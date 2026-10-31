import { useEffect, useRef, useState } from 'react';
import { findScrollParent, scrollEventTarget, smoothScrollToTop } from '@/lib/smoothScroll';

/*
 * "Tepaga" tugmasi: ro'yxatda pastga tushilganda pastdan yumshoq chiqadi, bosilsa sahifa yumshoq yuqoriga qaytadi.
 * Skroll qiluvchi element o'zi topiladi (mobilda `<main>`, kompyuterda sahifa). Mobilda pastki menyu ustida turadi.
 */
export function ScrollTopButton({ threshold = 480 }) {
  const anchor = useRef(null);
  const scroller = useRef(null);
  const anim = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let raf = 0;
    let bound = null;
    const update = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; setVisible((scroller.current?.scrollTop || 0) > threshold); });
    };
    const attach = () => {
      if (bound) bound.removeEventListener('scroll', update);
      scroller.current = findScrollParent(anchor.current);
      bound = scrollEventTarget(scroller.current);
      bound.addEventListener('scroll', update, { passive: true });
      update();
    };
    attach();
    window.addEventListener('resize', attach);        // mobil ↔ kompyuter o'tganda skroll qiluvchi element almashadi
    return () => {
      cancelAnimationFrame(raf);
      bound?.removeEventListener('scroll', update);
      window.removeEventListener('resize', attach);
      anim.current?.cancel();
    };
  }, [threshold]);

  const goTop = () => {
    const el = scroller.current;
    if (!el) return;
    anim.current?.cancel();
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    anim.current = smoothScrollToTop(el, { reduced });
  };

  return (
    <>
      <span ref={anchor} className="hidden" aria-hidden="true" />
      <button
        type="button"
        onClick={goTop}
        aria-label="Tepaga qaytish"
        title="Tepaga"
        aria-hidden={!visible}
        tabIndex={visible ? 0 : -1}
        data-testid="scroll-top"
        className={`fixed right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-brand-400 text-brand-text shadow-lg shadow-black/25 ring-1 ring-black/5
          bottom-[calc(64px+env(safe-area-inset-bottom,0px)+16px)] lg:bottom-6 lg:right-6
          transition-all duration-300 ease-out hover:bg-brand-500 active:scale-90
          ${visible ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-4 scale-90 opacity-0'}`}
      >
        <i className="ti ti-arrow-up text-xl" />
      </button>
    </>
  );
}
