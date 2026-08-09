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

const players = new Map();   // sound → HTMLAudioElement
let queue = [];              // chalinishi kutilayotgan ovozlar
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
  const sound = queue.shift();
  if (!sound) return;

  const el = player(sound);
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

/** Ovozni navbatga qo'shish. Yangi bildirishnoma kelganda chaqiriladi. */
export function playSound(sound) {
  if (muted || sound === 'none' || !FILES[sound]) return;

  // Bir xil ovoz navbatda ikki marta turmasin — ketma-ket
  // 5 ta buyurtma kelsa 5 marta emas, bir marta chalinadi
  if (queue[queue.length - 1] === sound) return;

  queue.push(sound);
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

/** Butun ovozni o'chirish/yoqish (panel sozlamasi). */
export function setMuted(value) {
  muted = Boolean(value);
  if (muted) stopSound();
}

export function isMuted() {
  return muted;
}
