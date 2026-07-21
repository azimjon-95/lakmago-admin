import { useState, useEffect, useCallback } from 'react';
import { panelApi } from '@/api';
import { ImageUpload } from '@/components/ImageUpload';

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

  // Bo'limlar bo'yicha guruhlash
  const sections = {};
  dishes.forEach((d) => {
    (sections[d.section] = sections[d.section] || []).push(d);
  });

  return (
    <div className="flex-1 p-4 sm:p-6 min-w-0">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-ink">Menyu</h1>
          <p className="text-sm text-muted mt-0.5">Taomlarni boshqaring — tugaganini STOP qiling</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-brand-400 text-brand-text font-medium px-4 py-2.5 rounded-xl hover:bg-brand-600 hover:text-white transition-colors flex items-center gap-2"
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
                  className={`bg-surface border rounded-xl p-4 flex items-center gap-4 ${
                    d.isAvailable ? 'border-line' : 'border-red-200 bg-red-50/40'
                  }`}
                >
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
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink">{d.name}</span>
                      {!d.isAvailable && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">STOP</span>
                      )}
                    </div>
                    <div className="text-xs text-muted truncate mt-0.5">{d.description}</div>
                  </div>
                  <div className="text-right flex-none">
                    <div className="font-semibold text-ink">{som(d.price)} so'm</div>
                    {d.oldPrice && <div className="text-xs text-muted line-through">{som(d.oldPrice)}</div>}
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
  const [form, setForm] = useState({ section: '', name: '', description: '', price: '', oldPrice: '', icon: 'ti-bowl', imageUrl: '' });
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setErr(null); setSaving(true);
    try {
      await panelApi.createDish({
        section: form.section,
        name: form.name,
        description: form.description,
        price: Number(form.price),
        ...(form.oldPrice ? { oldPrice: Number(form.oldPrice) } : {}),
        icon: form.icon,
        ...(form.imageUrl ? { imageUrl: form.imageUrl, images: [form.imageUrl] } : {}),
      });
      onSaved();
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-surface rounded-2xl p-6 w-full max-w-[420px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink">Yangi taom</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><i className="ti ti-x text-xl" /></button>
        </div>
        <div className="grid gap-3">
          <ImageUpload
            value={form.imageUrl}
            onChange={(url) => set('imageUrl', url)}
            folder="dishes"
            label="Taom rasmi"
            aspect="4/3"
          />
          <Field label="Bo'lim" value={form.section} onChange={(v) => set('section', v)} placeholder="Masalan: Milliy taomlar" />
          <Field label="Nomi" value={form.name} onChange={(v) => set('name', v)} placeholder="Masalan: Osh" />
          <Field label="Tavsif" value={form.description} onChange={(v) => set('description', v)} placeholder="Qisqacha izoh" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Narx (so'm)" value={form.price} onChange={(v) => set('price', v)} placeholder="38000" type="number" />
            <Field label="Eski narx (ixt.)" value={form.oldPrice} onChange={(v) => set('oldPrice', v)} placeholder="—" type="number" />
          </div>
          {err && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</div>}
          <button
            onClick={submit}
            disabled={saving || !form.name || !form.section || !form.price}
            className="bg-brand-400 text-brand-text font-medium py-2.5 rounded-xl hover:bg-brand-600 hover:text-white transition-colors disabled:opacity-50"
          >
            {saving ? 'Saqlanmoqda...' : 'Qo\u2018shish'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink mb-1.5">{label}</label>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-canvas text-ink outline-none focus:border-brand-400 transition-colors"
      />
    </div>
  );
}

// Mavjud taomga rasm qo'shish / almashtirish.
// Seed'dan kelgan taomlarga rasm biriktirish uchun eng qulay yo'l.
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
