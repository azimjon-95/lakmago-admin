import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/api';
import { NumberInput, MoneyInput } from '@/components/form/NumberInput';
import { ImageUpload } from '@/components/ImageUpload';
import { useLockScroll } from '@/hooks/useLockScroll';
import { confirm } from '@/components/ui/confirm';
import { Img } from '@/components/Img';

const CATEGORIES = [
  { value: 'salqin', label: 'Ichimliklar' },
  { value: 'koffe', label: 'Qahva' },
  { value: 'choyxona', label: 'Choy' },
  { value: 'shirinlik', label: 'Shirinlik' },
  { value: 'fastfood', label: 'Fast food' },
  { value: 'milliy', label: 'Milliy taom' },
  { value: 'osh', label: 'Osh' },
  { value: 'shashlik', label: 'Shashlik' },
  { value: 'sup', label: "Sho'rva" },
  { value: 'salat', label: 'Salatlar' },
  { value: 'lavash', label: 'Lavash' },
  { value: 'burger', label: 'Burger' },
  { value: 'tovuq', label: 'Tovuq' },
  { value: 'pitsa', label: 'Pitsa' },
  { value: 'sushi', label: 'Sushi' },
  { value: 'evropa', label: 'Yevropa' },
  { value: 'turetskaya', label: 'Turk taomlari' },
  { value: 'zavtroki', label: 'Nonushta' },
  { value: 'obed', label: 'Tushlik' },
  { value: 'magazin_oziq', label: "Do'kon mahsuloti" },
];

