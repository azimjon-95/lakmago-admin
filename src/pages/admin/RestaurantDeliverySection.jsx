import { useEffect, useState } from 'react';
import { adminApi } from '@/api';
import { useAuth } from '@/store/auth';
import { DistrictPicker } from '@/components/delivery/DistrictPicker';
import { COURIER_MODES, DEFAULT_DISTRICT } from '@/components/delivery/districts';

/**
 * ═══ HUDUD va KIM YETKAZADI ═══ (restoran sozlamalari ichida, o'z "Saqlash" tugmasi bilan)
 *
 * • Tuman — restoranlar bo'limi xodimi ham o'zgartiradi (kuryerlar shu bo'yicha ishlaydi).
 * • Rejim / tekin yetkazish / LokmaGo foizi — FAQAT bosh admin (pulga ta'sir qiladi; server ham shuni tekshiradi).
 * Rejim o'zgarishi faqat YANGI buyurtmalarga ta'sir qiladi — mavjudlari o'z hisobi bilan qoladi.
 */
export function RestaurantDeliverySection({ restaurant }) {
  const isAdmin = useAuth((s) => s.user?.role === 'admin');
  const [district, setDistrict] = useState(restaurant?.district || DEFAULT_DISTRICT);
  const [mode, setMode] = useState(restaurant?.courierMode || 'own');
  const [free, setFree] = useState(Boolean(restaurant?.lokmaFreeDelivery));
  const [percent, setPercent] = useState(restaurant?.lokmaCourierPercent ?? '');
  const [globalPercent, setGlobalPercent] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!isAdmin) return;
    adminApi.getCourierSettings().then((s) => setGlobalPercent(s.commissionPercent)).catch(() => {});
  }, [isAdmin]);

  const percentValue = percent === '' || percent === null ? null : Number(percent);
  const percentBad = percentValue !== null && (!Number.isFinite(percentValue) || percentValue < 0 || percentValue > 100);

  const save = async () => {
    if (percentBad) { setMsg({ type: 'err', text: 'Foiz 0 dan 100 gacha bo‘lsin' }); return; }
    setSaving(true); setMsg(null);
    try {
      if (isAdmin) {
        await adminApi.updateRestaurantCourierSettings(restaurant._id, { district, courierMode: mode, lokmaFreeDelivery: free, lokmaCourierPercent: percentValue });
      } else {
        await adminApi.updateRestaurantDistrict(restaurant._id, district);
      }
      setMsg({ type: 'ok', text: 'Saqlandi. Yangi buyurtmalar shu sozlama bilan ishlaydi.' });
    } catch (e) {
      setMsg({ type: 'err', text: e?.message || 'Saqlanmadi' });
    } finally {
      setSaving(false);
    }
  };

  const effectivePercent = percentValue ?? globalPercent;
  return (
    <section className="bg-surface border border-line rounded-2xl p-5" data-testid="restaurant-delivery-section">
      <h2 className="text-sm font-semibold text-ink mb-1 flex items-center gap-2">
        <i className="ti ti-motorbike text-brand-600" /> Hudud va yetkazish
      </h2>
      <p className="text-xs text-muted mb-4">Restoran qaysi tumanda va buyurtmani kim yetkazadi</p>

      <div className="mb-5">
        <div className="text-sm font-medium text-ink mb-2">Tuman</div>
        <DistrictPicker value={district} onChange={setDistrict} />
      </div>

      <div className="mb-4">
        <div className="text-sm font-medium text-ink mb-2 flex items-center gap-2">
          Kim yetkazadi
          {!isAdmin && <span className="text-[11px] font-normal text-muted">(faqat bosh admin o‘zgartiradi)</span>}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {COURIER_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={!isAdmin}
              onClick={() => setMode(m.id)}
              aria-pressed={mode === m.id}
              className={`rounded-xl border p-3 text-left transition ${mode === m.id ? 'border-brand-400 bg-brand-tint' : 'border-line hover:bg-canvas'} ${!isAdmin ? 'opacity-60' : ''}`}
            >
              <div className="text-sm font-semibold text-ink">{m.title}</div>
              <div className="mt-1 text-[11px] leading-snug text-muted">{m.hint}</div>
            </button>
          ))}
        </div>
      </div>

      {mode !== 'own' && (
        <div className="grid gap-4 sm:grid-cols-2 rounded-xl bg-canvas p-4">
          <label className={`flex items-start gap-3 ${mode !== 'lokma' || !isAdmin ? 'opacity-60' : ''}`}>
            <input
              type="checkbox"
              className="mt-1"
              checked={free && mode === 'lokma'}
              disabled={mode !== 'lokma' || !isAdmin}
              onChange={(e) => setFree(e.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium text-ink">Tekin yetkazish (LokmaGo hisobidan)</span>
              <span className="block text-[11px] text-muted">
                Mijozdan yetkazish puli olinmaydi, kuryer ulushini LokmaGo to‘laydi.
                {mode !== 'lokma' && ' Faqat «LokmaGo kuryeri» rejimida ishlaydi.'}
              </span>
            </span>
          </label>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">LokmaGo foizi (yetkazishdan)</label>
            <div className="flex items-center gap-2">
              <input
                type="number" min="0" max="100" step="0.5" inputMode="decimal"
                disabled={!isAdmin}
                value={percent ?? ''}
                placeholder={globalPercent !== null ? `${globalPercent} (umumiy)` : 'umumiy'}
                onChange={(e) => setPercent(e.target.value)}
                className={`w-28 rounded-lg border px-3 py-2 text-sm ${percentBad ? 'border-red-400' : 'border-line'}`}
              />
              <span className="text-sm text-muted">%</span>
            </div>
            <p className="text-[11px] text-muted mt-1">
              Bo‘sh — umumiy foiz{globalPercent !== null ? ` (${globalPercent}%)` : ''}.
              {Number.isFinite(effectivePercent) && ` Masalan 30 000 so‘mdan kuryerga ${Math.round(30000 * (1 - effectivePercent / 100)).toLocaleString('ru-RU')} so‘m.`}
            </p>
          </div>
        </div>
      )}

      {msg && <div className={`mt-4 text-sm rounded-xl px-4 py-3 ${msg.type === 'ok' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>{msg.text}</div>}
      <div className="mt-4 flex justify-end">
        <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-brand-text disabled:opacity-60">
          {saving ? 'Saqlanmoqda…' : 'Saqlash'}
        </button>
      </div>
    </section>
  );
}
