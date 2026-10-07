import { useLockScroll } from '@/hooks/useLockScroll';

/*
 * ═══ TO'YXONALAR BO'LIMI — umumiy yordamchilar ═══
 * Ma'lumot: weddingApi (alohida server). LokmaGo sahifalaridan mustaqil.
 */
export const som = (n) => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/,/g, ' ');

// Seanslar — server lib/sessions.ts bilan bir xil (kodlar bazada saqlanadi)
export const SESSION_LABEL = { morning: 'Nahorgi osh', day: "Nikoh to'yi", evening: 'Kunduzgi / Vecher', special: 'Maxsus tadbir' };
export const SESSION_HINT = {
  morning: 'Ertalabki osh',
  day: 'Kunduzgi nikoh marosimi',
  evening: "Asosiy to'y kechasi",
  special: 'Konsert, shou, majlis — plandan tashqari',
};
export const SESSION_ICON = { morning: 'ti-sunrise', day: 'ti-sun', evening: 'ti-moon-stars', special: 'ti-confetti' };
export const EVENT_LABEL = { nahorgi_osh: 'Nahorgi osh', nikoh: 'Nikoh', kunduzgi: 'Kunduzgi', kechki: 'Kechki', tadbir: 'Tadbir (konsert, shou)' };
export const PRICING_MODE = {
  per_guest: { label: 'Mehmon boshiga', hint: 'Menyu narxi × mehmonlar × koeffitsient' },
  fixed: { label: 'Aniq narx', hint: 'Seans uchun bitta narx, mehmon soniga bog‘liq emas' },
  negotiable: { label: 'Kelishiladi', hint: 'Narx yo‘q, onlayn bron qilinmaydi — egasi qo‘lda band qiladi' },
};
export const BOOKING_STATUS = {
  pending: { label: 'Kutilmoqda', cls: 'bg-amber-50 text-amber-700' },
  confirmed: { label: 'Tasdiqlangan', cls: 'bg-green-50 text-green-700' },
  completed: { label: "O'tgan", cls: 'bg-canvas text-muted' },
  cancelled: { label: 'Bekor', cls: 'bg-red-50 text-red-600' },
};
export const VENUE_STATUS = {
  active: { label: 'Faol', cls: 'bg-green-50 text-green-700' },
  hidden: { label: 'Yashirin', cls: 'bg-canvas text-muted' },
  blocked: { label: 'Bloklangan', cls: 'bg-red-50 text-red-600' },
};
export const SUB_STATE = {
  paid: { label: "To'langan", cls: 'bg-green-50 text-green-700', icon: 'ti-circle-check' },
  due_soon: { label: 'Muddati yaqin', cls: 'bg-amber-50 text-amber-700', icon: 'ti-clock' },
  overdue: { label: 'Qarzdor', cls: 'bg-red-50 text-red-600', icon: 'ti-alert-triangle' },
  never: { label: "To'lov qilinmagan", cls: 'bg-red-50 text-red-600', icon: 'ti-alert-triangle' },
  free: { label: 'Bepul', cls: 'bg-canvas text-muted', icon: 'ti-gift' },
};
export const PAY_METHOD = { cash: 'Naqd', card: 'Karta', transfer: "O'tkazma", click: 'Click', payme: 'Payme', other: 'Boshqa' };

export function Badge({ cls, icon, children }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${cls}`}>
      {icon && <i className={`ti ${icon} text-[12px]`} />}{children}
    </span>
  );
}

export function SubBadge({ s }) {
  const st = SUB_STATE[s?.state] || SUB_STATE.free;
  return (
    <Badge cls={st.cls} icon={st.icon}>
      {st.label}
      {s?.debt_months > 0 && ` · ${s.debt_months} oy`}
      {s?.state === 'due_soon' && s.days_left != null && ` · ${s.days_left} kun`}
    </Badge>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl font-semibold text-ink">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="mb-4 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">
      <i className="ti ti-alert-circle mt-0.5" />
      <span className="flex-1">{error}</span>
      {onRetry && <button onClick={onRetry} className="font-medium underline">Qayta</button>}
    </div>
  );
}

export function Empty({ icon = 'ti-inbox', children }) {
  return (
    <div className="text-center text-muted text-sm py-12 border border-dashed border-line rounded-xl px-4">
      <i className={`ti ${icon} text-3xl opacity-40 block mb-2`} />
      {children}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide = false }) {
  useLockScroll();
  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div onClick={(e) => e.stopPropagation()}
        className={`bg-white w-full ${wide ? 'max-w-2xl' : 'max-w-md'} rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[92dvh]`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line flex-none">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink" aria-label="Yopish"><i className="ti ti-x text-xl" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex-none border-t border-line px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <div className={`mb-3 ${className}`}>
      <label className="block text-xs font-medium text-ink mb-1">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted mt-1">{hint}</p>}
    </div>
  );
}

export function Section({ title, icon, children, right }) {
  return (
    <div className="bg-surface border border-line rounded-2xl p-4 sm:p-5 mb-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
          {icon && <i className={`ti ${icon} text-brand-600`} />}{title}
        </h2>
        {right}
      </div>
      {children}
    </div>
  );
}

/** Joriy oy 'YYYY-MM' (Toshkent) */
export function thisMonth() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit' }).format(new Date());
}
export function todayIso() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
export const fmtDate = (d) => {
  if (!d) return '—';
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? String(d) : x.toLocaleDateString('ru-RU', { timeZone: 'Asia/Tashkent' });
};
