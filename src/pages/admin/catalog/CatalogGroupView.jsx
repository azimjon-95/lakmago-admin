import { useEffect, useMemo, useRef, useState } from 'react';
import { categoryLabel, catsOfGroup } from '@/constants/catalogGroups';
import { groupCoverImg, BANNER_SIZES } from '@/lib/catalogCovers';
import { newSeed, seedForOpen } from '@/lib/catalogPager';
import { useCatalogPager } from '@/hooks/useCatalogPager';
import { ProductCard, ProductCardSkeleton } from './CatalogCards';
import { InfiniteGrid } from './InfiniteGrid';

const SORTS = [
  ['random', 'Aralash (tasodifiy)'], ['name', "Nomi bo'yicha (A–Z)"], ['name_desc', "Nomi bo'yicha (Z–A)"],
  ['usage', "Ko'p ishlatilgan"], ['new', "Yangi qo'shilgan"],
];
const NO_FILTER = { status: 'all', image: 'all' };

/** Qiymat o'zgarishini `ms` kechiktiradi (qidiruvda har harfga so'rov ketmasin). */
function useDebounced(value, ms) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/*
 * Guruh ichi: orqaga + nom + "N ta mahsulot" + qidiruv; muqova rasm; nom va tavsif; pastki kategoriyalar CHIPLARI;
 * saralash va filtr; mahsulot kartochkalari (telefonda 2 ta, 640 px dan 3 ta bir qatorda).
 *
 * MA'LUMOT: guruhda minglab mahsulot bo'lishi mumkin, shuning uchun HAMMASI yuklanmaydi:
 *   • ochilganda 100 ta, HAR SAFAR TASODIFIY (seed bilan: aylantirish davomida tartib barqaror);
 *   • pastga tushganda skelet → keyingi 100 ta qo'shiladi (cheksiz aylantirish);
 *   • qidiruv, filtr, saralash, chip — BUTUN to'plam bo'yicha (serverda), yuklangan 100 ta bilan cheklanmaydi;
 *   • saqlash/o'chirish — ro'yxat qayta yuklanmaydi, joyida yangilanadi (`change`).
 */
