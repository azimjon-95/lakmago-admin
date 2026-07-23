import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '@/api';
import { CATEGORIES, KINDS, SHOP_TYPES } from './restaurantMeta';
import { ImageUpload } from '@/components/ImageUpload';

export function CreateRestaurantPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', cuisine: '', category: 'milliy', kind: 'restaurant',
    phone: '', address: '', deliveryMin: 25, deliveryMax: 40, deliveryFee: 0,
    login: '', password: '', imageUrl: '',
    shopTypes: [], pickupEnabled: true, pickupDiscountPercent: 0, prepMinutes: 20,
    lat: '', lng: '', landmark: '',
    reservationEnabled: false, reservationNote: '',
  });
  const [step, setStep] = useState(1);
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
      // Koordinata matn sifatida kiritiladi — songa aylantiramiz
      if (form.lat) payload.lat = Number(form.lat); else delete payload.lat;
      if (form.lng) payload.lng = Number(form.lng); else delete payload.lng;
      if (form.imageUrl) payload.images = [form.imageUrl];
      await adminApi.createRestaurant(payload);
      navigate('/restaurants');
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  // Har bosqichning o'z shartlari
  const stepValid = {
    1: form.name.trim() && form.cuisine.trim(),
    2: form.address.trim(),
    3: form.login.trim() && form.password.length >= 4,
    4: true,
  };
  const valid = stepValid[1] && stepValid[2] && stepValid[3];

  const STEPS = [
    { n: 1, label: 'Asosiy', icon: 'ti-building-store' },
    { n: 2, label: 'Manzil', icon: 'ti-map-pin' },
    { n: 3, label: 'Sozlamalar', icon: 'ti-settings' },
    { n: 4, label: 'Tekshiruv', icon: 'ti-checks' },
  ];

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

      {/* Bosqich indikatori */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-5">
        <div className="flex items-center gap-1 sm:gap-2">
          {STEPS.map((st, i) => (
            <div key={st.n} className="flex items-center flex-1 min-w-0">
              <button
                onClick={() => st.n < step && setStep(st.n)}
                disabled={st.n > step}
                className={`flex items-center gap-2 min-w-0 ${st.n <= step ? '' : 'opacity-40'}`}
              >
                <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-none text-sm ${
                  st.n === step ? 'bg-brand-400 text-brand-text'
                  : st.n < step ? 'bg-green-100 text-green-700' : 'bg-canvas border border-line text-muted'
                }`}>
                  {st.n < step ? <i className="ti ti-check" /> : st.n}
                </span>
                <span className={`text-xs sm:text-sm truncate hidden sm:block ${
                  st.n === step ? 'text-ink font-medium' : 'text-muted'
                }`}>{st.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 sm:mx-2 ${st.n < step ? 'bg-green-300' : 'bg-line'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 grid gap-6">
        {/* ===== 1-BOSQICH: asosiy ma'lumot ===== */}
        {step === 1 && (<>
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

        {/* Do'kon yo'nalishlari — faqat magazin tanlansa */}
        {/* Aloqa + yetkazish */}
        <section className="bg-surface border border-line rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">
            <i className="ti ti-map-pin text-brand-600" /> Aloqa va yetkazish
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Telefon" value={form.phone} onChange={(v) => set('phone', v)} placeholder="+998 90 123 45 67" />
            <Field label="Manzil" value={form.address} onChange={(v) => set('address', v)} placeholder="Shahar, ko'cha, uy" />
          </div>
          <div className="mt-4">
            <Field label="Mo'ljal" value={form.landmark} onChange={(v) => set('landmark', v)} placeholder="Metro yonida, 2-qavat" />
          </div>

          {/* Xaritadagi joylashuv */}
          <div className="mt-4 pt-4 border-t border-line">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink">Xaritadagi joylashuv</div>
                <p className="text-xs text-muted mt-0.5">Kuryer va mijoz aniq topishi uchun</p>
              </div>
              <button
                onClick={() => {
                  if (!navigator.geolocation) { setErr('Brauzer joylashuvni qo\'llab-quvvatlamaydi'); return; }
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      set('lat', pos.coords.latitude.toFixed(6));
                      set('lng', pos.coords.longitude.toFixed(6));
                    },
                    () => setErr('Joylashuvni olishda xato'),
                    { enableHighAccuracy: true, timeout: 10000 },
                  );
                }}
                className="text-sm px-3 py-2 rounded-lg border border-line text-brand-600 hover:bg-canvas flex items-center gap-2 flex-none"
              >
                <i className="ti ti-current-location" /> Hozirgi joyni olish
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Kenglik (lat)" value={form.lat} onChange={(v) => set('lat', v)} placeholder="41.311081" />
              <Field label="Uzunlik (lng)" value={form.lng} onChange={(v) => set('lng', v)} placeholder="69.240562" />
            </div>
            {form.lat && form.lng && (
              <a
                href={`https://maps.google.com/?q=${form.lat},${form.lng}`}
                target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-brand-600 mt-2 hover:underline"
              >
                <i className="ti ti-map-2" /> Xaritada tekshirish
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-line">
            <NumField label="Yetkazish (min daq)" value={form.deliveryMin} onChange={(v) => set('deliveryMin', v)} />
            <NumField label="Yetkazish (max daq)" value={form.deliveryMax} onChange={(v) => set('deliveryMax', v)} />
            <NumField label="Yetkazish narxi" value={form.deliveryFee} onChange={(v) => set('deliveryFee', v)} hint="0 = bepul" />
          </div>
        </section>
        </>)}

        {/* ===== 3-BOSQICH: sozlamalar va akkaunt ===== */}
        {step === 2 && (<>

        {/* Stol bron qilish */}
        <section className="bg-surface border border-line rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-ink mb-1 flex items-center gap-2">
            <i className="ti ti-calendar-plus text-brand-600" /> Stol bron qilish
          </h2>
          <p className="text-xs text-muted mb-4">
            Yoqilsa mijoz ilovada "Stol bron qilish" tugmasini ko'radi
          </p>
          <label className="flex items-center gap-3 cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={form.reservationEnabled}
              onChange={(e) => set('reservationEnabled', e.target.checked)}
              className="w-4 h-4 accent-brand-400"
            />
            <span className="text-sm text-ink">Bron qabul qilish</span>
          </label>
          {form.reservationEnabled && (
            <Field
              label="Bron shartlari"
              value={form.reservationNote}
              onChange={(v) => set('reservationNote', v)}
              placeholder="Kamida 2 soat oldin bron qiling"
            />
          )}
        </section>


        </>)}

        {step === 3 && (<>
        {form.kind === 'shop' && (
          <section className="bg-surface border border-line rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-ink mb-1 flex items-center gap-2">
              <i className="ti ti-building-store text-brand-600" /> Do'kon yo'nalishi
            </h2>
            <p className="text-xs text-muted mb-4">
              Nima sotadi? Bir nechtasini tanlash mumkin (mijoz shu bo'yicha qidiradi)
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {SHOP_TYPES.map((t) => {
                const active = form.shopTypes.includes(t.value);
                return (
                  <button
                    key={t.value}
                    onClick={() => set('shopTypes', active
                      ? form.shopTypes.filter((x) => x !== t.value)
                      : [...form.shopTypes, t.value])}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-xs text-center transition-colors ${
                      active ? 'border-brand-400 bg-brand-50 text-brand-600' : 'border-line text-muted hover:bg-canvas'
                    }`}
                  >
                    <i className={`ti ${t.icon} text-xl`} />
                    <span className="leading-tight">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Olib ketish */}
        <section className="bg-surface border border-line rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-ink mb-1 flex items-center gap-2">
            <i className="ti ti-shopping-bag text-brand-600" /> Olib ketish (pickup)
          </h2>
          <p className="text-xs text-muted mb-4">Mijoz o'zi kelib olib ketishi mumkinmi</p>

          <label className="flex items-center gap-3 cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={form.pickupEnabled}
              onChange={(e) => set('pickupEnabled', e.target.checked)}
              className="w-4 h-4 accent-brand-400"
            />
            <span className="text-sm text-ink">Olib ketishni qabul qilish</span>
          </label>

          {form.pickupEnabled && (
            <div className="grid grid-cols-2 gap-4">
              <NumField
                label="Tayyorlash vaqti (daqiqa)"
                value={form.prepMinutes}
                onChange={(v) => set('prepMinutes', v)}
                hint="Mijozga 'nechida tayyor' deb ko'rsatiladi"
              />
              <NumField
                label="Olib ketish chegirmasi (%)"
                value={form.pickupDiscountPercent}
                onChange={(v) => set('pickupDiscountPercent', v)}
                hint="0 = chegirma yo'q"
              />
            </div>
          )}
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
        </>)}

        {/* ===== 4-BOSQICH: tekshiruv ===== */}
        {step === 4 && (
          <section className="bg-surface border border-line rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-ink mb-1 flex items-center gap-2">
              <i className="ti ti-checks text-brand-600" /> Tekshiruv
            </h2>
            <p className="text-xs text-muted mb-4">Barcha ma'lumotni tekshiring va yarating</p>

            {form.imageUrl && (
              <img src={form.imageUrl} alt="" className="w-full h-36 object-cover rounded-xl mb-4" />
            )}

            <Review label="Nomi" value={form.name} />
            <Review label="Turi" value={KINDS.find((k) => k.value === form.kind)?.label} />
            <Review label="Kategoriya" value={selectedCat?.label} />
            <Review label="Tavsif" value={form.cuisine} />
            <Review label="Telefon" value={form.phone} />
            <Review label="Manzil" value={form.address} />
            {form.landmark && <Review label="Mo'ljal" value={form.landmark} />}
            <Review
              label="Koordinata"
              value={form.lat && form.lng ? `${form.lat}, ${form.lng}` : 'Kiritilmagan'}
              warn={!form.lat || !form.lng}
            />
            <Review label="Yetkazish" value={`${form.deliveryMin}–${form.deliveryMax} daq · ${form.deliveryFee > 0 ? form.deliveryFee.toLocaleString('ru-RU') + " so'm" : 'bepul'}`} />
            <Review label="Olib ketish" value={form.pickupEnabled ? `Ha · ${form.prepMinutes} daq` : "Yo'q"} />
            <Review label="Stol bron" value={form.reservationEnabled ? 'Yoqilgan' : "O'chirilgan"} />
            {form.kind === 'shop' && form.shopTypes.length > 0 && (
              <Review label="Do'kon yo'nalishi" value={form.shopTypes.length + ' ta tanlangan'} />
            )}
            <Review label="Login" value={form.login} />
            <Review label="Parol" value={'•'.repeat(form.password.length)} />
          </section>
        )}

        {err && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{err}</div>}

        {/* Bosqich navigatsiyasi */}
        <div className="flex gap-3 pb-6">
          <button
            onClick={() => (step === 1 ? navigate('/restaurants') : setStep(step - 1))}
            className="px-5 py-3 border border-line text-muted rounded-xl hover:bg-surface flex-none"
          >
            {step === 1 ? 'Bekor' : 'Orqaga'}
          </button>
          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!stepValid[step]}
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
  );
}

// Tekshiruv qatori
function Review({ label, value, warn }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-line last:border-0">
      <span className="text-sm text-muted flex-none">{label}</span>
      <span className={`text-sm text-right break-words ${warn ? 'text-amber-600' : 'text-ink'}`}>
        {value || '—'}
      </span>
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
