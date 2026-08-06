import { useState, useEffect, useCallback } from 'react';
import { panelApi } from '@/api';

const som = (n) => (n ?? 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtDT = (d) => new Date(d).toLocaleString('ru-RU', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
});

const STATUS = {
  pending: { label: 'Yangi', cls: 'bg-amber-50 text-amber-700' },
  accepted: { label: 'Qabul', cls: 'bg-blue-50 text-blue-700' },
  preparing: { label: 'Tayyorlanmoqda', cls: 'bg-violet-50 text-violet-700' },
  ready: { label: 'Tayyor', cls: 'bg-green-50 text-green-700' },
  served: { label: 'Berildi', cls: 'bg-green-50 text-green-700' },
  completed: { label: 'Yakunlandi', cls: 'bg-canvas text-muted' },
  cancelled: { label: 'Bekor', cls: 'bg-red-50 text-red-600' },
};

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

export function DineInHistoryPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    from: daysAgo(7),
    to: today(),
    status: '',
    source: '',
  });
  const [open, setOpen] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const q = { page, limit: 25 };
    for (const [k, v] of Object.entries(filters)) if (v) q[k] = v;

    panelApi.getDineInHistory(q)
      .then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (k, v) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };

  const quick = (days) => {
    setFilters((f) => ({ ...f, from: daysAgo(days), to: today() }));
    setPage(1);
  };

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl font-semibold text-ink mb-1">Buyurtmalar tarixi</h1>
      <p className="text-sm text-muted mb-5">Zal buyurtmalari arxivi</p>

      {/* Tez tanlov */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {[[0, 'Bugun'], [6, 'Hafta'], [29, 'Oy']].map(([d, label]) => (
          <button key={label} onClick={() => quick(d)}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              filters.from === daysAgo(d) && filters.to === today()
                ? 'border-brand-400 bg-brand-50 text-brand-600'
                : 'border-line text-muted'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Filtrlar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
        <input type="date" value={filters.from}
          onChange={(e) => setFilter('from', e.target.value)} className="inp" />
        <input type="date" value={filters.to}
          onChange={(e) => setFilter('to', e.target.value)} className="inp" />
        <select value={filters.status}
          onChange={(e) => setFilter('status', e.target.value)} className="inp">
          <option value="">Barcha holat</option>
          {Object.entries(STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select value={filters.source}
          onChange={(e) => setFilter('source', e.target.value)} className="inp">
          <option value="">Barcha manba</option>
          <option value="qr">QR (mijoz)</option>
          <option value="waiter">Ofitsiant</option>
        </select>
      </div>

      {/* Jamlanma */}
      {data?.summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Stat label="Buyurtmalar" value={data.total} raw />
          <Stat label="Tushum" value={data.summary.revenue} />
          <Stat label="Xizmat haqi" value={data.summary.serviceFee} accent />
          <Stat label="Chegirma" value={data.summary.discount} />
        </div>
      )}

      {loading ? (
        <div className="text-muted text-sm">Yuklanmoqda...</div>
      ) : !data?.orders?.length ? (
        <div className="text-center py-12">
          <i className="ti ti-file-search text-4xl text-muted mb-3 block" />
          <div className="text-ink font-medium">Buyurtma topilmadi</div>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {data.orders.map((o) => {
              const st = STATUS[o.status] || STATUS.pending;
              const isOpen = open === o._id;

              return (
                <div key={o._id} className="bg-surface border border-line rounded-xl overflow-hidden">
                  <button onClick={() => setOpen(isOpen ? null : o._id)}
                    className="w-full p-3.5 flex items-center gap-3 text-left">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink">#{o.dineInNumber}</span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${st.cls}`}>
                          {st.label}
                        </span>
                        {o.orderSource === 'waiter' && (
                          <span className="text-[10px] text-brand-600">Ofitsiant</span>
                        )}
                      </div>
                      <div className="text-xs text-muted mt-0.5">
                        {o.tableId?.tableName || `Stol ${o.tableId?.tableNumber || '—'}`}
                        {' · '}{fmtDT(o.createdAt)}
                        {o.waiterName && ` · ${o.waiterName}`}
                      </div>
                    </div>
                    <div className="text-right flex-none">
                      <div className="font-semibold text-ink">{som(o.total)}</div>
                      <i className={`ti ti-chevron-${isOpen ? 'up' : 'down'} text-muted text-sm`} />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-3.5 pb-3.5 border-t border-line pt-3">
                      <div className="space-y-1 text-sm text-muted mb-2">
                        {o.items?.map((it, i) => (
                          <div key={i} className="flex justify-between gap-3">
                            <span>{it.name} ×{it.quantity}</span>
                            <span>{som(it.unitPrice * it.quantity)}</span>
                          </div>
                        ))}
                      </div>

                      <div className="text-xs space-y-1 pt-2 border-t border-line">
                        <Row label="Taomlar" value={som(o.subtotal)} />
                        {o.promotionDiscount > 0 && (
                          <Row label={o.promotionName || 'Aksiya'}
                            value={`−${som(o.promotionDiscount)}`} green />
                        )}
                        {o.bonusUsed > 0 && (
                          <Row label="Bonus" value={`−${som(o.bonusUsed)}`} green />
                        )}
                        {o.serviceFee > 0 && (
                          <Row label="Xizmat haqi" value={som(o.serviceFee)} />
                        )}
                      </div>

                      {o.note && (
                        <div className="text-xs text-muted bg-canvas rounded-lg px-3 py-2 mt-2">
                          {o.note}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Sahifalash */}
          {data.pages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-5">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 border border-line rounded-lg text-muted disabled:opacity-40">
                <i className="ti ti-chevron-left" />
              </button>
              <span className="text-sm text-muted">
                {page} / {data.pages}
              </span>
              <button onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                disabled={page >= data.pages}
                className="px-3 py-2 border border-line rounded-lg text-muted disabled:opacity-40">
                <i className="ti ti-chevron-right" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Row({ label, value, green }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className={green ? 'text-green-600' : 'text-ink'}>{value}</span>
    </div>
  );
}

function Stat({ label, value, raw, accent }) {
  return (
    <div className="bg-surface border border-line rounded-xl p-3.5">
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className={`text-lg font-bold ${accent ? 'text-brand-600' : 'text-ink'}`}>
        {raw ? value : som(value)}
      </div>
    </div>
  );
}
