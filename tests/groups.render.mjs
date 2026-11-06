/*
 * Telegram guruhlar sahifasi: umumiy / restoran / kanal kartalari, reklama kaliti, reklama uchun chat tanlash (Vite SSR).
 * npm run test:groups
 */
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
let failed = 0;
const check = (name, cond) => { console.log((cond ? '  ✓ ' : '  ✗ FAIL: ') + name); if (!cond) failed += 1; };
try {
  const { GroupCard, TargetPicker } = await server.ssrLoadModule('/src/pages/admin/GroupsPage.jsx');
  const h = React.createElement;
  const noop = () => {};
  const clean = (x) => x.replace(/<!-- -->/g, '');
  const card = (g) => clean(renderToString(h(GroupCard, { g, busy: false, onAd: noop, onResend: noop, onToggleAds: noop, onPick: noop, onRepin: noop, onUnbind: noop })));
  const general = { chatId: '-1', title: 'LOKMA GO', kind: 'group', isBotAdmin: true, isActive: true, isPinned: true, adsEnabled: true, restaurant: null };
  const rest = { chatId: '-2', title: 'Ziynat mijozlari', kind: 'group', isBotAdmin: true, isActive: true, adsEnabled: false, restaurantId: 'r1', restaurant: { id: 'r1', name: 'Ziynat Restoran', imageUrl: '', isActive: true }, restaurantPin: { isPinned: true } };
  const channel = { chatId: '-3', title: 'Totli kanali', kind: 'channel', isBotAdmin: true, isActive: true, adsEnabled: false, restaurant: null };

  let html = card(general);
  check('umumiy guruh: «Restoran biriktirish», umumiy pinni qayta yuborish, reklama YOQILGAN', html.includes('data-testid="bind-restaurant"') && html.includes('Umumiy pinni qayta yuborish') && html.includes('aria-checked="true"'));
  html = card(rest);
  check('restoran guruhi: restoran nomi, «shu restoran sahifasini ochadi», almashtirish/pinni yangilash/ajratish', html.includes('Ziynat Restoran') && html.includes('shu restoran sahifasini ochadi') && html.includes('Almashtirish') && html.includes('Pinni yangilash') && html.includes('Ajratish'));
  check('restoran guruhi: umumiy promo tugmasi YO‘Q, reklama O‘CHIQ, reklama tugmasi o‘chirilgan', !html.includes('Umumiy pinni qayta yuborish') && html.includes('aria-checked="false"') && html.includes('umumiy reklama yuborilmaydi') && /disabled=""[^>]*title="Bu chatda reklama o‘chirilgan"|title="Bu chatda reklama o‘chirilgan"[^>]*disabled=""/.test(html));
  html = card({ ...rest, restaurantPin: { isPinned: false, error: 'Botda "Xabarlarni mahkamlash" (Pin messages) huquqi yo‘q' } });
  check('pin huquqi yo‘q — aniq xato ko‘rsatiladi', html.includes('Pin messages') && html.includes('Pin yo‘q'));
  html = card(channel);
  check('kanal: belgisi, umumiy promo tugmasi yo‘q, restoran biriktirish bor', html.includes('ti-speakerphone') && html.includes('kanal') && !html.includes('Umumiy pinni qayta yuborish') && html.includes('bind-restaurant'));
  html = card({ ...general, isBotAdmin: false });
  check('bot admin emas: biriktirish va reklama o‘chirilgan', html.includes('Admin emas') && /data-testid="bind-restaurant"/.test(html) && (html.match(/disabled=""/g) || []).length >= 2);

  html = clean(renderToString(h(TargetPicker, { groups: [general, rest, channel, { ...general, chatId: '-4', title: 'Admin emas', isBotAdmin: false }], onClose: noop, onNext: noop })));
  check('reklama tanlovi: faqat reklamasi yoqilgan chatlar standart tanlangan (1 ta)', html.includes('1 ta chat tanlandi') && html.includes('Davom etish (1)'));
  check('reklamasi o‘chirilgan / admin emas chatlar sababi bilan va tanlab bo‘lmaydi', html.includes('reklama o‘chirilgan') && html.includes('bot admin emas') && (html.match(/type="checkbox"[^>]*disabled=""/g) || []).length === 3);
  check('restoran chati tanlovda restoran nomi bilan ko‘rinadi', html.includes('🍽 Ziynat Restoran'));
} finally { await server.close(); }
if (failed) { console.log(`\n${failed} ta xato`); process.exit(1); }
console.log('\nHammasi o‘tdi');
