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
  ['image', 'Faqat rasm', "Matnsiz: rasm butun oynani chetdan-chetgacha qoplaydi"],
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
                  <p className="mt-1 line-clamp-2 text-sm font-semibold text-ink">{p.template === 'image' ? (p.title ? p.title.replace(/\*/g, '') : 'Faqat rasm') : p.title.replace(/\*/g, '')}</p>
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

/*
 * ── Tahrirlovchi ──
 * TELEFONDA: butun ekran, 3 qadam (1 Dizayn · 2 Matn · 3 Sozlama), pastda "Keyingi"; tepada "Ko'rish" —
 * mijoz ko'radigan oyna to'liq ekranda. Har qadamda kam narsa, hech narsa yon tomonga chiqib ketmaydi.
 * KOMPYUTERDA: chapda forma (hamma qadam ketma-ket), o'ngda jonli ko'rinish.
 * Yon tomonga siljib ketmaslik uchun: grid ustuni minmax(0,1fr), har maydon min-w-0, sana maydonlari
 * to'liq kenglikda (iOS ularga katta o'z kengligini beradi), forma 16px shriftda (iPhone yaqinlashtirmasin).
 */
const STEPS = [['design', 'Dizayn'], ['text', 'Matn'], ['setup', 'Sozlama']];
const FIELD = 'inp !w-full min-w-0 max-w-full !text-base sm:!text-sm';

