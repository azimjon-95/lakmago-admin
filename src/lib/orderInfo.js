/*
 * Buyurtma kartasidagi mijoz/manzil/to'lov/bekor ma'lumotlari uchun yordamchilar.
 * Sof funksiyalar — testlanadi.
 */

/** Mijoz. `userId` populate qilingan obyekt bo'lishi ham, oddiy matn (id) bo'lishi ham mumkin. */
export function customerOf(o) {
  const u = o?.userId && typeof o.userId === 'object' ? o.userId : {};
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return {
    name: name || o?.customerName || 'Mijoz',
    username: String(u.username || '').replace(/^@/, ''),
    // Buyurtmadagi telefon (yetkazish uchun) birinchi, bo'lmasa profil telefoni
    phone: o?.phone || u.phone || '',
    telegramId: u.telegramId || '',
  };
}

/** +998901234567 → "+998 90 123 45 67". Boshqa shakl — o'zgarishsiz. */
export function formatPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  const m = digits.match(/^998(\d{2})(\d{3})(\d{2})(\d{2})$/);
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : String(raw || '');
}

/** tel: havolasi uchun faqat raqamlar va "+". */
export const telHref = (raw) => {
  const d = String(raw || '').replace(/[^\d+]/g, '');
  return d ? `tel:${d.startsWith('+') ? d : `+${d}`}` : '';
};

/*
 * Koordinata yaroqlimi. `Number(null) === 0` tuzog'i: null/bo'sh qiymat 0 deb
 * o'qilib, "(0, 0)" xaritada Gvineya ko'rfazini ko'rsatardi — shuning uchun
 * avval TUR tekshiriladi. (0, 0) "Null Island" ham yaroqsiz.
 */
export function validCoords(lat, lng) {
  const ok = (v) => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v));
  if (!ok(lat) || !ok(lng)) return false;
  const a = Number(lat); const b = Number(lng);
  if (Math.abs(a) > 90 || Math.abs(b) > 180) return false;
  return !(a === 0 && b === 0);
}

/** Xarita havolalari (Yandex — ilova ham shuni ishlatadi; Google — zaxira). */
export function mapLinks(lat, lng) {
  const a = Number(lat); const b = Number(lng);
  return {
    yandex: `https://yandex.com/maps/?pt=${b},${a}&z=17&l=map`,
    google: `https://www.google.com/maps?q=${a},${b}`,
  };
}

export const coordsText = (lat, lng) => `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;

const PAY = { cash: 'Naqd', click: 'Click', payme: 'Payme', paynet: 'Paynet', uzum: 'Uzum' };

/** To'lov turi va holati. `paid` — pul haqiqatan tushgan (onlayn to'lov bekor qilingan bo'lsa muhim). */
export function paymentInfo(o) {
  const m = o?.paymentMethod || 'cash';
  return {
    method: m,
    label: PAY[m] || o?.paymentLabel || m,
    online: m !== 'cash',
    paid: Boolean(o?.isPaid),
  };
}

export const FULFILLMENT = { delivery: 'Yetkazish', pickup: 'Olib ketish', dinein: 'Zalda' };

/** Bekor qilish: sabab (bo'lmasa null) va vaqt. Sabab yo'q bo'lsa UYDIRMAYMIZ — "ko'rsatilmagan". */
export function cancelInfo(o) {
  const reason = String(o?.cancelReason || '').trim();
  return { reason: reason || null, at: o?.cancelledAt || null };
}

/** Qisqa buyurtma belgisi: kunlik raqam bo'lsa "#12", bo'lmasa _id oxirgi 4 belgi (bot bilan bir xil). */
export const orderTag = (o) => (o?.dailyNumber ? `#${o.dailyNumber}` : `#${String(o?._id || '').slice(-4).toUpperCase()}`);

export const hhmm = (d) => (d ? new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '');

/*
 * ─── To'liq karta uchun qo'shimcha yordamchilar (2026-10) ───
 * Faqat QO'SHILDI — yuqoridagi funksiyalar o'zgarmagan.
 */

/** Buyurtma bosqichlari: faqat haqiqatda bo'lgan (vaqti bor) qadamlar qaytadi. */
export function orderTimeline(o) {
  if (!o) return [];
  const steps = [
    ['created', 'Yaratildi', o.createdAt],
    ['paid', 'To‘landi', o.paymentMethod && o.paymentMethod !== 'cash' ? o.paidAt : null],
    ['accepted', 'Qabul', o.acceptedAt],
    ['ready', 'Tayyor', o.readyAt],
    ['delivering', 'Yo‘lda', o.deliveringAt],
    ['delivered', 'Yetkazildi', o.deliveredAt],
    ['cancelled', 'Bekor', o.cancelledAt],
  ];
  return steps.filter(([, , at]) => at).map(([key, label, at]) => ({ key, label, at }));
}

/** Ikki vaqt orasidagi daqiqa (butun). `to` berilmasa — hozir. */
export function minutesBetween(from, to) {
  if (!from) return null;
  const a = new Date(from).getTime();
  const b = to ? new Date(to).getTime() : Date.now();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.round((b - a) / 60000));
}

/** 75 → "1 soat 15 daq", 8 → "8 daq". */
export function durationText(min) {
  if (min === null || min === undefined) return '';
  if (min < 60) return `${min} daq`;
  const h = Math.floor(min / 60); const m = min % 60;
  return m ? `${h} soat ${m} daq` : `${h} soat`;
}

/** Narx tarkibi — faqat noldan farqli qatorlar (so'mda, buyurtmadagi maydonlardan). */
export function orderMoney(o) {
  if (!o) return [];
  const rows = [];
  const add = (label, value, sign = 1) => {
    const n = Number(value);
    if (Number.isFinite(n) && n !== 0) rows.push({ label, value: n * sign });
  };
  add('Taomlar', o.subtotal);
  add('Yetkazish', o.deliveryFee);
  add('Xizmat haqi', o.serviceFee);
  add(o.promotionName ? `Aksiya: ${o.promotionName}` : 'Aksiya', o.promotionDiscount, -1);
  add(o.pickupDiscountPercent ? `Olib ketish −${o.pickupDiscountPercent}%` : 'Olib ketish chegirmasi', o.pickupDiscount, -1);
  add('Bonus', o.bonusUsed, -1);
  return rows;
}

/** Element qatori: "Lavash (katta, +pishloq) ×2". */
export function itemLine(i) {
  const opts = (i?.selectedOptions || []).map((s) => s?.name).filter(Boolean);
  return `${i?.name || '—'}${opts.length ? ` (${opts.join(', ')})` : ''} ×${i?.quantity ?? 1}`;
}

/** Qidiruv uchun bitta matn (kichik harf): restoran, mijoz, telefon, manzil, belgi, taomlar. */
export function orderSearchText(o) {
  const c = customerOf(o);
  return [
    o?.restaurantName, c.name, c.username, c.phone, String(c.phone || '').replace(/\D/g, ''),
    o?.address, orderTag(o), String(o?._id || ''), o?.courierName, o?.cancelReason,
    ...(o?.items || []).map((i) => i?.name),
  ].filter(Boolean).join(' ').toLowerCase();
}
