/* Katalog guruhlari: 70 kategoriya HAR BIRI aniq bir guruhda. npm run test:catalog */
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG_CATEGORIES } from '../src/constants/catalogCategories.js';
import { CATALOG_GROUPS, OTHER_GROUP, groupIdOfCategory, summarizeGroups } from '../src/constants/catalogGroups.js';

test('har bir kategoriya aniq BITTA guruhda (yo‘qolmaydi, takrorlanmaydi)', () => {
  const seen = new Map();
  for (const g of CATALOG_GROUPS) for (const c of g.categories) { assert.ok(!seen.has(c), `${c} ikki guruhda: ${seen.get(c)} va ${g.id}`); seen.set(c, g.id); }
  const missing = CATALOG_CATEGORIES.map((c) => c.value).filter((v) => !seen.has(v));
  assert.deepEqual(missing, [], `guruhsiz kategoriyalar: ${missing.join(', ')}`);
  const unknown = [...seen.keys()].filter((v) => !CATALOG_CATEGORIES.some((c) => c.value === v));
  assert.deepEqual(unknown, [], `ro‘yxatda yo‘q kategoriyalar: ${unknown.join(', ')}`);
  assert.equal(seen.size, CATALOG_CATEGORIES.length);
});

test('guruh id lari noyob, har birida nom, tavsif, emoji', () => {
  assert.equal(new Set(CATALOG_GROUPS.map((g) => g.id)).size, CATALOG_GROUPS.length);
  for (const g of CATALOG_GROUPS) { assert.ok(g.label && g.hint && g.emoji && g.categories.length, g.id); assert.notEqual(g.id, OTHER_GROUP.id); }
});

test('muzqaymoq — alohida kartochka (sut guruhida EMAS), kategoriyasi faqat o‘zida', () => {
  const g = CATALOG_GROUPS.find((x) => x.id === 'muzqaymoq');
  assert.ok(g, 'muzqaymoq guruhi bor');
  assert.deepEqual(g.categories, ['muzqaymoq']);
  assert.equal(groupIdOfCategory('muzqaymoq'), 'muzqaymoq');
  assert.ok(!CATALOG_GROUPS.find((x) => x.id === 'sut').categories.includes('muzqaymoq'), 'sut guruhidan chiqarilgan');
  // sut guruhi qolgan kategoriyalarini yo'qotmagan
  assert.deepEqual(CATALOG_GROUPS.find((x) => x.id === 'sut').categories, ['sut_mahsulotlari', 'pishloq_mahsulotlari', 'sariyog_margarin', 'tuxum']);
  // yig'indi: muzqaymoq mahsulotlari muzqaymoq kartochkasiga tushadi, sut kartochkasiga EMAS
  const { groups } = summarizeGroups([{ category: 'muzqaymoq', total: 7, active: 5, withImage: 3 }, { category: 'tuxum', total: 4, active: 4, withImage: 4 }]);
  assert.equal(groups.find((x) => x.id === 'muzqaymoq').total, 7);
  assert.equal(groups.find((x) => x.id === 'sut').total, 4);
});

test('kolbasa_sosiska — alohida kartochka (go‘sht guruhida EMAS), go‘sht qolgan kategoriyalarini yo‘qotmagan', () => {
  const g = CATALOG_GROUPS.find((x) => x.id === 'kolbasa');
  assert.ok(g, 'kolbasa guruhi bor');
  assert.deepEqual(g.categories, ['kolbasa_sosiska']);
  assert.equal(groupIdOfCategory('kolbasa_sosiska'), 'kolbasa');
  assert.deepEqual(CATALOG_GROUPS.find((x) => x.id === 'gosht').categories, ['gosht_mahsulotlari', 'parranda_goshti', 'baliq_dengiz_mahsulotlari']);
  const { groups } = summarizeGroups([{ category: 'kolbasa_sosiska', total: 40, active: 39, withImage: 9 }, { category: 'parranda_goshti', total: 25, active: 25, withImage: 20 }]);
  assert.equal(groups.find((x) => x.id === 'kolbasa').total, 40);
  assert.equal(groups.find((x) => x.id === 'gosht').total, 25);
});

test('noma‘lum kategoriya → "Boshqa" (hech narsa yo‘qolmaydi)', () => {
  assert.equal(groupIdOfCategory('yangi_hali_yoq'), 'boshqa');
  assert.equal(groupIdOfCategory('gosht_mahsulotlari'), 'gosht');
});

