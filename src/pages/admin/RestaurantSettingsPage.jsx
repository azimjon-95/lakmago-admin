import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApi } from '@/api';
import { ImageUpload } from '@/components/ImageUpload';

// Restoran sozlamalari — ish tartibi, xizmat haqi, bron.
// Bu ma'lumotlar mijoz ilovasida restoran sahifasida ko'rinadi.
export function RestaurantSettingsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    adminApi.getRestaurants()
      .then((list) => {
        const r = list.find((x) => x._id === id);
        if (r) {
          setForm({
            openTime: r.openTime || '09:00',
            closeTime: r.closeTime || '23:00',
            legalName: r.legalName || '',
            legalAddress: r.legalAddress || '',
            inn: r.inn || '',
            minOrderAmount: r.minOrderAmount || 0,
            serviceFeePercent: r.serviceFeePercent || 0,
            serviceFeeMin: r.serviceFeeMin || 0,
            serviceFeeMax: r.serviceFeeMax || 0,
            reservationEnabled: r.reservationEnabled ?? false,
            reservationNote: r.reservationNote || '',
            name: r.name,
            imageUrl: r.imageUrl || '',
          });
        }
      })
      .catch(() => setMsg({ type: 'err', text: 'Ma\u2018lumot yuklanmadi' }));
  }, [id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const { name, ...rest } = form;
      const payload = { ...rest, images: rest.imageUrl ? [rest.imageUrl] : [] };
      await adminApi.updateRestaurant(id, payload);
      setMsg({ type: 'ok', text: 'Saqlandi' });
      setTimeout(() => setMsg(null), 2500);
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return <div className="flex-1 p-6 text-muted">Yuklanmoqda...</div>;
  }

  return (
    <div className="flex-1 min-w-0 overflow-y-auto">
      <div className="sticky top-0 bg-canvas border-b border-line px-6 py-4 flex items-center gap-3 z-10">
        <button onClick={() => navigate('/restaurants')} className="w-9 h-9 rounded-lg border border-line hover:bg-surface flex items-center justify-center text-muted">
          <i className="ti ti-arrow-left" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-ink">{form.name} — sozlamalar</h1>
          <p className="text-sm text-muted mt-0.5">Ish tartibi, xizmat haqi, stol bron</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6 grid gap-6">
        {/* Muassasa rasmi (banner) */}
        <section className="bg-surface border border-line rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-ink mb-1 flex items-center gap-2">
            <i className="ti ti-photo text-brand-600" /> Muassasa rasmi
          </h2>
          <p className="text-xs text-muted mb-4">Mijoz ilovasida restoran kartasi va sahifasida ko'rinadi</p>
          <ImageUpload
            value={form.imageUrl}
            onChange={(url) => set('imageUrl', url)}
            folder="banners"
            label=""
            aspect="16/9"
          />
        </section>

        {/* Ish tartibi */}
        <section className="bg-surface border border-line rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-ink mb-1 flex items-center gap-2">
            <i className="ti ti-clock text-brand-600" /> Ish tartibi
          </h2>
          <p className="text-xs text-muted mb-4">Mijoz ilovasida "Xabar · ish tartibi" oynasida ko'rinadi</p>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <Field label="Ochilish vaqti" type="time" value={form.openTime} onChange={(v) => set('openTime', v)} />
            <Field label="Yopilish vaqti" type="time" value={form.closeTime} onChange={(v) => set('closeTime', v)} />
          </div>

          <div className="grid gap-4">
            <Field label="Yuridik nom" value={form.legalName} onChange={(v) => set('legalName', v)} placeholder='MCHJ "MAK FOOD SERVIS"' />
            <Field label="Yuridik manzil" value={form.legalAddress} onChange={(v) => set('legalAddress', v)} placeholder="Toshkent, Shayxontohur t., ..." />
            <Field label="INN" value={form.inn} onChange={(v) => set('inn', v)} placeholder="301422146" />
          </div>
        </section>

        {/* Xizmat haqi */}
        <section className="bg-surface border border-line rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-ink mb-1 flex items-center gap-2">
            <i className="ti ti-receipt text-brand-600" /> Xizmat haqi va shartlar
          </h2>
          <p className="text-xs text-muted mb-4">0 qoldirilsa — mijozga "Bepul" deb ko'rsatiladi</p>

          <div className="grid gap-4">
            <NumField label="Minimal buyurtma (so'm)" value={form.minOrderAmount} onChange={(v) => set('minOrderAmount', v)} hint="0 = cheklovsiz" />
            <NumField label="Xizmat haqi (%)" value={form.serviceFeePercent} onChange={(v) => set('serviceFeePercent', v)} hint="Buyurtma summasidan foiz" />
            <div className="grid grid-cols-2 gap-4">
              <NumField label="Eng kam xizmat haqi" value={form.serviceFeeMin} onChange={(v) => set('serviceFeeMin', v)} />
              <NumField label="Eng ko'p xizmat haqi" value={form.serviceFeeMax} onChange={(v) => set('serviceFeeMax', v)} />
            </div>
          </div>

          {form.serviceFeePercent > 0 && form.serviceFeeMin > 0 && form.serviceFeeMax > 0 && (
            <div className="mt-3 text-xs text-muted bg-canvas rounded-lg p-3">
              Mijozga shunday ko'rinadi: "Servis haqi buyurtma summasining {form.serviceFeePercent}% ini
              tashkil etadi, lekin {form.serviceFeeMax.toLocaleString('ru-RU')} so'mdan oshmaydi va{' '}
              {form.serviceFeeMin.toLocaleString('ru-RU')} so'mdan kam bo'lmaydi"
            </div>
          )}
        </section>

        {/* Stol bron qilish */}
        <section className="bg-surface border border-line rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-ink mb-1 flex items-center gap-2">
            <i className="ti ti-calendar-plus text-brand-600" /> Stol bron qilish
          </h2>
          <p className="text-xs text-muted mb-4">Yoqilsa — mijoz restoran sahifasidan stol bron qila oladi</p>

          <label className="flex items-center gap-3 cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={form.reservationEnabled}
              onChange={(e) => set('reservationEnabled', e.target.checked)}
              className="w-4 h-4 accent-brand-400"
            />
            <span className="text-sm text-ink">Stol bron qilishni yoqish</span>
          </label>

          {form.reservationEnabled && (
            <Field
              label="Bron shartlari (ixtiyoriy)"
              value={form.reservationNote}
              onChange={(v) => set('reservationNote', v)}
              placeholder="Kamida 2 soat oldin bron qiling"
            />
          )}
        </section>

        {msg && (
          <div className={`text-sm rounded-xl px-4 py-3 ${msg.type === 'ok' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
            {msg.text}
          </div>
        )}

        <div className="flex gap-3 pb-6">
          <button onClick={() => navigate('/restaurants')} className="px-6 py-3 border border-line text-muted rounded-xl hover:bg-surface">
            Orqaga
          </button>
          <button onClick={save} disabled={saving} className="flex-1 bg-brand-400 text-brand-text font-medium py-3 rounded-xl hover:bg-brand-600 hover:text-white transition-colors disabled:opacity-50">
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
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
        type={type}
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
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-canvas text-ink outline-none focus:border-brand-400 transition-colors"
      />
      {hint && <p className="text-[11px] text-muted mt-1">{hint}</p>}
    </div>
  );
}
