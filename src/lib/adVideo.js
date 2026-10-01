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
