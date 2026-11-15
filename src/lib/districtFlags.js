/*
 * Tuman chegaralari (katalog hududi) UI — standart O'CHIQ. Vercel: VITE_DISTRICT_BOUNDARIES_ENABLED=true.
 * Yoqilganda ham server (DISTRICT_BOUNDARIES_ENABLED) o'chiq bo'lsa blok ko'rinmaydi — /admin/district-preview { enabled:false }.
 * Kuryer tumani (DistrictPicker) bunga bog'liq emas — avvalgidek ishlaydi.
 */
export const DISTRICT_BOUNDARIES_UI = import.meta.env?.VITE_DISTRICT_BOUNDARIES_ENABLED === 'true';
