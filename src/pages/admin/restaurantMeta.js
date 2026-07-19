// Muassasa kategoriya va turlari — O'zbekiston sharoitidan kelib chiqib.
// RestaurantsPage va CreateRestaurantPage birgalikda ishlatadi.

export const CATEGORIES = [
  { value: 'milliy', label: 'Milliy oshxona', icon: 'ti-bowl' },
  { value: 'choyxona', label: 'Choyxona', icon: 'ti-tea' },
  { value: 'osh', label: 'Oshxona / Osh markazi', icon: 'ti-cooker' },
  { value: 'shashlik', label: 'Shashlik / Mangal', icon: 'ti-flame' },
  { value: 'fastfood', label: 'Fast food', icon: 'ti-pizza' },
  { value: 'lavash', label: 'Lavash / Shaurma', icon: 'ti-meat' },
  { value: 'burger', label: 'Burger', icon: 'ti-burger' },
  { value: 'sushi', label: 'Sushi / Yapon', icon: 'ti-fish' },
  { value: 'pitsa', label: 'Pitseriya', icon: 'ti-pizza' },
  { value: 'kafe', label: 'Kafe', icon: 'ti-coffee' },
  { value: 'shirinlik', label: 'Shirinlik / Nonvoyxona', icon: 'ti-cake' },
  { value: 'restoran', label: 'Restoran (yevropa)', icon: 'ti-tools-kitchen-2' },
  { value: 'klub', label: 'Tungi klub / Lounge', icon: 'ti-disco' },
  { value: 'bar', label: 'Bar / Pab', icon: 'ti-beer' },
  { value: 'magazin_oziq', label: "Oziq-ovqat do'koni", icon: 'ti-building-store' },
  { value: 'magazin_meva', label: 'Meva-sabzavot', icon: 'ti-apple' },
  { value: 'salqin', label: 'Muzqaymoq / Salqin', icon: 'ti-ice-cream' },
];

export const KINDS = [
  { value: 'restaurant', label: 'Restoran', icon: 'ti-tools-kitchen-2', desc: "To'liq menyu, zal bilan" },
  { value: 'choyxona', label: 'Choyxona', icon: 'ti-tea', desc: "Milliy, so'rilar bilan" },
  { value: 'cafe', label: 'Kafe', icon: 'ti-coffee', desc: 'Yengil taomlar, ichimlik' },
  { value: 'fastfood', label: 'Fast food', icon: 'ti-pizza', desc: 'Tez tayyor taomlar' },
  { value: 'club', label: 'Tungi klub', icon: 'ti-disco', desc: 'Kechqurun/tunda ishlaydi' },
  { value: 'shop', label: 'Magazin', icon: 'ti-building-store', desc: 'Mahsulot yetkazish' },
];

export const KIND_LABEL = KINDS.reduce((acc, k) => { acc[k.value] = k.label; return acc; }, {});

// Do'kon yo'nalishlari — faqat kind='shop' bo'lganda ko'rsatiladi.
// LokmaGo ovqat yetkazish platformasi: faqat oziq-ovqat bilan bog'liq turlar.
export const SHOP_TYPES = [
  { value: 'oziq_ovqat', label: 'Oziq-ovqat', icon: 'ti-building-store' },
  { value: 'meva_sabzavot', label: 'Meva-sabzavot', icon: 'ti-apple' },
  { value: 'nonvoyxona', label: 'Nonvoyxona', icon: 'ti-bread' },
  { value: 'shirinlik', label: 'Shirinlik', icon: 'ti-cake' },
  { value: 'ichimlik', label: 'Ichimliklar', icon: 'ti-bottle' },
  { value: 'gosht', label: "Go'sht mahsulotlari", icon: 'ti-meat' },
  { value: 'sut', label: 'Sut mahsulotlari', icon: 'ti-milk' },
  { value: 'quruq_meva', label: 'Quruq meva', icon: 'ti-seeding' },
  { value: 'salqin', label: 'Muzqaymoq / salqin', icon: 'ti-ice-cream' },
];
