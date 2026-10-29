import { useState } from 'react';
import { adminApi } from '@/api';
import { ImageUpload } from '@/components/ImageUpload';
import { useLockScroll } from '@/hooks/useLockScroll';
import { CATALOG_CATEGORIES as CATEGORIES, DRINKS_CATEGORY } from '@/constants/catalogCategories';

/*
 * Katalog mahsuloti formasi (yaratish/tahrirlash). Avval CatalogPage.jsx ichida edi — xatti-harakati o'zgarmagan;
 * faqat `defaults.category` qo'shildi (ochiq kategoriyada "Qo'shish" bosilsa shu kategoriya tanlangan bo'ladi).
 */
export function CatalogProductForm({ product, defaults = null, onClose, onSaved }) {
  useLockScroll();

  const [form, setForm] = useState({
    name: product?.name || '',
    volume: product?.volume || '',
    // Yangi mahsulot: ochiq guruh/chip kategoriyasi oldindan tanlanadi (qo'lda qidirish shart emas)
    category: product?.category || defaults?.category || DRINKS_CATEGORY,
    description: product?.description || '',
    imageUrl: product?.imageUrl || '',
    isActive: product?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (form.name.trim().length < 2) { setErr('Nom kiriting'); return; }
    setSaving(true); setErr(null);
    try {
      const payload = { ...form, name: form.name.trim() };
      const saved = product
        ? await adminApi.updateCatalogProduct(product._id, payload)
        : await adminApi.createCatalogProduct(payload);
      onSaved(saved);   // ro'yxat qayta yuklanmaydi — saqlangan mahsulot joyida yangilanadi
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

        <Field label="Hajm" hint="Ixtiyoriy — 0.5 l, 1 kg va h.k.">
          <input
            value={form.volume}
            onChange={(e) => set('volume', e.target.value)}
            placeholder="0.5 l"
            className="inp"
          />
        </Field>

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
