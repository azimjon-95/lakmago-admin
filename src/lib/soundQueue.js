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
let unlocked = false;
let muted = false;

function player(sound) {
  if (!players.has(sound)) {
    const el = new Audio(FILES[sound]);
    el.preload = 'auto';
    players.set(sound, el);
  }
  return players.get(sound);
}

/**
 * Brauzer cheklovini ochish. Birinchi bosishda chaqiriladi:
 * har faylni ovozsiz bir marta ijro etib to'xtatamiz, shundan
 * keyin dastur xohlagan paytda chala oladi.
 */
export function unlockSound() {
  if (unlocked) return;
  unlocked = true;

  Object.keys(FILES).forEach((sound) => {
    const el = player(sound);
    const prev = el.volume;
    el.volume = 0;
    el.play()
      .then(() => { el.pause(); el.currentTime = 0; el.volume = prev; })
      .catch(() => { el.volume = prev; });
  });

  /*
   * Halqa DARHOL yoqilmaydi.
   *
   * Sahifa ko'rinib turganda play() baribir ishlaydi — halqa
   * hech narsa bermaydi, faqat quvvat sarflaydi. U faqat
   * sahifa fonga o'tganda kerak, o'sha paytda yoqiladi:
   * sessiya hali tirik bo'lgani uchun halqa uni ushlab qoladi.
   */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') startKeepAlive();
    else stopKeepAlive();
  });
}

/** Navbatdagi keyingi ovozni chalish. */
function next() {
  if (playing) return;
  const item = queue.shift();
  if (!item) return;
  const { sound } = item;

  const el = player(sound);
  el.volume = currentVolume();

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
    try { el.pause(); el.currentTime = 0; } catch { /* ignore */ }
  });
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
