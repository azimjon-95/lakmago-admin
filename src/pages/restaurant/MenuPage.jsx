import { useState, useEffect, useCallback, useMemo } from 'react';
import { panelApi } from '@/api';
import { useLockScroll } from '@/hooks/useLockScroll';
import { NumberInput, MoneyInput } from '@/components/form/NumberInput';
import { ImageUpload } from '@/components/ImageUpload';
import { confirm } from '@/components/ui/confirm';

// Taom kategoriyalari — barcha muassasalar uchun umumiy.
// Restoran, kafe, bar, choyxona — hammasi shu ro'yxatdan tanlaydi.
const DISH_CATEGORIES = [
  // Mijoz ilovasidagi kategoriyalar bilan AYNAN bir xil.
  // Mijoz kategoriya tanlasa — shu taomlar va restoranlar chiqadi.
  { value: 'milliy', label: 'Milliy taom' },
  { value: 'osh', label: 'Osh' },
  { value: 'shashlik', label: 'Shashlik' },
  { value: 'sup', label: "Sho'rva" },
  { value: 'salat', label: 'Salatlar' },
  { value: 'choyxona', label: 'Choyxona' },
  { value: 'zavtroki', label: 'Nonushta' },
  { value: 'obed', label: 'Tushlik' },
  { value: 'fastfood', label: 'Fast food' },
  { value: 'lavash', label: 'Lavash' },
  { value: 'burger', label: 'Burger' },
  { value: 'tovuq', label: 'Tovuq' },
  { value: 'pitsa', label: 'Pitsa' },
  { value: 'sushi', label: 'Sushi' },
  { value: 'evropa', label: 'Yevropa' },
  { value: 'turetskaya', label: 'Turk taomlari' },
  { value: 'koffe', label: 'Qahva' },
  { value: 'shirinlik', label: 'Shirinlik' },
  { value: 'salqin', label: 'Ichimlik' },
  { value: 'magazin_oziq', label: "Do'kon mahsuloti" },
];

const som = (n) => (n ?? 0).toLocaleString('ru-RU').replace(/,/g, ' ');

