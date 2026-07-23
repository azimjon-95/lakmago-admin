import { useState, useEffect, useCallback } from 'react';
import { panelApi } from '@/api';
import { ImageUpload } from '@/components/ImageUpload';

// Taom kategoriyalari — barcha muassasalar uchun umumiy.
// Restoran, kafe, bar, choyxona — hammasi shu ro'yxatdan tanlaydi.
const DISH_CATEGORIES = [
  { value: 'issiq', label: 'Issiq taomlar (garyachiy sex)' },
  { value: 'shorva', label: "Sho'rvalar" },
  { value: 'salat', label: 'Salatlar' },
  { value: 'sovuq', label: 'Sovuq gazaklar' },
  { value: 'grill', label: 'Mangal / shashlik' },
  { value: 'garnir', label: 'Garnirlar' },
  { value: 'fastfood', label: 'Fast food (lavash, burger)' },
  { value: 'pitsa', label: 'Pitsa' },
  { value: 'sushi', label: 'Sushi va rollar' },
  { value: 'nonushta', label: 'Nonushta' },
  { value: 'shirinlik', label: 'Shirinlik / desert' },
  { value: 'nonvoyxona', label: 'Non, somsa, patir' },
  { value: 'ichimlik', label: 'Ichimliklar (bar)' },
  { value: 'alkogol', label: 'Alkogolli ichimliklar' },
  { value: 'boshqa', label: 'Boshqa' },
];

const som = (n) => (n ?? 0).toLocaleString('ru-RU').replace(/,/g, ' ');

export function RestaurantMenuPage() {
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
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
    if (!confirm(`"${d.name}" o'chirilsinmi?`)) return;
    await panelApi.deleteDish(d._id);
    load();
  };

  // Kategoriya bo'yicha guruhlash — DISH_CATEGORIES tartibida.
  // Bir kategoriya ichida bo'limlar ham ajratiladi.
  const grouped = DISH_CATEGORIES
    .map((cat) => ({
      ...cat,
      items: dishes.filter((d) => (d.category || 'issiq') === cat.value),
    }))
    .filter((g) => g.items.length > 0);

  // Kategoriyasi noma'lum taomlar (eski ma'lumot)
  const known = new Set(DISH_CATEGORIES.map((c) => c.value));
  const orphans = dishes.filter((d) => !known.has(d.category || 'issiq'));
  if (orphans.length) grouped.push({ value: '_', label: 'Boshqalar', items: orphans });

  return (
    <div className="flex-1 p-4 sm:p-6 min-w-0">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold text-ink">Menyu</h1>
          <p className="text-xs sm:text-sm text-muted mt-0.5">Taomlarni boshqaring — tugaganini STOP qiling</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-brand-400 text-brand-text font-medium px-4 py-2.5 rounded-xl hover:bg-brand-600 hover:text-white transition-colors flex items-center gap-2 flex-none whitespace-nowrap"
        >
          <i className="ti ti-plus" /> Taom qo'shish
        </button>
      </div>

      {loading ? (
        <div className="text-muted text-sm py-10 text-center">Yuklanmoqda...</div>
      ) : dishes.length === 0 ? (
        <div className="text-center text-muted text-sm py-12 border border-dashed border-line rounded-xl">
          Menyu bo'sh. "Taom qo'shish" tugmasini bosing.
        </div>
      ) : (
        Object.entries(sections).map(([section, items]) => (
          <div key={section} className="mb-6">
            <h2 className="text-sm font-medium text-muted mb-2 uppercase tracking-wide">{section}</h2>
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
                      onClick={() => remove(d)}
                      className="w-9 h-9 rounded-lg border border-line hover:bg-red-50 hover:border-red-200 flex items-center justify-center text-red-500"
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

      {showForm && <DishForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
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

function DishForm({ onClose, onSaved }) {
  const [form, setForm] = useState({
    imageUrl: '', name: '', description: '',
    category: 'issiq', section: '',
    price: '', oldPrice: '', prepMinutes: 15,
    icon: 'ti-bowl',
  });
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) { setErr('Taom nomini kiriting'); return; }
    if (!form.price || Number(form.price) <= 0) { setErr('Narxni kiriting'); return; }
    setErr(null); setSaving(true);
    try {
      await panelApi.createDish({
        // Bo'lim ko'rsatilmasa kategoriya nomi ishlatiladi
        section: form.section.trim() || DISH_CATEGORIES.find((c) => c.value === form.category)?.label || 'Menyu',
        category: form.category,
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        ...(form.oldPrice ? { oldPrice: Number(form.oldPrice) } : {}),
        prepMinutes: Number(form.prepMinutes) || 15,
        icon: form.icon,
        ...(form.imageUrl ? { imageUrl: form.imageUrl, images: [form.imageUrl] } : {}),
      });
      onSaved();
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-md p-5 sm:p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink">Yangi taom</h2>
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

        <Field label="Tavsif">
          <input
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Devzira guruch, mol go'shti"
            className="inp"
          />
        </Field>

        {/* 3. Kategoriya — qaysi bo'limga kiradi */}
        <Field label="Kategoriya *" hint="Mijoz shu bo'yicha qidiradi va filtrlaydi">
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

        <Field label="Menyu bo'limi" hint="Bo'sh qoldirilsa kategoriya nomi ishlatiladi">
          <input
            value={form.section}
            onChange={(e) => set('section', e.target.value)}
            placeholder="Masalan: Milliy taomlar"
            className="inp"
          />
        </Field>

        {/* 4. Narx */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Narx (so'm) *">
            <input
              type="number" min="0"
              value={form.price}
              onChange={(e) => set('price', e.target.value)}
              placeholder="45000"
              className="inp"
            />
          </Field>
          <Field label="Eski narx" hint="Chegirma ko'rsatish uchun">
            <input
              type="number" min="0"
              value={form.oldPrice}
              onChange={(e) => set('oldPrice', e.target.value)}
              placeholder="55000"
              className="inp"
            />
          </Field>
        </div>

        {/* 5. Tayyorlanish vaqti */}
        <Field label="Tayyorlanish vaqti" hint="Mijozga «nechida tayyor» shu bo'yicha hisoblanadi">
          <div className="flex items-center gap-2">
            <input
              type="number" min="1" max="240"
              value={form.prepMinutes}
              onChange={(e) => set('prepMinutes', e.target.value)}
              className="inp flex-1"
            />
            <span className="text-sm text-muted flex-none">daqiqa</span>
          </div>
        </Field>

        {err && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{err}</div>}

        <div className="flex gap-2 mt-2">
          <button onClick={onClose} className="flex-1 border border-line text-muted py-2.5 rounded-xl hover:bg-canvas">
            Bekor
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-[1.5] bg-brand-400 text-brand-text font-medium py-2.5 rounded-xl hover:bg-brand-600 hover:text-white disabled:opacity-50"
          >
            {saving ? 'Saqlanmoqda...' : 'Qo\'shish'}
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
    <div onClick={onClose} className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-md p-6">
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
