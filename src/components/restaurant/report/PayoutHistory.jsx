import { som, dateTimeLabel } from './format';

/** O'tkazmalar tarixi — LokmaGo restoranga qachon qancha o'tkazgani (barcha vaqt, oxirgi 20 ta). */
export function PayoutHistory({ items, loading }) {
  if (loading) return null;
  return (
    <section className="mt-6" data-testid="payout-history">
      <h2 className="text-sm font-semibold text-ink mb-2.5">O‘tkazmalar tarixi</h2>
      {!items?.length ? (
        <div className="text-center text-muted text-sm py-8 border border-dashed border-line rounded-xl">
          Hali o‘tkazma bo‘lmagan
        </div>
      ) : (
        <div className="rb-top">
          {items.map((p) => (
            <div key={p._id} className="rb-pay__row">
              <span className="rb-pay__date">{dateTimeLabel(p.createdAt)}</span>
              <span className="rb-pay__note">{p.note || ''}</span>
              <span className="rb-pay__sum">{som(Math.abs(p.amount))} so‘m</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
