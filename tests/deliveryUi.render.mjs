/*
 * Yetkazish rejimi va LokmaGo kuryerlari interfeysi: Vite SSR orqali turli holatlarda chizib ko'rish (brauzer kerak emas).
 * npm run test:delivery-ui
 */
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
let failed = 0;
const check = (name, cond) => { console.log((cond ? '  ✓ ' : '  ✗ FAIL: ') + name); if (!cond) failed += 1; };
try {
  const { LokmaCourierBar } = await server.ssrLoadModule('/src/components/restaurant/LokmaCourierBar.jsx');
  const { RestaurantDeliverySection } = await server.ssrLoadModule('/src/pages/admin/RestaurantDeliverySection.jsx');
  const { DistrictPicker } = await server.ssrLoadModule('/src/components/delivery/DistrictPicker.jsx');
  const { CourierAccountsPage: CouriersPage } = await server.ssrLoadModule('/src/pages/admin/CourierAccountsPage.jsx');
  const { CourierLiveMap } = await server.ssrLoadModule('/src/components/delivery/CourierLiveMap.jsx');
  const { useAuth } = await server.ssrLoadModule('/src/store/auth.js');
  /*
   * Zustand SSR'da (getServerSnapshot) BOSHLANG'ICH holatni o'qiydi — setState ko'rinmaydi. Testda rolni ikkalasiga yozamiz:
   * boshlang'ich holat obyektining o'zini yangilaymiz (ichki api shu obyektga havola qiladi).
   */
  const setRole = (role) => { useAuth.setState({ user: { role } }); Object.assign(useAuth.getInitialState(), { user: { role } }); };
  const h = React.createElement;
  const r = (C, p) => renderToString(h(C, p));
  const base = { _id: 'o1', fulfillment: 'delivery', status: 'ready', finance: {} };

  // ── Buyurtma kartasi: kim yetkazadi ──
  check('o‘z kuryeri (own) — blok chiqmaydi', r(LokmaCourierBar, { order: { ...base, courierParty: 'restaurant' }, courierMode: 'own' }) === '');
  check('olib ketish — blok chiqmaydi', r(LokmaCourierBar, { order: { ...base, fulfillment: 'pickup', courierParty: 'lokma' }, courierMode: 'lokma' }) === '');
  let html = r(LokmaCourierBar, { order: { ...base, courierParty: 'lokma', lokmaCourier: { assigned: false } }, courierMode: 'lokma' });
  check('lokma, qutida — "kuryer qidirilmoqda", tanlov YO‘Q', html.includes('qidirilmoqda') && !html.includes('O‘zim yetkazaman'));
  html = r(LokmaCourierBar, { order: { ...base, courierParty: 'lokma', lokmaCourier: { assigned: true, name: 'Vali', phone: '+998901234567' } }, courierMode: 'both' });
  check('kuryer oldi — ismi va telefoni; both bo‘lsa ham tanlov YO‘Q (o‘zgartirib bo‘lmaydi)', html.includes('Vali') && html.includes('tel:+998901234567') && !html.includes('O‘zim yetkazaman'));
  html = r(LokmaCourierBar, { order: { ...base, status: 'delivering', courierParty: 'lokma', lokmaCourier: { assigned: true, name: 'Vali' } }, courierMode: 'lokma' });
  check('yo‘lda', html.includes('yo‘lda'));
  html = r(LokmaCourierBar, { order: { ...base, status: 'accepted', courierParty: null }, courierMode: 'both' });
  check('both, tanlanmagan — ikki tugma va eslatma', html.includes('O‘zim yetkazaman') && html.includes('LokmaGo kuryeri') && html.includes('Tanlang'));
  html = r(LokmaCourierBar, { order: { ...base, courierParty: 'lokma', lokmaCourier: { assigned: false }, finance: { freeDeliveryByLokma: true } }, courierMode: 'lokma' });
  check('tekin yetkazish yozuvi', html.includes('tekin'));
  check('yakunlangan — blok chiqmaydi', r(LokmaCourierBar, { order: { ...base, status: 'delivered', courierParty: 'lokma' }, courierMode: 'lokma' }) === '');

  // ── Restoran sozlamalari: bosh admin vs xodim ──
  const rest = { _id: 'r1', district: 'chust', courierMode: 'lokma', lokmaFreeDelivery: true, lokmaCourierPercent: 12 };
  setRole('admin');
  html = r(RestaurantDeliverySection, { restaurant: rest });
  check('admin: tuman, 3 rejim, tekin va foiz maydoni', html.includes('Chust tumani') && html.includes('Ikkalasi') && html.includes('Tekin yetkazish') && html.includes('value="12"'));
  check('admin: rejim tugmalari yoqilgan', !/aria-pressed="true"[^>]*disabled|disabled=""[^>]*aria-pressed/.test(html));
  setRole('staff');
  html = r(RestaurantDeliverySection, { restaurant: rest });
  check('xodim: "faqat bosh admin" yozuvi, rejim tugmalari o‘chirilgan', html.includes('faqat bosh admin') && (html.match(/disabled=""/g) || []).length >= 3);
  setRole('admin');
  html = r(RestaurantDeliverySection, { restaurant: { ...rest, courierMode: 'own' } });
  check('own rejimida tekin/foiz bloki ko‘rinmaydi, kuryer biriktirish bloki bor', !html.includes('Tekin yetkazish') && html.includes('data-testid="bound-couriers"') && html.includes('Biriktirilgan kuryerlar'));

  // ── Tuman tanlagich ──
  html = r(DistrictPicker, { multiple: true, value: ['pop', 'chust'], onChange() {} });
  check('14 ta tuman, 2 ta tanlangan, "Hammasi" tugmasi', (html.match(/<button/g) || []).length === 16 && (html.match(/aria-pressed="true"/g) || []).length === 2 && html.includes('Hammasi'));

  // ── Kuryerlar sahifasi ──
  html = r(CouriersPage, {});
  check('kuryerlar sahifasi: admin uchun 5 bo‘lim (Jonli, Quti, Nazorat, Sozlamalar)', ['Kuryerlar', 'Jonli', 'Quti', 'Nazorat', 'Sozlamalar'].every((t) => html.includes(t)));
  check('jonli xarita komponenti chiziladi (yuklanmoqda holati)', r(CourierLiveMap, { couriers: [], selectedId: null }).includes('courier-live-map'));
  setRole('staff');
  check('xodim uchun "Sozlamalar" bo‘limi yo‘q, Jonli va Nazorat bor', !r(CouriersPage, {}).includes('Sozlamalar') && r(CouriersPage, {}).includes('Jonli') && r(CouriersPage, {}).includes('Nazorat'));
} finally {
  await server.close();
}
if (failed) { console.log(`\n${failed} ta xato`); process.exit(1); }
console.log('\nHammasi o‘tdi');
