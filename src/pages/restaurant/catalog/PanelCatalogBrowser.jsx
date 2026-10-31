import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { panelApi } from '@/api';
import { Img } from '@/components/Img';
import { categoryLabel, summarizeGroups } from '@/constants/catalogGroups';
import { GroupCard, ProductCardSkeleton } from '@/pages/admin/catalog/CatalogCards';
import { useDebounced } from '@/hooks/useDebounced';
import { usePanelCatalogPager } from '@/hooks/usePanelCatalogPager';
import { countLabel, fmtInt } from '@/lib/catalogTotals';

/*
 * ═══ RESTORAN / DO'KON KATALOGI — admin bilan BIR XIL ko'rinish ═══
 * Guruh kartochkalari (rasmli, sonli) → ichida mahsulotlar (kartochka) → tanlangani onPick(product) bilan qaytadi
 * (narx formasi chaqiruvchida: restoran — narx, do'kon — narx + market maydonlari). Qidiruv — butun ko'rinadigan katalog bo'yicha.
 *
 * Nimani ko'rishi serverda belgilanadi (restoran — faqat ichimliklar, do'kon — hammasi); bu yerda faqat chiziladi.
 * ESKI server (yangi endpoint yo'q → 404) bo'lsa onUnavailable() chaqiriladi — chaqiruvchi eski ro'yxatga qaytadi.
 */
