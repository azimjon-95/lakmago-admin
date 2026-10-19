import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

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

/*
 * ═══ TO'LIQ KO'RSATISH REJIMI ═══
 * `allowFull` — "Kesish | To'liq ko'rsatish" tanlovi ko'rinadi. To'liq rejimda ramka rasmning O'Z nisbatiga
 * moslashadi (tik plakat tik ramka bo'ladi) va rasm KESILMAYDI: yuklanadigan fayl burilgan rasmning to'liq
 * ko'rinishi (eng uzun tomoni ≤ 1600 px). `startFull` — oyna shu rejimda ochiladi (reklama plakatlari uchun).
 * Standart rejim (Kesish) avvalgidek: berilgan `aspect` ramkasiga to'ldirib qirqiladi.
 */
export function ImageCropper({ file, aspect = 4 / 3, allowFull = true, startFull = false, onCancel, onDone }) {
  const [img, setImg] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  /*
   * ═══ AYLANTIRISH ═══
   *
   * Faqat 90° qadamlar: 0, 90, 180, 270. Erkin burchak
   * ATAYLAB qo'llanmadi — oshpaz telefonda taom rasmini
   * to'g'irlayapti, unga "3 gradusga burish" kerak emas.
   * Kerak bo'ladigani: yonboshlab olingan rasmni tikka
   * qilish. 90° qadam buni bir bosishda hal qiladi va
   * natija har doim aniq to'g'ri chiqadi.
   */
  const [rot, setRot] = useState(0);
  const [busy, setBusy] = useState(false);
  const [whole, setWhole] = useState(startFull);
  const [fw, setFw] = useState(0); // ramkaning haqiqiy eni (px) — to'liq rejimda ramka eni o'zgaradi

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

  // Burilgandan keyingi rasm o'lchami va ramka nisbati (to'liq rejimda ramka rasmning o'z nisbati)
  const swappedRot = rot === 90 || rot === 270;
  const rotW = img ? (swappedRot ? img.h : img.w) : 0;
  const rotH = img ? (swappedRot ? img.w : img.h) : 0;
  const effAspect = whole && img ? rotW / rotH : aspect;

  /* Ramka eni o'zgarganda (rejim, burish, oyna o'lchami) qayta o'lchanadi */
  useLayoutEffect(() => {
    const node = frameRef.current;
    if (!node) return undefined;
    const measure = () => setFw(node.clientWidth);
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(node);
    window.addEventListener('resize', measure);
    return () => { ro?.disconnect(); window.removeEventListener('resize', measure); };
  }, [whole, rot, img]);

  const setMode = (full) => { setWhole(full); setZoom(1); setPos({ x: 0, y: 0 }); };

  /*
   * Rasm ramkani TO'LIQ qoplashi uchun kerakli o'lcham.
   *
   * `cover` mantiqi: qaysi o'lcham yetishmasa, o'sha bo'yicha
   * cho'ziladi. Shu tufayli qirqilgan joyda bo'sh (shaffof)
   * burchak qolmaydi.
   */
  const fit = useCallback(() => {
    if (!fw || !img) return null;
    const fh = fw / effAspect;

    /*
     * 90° yoki 270° ga burilganda rasmning ENI va BO'YI
     * o'rin almashadi. Shuni hisobga olmasak, tikka rasm
     * burilgandan keyin ramkani qoplamay, chetlarida bo'sh
     * joy qolardi.
     */
    const swapped = rot === 90 || rot === 270;
    const iw = swapped ? img.h : img.w;
    const ih = swapped ? img.w : img.h;

    const scale = Math.max(fw / iw, fh / ih);
    return {
      fw, fh,
      // Ko'rinadigan (burilgandan keyingi) o'lcham
      w: iw * scale, h: ih * scale,
      // Rasmning O'ZINING o'lchami — CSS transform uchun
      rawW: img.w * scale, rawH: img.h * scale,
    };
  }, [img, fw, effAspect, rot]);

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

  /*
   * Burilgandan keyin surilgan joy ma'nosini yo'qotadi —
   * rasm boshqa yo'nalishda turadi. Markazga qaytaramiz,
   * shunda foydalanuvchi yangi holatdan boshlaydi.
   */
  const rotate = (dir) => {
    setRot((r) => (r + dir * 90 + 360) % 360);
    setPos({ x: 0, y: 0 });
  };

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
      let outW; let outH;
      if (whole) {
        // To'liq rejim: kesish YO'Q — burilgan rasmning o'z o'lchami (eng uzun tomoni 1600 px dan oshmaydi)
        const sc = Math.min(1, 1600 / Math.max(rotW, rotH));
        outW = Math.round(rotW * sc);
        outH = Math.round(rotH * sc);
      } else {
        outW = Math.min(1600, Math.round(img.w / (f.w / f.fw) * zoom * 2));
        outH = Math.round(outW / aspect);
      }

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';

      // Ekrandagi o'lchamdan asl rasmdagi o'lchamga o'tish
      const k = outW / f.fw;

      /*
       * ═══ AYLANTIRISHNI CHIZISH ═══
       *
       * Tartib MUHIM va ataylab shunday:
       *   1. koordinata boshini kesish markaziga ko'chiramiz
       *   2. buramiz
       *   3. rasmni O'Z markazidan chizamiz
       *
       * Agar avval chizib, keyin bursak, rasm ramkadan
       * chiqib ketardi — burilish nuqtasi noto'g'ri bo'lardi.
       *
       * `rawW/rawH` ishlatiladi, `w/h` emas: bular rasmning
       * o'z o'lchamlari. `w/h` esa burilgandan KEYINGI
       * ko'rinadigan o'lcham va u faqat ramkani to'ldirishni
       * hisoblash uchun kerak edi.
       */
      ctx.save();
      ctx.translate(outW / 2 + pos.x * k, outH / 2 + pos.y * k);
      if (rot) ctx.rotate((rot * Math.PI) / 180);

      const dw = f.rawW * zoom * k;
      const dh = f.rawH * zoom * k;
      ctx.drawImage(img.el, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();

      const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', whole ? 0.92 : 0.9));
      if (!blob) throw new Error('Kesib bo‘lmadi');

      onDone(new File([blob], 'crop.jpg', { type: 'image/jpeg' }));
    } catch {
      setBusy(false);
    }
  };

  const f = fit();

  /*
   * PORTAL — document.body ga chiziladi.
   *
   * Ilgari qirqish oynasi "Yangi mahsulot" modali ICHIDA
   * chizilardi. Modal o'z stacking context'ini yaratadi va
   * `overflow-hidden` qo'yadi, shuning uchun z-index qanchalik
   * katta bo'lmasin, bola undan CHIQA OLMAYDI — natijada modal
   * qirqish oynasi ustidan ko'rinib turardi (skrinshotdagi holat).
   *
   * Portal DOM daraxtidan tashqariga chiqaradi, React holati esa
   * o'z joyida qoladi.
   */
  return createPortal((
    <div className="fixed inset-0 z-[100] flex items-center justify-center
                    bg-black/80 backdrop-blur-sm p-4">

      <div className="w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto overflow-x-hidden
                      rounded-2xl bg-neutral-900 shadow-2xl">

      <div className="flex-none flex items-center justify-between px-4 py-3
                      border-b border-white/10">
        <button onClick={onCancel} className="text-white/70 text-sm font-medium">
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

      {/* ═══ QO'LLANMA ═══
          Ikkita ikonka va qisqa matn. Foydalanuvchi bu oynani
          birinchi marta ko'rmoqda va nima qilish kerakligi
          darhol tushunarli bo'lishi kerak. */}
      {/*
        Ikonkalar ATAYLAB loyihada allaqachon ishlatilganlaridan
        tanlandi (ti-photo, ti-camera, ti-check). Tabler
        to'plamida bo'lmagan nom yozilsa bo'sh kvadrat chiqadi
        va qo'llanma teskari ta'sir beradi. Yangi nomni
        tekshirmasdan ishlatmaslik kerak.
      */}
      <div className="grid grid-cols-3 gap-1 px-3 py-3 bg-white/[0.04]">
        <Hint icon="ti-camera" text="Suring" />
        <Hint icon="ti-photo" text="Kattalashtiring" />
        <Hint icon="ti-check" text="Tayyor bosing" />
      </div>

      <div className="flex items-center justify-center p-4">
        <div
          ref={frameRef}
          onMouseDown={onStart}
          onMouseMove={(e) => drag.current && onMove(e)}
          onMouseUp={onEnd}
          onMouseLeave={onEnd}
          onTouchStart={onStart}
          onTouchEnd={onEnd}
          onTouchCancel={onEnd}
          /*
            `bg-black` — ramka ichi. Rasm hali yuklanmagan yoki
            biror sabab bilan chizilmasa, ostidagi oq modal
            ko'rinib qolmasin.
          */
          className={`relative mx-auto overflow-hidden rounded-xl bg-black select-none ${
            whole ? '' : 'cursor-grab active:cursor-grabbing'}`}
          style={{
            aspectRatio: effAspect,
            touchAction: whole ? 'auto' : 'none',
            // To'liq rejimda tik rasm ekrandan chiqib ketmasin: balandlik ko'pi bilan ekranning 44% i
            width: whole ? `min(100%, calc(44vh * ${effAspect}))` : '100%',
          }}
        >
          {img && f && (
            <img
              src={img.el.src}
              alt=""
              draggable={false}
              className="absolute left-1/2 top-1/2 max-w-none will-change-transform"
              style={{
                /*
                 * Rasmning O'Z o'lchami (rawW/rawH), burilgandan
                 * keyingi ko'rinadigan o'lcham emas. Burish CSS
                 * transform bilan qilinadi, shuning uchun element
                 * o'z holicha qoladi.
                 *
                 * Transform tartibi canvas'dagi bilan BIR XIL:
                 * avval markazga, keyin surish, keyin burish,
                 * keyin masshtab. Aks holda ko'rinish va
                 * yakuniy natija bir-biriga mos kelmasdi.
                 */
                width: f.rawW,
                height: f.rawH,
                transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) rotate(${rot}deg) scale(${zoom})`,
              }}
            />
          )}

          {!img && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2
                              border-white/20 border-t-brand-400" />
            </div>
          )}

          {/* Uchdan bir chiziqlari — markazni topishga yordam beradi */}
          {!whole && (
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-y-0 left-1/3 w-px bg-white/25" />
              <div className="absolute inset-y-0 left-2/3 w-px bg-white/25" />
              <div className="absolute inset-x-0 top-1/3 h-px bg-white/25" />
              <div className="absolute inset-x-0 top-2/3 h-px bg-white/25" />
            </div>
          )}
        </div>
      </div>

      <div className="flex-none px-4 pb-4">
        {allowFull && (
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-white/[0.07] p-1" role="group" aria-label="Rasm ko‘rinishi">
            <ModeBtn on={!whole} icon="ti-crop" label="Kesish" onClick={() => setMode(false)} />
            <ModeBtn on={whole} icon="ti-arrows-maximize" label="To‘liq ko‘rsatish" onClick={() => setMode(true)} />
          </div>
        )}
        {whole && (
          <p className="mb-3 text-center text-[11px] leading-snug text-white/55">
            Rasm kesilmaydi — asl nisbatda to‘liq saqlanadi.
          </p>
        )}
        <div className="flex items-center gap-3">
          <i className="ti ti-photo text-white/40 text-sm" />
          <input
            type="range"
            min={MIN_ZOOM} max={MAX_ZOOM} step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            disabled={whole}
            className="flex-1 accent-brand-400 disabled:opacity-30"
            aria-label="Kattalashtirish"
          />
          <i className="ti ti-photo text-white/40 text-xl" />
        </div>

        {/*
          Aylantirish tugmalari slayder OSTIDA, markazda.
          Yuqorida bo'lsa kesish maydonidan joy olardi —
          telefonda esa rasm ko'rinishi eng muhimi.
        */}
        <div className="mt-3 flex items-center justify-center gap-2">
          <RotBtn icon="ti-rotate-2" label="Chapga burish" onClick={() => rotate(-1)} />
          <span className="min-w-[52px] text-center text-[12px] tabular-nums text-white/50">
            {rot}°
          </span>
          <RotBtn icon="ti-rotate-clockwise-2" label="O‘ngga burish" onClick={() => rotate(1)} />
        </div>
      </div>

      </div>
    </div>
  ), document.body);
}

/* "Kesish | To'liq ko'rsatish" tanlovi bandi (44 px dan past emas — barmoq bilan bosiladi) */
function ModeBtn({ on, icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex h-11 items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold
                  transition-colors ${on ? 'bg-brand-400 text-brand-text' : 'text-white/65 active:bg-white/10'}`}
    >
      <i className={`ti ${icon} text-base`} />
      {label}
    </button>
  );
}

/*
 * Aylantirish tugmasi.
 *
 * Katta bosish maydoni (44px) — telefonda barmoq bilan
 * bosiladi va oshxona sharoitida aniqlik past bo'ladi.
 */
function RotBtn({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-11 w-11 items-center justify-center rounded-xl
                 bg-white/10 text-white active:bg-white/20 active:scale-95
                 transition-transform"
    >
      <i className={`ti ${icon} text-xl`} />
    </button>
  );
}

/**
 * Qo'llanma bandi — ikonka + qisqa matn.
 *
 * Uchta qadam vertikal emas, YONMA-YON: ular ketma-ketlik
 * emas, bir vaqtda mavjud imkoniyatlar. Matn qisqa, chunki
 * foydalanuvchi buni o'qish uchun emas, ishlash uchun ochgan.
 */
function Hint({ icon, text }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <i className={`ti ${icon} text-[17px] text-brand-400`} />
      <span className="text-[11px] leading-tight text-white/60">{text}</span>
    </div>
  );
}
