import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { panelApi } from '@/api';
import { useAuth } from '@/store/auth';
import { OrdersBillingTabs } from '@/components/restaurant/OrdersBillingTabs';
import { tashkentToday, addDaysYmd } from '@/lib/billingPeriod';
import { som } from '@/components/restaurant/report/format';
import { PeriodStatement } from '@/components/restaurant/report/PeriodStatement';
import { AccountCard } from '@/components/restaurant/report/AccountCard';
import { OrderList } from '@/components/restaurant/report/OrderList';
import { DailyTable } from '@/components/restaurant/report/DailyTable';
import { PayoutHistory } from '@/components/restaurant/report/PayoutHistory';

/*
 * ═══════════════════════════════════════════════════════════
 * RESTORAN — HISOBOTLAR
 * ═══════════════════════════════════════════════════════════
 *
 * 2026-11-23 audit: server hisobot endpointlari string restaurantId
 * sababli buyurtmalarni umuman topmasdi — restoran doim "0 ta
 * buyurtma" ko'rardi. Server tuzatildi (services/restaurantReport.js);
 * bu sahifa endi restoranga kerakli hamma narsani ko'rsatadi:
 *
 *   1. Hisob varaqasi — taom savdosi, komissiyangiz, ulushingiz,
 *      pul qayerda (karta — LokmaGo o'tkazadi, naqd — sizda),
 *      davr natijasi
 *   2. Umumiy hisob (barcha vaqt) — alohida, davrga bog'liq emas
 *   3. Ko'rsatkichlar — buyurtmalar, o'rtacha chek, jarayondagilar,
 *      bekorlar, turi bo'yicha
 *   4. Har bir buyurtma — raqam, vaqt, to'lov, taom/komissiya/ulush
 *   5. Kunlik jadval, eng ko'p sotilganlar, o'tkazmalar tarixi
 *
 * Sana — TOSHKENT kuni ("YYYY-MM-DD"), qurilma vaqt zonasidan
 * qat'i nazar. Hech narsa shu yerda hisoblanmaydi — hammasi serverdan.
 */
