import { create } from 'zustand';
import { getSocket, joinRestaurant, resetSocket } from '@/lib/socket';
import { useAuth } from '@/store/auth';
import { apiFetch } from '@/api/client';
import { playSound, stopSound, unlockSound, isSoundUnlocked, setMuted, isMuted } from '@/lib/soundQueue';
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
 *
 * ═══ OVOZ QOIDASI: FAQAT YANGI MA'LUMOTGA ═══
 *
 * Har bildirishnoma ikki toifadan biriga tushadi:
 *
 *   TARIX — panel ochilgan paytda allaqachon mavjud bo'lganlar
 *     (birinchi yuklanish). Ro'yxatda va hisoblagichda ko'rinadi,
 *     lekin HECH QACHON ovoz chalmaydi: na darhol, na takroran.
 *
 *   JONLI — sessiya davomida kelganlar: socket orqali yoki
 *     uzilishdan keyingi sinxronlashda, sessiya chegarasidan
 *     (server `headSeq`) KEYINGI seq bilan. Faqat shular chaladi.
 *
 * AVVALGI XATO: eski bildirishnomalar jim yuklanardi-yu, darhol
 * takroriy ovoz rejasiga tushardi. Kutish vaqti yaratilgan
 * paytdan hisoblangani uchun 8 soniyadan eski HAR BIR xabar
 * panel ochilishi bilan DARHOL chalinardi.
 */

const SEQ_KEY_PREFIX = 'lokmago_notif_seq';
let seqKey = SEQ_KEY_PREFIX;

/*
 * Sessiya davomida JONLI kelgan bildirishnomalar. Ovoz va
 * takrorlash faqat shularga tegishli.
 */
const liveIds = new Set();

/*
 * Har bir bildirishnoma oxirgi marta qachon chalinganini
 * eslab turadi (faqat xotirada — saqlanmaydi). Shu yordamida
 * "repeatInterval o'tdimi" deb har birini alohida tekshiramiz.
 */
const lastPlayedAt = new Map();

/**
 * Har bir bildirishnoma NECHA MARTA chalinganini sanaydi.
 *
 * Talab (2026-08): ovoz 4-5 marta chalinib TO'XTASIN. Undan
 * keyin xabar "eski" hisoblanadi — ro'yxatda ko'rinaveradi va
 * qabul qilinishini kutadi, LEKIN boshqa ovoz chiqarmaydi.
 * Faqat YANGI kelganlar chaladi.
 *
 * Avval cheksiz chalinardi (faqat 2 soatlik yosh chegarasi bor
 * edi) — bu esa restoran xodimini bezovta qilardi.
 */
const playCount = new Map();
const MAX_PLAYS = 5;

/*
 * ═══ TAKRORIY OVOZ ═══
 *
 * ILGARI: setInterval(2000) butun seans davomida aylanardi va
 * har 2 soniyada butun ro'yxatni skanerlardi. Kutilayotgan
 * bildirishnoma BO'LMASA HAM ishlayverardi — daqiqasiga 30 ta
 * bekorga uyg'onish. Bu protsessorni bo'sh turishга qo'ymaydi:
 * brauzer tabni past quvvat rejimiga tushira olmaydi.
 *
 * ENDI: har bildirishnoma O'ZI uchun aniq vaqtga setTimeout
 * qo'yadi. Kutilayotgan xabar yo'q bo'lsa — taymer ham yo'q,
 * protsessor butunlay bo'sh.
 *
 * Nega intervalni 10-15 soniyaga uzaytirish yetarli emas edi:
 * u bo'sh uyg'onishlarni faqat kamaytiradi, YO'QOTMAYDI, va
 * takroriy ovoz 15 soniyagacha kechikib chalinadi. Rejalangan
 * taymer esa ikkala muammoni ham bir yo'la hal qiladi.
 */

// notificationId → setTimeout identifikatori
const repeatTimers = new Map();

const REPEAT_MAX_AGE_MS = 2 * 60 * 60 * 1000;

function clearRepeat(id) {
  const t = repeatTimers.get(id);
  if (t) clearTimeout(t);
  repeatTimers.delete(id);
  lastPlayedAt.delete(id);
  playCount.delete(id);
  liveIds.delete(id);
}

