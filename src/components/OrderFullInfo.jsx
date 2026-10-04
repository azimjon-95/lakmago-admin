import { useState } from 'react';
import {
  customerOf, formatPhone, telHref, validCoords, mapLinks, coordsText,
  paymentInfo, cancelInfo, orderTag, hhmm, FULFILLMENT,
  orderTimeline, minutesBetween, durationText, orderMoney, restaurantSaw,
} from '@/lib/orderInfo';

const som = (n) => Math.round(n ?? 0).toLocaleString('ru-RU').replace(/,/g, ' ');

/*
 * Buyurtmaning TO'LIQ ma'lumoti — har qanday holat uchun (avval faqat bekor
 * qilinganlarda bor edi, endi hammasida bir xil ko'rinadi):
 *   mijoz · @username · telefon
 *   manzil + izoh + [Xaritada] + koordinata (nusxalanadi)
 *   yetkazish turi · to'lov · to'langanmi · rejalashtirilgan vaqt · masofa · kuryer
 *   taom izohlari, narx tarkibi
 *   ❌ Sabab (faqat bekor), ⭐ baho (bo'lsa)
 *   bosqichlar vaqti (yaratildi → qabul → tayyor → yo'lda → yetkazildi/bekor)
 *
 * `compact` — faqat mijoz va manzil (ro'yxatni tez ko'rib chiqish uchun).
 */
