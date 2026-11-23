import { useEffect, useRef } from 'react';
import { fmtWeek } from '@/lib/billingPeriod';
import { som } from './format';

/*
 * ═══════════════════════════════════════════════════════════
 * HAFTA LENTASI — eski haftalarga o'tish
 * ═══════════════════════════════════════════════════════════
 *
 * Har plitka — bitta hafta (dushanba–yakshanba, Toshkent). Pastidagi
 * ingichka chiziq shu haftaning holatini ko'rsatadi:
 *   ko'k  — LokmaGo restoranlarga hali to'lamagan qismi,
 *   yashil — to'langan qismi,
 *   qizil nuqta — restoranlarning ochiq qarzi bor.
 * Raqamlar server javobidan (GET /admin/billing/weeks) — frontend hech
 * narsani hisoblamaydi, faqat chizadi.
 *
 * value: tanlangan hafta dushanbasi yoki null (hafta tanlanmagan).
 */
export function WeekStrip({ weeks, value, onChange }) {
  const scroller = useRef(null);
  const selectedRef = useRef(null);

  // Tanlangan hafta har doim ko'rinib tursin (tashqaridan — masalan kartadagi "eski hafta" bosilganda)
  useEffect(() => {
    selectedRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [value]);

  if (!weeks?.length) return null;

  const idx = value ? weeks.findIndex((w) => w.weekStart === value) : -1;
  // Ro'yxat yangisidan eskisiga: "oldingi hafta" — indeks +1
  const older = idx === -1 ? weeks[0] : weeks[idx + 1];
  const newer = idx > 0 ? weeks[idx - 1] : null;

  return (
    <div className="mb-3" data-testid="week-strip">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-ink">Haftalar</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => older && onChange(older.weekStart)}
            disabled={!older}
            aria-label="Oldingi hafta"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-muted hover:bg-canvas disabled:opacity-40"
          >
            <i className="ti ti-chevron-left text-sm" />
          </button>
          <button
            type="button"
            onClick={() => newer && onChange(newer.weekStart)}
            disabled={!newer}
            aria-label="Keyingi hafta"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-muted hover:bg-canvas disabled:opacity-40"
          >
            <i className="ti ti-chevron-right text-sm" />
          </button>
        </div>
      </div>

      <div ref={scroller} className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="listbox" aria-label="Haftalar">
        {weeks.map((w) => {
          const active = w.weekStart === value;
          const total = w.paid + w.payable;
          const paidPct = total > 0 ? Math.round((w.paid / total) * 100) : 0;
          const quiet = w.orders === 0 && total === 0 && w.receivable === 0;
          return (
            <button
              key={w.weekStart}
              ref={active ? selectedRef : null}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => onChange(active ? null : w.weekStart)}
              className={`relative flex w-[8.5rem] flex-none flex-col rounded-xl border px-3 pb-2.5 pt-2 text-left transition-colors ${
                active
                  ? 'border-brand-400 bg-brand-400/10 ring-1 ring-brand-400'
                  : 'border-line bg-surface hover:bg-canvas'
              } ${quiet && !active ? 'opacity-60' : ''}`}
            >
              <span className={`text-[11px] ${active ? 'text-brand-800' : w.current ? 'font-medium text-brand-600' : 'text-muted'}`}>
                {w.current ? 'Joriy hafta' : `${w.orders} ta buyurtma`}
              </span>
              <span className="text-sm font-semibold text-ink">{fmtWeek(w.weekStart)}</span>
              <span className={`mt-0.5 text-[11px] ${w.payable > 0 ? 'text-blue-600' : 'text-muted'}`}>
                {w.payable > 0 ? `${som(w.payable)} ochiq` : total > 0 ? 'To‘langan' : '—'}
              </span>

              {/* Holat chizig'i: yashil — to'langan, ko'k — to'lanmagan */}
              <span className="mt-2 flex h-1 w-full overflow-hidden rounded-full bg-line">
                {total > 0 && (
                  <>
                    <span className="h-full bg-green-500" style={{ width: `${paidPct}%` }} />
                    <span className="h-full bg-blue-500" style={{ width: `${100 - paidPct}%` }} />
                  </>
                )}
              </span>

              {w.receivable > 0 && (
                <span
                  className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-red-500"
                  title={`Restoranlar qarzi: ${som(w.receivable)} so‘m`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
