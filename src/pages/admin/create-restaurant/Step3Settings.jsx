import { useCreateForm } from './context';
import { SHOP_TYPES } from '../restaurantMeta';
import { Field, NumField } from './fields';

export function Step3Settings() {
  const { form, set, setErr } = useCreateForm();

  return (
    <>
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
    </>
  );
}