test('yig‘indi: guruh jami = pastki kategoriyalar yig‘indisi; bo‘sh guruh ham bor; "Boshqa" faqat mahsulot bo‘lsa', () => {
  const counts = [
    { category: 'gosht_mahsulotlari', total: 4, active: 3, withImage: 2 },
    { category: 'parranda_goshti', total: 8, active: 8, withImage: 8 },
    { category: 'sut_mahsulotlari', total: 5, active: 5, withImage: 0 },
  ];
  const { groups } = summarizeGroups(counts);
  assert.equal(groups.length, CATALOG_GROUPS.length, 'Boshqa yo‘q');
  const g = groups.find((x) => x.id === 'gosht');
  assert.deepEqual([g.total, g.active, g.withImage], [12, 11, 10]);
  assert.deepEqual(g.subs.map((s) => s.category), ['gosht_mahsulotlari', 'parranda_goshti'], 'ro‘yxat tartibida');
  assert.equal(groups.find((x) => x.id === 'ichimlik').total, 0, 'bo‘sh guruh ham ko‘rinadi');
  const withOther = summarizeGroups([...counts, { category: 'nomalum', total: 2, active: 2, withImage: 0 }]).groups;
  assert.equal(withOther.at(-1).id, 'boshqa'); assert.equal(withOther.at(-1).total, 2);
});

import { countFromItems, sortProducts, filterProducts } from '../src/lib/catalogCounts.js';
test('countFromItems: jami, faol va rasmli sonlar', () => {
  const r = countFromItems([
    { category: 'a', isActive: true, imageUrl: 'x' }, { category: 'a', isActive: false, imageUrl: '' },
    { category: 'b', imageUrl: 'y' },
  ]);
  assert.deepEqual(r.find((c) => c.category === 'a'), { category: 'a', total: 2, active: 1, withImage: 1 });
  assert.deepEqual(r.find((c) => c.category === 'b'), { category: 'b', total: 1, active: 1, withImage: 1 });
});
test('tartiblash va filtr', () => {
  const l = [{ name: 'Banan', usageCount: 1, createdAt: '2026-01-02' }, { name: 'Anor', usageCount: 5, createdAt: '2026-01-01', isActive: false, imageUrl: 'i' }, { name: 'Olma', usageCount: 5, createdAt: '2026-01-03' }];
  assert.deepEqual(sortProducts(l, 'name').map((p) => p.name), ['Anor', 'Banan', 'Olma']);
  assert.deepEqual(sortProducts(l, 'name_desc').map((p) => p.name), ['Olma', 'Banan', 'Anor']);
  assert.deepEqual(sortProducts(l, 'usage').map((p) => p.name), ['Anor', 'Olma', 'Banan']);
  assert.deepEqual(sortProducts(l, 'new').map((p) => p.name), ['Olma', 'Banan', 'Anor']);
  assert.deepEqual(filterProducts(l, { status: 'inactive' }).map((p) => p.name), ['Anor']);
  assert.deepEqual(filterProducts(l, { image: 'without' }).map((p) => p.name), ['Banan', 'Olma']);
  assert.deepEqual(filterProducts(l, { q: 'ban' }).map((p) => p.name), ['Banan']);
});

import { queryPage as qp, metaOf as mo, hash32 as h32, seededRank as sr } from '../src/lib/catalogPaging.js';
test('FIXTURE: xesh va tasodifiy tartib SERVER bilan AYNAN BIR XIL (eski server uchun zaxira)', () => {
  assert.equal(h32('abc'), 482950588);
  assert.equal(sr('fixture1', 'id00000'), 2408853168);
  const items = Array.from({ length: 12 }, (_, i) => ({ _id: `id${String(i).padStart(5, '0')}`, name: `Mahsulot ${String(i).padStart(4, '0')}`, category: 'meva', isActive: true, imageUrl: '', description: '', volume: '', usageCount: 0, createdAt: '2026-01-01' }));
  const metas = items.map(mo);
  const order = (seed) => qp(items, metas, { sort: 'random', seed, limit: 12 }).items.map((p) => p._id).join(',');
  assert.equal(order('fixture1'), 'id00011,id00001,id00005,id00004,id00000,id00009,id00008,id00002,id00003,id00010,id00006,id00007');
  assert.equal(order('kalit2'), 'id00002,id00011,id00001,id00007,id00000,id00008,id00009,id00010,id00003,id00005,id00004,id00006');
});

