import { createContext, useContext, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { adminApi } from '@/api';
import { CATEGORIES } from '../restaurantMeta';

const Ctx = createContext(null);
export const useCreateForm = () => useContext(Ctx);

const EMPTY = {
  name: '', cuisine: '', category: 'milliy', kind: 'restaurant', imageUrl: '',
  phone: '', address: '', landmark: '', lat: '', lng: '',
  deliveryMin: 25, deliveryMax: 40, deliveryFee: 0,
  shopTypes: [], pickupEnabled: true, pickupDiscountPercent: 0, prepMinutes: 20,
  reservationEnabled: false, reservationNote: '',
  login: '', password: '',
};

// Bosqichlar — URL bilan bog'langan
export const STEPS = [
  { path: 'asosiy', n: 1, label: 'Asosiy', icon: 'ti-building-store' },
  { path: 'manzil', n: 2, label: 'Manzil', icon: 'ti-map-pin' },
  { path: 'sozlamalar', n: 3, label: 'Sozlamalar', icon: 'ti-settings' },
  { path: 'tekshiruv', n: 4, label: 'Tekshiruv', icon: 'ti-checks' },
];

export function CreateRestaurantLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Hozirgi bosqich URL'dan aniqlanadi
  const current = STEPS.find((s) => location.pathname.endsWith(s.path)) || STEPS[0];

  // Har bosqichning shartlari
  const stepValid = {
    1: Boolean(form.name.trim() && form.cuisine.trim()),
    2: Boolean(form.address.trim()),
    3: Boolean(form.login.trim() && form.password.length >= 4),
    4: true,
  };
  const valid = stepValid[1] && stepValid[2] && stepValid[3];

  const goTo = (n) => {
    const st = STEPS.find((s) => s.n === n);
    if (st) navigate(`/restaurants/new/${st.path}`);
  };

  const submit = async () => {
    setErr(null);
    setSaving(true);
    try {
      const icon = CATEGORIES.find((c) => c.value === form.category)?.icon || 'ti-building-store';
      const payload = { ...form, icon };
      if (form.imageUrl) payload.images = [form.imageUrl];
      // Koordinata matn — songa aylantiramiz
      if (form.lat) payload.lat = Number(form.lat); else delete payload.lat;
      if (form.lng) payload.lng = Number(form.lng); else delete payload.lng;
      await adminApi.createRestaurant(payload);
      navigate('/restaurants');
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  const ctx = { form, set, setForm, err, setErr, saving, submit, stepValid, valid, current, goTo };

  return (
    <Ctx.Provider value={ctx}>
      <div className="flex-1 min-w-0 overflow-y-auto">
        {/* Sarlavha */}
        <div className="sticky top-0 bg-canvas border-b border-line px-4 sm:px-6 py-4 flex items-center gap-3 z-10">
          <button
            onClick={() => navigate('/restaurants')}
            className="w-9 h-9 rounded-lg border border-line hover:bg-surface flex items-center justify-center text-muted flex-none"
          >
            <i className="ti ti-arrow-left" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold text-ink">Yangi muassasa</h1>
            <p className="text-xs sm:text-sm text-muted mt-0.5 truncate">
              {current.n}-bosqich: {current.label}
            </p>
          </div>
        </div>

        {/* Bosqich indikatori */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-5">
          <div className="flex items-center gap-1 sm:gap-2">
            {STEPS.map((st, i) => (
              <div key={st.n} className="flex items-center flex-1 min-w-0">
                <button
                  onClick={() => st.n < current.n && goTo(st.n)}
                  disabled={st.n > current.n}
                  className={`flex items-center gap-2 min-w-0 ${st.n <= current.n ? '' : 'opacity-40'}`}
                >
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-none text-sm ${
                    st.n === current.n ? 'bg-brand-400 text-brand-text'
                    : st.n < current.n ? 'bg-green-100 text-green-700'
                    : 'bg-canvas border border-line text-muted'
                  }`}>
                    {st.n < current.n ? <i className="ti ti-check" /> : st.n}
                  </span>
                  <span className={`text-xs sm:text-sm truncate hidden sm:block ${
                    st.n === current.n ? 'text-ink font-medium' : 'text-muted'
                  }`}>{st.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 sm:mx-2 ${st.n < current.n ? 'bg-green-300' : 'bg-line'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 grid gap-6">
          <Outlet />

          {err && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{err}</div>}

          {/* Navigatsiya */}
          <div className="flex gap-3 pb-6">
            <button
              onClick={() => (current.n === 1 ? navigate('/restaurants') : goTo(current.n - 1))}
              className="px-5 py-3 border border-line text-muted rounded-xl hover:bg-surface flex-none"
            >
              {current.n === 1 ? 'Bekor' : 'Orqaga'}
            </button>
            {current.n < 4 ? (
              <button
                onClick={() => goTo(current.n + 1)}
                disabled={!stepValid[current.n]}
                className="flex-1 bg-brand-400 text-brand-text font-medium py-3 rounded-xl hover:bg-brand-600 hover:text-white transition-colors disabled:opacity-50"
              >
                Keyingi
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={saving || !valid}
                className="flex-1 bg-brand-400 text-brand-text font-medium py-3 rounded-xl hover:bg-brand-600 hover:text-white transition-colors disabled:opacity-50"
              >
                {saving ? 'Saqlanmoqda...' : 'Muassasani yaratish'}
              </button>
            )}
          </div>
        </div>
      </div>
    </Ctx.Provider>
  );
}