const clamp = (n) => ({ display: '-webkit-box', WebkitLineClamp: n, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' });

export function PanelCatalogBrowser({ onPick, onUnavailable }) {
  const [st, setSt] = useState({ phase: 'loading', groups: [], error: '' });
  const [openId, setOpenId] = useState(null);
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 300);
  const scroller = useRef(null);
  const unavailable = useRef(onUnavailable); unavailable.current = onUnavailable;

  const load = useCallback(() => {
    setSt((s) => ({ ...s, phase: 'loading', error: '' }));
    panelApi.getPanelCatalogCounts()
      .then((r) => {
        const { groups } = summarizeGroups(r.counts || []);
        setSt({ phase: 'ready', groups: groups.filter((g) => g.total > 0), error: '' });
      })
      .catch((e) => {
        if (e?.status === 404) { unavailable.current?.(); return; }
        setSt((s) => ({ ...s, phase: 'error', error: e?.message || 'Katalogni yuklab bo‘lmadi' }));
      });
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = st.groups.find((g) => g.id === openId) || null;
  const searching = !open && dq.length >= 2;

  if (st.phase === 'loading') {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }, (_, i) => <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-line" />)}</div>
      </div>
    );
  }
  if (st.phase === 'error') {
    return (
      <div className="flex-1 px-5 py-10 text-center">
        <div className="text-sm font-semibold text-ink">{st.error}</div>
        <button type="button" onClick={load} className="mt-3 rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink">Qayta urinish</button>
      </div>
    );
  }
  if (!st.groups.length) {
    return (
      <div className="flex-1 px-5 py-12 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-canvas"><i className="ti ti-package-off text-2xl text-muted" /></div>
        <div className="text-sm font-semibold text-ink">Katalog hali to‘ldirilmagan</div>
        <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-muted">Katalogni LokmaGo administratori to‘ldiradi. Hozircha mahsulotni qo‘lda qo‘shishingiz mumkin.</p>
      </div>
    );
  }

  return (
    <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" data-testid="panel-catalog">
      {open ? (
        <GroupPanel key={open.id} group={open} root={scroller} onBack={() => setOpenId(null)} onPick={onPick} />
      ) : (
        <>
          <div className="sticky top-0 z-10 -mx-4 bg-white px-4 pb-2 pt-3">
            <div className="relative">
              <i className="ti ti-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mahsulot qidirish…" data-testid="panel-catalog-search"
                className="inp pl-9 pr-9" enterKeyHint="search" autoComplete="off"
              />
              {q && <button type="button" onClick={() => setQ('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" aria-label="Tozalash"><i className="ti ti-x" /></button>}
            </div>
          </div>
          {searching ? (
            <SearchResults q={dq} root={scroller} onPick={onPick} />
          ) : (
            <>
              <div className="mb-3 mt-1 flex items-baseline justify-between">
                <h3 className="text-base font-bold text-ink">Kategoriyalar</h3>
                <span className="text-xs text-muted" data-testid="panel-catalog-count">{countLabel(st.groups)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {st.groups.map((g, i) => <GroupCard key={g.id} g={g} priority={i < 4} onOpen={() => setOpenId(g.id)} onWarm={() => {}} />)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ───────── Guruh ichi: pastki kategoriya chiplari, qidiruv, mahsulotlar ───────── */
function GroupPanel({ group, root, onBack, onPick }) {
  const [sub, setSub] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 300);
  const cats = useMemo(() => (sub ? [sub] : group.subs.map((s) => s.category)), [sub, group]);
  const query = useMemo(() => ({ cats, q: dq, sort: dq ? 'relevance' : 'usage' }), [cats, dq]);
  const pager = usePanelCatalogPager(query);

  return (
    <>
      <div className="sticky top-0 z-10 -mx-4 bg-white px-4 pb-2 pt-3">
        <button type="button" onClick={onBack} className="mb-2 flex items-center gap-1 text-sm font-medium text-muted hover:text-ink" data-testid="panel-catalog-back">
          <i className="ti ti-chevron-left" /> Kategoriyalar
        </button>
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="min-w-0 truncate text-lg font-bold text-ink">{group.label}</h3>
          <span className="flex-none text-xs text-muted">{fmtInt(group.total)} ta mahsulot</span>
        </div>
        {group.subs.length > 1 && (
          <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: 'none' }}>
            <Chip active={!sub} onClick={() => setSub('')}>Hammasi</Chip>
            {group.subs.map((s) => <Chip key={s.category} active={sub === s.category} onClick={() => setSub(s.category)}>{categoryLabel(s.category)} <span className="opacity-60">{fmtInt(s.total)}</span></Chip>)}
          </div>
        )}
        <div className="relative mt-2">
          <i className="ti ti-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`${group.label} ichida qidirish…`} className="inp pl-9" autoComplete="off" />
        </div>
      </div>
      <ProductGrid pager={pager} root={root} onPick={onPick} emptyText={dq ? 'Topilmadi' : 'Bu bo‘limda mahsulot yo‘q'} />
    </>
  );
}

function SearchResults({ q, root, onPick }) {
  const query = useMemo(() => ({ cats: [], q, sort: 'relevance' }), [q]);
  const pager = usePanelCatalogPager(query);
  return (
    <>
      <div className="mb-3 mt-1 text-xs text-muted">{pager.phase === 'loading' ? 'Qidirilmoqda…' : `“${q}” bo‘yicha ${fmtInt(pager.total)} ta natija`}</div>
      <ProductGrid pager={pager} root={root} onPick={onPick} emptyText="Topilmadi — boshqa nom bilan qidiring yoki mahsulotni qo‘lda qo‘shing" />
    </>
  );
}

const Chip = ({ active, onClick, children }) => (
  <button type="button" onClick={onClick} className={`flex-none whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition ${active ? 'border-brand-400 bg-brand-400 text-brand-text' : 'border-line bg-white text-muted hover:border-brand-400'}`}>{children}</button>
);

/* ───────── Mahsulot kartochkalari + cheksiz aylantirish (aylantirish konteyneri — root) ───────── */
function ProductGrid({ pager, root, onPick, emptyText }) {
  const { items, hasMore, phase, error, moreError, loadMore, reload, offset } = pager;
  const sentinel = useRef(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || moreError || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) loadMore(); }, { root: root?.current || null, rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, moreError, loadMore, items.length, offset, root]);

  if (phase === 'loading' && !items.length) return <div className="grid grid-cols-2 gap-3">{Array.from({ length: 6 }, (_, i) => <ProductCardSkeleton key={i} />)}</div>;
  if (phase === 'error' && !items.length) {
    return (<div className="py-10 text-center"><div className="text-sm text-red-600">{error}</div><button type="button" onClick={reload} className="mt-3 rounded-xl border border-line px-4 py-2 text-sm font-medium">Qayta urinish</button></div>);
  }
  if (!items.length) return <div className="px-4 py-12 text-center text-sm text-muted">{emptyText}</div>;
  return (
    <>
      <div className={`grid grid-cols-2 gap-3 transition-opacity ${phase === 'refreshing' ? 'opacity-50' : ''}`} aria-busy={phase !== 'ready'}>
        {items.map((p, i) => <PanelProductCard key={p._id} p={p} priority={i < 6} onPick={onPick} />)}
        {phase === 'more' && Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={`sk${i}`} />)}
      </div>
      {hasMore && !moreError && <div ref={sentinel} aria-hidden="true" className="h-px" data-sentinel="" />}
      {moreError && <div className="mt-4 flex items-center justify-center gap-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{moreError}<button type="button" onClick={loadMore} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 font-medium">Qayta urinish</button></div>}
    </>
  );
}

function PanelProductCard({ p, priority, onPick }) {
  const added = p.alreadyAdded;
  return (
    <button
      type="button" disabled={added} onClick={() => onPick(p)} data-testid="panel-product"
      style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 240px' }}
      className={`group flex flex-col overflow-hidden rounded-2xl border border-line bg-white text-left shadow-sm transition ${added ? 'opacity-60' : 'hover:shadow-md active:scale-[0.98]'}`}
    >
      <div className="relative aspect-[4/3] bg-canvas">
        {p.imageUrl
          ? <Img src={p.imageUrl} w={360} priority={priority} alt="" className="absolute inset-0 h-full w-full object-contain p-1.5" />
          : <span className="absolute inset-0 flex items-center justify-center text-muted"><i className="ti ti-photo-off text-2xl" /></span>}
        {added && <span className="absolute left-2 top-2 rounded-full bg-green-600 px-2 py-0.5 text-[11px] font-semibold text-white">Qo‘shilgan</span>}
      </div>
      <div className="flex flex-1 flex-col p-2.5">
        <b className="text-[13px] font-semibold leading-snug text-ink" style={clamp(2)}>{p.name}</b>
        {p.volume ? <span className="mt-0.5 text-[11px] text-muted">{p.volume}</span> : null}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="text-xs font-medium text-muted">{p.suggestedPrice > 0 ? `~${fmtInt(p.suggestedPrice)} so‘m` : '\u00a0'}</span>
          {!added && <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand-400 text-brand-text" aria-hidden="true"><i className="ti ti-plus" /></span>}
        </div>
      </div>
    </button>
  );
}
