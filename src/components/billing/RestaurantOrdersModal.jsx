import { useEffect, useState } from 'react';
import { adminApi } from '@/api';
import { buildQuery } from '@/lib/billingPeriod';
import { Sheet } from './Sheet';
import { som, fmtDateTime } from './format';

const FULFILLMENT = { delivery: 'Yetkazish', pickup: 'Olib ketish', dinein: 'Zalda' };

const METHOD_TEXT = {
  cash: {
    title: 'Naqd buyurtmalar',
    totalLabel: 'Naqd olingan',
    hint: 'Bu buyurtmalarda pulni restoran/kuryer naqd oldi. LokmaGo komissiyasi restoranning hisobidan yechiladi.',
  },
  card: {
    title: 'Karta bilan to‘langan buyurtmalar',
    totalLabel: 'Karta orqali tushgan',
    hint: 'Bu summalar karta orqali LokmaGo hisobiga tushgan. Restoran ulushi restoranga o‘tkaziladi.',
  },
};

function Line({ label, value, strong, muted, minus }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${strong ? 'font-semibold text-ink' : muted ? 'text-muted' : 'text-ink'}`}>
      <span>{label}</span>
      <span className="whitespace-nowrap">{minus ? '−' : ''}{som(Math.abs(value))} so‘m</span>
    </div>
  );
}

function OrderCard({ o }) {
  const cash = o.method === 'cash';
  return (
    <div className="rounded-xl border border-line bg-surface p-3 text-xs">
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink">
            {o.label} <span className="font-normal text-muted">· {fmtDateTime(o.deliveredAt)}</span>
          </div>
          <div className="text-[11px] text-muted">
            {FULFILLMENT[o.fulfillment] || o.fulfillment}
            {o.customer && ` · ${o.customer.name}${o.customer.phone ? ` · ${o.customer.phone}` : ''}`}
          </div>
        </div>
        <div className="flex-none text-right">
          <div className="text-sm font-bold text-ink">{som(o.total)}</div>
          <div className="text-[10px] text-muted">{cash ? 'naqd' : `karta · ${o.paymentMethod}`}</div>
        </div>
      </div>

      {cash && !o.isPaid && (
        <div className="mb-1.5 inline-block rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
          Naqd olingani belgilanmagan
        </div>
      )}

      <div className="mb-2 space-y-0.5 border-l-2 border-line pl-2">
        {o.items.map((it, i) => (
          <div key={i} className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 text-ink">
              {it.quantity}× {it.name}
              {it.options.length > 0 && <span className="text-muted"> ({it.options.join(', ')})</span>}
            </span>
            <span className="whitespace-nowrap text-muted">{som(it.lineTotal)}</span>
          </div>
        ))}
      </div>

      <div className="space-y-0.5 border-t border-line pt-1.5">
        <Line label="Taom puli" value={o.foodTotal} />
        {o.deliveryFee > 0 && <Line label="Yetkazish puli" value={o.deliveryFee} />}
        {o.customerFee > 0 && <Line label="Mijoz xizmat haqi" value={o.customerFee} />}
        {o.adjustment !== 0 && (
          <Line
            label={o.adjustment < 0 ? 'Chegirma / bonus' : 'Boshqa qo‘shimcha'}
            value={o.adjustment}
            minus={o.adjustment < 0}
          />
        )}
        <Line label={cash ? 'Jami (naqd)' : 'Jami (kartadan yechilgan)'} value={o.total} strong />
      </div>

      {o.restaurantShare !== null && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted">
          <span>Restoranga: <b className="text-ink">{som(o.restaurantShare)}</b></span>
          <span>LokmaGo: <b className="text-ink">{som(o.lokmaCommission)}</b></span>
          {o.clickFee > 0 && <span>Click: <b className="text-ink">{som(o.clickFee)}</b></span>}
        </div>
      )}
    </div>
  );
}

/*
 * "Naqd: N ta / Karta: N ta" ustiga bosilganda ochiladi —
 * kartadagi son ORQASIDAGI aynan shu buyurtmalar (server sanash
 * qoidasi bir xil, shuning uchun ro'yxat uzunligi songa teng).
 */
export function RestaurantOrdersModal({ restaurant, method: initialMethod, range, periodText, counts, onClose }) {
  const [method, setMethod] = useState(initialMethod);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const rangeKey = range ? `${range.from}|${range.to}` : '';

  useEffect(() => {
    let dead = false;
    setLoading(true);
    setErr('');
    adminApi.getRestaurantBillingOrders(restaurant._id, buildQuery(range, { method }))
      .then((d) => { if (!dead) setData(d); })
      .catch((e) => { if (!dead) { setData(null); setErr(e.message); } })
      .finally(() => { if (!dead) setLoading(false); });
    return () => { dead = true; };
    // range o'zgarishi rangeKey orqali kuzatiladi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant._id, method, rangeKey]);

  const t = data?.totals;
  const text = METHOD_TEXT[method];

  return (
    <Sheet title={restaurant.name} subtitle={periodText} onClose={onClose} wide>
      <div className="mb-3 grid grid-cols-2 gap-1.5">
        {['cash', 'card'].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            className={`rounded-xl border py-2 text-sm font-medium ${
              method === m ? 'border-brand-400 bg-brand-400/10 text-ink' : 'border-line text-muted'
            }`}
          >
            {m === 'cash' ? 'Naqd' : 'Karta'}: <b>{counts?.[m] ?? 0}</b> ta
          </button>
        ))}
      </div>

      <p className="mb-3 text-[11px] text-muted">{text.hint}</p>

      {loading && <div className="py-8 text-center text-sm text-muted">Yuklanmoqda...</div>}
      {err && <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600">{err}</div>}

      {!loading && data && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Buyurtma', `${data.count} ta`],
              ['Taom puli', som(t.foodTotal)],
              ['Yetkazish puli', som(t.deliveryFee)],
              [text.totalLabel, som(t.total)],
            ].map(([label, value], i) => (
              <div key={label} className={`rounded-xl px-3 py-2 text-center ${i === 3 ? 'bg-brand-400/10' : 'bg-canvas'}`}>
                <div className="text-[10px] text-muted">{label}</div>
                <div className="text-sm font-bold text-ink">{value}</div>
              </div>
            ))}
          </div>

          {t.restaurantShare > 0 && (
            <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-canvas px-3 py-2 text-xs text-muted">
              <span>Restoran ulushi: <b className="text-ink">{som(t.restaurantShare)}</b> so‘m</span>
              <span>LokmaGo komissiyasi: <b className="text-ink">{som(t.lokmaCommission)}</b> so‘m</span>
            </div>
          )}

          {data.truncated && (
            <div className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
              Jami {data.count} ta buyurtma bor, eng oxirgi {data.orders.length} tasi ko‘rsatilmoqda va
              yuqoridagi summalar faqat shularga tegishli. Sana oralig‘ini toraytiring.
            </div>
          )}

          {data.orders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line py-8 text-center text-sm text-muted">
              Bu davrda {method === 'cash' ? 'naqd' : 'karta bilan'} buyurtma yo‘q
            </div>
          ) : (
            <div className="space-y-2">
              {data.orders.map((o) => <OrderCard key={o._id} o={o} />)}
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
