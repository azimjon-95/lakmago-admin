/*
 * Restoran hisoboti — ko'rsatish yordamchilari. Hech narsa
 * hisoblanmaydi: raqamlar serverdan (GET /panel/billing/*).
 */
const TZ = 'Asia/Tashkent';

export const som = (n) => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/[\s,]/g, ' ');

/** Ishorasi bilan: +1 200 / −1 200 */
export const signed = (n) => {
  const v = Math.round(Number(n) || 0);
  if (v === 0) return '0';
  return `${v > 0 ? '+' : '−'}${som(Math.abs(v))}`;
};

const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

/** "2026-11-20" → "20 noyabr" */
export function dayLabel(ymd) {
  const [, m, d] = String(ymd || '').split('-').map(Number);
  if (!m || !d) return ymd || '';
  return `${d} ${MONTHS[m - 1]}`;
}

/** Davr sarlavhasi: "20 noyabr" yoki "14 – 20 noyabr" */
export function periodLabel(from, to) {
  if (!from) return '';
  if (from === to) return dayLabel(from);
  const [, fm] = from.split('-');
  const [, tm] = to.split('-');
  if (fm === tm) return `${Number(from.slice(8))} – ${dayLabel(to)}`;
  return `${dayLabel(from)} – ${dayLabel(to)}`;
}

/** Toshkent vaqti: "14:32" */
export function timeLabel(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

/** Toshkent sanasi + vaqti: "20 noyabr, 14:32" */
export function dateTimeLabel(iso) {
  if (!iso) return '';
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
  return `${dayLabel(ymd)}, ${timeLabel(iso)}`;
}

export const PAY_LABEL = { cash: 'Naqd', click: 'Click', payme: 'Payme', paynet: 'Paynet', uzum: 'Uzum' };

export function fulfillmentLabel(o) {
  if (o.fulfillment === 'pickup') return 'Olib ketish';
  if (o.fulfillment === 'dinein') return 'Zalda';
  return o.courierParty === 'lokma' ? 'LokmaGo kuryeri' : 'Yetkazish';
}

export const pct = (p) => (p == null ? '' : `${String(p).replace('.', ',')}%`);
