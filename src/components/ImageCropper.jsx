import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * RASM QIRQISH — surib, kattalashtirib markazini tanlash.
 *
 * NEGA KUTUBXONA EMAS:
 * react-easy-crop ~40 KB gzip. Bizga faqat bitta to'rtburchak
 * qirqish kerak — aylantirish, ko'p nuqta, filtrlar kerak emas.
 * Bu fayl ~4 KB va tashqi bog'liqlik qo'shmaydi.
 *
 * ISHLASH TAMOYILI:
 * Rasm CSS transform bilan siljitiladi (surish arzon, har
 * kadrda qayta chizish yo'q). "Saqlash" bosilgandagina bir
 * marta canvas'ga chiziladi va kesiladi.
 *
 * Natija ASL SIFATDA kesiladi, ekrandagi kichraytirilgan
 * ko'rinishdan emas — ya'ni qirqilgan rasm xira bo'lmaydi.
 */

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

export function ImageCropper({ file, aspect = 4 / 3, onCancel, onDone }) {
  const [img, setImg] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);

  const frameRef = useRef(null);
  const drag = useRef(null);
  const pinch = useRef(null);

  /* Faylni o'qish */
  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => setImg({ el: image, w: image.naturalWidth, h: image.naturalHeight });
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  /*
   * Rasm ramkani TO'LIQ qoplashi uchun kerakli o'lcham.
   *
   * `cover` mantiqi: qaysi o'lcham yetishmasa, o'sha bo'yicha
   * cho'ziladi. Shu tufayli qirqilgan joyda bo'sh (shaffof)
   * burchak qolmaydi.
   */
  const fit = useCallback(() => {
    const frame = frameRef.current;
    if (!frame || !img) return null;
    const fw = frame.clientWidth;
    const fh = fw / aspect;
    const scale = Math.max(fw / img.w, fh / img.h);
    return { fw, fh, w: img.w * scale, h: img.h * scale };
  }, [img, aspect]);

  /*
   * Chegara: rasm ramkadan uzoqlashib, chetida bo'sh joy
   * qolmasin. Foydalanuvchi qanchalik kuchli sursa ham
   * rasm ramkani qoplab turadi.
   */
  const clamp = useCallback((p, z) => {
    const f = fit();
    if (!f) return p;
    const maxX = Math.max(0, (f.w * z - f.fw) / 2);
    const maxY = Math.max(0, (f.h * z - f.fh) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, p.x)),
      y: Math.min(maxY, Math.max(-maxY, p.y)),
    };
  }, [fit]);

  useEffect(() => {
    setPos((p) => clamp(p, zoom));
  }, [zoom, clamp]);

  /* ═══ Surish va ikki barmoq ═══ */
  const dist = (t) => Math.hypot(
    t[0].clientX - t[1].clientX,
    t[0].clientY - t[1].clientY,
  );

  const onStart = (e) => {
    if (e.touches?.length === 2) {
      drag.current = null;
      pinch.current = { d: dist(e.touches), z: zoom };
      return;
    }
    const p = e.touches?.[0] || e;
    drag.current = { x: p.clientX - pos.x, y: p.clientY - pos.y };
  };

  const onMove = (e) => {
    if (pinch.current && e.touches?.length === 2) {
      const ratio = dist(e.touches) / pinch.current.d;
      setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinch.current.z * ratio)));
      e.preventDefault();
      return;
    }
    if (!drag.current) return;
    const p = e.touches?.[0] || e;
    setPos(clamp({ x: p.clientX - drag.current.x, y: p.clientY - drag.current.y }, zoom));
    // Sahifa surilib ketmasin
    if (e.cancelable) e.preventDefault();
  };

  const onEnd = () => { drag.current = null; pinch.current = null; };

  /*
   * touchmove QO'LDA qo'shiladi: React propi passiv bo'lgani
   * uchun undagi preventDefault e'tiborsiz qoldiriladi va
   * rasmni surganda sahifa ham surilib ketardi.
   */
  useEffect(() => {
    const node = frameRef.current;
    if (!node) return undefined;
    node.addEventListener('touchmove', onMove, { passive: false });
    return () => node.removeEventListener('touchmove', onMove);
  });

  /* ═══ Kesish ═══ */
  const crop = async () => {
    const f = fit();
    if (!f || !img) return;
    setBusy(true);

    try {
      /*
       * Chiqish o'lchami ekranga emas, ASL rasmga bog'lanadi.
       * Ekranda 300px ko'ringan rasm 1200px bo'lib kesiladi —
       * aks holda menyudagi katta kartochkada xira chiqardi.
       */
      const outW = Math.min(1600, Math.round(img.w / (f.w / f.fw) * zoom * 2));
      const outH = Math.round(outW / aspect);

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';

      // Ekrandagi o'lchamdan asl rasmdagi o'lchamga o'tish
      const k = outW / f.fw;
      const dw = f.w * zoom * k;
      const dh = f.h * zoom * k;
      const dx = (outW - dw) / 2 + pos.x * k;
      const dy = (outH - dh) / 2 + pos.y * k;

      ctx.drawImage(img.el, dx, dy, dw, dh);

      const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.9));
      if (!blob) throw new Error('Kesib bo\u2018lmadi');

      onDone(new File([blob], 'crop.jpg', { type: 'image/jpeg' }));
    } catch {
      setBusy(false);
    }
  };

  const f = fit();

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black">

      <div className="flex-none flex items-center justify-between px-4 py-3">
        <button onClick={onCancel} className="text-white/80 text-sm font-medium">
          Bekor
        </button>
        <span className="text-white text-sm font-semibold">Rasmni joylashtiring</span>
        <button
          onClick={crop}
          disabled={busy || !img}
          className="text-brand-400 text-sm font-semibold disabled:opacity-40"
        >
          {busy ? '...' : 'Tayyor'}
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 min-h-0">
        <div
          ref={frameRef}
          onMouseDown={onStart}
          onMouseMove={(e) => drag.current && onMove(e)}
          onMouseUp={onEnd}
          onMouseLeave={onEnd}
          onTouchStart={onStart}
          onTouchEnd={onEnd}
          onTouchCancel={onEnd}
          className="relative w-full max-w-md overflow-hidden rounded-xl
                     bg-neutral-900 cursor-grab active:cursor-grabbing select-none"
          style={{ aspectRatio: aspect, touchAction: 'none' }}
        >
          {img && f && (
            <img
              src={img.el.src}
              alt=""
              draggable={false}
              className="absolute left-1/2 top-1/2 max-w-none will-change-transform"
              style={{
                width: f.w,
                height: f.h,
                transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) scale(${zoom})`,
              }}
            />
          )}

          {/* Uchdan bir chiziqlari — markazni topishga yordam beradi */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-y-0 left-1/3 w-px bg-white/25" />
            <div className="absolute inset-y-0 left-2/3 w-px bg-white/25" />
            <div className="absolute inset-x-0 top-1/3 h-px bg-white/25" />
            <div className="absolute inset-x-0 top-2/3 h-px bg-white/25" />
          </div>
        </div>
      </div>

      <div className="flex-none px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4">
        <div className="flex items-center gap-3">
          <i className="ti ti-photo text-white/50 text-sm" />
          <input
            type="range"
            min={MIN_ZOOM} max={MAX_ZOOM} step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-brand-400"
            aria-label="Kattalashtirish"
          />
          <i className="ti ti-photo text-white/50 text-xl" />
        </div>
        <p className="mt-2.5 text-center text-[12.5px] text-white/50">
          Barmoq bilan suring · ikki barmoq bilan kattalashtiring
        </p>
      </div>
    </div>
  );
}
