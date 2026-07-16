import { useState, useRef } from 'react';
import { uploadImage, optimizeUrl } from '@/lib/cloudinary';

// Bitta rasm yuklash komponenti (taom yoki banner uchun).
// value = rasm URL (bor bo'lsa preview), onChange(url) — yuklangач chaqiriladi.
// folder = 'dishes' yoki 'banners'.
export function ImageUpload({ value, onChange, folder = 'dishes', label = 'Rasm', aspect = '4/3' }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState(null);
  const inputRef = useRef(null);

  const pick = () => inputRef.current?.click();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Tekshiruv — faqat rasm, 5MB gacha
    if (!file.type.startsWith('image/')) { setErr('Faqat rasm fayli'); return; }
    if (file.size > 5 * 1024 * 1024) { setErr('Rasm 5MB dan katta bo\u2018lmasin'); return; }

    setErr(null);
    setUploading(true);
    setProgress(0);
    try {
      const { url } = await uploadImage(file, folder, setProgress);
      onChange(url);
    } catch (e2) {
      setErr(e2.message || 'Yuklashda xato');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
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
    </div>
  );
}