export function CatalogGroupView({ group, sub, onSub, onBack, onAdd, onEdit, onDelete, version, v2, change }) {
  const cats = useMemo(() => catsOfGroup(group), [group.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [seed, setSeed] = useState(() => seedForOpen(cats));
  const [sort, setSort] = useState('random');
  const [filter, setFilter] = useState(NO_FILTER);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 300);
  const popRef = useRef(null);
  const cover = groupCoverImg(group.id);

  // Qidiruv bor va saralash "Aralash" bo'lsa — mosligi bo'yicha (relevance); foydalanuvchi boshqa saralash tanlagan bo'lsa — o'sha
  const query = useMemo(() => ({
    cats: sub ? [sub] : cats, q: dq, status: filter.status, image: filter.image,
    sort: dq && sort === 'random' ? 'relevance' : sort, seed,
  }), [sub, cats, dq, filter.status, filter.image, sort, seed]);
  const pager = useCatalogPager(query, { v2 });
  const { items, total, phase, error, reload, removeLocal, upsertLocal } = pager;

  // ZIP import kabi katta o'zgarishdan keyin — to'liq qayta yuklash (bir xil seed: tartib o'zgarmaydi)
  const firstVersion = useRef(version);
  useEffect(() => { if (version !== firstVersion.current) reload(); }, [version, reload]);

  // Bitta mahsulot saqlandi/o'chirildi: ro'yxat joyida yangilanadi
  const lastChange = useRef(null);
  useEffect(() => {
    if (!change || change.n === lastChange.current) return;
    lastChange.current = change.n;
    if (change.kind === 'remove') removeLocal(change.id);
    else if (change.kind === 'deactivate') upsertLocal({ _id: change.id, isActive: false });
    else if (change.kind === 'upsert' && change.product) {
      const p = change.product;
      const belongs = cats.includes(p.category) && (!sub || sub === p.category);
      if (!belongs) removeLocal(p._id);
      else upsertLocal(p, { add: !dq && filter.status === 'all' && filter.image === 'all' });
    }
  }, [change]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filtr oynasi: tashqariga bosilsa / Escape — yopiladi
  useEffect(() => {
    if (!filterOpen) return undefined;
    const off = (e) => { if (e.type === 'keydown' ? e.key === 'Escape' : !popRef.current?.contains(e.target)) setFilterOpen(false); };
    document.addEventListener('mousedown', off); document.addEventListener('keydown', off);
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', off); };
  }, [filterOpen]);

  const activeFilters = (filter.status !== 'all' ? 1 : 0) + (filter.image !== 'all' ? 1 : 0);
  const narrowed = Boolean(dq || activeFilters || sub);
  const firstLoad = phase === 'loading' && items.length === 0;
  const empty = phase !== 'loading' && phase !== 'refreshing' && items.length === 0 && !error;
  const chooseSort = (v) => { setSort(v); if (v === 'random') setSeed(newSeed()); };
  const reset = () => { setQ(''); setFilter(NO_FILTER); onSub(''); };

  return (
    <div className="mx-auto max-w-6xl pb-10">
      <header className="flex items-center gap-3 p-4 pb-3 sm:p-6 sm:pb-3">
        <button type="button" onClick={onBack} aria-label="Orqaga" className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-canvas text-ink transition hover:bg-line">
          <i className="ti ti-arrow-left text-xl" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold leading-tight text-ink">{group.label}</h1>
          <p className="text-xs text-muted">{group.total} ta mahsulot</p>
        </div>
        <button type="button" onClick={() => setSearchOpen((v) => !v)} aria-label="Qidirish" aria-pressed={searchOpen}
          className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl transition ${searchOpen ? 'bg-brand-400 text-brand-text' : 'bg-canvas text-ink hover:bg-line'}`}>
          <i className="ti ti-search text-xl" />
        </button>
        <button type="button" onClick={onAdd} aria-label="Qo'shish" className="flex h-10 flex-none items-center gap-1.5 rounded-xl bg-brand-400 px-3.5 text-sm font-semibold text-brand-text transition hover:bg-brand-600 hover:text-white">
          <i className="ti ti-plus" /> <span className="hidden sm:inline">Qo'shish</span>
        </button>
      </header>

      {searchOpen && (
        <div className="px-4 pb-3 sm:px-6">
          <div className="relative">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`${group.label} ichidan qidirish (${group.total} ta ichidan)…`} className="inp !rounded-xl !py-2.5 !pr-10" />
            {q && (
              <button type="button" onClick={() => setQ('')} aria-label="Tozalash" className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-canvas">
                <i className="ti ti-x" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Muqova */}
      <div className="relative mx-4 h-44 overflow-hidden rounded-2xl sm:mx-6 sm:h-56" style={{ background: `linear-gradient(135deg, ${group.from}, ${group.to})` }}>
        {cover
          ? <img src={cover.src} srcSet={cover.srcSet || undefined} sizes={cover.srcSet ? BANNER_SIZES : undefined} alt="" fetchPriority="high" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
          : <span className="absolute inset-0 flex select-none items-center justify-center text-8xl opacity-30" aria-hidden="true">{group.emoji}</span>}
        <span className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
      </div>

      {/* Nom, tavsif, chiplar, saralash — muqovaga "yopishgan" oq karta */}
      <section className="relative z-[1] mx-4 -mt-6 rounded-2xl border border-line bg-white p-4 shadow-sm sm:mx-6 sm:p-5">
        <h2 className="text-2xl font-bold text-ink">{group.label}</h2>
        <p className="mt-1 text-sm text-muted">{group.hint}</p>

        {/* Faqat bitta kategoriyali kartochkada (masalan «Maishiy kimyo») chiplar ortiqcha — yashiriladi */}
        {group.subs.length > 1 && (
        <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Pastki kategoriyalar">
          {[{ category: '', total: group.total }, ...group.subs].map((s) => {
            const on = (s.category || '') === (sub || '');
            return (
              <button key={s.category || 'all'} type="button" role="tab" aria-selected={on} onClick={() => onSub(s.category || '')}
                className={`flex flex-none items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-semibold transition ${on ? 'border-brand-400 bg-brand-400 text-brand-text' : 'border-line bg-white text-ink hover:bg-canvas'}`}>
                {s.category ? categoryLabel(s.category) : 'Barchasi'}
                <span className={`rounded-full px-2 py-0.5 text-xs ${on ? 'bg-white/45' : 'bg-canvas text-muted'}`}>{s.total}</span>
              </button>
            );
          })}
        </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <label className="relative min-w-0 flex-1">
            <i className="ti ti-arrows-sort pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-muted" aria-hidden="true" />
            <select value={sort} onChange={(e) => chooseSort(e.target.value)} aria-label="Saralash" className="inp !rounded-xl !py-2.5 !pl-10 font-medium">
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          {sort === 'random' && (
            <button type="button" onClick={() => setSeed(newSeed())} aria-label="Qayta aralashtirish" title="Qayta aralashtirish"
              className="flex h-[42px] w-[46px] flex-none items-center justify-center rounded-xl border border-line bg-white text-ink transition hover:bg-canvas">
              <i className="ti ti-arrows-shuffle text-xl" />
            </button>
          )}
          <div className="relative flex-none" ref={popRef}>
            <button type="button" onClick={() => setFilterOpen((v) => !v)} aria-label="Filtr" aria-expanded={filterOpen}
              className={`relative flex h-[42px] w-[46px] items-center justify-center rounded-xl border transition ${activeFilters ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-line bg-white text-ink hover:bg-canvas'}`}>
              <i className="ti ti-adjustments-horizontal text-xl" />
              {activeFilters > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-400 px-1 text-[10px] font-bold text-brand-text">{activeFilters}</span>}
            </button>
            {filterOpen && (
              <div className="absolute right-0 z-20 mt-2 w-64 rounded-2xl border border-line bg-white p-3 shadow-xl" role="dialog" aria-label="Filtr">
                <FilterGroup title="Holat" value={filter.status} onChange={(v) => setFilter((f) => ({ ...f, status: v }))}
                  options={[['all', 'Hammasi'], ['active', 'Faol'], ['inactive', 'Nofaol']]} />
                <FilterGroup title="Rasm" value={filter.image} onChange={(v) => setFilter((f) => ({ ...f, image: v }))}
                  options={[['all', 'Hammasi'], ['with', 'Rasmli'], ['without', 'Rasmsiz']]} />
                {activeFilters > 0 && <button type="button" onClick={() => setFilter(NO_FILTER)} className="mt-1 w-full rounded-lg py-2 text-sm font-medium text-brand-600 hover:bg-canvas">Tozalash</button>}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mt-5 px-4 sm:px-6">
        {narrowed && phase !== 'loading' && !error && (
          <p className="mb-3 text-sm text-muted" aria-live="polite" data-testid="result-count">
            {dq ? <>«{dq}» bo'yicha </> : null}<b className="text-ink">{total}</b> ta {dq ? 'topildi' : 'mahsulot'}
            {phase === 'refreshing' && <span className="ml-2 text-xs">yangilanmoqda…</span>}
          </p>
        )}

        {firstLoad ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4" aria-busy="true">{Array.from({ length: 12 }, (_, i) => <ProductCardSkeleton key={i} />)}</div>
        ) : error && items.length === 0 ? (
          <div className="rounded-2xl bg-red-50 px-4 py-6 text-center text-sm text-red-700" role="alert">
            {error}
            <button type="button" onClick={reload} className="ml-3 rounded-lg border border-red-200 bg-white px-3 py-1.5 font-medium">Qayta urinish</button>
          </div>
        ) : empty ? (
          narrowed ? (
            <div className="py-12 text-center text-sm text-muted">
              Hech narsa topilmadi
              <button type="button" onClick={reset} className="ml-2 font-semibold text-brand-600">Filtrni tozalash</button>
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-3xl" aria-hidden="true">{group.emoji}</div>
              <div className="font-semibold text-ink">Bu kategoriyada hali mahsulot yo'q</div>
              <button type="button" onClick={onAdd} className="mt-4 rounded-xl bg-brand-400 px-5 py-2.5 text-sm font-semibold text-brand-text hover:bg-brand-600 hover:text-white"><i className="ti ti-plus mr-1.5" />Birinchi mahsulotni qo'shish</button>
            </div>
          )
        ) : (
          <InfiniteGrid
            pager={pager}
            renderCard={(p, i) => <ProductCard key={p._id} p={p} priority={i < 6} tag={categoryLabel(p.category)} onEdit={() => onEdit(p)} onDelete={() => onDelete(p)} />}
          />
        )}
        {!pager.hasMore && items.length > 100 && phase === 'ready' && (
          <p className="mt-6 text-center text-xs text-muted" data-testid="end-note">Hammasi ko'rsatildi · {total} ta</p>
        )}
      </div>
    </div>
  );
}

function FilterGroup({ title, value, onChange, options }) {
  return (
    <fieldset className="mb-2">
      <legend className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted">{title}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map(([v, l]) => (
          <button key={v} type="button" onClick={() => onChange(v)} aria-pressed={value === v}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${value === v ? 'border-brand-400 bg-brand-400 text-brand-text' : 'border-line bg-white text-ink hover:bg-canvas'}`}>{l}</button>
        ))}
      </div>
    </fieldset>
  );
}
