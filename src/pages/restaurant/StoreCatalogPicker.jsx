import { useState, useEffect, useMemo } from 'react';
import { panelApi } from '@/api';
import { useLockScroll } from '@/hooks/useLockScroll';
import { MoneyInput } from '@/components/form/NumberInput';
import { Img } from '@/components/Img';
import { catalogCategoryLabel } from '@/constants/catalogCategories';
import { BarcodeField } from './BarcodeField';

/*
 * ═══ DO'KON: UMUMIY KATALOGDAN QO'SHISH ═══
 *
 * Restoran menyusidagi katalog tugmasining do'kon varianti. Farqi —
 * tanlangan mahsulot Market maydonlari bilan qo'shiladi:
 *   kategoriya (katalogdan avtomatik taklif — server: CATALOG_TO_MARKET),
 *   narx + nima uchun (dona / kg / ...), chegirma, qadoq hajmi, brend,
 *   shtrix-kod. Hammasi oldindan to'ldiriladi, do'kon egasi faqat
 *   narxni qo'yib "Qo'shish"ni bosadi (kerak bo'lsa o'zgartiradi).
 *
 * Server: POST /panel/catalog/:id/add — do'kon bo'lsa shu maydonlarni oladi.
 */
const som = (n) => (n ?? 0).toLocaleString('ru-RU').replace(/,/g, ' ');

