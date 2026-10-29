/*
 * "MIJOZ RAD ETDI" — ikki rejim (server: CANCEL_APPROVAL_REQUIRED):
 *
 *   approval (eski)    restoran SO'ROV yuboradi → buyurtma admin tasdiqlaguncha DAVOM ETADI.
 *                      Admin: "bekor qilishni tasdiqlash" yoki "rad etish (buyurtma davom etadi)".
 *   post (standart)    restoran buyurtmani DARHOL bekor qiladi → admin KEYIN ko'rib chiqadi.
 *                      Buyurtma allaqachon bekor: admin faqat "mijoz aybdor" (chora ko'rish mumkin) yoki "asossiz"
 *                      (chora yo'q) deb belgilaydi — buyurtma HECH QACHON qayta tiklanmaydi.
 *
 * Eski server `mode` maydonini bermaydi → hammasi eski ma'noda (o'zgarishsiz).
 */
export const isPost = (inc) => inc?.mode === 'post';

const APPROVAL = {
  pending: { label: 'Kutilmoqda', cls: 'bg-amber-50 text-amber-700' },
  approved: { label: 'Bekor qilindi', cls: 'bg-red-50 text-red-600' },
  rejected: { label: 'Rad etildi', cls: 'bg-canvas text-muted' },
};
const POST = {
  pending: { label: 'Ko‘rib chiqilmagan', cls: 'bg-amber-50 text-amber-700' },
  approved: { label: 'Mijoz aybdor', cls: 'bg-red-50 text-red-600' },
  rejected: { label: 'Asossiz', cls: 'bg-canvas text-muted' },
};

/** Holat yorlig'i (rejimga qarab): { label, cls } */
export const statusInfo = (inc) => (isPost(inc) ? POST : APPROVAL)[inc?.status] || APPROVAL.pending;

/** Qaror tasdiqlash oynasi va tugmalar matnlari. approve=true — "mijoz aybdor"/"bekor qilishni tasdiqlash". */
export function decisionTexts(inc, { approve, disableCash = false, block = false } = {}) {
  const flags = [disableCash && 'mijozning naqd to‘lovi o‘chiriladi', block && 'mijoz bloklanadi'].filter(Boolean).join(', ');
  if (isPost(inc)) {
    return approve
      ? { title: 'Mijoz aybdor deb belgilansinmi?', content: flags || 'Buyurtma allaqachon bekor qilingan. Mijozga cheklov qo‘yilmaydi', tone: 'danger' }
      : { title: 'Asossiz deb belgilansinmi?', content: 'Buyurtma allaqachon bekor qilingan — mijozga hech qanday chora ko‘rilmaydi', tone: 'warning' };
  }
  return approve
    ? { title: 'Buyurtma bekor qilinsinmi?', content: flags || 'Mijozga cheklov qo‘yilmaydi', tone: 'danger' }
    : { title: 'So‘rov rad etilsinmi?', content: 'Buyurtma bekor qilinmaydi, restoran davom ettiradi', tone: 'warning' };
}

export const decisionButtons = (inc) => (isPost(inc)
  ? { no: 'ℹ️ Asossiz (chora yo‘q)', yes: '🧾 Mijoz aybdor' }
  : { no: '❌ Rad etish (buyurtma davom etadi)', yes: '✅ Bekor qilishni tasdiqlash' });

export const pendingBanner = (inc) => (isPost(inc)
  ? 'Buyurtma restoran tomonidan DARHOL bekor qilingan. Siz holatni ko‘rib chiqasiz: mijozga chora ko‘rish kerakmi? (Buyurtma qayta tiklanmaydi.)'
  : null);

/*
 * Restoran paneli: GET /panel/refusal-reasons javobi ikki shaklda bo'lishi mumkin —
 * eski server: massiv [{value,label}]; yangi: { reasons, approvalRequired }.
 * Eski server har doim admin tasdig'ini kutadi (approvalRequired = true).
 */
export function parseRefusalReasons(res) {
  if (Array.isArray(res)) return { reasons: res, approvalRequired: true };
  return { reasons: Array.isArray(res?.reasons) ? res.reasons : [], approvalRequired: res?.approvalRequired !== false };
}
