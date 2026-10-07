import { useState, useEffect, useCallback, useMemo } from 'react';
import { panelApi } from '@/api';
import { useLockScroll } from '@/hooks/useLockScroll';
import { MoneyInput } from '@/components/form/NumberInput';
import { ImageUpload } from '@/components/ImageUpload';
import { confirm } from '@/components/ui/confirm';
import { Img } from '@/components/Img';
import { StoreCatalogPicker } from './StoreCatalogPicker';

/*
 * ═══ DO'KON MAHSULOTLARI (Lokma Market) ═══
 *
 * Restoran menyusidan farqi:
 *   • kategoriya — do'kon kategoriyalari (Mevalar, Sut, Go'sht, Ichimliklar...)
 *     GET /api/market/categories (yagona manba — server)
 *   • narx BIRLIK uchun: "12 000 so'm / kg", "8 000 so'm / dona"
 *   • qadoq hajmi ("1 kg", "0.5 l"), brend, shtrix-kod
 *   • tayyorlanish vaqti, kaloriya, zal narxi, ichimlik turi — YO'Q
 * Saqlash, STOP, o'chirish — restoran menyusi bilan bir xil API.
 */

const som = (n) => (n ?? 0).toLocaleString('ru-RU').replace(/,/g, ' ');

export function StoreMenuPage() {
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState(null);       // { groups, categories, units }
  const [metaErr, setMetaErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);       // null | { product? }
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const [catalogOpen, setCatalogOpen] = useState(false);

  const load = useCallback(async () => {
    try { setProducts(await panelApi.getDishes()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    panelApi.getMarketCategories()
      .then(setMeta)
      .catch((e) => setMetaErr(e.message || 'Kategoriyalarni yuklab bo‘lmadi'));
  }, [load]);

  const catMap = useMemo(() => new Map((meta?.categories || []).map((c) => [c.value, c])), [meta]);
  const unitLabel = useCallback(
    (u) => (meta?.units || []).find((x) => x.value === u)?.label || u || 'dona',
    [meta],
  );

  // Qidiruv: nom, brend, shtrix-kod
  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return products.filter((p) => {
      if (cat !== 'all' && (p.marketCategory || '_') !== cat) return false;
      if (!term) return true;
      return [p.name, p.brand, p.barcode].filter(Boolean).join(' ').toLowerCase().includes(term);
    });
  }, [products, q, cat]);

  // Kategoriya bo'yicha guruhlash — serverdagi tartibda; kategoriyasizlar oxirida
  const grouped = useMemo(() => {
    const by = new Map();
    for (const p of visible) {
      const k = p.marketCategory && catMap.has(p.marketCategory) ? p.marketCategory : '_';
      if (!by.has(k)) by.set(k, []);
      by.get(k).push(p);
    }
    const order = (meta?.categories || []).map((c) => c.value);
    const keys = [...by.keys()].sort((a, b) => {
      const ai = a === '_' ? 1e9 : order.indexOf(a); const bi = b === '_' ? 1e9 : order.indexOf(b);
      return ai - bi;
    });
    return keys.map((k) => ({
      key: k,
      label: k === '_' ? 'Kategoriyasiz (tahrirlab kategoriya tanlang)' : `${catMap.get(k)?.emoji || ''} ${catMap.get(k)?.label || k}`,
      items: by.get(k).sort((a, b) => String(a.name).localeCompare(String(b.name))),
    }));
  }, [visible, catMap, meta]);

  // Filtr chiplari — faqat mahsuloti bor kategoriyalar
  const usedCats = useMemo(() => {
    const counts = new Map();
    for (const p of products) {
      const k = p.marketCategory && catMap.has(p.marketCategory) ? p.marketCategory : '_';
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    const order = (meta?.categories || []).map((c) => c.value);
    return [...counts.entries()].sort(([a], [b]) => (a === '_' ? 1e9 : order.indexOf(a)) - (b === '_' ? 1e9 : order.indexOf(b)));
  }, [products, catMap, meta]);

  const stopped = products.filter((p) => !p.isAvailable).length;

  const toggleStop = async (p) => {
    setBusyId(p._id);
    try {
      await panelApi.toggleStop(p._id, p.isAvailable);
      setProducts((list) => list.map((x) => (x._id === p._id ? { ...x, isAvailable: !p.isAvailable } : x)));
    } finally { setBusyId(null); }
  };
  const remove = async (p) => {
    if (!await confirm({ title: `"${p.name}" o'chirilsinmi?` })) return;
    await panelApi.deleteDish(p._id);
    setProducts((list) => list.filter((x) => x._id !== p._id));
  };

  return (
    <div className="flex-1 p-4 sm:p-6 min-w-0">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold text-ink flex items-center gap-2">
            <i className="ti ti-building-store text-brand-600" /> Mahsulotlar
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-0.5">
            {products.length} ta mahsulot{stopped ? ` · ${stopped} tasi tugagan (STOP)` : ''} · Lokma Market'da ko'rinadi
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Umumiy katalogdan — Market maydonlari avtomatik to'ldiriladi */}
          <button
            onClick={() => setCatalogOpen(true)}
            disabled={!meta}
            title="Umumiy katalogdagi tayyor mahsulotlar"
            className="border border-line text-muted font-medium px-3 py-2.5 rounded-xl hover:bg-canvas transition-colors flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
          >
            <i className="ti ti-package" />
            <span className="hidden sm:inline">Katalogdan</span>
          </button>
          <button
            onClick={() => setForm({})}
            disabled={!meta}
            className="bg-brand-400 text-brand-text font-medium px-4 py-2.5 rounded-xl hover:bg-brand-600 hover:text-white transition-colors flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
          >
            <i className="ti ti-plus" /> Mahsulot qo'shish
          </button>
        </div>
      </div>

      {metaErr && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {metaErr}. Sahifani yangilang — server yangilanmagan bo'lishi mumkin.
        </div>
      )}

      {products.length > 0 && (
        <div className="mb-4 grid gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2">
            <i className="ti ti-search text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nom, brend yoki shtrix-kod"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
            />
            {q && <button onClick={() => setQ('')} className="text-muted" aria-label="Tozalash"><i className="ti ti-x" /></button>}
          </label>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
            <Chip on={cat === 'all'} onClick={() => setCat('all')}>Hammasi <b className="opacity-60">{products.length}</b></Chip>
            {usedCats.map(([k, n]) => (
              <Chip key={k} on={cat === k} onClick={() => setCat(k)}>
                {k === '_' ? 'Kategoriyasiz' : `${catMap.get(k)?.emoji || ''} ${catMap.get(k)?.label || k}`} <b className="opacity-60">{n}</b>
              </Chip>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-muted text-sm py-10 text-center">Yuklanmoqda...</div>
      ) : products.length === 0 ? (
        <div className="text-center text-muted text-sm py-12 border border-dashed border-line rounded-xl px-4">
          <i className="ti ti-basket text-4xl opacity-40" />
          <p className="mt-2">Hali mahsulot yo'q. "Mahsulot qo'shish" tugmasini bosing.</p>
        </div>
      ) : grouped.length === 0 ? (
        <div className="text-center text-muted text-sm py-10">Hech narsa topilmadi</div>
      ) : (
        grouped.map(({ key, label, items }) => (
          <div key={key} className="mb-6">
            <h2 className="text-sm font-medium text-muted mb-2 flex items-center gap-2">
              {label}
              <span className="text-[11px] font-normal bg-canvas px-2 py-0.5 rounded-full">{items.length}</span>
            </h2>
            <div className="grid gap-2">
              {items.map((p) => (
                <div
                  key={p._id}
                  className={`bg-surface border rounded-xl p-3 flex items-center gap-3 min-w-0 ${
                    p.isAvailable ? 'border-line' : 'border-red-200 bg-red-50/40'}`}
                >
                  <div className="w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center flex-none bg-canvas">
                    {p.imageUrl
                      ? <Img src={p.imageUrl} w={200} className="w-full h-full object-cover" />
                      : <span className="text-2xl">{catMap.get(p.marketCategory)?.emoji || '🛒'}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-ink truncate">{p.name}</span>
                      {!p.isAvailable && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold flex-none">TUGAGAN</span>
                      )}
                    </div>
                    <div className="text-xs text-muted truncate mt-0.5">
                      {[p.brand, p.packSize, p.barcode && `#${p.barcode}`].filter(Boolean).join(' · ') || '—'}
                    </div>
                    <div className="mt-0.5 text-sm font-semibold text-ink">
                      {som(p.price)} so'm <span className="text-xs font-normal text-muted">/ {unitLabel(p.unit)}</span>
                      {p.oldPrice > p.price && <span className="ml-1.5 text-[11px] font-normal text-muted line-through">{som(p.oldPrice)}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 flex-none">
                    <button
                      onClick={() => toggleStop(p)}
                      disabled={busyId === p._id}
                      className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                        p.isAvailable
                          ? 'border border-line text-muted hover:bg-red-50 hover:text-red-600'
                          : 'bg-green-500 text-white hover:bg-green-600'}`}
                      title={p.isAvailable ? 'Tugadi — mijozga ko‘rinmasin' : 'Qayta sotuvga chiqarish'}
                    >
                      {p.isAvailable ? 'Tugadi' : 'Sotuvda'}
                    </button>
                    <div className="flex gap-1.5">
                      <button onClick={() => setForm({ product: p })} disabled={!meta}
                        className="w-8 h-8 rounded-lg border border-line hover:bg-canvas flex items-center justify-center text-muted disabled:opacity-50" title="Tahrirlash">
                        <i className="ti ti-pencil" />
                      </button>
                      <button onClick={() => remove(p)}
                        className="w-8 h-8 rounded-lg border border-line hover:bg-red-50 flex items-center justify-center text-red-500" title="O'chirish">
                        <i className="ti ti-trash" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {catalogOpen && meta && (
        <StoreCatalogPicker
          meta={meta}
          onClose={() => setCatalogOpen(false)}
          onAdded={() => { setCatalogOpen(false); load(); }}
        />
      )}

      {form && meta && (
        <ProductForm
          product={form.product}
          meta={meta}
          onClose={() => setForm(null)}
          onSaved={() => { setForm(null); load(); }}
        />
      )}
    </div>
  );
}

function Chip({ on, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-none whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        on ? 'border-brand-400 bg-brand-100 text-brand-text' : 'border-line bg-white text-muted hover:text-ink'}`}
    >
      {children}
    </button>
  );
}

function ProductForm({ product, meta, onClose, onSaved }) {
  useLockScroll();
  const isEdit = Boolean(product?._id);
  const [f, setF] = useState({
    imageUrl: product?.imageUrl || '',
    name: product?.name || '',
    description: product?.description || '',
    marketCategory: product?.marketCategory || '',
    price: product?.price ?? null,
    oldPrice: product?.oldPrice ?? null,
    unit: product?.unit || 'dona',
    packSize: product?.packSize || '',
    brand: product?.brand || '',
    barcode: product?.barcode || '',
  });
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const catByGroup = useMemo(() => meta.groups.map((g) => ({
    ...g, items: meta.categories.filter((c) => c.group === g.value),
  })).filter((g) => g.items.length), [meta]);
  const chosen = meta.categories.find((c) => c.value === f.marketCategory);

  const submit = async () => {
    if (!f.name.trim()) { setErr('Mahsulot nomini kiriting'); return; }
    if (!f.marketCategory) { setErr('Kategoriyani tanlang'); return; }
    if (!f.price || Number(f.price) <= 0) { setErr('Narxni kiriting'); return; }
    if (f.oldPrice && Number(f.oldPrice) <= Number(f.price)) {
      setErr('Eski narx hozirgi narxdan katta bo‘lishi kerak (chegirma uchun)'); return;
    }
    if (f.barcode && !/^[0-9A-Za-z-]{4,32}$/.test(f.barcode.trim())) { setErr('Shtrix-kod noto‘g‘ri'); return; }
    setErr(null); setSaving(true);
    try {
      const payload = {
        // Do'kon sahifasida mahsulotlar shu sarlavha ostida guruhlanadi
        section: chosen?.label || 'Mahsulotlar',
        category: 'boshqa',
        marketCategory: f.marketCategory,
        icon: chosen?.icon || 'ti-shopping-cart',
        name: f.name.trim(),
        description: f.description.trim(),
        price: Number(f.price),
        unit: f.unit,
        packSize: f.packSize.trim(),
        brand: f.brand.trim(),
        barcode: f.barcode.trim(),
        prepMinutes: 5, // tayyor mahsulot — yig'ish vaqti
        ...(f.imageUrl ? { imageUrl: f.imageUrl, images: [f.imageUrl] } : {}),
      };
      // Chegirma: yangida faqat bo'lsa; tahrirda olib tashlansa — null (tozalanadi)
      if (f.oldPrice > 0) payload.oldPrice = Number(f.oldPrice);
      else if (isEdit && product.oldPrice) payload.oldPrice = null;

      if (isEdit) await panelApi.updateDish(product._id, payload);
      else await panelApi.createDish(payload);
      onSaved();
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 overflow-y-auto max-h-[90dvh] pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink">{isEdit ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot'}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink" aria-label="Yopish"><i className="ti ti-x text-xl" /></button>
        </div>

        <div className="mb-4">
          <ImageUpload value={f.imageUrl} onChange={(url) => set('imageUrl', url)} folder="dishes" label="Mahsulot rasmi" aspect="1/1" />
        </div>

        <Field label="Nomi *">
          <input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Sut 3.2%" className="inp" />
        </Field>

        <Field label="Kategoriya *" hint="Mijoz Lokma Market'da shu kategoriya orqali topadi">
          <select value={f.marketCategory} onChange={(e) => set('marketCategory', e.target.value)} className="inp">
            <option value="">— tanlang —</option>
            {catByGroup.map((g) => (
              <optgroup key={g.value} label={g.label}>
                {g.items.map((c) => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Narx (so'm) *">
            <MoneyInput value={f.price} onChange={(v) => set('price', v)} placeholder="12 000" />
          </Field>
          <Field label="Narx nima uchun">
            <select value={f.unit} onChange={(e) => set('unit', e.target.value)} className="inp">
              {meta.units.map((u) => <option key={u.value} value={u.value}>1 {u.label}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Eski narx (chegirma bo'lsa)" hint="Bo'sh qoldiring — chegirma yo'q">
          <MoneyInput value={f.oldPrice} onChange={(v) => set('oldPrice', v)} placeholder="15 000" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Qadoq hajmi">
            <input value={f.packSize} onChange={(e) => set('packSize', e.target.value)} placeholder="1 l, 900 g" maxLength={40} className="inp" />
          </Field>
          <Field label="Brend">
            <input value={f.brand} onChange={(e) => set('brand', e.target.value)} placeholder="Musaffo" maxLength={80} className="inp" />
          </Field>
        </div>

        <Field label="Shtrix-kod" hint="Ixtiyoriy — qidiruvda va kassa bilan moslashda yordam beradi">
          <input value={f.barcode} onChange={(e) => set('barcode', e.target.value)} inputMode="numeric" placeholder="4780000000000" maxLength={32} className="inp" />
        </Field>

        <Field label="Tavsif">
          <textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={2}
            placeholder="Tarkibi, yaroqlilik muddati, ishlab chiqaruvchi" className="inp resize-none" />
        </Field>

        {f.price > 0 && (
          <div className="mb-3 rounded-xl bg-canvas px-3 py-2 text-xs text-muted">
            Mijoz ko'radi: <b className="text-ink">{som(f.price)} so'm / {meta.units.find((u) => u.value === f.unit)?.label}</b>
            {f.packSize && ` · ${f.packSize}`}
          </div>
        )}

        {err && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{err}</div>}

        <div className="flex gap-2 mt-2">
          <button onClick={onClose} className="px-4 py-2.5 border border-line text-muted rounded-xl hover:bg-canvas">Bekor</button>
          <button onClick={submit} disabled={saving}
            className="flex-1 bg-brand-400 text-brand-text font-medium py-2.5 rounded-xl hover:bg-brand-600 hover:text-white transition-colors disabled:opacity-50">
            {saving ? 'Saqlanmoqda...' : isEdit ? 'Saqlash' : "Qo'shish"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-ink mb-1">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted mt-1">{hint}</p>}
    </div>
  );
}
