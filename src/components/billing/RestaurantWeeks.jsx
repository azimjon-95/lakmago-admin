import { useState } from 'react';
import { fmtWeek } from '@/lib/billingPeriod';
import { som, fmtDateTime } from './format';

/*
 * ═══════════════════════════════════════════════════════════
 * RESTORAN KARTASIDAGI HAFTALAR
 * ═══════════════════════════════════════════════════════════
 *
 * Mavjud karta raqamlari (tushum, daromad, balans) O'ZGARMAYDI — bu blok
 * ularning ostida turadi va faqat haftalar kesimini ko'rsatadi.
 *
 *  • Hafta tanlangan bo'lsa — "Shu hafta": majburiyat, to'langan, qoldiq, foiz
 *    va to'lovlar tarixi; ochiq bo'lsa "Shu haftani to'lash".
 *  • Pastida doim kichik qilib: boshqa haftalardagi ochiq qoldiqlar.
 *      ko'k  — LokmaGo restoranga qarz: bosilsa o'sha haftaga o'tiladi va to'lanadi;
 *      qizil — restoran bizga qarz: karta tushumi kelgan sari o'zi yopiladi.
 *    2+ hafta ochiq bo'lsa — "Hammasini to'lash" (eng eski haftadan boshlab).
 *
 * To'lash summasi Restaurant.balance bilan cheklanadi (server shuni tekshiradi);
 * jurnal va balans farq qilsa — bu yashirilmaydi.
 */

const VISIBLE_OLD = 4;

export function RestaurantWeeks({ data, balance, selectedWeek, onOpenWeek, onPayWeek, onPayAll }) {
  const [showAll, setShowAll] = useState(false);
  const [showPayments, setShowPayments] = useState(false);
  if (!data) return null;

  const canPayMax = Math.max(0, Math.round((balance || 0) * 100) / 100);
  const week = selectedWeek ? data.weeks.find((w) => w.weekStart === selectedWeek) : null;

  // Tanlangan va joriy haftadan tashqari ochiq haftalar (yangisi birinchi)
  const open = data.weeks.filter((w) => (w.payable > 0 || w.receivable > 0) && w.weekStart !== selectedWeek
    && !(w.current && !selectedWeek));
  const payableWeeks = data.weeks.filter((w) => w.payable > 0);
  const shown = showAll ? open : open.slice(0, VISIBLE_OLD);
  const drift = Math.abs(data.driftAmount || 0) >= 0.01;

  return (
    <div className="mt-3" data-testid="restaurant-weeks">
      {selectedWeek && <SelectedWeek week={week} weekStart={selectedWeek} canPayMax={canPayMax}
        onPay={onPayWeek} showPayments={showPayments} setShowPayments={setShowPayments} />}

      {open.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] text-muted">
              {selectedWeek ? 'Boshqa haftalarda ochiq' : 'Eski haftalarda ochiq'}
            </span>
            {payableWeeks.length >= 2 && canPayMax > 0 && (
              <button
                type="button"
                onClick={() => onPayAll(Math.min(data.openPayable, canPayMax))}
                className="text-[11px] font-medium text-brand-600 underline decoration-dotted underline-offset-2"
              >
                Hammasini to‘lash ({som(Math.min(data.openPayable, canPayMax))})
              </button>
            )}
          </div>

          <ul className="divide-y divide-line/70 rounded-lg border border-line">
            {shown.map((w) => {
              const lokmaOwes = w.payable > 0;
              return (
                <li key={w.weekStart}>
                  <button
                    type="button"
                    onClick={() => onOpenWeek(w.weekStart)}
                    className="flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left text-[11px] hover:bg-canvas"
                  >
                    <span className={`h-1.5 w-1.5 flex-none rounded-full ${lokmaOwes ? 'bg-blue-500' : 'bg-red-500'}`} />
                    {/* Telefonda izoh sana ostida, kattaroq ekranda alohida ustunda — qirqilmasin */}
                    <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:gap-2.5">
                      <span className="text-ink sm:w-24 sm:flex-none">{fmtWeek(w.weekStart)}</span>
                      <span className="min-w-0 truncate text-[10px] text-muted sm:text-[11px]">
                        {lokmaOwes
                          ? (w.paid > 0 ? `LokmaGo qarzi, ${w.paidPercent}% to‘langan` : 'LokmaGo qarzi')
                          : (w.debtClosed > 0 ? `Restoran qarzi, ${w.debtClosedPercent}% yopildi` : 'Restoran qarzi')}
                      </span>
                    </span>
                    <span className={`flex-none font-semibold ${lokmaOwes ? 'text-blue-600' : 'text-red-600'}`}>
                      {som(lokmaOwes ? w.payable : w.receivable)}
                    </span>
                    <i className="ti ti-chevron-right flex-none text-xs text-muted" />
                  </button>
                </li>
              );
            })}
          </ul>
          {open.length > VISIBLE_OLD && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-1 text-[11px] text-muted underline">
              {showAll ? 'Kamroq' : `Yana ${open.length - VISIBLE_OLD} ta hafta`}
            </button>
          )}
          {open.some((w) => w.receivable > 0) && (
            <p className="mt-1 text-[10px] text-muted">
              Restoran qarzi keyingi karta tushumlaridan eng eski haftadan boshlab o‘zi yopiladi.
            </p>
          )}
        </div>
      )}

      {drift && (
        <p className="mt-2 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[10px] text-amber-700" data-testid="weeks-drift">
          Haftalar jurnal bo‘yicha hisoblangan ({som(data.ledgerBalance)}), balans esa {som(data.storedBalance)} —
          farq {som(data.driftAmount)} so‘m. To‘lov balans bo‘yicha cheklanadi; farq audit qilinmoqda.
        </p>
      )}
    </div>
  );
}

