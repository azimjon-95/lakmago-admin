import { useState } from 'react';
import {
  customerOf, formatPhone, telHref, validCoords, mapLinks, coordsText,
  paymentInfo, cancelInfo, orderTag, hhmm, FULFILLMENT,
} from '@/lib/orderInfo';

/*
 * Bekor qilingan buyurtmaning to'liq ma'lumoti — ixcham, kartaning ichida:
 *   mijoz · @username · telefon
 *   manzil + [Xaritada] + koordinata (nusxalanadi)
 *   yetkazish turi · to'lov turi (onlayn to'langan bo'lsa belgi)
 *   ❌ Sabab (yo'q bo'lsa: "ko'rsatilmagan")
 */
export function CancelledOrderInfo({ order }) {
  const [copied, setCopied] = useState(false);
  const c = customerOf(order);
  const pay = paymentInfo(order);
  const cancel = cancelInfo(order);
  const hasCoords = validCoords(order.addressLat, order.addressLng);
  const links = hasCoords ? mapLinks(order.addressLat, order.addressLng) : null;
  const delivery = order.fulfillment !== 'pickup' && order.fulfillment !== 'dinein';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(coordsText(order.addressLat, order.addressLng));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard ruxsati yo'q — havola baribir ishlaydi */ }
  };

  return (
    <div className="mt-2 space-y-1.5 border-t border-black/[0.05] pl-1.5 pt-2 text-[11.5px] leading-snug" data-testid="cancelled-info">
      {/* Mijoz */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
        <span className="flex items-center gap-1 font-semibold text-ink">
          <i className="ti ti-user text-[12px] text-muted" />{c.name}
        </span>
        {c.username ? (
          <a href={`https://t.me/${c.username}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sky-700">
            <i className="ti ti-brand-telegram text-[12px]" />@{c.username}
          </a>
        ) : (
          <span className="flex items-center gap-1 text-muted"><i className="ti ti-brand-telegram text-[12px]" />username yo‘q</span>
        )}
        {c.phone ? (
          <a href={telHref(c.phone)} className="flex items-center gap-1 tabular-nums text-ink">
            <i className="ti ti-phone text-[12px] text-muted" />{formatPhone(c.phone)}
          </a>
        ) : (
          <span className="flex items-center gap-1 text-muted"><i className="ti ti-phone text-[12px]" />telefon yo‘q</span>
        )}
      </div>

      {/* Manzil */}
      {delivery ? (
        <div className="text-muted">
          <div className="flex items-start gap-1.5">
            <i className="ti ti-map-pin mt-[2px] flex-none text-[12px]" />
            <span className="break-words text-ink">{order.address || 'Manzil ko‘rsatilmagan'}</span>
          </div>
          {order.addressNote && (
            <div className="ml-[18px] mt-0.5 italic">Izoh: {order.addressNote}</div>
          )}
          <div className="ml-[18px] mt-1 flex flex-wrap items-center gap-1.5">
            {hasCoords ? (
              <>
                <a href={links.yandex} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-[3px] font-semibold text-sky-700">
                  <i className="ti ti-map-2 text-[12px]" />Xaritada ochish
                </a>
                <button type="button" onClick={copy}
                  className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] px-2 py-[3px] tabular-nums text-muted"
                  title="Koordinatani nusxalash">
                  <i className={`ti ${copied ? 'ti-check' : 'ti-copy'} text-[11px]`} />
                  {copied ? 'Nusxalandi' : coordsText(order.addressLat, order.addressLng)}
                </button>
              </>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-[3px] text-amber-700">
                <i className="ti ti-map-off text-[12px]" />Koordinata yo‘q
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-muted">
          <i className="ti ti-building-store text-[12px]" />{FULFILLMENT[order.fulfillment] || 'Olib ketish'} — manzil yo‘q
        </div>
      )}

      {/* Yetkazish turi · to'lov */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-black/[0.05] px-2 py-[2px] font-medium text-ink">
          {FULFILLMENT[order.fulfillment] || 'Yetkazish'}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.05] px-2 py-[2px] font-medium text-ink">
          <i className={`ti ${pay.online ? 'ti-credit-card' : 'ti-cash'} text-[12px] text-muted`} />{pay.label}
        </span>
        {pay.online && pay.paid && (
          <span className="rounded-full bg-amber-50 px-2 py-[2px] font-semibold text-amber-700" title="Onlayn to‘lov tushgan edi">
            to‘langan
          </span>
        )}
      </div>

      {/* Sabab */}
      <div className="flex items-start gap-1.5 rounded-lg bg-red-50 px-2 py-1.5 text-red-700">
        <i className="ti ti-circle-x mt-[1px] flex-none text-[13px]" />
        <span className="min-w-0 flex-1 break-words">
          <b>Sabab:</b> {cancel.reason || <span className="opacity-70">ko‘rsatilmagan</span>}
        </span>
        {cancel.at && <span className="flex-none tabular-nums opacity-80">{hhmm(cancel.at)}</span>}
      </div>

      <div className="text-[10.5px] tabular-nums text-muted">
        {orderTag(order)} · yaratildi {hhmm(order.createdAt)}{cancel.at ? ` · bekor ${hhmm(cancel.at)}` : ''}
      </div>
    </div>
  );
}
