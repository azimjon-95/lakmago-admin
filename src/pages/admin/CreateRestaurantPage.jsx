import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '@/api';
import { CATEGORIES, KINDS } from './restaurantMeta';
import { ImageUpload } from '@/components/ImageUpload';

export function CreateRestaurantPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', cuisine: '', category: 'milliy', kind: 'restaurant',
    phone: '', address: '', deliveryMin: 25, deliveryMax: 40, deliveryFee: 0,
    login: '', password: '', imageUrl: '',
  });
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const selectedCat = CATEGORIES.find((c) => c.value === form.category);

  const submit = async () => {
    setErr(null);
    setSaving(true);
    try {
      const icon = selectedCat?.icon || 'ti-building-store';
      const payload = { ...form, icon };
      if (form.imageUrl) payload.images = [form.imageUrl];
      await adminApi.createRestaurant(payload);
      navigate('/restaurants');
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  const valid = form.name && form.cuisine && form.login && form.password.length >= 4;

  return (
    <div className="flex-1 min-w-0 overflow-y-auto">
      {/* Sarlavha */}
      <div className="sticky top-0 bg-canvas border-b border-line px-6 py-4 flex items-center gap-3 z-10">
        <button onClick={() => navigate('/restaurants')} className="w-9 h-9 rounded-lg border border-line hover:bg-surface flex items-center justify-center text-muted">
          <i className="ti ti-arrow-left" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-ink">Yangi muassasa qo'shish</h1>
          <p className="text-sm text-muted mt-0.5">Restoran, choyxona, kafe, klub yoki magazin</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 grid gap-6">
        {/* Asosiy ma'lumot */}
        <section className="bg-surface border border-line rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">
            <i className="ti ti-info-circle text-brand-600" /> Asosiy ma'lumot
          </h2>
          <div className="grid gap-4">
            <ImageUpload
              value={form.imageUrl}
              onChange={(url) => set('imageUrl', url)}
              folder="banners"
              label="Muassasa rasmi (banner)"
              aspect="16/9"
            />
            <Field label="Muassasa nomi *" value={form.name} onChange={(v) => set('name', v)} placeholder="Masalan: Milliy Taomlar" />
            <Field label="Oshxona / yo'nalish tavsifi *" value={form.cuisine} onChange={(v) => set('cuisine', v)} placeholder="Masalan: Milliy oshxona, osh va shashlik" />
          </div>
        </section>

        {/* Kategoriya */}
        <section className="bg-surface border border-line rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-ink mb-1 flex items-center gap-2">
            <i className="ti ti-tag text-brand-600" /> Kategoriya
          </h2>
          <p className="text-xs text-muted mb-4">Muassasa qaysi yo'nalishда — mijozlar shu bo'yicha filtrlaydi</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => set('category', c.value)}
                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-xs text-center transition-colors ${
                  form.category === c.value
                    ? 'border-brand-400 bg-brand-50 text-brand-600'
                    : 'border-line text-muted hover:bg-canvas'
                }`}
              >
                <i className={`ti ${c.icon} text-xl`} />
                <span className="leading-tight">{c.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Muassasa turi */}
        <section className="bg-surface border border-line rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-ink mb-1 flex items-center gap-2">
            <i className="ti ti-building text-brand-600" /> Muassasa turi
          </h2>
          <p className="text-xs text-muted mb-4">Ish tartibi va xarakteri</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {KINDS.map((k) => (
              <button
                key={k.value}
                onClick={() => set('kind', k.value)}
                className={`text-left p-3 rounded-xl border transition-colors ${
                  form.kind === k.value ? 'border-brand-400 bg-brand-50' : 'border-line hover:bg-canvas'
                }`}
              >
                <div className="flex items-center gap-2">
                  <i className={`ti ${k.icon} text-lg ${form.kind === k.value ? 'text-brand-600' : 'text-muted'}`} />
                  <span className={`text-sm font-medium ${form.kind === k.value ? 'text-brand-600' : 'text-ink'}`}>{k.label}</span>
                </div>
                <p className="text-[11px] text-muted mt-1 leading-tight">{k.desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Aloqa + yetkazish */}
        <section className="bg-surface border border-line rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">
            <i className="ti ti-map-pin text-brand-600" /> Aloqa va yetkazish
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Telefon" value={form.phone} onChange={(v) => set('phone', v)} placeholder="+998 90 123 45 67" />
            <Field label="Manzil" value={form.address} onChange={(v) => set('address', v)} placeholder="Shahar, ko'cha, uy" />
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <NumField label="Yetkazish (min daq)" value={form.deliveryMin} onChange={(v) => set('deliveryMin', v)} />
            <NumField label="Yetkazish (max daq)" value={form.deliveryMax} onChange={(v) => set('deliveryMax', v)} />
            <NumField label="Yetkazish narxi" value={form.deliveryFee} onChange={(v) => set('deliveryFee', v)} hint="0 = bepul" />
          </div>
        </section>

        {/* Akkaunt */}
        <section className="bg-surface border border-line rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-ink mb-1 flex items-center gap-2">
            <i className="ti ti-key text-brand-600" /> Kirish akkaunti
          </h2>
          <p className="text-xs text-muted mb-4">Muassasa shu login va parol bilan o'z paneliga kiradi</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Login *" value={form.login} onChange={(v) => set('login', v)} placeholder="masalan: milliy" />
            <Field label="Parol *" value={form.password} onChange={(v) => set('password', v)} placeholder="kamida 4 belgi" />
          </div>
        </section>

        {err && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{err}</div>}

        {/* Amal tugmalari */}
        <div className="flex gap-3 pb-6">
          <button onClick={() => navigate('/restaurants')} className="px-6 py-3 border border-line text-muted rounded-xl hover:bg-surface">
            Bekor qilish
          </button>
          <button
            onClick={submit}
            disabled={saving || !valid}
            className="flex-1 bg-brand-400 text-brand-text font-medium py-3 rounded-xl hover:bg-brand-600 hover:text-white transition-colors disabled:opacity-50"
          >
            {saving ? 'Saqlanmoqda...' : 'Muassasani yaratish'}
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

function NumField({ label, value, onChange, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink mb-1.5">{label}</label>
      <input
        type="number" min="0"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-canvas text-ink outline-none focus:border-brand-400 transition-colors"
      />
      {hint && <p className="text-[11px] text-muted mt-1">{hint}</p>}
    </div>
  );
}
