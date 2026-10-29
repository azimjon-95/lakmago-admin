/* "Mijoz rad etdi": eski va yangi server shakllari, ikki rejim yozuvlari. npm run test:incident-mode */
import test from 'node:test';
import assert from 'node:assert/strict';
import { isPost, statusInfo, decisionTexts, decisionButtons, pendingBanner, parseRefusalReasons } from '../src/lib/incidentMode.js';

test('eski server (massiv) va yangi server (obyekt) javoblari ikkalasi ham o‘qiladi', () => {
  const list = [{ value: 'not_needed', label: 'x' }];
  assert.deepEqual(parseRefusalReasons(list), { reasons: list, approvalRequired: true }, 'eski: massiv, tasdiq kutadi');
  assert.deepEqual(parseRefusalReasons({ reasons: list, approvalRequired: false }), { reasons: list, approvalRequired: false });
  assert.equal(parseRefusalReasons({ reasons: list }).approvalRequired, true, 'maydon yo‘q → xavfsiz taxmin: tasdiq kutadi');
  assert.deepEqual(parseRefusalReasons(null), { reasons: [], approvalRequired: true }, 'buzuq javob yiqitmaydi');
  assert.deepEqual(parseRefusalReasons({ reasons: 'x' }).reasons, []);
});

test('rejim: faqat mode === "post" standart rejim; eski server (mode yo‘q) — eski ma’no', () => {
  assert.equal(isPost({ mode: 'post' }), true);
  assert.equal(isPost({ mode: 'approval' }), false);
  assert.equal(isPost({}), false); assert.equal(isPost(null), false);
});

test('holat yorliqlari: post rejimda "Mijoz aybdor"/"Asossiz", eski rejimda "Bekor qilindi"/"Rad etildi"', () => {
  assert.equal(statusInfo({ mode: 'post', status: 'approved' }).label, 'Mijoz aybdor');
  assert.equal(statusInfo({ mode: 'post', status: 'rejected' }).label, 'Asossiz');
  assert.equal(statusInfo({ mode: 'post', status: 'pending' }).label, 'Ko‘rib chiqilmagan');
  assert.equal(statusInfo({ status: 'approved' }).label, 'Bekor qilindi');
  assert.equal(statusInfo({ status: 'rejected' }).label, 'Rad etildi');
  assert.ok(statusInfo({ status: 'noma’lum' }).label, 'noma’lum holat yiqitmaydi');
});

test('post rejimda "buyurtma davom etadi" degan YOLG‘ON matn yo‘q (buyurtma allaqachon bekor)', () => {
  const post = { mode: 'post' };
  for (const approve of [true, false]) {
    const t = decisionTexts(post, { approve });
    assert.ok(!/davom et|bekor qilinsinmi\?/.test(t.title + t.content), `${approve}: ${t.title} / ${t.content}`);
  }
  assert.ok(/allaqachon bekor/.test(decisionTexts(post, { approve: true }).content));
  assert.ok(!/davom etadi/.test(decisionButtons(post).no + decisionButtons(post).yes));
  assert.ok(/qayta tiklanmaydi/.test(pendingBanner(post)));
});

test('eski rejim matnlari O‘ZGARMAGAN', () => {
  const t = decisionTexts({}, { approve: false });
  assert.equal(t.title, 'So‘rov rad etilsinmi?'); assert.equal(t.content, 'Buyurtma bekor qilinmaydi, restoran davom ettiradi');
  assert.equal(decisionTexts({}, { approve: true, disableCash: true, block: true }).content, 'mijozning naqd to‘lovi o‘chiriladi, mijoz bloklanadi');
  assert.equal(decisionButtons({}).yes, '✅ Bekor qilishni tasdiqlash');
  assert.equal(pendingBanner({}), null);
});