const som = (n) => (n ?? 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const catLabel = (v) => CATEGORIES.find((c) => c.value === v)?.label || v;

export function CatalogPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter) params.set('category', filter);
    if (q.trim()) params.set('q', q.trim());
    const qs = params.toString();

    adminApi.getCatalog(qs ? `?${qs}` : '')
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const remove = async (p) => {
    if (!await confirm({ title: `"${p.name}" o'chirilsinmi?` })) return;
    try {
      const r = await adminApi.deleteCatalogProduct(p._id);
      if (r.deactivated) alert(r.message);
      load();
    } catch (e) { alert(e.message); }
  };

  // Brend bo'yicha guruhlaymiz
  const grouped = items.reduce((acc, p) => {
    const key = p.brand || catLabel(p.category);
    (acc[key] = acc[key] || []).push(p);
    return acc;
  }, {});

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h1 className="text-xl font-semibold text-ink">Umumiy katalog</h1>
          <p className="text-sm text-muted mt-0.5">
            Restoranlar shu ro'yxatdan tanlab o'z narxini qo'yadi
          </p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="bg-brand-400 text-brand-text font-medium px-4 py-2 rounded-xl hover:bg-brand-600 hover:text-white flex-none"
        >
          <i className="ti ti-plus" /> Qo'shish
        </button>
      </div>

      {/* Filtr */}
      <div className="flex gap-2 mt-4 mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nom yoki brend..."
          className="inp flex-1"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="inp w-44 flex-none"
        >
          <option value="">Barcha kategoriya</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-muted text-sm">Yuklanmoqda...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-14 px-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center
                          rounded-full bg-brand-50">
            <i className="ti ti-package text-3xl text-brand-600" />
          </div>
          <div className="text-ink font-semibold">Katalog bo'sh</div>
          {/*
            Ilgari bu yerda "npm run seed:catalog" yozilardi.
            Bu sahifani biznes administratori ochadi — terminal
            buyrug'i unga hech narsa aytmaydi va ish to'xtaydi.
            Endi tugma ko'rsatiladi.
          */}
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
            Bu yerga bir marta kiritilgan mahsulot barcha restoranlarda
            bir xil nom va rasm bilan ko'rinadi. Restoran faqat
            o'z narxini qo'yadi.
          </p>
          <button
            onClick={() => setEditing('new')}
            className="mt-5 rounded-xl bg-brand-400 px-5 py-2.5 text-sm font-medium
                       text-brand-text transition hover:bg-brand-600 hover:text-white"
          >
            <i className="ti ti-plus mr-1.5" />
            Birinchi mahsulotni qo'shish
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([group, list]) => (
            <div key={group}>
              <h2 className="text-sm font-semibold text-ink mb-2">{group}</h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((p) => (
                  <div
                    key={p._id}
                    className={`bg-surface border rounded-xl p-3 flex items-center gap-3 ${
                      p.isActive ? 'border-line' : 'border-line opacity-50'
                    }`}
                  >
                    {p.imageUrl ? (
                      <Img
                        src={p.imageUrl} w={96}
                        className="w-12 h-12 rounded-lg object-cover flex-none bg-canvas"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-canvas flex items-center justify-center flex-none">
                        <i className="ti ti-photo text-muted" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ink truncate">
                        {p.name}
                        {p.volume && (
                          <span className="text-muted font-normal"> · {p.volume}</span>
                        )}
                      </div>
                      <div className="text-xs text-muted">
                        {som(p.suggestedPrice)} so'm
                        {p.usageCount > 0 && ` · ${p.usageCount} restoranda`}
                      </div>
                    </div>

                    <div className="flex gap-1 flex-none">
                      <button
                        onClick={() => setEditing(p)}
                        className="w-8 h-8 rounded-lg hover:bg-canvas text-muted"
                      >
                        <i className="ti ti-pencil text-sm" />
                      </button>
                      <button
                        onClick={() => remove(p)}
                        className="w-8 h-8 rounded-lg hover:bg-red-50 text-red-600"
                      >
                        <i className="ti ti-trash text-sm" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ProductForm
          product={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function ProductForm({ product, onClose, onSaved }) {
  useLockScroll();

  const [form, setForm] = useState({
    name: product?.name || '',
    brand: product?.brand || '',
    volume: product?.volume || '',
    category: product?.category || 'salqin',
    description: product?.description || '',
    imageUrl: product?.imageUrl || '',
    suggestedPrice: product?.suggestedPrice ?? null,
    calories: product?.calories ?? null,
    isActive: product?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (form.name.trim().length < 2) { setErr('Nom kiriting'); return; }
    setSaving(true); setErr(null);
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        suggestedPrice: Number(form.suggestedPrice) || 0,
        ...(form.calories ? { calories: Number(form.calories) } : {}),
      };
      if (product) await adminApi.updateCatalogProduct(product._id, payload);
      else await adminApi.createCatalogProduct(payload);
      onSaved();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        /*
          FLEX USTUN: sarlavha va tugmalar qotib turadi, faqat
          o'rtadagi forma suriladi.

          Ilgari butun quti `overflow-y-auto` edi va tugmalar
          `sticky bottom-0` bilan ushlab turilardi. Sticky element
          O'Z KONTEYNERI ichida yopishadi — konteyner esa suriladi,
          shuning uchun tugmalar formaning o'rtasida osilib
          qolardi va ostidagi maydonlarni to'sardi.
        */
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl
                   flex flex-col max-h-[92dvh] sm:max-h-[85dvh] overflow-hidden"
      >
        <div className="flex-none flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="text-lg font-semibold text-ink">
            {product ? 'Tahrirlash' : 'Yangi mahsulot'}
          </h3>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <i className="ti ti-x text-xl" />
          </button>
        </div>

        {/* Faqat SHU qism suriladi */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-3">

        <ImageUpload
          label="Rasm"
          value={form.imageUrl}
          onChange={(url) => set('imageUrl', url)}
        />

        <Field label="Nom *">
          <input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Coca-Cola"
            className="inp"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Brend" hint="Guruhlash uchun">
            <input
              value={form.brand}
              onChange={(e) => set('brand', e.target.value)}
              placeholder="Coca-Cola"
              className="inp"
            />
          </Field>
          <Field label="Hajm">
            <input
              value={form.volume}
              onChange={(e) => set('volume', e.target.value)}
              placeholder="0.5 l"
              className="inp"
            />
          </Field>
        </div>

        <Field label="Kategoriya *">
          <select
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
            className="inp"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Tavsif">
          <textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            rows={2}
            className="inp resize-none"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tavsiya narx" hint="Restoran o'zgartiradi">
            <MoneyInput
              value={form.suggestedPrice}
              onChange={(v) => set('suggestedPrice', v)}
            />
          </Field>
          <Field label="Kaloriya">
            <NumberInput
              value={form.calories}
              onChange={(v) => set('calories', v)}
              suffix="ккал"
            />
          </Field>
        </div>

        <label className="flex items-center justify-between gap-3 py-2 cursor-pointer">
          <span className="text-sm text-ink">Faol</span>
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => set('isActive', e.target.checked)}
            className="w-5 h-5 accent-brand-400"
          />
        </label>

        {err && (
          <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">
            {err}
          </div>
        )}

        </div>

        <div className="flex-none flex gap-2 px-5 pt-3 border-t border-line bg-white
                        pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
          <button onClick={onClose} className="flex-1 border border-line text-muted py-2.5 rounded-xl">
            Bekor
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-[1.5] bg-brand-400 text-brand-text font-medium py-2.5 rounded-xl disabled:opacity-50"
          >
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="mb-3">
      <label className="block text-sm font-medium text-ink mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted mt-1">{hint}</p>}
    </div>
  );
}
