import { useEffect, useRef, useState } from 'react';
import { adminApi } from '@/api';
import { DISTRICT_BOUNDARIES_UI } from '@/lib/districtFlags';

/*
 * ═══ KATALOG HUDUDI: "Restoran joylashgan tuman" + "Xizmat ko'rsatadigan tumanlar" ═══
 *
 * KURYER TUMANI EMAS (u DistrictPicker'da, avvalgidek). Bu — mijoz katalogida restoran qaysi tumanlarda ko'rinadi.
 *   • Joylashgan tuman — server lat/lng'dan aniqlaydi (bu yerda faqat ko'rsatiladi; admin yozolmaydi).
 *   • Xizmat hududi — admin qo'shimcha tumanlar tanlaydi; o'z tumani har doim ichida (o'chirib bo'lmaydi).
 *   • Aniqlanmasa (qamrovdan tashqari / chegarada / koordinata yo'q) — aniq sabab; katalog filtri yoqilgan bo'lsa
 *     restoran faollashtirilmaydi (server ham tekshiradi).
 * Flag o'chiq (VITE_DISTRICT_BOUNDARIES_ENABLED) yoki server o'chiq — hech narsa chizilmaydi.
 */
const REASON = {
  OUTSIDE_COVERAGE: 'Nuqta Namangan viloyati tumanlari chegarasidan tashqarida',
  BOUNDARY_UNCERTAIN: 'Nuqta ikki tuman chegarasida — aniqlab bo‘lmadi',
  NO_COORDINATES: 'Xaritada joylashuv belgilanmagan',
  INVALID_COORDINATES: 'Koordinata noto‘g‘ri',
  UNAVAILABLE: 'Tuman aniqlash xizmati vaqtincha ishlamayapti',
};
export const reasonText = (r) => REASON[r] || r || '';

export function ServiceAreaPicker({ lat, lng, value, onChange, disabled = false, previewOverride = null }) {
  const [info, setInfo] = useState(null);       // { enabled, catalogFilterEnabled, supported:[{id,name}], result }
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!DISTRICT_BOUNDARIES_UI) return undefined;
    const my = ++seq.current;
    setLoading(true);
    const t = setTimeout(() => {
      adminApi.districtPreview(lat ?? '', lng ?? '')
        .then((r) => { if (my === seq.current) setInfo(r); })
        .catch(() => { if (my === seq.current) setInfo(null); })
        .finally(() => { if (my === seq.current) setLoading(false); });
    }, 350);
    return () => clearTimeout(t);
  }, [lat, lng]);

  if (!DISTRICT_BOUNDARIES_UI || !info?.enabled) return null;

  const hasCoords = String(lat ?? '').trim() !== '' && String(lng ?? '').trim() !== '';
  const own = previewOverride || (info.result?.matched ? info.result.districtId : null);
  const ownName = info.supported.find((d) => d.id === own)?.name || own;
  const reason = !hasCoords ? 'NO_COORDINATES' : (info.result && !info.result.matched ? info.result.reason : null);
  const selected = new Set([...(value || []), ...(own ? [own] : [])]);
  const toggle = (id) => {
    if (disabled || id === own) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(info.supported.map((d) => d.id).filter((x) => next.has(x)));
  };

  return (
    <div className="mt-4 pt-4 border-t border-line" data-testid="service-area-picker">
      <div className="text-sm font-medium text-ink">Katalog hududi</div>
      <p className="text-xs text-muted mt-0.5 mb-3">Mijoz ilovasida restoran qaysi tuman ro‘yxatida ko‘rinadi. Kuryer tumani bu emas.</p>

      <div className="rounded-xl bg-canvas px-3 py-2 text-sm flex items-center gap-2" aria-live="polite">
        <i className="ti ti-map-pin text-brand-600" />
        <span className="text-muted">Restoran joylashgan tuman:</span>
        {loading ? <span className="text-muted">aniqlanmoqda…</span>
          : own ? <b className="text-ink">{ownName}</b>
            : <span className="text-red-600">aniqlanmadi</span>}
      </div>
      {!loading && !own && reason && (
        <div className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600" role="alert">
          {reasonText(reason)}.{info.catalogFilterEnabled ? ' Bu holatda restoran faollashtirilmaydi — xaritadagi nuqtani tekshiring.' : ''}
        </div>
      )}

      <div className="mt-3 text-xs font-medium text-ink mb-1.5">Xizmat ko‘rsatadigan tumanlar</div>
      <div className="flex flex-wrap gap-1.5">
        {info.supported.map((d) => {
          const on = selected.has(d.id);
          const locked = d.id === own;
          return (
            <button
              key={d.id} type="button" disabled={disabled || locked} onClick={() => toggle(d.id)} aria-pressed={on}
              title={locked ? 'Restoranning o‘z tumani — har doim ichida' : undefined}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${on ? 'border-brand-400 bg-brand-tint text-brand-600' : 'border-line bg-surface text-ink hover:bg-canvas'} ${locked ? 'cursor-default' : ''}`}
            >
              {on && <i className={`ti ${locked ? 'ti-lock' : 'ti-check'} mr-1`} />}{d.name}
            </button>
          );
        })}
      </div>
      {info.noBoundary?.length > 0 && (
        <p className="mt-2 text-[11px] text-muted">Davlatobod va Yangi Namangan chegarasi manbada yo‘q — ular Namangan shahri tarkibida hisoblanadi.</p>
      )}
    </div>
  );
}
