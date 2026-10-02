import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { adminApi } from '@/api';
import { getSocket, joinAdmin } from '@/lib/socket';
import { softVibrate } from '@/lib/haptic';
import { confirm } from '@/components/ui/confirm';
import { PeriodFilter } from '@/components/billing/PeriodFilter';
import { RestaurantOrdersModal } from '@/components/billing/RestaurantOrdersModal';
import { PayoutModal } from '@/components/billing/PayoutModal';
import { PayoutsHistoryModal } from '@/components/billing/PayoutsHistoryModal';
import { rangeFor, buildQuery, periodLabel } from '@/lib/billingPeriod';

/*
 * Kasr qismi bo'lishi mumkin (Click 1.5% → 9 940,5). Avval vergul
 * bo'shliqqa almashtirilardi va "9 940 5" ko'rinardi — o'qib
 * bo'lmasdi. Endi kasr vergul bilan, ming'lar bo'shliq bilan.
 */
const som = (n) => (Math.round((Number(n) || 0) * 100) / 100)
  .toLocaleString('ru-RU', { maximumFractionDigits: 2 });
// Payment/Expense modellari TIYINDA saqlaydi (1 so'm = 100 tiyin),
// eski Ledger/Restaurant.balance esa SO'MDA — shuning uchun
// yangi (kunlik hisobot, kirim-chiqim) qismlarda alohida yordamchi:
const somT = (tiyin) => som(Math.round((tiyin ?? 0) / 100));

const TYPE_LABEL = {
  payment_in: { text: 'Mijoz to‘lovi', color: 'text-green-600' },
  commission: { text: 'Komissiya', color: 'text-brand-600' },
  restaurant_due: { text: 'Restoranga', color: 'text-blue-600' },
  payout: { text: 'To‘landi', color: 'text-violet-600' },
  refund: { text: 'Qaytarildi', color: 'text-red-600' },
  adjustment: { text: 'Tuzatish', color: 'text-muted' },
};

