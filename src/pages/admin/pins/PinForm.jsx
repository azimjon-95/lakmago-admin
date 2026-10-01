import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '@/api';
import { useLockScroll } from '@/hooks/useLockScroll';
import {
  POSITIONS, DURATIONS, toInputValue, fromInputValue, fmtDT,
  findConflict, conflictMessage, nextFreeStart, validateForm,
} from '@/lib/pinSchedule';

/*
 * Yangi pin qo'yish. Hamma qoida OLDINDAN ko'rinadi: o'rin band bo'lsa kim va
 * qachongacha band ekani ko'rsatiladi va "Pin qo'yish" yoqilmaydi; "bo'shaydigan
 * vaqtdan boshlash" tugmasi vaqtni o'zi qo'yadi. Server baribir qayta tekshiradi.
 * Vaqt — TOSHKENT (UTC+5).
 */
export function PinForm({ pins, defaultPosition = 1, onClose, onSaved }) {
  useLockScroll();
  const [now] = useState(() => Date.now());

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [restaurant, setRestaurant] = useState(null);
  const [position, setPosition] = useState(defaultPosition);
  const [startNow, setStartNow] = useState(true);
  const [startInput, setStartInput] = useState(() => toInputValue(now + 3_600_000));
  const [endInput, setEndInput] = useState(() => toInputValue(now + 24 * 3_600_000));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Restoran qidirish (kichik kechikish bilan — har harfda so'rov ketmasin)
  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const rows = await adminApi.getPinRestaurants(query.trim());
        if (alive) setResults(Array.isArray(rows) ? rows : []);
      } catch (e) { if (alive) setErr(e.message); }
    }, query ? 250 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [query]);

  const checked = useMemo(
    () => validateForm({ restaurantId: restaurant?._id, position, startNow, startInput, endInput }, now),
    [restaurant, position, startNow, startInput, endInput, now],
  );
  const conflict = useMemo(
    () => (checked.error ? null : findConflict(pins, { restaurantId: restaurant._id, position, startsAt: checked.startsAt, endsAt: checked.endsAt }, now)),
    [checked, pins, restaurant, position, now],
  );

  const startMs = startNow ? now : new Date(fromInputValue(startInput) || now).getTime();
  const durationMs = (() => {
    const e = new Date(fromInputValue(endInput) || 0).getTime();
    return e > startMs ? e - startMs : 24 * 3_600_000;
  })();

  const applyDuration = (ms) => setEndInput(toInputValue(startMs + ms));
  /*
   * Eng erta bo'sh vaqt — keyingi to'liq DAQIQAGA YUQORIGA yaxlitlanadi. datetime-local
   * soniyani ko'rsatmaydi (pastga kesadi): yaxlitlanmasa boshlanish band pin tugashidan
   * bir necha soniya OLDIN bo'lib, to'qnashuv qolib ketardi.
   */
  const freeStartMs = () => Math.ceil(nextFreeStart(pins, position, startMs, durationMs, now) / 60_000) * 60_000;
  const startWhenFree = () => {
    const free = freeStartMs();
    setStartNow(false);
    setStartInput(toInputValue(free));
    setEndInput(toInputValue(free + durationMs));
  };

  const canSave = !checked.error && !conflict && !busy;
  const save = async () => {
    if (!canSave) return;
    setBusy(true); setErr('');
    try {
      await adminApi.createPin({ restaurantId: restaurant._id, position, startsAt: checked.startsAt, endsAt: checked.endsAt, note: note.trim() });
      onSaved();
    } catch (e) {
      setErr(e.message);
      onSaved({ keepOpen: true }); // 409 bo'lsa ro'yxat eskirgan — yangilanadi, forma ochiq qoladi
    } finally { setBusy(false); }
  };

  const inputCls = 'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-400';

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl" data-testid="pin-form">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-ink">Top joyga pin qo‘yish</h3>
            <p className="mt-0.5 text-xs text-muted">Vaqt Toshkent bo‘yicha (UTC+5)</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink" aria-label="Yopish"><i className="ti ti-x text-xl" /></button>
        </div>

        <div className="grid flex-1 content-start gap-4 overflow-y-auto p-5">
          {/* Restoran */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Restoran</label>
            {restaurant ? (
              <div className="flex items-center justify-between rounded-lg border border-brand-400 bg-orange-50/50 px-3 py-2" data-testid="selected-restaurant">
                <span className="truncate text-sm font-semibold text-ink">{restaurant.name}</span>
                <button type="button" onClick={() => setRestaurant(null)} className="text-xs text-brand-600 hover:underline">O‘zgartirish</button>
              </div>
            ) : (
              <>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Restoran nomini qidiring…" className={inputCls} data-testid="restaurant-search" />
                <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-line">
                  {results.length === 0 ? (
                    <div className="px-3 py-3 text-center text-xs text-muted">Restoran topilmadi</div>
                  ) : results.map((r) => (
                    <button key={r._id} type="button" onClick={() => setRestaurant(r)} data-testid="restaurant-option"
                      className="flex w-full items-center justify-between gap-2 border-b border-line px-3 py-2 text-left text-sm last:border-b-0 hover:bg-canvas">
                      <span className="truncate text-ink">{r.name}</span>
                      <span className="flex-none text-[11px] text-muted">{r.cuisine || r.category}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* O'rin */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">O‘rin</label>
            <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-canvas p-1" role="radiogroup" aria-label="O‘rin">
              {POSITIONS.map((p) => (
                <button key={p} type="button" role="radio" aria-checked={position === p} onClick={() => setPosition(p)}
                  className={`rounded-lg py-2 text-sm font-semibold transition-colors ${position === p ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
                  {p}-o‘rin
                </button>
              ))}
            </div>
          </div>

          {/* Vaqt */}
          <div className="grid gap-3">
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-medium text-ink">Boshlanish</label>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
                  <input type="checkbox" checked={startNow} onChange={(e) => setStartNow(e.target.checked)} data-testid="start-now" /> Hozirdan
                </label>
              </div>
              <input type="datetime-local" value={startNow ? toInputValue(now) : startInput} disabled={startNow}
                onChange={(e) => setStartInput(e.target.value)} className={`${inputCls} disabled:bg-canvas disabled:text-muted`} data-testid="start-input" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Tugash</label>
              <input type="datetime-local" value={endInput} onChange={(e) => setEndInput(e.target.value)} className={inputCls} data-testid="end-input" />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DURATIONS.map((d) => (
                  <button key={d.label} type="button" onClick={() => applyDuration(d.ms)} data-testid="duration"
                    className="rounded-full border border-line bg-white px-2.5 py-1 text-xs text-ink hover:border-brand-400">{d.label}</button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Izoh <span className="font-normal text-muted">(ixtiyoriy)</span></label>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Masalan: to‘lov 500 000, shartnoma №12" className={inputCls} />
          </div>

          {/* Holat: xato yoki to'qnashuv */}
          {conflict && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700" data-testid="conflict">
              <div className="flex items-start gap-2"><i className="ti ti-lock mt-0.5" /><span>{conflictMessage(conflict, position)}</span></div>
              {conflict.type === 'position' && (
                <button type="button" onClick={startWhenFree} className="mt-2 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50" data-testid="start-when-free">
                  Bo‘shaydigan vaqtdan boshlash ({fmtDT(freeStartMs())})
                </button>
              )}
            </div>
          )}
          {!conflict && checked.error && restaurant && <div className="text-sm text-amber-700" data-testid="form-hint">{checked.error}</div>}
          {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600" data-testid="server-error">{err}</div>}
          {!conflict && !checked.error && (
            <div className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700" data-testid="ok-hint">
              {position}-o‘rin bo‘sh: {fmtDT(checked.startsAt)} — {fmtDT(checked.endsAt)}. Muddat tugagach restoran o‘zi tasodifiy ro‘yxatga qaytadi.
            </div>
          )}
        </div>

        <div className="flex gap-3 border-t border-line px-5 py-4">
          <button onClick={onClose} className="flex-1 rounded-xl border border-line py-2.5 text-sm font-medium text-ink hover:bg-canvas">Bekor</button>
          <button onClick={save} disabled={!canSave} data-testid="save-pin"
            className="flex-[1.6] rounded-xl bg-brand-400 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
            {busy ? 'Saqlanmoqda…' : 'Pin qo‘yish'}
          </button>
        </div>
      </div>
    </div>
  );
}
