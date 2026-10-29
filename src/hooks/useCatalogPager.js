import { useCallback, useEffect, useRef, useState } from 'react';
import { PAGE_SIZE, canon, fetchPage, takePrefetched } from '@/lib/catalogPager';

/*
 * Cheksiz aylantirish uchun sahifalagich (YouTube kabi): birinchi sahifa → pastga tushganda keyingisi qo'shiladi.
 *
 *   phase:  idle · loading (birinchi yuklash, ro'yxat yo'q) · refreshing (so'rov o'zgardi — eski ro'yxat xiralashib turadi)
 *           ready · more (keyingi sahifa yuklanmoqda — pastda skelet) · error
 *
 * Qoidalar (silliqlik):
 *   • Eskirgan javob (so'rov o'zgargach kelgan) HECH QACHON ko'rsatilmaydi (avlod hisoblagichi).
 *   • Keyingi sahifada takroriy mahsulotlar tashlanadi; offset server hisobi bilan yuritiladi (takror ko'paysa ham tsikl yo'q).
 *   • Keyingi sahifa xatosi cheksiz urinishga aylanmaydi: `moreError` + qo'lda qayta urinish.
 *   • Mahalliy o'zgarish (saqlash/o'chirish): ro'yxat qayta yuklanmaydi — joyida yangilanadi (aylanish joyi sakramaydi).
 */
const EMPTY = { items: [], total: 0, hasMore: false, offset: 0, error: null, moreError: null };

export function useCatalogPager(query, { v2 = false, pageSize = PAGE_SIZE, enabled = true } = {}) {
  const [st, setSt] = useState({ ...EMPTY, phase: enabled ? 'loading' : 'idle' });
  const [tick, setTick] = useState(0);
  const gen = useRef(0);
  const stRef = useRef(st); stRef.current = st;
  const qRef = useRef(query); qRef.current = query;
  const key = enabled ? canon({ ...query, offset: 0, limit: pageSize }) : '';

  // So'rov o'zgardi (qidiruv, saralash, filtr, chip, seed) → birinchi sahifadan boshlanadi
  useEffect(() => {
    if (!enabled) { gen.current += 1; setSt({ ...EMPTY, phase: 'idle' }); return; }
    const id = ++gen.current;
    setSt((s) => ({ ...s, phase: s.items.length ? 'refreshing' : 'loading', error: null, moreError: null }));
    const params = { ...qRef.current, offset: 0, limit: pageSize };
    const p = takePrefetched(params) || fetchPage(params, { v2 });
    p.then((r) => {
      if (id === gen.current) setSt({ items: r.items, total: r.total, hasMore: r.hasMore, offset: r.items.length, phase: 'ready', error: null, moreError: null });
    }).catch((e) => {
      if (id === gen.current) setSt((s) => ({ ...s, phase: 'error', error: e?.message || 'Yuklab bo‘lmadi' }));
    });
  }, [key, enabled, v2, pageSize, tick]);

  const loadMore = useCallback(() => {
    const s = stRef.current;
    if (s.phase !== 'ready' || !s.hasMore) return;
    const id = gen.current;
    setSt((x) => ({ ...x, phase: 'more', moreError: null }));
    fetchPage({ ...qRef.current, offset: s.offset, limit: pageSize }, { v2 })
      .then((r) => {
        if (id !== gen.current) return;
        setSt((x) => {
          const seen = new Set(x.items.map((p) => p._id));
          const add = r.items.filter((p) => !seen.has(p._id));
          return { ...x, items: add.length ? [...x.items, ...add] : x.items, total: r.total, offset: x.offset + r.items.length, hasMore: r.hasMore && r.items.length > 0, phase: 'ready' };
        });
      })
      .catch((e) => { if (id === gen.current) setSt((x) => ({ ...x, phase: 'ready', moreError: e?.message || 'Yuklab bo‘lmadi' })); });
  }, [pageSize, v2]);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  /** Mahsulot o'chirildi: ro'yxatdan olinadi; server ro'yxati ham qisqargani uchun keyingi sahifa offseti ham kamayadi. */
  const removeLocal = useCallback((id) => setSt((x) => {
    if (!x.items.some((p) => p._id === id)) return { ...x, total: Math.max(0, x.total - 1) };
    return { ...x, items: x.items.filter((p) => p._id !== id), total: Math.max(0, x.total - 1), offset: Math.max(0, x.offset - 1) };
  }), []);

  /** Mahsulot yangilandi/yaratildi: ro'yxatda bo'lsa joyida almashtiriladi; yo'q va `add` bo'lsa — boshiga qo'shiladi. */
  const upsertLocal = useCallback((product, { add = false } = {}) => setSt((x) => {
    const i = x.items.findIndex((p) => p._id === product._id);
    if (i >= 0) { const items = [...x.items]; items[i] = { ...items[i], ...product }; return { ...x, items }; }
    if (!add) return x;
    return { ...x, items: [product, ...x.items], total: x.total + 1 };
  }), []);

  return { ...st, loadMore, reload, removeLocal, upsertLocal };
}
