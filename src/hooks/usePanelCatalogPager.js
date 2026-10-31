import { useCallback, useEffect, useRef, useState } from 'react';
import { panelApi } from '@/api';

/*
 * Restoran/do'kon katalogini sahifalab yuklash: GET /panel/catalog/page (server: faqat faol, ruxsat etilgan kategoriyalar).
 * query: { cats: [], q: '', sort: '' }. Bir xil so'rov kaliti o'zgarmasa qayta yuklanmaydi; eskirgan javob e'tiborsiz.
 */
const PAGE = 40;
const EMPTY = { items: [], total: 0, hasMore: false, offset: 0, error: null, moreError: null };

const toQs = (p, offset) => {
  const qs = new URLSearchParams();
  if (p.cats?.length) qs.set('categories', p.cats.join(','));
  if (p.q) qs.set('q', p.q);
  if (p.sort) qs.set('sort', p.sort);
  qs.set('limit', String(PAGE)); qs.set('offset', String(offset));
  return qs.toString();
};

export function usePanelCatalogPager(query, { enabled = true } = {}) {
  const [st, setSt] = useState({ ...EMPTY, phase: enabled ? 'loading' : 'idle' });
  const [tick, setTick] = useState(0);
  const gen = useRef(0);
  const stRef = useRef(st); stRef.current = st;
  const qRef = useRef(query); qRef.current = query;
  const key = enabled ? JSON.stringify({ c: query.cats || [], q: query.q || '', s: query.sort || '' }) : '';

  useEffect(() => {
    if (!enabled) { gen.current += 1; setSt({ ...EMPTY, phase: 'idle' }); return; }
    const id = ++gen.current;
    setSt((s) => ({ ...s, phase: s.items.length ? 'refreshing' : 'loading', error: null, moreError: null }));
    panelApi.getPanelCatalogPage(toQs(qRef.current, 0))
      .then((r) => { if (id === gen.current) setSt({ items: r.items, total: r.total, hasMore: r.hasMore, offset: r.items.length, phase: 'ready', error: null, moreError: null }); })
      .catch((e) => { if (id === gen.current) setSt((s) => ({ ...s, phase: 'error', error: e?.message || 'Yuklab bo‘lmadi' })); });
  }, [key, enabled, tick]);

  const loadMore = useCallback(() => {
    const s = stRef.current;
    if (s.phase !== 'ready' || !s.hasMore) return;
    const id = gen.current;
    setSt((x) => ({ ...x, phase: 'more', moreError: null }));
    panelApi.getPanelCatalogPage(toQs(qRef.current, s.offset))
      .then((r) => {
        if (id !== gen.current) return;
        setSt((x) => {
          const seen = new Set(x.items.map((p) => p._id));
          const add = r.items.filter((p) => !seen.has(p._id));
          return { ...x, items: add.length ? [...x.items, ...add] : x.items, total: r.total, offset: x.offset + r.items.length, hasMore: r.hasMore && r.items.length > 0, phase: 'ready' };
        });
      })
      .catch((e) => { if (id === gen.current) setSt((x) => ({ ...x, phase: 'ready', moreError: e?.message || 'Yuklab bo‘lmadi' })); });
  }, []);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { ...st, loadMore, reload };
}
