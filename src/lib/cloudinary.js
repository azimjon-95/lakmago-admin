import { apiFetch } from '@/api/client';

// Rasmni TO'G'RIDAN Cloudinary'ga yuklaydi (server orqali o'tmaydi — tez va tejamli).
// Jarayon:
//   1. Serverdan imzo (signature) olamiz — API Secret frontendga tushmaydi
//   2. Rasmni to'g'ridan Cloudinary API'ga POST qilamiz
//   3. Faqat natija URL'ni qaytaramiz (server bazaga saqlaydi)
//
// folder: 'dishes' (taom) yoki 'banners' (banner)
export async function uploadImage(file, folder = 'dishes', onProgress) {
  // 1. Serverdan imzo
  const sig = await apiFetch(`/upload/signature?folder=${folder}`);
  // sig = { cloudName, apiKey, timestamp, folder, signature }

  // 2. Cloudinary'ga to'g'ridan yuklash
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', sig.timestamp);
  form.append('signature', sig.signature);
  form.append('folder', sig.folder);

  const url = `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`;

  // XMLHttpRequest — progress kuzatish uchun
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        // secure_url — HTTPS rasm manzili (serverga shu saqlanadi)
        resolve({ url: data.secure_url, publicId: data.public_id, width: data.width, height: data.height });
      } else {
        reject(new Error('Cloudinary yuklash xatosi: ' + xhr.status));
      }
    };
    xhr.onerror = () => reject(new Error('Tarmoq xatosi'));
    xhr.send(form);
  });
}

// Cloudinary URL'ni optimallashtirish — avtomatik format (WebP/AVIF) va sifat.
// Rasm ko'rsatishда shu ishlatiladi — tez yuklanadi, kam trafik.
// Masalan: optimizeUrl(url, 400) → 400px kenglikда, auto format/sifat
export function optimizeUrl(url, width = 400) {
  if (!url || !url.includes('/upload/')) return url;
  // f_auto (format: WebP/AVIF), q_auto (sifat), w_ (kenglik), c_fill (kesib to'ldirish)
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width},c_fill/`);
}
