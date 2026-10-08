import { useEffect, useState, useCallback, useMemo } from 'react';
import { ownerApi } from '@/api';
import { ErrorBox, SESSION_LABEL, SESSION_ICON, som, thisMonth, todayIso } from '@/pages/wedding/common';
import { ReservationForm } from './ReservationForm';
import { useOwnerVenue } from './useOwnerVenue';

/*
 * ═══ KATTA KALENDAR — to'yxona egasi ═══
 * Telefonda ham qulay: katta kun kataklari, har katakda seanslar holati
 * (rangli chiziqlar). Kunga bosilsa — o'sha kun seanslari ro'yxati,
 * seansga bosilsa — band qilish / tahrirlash oynasi.
 * Mijoz qo'ng'iroq qilganda bo'sh kunni bir qarashda topish uchun.
 */
const WEEK = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];

const STATUS = {
  booked: { label: 'Band', bar: 'bg-red-500', chip: 'bg-red-50 text-red-700 border-red-200' },
  tentative: { label: 'Kelishilmoqda', bar: 'bg-amber-400', chip: 'bg-amber-50 text-amber-800 border-amber-200' },
  closed: { label: 'Yopiq', bar: 'bg-gray-400', chip: 'bg-gray-100 text-gray-600 border-gray-200' },
  free: { label: "Bo'sh", bar: 'bg-green-500', chip: 'bg-green-50 text-green-700 border-green-200' },
};

function shiftMonth(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const i = y * 12 + (m - 1) + n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
}

