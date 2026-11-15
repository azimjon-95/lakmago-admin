import { useState, useEffect, useRef, useMemo } from 'react';
import { adminApi } from '@/api';

const som = (n) => (n ?? 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const labelOf = (k) => (k === 'all' ? 'Barchasi' : `${MONTHS[Number(k.slice(5)) - 1]} ${k.slice(0, 4)}`);

/** Joriy oydan boshlab 12 oy + "Barchasi" */
function buildOptions() {
  const now = new Date();
  const list = [];
  for (let i = 0; i < 12; i++) list.push(keyOf(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  return [...list, 'all'];
}

export function RevenuePage() {
  const options = useMemo(buildOptions, []);
  const [month, setMonth] = useState(options[0]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const reqId = useRef(0);
  const chipsRef = useRef(null);

  const load = () => {
    const id = ++reqId.current;
    setLoading(true); setError('');
    adminApi.getRevenue(month)
      .then((d) => { if (id === reqId.current) setData(d); })
      .catch((e) => { if (id === reqId.current) setError(e.message || 'Yuklab bo‘lmadi'); })
      .finally(() => { if (id === reqId.current) setLoading(false); });
  };
  useEffect(load, [month]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    chipsRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [month]);

  // Eski server oy parametrini bilmaydi: javobda `month` yo'q bo'lsa, ko'rsatilgan raqamlar "Barchasi"
  const filterUnsupported = month !== 'all' && data && data.month !== month;

  const idx = options.indexOf(month);
  const step = (d) => { const n = options[idx + d]; if (n) setMonth(n); };

  const rows = data?.rows || [];
  const share = (r) => (data?.totals?.gross > 0 ? Math.max(2, Math.round((r.gross / data.totals.gross) * 100)) : 0);

  return (
    <div className="flex-1 p-4 sm:p-6 min-w-0">
      <h1 className="text-xl font-semibold text-ink">Daromad</h1>
      <p className="text-xs sm:text-sm text-muted mt-0.5 mb-4">
        Yetkazilgan buyurtmalar — har restoran o‘z komissiya foizi bilan
      </p>

      {/* Oy tanlash */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => step(1)} disabled={idx >= options.length - 1}
          className="h-10 w-10 shrink-0 rounded-xl border border-line bg-surface text-ink disabled:opacity-30 active:opacity-70" aria-label="Oldingi oy">
          <i className="ti ti-chevron-left" />
        </button>
        <div className="flex-1 min-w-0 text-center">
          <div className="text-base font-semibold text-ink truncate">{labelOf(month)}</div>
          {month === options[0] && <div className="text-[11px] text-muted -mt-0.5">joriy oy</div>}
        </div>
        <button onClick={() => step(-1)} disabled={idx <= 0}
          className="h-10 w-10 shrink-0 rounded-xl border border-line bg-surface text-ink disabled:opacity-30 active:opacity-70" aria-label="Keyingi oy">
          <i className="ti ti-chevron-right" />
        </button>
      </div>
      <div ref={chipsRef} className="-mx-4 sm:mx-0 px-4 sm:px-0 mb-5 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {options.map((k) => (
          <button key={k} data-active={k === month} onClick={() => setMonth(k)}
            className={`h-9 shrink-0 rounded-full px-4 text-sm font-medium border transition-colors ${k === month ? 'bg-brand-400 text-brand-text border-transparent' : 'bg-surface text-ink border-line active:opacity-70'}`}>
            {k === 'all' ? 'Barchasi' : `${MONTHS[Number(k.slice(5)) - 1].slice(0, 3)}${k.slice(0, 4) !== options[0].slice(0, 4) ? ` ’${k.slice(2, 4)}` : ''}`}
          </button>
        ))}
      </div>

      {error ? (
        <div>
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
            Daromadni yuklab bo&apos;lmadi: {error}
          </div>
          <button onClick={load} className="mt-3 h-11 rounded-xl bg-brand-400 px-5 text-sm font-semibold text-brand-text active:opacity-80">
            <i className="ti ti-refresh" /> Qayta urinish
          </button>
        </div>
      ) : !data ? (
        <div className="text-muted text-sm py-10 text-center">Yuklanmoqda...</div>
      ) : (
        <div className={loading ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
          {filterUnsupported && (
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
              Server hali oy filtrini qo‘llab-quvvatlamaydi — barcha vaqt bo‘yicha ko‘rsatilmoqda.
            </div>
          )}

          {/* Asosiy: bizning daromad */}
          <div className="bg-brand-50 border border-brand-200 rounded-2xl p-4 mb-3">
            <div className="text-xs text-brand-600">Bizning daromad</div>
            <div className="text-3xl font-bold text-brand-600 leading-tight mt-1">
              {som(data.totals.platform)} <span className="text-sm font-medium">so‘m</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-surface border border-line rounded-xl p-3">
              <div className="text-xs text-muted">Umumiy aylanma</div>
              <div className="text-base font-semibold text-ink mt-1 break-words">{som(data.totals.gross)}</div>
              <div className="text-[11px] text-muted">so‘m</div>
            </div>
            <div className="bg-surface border border-line rounded-xl p-3">
              <div className="text-xs text-muted">Restoranlar oldi</div>
              <div className="text-base font-semibold text-green-600 mt-1 break-words">{som(data.totals.restaurant)}</div>
              <div className="text-[11px] text-muted">so‘m</div>
            </div>
          </div>

          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-semibold text-ink">Muassasalar bo‘yicha</h2>
            <span className="text-xs text-muted">{rows.length} ta</span>
          </div>

          {rows.length === 0 ? (
            <div className="text-center text-muted text-sm py-12 border border-dashed border-line rounded-xl px-4">
              {month === 'all' ? 'Hozircha yetkazilgan buyurtma yo‘q.' : `${labelOf(month)} oyida yetkazilgan buyurtma yo‘q.`}
            </div>
          ) : (
            <>
              {/* Mobil: har muassasa — alohida karta, hech narsa kesilmaydi */}
              <div className="space-y-2 md:hidden">
                {rows.map((r) => {
                  const id = String(r.restaurantId);
                  const isOpen = open === id;
                  return (
                    <div key={id} className="bg-surface border border-line rounded-xl p-3">
                      <button className="w-full text-left" onClick={() => setOpen(isOpen ? null : id)}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold text-ink truncate">{r.name}</div>
                            <div className="text-xs text-muted mt-0.5">
                              {r.orders} ta buyurtma · {r.commissionMode === 'none' ? '—' : `${r.commissionPercent}%`}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[11px] text-muted">Bizga</div>
                            <div className="font-bold text-brand-600">{som(r.platformIncome)}</div>
                          </div>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-canvas overflow-hidden">
                          <div className="h-full rounded-full bg-brand-400" style={{ width: `${share(r)}%` }} />
                        </div>
                      </button>
                      {isOpen && (
                        <dl className="mt-3 pt-3 border-t border-line grid grid-cols-2 gap-y-2 text-sm">
                          <dt className="text-muted">Aylanma</dt><dd className="text-right text-ink">{som(r.gross)}</dd>
                          <dt className="text-muted">Restoran oldi</dt><dd className="text-right text-green-600">{som(r.restaurantIncome)}</dd>
                          <dt className="text-muted">Komissiya</dt><dd className="text-right text-ink">{r.commissionMode === 'none' ? '—' : `${r.commissionPercent}%`}</dd>
                          <dt className="text-muted">Buyurtmalar</dt><dd className="text-right text-ink">{r.orders}</dd>
                        </dl>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Planshet/kompyuter: jadval */}
              <div className="hidden md:block bg-surface border border-line rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted text-xs border-b border-line">
                      <th className="p-3 font-medium">Muassasa</th>
                      <th className="p-3 font-medium text-right">Buyurtma</th>
                      <th className="p-3 font-medium text-right">Aylanma</th>
                      <th className="p-3 font-medium text-right">Foiz</th>
                      <th className="p-3 font-medium text-right">Restoran</th>
                      <th className="p-3 font-medium text-right">Bizga</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.restaurantId} className="border-b border-line last:border-0">
                        <td className="p-3 text-ink font-medium">{r.name}</td>
                        <td className="p-3 text-right text-muted">{r.orders}</td>
                        <td className="p-3 text-right text-ink">{som(r.gross)}</td>
                        <td className="p-3 text-right text-muted">{r.commissionMode === 'none' ? '—' : `${r.commissionPercent}%`}</td>
                        <td className="p-3 text-right text-green-600">{som(r.restaurantIncome)}</td>
                        <td className="p-3 text-right text-brand-600 font-medium">{som(r.platformIncome)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
