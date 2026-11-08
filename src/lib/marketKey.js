/*
 * Nomdan kalit (ID) — SERVER BILAN BIR XIL qoida (controllers/marketCategoryAdmin.js: slugifyKey).
 * "Sut mahsulotlari" → sut_mahsulotlari; "Uy-ro'zg'or" → uy_rozgor; "Bolalar oʻquv" → bolalar_oquv.
 */
export function slugifyKey(name) {
  const s = String(name || '')
    .toLowerCase()
    .replace(/[oʻ‘’'`]/g, (m) => (m === 'o' ? 'o' : ''))
    .replace(/g[ʻ‘’'`]/g, 'g')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return s.slice(0, 60).replace(/_+$/, '');
}
