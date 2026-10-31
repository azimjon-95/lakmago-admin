/*
 * Katalog sarlavhasi uchun sonlar: "19 ta · 16 900 mahsulot". Sof funksiyalar (tests/catalogTotals.test.mjs).
 * Mingliklar orasida NBSP: raqam satr oxirida "16 / 900" bo'lib uzilib qolmasin.
 */
export const fmtInt = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');

/** Guruhlar bo'yicha jami mahsulot soni (summarizeGroups natijasi: har guruhda `total`). */
export const sumProducts = (groups) => (groups || []).reduce((a, g) => a + (Number(g.total) || 0), 0);

/** "19 ta · 16 900 mahsulot" (mahsulot yo'q/hali sanalmagan bo'lsa — faqat "19 ta"). */
export function countLabel(groups) {
  const cats = (groups || []).length;
  const total = sumProducts(groups);
  return total > 0 ? `${cats} ta · ${fmtInt(total)} mahsulot` : `${cats} ta`;
}
