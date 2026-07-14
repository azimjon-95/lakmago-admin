// Yangi buyurtma signali — Web Audio API bilan (audio fayl kerak emas).
// Ikki marta "jiring" chalinadi (dosh-dosh).
let audioCtx = null;

function ctx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function beep(freq, start, duration) {
  const c = ctx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, c.currentTime + start);
  gain.gain.linearRampToValueAtTime(0.3, c.currentTime + start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + duration);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + duration);
}

// Yangi buyurtma — yoqimli ikki notali signal
export function playNewOrderSound() {
  try {
    beep(880, 0, 0.15);
    beep(1174, 0.18, 0.25);
  } catch {
    // audio bloklangan bo'lsa (foydalanuvchi hali sahifaga bosmagan) — e'tiborsiz
  }
}

// Qabul qilinganда qisqa "jik"
export function playAcceptSound() {
  try { beep(1046, 0, 0.12); } catch { /* ignore */ }
}
