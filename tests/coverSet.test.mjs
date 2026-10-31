import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildCovers } from '../src/lib/coverSet.js';
import { easeInOutCubic, scrollDuration } from '../src/lib/smoothScroll.js';
import { CATALOG_GROUPS } from '../src/constants/catalogGroups.js';

const P = (n) => `/src/assets/catalog-groups/${n}`;

test('buildCovers: variantlar kenglik bo‘yicha tartiblanadi, srcset to‘g‘ri, src — o‘rtacha (>=720)', () => {
  const c = buildCovers({ [P('gosht@1200.webp')]: '/a/g1200.webp', [P('gosht@480.webp')]: '/a/g480.webp', [P('gosht@720.webp')]: '/a/g720.webp' });
  assert.equal(c.gosht.srcSet, '/a/g480.webp 480w, /a/g720.webp 720w, /a/g1200.webp 1200w');
  assert.equal(c.gosht.src, '/a/g720.webp');
});

test('buildCovers: oddiy fayl (variantsiz) ham ishlaydi; katta-kichik harf farqsiz; id ajratiladi', () => {
  const c = buildCovers({ [P('Sut.WEBP')]: '/a/sut.webp', [P('don@480.webp')]: '/a/d480.webp' });
  assert.deepEqual(c.sut, { src: '/a/sut.webp', srcSet: '' });
  assert.equal(c.don.srcSet, '/a/d480.webp 480w');
  assert.equal(c.don.src, '/a/d480.webp', 'faqat kichik variant bor — o‘sha');
});

test('buildCovers: 900 kenglikli (muzqaymoq) — 720 dan keyingi eng yaqini', () => {
  const c = buildCovers({ [P('mz@480.webp')]: 'm4', [P('mz@720.webp')]: 'm7', [P('mz@900.webp')]: 'm9' });
  assert.equal(c.mz.srcSet, 'm4 480w, m7 720w, m9 900w');
  assert.equal(c.mz.src, 'm7');
});

test('haqiqiy muqovalar: har guruh rasmi uchun @480 va @720 variant bor, telefon variantlari yengil', () => {
  const dir = path.resolve('src/assets/catalog-groups');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.webp'));
  const ids = new Set(files.map((f) => f.split('@')[0].replace(/\.webp$/, '')));
  assert.ok(ids.size >= 18, 'kamida 18 ta muqova');
  let total480 = 0;
  for (const id of ids) {
    assert.ok(files.includes(`${id}@480.webp`), `${id}@480.webp bor`);
    assert.ok(files.includes(`${id}@720.webp`), `${id}@720.webp bor`);
    const kb480 = fs.statSync(path.join(dir, `${id}@480.webp`)).size / 1024;
    assert.ok(kb480 <= 60, `${id}@480 ${kb480.toFixed(0)} KB (<= 60)`);
    total480 += kb480;
    assert.ok(!files.includes(`${id}.webp`), `${id}: oddiy fayl o‘rniga variantlar (takrorlanmasin)`);
  }
  assert.ok(total480 < 1000, `jami @480 = ${total480.toFixed(0)} KB (< 1000 KB; avval ~2800 KB)`);
});

test('har guruh (rasmi bor bo‘lsa) srcset bilan chiziladi; yangi shaxsiy guruhi muqovasi bor', () => {
  const dir = path.resolve('src/assets/catalog-groups');
  const files = fs.readdirSync(dir);
  assert.ok(files.includes('shaxsiy@480.webp') && files.includes('shaxsiy@1200.webp'));
  assert.ok(CATALOG_GROUPS.some((g) => g.id === 'shaxsiy'));
});

test('smoothScroll: easing chegaralari va monotonlik; davomiylik 450..1100 ms', () => {
  assert.equal(easeInOutCubic(0), 0); assert.equal(easeInOutCubic(1), 1); assert.equal(easeInOutCubic(0.5), 0.5);
  let prev = -1;
  for (let i = 0; i <= 100; i++) { const v = easeInOutCubic(i / 100); assert.ok(v >= prev, 'o‘smaydi'); prev = v; }
  assert.equal(scrollDuration(0), 450);
  assert.equal(scrollDuration(100), 450);
  assert.ok(scrollDuration(2000) > 450 && scrollDuration(2000) < 1100);
  assert.equal(scrollDuration(1e7), 1100);
  assert.ok(scrollDuration(5000) >= scrollDuration(1000), 'masofa ortsa davomiylik kamaymaydi');
});
