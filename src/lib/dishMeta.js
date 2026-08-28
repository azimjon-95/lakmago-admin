/**
 * ICHIMLIK TURLARI.
 *
 * Nega asosiy kategoriyaga qo'shilmadi:
 * mijoz bosh sahifada "Ichimlik" ni tanlaydi va HAMMA
 * ichimlikni ko'rishi kerak. "Choy", "Sok", "Gazli" alohida
 * asosiy kategoriya bo'lsa, bosh sahifa 20 tadan 30 taga
 * chiqib ketardi va mijoz sokni qidirib topa olmasdi.
 *
 * Shuning uchun ichimlik ICHIDA guruhlash: menyuda sarlavha
 * bo'lib chiqadi, bosh sahifada esa bittaligicha qoladi.
 */
export const DRINK_TYPES = [
  { value: 'salqin', label: 'Salqin ichimliklar' },
  { value: 'gazli', label: 'Gazli ichimliklar' },
  { value: 'sok', label: 'Sharbat / sok' },
  { value: 'choy', label: 'Choy' },
  { value: 'qahva', label: 'Qahva' },
  { value: 'suv', label: 'Suv' },
  { value: 'sut', label: 'Sut mahsulotlari' },
  { value: 'milliy', label: 'Milliy ichimliklar' },
  { value: 'energetik', label: 'Energetik' },
  { value: 'boshqa', label: 'Boshqa' },
];

export const DRINK_LABEL = Object.fromEntries(
  DRINK_TYPES.map((d) => [d.value, d.label]),
);

/**
 * Ichimlik kategoriyalari.
 *
 * Massiv, chunki katalogda ('ichimliklar') va restoran
 * menyusida ('salqin') tarixan har xil nom ishlatilgan.
 * Ikkalasini ham qo'llab-quvvatlaymiz — bazadagi mavjud
 * yozuvlarni ko'chirish shart bo'lmasin.
 */
const DRINK_CATEGORIES = ['salqin', 'ichimliklar', 'ichimlik', 'koffe'];

/** Shu kategoriya ichimlikmi. */
export function isDrink(category) {
  return DRINK_CATEGORIES.includes(String(category || '').toLowerCase());
}

/**
 * Miqdor maydonining ko'rinishi.
 *
 * Ichimlikda gramm so'rash xato: mijoz 0.5 l ni kutadi,
 * "500 г" esa g'alati ko'rinadi va litrga aylantirib
 * o'ylashga majbur qiladi.
 */
export function amountField(category) {
  return isDrink(category)
    ? {
      label: 'Hajm',
      unit: 'l',
      placeholder: '0.5 l',
      hint: 'Masalan: 0.5 l · 1 l · 330 ml',
      field: 'volume',
    }
    : {
      label: "Og'irlik",
      unit: 'г',
      placeholder: '150 г',
      hint: 'Bitta taom: 150 г · Assorti: 150/30/30/20 г',
      field: 'weight',
    };
}

/**
 * Ichimlikda kaloriya/oqsil/yog'/uglevod so'ralmaydi.
 *
 * Restoran ularni bilmaydi va bilishi ham shart emas —
 * ichimlik odatda tayyor mahsulot. Bo'sh maydonlar esa
 * formani uzaytirib, to'ldirishni og'irlashtiradi.
 */
export function showNutrition(category) {
  return !isDrink(category);
}