function SelectedWeek({ week, weekStart, canPayMax, onPay, showPayments, setShowPayments }) {
  if (!week) {
    return (
      <div className="rounded-xl border border-dashed border-line px-3 py-3 text-center text-xs text-muted">
        {fmtWeek(weekStart)}: bu restoranda hisob-kitob bo‘lmagan
      </div>
    );
  }
  const hasPayable = week.obligation > 0;
  const hasDebt = week.debt > 0;
  // Haftada faqat eski haftalarga to'lov qilingan bo'lishi mumkin — o'zining yangi hisobi yo'q
  if (!hasPayable && !hasDebt && week.cardShare === 0 && week.cashDebt === 0 && week.bonus === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line px-3 py-3 text-center text-xs text-muted">
        {fmtWeek(weekStart)}: bu haftada yangi hisob-kitob bo‘lmagan
        {week.current ? ' (joriy hafta)' : ''}
      </div>
    );
  }
  const payNow = Math.min(week.payable, canPayMax);

  return (
    <div className="rounded-xl border border-brand-400/50 bg-brand-400/5 p-3" data-testid="selected-week">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-ink">{fmtWeek(week.weekStart)}</span>
        <StatusText week={week} />
      </div>

      {hasPayable && (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Cell label="Majburiyat" value={week.obligation} />
            <Cell label="To‘langan" value={week.paid} tone="green" />
            <Cell label="Qoldiq" value={week.payable} tone={week.payable > 0 ? 'blue' : 'muted'} />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-line">
              <span className="h-full bg-green-500" style={{ width: `${week.paidPercent || 0}%` }} />
            </span>
            <span className="w-9 text-right text-[11px] font-medium text-ink">{week.paidPercent || 0}%</span>
          </div>
        </>
      )}

      {(week.cardShare > 0 || week.cashDebt > 0) && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted">
          {week.cardShare > 0 && <span>Karta ulushi {som(week.cardShare)}</span>}
          {week.cashDebt > 0 && <span>Naqd komissiya qarzi {som(week.cashDebt)}</span>}
          {week.bonus > 0 && <span>Sovg‘a qoplash {som(week.bonus)}</span>}
          {week.refunds < 0 && <span>Qaytarish {som(week.refunds)}</span>}
        </div>
      )}

      {week.coveredOldDebts.length > 0 && (
        <div className="mt-1 text-[11px] text-muted">
          Shundan eski qarzlarga ushlandi:{' '}
          {week.coveredOldDebts.map((c) => `${fmtWeek(c.week)} — ${som(c.amount)}`).join(', ')}
        </div>
      )}

      {hasDebt && (
        <div className="mt-2 rounded-lg bg-red-500/5 px-2.5 py-2 text-[11px]">
          <div className="flex justify-between">
            <span className="text-muted">Restoran qarzi</span>
            <span className="font-semibold text-ink">{som(week.debt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Karta tushumidan yopildi</span>
            <span className="text-green-700">{som(week.debtClosed)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Qoldiq</span>
            <span className={week.receivable > 0 ? 'font-semibold text-red-600' : 'text-muted'}>{som(week.receivable)}</span>
          </div>
        </div>
      )}

      {week.payments.length > 0 && (
        <div className="mt-2">
          <button type="button" onClick={() => setShowPayments((v) => !v)} className="text-[11px] text-muted underline">
            {showPayments ? 'To‘lovlarni yashirish' : `To‘lovlar tarixi (${week.payments.length})`}
          </button>
          {showPayments && (
            <ul className="mt-1 space-y-0.5 text-[11px]">
              {week.payments.map((p, i) => (
                <li key={`${p.ledgerId}-${i}`} className="flex justify-between gap-2">
                  <span className="text-muted">
                    {fmtDateTime(p.at)}
                    {p.kind === 'promo' ? ', promo qarzi ushlandi' : p.targeted ? '' : ', avtomatik (eng eski hafta)'}
                    {p.note && p.kind !== 'promo' ? `, ${p.note}` : ''}
                  </span>
                  <span className="flex-none font-medium text-green-700">{som(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {week.payable > 0 && (
        <div className="mt-3 flex items-center justify-end gap-2">
          {payNow < week.payable && (
            <span className="text-[10px] text-muted">
              {payNow > 0 ? `Balans bo‘yicha ${som(payNow)} gacha` : 'Restoranning boshqa haftadagi qarzi bilan qoplangan'}
            </span>
          )}
          <button
            type="button"
            disabled={payNow <= 0}
            onClick={() => onPay(week, payNow)}
            className="rounded-lg bg-brand-400 px-3.5 py-2 text-sm font-medium text-brand-text disabled:opacity-50"
          >
            Shu haftani to‘lash
          </button>
        </div>
      )}
    </div>
  );
}

function StatusText({ week }) {
  const map = {
    settled: ['Yopilgan', 'text-green-700'],
    open: ['To‘lanmagan', 'text-blue-600'],
    partial: ['Qisman to‘langan', 'text-blue-600'],
    debt: ['Restoran qarzi', 'text-red-600'],
    debt_closing: ['Qarz yopilmoqda', 'text-red-600'],
  };
  const [text, cls] = map[week.status] || ['', ''];
  return <span className={`text-[11px] font-medium ${cls}`}>{text}{week.current ? ', joriy hafta' : ''}</span>;
}

function Cell({ label, value, tone }) {
  const color = { green: 'text-green-700', blue: 'text-blue-600', muted: 'text-muted' }[tone] || 'text-ink';
  return (
    <div className="rounded-lg bg-surface py-1.5">
      <div className="text-[10px] text-muted">{label}</div>
      <div className={`text-sm font-semibold ${color}`}>{som(value)}</div>
    </div>
  );
}
