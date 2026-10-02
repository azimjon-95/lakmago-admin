import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi } from '@/api';

/*
 * ERTALABKI TEKSHIRUV — barcha restoranlar bo'yicha kunlik holat (admin).
 * Restoran ochilganda xodimlarga "taomlarni tekshiring, stopdagilarni Stop-listga qo'shing"
 * xabari ketadi; bu yerda kim javob bergani, nechta eslatma ketgani ko'rinadi.
 */
const TZ = 'Asia/Tashkent';
export const todayTashkent = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
const hhmm = (d) => (d ? new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(d)) : '—');

export const STATUS = {
  pending: { label: 'Kutilmoqda', cls: 'bg-amber-50 text-amber-700' },
  checked_all_ok: { label: 'Hammasi bor', cls: 'bg-green-50 text-green-700' },
  checked_with_stop: { label: 'Stopga qo‘yildi', cls: 'bg-blue-50 text-blue-700' },
  not_sent: { label: 'Yuborilmagan', cls: 'bg-canvas text-muted' },
};
const VIA = { bot: 'Telegram bot', panel: 'Panel' };

export function MorningChecksPage() {
  const [date, setDate] = useState(todayTashkent);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      setData(await adminApi.getMorningChecks(date));
      setError('');
    } catch (e) { setError(e.message); }
  }, [date]);

  useEffect(() => { setData(null); load(); }, [load]);
  // Bugungi kun — har minut yangilanadi (xodimlar javob bera boshlaydi)
  useEffect(() => {
    if (date !== todayTashkent()) return undefined;
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [date, load]);

  const rows = useMemo(() => (data?.rows || []).filter((r) => filter === 'all' || r.status === filter), [data, filter]);
  const counts = data?.counts || {};

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6" data-testid="morning-page">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Ertalabki tekshiruv</h1>
          <p className="mt-0.5 text-sm text-muted">Restoran ochilganda xodimlarga stop-list eslatmasi ketadi va javoblar shu yerda ko‘rinadi.</p>
        </div>
        <label className="text-xs text-muted">
          Sana
          <input type="date" value={date} max={todayTashkent()} onChange={(e) => e.target.value && setDate(e.target.value)}
            data-testid="morning-date" className="mt-1 block rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink" />
        </label>
      </div>

      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600" data-testid="morning-page-error">{error}</div>}

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Holat">
        {[['all', 'Hammasi', data?.rows?.length ?? 0], ...Object.entries(STATUS).map(([k, v]) => [k, v.label, counts[k] || 0])].map(([k, label, n]) => (
          <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} data-testid={`filter-${k}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${filter === k ? 'border-brand-400 bg-brand-400/10 text-ink' : 'border-line bg-white text-muted hover:text-ink'}`}>
            {label} <b className="ml-1">{n}</b>
          </button>
        ))}
      </div>

      {!data && !error ? (
        <div className="py-10 text-center text-sm text-muted">Yuklanmoqda...</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[640px] text-sm" data-testid="morning-table">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5">Restoran</th>
                <th className="px-3 py-2.5">Ochilish</th>
                <th className="px-3 py-2.5">Holat</th>
                <th className="px-3 py-2.5 text-center">Eslatma</th>
                <th className="px-3 py-2.5">Javob bergan</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">Ma’lumot yo‘q</td></tr>
              )}
              {rows.map((r) => {
                const st = STATUS[r.status] || STATUS.not_sent;
                return (
                  <tr key={r.restaurantId} className="border-b border-line last:border-b-0" data-testid="morning-row">
                    <td className="px-4 py-2.5 font-medium text-ink">{r.name}</td>
                    <td className="px-3 py-2.5 text-muted">{r.openTime || '—'}</td>
                    <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span></td>
                    <td className="px-3 py-2.5 text-center text-muted">{r.reminderCount || 0}</td>
                    <td className="px-3 py-2.5 text-xs text-muted">
                      {r.respondedBy ? (
                        <><span className="font-medium text-ink">{r.respondedBy}</span> · {hhmm(r.respondedAt)}{r.respondedVia && (VIA[r.respondedVia] || r.respondedVia) !== r.respondedBy ? ` · ${VIA[r.respondedVia] || r.respondedVia}` : ''}</>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
