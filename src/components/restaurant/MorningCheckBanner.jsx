import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { panelApi } from '@/api';
import { getSocket } from '@/lib/socket';

/*
 * ERTALABKI OCHILISH TEKSHIRUVI — restoran paneli banneri.
 *
 * Restoran ochilganda server (va Telegram bot) xodimlarga "taomlarni tekshiring, stopdagilarni
 * Stop-listga qo'shing" deb eslatadi. Bot ishlamasa/xodim ulanmagan bo'lsa ham shu banner
 * ko'rinadi. FAQAT status === 'pending' bo'lganda ko'rinadi (ochilishdan oldin, yopilgach,
 * dam kunida yoki javob berilgach — null/yopiq).
 *
 *   🛑 Stopga quyish — Menyu sahifasiga o'tadi (har taomda Stop tugmasi);
 *   ✅ Barchasi bor  — "bugun tekshirildi": banner ham, botdagi eslatmalar ham to'xtaydi.
 */
export const MORNING_TEXT = 'Retoran ochilishi bilan taomlarizni rekshirib oling ish boshlashdan oldin '
  + 'Stopdagi taomlarizni Stop listga qushib quying esizdan chiqmasin '
  + 'mijizlarni hurmat qilaylik bugungi boshlagan ishizni olloh barokatli qilsin';

export function MorningCheckBanner() {
  const navigate = useNavigate();
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const alive = useRef(true);
  const inflight = useRef(false);   // state yangilanishini kutmaydi: tez ikki marta bosish ikkinchi so'rov yubormasin

  const load = useCallback(async () => {
    try {
      const r = await panelApi.getMorningCheck();
      if (alive.current) setState(r);
    } catch { /* banner jim: xato bo'lsa ko'rinmaydi, sahifa ishiga xalaqit bermaydi */ }
  }, []);

  useEffect(() => {
    alive.current = true;
    load();
    const timer = setInterval(load, 60_000);
    const onVisible = () => { if (document.visibilityState !== 'hidden') load(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    let socket = null;
    try { socket = getSocket(); socket?.on?.('morning:check', load); } catch { /* socket yo'q — polling yetadi */ }
    return () => {
      alive.current = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      try { socket?.off?.('morning:check', load); } catch { /* */ }
    };
  }, [load]);

  if (state?.status !== 'pending') return null;

  const allOk = async () => {
    if (inflight.current) return;
    inflight.current = true;
    setBusy(true); setErr('');
    try {
      await panelApi.morningCheckAllOk();
      if (alive.current) setState((s) => ({ ...s, status: 'checked_all_ok' }));
    } catch (e) {
      if (alive.current) setErr(e.message || 'Saqlab bo‘lmadi, qayta urinib ko‘ring');
    } finally {
      inflight.current = false;
      if (alive.current) setBusy(false);
    }
  };

  return (
    <section
      role="region"
      aria-label="Ertalabki tekshiruv"
      data-testid="morning-banner"
      className="mx-4 mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm sm:mx-6"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <i className="ti ti-sunrise text-xl" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-amber-900">Ertalabki tekshiruv</div>
          <p className="mt-1 text-[13px] leading-snug text-amber-900" data-testid="morning-text">{MORNING_TEXT}</p>
          {state?.reminderCount > 0 && (
            <div className="mt-1 text-[11px] text-amber-700" data-testid="morning-reminders">Eslatma: {state.reminderCount} marta yuborilgan</div>
          )}
        </div>
      </div>

      {err && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600" data-testid="morning-error">{err}</div>}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => navigate('/menu')}
          data-testid="morning-stop"
          className="whitespace-nowrap rounded-xl border border-amber-300 bg-white px-2 py-2.5 text-[13px] font-semibold text-amber-900 hover:bg-amber-100"
        >
          🛑 Stopga quyish
        </button>
        <button
          type="button"
          onClick={allOk}
          disabled={busy}
          data-testid="morning-ok"
          className="whitespace-nowrap rounded-xl bg-green-600 px-2 py-2.5 text-[13px] font-semibold text-white hover:bg-green-700 disabled:opacity-60"
        >
          {busy ? 'Saqlanmoqda…' : '✅ Barchasi bor'}
        </button>
      </div>
    </section>
  );
}