/** Bildirishnoma hali javob kutyaptimi va ovozga arziydimi. */
function isRingable(n) {
  if (!n || !liveIds.has(n.notificationId)) return false;       // tarix — hech qachon
  if (!['NEW', 'DELIVERED'].includes(n.status)) return false;
  if (!soundAllowed(n.type)) return false;
  const born = new Date(n.createdAt).getTime();
  // Sana noto'g'ri — jonli kelgan, yangi deb hisoblaymiz
  if (Number.isNaN(born)) return true;
  return Date.now() - born < REPEAT_MAX_AGE_MS;
}

/**
 * Bitta bildirishnoma uchun keyingi ovozni rejalashtirish.
 *
 * O'zini o'zi qayta rejalashtiradi — MAX_PLAYS ga yetguncha
 * yoki xabar ro'yxatdan chiqguncha.
 */
function scheduleRepeat(n) {
  const id = n.notificationId;
  if (repeatTimers.has(id)) return;              // allaqachon rejada

  const { repeatInterval } = useNotifSettings.getState();
  if (!repeatInterval) return;                   // takrorlash o'chirilgan
  if (!isRingable(n)) return;                    // tarix yoki javob berilgan
  if ((playCount.get(id) || 0) >= MAX_PLAYS) return;

  /*
   * Kutish BIRINCHI CHALINGAN paytdan hisoblanadi. Hali bir marta
   * ham chalinmagan bo'lsa — takrorlash ham yo'q (avval yaratilgan
   * paytdan hisoblanib, eski xabar darhol chalinardi).
   */
  const last = lastPlayedAt.get(id);
  if (last === undefined) return;
  const wait = Math.max(0, last + repeatInterval * 1000 - Date.now());

  const timer = setTimeout(() => {
    repeatTimers.delete(id);

    // Vaqt kelganda holatni QAYTA tekshiramiz: xabar shu orada
    // qabul qilingan yoki o'chirilgan bo'lishi mumkin
    const fresh = useNotifications.getState().items
      .find((x) => x.notificationId === id);
    if (!fresh || !['NEW', 'DELIVERED'].includes(fresh.status)) { clearRepeat(id); return; }
    if (!isRingable(fresh)) return;

    const played = playCount.get(id) || 0;
    if (played >= MAX_PLAYS) return;

    playSound(fresh.sound, fresh.priority);
    playCount.set(id, played + 1);
    lastPlayedAt.set(id, Date.now());

    scheduleRepeat(fresh);          // keyingisini rejalashtirish
  }, wait);

  repeatTimers.set(id, timer);
}

/**
 * Ro'yxat o'zgarganda rejalarni moslashtirish.
 * Yangi kutilayotganlarga reja qo'yadi, yo'qolganlarni tozalaydi.
 */
function syncRepeats() {
  const items = useNotifications.getState().items;
  const live = new Set(items.map((n) => n.notificationId));

  repeatTimers.forEach((_, id) => { if (!live.has(id)) clearRepeat(id); });
  items.forEach(scheduleRepeat);
}

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

/*
 * seq restoran bo'yicha saqlanadi — bitta qurilmada ikki akkaunt
 * ishlatilsa biri ikkinchisining joyini buzmasin. Server `headSeq`
 * bersa, u ustun turadi (bu faqat eski server uchun zaxira).
 */
const readSeq = () => { try { return Number(localStorage.getItem(seqKey)) || 0; } catch { return 0; } };
const writeSeq = (v) => { try { localStorage.setItem(seqKey, String(v)); } catch { /* ignore */ } };

/*
 * Sinxronlashlar KETMA-KET bajariladi. Avval panel ochilishidagi
 * yuklanish va socket ulanishidagi sinxronlash parallel ketib,
 * biri ikkinchisining natijasini "yangi" deb chalib yuborishi
 * mumkin edi (poyga). Endi har biri oldingisi tugashini kutadi.
 */
let syncChain = Promise.resolve();

/*
 * Sessiya raqami: logout/akkaunt almashishida oshadi. Eski
 * sessiyada boshlangan so'rov javobi kechikib kelsa — yangi
 * sessiyaga (boshqa restoranga) yozilmaydi.
 */
let sessionNo = 0;

