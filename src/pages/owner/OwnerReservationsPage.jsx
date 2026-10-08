import { useEffect, useState, useCallback } from 'react';
import { ownerApi } from '@/api';
import { PageHeader, ErrorBox, Empty, Badge, SESSION_LABEL, som, todayIso } from '@/pages/wedding/common';
import { ReservationForm } from './ReservationForm';
import { useOwnerVenue } from './useOwnerVenue';

/*
 * Bronlar ro'yxati (egasi kiritganlari): kelayotganlar, qidiruv,
 * to'lov holati (to'langan / qoldiq). Bosilsa — tahrirlash oynasi.
 */
const STATUS = {
  booked: { label: 'Band', cls: 'bg-red-50 text-red-700' },
  tentative: { label: 'Kelishilmoqda', cls: 'bg-amber-50 text-amber-800' },
  closed: { label: 'Yopiq', cls: 'bg-gray-100 text-gray-600' },
};

export function OwnerReservationsPage() {
  const { venue } = useOwnerVenue();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [q, setQ] = useState('');
  const [past, setPast] = useState(false);
  const [edit, setEdit] = useState(null);

  const load = useCallback(async () => {
    setErr(null);
    const today = todayIso();
    try {
      setList(await ownerApi.reservations(past ? { to: today, q: q.trim() || undefined } : { from: today, q: q.trim() || undefined }));
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  }, [q, past]);
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);

  const rows = past ? [...list].reverse() : list;
  const debt = list.reduce((s, r) => s + Math.max(0, (r.total_price || 0) - paidOf(r)), 0);

  return (
    <div className="flex-1 p-3 sm:p-6 min-w-0">
      <PageHeader title="Bronlar" subtitle={!past && debt > 0 ? `Mijozlardan olinadigan qoldiq: ${som(debt)} so'm` : undefined} />
      <div className="flex gap-2 mb-3">
        <input className="inp flex-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mijoz, telefon, izoh" />
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface p-1 flex-none">
          {[[false, 'Kelayotgan'], [true, "O'tgan"]].map(([k, l]) => (
            <button key={l} onClick={() => setPast(k)} className={`rounded-lg px-3 text-xs font-medium ${past === k ? 'bg-brand-400 text-brand-text' : 'text-muted'}`}>{l}</button>
          ))}
        </div>
      </div>
      <ErrorBox error={err} onRetry={load} />
      {loading ? <div className="text-muted text-sm py-10 text-center">Yuklanmoqda...</div>
        : rows.length === 0 ? <Empty icon="ti-calendar-off">Bron yo'q</Empty> : (
          <div className="grid gap-2">
            {rows.map((r) => {
              const paid = paidOf(r);
              const left = (r.total_price || 0) - paid;
              return (
                <button key={r._id} onClick={() => setEdit(r)} className="bg-surface border border-line rounded-xl p-3 text-left active:bg-canvas">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-ink tabular-nums">{r.date.split('-').reverse().join('.')}</span>
                    <span className="text-sm text-muted">· {SESSION_LABEL[r.session]} · {r.hall_name}</span>
                    <Badge cls={STATUS[r.status]?.cls}>{STATUS[r.status]?.label}</Badge>
                  </div>
                  <div className="text-sm text-ink mt-1">{r.customer_name || r.description || '—'}{r.guests ? ` · ${r.guests} kishi` : ''}</div>
                  {r.status !== 'closed' && r.total_price > 0 && (
                    <div className="text-xs mt-0.5">
                      Jami {som(r.total_price)} · to'langan <b className="text-green-700">{som(paid)}</b>
                      {left > 0 && <b className="text-red-600"> · qoldiq {som(left)}</b>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      {edit && (
        <ReservationForm venue={venue} date={edit.date} hallId={String(edit.hall_id)} session={edit.session}
          entry={{ kind: 'reservation', id: edit._id }}
          onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />
      )}
    </div>
  );
}

function paidOf(r) {
  return (r.payments || []).reduce((s, p) => s + (p.kind === 'refund' ? -p.amount : p.amount), 0);
}
