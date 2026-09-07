import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { panelApi } from '@/api';
import { useAuth } from '@/store/auth';
import { OrdersBillingTabs } from '@/components/restaurant/OrdersBillingTabs';

const som = (n) => Math.round(n ?? 0).toLocaleString('ru-RU').replace(/,/g, ' ');

/*
 * Sana → 'YYYY-MM-DD' (input[type=date] va so'rov uchun bir xil
 * shakl). Mahalliy vaqt zonasi bilan — toISOString() UTC'ga
 * o'tkazib, kechqurun kunni bir kun oldinga suradi.
 */
function toDateInput(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const LEDGER_LABEL = {
  payment_in: 'Mijoz to‘lovi',
  commission: 'Komissiya',
  restaurant_due: 'Ulush hisoblandi',
  payout: 'O‘tkazma',
  refund: 'Qaytarish',
  adjustment: 'Tuzatish',
  waiter_payout: 'Ofitsiant haqi',
};

export function RestaurantBillingPage() {
  const user = useAuth((s) => s.user);

  /*
   * Standart oraliq — BUGUN. Talab shu edi: "aniq sanalar
   * orqali xohlagan kunini ko'ra olsin, default bugun".
   */
  const today = useMemo(() => toDateInput(new Date()), []);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const isToday = from === today && to === today;

  const summaryQ = useQuery({
    queryKey: ['panel', 'billing', 'summary', from, to],
    queryFn: () => panelApi.getBillingSummary(`${from}T00:00:00`, `${to}T23:59:59`),
  });

  const dailyQ = useQuery({
    queryKey: ['panel', 'billing', 'daily', from, to],
    queryFn: () => panelApi.getBillingDaily(`${from}T00:00:00`, `${to}T23:59:59`),
  });

  const orders = summaryQ.data?.orders;
  const payout = summaryQ.data?.payout;
  const daily = dailyQ.data || [];

  /*
   * "Tez tanlash" tugmalari — bugun/kecha/shu oy. Buxgalter
   * har safar kalendar bilan o'ynashi shart emas, eng ko'p
   * so'raladigan oraliqlar bir bosishda tayyor.
   */
  const applyPreset = (preset) => {
    const now = new Date();
    if (preset === 'today') {
      setFrom(today); setTo(today);
    } else if (preset === 'yesterday') {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      setFrom(toDateInput(y)); setTo(toDateInput(y));
    } else if (preset === 'week') {
      const w = new Date(now); w.setDate(w.getDate() - 6);
      setFrom(toDateInput(w)); setTo(today);
    } else if (preset === 'month') {
      setFrom(toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)));
      setTo(today);
    }
  };

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
          <PresetBtn active={isToday} onClick={() => applyPreset('today')}>Bugun</PresetBtn>
          <PresetBtn onClick={() => applyPreset('yesterday')}>Kecha</PresetBtn>
          <PresetBtn onClick={() => applyPreset('week')}>7 kun</PresetBtn>
          <PresetBtn onClick={() => applyPreset('month')}>Shu oy</PresetBtn>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <input
            type="date" value={from} max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="rb-date"
          />
          <span className="text-muted text-sm">—</span>
          <input
            type="date" value={to} min={from} max={today}
            onChange={(e) => setTo(e.target.value)}
            className="rb-date"
          />
        </div>
      </div>

      {summaryQ.isLoading ? (
        <div className="text-muted text-sm py-10 text-center">Yuklanmoqda...</div>
      ) : summaryQ.isError ? (
        <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          Hisobotni yuklab bo‘lmadi
        </div>
      ) : (
        <>
          {/* ═══ ASOSIY KARTALAR ═══ */}
          {/*
            BIRINCHI QATOR — restoran egasi ertalab ochib eng avval
            ko'radigan to'rt raqam. Tushum birinchi o'rinda: "bugun
            qancha ishladim" eng ko'p so'raladigan savol.
          */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <StatCard
              icon="ti-wallet"
              label="Tushum"
              value={som(orders?.revenue)}
              suffix="so'm"
              hint={`${orders?.ordersTotal ?? 0} ta buyurtma`}
              accent
            />
            <StatCard
              icon="ti-receipt"
              label="O‘rtacha chek"
              value={som(orders?.avgCheck)}
              suffix="so'm"
              hint="Bitta buyurtmaga"
            />
            <StatCard
              icon="ti-cash"
              label="Naqd"
              value={som(orders?.cash?.amount)}
              suffix="so'm"
              hint={`${orders?.cash?.count ?? 0} ta buyurtma`}
            />
            <StatCard
              icon="ti-credit-card"
              label="Karta orqali"
              value={som(orders?.card?.amount)}
              suffix="so'm"
              hint={`${orders?.card?.count ?? 0} ta buyurtma`}
            />
          </div>

          {/*
            IKKINCHI QATOR — balans va sifat ko'rsatkichlari.
            Bekor qilinganlar ataylab shu yerda: u pul emas, lekin
            e'tibor talab qiladigan signal.
          */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <BalanceCard payout={payout} />
            <StatCard
              icon="ti-x"
              label="Bekor qilingan"
              value={orders?.cancelled ?? 0}
              suffix="ta"
              hint={cancelHint(orders)}
              warn={(orders?.cancelled ?? 0) > 0}
            />
            <StatCard
              icon="ti-moped"
              label="Yetkazish"
              value={orders?.delivery ?? 0}
              suffix="ta"
              hint="Kuryer orqali"
            />
            <StatCard
              icon="ti-shopping-bag"
              label="Olib ketish"
              value={(orders?.pickup ?? 0) + (orders?.dinein ?? 0)}
              suffix="ta"
              hint="O‘zi olib ketgan"
            />
          </div>

          {/* ═══ ENG KO'P SOTILGAN TAOMLAR ═══ */}
          {orders?.topDishes?.length > 0 && (
            <div className="mb-5">
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

          {/* ═══ NAQD/KARTA TUSHUNTIRISH — shaffoflik uchun ═══ */}
          <div className="rb-note">
            <i className="ti ti-info-circle" />
            <div>
              <b>Naqd</b> to‘lovlarda pul to‘liq sizda qoladi — biz komissiyamizni
              keyingi karta to‘lovlaridan ushlab qolamiz.{' '}
              <b>Karta</b> orqali to‘langan pul avval bizga tushadi, ulushingizni
              keyin o‘tkazib beramiz (pastdagi jadvalda qachon-qanchaligi ko‘rinadi).
            </div>
          </div>

          {/* ═══ KUNLIK JADVAL ═══ */}
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-ink mb-2.5">Kunlik hisob-kitob</h2>

            {dailyQ.isLoading ? (
              <div className="text-muted text-sm py-6 text-center">Yuklanmoqda...</div>
            ) : daily.length === 0 ? (
              <div className="text-center text-muted text-sm py-10 border border-dashed border-line rounded-xl">
                Bu oraliqda yozuv yo‘q
              </div>
            ) : (
              <>
                {/* Desktop: jadval */}
                <div className="hidden md:block overflow-x-auto rounded-xl border border-line">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-canvas text-left text-muted text-xs uppercase tracking-wide">
                        <th className="px-4 py-2.5 font-medium">Sana</th>
                        <th className="px-4 py-2.5 font-medium text-right">Tushum</th>
                        <th className="px-4 py-2.5 font-medium text-right">Komissiya</th>
                        <th className="px-4 py-2.5 font-medium text-right">Ulushingiz</th>
                        <th className="px-4 py-2.5 font-medium text-right">O‘tkazildi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {daily.map((d) => (
                        <tr key={d.day} className="border-t border-line">
                          <td className="px-4 py-2.5 font-medium text-ink">{d.day}</td>
                          <td className="px-4 py-2.5 text-right text-ink">{som(d.tushum)}</td>
                          <td className="px-4 py-2.5 text-right text-red-600">
                            {d.komissiya > 0 ? `−${som(d.komissiya)}` : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-ink">
                            {som(d.restoranUlushi)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-green-600">
                            {d.tolangan > 0 ? som(d.tolangan) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobil: kartalar ro'yxati */}
                <div className="grid gap-2 md:hidden">
                  {daily.map((d) => (
                    <div key={d.day} className="rb-daycard">
                      <div className="rb-daycard__head">
                        <b>{d.day}</b>
                        <span>{som(d.tushum)} so'm</span>
                      </div>
                      <div className="rb-daycard__rows">
                        {d.komissiya > 0 && (
                          <div><span>Komissiya</span><span className="text-red-600">−{som(d.komissiya)}</span></div>
                        )}
                        <div><span>Ulushingiz</span><span className="font-medium">{som(d.restoranUlushi)}</span></div>
                        {d.tolangan > 0 && (
                          <div><span>O‘tkazildi</span><span className="text-green-600">{som(d.tolangan)}</span></div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PresetBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rb-preset ${active ? 'is-active' : ''}`}
    >
      {children}
    </button>
  );
}

/*
 * Bekor qilinganlar uchun izoh — nafaqat SONI, balki ULUSHI ham
 * ko'rsatiladi. 3 ta bekor 10 ta buyurtmadan va 300 tadan
 * butunlay boshqa narsa: birinchisi jiddiy muammo, ikkinchisi
 * odatiy holat.
 */
function cancelHint(orders) {
  const c = orders?.cancelled ?? 0;
  if (!c) return 'Muammo yo‘q';
  const done = orders?.ordersTotal ?? 0;
  if (!done) return 'Yetkazilgan buyurtma yo‘q';
  return `Buyurtmalarning ${Math.round((c / (c + done)) * 100)}%`;
}

function StatCard({ icon, label, value, suffix, hint, accent, warn }) {
  return (
    <div className={`rb-card${accent ? ' rb-card--accent' : ''}${warn ? ' rb-card--alert' : ''}`}>
      <i className={`ti ${icon} rb-card__icon`} />
      <div className="rb-card__label">{label}</div>
      <div className="rb-card__value">
        {value} <span>{suffix}</span>
      </div>
      {hint && <div className="rb-card__hint">{hint}</div>}
    </div>
  );
}

/**
 * Balans kartasi — musbat/manfiy holatga qarab rang va matn
 * o'zgaradi. Bu "kimga qancha qarz" savoliga bevosita javob.
 */
function BalanceCard({ payout }) {
  const owed = payout?.owedToLokma || 0;
  const pending = payout?.pendingToReceive || 0;

  if (owed > 0) {
    return (
      <div className="rb-card rb-card--warn">
        <i className="ti ti-cash rb-card__icon" />
        <div className="rb-card__label">Sizdan olinadigan</div>
        <div className="rb-card__value">
          {som(owed)} <span>so'm</span>
        </div>
        <div className="rb-card__hint">Naqd buyurtmalar komissiyasi</div>
      </div>
    );
  }

  return (
    <div className="rb-card rb-card--ok">
      <i className="ti ti-cash rb-card__icon" />
      <div className="rb-card__label">Sizga o‘tkaziladigan</div>
      <div className="rb-card__value">
        {som(pending)} <span>so'm</span>
      </div>
      <div className="rb-card__hint">Karta orqali kelgan, kutilmoqda</div>
    </div>
  );
}
