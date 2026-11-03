import { useDistricts } from './districts';

/**
 * Tuman tanlash. `multiple` — bir nechta (kuryer ish tumanlari), aks holda bittasi (restoran).
 * Namangan shahri ichidagi tumanlar alohida guruh.
 */
export function DistrictPicker({ value, onChange, multiple = false, disabled = false }) {
  const list = useDistricts();
  const groups = [
    { key: 'city', title: 'Namangan shahri', items: list.filter((d) => d.group === 'city') },
    { key: 'district', title: 'Tumanlar', items: list.filter((d) => d.group !== 'city') },
  ];
  const selected = new Set(multiple ? (value || []) : [value]);
  const toggle = (id) => {
    if (disabled) return;
    if (!multiple) { onChange(id); return; }
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(list.map((d) => d.id).filter((x) => next.has(x)));
  };
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.key}>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{g.title}</div>
          <div className="flex flex-wrap gap-1.5">
            {g.items.map((d) => {
              const on = selected.has(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggle(d.id)}
                  aria-pressed={on}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${on ? 'border-brand-400 bg-brand-tint text-brand-600' : 'border-line bg-surface text-ink hover:bg-canvas'} ${disabled ? 'opacity-50' : ''}`}
                >
                  {on && multiple && <i className="ti ti-check mr-1" />}{d.uz}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {multiple && (
        <div className="flex gap-2 text-xs">
          <button type="button" disabled={disabled} className="text-brand-600 hover:underline" onClick={() => onChange(list.map((d) => d.id))}>Hammasi</button>
          <button type="button" disabled={disabled} className="text-muted hover:underline" onClick={() => onChange([])}>Tozalash</button>
        </div>
      )}
    </div>
  );
}
