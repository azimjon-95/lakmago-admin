import { useState } from 'react';
import { adminApi } from '@/api';
import { useAuth } from '@/store/auth';
import { ServiceAreaPicker, reasonText } from '@/components/delivery/ServiceAreaPicker';
import { DISTRICT_BOUNDARIES_UI } from '@/lib/districtFlags';

/**
 * ═══ KATALOG HUDUDI (restoran sozlamalari) — o'z "Saqlash" tugmasi bilan ═══
 * Restoranning joylashgan tumani serverda koordinatadan aniqlanadi (asosiy formadagi lat/lng saqlanganda qayta hisoblanadi).
 * Bu yerda: xizmat ko'rsatadigan qo'shimcha tumanlar (xodim) va qo'lda almashtirish (faqat bosh admin, sabab bilan, audit).
 * Kuryer tumani — pastdagi "Hudud va yetkazish" bo'limida (o'zgarmagan).
 */
export function RestaurantServiceAreaSection({ restaurant, onUpdated }) {
  const isAdmin = useAuth((s) => s.user?.role === 'admin');
  const [area, setArea] = useState(restaurant?.serviceAreaDistrictIds || []);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [ovDistrict, setOvDistrict] = useState(restaurant?.serviceDistrictOverride?.districtId || '');
  const [ovReason, setOvReason] = useState('');
  if (!DISTRICT_BOUNDARIES_UI || !restaurant) return null;

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const r = await adminApi.updateRestaurant(restaurant._id, { serviceAreaDistrictIds: area });
      setArea(r?.serviceAreaDistrictIds || area);
      onUpdated?.(r);
      setMsg({ type: 'ok', text: 'Saqlandi.' });
    } catch (e) { setMsg({ type: 'err', text: e?.message || 'Saqlanmadi' }); }
    setSaving(false);
  };
  const override = async (districtId) => {
    if (ovReason.trim().length < 5) { setMsg({ type: 'err', text: 'Sababni yozing (kamida 5 belgi)' }); return; }
    setSaving(true); setMsg(null);
    try {
      const r = await adminApi.setServiceDistrictOverride(restaurant._id, districtId || null, ovReason.trim());
      setArea(r?.serviceAreaDistrictIds || area);
      onUpdated?.(r);
      setOvReason('');
      setMsg({ type: 'ok', text: districtId ? 'Tuman qo‘lda belgilandi (audit yozildi).' : 'Qo‘lda belgilash bekor qilindi — koordinatadan aniqlanadi.' });
    } catch (e) { setMsg({ type: 'err', text: e?.message || 'Saqlanmadi' }); }
    setSaving(false);
  };

  const ov = restaurant.serviceDistrictOverride;
  return (
    <section className="bg-surface border border-line rounded-2xl p-5" data-testid="restaurant-service-area-section">
      <h2 className="text-sm font-semibold text-ink mb-1 flex items-center gap-2">
        <i className="ti ti-map-2 text-brand-600" /> Katalog hududi
      </h2>
      {restaurant.districtResolveReason && !restaurant.serviceDistrictId && (
        <div className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">Saqlangan holat: tuman aniqlanmagan — {reasonText(restaurant.districtResolveReason)}.</div>
      )}
      <ServiceAreaPicker lat={restaurant.lat} lng={restaurant.lng} value={area} onChange={setArea} previewOverride={ov?.districtId || null} />
      <div className="mt-3 flex items-center gap-3">
        <button type="button" onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-brand-400 text-brand-text text-sm font-medium disabled:opacity-60">Saqlash</button>
        {msg && <span className={`text-xs ${msg.type === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</span>}
      </div>

      {isAdmin && (
        <details className="mt-4 rounded-xl border border-line p-3">
          <summary className="text-xs font-medium text-ink cursor-pointer">Qo‘lda belgilash (faqat bosh admin, audit yoziladi)</summary>
          {ov && <p className="mt-2 text-xs text-muted">Hozir qo‘lda: <b>{ov.districtId}</b> — {ov.reason}</p>}
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_2fr_auto_auto]">
            <select value={ovDistrict} onChange={(e) => setOvDistrict(e.target.value)} className="rounded-lg border border-line px-2 py-1.5 text-sm">
              <option value="">— tuman —</option>
              {['namangan_sh', 'davlatobod', 'yangi_namangan', 'pop', 'chust', 'kosonsoy', 'mingbuloq', 'namangan_t', 'norin', 'toraqorgon', 'uychi', 'uchqorgon', 'chortoq', 'yangiqorgon'].map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
            <input value={ovReason} onChange={(e) => setOvReason(e.target.value)} placeholder="Sabab (majburiy)" className="rounded-lg border border-line px-2 py-1.5 text-sm" />
            <button type="button" disabled={saving || !ovDistrict} onClick={() => override(ovDistrict)} className="px-3 py-1.5 rounded-lg border border-line text-sm">Belgilash</button>
            {ov && <button type="button" disabled={saving} onClick={() => override(null)} className="px-3 py-1.5 rounded-lg border border-line text-sm text-red-600">Bekor qilish</button>}
          </div>
        </details>
      )}
    </section>
  );
}
