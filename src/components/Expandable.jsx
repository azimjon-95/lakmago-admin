import { useState, useRef, useLayoutEffect } from 'react';

/**
 * Uzun matn — 2 qatordan keyin "..." va bosilsa to'liq ochiladi.
 *
 * Nega CSS line-clamp bilan emas: line-clamp qatorlar sonini
 * kesadi, lekin matn kesilganini BILISH uchun ham JS kerak —
 * aks holda "ko'proq" tugmasi qisqa matnda ham chiqib, ortiqcha
 * bosiladigan narsa bo'lib qolardi. Shuning uchun avval yashirin
 * to'liq balandlikni o'lchab, kesilgan-kesilmaganini aniqlaymiz.
 */
export function Expandable({ text, lines = 2, className = '' }) {
  const [open, setOpen] = useState(false);
  const [clamped, setClamped] = useState(false);
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Matn 2 qatorga sig'adigan balandlikdan uzunmi
    setClamped(el.scrollHeight > el.clientHeight + 1);
  }, [text, lines]);

  if (!text) return null;

  return (
    <div className={className}>
      <p
        ref={ref}
        onClick={() => clamped && setOpen((o) => !o)}
        className={clamped ? 'cursor-pointer' : ''}
        style={!open ? {
          display: '-webkit-box',
          WebkitLineClamp: lines,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        } : undefined}
      >
        {text}
      </p>

      {clamped && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-0.5 text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          {open ? 'Kamroq' : "Ko'proq"}
        </button>
      )}
    </div>
  );
}
