import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/api';

const som = (n) => (n ?? 0).toLocaleString('ru-RU').replace(/,/g, ' ');

const TYPE_LABEL = {
  payment_in: { text: 'Mijoz to\u2018lovi', color: 'text-green-600' },
  commission: { text: 'Komissiya', color: 'text-brand-600' },
  restaurant_due: { text: 'Restoranga', color: 'text-blue-600' },
  payout: { text: 'To\u2018landi', color: 'text-violet-600' },
  refund: { text: 'Qaytarildi', color: 'text-red-600' },
  adjustment: { text: 'Tuzatish', color: 'text-muted' },
};

export function BillingPage() {
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, r] = await Promise.all([
        adminApi.getBillingOverview(),
        adminApi.getBillingByRestaurant(),
      ]);
      setOverview(o);
      setRestaurants(r);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab !== 'ledger') return;
    adminApi.getLedger('?limit=150').then(setLedger).catch(() => {});
  }, [tab]);

  const doPayout = async (r) => {
    const amount = prompt(
      `${r.name} ga to'lov\n\nBalans: ${som(r.balans)} so'm\n\nQancha to'lanadi?`,
      String(r.balans),
    );
    if (!amount) return;
    try {
      await adminApi.payout({ restaurantId: r._id, amount: Number(amount) });
      load();
    } catch (e) { alert(e.message); }
  };

  const setCommission = async (r) => {
    const percent = prompt(
      `${r.name} — komissiya foizi\n\n` +
      `Hozir: ${r.commissionPercent ?? 'umumiy sozlama'}\n` +
      `Bo'sh qoldirilsa umumiy foiz ishlatiladi.`,
      String(r.commissionPercent ?? ''),
    );
    if (percent === null) return;

    const mode = prompt(
      'Komissiya qanday olinadi?\n\n' +
      'deduct — restoran ulushidan yechiladi (mijoz oddiy narx to\'laydi)\n' +
      'markup — taom narxiga qo\'shiladi (mijoz ko\'proq to\'laydi)',
      r.commissionMode || 'deduct',
    );
    if (mode === null) return;

    try {
      await adminApi.setCommission(r._id, {
        commissionPercent: percent === '' ? null : Number(percent),
        commissionMode: mode === '' ? null : mode,
      });
      load();
    } catch (e) { alert(e.message); }
  };

  if (loading) return <div className="p-6 text-muted">Yuklanmoqda...</div>;

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl font-semibold text-ink mb-1">Moliya</h1>
      <p className="text-sm text-muted mb-5">
        Pul harakati, komissiya va restoranlar bilan hisob-kitob
      </p>

      {/* Umumiy ko'rsatkichlar */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Stat label="Mijozlardan tushum" value={overview.tushum} color="text-green-600" />
          <Stat label="Platforma daromadi" value={overview.platformaDaromadi} color="text-brand-600" />
          <Stat label="Restoranlarga qarz" value={overview.restoranlargaQarz} color="text-blue-600" />
          <Stat label="Qaytarilgan" value={overview.qaytarilgan} color="text-red-600" />
        </div>
      )}

      {/* Bo'limlar */}
      <div className="flex gap-2 mb-4 border-b border-line">
        {[
          ['overview', 'Restoranlar'],
          ['ledger', 'Jurnal'],
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
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
        <div className="space-y-3">
          {restaurants.map((r) => (
            <div key={r._id} className="bg-surface border border-line rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="font-semibold text-ink">{r.name}</div>
                  <div className="text-xs text-muted mt-0.5">
                    Komissiya:{' '}
                    <b className="text-ink">
                      {r.commissionPercent != null ? `${r.commissionPercent}%` : 'umumiy'}
                    </b>
                    {r.commissionMode && ` · ${r.commissionMode === 'markup' ? 'narx ustiga' : 'ulushdan'}`}
                  </div>
                </div>
                <button
                  onClick={() => setCommission(r)}
                  className="text-xs border border-line px-3 py-1.5 rounded-lg text-muted hover:bg-canvas flex-none"
                >
                  Shartnoma
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <Mini label="Tushum" value={r.tushum} />
                <Mini label="Komissiya" value={r.komissiya} accent />
                <Mini label="To'langan" value={r.tolangan} />
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-line">
                <div>
                  <div className="text-xs text-muted">Qarzimiz</div>
                  <div className="text-lg font-bold text-ink">{som(r.balans)} so'm</div>
                </div>
                {r.balans > 0 && (
                  <button
                    onClick={() => doPayout(r)}
                    className="bg-brand-400 text-brand-text text-sm font-medium px-4 py-2 rounded-lg"
                  >
                    To'lash
                  </button>
                )}
              </div>
            </div>
          ))}
          {restaurants.length === 0 && (
            <div className="text-muted text-sm">Hozircha ma'lumot yo'q</div>
          )}
        </div>
      )}

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

function Stat({ label, value, color }) {
  return (
    <div className="bg-surface border border-line rounded-xl p-3.5">
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{som(value)}</div>
      <div className="text-[10px] text-muted">so'm</div>
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
