import { MoneyInput } from '@/components/form/NumberInput';

/*
 * ═══════════════════════════════════════════════════════════
 * HAJM / RAZMER VA QO'SHIMCHALAR — TAHRIRLAGICH
 * ═══════════════════════════════════════════════════════════
 *
 * Restoran taomga IKKITA, BIR-BIRIDAN MUSTAQIL panel qo'sha oladi:
 *
 *   Hajm / razmer (variant) — eng ko'pi BITTA
 *     "33 sm — 61 500", "40 sm — 76 875".
 *     Mijoz BITTASINI tanlaydi va uning narxi taom narxi
 *     O'RNIGA olinadi.
 *
 *   Qo'shimchalar (addon) — eng ko'pi BITTA
 *     "Pishloq +5 000", "Qo'ziqorin +7 000".
 *     Mijoz bir nechtasini tanlashi mumkin, narxi QO'SHILADI.
 *     Har bir qator "Majburiy" belgisiga ega bo'lishi mumkin —
 *     belgilansa, mijoz buyurtma qilganda shu qo'shimcha
 *     AVTOMATIK qo'shiladi va uni olib tashlay olmaydi
 *     (narxi ham majburan olinadi — server buni ham tekshiradi).
 *
 * ─── NEGA IKKI ALOHIDA PANEL, BITTA UMUMIY RO'YXAT EMAS ───
 *
 * Avval bitta `groups` massivi ustidan aylanib, har birini
 * massiv INDEKSI bo'yicha (`key={gi}`) chizardi. Ikkita panel
 * bo'lganda (Hajm + Qo'shimcha) biri o'chirilsa yoki tartib
 * o'zgarsa, React key'lar to'qnashib, BIR paneldagi input
 * qiymati IKKINCHI panelga "sirg'alib o'tishi" mumkin edi.
 *
 * Endi Hajm va Qo'shimcha — IKKITA MUSTAQIL STATE (pastda
 * `variant` va `addon`), massiv emas, obyekt maydoni sifatida
 * saqlanadi. Bittasini o'zgartirish ikkinchisiga HECH QACHON
 * tegmaydi — bu endi tasodifiy emas, STRUKTURA shunday.
 *
 * Tashqariga (serverga) hali ham `groups` massivi sifatida
 * chiqadi — backend va MenuPage.jsx o'zgarishsiz qoladi.
 */

const EMPTY_OPTION = { name: '', price: null };
const EMPTY_ADDON_OPTION = { name: '', price: null, mandatory: false };

/**
 * `groups` massividan Hajm va Qo'shimcha panellarini ajratadi.
 *
 * Eski ma'lumotda bir nechta 'addon' guruhi bo'lib qolgan bo'lsa
 * (avvalgi versiya buni ruxsat berardi), ularning BARCHA
 * qatorlari BITTA Qo'shimchalar paneliga birlashtiriladi —
 * ma'lumot yo'qolmaydi, faqat yangi (bitta panel) tuzilishiga
 * moslashtiriladi.
 */
function splitGroups(groups) {
  const variant = groups.find((g) => g.kind === 'variant') || null;
  const addonGroups = groups.filter((g) => g.kind === 'addon');
  const addon = addonGroups.length
    ? {
      title: addonGroups[0].title || 'Qo‘shimchalar',
      kind: 'addon',
      options: addonGroups.flatMap((g) => (g.options || []).map((o) => ({
        name: o.name || '', price: o.price ?? null, mandatory: Boolean(o.mandatory),
      }))),
    }
    : null;
  return { variant, addon };
}

/** `{variant, addon}` dan tashqi `groups` massivini yig'adi. */
function mergeGroups({ variant, addon }) {
  return [variant, addon].filter(Boolean);
}

export function OptionGroupsEditor({ groups, onChange }) {
  const { variant, addon } = splitGroups(groups);

  const setVariant = (next) => onChange(mergeGroups({ variant: next, addon }));
  const setAddon = (next) => onChange(mergeGroups({ variant, addon: next }));

  const openVariant = () => setVariant({
    title: 'Hajmi', kind: 'variant', options: [{ ...EMPTY_OPTION }, { ...EMPTY_OPTION }],
  });
  const openAddon = () => setAddon({
    title: 'Qo‘shimchalar', kind: 'addon', options: [{ ...EMPTY_ADDON_OPTION }],
  });

  return (
    <div className="space-y-3">
      {variant && <VariantPanel group={variant} onChange={setVariant} onRemove={() => setVariant(null)} />}
      {addon && <AddonPanel group={addon} onChange={setAddon} onRemove={() => setAddon(null)} />}

      {/*
        Pastdagi tugmalar FAQAT tegishli panel hali ochilmagan bo'lsa
        ko'rinadi — panel o'zi ochilgach, yangi qator qo'shish uning
        ICHIDAGI "+ ... qo'shish" havolasi orqali bo'ladi.
      */}
      <div className="flex flex-wrap gap-2">
        {!variant && (
          <button type="button" onClick={openVariant}
            className="text-sm px-3 py-2 rounded-lg border border-line text-ink">
            + Hajm / razmer
          </button>
        )}
        {!addon && (
          <button type="button" onClick={openAddon}
            className="text-sm px-3 py-2 rounded-lg border border-line text-ink">
            + Qo‘shimchalar
          </button>
        )}
      </div>
    </div>
  );
}

