import { adminApi } from '@/api';
import { LIST_LIMIT, countFromItems } from './catalogCounts';

/*
 * Katalog ma'lumotlari: brauzer keshi + yuklash.
 *
 *  • Guruh ochilganda — yangi serverda BITTA so'rov (`?categories=a,b,c`, serverda Redis keshidan); eski serverda
 *    kategoriyalar bo'yicha parallel so'rovlar.
 *  • Brauzer keshi (xotirada): guruh qayta ochilsa — oldingi ro'yxat DARHOL ko'rsatiladi, orqada yangisi yuklanadi
 *    (stale-while-revalidate). Har qanday yozuvdan keyin clear() — eskirgan ro'yxat ko'rsatilmaydi.
 *  • Oldindan yuklash (prefetch): kartochkaga kursor/barmoq tegishi bilan so'rov ketadi — bosilganda tayyor.
 */
const store = new Map();     // kalit → { at, items }
const inflight = new Map();  // kalit → Promise (bir xil so'rov ikki marta ketmasin)

export const keyOf = (cats) => cats.join(',');
export const peek = (cats) => store.get(keyOf(cats))?.items || null;
export const clear = () => { store.clear(); };

export function loadGroup(cats, { v2 = false } = {}) {
  const key = keyOf(cats);
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    const lists = v2
      ? [await adminApi.getCatalogGroup(cats)]
      : await Promise.all(cats.map((c) => adminApi.getCatalog(`?category=${encodeURIComponent(c)}`)));
    // Eski server `categories=` ni e'tiborsiz qoldirib, hamma narsani qaytarishi mumkin — faqat so'ralganlarini olamiz
    const want = new Set(cats);
    const items = lists.flat().filter((p) => want.has(p.category));
    store.set(key, { at: Date.now(), items });
    return items;
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Kartochkaga tegilganda: yangi (30 s dan yosh) ro'yxat bor yoki so'rov ketayotgan bo'lsa — hech narsa qilmaydi. */
export function prefetchGroup(cats, opts) {
  if (!cats.length) return;
  const hit = store.get(keyOf(cats));
  if (hit && Date.now() - hit.at < 30_000) return;
  loadGroup(cats, opts).catch(() => {});
}

/*
 * ESKI server (hisoblagich endpointi yo'q) va katalog 500 dan katta: umumiy ro'yxat 500 ta bilan kesiladi — undan sanash
 * noto'g'ri (kategoriyalar "0 ta" chiqardi). Shuning uchun har bir kategoriya ALOHIDA so'raladi (6 tadan parallel).
 * Kategoriyalar: ma'lum ro'yxat + umumiy ro'yxatda uchragan noma'lumlari. Qaytaradi: { rows, truncated }.
 */
export async function countPerCategory(knownValues, firstPage, concurrency = 6) {
  const cats = [...new Set([...knownValues, ...firstPage.map((p) => p.category)])];
  const rows = []; let truncated = false; let i = 0;
  async function worker() {
    while (i < cats.length) {
      const c = cats[i++];
      try {
        const items = await adminApi.getCatalog(`?category=${encodeURIComponent(c)}`);
        if (items.length >= LIST_LIMIT) truncated = true;
        rows.push(...countFromItems(items));
      } catch { /* bitta kategoriya xatosi butun sahifani to'xtatmasin */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, cats.length) }, worker));
  return { rows, truncated };
}
