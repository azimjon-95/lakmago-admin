import { useState, useEffect, useCallback, useRef } from 'react';
import { adminApi } from '@/api';
import { MoneyInput } from '@/components/form/NumberInput';
import { useLockScroll } from '@/hooks/useLockScroll';
import { confirm } from '@/components/ui/confirm';

const som = (n) => (n ?? 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtDT = (d) => new Date(d).toLocaleString('ru-RU', {
  day: '2-digit', month: '2-digit', year: '2-digit',
  hour: '2-digit', minute: '2-digit',
});

const SUB_STATUS = {
  active: { label: 'Faol', cls: 'bg-green-50 text-green-700' },
  suspended: { label: "To'xtatilgan", cls: 'bg-amber-50 text-amber-700' },
  expired: { label: 'Tugagan', cls: 'bg-canvas text-muted' },
};

export function PromoAdminPage() {
  const [tab, setTab] = useState('overview');

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl font-semibold text-ink mb-1">
        Mijozlarni jalb qilish
      </h1>
      <p className="text-sm text-muted mb-5">
        Aksiya, reklama va bonuslar — tarif va qarzdorlik nazorati
      </p>

      <div className="flex gap-2 mb-4 border-b border-line overflow-x-auto">
        {[
          ['overview', "Umumiy ko'rsatkich"],
          ['restaurants', 'Restoranlar'],
          ['tariff', 'Tarif'],
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
              tab === k ? 'border-brand-400 text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview />}
      {tab === 'restaurants' && <Restaurants />}
      {tab === 'tariff' && <Tariff />}
    </div>
  );
}

/* ═══ Umumiy ═══ */
function Overview() {
  const [data, setData] = useState(null);

  useEffect(() => {
    adminApi?.getPromoAdminOverview().then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="text-muted text-sm">Yuklanmoqda...</div>;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label="Faol restoranlar" value={data.faolRestoranlar} raw />
        <Stat label="Faol aksiyalar" value={data.faolAksiyalar} raw />
        <Stat label="Faol reklamalar" value={data.faolReklamalar} raw />
        <Stat label="Faol bonuslar" value={data.faolBonuslar} raw />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Bugungi hisob" value={data.bugungiHisob} />
        <Stat label="Jami qarzdorlik" value={data.jamiQarz} danger />
        <Stat label="Jami to'langan" value={data.jamiTolangan} accent />
        <Stat label="Delivery orqali" value={data.deliveryOrqali} />
      </div>

      <div className="bg-surface border border-line rounded-xl p-4 mt-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm text-ink font-medium">Kunlik tarif</div>
            <div className="text-xs text-muted mt-0.5">
              Aksiya va reklama uchun bitta narx
            </div>
          </div>
          <div className="text-lg font-bold text-brand-600">
            {som(data.kunlikNarx)} so'm
          </div>
        </div>

        <div className="text-xs text-muted mt-3 pt-3 border-t border-line">
          Qarzni delivery tushumidan ushlab qolish:{' '}
          <b className={data.settlementYoqilgan ? 'text-green-600' : 'text-muted'}>
            {data.settlementYoqilgan ? 'yoqilgan' : "o'chiq"}
          </b>
        </div>
      </div>
    </>
  );
}

/* ═══ Restoranlar ═══ */
function Restaurants() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [billing, setBilling] = useState(null);
  const timer = useRef(null);

  const load = useCallback((query = '') => {
    setLoading(true);
    adminApi.getPromoRestaurants(query)
      .then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => load(q.trim()), q ? 400 : 0);
    return () => clearTimeout(timer.current);
  }, [q, load]);

  const setStatus = async (r, status) => {
    const label = status === 'suspended' ? "to'xtatilsinmi" : 'yoqilsinmi';
    if (!await confirm({ title: `${r.name} xizmati ${label}?` })) return;
    try {
      await adminApi.setPromoStatus(r._id, status);
      load(q.trim());
    } catch (e) { alert(e.message); }
  };

  return (
    <>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Restoran nomi yoki telefon..."
        className="inp mb-4"
      />

      {loading ? (
        <div className="text-muted text-sm">Yuklanmoqda...</div>
      ) : items.length === 0 ? (
        <div className="text-muted text-sm py-8 text-center">Topilmadi</div>
      ) : (
        <div className="space-y-2.5">
          {items.map((r) => {
            const st = r.subscription
              ? SUB_STATUS[r.subscription.status]
              : null;

            return (
              <div key={r._id} className="bg-surface border border-line rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="font-medium text-ink truncate">{r.name}</div>
                    {r.phone && <div className="text-xs text-muted">{r.phone}</div>}
                  </div>
                  {st && (
                    <span className={`text-[11px] font-medium px-2 py-1 rounded-full flex-none ${st.cls}`}>
                      {st.label}
                    </span>
                  )}
                </div>

                {/* Xizmatlar */}
                <div className="flex gap-2 flex-wrap mb-3">
                  <Chip on={r.aksiya} label="Aksiya" />
                  <Chip on={r.reklama} label="Reklama" />
                  <Chip on={r.bonus} label="Bonus" />
                </div>

                {r.subscription && (
                  <div className="text-xs text-muted mb-3">
                    Boshlangan: {fmtDT(r.subscription.startedAt)} ·
                    {' '}{som(r.subscription.dailyPrice)} so'm / 24h
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-canvas rounded-lg py-2 text-center">
                    <div className="text-[10px] text-muted">Qarz</div>
                    <div className={`text-sm font-bold ${
                      r.qarz > 0 ? 'text-red-600' : 'text-ink'
                    }`}>
                      {som(r.qarz)}
                    </div>
                  </div>
                  <div className="bg-canvas rounded-lg py-2 text-center">
                    <div className="text-[10px] text-muted">To'langan</div>
                    <div className="text-sm font-bold text-ink">{som(r.tolangan)}</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setBilling(r)}
                    className="flex-1 border border-line text-muted py-2 rounded-lg text-sm"
                  >
                    Tarix
                  </button>

                  {r.subscription?.status === 'active' ? (
                    <button
                      onClick={() => setStatus(r, 'suspended')}
                      className="px-3 border border-amber-200 text-amber-700 py-2 rounded-lg text-sm"
                    >
                      To'xtatish
                    </button>
                  ) : r.subscription ? (
                    <button
                      onClick={() => setStatus(r, 'active')}
                      className="px-3 border border-green-200 text-green-700 py-2 rounded-lg text-sm"
                    >
                      Yoqish
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {billing && (
        <BillingModal
          restaurant={billing}
          onClose={() => setBilling(null)}
          onPaid={() => { setBilling(null); load(q.trim()); }}
        />
      )}
    </>
  );
}

function BillingModal({ restaurant, onClose, onPaid }) {
  useLockScroll();

  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminApi.getPromoBilling(restaurant._id).then(setData).catch(() => {});
  }, [restaurant._id]);

  useEffect(() => { load(); }, [load]);

  const pay = async () => {
    if (!await confirm({ title: 
      `${som(data.debt)} so'mlik qarz to'langan deb belgilanadi.\n\nDavom etilsinmi?`,
     })) return;

    setBusy(true);
    try {
      const r = await adminApi.markPromoPaid(restaurant._id);
      alert(r.message);
      onPaid();
    } catch (e) {
      alert(e.message);
      setBusy(false);
    }
  };

  return (
    <div onClick={onClose}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 overflow-y-auto max-h-[88dvh]">
        <div className="flex items-center justify-between mb-4">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-ink truncate">{restaurant.name}</h3>
            <p className="text-xs text-muted">Qarzdorlik tarixi</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink flex-none">
            <i className="ti ti-x text-xl" />
          </button>
        </div>

        {!data ? (
          <div className="text-muted text-sm">Yuklanmoqda...</div>
        ) : (
          <>
            <div className="bg-canvas rounded-xl p-4 mb-4 text-center">
              <div className="text-xs text-muted">Joriy qarz</div>
              <div className={`text-2xl font-bold ${
                data.debt > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {som(data.debt)} so'm
              </div>
              {data.periods > 0 && (
                <div className="text-xs text-muted mt-0.5">
                  {data.periods} ta to'lanmagan davr
                </div>
              )}
            </div>

            <div className="max-h-64 overflow-y-auto border border-line rounded-xl mb-4">
              {data.items.map((b) => (
                <div key={b._id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 border-b border-line last:border-0">
                  <div className="min-w-0">
                    <div className="text-xs text-ink">
                      {fmtDT(b.periodStart)} → {fmtDT(b.periodEnd)}
                    </div>
                    {b.paidVia && (
                      <div className="text-[10px] text-muted">
                        {b.paidVia === 'settlement' ? 'Delivery tushumidan' : "Qo'lda"}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-none">
                    <div className="text-sm font-medium text-ink">{som(b.amount)}</div>
                    <div className={`text-[10px] font-medium ${
                      b.status === 'paid' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {b.status === 'paid' ? "TO'LANGAN" : "TO'LANMAGAN"}
                    </div>
                  </div>
                </div>
              ))}
              {data.items.length === 0 && (
                <div className="text-sm text-muted p-4 text-center">Yozuv yo'q</div>
              )}
            </div>

            {data.debt > 0 && (
              <button onClick={pay} disabled={busy}
                className="w-full bg-green-500 text-white font-medium py-3 rounded-xl disabled:opacity-50">
                {busy ? '...' : "To'landi deb belgilash"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ═══ Tarif ═══ */
function Tariff() {
  const [data, setData] = useState(null);
  const [price, setPrice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(() => {
    adminApi.getPromoTariff().then((d) => {
      setData(d);
      setPrice(d.dailyPrice);
    }).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (extra = {}) => {
    setSaving(true); setMsg(null);
    try {
      await adminApi.updatePromoTariff({
        ...(price != null ? { dailyPrice: Number(price) } : {}),
        ...extra,
      });
      setMsg({ ok: true, text: 'Saqlandi' });
      load();
      setTimeout(() => setMsg(null), 2500);
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (!data) return <div className="text-muted text-sm">Yuklanmoqda...</div>;

  return (
    <div className="max-w-3xl space-y-4">
      <section className="bg-surface border border-line rounded-xl p-4">
        <h2 className="text-sm font-semibold text-ink mb-1">Kunlik narx</h2>
        <p className="text-xs text-muted mb-3">
          Aksiya va reklama birga ishlatilsa ham bitta narx olinadi
        </p>

        <MoneyInput value={price} onChange={setPrice} placeholder="15 000" />

        <p className="text-[11px] text-muted mt-2">
          Yangi narx faqat keyingi billing davrlariga qo'llanadi.
          Eski yozuvlar o'zgarmaydi.
        </p>

        <button onClick={() => save()} disabled={saving}
          className="w-full mt-3 bg-brand-400 text-brand-text font-medium py-2.5 rounded-xl disabled:opacity-50">
          {saving ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
      </section>

      <section className="bg-surface border border-line rounded-xl p-4">
        <label className="flex items-start justify-between gap-4 cursor-pointer">
          <div>
            <div className="text-sm text-ink">Delivery tushumidan ushlab qolish</div>
            <div className="text-xs text-muted mt-0.5">
              Restoranga to'lov qilinganda qarz avtomatik yechiladi
            </div>
          </div>
          <input type="checkbox"
            checked={data.deductFromSettlement}
            onChange={(e) => save({ deductFromSettlement: e.target.checked })}
            className="w-5 h-5 accent-brand-400 flex-none mt-0.5" />
        </label>
      </section>

      <section className="bg-surface border border-line rounded-xl p-4">
        <label className="flex items-start justify-between gap-4 cursor-pointer">
          <div>
            <div className="text-sm text-ink">Aksiya va bonus birga</div>
            <div className="text-xs text-muted mt-0.5">
              O'chiq bo'lsa faqat eng foydali chegirma qo'llanadi
            </div>
          </div>
          <input type="checkbox"
            checked={data.allowDiscountStacking}
            onChange={(e) => save({ allowDiscountStacking: e.target.checked })}
            className="w-5 h-5 accent-brand-400 flex-none mt-0.5" />
        </label>
      </section>

      {data.history?.length > 0 && (
        <section className="bg-surface border border-line rounded-xl p-4">
          <h2 className="text-sm font-semibold text-ink mb-3">Tarif tarixi</h2>
          <div className="space-y-2">
            {data.history.map((h) => (
              <div key={h._id} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted">{fmtDT(h.createdAt)}</span>
                <span className="text-ink">
                  {som(h.oldPrice)} → <b>{som(h.newPrice)}</b>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {msg && (
        <div className={`text-sm rounded-lg px-3 py-2 ${
          msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
        }`}>
          {msg.text}
        </div>
      )}
    </div>
  );
}

/* ═══ Umumiy ═══ */
function Stat({ label, value, raw, accent, danger }) {
  return (
    <div className="bg-surface border border-line rounded-xl p-3.5">
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className={`text-lg font-bold ${
        danger ? 'text-red-600' : accent ? 'text-green-600' : 'text-ink'
      }`}>
        {raw ? value : som(value)}
      </div>
      {!raw && <div className="text-[10px] text-muted">so'm</div>}
    </div>
  );
}

function Chip({ on, label }) {
  return (
    <span className={`text-[11px] px-2 py-1 rounded-full ${
      on ? 'bg-green-50 text-green-700' : 'bg-canvas text-muted'
    }`}>
      {label} {on ? 'ON' : 'OFF'}
    </span>
  );
}
