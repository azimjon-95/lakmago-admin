import { useState, useEffect } from 'react';
import { panelApi } from '@/api';
import { NumberInput, MoneyInput } from '@/components/form/NumberInput';
import { MapPicker } from '@/components/MapPicker';

/**
 * Restoran o'z ma'lumotlarini tahrirlaydi.
 *
 * Shartnomaga tegishli narsalar (komissiya, balans) bu yerda
 * KO'RSATILMAYDI — ular faqat admin panelida.
 */
export function RestaurantProfilePage() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [mapOpen, setMapOpen] = useState(false);

  useEffect(() => {
    panelApi.getProfile()
      .then((r) => setForm({
        name: r.name || '',
        cuisine: r.cuisine || '',
        description: r.description || '',
        phone: r.phone || '',

        address: r.address || '',
        landmark: r.landmark || '',
        lat: r.lat ?? null,
        lng: r.lng ?? null,

        openTime: r.openTime || '09:00',
        closeTime: r.closeTime || '23:00',
        timezone: r.timezone || 'Asia/Tashkent',
        workingDays: r.workingDays || [],

        deliveryType: r.delivery?.type || 'free',
        maxDistanceKm: r.delivery?.maxDistanceKm ?? 10,
        freeKm: r.delivery?.pricing?.freeKm ?? 0,
        basePrice: r.delivery?.pricing?.basePrice ?? null,
        extraKmPrice: r.delivery?.pricing?.extraKmPrice ?? null,
        maxPrice: r.delivery?.pricing?.maxPrice ?? null,

        deliveryMin: r.deliveryMin ?? 25,
        deliveryMax: r.deliveryMax ?? 40,
        deliveryFee: r.deliveryFee ?? null,
        deliveryMarkupPercent: r.deliveryMarkupPercent ?? 0,
        freeDeliveryThreshold: r.freeDeliveryThreshold ?? null,
        minOrderAmount: r.minOrderAmount ?? null,

        pickupEnabled: r.pickupEnabled ?? false,
        pickupDiscountPercent: r.pickupDiscountPercent ?? null,
        prepMinutes: r.prepMinutes ?? 20,

        reservationEnabled: r.reservationEnabled ?? false,
        reservationNote: r.reservationNote || '',
      }))
      .catch(() => setMsg({ type: 'err', text: 'Ma\u2018lumot yuklanmadi' }));
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      // Bo'sh raqamlar 0 sifatida yuboriladi
      const {
        deliveryType, maxDistanceKm, freeKm, basePrice,
        extraKmPrice, maxPrice, ...rest
      } = form;

      const payload = {
        ...rest,
        delivery: {
          type: deliveryType,
          maxDistanceKm: Number(maxDistanceKm) || 0,
          pricing: {
            freeKm: Number(freeKm) || 0,
            basePrice: Number(basePrice) || 0,
            extraKmPrice: Number(extraKmPrice) || 0,
            maxPrice: Number(maxPrice) || 0,
          },
        },
      };
      for (const k of ['deliveryFee', 'freeDeliveryThreshold', 'minOrderAmount',
                       'pickupDiscountPercent', 'deliveryMarkupPercent']) {
        if (payload[k] == null || payload[k] === '') payload[k] = 0;
      }
      await panelApi.updateProfile(payload);
      setMsg({ type: 'ok', text: 'Saqlandi' });
      setTimeout(() => setMsg(null), 2500);
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return <div className="p-6 text-muted">Yuklanmoqda...</div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl">
      <h1 className="text-xl font-semibold text-ink mb-1">Muassasa ma'lumotlari</h1>
      <p className="text-sm text-muted mb-5">
        Mijozlar ilovasida shu ma'lumotlar ko'rinadi
      </p>

      <div className="space-y-4">
        {/* Asosiy */}
        <Section title="Asosiy" icon="ti-building-store">
          <Field label="Nomi *">
            <input value={form.name} onChange={(e) => set('name', e.target.value)} className="inp" />
          </Field>

          <Field label="Yo'nalish" hint="Mijozga nom ostida ko'rinadi">
            <input
              value={form.cuisine}
              onChange={(e) => set('cuisine', e.target.value)}
              placeholder="Milliy taomlar, Fast food..."
              className="inp"
            />
          </Field>

          <Field label="Tavsif">
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              placeholder="Muassasa haqida qisqacha"
              className="inp resize-none"
            />
          </Field>

          <Field label="Telefon">
            <input
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="+998 90 123 45 67"
              className="inp"
            />
          </Field>
        </Section>

        {/* Joylashuv */}
        <Section title="Joylashuv" icon="ti-map-pin">
          <div className="flex justify-end -mt-2 mb-2">
            <button
              type="button"
              onClick={() => setMapOpen(true)}
              className="text-sm px-3 py-1.5 rounded-lg bg-brand-400 text-brand-text hover:bg-brand-600 hover:text-white"
            >
              <i className="ti ti-map-pin" /> Xaritadan
            </button>
          </div>

          <Field label="Manzil">
            <input value={form.address} onChange={(e) => set('address', e.target.value)} className="inp" />
          </Field>

          <Field label="Mo'ljal">
            <input
              value={form.landmark}
              onChange={(e) => set('landmark', e.target.value)}
              placeholder="Metro yonida, 2-qavat"
              className="inp"
            />
          </Field>

          {form.lat && form.lng ? (
            <div className="flex items-center justify-between gap-3 bg-canvas rounded-lg px-3 py-2.5">
              <div className="min-w-0">
                <div className="text-xs text-muted">Koordinata</div>
                <div className="text-sm font-mono text-ink">
                  {Number(form.lat).toFixed(6)}, {Number(form.lng).toFixed(6)}
                </div>
              </div>
              <a
                href={`https://yandex.uz/maps/?pt=${form.lng},${form.lat}&z=17&l=map`}
                target="_blank" rel="noreferrer"
                className="text-xs text-brand-600 hover:underline flex-none"
              >
                Ko'rish
              </a>
            </div>
          ) : (
            <div className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              Koordinata yo'q — kuryer manzilni topishi qiyin bo'ladi
            </div>
          )}
        </Section>

        {/* Ish vaqti */}
        <Section title="Ish vaqti" icon="ti-clock">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ochilish">
              <input
                type="time"
                value={form.openTime}
                onChange={(e) => set('openTime', e.target.value)}
                className="inp"
              />
            </Field>
            <Field label="Yopilish">
              <input
                type="time"
                value={form.closeTime}
                onChange={(e) => set('closeTime', e.target.value)}
                className="inp"
              />
            </Field>
          </div>
          <p className="text-xs text-muted">
            Mijozlar ilovasida "Ochiq" yoki "Yopiq" deb ko'rsatiladi
          </p>

          <Field label="Ish kunlari" hint="Tanlanmasa har kuni ishlaydi">
            <div className="flex flex-wrap gap-1.5">
              {[
                ['mon', 'Du'], ['tue', 'Se'], ['wed', 'Ch'], ['thu', 'Pa'],
                ['fri', 'Ju'], ['sat', 'Sh'], ['sun', 'Ya'],
              ].map(([k, label]) => (
                <button key={k} type="button"
                  onClick={() => set('workingDays',
                    form.workingDays.includes(k)
                      ? form.workingDays.filter((d) => d !== k)
                      : [...form.workingDays, k])}
                  className={`w-11 py-2 rounded-lg text-sm border ${
                    form.workingDays.includes(k)
                      ? 'border-brand-400 bg-brand-50 text-brand-600'
                      : 'border-line text-muted'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </Field>

          <div className="text-xs text-muted bg-canvas rounded-lg p-3 leading-relaxed">
            Vaqt <b className="text-ink">O'zbekiston</b> bo'yicha hisoblanadi.
            Mijoz boshqa davlatdan kirsa ham holat to'g'ri ko'rsatiladi.
          </div>
        </Section>

        {/* Yetkazish qoidalari */}
        <Section title="Yetkazish qoidalari" icon="ti-route">
          {/*
            Yetkazish ustamasi: yetkazishda taom narxi shu foizga
            oshadi. Zal va bronda narx o'zgarmaydi.
          */}
          <Field
            label="Yetkazish uchun narx ustamasi"
            hint="Yetkazishda taom narxi shu foizga oshadi. Zal va bronda narx o'zgarmaydi."
          >
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2, 3, 5, 7, 10].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => set('deliveryMarkupPercent', p)}
                  className={`min-w-[52px] rounded-lg border px-3 py-2 text-sm font-medium ${
                    Number(form.deliveryMarkupPercent) === p
                      ? 'border-brand-400 bg-brand-400/15 text-brand-600'
                      : 'border-line text-muted hover:bg-canvas'
                  }`}
                >
                  {p}%
                </button>
              ))}
              <input
                type="number" min="0" max="100" step="0.5"
                value={form.deliveryMarkupPercent ?? 0}
                onChange={(e) => set('deliveryMarkupPercent', e.target.value)}
                className="w-20 rounded-lg border border-line bg-canvas px-3 py-2 text-sm"
                placeholder="Boshqa"
              />
            </div>

            {Number(form.deliveryMarkupPercent) > 0 && (
              <div className="mt-2 rounded-lg bg-canvas px-3 py-2 text-xs text-muted">
                Zalda <b className="text-ink">10 000</b> so&apos;m bo&apos;lgan taom
                yetkazishda{' '}
                <b className="text-brand-600">
                  {Math.round(10000 * (1 + Number(form.deliveryMarkupPercent) / 100))
                    .toLocaleString('ru-RU')}
                </b>{' '}
                so&apos;m ko&apos;rinadi
              </div>
            )}
          </Field>

          <Field label="Yetkazish turi">
            <div className="grid grid-cols-3 gap-2">
              {[
                ['free', 'Bepul'],
                ['paid', 'Masofaga qarab'],
                ['disabled', "Yo'q"],
              ].map(([k, label]) => (
                <button key={k} type="button"
                  onClick={() => set('deliveryType', k)}
                  className={`py-2.5 rounded-xl text-sm border ${
                    form.deliveryType === k
                      ? 'border-brand-400 bg-brand-50 text-brand-600'
                      : 'border-line text-muted'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </Field>

          {form.deliveryType !== 'disabled' && (
            <Field label="Yetkazish radiusi" hint="Undan uzoqqa buyurtma qabul qilinmaydi">
              <NumberInput value={form.maxDistanceKm}
                onChange={(v) => set('maxDistanceKm', v)}
                suffix="km" placeholder="10" />
            </Field>
          )}

          {form.deliveryType === 'paid' && (
            <>
              <Field label="Bepul masofa" hint="Shu masofagacha bepul">
                <NumberInput value={form.freeKm}
                  onChange={(v) => set('freeKm', v)} suffix="km" placeholder="3" />
              </Field>

              <Field label="Boshlang'ich narx" hint="Har buyurtmaga qo'shiladi">
                <MoneyInput value={form.basePrice}
                  onChange={(v) => set('basePrice', v)} />
              </Field>

              <Field label="Har km uchun" hint="Bepul masofadan keyin">
                <MoneyInput value={form.extraKmPrice}
                  onChange={(v) => set('extraKmPrice', v)} placeholder="3 000" />
              </Field>

              <Field label="Eng ko'p narx" hint="Bo'sh = cheklovsiz">
                <MoneyInput value={form.maxPrice}
                  onChange={(v) => set('maxPrice', v)} />
              </Field>

              {/* Misol */}
              <div className="text-xs bg-canvas rounded-lg p-3 leading-relaxed">
                <div className="font-medium text-ink mb-1">Misol: 5 km masofa</div>
                <div className="text-muted">
                  {Number(form.freeKm) > 0 && (
                    <>Birinchi {form.freeKm} km — bepul<br /></>
                  )}
                  {Math.max(0, 5 - (Number(form.freeKm) || 0)) > 0 && (
                    <>
                      Qolgan {Math.max(0, 5 - (Number(form.freeKm) || 0))} km ×{' '}
                      {(Number(form.extraKmPrice) || 0).toLocaleString('ru-RU')}<br />
                    </>
                  )}
                  <b className="text-ink">
                    Jami:{' '}
                    {(
                      (Number(form.basePrice) || 0)
                      + Math.ceil(Math.max(0, 5 - (Number(form.freeKm) || 0)))
                        * (Number(form.extraKmPrice) || 0)
                    ).toLocaleString('ru-RU')} so'm
                  </b>
                </div>
              </div>

              <div className="text-[11px] text-muted leading-relaxed">
                Masofa Yandex xaritasi orqali haqiqiy yo'l bo'yicha
                hisoblanadi — to'g'ri chiziq emas.
              </div>
            </>
          )}
        </Section>

        {/* Yetkazish */}
        <Section title="Yetkazib berish" icon="ti-truck-delivery">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Eng kam vaqt">
              <NumberInput
                value={form.deliveryMin}
                onChange={(v) => set('deliveryMin', v)}
                suffix="daq" placeholder="25"
              />
            </Field>
            <Field label="Eng ko'p vaqt">
              <NumberInput
                value={form.deliveryMax}
                onChange={(v) => set('deliveryMax', v)}
                suffix="daq" placeholder="40"
              />
            </Field>
          </div>

          <Field label="Yetkazish narxi" hint="Bo'sh yoki 0 = bepul">
            <MoneyInput value={form.deliveryFee} onChange={(v) => set('deliveryFee', v)} />
          </Field>

          <Field label="Bepul yetkazish chegarasi" hint="Shu summadan boshlab bepul">
            <MoneyInput
              value={form.freeDeliveryThreshold}
              onChange={(v) => set('freeDeliveryThreshold', v)}
            />
          </Field>

          <Field label="Minimal buyurtma" hint="Shu summadan kam bo'lsa buyurtma berilmaydi">
            <MoneyInput value={form.minOrderAmount} onChange={(v) => set('minOrderAmount', v)} />
          </Field>
        </Section>

        {/* Olib ketish */}
        <Section title="O'zi olib ketish" icon="ti-shopping-bag">
          <Toggle
            checked={form.pickupEnabled}
            onChange={(v) => set('pickupEnabled', v)}
            label="Olib ketish mumkin"
            hint="Mijoz o'zi kelib oladi, yetkazish haqi olinmaydi"
          />

          {form.pickupEnabled && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Field label="Tayyorlash vaqti">
                <NumberInput
                  value={form.prepMinutes}
                  onChange={(v) => set('prepMinutes', v)}
                  suffix="daq" placeholder="20"
                />
              </Field>
              <Field label="Chegirma">
                <NumberInput
                  value={form.pickupDiscountPercent}
                  onChange={(v) => set('pickupDiscountPercent', v)}
                  suffix="%" placeholder="0"
                />
              </Field>
            </div>
          )}
        </Section>

        {/* Bron */}
        <Section title="Stol bron qilish" icon="ti-calendar-plus">
          <Toggle
            checked={form.reservationEnabled}
            onChange={(v) => set('reservationEnabled', v)}
            label="Bron qabul qilinadi"
            hint="Mijoz oldindan stol band qila oladi"
          />

          {form.reservationEnabled && (
            <Field label="Shartlar" hint="Mijozga bron oynasida ko'rsatiladi">
              <textarea
                value={form.reservationNote}
                onChange={(e) => set('reservationNote', e.target.value)}
                rows={2}
                placeholder="Bron 30 daqiqa saqlanadi"
                className="inp resize-none mt-3"
              />
            </Field>
          )}
        </Section>
      </div>

      {msg && (
        <div className={`mt-4 text-sm rounded-lg px-3 py-2 ${
          msg.type === 'ok'
            ? 'bg-green-50 text-green-700'
            : 'bg-red-50 text-red-600'
        }`}>
          {msg.text}
        </div>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="w-full mt-4 bg-brand-400 text-brand-text font-medium py-3 rounded-xl hover:bg-brand-600 hover:text-white disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saqlanmoqda...' : 'Saqlash'}
      </button>

      {mapOpen && (
        <MapPicker
          lat={form.lat}
          lng={form.lng}
          address={form.address}
          onPick={({ lat, lng, address }) => {
            set('lat', lat);
            set('lng', lng);
            if (address && !form.address?.trim()) set('address', address);
          }}
          onClose={() => setMapOpen(false)}
        />
      )}
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <section className="bg-surface border border-line rounded-2xl p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
        <i className={`ti ${icon} text-brand-600`} /> {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted mt-1">{hint}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer">
      <div className="min-w-0">
        <div className="text-sm text-ink">{label}</div>
        {hint && <div className="text-xs text-muted mt-0.5">{hint}</div>}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5 accent-brand-400 flex-none mt-0.5"
      />
    </label>
  );
}
