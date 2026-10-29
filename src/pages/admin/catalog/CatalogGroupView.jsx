import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadGroup, peek } from '@/lib/catalogData';
import { categoryLabel } from '@/constants/catalogGroups';
import { filterProducts, sortProducts } from '@/lib/catalogCounts';
import { groupCover } from '@/lib/catalogCovers';
import { ProductCard } from './CatalogCards';

const SORTS = [
  ['name', "Nomi bo'yicha (A–Z)"], ['name_desc', "Nomi bo'yicha (Z–A)"],
  ['usage', "Ko'p ishlatilgan"], ['new', "Yangi qo'shilgan"],
];

/*
 * Guruh ichi (maket, o'ng ekran): orqaga + nom + "N ta mahsulot" + qidiruv; muqova rasm; nom va tavsif;
 * pastki kategoriyalar CHIPLARI ("Barchasi 12", "Mol go'shti 4"…); saralash va filtr; mahsulot kartochkalari
 * (telefonda 2 ta, 640 px dan 3 ta bir qatorda).
 */
export function CatalogGroupView({ group, sub, onSub, onBack, onAdd, onEdit, onDelete, version, v2 }) {
  // Brauzer keshida shu guruh bor bo'lsa — DARHOL ko'rsatiladi (orqada yangisi yuklanadi)
  const [products, setProducts] = useState(() => peek(group.subs.map((s) => s.category)) || []);
  const [loading, setLoading] = useState(() => !peek(group.subs.map((s) => s.category)));
  const [error, setError] = useState(null);
  const [sort, setSort] = useState('name');
  const [filter, setFilter] = useState({ status: 'all', image: 'all' });
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState('');
  const popRef = useRef(null);
  const cover = groupCover(group.id);

  /*
   * Yuklash: yangi serverda BITTA so'rov (Redis keshidan, 500 kesishsiz); eski serverda kategoriyalar bo'yicha parallel.
   * Kesh bor bo'lsa ro'yxat allaqachon ko'rinib turibdi — shunchaki orqada yangilanadi (loading ko'rsatilmaydi).
   */
  const cats = useMemo(() => group.subs.map((s) => s.category), [group.subs]);
  const hasData = useRef(products.length > 0);   // saqlash/o'chirishdan keyin ro'yxat "skelet"ga qaytib miltillamasin
  useEffect(() => { hasData.current = products.length > 0; }, [products]);
  const load = useCallback(() => {
    if (!cats.length) { setProducts([]); setLoading(false); return () => {}; }
    let dead = false;
    setError(null);
    if (!peek(cats) && !hasData.current) setLoading(true);
    loadGroup(cats, { v2 })
      .then((items) => { if (!dead) setProducts(items); })
      .catch((e) => { if (!dead) setError(e.message || 'Yuklab bo‘lmadi'); })
      .finally(() => { if (!dead) setLoading(false); });
    return () => { dead = true; };
  }, [cats, v2]);
  useEffect(() => load(), [load, version]);

  // Filtr oynasi: tashqariga bosilsa / Escape — yopiladi
  useEffect(() => {
    if (!filterOpen) return undefined;
    const off = (e) => { if (e.type === 'keydown' ? e.key === 'Escape' : !popRef.current?.contains(e.target)) setFilterOpen(false); };
    document.addEventListener('mousedown', off); document.addEventListener('keydown', off);
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', off); };
  }, [filterOpen]);

  const inSub = useMemo(() => (sub ? products.filter((p) => p.category === sub) : products), [products, sub]);
  const shown = useMemo(() => sortProducts(filterProducts(inSub, { ...filter, q }), sort), [inSub, filter, q, sort]);
  const activeFilters = (filter.status !== 'all' ? 1 : 0) + (filter.image !== 'all' ? 1 : 0);
  const noPhoto = useMemo(() => products.filter((p) => !p.imageUrl).length, [products]);

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
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`${group.label} ichidan qidirish…`} className="inp !rounded-xl !py-2.5" />
        </div>
      )}

      {/* Muqova */}
      <div className="relative mx-4 h-44 overflow-hidden rounded-2xl sm:mx-6 sm:h-56" style={{ background: `linear-gradient(135deg, ${group.from}, ${group.to})` }}>
        {cover
          ? <img src={cover} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
          : <span className="absolute inset-0 flex select-none items-center justify-center text-8xl opacity-30" aria-hidden="true">{group.emoji}</span>}
        <span className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
      </div>

      {/* Nom, tavsif, chiplar, saralash — muqovaga "yopishgan" oq karta */}
      <section className="relative z-[1] mx-4 -mt-6 rounded-2xl border border-line bg-white p-4 shadow-sm sm:mx-6 sm:p-5">
        <h2 className="text-2xl font-bold text-ink">{group.label}</h2>
        <p className="mt-1 text-sm text-muted">{group.hint}</p>

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

        <div className="mt-3 flex items-center gap-2">
          <label className="relative min-w-0 flex-1">
            <i className="ti ti-arrows-sort pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-muted" aria-hidden="true" />
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Saralash" className="inp !rounded-xl !py-2.5 !pl-10 font-medium">
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
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
                  options={[['all', 'Hammasi'], ['with', 'Rasmli'], ['without', `Rasmsiz${noPhoto ? ` (${noPhoto})` : ''}`]]} />
                {activeFilters > 0 && <button type="button" onClick={() => setFilter({ status: 'all', image: 'all' })} className="mt-1 w-full rounded-lg py-2 text-sm font-medium text-brand-600 hover:bg-canvas">Tozalash</button>}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mt-5 px-4 sm:px-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-line" />)}</div>
        ) : error ? (
          <div className="rounded-2xl bg-red-50 px-4 py-6 text-center text-sm text-red-700">
            {error}
            <button type="button" onClick={load} className="ml-3 rounded-lg border border-red-200 bg-white px-3 py-1.5 font-medium">Qayta urinish</button>
          </div>
        ) : products.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-3xl" aria-hidden="true">{group.emoji}</div>
            <div className="font-semibold text-ink">Bu kategoriyada hali mahsulot yo'q</div>
            <button type="button" onClick={onAdd} className="mt-4 rounded-xl bg-brand-400 px-5 py-2.5 text-sm font-semibold text-brand-text hover:bg-brand-600 hover:text-white"><i className="ti ti-plus mr-1.5" />Birinchi mahsulotni qo'shish</button>
          </div>
        ) : shown.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">
            Hech narsa topilmadi
            <button type="button" onClick={() => { setQ(''); setFilter({ status: 'all', image: 'all' }); onSub(''); }} className="ml-2 font-semibold text-brand-600">Filtrni tozalash</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {shown.map((p) => <ProductCard key={p._id} p={p} tag={categoryLabel(p.category)} onEdit={() => onEdit(p)} onDelete={() => onDelete(p)} />)}
          </div>
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
