import { fmtMeters } from '@/lib/distance';

/**
 * «Mijoz manzildan uzoqda» — buyurtma berilganda mijoz telefoni yetkazish manzilidan ≥ 500 m uzoqda edi (server: services/deviceCheck.js).
 * Sabab: mijoz saqlangan manzilini unutib, boshqa joyda yurib buyurtma beradi → taom noto'g'ri manzilga boradi → shikoyat.
 *  • tasdiqlanmagan: restoran pishirishdan OLDIN qo'ng'iroq qilib aniqlasin (katta ogohlantirish + qo'ng'iroq tugmasi);
 *  • mijoz o'zi tasdiqlagan ("Ha, u yerda kutib olishadi"): xotirjam eslatma — javobgarlik mijozda.
 * Faqat yetkazishda va buyurtma yakunlanmagan bo'lsa ko'rsatiladi.
 */
export function DeviceFarNote({ order: o }) {
  const dc = o?.deviceCheck;
  if (!dc || dc.status !== 'far' || o.fulfillment === 'pickup' || ['delivered', 'cancelled'].includes(o.status)) return null;
  const d = fmtMeters(dc.distanceM);
  const phone = o.phone || o.customer?.phone || '';
  if (dc.confirmedFar) {
    return (
      <div className="mx-4 mb-3 flex items-start gap-2.5 rounded-xl border border-line bg-canvas px-3.5 py-3 text-xs text-muted" role="note" data-testid="device-far-confirmed">
        <i className="ti ti-info-circle mt-0.5 text-base" />
        <span>Mijoz manzildan <b className="text-ink">{d}</b> uzoqda edi, lekin manzilni <b className="text-ink">o‘zi tasdiqlagan</b>.</span>
      </div>
    );
  }
  return (
    <div className="mx-4 mb-3 rounded-xl border border-red-300 bg-red-50 px-3.5 py-3" role="alert" data-testid="device-far">
      <div className="flex items-center gap-2 text-sm font-bold text-red-700"><i className="ti ti-alert-triangle text-lg" />Mijoz manzildan {d} uzoqda</div>
      <p className="mt-1 text-xs leading-relaxed text-red-800">Buyurtma berganda mijoz yetkazish manzilida emas edi. Pishirishdan oldin qo‘ng‘iroq qilib manzilni aniqlang.</p>
      {phone && (
        <a href={`tel:${phone}`} className="mt-2.5 inline-flex h-10 items-center gap-1.5 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white">
          <i className="ti ti-phone" />Qo‘ng‘iroq qilish
        </a>
      )}
    </div>
  );
}
