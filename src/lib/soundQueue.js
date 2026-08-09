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
}

/** Navbatdagi keyingi ovozni chalish. */
function next() {
  if (playing) return;
  const item = queue.shift();
  if (!item) return;
  const { sound } = item;

  const el = player(sound);
  el.volume = currentVolume();
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
