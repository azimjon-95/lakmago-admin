import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminApi } from '@/api';
import { confirm } from '@/components/ui/confirm';
import { summarizeGroups, groupById, catsOfGroup } from '@/constants/catalogGroups';
import { countFromItems, LIST_LIMIT } from '@/lib/catalogCounts';
import { CATALOG_CATEGORIES } from '@/constants/catalogCategories';
import { clear as clearCatalogCache, countPerCategory } from '@/lib/catalogData';
import { prefetchGroup } from '@/lib/catalogPager';
import { CatalogZipImportModal } from './CatalogZipImportModal';
import { CatalogHome } from './catalog/CatalogHome';
import { CatalogGroupView } from './catalog/CatalogGroupView';
import { CatalogProductForm } from './catalog/CatalogProductForm';

/*
 * ═══ UMUMIY KATALOG ═══
 *
 * Ko'rinishlar (URL bilan — "orqaga" tugmasi va yangilash joyida qoladi):
 *   /catalog                       — guruh kartochkalari (maketdagi chap ekran)
 *   /catalog?g=gosht[&c=<kateg.>]  — guruh ichi: muqova, chiplar, mahsulotlar (o'ng ekran)
 *
 * Sonlar: serverning /admin/catalog/counts (aniq; server buni birinchi chaqiruvda butun katalogni Redis'ga yuklaydi,
 * kartochka bosilganda esa faqat shu guruh Redis'dan keladi). Server hali yangilanmagan bo'lsa (404):
 *   • katalog ≤ 500 — umumiy ro'yxatdan hisoblanadi;
 *   • katalog > 500 — umumiy ro'yxat kesilgani uchun har bir kategoriya ALOHIDA so'raladi (aniq, lekin sekinroq).
 */
export function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const groupId = params.get('g') || '';
  const sub = params.get('c') || '';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [truncated, setTruncated] = useState(false);
  const [v2, setV2] = useState(false);                // yangi server: hisoblagich + Redis keshi + ?categories=
  const [counting, setCounting] = useState(false);    // eski server: sonlar kategoriyalar bo'yicha hisoblanmoqda
  const [loadError, setLoadError] = useState(null);
  const [version, setVersion] = useState(0);          // saqlash/o'chirishdan keyin ro'yxatlarni qayta yuklash
  const [zipOpen, setZipOpen] = useState(false);
  const [editing, setEditing] = useState(null);       // null | { product } | { defaults }
  const [change, setChange] = useState(null);         // { n, kind: upsert|remove|deactivate, ... } — ochiq ro'yxat joyida yangilanadi

  const loadCounts = useCallback(async () => {
    try {
      const r = await adminApi.getCatalogCounts();
      setRows(Array.isArray(r) ? r : r.counts || []); setTruncated(false); setLoadError(null); setV2(true);
    } catch {
      setV2(false);
      try {
        const list = await adminApi.getCatalog('');
        if (list.length >= LIST_LIMIT) {
          setCounting(true);
          const { rows: exact, truncated: still } = await countPerCategory(CATALOG_CATEGORIES.map((c) => c.value), list);
          setRows(exact); setTruncated(still);
        } else { setRows(countFromItems(list)); setTruncated(false); }
        setLoadError(null);
      } catch (e) { setLoadError(e.message || 'Katalogni yuklab bo‘lmadi'); }
      finally { setCounting(false); }
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { loadCounts(); }, [loadCounts, version]);

  const { groups } = useMemo(() => summarizeGroups(rows), [rows]);
  const group = groupId ? groups.find((g) => g.id === groupId) || (groupById(groupId) ? { ...groupById(groupId), subs: [], total: 0, active: 0, withImage: 0 } : null) : null;

  // Guruh ochilganda/yopilganda sahifa boshiga
  useEffect(() => { window.scrollTo?.(0, 0); document.querySelector('main')?.scrollTo?.(0, 0); }, [groupId]);

  const openGroup = (id) => setParams({ g: id });
  const setSub = (c) => setParams(c ? { g: groupId, c } : { g: groupId }, { replace: true });
  const back = () => setParams({});
  // Har qanday yozuvdan keyin brauzer keshi tozalanadi (eskirgan ro'yxat ko'rinmasin) va ro'yxatlar qayta yuklanadi
  const refresh = () => { clearCatalogCache(); setVersion((v) => v + 1); };
  /*
   * Bitta mahsulot o'zgardi (saqlandi/o'chirildi): ro'yxat QAYTA YUKLANMAYDI — ochiq ro'yxat joyida yangilanadi (`change`),
   * sonlar esa orqada jimgina yangilanadi. Faqat ZIP import kabi katta o'zgarishda `refresh()` (to'liq qayta yuklash).
   */
  const noteChange = useCallback((c) => { clearCatalogCache(); setChange({ n: Date.now() + Math.random(), ...c }); loadCounts(); }, [loadCounts]);
  const prefetch = useCallback((g) => prefetchGroup(catsOfGroup(g), { v2 }), [v2]);

  const remove = async (p) => {
    if (!await confirm({ title: `"${p.name}" o'chirilsinmi?` })) return;
    try {
      const r = await adminApi.deleteCatalogProduct(p._id);
      if (r.deactivated) alert(r.message);
      noteChange(r.deactivated ? { kind: 'deactivate', id: p._id } : { kind: 'remove', id: p._id });
    } catch (e) { alert(e.message); }
  };

  // "Qo'shish": ochiq guruhda — tanlangan chip yoki guruhning birinchi kategoriyasi oldindan tanlanadi
  const addDefaults = group ? { category: sub || group.subs[0]?.category || group.categories?.[0] } : null;

  return (
    <>
      {loadError && !rows.length ? (
        <div className="mx-auto max-w-md p-8 text-center">
          <div className="text-ink font-semibold">{loadError}</div>
          <button type="button" onClick={() => { setLoading(true); loadCounts(); }} className="mt-4 rounded-xl bg-brand-400 px-5 py-2.5 text-sm font-semibold text-brand-text">Qayta urinish</button>
        </div>
      ) : group ? (
        <CatalogGroupView
          key={group.id}
          group={group}
          sub={sub}
          onSub={setSub}
          onBack={back}
          onAdd={() => setEditing({ defaults: addDefaults })}
          onEdit={(p) => setEditing({ product: p })}
          onDelete={remove}
          version={version}
          v2={v2}
          change={change}
        />
      ) : (
        <CatalogHome
          groups={groups}
          loading={loading}
          counting={counting}
          truncated={truncated}
          onPrefetch={prefetch}
          onOpenGroup={openGroup}
          onZip={() => setZipOpen(true)}
          onAdd={() => setEditing({ defaults: null })}
          onEdit={(p) => setEditing({ product: p })}
          onDelete={remove}
          version={version}
          v2={v2}
          change={change}
        />
      )}

      {zipOpen && <CatalogZipImportModal onClose={() => setZipOpen(false)} onImported={refresh} />}
      {editing && (
        <CatalogProductForm
          product={editing.product || null}
          defaults={editing.defaults || null}
          onClose={() => setEditing(null)}
          onSaved={(saved) => { setEditing(null); if (saved?._id) noteChange({ kind: 'upsert', product: saved }); else refresh(); }}
        />
      )}
    </>
  );
}