export function BillingPage() {
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [ledger, setLedger] = useState([]);
  /*
   * Butun sahifa "Yuklanmoqda" bo'lib qolishi FAQAT birinchi
   * yuklanishda. Filtr almashtirilganda yoki jonli yangilanishda
   * ro'yxat joyida turadi (avval har yangilanish sahifani
   * miltillatib yuborardi).
   */
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Restoranlar bo'limining sana filtri (Toshkent kunlari)
  const [period, setPeriod] = useState({ key: 'all', from: '', to: '' });
  const range = useMemo(() => rangeFor(period), [period]);
  const periodText = periodLabel(period, range);

  // Ketma-ket filtr almashtirilsa, kechikkan ESKI javob yangisini bosib ketmasin
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++loadSeq.current;
    setRefreshing(true);
    try {
      const [o, r] = await Promise.all([
        adminApi.getBillingOverview(),
        adminApi.getBillingByRestaurant(buildQuery(range)),
      ]);
      if (mine !== loadSeq.current) return;
      setOverview(o);
      setRestaurants(r);
      setLoadError('');
    } catch (e) {
      if (mine !== loadSeq.current) return;
      // Xato yutilmaydi: buxgalter eski raqamni yangi deb o'ylab qolmasin
      setLoadError(e.message || 'Ma‘lumotni yuklab bo‘lmadi');
    }
    setInitialLoading(false);
    setRefreshing(false);
  }, [range]);

  useEffect(() => { load(); }, [load]);

  /*
   * ═══ JONLI YANGILANISH ═══
   *
   * Server buyurtma hisob-kitobi yoki qaytarish bo'lganda
   * `billing:update` yuboradi. Avval sahifa uni TINGLAMASDI —
   * buyurtma qabul qilinsa ham raqamlar eski holicha turardi,
   * faqat qo'lda yangilaganda o'zgarardi.
   *
   * Yangilanish 400 ms kechiktiriladi: bitta buyurtma bir necha
   * yozuv yaratadi (komissiya, restoran qarzi) — har biriga
   * alohida so'rov yubormaymiz.
   */
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    joinAdmin();
    const socket = getSocket();
    let timer = null;

    const onUpdate = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        load();
        softVibrate();
        // Qisqa yorug'lik — raqam o'zgarganini ko'z ilg'asin
        setFlash(true);
        setTimeout(() => setFlash(false), 900);
      }, 400);
    };

    socket.on('billing:update', onUpdate);
    // Buyurtma yetkazilganda ham summalar o'zgaradi
    socket.on('order:update', onUpdate);

    return () => {
      clearTimeout(timer);
      socket.off('billing:update', onUpdate);
      socket.off('order:update', onUpdate);
    };
  }, [load]);

  useEffect(() => {
    if (tab !== 'ledger') return;
    adminApi.getLedger('?limit=150').then(setLedger).catch(() => {});
  }, [tab]);

  // Restoran bo'yicha alohida kelishuvlar
  const [agreements, setAgreements] = useState({});
  /*
   * XATO TUZATILDI: yuklanmasa (masalan ruxsat yo'q) `.catch(() => {})`
   * jimgina yutardi va HAR restoran "Kelishuv belgilanmagan" bo'lib
   * ko'rinardi — buxgalter foizlar yo'q deb o'ylardi. Endi "yuklanmadi"
   * deb aniq aytiladi.
   */
  const [agreementsError, setAgreementsError] = useState('');
  const loadAgreements = useCallback(() => {
    adminApi.getAgreements()
      .then((list) => {
        const map = {};
        list.forEach((r) => { map[r._id] = r; });
        setAgreements(map);
        setAgreementsError('');
      })
      .catch((e) => setAgreementsError(e.message || 'Kelishuvlarni yuklab bo‘lmadi'));
  }, []);
  useEffect(() => { loadAgreements(); }, [loadAgreements]);

  const [editing, setEditing] = useState(null);
  /*
   * "To'lash" endi oddiy dialog emas — PayoutModal: pul QAYERGA
   * o'tkazilishi (karta/bank, to'liq) shu yerda ko'rinadi.
   */
  const [payTarget, setPayTarget] = useState(null);
  const [ordersView, setOrdersView] = useState(null);   // { restaurant, method }
  const [historyView, setHistoryView] = useState(null); // restoran

  if (initialLoading) return <div className="p-6 text-muted">Yuklanmoqda...</div>;

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl font-semibold text-ink mb-1 flex items-center gap-2">
        Moliya
        {/* Jonli yangilandi — qisqa yashil belgi */}
        <span
          className={`w-2 h-2 rounded-full bg-green-500 transition-opacity duration-500 ${
            flash ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden="true"
        />
      </h1>
      <p className="text-sm text-muted mb-5">
        Pul harakati, komissiya va restoranlar bilan hisob-kitob
      </p>

      {/* Umumiy ko'rsatkichlar */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Stat label="Mijozlardan tushum" value={overview.tushum} color="text-green-600" />
          {/*
            LokmaGo daromadi — kelishuv bo'yicha komissiya.
            Click ushlagani shu summa ICHIDAN chiqadi, shuning
            uchun pastida alohida ko'rsatiladi.
          */}
          <Stat
            label="LokmaGo daromadi"
            value={overview.platformaDaromadi}
            color="text-brand-600"
            note={overview.clickFee > 0
              ? `${som(overview.komissiyaBrutto)} − Click ${som(overview.clickFee)}`
              : null}
          />
          <Stat label="Restoranlarga qarz" value={overview.restoranlargaQarz} color="text-blue-600" />
          <Stat label="Click ushlagani" value={overview.clickFee} color="text-muted" />
        </div>
      )}

      {/* Bo'limlar */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line no-scrollbar sm:gap-2">
        {[
          ['overview', 'Restoranlar'],
          ['daily', 'Kunlik hisobot'],
          ['expenses', 'Kirim-chiqim'],
          ['ledger', 'Jurnal'],
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex-none whitespace-nowrap border-b-2 -mb-px px-3 py-2 text-sm font-medium sm:px-4 ${
              tab === k
                ? 'border-brand-400 text-ink'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div>
          {loadError && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-600">
              <span>Ma&apos;lumotni yuklab bo&apos;lmadi: {loadError}</span>
              <button type="button" onClick={load} className="flex-none underline">Qayta urinish</button>
            </div>
          )}
          {agreementsError && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700">
              <span>Kelishuv foizlarini yuklab bo&apos;lmadi ({agreementsError}). Foizlar ko&apos;rsatilmayapti.</span>
              <button type="button" onClick={loadAgreements} className="flex-none underline">Qayta urinish</button>
            </div>
          )}

          <PeriodFilter value={period} onChange={setPeriod} />

          {/* Davr tanlangan bo'lsa — umumiy natija ("kecha qancha o'tkazildi?") */}
          {range && (() => {
            const sum = (k) => restaurants.reduce((a, r) => a + (r.period?.[k] || 0), 0);
            return (
              <div className="mb-3 rounded-xl border border-brand-400/40 bg-brand-400/5 p-3">
                <div className="mb-1.5 text-xs font-medium text-ink">{periodText}</div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Mini label="O'tkazilgan" value={sum('tolangan')} />
                  <Mini label="Tushum" value={sum('tushum')} />
                  <Mini label="LokmaGo daromadi" value={sum('komissiya')} accent />
                </div>
                <div className="mt-1.5 text-[10px] text-muted">
                  «Restoranga qarzimiz» — hozirgi qoldiq, tanlangan davrga bog&apos;liq emas
                </div>
              </div>
            );
          })()}

          <div className={`space-y-3 transition-opacity ${refreshing ? 'opacity-70' : ''}`}>
            {restaurants.map((r) => {
              // Davr tanlangan bo'lsa — SHU DAVR summalari, aks holda jami
              const p = r.period;
              const tushum = p ? p.tushum : r.tushum;
              const komissiya = p ? p.komissiya : r.komissiya;
              const tolangan = p ? p.tolangan : r.tolangan;
              const clickFee = p ? p.clickFee : r.clickFee;
              const sof = p ? p.sofKomissiya : r.sofKomissiya;

              return (
                <div key={r._id} className="bg-surface border border-line rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-ink">{r.name}</div>
                      <AgreementLine info={agreements[r._id]} failed={Boolean(agreementsError)} />
                    </div>
                    <button
                      onClick={() => setEditing({ id: r._id, name: r.name, info: agreements[r._id] })}
                      className="text-xs border border-line px-3 py-1.5 rounded-lg text-muted hover:bg-canvas flex-none"
                    >
                      Kelishuv
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <Mini label="Tushum" value={tushum} />
                    <Mini label="LokmaGo daromadi" value={komissiya} accent />
                    {/* Bosilsa — qachon, qancha, kim o'tkazgani */}
                    <button
                      type="button"
                      onClick={() => setHistoryView(r)}
                      className="rounded-lg text-center ring-brand-400 hover:ring-1"
                      title="O'tkazmalar tarixi"
                    >
                      <Mini label={p ? "O'tkazilgan ›" : "To'langan ›"} value={tolangan} />
                    </button>
                  </div>

                  {/*
                    Click faqat karta to'lovlarida bo'ladi. Naqdda 0 —
                    u hech qanday to'lov tizimiga tegmaydi.
                  */}
                  {clickFee > 0 && (
                    <div className="mt-2 text-xs text-muted flex items-center justify-between
                                    bg-canvas rounded-lg px-3 py-2">
                      <span>Click 1.5% ushlagani</span>
                      <span>
                        −{som(clickFee)} · sof{' '}
                        <b className="text-ink">{som(sof)}</b>
                      </span>
                    </div>
                  )}

                  {/*
                    Naqd/karta buyurtma SONI — bosilsa, aynan shu buyurtmalar:
                    qaysi taom, taom puli, yetkazish puli, karta bo'lsa
                    qancha yechilgani. Son davrga (yuqoridagi filtr) mos.
                  */}
                  {(r.cashCount > 0 || r.cardCount > 0) && (
                    <div className="flex items-center gap-4 mt-2 text-[11px] text-muted">
                      {[['cash', 'Naqd', r.cashCount], ['card', 'Karta', r.cardCount]].map(([m, label, count]) => (
                        <button
                          key={m}
                          type="button"
                          disabled={count === 0}
                          onClick={() => setOrdersView({ restaurant: r, method: m })}
                          className="-mx-1.5 flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-canvas disabled:opacity-60 disabled:hover:bg-transparent"
                        >
                          <i className="ti ti-cash text-sm" /> {label}:{' '}
                          <b className="text-ink underline decoration-dotted underline-offset-2">{count}</b> ta
                          {count > 0 && <i className="ti ti-chevron-right text-xs" />}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-line">
                    <div>
                      <div className="text-xs text-muted">
                        {r.balans >= 0 ? 'Restoranga qarzimiz' : 'Restoran bizga qarz'}
                        {range && ' (hozirgi)'}
                      </div>
                      <div className={`text-lg font-bold ${
                        r.balans >= 0 ? 'text-ink' : 'text-red-600'
                      }`}>
                        {som(Math.abs(r.balans))} so'm
                      </div>
                      {r.balans < 0 && (
                        <div className="text-[11px] text-muted mt-0.5">
                          Naqd to'lovlar komissiyasi — keyingi karta
                          to'lovlaridan yopiladi
                        </div>
                      )}
                    </div>
                    {r.balans > 0 && (
                      <button
                        onClick={() => setPayTarget(r)}
                        className="bg-brand-400 text-brand-text text-sm font-medium px-4 py-2 rounded-lg flex-none"
                      >
                        To'lash
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {restaurants.length === 0 && (
              <div className="text-muted text-sm">Hozircha ma'lumot yo'q</div>
            )}
          </div>
        </div>
      )}

      {editing && (
        <AgreementModal
          restaurant={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); loadAgreements(); load(); }}
        />
      )}

      {payTarget && (
        <PayoutModal
          restaurant={payTarget}
          onClose={() => setPayTarget(null)}
          onDone={() => { setPayTarget(null); load(); }}
        />
      )}

      {ordersView && (
        <RestaurantOrdersModal
          restaurant={ordersView.restaurant}
          method={ordersView.method}
          range={range}
          periodText={periodText}
          counts={{ cash: ordersView.restaurant.cashCount, card: ordersView.restaurant.cardCount }}
          onClose={() => setOrdersView(null)}
        />
      )}

      {historyView && (
        <PayoutsHistoryModal
          restaurant={historyView}
          range={range}
          periodText={periodText}
          onClose={() => setHistoryView(null)}
        />
      )}

      {tab === 'daily' && <DailySettlementTab />}

      {tab === 'expenses' && <ExpensesTab />}

      {tab === 'ledger' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted border-b border-line">
                <th className="py-2 pr-3">Sana</th>
                <th className="py-2 pr-3">Turi</th>
                <th className="py-2 pr-3">Restoran</th>
                <th className="py-2 pr-3 text-right">Summa</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((l) => {
                const t = TYPE_LABEL[l.type] || TYPE_LABEL.adjustment;
                return (
                  <tr key={l._id} className="border-b border-line/60">
                    <td className="py-2 pr-3 text-muted whitespace-nowrap">
                      {new Date(l.createdAt).toLocaleString('ru-RU', {
                        day: '2-digit', month: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className={`py-2 pr-3 ${t.color}`}>{t.text}</td>
                    <td className="py-2 pr-3 text-ink">
                      {l.restaurantId?.name || '—'}
                    </td>
                    <td className={`py-2 pr-3 text-right font-medium ${
                      l.amount < 0 ? 'text-red-600' : 'text-ink'
                    }`}>
                      {l.amount < 0 ? '−' : ''}{som(Math.abs(l.amount))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {ledger.length === 0 && (
            <div className="text-muted text-sm py-6">Yozuvlar yo'q</div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color, note }) {
  return (
    <div className="bg-surface border border-line rounded-xl p-3.5">
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{som(value)}</div>
      {/* Izoh — raqam qanday chiqqanini ko'rsatadi */}
      <div className="text-[10px] text-muted">{note || "so'm"}</div>
    </div>
  );
}

function Mini({ label, value, accent }) {
  return (
    <div className="bg-canvas rounded-lg py-2">
      <div className="text-[10px] text-muted">{label}</div>
      <div className={`text-sm font-semibold ${accent ? 'text-brand-600' : 'text-ink'}`}>
        {som(value)}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Restoran bilan kelishuv
   ═══════════════════════════════════════════ */

/** Kartadagi qisqa satr: 5% + 5% = 10%. */
function AgreementLine({ info, failed }) {
  const a = info?.agreement;
  const markup = info?.deliveryMarkupPercent || 0;

  // Yuklab bo'lmagan bo'lsa "belgilanmagan" DEYILMAYDI — bu noto'g'ri
  // bo'lardi (foiz bor, lekin ko'rsatib bo'lmayapti)
  if (failed && !a) {
    return <div className="text-xs mt-0.5 text-red-600">Kelishuv yuklanmadi</div>;
  }

  if (!a) {
    return (
      <div className="text-xs text-muted mt-0.5">
        Kelishuv <b className="text-amber-600">belgilanmagan</b>
        {markup > 0 && ` · yetkazish ustamasi ${markup}%`}
      </div>
    );
  }

  return (
    <div className="text-xs text-muted mt-0.5">
      Restoran <b className="text-ink">{a.restaurantCommissionPercent}%</b>
      {' + '}mijoz <b className="text-ink">{a.customerFeePercent}%</b>
      {' = '}<b className="text-brand-600">{a.totalSplitPercent}%</b>
      {markup > 0 && <span> · yetkazish ustamasi {markup}%</span>}
    </div>
  );
}

/**
 * Kelishuv oynasi.
 *
 * Ikki foiz alohida kiritiladi. Yig'indi — to'lov tizimiga
 * yuboriladigan YAGONA foiz: shlyuz ikkita alohida komissiya
 * emas, bitta 10% oladi.
 */
export function AgreementModal({ restaurant, onClose, onSaved }) {
  const a = restaurant.info?.agreement;
    /*
   * Yangi kelishuvda maydonlar BO'SH: ilgari 5% + 5% oldindan to'ldirilardi va admin
   * e'tiborsiz "Saqlash" bossa restoranga o'ylab topilgan 10% yozilib ketardi.
   * Foiz har restoran bilan alohida kelishiladi — aniq kiritilishi shart (0 ham to'g'ri
   * qiymat: komissiyasiz restoran). Mavjud kelishuvda — uning haqiqiy qiymatlari.
   */
  const [restPct, setRestPct] = useState(a ? String(a.restaurantCommissionPercent) : '');
  const [custPct, setCustPct] = useState(a ? String(a.customerFeePercent) : '');
  const [note, setNote] = useState(a?.note || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const r = Number(restPct) || 0;
  const c = Number(custPct) || 0;
  const total = r + c;
    const filled = String(restPct).trim() !== '' && String(custPct).trim() !== '';
  const valid = filled && r >= 0 && r <= 100 && c >= 0 && c <= 100 && total <= 100;

  /*
   * 10 000 so'mlik taomda nima bo'lishini ko'rsatamiz.
   *
   * QOIDA: ikkala foiz ham BAZADAN mustaqil hisoblanadi va
   * qo'shiladi — biri ikkinchisi ustiga qo'yilmaydi.
   *   10 000 + ustama 5% (500) + mijoz haqi 5% (500) = 11 000
   * Restoran o'z ustamasi bilan qoladi, undan faqat o'z
   * komissiyasi chegiriladi — mijoz haqi butunlay LokmaGo'ga.
   */
  const demoBase = 10000;
  const demoMarkup = restaurant.info?.deliveryMarkupPercent || 0;
  const demoMarkupAmt = Math.round((demoBase * demoMarkup) / 100);
  const demoFeeAmt = Math.round((demoBase * c) / 100);
  const demoRestCommAmt = Math.round((demoBase * r) / 100);
  const demoFinal = demoBase + demoMarkupAmt + demoFeeAmt;
  const demoRestaurant = demoBase + demoMarkupAmt - demoRestCommAmt;
  const demoLokma = demoRestCommAmt + demoFeeAmt;
  const som = (n) => n.toLocaleString('ru-RU');

    const save = async () => {
    if (!filled) { setErr('Ikkala foizni kiriting (0 ham to\'g\'ri qiymat)'); return; }
    if (!valid) { setErr('Foizlar noto\'g\'ri'); return; }
    setSaving(true); setErr(null);
    try {
      await adminApi.setAgreement(restaurant.id, {
        restaurantCommissionPercent: r,
        customerFeePercent: c,
        note: note.trim(),
      });
      onSaved();
    } catch (e) { setErr(e.message); setSaving(false); }
  };

  return (
    <div onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4">
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-h-[92dvh] overflow-y-auto rounded-t-2xl bg-surface p-5 sm:max-w-md sm:rounded-2xl">
        <div className="mb-1 text-lg font-semibold text-ink">{restaurant.name}</div>
        <p className="mb-4 text-xs text-muted">
          Har restoran bilan alohida kelishuv. To&apos;lov tizimiga
          ikki foizning <b>yig&apos;indisi</b> yuboriladi.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Restoran komissiyasi" hint="Restoran ulushidan yechiladi">
            <PercentInput value={restPct} onChange={setRestPct} testId="rest-pct" />
          </Field>
          <Field label="Mijoz xizmat haqi" hint="Taom narxi ustiga qo'shiladi">
            <PercentInput value={custPct} onChange={setCustPct} testId="cust-pct" />
          </Field>
        </div>

        {/* Yig'indi — shlyuzga ketadigan foiz */}
                <div className={`mb-4 rounded-xl px-4 py-3 ${
          !filled ? 'bg-canvas' : valid ? 'bg-brand-400/10' : 'bg-red-500/10'
        }`} data-testid="split-box">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted">To&apos;lov tizimidan ushlanadi</span>
                        <span className={`text-2xl font-bold ${!filled ? 'text-muted' : valid ? 'text-brand-600' : 'text-red-600'}`} data-testid="split-total">
              {filled ? `${total}%` : '—'}
            </span>
          </div>
                    <div className="mt-0.5 text-[11px] text-muted" data-testid="split-hint">
            {filled
              ? `${r}% (restoran) + ${c}% (mijoz) — shlyuzga bitta ${total}% yuboriladi`
              : 'Ikkala foizni kiriting. 0 ham to‘g‘ri qiymat (komissiyasiz restoran).'}
          </div>
        </div>

        {/* Misol */}
        <div className="mb-4 rounded-xl bg-canvas p-3 text-xs">
          <div className="mb-1.5 font-medium text-ink">10 000 so&apos;mlik taom (yetkazishda):</div>
          <Row label="Restoran narxi" value={`${som(demoBase)} so'm`} />
          {demoMarkup > 0 && (
            <Row label={`+ Yetkazish ustamasi ${demoMarkup}%`} value={`${som(demoMarkupAmt)} so'm`} />
          )}
          {c > 0 && (
            <Row label={`+ Mijoz haqi ${c}%`} value={`${som(demoFeeAmt)} so'm`} />
          )}
          <Row label="Mijoz to'laydi" value={`${som(demoFinal)} so'm`} strong />
          <div className="my-1.5 h-px bg-line" />
          <Row label="LokmaGo oladi" value={`${som(demoLokma)} so'm`} accent />
          <Row label="Restoran oladi" value={`${som(demoRestaurant)} so'm`} strong />
          <div className="mt-2 text-[11px] text-muted">
            Zal va bronda narx o&apos;zgarmaydi: {som(demoBase)} so&apos;m
          </div>
        </div>

        <Field label="Izoh">
          <input value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Masalan: 2026-yil shartnomasi"
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm" />
        </Field>

        {err && (
          <div className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600">{err}</div>
        )}

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 rounded-xl border border-line py-2.5 text-sm text-muted">
            Bekor
          </button>
          <button onClick={save} disabled={saving || !valid}
            className="flex-[1.5] rounded-xl bg-brand-400 py-2.5 text-sm font-semibold text-brand-text disabled:opacity-50">
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>

        {a && (
          <p className="mt-3 text-center text-[11px] text-muted">
            Eski kelishuv arxivlanadi, eski buyurtmalar o&apos;zgarmaydi
          </p>
        )}
      </div>
    </div>
  );
}

