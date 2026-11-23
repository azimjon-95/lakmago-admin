/*
 * Moliya — haftalik ko'rinish: hafta lentasi, kartadagi haftalar bloki, to'lov oynasi (Vite SSR, brauzersiz).
 * npm run test:finance-weeks
 */
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
let failed = 0; let passed = 0;
const check = (name, cond) => { console.log((cond ? '  ✓ ' : '  ✗ FAIL: ') + name); if (cond) passed += 1; else failed += 1; };
try {
  const P = await server.ssrLoadModule('/src/lib/billingPeriod.js');
  const { WeekStrip } = await server.ssrLoadModule('/src/components/billing/WeekStrip.jsx');
  const { RestaurantWeeks } = await server.ssrLoadModule('/src/components/billing/RestaurantWeeks.jsx');
  const { PayoutModal } = await server.ssrLoadModule('/src/components/billing/PayoutModal.jsx');
  const h = React.createElement;
  // ru-RU mingliklarni bo'linmas bo'shliq bilan ajratadi — taqqoslash uchun oddiy bo'shliqqa
  const r = (C, p) => renderToString(h(C, p)).replace(/[\u00a0\u202f]/g, ' ').replace(/<!-- -->/g, '');

  // ── Sana yordamchilari (server weeklySettlement.js bilan bir xil qoida) ──
  check('dushanba: 2026-11-29 (yakshanba) → 2026-11-23', P.weekStartOfYmd('2026-11-29') === '2026-11-23');
  check('fmtWeek: bir oy / ikki oy / yil bilan', P.fmtWeek('2026-11-16') === '16–22 noy' && P.fmtWeek('2026-10-26') === '26 okt – 1 noy' && P.fmtWeek('2026-12-28', { year: true }) === '28 dek – 3 yan 2027');
  const wp = P.weekPeriod('2026-11-16');
  check('hafta → davr filtri (dush–yaksh), mavjud so‘rov formatida', JSON.stringify(P.rangeFor(wp)) === '{"from":"2026-11-16","to":"2026-11-22"}' && P.buildQuery(P.rangeFor(wp)) === '?from=2026-11-16&to=2026-11-22');
  check('mavjud presetlar o‘zgarmagan', P.PRESETS.map((x) => x.key).join() === 'all,today,yesterday,week,month,custom');

  // ── Hafta lentasi ──
  const weeks = [
    { weekStart: '2026-11-23', current: true, orders: 2, paid: 0, payable: 121380, receivable: 7175 },
    { weekStart: '2026-11-16', current: false, orders: 4, paid: 432320, payable: 0, receivable: 0 },
    { weekStart: '2026-11-09', current: false, orders: 6, paid: 0, payable: 526760, receivable: 9200 },
  ];
  let html = r(WeekStrip, { weeks, value: '2026-11-16', onChange() {} });
  check('lenta: 3 plitka, tanlangan bitta', (html.match(/role="option"/g) || []).length === 3 && (html.match(/aria-selected="true"/g) || []).length === 1);
  check('lenta: joriy hafta, ochiq summa, to‘langan', html.includes('Joriy hafta') && html.includes('121 380 ochiq') && html.includes('To‘langan'));
  check('lenta: restoran qarzi bor haftada qizil nuqta (2 ta)', (html.match(/bg-red-500/g) || []).length === 2);
  check('lenta: ma‘lumot yo‘q — hech narsa chizilmaydi', r(WeekStrip, { weeks: [], value: null, onChange() {} }) === '');

  // ── Kartadagi haftalar ──
  const W = (o) => ({ weekStart: '2026-11-09', current: false, status: 'open', orders: 3, cardShare: 0, cashDebt: 0, refunds: 0, bonus: 0, other: 0,
    obligation: 0, paid: 0, payable: 0, paidPercent: null, debt: 0, debtClosed: 0, receivable: 0, debtClosedPercent: null, overpaid: 0,
    remaining: 0, payments: [], debtClosings: [], coveredOldDebts: [], ...o });
  const data = {
    ledgerBalance: 113000, storedBalance: 113000, driftAmount: 0, openPayable: 250000, openReceivable: 7000,
    weeks: [
      W({ weekStart: '2026-11-23', current: true, status: 'debt', debt: 7000, receivable: 7000, cashDebt: 7000 }),
      W({ weekStart: '2026-11-16', status: 'partial', cardShare: 250000, obligation: 250000, paid: 150000, payable: 100000, paidPercent: 60,
        payments: [{ at: '2026-11-18T05:00:00Z', amount: 150000, kind: 'payout', targeted: true, note: 'Bank' }] }),
      W({ weekStart: '2026-11-09', status: 'open', cardShare: 150000, obligation: 150000, payable: 150000, paidPercent: 0 }),
    ],
  };
  html = r(RestaurantWeeks, { data, balance: 243000, selectedWeek: null, onOpenWeek() {}, onPayWeek() {}, onPayAll() {} });
  check('hafta tanlanmagan: joriy hafta ro‘yxatda emas, 2 eski hafta', !html.includes('23–29 noy') && html.includes('16–22 noy') && html.includes('9–15 noy'));
  check('2+ ochiq hafta — "Hammasini to‘lash" (min(ochiq, balans))', html.includes('Hammasini to‘lash (243 000)'));
  check('qisman: "60% to‘langan"', html.includes('60% to‘langan'));

  html = r(RestaurantWeeks, { data, balance: 243000, selectedWeek: '2026-11-16', onOpenWeek() {}, onPayWeek() {}, onPayAll() {} });
  check('TZ misoli: majburiyat 250 000, to‘langan 150 000, qoldiq 100 000, 60%', html.includes('data-testid="selected-week"') && html.includes('250 000') && html.includes('150 000') && html.includes('100 000') && html.includes('60%'));
  check('tanlangan hafta: "Shu haftani to‘lash" faol', html.includes('Shu haftani to‘lash') && !/disabled=""[^>]*>Shu haftani/.test(html));
  check('hafta tanlansa — joriy hafta qarzi "Boshqa haftalarda" ko‘rinadi', html.includes('Boshqa haftalarda ochiq') && html.includes('23–29 noy') && html.includes('Restoran qarzi'));

  html = r(RestaurantWeeks, { data, balance: 0, selectedWeek: '2026-11-16', onOpenWeek() {}, onPayWeek() {}, onPayAll() {} });
  check('balans 0 — to‘lash tugmasi o‘chiq, sababi yozilgan', /disabled=""[^>]*>Shu haftani/.test(html) && html.includes('boshqa haftadagi qarzi bilan qoplangan') && !html.includes('Hammasini to‘lash'));

  html = r(RestaurantWeeks, { data: { ...data, storedBalance: 279350, driftAmount: 166350 }, balance: 279350, selectedWeek: null, onOpenWeek() {}, onPayWeek() {}, onPayAll() {} });
  check('jurnal/balans farqi yashirilmaydi', html.includes('data-testid="weeks-drift"') && html.includes('166 350'));

  html = r(RestaurantWeeks, { data: { ...data, weeks: [W({ weekStart: '2026-11-16', status: 'settled' })] }, balance: 0, selectedWeek: '2026-11-16', onOpenWeek() {}, onPayWeek() {}, onPayAll() {} });
  check('faqat to‘lov bo‘lgan hafta — "yangi hisob-kitob bo‘lmagan"', html.includes('yangi hisob-kitob bo‘lmagan'));
  check('ma‘lumot yo‘q (endpoint yuklanmagan) — blok chizilmaydi', r(RestaurantWeeks, { data: undefined, balance: 0, selectedWeek: null }) === '');

  // ── To'lov oynasi ──
  const rest = { _id: 'r1', name: 'Ziynat', balans: 243000 };
  html = r(PayoutModal, { restaurant: rest, week: { weekStart: '2026-11-16', payable: 100000 }, presetAmount: 100000, onClose() {}, onDone() {} });
  check('hafta bilan: sarlavhada hafta, summa = hafta qoldig‘i', html.includes('data-testid="payout-week"') && html.includes('16–22 noy') && html.includes('value="100 000"') && html.includes('Hafta qoldig‘i'));
  html = r(PayoutModal, { restaurant: rest, presetAmount: 999999, onClose() {}, onDone() {} });
  check('taklif summasi balansdan oshmaydi', html.includes('value="243 000"'));
  html = r(PayoutModal, { restaurant: rest, onClose() {}, onDone() {} });
  check('avvalgi xulq: hafta yo‘q, summa = balans, "Hammasi"', !html.includes('payout-week') && html.includes('value="243 000"') && html.includes('Hammasi'));
} finally {
  await server.close();
}
console.log(`\n${failed === 0 ? '✓ HAMMASI O‘TDI' : `✗ ${failed} TA XATO`} (${passed} tekshiruv)`);
process.exit(failed === 0 ? 0 : 1);