function Editor({ initial, activeCount, onClose, onSaved }) {
  const isNew = !initial.id;
  const [f, setF] = useState({ ...EMPTY, ...initial });
  const [linkMode, setLinkMode] = useState(() => (LINKS.some(([v]) => v === (initial.link || '')) ? (initial.link || '') : 'custom'));
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const titleRef = useRef(null);
  const bodyRef = useRef(null);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const imageOnly = f.template === 'image';
  const titleLen = visibleLen(f.title);
  const footerLen = visibleLen(f.footer);
  const canActivate = f.active || initial.active || activeCount < MAX_ACTIVE;
  const link = linkMode === 'custom' ? f.link.trim() : linkMode;
  const linkBad = linkMode === 'custom' && !/^(\/(?!\/)\S*|https:\/\/\S+)$/.test(f.link);

  // Har qadam uchun nima yetishmayapti (foydalanuvchiga tushunarli matn)
  const problems = {
    design: imageOnly && !f.imageUrl ? '“Faqat rasm” uchun rasm yuklang' : null,
    text: !imageOnly && titleLen < 3 ? 'Sarlavhani yozing (kamida 3 belgi)'
      : titleLen > LIMIT.title ? `Sarlavha ${LIMIT.title} belgidan oshmasin`
      : footerLen > LIMIT.footer ? `Pastki yozuv ${LIMIT.footer} belgidan oshmasin`
      : linkBad ? 'Havola noto‘g‘ri: /market kabi yo‘l yoki https:// manzil yozing' : null,
    setup: null,
  };
  const firstBad = STEPS.findIndex(([k]) => problems[k]);
  const stepLabel = (k) => (k === 'text' && imageOnly ? 'Havola' : STEPS.find((x) => x[0] === k)[1]);

  const go = (n) => { setErr(null); setStep(n); requestAnimationFrame(() => bodyRef.current?.scrollTo({ top: 0 })); };
  const next = () => {
    const k = STEPS[step][0];
    if (problems[k]) { setErr(problems[k]); return; }
    go(Math.min(2, step + 1));
  };

  // Tanlangan so'zni *...* bilan o'rash (urg'u rangi)
  const accent = () => {
    const el = titleRef.current; if (!el) return;
    const { selectionStart: a, selectionEnd: b, value } = el;
    if (a === b) { setErr('Avval sarlavhadagi so‘zni belgilang, keyin tugmani bosing'); return; }
    setErr(null);
    set('title')(`${value.slice(0, a)}*${value.slice(a, b).replace(/\*/g, '')}*${value.slice(b)}`);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(b + 2, b + 2); });
  };

  const save = async () => {
    if (firstBad >= 0) { go(firstBad); setErr(problems[STEPS[firstBad][0]]); return; }
    setBusy(true); setErr(null);
    const body = {
      ...pick(f), link, active: Boolean(f.active),
      startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : null,
      endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : null,
    };
    try {
      if (isNew) await adminApi.createPromoModal(body); else await adminApi.updatePromoModal(initial.id, body);
      onSaved();
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  const showStep = (n) => (step === n ? 'block' : 'hidden sm:block');
  const last = step === 2;
  const previewPromo = { ...f, link, title: f.title || (imageOnly ? '' : 'Sarlavha shu yerda chiqadi') };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="flex h-[100dvh] w-full min-w-0 max-w-4xl flex-col overflow-hidden bg-surface sm:h-auto sm:max-h-[92vh] sm:rounded-3xl">
        {/* Sarlavha */}
        <div className="flex flex-none items-center gap-2 border-b border-line px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5">
          <button onClick={onClose} aria-label="Yopish" className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-ink active:bg-canvas sm:hidden"><i className="ti ti-arrow-left text-xl" /></button>
          <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-ink">{isNew ? 'Yangi reklama oynasi' : 'Oynani tahrirlash'}</h2>
          <button onClick={() => setPreview(true)} className="flex h-10 flex-none items-center gap-1.5 rounded-full bg-canvas px-3.5 text-sm font-medium text-ink active:opacity-70 sm:hidden"><i className="ti ti-eye" /> Ko‘rish</button>
          <button onClick={onClose} aria-label="Yopish" className="hidden text-muted sm:block"><i className="ti ti-x text-xl" /></button>
        </div>

        {/* Qadamlar (faqat telefonda) */}
        <div className="flex flex-none gap-1.5 border-b border-line px-3 py-2.5 sm:hidden" role="tablist">
          {STEPS.map(([k], i) => {
            const on = step === i; const bad = problems[k] && i < step;
            return (
              <button key={k} role="tab" aria-selected={on} onClick={() => go(i)}
                className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold ${on ? 'bg-brand-400 text-brand-text' : 'bg-canvas text-muted'}`}>
                <span className={`flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] ${on ? 'bg-white/70 text-ink' : bad ? 'bg-red-500 text-white' : i < step ? 'bg-green-500 text-white' : 'bg-white text-muted'}`}>{bad ? '!' : i < step ? '✓' : i + 1}</span>
                <span className="truncate">{stepLabel(k)}</span>
              </button>
            );
          })}
        </div>

        {/* Tarkib */}
        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-4 sm:p-5">
          <div className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1fr)_300px]">
            {/* Jonli ko'rinish: kompyuterda o'ngda; telefonda 1-qadamda katta, 2-qadamda kichik */}
            <div className={`min-w-0 sm:order-last ${step === 2 ? 'hidden sm:block' : ''}`}>
              <div className="sm:sticky sm:top-0">
                <div className={`mx-auto sm:w-full ${step === 0 ? 'w-[min(40vw,150px)]' : 'w-[120px]'}`}>
                  <PromoCard promo={previewPromo} preview />
                </div>
                <p className="mt-2 text-center text-[11px] leading-snug text-muted">Mijoz aynan shunday ko‘radi.{!imageOnly && ' Matn uzun bo‘lsa, shrift o‘zi kichrayadi.'}</p>
              </div>
            </div>

            <div className="min-w-0 space-y-5">
              {/* 1. DIZAYN */}
              <div className={`min-w-0 space-y-5 ${showStep(0)}`}>
                <fieldset className="min-w-0">
                  <legend className="mb-2 text-sm font-semibold text-ink">1. Dizaynni tanlang</legend>
                  <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5">
                    {TEMPLATES.map(([k, l, d]) => (
                      <button key={k} type="button" onClick={() => set('template')(k)} aria-pressed={f.template === k}
                        className={`min-w-0 rounded-2xl border p-1.5 text-left transition active:scale-[0.98] sm:p-2 ${f.template === k ? 'border-brand-400 bg-brand-400/10 ring-2 ring-brand-400/50' : 'border-line'}`}>
                        <div className="pointer-events-none mx-auto w-full max-w-[64px]"><PromoCard promo={{ template: k, title: 'Aa *Bb*', footer: 'Cc', imageUrl: f.imageUrl }} preview /></div>
                        <div className="mt-1.5 text-center text-xs font-semibold leading-tight text-ink sm:text-sm">{l}</div>
                        <div className="hidden text-center text-[11px] leading-tight text-muted sm:block">{d}</div>
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="min-w-0">
                  <ImageUpload
                    key={imageOnly ? 'cover' : 'art'}
                    value={f.imageUrl}
                    onChange={set('imageUrl')}
                    folder="banners"
                    label={imageOnly ? 'Rasm — butun oynani qoplaydi' : 'Rasm (shaffof PNG eng chiroyli chiqadi)'}
                    aspect={imageOnly ? '2/3' : '1/1'}
                  />
                  <p className="mt-1.5 text-[11px] leading-snug text-muted">
                    {imageOnly ? 'Tavsiya: 2:3 nisbat (masalan 1080×1620). Boshqacha bo‘lsa chetlari kesiladi. Matn va ramka ko‘rsatilmaydi — yozuvlarni rasmning o‘ziga joylang.' : 'Rasm bo‘sh bo‘lsa, idish belgisi ko‘rinadi.'}
                  </p>
                </div>
              </div>

              {/* 2. MATN */}
              <div className={`min-w-0 space-y-5 ${showStep(1)}`}>
                {!imageOnly && (
                  <>
                    <label className="block min-w-0">
                      <span className="mb-1.5 flex items-center justify-between gap-2 text-sm font-semibold text-ink">
                        2. Sarlavha
                        <span className={`text-xs font-normal ${titleLen > LIMIT.title ? 'text-red-600' : 'text-muted'}`}>{titleLen}/{LIMIT.title}</span>
                      </span>
                      <textarea ref={titleRef} rows={3} className={`${FIELD} resize-none`} value={f.title} onChange={(e) => set('title')(e.target.value)}
                        placeholder={'100 000 so‘mlik\ntaom buyurtma qiling\n1 litr *Coca-Cola Bonus!*'} />
                      <span className="mt-2 block text-xs leading-snug text-muted">
                        Yangi qator uchun Enter bosing. Rangli so‘z: uni belgilang va quyidagi tugmani bosing.
                      </span>
                      <button type="button" onClick={accent} className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-white text-sm font-semibold text-ink active:bg-canvas">
                        <i className="ti ti-brush" /> Belgilangan so‘zni rangli qilish
                      </button>
                    </label>

                    <label className="block min-w-0">
                      <span className="mb-1.5 flex items-center justify-between gap-2 text-sm font-semibold text-ink">
                        <span>Pastki yozuv <span className="font-normal text-muted">(ixtiyoriy)</span></span>
                        <span className={`text-xs font-normal ${footerLen > LIMIT.footer ? 'text-red-600' : 'text-muted'}`}>{footerLen}/{LIMIT.footer}</span>
                      </span>
                      <input className={FIELD} value={f.footer} onChange={(e) => set('footer')(e.target.value)} placeholder="*LokmaGo* bilan buyurtma qiling — sovg‘a oling!" />
                    </label>
                  </>
                )}

                <label className="block min-w-0">
                  <span className="mb-1.5 block text-sm font-semibold text-ink">{imageOnly ? 'Rasm bosilganda nima bo‘lsin?' : 'Pastki yozuv bosilganda nima bo‘lsin?'}</span>
                  <select className={FIELD} value={linkMode} onChange={(e) => { setLinkMode(e.target.value); if (e.target.value !== 'custom') set('link')(e.target.value); }}>
                    {LINKS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  {linkMode === 'custom' && (
                    <input className={`${FIELD} mt-2 ${linkBad ? '!border-red-400' : ''}`} value={f.link} onChange={(e) => set('link')(e.target.value)} placeholder="/restaurant/… yoki https://…" inputMode="url" autoCapitalize="none" autoCorrect="off" />
                  )}
                </label>
              </div>

              {/* 3. SOZLAMA */}
              <div className={`min-w-0 space-y-5 ${showStep(2)}`}>
                <fieldset className="min-w-0">
                  <legend className="mb-2 text-sm font-semibold text-ink">3. Har bir mijozga necha marta?</legend>
                  <div className="grid grid-cols-2 gap-1 rounded-xl border border-line p-1">
                    {[['daily', 'Kuniga bir marta'], ['once', 'Faqat bir marta']].map(([v, l]) => (
                      <button key={v} type="button" onClick={() => set('frequency')(v)} aria-pressed={f.frequency === v}
                        className={`min-w-0 rounded-lg px-1 py-3 text-sm font-semibold ${f.frequency === v ? 'bg-brand-400 text-brand-text' : 'text-muted'}`}>{l}</button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="min-w-0">
                  <legend className="mb-2 text-sm font-semibold text-ink">Qachon ko‘rsatilsin? <span className="font-normal text-muted">(ixtiyoriy)</span></legend>
                  <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block min-w-0"><span className="mb-1 block text-xs text-muted">Boshlanishi</span><input type="datetime-local" className={FIELD} value={f.startsAt} onChange={(e) => set('startsAt')(e.target.value)} /></label>
                    <label className="block min-w-0"><span className="mb-1 block text-xs text-muted">Tugashi</span><input type="datetime-local" className={FIELD} value={f.endsAt} onChange={(e) => set('endsAt')(e.target.value)} /></label>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-snug text-muted">Bo‘sh qoldirsangiz — yoqilgan paytdan to o‘chirilguncha ko‘rsatiladi.</p>
                </fieldset>

                <div className="flex items-center justify-between gap-3 rounded-2xl bg-canvas px-4 py-3.5">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-ink">Mijozlarga ko‘rsatish</div>
                    <div className="text-xs leading-snug text-muted">{canActivate ? (f.active ? 'Saqlangach darhol hamma mijozga chiqadi' : 'O‘chiq: qoralama bo‘lib saqlanadi') : `Allaqachon ${MAX_ACTIVE} ta oyna yoqilgan`}</div>
                  </div>
                  <Switch on={f.active} disabled={!canActivate} onChange={() => set('active')(!f.active)} />
                </div>
              </div>

              {err && <div role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm leading-snug text-red-700">{err}</div>}
            </div>
          </div>
        </div>

        {/* Tugmalar */}
        <div className="flex flex-none gap-2 border-t border-line bg-surface px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
          {step > 0
            ? <button onClick={() => go(step - 1)} className="h-12 flex-none rounded-xl border border-line px-5 text-sm font-semibold text-ink sm:hidden">Orqaga</button>
            : <button onClick={onClose} className="h-12 flex-none rounded-xl border border-line px-5 text-sm font-semibold text-muted sm:hidden">Bekor</button>}
          <button onClick={onClose} className="hidden h-12 flex-none rounded-xl border border-line px-5 text-sm font-semibold text-muted sm:block">Bekor qilish</button>
          {/* Telefonda: oxirgi qadamda (yoki mavjud oynani tahrirlayotganda har qadamda) — Saqlash; aks holda Keyingi */}
          {!last && isNew ? (
            <button onClick={next} className="h-12 min-w-0 flex-1 rounded-xl bg-brand-400 text-sm font-semibold text-brand-text active:opacity-80 sm:hidden">Keyingi <i className="ti ti-arrow-right" /></button>
          ) : null}
          <button onClick={save} disabled={busy}
            className={`h-12 min-w-0 flex-1 rounded-xl bg-brand-400 text-sm font-semibold text-brand-text active:opacity-80 disabled:opacity-40 ${!last && isNew ? 'hidden sm:block' : ''}`}>
            {busy ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>
      </div>

      {/* To'liq ekran ko'rinish (telefon) */}
      {preview && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-black/75 p-5" role="dialog" aria-label="Ko‘rinish" onClick={() => setPreview(false)}>
          <div className="w-[min(82vw,360px)]" style={{ maxHeight: 'calc(100dvh - 120px)' }}><PromoCard promo={previewPromo} preview /></div>
          <button className="h-11 rounded-full bg-white/15 px-6 text-sm font-semibold text-white">Yopish</button>
        </div>
      )}
    </div>
  );
}