import { existsSync, readdirSync } from 'node:fs';
test('har bir guruh kartochkasining muqova rasmi bor (src/assets/catalog-groups/<id>.webp yoki <id>@<kenglik>.webp)', () => {
  const files = readdirSync(new URL('../src/assets/catalog-groups/', import.meta.url));
  const has = (id) => files.some((f) => new RegExp(`^${id}(@\\d+)?\\.(webp|jpe?g|png|avif)$`, 'i').test(f));
  const missing = CATALOG_GROUPS.filter((g) => !has(g.id)).map((g) => g.id);
  assert.deepEqual(missing, [], `rasmsiz kartochkalar: ${missing.join(', ')}`);
});
test('uy-ro‘zg‘or va bolalar: 7 ta kartochka, kalitlar to‘g‘ri', () => {
  const want = { bolalar_gigiyena: 'bolalar_gigiyena', bolalar_ovqat: 'bolalar_oziq_ovqatlari', uyrozgor: 'uy_rozgor_mahsulotlari', kimyo: 'maishiy_kimyo', tozalash: 'tozalash_vositalari', qogoz: 'qogoz_salfetka', oshxona: 'oshxona_xojalik_buyumlari' };
  for (const [id, cat] of Object.entries(want)) assert.equal(groupIdOfCategory(cat), id, cat);
});

test('shaxsiy_gigiyena — alohida kartochka (uy-ro‘zg‘orda EMAS), uy-ro‘zg‘or qolgan kategoriyalarini yo‘qotmagan', () => {
  const g = CATALOG_GROUPS.find((x) => x.id === 'shaxsiy');
  assert.ok(g, 'shaxsiy guruhi bor');
  assert.deepEqual(g.categories, ['shaxsiy_gigiyena']);
  assert.equal(groupIdOfCategory('shaxsiy_gigiyena'), 'shaxsiy');
  const home = CATALOG_GROUPS.find((x) => x.id === 'uyrozgor').categories;
  assert.ok(!home.includes('shaxsiy_gigiyena') && home.includes('uy_rozgor_mahsulotlari') && home.includes('bir_martalik_idishlar'));
  const { groups } = summarizeGroups([{ category: 'shaxsiy_gigiyena', total: 55, active: 50, withImage: 12 }, { category: 'uy_rozgor_mahsulotlari', total: 9, active: 9, withImage: 9 }]);
  assert.equal(groups.find((x) => x.id === 'shaxsiy').total, 55);
  assert.equal(groups.find((x) => x.id === 'uyrozgor').total, 9);
});

test('shirinlik: 6 kategoriya BITTA kartochkada (non va tayyor guruhlaridan ko‘chgan), qolganlari yo‘qolmagan', () => {
  const g = CATALOG_GROUPS.find((x) => x.id === 'shirinlik');
  assert.ok(g, 'shirinlik guruhi bor');
  assert.deepEqual([...g.categories].sort(), ['chips_snacklar', 'konfetlar', 'pechenye', 'shirinliklar', 'shokolad', 'vafli']);
  for (const c of g.categories) assert.equal(groupIdOfCategory(c), 'shirinlik', c);
  assert.deepEqual(CATALOG_GROUPS.find((x) => x.id === 'non').categories, ['non_mahsulotlari', 'keks_pishiriqlar', 'qandolat_mahsulotlari', 'pishirish_mahsulotlari']);
  const tayyor = CATALOG_GROUPS.find((x) => x.id === 'tayyor').categories;
  assert.ok(!tayyor.includes('chips_snacklar') && tayyor.includes('fastfood_mahsulotlari') && tayyor.includes('nonushta_mahsulotlari') && tayyor.length === 10);
  const { groups } = summarizeGroups([
    { category: 'shokolad', total: 120, active: 100, withImage: 5 }, { category: 'pechenye', total: 80, active: 80, withImage: 5 },
    { category: 'chips_snacklar', total: 60, active: 60, withImage: 5 }, { category: 'non_mahsulotlari', total: 30, active: 30, withImage: 5 },
  ]);
  assert.equal(groups.find((x) => x.id === 'shirinlik').total, 260, 'shokolad + pechenye + chips bitta kartochkada');
  assert.equal(groups.find((x) => x.id === 'non').total, 30);
});
