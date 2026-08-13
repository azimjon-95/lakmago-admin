import { create } from 'zustand';
import { getSocket, joinRestaurant } from '@/lib/socket';
import { useAuth } from '@/store/auth';
import { apiFetch } from '@/api/client';
import { playSound, stopSound, unlockSound, setMuted, isMuted } from '@/lib/soundQueue';
import { soundAllowed, useNotifSettings } from '@/lib/notifSettings';
import { subscribePush } from '@/lib/push';

/**
 * Markaziy bildirishnoma tizimi.
 *
 * Nega kerak: avval har sahifa o'zi socket hodisasini eshitib,
 * o'zi ovoz chalardi. Natijada bir hodisa ikki joyda ovoz berardi,
 * socket uzilsa hodisa butunlay yo'qolardi, panel yangilansa
 * bajarilmagan ish esdan chiqardi.
 *
 * Oqim:
 *   socket 'notification:new' ─┐
 *                              ├→ ingest() → dedupe → queue → UI + ovoz
 *   REST sync (qayta ulanish) ─┘
 *
 * Socketga YOLG'IZ ishonmaymiz: ulanish tiklanganda oxirgi seq
 * bo'yicha serverdan yo'qolganlarini olib kelamiz.
 */

const SEQ_KEY = 'lokmago_notif_seq';

/**
 * Ilova ochiq, lekin boshqa oynada bo'lganda brauzer
 * bildirishnomasi. Bu Web Push emas — ilova ishlab turibdi,
 * shunchaki ko'rinmayapti.
 */
function showDesktopNotification(n) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const notif = new Notification(n.title, {
      body: n.body || '',
      icon: '/icon-192.png',
      tag: n.notificationId,
    });
    notif.onclick = () => { window.focus(); notif.close(); };
  } catch { /* ruxsat yo'q — muhim emas */ }
}

const readSeq = () => Number(localStorage.getItem(SEQ_KEY)) || 0;
const writeSeq = (v) => { try { localStorage.setItem(SEQ_KEY, String(v)); } catch { /* ignore */ } };

