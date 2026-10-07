import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { weddingApi } from '@/api';
import { confirm } from '@/components/ui/confirm';
import { PageHeader, ErrorBox, Empty, SubBadge, Badge, VENUE_STATUS, PAY_METHOD, som, thisMonth, fmtDate } from './common';
import { PaymentModal } from './PaymentModal';

/*
 * Oylik to'lovlar nazorati:
 *   1) Obuna holati — barcha to'yxonalar (qarzdorlar birinchi), bir bosishda to'lov qabul qilish
 *   2) Tanlangan oyda qabul qilingan to'lovlar va jami
 */
export function PaymentsPage() {
  const navigate = useNavigate();
  const [subs, setSubs] = useState([]);
  const [pays, setPays] = useState([]);
  const [month, setMonth] = useState(thisMonth());
  const [filter, setFilter] = useState('debt');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [payFor, setPayFor] = useState(null);

  const loadSubs = useCallback(() => weddingApi.subscriptions().then(setSubs), []);
  const loadPays = useCallback(() => weddingApi.payments({ month }).then(setPays), [month]);
  const load = useCallback(async () => {
    setErr(null);
    try { await Promise.all([loadSubs(), loadPays()]); } catch (e) { setErr(e.message); } finally { setLoading(false); }
  }, [loadSubs, loadPays]);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => subs.filter((v) => {
    const s = v.subscription_state?.state;
    if (filter === 'debt') return s === 'overdue' || s === 'never';
    if (filter === 'soon') return s === 'due_soon';
    if (filter === 'paid') return s === 'paid';
    return true;
  }), [subs, filter]);
  const counts = useMemo(() => ({
    debt: subs.filter((v) => ['overdue', 'never'].includes(v.subscription_state?.state)).length,
    soon: subs.filter((v) => v.subscription_state?.state === 'due_soon').length,
    paid: subs.filter((v) => v.subscription_state?.state === 'paid').length,
    all: subs.length,
  }), [subs]);
  const totalDebt = subs.reduce((s, v) => s + (v.subscription_state?.debt_amount || 0), 0);
  const monthTotal = pays.reduce((s, p) => s + (p.amount || 0), 0);

  const removePayment = async (p) => {
    if (!await confirm({ title: `${p.venue_name}: ${som(p.amount)} so'mlik to'lov o'chirilsinmi?`, tone: 'danger' })) return;
    try { await weddingApi.deletePayment(p._id); await Promise.all([loadSubs(), loadPays()]); } catch (e) { setErr(e.message); }
  };

  return (
    <div className="flex-1 p-4 sm:p-6 min-w-0">
      <PageHeader title="Oylik to'lovlar" subtitle={`Umumiy qarz: ${som(totalDebt)} so'm`} />
      <ErrorBox error={err} onRetry={load} />

      <div className="grid grid-cols-4 gap-1 rounded-xl border border-line bg-surface p-1 mb-3 sm:inline-grid">
        {[['debt', 'Qarzdorlar'], ['soon', 'Muddati yaqin'], ['paid', "To'langan"], ['all', 'Hammasi']].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap ${filter === k ? 'bg-brand-400 text-brand-text' : 'text-muted hover:bg-canvas'}`}>
            {l} <span className="opacity-60">{counts[k]}</span>
          </button>
        ))}
      </div>

      {loading ? <div className="text-muted text-sm py-10 text-center">Yuklanmoqda...</div>
        : shown.length === 0 ? <Empty icon="ti-circle-check">{filter === 'debt' ? 'Qarzdor to‘yxona yo‘q' : 'Bo‘sh'}</Empty>
          : (
            <div className="grid gap-2 mb-6">
              {shown.map((v) => (
                <div key={v._id} className="bg-surface border border-line rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                  <button onClick={() => navigate(`/weddings/venues/${v._id}`)} className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-ink">{v.name}</span>
                      <SubBadge s={v.subscription_state} />
                      {v.status !== 'active' && <Badge cls={VENUE_STATUS[v.status]?.cls}>{VENUE_STATUS[v.status]?.label}</Badge>}
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      {[v.district, v.owner?.name, v.owner?.phone].filter(Boolean).join(' · ')}
                      {' · '}Oylik: {v.subscription?.monthly_fee ? `${som(v.subscription.monthly_fee)} so'm` : '—'}
                      {v.subscription?.paid_until && ` · ${v.subscription.paid_until} gacha`}
                      {v.subscription_state?.debt_amount > 0 && <b className="text-red-600"> · qarz {som(v.subscription_state.debt_amount)}</b>}
                    </div>
                  </button>
                  {v.subscription?.monthly_fee > 0 && (
                    <button onClick={() => setPayFor(v)} className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm flex-none">
                      <i className="ti ti-cash" /> To'lov qabul qilish
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <h2 className="text-sm font-semibold text-ink">Qabul qilingan to'lovlar · <span className="text-green-700">{som(monthTotal)} so'm</span></h2>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value || thisMonth())} className="inp !w-auto" />
      </div>
      {pays.length === 0 ? <Empty icon="ti-receipt-off">Bu oyda to'lov yo'q</Empty> : (
        <div className="divide-y divide-line border border-line rounded-xl bg-surface">
          {pays.map((p) => (
            <div key={p._id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-ink truncate">{p.venue_name} · {som(p.amount)} so'm</div>
                <div className="text-xs text-muted">{PAY_METHOD[p.method] || p.method} · {p.period_from}{p.months > 1 ? ` dan ${p.months} oy` : ''} · {fmtDate(p.paid_at)}{p.note && ` · ${p.note}`}</div>
              </div>
              <button onClick={() => removePayment(p)} className="w-8 h-8 rounded-lg border border-line text-red-500 flex-none" aria-label="O'chirish"><i className="ti ti-trash" /></button>
            </div>
          ))}
        </div>
      )}

      {payFor && (
        <PaymentModal venue={payFor} onClose={() => setPayFor(null)}
          onSaved={() => { setPayFor(null); loadSubs(); loadPays(); }} />
      )}
    </div>
  );
}
