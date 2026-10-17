import { useLayoutEffect, useRef } from 'react';
import './PromoCard.css';

/*
 * ═══ REKLAMA OYNASI KARTASI (mijoz ilovasi va admin oldindan ko'rishi — BIR XIL kod) ═══
 * NUSXA: asl fayl lakmago-client/src/components/PromoModals/PromoCard.jsx — o'zgartirsangiz IKKALASINI yangilang.
 * Shablonlar:
 *   brush    — oq fon, to'q sariq cho'tka zarbalari, nuqtali naqsh, pastda qora lenta (asosiy reklama rasmi kabi)
 *   coupon   — to'q sariq kupon: teshikli chet, uzib olinadigan pastki qism
 *   sunburst — to'q sariq nurlar, oq sarlavha, urg'u qora stikerda
 * Matn: *yulduzcha* ichidagi qism urg'u rangida. Matn har doim kartaga SIG'ADI:
 * shrift o'lchami karta eniga qarab hisoblanadi va sig'maguncha kichraytiriladi (dizayn buzilmaydi).
 */
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@800;900&display=swap';
export function ensurePromoFont() {
  if (typeof document === 'undefined' || document.getElementById('pm-font')) return;
  const l = document.createElement('link');
  l.id = 'pm-font'; l.rel = 'stylesheet'; l.href = FONT_HREF;
  document.head.appendChild(l);
}

/** "*so'z*" → urg'u bo'laklari. Natija — React elementlari (HTML emas) */
export function renderMarked(text = '') {
  return String(text).split(/(\*[^*]+\*)/g).filter(Boolean).map((part, i) => (
    part.startsWith('*') && part.endsWith('*') && part.length > 2
      ? <span key={i} className="pm-acc">{part.slice(1, -1)}</span>
      : <span key={i}>{part}</span>
  ));
}

/** Cloudinary rasmi: avtomatik format (shaffoflik saqlanadi) va o'lcham */
export function promoImg(url = '') {
  if (!/res\.cloudinary\.com\/.+\/upload\//.test(url) || /\/upload\/[a-z]_/.test(url)) return url;
  return url.replace('/upload/', '/upload/f_auto,q_auto,w_800/');
}

/**
 * Matnni o'z qutisiga sig'diradi: boshlang'ich o'lcham = karta eni × ratio, sig'maguncha 1px kichraytiriladi.
 * Shrift yuklangach va karta o'lchami o'zgarganda qayta hisoblanadi.
 */
function Fit({ as: Tag = 'div', className, ratio, min, children, deps }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const card = el.closest('.pm-card');
    const fit = () => {
      const box = el.parentElement;
      const w = card?.clientWidth || 320;
      let size = Math.round(w * ratio);
      el.style.fontSize = `${size}px`;
      let guard = 80;
      while (guard-- > 0 && size > min && (el.scrollHeight > box.clientHeight + 1 || el.scrollWidth > box.clientWidth + 1)) {
        size -= 1;
        el.style.fontSize = `${size}px`;
      }
    };
    fit();
    let alive = true;
    document.fonts?.ready?.then(() => { if (alive) fit(); });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    if (ro && card) ro.observe(card);
    return () => { alive = false; ro?.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return <Tag ref={ref} className={className}>{children}</Tag>;
}

export function PromoCard({ promo, onClose, onAction, preview = false }) {
  // Kupon kesimlari karta eniga nisbatan (kichik ko'rinishda ham to'g'ri)
  const cardRef = useRef(null);
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return undefined;
    const set = () => el.style.setProperty('--pm-notch', `${Math.max(4, Math.round(el.clientWidth * 0.044))}px`);
    set();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(set) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  const t = ['brush', 'coupon', 'sunburst'].includes(promo?.template) ? promo.template : 'brush';
  const title = promo?.title || '';
  const footer = promo?.footer || '';
  const img = promoImg(promo?.imageUrl || '');
  const clickable = Boolean(promo?.link) && !preview;
  const Footer = clickable ? 'button' : 'div';

  return (
    <div ref={cardRef} className={`pm-card pm-t-${t}${preview ? ' pm-preview' : ''}`} role="document">
      {t === 'brush' && <BrushArt />}
      {t === 'sunburst' && <div className="pm-rays" aria-hidden="true" />}
      {t === 'coupon' && <div className="pm-perf" aria-hidden="true" />}
      {t !== 'coupon' && <div className="pm-dots pm-dots--l" aria-hidden="true" />}
      {t !== 'coupon' && <div className="pm-dots pm-dots--r" aria-hidden="true" />}

      {onClose && (
        <button type="button" className="pm-close" onClick={onClose} aria-label="Yopish">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
        </button>
      )}

      <div className="pm-titlebox">
        <Fit as="h2" className="pm-title" ratio={t === 'brush' ? 0.104 : 0.096} min={preview ? 4 : 13} deps={[title, t]}>{renderMarked(title)}</Fit>
      </div>

      <div className="pm-imgbox">
        {img ? <img className="pm-img" src={img} alt="" draggable="false" /> : <div className="pm-img pm-img--empty" aria-hidden="true">🍽</div>}
      </div>

      {footer && (
        <Footer type={clickable ? 'button' : undefined} className="pm-foot" onClick={clickable ? onAction : undefined}>
          <span className="pm-footbox">
            <Fit as="span" className="pm-foottext" ratio={0.06} min={preview ? 3 : 11} deps={[footer, t]}>{renderMarked(footer)}</Fit>
          </span>
          {clickable && (
            <svg className="pm-foot-go" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          )}
        </Footer>
      )}
      {!footer && clickable && <button type="button" className="pm-foot pm-foot--bare" onClick={onAction}><span className="pm-footbox"><span className="pm-foottext">Ko‘rish</span></span></button>}
    </div>
  );
}

/* Cho'tka zarbalari: qalin egri chiziqlar + turbulentlik filtri → qirralari "cho'tka" kabi notekis */
function BrushArt() {
  return (
    <svg className="pm-brushart" viewBox="0 0 200 300" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <filter id="pm-rough" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter="url(#pm-rough)" fill="none" strokeLinecap="round">
        {/* yuqori chap burchak: zarbalar faqat burchakda — sarlavhaga tegmaydi */}
        <path d="M-16 56 C -4 26, 20 6, 62 -8" stroke="#F2661A" strokeWidth="15" />
        <path d="M-12 70 C 0 40, 26 16, 72 -2" stroke="#000" strokeWidth="3.6" />
        <path d="M-8 36 C 2 20, 12 10, 30 2" stroke="#F2661A" strokeWidth="4" opacity=".75" />
        <path d="M214 112 C 200 170, 204 228, 168 306" stroke="#F2661A" strokeWidth="13" />
        <path d="M206 190 C 196 236, 186 262, 150 310" stroke="#000" strokeWidth="4" />
        <path d="M-12 238 C 18 286, 70 310, 140 304" stroke="#F2661A" strokeWidth="12" />
        <path d="M-8 268 C 30 300, 76 312, 120 306" stroke="#000" strokeWidth="5" />
      </g>
    </svg>
  );
}