export const useNotifications = create((set, get) => ({
  items: [],            // eng yangisi birinchi
  lastSeq: readSeq(),
  connected: false,
  muted: isMuted(),
  open: false,          // panel ochiqmi

  /** Bittasi yoki bir nechtasi keldi. Dublikatlar bu yerda to'siladi. */
  ingest(list, { silent = false } = {}) {
    const incoming = Array.isArray(list) ? list : [list];
    if (incoming.length === 0) return;

    const { items } = get();
    const known = new Set(items.map((n) => n.notificationId));

    const fresh = [];
    for (const n of incoming) {
      if (!n?.notificationId || known.has(n.notificationId)) continue;
      known.add(n.notificationId);
      fresh.push(n);
    }
    if (fresh.length === 0) return;

    // seq faqat oldinga siljiydi
    const maxSeq = Math.max(get().lastSeq, ...fresh.map((n) => n.seq || 0));

    set({
      items: [...fresh].sort((a, b) => b.seq - a.seq).concat(items).slice(0, 100),
      lastSeq: maxSeq,
    });
    writeSeq(maxSeq);

    // Javob berilmaganlari uchun ovoz. Sinxronlashda ham chalinadi —
    // panel yopiq turganda kelgan buyurtma e'tibordan qolmasin.
    if (!silent) {
      // Sozlamada o'chirilgan turlar jim qoladi
      fresh
        .filter((n) => ['NEW', 'DELIVERED'].includes(n.status))
        .filter((n) => soundAllowed(n.type))
        .forEach((n) => playSound(n.sound, n.priority));

      // Ilova ochiq, lekin boshqa oynada — brauzer bildirishnomasi
      if (document.visibilityState === 'hidden'
          && useNotifSettings.getState().desktopNotifications) {
        fresh.forEach(showDesktopNotification);
      }
    }

    // Serverga "yetkazildi" deb belgilaymiz
    fresh
      .filter((n) => n.status === 'NEW')
      .forEach((n) => get().patch(n.notificationId, 'DELIVERED', { quiet: true }));
  },

  /** Holatni o'zgartirish. Yakuniy amallarda ovoz darhol to'xtaydi. */
  async patch(notificationId, status, { quiet = false } = {}) {
    if (['ACCEPTED', 'CANCELLED', 'MUTED'].includes(status)) stopSound();

    set({
      items: get().items.map((n) =>
        (n.notificationId === notificationId ? { ...n, status } : n)),
    });

    try {
      await apiFetch(`/panel/notifications/${encodeURIComponent(notificationId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    } catch (e) {
      // Tarmoq yo'q — UI holati saqlanadi, keyingi sinxronlashda
      // server holati ustun keladi
      if (!quiet) console.warn('[notify] holat saqlanmadi:', e.message);
    }
  },

  /** Yo'qolganlarini serverdan olib kelish. */
  async sync({ initial = false } = {}) {
    try {
      // Birinchi yuklanишda javob berilmaganlar, keyin esa
      // oxirgi seq'dan keyingilari
      const qs = initial ? '' : `?after=${get().lastSeq}`;
      const data = await apiFetch(`/panel/notifications${qs}`);
      const items = data?.items || [];

      // Dastlabki yuklanishda ovoz chalinmaydi: bu eski ishlar,
      // panel ochilishi bilan shovqin bo'lmasin
      get().ingest(items, { silent: initial });

      if (data?.lastSeq) {
        set({ lastSeq: Math.max(get().lastSeq, data.lastSeq) });
        writeSeq(get().lastSeq);
      }
    } catch {
      /* keyingi urinishда tiklanadi */
    }
  },

  toggleMute() {
    const next = !get().muted;
    setMuted(next);
    set({ muted: next });
  },

  setOpen(open) {
    set({ open });
    // Panel ochilganda ko'rilgan deb belgilaymiz
    if (open) {
      get().items
        .filter((n) => ['NEW', 'DELIVERED'].includes(n.status))
        .forEach((n) => get().patch(n.notificationId, 'SEEN', { quiet: true }));
    }
  },

  /** Ovoz va navbatni darhol to'xtatish. */
  hush: () => stopSound(),
}));

/* ═══════════════════════════════════════════
   Socket ulanishi — bir marta o'rnatiladi
   ═══════════════════════════════════════════ */
let started = false;

export function startNotificationCenter() {
  if (started) return;

  // Kim ekanimiz aniq bo'lguncha kutamiz: socket xonasi shunga
  // qarab tanlanadi. Avval bu sahifalarga bog'liq edi va
  // bildirishnoma markazi noto'g'ri xonada qolib ketardi.
  const { user, status } = useAuth.getState();
  if (status !== 'authed' || !user) return;

  /*
   * Faqat restoran paneli. Admin uchun ishga tushirilmaydi —
   * socket ham ulanmaydi, ovoz ham chalinmaydi.
   */
  if (user.role !== 'restaurant') return;

  started = true;

  const store = useNotifications.getState();
  const socket = getSocket();

  /**
   * Socket xonasiga qo'shilish.
   *
   * To'g'ridan-to'g'ri emit qilamiz: socket.io ulanmagan paytdagi
   * emitlarni o'zi buferlaydi va ulanганda yuboradi. Avval bu
   * socket.js dagi "xonalarni qayta tiklash" mexanizmiga
   * bog'langan edi va u ba'zan ishlamay qolardi — xona
   * bo'lmasa esa hech qanday bildirishnoma kelmaydi.
   */
  const joinRoom = () => {
    const rid = user.restaurantId || useAuth.getState().restaurant?._id;
    if (!rid) return;
    joinRestaurant(rid);              // qayta ulanish ro'yxatiga ham
    socket.emit('join:restaurant', String(rid));
  };
  joinRoom();

  socket.on('notification:new', (n) => useNotifications.getState().ingest(n));

  socket.on('notification:status', ({ notificationId, status }) => {
    useNotifications.setState({
      items: useNotifications.getState().items.map((n) =>
        (n.notificationId === notificationId ? { ...n, status } : n)),
    });
  });

  socket.on('connect', () => {
    useNotifications.setState({ connected: true });
    joinRoom();   // qayta ulanганda xona yo'qoladi — qaytamiz
    // Uzilib turgan paytda kelganlarini olib kelamiz
    useNotifications.getState().sync();
  });

  socket.on('disconnect', () => {
    useNotifications.setState({ connected: false });
  });

  useNotifications.setState({ connected: socket.connected });

  // Panel yangilanganda bajarilmagan ishlar tiklanadi
  store.sync({ initial: true });

  // Zaxira: socket "ulangan" ko'rinib turib hodisa kelmasligi
  // mumkin (proxy uzib qo'ysa). Har 60 soniyada tekshiramiz.
  setInterval(() => useNotifications.getState().sync(), 60000);

  // Brauzer ovozga ruxsatni faqat foydalanuvchi harakatidan
  // keyin beradi
  const unlock = () => {
    unlockSound();
    // Push obunasi ham foydalanuvchi harakatidan keyin so'raladi:
    // sahifa ochilishi bilan ruxsat so'rash bezovta qiladi va
    // ko'pchilik rad etadi
    if (useNotifSettings.getState().pushNotifications) {
      subscribePush().catch(() => {});
    }
    window.removeEventListener('pointerdown', unlock);
  };
  window.addEventListener('pointerdown', unlock);

  // Service Worker'dan kelgan xabarlar (push bosilganda)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (e) => {
      const { source, payload, url } = e.data || {};
      if (source === 'push' && payload) {
        // Ilova ochiq edi — markaziy tizim o'zi ko'rsatadi.
        // Socket allaqachon yetkazgan bo'lsa dedupe to'sadi.
        useNotifications.getState().sync();
      }
      if (source === 'push-click' && url) window.location.assign(url);
    });
  }

  /*
   * Javob berilmagan CRITICAL bildirishnoma qayta eslatiladi.
   * Ofitsiant chaqiruvi e'tibordan chetda qolmasligi kerak.
   */
  setInterval(() => {
    const { repeatInterval } = useNotifSettings.getState();
    if (!repeatInterval) return;

    const cutoff = Date.now() - repeatInterval * 1000;
    const stale = useNotifications.getState().items.filter((n) =>
      n.priority === 'CRITICAL'
      && ['NEW', 'DELIVERED', 'SEEN'].includes(n.status)
      && new Date(n.createdAt).getTime() < cutoff);

    if (stale.length && soundAllowed(stale[0].type)) {
      playSound(stale[0].sound, 'CRITICAL');
    }
  }, 15000);

  // Ilova fonga o'tib qaytganda ham tekshiramiz
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') useNotifications.getState().sync();
  });
}
