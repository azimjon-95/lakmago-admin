import { useState, useEffect } from 'react';
import { adminApi } from '@/api';

const som = (n) => (n ?? 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const MODE_LABEL = { none: 'Komissiyasiz', markup: 'Narx ustiga', deduct: 'Narxdan olish' };

export function RevenuePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getRevenue().then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex-1 p-6 text-muted text-sm">Yuklanmoqda...</div>;
  if (!data) return <div className="flex-1 p-6 text-muted text-sm">Ma'lumot yo'q</div>;

  return (
    <div className="flex-1 p-4 sm:p-6 min-w-0">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-ink">Daromad</h1>
          <p className="text-sm text-muted mt-0.5">
            Yetkazilgan buyurtmalar bo'yicha · Komissiya: {data.commissionPercent}% ({MODE_LABEL[data.commissionMode]})
          </p>
        </div>
      </div>

      {/* Umumiy kartalar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="text-xs text-muted mb-1">Umumiy aylanma</div>
          <div className="text-xl font-semibold text-ink">{som(data.totals.gross)}</div>
          <div className="text-[11px] text-muted mt-0.5">so'm</div>
        </div>
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="text-xs text-muted mb-1">Restoranlar oldi</div>
          <div className="text-xl font-semibold text-green-600">{som(data.totals.restaurant)}</div>
          <div className="text-[11px] text-muted mt-0.5">so'm</div>
        </div>
        <div className="bg-brand-50 border border-brand-200 rounded-xl p-4">
          <div className="text-xs text-brand-600 mb-1">Bizning daromad</div>
          <div className="text-xl font-semibold text-brand-600">{som(data.totals.platform)}</div>
          <div className="text-[11px] text-brand-600 mt-0.5">so'm</div>
        </div>
      </div>

      {/* Muassasalar bo'yicha */}
      <h2 className="text-sm font-medium text-ink mb-3">Muassasalar bo'yicha</h2>
      {data.rows.length === 0 ? (
        <div className="text-center text-muted text-sm py-12 border border-dashed border-line rounded-xl">
          Hozircha yetkazilgan buyurtma yo'q. Buyurtmalar yetkazilgach daromad shu yerda ko'rinadi.
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          {/* Mobilda ustunlar sig'masa gorizontal scroll bilan */}
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-left text-muted text-xs border-b border-line">
                <th className="p-3 font-medium">Muassasa</th>
                <th className="p-3 font-medium text-right">Buyurtma</th>
                <th className="p-3 font-medium text-right">Aylanma</th>
                <th className="p-3 font-medium text-right">Restoran</th>
                <th className="p-3 font-medium text-right">Bizga</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.restaurantId} className="border-b border-line last:border-0">
                  <td className="p-3 text-ink font-medium">{r.name}</td>
                  <td className="p-3 text-right text-muted">{r.orders}</td>
                  <td className="p-3 text-right text-ink">{som(r.gross)}</td>
                  <td className="p-3 text-right text-green-600">{som(r.restaurantIncome)}</td>
                  <td className="p-3 text-right text-brand-600 font-medium">{som(r.platformIncome)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
