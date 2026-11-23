/*
 * ═══════════════════════════════════════════════════════════
 * MOLIYA — SANA ORALIG'I (Toshkent kunlari)
 * ═══════════════════════════════════════════════════════════
 *
 * Server sanani TOSHKENT kuni sifatida o'qiydi (YYYY-MM-DD, ikkala
 * chegara ham kiradi). Brauzer boshqa vaqt zonasida bo'lsa ham
 * "bugun/kecha" shu bilan bir xil bo'lishi uchun bu yerda ham
 * Toshkent vaqti ishlatiladi — qurilma soati yoki zonasi
 * "kecha"ni boshqa kunga surib yubormasin.
 */
const TZ = 'Asia/Tashkent';
const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Toshkentdagi bugungi sana: "2026-09-28". */
export function tashkentToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function addDaysYmd(ymd, days) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export const PRESETS = [
  { key: 'all', label: 'Hammasi' },
  { key: 'today', label: 'Bugun' },
  { key: 'yesterday', label: 'Kecha' },
  { key: 'week', label: '7 kun' },
  { key: 'month', label: '30 kun' },
  { key: 'custom', label: 'Sana tanlash' },
];

export function isValidRange(from, to) {
  return YMD.test(from || '') && YMD.test(to || '') && from <= to;
}

/**
 * @param {{ key: string, from?: string, to?: string }} period
 * @returns {{ from: string, to: string } | null}  null — filtr yo'q (hammasi)
 *   yoki "Sana tanlash" hali to'liq/to'g'ri emas.
 */
export function rangeFor(period, now = new Date()) {
  const today = tashkentToday(now);
  switch (period?.key) {
    case 'today': return { from: today, to: today };
    case 'yesterday': { const y = addDaysYmd(today, -1); return { from: y, to: y }; }
    case 'week': return { from: addDaysYmd(today, -6), to: today };
    case 'month': return { from: addDaysYmd(today, -29), to: today };
    case 'custom': return isValidRange(period.from, period.to) ? { from: period.from, to: period.to } : null;
    default: return null;
  }
}

/** Server so'rovi uchun query. Bo'sh qiymatlar tashlanadi. */
export function buildQuery(range, extra = {}) {
  const p = new URLSearchParams();
  if (range?.from) p.set('from', range.from);
  if (range?.to) p.set('to', range.to);
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

const fmt = (ymd) => ymd.split('-').reverse().join('.');

/** "Kecha (27.09.2026)", "24.09 — 28.09.2026", "Hamma vaqt". */
export function periodLabel(period, range) {
  if (!range) return 'Hamma vaqt';
  const dates = range.from === range.to ? fmt(range.from) : `${fmt(range.from)} — ${fmt(range.to)}`;
  const preset = PRESETS.find((p) => p.key === period?.key);
  return preset && preset.key !== 'custom' && preset.key !== 'all' && range.from === range.to
    ? `${preset.label} (${dates})`
    : dates;
}

/** Karta raqamini 4 tadan guruhlaydi: "8600 1234 5678 9012". */
export function formatCard(num) {
  return String(num || '').replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
}

/** Buferga nusxalash (Telegram WebView / HTTP da clipboard API bo'lmasligi mumkin). */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch { return false; }
  }
}
