import { buildCovers } from './coverSet.js';

/*
 * Katalog guruhlari muqova rasmlari: `src/assets/catalog-groups/<id>@<kenglik>.webp` (480, 720, 1200 — srcset) yoki oddiy
 * `<id>.webp`. Fayl papkaga tushishi bilan O'ZI ulanadi (kodni o'zgartirish shart emas). Rasm bo'lmasa — kartochka
 * gradient + emoji bilan chiziladi (constants/catalogGroups.js). Tafsilot: lib/coverSet.js
 */
const files = import.meta.glob('/src/assets/catalog-groups/*.{webp,jpg,jpeg,png,avif}', { eager: true, query: '?url', import: 'default' });
const COVERS = buildCovers(files);

/** Eski API: bitta URL (o'rtacha variant). */
export const groupCover = (id) => COVERS[id]?.src || null;
/** Responsive: { src, srcSet } — <img src srcSet sizes> uchun. */
export const groupCoverImg = (id) => COVERS[id] || null;

// Kartochka kengligi: telefonda 2 ustun (~46vw), planshetda 3 ustun (~30vw), kompyuterda 3 ustun yon menyu bilan (~24vw)
export const CARD_SIZES = '(min-width: 1024px) 24vw, (min-width: 640px) 30vw, 46vw';
// Guruh sahifasidagi keng banner
export const BANNER_SIZES = '(min-width: 1024px) 720px, 100vw';
