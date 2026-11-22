import { useEffect, useState } from 'react';
import { adminApi } from '@/api';
import { DISTRICT_BOUNDARIES_UI } from '@/lib/districtFlags';

/*
 * Banner qaysi tumanlarda ko'rinadi (server: Banner.districtIds, services/bannerDistrict.js).
 *   • Tanlanmasa — banner restoranga bog'langan bo'lsa (havola /restaurant/<id>) o'sha restoran tumanida, aks holda hamma tumanda.
 *   • Tanlansa — faqat tanlangan tumanlarda.
 * Flag o'chiq (VITE_DISTRICT_BOUNDARIES_ENABLED) yoki server chegaralari o'chiq — hech narsa chizilmaydi.
 */
let cache = null;
export function useSupportedDistricts() {
  const [list, setList] = useState(cache || []);
  useEffect(() => {
    if (!DISTRICT_BOUNDARIES_UI || cache) return;
    adminApi.districtPreview('', '')
      .then((r) => { if (r?.enabled && Array.isArray(r.supported)) { cache = r.supported; setList(r.supported); } })
      .catch(() => {});
  }, []);
  return list;
}

export function BannerDistrictPicker({ value, onChange, linkUrl }) {
  const supported = useSupportedDistricts();
  if (!DISTRICT_BOUNDARIES_UI || !supported.length) return null;
  const selected = new Set(value || []);
  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(supported.map((d) => d.id).filter((x) => next.has(x)));
  };
  const linked = /\/restaurant\/[a-f0-9]{24}/i.test(linkUrl || '');
  return (
    <div className="mb-4" data-testid="banner-districts">
      <label className="block text-xs text-muted mb-1">Qaysi tumanlarda ko'rinadi</label>
      <div className="flex flex-wrap gap-1.5">
        {supported.map((d) => (
          <button key={d.id} type="button" onClick={() => toggle(d.id)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              selected.has(d.id) ? 'border-brand-400 bg-brand-100 text-brand-text' : 'border-line text-muted hover:bg-canvas'}`}>
            {d.name}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted mt-1.5">
        {selected.size
          ? 'Faqat tanlangan tumanlardagi mijozlarga ko‘rinadi.'
          : linked
            ? 'Tanlanmagan: banner havolasidagi restoran tumanida ko‘rinadi.'
            : 'Tanlanmagan: hamma tumanda ko‘rinadi.'}
      </p>
    </div>
  );
}
