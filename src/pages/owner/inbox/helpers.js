import { todayIso } from '@/pages/wedding/common';

/* Mijoz bronlari holatlari — rang va nomlar (server: booking.flow.ts bilan bir xil kalitlar) */
export const STATE_STYLE = {
  new: { label: "Yangi so'rov", cls: 'bg-amber-50 text-amber-800', icon: 'ti-bell-ringing' },
  agreed: { label: 'Kelishildi', cls: 'bg-blue-50 text-blue-700', icon: 'ti-handshake' },
  confirmed: { label: 'Tasdiqlandi', cls: 'bg-green-50 text-green-700', icon: 'ti-circle-check' },
  completed: { label: 'Yakunlandi', cls: 'bg-gray-100 text-gray-600', icon: 'ti-flag-check' },
  rejected: { label: 'Rad etildi', cls: 'bg-red-50 text-red-700', icon: 'ti-circle-x' },
  cancelled: { label: 'Bekor qilindi', cls: 'bg-red-50 text-red-700', icon: 'ti-ban' },
  expired: { label: 'Muddati tugadi', cls: 'bg-gray-100 text-gray-600', icon: 'ti-clock-off' },
};

export const REJECT_REASONS = [
  ['busy', 'Bu sana yoki vaqt mos emas'],
  ['price', "Narx bo'yicha kelisha olmadik"],
  ['guests', 'Mehmonlar soni mos emas'],
  ['no_answer', 'Mijoz telefonga javob bermadi'],
  ['declined', "Mijoz o'zi voz kechdi"],
  ['other', 'Boshqa sabab'],
];

const WEEKDAY = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
export const fmtDate = (iso) => (iso ? iso.split('-').reverse().join('.') : '—');
export const weekdayOf = (iso) => WEEKDAY[new Date(`${iso}T00:00:00Z`).getUTCDay()];
export const fmtDateTime = (v) => (v ? new Date(v).toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

/** "12 daqiqa oldin" */
export function ago(v, now = Date.now()) {
  if (!v) return '';
  const m = Math.max(0, Math.floor((now - new Date(v).getTime()) / 60_000));
  if (m < 1) return 'hozirgina';
  if (m < 60) return `${m} daqiqa oldin`;
  if (m < 1440) return `${Math.floor(m / 60)} soat oldin`;
  return `${Math.floor(m / 1440)} kun oldin`;
}

/** "23 soat 10 daq qoldi" / "2 kun qoldi" */
export function timeLeft(v, now = Date.now()) {
  if (!v) return '';
  const m = Math.floor((new Date(v).getTime() - now) / 60_000);
  if (m <= 0) return 'muddat tugadi';
  if (m < 60) return `${m} daq qoldi`;
  if (m < 1440) return `${Math.floor(m / 60)} soat ${m % 60} daq qoldi`;
  return `${Math.floor(m / 1440)} kun ${Math.floor((m % 1440) / 60)} soat qoldi`;
}

/** Sana + n kun (YYYY-MM-DD, vaqt zonasiga bog'liq emas) */
export function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const today = todayIso;

/** Faqat raqamlar → "1 234 567" */
export const digits = (s) => String(s ?? '').replace(/\D/g, '');
export const spaced = (s) => digits(s).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
export const telHref = (p) => `tel:${String(p || '').replace(/[^\d+]/g, '')}`;

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* eski brauzer */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch { return false; }
}
