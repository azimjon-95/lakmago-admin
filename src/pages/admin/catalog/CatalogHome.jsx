import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '@/api';
import { categoryLabel } from '@/constants/catalogGroups';
import { GroupCard, ProductCard } from './CatalogCards';

const SEARCH_MAX = 60;

/*
 * "Umumiy katalog" bosh ko'rinishi (maket): sarlavha, qidiruv, [ZIP orqali | + Qo'shish], "Kategoriyalar N ta" va
 * guruh kartochkalari (telefonda 2 ta, 640 px dan 3 ta bir qatorda). Qidiruv: mos GURUHLAR (nomi, tavsifi yoki
 * pastki kategoriyasi bo'yicha) + mos MAHSULOTLAR (serverda, nom/brend bo'yicha).
 */
export function CatalogHome({ groups, loading, counting, truncated, onPrefetch, onOpenGroup, onZip, onAdd, onEdit, onDelete, version }) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState({ q: '', items: [], loading: false });
  const needle = q.trim().toLowerCase();

  const shownGroups = useMemo(() => {
    if (!needle) return groups;
    return groups.filter((g) => [g.label, g.hint, ...g.subs.map((s) => categoryLabel(s.category)), ...g.categories.map(categoryLabel)]
      .some((s) => String(s).toLowerCase().includes(needle)));
  }, [groups, needle]);

  // Mahsulot qidiruvi (serverda, 350 ms kutib). `version` — saqlash/o'chirishdan keyin qayta yuklash uchun.
  useEffect(() => {
    if (needle.length < 2) { setFound({ q: '', items: [], loading: false }); return undefined; }
    let dead = false;
    setFound((f) => ({ ...f, loading: true }));
    const t = setTimeout(() => {
      adminApi.getCatalog(`?q=${encodeURIComponent(q.trim())}`)
        .then((items) => { if (!dead) setFound({ q: needle, items, loading: false }); })
        .catch(() => { if (!dead) setFound({ q: needle, items: [], loading: false }); });
    }, 350);
    return () => { dead = true; clearTimeout(t); };
  }, [needle, q, version]);

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-ink">Umumiy katalog</h1>
        <p className="mt-1 text-sm text-muted">Restoranlar shu ro'yxatdan tanlab o'z narxini qo'yadi</p>
      </div>

      <div className="relative mb-3">
        <i className="ti ti-search pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-muted" aria-hidden="true" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Mahsulot yoki kategoriya qidirish…"
          aria-label="Katalogdan qidirish"
          className="inp !rounded-2xl !py-3 !pl-10 !pr-10"
        />
        {q && (
          <button type="button" onClick={() => setQ('')} aria-label="Tozalash" className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-canvas">
            <i className="ti ti-x" />
          </button>
        )}
      </div>

      <div className="mb-7 grid grid-cols-2 gap-3">
        <button type="button" onClick={onZip} className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-white py-3.5 font-semibold text-ink transition hover:bg-canvas">
          <i className="ti ti-file-zip text-lg" /> ZIP orqali
        </button>
        <button type="button" onClick={onAdd} className="flex items-center justify-center gap-2 rounded-2xl bg-brand-400 py-3.5 font-semibold text-brand-text transition hover:bg-brand-600 hover:text-white">
          <i className="ti ti-plus text-lg" /> Qo'shish
        </button>
      </div>

      {counting && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-canvas px-3.5 py-2.5 text-xs text-muted" role="status">
          <i className="ti ti-loader-2 animate-spin" /> Sonlar hisoblanmoqda… (server yangilanmagan — shu sabab sekinroq)
        </div>
      )}
      {truncated && (
        <div className="mb-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
          Ba'zi kategoriyalarda 500 tadan ko'p mahsulot bor — hozirgi server bitta so'rovda 500 tadan ortiq bermaydi, shuning uchun
          sonlar taxminiy. Aniq sonlar uchun serverni yangilang (katalog hisoblagichi).
        </div>
      )}

      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-ink">Kategoriyalar</h2>
        <span className="text-sm text-muted">{shownGroups.length} ta</span>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-line sm:aspect-[4/3]" />)}
        </div>
      ) : shownGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line py-8 text-center text-sm text-muted">Mos kategoriya topilmadi</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {shownGroups.map((g) => <GroupCard key={g.id} g={g} onOpen={() => onOpenGroup(g.id)} onWarm={() => onPrefetch?.(g)} />)}
        </div>
      )}

      {needle.length >= 2 && (
        <section className="mt-9" aria-live="polite">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-bold text-ink">Mahsulotlar</h2>
            <span className="text-sm text-muted">{found.loading ? 'Qidirilmoqda…' : `${found.items.length} ta`}</span>
          </div>
          {!found.loading && found.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line py-8 text-center text-sm text-muted">«{q.trim()}» bo'yicha mahsulot topilmadi</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
                {found.items.slice(0, SEARCH_MAX).map((p) => (
                  <ProductCard key={p._id} p={p} tag={categoryLabel(p.category)} onEdit={() => onEdit(p)} onDelete={() => onDelete(p)} />
                ))}
              </div>
              {found.items.length > SEARCH_MAX && <p className="mt-3 text-center text-xs text-muted">Yana {found.items.length - SEARCH_MAX} ta bor — qidiruvni aniqroq yozing</p>}
            </>
          )}
        </section>
      )}
    </div>
  );
}
