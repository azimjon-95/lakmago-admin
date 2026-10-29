import { adminApi } from '@/api';
import { loadGroup, peek, prefetchGroup as prefetchAll } from './catalogData';
import { metaOf, newSeed, queryPage } from './catalogPaging';

/*
 * Katalog sahifalash — ma'lumot manbai.
 *
 *  • YANGI server: GET /admin/catalog/page — filtr, qidiruv, saralash, tasodifiy tartib va bo'lak SERVERDA (Redis keshidan,
 *    ~6 ms). Mijozga faqat 100 ta keladi.
 *  • ESKI server (404): butun guruh yuklanadi va SHU mantiq (lib/catalogPaging.js — serverdagi bilan bir xil) bilan
 *    mijozda sahifalanadi — foydalanuvchi uchun xatti-harakat bir xil (faqat birinchi yuklash sekinroq).
 *  • Oldindan yuklash: kartochkaga kursor/barmoq tegishi bilan birinchi sahifa so'raladi (bosilganda tayyor).
 */
export const PAGE_SIZE = 100;
const FRESH_MS = 20_000;
let pageApi = null;   // null — noma'lum · true — yangi server · false — eski server (404)
export const pageApiState = () => pageApi;
export { newSeed };

/** So'rov parametrlarini bir xil tartibda yozadi (kesh/prefetch kaliti uchun). */
export const canon = (p) => JSON.stringify({
  cats: p.cats || [], q: p.q || '', status: p.status || 'all', image: p.image || 'all', sort: p.sort || 'name', seed: p.seed || '',
  offset: p.offset || 0, limit: p.limit || PAGE_SIZE,
});

function toQs(p) {
  const qs = new URLSearchParams();
  if (p.cats?.length) qs.set('categories', p.cats.join(','));
  if (p.q) qs.set('q', p.q);
  if (p.status && p.status !== 'all') qs.set('status', p.status);
  if (p.image && p.image !== 'all') qs.set('image', p.image);
  if (p.sort) qs.set('sort', p.sort);
  if (p.seed) qs.set('seed', p.seed);
  qs.set('limit', String(p.limit)); qs.set('offset', String(p.offset));
  return qs.toString();
}

// ── Eski server zaxirasi ──
const metaCache = new WeakMap();
const metasOf = (items) => { let m = metaCache.get(items); if (!m) { m = items.map(metaOf); metaCache.set(items, m); } return m; };
let legacyGlobal = { q: null, items: [] };

async function legacy(p, { v2 }) {
  let items;
  if (p.cats?.length) {
    // Birinchi sahifada yangidan yuklanadi; keyingilarida xotiradagi ro'yxatdan (har sahifada server so'ralmaydi)
    items = (p.offset > 0 && peek(p.cats)) || await loadGroup(p.cats, { v2 });
  } else {
    // Umumiy qidiruv: eski serverda `?q=` ≤ 500 ta natija beradi
    if (p.offset === 0 || legacyGlobal.q !== p.q) legacyGlobal = { q: p.q, items: await adminApi.getCatalog(`?q=${encodeURIComponent(p.q || '')}`) };
    items = legacyGlobal.items;
  }
  return queryPage(items, metasOf(items), p);
}

/** Bitta sahifa: { items, total, hasMore, seed, offset, limit }. */
export async function fetchPage(params, { v2 = false } = {}) {
  const p = { limit: PAGE_SIZE, offset: 0, ...params };
  if (pageApi !== false) {
    try {
      const r = await adminApi.getCatalogPage(toQs(p));
      pageApi = true;
      return r;
    } catch (e) {
      if (e?.status === 404 && pageApi !== true) pageApi = false;   // endpoint yo'q — eski server
      else throw e;
    }
  }
  return legacy(p, { v2 });
}

// ── Oldindan yuklash ──
const prefetched = new Map();   // canon(params) → { at, promise }
const seeds = new Map();        // kategoriyalar kaliti → { seed, at }
export const defaultQuery = (cats, seed) => ({ cats, q: '', status: 'all', image: 'all', sort: 'random', seed, offset: 0, limit: PAGE_SIZE });

export function takePrefetched(params) {
  const key = canon(params);
  const hit = prefetched.get(key);
  if (!hit || Date.now() - hit.at > FRESH_MS) return null;
  prefetched.delete(key);
  return hit.promise;
}

/** Guruh ochilganda ishlatiladigan seed: kursor tekkanda tayyorlangani (birinchi sahifa allaqachon yo'lda) yoki yangisi. */
export function seedForOpen(cats) {
  const k = cats.join(',');
  const s = seeds.get(k);
  seeds.delete(k);
  return s && Date.now() - s.at < FRESH_MS ? s.seed : newSeed();
}

export function prefetchGroup(cats, opts = {}) {
  if (!cats.length) return;
  if (pageApi === false) { prefetchAll(cats, opts); return; }          // eski server: butun guruhni oldindan yuklash
  const k = cats.join(',');
  const cur = seeds.get(k);
  if (cur && Date.now() - cur.at < FRESH_MS) return;                    // allaqachon yo'lda
  const seed = newSeed();
  seeds.set(k, { seed, at: Date.now() });
  const params = defaultQuery(cats, seed);
  const promise = fetchPage(params, opts);
  promise.catch(() => {});
  prefetched.set(canon(params), { at: Date.now(), promise });
}
