/*
 * ═══════════════════════════════════════════════════════════
 * YUMSHOQ TEBRANISH
 * ═══════════════════════════════════════════════════════════
 *
 * Jonli yangilanish bo'lganda xodim ekranga qaramayotgan
 * bo'lishi mumkin — qisqa tebranish "raqam o'zgardi" deb
 * bildiradi.
 *
 * QAYERDA ISHLAYDI:
 *   • Telegram ichidagi brauzer — WebApp haptic API (eng silliq);
 *   • Android brauzer — navigator.vibrate;
 *   • iOS Safari — qo'llab-quvvatlamaydi, jimgina o'tkazib
 *     yuboriladi (xato bermaydi).
 *
 * Tebranish QISQA: 15 ms. Uzunroq bo'lsa bezovta qiladi,
 * ayniqsa buyurtmalar ketma-ket kelganda.
 */

/** Sahifa ko'rinmayotgan bo'lsa tebratmaymiz — foydasi yo'q. */
function pageVisible() {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

/**
 * @param {'soft'|'light'} [strength] Telegram uchun kuch darajasi
 */
export function softVibrate(strength = 'soft') {
  if (!pageVisible()) return;

  try {
    // Telegram WebApp — eng tabiiy his
    const tg = window.Telegram?.WebApp?.HapticFeedback;
    if (tg?.impactOccurred) {
      tg.impactOccurred(strength);
      return;
    }
  } catch { /* Telegram yo'q — davom etamiz */ }

  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(15);
    }
  } catch { /* qurilma qo'llab-quvvatlamaydi */ }
}
