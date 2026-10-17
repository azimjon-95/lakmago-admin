import { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi } from '@/api';
import { ImageUpload } from '@/components/ImageUpload';
import { confirm, confirmDelete } from '@/components/ui/confirm';
import { PromoCard, ensurePromoFont } from './PromoCard';

/*
 * ═══ REKLAMA OYNALARI — ADMIN BOSHQARUVI ═══
 * Mijoz ilovasi ochilganda (splash'dan keyin, bosh sahifada) faol oynalar tartib bo'yicha
 * navbat bilan chiqadi; har biri kuniga bir marta (yoki umuman bir marta).
 * Bu yerda: yaratish, tahrirlash (jonli ko'rinish bilan), yoqish/o'chirish, tartib, nusxa,
 * "Qayta ko'rsatish" (bugun ko'rganlarga ham), o'chirish, ko'rildi/bosildi statistikasi.
 */
const TEMPLATES = [
  ['brush', "Cho'tka", "Oq fon, to'q sariq zarbalar, qora lenta"],
  ['coupon', 'Kupon', 'Chegirma chiptasi, uzib olinadigan pastki qism'],
  ['sunburst', 'Nurlar', "To'q sariq nurlar, oq sarlavha"],
];
const LINKS = [['', 'Faqat yopiladi'], ['/', 'Bosh sahifa'], ['/market', 'Market'], ['custom', 'Boshqa havola']];
const MAX_ACTIVE = 5;
const LIMIT = { title: 90, footer: 70 };
const visibleLen = (s) => String(s || '').replace(/\*/g, '').length;

const EMPTY = { template: 'brush', title: '', footer: '', imageUrl: '', link: '', active: false, frequency: 'daily', startsAt: '', endsAt: '' };