export function OwnerCalendarPage() {
  const { venue } = useOwnerVenue();
  const [month, setMonth] = useState(thisMonth());
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [hallId, setHallId] = useState('');
  const [day, setDay] = useState(null);       // tanlangan sana
  const [form, setForm] = useState(null);     // { session, entry? }

  const load = useCallback(async () => {
    setErr(null);
    try {
      const d = await ownerApi.calendar(month);
      setData(d);
      setHallId((h) => h || d.halls[0]?._id || '');
    } catch (e) { setErr(e.message); }
  }, [month]);
  useEffect(() => { load(); }, [load]);

  // entries → map: date|hall|session → entry
  const map = useMemo(() => {
    const m = new Map();
    for (const e of data?.entries || []) m.set(`${e.date}|${e.hall_id}|${e.session}`, e);
    return m;
  }, [data]);

  const sessions = data?.sessions || [];
  const today = data?.today || todayIso();

  const cells = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const lead = (first.getUTCDay() + 6) % 7; // Dushanbadan
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const out = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= days; d += 1) out.push(`${month}-${String(d).padStart(2, '0')}`);
    while (out.length % 7) out.push(null);
    return out;
  }, [month]);

  const statusOf = (date, session) => map.get(`${date}|${hallId}|${session}`)?.status || 'free';
  const monthStats = useMemo(() => {
    let busy = 0; let free = 0;
    for (const c of cells) {
      if (!c || c < today) continue;
      for (const s of sessions) (statusOf(c, s) === 'free' ? free++ : busy++);
    }
    return { busy, free };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, sessions, map, hallId, today]);

  const [y, m] = month.split('-').map(Number);

  return (
    <div className="flex-1 p-3 sm:p-6 min-w-0">
      {/* Oy boshqaruvi */}
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => setMonth((x) => shiftMonth(x, -1))} className="h-11 w-11 rounded-xl border border-line bg-surface flex items-center justify-center" aria-label="Oldingi oy">
          <i className="ti ti-chevron-left text-xl" />
        </button>
        <div className="flex-1 text-center">
          <div className="text-lg font-semibold text-ink leading-tight">{MONTHS[m - 1]} {y}</div>
          <div className="text-xs text-muted">{monthStats.free} bo'sh · {monthStats.busy} band seans</div>
        </div>
        <button onClick={() => setMonth((x) => shiftMonth(x, 1))} className="h-11 w-11 rounded-xl border border-line bg-surface flex items-center justify-center" aria-label="Keyingi oy">
          <i className="ti ti-chevron-right text-xl" />
        </button>
      </div>
      {month !== thisMonth() && (
        <div className="mb-3 text-center">
          <button onClick={() => setMonth(thisMonth())} className="text-xs font-medium text-brand-600">Bugungi oyga qaytish</button>
        </div>
      )}

      {/* Zal tanlash */}
      {data?.halls?.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-3">
          {data.halls.map((h) => (
            <button key={h._id} onClick={() => setHallId(h._id)}
              className={`flex-none rounded-full border px-4 py-2 text-sm font-medium ${hallId === h._id ? 'border-brand-400 bg-brand-400 text-brand-text' : 'border-line bg-surface text-muted'}`}>
              {h.name}
            </button>
          ))}
        </div>
      )}

      <ErrorBox error={err} onRetry={load} />

      {/* Seans belgilari */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2 text-[11px] text-muted">
        {sessions.map((s, i) => <span key={s}>{i + 1} — {SESSION_LABEL[s]}</span>)}
        <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-green-500" />bo'sh</span>
        <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-red-500" />band</span>
        <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-amber-400" />kelishilmoqda</span>
      </div>

      {/* Kalendar */}
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {WEEK.map((w, i) => <div key={w} className={`text-center text-[11px] font-semibold py-1 ${i >= 5 ? 'text-red-500' : 'text-muted'}`}>{w}</div>)}
        {cells.map((date, i) => {
          if (!date) return <div key={`e${i}`} />;
          const past = date < today;
          const isToday = date === today;
          const free = sessions.filter((s) => statusOf(date, s) === 'free').length;
          return (
            <button key={date} onClick={() => setDay(date)} disabled={!data}
              className={`relative flex min-h-[64px] sm:min-h-[92px] flex-col rounded-xl border p-1.5 text-left transition-colors active:scale-[0.97] ${
                isToday ? 'border-brand-400 ring-1 ring-brand-400' : 'border-line'} ${past ? 'bg-canvas/70 opacity-60' : 'bg-surface hover:border-brand-400'}`}>
              <span className={`text-sm sm:text-base font-semibold ${isToday ? 'text-brand-600' : 'text-ink'}`}>{Number(date.slice(8))}</span>
              <span className="mt-auto flex flex-col gap-[3px]">
                {sessions.map((s) => (
                  <span key={s} className={`h-[5px] sm:h-[7px] rounded-full ${STATUS[statusOf(date, s)].bar}`} />
                ))}
              </span>
              {!past && free === sessions.length && sessions.length > 0 && (
                <span className="absolute top-1.5 right-1.5 hidden sm:inline text-[10px] text-green-700">bo'sh</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tanlangan kun */}
      {day && data && (
        <DaySheet
          date={day}
          hall={data.halls.find((h) => h._id === hallId)}
          sessions={sessions}
          entryOf={(s) => map.get(`${day}|${hallId}|${s}`)}
          past={day < today}
          onClose={() => setDay(null)}
          onPick={(session, entry) => setForm({ session, entry })}
          onPrev={() => setDay((d) => shiftDay(d, -1))}
          onNext={() => setDay((d) => shiftDay(d, 1))}
        />
      )}

      {form && day && (
        <ReservationForm
          venue={venue}
          date={day}
          hallId={hallId}
          session={form.session}
          entry={form.entry}
          onClose={() => setForm(null)}
          onSaved={() => { setForm(null); load(); }}
        />
      )}
    </div>
  );
}

function shiftDay(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const WEEKDAY_FULL = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

function DaySheet({ date, hall, sessions, entryOf, past, onClose, onPick, onPrev, onNext }) {
  const d = new Date(`${date}T00:00:00Z`);
  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-t-2xl bg-white sm:rounded-2xl max-h-[88dvh] flex flex-col">
        <div className="flex items-center gap-2 border-b border-line px-3 py-3">
          <button onClick={onPrev} className="h-10 w-10 rounded-lg border border-line flex items-center justify-center" aria-label="Oldingi kun"><i className="ti ti-chevron-left" /></button>
          <div className="flex-1 text-center">
            <div className="font-semibold text-ink">{Number(date.slice(8))} {MONTHS[Number(date.slice(5, 7)) - 1]}, {WEEKDAY_FULL[d.getUTCDay()]}</div>
            <div className="text-xs text-muted">{hall?.name}</div>
          </div>
          <button onClick={onNext} className="h-10 w-10 rounded-lg border border-line flex items-center justify-center" aria-label="Keyingi kun"><i className="ti ti-chevron-right" /></button>
          <button onClick={onClose} className="h-10 w-10 text-muted" aria-label="Yopish"><i className="ti ti-x text-xl" /></button>
        </div>
        <div className="overflow-y-auto p-3 space-y-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {sessions.map((s) => {
            const e = entryOf(s);
            const st = STATUS[e?.status || 'free'];
            return (
              <button key={s} onClick={() => onPick(s, e)} disabled={past && !e}
                className={`w-full rounded-2xl border p-3.5 text-left transition-colors ${st.chip} disabled:opacity-50`}>
                <div className="flex items-center gap-2">
                  <i className={`ti ${SESSION_ICON[s]} text-lg`} />
                  <span className="font-semibold">{SESSION_LABEL[s]}</span>
                  <span className="ml-auto rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold">
                    {e?.kind === 'booking' ? 'Ilovadan · ' : ''}{st.label}
                  </span>
                </div>
                {e ? (
                  <div className="mt-1.5 text-sm text-ink">
                    <div className="font-medium">{e.title || '—'}{e.guests ? ` · ${e.guests} kishi` : ''}</div>
                    {e.phone && <div className="text-xs">{e.phone}</div>}
                    {e.total > 0 && (
                      <div className="text-xs mt-0.5">
                        Jami {som(e.total)} · to'langan <b>{som(e.paid)}</b>
                        {e.total - e.paid > 0 && <span className="text-red-600"> · qoldiq {som(e.total - e.paid)}</span>}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-1 text-xs">{past ? "O'tgan kun" : 'Bosing — band qilish'}</div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
