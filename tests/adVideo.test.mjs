/* Reklama videosi o'lchami: serverga yuboriladigan maydonlar va nisbat yorlig'i (src/lib/adVideo.js). npm run test:advideo */
import test from 'node:test';
import assert from 'node:assert/strict';
import { videoMetaFields, aspectLabel, readVideoMeta } from '../src/lib/adVideo.js';

test('o\'lcham: butun sonlar, eni va bo\'yi faqat birga, davomiylik ≥1 s', () => {
  assert.deepEqual(videoMetaFields({ width: 1080, height: 1920, duration: 14.6 }), { width: 1080, height: 1920, duration: 15 });
  assert.deepEqual(videoMetaFields({ width: 720.4, height: 1280.6, duration: 0.3 }), { width: 720, height: 1281, duration: 1 });
  assert.deepEqual(videoMetaFields({ width: 1080, height: 0, duration: 10 }), { duration: 10 }, 'bo\'yi noma\'lum — o\'lcham yuborilmaydi');
  assert.deepEqual(videoMetaFields({ width: NaN, height: 1920, duration: Infinity }), {}, 'Infinity (oqim videolari) — yuborilmaydi');
  assert.deepEqual(videoMetaFields({ width: 20000, height: 1920 }), {});
  assert.deepEqual(videoMetaFields(null), {});
});

test('nisbat yorlig\'i: reels, kvadrat, gorizontal', () => {
  assert.equal(aspectLabel({ width: 1080, height: 1920 }), '9:16 · vertikal');
  assert.equal(aspectLabel({ width: 1080, height: 1350 }), '4:5 · vertikal');
  assert.equal(aspectLabel({ width: 1080, height: 1080 }), '1:1 · kvadrat');
  assert.equal(aspectLabel({ width: 1920, height: 1080 }), '16:9 · gorizontal');
  assert.equal(aspectLabel(null), '');
});

test('brauzersiz muhitda readVideoMeta xavfsiz (null)', async () => {
  assert.equal(await readVideoMeta(null), null);
  assert.equal(await readVideoMeta({ name: 'x.mp4' }), null, 'document yo\'q');
});
