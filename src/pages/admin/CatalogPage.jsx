import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminApi } from '@/api';
import { confirm } from '@/components/ui/confirm';
import { summarizeGroups, groupById } from '@/constants/catalogGroups';
import { countFromItems, LIST_LIMIT } from '@/lib/catalogCounts';
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
 * Sonlar: serverning /admin/catalog/counts (aniq). Server hali yangilanmagan bo'lsa (404) — oddiy ro'yxatdan
 * hisoblanadi (server ro'yxatni 500 ta bilan kesadi → `truncated` ogohlantirishi).
 */
export function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const groupId = params.get('g') || '';
  const sub = params.get('c') || '';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [truncated, setTruncated] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [version, setVersion] = useState(0);          // saqlash/o'chirishdan keyin ro'yxatlarni qayta yuklash
  const [zipOpen, setZipOpen] = useState(false);
  const [editing, setEditing] = useState(null);       // null | { product } | { defaults }

  const loadCounts = useCallback(async () => {
    try {
      const r = await adminApi.getCatalogCounts();
      setRows(Array.isArray(r) ? r : r.counts || []); setTruncated(false); setLoadError(null);
    } catch {
      try {
        const list = await adminApi.getCatalog('');
        setRows(countFromItems(list)); setTruncated(list.length >= LIST_LIMIT); setLoadError(null);
      } catch (e) { setLoadError(e.message || 'Katalogni yuklab bo‘lmadi'); }
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
  const refresh = () => setVersion((v) => v + 1);

  const remove = async (p) => {
    if (!await confirm({ title: `"${p.name}" o'chirilsinmi?` })) return;
    try {
      const r = await adminApi.deleteCatalogProduct(p._id);
      if (r.deactivated) alert(r.message);
      refresh();
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
        />
      ) : (
        <CatalogHome
          groups={groups}
          loading={loading}
          truncated={truncated}
          onOpenGroup={openGroup}
          onZip={() => setZipOpen(true)}
          onAdd={() => setEditing({ defaults: null })}
          onEdit={(p) => setEditing({ product: p })}
          onDelete={remove}
          version={version}
        />
      )}

      {zipOpen && <CatalogZipImportModal onClose={() => setZipOpen(false)} onImported={refresh} />}
      {editing && (
        <CatalogProductForm
          product={editing.product || null}
          defaults={editing.defaults || null}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}
    </>
  );
}