export function RestaurantBillingPage() {
  const user = useAuth((s) => s.user);

  const today = useMemo(() => tashkentToday(), []);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  const presets = useMemo(() => ({
    today: [today, today],
    yesterday: [addDaysYmd(today, -1), addDaysYmd(today, -1)],
    week: [addDaysYmd(today, -6), today],
    month: [`${today.slice(0, 8)}01`, today],
  }), [today]);
  const activePreset = Object.keys(presets).find((k) => presets[k][0] === from && presets[k][1] === to);
  const applyPreset = (k) => { setFrom(presets[k][0]); setTo(presets[k][1]); };

  const summaryQ = useQuery({
    queryKey: ['panel', 'billing', 'summary', from, to],
    queryFn: () => panelApi.getBillingSummary(from, to),
  });
  const ordersQ = useQuery({
    queryKey: ['panel', 'billing', 'orders', from, to],
    queryFn: () => panelApi.getBillingOrders(from, to),
  });
  const dailyQ = useQuery({
    queryKey: ['panel', 'billing', 'daily', from, to],
    queryFn: () => panelApi.getBillingDaily(from, to),
  });
  const payoutsQ = useQuery({
    queryKey: ['panel', 'billing', 'payouts'],
    queryFn: () => panelApi.getBillingLedger({ type: 'payout', limit: 20 }),
  });

  const orders = summaryQ.data?.orders;
  const finance = summaryQ.data?.finance;
  const payout = summaryQ.data?.payout;
  const multiDay = from !== to;

  return (
    <div className="flex-1 p-4 sm:p-6 min-w-0 max-w-7xl">
      <div className="mb-5">
        <h1 className="text-lg sm:text-xl font-semibold text-ink">Hisobotlar</h1>
        <p className="text-xs sm:text-sm text-muted mt-0.5 truncate">{user?.restaurant?.name}</p>
      </div>

      <OrdersBillingTabs />

      {/* ═══ SANA TANLASH ═══ */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="flex gap-1.5">
          <PresetBtn active={activePreset === 'today'} onClick={() => applyPreset('today')}>Bugun</PresetBtn>
          <PresetBtn active={activePreset === 'yesterday'} onClick={() => applyPreset('yesterday')}>Kecha</PresetBtn>
          <PresetBtn active={activePreset === 'week'} onClick={() => applyPreset('week')}>7 kun</PresetBtn>
          <PresetBtn active={activePreset === 'month'} onClick={() => applyPreset('month')}>Shu oy</PresetBtn>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <input
            type="date" value={from} max={to} aria-label="Boshlanish sanasi"
            onChange={(e) => e.target.value && setFrom(e.target.value)}
            className="rb-date"
          />
          <span className="text-muted text-sm">—</span>
          <input
            type="date" value={to} min={from} max={today} aria-label="Tugash sanasi"
            onChange={(e) => e.target.value && setTo(e.target.value)}
            className="rb-date"
          />
        </div>
      </div>

      {summaryQ.isLoading ? (
        <div className="text-muted text-sm py-10 text-center">Yuklanmoqda...</div>
      ) : summaryQ.isError ? (
        <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          Hisobotni yuklab bo‘lmadi{summaryQ.error?.message ? `: ${summaryQ.error.message}` : ''}. Sahifani yangilab ko‘ring.
        </div>
      ) : (
        <>
          {/* ═══ HISOB VARAQASI + UMUMIY HISOB ═══ */}
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] mb-3">
            <PeriodStatement period={summaryQ.data?.period} orders={orders} finance={finance} />
            <AccountCard payout={payout} />
          </div>

          {/* ═══ KO'RSATKICHLAR ═══ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <StatCard
              icon="ti-receipt"
              label="Yakunlangan buyurtmalar"
              value={orders?.ordersTotal ?? 0}
              suffix="ta"
              hint={`Naqd ${orders?.cash?.count ?? 0} · Karta ${orders?.card?.count ?? 0}`}
            />
            <StatCard
              icon="ti-chart-bar"
              label="O‘rtacha chek"
              value={som(orders?.avgFood)}
              suffix="so‘m"
              hint="Taom summasi, bitta buyurtmaga"
            />
            <StatCard
              icon="ti-clock"
              label="Hozir jarayonda"
              value={orders?.active ?? 0}
              suffix="ta"
              hint="Hali yakunlanmagan (hozirgi holat)"
            />
            <StatCard
              icon="ti-x"
              label="Bekor qilingan"
              value={orders?.cancelled ?? 0}
              suffix="ta"
              hint={orders?.cancelled ? `${som(orders.cancelledFood)} so‘mlik taom` : 'Muammo yo‘q'}
              warn={(orders?.cancelled ?? 0) > 0}
            />
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <StatCard icon="ti-moped" label="Yetkazish" value={orders?.delivery ?? 0} suffix="ta" />
            <StatCard icon="ti-shopping-bag" label="Olib ketish" value={orders?.pickup ?? 0} suffix="ta" />
            <StatCard icon="ti-armchair" label="Zalda" value={orders?.dinein ?? 0} suffix="ta" />
          </div>

          {orders?.cancelReasons?.length > 0 && (
            <div className="rb-note mb-5" data-testid="cancel-reasons">
              <i className="ti ti-alert-triangle" />
              <div>
                <b>Bekor qilish sabablari:</b>{' '}
                {orders.cancelReasons.map((r) => `${r.reason} — ${r.count} ta`).join('; ')}
              </div>
            </div>
          )}

          {/* ═══ HAR BIR BUYURTMA ═══ */}
          <OrderList data={ordersQ.data} loading={ordersQ.isLoading} multiDay={multiDay} />

          {/* ═══ ENG KO'P SOTILGAN ═══ */}
          {orders?.topDishes?.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-ink mb-2.5">Eng ko‘p sotilgan</h2>
              <div className="rb-top">
                {orders.topDishes.map((d, i) => (
                  <div key={d.name} className="rb-top__row">
                    <span className="rb-top__rank">{i + 1}</span>
                    <span className="rb-top__name">{d.name}</span>
                    <span className="rb-top__qty">{d.qty} ta</span>
                    <span className="rb-top__sum">{som(d.amount)} so‘m</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DailyTable rows={dailyQ.data} loading={dailyQ.isLoading} />
          <PayoutHistory items={payoutsQ.data} loading={payoutsQ.isLoading} />

          {/* ═══ NAQD/KARTA TUSHUNTIRISH — shaffoflik uchun ═══ */}
          <div className="rb-note mt-6">
            <i className="ti ti-info-circle" />
            <div>
              <b>Naqd</b> to‘lovlarda pul to‘liq sizda qoladi — LokmaGo qismi (komissiyangiz va mijoz xizmat haqi)
              keyingi karta to‘lovlaridan ushlab qolinadi.{' '}
              <b>Karta</b> orqali (yoki LokmaGo kuryeri naqd olganda) pul avval LokmaGo’ga tushadi, ulushingiz keyin
              o‘tkazib beriladi. Sanalar Toshkent vaqti bo‘yicha.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PresetBtn({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={Boolean(active)} className={`rb-preset ${active ? 'is-active' : ''}`}>
      {children}
    </button>
  );
}

function StatCard({ icon, label, value, suffix, hint, warn }) {
  return (
    <div className={`rb-card${warn ? ' rb-card--alert' : ''}`}>
      <i className={`ti ${icon} rb-card__icon`} />
      <div className="rb-card__label">{label}</div>
      <div className="rb-card__value">
        {value} <span>{suffix}</span>
      </div>
      {hint && <div className="rb-card__hint">{hint}</div>}
    </div>
  );
}
