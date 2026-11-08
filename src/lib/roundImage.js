/*
 * Rasmni YUMALOQ qilib kesish (brauzerda, canvas). Markazdan kvadratga kesiladi, doira tashqarisi shaffof bo'ladi.
 * Natija: PNG Blob (shaffoflik uchun). Kategoriya ikoni va kartasi uchun ishlatiladi.
 */
export async function makeRoundImage(file, size = 512) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('Rasmni o‘qib bo‘lmadi (JPG, PNG yoki WebP tanlang)'));
      im.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    return await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Rasmni tayyorlab bo‘lmadi'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}
