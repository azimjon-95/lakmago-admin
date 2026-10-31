import test from 'node:test';
import assert from 'node:assert/strict';
import { fmtInt, sumProducts, countLabel } from '../src/lib/catalogTotals.js';
import { summarizeGroups, CATALOG_GROUPS } from '../src/constants/catalogGroups.js';

const NB = '\u00a0';
test('fmtInt: mingliklar NBSP bilan, bo‘sh/xato qiymat 0', () => {
  assert.equal(fmtInt(0), '0'); assert.equal(fmtInt(999), '999'); assert.equal(fmtInt(1000), `1${NB}000`);
  assert.equal(fmtInt(16900), `16${NB}900`); assert.equal(fmtInt(1234567), `1${NB}234${NB}567`);
  assert.equal(fmtInt(null), '0'); assert.equal(fmtInt(undefined), '0'); assert.equal(fmtInt('abc'), '0'); assert.equal(fmtInt(12.6), '13');
});

test('countLabel: "19 ta · 16 900 mahsulot" (misol), mahsulot yo‘q bo‘lsa faqat son', () => {
  const groups = Array.from({ length: 19 }, (_, i) => ({ id: `g${i}`, total: i === 0 ? 16900 - 18 * 100 : 100 }));
  assert.equal(sumProducts(groups), 16900);
  assert.equal(countLabel(groups), `19 ta · 16${NB}900 mahsulot`);
  assert.equal(countLabel([{ total: 0 }, { total: 0 }]), '2 ta');
  assert.equal(countLabel([]), '0 ta');
  assert.equal(countLabel(undefined), '0 ta');
});

test('summarizeGroups bilan: haqiqiy guruhlardan jami to‘g‘ri yig‘iladi (muzqaymoq/kolbasa/shaxsiy alohida)', () => {
  const counts = [
    { category: 'muzqaymoq', total: 169, active: 160, withImage: 1 }, { category: 'kolbasa_sosiska', total: 37, active: 37, withImage: 1 },
    { category: 'shaxsiy_gigiyena', total: 55, active: 50, withImage: 1 }, { category: 'gosht_mahsulotlari', total: 46, active: 46, withImage: 1 },
  ];
  const { groups } = summarizeGroups(counts);
  assert.equal(sumProducts(groups), 169 + 37 + 55 + 46, 'barcha mahsulotlar bir marta sanaladi');
  assert.equal(groups.length, CATALOG_GROUPS.length, 'bo‘sh guruhlar ham ro‘yxatda (admin)');
  const nonEmpty = groups.filter((g) => g.total > 0);
  assert.equal(countLabel(nonEmpty), `4 ta · ${fmtInt(307)} mahsulot`, 'panel: faqat mahsuloti borlari');
});
