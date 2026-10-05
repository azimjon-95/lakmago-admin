import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminApi } from '@/api';
import { getSocket, joinAdmin } from '@/lib/socket';
import { Img } from '@/components/Img';

/*
 * Vaqt formatlash: bugun bo'lsa soat, aks holda sana.
 *
 * DOIM Toshkent vaqtida — Telegram guruhidagi bot posti ham Toshkent
 * vaqtini yozadi (services/supportGroupNotify.js). Avval qurilma vaqti
 * ishlatilardi: boshqa mintaqadagi telefonda guruhda «19:18», panelda
 * «17:18» chiqib, bir xabar ikki xil vaqtda ko'rinardi.
 */
const TZ = 'Asia/Tashkent';
const ymd = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
function fmtTime(d) {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return ymd(date) === ymd(new Date())
    ? date.toLocaleTimeString('ru-RU', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('ru-RU', { timeZone: TZ, day: '2-digit', month: '2-digit' });
}

// Mongo ObjectId — URL'dagi ?chat= qiymati shunga mos bo'lishi shart
const isObjectId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

// Kun ajratgichi: "Bugun", "Kecha", "05.10.2026" (Toshkent bo'yicha)
function dayLabel(d) {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  const k = ymd(date);
  if (k === ymd(new Date())) return 'Bugun';
  if (k === ymd(new Date(Date.now() - 86_400_000))) return 'Kecha';
  return date.toLocaleDateString('ru-RU', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
}
const hhmm = (d) => {
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('ru-RU', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
};

/** media query'ni jonli kuzatadi */
function useMedia(query) {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false);
  const [match, setMatch] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, [query]);
  return match;
}

/*
 * Mobilda ko'rinadigan maydon (klaviatura ochilganda kichrayadi).
 * iOS'da 100vh/100dvh klaviaturani hisobga olmaydi — yozish maydoni
 * klaviatura ostida qolib, pastki menyu ustiga chiqib ketardi.
 * visualViewport aynan ko'rinib turgan qismni beradi.
 */
function useVisualViewport(enabled) {
  const [box, setBox] = useState(null);
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!enabled || !vv) { setBox(null); return undefined; }
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setBox({ top: vv.offsetTop, height: vv.height }));
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [enabled]);
  return box;
}

