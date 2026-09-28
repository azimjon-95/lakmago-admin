/*
 * Kilometrga qarab yetkazish narxi — PANEL KO'RINISHI uchun
 * ("Mijoz nimani ko'radi" misoli).
 *
 * Bu HAQIQIY narx emas: haqiqiy narxni server hisoblaydi
 * (lakmago-server/src/services/deliveryEngine.js) va mijozga ham,
 * buyurtmaga ham o'sha yoziladi. Bu funksiya faqat restoran
 * sozlamani o'zgartirganda natijani darhol ko'rishi uchun — formula
 * serverdagi bilan AYNAN bir xil:
 *
 *   narx = basePrice + (masofa − freeKm) × perKm
 *
 *   • masofa freeKm ichida bo'lsa — faqat basePrice (0 bo'lsa bepul);
 *   • faqat km qismi 100 so'mgacha yaxlitlanadi, basePrice o'zgarmaydi.
 */
export function perKmFee(distanceKm, { freeKm = 0, perKm = 0, basePrice = 0 } = {}) {
  const base = Math.max(0, Math.round(Number(basePrice) || 0));
  const free = Math.max(0, Number(freeKm) || 0);
  const per = Math.max(0, Math.round(Number(perKm) || 0));
  const paidKm = Math.max(0, Number(distanceKm) - free);
  return base + Math.round((paidKm * per) / 100) * 100;
}

/** 5000 → "5 000" */
export const fmtSom = (n) => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/\u00a0/g, ' ');

/** Serverdagi zod chegarasi (restaurantPanel.js) bilan bir xil. */
export const BASE_PRICE_MAX = 500000;
