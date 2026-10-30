/*
 * Katalog guruhlari muqova rasmlari. Fayl `src/assets/catalog-groups/<guruh-id>.webp|jpg|png` papkaga tushishi bilan
 * O'ZI ulanadi (kodni o'zgartirish shart emas): gosht, sut, sabzavot, meva, don, ichimlik, non, ziravor, tayyor,
 * bolalar_gigiyena, bolalar_ovqat, uyrozgor, kimyo, tozalash, qogoz, oshxona.
 * Rasm bo'lmasa — kartochka gradient + emoji bilan chiziladi (constants/catalogGroups.js).
 */
const files = import.meta.glob('/src/assets/catalog-groups/*.{webp,jpg,jpeg,png,avif}', { eager: true, query: '?url', import: 'default' });
const COVERS = {};
for (const [path, url] of Object.entries(files)) COVERS[path.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase()] = url;

export const groupCover = (id) => COVERS[id] || null;