export function SupportPage() {
  const [chats, setChats] = useState([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [activeId, setActiveId] = useState(null);
  const [active, setActive] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [notice, setNotice] = useState('');
  // Tahrir rejimi: { id, original, draft } — draft: tahrirdan oldingi qoralama
  const [editing, setEditing] = useState(null);
  // Xabar amallari oynasi: { message, confirm } | null
  const [sheet, setSheet] = useState(null);
  const [sheetBusy, setSheetBusy] = useState(false);
  // Qisqa xabar (toast): { text, tone }
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(0);
  const flash = useCallback((text, tone = 'ok') => {
    clearTimeout(toastTimer.current);
    setToast({ text, tone });
    toastTimer.current = setTimeout(() => setToast(null), tone === 'ok' ? 2200 : 4500);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const isDesktop = useMedia('(min-width: 1024px)');
  // Sichqoncha/klaviatura qurilmasi: Enter — yuborish. Telefonda Enter — yangi qator.
  const finePointer = useMedia('(pointer: fine)');
  const bodyRef = useRef(null);
  /*
   * ?chat=<id> — Telegram guruhidagi "Xabarlar bo'limiga o'tish" tugmasi
   * aynan shu mijoz suhbatiga olib keladi. URL suhbat bilan sinxron:
   * sahifa yangilansa ham suhbat ochiq qoladi, mobil "orqaga" ro'yxatga qaytaradi.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const chatParam = searchParams.get('chat');
  // Tez-tez bosilganda eski javob yangisini bosib ketmasin
  const openSeq = useRef(0);
  const activeIdRef = useRef(null);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  const audioRef = useRef(null);

  // Ovozli signal (yangi xabar kelganda)
  const playSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
    } catch { /* ovoz ishlamasa ham davom */ }
  }, []);

  const loadList = useCallback(async () => {
    try {
      const data = await adminApi.getSupportChats(showResolved);
      setChats(data.chats || []);
      setTotalUnread(data.totalUnread || 0);
    } catch { /* ignore */ }
  }, [showResolved]);

  useEffect(() => { loadList(); }, [loadList]);

  // Suhbatni ochish (ro'yxatdan bosilganda ham, URL'dan ham)
  const openChat = useCallback(async (id, { fromUrl = false } = {}) => {
    const seq = ++openSeq.current;
    setActiveId(id);
    setNotice('');
    // Boshqa suhbatga o'tildi — tahrir/oyna/qoralama shu suhbatga tegishli emas
    setEditing(null);
    setSheet(null);
    setReply('');
    // URL'ni suhbatga moslaymiz (tarixga yangi yozuv qo'shmasdan)
    if (!fromUrl) setSearchParams({ chat: id }, { replace: true });
    try {
      const data = await adminApi.getSupportChat(id);
      if (seq !== openSeq.current) return; // boshqa suhbat ochilib ulgurdi
      setActive(data);
      // Havola yopilgan suhbatga olib kelsa — o'ng ro'yxat ham "Yopilgan"ga o'tadi
      if (fromUrl) setShowResolved(Boolean(data?.isResolved));
      loadList(); // badge yangilansin
    } catch (e) {
      if (seq !== openSeq.current) return;
      setActiveId(null);
      setActive(null);
      setSearchParams({}, { replace: true });
      setNotice(e?.message?.includes('topilmadi')
        ? 'Suhbat topilmadi — o‘chirilgan bo‘lishi mumkin'
        : 'Suhbatni ochib bo‘lmadi. Qayta urinib ko‘ring.');
    }
  }, [loadList, setSearchParams]);

  const closeChat = useCallback(() => {
    openSeq.current += 1;
    setEditing(null);
    setSheet(null);
    setReply('');
    setActiveId(null);
    setActive(null);
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  // URL'dagi ?chat= — Telegram tugmasidan kelganda suhbatni darhol ochamiz
  useEffect(() => {
    if (!chatParam) return;
    if (!isObjectId(chatParam)) {
      setSearchParams({}, { replace: true });
      setNotice('Havola noto‘g‘ri — suhbat topilmadi');
      return;
    }
    if (chatParam !== activeId) openChat(chatParam, { fromUrl: true });
    // activeId ataylab yo'q: faqat URL o'zgarganda ishlaydi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatParam]);

  /*
   * "Online" holati — Telegram kabi ishlaydi.
   *
   * Sahifa ochiq VA oyna faol bo'lsa — online. Boshqa ilova/
   * oynaga o'tilsa yoki sahifadan chiqilsa — darhol offline,
   * mijoz "N daqiqa oldin faol edi" ko'radi. Refreshsiz,
   * socket orqali jonli.
   */
  useEffect(() => {
    const socket = getSocket();

    const isForeground = () => document.visibilityState === 'visible' && document.hasFocus();

    // Juda tez-tez almashib ketmasin (masalan boshqa oynaga
    // sichqoncha bilan tegib o'tish) — kichik kechikish bilan
    let debounce = null;
    const sync = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        socket.emit(isForeground() ? 'support:presence:online' : 'support:presence:offline');
      }, 300);
    };

    sync();   // sahifa ochilganda darhol
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    window.addEventListener('blur', sync);

    return () => {
      clearTimeout(debounce);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
      window.removeEventListener('blur', sync);
      // Sahifadan butunlay chiqilmoqda (boshqa admin bo'limiga
      // o'tish) — darhol offline
      socket.emit('support:presence:offline');
    };
  }, []);

  // Real-time: yangi xabar
  useEffect(() => {
    const socket = getSocket();
    joinAdmin();

    const onMessage = (msg) => {
      playSound();
      loadList();
      // Ochiq suhbatga tegishli bo'lsa — darhol qo'shamiz
      setActive((cur) => {
        if (!cur || String(cur._id) !== msg.chatId) return cur;
        return { ...cur, messages: [...cur.messages, { from: 'user', text: msg.text, createdAt: msg.at }] };
      });
    };
    // Boshqa admin xabarni tahrirladi/o'chirdi — ochiq suhbat qayta yuklanadi
    const onChanged = ({ chatId } = {}) => {
      loadList();
      if (!chatId || chatId !== activeIdRef.current) return;
      adminApi.getSupportChat(chatId)
        .then((data) => { if (activeIdRef.current === chatId) setActive(data); })
        .catch(() => {});
    };
    socket.on('support:message', onMessage);
    socket.on('support:read', loadList);
    socket.on('support:resolved', loadList);
    socket.on('support:changed', onChanged);

    return () => {
      socket.off('support:message', onMessage);
      socket.off('support:read', loadList);
      socket.off('support:resolved', loadList);
      socket.off('support:changed', onChanged);
    };
  }, [loadList, playSound]);

  // Xabarlar oxiriga scroll: suhbat ochilganda — darhol, yangi xabarda — silliq.
  // Tahrir/o'chirishda (soni kamaysa) sakramaydi.
  const lastCount = useRef({ id: null, n: 0 });
  useLayoutEffect(() => {
    const el = bodyRef.current;
    const n = active?.messages?.length || 0;
    if (!el || !active) return;
    const sameChat = lastCount.current.id === active._id;
    if (!sameChat) el.scrollTop = el.scrollHeight;
    else if (n > lastCount.current.n) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    lastCount.current = { id: active._id, n };
  }, [active?._id, active?.messages?.length]);

  // Mobil overlay o'lchami (klaviatura) — o'zgarganda pastga yopishib turadi
  const mobileChat = !isDesktop && Boolean(activeId);
  const vbox = useVisualViewport(mobileChat);
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (el && mobileChat) el.scrollTop = el.scrollHeight;
  }, [vbox?.height, mobileChat]);

  /*
   * Yuborish / tahrirni saqlash. Muvaffaqiyatsiz bo'lsa matn O'CHMAYDI —
   * admin qayta urinishi mumkin (avval xatoda alert chiqib, matn qolardi,
   * lekin muvaffaqiyatli yuborilgan-yuborilmagani aniq emas edi).
   */
  const send = async () => {
    const text = reply.trim();
    if (!text || !activeId || sending) return;
    setSending(true);
    try {
      if (editing) {
        if (text === editing.original) { cancelEdit(); return; }
        const res = await adminApi.editSupportMessage(activeId, editing.id, text);
        setActive((cur) => cur ? {
          ...cur,
          messages: cur.messages.map((m) => (String(m._id) === editing.id
            ? { ...m, text, editedAt: res?.message?.editedAt || new Date().toISOString() } : m)),
        } : cur);
        if (res?.telegram === 'failed') flash('Ilovada tahrirlandi. Botdagi xabarni tahrirlab bo‘lmadi.', 'warn');
        else flash('Xabar tahrirlandi');
        setReply(editing.draft || '');
        setEditing(null);
      } else {
        const res = await adminApi.replySupport(activeId, text);
        setActive((cur) => cur ? { ...cur, messages: [...cur.messages, res.message] } : cur);
        setReply('');
      }
      loadList();
    } catch (e) {
      flash(e?.message || 'Yuborilmadi. Internetni tekshirib qayta urinib ko‘ring.', 'error');
    } finally {
      setSending(false);
    }
  };

  // Tahrirni boshlash — joriy qoralama saqlanadi va tahrirdan keyin qaytadi (Telegram kabi)
  const startEdit = (m) => {
    setEditing({ id: String(m._id), original: m.text, draft: editing ? editing.draft : reply });
    setReply(m.text);
    setSheet(null);
  };
  const cancelEdit = useCallback(() => {
    setEditing((cur) => {
      if (cur) setReply(cur.draft || '');
      return null;
    });
  }, []);

  const removeMessage = async (m) => {
    const msgId = String(m._id);
    setSheetBusy(true);
    try {
      const res = await adminApi.deleteSupportMessage(activeId, msgId);
      setActive((cur) => cur ? { ...cur, messages: cur.messages.filter((x) => String(x._id) !== msgId) } : cur);
      if (editing?.id === msgId) cancelEdit();
      setSheet(null);
      if (res?.telegram === 'failed') flash('Ilovadan o‘chirildi. Botdagi xabar 48 soatdan eski — u yerda qoldi.', 'warn');
      else flash('Xabar o‘chirildi');
      loadList();
    } catch (e) {
      flash(e?.message || 'O‘chirib bo‘lmadi', 'error');
    } finally {
      setSheetBusy(false);
    }
  };

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      flash('Nusxalandi');
    } catch {
      flash('Nusxalab bo‘lmadi', 'error');
    }
    setSheet(null);
  };

  const toggleResolve = async () => {
    if (!activeId) return;
    try {
      await adminApi.resolveSupport(activeId, !active?.isResolved);
      setActive((cur) => cur ? { ...cur, isResolved: !cur.isResolved } : cur);
      loadList();
    } catch (e) {
      flash(e?.message || 'Holatni o‘zgartirib bo‘lmadi', 'error');
    }
  };

  const fullName = (c) => `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.username || 'Mijoz';
  const initials = (c) => fullName(c).slice(0, 2).toUpperCase();

  return (
    <div className="flex-1 flex min-w-0 h-screen">
      {/* Suhbatlar ro'yxati — mobilda chat ochilganда yashiriladi */}
      <div className={`w-full lg:w-80 border-r border-line flex-col flex-none ${
        activeId ? 'hidden lg:flex' : 'flex'
      }`}>
        <div className="p-4 border-b border-line">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-semibold text-ink">Xabarlar</h1>
            {totalUnread > 0 && (
              <span className="text-xs font-bold px-2 py-1 rounded-full bg-red-500 text-white">
                {totalUnread}
              </span>
            )}
          </div>
          <div className="flex bg-canvas rounded-lg p-0.5 border border-line">
            <button
              onClick={() => setShowResolved(false)}
              className={`flex-1 px-3 py-1.5 rounded-md text-sm ${!showResolved ? 'bg-brand-400 text-brand-text font-medium' : 'text-muted'}`}
            >
              Faol
            </button>
            <button
              onClick={() => setShowResolved(true)}
              className={`flex-1 px-3 py-1.5 rounded-md text-sm ${showResolved ? 'bg-brand-400 text-brand-text font-medium' : 'text-muted'}`}
            >
              Yopilgan
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {notice && (
            <div className="mx-3 mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <i className="ti ti-alert-triangle mt-[1px] flex-none" />
              <span className="flex-1">{notice}</span>
              <button onClick={() => setNotice('')} aria-label="Yopish" className="flex-none opacity-70">
                <i className="ti ti-x" />
              </button>
            </div>
          )}
          {chats.length === 0 ? (
            <div className="text-center text-muted text-sm py-10 px-4">
              {showResolved ? 'Yopilgan suhbat yo‘q' : 'Yangi xabar yo‘q'}
            </div>
          ) : chats.map((c) => (
            <button
              key={c._id}
              onClick={() => openChat(c._id)}
              className={`w-full text-left px-4 py-3 border-b border-line hover:bg-canvas transition-colors ${
                activeId === c._id ? 'bg-canvas' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Telegram rasmi yoki bosh harflar */}
                {c.photoUrl ? (
                  <Img src={c.photoUrl} w={80} className="w-10 h-10 rounded-full object-cover flex-none" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-text flex items-center justify-center text-xs font-bold flex-none">
                    {initials(c)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-ink truncate">{fullName(c)}</span>
                    <span className="text-[11px] text-muted flex-none">{fmtTime(c.lastMessageAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-xs text-muted truncate">{c.lastMessageText}</span>
                    {c.unreadCount > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white flex-none">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Suhbat oynasi — mobilda butun ekran (pastki menyu ustida), desktopda o'ng ustun */}
      {activeId ? (
        <div
          className={isDesktop
            ? 'flex-1 flex flex-col min-w-0'
            : 'fixed inset-x-0 z-[65] flex flex-col bg-canvas'}
          style={isDesktop ? undefined : { top: vbox?.top ?? 0, height: vbox?.height ?? '100dvh' }}
        >
          {/* Sarlavha */}
          <div className={`flex items-center gap-2 border-b border-line bg-surface/95 px-2 py-2 backdrop-blur sm:gap-3 sm:px-4 ${
            isDesktop ? '' : 'pt-[max(0.5rem,env(safe-area-inset-top))]'}`}>
            <button
              onClick={closeChat}
              className="lg:hidden flex h-10 w-10 flex-none items-center justify-center rounded-full text-ink active:bg-canvas"
              aria-label="Orqaga"
            >
              <i className="ti ti-arrow-left text-xl" />
            </button>
            {active?.photoUrl ? (
              <Img src={active.photoUrl} w={96} className="h-10 w-10 flex-none rounded-full object-cover" />
            ) : (
              <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-text">
                {active ? initials(active) : ''}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold leading-tight text-ink">
                {active ? fullName(active) : 'Yuklanmoqda…'}
              </div>
              {active && (
                <div className="truncate text-xs text-muted">
                  {[active.username && `@${active.username}`, active.phone, active.telegramId && `ID ${active.telegramId}`]
                    .filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
            {active && (active.username || active.telegramId) && (
              <a
                href={active.username ? `https://t.me/${active.username}` : `tg://user?id=${active.telegramId}`}
                target="_blank"
                rel="noreferrer"
                title="Telegramda yozish"
                className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-[#229ED9] active:bg-canvas lg:hover:bg-canvas"
              >
                <i className="ti ti-brand-telegram text-xl" />
              </a>
            )}
            {active && (
              <button
                onClick={toggleResolve}
                title={active.isResolved ? 'Suhbatni qayta ochish' : 'Hal qilindi deb belgilash'}
                className={`flex h-9 flex-none items-center gap-1.5 rounded-full border px-3 text-sm font-medium ${
                  active.isResolved
                    ? 'border-line text-muted active:bg-canvas lg:hover:bg-canvas'
                    : 'border-green-300 text-green-700 active:bg-green-50 lg:hover:bg-green-50'
                }`}
              >
                <i className={`ti ${active.isResolved ? 'ti-refresh' : 'ti-check'} text-base`} />
                <span className="hidden sm:inline">{active.isResolved ? 'Qayta ochish' : 'Hal qilindi'}</span>
              </button>
            )}
          </div>

          {/* Xabarlar */}
          <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-canvas px-3 py-3 sm:px-5">
            {!active ? (
              <div className="flex h-full items-center justify-center text-muted">
                <i className="ti ti-loader-2 animate-spin text-2xl" />
              </div>
            ) : (active.messages || []).length === 0 ? (
              <div className="py-10 text-center text-sm text-muted">Xabarlar yo‘q</div>
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
                {active.messages.map((m, i) => {
                  const prev = active.messages[i - 1];
                  const newDay = !prev || ymd(new Date(prev.createdAt)) !== ymd(new Date(m.createdAt));
                  return (
                    <div key={m._id || `t${i}`}>
                      {newDay && (
                        <div className="my-2 flex justify-center">
                          <span className="rounded-full bg-black/[0.06] px-3 py-0.5 text-[11px] font-medium text-muted">
                            {dayLabel(m.createdAt)}
                          </span>
                        </div>
                      )}
                      <Bubble
                        m={m}
                        editingNow={editing?.id === String(m._id)}
                        onTap={() => m.text && setSheet({ message: m, confirm: false })}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Qisqa xabar (toast) */}
          {toast && (
            <div className="pointer-events-none relative">
              <div className={`absolute bottom-2 left-1/2 z-10 max-w-[90%] -translate-x-1/2 rounded-full px-4 py-2 text-center text-xs font-medium shadow-lg ${
                toast.tone === 'error' ? 'bg-red-600 text-white'
                  : toast.tone === 'warn' ? 'bg-amber-500 text-white' : 'bg-ink/90 text-white'}`}>
                {toast.text}
              </div>
            </div>
          )}

          {/* Yozish maydoni */}
          {active && (
            <Composer
              value={reply}
              onChange={setReply}
              onSubmit={send}
              sending={sending}
              editing={editing}
              onCancelEdit={cancelEdit}
              enterSends={finePointer}
              safeBottom={!isDesktop}
            />
          )}
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center text-muted">
          <div className="text-center">
            <i className="ti ti-message-circle text-5xl opacity-30" />
            <p className="mt-3 text-sm">Suhbatni tanlang</p>
          </div>
        </div>
      )}

      {/* Xabar amallari */}
      {sheet && (
        <ActionSheet
          message={sheet.message}
          confirm={sheet.confirm}
          busy={sheetBusy}
          onClose={() => !sheetBusy && setSheet(null)}
          onEdit={() => startEdit(sheet.message)}
          onCopy={() => copyText(sheet.message.text)}
          onAskDelete={() => setSheet((cur) => cur && { ...cur, confirm: true })}
          onCancelDelete={() => setSheet((cur) => cur && { ...cur, confirm: false })}
          onDelete={() => removeMessage(sheet.message)}
        />
      )}
    </div>
  );
}

/* ═════════════════════════ Xabar pufakchasi ═════════════════════════ */
function Bubble({ m, editingNow, onTap }) {
  const mine = m.from === 'admin';
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <button
        type="button"
        onClick={onTap}
        className={`max-w-[85%] select-text rounded-2xl px-3.5 py-2 text-left transition sm:max-w-[70%] ${
          mine
            ? 'rounded-br-md bg-brand-400 text-brand-text active:brightness-95'
            : 'rounded-bl-md border border-line bg-surface text-ink active:bg-canvas'
        } ${editingNow ? 'ring-2 ring-offset-2 ring-brand-600 ring-offset-canvas' : ''}`}
      >
        {mine && m.adminName && (
          <div className="mb-0.5 text-[11px] font-medium opacity-70">{m.adminName}</div>
        )}
        <div className="whitespace-pre-wrap break-words text-[15px] leading-snug">{m.text}</div>
        <div className={`mt-0.5 flex items-center justify-end gap-1 text-[10.5px] ${mine ? 'opacity-70' : 'text-muted'}`}>
          {m.editedAt && <span>tahrirlandi</span>}
          <span className="tabular-nums">{hhmm(m.createdAt)}</span>
          {/* Mijoz o'qidimi: ✓ yuborildi, ✓✓ o'qildi */}
          {mine && m._id && (
            <i className={`ti ${m.readAt ? 'ti-checks' : 'ti-check'} text-[13px]`} title={m.readAt ? 'O‘qildi' : 'Yuborildi'} />
          )}
        </div>
      </button>
    </div>
  );
}

/* ═════════════════════════ Yozish maydoni (Telegram uslubi) ═════════════════════════
 * - Avtomatik kattalashadigan textarea (1 → 6 qator, keyin ichida scroll).
 * - Telefonda Enter / klaviaturadagi tugmalar YANGI QATOR — xabar faqat
 *   yuborish tugmasi bilan ketadi (avval klaviatura tugmasi bosilsa xabar
 *   ketib qolardi). Kompyuterda: Enter — yuborish, Shift+Enter — yangi qator.
 * - IME (so'z tanlash) paytidagi Enter yuborilmaydi.
 * - Yuborish tugmasi bosilganda klaviatura yopilmaydi (fokus textarea'da qoladi).
 * - font-size 16px — iOS maydonga bosganda sahifani kattalashtirmaydi.
 */
const MAX_TEXTAREA_PX = 148;

function Composer({ value, onChange, onSubmit, sending, editing, onCancelEdit, enterSends, safeBottom }) {
  const ref = useRef(null);

  // Balandlikni matnga moslash
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const h = Math.min(el.scrollHeight, MAX_TEXTAREA_PX);
    el.style.height = `${h}px`;
    el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_PX ? 'auto' : 'hidden';
  }, [value]);

  // Tahrir boshlanganda — fokus va kursor oxirida
  useEffect(() => {
    if (!editing || !ref.current) return;
    const el = ref.current;
    el.focus();
    const n = el.value.length;
    el.setSelectionRange(n, n);
  }, [editing]);

  const onKeyDown = (e) => {
    if (e.key === 'Escape' && editing) { e.preventDefault(); onCancelEdit(); return; }
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (!enterSends) return; // telefonda — oddiy yangi qator
    e.preventDefault();
    onSubmit();
  };

  const canSend = value.trim().length > 0 && !sending;

  return (
    <div className={`border-t border-line bg-surface ${safeBottom ? 'pb-[max(0.5rem,env(safe-area-inset-bottom))]' : 'pb-2'}`}>
      {editing && (
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 pt-2">
          <i className="ti ti-pencil flex-none text-lg text-brand-600" />
          <div className="min-w-0 flex-1 border-l-2 border-brand-400 pl-2">
            <div className="text-xs font-semibold text-brand-600">Tahrirlash</div>
            <div className="truncate text-xs text-muted">{editing.original}</div>
          </div>
          <button
            type="button"
            onClick={onCancelEdit}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-muted active:bg-canvas lg:hover:bg-canvas"
            aria-label="Tahrirni bekor qilish"
          >
            <i className="ti ti-x text-lg" />
          </button>
        </div>
      )}
      <div className="mx-auto flex max-w-3xl items-end gap-2 px-2 pt-2 sm:px-3">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={editing ? 'Xabarni tahrirlang…' : 'Javob yozing…'}
          maxLength={2000}
          enterKeyHint="enter"
          autoComplete="off"
          className="min-h-[44px] flex-1 resize-none rounded-[22px] border border-line bg-canvas px-4 py-[10px] text-[16px] leading-[22px] text-ink outline-none transition-colors placeholder:text-muted focus:border-brand-400"
        />
        <button
          type="button"
          // Fokus textarea'da qolsin — klaviatura yopilib-ochilmasin
          onMouseDown={(e) => e.preventDefault()}
          onClick={onSubmit}
          disabled={!canSend}
          aria-label={editing ? 'Saqlash' : 'Yuborish'}
          className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-brand-400 text-brand-text shadow-sm transition active:scale-95 disabled:opacity-40 lg:hover:bg-brand-600 lg:hover:text-white"
        >
          {sending
            ? <i className="ti ti-loader-2 animate-spin text-xl" />
            : <i className={`ti ${editing ? 'ti-check' : 'ti-send'} text-xl`} />}
        </button>
      </div>
      {value.length > 1800 && (
        <div className="mx-auto max-w-3xl px-4 pt-1 text-right text-[11px] tabular-nums text-muted">{value.length}/2000</div>
      )}
    </div>
  );
}

/* ═════════════════════════ Xabar amallari oynasi ═════════════════════════
 * Mobilda pastdan chiqadi, kompyuterda markazda. Tahrirlash va o'chirish
 * faqat administrator javoblarida; nusxalash — hamma xabarda.
 */
function ActionSheet({ message, confirm, busy, onClose, onEdit, onCopy, onAskDelete, onCancelDelete, onDelete }) {
  const mine = message.from === 'admin' && Boolean(message._id);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const item = 'flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] active:bg-canvas lg:hover:bg-canvas disabled:opacity-50';

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 lg:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md overflow-hidden rounded-t-2xl bg-surface pb-[env(safe-area-inset-bottom)] shadow-xl lg:rounded-2xl lg:pb-0"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-black/10 lg:hidden" />
        <div className="border-b border-line px-4 py-3">
          <div className="line-clamp-3 whitespace-pre-wrap break-words text-sm text-muted">{message.text}</div>
        </div>

        {confirm ? (
          <div className="p-4">
            <div className="text-[15px] font-semibold text-ink">Xabar o‘chirilsinmi?</div>
            <p className="mt-1 text-sm text-muted">Mijozning ilovasidan va Telegram botdagi xabardan ham o‘chiriladi.</p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={onCancelDelete} disabled={busy}
                className="h-11 flex-1 rounded-xl border border-line text-[15px] font-medium text-ink active:bg-canvas disabled:opacity-50">
                Bekor qilish
              </button>
              <button type="button" onClick={onDelete} disabled={busy}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 text-[15px] font-semibold text-white active:bg-red-700 disabled:opacity-60">
                {busy && <i className="ti ti-loader-2 animate-spin" />}O‘chirish
              </button>
            </div>
          </div>
        ) : (
          <div className="py-1">
            {mine && (
              <button type="button" onClick={onEdit} className={`${item} text-ink`}>
                <i className="ti ti-pencil text-xl text-muted" />Tahrirlash
              </button>
            )}
            <button type="button" onClick={onCopy} className={`${item} text-ink`}>
              <i className="ti ti-copy text-xl text-muted" />Nusxalash
            </button>
            {mine && (
              <button type="button" onClick={onAskDelete} className={`${item} text-red-600`}>
                <i className="ti ti-trash text-xl" />O‘chirish
              </button>
            )}
            <button type="button" onClick={onClose} className={`${item} justify-center border-t border-line font-medium text-muted lg:hidden`}>
              Bekor qilish
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
