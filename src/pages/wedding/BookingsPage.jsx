import { useEffect, useState, useCallback } from 'react';
import { weddingApi } from '@/api';
import { confirm, confirmWithReason } from '@/components/ui/confirm';
import { PageHeader, ErrorBox, Empty, Badge, BOOKING_STATUS, SESSION_LABEL, EVENT_LABEL, som, todayIso } from './common';

/* To'yxona bronlarini kuzatish: holat, sana oralig'i, qidiruv; tasdiqlash / bekor qilish */
export function WeddingBookingsPage() {
  const [list, setList] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [f, setF] = useState({ status: '', from: todayIso(), to: '', q: '', venue_id: '' });
  const [busy, setBusy] = useState(null);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => { weddingApi.venues().then(setVenues).catch(() => {}); }, []);
  const load = useCallback(async () => {
    setErr(null);
    try { setList(await weddingApi.bookings({ ...f, q: f.q.trim() || undefined, limit: 300 })); }
    catch (e) { setErr(e.message); } finally { setLoading(false); }
  }, [f]);
  useEffect(() => { const t = setTimeout(load, f.q ? 300 : 0); return () => clearTimeout(t); }, [load, f.q]);

  const confirmB = async (b) => {
    if (!await confirm({ title: `${b.number}: avans to'langan deb tasdiqlansinmi?` })) return;
    setBusy(b.id);
    try { const r = await weddingApi.confirmBooking(b.id); setList((l) => l.map((x) => (x.id === b.id ? { ...x, ...r } : x))); }
    catch (e) { setErr(e.message); } finally { setBusy(null); }
  };
  const cancelB = async (b) => {
    const reason = await confirmWithReason(`${b.number} bekor qilinsinmi? Seans bo'shaydi.`, 'Sabab');
    if (reason === false) return;
    setBusy(b.id);
    try { const r = await weddingApi.cancelBooking(b.id, String(reason || 'admin').slice(0, 200)); setList((l) => l.map((x) => (x.id === b.id ? { ...x, ...r } : x))); }
    catch (e) { setErr(e.message); } finally { setBusy(null); }
  };

  return (
    <div className="flex-1 p-4 sm:p-6 min-w-0">
      <PageHeader title="Bronlar" subtitle={`${list.length} ta bron`} />
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        <input className="inp col-span-2" value={f.q} onChange={(e) => set('q', e.target.value)} placeholder="Raqam, mijoz, telefon" />
        <select className="inp" value={f.status} onChange={(e) => set('status', e.target.value)}>
          <option value="">Barcha holat</option>
          {Object.entries(BOOKING_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="inp" value={f.venue_id} onChange={(e) => set('venue_id', e.target.value)}>
          <option value="">Barcha to'yxona</option>
          {venues.map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}
        </select>
        <div className="col-span-2 sm:col-span-1 grid grid-cols-2 gap-1">
          <input className="inp" type="date" value={f.from} onChange={(e) => set('from', e.target.value)} title="Dan" />
          <input className="inp" type="date" value={f.to} onChange={(e) => set('to', e.target.value)} title="Gacha" />
        </div>
      </div>
      <ErrorBox error={err} onRetry={load} />
      {loading ? <div className="text-muted text-sm py-10 text-center">Yuklanmoqda...</div>
        : list.length === 0 ? <Empty icon="ti-calendar-off">Bron topilmadi</Empty>
          : (
            <div className="grid gap-2">
              {list.map((b) => {
                const st = BOOKING_STATUS[b.status] || BOOKING_STATUS.pending;
                return (
                  <div key={b.id} className="bg-surface border border-line rounded-xl p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-ink tabular-nums">{b.date}</span>
                          <span className="text-sm text-muted">· {SESSION_LABEL[b.session]} · {EVENT_LABEL[b.event_type] || b.event_type}</span>
                          <Badge cls={st.cls}>{st.label}</Badge>
                        </div>
                        <div className="text-sm text-ink mt-1">{b.venue_name} · {b.hall_name}</div>
                        <div className="text-xs text-muted mt-0.5">
                          #{b.number} · {b.customer_name} · <a href={`tel:${b.customer_phone}`} className="text-ink">{b.customer_phone}</a> · {b.guests} mehmon
                          {b.menu_name && ` · ${b.menu_name}`}
                        </div>
                        {b.extras?.length > 0 && (
                          <div className="text-xs text-muted mt-0.5">+ {b.extras.map((e) => `${e.name} (${som(e.price)})`).join(', ')}</div>
                        )}
                        {b.status === 'cancelled' && b.cancel_reason && <div className="text-xs text-red-600 mt-0.5">Sabab: {b.cancel_reason}</div>}
                      </div>
                      <div className="text-right flex-none">
                        <div className="font-semibold text-ink tabular-nums">{som(b.total)}</div>
                        <div className="text-[11px] text-muted">avans {som(b.deposit)}</div>
                      </div>
                    </div>
                    {(b.status === 'pending' || b.status === 'confirmed') && (
                      <div className="flex gap-2 mt-3">
                        {b.status === 'pending' && (
                          <button disabled={busy === b.id} onClick={() => confirmB(b)} className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm disabled:opacity-50">
                            <i className="ti ti-check" /> Avans to'landi
                          </button>
                        )}
                        <button disabled={busy === b.id} onClick={() => cancelB(b)} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-sm disabled:opacity-50">
                          <i className="ti ti-x" /> Bekor qilish
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
    </div>
  );
}
