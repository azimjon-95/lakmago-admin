import { CATALOG_CATEGORIES } from './catalogCategories.js';

/*
 * ═══ KATALOG GURUHLARI (yuqori daraja) ═══
 *
 * Umumiy katalogda 70 ta tekis kategoriya bor (constants/catalogCategories.js, serverdagi bilan bir xil). 70 ta
 * kartochka ko'rinmaydi — ular 10 ta KATTA GURUHGA yig'iladi: guruh kartochkasi → ichida pastki kategoriyalar
 * (chiplar) → mahsulotlar. Server va ma'lumotlar bazasiga TEGILMAYDI: guruhlash faqat shu yerda.
 *
 * Qoida: har bir kategoriya FAQAT BITTA guruhda (tests/catalogGroups.test.mjs tekshiradi). Ro'yxatda yo'q yangi
 * kategoriya qo'shilsa — avtomatik "Boshqa" guruhiga tushadi (hech narsa yo'qolmaydi).
 *
 * RASMLAR: guruh muqovasi `src/assets/catalog-groups/<id>.webp|jpg|png` (masalan gosht.webp) — fayl shu papkaga
 * tushishi bilan O'ZI ulanadi (lib/catalogCovers.js), kodni o'zgartirish shart emas. Rasm bo'lmasa — gradient + emoji.
 */
export const CATALOG_GROUPS = [
  { id: 'gosht', label: "Go'sht mahsulotlari", hint: "Mol, qo'y, parranda, baliq…", emoji: '🥩', from: '#7A1F1F', to: '#C2410C',
    categories: ['gosht_mahsulotlari', 'parranda_goshti', 'kolbasa_sosiska', 'baliq_dengiz_mahsulotlari'] },
  { id: 'sut', label: 'Sut mahsulotlari', hint: 'Sut, pishloq, qaymoq, tuxum…', emoji: '🥛', from: '#1E3A8A', to: '#60A5FA',
    categories: ['sut_mahsulotlari', 'pishloq_mahsulotlari', 'sariyog_margarin', 'tuxum', 'muzqaymoq'] },
  { id: 'sabzavot', label: 'Sabzavotlar', hint: "Yangi sabzavot va ko'katlar", emoji: '🥕', from: '#166534', to: '#65A30D',
    categories: ['yangi_sabzavot', 'kokatlar', 'tuzlama_marinad', 'tomat_mahsulotlari'] },
  { id: 'meva', label: 'Mevalar', hint: 'Mavsumiy va quruq mevalar', emoji: '🍎', from: '#B91C1C', to: '#F59E0B',
    categories: ['yangi_meva', 'quruq_mevalar', 'yongoqlar', 'murabbo_jem', 'asal'] },
  { id: 'don', label: 'Yormalar va donlar', hint: 'Guruch, un, makaron, dukkakli…', emoji: '🌾', from: '#854D0E', to: '#D97706',
    categories: ['guruch_don', 'un_mahsulotlari', 'makaron_mahsulotlari', 'dukkakli_mahsulotlar'] },
  { id: 'ichimlik', label: 'Ichimliklar', hint: 'Suv, sharbat, gazli, choy, qahva…', emoji: '🥤', from: '#0F172A', to: '#DC2626',
    categories: ['ichimliklar', 'mineral_suv', 'sharbatlar', 'gazli_ichimliklar', 'energetik_ichimliklar', 'choy', 'qahva', 'kakao'] },
  { id: 'non', label: 'Non va qandolat', hint: 'Non, pirog, shirinlik, pechenye…', emoji: '🥐', from: '#78350F', to: '#EA9A3E',
    categories: ['non_mahsulotlari', 'keks_pishiriqlar', 'pechenye', 'vafli', 'shirinliklar', 'konfetlar', 'shokolad', 'qandolat_mahsulotlari', 'pishirish_mahsulotlari'] },
  { id: 'ziravor', label: 'Ziravorlar va souslar', hint: "Ziravor, tuz, sous, yog', sirka…", emoji: '🌶️', from: '#7C2D12', to: '#CA8A04',
    categories: ['ziravorlar', 'tuz', 'souslar', 'ketchup_mayonez', 'sirka', 'osimlik_yoglari', 'shakar_shirinlashtiruvchi'] },
  { id: 'tayyor', label: 'Tayyor va muzlatilgan', hint: 'Yarim tayyor, konserva, fast-food…', emoji: '🍱', from: '#3F3F46', to: '#B45309',
    categories: ['muzlatilgan_mahsulotlar', 'yarim_tayyor_mahsulotlar', 'konserva_mahsulotlari', 'fastfood_mahsulotlari', 'chips_snacklar', 'nonushta_mahsulotlari',
      'milliy_oziq_ovqat', 'xorijiy_oziq_ovqat', 'parhezbop_mahsulotlar', 'bolalar_oziq_ovqatlari', 'ofis_korxona_oziq_ovqat', 'restoran_kafe_mahsulotlari'] },
  { id: 'uyrozgor', label: "Uy-ro'zg'or", hint: 'Kimyo, gigiyena, idish, qadoq…', emoji: '🧴', from: '#134E4A', to: '#0EA5E9',
    categories: ['maishiy_kimyo', 'shaxsiy_gigiyena', 'qogoz_salfetka', 'bir_martalik_idishlar', 'oshxona_xojalik_buyumlari', 'tozalash_vositalari', 'uy_rozgor_mahsulotlari',
      'bolalar_gigiyena', 'uy_hayvonlari_ozuqasi', 'tamaki_mahsulotlari', 'sovgalik_qadoqlangan', 'qadoqlash_materiallari'] },
];

