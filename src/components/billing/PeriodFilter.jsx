import { PRESETS, tashkentToday, isValidRange } from '@/lib/billingPeriod';

/*
 * Sana filtri — "Kecha qancha o'tkazildi?" savoliga javob berish
 * uchun. Tez tanlov tugmalari + "Sana tanlash" (dan–gacha).
 * Sanalar TOSHKENT kunlari (server ham shunday o'qiydi).
 *
 * value: { key, from, to }
 */
export function PeriodFilter({ value, onChange }) {
  const today = tashkentToday();
  const custom = value.key === 'custom';
  const invalid = custom && value.from && value.to && !isValidRange(value.from, value.to);

  const pick = (key) => {
    if (key === 'custom') onChange({ key, from: value.from || today, to: value.to || today });
    else onChange({ key, from: '', to: '' });
  };

  return (
    <div className="mb-3">
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => pick(p.key)}
            className={`flex-none whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium ${
              value.key === p.key
                ? 'border-brand-400 bg-brand-400 text-brand-text'
                : 'border-line bg-surface text-muted hover:bg-canvas'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {custom && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          <label className="flex items-center gap-1.5">
            dan
            <input
              type="date"
              max={today}
              value={value.from}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
              className="rounded-lg border border-line bg-canvas px-2 py-1.5 text-sm text-ink"
            />
          </label>
          <label className="flex items-center gap-1.5">
            gacha
            <input
              type="date"
              max={today}
              value={value.to}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
              className="rounded-lg border border-line bg-canvas px-2 py-1.5 text-sm text-ink"
            />
          </label>
          {invalid && (
            <span className="text-red-600">Boshlanish sanasi tugashidan keyin bo‘lmasligi kerak</span>
          )}
        </div>
      )}
    </div>
  );
}
