/*
 * Reklama videosi — mijoz tomonidagi tekshiruv.
 * Server (middleware/adUpload.js) baribir qayta tekshiradi; bu yerda maqsad —
 * 50 MB ni yuklab, keyin rad etilishini kutmaslik.
 */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;   // Telegram Bot API sendVideo chegarasi
export const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const EXT_TYPE = { mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' };

/** Ba'zi Android qurilmalarda `file.type` bo'sh keladi — kengaytmaga tayanamiz. */
export function videoTypeOf(file) {
  if (file?.type) return file.type;
  const ext = String(file?.name || '').split('.').pop().toLowerCase();
  return EXT_TYPE[ext] || '';
}

/** @returns {string} xato matni yoki '' (yaroqli) */
export function validateVideo(file) {
  if (!file) return '';
  if (!VIDEO_TYPES.includes(videoTypeOf(file))) return 'Faqat video fayl: MP4, MOV yoki WEBM';
  if (file.size > MAX_VIDEO_BYTES) return `Video ${MAX_VIDEO_BYTES / 1024 / 1024} MB dan katta bo‘lmasin (hozir ${formatMB(file.size)})`;
  if (file.size === 0) return 'Fayl bo‘sh';
  return '';
}

export const formatMB = (bytes) => `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;

/**
 * Videoning KO'RINADIGAN o'lchami va davomiyligi (brauzer aylantirishni hisobga oladi — iPhone vertikal video 1080×1920 bo'lib chiqadi).
 * Serverga yuboriladi → Telegram sendVideo(width, height, duration): bo'lmasa Telegram ba'zi videolarni ezilgan ko'rsatadi.
 * O'qib bo'lmasa (format brauzerda ochilmaydi) — null; video baribir yuboriladi.
 */
export function readVideoMeta(file, { timeoutMs = 8000 } = {}) {
  if (!file || typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    let done = false;
    const finish = (meta) => { if (done) return; done = true; clearTimeout(t); v.removeAttribute('src'); v.load?.(); URL.revokeObjectURL(url); resolve(meta); };
    const t = setTimeout(() => finish(null), timeoutMs);
    v.preload = 'metadata'; v.muted = true; v.playsInline = true;
    v.onloadedmetadata = () => finish({ width: v.videoWidth, height: v.videoHeight, duration: v.duration });
    v.onerror = () => finish(null);
    v.src = url;
  });
}

/** Serverga yuboriladigan maydonlar (sof): faqat to'g'ri butun sonlar; eni va bo'yi faqat birga. */
export function videoMetaFields(meta) {
  if (!meta) return {};
  const w = Math.round(Number(meta.width)); const h = Math.round(Number(meta.height)); const d = Number(meta.duration);
  const out = {};
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 && w <= 10000 && h <= 10000) { out.width = w; out.height = h; }
  if (Number.isFinite(d) && d > 0 && d < 36000) out.duration = Math.max(1, Math.round(d));
  return out;
}

/** Oldindan ko'rish uchun nisbat matni: "9:16 · vertikal" */
export function aspectLabel(meta) {
  if (!meta?.width || !meta?.height) return '';
  const r = meta.width / meta.height;
  const known = [[9 / 16, '9:16'], [3 / 4, '3:4'], [4 / 5, '4:5'], [1, '1:1'], [4 / 3, '4:3'], [16 / 9, '16:9']];
  const [, name] = known.reduce((best, k) => (Math.abs(k[0] - r) < Math.abs(best[0] - r) ? k : best), known[0]);
  return `${name} · ${r < 0.95 ? 'vertikal' : r > 1.05 ? 'gorizontal' : 'kvadrat'}`;
}