async function runSync(get, set) {
  if (!started) return;
  const mySession = sessionNo;
  const first = !get().didFirstSync;
  const qs = first ? '' : `?after=${get().lastSeq}`;
  const data = await apiFetch(`/panel/notifications${qs}`);
  if (mySession !== sessionNo || !started) return;
  const items = Array.isArray(data?.items) ? data.items : [];

  if (first) {
    get().ingest(items, { live: false });
    /*
     * Sessiya chegarasi. Server `headSeq` bersa — u haqiqat
     * manbai (localStorage'dagi eski yoki boshqa akkauntniki
     * bo'lgan qiymat hisobga olinmaydi). Eski server uchun zaxira.
     */
    const head = Number(data?.headSeq);
    const baseline = Number.isFinite(head) && head > 0
      ? Math.max(head, ...items.map((n) => Number(n.seq) || 0))
      : Math.max(readSeq(), get().lastSeq, Number(data?.lastSeq) || 0);
    set({ lastSeq: baseline, didFirstSync: true });
    writeSeq(baseline);
    return;
  }

  get().ingest(items, { live: true });
  if (data?.lastSeq) {
    set({ lastSeq: Math.max(get().lastSeq, Number(data.lastSeq) || 0) });
    writeSeq(get().lastSeq);
  }
}

