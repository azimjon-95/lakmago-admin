/**
 * Raqam kiritish maydoni.
 *
 * Muammo: type="number" bilan qiymat 0 bo'lsa foydalanuvchi avval
 * uni o'chirib, keyin yozishga majbur bo'ladi. Bo'sh maydon
 * ancha qulay.
 *
 * Yechim: ichkarida matn sifatida saqlanadi, tashqariga son
 * yoki null uzatiladi.
 */
export function NumberInput({
  value,
  onChange,
  placeholder = '',
  min,
  max,
  step,
  suffix,
  className = '',
  ...rest
}) {
  // null/undefined → bo'sh maydon. 0 esa haqiqiy qiymat sifatida ko'rsatiladi.
  const shown = value === null || value === undefined || value === '' ? '' : String(value);

  const handle = (e) => {
    const raw = e.target.value;
    if (raw === '') {
      onChange(null);
      return;
    }
    // Faqat raqam va nuqta
    const cleaned = raw.replace(/[^\d.]/g, '');
    if (cleaned === '') {
      onChange(null);
      return;
    }
    const num = Number(cleaned);
    if (Number.isNaN(num)) return;
    onChange(num);
  };

  return (
    <div className={suffix ? 'relative' : ''}>
      <input
        type="text"
        inputMode="decimal"
        value={shown}
        onChange={handle}
        placeholder={placeholder}
        className={`inp ${suffix ? 'pr-12' : ''} ${className}`}
        {...rest}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

/**
 * Pul miqdori — yozilayotganda 1 000 000 ko'rinishida ajratiladi,
 * serverga toza son uzatiladi.
 */
export function MoneyInput({
  value,
  onChange,
  placeholder = '0',
  className = '',
  ...rest
}) {
  const shown = value === null || value === undefined || value === ''
    ? ''
    : Number(value).toLocaleString('ru-RU').replace(/,/g, ' ');

  const handle = (e) => {
    // Bo'shliq va boshqa belgilarni olib tashlaymiz
    const digits = e.target.value.replace(/\D/g, '');
    onChange(digits === '' ? null : Number(digits));
  };

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        value={shown}
        onChange={handle}
        placeholder={placeholder}
        className={`inp pr-14 ${className}`}
        {...rest}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted pointer-events-none">
        so'm
      </span>
    </div>
  );
}
