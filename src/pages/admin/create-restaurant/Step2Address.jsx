import { useCreateForm } from './context';
import { Field, NumField } from './fields';

export function Step2Address() {
  const { form, set, setErr } = useCreateForm();

  return (
    <>
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

        {/* ===== 3-BOSQICH: sozlamalar va akkaunt ===== */}
    </>
  );
}

