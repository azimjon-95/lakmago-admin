import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi } from '@/api';
import { confirm } from '@/components/ui/confirm';
import { useLockScroll } from '@/hooks/useLockScroll';
import { PinForm } from './PinForm';
import {
  slotsView, fmtDT, remainingText, pinState, toInputValue, fromInputValue,
  findConflict, conflictMessage, DURATIONS,
} from '@/lib/pinSchedule';

/*
 * MIJOZ JALB QILISH → TOP JOYLAR
 * Mijoz ilovasidagi "Barcha restoranlar" ro'yxatida 1, 2, 3-o'ringa restoran pin
 * qilinadi (muddat bilan, oldindan belgilash mumkin). Qolgan restoranlar pastda
 * tasodifiy bo'lib qoladi. Muddat tugagach pin AVTOMATIK yo'qoladi (serverda).
 */
export function PinsManager() {
  const [pins, setPins] = useState([]);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [form, setForm] = useState(null);      // { position }
  const [extend, setExtend] = useState(null);  // pin
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await adminApi.getPins(false);
      setPins(Array.isArray(r?.pins) ? r.pins : []);
      setLoadErr('');
    } catch (e) { setLoadErr(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  // Qolgan vaqt matni 30 soniyada, ro'yxat 60 soniyada yangilanadi (muddat tugashi/boshlanishi ko'rinsin)
  useEffect(() => {
    const t1 = setInterval(() => setNow(Date.now()), 30_000);
    const t2 = setInterval(load, 60_000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, [load]);

  useEffect(() => {
    if (!showHistory) return;
    adminApi.getPins(true)
      .then((r) => setHistory((r?.pins || []).filter((p) => ['ended', 'cancelled'].includes(p.status)).sort((a, b) => new Date(b.endsAt) - new Date(a.endsAt)).slice(0, 30)))
      .catch(() => setHistory([]));
  }, [showHistory, pins.length]);

  const slots = useMemo(() => slotsView(pins, now), [pins, now]);

  const remove = async (pin) => {
    const active = pinState(pin, now) === 'active';
    const ok = await confirm({
      title: active ? 'Pindan chiqarilsinmi?' : 'Rejalashtirilgan pin bekor qilinsinmi?',
      content: active
        ? `${pin.restaurant?.name} ${pin.position}-o‘rindan DARHOL olinadi va tasodifiy ro‘yxatga qaytadi.`
        : `${pin.restaurant?.name} — ${fmtDT(pin.startsAt)} dagi pin bekor qilinadi, o‘rin bo‘shaydi.`,
      tone: 'danger',
      okText: active ? 'Olib tashlash' : 'Bekor qilish',
    });
    if (!ok) return;
    setBusyId(pin._id);
    try { await adminApi.cancelPin(pin._id); await load(); } catch (e) { alert(e.message); }
    setBusyId(null);
  };

  const closeForm = ({ keepOpen } = {}) => { load(); if (!keepOpen) setForm(null); };

  return (
    <div data-testid="pins-manager">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl text-sm text-muted">
          Mijoz ilovasi bosh sahifasidagi <b className="font-semibold text-ink">“Barcha restoranlar”</b> ro‘yxatida restoranni
          1, 2 yoki 3-o‘ringa qo‘ying. Qolganlari pastda tasodifiy bo‘ladi. Muddat tugagach restoran o‘zi pindan chiqadi.
        </p>
        <button onClick={() => setForm({ position: slots.find((s) => !s.active)?.position || 1 })} data-testid="add-pin"
          className="flex-none rounded-xl bg-brand-400 px-4 py-2 text-sm font-semibold text-white">
          <i className="ti ti-plus mr-1" />Pin qo‘yish
        </button>
      </div>

      {loadErr && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{loadErr}</div>}

      {loading ? (
        <div className="py-10 text-center text-sm text-muted">Yuklanmoqda...</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {slots.map((s) => (
            <SlotCard key={s.position} slot={s} now={now} busyId={busyId}
              onAdd={() => setForm({ position: s.position })}
              onExtend={setExtend} onRemove={remove} />
          ))}
        </div>
      )}

      <div className="mt-5">
        <button onClick={() => setShowHistory((v) => !v)} className="text-sm text-muted hover:text-ink" data-testid="toggle-history">
          <i className={`ti ${showHistory ? 'ti-chevron-up' : 'ti-chevron-down'} mr-1`} />Tarix (tugagan va bekor qilingan)
        </button>
        {showHistory && (
          <div className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface" data-testid="history">
            {history.length === 0 ? (
              <div className="px-4 py-4 text-center text-sm text-muted">Tarix bo‘sh</div>
            ) : history.map((p) => (
              <div key={p._id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="min-w-0"><b className="font-semibold text-ink">{p.restaurant?.name || '—'}</b> <span className="text-muted">· {p.position}-o‘rin</span></span>
                <span className="text-xs text-muted">
                  {fmtDT(p.startsAt)} — {fmtDT(p.endsAt)} · {p.status === 'cancelled' ? 'bekor qilindi' : 'tugadi'}{p.createdByName ? ` · ${p.createdByName}` : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {form && <PinForm pins={pins} defaultPosition={form.position} onClose={() => setForm(null)} onSaved={closeForm} />}
      {extend && <ExtendDialog pin={extend} pins={pins} now={now} onClose={() => setExtend(null)} onSaved={() => { setExtend(null); load(); }} />}
    </div>
  );
}

function SlotCard({ slot, now, busyId, onAdd, onExtend, onRemove }) {
  const { position, active, upcoming } = slot;
  return (
    <section className="rounded-xl border border-line bg-surface p-4" data-testid={`slot-${position}`}>
      <header className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-orange-50 text-sm font-bold text-brand-600">{position}</span>
        <h3 className="text-sm font-semibold text-ink">{position}-o‘rin</h3>
        {active ? (
          <span className="ml-auto rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700">Band</span>
        ) : (
          <span className="ml-auto rounded-full bg-canvas px-2 py-0.5 text-[11px] text-muted">Bo‘sh</span>
        )}
      </header>

      {active ? (
        <div data-testid="slot-active">
          <div className="truncate text-[15px] font-semibold text-ink">{active.restaurant?.name || '—'}</div>
          {active.restaurant && active.restaurant.visible === false && (
            <div className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-700">Restoran hozir mijozlarga ko‘rinmayapti (faol emas/bloklangan)</div>
          )}
          <div className="mt-1.5 text-xs text-muted">{fmtDT(active.startsAt)} — <b className="font-semibold text-ink">{fmtDT(active.endsAt)}</b> gacha</div>
          <span className="mt-1.5 inline-block rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700" data-testid="remaining">{remainingText(active.endsAt, now)} qoldi</span>
          {active.note && <div className="mt-1.5 text-xs italic text-muted">{active.note}</div>}
          <div className="mt-3 flex gap-2">
            <button onClick={() => onExtend(active)} className="flex-1 rounded-lg border border-line py-1.5 text-xs font-semibold text-ink hover:bg-canvas">Uzaytirish</button>
            <button onClick={() => onRemove(active)} disabled={busyId === active._id} data-testid="remove-active"
              className="flex-1 rounded-lg border border-red-200 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">Olib tashlash</button>
          </div>
        </div>
      ) : (
        <div className="py-3 text-center text-sm text-muted" data-testid="slot-empty">
          Hozir bo‘sh — bu o‘rinda tasodifiy restoran
          <button onClick={onAdd} className="mx-auto mt-2 block rounded-lg bg-canvas px-3 py-1.5 text-xs font-semibold text-ink ring-1 ring-line hover:bg-white">Pin qo‘yish</button>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="mt-3 border-t border-line pt-3" data-testid="upcoming">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Rejalashtirilgan</div>
          {upcoming.map((p) => (
            <div key={p._id} className="flex items-start justify-between gap-2 py-1.5 text-xs">
              <span className="min-w-0">
                <b className="block truncate font-semibold text-ink">{p.restaurant?.name}</b>
                <span className="text-muted">{fmtDT(p.startsAt)} → {fmtDT(p.endsAt)}</span>
              </span>
              <button onClick={() => onRemove(p)} disabled={busyId === p._id} className="mt-0.5 flex-none text-red-500 hover:text-red-700 disabled:opacity-40" aria-label="Bekor qilish" data-testid="remove-upcoming"><i className="ti ti-trash" /></button>
            </div>
          ))}
        </div>
      )}
      {active && (
        <button onClick={onAdd} className="mt-3 w-full text-center text-xs font-medium text-brand-600 hover:underline">+ Keyingi vaqtga qo‘shish</button>
      )}
    </section>
  );
}

/** Faol pin muddatini uzaytirish (boshlanishi o'zgarmaydi). */
function ExtendDialog({ pin, pins, now, onClose, onSaved }) {
  useLockScroll();
  const [endInput, setEndInput] = useState(() => toInputValue(pin.endsAt));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const endsAt = fromInputValue(endInput);
  const bad = !endsAt ? 'Tugash vaqtini kiriting'
    : new Date(endsAt) <= new Date(pin.startsAt) ? 'Tugash vaqti boshlanishdan keyin bo‘lishi kerak'
      : new Date(endsAt).getTime() <= now ? 'Tugash vaqti o‘tib ketgan' : '';
  const conflict = bad ? null : findConflict(pins, { restaurantId: pin.restaurantId, position: pin.position, startsAt: pin.startsAt, endsAt, excludeId: pin._id }, now);

  const add = (ms) => setEndInput(toInputValue(new Date(pin.endsAt).getTime() + ms));
  const save = async () => {
    setBusy(true); setErr('');
    try { await adminApi.updatePin(pin._id, { endsAt }); onSaved(); } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-5" data-testid="extend-dialog">
        <h3 className="text-base font-semibold text-ink">Muddatni uzaytirish</h3>
        <p className="mt-0.5 text-xs text-muted">{pin.restaurant?.name} · {pin.position}-o‘rin · hozir {fmtDT(pin.endsAt)} gacha (Toshkent vaqti)</p>
        <input type="datetime-local" value={endInput} onChange={(e) => setEndInput(e.target.value)}
          className="mt-3 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand-400" data-testid="extend-input" />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {DURATIONS.slice(1).map((d) => (
            <button key={d.label} type="button" onClick={() => add(d.ms)} className="rounded-full border border-line px-2.5 py-1 text-xs hover:border-brand-400" data-testid="extend-add">+{d.label}</button>
          ))}
        </div>
        {conflict && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" data-testid="extend-conflict">{conflictMessage(conflict, pin.position)}</div>}
        {!conflict && bad && <div className="mt-3 text-sm text-amber-700">{bad}</div>}
        {err && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}
        <div className="mt-4 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-line py-2 text-sm">Bekor</button>
          <button onClick={save} disabled={busy || Boolean(bad) || Boolean(conflict)} data-testid="extend-save" className="flex-1 rounded-xl bg-brand-400 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy ? '…' : 'Saqlash'}</button>
        </div>
      </div>
    </div>
  );
}
