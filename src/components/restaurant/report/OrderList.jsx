import { useState } from 'react';
import { som, timeLabel, dayLabel, PAY_LABEL, fulfillmentLabel } from './format';

/*
 * Davrdagi HAR BIR buyurtma — "aynan qaysi buyurtmadan qancha".
 * Restoran o'z daftari bilan solishtira olishi uchun kunlik raqam,
 * vaqt, to'lov turi va pul tasviri (taom, komissiya, ulush) bir
 * qatorda. Naqd buyurtmada — LokmaGo qismi, kartada — LokmaGo
 * o'tkazadigan summa.
 */
const PAGE = 20;

export function OrderList({ data, loading, multiDay }) {
  const [showAll, setShowAll] = useState(false);
  const items = data?.items || [];
  const cancelled = data?.cancelled || [];

  if (loading) return <div className="text-muted text-sm py-6 text-center">Yuklanmoqda...</div>;

  return (
    <section className="mt-6" data-testid="order-list">
      <h2 className="text-sm font-semibold text-ink mb-2.5">
        Buyurtmalar <span className="text-muted font-normal">· {items.length} ta yakunlangan</span>
      </h2>
      {items.length > 0 && <p className="text-xs text-muted -mt-1.5 mb-2">O‘ngdagi summa — shu buyurtmadan ulushingiz.</p>}

      {items.length === 0 ? (
        <div className="text-center text-muted text-sm py-8 border border-dashed border-line rounded-xl">
          Bu davrda yakunlangan buyurtma yo‘q
        </div>
      ) : (
        <div className="rb-ord">
          {(showAll ? items : items.slice(0, PAGE)).map((o) => (
            <OrderRow key={o._id} o={o} multiDay={multiDay} />
          ))}
        </div>
      )}

      {items.length > PAGE && (
        <button type="button" className="rb-more" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Qisqartirish' : `Yana ${items.length - PAGE} tasini ko‘rsatish`}
        </button>
      )}
      {data?.hasMore && (
        <p className="text-xs text-muted mt-2">Ro‘yxat juda uzun — qisqaroq davr tanlang.</p>
      )}

      {cancelled.length > 0 && (
        <details className="rb-cancelled" data-testid="cancelled-list">
          <summary>Bekor qilinganlar · {cancelled.length} ta</summary>
          <div className="rb-ord">
            {cancelled.map((o) => (
              <div key={o._id} className="rb-ord__row is-cancelled">
                <div className="rb-ord__top">
                  <span className="rb-ord__num">{o.dailyNumber ? `#${o.dailyNumber}` : '—'}</span>
                  <span className="rb-ord__meta">
                    {multiDay ? `${dayLabel(ymdOf(o.cancelledAt))}, ` : ''}{timeLabel(o.cancelledAt)} · {PAY_LABEL[o.paymentMethod] || 'Karta'} · {fulfillmentLabel(o)}
                  </span>
                  <span className="rb-ord__share">{som(o.food)}</span>
                </div>
                <div className="rb-ord__reason">{o.cancelReason || 'Sabab ko‘rsatilmagan'}</div>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function OrderRow({ o, multiDay }) {
  const m = o.money || {};
  const cash = o.payGroup === 'cash' && m.ownCash;
  return (
    <div className="rb-ord__row" data-testid="order-row">
      <div className="rb-ord__top">
        <span className="rb-ord__num">{o.dailyNumber ? `#${o.dailyNumber}` : '—'}</span>
        <span className="rb-ord__meta">
          {multiDay ? `${dayLabel(ymdOf(o.deliveredAt))}, ` : ''}{timeLabel(o.deliveredAt)} · {PAY_LABEL[o.paymentMethod] || 'Karta'} · {fulfillmentLabel(o)}
        </span>
        <span className="rb-ord__share">{m.share != null ? som(m.share) : som(m.food)}</span>
      </div>

      {m.v2 ? (
        <div className="rb-ord__calc">
          <span>Taom {som(m.food)}</span>
          {m.commission > 0 && <span className="is-minus">Komissiya −{som(m.commission)}</span>}
          {m.delivery > 0 && <span>Yetkazish +{som(m.delivery)}</span>}
          {cash
            ? <span className="is-minus">LokmaGo qismi {som(m.toLokma)}</span>
            : <span className="is-plus">LokmaGo o‘tkazadi {som(m.fromLokma)}</span>}
        </div>
      ) : (
        <div className="rb-ord__calc">
          <span>Taom {som(m.food)}</span>
          <span>Eski tizimdagi buyurtma — ulush kunlik jadvalda</span>
        </div>
      )}
    </div>
  );
}

function ymdOf(iso) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}