/** Hajm / razmer paneli — bitta guruh, kamida 2 ta variant. */
function VariantPanel({ group, onChange, onRemove }) {
  const setOption = (oi, patch) => onChange({
    ...group, options: group.options.map((o, j) => (j === oi ? { ...o, ...patch } : o)),
  });
  const addOption = () => onChange({ ...group, options: [...group.options, { ...EMPTY_OPTION }] });
  const removeOption = (oi) => onChange({ ...group, options: group.options.filter((_, j) => j !== oi) });

  return (
    <div className="border border-line rounded-xl p-3 bg-canvas/40">
      <div className="flex items-center gap-2 mb-2">
        <input
          value={group.title}
          onChange={(e) => onChange({ ...group, title: e.target.value.slice(0, 60) })}
          placeholder="Hajmi"
          className="flex-1 bg-transparent font-medium text-ink outline-none"
        />
        <button type="button" onClick={onRemove}
          className="text-xs text-red-600 px-2 py-1">O‘chirish</button>
      </div>

      <p className="text-[11px] text-muted mb-2 leading-snug">
        Mijoz BITTASINI tanlaydi. Narx taom narxi O‘RNIGA olinadi — to‘liq narxni yozing.
      </p>

      <div className="space-y-1.5">
        {group.options.map((o, oi) => (
          <div key={oi} className="flex items-center gap-2">
            <input
              value={o.name}
              onChange={(e) => setOption(oi, { name: e.target.value.slice(0, 60) })}
              placeholder={oi === 0 ? '33 sm' : '40 sm'}
              className="flex-1 min-w-0 border border-line rounded-lg px-2.5 py-2 text-sm bg-surface"
            />
            <div className="w-32 shrink-0">
              <MoneyInput value={o.price} onChange={(v) => setOption(oi, { price: v })} placeholder="61 500" />
            </div>
            <button type="button" onClick={() => removeOption(oi)}
              disabled={group.options.length <= 2}
              className="text-muted px-1 disabled:opacity-30" aria-label="O‘chirish">✕</button>
          </div>
        ))}
      </div>

      {group.options.length < 20 && (
        <button type="button" onClick={addOption} className="mt-2 text-xs text-brand-600">
          + Hajm qo‘shish
        </button>
      )}
    </div>
  );
}

/** Qo'shimchalar paneli — bitta guruh, har qatorda "Majburiy" belgisi. */
function AddonPanel({ group, onChange, onRemove }) {
  const setOption = (oi, patch) => onChange({
    ...group, options: group.options.map((o, j) => (j === oi ? { ...o, ...patch } : o)),
  });
  const addOption = () => onChange({ ...group, options: [...group.options, { ...EMPTY_ADDON_OPTION }] });
  const removeOption = (oi) => onChange({ ...group, options: group.options.filter((_, j) => j !== oi) });

  return (
    <div className="border border-line rounded-xl p-3 bg-canvas/40">
      <div className="flex items-center gap-2 mb-2">
        <input
          value={group.title}
          onChange={(e) => onChange({ ...group, title: e.target.value.slice(0, 60) })}
          placeholder="Qo‘shimchalar"
          className="flex-1 bg-transparent font-medium text-ink outline-none"
        />
        <button type="button" onClick={onRemove}
          className="text-xs text-red-600 px-2 py-1">O‘chirish</button>
      </div>

      <p className="text-[11px] text-muted mb-2 leading-snug">
        Mijoz bir nechtasini tanlashi mumkin. Narx taom narxiga QO‘SHILADI.
        Katakchani belgilasangiz — bu qo‘shimcha <b>majburiy</b> bo‘ladi:
        mijoz buyurtma qilganda avtomatik qo‘shiladi, olib tashlay olmaydi.
      </p>

      <div className="space-y-1.5">
        {group.options.map((o, oi) => (
          <div key={oi} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(o.mandatory)}
              onChange={(e) => setOption(oi, { mandatory: e.target.checked })}
              className="shrink-0 w-4 h-4 accent-brand-500"
              title="Majburiy qo‘shimcha"
              aria-label="Majburiy"
            />
            <input
              value={o.name}
              onChange={(e) => setOption(oi, { name: e.target.value.slice(0, 60) })}
              placeholder="Pishloq"
              className="flex-1 min-w-0 border border-line rounded-lg px-2.5 py-2 text-sm bg-surface"
            />
            <div className="w-28 shrink-0">
              <MoneyInput value={o.price} onChange={(v) => setOption(oi, { price: v })} placeholder="5 000" />
            </div>
            <button type="button" onClick={() => removeOption(oi)}
              disabled={group.options.length <= 1}
              className="text-muted px-1 disabled:opacity-30" aria-label="O‘chirish">✕</button>
          </div>
        ))}
      </div>

      {group.options.length < 20 && (
        <button type="button" onClick={addOption} className="mt-2 text-xs text-brand-600">
          + Qo‘shimcha qo‘shish
        </button>
      )}
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
      .map((o) => ({
        name: o.name.trim(),
        price: Number(o.price) || 0,
        // `mandatory` faqat qo'shimcha (addon) uchun ma'noli
        ...(g.kind === 'addon' ? { mandatory: Boolean(o.mandatory) } : {}),
      })),
  }));
}
