/*
 * ADMIN: Market kategoriyalari — markaziy ro'yxat ulanishi (statik tekshiruv): sahifa, marshrut, menyu, API va
 * do'kon formasi endi marketCategory emas, katalog kalitini (catalogCategory) yuboradi. npm run test:market-categories
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(p, 'utf8');

test('sahifa: ro‘yxat, qo‘shish, tahrir, faollik, o‘chirish (ishlatilganini o‘chirmaydi)', () => {
  const p = read('src/pages/admin/MarketCategoriesPage.jsx');
  for (const m of ['getMarketCategoryList', 'createMarketCategory', 'updateMarketCategory', 'deleteMarketCategory']) assert.ok(p.includes(m), m);
  assert.ok(p.includes("usage > 0") && p.includes('o‘chirib bo‘lmaydi'), 'ishlatilgan kategoriya o‘chmaydi');
  assert.ok(/KEY_RE = \/\^\[a-z0-9_\]\{2,60\}\$\//.test(p), 'kalit formati');
});

test('marshrut va menyu: /market-categories (faqat admin)', () => {
  const app = read('src/App.jsx');
  assert.ok(app.includes('path="/market-categories" element={<AdminOnly><MarketCategoriesPage /></AdminOnly>}'));
  assert.ok(read('src/components/Sidebar.jsx').includes('to: "/market-categories"'));
});

test('API: /admin/market-categories CRUD', () => {
  const api = read('src/api/index.js');
  assert.ok(api.includes("'/admin/market-categories'") && api.includes('PATCH') && api.includes('DELETE'));
});

test('do‘kon formasi (StoreMenuPage): markaziy ro‘yxat va catalogCategory; marketCategory yo‘q', () => {
  const p = read('src/pages/restaurant/StoreMenuPage.jsx');
  assert.ok(p.includes('meta?.catalogCategories') && p.includes('catalogCategory: f.catalogCategory'));
  assert.ok(!/marketCategory/.test(p.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')), 'eski marketCategory qoldi');
});

test('katalog tanlagich (StoreCatalogPicker): markaziy ro‘yxat; katalog kalitidan avtomatik tanlanadi', () => {
  const p = read('src/pages/restaurant/StoreCatalogPicker.jsx');
  assert.ok(p.includes('meta.catalogCategories') && p.includes('catalogCategory: suggested'));
  assert.ok(p.includes('catalogCategory: f.catalogCategory'));
});