export function StoreCatalogPicker({ meta, onClose, onAdded }) {
  useLockScroll();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(null);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
      panelApi.getPanelCatalog(qs)
        .then((list) => { setItems(list); setLoadErr(null); })
        .catch((e) => setLoadErr(e.message || 'Katalogni yuklab bo‘lmadi'))
        .finally(() => setLoading(false));
    }, q ? 350 : 0);
    return () => clearTimeout(t);
  }, [q]);

  // Katalog kategoriyasi bo'yicha guruh
  const grouped = useMemo(() => items.reduce((acc, p) => {
    const key = catalogCategoryLabel(p.category);
    (acc[key] = acc[key] || []).push(p);
    return acc;
  }, {}), [items]);

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[90dvh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line flex-none">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-ink">Katalogdan qo'shish</h2>
            <p className="text-xs text-muted mt-0.5">Tayyor mahsulot — narxini qo'ying, qolgani to'ldirilgan</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink flex-none" aria-label="Yopish"><i className="ti ti-x text-xl" /></button>
        </div>

        {picked ? (
          <AddForm
            product={picked}
            meta={meta}
            onBack={() => setPicked(null)}
            onAdded={onAdded}
          />
        ) : (
          <>
            <div className="px-5 py-3 border-b border-line flex-none">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sut, guruch, Coca-Cola..." className="inp" />
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              {loading ? (
                <div className="text-muted text-sm py-6 text-center">Yuklanmoqda...</div>
              ) : loadErr ? (
                <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{loadErr}</div>
              ) : items.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-canvas">
                    <i className="ti ti-package-off text-2xl text-muted" />
                  </div>
                  <div className="text-sm text-ink font-semibold">{q ? 'Topilmadi' : 'Katalog hali to‘ldirilmagan'}</div>
                  <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-muted">
                    {q ? 'Boshqa nom bilan qidiring yoki mahsulotni qo‘lda qo‘shing.'
                      : 'Katalogni LokmaGo administratori to‘ldiradi. Hozircha mahsulotni qo‘lda qo‘shishingiz mumkin.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(grouped).map(([category, list]) => (
                    <div key={category}>
                      <div className="text-xs font-semibold text-muted mb-2">{category}</div>
                      <div className="space-y-1.5">
                        {list.map((p) => (
                          <button
                            key={p._id}
                            onClick={() => !p.alreadyAdded && setPicked(p)}
                            disabled={p.alreadyAdded}
                            className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors ${
                              p.alreadyAdded ? 'border-line bg-canvas opacity-50 cursor-default' : 'border-line hover:border-brand-400 hover:bg-canvas'}`}
                          >
                            {p.imageUrl ? (
                              <Img src={p.imageUrl} w={96} className="w-11 h-11 rounded-lg object-cover flex-none" />
                            ) : (
                              <div className="w-11 h-11 rounded-lg bg-canvas flex items-center justify-center flex-none">
                                <i className="ti ti-basket text-muted" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-ink truncate">
                                {p.name}{p.volume && <span className="text-muted font-normal"> · {p.volume}</span>}
                              </div>
                              <div className="text-xs text-muted truncate">
                                {[p.suggestedPrice > 0 && `~${som(p.suggestedPrice)} so'm`].filter(Boolean).join(' · ') || '\u00a0'}
                              </div>
                            </div>
                            {p.alreadyAdded
                              ? <span className="text-[11px] text-green-600 font-medium flex-none">Do'konda</span>
                              : <i className="ti ti-plus text-brand-600 flex-none" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AddForm({ product, meta, onBack, onAdded }) {
  const sug = product.market || {};
  const [f, setF] = useState({
    marketCategory: sug.marketCategory || 'boshqa',
    unit: sug.unit || 'dona',
    price: product.suggestedPrice || null,
    oldPrice: null,
    packSize: product.volume || '',
    barcode: '',
  });
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const catByGroup = useMemo(() => meta.groups.map((g) => ({
    ...g, items: meta.categories.filter((c) => c.group === g.value),
  })).filter((g) => g.items.length), [meta]);
  const unitLabel = meta.units.find((u) => u.value === f.unit)?.label || f.unit;

  const add = async () => {
    if (!f.price || Number(f.price) <= 0) { setErr('Narxni kiriting'); return; }
    if (f.oldPrice && Number(f.oldPrice) <= Number(f.price)) { setErr('Eski narx hozirgi narxdan katta bo‘lishi kerak'); return; }
    if (f.barcode && !/^[0-9A-Za-z-]{4,32}$/.test(f.barcode.trim())) { setErr('Shtrix-kod noto‘g‘ri'); return; }
    setSaving(true); setErr(null);
    try {
      await panelApi.addFromCatalog(product._id, {
        price: Number(f.price),
        ...(f.oldPrice > 0 ? { oldPrice: Number(f.oldPrice) } : {}),
        marketCategory: f.marketCategory,
        unit: f.unit,
        packSize: f.packSize.trim(),
        barcode: f.barcode.trim(),
      });
      onAdded();
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-3 bg-canvas rounded-xl p-3 mb-4">
        {product.imageUrl ? (
          <Img src={product.imageUrl} w={112} className="w-14 h-14 rounded-lg object-cover flex-none" />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-surface flex items-center justify-center flex-none"><i className="ti ti-basket text-muted text-xl" /></div>
        )}
        <div className="min-w-0">
          <div className="font-medium text-ink">{product.name}</div>
          <div className="text-sm text-muted truncate">{catalogCategoryLabel(product.category)}</div>
        </div>
      </div>

      <Field label="Market kategoriyasi" hint="Katalogdan avtomatik tanlandi — kerak bo'lsa o'zgartiring">
        <select value={f.marketCategory} onChange={(e) => set('marketCategory', e.target.value)} className="inp">
          {catByGroup.map((g) => (
            <optgroup key={g.value} label={g.label}>
              {g.items.map((c) => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
            </optgroup>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Sizning narxingiz *" hint={product.suggestedPrice > 0 ? `Tavsiya: ${som(product.suggestedPrice)}` : undefined}>
          <MoneyInput value={f.price} onChange={(v) => set('price', v)} placeholder="8 000" />
        </Field>
        <Field label="Narx nima uchun">
          <select value={f.unit} onChange={(e) => set('unit', e.target.value)} className="inp">
            {meta.units.map((u) => <option key={u.value} value={u.value}>1 {u.label}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Eski narx (chegirma bo'lsa)">
        <MoneyInput value={f.oldPrice} onChange={(v) => set('oldPrice', v)} placeholder="Bo'sh — chegirma yo'q" />
      </Field>

      <Field label="Qadoq hajmi">
        <input value={f.packSize} onChange={(e) => set('packSize', e.target.value)} placeholder="1 l, 900 g" maxLength={40} className="inp" />
      </Field>

      <BarcodeField value={f.barcode} onChange={(v) => set('barcode', v)} />

      {f.price > 0 && (
        <div className="mb-3 rounded-xl bg-canvas px-3 py-2 text-xs text-muted">
          Mijoz ko'radi: <b className="text-ink">{som(f.price)} so'm / {unitLabel}</b>{f.packSize && ` · ${f.packSize}`}
        </div>
      )}

      {err && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{err}</div>}

      <div className="flex gap-2 mt-2">
        <button onClick={onBack} className="flex-1 border border-line text-muted py-2.5 rounded-xl">Orqaga</button>
        <button onClick={add} disabled={saving} className="flex-[1.5] bg-brand-400 text-brand-text font-medium py-2.5 rounded-xl disabled:opacity-50">
          {saving ? 'Qo‘shilmoqda...' : 'Do‘konga qo‘shish'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-ink mb-1">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted mt-1">{hint}</p>}
    </div>
  );
}