export function RestaurantMenuPage() {
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDish, setEditingDish] = useState(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [editDish, setEditDish] = useState(null);

  const load = useCallback(async () => {
    try { setDishes(await panelApi.getDishes()); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleStop = async (d) => {
    // STOP = isAvailable false. Tugma bosilganda teskarisiga o'tadi.
    await panelApi.toggleStop(d._id, d.isAvailable); // isAvailable=true bo'lsa stop=true yuboriladi
    load();
  };
  const remove = async (d) => {
    if (!await confirm({ title: `"${d.name}" o'chirilsinmi?` })) return;
    await panelApi.deleteDish(d._id);
    load();
  };

  /*
   * Kategoriya bo'yicha guruhlash — DISH_CATEGORIES tartibida.
   *
   * ILGARI ikki muammo bor edi:
   *
   * 1) 20 ta kategoriyaning HAR BIRI uchun butun taomlar
   *    ro'yxati filtrlanardi (20 x N taqqoslash), keyin
   *    "boshqalar" uchun yana bir marta. 200 taomli menyuda
   *    bu ~8000 taqqoslash.
   *
   * 2) useMemo YO'Q edi — demak bu hisob HAR RENDERDA qaytadan
   *    bajarilardi: qidiruvga harf yozilsa ham, modal ochilsa
   *    ham, istalgan state o'zgarsa ham.
   *
   * Endi bitta o'tishda (N ta amal) guruhlanadi va natija
   * `dishes` o'zgarmaguncha eslab turiladi.
   */
  const grouped = useMemo(() => {
    const known = new Set(DISH_CATEGORIES.map((c) => c.value));
    const buckets = new Map();
    const orphans = [];

    for (const d of dishes) {
      const cat = d.category || 'issiq';
      if (!known.has(cat)) { orphans.push(d); continue; }
      let list = buckets.get(cat);
      if (!list) { list = []; buckets.set(cat, list); }
      list.push(d);
    }

    // DISH_CATEGORIES tartibi saqlanadi — mijoz ilovasidagi
    // tartib bilan bir xil bo'lishi kerak
    const out = DISH_CATEGORIES
      .filter((cat) => buckets.has(cat.value))
      .map((cat) => ({ ...cat, items: buckets.get(cat.value) }));

    // Kategoriyasi noma'lum taomlar (eski ma'lumot)
    if (orphans.length) out.push({ value: '_', label: 'Boshqalar', items: orphans });

    return out;
  }, [dishes]);

  return (
    <div className="flex-1 p-4 sm:p-6 min-w-0">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold text-ink">Menyu</h1>
          <p className="text-xs sm:text-sm text-muted mt-0.5">Taomlarni boshqaring — tugaganini STOP qiling</p>
        </div>
        <div className="flex gap-2 flex-none">
          <button
            onClick={() => setCatalogOpen(true)}
            className="border border-line text-muted font-medium px-3 py-2.5 rounded-xl hover:bg-canvas transition-colors flex items-center gap-2 whitespace-nowrap"
            title="Ichimlik va tayyor mahsulotlar"
          >
            <i className="ti ti-package" />
            <span className="hidden sm:inline">Katalogdan</span>
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="bg-brand-400 text-brand-text font-medium px-4 py-2.5 rounded-xl hover:bg-brand-600 hover:text-white transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <i className="ti ti-plus" /> Taom qo'shish
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-muted text-sm py-10 text-center">Yuklanmoqda...</div>
      ) : dishes.length === 0 ? (
        <div className="text-center text-muted text-sm py-12 border border-dashed border-line rounded-xl">
          Menyu bo'sh. "Taom qo'shish" tugmasini bosing.
        </div>
      ) : (
        grouped.map(({ value, label, items }) => (
          <div key={value} className="mb-6">
            <h2 className="text-sm font-medium text-muted mb-2 uppercase tracking-wide flex items-center gap-2">
              {label}
              <span className="text-[11px] normal-case font-normal text-muted bg-canvas px-2 py-0.5 rounded-full">
                {items.length}
              </span>
            </h2>
            <div className="grid gap-2">
              {items.map((d) => (
                <div
                  key={d._id}
                  className={`bg-surface border rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 min-w-0 ${
                    d.isAvailable ? 'border-line' : 'border-red-200 bg-red-50/40'
                  }`}
                >
                  {/* Yuqori qator: rasm + nom + narx */}
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                  {/* Rasm — bor bo'lsa foto, yo'q bo'lsa ikonka. Bosilsa tahrirlash. */}
                  <button
                    onClick={() => setEditDish(d)}
                    title="Rasmni o'zgartirish"
                    className="w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center flex-none relative group"
                    style={{ background: d.tint || '#FAEEDA' }}
                  >
                    {d.imageUrl ? (
                      <img src={d.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <i className={`ti ${d.icon || 'ti-bowl'} text-lg text-brand-600`} />
                    )}
                    <span className="absolute inset-0 bg-black/0 group-hover:bg-black/45 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                      <i className="ti ti-camera text-white text-lg" />
                    </span>
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-ink truncate">{d.name}</span>
                      {!d.isAvailable && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium flex-none">STOP</span>
                      )}
                    </div>
                    {d.description && (
                      <div className="text-xs text-muted truncate mt-0.5">{d.description}</div>
                    )}
                    {d.prepMinutes > 0 && (
                      <div className="text-[11px] text-muted mt-0.5">
                        <i className="ti ti-clock text-[10px]" /> {d.prepMinutes} daq
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-none pl-2">
                    <div className="text-sm sm:text-base font-semibold text-ink whitespace-nowrap">{som(d.price)} so'm</div>
                    {d.oldPrice > 0 && <div className="text-[11px] text-muted line-through whitespace-nowrap">{som(d.oldPrice)}</div>}
                  </div>
                  </div>
                  <div className="flex items-center gap-2 flex-none">
                    <button
                      onClick={() => toggleStop(d)}
                      className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                        d.isAvailable
                          ? 'border border-line text-muted hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                          : 'bg-green-500 text-white hover:bg-green-600'
                      }`}
                    >
                      {d.isAvailable ? 'STOP' : 'Faollashtirish'}
                    </button>
                    <button
                      onClick={() => { setEditingDish(d); setShowForm(true); }}
                      className="w-9 h-9 rounded-lg border border-line hover:bg-canvas flex items-center justify-center text-muted"
                      title="Tahrirlash"
                    >
                      <i className="ti ti-pencil" />
                    </button>
                    <button
                      onClick={() => remove(d)}
                      className="w-9 h-9 rounded-lg border border-line hover:bg-red-50 hover:border-red-200 flex items-center justify-center text-red-500"
                      title="O'chirish"
                    >
                      <i className="ti ti-trash" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {showForm && (
        <DishForm
          dish={editingDish}
          onClose={() => { setShowForm(false); setEditingDish(null); }}
          onSaved={() => { setShowForm(false); setEditingDish(null); load(); }}
        />
      )}

      {catalogOpen && (
        <CatalogPicker
          onClose={() => setCatalogOpen(false)}
          onAdded={() => { setCatalogOpen(false); load(); }}
        />
      )}
      {editDish && (
        <DishImageEditor
          dish={editDish}
          onClose={() => setEditDish(null)}
          onSaved={() => { setEditDish(null); load(); }}
        />
      )}
    </div>
  );
}

function DishForm({ dish, onClose, onSaved }) {
  useLockScroll();
  const isEdit = Boolean(dish);
  const [form, setForm] = useState({
    imageUrl: dish?.imageUrl || '',
    name: dish?.name || '',
    description: dish?.description || '',
    category: dish?.category || 'milliy',
    price: dish?.price ?? null,
    oldPrice: dish?.oldPrice ?? null,
    prepMinutes: dish?.prepMinutes ?? 15,
    weight: dish?.weight || '',
    volume: dish?.volume || '',
    calories: dish?.calories ?? null,
    protein: dish?.protein ?? null,
    fat: dish?.fat ?? null,
    carbs: dish?.carbs ?? null,
    icon: dish?.icon || 'ti-bowl',
    priceMode: dish?.priceMode || 'sync',
    dineInPrice: dish?.dineInPrice ?? null,
  });
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) { setErr('Taom nomini kiriting'); return; }
    if (!form.price || Number(form.price) <= 0) { setErr('Narxni kiriting'); return; }
    setErr(null); setSaving(true);
    try {
      const payload = {
        // Bo'lim kategoriya nomidan avtomatik olinadi
        section: DISH_CATEGORIES.find((c) => c.value === form.category)?.label || 'Menyu',
        category: form.category,
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price) || 0,
        ...(form.oldPrice > 0 ? { oldPrice: Number(form.oldPrice) } : {}),
        prepMinutes: Number(form.prepMinutes) || 15,
        // Qo'shimcha ma'lumot — faqat to'ldirilganlari yuboriladi
        ...(form.weight.trim() ? { weight: form.weight.trim() } : {}),
        ...(form.calories ? { calories: Number(form.calories) } : {}),
        ...(form.protein ? { protein: Number(form.protein) } : {}),
        ...(form.fat ? { fat: Number(form.fat) } : {}),
        ...(form.carbs ? { carbs: Number(form.carbs) } : {}),
        icon: form.icon,
        ...(form.volume.trim() ? { volume: form.volume.trim() } : {}),
        priceMode: form.priceMode,
        ...(form.priceMode === 'custom' && form.dineInPrice
          ? { dineInPrice: Number(form.dineInPrice) }
          : {}),
        ...(form.imageUrl ? { imageUrl: form.imageUrl, images: [form.imageUrl] } : {}),
      };

      if (isEdit) await panelApi.updateDish(dish._id, payload);
      else await panelApi.createDish(payload);

      onSaved();
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 overflow-y-auto
                   max-h-[88dvh] sm:max-h-[92dvh]
                   pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink">{isEdit ? 'Taomni tahrirlash' : 'Yangi taom'}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <i className="ti ti-x text-xl" />
          </button>
        </div>

        {/* 1. Rasm */}
        <div className="mb-4">
          <ImageUpload
            value={form.imageUrl}
            onChange={(url) => set('imageUrl', url)}
            folder="dishes"
            label="Taom rasmi"
            aspect="4/3"
          />
        </div>

        {/* 2. Nom va tavsif */}
        <Field label="Taom nomi *">
          <input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Osh (palov)"
            className="inp"
          />
        </Field>

        <Field label="Tavsif" hint="Tarkibi, tayyorlanish usuli — mijoz o'qiydi">
          <textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Devzira guruch, mol go'shti, sabzi va no'xat bilan"
            rows={3}
            className="inp resize-none"
          />
        </Field>

        {/* 3. Kategoriya — qaysi bo'limga kiradi */}
        <Field
          label="Kategoriya *"
          hint="Mijoz bosh sahifadagi kategoriyalardan tanlaganda shu taom chiqadi. Menyuda ham shu sarlavha ostida guruhlanadi."
        >
          <select
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
            className="inp"
          >
            {DISH_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </Field>

        {/* 4. Narx */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Narx *">
            <MoneyInput
              value={form.price}
              onChange={(v) => set('price', v)}
              placeholder="45 000"
            />
          </Field>
          <Field label="Eski narx" hint="Chegirma ko'rsatish uchun">
            <MoneyInput
              value={form.oldPrice}
              onChange={(v) => set('oldPrice', v)}
              placeholder="55 000"
            />
          </Field>
        </div>

        {/* 5. Tayyorlanish vaqti */}
        <Field label="Tayyorlanish vaqti" hint="Mijozga «nechida tayyor» shu bo'yicha hisoblanadi">
          <NumberInput
            value={form.prepMinutes}
            onChange={(v) => set('prepMinutes', v)}
            placeholder="15"
            suffix="daqiqa"
          />
        </Field>

        {/* Qo'shimcha ma'lumot — barchasi ixtiyoriy */}
        <details open className="border border-line rounded-xl mb-4 overflow-hidden">
          <summary className="px-3 py-2.5 text-sm text-ink cursor-pointer select-none bg-canvas">
            Qo'shimcha ma'lumot
            <span className="text-xs text-muted font-normal"> — ixtiyoriy</span>
          </summary>

          <div className="p-3 pt-1">
            <Field
              label="Og'irlik"
              hint="Bitta taom: 150 г · Assorti: 150/30/30/20 г"
            >
              <input
                value={form.weight}
                onChange={(e) => set('weight', e.target.value)}
                placeholder="150 г"
                className="inp"
              />
            </Field>

            <Field label="Kaloriya (ккал)">
              <NumberInput
                value={form.calories}
                onChange={(v) => set('calories', v)}
                placeholder="336"
                suffix="ккал"
              />
            </Field>

            <div className="grid grid-cols-3 gap-2">
              <Field label="Oqsil (г)">
                <NumberInput
                  value={form.protein}
                  onChange={(v) => set('protein', v)}
                  placeholder="35"
                  suffix="г"
                />
              </Field>
              <Field label="Yog' (г)">
                <NumberInput
                  value={form.fat}
                  onChange={(v) => set('fat', v)}
                  placeholder="12"
                  suffix="г"
                />
              </Field>
              <Field label="Uglevod (г)">
                <NumberInput
                  value={form.carbs}
                  onChange={(v) => set('carbs', v)}
                  placeholder="21"
                  suffix="г"
                />
              </Field>
            </div>
          </div>
        </details>

        {err && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{err}</div>}

        {/* Tugmalar pastda mahkamlanadi — scroll qilganda ham ko'rinadi */}
        <div className="flex gap-2 mt-4 sticky bottom-0 bg-white pt-3 -mx-5 px-5 sm:-mx-6 sm:px-6 border-t border-line">
          <button onClick={onClose} className="flex-1 border border-line text-muted py-2.5 rounded-xl hover:bg-canvas">
            Bekor
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-[1.5] bg-brand-400 text-brand-text font-medium py-2.5 rounded-xl hover:bg-brand-600 hover:text-white disabled:opacity-50"
          >
            {saving ? 'Saqlanmoqda...' : isEdit ? 'Saqlash' : 'Qo\'shish'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Forma maydoni — label + hint bilan
function Field({ label, hint, children }) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-ink mb-1">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted mt-1">{hint}</p>}
    </div>
  );
}
function DishImageEditor({ dish, onClose, onSaved }) {
  useLockScroll();
  const [imageUrl, setImageUrl] = useState(dish.imageUrl || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      await panelApi.updateDish(dish._id, {
        imageUrl,
        images: imageUrl ? [imageUrl] : [],
      });
      onSaved();
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 overflow-y-auto
                   max-h-[88dvh]
                   pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6"
      >
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-lg font-semibold text-ink">Taom rasmi</h3>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <i className="ti ti-x text-xl" />
          </button>
        </div>
        <p className="text-sm text-muted mb-4">{dish.name}</p>

        <ImageUpload
          value={imageUrl}
          onChange={setImageUrl}
          folder="dishes"
          label=""
          aspect="4/3"
        />

        {err && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-3">{err}</div>}

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="px-5 py-2.5 border border-line text-muted rounded-xl hover:bg-canvas">
            Bekor
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 bg-brand-400 text-brand-text font-medium py-2.5 rounded-xl hover:bg-brand-600 hover:text-white transition-colors disabled:opacity-50"
          >
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Umumiy katalogdan mahsulot tanlash.
 *
 * Ichimlik va tayyor mahsulotlar (Coca-Cola, suv) barcha
 * restoranlarda bir xil — admin bir marta yaratadi, restoran
 * tanlab faqat o'z narxini qo'yadi.
 */
function CatalogPicker({ onClose, onAdded }) {
  useLockScroll();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(null);
  const [price, setPrice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
      panelApi.getPanelCatalog(qs)
        .then(setItems)
        .catch(() => {})
        .finally(() => setLoading(false));
    }, q ? 350 : 0);
    return () => clearTimeout(t);
  }, [q]);

  const add = async () => {
    if (!price || price <= 0) { setErr('Narx kiriting'); return; }
    setSaving(true); setErr(null);
    try {
      await panelApi.addFromCatalog(picked._id, { price: Number(price) });
      onAdded();
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  // Brend bo'yicha guruh
  const grouped = items.reduce((acc, p) => {
    const key = p.brand || 'Boshqa';
    (acc[key] = acc[key] || []).push(p);
    return acc;
  }, {});

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[88dvh]"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line flex-none">
          <div>
            <h2 className="text-lg font-semibold text-ink">Katalogdan qo'shish</h2>
            <p className="text-xs text-muted mt-0.5">
              Tayyor mahsulot tanlang, narxini o'zingiz qo'yasiz
            </p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink flex-none">
            <i className="ti ti-x text-xl" />
          </button>
        </div>

        {picked ? (
          /* Narx kiritish */
          <div className="p-5">
            <div className="flex items-center gap-3 bg-canvas rounded-xl p-3 mb-4">
              {picked.imageUrl ? (
                <img src={picked.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover flex-none" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-surface flex items-center justify-center flex-none">
                  <i className="ti ti-cup text-muted text-xl" />
                </div>
              )}
              <div className="min-w-0">
                <div className="font-medium text-ink">{picked.name}</div>
                {picked.volume && <div className="text-sm text-muted">{picked.volume}</div>}
              </div>
            </div>

            <label className="block text-sm font-medium text-ink mb-1.5">
              Sizning narxingiz *
            </label>
            <MoneyInput value={price} onChange={setPrice} placeholder="8 000" />
            {picked.suggestedPrice > 0 && (
              <p className="text-[11px] text-muted mt-1">
                Tavsiya: {picked.suggestedPrice.toLocaleString('ru-RU')} so'm
              </p>
            )}

            {err && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-3">
                {err}
              </div>
            )}

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setPicked(null); setErr(null); }}
                className="flex-1 border border-line text-muted py-2.5 rounded-xl"
              >
                Orqaga
              </button>
              <button
                onClick={add}
                disabled={saving}
                className="flex-[1.5] bg-brand-400 text-brand-text font-medium py-2.5 rounded-xl disabled:opacity-50"
              >
                {saving ? 'Qo\u2018shilmoqda...' : 'Menyuga qo\u2018shish'}
              </button>
            </div>
          </div>
        ) : (
          /* Ro'yxat */
          <>
            <div className="px-5 py-3 border-b border-line flex-none">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Coca-Cola, suv, qahva..."
                className="inp"
              />
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3">
              {loading ? (
                <div className="text-muted text-sm py-6 text-center">Yuklanmoqda...</div>
              ) : items.length === 0 ? (
                <div className="text-center py-10">
                  <i className="ti ti-package-off text-3xl text-muted mb-2 block" />
                  <div className="text-sm text-ink font-medium">Katalog bo'sh</div>
                  <p className="text-xs text-muted mt-1">
                    Administrator hali mahsulot qo'shmagan
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(grouped).map(([brand, list]) => (
                    <div key={brand}>
                      <div className="text-xs font-semibold text-muted mb-2">{brand}</div>
                      <div className="space-y-1.5">
                        {list.map((p) => (
                          <button
                            key={p._id}
                            onClick={() => {
                              if (p.alreadyAdded) return;
                              setPicked(p);
                              setPrice(p.suggestedPrice || null);
                            }}
                            disabled={p.alreadyAdded}
                            className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors ${
                              p.alreadyAdded
                                ? 'border-line bg-canvas opacity-50 cursor-default'
                                : 'border-line hover:border-brand-400 hover:bg-canvas'
                            }`}
                          >
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt="" className="w-11 h-11 rounded-lg object-cover flex-none" />
                            ) : (
                              <div className="w-11 h-11 rounded-lg bg-canvas flex items-center justify-center flex-none">
                                <i className="ti ti-cup text-muted" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-ink truncate">
                                {p.name}
                                {p.volume && <span className="text-muted font-normal"> · {p.volume}</span>}
                              </div>
                              {p.suggestedPrice > 0 && (
                                <div className="text-xs text-muted">
                                  ~{p.suggestedPrice.toLocaleString('ru-RU')} so'm
                                </div>
                              )}
                            </div>
                            {p.alreadyAdded ? (
                              <span className="text-[11px] text-green-600 font-medium flex-none">
                                Menyuda
                              </span>
                            ) : (
                              <i className="ti ti-plus text-brand-600 flex-none" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
