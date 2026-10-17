import { create } from 'zustand';
import { ownerApi } from '@/api';

/*
 * ═══ TO'YXONA EGASI: YANGI BRON SO'ROVLARI — JONLI HOLAT ═══
 * Panel ochiq turganda har 20 soniyada yengil so'rov (/inbox/summary) yuboriladi; yangi so'rov
 * kelsa — ekranda xabar (toast), ovoz va tebranish, tab belgisida son, sarlavhada (N).
 * Shaxsiy ma'lumot (mijoz ismi, telefon) soket orqali yuborilmaydi — faqat avtorizatsiyali so'rov bilan olinadi.
 * Panel yopiq bo'lsa — egasiga SMS ketadi (to'yxona serveri).
 */
const POLL_MS = 20_000;
const BASE_TITLE = typeof document !== 'undefined' ? document.title : '';
let timer = null;
let prevUnread = null;
let audioCtx = null;

function beep() {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime;
    [[880, 0], [1175, 0.16]].forEach(([f, dt]) => {
      const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + dt); g.gain.exponentialRampToValueAtTime(0.25, t0 + dt + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.22);
      o.connect(g).connect(audioCtx.destination); o.start(t0 + dt); o.stop(t0 + dt + 0.25);
    });
  } catch { /* brauzer ovozga ruxsat bermagan — jim */ }
  try { navigator.vibrate?.([120, 60, 120]); } catch { /* */ }
}

const EMPTY = { unread: 0, counts: { new: 0, agreed: 0, confirmed: 0 } };

export const useOwnerInbox = create((set, get) => ({
  summary: EMPTY,
  /** Ro'yxatlar shuni kuzatib qayta yuklanadi (hisob o'zgarganda yoki amaldan keyin) */
  version: 0,
  toast: null,
  openId: null,

  start() {
    if (timer) return;
    get().refresh();
    timer = setInterval(() => { if (!document.hidden) get().refresh(); }, POLL_MS);
    document.addEventListener('visibilitychange', onVisible);
  },
  stop() {
    clearInterval(timer); timer = null; prevUnread = null;
    document.removeEventListener('visibilitychange', onVisible);
    if (typeof document !== 'undefined') document.title = BASE_TITLE;
  },

  async refresh() {
    try {
      const s = await ownerApi.inboxSummary();
      const prev = get().summary;
      const changed = s.unread !== prev.unread || s.counts.new !== prev.counts.new || s.counts.agreed !== prev.counts.agreed || s.counts.confirmed !== prev.counts.confirmed;
      set({ summary: s, version: changed ? get().version + 1 : get().version });
      document.title = s.counts.new > 0 ? `(${s.counts.new}) ${BASE_TITLE}` : BASE_TITLE;
      // Yangi bildirishnoma: birinchi yuklashda emas, faqat keyingi o'sishda
      if (prevUnread !== null && s.unread > prevUnread) {
        beep();
        try {
          const n = await ownerApi.notifications();
          const first = n.items.find((x) => !x.read);
          if (first) set({ toast: first });
        } catch { /* ro'yxat olinmasa ham ovoz berildi */ }
      }
      prevUnread = s.unread;
    } catch { /* tarmoq xatosi — keyingi urinishda */ }
  },
  /** Amaldan keyin ro'yxat va belgilarni darhol yangilash */
  touch() { set({ version: get().version + 1 }); get().refresh(); },
  openBooking(id) { set({ openId: id, toast: null }); },
  closeBooking() { set({ openId: null }); },
  dismissToast() { set({ toast: null }); },
}));

function onVisible() { if (!document.hidden) useOwnerInbox.getState().refresh(); }
