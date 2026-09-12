/**
 * Markaziy ovoz xizmati.
 *
 * Muammolar va yechimlar:
 *
 * 1. Uch xil ovoz bir vaqtda kelsa ustma-ust chalinardi va
 *    hech biri eshitilmasdi → navbat. Bittasi tugagach keyingisi.
 *
 * 2. Har sahifa o'z Audio nusxasini yaratardi → bitta joyda
 *    yaratiladi va qayta ishlatiladi.
 *
 * 3. Brauzer foydalanuvchi bosmaguncha ovozga ruxsat bermaydi →
 *    birinchi bosishda "ochib qo'yamiz" (unlock).
 *
 * 4. Accept/Cancel/Mute bosilganda ovoz DARHOL to'xtashi kerak →
 *    stop() navbatni ham tozalaydi.
 */

const FILES = {
  orders: '/sounds/orders.mp3',
  reservations: '/sounds/reservations.mp3',
  'hall-orders': '/sounds/hall-orders.mp3',
};

import { currentVolume } from '@/lib/notifSettings';

/**
 * Jimjit halqa — fon rejimida ovozni saqlab qolish uchun.
 *
 * MUAMMO: telefon brauzeri ilova fonga o'tganda audio
 * sessiyani to'xtatadi va keyingi play() jim o'tib ketadi.
 * Bitta ovoz uzluksiz chalinib tursa, tizim sessiyani ochiq
 * deb biladi.
 *
 * ILGARI: halqa unlockSound() da yoqilib, BUTUN SEANS
 * davomida to'xtovsiz aylanardi. Noutbukda bu:
 *   - audio qurilmasini uyquga ketishдan to'sadi
 *   - har soniyada WAV dekodlanadi
 *   - brauzer tabni "ovoz chalayotgan" deb belgilaydi va
 *     uni past quvvat rejimiga tushirmaydi
 * Ish stolida esa u UMUMAN KERAK EMAS: desktop brauzerlar
 * fon tabidagi audio sessiyani to'xtatmaydi.
 *
 * ENDI: halqa faqat KERAK BO'LGANDA — mobil qurilmada va
 * faqat sahifa FONGA o'tgan paytda ishlaydi. Qaytib
 * kelinganda darhol o'chadi.
 */
let keepAlive = null;

/*
 * Sensorli, sichqonchasiz qurilma — ya'ni telefon/planshet.
 * Noutbukda (sensorli ekran bo'lsa ham sichqonchasi bor)
 * `hover: hover` rost bo'ladi va halqa umuman yoqilmaydi.
 */
const needsKeepAlive = () => typeof window !== 'undefined'
  && window.matchMedia?.('(hover: none) and (pointer: coarse)').matches;

function makeSilentLoop() {
  // 1 soniyalik jim WAV — tashqi faylsiz, base64 orqali
  const el = new Audio(
    'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=',
  );
  el.loop = true;
  el.volume = 0.0001;   // 0 bo'lsa ba'zi brauzerlar to'xtatadi
  return el;
}

/** Fon rejimida ovoz o'chib qolmasligi uchun sessiyani ushlab turadi. */
export function startKeepAlive() {
  if (keepAlive || !needsKeepAlive()) return;
  keepAlive = makeSilentLoop();
  keepAlive.play().catch(() => { keepAlive = null; });
}

export function stopKeepAlive() {
  if (!keepAlive) return;
  try { keepAlive.pause(); } catch { /* ignore */ }
  keepAlive = null;
}

const players = new Map();   // sound → HTMLAudioElement
// Navbat elementlari: { sound, priority }
let queue = [];
let playing = false;
let muted = false;

/*
 * Ruxsati ochilgan elementlar va hozir "ochilayotgan"lar.
 * Ochilayotgan element ustida haqiqiy ovoz boshlansa, ochish
 * jarayoni uni to'xtatib qo'ymasligi uchun ajratib turiladi.
 */
/*
 * ═══ QULF: BIRINCHI YUKLANISH TUGAMAGUNCHA OVOZ YO'Q ═══
 *
 * Ovoz FAQAT bildirishnoma markazi birinchi sinxronlashni
 * tugatgandan keyin ochiladi (notificationCenter → armSound).
 *
 * Bu himoya qatlami: panelga kirganda ovoz chalinishi mumkin
 * bo'lgan HAR QANDAY yo'lni yopadi — kod xatosi, kutilmagan
 * hodisa yoki kelajakda qo'shiladigan yangi chaqiruv bo'lsa ham.
 * Sabab: mijoz "kirsam hamma musiqa chalib yubordi" deb shikoyat
 * qildi; bitta joyni tuzatish yetarli emas, kafolat kerak.
 */
let armed = false;

export function armSound(value = true) {
  armed = value;
}

export function isSoundArmed() {
  return armed;
}

const unlockedEls = new WeakSet();
const unlockingEls = new Set();
let visibilityBound = false;

function player(sound) {
  if (!players.has(sound)) {
    const el = new Audio(FILES[sound]);
    el.preload = 'auto';
    players.set(sound, el);
  }
  return players.get(sound);
}

