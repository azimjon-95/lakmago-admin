// Bosqich sahifalarida ishlatiladigan umumiy forma elementlari

export function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink mb-1.5">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-canvas text-ink outline-none focus:border-brand-400 transition-colors"
      />
    </div>
  );
}

/**
 * Raqam maydoni.
 *
 * money={true} bo'lsa yozilayotganda 1 000 000 ko'rinishida
 * ajratiladi, serverga toza son uzatiladi.
 *
 * Bo'sh qoldirish mumkin — 0 ni o'chirib yozish shart emas.
 */
export function NumField({ label, value, onChange, hint, money, placeholder, suffix }) {
  const isEmpty = value === null || value === undefined || value === '';

  const shown = isEmpty
    ? ''
    : money
      ? Number(value).toLocaleString('ru-RU').replace(/,/g, ' ')
      : String(value);

  const handle = (e) => {
    const digits = e.target.value.replace(/\D/g, '');
    onChange(digits === '' ? null : Number(digits));
  };

  const unit = suffix || (money ? "so'm" : null);

  return (
    <div>
      <label className="block text-sm font-medium text-ink mb-1.5">{label}</label>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={shown}
          onChange={handle}
          placeholder={placeholder || '0'}
          className={`w-full px-3.5 py-2.5 rounded-xl border border-line bg-canvas text-ink outline-none focus:border-brand-400 transition-colors ${
            unit ? 'pr-14' : ''
          }`}
        />
        {unit && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-muted pointer-events-none">
            {unit}
          </span>
        )}
      </div>
      {hint && <p className="text-[11px] text-muted mt-1">{hint}</p>}
    </div>
  );
}

// Bo'lim karkasi — bir xil ko'rinish
export function Section({ icon, title, hint, children }) {
  return (
    <section className="bg-surface border border-line rounded-2xl p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-ink mb-1 flex items-center gap-2">
        <i className={`ti ${icon} text-brand-600`} /> {title}
      </h2>
      {hint && <p className="text-xs text-muted mb-4">{hint}</p>}
      {!hint && <div className="mb-4" />}
      {children}
    </section>
  );
}

// Tekshiruv qatori
export function Review({ label, value, warn }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-line last:border-0">
      <span className="text-sm text-muted flex-none">{label}</span>
      <span className={`text-sm text-right break-words ${warn ? 'text-amber-600' : 'text-ink'}`}>
        {value || '—'}
      </span>
    </div>
  );
}
