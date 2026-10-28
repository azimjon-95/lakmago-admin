/*
 * Katalog sonlari: serverning /admin/catalog/counts javobi YOKI (server hali yangilanmagan bo'lsa) oddiy ro'yxatdan.
 * Server ro'yxati 500 tadan kesadi — shuning uchun zaxira yo'lda `truncated` belgisi (sonlar taxminiy).
 */
export const LIST_LIMIT = 500;

/** Mahsulotlar ro'yxati → [{ category, total, active, withImage }] */
export function countFromItems(items = []) {
  const by = new Map();
  for (const p of items) {
    const c = by.get(p.category) || { category: p.category, total: 0, active: 0, withImage: 0 };
    c.total += 1;
    if (p.isActive !== false) c.active += 1;
    if (p.imageUrl) c.withImage += 1;
    by.set(p.category, c);
  }
  return [...by.values()];
}

/** Mahsulotlarni tartiblash: nom (A–Z / Z–A), ko'p ishlatilgan, yangi qo'shilgan. */
export function sortProducts(list, mode) {
  const byName = (a, b) => String(a.name).localeCompare(String(b.name), 'uz');
  const arr = [...list];
  if (mode === 'name_desc') return arr.sort((a, b) => byName(b, a));
  if (mode === 'usage') return arr.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0) || byName(a, b));
  if (mode === 'new') return arr.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')) || byName(a, b));
  return arr.sort(byName);
}

/** Holat/rasm filtri + qidiruv (nom, tavsif, hajm). */
export function filterProducts(list, { status = 'all', image = 'all', q = '' } = {}) {
  const needle = String(q).trim().toLowerCase();
  return list.filter((p) => {
    if (status === 'active' && p.isActive === false) return false;
    if (status === 'inactive' && p.isActive !== false) return false;
    if (image === 'with' && !p.imageUrl) return false;
    if (image === 'without' && p.imageUrl) return false;
    if (needle && ![p.name, p.description, p.volume].some((s) => String(s || '').toLowerCase().includes(needle))) return false;
    return true;
  });
}
