import JSZip from 'jszip';
import { CATALOG_CATEGORIES } from '@/constants/catalogCategories';

/*
 * ZIP orqali ommaviy import.
 *
 * Kutilgan tuzilma:
 *   nimadir.zip
 *   ├── data.json          — massiv: [{ id, nomi, kategoriya, desc, rasim }]
 *   └── images/            — data.json'dagi "rasim" yo'llari shu papkaga nisbatan
 *       ├── banan.jpg
 *       └── ...
 *
 * Bu modul FAQAT tahlil va moslashtirish qiladi — tarmoq so'rovi
 * yubormaydi. Haqiqiy yuklash (Cloudinary + API) CatalogZipImport.jsx
 * komponentida, ko'rib chiqishdan (review) keyin amalga oshadi.
 */

const MIME_BY_EXT = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', gif: 'image/gif',
};

function guessMime(path) {
  const ext = path.split('.').pop()?.toLowerCase();
  return MIME_BY_EXT[ext] || 'image/jpeg';
}
function normalize(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/['’‘ʻ`]/g, "'") // turli apostrof belgilarini bittaga tenglashtiramiz
    .replace(/\s+/g, ' ');
}

const CATEGORY_INDEX = new Map(
  CATALOG_CATEGORIES.map((c) => [normalize(c.label), c.value]),
);

// "Yangi meva" -> 'yangi_meva'. Topilmasa null.
export function matchCategory(label) {
  return CATEGORY_INDEX.get(normalize(label)) || null;
}

/**
 * ZIP faylni o'qib, tahlil qilingan qatorlar ro'yxatini qaytaradi.
 * Har bir qator: { id, name, description, categoryLabel, categoryValue,
 *                  imagePath, imageBlob, imagePreviewUrl, errors: [] }
 *
 * Tarmoqqa hech narsa yubormaydi — faqat ZIP ichidagi ma'lumotni o'qiydi.
 */
export async function parseCatalogZip(file) {
  const zip = await JSZip.loadAsync(file);

  const dataFile = zip.file(/(^|\/)data\.json$/i)[0];
  if (!dataFile) {
    throw new Error("ZIP ichida data.json topilmadi");
  }

  let raw;
  try {
    raw = JSON.parse(await dataFile.async('string'));
  } catch {
    throw new Error("data.json noto'g'ri JSON formatda");
  }
  if (!Array.isArray(raw)) {
    throw new Error("data.json massiv bo'lishi kerak: [ {...}, {...} ]");
  }
  if (raw.length === 0) {
    throw new Error("data.json bo'sh");
  }

  // data.json qayerda ekanini bilib olamiz — "images/x.jpg" yo'li
  // shunga NISBATAN berilgan bo'lishi mumkin (masalan zip ichida
  // hammasi bitta papka ichida bo'lsa: mevalar/data.json, mevalar/images/...)
  const basePath = dataFile.name.includes('/')
    ? dataFile.name.slice(0, dataFile.name.lastIndexOf('/') + 1)
    : '';

  const rows = await Promise.all(raw.map(async (entry, idx) => {
    const errors = [];

    const name = String(entry.nomi || entry.name || '').trim();
    if (!name) errors.push('Nomi yo\u2018q');
    else if (name.length < 2 || name.length > 120) errors.push("Nomi 2-120 belgi bo'lishi kerak");

    const categoryLabel = String(entry.kategoriya || entry.category || '').trim();
    const categoryValue = matchCategory(categoryLabel);
    if (!categoryLabel) errors.push('Kategoriya yo\u2018q');
    else if (!categoryValue) errors.push(`Kategoriya topilmadi: "${categoryLabel}"`);

    const description = String(entry.desc || entry.description || '').trim();

    const imagePath = String(entry.rasim || entry.rasm || entry.image || '').trim();
    let imageBlob = null;
    let imagePreviewUrl = null;
    if (!imagePath) {
      errors.push('Rasm yo\u2018li yo\u2018q');
    } else {
      const zipEntry = zip.file(basePath + imagePath) || zip.file(imagePath);
      if (!zipEntry) {
        errors.push(`Rasm ZIP ichida topilmadi: ${imagePath}`);
      } else {
        const rawBlob = await zipEntry.async('blob');
        const fileName = imagePath.split('/').pop() || 'image.jpg';
        // JSZip blob turini avtomatik aniqlamaydi (odatda
        // application/octet-stream) — Cloudinary buni rad etishi
        // mumkin, shuning uchun kengaytmadan MIME turini o'zimiz
        // belgilaymiz va haqiqiy File obyekti yaratamiz.
        imageBlob = new File([rawBlob], fileName, { type: guessMime(fileName) });
        imagePreviewUrl = URL.createObjectURL(imageBlob);
      }
    }

    return {
      rowId: entry.id ?? idx,
      name,
      description,
      categoryLabel,
      categoryValue,
      imagePath,
      imageBlob,
      imagePreviewUrl,
      // Admin ko'rib chiqishda o'zgartirishi mumkin bo'lgan maydonlar
      included: errors.length === 0,
      errors,
    };
  }));

  return rows;
}

// Xotira sizib chiqmasin — modal yopilganda chaqiriladi
export function revokePreviewUrls(rows) {
  for (const r of rows) {
    if (r.imagePreviewUrl) URL.revokeObjectURL(r.imagePreviewUrl);
  }
}
