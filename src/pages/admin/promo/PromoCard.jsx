import { useLayoutEffect, useRef } from 'react';
// Sarlavha shrifti — Inter Tight (plakatdagi qalin, ensiz shriftga eng yaqini), ilovaning o'zida:
// Google Fonts'siz, Telegram ichida tez. @font-face faqat e'lon qiladi — fayl oyna chiqqandagina yuklanadi.
import '@fontsource/inter-tight/800.css';
import '@fontsource/inter-tight/900.css';
import './PromoCard.css';

/*
 * ═══ REKLAMA OYNASI KARTASI (mijoz ilovasi va admin oldindan ko'rishi — BIR XIL kod) ═══
 * NUSXA: asl fayl lakmago-client/src/components/PromoModals/PromoCard.jsx — o'zgartirsangiz IKKALASINI yangilang.
 * Shablonlar:
 *   brush    — asosiy reklama plakati bilan AYNAN bir xil: ramka (cho'tka zarbalari va nuqtalar) plakatning
 *              o'zidan ajratilgan (/promo/brush-frame.webp), sarlavha, rasm va lenta plakat o'lchovlarida
 *   image    — faqat rasm: matnsiz, ramkasiz, rasm oynani chetdan-chetgacha qoplaydi
 *   coupon   — to'q sariq kupon: teshikli chet, uzib olinadigan pastki qism
 *   sunburst — to'q sariq nurlar, oq sarlavha, urg'u qora stikerda
 * Matn: *yulduzcha* ichidagi qism urg'u rangida. Matn har doim kartaga SIG'ADI:
 * shrift o'lchami karta eniga qarab hisoblanadi va sig'maguncha kichraytiriladi (dizayn buzilmaydi).
 */
/** Eski chaqiruvlar uchun (shrift endi paket orqali keladi) — hech narsa qilmaydi */
export function ensurePromoFont() {}

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
function Fit({ as: Tag = 'div', className, ratio, min, maxLines = 0, children, deps }) {
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
      // Qatorlar soni: balandlik / (shrift × qator oralig'i). maxLines — ko'p qatorga bo'linib ketmasin
      const lines = () => {
        const lh = parseFloat(getComputedStyle(el).lineHeight) || size * 1.1;
        return Math.round(el.scrollHeight / lh);
      };
      let guard = 80;
      while (guard-- > 0 && size > min && (el.scrollHeight > box.clientHeight + 1 || el.scrollWidth > box.clientWidth + 1 || (maxLines && lines() > maxLines))) {
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

export const PROMO_TEMPLATES = ['brush', 'coupon', 'sunburst', 'image'];

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
  const t = PROMO_TEMPLATES.includes(promo?.template) ? promo.template : 'brush';
  const title = promo?.title || '';
  const footer = promo?.footer || '';
  const img = promoImg(promo?.imageUrl || '');
  const clickable = Boolean(promo?.link) && !preview;
  const Footer = clickable ? 'button' : 'div';

  const closeBtn = onClose && (
    <button type="button" className="pm-close" onClick={onClose} aria-label="Yopish">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
    </button>
  );

  /* Faqat rasm: butun kartani qoplaydi, ramka va matn yo'q; havola bo'lsa — butun rasm bosiladi */
  if (t === 'image') {
    const Cover = clickable ? 'button' : 'div';
    return (
      <div ref={cardRef} className={`pm-card pm-t-image${preview ? ' pm-preview' : ''}`} role="document">
        <Cover type={clickable ? 'button' : undefined} className="pm-coverbtn" onClick={clickable ? onAction : undefined} aria-label={clickable ? 'Ko‘rish' : undefined}>
          {img ? <img className="pm-cover" src={img} alt="" draggable="false" /> : <span className="pm-cover pm-cover--empty" aria-hidden="true">Rasm yuklang</span>}
        </Cover>
        {closeBtn}
      </div>
    );
  }

  return (
    <div ref={cardRef} className={`pm-card pm-t-${t}${preview ? ' pm-preview' : ''}`} role="document">
      {t === 'brush' && <div className="pm-frame" aria-hidden="true" />}
      {t === 'sunburst' && <div className="pm-rays" aria-hidden="true" />}
      {t === 'coupon' && <div className="pm-perf" aria-hidden="true" />}
      {t === 'sunburst' && <div className="pm-dots pm-dots--l" aria-hidden="true" />}
      {t === 'sunburst' && <div className="pm-dots pm-dots--r" aria-hidden="true" />}
      {closeBtn}

      <div className="pm-titlebox">
        <Fit as="h2" className="pm-title" ratio={t === 'brush' ? 0.1 : 0.096} min={preview ? 4 : 13} maxLines={4} deps={[title, t]}>{renderMarked(title)}</Fit>
      </div>

      <div className="pm-imgbox">
        {img ? <img className="pm-img" src={img} alt="" draggable="false" /> : <div className="pm-img pm-img--empty" aria-hidden="true">🍽</div>}
      </div>

      {footer && (
        <Footer type={clickable ? 'button' : undefined} className="pm-foot" onClick={clickable ? onAction : undefined}>
          <span className="pm-footbox">
            <Fit as="span" className="pm-foottext" ratio={t === 'brush' ? 0.054 : 0.06} min={preview ? 3 : 11} maxLines={Math.max(2, footer.split('\n').length)} deps={[footer, t]}>{renderMarked(footer)}</Fit>
          </span>
          {t === 'brush' && <Swoosh />}
          {clickable && (
            <svg className="pm-foot-go" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          )}
        </Footer>
      )}
      {!footer && clickable && <button type="button" className="pm-foot pm-foot--bare" onClick={onAction}><span className="pm-footbox"><span className="pm-foottext">Ko‘rish</span></span></button>}
    </div>
  );
}

/* Lenta ichidagi to'q sariq cho'tka chizig'i (plakatdagi kabi ikkinchi qator ostida) */
function Swoosh() {
  return (
    <svg className="pm-swoosh" viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <filter id="pm-rough" x="-5%" y="-60%" width="110%" height="220%">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <path d="M2 9 C 50 4, 120 2, 198 5" stroke="#F2661A" strokeWidth="3.4" strokeLinecap="round" fill="none" filter="url(#pm-rough)" />
    </svg>
  );
}