function PercentInput({ value, onChange, testId }) {
  return (
    <div className="relative">
      <input
        type="number" inputMode="decimal" min="0" max="100" step="any" placeholder="0" data-testid={testId}
        value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-line bg-canvas px-3 py-2 pr-7 text-lg font-semibold text-ink"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">%</span>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs font-medium text-ink">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

function Row({ label, value, strong, accent }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-muted">{label}</span>
      <span className={
        accent ? 'font-semibold text-brand-600'
          : strong ? 'font-semibold text-ink' : 'text-ink'
      }>{value}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   KUNLIK HISOBOT — Click/Paynet ajratilgan, restoran
   bo'yicha qarz, qo'lda "Pul o'tdi" tasdiqlash.
   ═══════════════════════════════════════════════ */
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function DailySettlementTab() {
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getDailySettlement(date);
      setData(res);
    } catch { setData(null); }
    setLoading(false);
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const markPaid = async (row) => {
    // 1-bosqich: umumiy ogohlantirish — pulni tizim YUBORMAYDI,
    // faqat "yubordim" deb qayd etadi
    const step1 = await confirm({
      title: "Rostdan ham pul o'tkazildimi?",
      content: `${row.restaurantName} ga bank orqali ${somT(row.netPayable)} so'm `
        + "HAQIQATDA o'tkazilgandan keyingina bosing. "
        + "Tizim pulni o'zi yubormaydi — faqat qayd etadi.",
      tone: 'warning',
      okText: 'Ha, tekshirdim',
      cancelText: 'Bekor',
    });
    if (!step1) return;

    // 2-bosqich: bank hujjat raqami (ixtiyoriy, lekin tavsiya etiladi)
    const bankReference = await confirm({
      title: 'Bank hujjat raqami',
      content: 'Keyinchalik tekshirish uchun (ixtiyoriy)',
      input: true,
      inputPlaceholder: 'Masalan: 000123456',
      okText: 'Tasdiqlash',
      tone: 'success',
    });
    if (bankReference === false) return;

    setBusyId(row.restaurantId);
    try {
      /*
       * `amount` sifatida SERVER hisoblagan `netPayable` yuboriladi
       * — frontend hech qanday summani o'zi o'ylab topmaydi (TZ
       * 9-band). Server baribir bu summani qayta tekshiradi va
       * balansdan oshib ketsa rad etadi.
       *
       * `idempotencyKey` — bir marta yaratiladi, takroriy
       * yuborishdan himoya (TZ 16-band).
       */
      await adminApi.confirmSettlement({
        restaurantId: row.restaurantId,
        amount: row.netPayable,
        bankReference: bankReference || '',
        idempotencyKey: crypto.randomUUID(),
      });
      await load();
    } catch (e) {
      alert(e.message);
    }
    setBusyId(null);
  };

  if (loading) return <div className="text-muted text-sm py-6">Yuklanmoqda...</div>;
  if (!data) return <div className="text-muted text-sm py-6">Yuklab bo'lmadi</div>;

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-line px-3 py-1.5 text-sm"
        />
        <span className="text-xs text-muted">
          {data.restaurants.length} ta restoranda faollik
        </span>
      </div>

      {/* Kun bo'yicha jami */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SummaryCard label="Click tushum" value={`${somT(data.totals.click.total)} so'm`} />
        <SummaryCard label="Paynet tushum" value={`${somT(data.totals.paynet.total)} so'm`} />
        <SummaryCard label="Naqd tushum" value={`${somT(data.totals.cash.total)} so'm`} />
        <SummaryCard label="LokmaGo komissiyasi" value={`${somT(data.totals.platformCommission)} so'm`} accent
          sub={`shundan naqd: ${somT(data.totals.cashCommissionDue)}`} />
        <SummaryCard label="Restoranlarga to'lanadigan" value={`${somT(data.totals.netPayable)} so'm`}
          danger={data.totals.netPayable > 0} />
      </div>

      {data.restaurants.length === 0 && (
        <div className="text-muted text-sm py-6">Shu kunda faollik bo'lmagan</div>
      )}

      <div className="space-y-3">
        {data.restaurants.map((row) => (
          <div key={row.restaurantId} className="rounded-xl border border-line p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="font-semibold text-ink">{row.restaurantName}</div>
                {row.commissionMismatch && (
                  <span
                    title={`Bu restoranda ikki xil komissiya foizi bor: Moliya sozlamasida boshqa, shartnomada (${row.agreementCommissionPercent}%) boshqa. Tekshiring.`}
                    className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700"
                  >
                    ⚠ Komissiya nomos
                  </span>
                )}
              </div>
              {row.netPayable <= 0 ? (
                <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                  Balans yopiq
                </span>
              ) : (
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                  Kutilmoqda
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-x-4 text-xs sm:grid-cols-4">
              {row.click.count > 0 && (
                <Row label={`Click (${row.click.count})`} value={`${somT(row.click.total)} so'm`} />
              )}
              {row.paynet.count > 0 && (
                <Row label={`Paynet (${row.paynet.count})`} value={`${somT(row.paynet.total)} so'm`} />
              )}
              {row.cash.count > 0 && (
                <Row label={`Naqd (${row.cash.count})`} value={`${somT(row.cash.total)} so'm`} />
              )}
              <Row label="Komissiya" value={`${somT(row.platformCommission)} so'm`} />
              {row.cashCommissionDue > 0 && (
                <Row label="Naqd komissiya qarzi" value={`${somT(row.cashCommissionDue)} so'm`} />
              )}
              <Row label="Elektron ulush" value={`${somT(row.restaurantShare)} so'm`} accent />
            </div>

            <div className="my-2 h-px bg-line" />

            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted">Restoranga to'lanadigan (umumiy balans)</div>
                <div className="text-lg font-bold text-ink">{somT(row.netPayable)} so'm</div>
              </div>
              {row.netPayable > 0 && (
                <button
                  onClick={() => markPaid(row)}
                  disabled={busyId === row.restaurantId}
                  className="rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-brand-text disabled:opacity-50"
                >
                  {busyId === row.restaurantId ? '...' : "Pul o'tdi"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, accent, danger }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="text-[11px] text-muted">{label}</div>
      <div className={`text-base font-bold ${danger ? 'text-red-600' : accent ? 'text-brand-600' : 'text-ink'}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-muted">{sub}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   KIRIM-CHIQIM — platformaning o'z xarajatlari
   (server, soliq, domen, bank komissiyasi va h.k.)
   ═══════════════════════════════════════════════ */
const EXPENSE_CATEGORIES = [
  ['server', 'Server xarajati'],
  ['tax', 'Soliq'],
  ['income_tax', "Daromad solig'i"],
  ['domain', 'Domen'],
  ['bank_fee', 'Bank komissiyasi'],
  ['fuel', "Yo'lkira"],
  ['salary', 'Ish haqi'],
  ['marketing', 'Reklama'],
  ['other', 'Boshqa'],
];

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function ExpensesTab() {
  const [month, setMonth] = useState(currentMonthStr());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: 'server', title: '', amount: '', note: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getExpenses(`?month=${month}`);
      setData(res);
    } catch { setData(null); }
    setLoading(false);
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.title.trim() || !Number(form.amount)) return;
    setSaving(true);
    try {
      await adminApi.createExpense({
        category: form.category,
        title: form.title.trim(),
        amount: Number(form.amount) * 100,   // som -> tiyin
        note: form.note.trim(),
      });
      setForm({ category: 'server', title: '', amount: '', note: '' });
      setShowForm(false);
      await load();
    } catch (e) {
      alert(e.message);
    }
    setSaving(false);
  };

  const remove = async (item) => {
    const ok = await confirm({
      title: "O'chirilsinmi?",
      content: `${item.title} — ${somT(item.amount)} so'm`,
      tone: 'danger',
      okText: "O'chirish",
    });
    if (!ok) return;
    await adminApi.deleteExpense(item._id);
    load();
  };

  if (loading && !data) return <div className="text-muted text-sm py-6">Yuklanmoqda...</div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-line px-3 py-1.5 text-sm"
        />
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-brand-400 px-3.5 py-1.5 text-sm font-semibold text-brand-text"
        >
          + Xarajat qo'shish
        </button>
      </div>

      {showForm && (
        <div className="mb-4 rounded-xl border border-line p-3.5">
          <Field label="Turkum">
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm"
            >
              {EXPENSE_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Nomi">
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Masalan: Avgust oyi server to'lovi"
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Summa (so'm)">
            <input
              type="number"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="500000"
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Izoh" hint="ixtiyoriy">
            <input
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm"
            />
          </Field>
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="flex-1 rounded-lg border border-line py-2 text-sm">
              Bekor
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 rounded-lg bg-brand-400 py-2 text-sm font-semibold text-brand-text disabled:opacity-50"
            >
              {saving ? '...' : 'Saqlash'}
            </button>
          </div>
        </div>
      )}

      {data && (
        <>
          <div className="mb-4 rounded-xl bg-canvas p-3.5">
            <div className="mb-1 flex justify-between">
              <span className="text-sm font-semibold text-ink">Jami xarajat</span>
              <span className="text-lg font-bold text-red-600">{somT(data.total)} so'm</span>
            </div>
            <div className="mt-2 space-y-1">
              {data.byCategory.map((c) => (
                <Row key={c.category} label={c.label} value={`${somT(c.amount)} so'm`} />
              ))}
            </div>
          </div>

          {data.items.length === 0 ? (
            <div className="text-muted text-sm py-6">Bu oyda xarajat yozilmagan</div>
          ) : (
            <div className="space-y-2">
              {data.items.map((item) => (
                <div key={item._id} className="flex items-center justify-between rounded-lg border border-line p-2.5">
                  <div>
                    <div className="text-sm font-medium text-ink">{item.title}</div>
                    <div className="text-[11px] text-muted">
                      {item.categoryLabel} · {new Date(item.date).toLocaleDateString('ru-RU')}
                      {item.note && ` · ${item.note}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-red-600">{somT(item.amount)} so'm</span>
                    <button onClick={() => remove(item)} className="text-muted hover:text-red-600">
                      <i className="ti ti-trash text-base" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