export const useNotifications = create((set, get) => ({
  items: [],            // eng yangisi birinchi
  lastSeq: 0,          // birinchi sinxronlashda server headSeq bilan o'rnatiladi
  connected: false,
  muted: isMuted(),
  open: false,          // panel ochiqmi
  didFirstSync: false,  // birinchi sync tugadimi (poyga himoyasi)

  /**
   * Bittasi yoki bir nechtasi keldi. Dublikatlar bu yerda to'siladi.
   *
   * @param {object} opts
   * @param {boolean} opts.live  true — sessiya davomida kelgan (ovoz
   *   chalinadi); false — tarix (faqat ro'yxatga qo'shiladi).
   *   `silent: true` eski nomi — `live: false` bilan bir xil.
   */
  ingest(list, { live, silent } = {}) {
    const isLive = live ?? !silent;
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
    const maxSeq = Math.max(get().lastSeq, ...fresh.map((n) => Number(n.seq) || 0));

    set({
      items: [...fresh].sort((a, b) => (b.seq || 0) - (a.seq || 0)).concat(items).slice(0, 100),
      lastSeq: maxSeq,
    });
    writeSeq(maxSeq);

    if (isLive) {
      fresh.forEach((n) => liveIds.add(n.notificationId));

      // Faqat JONLI, javob kutayotgan, yangi va sozlamada yoqilganlar
      fresh.filter(isRingable).forEach((n) => {
        playSound(n.sound, n.priority);
        // Birinchi chalish ham hisobga olinadi — JAMI 5 marta (6 emas)
        playCount.set(n.notificationId, 1);
        lastPlayedAt.set(n.notificationId, Date.now());
      });

      // Ilova ochiq, lekin boshqa oynada — brauzer bildirishnomasi
      if (document.visibilityState === 'hidden'
          && useNotifSettings.getState().desktopNotifications) {
        fresh.filter((n) => ['NEW', 'DELIVERED'].includes(n.status)).forEach(showDesktopNotification);
      }
    }

    // Serverga "yetkazildi" deb belgilaymiz
    fresh
      .filter((n) => n.status === 'NEW')
      .forEach((n) => get().patch(n.notificationId, 'DELIVERED', { quiet: true }));

    // Yangi kelganlar uchun takroriy ovoz rejasi (tarix rejaga tushmaydi)
    syncRepeats();
  },

  /** Holatni o'zgartirish. Yakuniy amallarda ovoz darhol to'xtaydi. */
  async patch(notificationId, status, { quiet = false } = {}) {
    if (['ACCEPTED', 'CANCELLED', 'MUTED'].includes(status)) stopSound();

    set({
      items: get().items.map((n) =>
        (n.notificationId === notificationId ? { ...n, status } : n)),
    });

    /*
     * Qabul qilingan/bekor qilingan xabar boshqa chalinmaydi.
     * Rejani DARHOL bekor qilamiz — ilgari 2 soniyalik sikl
     * keyingi aylanishida o'zi payqashini kutish kerak edi.
     */
    if (['ACCEPTED', 'CANCELLED', 'MUTED'].includes(status)) {
      clearRepeat(notificationId);
    } else {
      syncRepeats();
    }

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

  /**
   * Serverdan olib kelish — KETMA-KET (syncChain).
   *
   * BIRINCHI sinxronlash (qaysi yo'ldan chaqirilishidan qat'i
   * nazar: panel ochilishi, socket ulanishi) — javob kutayotganlar
   * TARIX sifatida, ovozsiz yuklanadi va sessiya chegarasi
   * o'rnatiladi: lastSeq = server headSeq.
   *
   * KEYINGILARI (qayta ulanish, 60 soniyalik zaxira, sahifaga
   * qaytish) — faqat chegaradan keyingi seq'lar so'raladi. Ular
   * sessiya davomida yaratilgan, ya'ni haqiqatan YANGI — chalinadi.
   */
  sync() {
    syncChain = syncChain.then(() => runSync(get, set)).catch(() => { /* keyingi urinishda */ });
    return syncChain;
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

/**
 * Real sahifalar (Buyurtmalar, Dine-in, Bronlar) uchun.
 *
 * Admin buyurtmani/chaqiruvni/bronni HAQIQIY sahifada hal
 * qilganda — bildirishnoma panelida alohida bosish shart
 * emas, u avtomatik yopiladi va ovoz to'xtaydi. Aks holda
 * admin buyurtmani qabul qilib ishlayveradi-yu, bildirishnoma
 * jiringlashda davom etadi — chalkash va xato taassurot beradi.
 *
 * @param prefix  'order' | 'hall' | 'request' | 'reservation'
 * @param id      shu obyektning _id'si (notificationId shundan tuziladi)
 * @param status  'ACCEPTED' | 'CANCELLED'
 */
export function resolveNotification(prefix, id, status = 'ACCEPTED') {
  if (!id) return;
  const notificationId = `${prefix}:${id}`;
  const exists = useNotifications.getState().items.some(
    (n) => n.notificationId === notificationId,
  );
  // Yo'q bildirishnoma uchun so'rov yubormaymiz — jim o'tamiz
  if (exists) useNotifications.getState().patch(notificationId, status, { quiet: true });
}

export function startNotificationCenter() {
  if (started) return;

  // Kim ekanimiz aniq bo'lguncha kutamiz: socket xonasi shunga
  // qarab tanlanadi.
  const { user, status } = useAuth.getState();
  if (status !== 'authed' || !user) return;

  /*
   * Faqat restoran paneli. Admin uchun ishga tushirilmaydi —
   * socket ham ulanmaydi, ovoz ham chalinmaydi.
   */
  if (user.role !== 'restaurant') return;

  const rid = String(user.restaurantId || useAuth.getState().restaurant?._id || '');
  if (!rid) return;

  started = true;
  sessionNo += 1;
  seqKey = `${SEQ_KEY_PREFIX}:${rid}`;

  const store = useNotifications.getState();
  const socket = getSocket();
  const cleanups = [];
  const on = (target, event, fn, opts) => {
    target.addEventListener(event, fn, opts);
    cleanups.push(() => target.removeEventListener(event, fn, opts));
  };
  const onSocket = (event, fn) => {
    socket.on(event, fn);
    cleanups.push(() => socket.off(event, fn));
  };

  /**
   * Socket xonasiga qo'shilish. socket.io ulanmagan paytdagi
   * emitlarni o'zi buferlaydi va ulanganda yuboradi.
   */
  const joinRoom = () => {
    joinRestaurant(rid);              // qayta ulanish ro'yxatiga ham
    socket.emit('join:restaurant', rid);
  };
  joinRoom();

  /*
   * Faqat O'Z restoranimizning bildirishnomasi. Admin uchun
   * nusxalangan (`mirrored`) yoki boshqa restoranniki kelsa —
   * (masalan eski xona qolib ketgan bo'lsa) e'tiborsiz.
   */
  onSocket('notification:new', (n) => {
    if (!n || n.mirrored) return;
    if (n.restaurantId && String(n.restaurantId) !== rid) return;
    useNotifications.getState().ingest(n, { live: true });
  });

  onSocket('notification:status', ({ notificationId, status: st } = {}) => {
    if (!notificationId) return;
    useNotifications.setState({
      items: useNotifications.getState().items.map((n) =>
        (n.notificationId === notificationId ? { ...n, status: st } : n)),
    });

    // Boshqa qurilmada / Telegram botda hal qilinsa — bu yerda ham jimiydi
    if (['ACCEPTED', 'CANCELLED', 'MUTED'].includes(st)) {
      clearRepeat(notificationId);
      // Hozir aynan shu xabar chalinayotgan bo'lsa — to'xtatamiz
      const stillRinging = useNotifications.getState().items.some(
        (n) => n.notificationId !== notificationId
          && isRingable(n)
          && (playCount.get(n.notificationId) || 0) < MAX_PLAYS,
      );
      if (!stillRinging) stopSound();
    } else {
      syncRepeats();
    }
  });

  onSocket('connect', () => {
    useNotifications.setState({ connected: true });
    joinRoom();   // qayta ulanganda xona yo'qoladi — qaytamiz
    // Uzilib turgan paytda kelganlarini olib kelamiz (ketma-ket navbatda)
    useNotifications.getState().sync();
  });

  onSocket('disconnect', () => {
    useNotifications.setState({ connected: false });
  });

  useNotifications.setState({ connected: socket.connected });

  // Panel ochilishi — javob kutayotganlar TARIX sifatida (ovozsiz)
  store.sync();

  /*
   * Zaxira sinxronlash: socket "ulangan" ko'rinib turib hodisa
   * kelmasligi mumkin (proxy uzib qo'ysa). Sahifa fonda bo'lsa
   * so'rov yuborilmaydi — qaytib kelinganda darhol sinxronlanadi.
   */
  const interval = setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    useNotifications.getState().sync();
  }, 60000);
  cleanups.push(() => clearInterval(interval));

  on(document, 'visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      useNotifications.getState().sync();
      syncRepeats();
    }
  });

  /*
   * Brauzer ovozga ruxsatni faqat foydalanuvchi harakatidan keyin
   * beradi. Ochish JIM bajariladi (soundQueue.unlockSound) va
   * muvaffaqiyatsiz bo'lsa keyingi tegishda qayta uriniladi —
   * tinglovchi faqat hammasi ochilgach olib tashlanadi.
   */
  let pushAsked = false;
  const unlock = () => {
    unlockSound();
    // Push obunasi ham foydalanuvchi harakatidan keyin so'raladi
    if (!pushAsked && useNotifSettings.getState().pushNotifications) {
      pushAsked = true;
      subscribePush().catch(() => {});
    }
    if (isSoundUnlocked()) window.removeEventListener('pointerdown', unlock);
  };
  on(window, 'pointerdown', unlock);

  // Service Worker'dan kelgan xabarlar (push bosilganda)
  if ('serviceWorker' in navigator) {
    on(navigator.serviceWorker, 'message', (e) => {
      const { source, payload, url } = e.data || {};
      // Ilova ochiq edi — socket allaqachon yetkazgan bo'lsa dedupe to'sadi
      if (source === 'push' && payload) useNotifications.getState().sync();
      if (source === 'push-click' && url) window.location.assign(url);
    });
  }

  syncRepeats();

  /*
   * Takrorlash oralig'i sozlamada o'zgarsa rejalar qayta quriladi.
   */
  const unsubSettings = useNotifSettings.subscribe(() => {
    repeatTimers.forEach((t) => clearTimeout(t));
    repeatTimers.clear();
    syncRepeats();
  });
  cleanups.push(unsubSettings);

  /*
   * ═══ CHIQIB KETISH / AKKAUNT ALMASHISHI ═══
   * Avval markaz bir marta ishga tushib, logout'dan keyin ham
   * ishlayverardi: socket eski restoran xonasida qolar, shu
   * qurilmada boshqa restoran bilan kirilsa OLDINGISINING
   * buyurtmalariga ovoz chalinar va ro'yxatda ular ko'rinardi.
   */
  const unsubAuth = useAuth.subscribe((state) => {
    const nextRid = String(state.user?.restaurantId || state.restaurant?._id || '');
    if (state.status !== 'authed' || state.user?.role !== 'restaurant' || (nextRid && nextRid !== rid)) {
      stopNotificationCenter();
    }
  });
  cleanups.push(unsubAuth);

  teardown = () => {
    cleanups.splice(0).forEach((fn) => { try { fn(); } catch { /* ignore */ } });
  };
}

let teardown = null;

/**
 * Markazni to'liq to'xtatish: ovoz, taymerlar, socket, holat.
 * Keyingi kirishda startNotificationCenter() noldan boshlaydi.
 */
export function stopNotificationCenter() {
  if (!started) return;
  started = false;
  sessionNo += 1;
  teardown?.();
  teardown = null;

  repeatTimers.forEach((t) => clearTimeout(t));
  repeatTimers.clear();
  lastPlayedAt.clear();
  playCount.clear();
  liveIds.clear();
  stopSound();
  resetSocket();
  syncChain = Promise.resolve();
  seqKey = SEQ_KEY_PREFIX;

  useNotifications.setState({
    items: [], lastSeq: 0, connected: false, open: false, didFirstSync: false,
  });
}
