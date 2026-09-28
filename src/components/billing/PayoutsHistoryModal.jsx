import { useEffect, useState } from 'react';
import { adminApi } from '@/api';
import { buildQuery } from '@/lib/billingPeriod';
import { Sheet } from './Sheet';
import { som, fmtDateTime } from './format';

/*
 * "To'langan / O'tkazilgan" ustiga bosilganda — shu restoranga
 * tanlangan davrda QAYSI kunda, QANCHA, KIM o'tkazgani.
 * ("Kecha qancha o'tkazilgan?" savoliga bevosita javob.)
 */
export function PayoutsHistoryModal({ restaurant, range, periodText, onClose }) {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');
  const rangeKey = range ? `${range.from}|${range.to}` : '';

  useEffect(() => {
    let dead = false;
    adminApi.getLedger(buildQuery(range, { type: 'payout', restaurantId: restaurant._id, limit: 200 }))
      .then((list) => { if (!dead) setItems(list); })
      .catch((e) => { if (!dead) setErr(e.message); });
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant._id, rangeKey]);

  const total = (items || []).reduce((a, x) => a + Math.abs(x.amount || 0), 0);

  return (
    <Sheet title={`${restaurant.name} — o‘tkazmalar`} subtitle={periodText} onClose={onClose}>
      {err && <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600">{err}</div>}
      {!items && !err && <div className="py-8 text-center text-sm text-muted">Yuklanmoqda...</div>}

      {items && (
        <>
          <div className="mb-3 rounded-xl bg-brand-400/10 px-4 py-3">
            <div className="text-xs text-muted">Jami o‘tkazilgan</div>
            <div className="text-2xl font-bold text-ink">{som(total)} <span className="text-sm font-normal">so‘m</span></div>
            <div className="text-[11px] text-muted">{items.length} ta o‘tkazma</div>
          </div>

          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line py-8 text-center text-sm text-muted">
              Bu davrda o‘tkazma bo‘lmagan
            </div>
          ) : (
            <div className="divide-y divide-line rounded-xl border border-line">
              {items.map((it) => (
                <div key={it._id} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="text-ink">{fmtDateTime(it.createdAt)}</div>
                    <div className="text-[11px] text-muted">
                      {it.createdByName ? `O‘tkazdi: ${it.createdByName}` : 'O‘tkazgan xodim noma’lum'}
                      {it.meta?.note ? ` · ${it.meta.note}` : ''}
                    </div>
                  </div>
                  <div className="whitespace-nowrap font-semibold text-violet-600">{som(Math.abs(it.amount))} so‘m</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
