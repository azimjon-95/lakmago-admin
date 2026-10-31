/*
 * Muqova fayllaridan responsive rasm to'plamini yig'adi (sof funksiya — Vite'siz sinaladi: tests/coverSet.test.mjs).
 *
 * Fayl nomi: `<guruh-id>@<kenglik>.webp` (masalan gosht@480.webp, gosht@720.webp, gosht@1200.webp) — brauzer srcset
 * orqali ekran o'lchami va zichligiga mosini O'ZI tanlaydi. Oddiy `<guruh-id>.webp` ham ishlaydi (variantsiz).
 * src — srcset'ni tushunmaydigan brauzerlar uchun o'rtacha (>= 720) variant.
 */
export function buildCovers(files) {
  const by = {};
  for (const [path, url] of Object.entries(files)) {
    const name = path.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase();
    const m = name.match(/^(.+)@(\d+)$/);
    const id = m ? m[1] : name;
    const slot = (by[id] = by[id] || { variants: [], plain: null });
    if (m) slot.variants.push({ w: Number(m[2]), url }); else slot.plain = url;
  }
  const out = {};
  for (const [id, { variants, plain }] of Object.entries(by)) {
    const vs = [...variants].sort((a, b) => a.w - b.w);
    if (!vs.length) { out[id] = { src: plain, srcSet: '' }; continue; }
    const mid = vs.find((v) => v.w >= 720) || vs[vs.length - 1];
    out[id] = { src: mid.url, srcSet: vs.map((v) => `${v.url} ${v.w}w`).join(', ') };
  }
  return out;
}
