import { MoneyInput } from '@/components/form/NumberInput';

/*
 * ═══════════════════════════════════════════════════════════
 * HAJM / RAZMER VA QO'SHIMCHALAR — TAHRIRLAGICH
 * ═══════════════════════════════════════════════════════════
 *
 * Restoran taomga ikki xil guruh qo'sha oladi:
 *
 *   Hajm / razmer (variant)
 *     "33 sm — 61 500", "40 sm — 76 875".
 *     Mijoz BITTASINI tanlaydi va uning narxi taom narxi
 *     O'RNIGA olinadi. Taomda faqat bitta shunday guruh.
 *
 *   Qo'shimchalar (addon)
 *     "Pishloq +5 000", "Qo'ziqorin +7 000".
 *     Mijoz bir nechtasini tanlashi mumkin, narxi QO'SHILADI.
 *
 * Mustaqil komponent — faqat `groups` va `onChange` bilan ishlaydi,
 * formaning boshqa qismlariga ta'sir qilmaydi.
 */

const EMPTY_OPTION = { name: '', price: null };

export function OptionGroupsEditor({ groups, onChange }) {
  const hasVariant = groups.some((g) => g.kind === 'variant');

  const update = (i, patch) => onChange(groups.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  const remove = (i) => onChange(groups.filter((_, j) => j !== i));

  const setOption = (gi, oi, patch) => update(gi, {
    options: groups[gi].options.map((o, j) => (j === oi ? { ...o, ...patch } : o)),
  });
  const addOption = (gi) => update(gi, { options: [...groups[gi].options, { ...EMPTY_OPTION }] });
  const removeOption = (gi, oi) => update(gi, {
    options: groups[gi].options.filter((_, j) => j !== oi),
  });

  const addGroup = (kind) => onChange([
    ...groups,
    kind === 'variant'
      ? { title: 'Hajmi', kind: 'variant', options: [{ ...EMPTY_OPTION }, { ...EMPTY_OPTION }] }
      : { title: 'Qo‘shimchalar', kind: 'addon', options: [{ ...EMPTY_OPTION }] },
  ]);

  return (
    <div className="space-y-3">
      {groups.map((g, gi) => {
        const isVariant = g.kind === 'variant';
        return (
          <div key={gi} className="border border-line rounded-xl p-3 bg-canvas/40">
            <div className="flex items-center gap-2 mb-2">
              <input
                value={g.title}
                onChange={(e) => update(gi, { title: e.target.value.slice(0, 60) })}
                placeholder={isVariant ? 'Hajmi' : 'Qo‘shimchalar'}
                className="flex-1 bg-transparent font-medium text-ink outline-none"
              />
              <button type="button" onClick={() => remove(gi)}
                className="text-xs text-red-600 px-2 py-1">O‘chirish</button>
            </div>

            {/* Tur — narx qanday hisoblanishini aniq ko'rsatadi */}
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {[
                ['variant', 'Hajm / razmer'],
                ['addon', 'Qo‘shimcha'],
              ].map(([k, label]) => {
                // Ikkinchi hajm guruhini yaratib bo'lmaydi
                const blocked = k === 'variant' && hasVariant && !isVariant;
                return (
                  <button key={k} type="button" disabled={blocked}
                    onClick={() => update(gi, { kind: k })}
                    className={`py-1.5 rounded-lg text-xs border ${
                      g.kind === k
                        ? 'border-brand-400 bg-brand-50 text-brand-600 font-medium'
                        : 'border-line text-muted'
                    } ${blocked ? 'opacity-40' : ''}`}>
                    {label}
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] text-muted mb-2 leading-snug">
              {isVariant
                ? 'Mijoz BITTASINI tanlaydi. Narx taom narxi O‘RNIGA olinadi — to‘liq narxni yozing.'
                : 'Mijoz bir nechtasini tanlashi mumkin. Narx taom narxiga QO‘SHILADI.'}
            </p>

            <div className="space-y-1.5">
              {g.options.map((o, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input
                    value={o.name}
                    onChange={(e) => setOption(gi, oi, { name: e.target.value.slice(0, 60) })}
                    placeholder={isVariant ? (oi === 0 ? '33 sm' : '40 sm') : 'Pishloq'}
                    className="flex-1 min-w-0 border border-line rounded-lg px-2.5 py-2 text-sm bg-surface"
                  />
                  <div className="w-32 shrink-0">
                    <MoneyInput
                      value={o.price}
                      onChange={(v) => setOption(gi, oi, { price: v })}
                      placeholder={isVariant ? '61 500' : '5 000'}
                    />
                  </div>
                  <button type="button" onClick={() => removeOption(gi, oi)}
                    disabled={g.options.length <= (isVariant ? 2 : 1)}
                    className="text-muted px-1 disabled:opacity-30" aria-label="O‘chirish">✕</button>
                </div>
              ))}
            </div>

            {g.options.length < 20 && (
              <button type="button" onClick={() => addOption(gi)}
                className="mt-2 text-xs text-brand-600">
                + {isVariant ? 'Hajm qo‘shish' : 'Qo‘shimcha qo‘shish'}
              </button>
            )}
          </div>
        );
      })}

      <div className="flex flex-wrap gap-2">
        {!hasVariant && (
          <button type="button" onClick={() => addGroup('variant')}
            className="text-sm px-3 py-2 rounded-lg border border-line text-ink">
            + Hajm / razmer
          </button>
        )}
        {groups.length < 10 && (
          <button type="button" onClick={() => addGroup('addon')}
            className="text-sm px-3 py-2 rounded-lg border border-line text-ink">
            + Qo‘shimchalar
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Guruhlarni saqlashdan oldin tekshiradi.
 * @returns {string|null} xato matni yoki null
 */
export function validateOptionGroups(groups) {
  for (const g of groups) {
    if (!g.title.trim()) return 'Guruh nomini kiriting';
    const filled = g.options.filter((o) => o.name.trim());
    if (g.kind === 'variant') {
      if (filled.length < 2) return `"${g.title}": kamida 2 ta hajm kiriting`;
      if (filled.some((o) => !(Number(o.price) > 0))) return `"${g.title}": har bir hajmga narx yozing`;
    } else if (filled.length < 1) {
      return `"${g.title}": kamida bitta qo‘shimcha kiriting`;
    }
  }
  return null;
}

/** Serverga yuboriladigan shakl — bo'sh qatorlar tashlanadi. */
export function serializeOptionGroups(groups) {
  return groups.map((g) => ({
    title: g.title.trim(),
    kind: g.kind,
    options: g.options
      .filter((o) => o.name.trim())
      .map((o) => ({ name: o.name.trim(), price: Number(o.price) || 0 })),
  }));
}