/**
 * Brauzer cheklovini ochish — foydalanuvchi ekranga tekkanida.
 *
 * ═══ XATO TUZATILDI: iPhone'da "kirishim bilan muzika chaladi" ═══
 *
 * AVVAL: har fayl `volume = 0` qilib ijro etilardi. Lekin iOS'da
 * (Safari, Telegram ichidagi brauzer, PWA) `volume` FAQAT O'QISH
 * UCHUN — tizim uni e'tiborsiz qoldiradi. Natijada panelga
 * birinchi tegishda UCHALA qo'ng'iroq (buyurtma, bron, zal) to'liq
 * balandlikda chalinib ketardi — ro'yxat bo'sh bo'lsa ham.
 *
 * ENDI: `muted = true` — bu iOS'da ham ishlaydi. Element ovozsiz
 * ijro etilib darhol to'xtatiladi; foydalanuvchi harakati ichida
 * ijro etilgani uchun keyin dastur uni bemalol chala oladi.
 *
 * Idempotent: muvaffaqiyatsiz bo'lgan element keyingi tegishda
 * qayta uriniladi. @returns {boolean} hammasi ochilganmi
 */
export function unlockSound() {
  Object.keys(FILES).forEach((sound) => {
    const el = player(sound);
    if (unlockedEls.has(el) || unlockingEls.has(el) || !el.paused) return;

    unlockingEls.add(el);
    el.muted = true;
    const finish = (ok) => {
      // Shu orada haqiqiy ovoz boshlangan bo'lsa (next() egallagan) — tegmaymiz
      if (!unlockingEls.has(el)) return;
      unlockingEls.delete(el);
      try { el.pause(); el.currentTime = 0; } catch { /* ignore */ }
      el.muted = false;
      if (ok) unlockedEls.add(el);
    };
    try {
      Promise.resolve(el.play()).then(() => finish(true), () => finish(false));
    } catch {
      finish(false);
    }
  });

  /*
   * Halqa DARHOL yoqilmaydi — faqat sahifa fonga o'tganda kerak
   * (sessiya hali tirik bo'lgani uchun halqa uni ushlab qoladi).
   */
  if (!visibilityBound) {
    visibilityBound = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') startKeepAlive();
      else stopKeepAlive();
    });
  }
  return isSoundUnlocked();
}

/** Barcha ovoz fayllari ochilganmi. */
export function isSoundUnlocked() {
  return Object.keys(FILES).every((sound) => unlockedEls.has(player(sound)));
}

/** Navbatdagi keyingi ovozni chalish. */
function next() {
  if (playing) return;
  const item = queue.shift();
  if (!item) return;
  const { sound } = item;

  const el = player(sound);
  // Element hali "ochilayotgan" bo'lsa — egallaymiz: ochish jarayoni
  // endi uni to'xtatmaydi, ovoz esa jim qolmaydi
  unlockingEls.delete(el);
  el.muted = false;
  el.volume = currentVolume();   // iOS'da e'tiborsiz — tizim balandligi ishlaydi

  /*
   * Tizimga bu "media" ekanini bildiramiz. Shusiz ba'zi
   * telefonlarda fon rejimidagi ovoz bloklanadi.
   */
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: 'LokmaGo — yangi buyurtma',
        artist: 'Restoran paneli',
      });
      navigator.mediaSession.playbackState = 'playing';
    } catch { /* qo'llab-quvvatlanmasa muhim emas */ }
  }
  playing = true;

  const done = () => {
    playing = false;
    el.removeEventListener('ended', done);
    // Ketma-ket ovozlar bir-biriga yopishmasin
    setTimeout(next, 120);
  };
  el.addEventListener('ended', done);

  el.currentTime = 0;
  el.play().catch(() => { done(); });
}

const RANK = { CRITICAL: 0, HIGH: 1, NORMAL: 2 };

/**
 * Ovozni navbatga qo'shish.
 *
 * Muhimlik hisobga olinadi: ofitsiant chaqiruvi (CRITICAL)
 * oddiy buyurtmalar navbati ortida kutib qolmaydi — u oldinga
 * o'tadi. Mijoz stolda kutib turibdi.
 */
export function playSound(sound, priority = 'NORMAL') {
  // Qulf ochilmagan (panel endi yuklanmoqda) — hech narsa chalinmaydi
  if (!armed) return;
  if (muted || sound === 'none' || !FILES[sound]) return;

  // Bir xil ovoz navbatda ikki marta turmasin — ketma-ket
  // 5 ta buyurtma kelsa 5 marta emas, bir marta chalinadi
  const last = queue[queue.length - 1];
  if (last && last.sound === sound && last.priority === priority) return;

  queue.push({ sound, priority });
  queue.sort((a, b) => RANK[a.priority] - RANK[b.priority]);
  next();
}

/** Darhol to'xtatish va navbatni tozalash. */
export function stopSound() {
  queue = [];
  playing = false;
  players.forEach((el) => {
    if (unlockingEls.has(el)) return;   // jim ochish jarayoni — o'zi tugaydi
    try { el.pause(); el.currentTime = 0; } catch { /* ignore */ }
  });
  if ('mediaSession' in navigator) {
    try { navigator.mediaSession.playbackState = 'none'; } catch { /* ignore */ }
  }
}

/** Joriy tovush balandligini qo'llash (sozlama o'zgarganda). */
export function applyVolume() {
  const v = currentVolume();
  players.forEach((el) => { el.volume = v; });
}

/** Butun ovozni o'chirish/yoqish (panel sozlamasi). */
export function setMuted(value) {
  muted = Boolean(value);
  if (muted) stopSound();
}

export function isMuted() {
  return muted;
}