export function OrderFullInfo({ order, compact = false }) {
  const [copied, setCopied] = useState(false);
  const c = customerOf(order);
  const pay = paymentInfo(order);
  const cancelled = order.status === 'cancelled';
  const cancel = cancelInfo(order);
  const hasCoords = validCoords(order.addressLat, order.addressLng);
  const links = hasCoords ? mapLinks(order.addressLat, order.addressLng) : null;
  const delivery = order.fulfillment !== 'pickup' && order.fulfillment !== 'dinein';
  const timeline = orderTimeline(order);
  const money = orderMoney(order);
  const notes = (order.items || []).filter((i) => i?.note);
  const endAt = order.deliveredAt || order.cancelledAt;
  const totalMin = endAt ? minutesBetween(order.createdAt, endAt) : null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(coordsText(order.addressLat, order.addressLng));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard ruxsati yo'q — havola baribir ishlaydi */ }
  };

  return (
    <div className="mt-2 space-y-1.5 border-t border-black/[0.05] pl-1.5 pt-2 text-[11.5px] leading-snug"
      data-testid={cancelled ? 'cancelled-info' : 'order-info'}>
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
          {!compact && order.addressNote && (
            <div className="ml-[18px] mt-0.5 italic">Izoh: {order.addressNote}</div>
          )}
          {!compact && (
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
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-muted">
          <i className="ti ti-building-store text-[12px]" />{FULFILLMENT[order.fulfillment] || 'Olib ketish'} — manzil yo‘q
        </div>
      )}

      {!compact && (
        <>
          {/* Yetkazish turi · to'lov · qo'shimcha belgilar */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-black/[0.05] px-2 py-[2px] font-medium text-ink">
              {FULFILLMENT[order.fulfillment] || 'Yetkazish'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.05] px-2 py-[2px] font-medium text-ink">
              <i className={`ti ${pay.online ? 'ti-credit-card' : 'ti-cash'} text-[12px] text-muted`} />{pay.label}
              {order.cardLast4 ? <span className="tabular-nums text-muted">·{order.cardLast4}</span> : null}
            </span>
            {pay.paid ? (
              <span className={`rounded-full px-2 py-[2px] font-semibold ${cancelled ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}
                title={cancelled ? 'Onlayn to‘lov tushgan edi — qaytarishni tekshiring' : 'To‘lov tushgan'}>
                to‘langan{order.paidAt ? ` ${hhmm(order.paidAt)}` : ''}
              </span>
            ) : pay.online && !cancelled ? (
              <span className="rounded-full bg-red-50 px-2 py-[2px] font-semibold text-red-700">to‘lanmagan</span>
            ) : null}
            {!restaurantSaw(order) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.05] px-2 py-[2px] font-semibold text-muted"
                title="Pul yechilmagan — buyurtma restoranga yuborilmagan. To‘lov o‘tsa avtomatik yuboriladi; 24 soatda to‘lanmasa bekor bo‘ladi.">
                <i className="ti ti-eye-off text-[12px]" />restoranga yuborilmagan
              </span>
            )}
            {order.timingMode === 'scheduled' && order.scheduledFor && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-[2px] font-semibold text-violet-700">
                <i className="ti ti-calendar-time text-[12px]" />{hhmm(order.scheduledFor)} ga
              </span>
            )}
            {Number(order.distanceKm) > 0 && (
              <span className="rounded-full bg-black/[0.05] px-2 py-[2px] tabular-nums text-muted">
                {Number(order.distanceKm).toFixed(1)} km
              </span>
            )}
            {/* courierName serverda tasodifiy tanlanadi (haqiqiy kuryer emas) —
                faqat buyurtma haqiqatan yo'lga chiqqanda ko'rsatamiz */}
            {order.courierName && (order.status === 'delivering' || order.status === 'delivered') && (
              <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.05] px-2 py-[2px] text-ink">
                <i className="ti ti-motorbike text-[12px] text-muted" />{order.courierName}
                {order.etaMinutes ? <span className="text-muted">· {order.etaMinutes} daq</span> : null}
              </span>
            )}
          </div>

          {/* Taom izohlari */}
          {notes.length > 0 && (
            <div className="space-y-0.5 rounded-lg bg-amber-50/70 px-2 py-1.5 text-amber-900">
              {notes.map((i, k) => (
                <div key={k} className="flex items-start gap-1.5">
                  <i className="ti ti-message-2 mt-[1px] flex-none text-[12px]" />
                  <span className="break-words"><b>{i.name}:</b> {i.note}</span>
                </div>
              ))}
            </div>
          )}

          {/* Narx tarkibi (bittadan ko'p qator bo'lsa ma'noli) */}
          {money.length > 1 && (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 tabular-nums text-muted">
              {money.map((m) => (
                <span key={m.label}>
                  {m.label} <span className={m.value < 0 ? 'text-emerald-700' : 'text-ink'}>
                    {m.value < 0 ? '−' : ''}{som(Math.abs(m.value))}
                  </span>
                </span>
              ))}
            </div>
          )}

          {/* Sabab — faqat bekor qilinganda */}
          {cancelled && (
            <div className="flex items-start gap-1.5 rounded-lg bg-red-50 px-2 py-1.5 text-red-700">
              <i className="ti ti-circle-x mt-[1px] flex-none text-[13px]" />
              <span className="min-w-0 flex-1 break-words">
                <b>Sabab:</b> {cancel.reason || <span className="opacity-70">ko‘rsatilmagan</span>}
              </span>
              {cancel.at && <span className="flex-none tabular-nums opacity-80">{hhmm(cancel.at)}</span>}
            </div>
          )}

          {/* Baho */}
          {order.rating ? (
            <div className="flex items-start gap-1.5 text-ink">
              <span className="flex-none font-semibold text-amber-600">
                {'★'.repeat(order.rating)}<span className="text-black/15">{'★'.repeat(5 - order.rating)}</span>
              </span>
              {order.comment && <span className="break-words italic text-muted">“{order.comment}”</span>}
            </div>
          ) : null}

          {/* Bosqichlar */}
          <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[10.5px] tabular-nums text-muted">
            <span className="font-semibold text-ink">{orderTag(order)}</span>
            {timeline.map((s) => (
              <span key={s.key} className={s.key === 'cancelled' ? 'text-red-600' : ''}>
                · {s.label.toLowerCase()} {hhmm(s.at)}
              </span>
            ))}
            {totalMin !== null && <span>· jami {durationText(totalMin)}</span>}
          </div>
        </>
      )}
    </div>
  );
}
