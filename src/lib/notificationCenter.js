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
  if (!['NEW', 'DELIVERED'].includes(n.status)) return;
  if (!soundAllowed(n.type)) return;

  const born = new Date(n.createdAt).getTime();
  // Eski xabar takrorlanmaydi — ahamiyatini yo'qotgan
  if (Date.now() - born >= REPEAT_MAX_AGE_MS) return;
  if ((playCount.get(id) || 0) >= MAX_PLAYS) return;

  const last = lastPlayedAt.get(id) ?? born;
  const wait = Math.max(0, last + repeatInterval * 1000 - Date.now());

  const timer = setTimeout(() => {
    repeatTimers.delete(id);

    // Vaqt kelganda holatni QAYTA tekshiramiz: xabar shu orada
    // qabul qilingan yoki o'chirilgan bo'lishi mumkin
    const fresh = useNotifications.getState().items
      .find((x) => x.notificationId === id);
    if (!fresh) { clearRepeat(id); return; }
    if (!['NEW', 'DELIVERED'].includes(fresh.status)) { clearRepeat(id); return; }
    if (Date.now() - new Date(fresh.createdAt).getTime() >= REPEAT_MAX_AGE_MS) return;

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

const readSeq = () => Number(localStorage.getItem(SEQ_KEY)) || 0;
const writeSeq = (v) => { try { localStorage.setItem(SEQ_KEY, String(v)); } catch { /* ignore */ } };

export const useNotifications = create((set, get) => ({
  items: [],            // eng yangisi birinchi
  lastSeq: readSeq(),
  connected: false,
  muted: isMuted(),
  open: false,          // panel ochiqmi
  didFirstSync: false,  // birinchi sync tugadimi (poyga himoyasi)

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
        .forEach((n) => {
          playSound(n.sound, n.priority);
          // Birinchi chalish ham hisobga olinadi — takroriy sikl
          // bilan birga JAMI 5 marta bo'lsin (6 emas)
          playCount.set(n.notificationId, 1);
          lastPlayedAt.set(n.notificationId, Date.now());
        });

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

    // Yangi kelganlar uchun takroriy ovoz rejasi
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
   * Yo'qolganlarini serverdan olib kelish.
   *
   * POYGA HOLATI TUZATILDI (2026-08): avval faqat `initial: true`
   * bilan chaqirilgan sync jim edi. Lekin socket 'connect'
   * hodisasi ham sync() chaqirardi — JIM EMAS. Agar socket
   * dastlabki sync tugashidan OLDIN ulansa (login paytida
   * odatda shunday bo'ladi), u `?after=0` bilan BARCHA eski
   * bildirishnomalarni olib kelib, ularni "yangi" deb OVOZ
   * bilan chalardi — foydalanuvchi shikoyat qilgan holat aynan
   * shu edi.
   *
   * Endi: birinchi muvaffaqiyatli sync HAR DOIM jim, qaysi
   * yo'ldan chaqirilishidan qat'i nazar.
   */
  async sync({ initial = false } = {}) {
    const firstEver = !get().didFirstSync;
    const silent = initial || firstEver;
    try {
      // Birinchi yuklanишda javob berilmaganlar, keyin esa
      // oxirgi seq'dan keyingilari
      const qs = initial ? '' : `?after=${get().lastSeq}`;
      const data = await apiFetch(`/panel/notifications${qs}`);
      const items = data?.items || [];

      // Dastlabki yuklanishda ovoz chalinmaydi: bu eski ishlar,
      // panel ochilishi bilan shovqin bo'lmasin
      get().ingest(items, { silent });
      if (firstEver) set({ didFirstSync: true });

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

    // Boshqa qurilmada qabul qilinsa — bu yerda ham jimiydi
    if (['ACCEPTED', 'CANCELLED', 'MUTED'].includes(status)) {
      clearRepeat(notificationId);
    } else {
      syncRepeats();
    }
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
  /*
   * Zaxira sinxronlash.
   *
   * Sahifa fonda bo'lsa so'rov YUBORILMAYDI: socket baribir
   * ulanib turibdi va hodisalarni yetkazadi, ko'rinmayotgan
   * tabdan har daqiqada tarmoqni bezovta qilishning ma'nosi
   * yo'q. Qaytib kelinganda darhol bir marta sinxronlanadi —
   * ya'ni ma'lumot eskirib qolmaydi.
   */
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    useNotifications.getState().sync();
  }, 60000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      useNotifications.getState().sync();
      syncRepeats();
    }
  });

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
   * Javob berilmagan bildirishnoma QAYTA-QAYTA eslatiladi —
   * telefon jiringlagani kabi. Bitta marta chalinib jim
   * qolsa, ekrandan uzoqdagi admin uni butunlay o'tkazib
   * yuborishi mumkin edi — aynan shu "yaxshi ishlamayapti"
   * degan shikoyatning sababi.
   *
   * Faqat NEW/DELIVERED holatidagilar takrorlanadi: bildirishnoma
   * ochib ko'rilsa (SEEN) yoki chindan hal qilinsa (ACCEPTED/
   * CANCELLED/MUTED) — jimiydi. Har bir tur o'zining ovozidan
   * foydalanadi, sozlamada o'chirilgan turlar tinch qoladi.
   */
  syncRepeats();

  /*
   * Takrorlash oralig'i sozlamada o'zgarsa rejalar qayta
   * quriladi. Ilgari 2 soniyalik sikl yangi qiymatni keyingi
   * aylanishida o'zi o'qib olardi; rejalangan taymerga esa
   * aniq xabar berish kerak.
   */
  useNotifSettings.subscribe(() => {
    repeatTimers.forEach((t) => clearTimeout(t));
    repeatTimers.clear();
    syncRepeats();
  });
}
