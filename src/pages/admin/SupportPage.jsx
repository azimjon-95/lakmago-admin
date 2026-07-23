import { useState, useEffect, useCallback, useRef } from 'react';
import { adminApi } from '@/api';
import { getSocket, joinAdmin } from '@/lib/socket';

// Vaqt formatlash: bugun bo'lsa soat, aks holda sana
function fmtTime(d) {
  const date = new Date(d);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  return isToday
    ? date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

export function SupportPage() {
  const [chats, setChats] = useState([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [activeId, setActiveId] = useState(null);
  const [active, setActive] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const bodyRef = useRef(null);
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

  // Suhbatni ochish
  const openChat = useCallback(async (id) => {
    setActiveId(id);
    try {
      const data = await adminApi.getSupportChat(id);
      setActive(data);
      loadList(); // badge yangilansin
    } catch { /* ignore */ }
  }, [loadList]);

  // Real-time: yangi xabar
  useEffect(() => {
    const socket = getSocket();
    joinAdmin();

    socket.on('support:message', (msg) => {
      playSound();
      loadList();
      // Ochiq suhbatga tegishli bo'lsa — darhol qo'shamiz
      setActive((cur) => {
        if (!cur || String(cur._id) !== msg.chatId) return cur;
        return { ...cur, messages: [...cur.messages, { from: 'user', text: msg.text, createdAt: msg.at }] };
      });
    });
    socket.on('support:read', loadList);
    socket.on('support:resolved', loadList);

    return () => socket.removeAllListeners();
  }, [loadList, playSound]);

  // Xabarlar oxiriga scroll
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [active?.messages?.length]);

  const send = async () => {
    const text = reply.trim();
    if (!text || !activeId || sending) return;
    setSending(true);
    try {
      const res = await adminApi.replySupport(activeId, text);
      setActive((cur) => cur ? { ...cur, messages: [...cur.messages, res.message] } : cur);
      setReply('');
      loadList();
    } catch (e) {
      alert(e.message);
    } finally {
      setSending(false);
    }
  };

  const toggleResolve = async () => {
    if (!activeId) return;
    await adminApi.resolveSupport(activeId, !active?.isResolved);
    setActive((cur) => cur ? { ...cur, isResolved: !cur.isResolved } : cur);
    loadList();
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
          {chats.length === 0 ? (
            <div className="text-center text-muted text-sm py-10 px-4">
              {showResolved ? 'Yopilgan suhbat yo\u2018q' : 'Yangi xabar yo\u2018q'}
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
                  <img src={c.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-none" />
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

      {/* Suhbat oynasi — mobilda faqat suhbat tanlanganда ko'rinadi */}
      {!active ? (
        <div className="hidden lg:flex flex-1 items-center justify-center text-muted">
          <div className="text-center">
            <i className="ti ti-message-circle text-5xl opacity-30" />
            <p className="mt-3 text-sm">Suhbatni tanlang</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mijoz ma'lumotlari */}
          <div className="px-3 sm:px-5 py-3 border-b border-line flex items-center gap-2 sm:gap-3">
            {/* Orqaga — faqat mobilda (ro'yxatga qaytish) */}
            <button
              onClick={() => { setActiveId(null); setActive(null); }}
              className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:bg-canvas flex-none"
              aria-label="Orqaga"
            >
              <i className="ti ti-arrow-left text-lg" />
            </button>
            {active.photoUrl ? (
              <img src={active.photoUrl} alt="" className="w-11 h-11 rounded-full object-cover" />
            ) : (
              <div className="w-11 h-11 rounded-full bg-brand-100 text-brand-text flex items-center justify-center text-sm font-bold">
                {initials(active)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-ink">{fullName(active)}</div>
              <div className="text-xs text-muted flex items-center gap-2 flex-wrap">
                {active.username && <span>@{active.username}</span>}
                {active.phone && <span>· {active.phone}</span>}
                {active.telegramId && <span>· ID {active.telegramId}</span>}
              </div>
            </div>
            {/* Mijozning Telegram akkauntiga o'tish */}
            {(active.username || active.telegramId) && (
              <a
                href={active.username
                  ? `https://t.me/${active.username}`
                  : `tg://user?id=${active.telegramId}`}
                target="_blank"
                rel="noreferrer"
                title="Telegramda yozish"
                className="w-9 h-9 rounded-lg border border-line hover:bg-canvas flex items-center justify-center text-[#229ED9] flex-none"
              >
                <i className="ti ti-brand-telegram text-lg" />
              </a>
            )}
            <button
              onClick={toggleResolve}
              className={`px-3 py-1.5 rounded-lg text-sm border ${
                active.isResolved

                  ? 'border-line text-muted hover:bg-canvas'
                  : 'border-green-300 text-green-600 hover:bg-green-50'
              }`}
            >
              {active.isResolved ? 'Qayta ochish' : 'Hal qilindi'}
            </button>
          </div>

          {/* Xabarlar */}
          <div ref={bodyRef} className="flex-1 overflow-y-auto p-5 space-y-3 bg-canvas">
            {(active.messages || []).map((m, i) => (
              <div key={m._id || i} className={`flex ${m.from === 'admin' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl ${
                  m.from === 'admin'
                    ? 'bg-brand-400 text-brand-text rounded-br-sm'
                    : 'bg-surface border border-line text-ink rounded-bl-sm'
                }`}>
                  {m.from === 'admin' && m.adminName && (
                    <div className="text-[11px] opacity-70 mb-0.5">{m.adminName}</div>
                  )}
                  <div className="text-sm whitespace-pre-wrap break-words">{m.text}</div>
                  <div className={`text-[10px] mt-1 ${m.from === 'admin' ? 'opacity-60' : 'text-muted'}`}>
                    {fmtTime(m.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Javob yozish */}
          <div className="p-4 border-t border-line flex gap-3">
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Javob yozing..."
              className="flex-1 px-4 py-2.5 rounded-xl border border-line bg-canvas text-ink outline-none focus:border-brand-400"
            />
            <button
              onClick={send}
              disabled={sending || !reply.trim()}
              className="px-5 py-2.5 bg-brand-400 text-brand-text font-medium rounded-xl hover:bg-brand-600 hover:text-white transition-colors disabled:opacity-50"
            >
              {sending ? '...' : 'Yuborish'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