export const OTHER_GROUP = { id: 'boshqa', label: 'Boshqa', hint: "Guruhga kirmagan mahsulotlar", emoji: '📦', from: '#44403C', to: '#78716C', categories: [] };

const GROUP_OF = new Map();
CATALOG_GROUPS.forEach((g) => g.categories.forEach((c) => GROUP_OF.set(c, g.id)));

/** Kategoriya qiymati → guruh id (ro'yxatda yo'q bo'lsa 'boshqa'). */
export const groupIdOfCategory = (value) => GROUP_OF.get(value) || OTHER_GROUP.id;

/**
 * Guruhning so'rov kategoriyalari. Oddiy guruhlarda — BARQAROR ro'yxat (sonlar o'zgarsa ham so'rov kaliti o'zgarmaydi:
 * saqlash/o'chirishdan keyin ro'yxat qayta aralashib ketmaydi). "Boshqa" guruhida — mavjudlari.
 */
export const catsOfGroup = (g) => (g.categories?.length ? g.categories : (g.subs || []).map((s) => s.category));

export const groupById = (id) => CATALOG_GROUPS.find((g) => g.id === id) || (id === OTHER_GROUP.id ? OTHER_GROUP : null);

const LABELS = new Map(CATALOG_CATEGORIES.map((c) => [c.value, c.label]));
export const categoryLabel = (value) => LABELS.get(value) || value;

/**
 * counts: [{ category, total, active, withImage }] → guruhlar bo'yicha yig'indi.
 * Bo'sh guruhlar ham ko'rsatiladi (mahsulot qo'shish uchun), "Boshqa" — faqat mahsulot bo'lsa.
 */
export function summarizeGroups(counts = []) {
  const by = new Map(counts.map((c) => [c.category, c]));
  const out = CATALOG_GROUPS.map((g) => ({ ...g, subs: [] }));
  const other = { ...OTHER_GROUP, subs: [] };
  const index = new Map(out.map((g) => [g.id, g]));
  for (const c of counts) {
    const g = index.get(groupIdOfCategory(c.category)) || other;
    g.subs.push(c);
  }
  const sum = (g, k) => g.subs.reduce((a, s) => a + (s[k] || 0), 0);
  const fin = (g) => ({ ...g, total: sum(g, 'total'), active: sum(g, 'active'), withImage: sum(g, 'withImage'),
    // pastki kategoriyalar: avval ro'yxat tartibida, mahsuloti borlari
    subs: [...g.subs].filter((s) => s.total > 0).sort((a, b) => (g.categories.indexOf(a.category) + 1 || 999) - (g.categories.indexOf(b.category) + 1 || 999)) });
  const res = out.map(fin);
  if (other.subs.length) res.push(fin(other));
  return { groups: res, byCategory: by };
}
