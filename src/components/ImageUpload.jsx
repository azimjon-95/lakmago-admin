import { useState, useRef } from 'react';
import { uploadImage, optimizeUrl } from '@/lib/cloudinary';
import { ImageCropper } from './ImageCropper';

// Bitta rasm yuklash komponenti (taom yoki banner uchun).
// value = rasm URL (bor bo'lsa preview), onChange(url) — yuklangач chaqiriladi.
// folder = 'dishes' yoki 'banners'.
export function ImageUpload({ value, onChange, folder = 'dishes', label = 'Rasm', aspect = '4/3' }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState(null);
  // Qirqish oynasiga tushadigan tanlangan fayl
  const [cropping, setCropping] = useState(null);
  const inputRef = useRef(null);

  const pick = () => inputRef.current?.click();

  // 'aspect' propi "4/3" ko'rinishida keladi — songa aylantiramiz
  const ratio = (() => {
    const [w, h] = String(aspect).split('/').map(Number);
    return h ? w / h : 4 / 3;
  })();

  /*
   * Fayl tanlangach DARHOL yuklanmaydi — avval qirqish oynasi.
   *
   * Sabab: telefondan olingan rasm odatda vertikal (9:16), menyu
   * kartochkasi esa gorizontal (4:3). Avtomatik `object-fit: cover`
   * markazni oladi va taomning yarmi kesilib qolardi. Endi
   * qaysi joyni ko'rsatishni foydalanuvchi hal qiladi.
   *
   * Qo'shimcha foyda: qirqilgan rasm asl fayldan kichik bo'ladi,
   * ya'ni yuklash tezroq va Cloudinary'da kam joy egallaydi.
   */
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) { setErr('Faqat rasm fayli'); return; }
    if (file.size > 5 * 1024 * 1024) { setErr('Rasm 5MB dan katta bo‘lmasin'); return; }

    setErr(null);
    setCropping(file);
    // Bir xil faylni qayta tanlash ham ishlasin
    if (inputRef.current) inputRef.current.value = '';
  };

  const upload = async (file) => {
    setCropping(null);
    setUploading(true);
    setProgress(0);
    try {
      const { url } = await uploadImage(file, folder, setProgress);
      onChange(url);
    } catch (e2) {
      setErr(e2.message || 'Yuklashda xato');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {label && <label className="block text-sm font-medium text-ink mb-1.5">{label}</label>}

      <div
        onClick={!uploading ? pick : undefined}
        className="relative rounded-xl border-2 border-dashed border-line hover:border-brand-400 cursor-pointer overflow-hidden transition-colors bg-canvas"
        style={{ aspectRatio: aspect }}
      >
        {value ? (
          <>
            <img src={optimizeUrl(value, 600)} alt="" className="w-full h-full object-cover" loading="lazy" />
            {!uploading && (
              <div className="absolute inset-0 bg-black/0 hover:bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-all">
                <span className="text-white text-sm font-medium flex items-center gap-1.5">
                  <i className="ti ti-camera" /> Almashtirish
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted">
            <i className="ti ti-photo-plus text-3xl mb-1" />
            <span className="text-sm">Rasm tanlash</span>
            <span className="text-[11px] mt-0.5">JPG, PNG — 5MB gacha</span>
          </div>
        )}

        {/* Yuklash progress */}
        {uploading && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
            <div className="w-3/4 h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-brand-400 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-white text-xs mt-2">{progress}%</span>
          </div>
        )}
      </div>

      {err && <p className="text-xs text-red-600 mt-1.5">{err}</p>}
      {value && !uploading && (
        <button onClick={() => onChange('')} className="text-xs text-red-500 mt-1.5 hover:underline">
          Rasmni olib tashlash
        </button>
      )}

      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

      {cropping && (
        <ImageCropper
          file={cropping}
          aspect={ratio}
          onCancel={() => setCropping(null)}
          onDone={upload}
        />
      )}
    </div>
  );
}
