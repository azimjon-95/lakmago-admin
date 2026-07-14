import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/api';

const CATEGORIES = [
  { value: 'milliy', label: 'Milliy oshxona', icon: 'ti-bowl' },
  { value: 'fastfood', label: 'Fast food', icon: 'ti-pizza' },
  { value: 'sushi', label: 'Sushi', icon: 'ti-fish' },
  { value: 'kafe', label: 'Kafe', icon: 'ti-coffee' },
  { value: 'shirinlik', label: 'Shirinliklar', icon: 'ti-cake' },
  { value: 'magazin', label: 'Magazin', icon: 'ti-building-store' },
];

const KIND_LABEL = { restaurant: 'Restoran', cafe: 'Kafe', shop: 'Magazin' };

export function RestaurantsPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setList(await adminApi.getRestaurants());
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (r) => {
    await adminApi.updateRestaurant(r._id, { isActive: !r.isActive });
    load();
  };

  const toggleBlock = async (r) => {
    const action = r.isBlocked ? 'blokdan chiqarish' : 'BLOKLASH';
    const warn = r.isBlocked ? '' : ' Bloklansa mijozlarga taomlari bilan ko\u2018rinmaydi.';
    if (!confirm(`"${r.name}" ${action}?${warn}`)) return;
    await adminApi.toggleBlock(r._id, !r.isBlocked);
    load();
  };

  const remove = async (r) => {
    if (!confirm(`"${r.name}" o'chirilsinmi? Akkaunt ham o'chadi.`)) return;
    await adminApi.deleteRestaurant(r._id);
    load();
  };

  const resetPass = async (r) => {
    const p = prompt(`"${r.name}" uchun yangi parol:`);
    if (!p) return;
    await adminApi.resetPassword(r._id, p);
    alert('Parol yangilandi');
  };

  return (
    <div className="flex-1 p-6 min-w-0">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-ink">Muassasalar</h1>
          <p className="text-sm text-muted mt-0.5">Restoran, kafe va magazinlarni boshqarish</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-brand-400 text-brand-text font-medium px-4 py-2.5 rounded-xl hover:bg-brand-600 hover:text-white transition-colors flex items-center gap-2"
        >
          <i className="ti ti-plus" /> Yangi qo'shish
        </button>
      </div>

      {err && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</div>}

      {loading ? (
        <div className="text-muted text-sm py-10 text-center">Yuklanmoqda...</div>
      ) : (
        <div className="grid gap-3">
          {list.length === 0 && (
            <div className="text-center text-muted text-sm py-12 border border-dashed border-line rounded-xl">
              Hozircha muassasa yo'q. "Yangi qo'shish" tugmasini bosing.
            </div>
          )}
          {list.map((r) => (
            <div key={r._id} className="bg-surface border border-line rounded-xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center flex-none">
                <i className={`ti ${r.icon || 'ti-building-store'} text-xl text-brand-600`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink">{r.name}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-600">
                    {KIND_LABEL[r.kind] || 'Restoran'}
                  </span>
                  {r.isBlocked ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">🚫 Bloklangan</span>
                  ) : r.isActive ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-700">Faol</span>
                  ) : (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Yopiq</span>
                  )}
                </div>
                <div className="text-sm text-muted mt-0.5">{r.cuisine}</div>
                {r.ownerLogin && (
                  <div className="text-xs text-muted mt-1">
                    <i className="ti ti-user text-[11px]" /> login: <span className="font-mono text-ink">{r.ownerLogin}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-none">
                <button
                  onClick={() => toggleActive(r)}
                  title={r.isActive ? 'Yopish' : 'Ochish'}
                  className="w-9 h-9 rounded-lg border border-line hover:bg-canvas flex items-center justify-center text-muted"
                >
                  <i className={`ti ${r.isActive ? 'ti-lock' : 'ti-lock-open'}`} />
                </button>
                <button
                  onClick={() => toggleBlock(r)}
                  title={r.isBlocked ? 'Blokdan chiqarish' : 'Bloklash'}
                  className={`w-9 h-9 rounded-lg border flex items-center justify-center ${r.isBlocked ? 'border-red-300 bg-red-50 text-red-600' : 'border-line hover:bg-canvas text-muted'}`}
                >
                  <i className={`ti ${r.isBlocked ? 'ti-ban' : 'ti-shield-x'}`} />
                </button>
                <button
                  onClick={() => resetPass(r)}
                  title="Parolni almashtirish"
                  className="w-9 h-9 rounded-lg border border-line hover:bg-canvas flex items-center justify-center text-muted"
                >
                  <i className="ti ti-key" />
                </button>
                <button
                  onClick={() => remove(r)}
                  title="O'chirish"
                  className="w-9 h-9 rounded-lg border border-line hover:bg-red-50 hover:border-red-200 flex items-center justify-center text-red-500"
                >
                  <i className="ti ti-trash" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <CreateForm
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function CreateForm({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', cuisine: '', category: 'milliy', kind: 'restaurant',
    phone: '', address: '', login: '', password: '',
  });
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setErr(null);
    setSaving(true);
    try {
      const icon = CATEGORIES.find((c) => c.value === form.category)?.icon || 'ti-building-store';
      await adminApi.createRestaurant({ ...form, icon });
      onCreated();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-surface rounded-2xl p-6 w-full max-w-[460px] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink">Yangi muassasa</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><i className="ti ti-x text-xl" /></button>
        </div>

        <div className="grid gap-3">
          <Field label="Nomi" value={form.name} onChange={(v) => set('name', v)} placeholder="Masalan: Milliy Taomlar" />
          <Field label="Oshxona turi" value={form.cuisine} onChange={(v) => set('cuisine', v)} placeholder="Masalan: Milliy oshxona" />

          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Kategoriya</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => set('category', c.value)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs transition-colors ${
                    form.category === c.value
                      ? 'border-brand-400 bg-brand-50 text-brand-600'
                      : 'border-line text-muted hover:bg-canvas'
                  }`}
                >
                  <i className={`ti ${c.icon} text-lg`} />
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Muassasa turi</label>
            <div className="flex gap-2">
              {Object.entries(KIND_LABEL).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => set('kind', k)}
                  className={`flex-1 py-2 rounded-xl border text-sm transition-colors ${
                    form.kind === k ? 'border-brand-400 bg-brand-50 text-brand-600' : 'border-line text-muted'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefon" value={form.phone} onChange={(v) => set('phone', v)} placeholder="+998..." />
            <Field label="Manzil" value={form.address} onChange={(v) => set('address', v)} placeholder="Shahar, ko'cha" />
          </div>

          <div className="border-t border-line pt-3 mt-1">
            <p className="text-xs text-muted mb-2">Restoran shu login/parol bilan kiradi:</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Login" value={form.login} onChange={(v) => set('login', v)} placeholder="masalan: milliy" />
              <Field label="Parol" value={form.password} onChange={(v) => set('password', v)} placeholder="kamida 4 belgi" />
            </div>
          </div>

          {err && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</div>}

          <button
            onClick={submit}
            disabled={saving || !form.name || !form.cuisine || !form.login || !form.password}
            className="bg-brand-400 text-brand-text font-medium py-2.5 rounded-xl hover:bg-brand-600 hover:text-white transition-colors disabled:opacity-50 mt-1"
          >
            {saving ? 'Saqlanmoqda...' : 'Yaratish'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink mb-1.5">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-canvas text-ink outline-none focus:border-brand-400 transition-colors"
      />
    </div>
  );
}
