import { useCallback, useEffect, useState } from 'react';
import { ownerApi } from '@/api';
import { Badge, Empty, ErrorBox, SESSION_LABEL, som } from '@/pages/wedding/common';
import { useOwnerInbox } from '@/store/ownerInbox';
import { STATE_STYLE, ago, fmtDate, fmtDateTime, timeLeft, weekdayOf } from './helpers';
import { OwnerBell } from './OwnerBell';

/*
 * Mijoz bronlari ro'yxati: Yangi · Kelishildi · Tasdiqlangan · Tarix.
 * Bosilsa — to'liq ma'lumot va amallar (BookingSheet). Yangi so'rov kelsa ro'yxat o'zi yangilanadi
 * (ownerInbox store: version o'zgaradi) — qo'lda yangilash shart emas.
 */
const TABS = [
  ['new', 'Yangi', 'amber'],
  ['agreed', 'Kelishildi', 'blue'],
  ['confirmed', 'Tasdiqlangan', 'green'],
  ['history', 'Tarix', 'gray'],
];
const CHIP = {
  amber: 'bg-amber-400 text-white', blue: 'bg-blue-600 text-white', green: 'bg-green-600 text-white', gray: 'bg-gray-500 text-white',
};

export function OwnerRequests() {
  const counts = useOwnerInbox((s) => s.summary.counts);
  const version = useOwnerInbox((s) => s.version);
  const openBooking = useOwnerInbox((s) => s.openBooking);
  const [state, setState] = useState('new');
  const [items, setItems] = useState(null);
  const [err, setErr] = useState(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    setErr(null);
    try { setItems((await ownerApi.inbox(state)).items); } catch (e) { setErr(e.message); setItems((p) => p ?? []); }
  }, [state]);
  useEffect(() => { setItems(null); }, [state]);
  useEffect(() => { load(); }, [load, version]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="no-scrollbar flex flex-1 gap-1.5 overflow-x-auto">
          {TABS.map(([k, label, tone]) => {
            const n = counts[k];
            const on = state === k;
            return (
              <button key={k} onClick={() => setState(k)} className={`flex flex-none items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium ${on ? 'border-brand-400 bg-brand-400 text-brand-text' : 'border-line bg-surface text-muted'}`}>
                {label}
                {n > 0 && <span className={`min-w-[18px] rounded-full px-1.5 text-[11px] font-bold leading-[18px] ${on ? 'bg-white/80 text-ink' : CHIP[tone]}`}>{n}</span>}
              </button>
            );
          })}
        </div>
        <OwnerBell />
      </div>

      <ErrorBox error={err} onRetry={load} />
      {items === null ? (
        <div className="grid gap-2">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-canvas" />)}</div>
      ) : items.length === 0 ? (
        <Empty icon={state === 'new' ? 'ti-bell-off' : 'ti-calendar-off'}>
          {state === 'new' ? "Yangi so'rov yo'q. Mijoz bron qilsa, shu yerda va SMS orqali xabar keladi." : state === 'agreed' ? "Kelishilgan, avans kutilayotgan bron yo'q" : state === 'confirmed' ? "Kelayotgan tasdiqlangan bron yo'q" : "Tarix bo'sh"}
        </Empty>
      ) : (
        <div className="grid gap-2">
          {items.map((b) => <Card key={b.id} b={b} now={now} onOpen={() => openBooking(b.id)} />)}
        </div>
      )}
    </div>
  );
}

function Card({ b, now, onOpen }) {
  const st = STATE_STYLE[b.state] || STATE_STYLE.new;
  const fresh = b.state === 'new' && !b.seen_at;
  return (
    <button onClick={onOpen} className={`rounded-xl border bg-surface p-3 text-left active:bg-canvas ${fresh ? 'border-amber-300 ring-1 ring-amber-200' : 'border-line'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {fresh && <span className="h-2 w-2 flex-none animate-pulse rounded-full bg-amber-500" aria-label="Yangi" />}
            <span className="truncate font-semibold text-ink">{b.customer.name}</span>
          </div>
          <div className="text-xs text-muted">{b.customer.phone}</div>
        </div>
        <Badge cls={st.cls} icon={st.icon}>{st.label}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-ink">
        <span className="font-semibold tabular-nums">{fmtDate(b.date)}</span>
        <span className="text-muted">{weekdayOf(b.date).slice(0, 3)} · {SESSION_LABEL[b.session] || b.session} · {b.hall_name}</span>
      </div>
      <div className="mt-0.5 text-sm text-ink">{b.guests} kishi · <b>{som(b.total_effective)}</b> so'm</div>
      <div className="mt-1.5 text-[11px] text-muted">
        {b.state === 'new' && <>{ago(b.created_at, now)} · javob muddati: {timeLeft(b.hold_until, now)}</>}
        {b.state === 'agreed' && <>Avans muddati: <b className="text-blue-700">{fmtDateTime(b.advance_due)}</b> · {timeLeft(b.advance_due, now)}</>}
        {b.state === 'confirmed' && <>To'langan <b className="text-green-700">{som(b.paid)}</b>{b.balance > 0 && <b className="text-red-600"> · qoldiq {som(b.balance)}</b>}</>}
        {['rejected', 'cancelled'].includes(b.state) && (b.reject_reason || 'Bekor qilingan')}
        {['expired', 'completed'].includes(b.state) && ago(b.created_at, now)}
      </div>
    </button>
  );
}
