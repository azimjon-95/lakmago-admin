import { useEffect, useRef, useState } from 'react';
import { validateVideo, formatMB, MAX_VIDEO_BYTES } from '@/lib/adVideo';

/*
 * Reklama uchun video tanlash. Fayl YUKLANMAYDI — faqat tanlanadi va
 * ko'rsatiladi; "Yuborish"da serverga multipart bilan ketadi va u yerda
 * bazaga saqlanmasdan Telegram'ga uzatiladi.
 *
 * value: File | null · onChange(file | null)
 */
export function VideoPicker({ value, onChange, disabled = false, label = 'Video (ixtiyoriy)' }) {
  const inputRef = useRef(null);
  const [err, setErr] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');

  // Ko'rish uchun vaqtinchalik havola — almashganda/yopilganda bo'shatiladi
  useEffect(() => {
    if (!value) { setPreviewUrl(''); return undefined; }
    const url = URL.createObjectURL(value);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const pick = () => { if (!disabled) inputRef.current?.click(); };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = ''; // bir xil faylni qayta tanlash ham ishlasin
    if (!file) return;
    const problem = validateVideo(file);
    setErr(problem);
    if (!problem) onChange(file);
  };

  return (
    <div>
      {label && <label className="block text-sm font-medium text-ink mb-1.5">{label}</label>}
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        onChange={handleFile}
        className="hidden"
        data-testid="video-input"
      />

      {value ? (
        <div className="rounded-xl border border-line overflow-hidden bg-canvas">
          <video
            src={previewUrl}
            controls
            muted
            playsInline
            preload="metadata"
            className="w-full bg-black"
            style={{ maxHeight: 220 }}
          />
          <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
            <span className="min-w-0 truncate text-ink" title={value.name}>
              <i className="ti ti-video mr-1.5 text-muted" />{value.name} · {formatMB(value.size)}
            </span>
            <span className="flex flex-none gap-3">
              <button type="button" onClick={pick} disabled={disabled} className="text-brand-600 hover:underline disabled:opacity-40">Almashtirish</button>
              <button type="button" onClick={() => { setErr(''); onChange(null); }} disabled={disabled} className="text-red-600 hover:underline disabled:opacity-40">O‘chirish</button>
            </span>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={pick}
          disabled={disabled}
          className="w-full rounded-xl border-2 border-dashed border-line hover:border-brand-400 bg-canvas transition-colors flex flex-col items-center justify-center gap-1.5 py-10 text-muted disabled:opacity-50"
          style={{ aspectRatio: '16/9' }}
        >
          <i className="ti ti-video-plus text-3xl" />
          <span className="text-sm">Video tanlash</span>
          <span className="text-[11px]">MP4, MOV, WEBM — {MAX_VIDEO_BYTES / 1024 / 1024} MB gacha</span>
        </button>
      )}

      {err && <div className="mt-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</div>}
    </div>
  );
}
