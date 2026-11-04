import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './delivery.css';

/*
 * ═══ KURYERLAR SAHIFASI: MOBIL-BIRINCHI KOMPONENTLAR ═══
 * Barmoq uchun: tugmalar ≥ 44 px, maydonlar 48 px / 16 px matn, pastdan chiqadigan oyna (bottom sheet) — kompyuterda markazdagi dialog.
 * Hammasi mavjud dizayn tokenlari (brand/ink/muted/line/surface/canvas) bilan; yangi kutubxona yo'q.
 */

/* ───────────── Sheet: telefonda pastdan chiqadi, ≥640 px da markazda ───────────── */
export function Sheet({ title, subtitle, onClose, children, footer, tall = false }) {
  const panel = useRef(null);
  const drag = useRef(null);

  // Orqa sahifa skrolli qulflanadi; Esc yopadi; ochilganda oyna fokus oladi (ekran o'qiydigan dastur uchun)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    panel.current?.focus();
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  // Sarlavhadan pastga tortib yopish (telefon): 110 px dan ortiq tortilsa yopiladi, aks holda joyiga qaytadi
  const onTouchStart = (e) => { drag.current = { y: e.touches[0].clientY, dy: 0 }; };
  const onTouchMove = (e) => {
    if (!drag.current) return;
    const dy = Math.max(0, e.touches[0].clientY - drag.current.y);
    drag.current.dy = dy;
    if (panel.current) { panel.current.style.transition = 'none'; panel.current.style.transform = `translateY(${dy}px)`; }
  };
  const onTouchEnd = () => {
    const d = drag.current; drag.current = null;
    if (!d || !panel.current) return;
    panel.current.style.transition = 'transform 0.2s ease';
    if (d.dy > 110) { panel.current.style.transform = 'translateY(100%)'; setTimeout(() => onClose?.(), 180); }
    else panel.current.style.transform = '';
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4" data-testid="sheet">
      <div className="cs-backdrop absolute inset-0 bg-black/45" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        data-no-ptr
        className={`cs-sheet relative flex w-full flex-col overflow-hidden bg-white shadow-2xl outline-none rounded-t-[28px] sm:max-w-xl sm:rounded-3xl ${tall ? 'h-[92dvh] sm:h-[85vh]' : 'max-h-[92dvh] sm:max-h-[88vh]'}`}
      >
        <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} className="flex-none">
          <div className="mx-auto mt-2.5 h-1.5 w-11 rounded-full bg-black/12 sm:hidden" aria-hidden="true" />
          <div className="flex items-start gap-3 px-5 pb-3 pt-3">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[19px] font-bold leading-tight text-ink">{title}</h2>
              {subtitle && <p className="mt-0.5 truncate text-[13px] text-muted">{subtitle}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="Yopish" className="cs-tap flex h-10 w-10 flex-none items-center justify-center rounded-full bg-canvas text-ink">
              <i className="ti ti-x text-lg" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
        {footer && <div className="flex-none border-t border-line bg-white px-5 pb-[max(14px,env(safe-area-inset-bottom))] pt-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ───────────── Tab paneli: gorizontal surilar, faol tab ko'rinib turadi ───────────── */
export function ScrollTabs({ tabs, value, onChange }) {
  const refs = useRef({});
  useEffect(() => {
    refs.current[value]?.scrollIntoView?.({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [value]);
  return (
    <div className="relative -mx-4 sm:mx-0">
      <div role="tablist" className="no-scrollbar flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:px-0">
        {tabs.map((t) => {
          const on = t.id === value;
          return (
            <button
              key={t.id}
              ref={(el) => { refs.current[t.id] = el; }}
              role="tab"
              aria-selected={on}
              onClick={() => onChange(t.id)}
              className={`cs-tap flex h-11 flex-none snap-start items-center gap-2 whitespace-nowrap rounded-full px-4 text-[15px] font-semibold ${on ? 'bg-ink text-white shadow-sm' : 'border border-line bg-white text-muted'}`}
            >
              {t.icon && <i className={`ti ${t.icon} text-[17px]`} />}
              {t.label}
              {t.badge > 0 && (
                <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${t.alert ? 'bg-red-500 text-white' : on ? 'bg-white/20 text-white' : 'bg-canvas text-ink'}`}>{t.badge}</span>
              )}
            </button>
          );
        })}
      </div>
      {/* O'ngdagi "yana bor" soyasi — faqat telefonda */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-canvas to-transparent sm:hidden" aria-hidden="true" />
    </div>
  );
}

/* ───────────── Kichik qismlar ───────────── */
const TONES = {
  green: 'bg-green-50 text-green-700', red: 'bg-red-50 text-red-600', amber: 'bg-amber-50 text-amber-700',
  blue: 'bg-blue-50 text-blue-700', orange: 'bg-orange-50 text-orange-700', gray: 'bg-canvas text-muted', ink: 'bg-ink text-white',
};
export const Badge = ({ tone = 'gray', icon, children }) => (
  <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold leading-none ${TONES[tone]}`}>
    {icon && <i className={`ti ${icon} text-[13px]`} />}{children}
  </span>
);

export function Avatar({ name = '?', online = false, size = 48 }) {
  const hue = [...name].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <div className="flex h-full w-full items-center justify-center rounded-full text-base font-bold text-white" style={{ background: `hsl(${hue} 55% 46%)`, fontSize: size * 0.38 }}>
        {name.trim()[0]?.toUpperCase() || '?'}
      </div>
      {online && <span className="cs-live-dot absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-[3px] border-white bg-green-500" title="Smenada" />}
    </div>
  );
}

export const Stat = ({ icon, label, value, tone = 'ink', sub }) => {
  // "300 000 so‘m" — raqam katta, "so‘m" kichik (tor ekranda ikki qatorga bo'linmasin)
  const m = typeof value === 'string' ? value.match(/^(.*?)\s*(so‘m)$/) : null;
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-white p-3.5">
      <div className="flex items-center gap-1.5 truncate text-[12px] font-medium text-muted"><i className={`ti ${icon} text-[15px]`} />{label}</div>
      <div className={`mt-1 truncate text-[19px] font-bold leading-tight tracking-tight tabular-nums sm:text-[22px] ${tone === 'red' ? 'text-red-600' : tone === 'green' ? 'text-green-700' : 'text-ink'}`}>
        {m ? <>{m[1]}<span className="ml-1 text-[12px] font-semibold opacity-70">so‘m</span></> : value}
      </div>
      {sub && <div className="mt-0.5 truncate text-[11px] text-muted">{sub}</div>}
    </div>
  );
};

export const Skeleton = ({ className = 'h-24 w-full' }) => <div className={`cs-skeleton ${className}`} aria-hidden="true" />;

export function EmptyState({ icon = 'ti-moped', title, text, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 text-brand-600"><i className={`ti ${icon} text-4xl`} /></div>
      <div className="mt-4 text-lg font-bold text-ink">{title}</div>
      {text && <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Bosiladigan tugma: primary (brand) / soft / danger. Balandlik 44–48 px. */
export function Btn({ children, tone = 'soft', icon, onClick, disabled, type = 'button', className = '', full = false, ...rest }) {
  const t = {
    primary: 'bg-brand-400 text-brand-text font-bold shadow-sm',
    soft: 'bg-canvas text-ink font-semibold',
    outline: 'border border-line bg-white text-ink font-semibold',
    danger: 'bg-red-50 text-red-600 font-semibold',
    success: 'bg-green-50 text-green-700 font-semibold',
  }[tone];
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`cs-tap flex h-12 items-center justify-center gap-2 rounded-2xl px-4 text-[15px] disabled:opacity-50 ${full ? 'w-full' : ''} ${t} ${className}`} {...rest}>
      {icon && <i className={`ti ${icon} text-lg`} />}{children}
    </button>
  );
}

export const Banner = ({ tone = 'red', children }) => (
  <div role="alert" className={`flex items-start gap-2 rounded-2xl px-4 py-3 text-sm ${tone === 'green' ? 'bg-green-50 text-green-700' : tone === 'amber' ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-600'}`}>
    <i className={`ti ${tone === 'green' ? 'ti-circle-check' : 'ti-alert-circle'} mt-0.5 text-lg`} /><div className="min-w-0 flex-1">{children}</div>
  </div>
);

/** Maydon yorlig'i + izoh + xato (bitta joyda) */
export const Field = ({ label, hint, error, children }) => (
  <div className="mb-4">
    <label className="mb-1.5 block text-[13px] font-semibold text-ink">{label}</label>
    {children}
    {error ? <p className="mt-1.5 text-[12px] font-medium text-red-600">{error}</p> : hint ? <p className="mt-1.5 text-[12px] leading-snug text-muted">{hint}</p> : null}
  </div>
);

/** Raqamlarni minglik bo'shliq bilan ko'rsatuvchi so'm maydoni (qiymat — faqat raqamlar satri) */
export function MoneyInput({ value, onChange, placeholder, ...rest }) {
  const shown = value === '' || value == null ? '' : Number(value).toLocaleString('ru-RU').replace(/\u00a0/g, ' ');
  return (
    <div className="relative">
      <input className="cs-input pr-14 tabular-nums" inputMode="numeric" value={shown} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 10))} {...rest} />
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted">so‘m</span>
    </div>
  );
}

/** Qidiruv maydoni */
export function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <i className="ti ti-search pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted" />
      <input className="cs-input cs-on-canvas pl-11" type="search" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} enterKeyHint="search" />
    </div>
  );
}

/** Suzuvchi asosiy tugma (faqat telefonda; kompyuterda sarlavhadagi tugma ishlatiladi) */
export const Fab = ({ label, icon = 'ti-plus', onClick }) => (
  <button type="button" onClick={onClick} className="cs-fab cs-tap fixed right-4 z-40 flex h-14 items-center gap-2 rounded-full bg-brand-400 px-5 text-[15px] font-bold text-brand-text shadow-[0_8px_24px_rgba(186,117,23,0.45)] lg:hidden" data-testid="fab">
    <i className={`ti ${icon} text-xl`} />{label}
  </button>
);

/** Soat/sana yorlig'i: "bugun 14:05" · "kecha 09:12" · "03.11 18:40" */
export function when(d) {
  if (!d) return '—';
  const x = new Date(d); const now = new Date();
  const hm = x.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hour12: false });
  const day = (dt) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  const diff = Math.round((day(now) - day(x)) / 86400000);
  if (diff === 0) return `bugun ${hm}`;
  if (diff === 1) return `kecha ${hm}`;
  return `${String(x.getDate()).padStart(2, '0')}.${String(x.getMonth() + 1).padStart(2, '0')} ${hm}`;
}

/** Bosqichlar chizig'i: Qabul → Taom olindi → Topshirildi */
export function Steps({ steps }) {
  return (
    <div className="flex items-center gap-1.5">
      {steps.map((s, i) => (
        <div key={s.label} className="flex min-w-0 flex-1 flex-col gap-1">
          <div className={`h-1.5 rounded-full ${s.done ? 'bg-green-500' : s.active ? 'cs-live-dot bg-brand-400' : 'bg-line'}`} />
          <div className={`truncate text-[11px] ${s.done || s.active ? 'font-semibold text-ink' : 'text-muted'}`}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

export function useDebounced(value, ms = 200) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