const toLocal = (d) => (d ? new Date(new Date(d).getTime() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '');

function statusOf(p) {
  if (!p.active) return ['O‘chirilgan', 'bg-gray-100 text-gray-600'];
  if (p.live) return ['Mijozlarga ko‘rinmoqda', 'bg-green-50 text-green-700'];
  if (p.startsAt && new Date(p.startsAt) > new Date()) return ['Boshlanishi kutilmoqda', 'bg-amber-50 text-amber-700'];
  return ['Muddati tugagan', 'bg-red-50 text-red-600'];
}

export function PromoModalsPage() {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState(null);
  const [edit, setEdit] = useState(null); // { ...promo } yoki EMPTY
  const [busyId, setBusyId] = useState(null);

  useEffect(() => { ensurePromoFont(); }, []);
  const load = useCallback(async () => {
    setErr(null);
    try { setItems(await adminApi.getPromoModals()); } catch (e) { setErr(e.message); setItems((p) => p ?? []); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const activeCount = (items || []).filter((p) => p.active).length;

  const act = async (id, fn) => {
    setBusyId(id); setErr(null);
    try { await fn(); await load(); } catch (e) { setErr(e.message); } finally { setBusyId(null); }
  };
  const toggle = (p) => act(p.id, () => adminApi.updatePromoModal(p.id, { active: !p.active }));
  const move = (i, dir) => {
    const list = [...items];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setItems(list);
    act('order', () => adminApi.reorderPromoModals(list.map((p) => p.id)));
  };
  const duplicate = (p) => act(p.id, () => adminApi.createPromoModal({ ...pick(p), active: false, title: p.title }));
  const reshow = async (p) => {
    if (!await confirm({ title: 'Yana ko‘rsatilsinmi?', content: 'Bugun bu oynani ko‘rgan mijozlarga ham u yana bir marta chiqadi.' })) return;
    act(p.id, () => adminApi.reshowPromoModal(p.id));
  };
  const remove = async (p) => {
    if (!await confirmDelete('reklama oynasini')) return;
    act(p.id, () => adminApi.deletePromoModal(p.id));
  };

  return (
    <div className="min-w-0 flex-1 p-3 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Reklama oynalari</h1>
          <p className="mt-0.5 max-w-xl text-sm text-muted">Mijoz ilovani ochib, bosh sahifaga kirganda faol oynalar shu tartibda birin-ketin chiqadi. Har bir oyna mijozga kuniga bir marta ko‘rinadi.</p>
        </div>
        <button onClick={() => setEdit({ ...EMPTY })} className="rounded-xl bg-brand-400 px-4 py-2.5 text-sm font-semibold text-brand-text active:opacity-80">
          <i className="ti ti-plus" /> Yangi oyna
        </button>
      </div>

      {err && <div className="mb-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{err}</div>}
      {activeCount >= MAX_ACTIVE && <div className="mb-3 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">Bir vaqtda ko‘pi bilan {MAX_ACTIVE} ta oyna yoqilishi mumkin — mijozni charchatmaslik uchun.</div>}

      {items === null ? (
        <div className="grid gap-3">{[0, 1].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-canvas" />)}</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-6 py-12 text-center">
          <i className="ti ti-sparkles text-3xl text-muted" />
          <p className="mt-2 text-sm text-muted">Hali reklama oynasi yo‘q. Birinchisini yarating — u mijoz ilovasi ochilganda chiqadi.</p>
          <button onClick={() => setEdit({ ...EMPTY })} className="mt-4 rounded-xl bg-brand-400 px-4 py-2.5 text-sm font-semibold text-brand-text">Yangi oyna</button>
        </div>
      ) : (
        <ol className="grid gap-3">
          {items.map((p, i) => {
            const [label, cls] = statusOf(p);
            const shown = p.stats?.shown || 0; const clicked = p.stats?.clicked || 0;
            return (
              <li key={p.id} className={`flex gap-3 rounded-2xl border bg-surface p-3 ${p.active ? 'border-line' : 'border-line opacity-80'}`}>
                <button onClick={() => setEdit({ ...p, startsAt: toLocal(p.startsAt), endsAt: toLocal(p.endsAt) })} className="w-[104px] flex-none sm:w-[128px]" aria-label="Tahrirlash">
                  <PromoCard promo={p} preview />
                </button>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-muted">{i + 1}-navbat · {TEMPLATES.find((t) => t[0] === p.template)?.[1]}</span>
                    <Switch on={p.active} disabled={busyId === p.id || (!p.active && activeCount >= MAX_ACTIVE)} onChange={() => toggle(p)} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm font-semibold text-ink">{p.title.replace(/\*/g, '')}</p>
                  {p.footer && <p className="line-clamp-1 text-xs text-muted">{p.footer.replace(/\*/g, '')}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className={`rounded-full px-2 py-0.5 font-medium ${cls}`}>{label}</span>
                    <span className="rounded-full bg-canvas px-2 py-0.5 text-muted">{p.frequency === 'once' ? 'Faqat bir marta' : 'Kuniga bir marta'}</span>
                    <span className="text-muted">Ko‘rildi {shown}{p.link ? ` · bosildi ${clicked}${shown ? ` (${Math.round((clicked / shown) * 100)}%)` : ''}` : ''}</span>
                  </div>
                  <div className="mt-auto flex flex-wrap gap-1 pt-2">
                    <IconBtn icon="ti-arrow-up" label="Yuqoriga" disabled={i === 0 || busyId === 'order'} onClick={() => move(i, -1)} />
                    <IconBtn icon="ti-arrow-down" label="Pastga" disabled={i === items.length - 1 || busyId === 'order'} onClick={() => move(i, 1)} />
                    <IconBtn icon="ti-pencil" label="Tahrirlash" onClick={() => setEdit({ ...p, startsAt: toLocal(p.startsAt), endsAt: toLocal(p.endsAt) })} />
                    <IconBtn icon="ti-copy" label="Nusxa" disabled={busyId === p.id} onClick={() => duplicate(p)} />
                    <IconBtn icon="ti-refresh" label="Bugun yana ko‘rsatish" disabled={busyId === p.id || !p.active} onClick={() => reshow(p)} />
                    <IconBtn icon="ti-trash" label="O‘chirish" danger disabled={busyId === p.id} onClick={() => remove(p)} />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {edit && <Editor initial={edit} activeCount={activeCount} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </div>
  );
}

const pick = (p) => ({ template: p.template, title: p.title, footer: p.footer, imageUrl: p.imageUrl, link: p.link, frequency: p.frequency, startsAt: p.startsAt || null, endsAt: p.endsAt || null });

function Switch({ on, onChange, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={onChange}
      className={`relative h-6 w-11 flex-none rounded-full transition-colors disabled:opacity-40 ${on ? 'bg-green-500' : 'bg-gray-300'}`}>
      <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  );
}
function IconBtn({ icon, label, onClick, disabled, danger }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} disabled={disabled}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border text-sm disabled:opacity-30 ${danger ? 'border-red-200 text-red-600' : 'border-line text-ink'}`}>
      <i className={`ti ${icon}`} />
    </button>
  );
}

/* ── Tahrirlovchi: chapda forma, o'ngda jonli ko'rinish (mobilda ko'rinish tepada) ── */
function Editor({ initial, activeCount, onClose, onSaved }) {
  const isNew = !initial.id;
  const [f, setF] = useState({ ...EMPTY, ...initial });
  const [linkMode, setLinkMode] = useState(() => (LINKS.some(([v]) => v === (initial.link || '')) ? (initial.link || '') : 'custom'));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const titleRef = useRef(null);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const titleLen = visibleLen(f.title);
  const footerLen = visibleLen(f.footer);
  const canActivate = f.active || initial.active || activeCount < MAX_ACTIVE;
  const invalid = titleLen < 3 || titleLen > LIMIT.title || footerLen > LIMIT.footer || (linkMode === 'custom' && !/^(\/(?!\/)\S*|https:\/\/\S+)$/.test(f.link));

  // Tanlangan so'zni *...* bilan o'rash (urg'u rangi)
  const accent = () => {
    const el = titleRef.current; if (!el) return;
    const { selectionStart: a, selectionEnd: b, value } = el;
    if (a === b) return;
    const next = `${value.slice(0, a)}*${value.slice(a, b).replace(/\*/g, '')}*${value.slice(b)}`;
    set('title')(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(b + 2, b + 2); });
  };

  const save = async () => {
    setBusy(true); setErr(null);
    const body = {
      ...pick(f),
      link: linkMode === 'custom' ? f.link.trim() : linkMode,
      active: Boolean(f.active),
      startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : null,
      endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : null,
    };
    try {
      if (isNew) await adminApi.createPromoModal(body); else await adminApi.updatePromoModal(initial.id, body);
      onSaved();
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[96dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-surface sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold text-ink">{isNew ? 'Yangi reklama oynasi' : 'Oynani tahrirlash'}</h2>
          <button onClick={onClose} aria-label="Yopish" className="text-muted"><i className="ti ti-x text-xl" /></button>
        </div>

        <div className="grid flex-1 gap-5 overflow-y-auto p-4 sm:grid-cols-[1fr_300px] sm:p-5">
          {/* Jonli ko'rinish */}
          <div className="order-first sm:order-last">
            <div className="sm:sticky sm:top-0">
              <div className="mx-auto w-[220px] sm:w-full">
                <PromoCard promo={{ ...f, link: linkMode === 'custom' ? f.link : linkMode, title: f.title || 'Sarlavha shu yerda chiqadi', imageUrl: f.imageUrl }} preview />
              </div>
              <p className="mt-2 text-center text-[11px] text-muted">Mijoz aynan shunday ko‘radi. Matn uzun bo‘lsa, shrift o‘zi kichrayib, kartaga sig‘adi.</p>
            </div>
          </div>

          <div className="space-y-4">
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-ink">Dizayn</legend>
              <div className="grid grid-cols-3 gap-2">
                {TEMPLATES.map(([k, l, d]) => (
                  <button key={k} type="button" onClick={() => set('template')(k)} title={d}
                    className={`rounded-xl border p-1.5 text-left transition ${f.template === k ? 'border-brand-400 ring-2 ring-brand-400/40' : 'border-line'}`}>
                    <div className="pointer-events-none mx-auto w-[64px]"><PromoCard promo={{ template: k, title: 'Aa *Bb*', footer: 'Cc', imageUrl: f.imageUrl }} preview /></div>
                    <div className="mt-1 text-center text-xs font-medium text-ink">{l}</div>
                  </button>
                ))}
              </div>
            </fieldset>

            <ImageUpload value={f.imageUrl} onChange={set('imageUrl')} folder="banners" label="Rasm (shaffof PNG eng chiroyli chiqadi)" aspect="1/1" />

            <label className="block">
              <span className="mb-1 flex items-center justify-between text-sm font-medium text-ink">
                Sarlavha
                <span className={`text-xs ${titleLen > LIMIT.title ? 'text-red-600' : 'text-muted'}`}>{titleLen}/{LIMIT.title}</span>
              </span>
              <textarea ref={titleRef} rows={3} className="inp resize-none" value={f.title} onChange={(e) => set('title')(e.target.value)}
                placeholder="100 000 so‘mlik taom buyurtma qiling 1 litr *Coca-Cola Bonus!*" />
              <span className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted">
                <span>*yulduzcha* ichidagi so‘zlar urg‘u rangida chiqadi (ko‘pi bilan 2 ta).</span>
                <button type="button" onClick={accent} className="flex-none rounded-lg border border-line px-2 py-1 text-[11px] font-medium text-ink">Belgilanganni ajratish</button>
              </span>
            </label>

            <label className="block">
              <span className="mb-1 flex items-center justify-between text-sm font-medium text-ink">
                <span>Pastki yozuv <span className="font-normal text-muted">(ixtiyoriy)</span></span>
                <span className={`text-xs ${footerLen > LIMIT.footer ? 'text-red-600' : 'text-muted'}`}>{footerLen}/{LIMIT.footer}</span>
              </span>
              <input className="inp" value={f.footer} onChange={(e) => set('footer')(e.target.value)} placeholder="*LokmaGo* bilan buyurtma qiling — sovg‘a oling!" />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink">Pastki yozuv bosilganda</span>
              <select className="inp" value={linkMode} onChange={(e) => { setLinkMode(e.target.value); if (e.target.value !== 'custom') set('link')(e.target.value); }}>
                {LINKS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              {linkMode === 'custom' && (
                <input className="inp mt-2" value={f.link} onChange={(e) => set('link')(e.target.value)} placeholder="/restaurant/… yoki https://…" />
              )}
            </label>

            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-ink">Har bir mijozga</legend>
              <div className="grid grid-cols-2 gap-1 rounded-xl border border-line p-1">
                {[['daily', 'Kuniga bir marta'], ['once', 'Faqat bir marta']].map(([v, l]) => (
                  <button key={v} type="button" onClick={() => set('frequency')(v)} className={`rounded-lg py-2 text-sm font-medium ${f.frequency === v ? 'bg-brand-400 text-brand-text' : 'text-muted'}`}>{l}</button>
                ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-2 gap-2">
              <label className="block"><span className="mb-1 block text-sm font-medium text-ink">Boshlanish</span><input type="datetime-local" className="inp" value={f.startsAt} onChange={(e) => set('startsAt')(e.target.value)} /></label>
              <label className="block"><span className="mb-1 block text-sm font-medium text-ink">Tugash</span><input type="datetime-local" className="inp" value={f.endsAt} onChange={(e) => set('endsAt')(e.target.value)} /></label>
            </div>
            <p className="-mt-2 text-[11px] text-muted">Bo‘sh qoldirsangiz — yoqilgan paytdan to o‘chirilguncha.</p>

            <div className="flex items-center justify-between gap-3 rounded-xl bg-canvas px-3 py-3">
              <div>
                <div className="text-sm font-medium text-ink">Barcha mijozlarga ko‘rsatish</div>
                <div className="text-[11px] text-muted">{canActivate ? 'O‘chirib saqlasangiz — qoralama bo‘lib qoladi' : `Allaqachon ${MAX_ACTIVE} ta oyna yoqilgan`}</div>
              </div>
              <Switch on={f.active} disabled={!canActivate} onChange={() => set('active')(!f.active)} />
            </div>
            {err && <div className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{err}</div>}
          </div>
        </div>

        <div className="flex gap-2 border-t border-line px-4 py-3 sm:px-5">
          <button onClick={onClose} className="rounded-xl border border-line px-4 py-2.5 text-sm text-muted">Bekor qilish</button>
          <button onClick={save} disabled={busy || invalid} className="flex-1 rounded-xl bg-brand-400 py-2.5 text-sm font-semibold text-brand-text disabled:opacity-40">
            {busy ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>
      </div>
    </div>
  );
}
