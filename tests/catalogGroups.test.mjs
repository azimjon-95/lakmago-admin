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
