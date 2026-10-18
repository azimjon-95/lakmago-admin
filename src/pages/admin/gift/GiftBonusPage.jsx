import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi } from '@/api';
import { ImageUpload } from '@/components/ImageUpload';
import { confirm } from '@/components/ui/confirm';

/*
 * ═══ LOKMAGO SOVG'A-BONUSI — ADMIN BOSHQARUVI ═══
 * Buyurtma summasi shartdan oshsa, mijozga taomga QO'SHIB sovg'a beriladi (masalan 100 000 so'mdan 1 l Coca-Cola).
 * Sovg'ani RESTORAN bepul beradi; uning puli buyurtma yetkazilgach LokmaGo hisobidan restoranga QOPLANADI.
 * Bu sahifada: qoida yaratish/tahrirlash, yoqish/o'chirish, kimlarga va qachon, limit va byudjet, statistika.
 */
const MAX_ACTIVE = 5;
const KINDS = [['restaurant', 'Restoran'], ['choyxona', 'Choyxona'], ['cafe', 'Kafe'], ['fastfood', 'Fast food'], ['club', 'Klub'], ['shop', 'Do‘kon']];
const FOOD = ['restaurant', 'choyxona', 'cafe', 'fastfood', 'club'];
const PAYS = [['cash', 'Naqd'], ['click', 'Click'], ['payme', 'Payme'], ['paynet', 'Paynet'], ['uzum', 'Uzum']];
const DAYS = [[1, 'Du'], [2, 'Se'], [3, 'Ch'], [4, 'Pa'], [5, 'Ju'], [6, 'Sh'], [0, 'Ya']];
const AMOUNT_CHIPS = [50_000, 100_000, 150_000, 200_000, 300_000];
const STEPS = [['gift', 'Sovg‘a'], ['cond', 'Shart'], ['when', 'Cheklov']];
const FIELD = 'inp !w-full min-w-0 max-w-full !text-base sm:!text-sm';

const EMPTY = {
  name: '', itemName: '', imageUrl: '', quantity: 1, reimburse: 0, minAmount: 100_000, maxAmount: 0, basis: 'menu',
  active: false, scope: 'all', restaurantIds: [], kinds: [...FOOD], fulfillments: ['delivery', 'pickup'], paymentMethods: [],
  startsAt: '', endsAt: '', weekdays: [], hourFrom: '', hourTo: '',
  perCustomerPerDay: 0, perCustomerTotal: 0, dailyLimit: 0, totalLimit: 0, budget: 0,
};

const som = (n) => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/\u00a0/g, ' ');
const digits = (s) => String(s ?? '').replace(/\D/g, '');
const spaced = (s) => digits(s).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const toLocal = (d) => (d ? new Date(new Date(d).getTime() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '');
const num = (v) => Number(digits(v)) || 0;

/** Qoida — bitta tushunarli jumlada (admin nima yozganini aniq ko'rsin) */
export function describe(r) {
  const amount = r.basis === 'paid' ? 'chegirmalardan keyin taomlar summasi' : 'taomlar narxi';
  const range = r.maxAmount > 0 ? `${som(r.minAmount)} dan ${som(r.maxAmount)} so‘mgacha` : `${som(r.minAmount)} so‘mdan oshgan`;
  const who = r.scope === 'include' ? `${r.restaurantIds.length} ta tanlangan restoranda` : r.scope === 'exclude' ? `${r.restaurantIds.length} ta restorandan tashqari barcha joyda` : 'barcha restoranlarda';
  const pay = r.reimburse > 0
    ? `LokmaGo restoranga har bir dona uchun ${som(r.reimburse)} so‘m to‘laydi.`
    : 'Restoranga qoplash belgilanmagan (0 so‘m) — restoran o‘z hisobidan beradi.';
  const text = `${who} ${amount} ${range} buyurtmaga ${r.quantity} × ${r.itemName || 'sovg‘a'} bepul qo‘shiladi. ${pay}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function statusOf(r) {
  if (!r.active) return ['O‘chirilgan', 'bg-gray-100 text-gray-600'];
  if (r.live) return ['Mijozlarga ko‘rinmoqda', 'bg-green-50 text-green-700'];
  if (r.startsAt && new Date(r.startsAt) > new Date()) return ['Boshlanishi kutilmoqda', 'bg-amber-50 text-amber-700'];
  if (r.endsAt && new Date(r.endsAt) <= new Date()) return ['Muddati tugagan', 'bg-red-50 text-red-600'];
  return ['Hozir vaqti emas', 'bg-amber-50 text-amber-700']; // hafta kuni / soat oynasidan tashqari
}

export function GiftBonusPage() {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState(null);
  const [edit, setEdit] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setErr(null);
    try { setItems(await adminApi.getGiftBonuses()); } catch (e) { setErr(e.message); setItems((p) => p ?? []); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const activeCount = (items || []).filter((p) => p.active).length;

  const act = async (id, fn) => { setBusyId(id); setErr(null); try { await fn(); await load(); } catch (e) { setErr(e.message); } finally { setBusyId(null); } };
  const toggle = (r) => act(r.id, () => adminApi.updateGiftBonus(r.id, { active: !r.active }));
  const duplicate = (r) => act(r.id, () => adminApi.createGiftBonus({ ...pick(r), name: `${r.name} (nusxa)`, active: false }));
  const remove = async (r) => {
    if (!await confirm({ title: 'Bonus o‘chirilsinmi?', content: 'Hali hech bir buyurtmada ishlatilmagan bo‘lsa o‘chiriladi. Ishlatilgan bo‘lsa — uni shunchaki o‘chirib qo‘ying.', okText: 'O‘chirish', tone: 'danger' })) return;
    act(r.id, () => adminApi.deleteGiftBonus(r.id));
  };

  return (
    <div className="min-w-0 flex-1 p-3 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-ink">Sovg‘a-bonuslar</h1>
          <p className="mt-0.5 max-w-xl text-sm text-muted">Buyurtma summasi shartdan oshsa, taomga <b>qo‘shib bepul sovg‘a</b> beriladi (masalan 100 000 so‘mdan 1 l Coca-Cola). Sovg‘ani restoran beradi, puli esa <b>LokmaGo hisobidan restoranga qoplanadi</b>.</p>
        </div>
        <button onClick={() => setEdit({ ...EMPTY })} className="flex-none rounded-xl bg-brand-400 px-4 py-2.5 text-sm font-semibold text-brand-text active:opacity-80"><i className="ti ti-plus" /> Yangi bonus</button>
      </div>

      {err && <div role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{err}</div>}
      {activeCount >= MAX_ACTIVE && <div className="mb-3 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">Bir vaqtda ko‘pi bilan {MAX_ACTIVE} ta bonus yoqilishi mumkin.</div>}

      {items === null ? (
        <div className="grid gap-3">{[0, 1].map((i) => <div key={i} className="h-44 animate-pulse rounded-2xl bg-canvas" />)}</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-6 py-12 text-center">
          <div className="text-4xl">🎁</div>
          <p className="mt-2 text-sm text-muted">Hali bonus yo‘q. Birinchisini yarating — masalan “100 000 so‘mdan 1 l Coca-Cola”.</p>
          <button onClick={() => setEdit({ ...EMPTY })} className="mt-4 rounded-xl bg-brand-400 px-4 py-2.5 text-sm font-semibold text-brand-text">Yangi bonus</button>
        </div>
      ) : (
        <ul className="grid gap-3">
          {items.map((r) => <RuleCard key={r.id} r={r} busy={busyId === r.id} canOn={r.active || activeCount < MAX_ACTIVE} onToggle={() => toggle(r)} onEdit={() => setEdit(toForm(r))} onCopy={() => duplicate(r)} onDelete={() => remove(r)} />)}
        </ul>
      )}
      {edit && <Editor initial={edit} activeCount={activeCount} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </div>
  );
}

const pick = (r) => ({
  name: r.name, itemName: r.itemName, imageUrl: r.imageUrl || '', quantity: r.quantity, reimburse: r.reimburse, minAmount: r.minAmount, maxAmount: r.maxAmount, basis: r.basis,
  scope: r.scope, restaurantIds: r.restaurantIds || [], kinds: r.kinds, fulfillments: r.fulfillments, paymentMethods: r.paymentMethods || [],
  startsAt: r.startsAt || null, endsAt: r.endsAt || null, weekdays: r.weekdays || [], hourFrom: r.hourFrom ?? null, hourTo: r.hourTo ?? null,
  perCustomerPerDay: r.perCustomerPerDay, perCustomerTotal: r.perCustomerTotal, dailyLimit: r.dailyLimit, totalLimit: r.totalLimit, budget: r.budget,
});
const toForm = (r) => ({ ...EMPTY, ...r, startsAt: toLocal(r.startsAt), endsAt: toLocal(r.endsAt), hourFrom: r.hourFrom ?? '', hourTo: r.hourTo ?? '' });

function RuleCard({ r, busy, canOn, onToggle, onEdit, onCopy, onDelete }) {
  const [label, cls] = statusOf(r);
  const s = r.stats;
  const spent = s.compensated + s.pending;
  const pct = r.budget > 0 ? Math.min(100, Math.round((spent / r.budget) * 100)) : 0;
  return (
    <li className={`rounded-2xl border border-line bg-surface p-3.5 sm:p-4 ${r.active ? '' : 'opacity-85'}`}>
      <div className="flex items-start gap-3">
        <button onClick={onEdit} className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-2xl bg-amber-50 text-3xl" aria-label="Tahrirlash">
          {r.imageUrl ? <img src={r.imageUrl} alt="" className="h-full w-full object-contain" /> : '🎁'}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate font-semibold text-ink">{r.name}</div>
              <div className="truncate text-sm text-muted">{r.quantity} × {r.itemName}</div>
            </div>
            <Switch on={r.active} disabled={busy || !canOn} onChange={onToggle} />
          </div>
          <span className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{label}</span>
        </div>
      </div>

      <p className="mt-3 rounded-xl bg-canvas px-3 py-2.5 text-[13px] leading-snug text-ink">{describe(r)}</p>

      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat k="Berildi" v={`${s.given} ta`} />
        <Stat k="Yetkazildi" v={`${s.delivered} ta`} />
        <Stat k="Restoranlarga to‘langan" v={`${som(s.compensated)} so‘m`} tone="green" />
        <Stat k="Yo‘lda (yetkazilsa qoplanadi)" v={`${som(s.pending)} so‘m`} tone="amber" />
      </dl>

      {r.budget > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[11px] text-muted"><span>Byudjet</span><span>{som(spent)} / {som(r.budget)} so‘m ({pct}%)</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-canvas"><div className={`h-full rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} /></div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        <IconBtn icon="ti-pencil" label="Tahrirlash" onClick={onEdit} />
        <IconBtn icon="ti-copy" label="Nusxa" onClick={onCopy} disabled={busy} />
        <IconBtn icon="ti-trash" label="O‘chirish" onClick={onDelete} disabled={busy} danger />
      </div>
    </li>
  );
}

const Stat = ({ k, v, tone }) => (
  <div className="min-w-0 rounded-xl border border-line px-2.5 py-2">
    <dt className="truncate text-[10px] leading-tight text-muted">{k}</dt>
    <dd className={`truncate text-sm font-semibold tabular-nums ${tone === 'green' ? 'text-green-700' : tone === 'amber' ? 'text-amber-700' : 'text-ink'}`}>{v}</dd>
  </div>
);
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
    <button type="button" onClick={onClick} disabled={disabled} className={`flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm disabled:opacity-30 ${danger ? 'border-red-200 text-red-600' : 'border-line text-ink'}`}>
      <i className={`ti ${icon}`} /> {label}
    </button>
  );
}
const Chip = ({ on, onClick, children, tone = 'brand' }) => (
  <button type="button" aria-pressed={on} onClick={onClick}
    className={`min-h-[40px] rounded-full border px-3.5 py-1.5 text-sm font-medium ${on ? (tone === 'green' ? 'border-green-500 bg-green-50 text-green-700' : 'border-brand-400 bg-brand-400/15 text-ink') : 'border-line text-muted'}`}>{children}</button>
);
const Label = ({ children, hint }) => (
  <div className="mb-1.5"><div className="text-sm font-semibold text-ink">{children}</div>{hint && <div className="text-xs leading-snug text-muted">{hint}</div>}</div>
);

/*
 * ── Tahrirlovchi ──
 * Telefonda: butun ekran, 3 qadam (Sovg'a · Shart · Cheklov), "Keyingi"; tepada qoida jumlasi har doim ko'rinadi.
 * Kompyuterda: hamma qadam bir sahifada.
 */
function Editor({ initial, activeCount, onClose, onSaved }) {
  const isNew = !initial.id;
  const [f, setF] = useState(initial);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [rests, setRests] = useState(null);
  const [q, setQ] = useState('');
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const toggleIn = (k, v) => setF((s) => ({ ...s, [k]: s[k].includes(v) ? s[k].filter((x) => x !== v) : [...s[k], v] }));

  useEffect(() => { if (f.scope !== 'all' && !rests) adminApi.getRestaurants().then((r) => setRests(Array.isArray(r) ? r : (r.restaurants || []))).catch(() => setRests([])); }, [f.scope, rests]);

  const rule = useMemo(() => ({ ...f, minAmount: Number(f.minAmount) || 0, maxAmount: Number(f.maxAmount) || 0, reimburse: Number(f.reimburse) || 0, quantity: Number(f.quantity) || 1 }), [f]);
  const canActivate = f.active || initial.active || activeCount < MAX_ACTIVE;
  const maxBad = rule.maxAmount > 0 && rule.maxAmount <= rule.minAmount;
  const hourBad = (f.hourFrom === '') !== (f.hourTo === '') || (f.hourFrom !== '' && Number(f.hourFrom) === Number(f.hourTo));
  const problems = {
    gift: f.name.trim().length < 2 ? 'Bonus nomini yozing' : f.itemName.trim().length < 2 ? 'Sovg‘a nomini yozing (masalan: 1 l Coca-Cola)' : null,
    cond: maxBad ? 'Yuqori chegara pastki chegaradan katta bo‘lsin'
      : f.scope !== 'all' && !f.restaurantIds.length ? 'Restoranlarni tanlang yoki “Hammasi”ni tanlang'
      : !f.kinds.length ? 'Kamida bitta muassasa turini tanlang' : !f.fulfillments.length ? 'Yetkazish yoki olib ketishdan kamida bittasini tanlang' : null,
    when: hourBad ? 'Vaqt oynasida ikkala soatni kiriting (va ular bir xil bo‘lmasin)' : null,
  };
  const firstBad = STEPS.findIndex(([k]) => problems[k]);
  const go = (n) => { setErr(null); setStep(n); };
  const next = () => { const k = STEPS[step][0]; if (problems[k]) { setErr(problems[k]); return; } go(Math.min(2, step + 1)); };
  const last = step === 2;
  const show = (n) => (step === n ? 'block' : 'hidden sm:block');

  const save = async () => {
    if (firstBad >= 0) { go(firstBad); setErr(problems[STEPS[firstBad][0]]); return; }
    setBusy(true); setErr(null);
    const body = {
      ...pick(f), quantity: rule.quantity, reimburse: rule.reimburse, minAmount: rule.minAmount, maxAmount: rule.maxAmount,
      name: f.name.trim(), itemName: f.itemName.trim(), active: Boolean(f.active),
      startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : null, endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : null,
      hourFrom: f.hourFrom === '' ? null : Number(f.hourFrom), hourTo: f.hourTo === '' ? null : Number(f.hourTo),
    };
    try { if (isNew) await adminApi.createGiftBonus(body); else await adminApi.updateGiftBonus(initial.id, body); onSaved(); } catch (e) { setErr(e.message); setBusy(false); }
  };

  const list = (rests || []).filter((x) => !q || (x.name || '').toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="flex h-[100dvh] w-full min-w-0 max-w-2xl flex-col overflow-hidden bg-surface sm:h-auto sm:max-h-[92vh] sm:rounded-3xl">
        <div className="flex flex-none items-center gap-2 border-b border-line px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5">
          <button onClick={onClose} aria-label="Orqaga" className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-ink active:bg-canvas sm:hidden"><i className="ti ti-arrow-left text-xl" /></button>
          <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-ink">{isNew ? 'Yangi sovg‘a-bonus' : 'Bonusni tahrirlash'}</h2>
          <button onClick={onClose} aria-label="Yopish" className="hidden text-muted sm:block"><i className="ti ti-x text-xl" /></button>
        </div>

        <div className="flex flex-none gap-1.5 border-b border-line px-3 py-2.5 sm:hidden" role="tablist">
          {STEPS.map(([k, l], i) => {
            const on = step === i; const bad = problems[k] && i < step;
            return (
              <button key={k} role="tab" aria-selected={on} onClick={() => go(i)} className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold ${on ? 'bg-brand-400 text-brand-text' : 'bg-canvas text-muted'}`}>
                <span className={`flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] ${on ? 'bg-white/70 text-ink' : bad ? 'bg-red-500 text-white' : i < step ? 'bg-green-500 text-white' : 'bg-white text-muted'}`}>{bad ? '!' : i < step ? '✓' : i + 1}</span>
                <span className="truncate">{l}</span>
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden overscroll-contain p-4 sm:p-5">
          {/* Qoida jumlasi — har doim */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-amber-800">Qoida</div>
            <p className="mt-0.5 text-[13px] leading-snug text-ink">{describe(rule)}</p>
          </div>

          {/* 1. SOVG'A */}
          <div className={`min-w-0 space-y-5 ${show(0)}`}>
            <label className="block min-w-0">
              <Label hint="Faqat siz uchun, mijoz ko‘rmaydi">Bonus nomi</Label>
              <input className={FIELD} value={f.name} maxLength={80} onChange={(e) => set('name')(e.target.value)} placeholder="Kola bonusi — 100 ming" />
            </label>
            <label className="block min-w-0">
              <Label hint="Mijoz savatda va buyurtmada shunday ko‘radi">Sovg‘a nomi</Label>
              <input className={FIELD} value={f.itemName} maxLength={60} onChange={(e) => set('itemName')(e.target.value)} placeholder="1 l Coca-Cola" />
            </label>
            <div className="min-w-0">
              <ImageUpload value={f.imageUrl} onChange={set('imageUrl')} folder="banners" label="Sovg‘a rasmi (ixtiyoriy)" aspect="1/1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <Label hint="Bitta buyurtmaga">Nechta dona</Label>
                <div className="flex items-center overflow-hidden rounded-xl border border-line">
                  <button type="button" onClick={() => set('quantity')(Math.max(1, (Number(f.quantity) || 1) - 1))} className="h-11 w-11 flex-none text-xl text-ink active:bg-canvas" aria-label="Kamaytirish">−</button>
                  <div className="min-w-0 flex-1 text-center text-base font-semibold tabular-nums">{f.quantity}</div>
                  <button type="button" onClick={() => set('quantity')(Math.min(5, (Number(f.quantity) || 1) + 1))} className="h-11 w-11 flex-none text-xl text-ink active:bg-canvas" aria-label="Ko‘paytirish">+</button>
                </div>
              </div>
              <label className="block min-w-0">
                <Label hint="Bitta dona uchun, so‘m">LokmaGo restoranga to‘laydi</Label>
                <input className={FIELD} inputMode="numeric" value={f.reimburse ? spaced(f.reimburse) : ''} onChange={(e) => set('reimburse')(num(e.target.value))} placeholder="12 000" />
              </label>
            </div>
            <div className="rounded-xl bg-canvas px-3.5 py-3 text-xs leading-relaxed text-muted">
              <b className="text-ink">Hisob qanday:</b> buyurtma yetkazilgach, restoran balansiga <b>{som(rule.reimburse * rule.quantity)} so‘m</b> qo‘shiladi (naqd ham, karta ham). Mijoz sovg‘a uchun to‘lamaydi. Bekor qilingan buyurtma uchun qoplash yo‘q.
            </div>
          </div>

          {/* 2. SHART */}
          <div className={`min-w-0 space-y-5 ${show(1)}`}>
            <div className="min-w-0">
              <Label hint="Shu summadan boshlab (shu summaning o‘zi ham) sovg‘a beriladi">Buyurtma summasi (so‘m)</Label>
              <input className={FIELD} inputMode="numeric" value={f.minAmount ? spaced(f.minAmount) : ''} onChange={(e) => set('minAmount')(num(e.target.value))} placeholder="100 000" />
              <div className="mt-2 flex flex-wrap gap-1.5">{AMOUNT_CHIPS.map((a) => <Chip key={a} on={Number(f.minAmount) === a} onClick={() => set('minAmount')(a)}>{som(a)}</Chip>)}</div>
            </div>
            <label className="block min-w-0">
              <Label hint="Bo‘sh = yuqori chegara yo‘q. Masalan faqat 300 000 gacha">Eng ko‘pi bilan (ixtiyoriy)</Label>
              <input className={`${FIELD} ${maxBad ? '!border-red-400' : ''}`} inputMode="numeric" value={f.maxAmount ? spaced(f.maxAmount) : ''} onChange={(e) => set('maxAmount')(num(e.target.value))} placeholder="Cheklovsiz" />
            </label>
            <fieldset className="min-w-0">
              <Label hint="Qaysi summa shart bilan solishtiriladi">Summa hisobi</Label>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {[['menu', 'Taomlar narxi', 'Aksiya va chegirmadan OLDIN — mijoz savatda aniq ko‘radi (tavsiya)'], ['paid', 'Chegirmadan keyin', 'Mijoz taomlar uchun haqiqatda to‘laydigan summa']].map(([v, l, d]) => (
                  <button key={v} type="button" aria-pressed={f.basis === v} onClick={() => set('basis')(v)} className={`rounded-xl border p-3 text-left ${f.basis === v ? 'border-brand-400 bg-brand-400/10 ring-1 ring-brand-400/40' : 'border-line'}`}>
                    <div className="text-sm font-semibold text-ink">{l}</div><div className="text-xs leading-snug text-muted">{d}</div>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="min-w-0">
              <Label>Qaysi restoranlarda</Label>
              <div className="flex flex-wrap gap-1.5">
                {[['all', 'Hammasida'], ['include', 'Faqat tanlanganlarda'], ['exclude', 'Tanlanganlardan tashqari']].map(([v, l]) => <Chip key={v} on={f.scope === v} onClick={() => set('scope')(v)}>{l}</Chip>)}
              </div>
              {f.scope !== 'all' && (
                <div className="mt-3 min-w-0 rounded-2xl border border-line p-2.5">
                  <input className={FIELD} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Restoran qidirish..." />
                  <div className="mt-1 text-xs text-muted">Tanlandi: <b className="text-ink">{f.restaurantIds.length}</b> ta</div>
                  <div className="mt-2 max-h-56 overflow-y-auto">
                    {rests === null ? <div className="py-4 text-center text-sm text-muted">Yuklanmoqda...</div> : list.length === 0 ? <div className="py-4 text-center text-sm text-muted">Topilmadi</div> : list.map((x) => {
                      const id = String(x._id || x.id); const on = f.restaurantIds.includes(id);
                      return (
                        <label key={id} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-2 active:bg-canvas">
                          <input type="checkbox" checked={on} onChange={() => toggleIn('restaurantIds', id)} className="h-5 w-5 accent-orange-500" />
                          <span className="min-w-0 flex-1 truncate text-sm text-ink">{x.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </fieldset>

            <fieldset className="min-w-0"><Label hint="Do‘konlar (market) standart holatda kirmaydi">Muassasa turi</Label>
              <div className="flex flex-wrap gap-1.5">{KINDS.map(([k, l]) => <Chip key={k} on={f.kinds.includes(k)} onClick={() => toggleIn('kinds', k)}>{l}</Chip>)}</div>
            </fieldset>
            <fieldset className="min-w-0"><Label>Buyurtma turi</Label>
              <div className="flex flex-wrap gap-1.5">{[['delivery', 'Yetkazib berish'], ['pickup', 'Olib ketish']].map(([k, l]) => <Chip key={k} on={f.fulfillments.includes(k)} onClick={() => toggleIn('fulfillments', k)}>{l}</Chip>)}</div>
            </fieldset>
            <fieldset className="min-w-0"><Label hint="Hech biri tanlanmasa — hamma to‘lov turi">To‘lov turi</Label>
              <div className="flex flex-wrap gap-1.5">{PAYS.map(([k, l]) => <Chip key={k} on={f.paymentMethods.includes(k)} onClick={() => toggleIn('paymentMethods', k)}>{l}</Chip>)}</div>
            </fieldset>
          </div>

          {/* 3. CHEKLOV */}
          <div className={`min-w-0 space-y-5 ${show(2)}`}>
            <fieldset className="min-w-0">
              <Label hint="Bo‘sh qoldirsangiz — yoqilgandan to o‘chirilguncha">Qachon amal qilsin (ixtiyoriy)</Label>
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block min-w-0"><span className="mb-1 block text-xs text-muted">Boshlanishi</span><input type="datetime-local" className={FIELD} value={f.startsAt} onChange={(e) => set('startsAt')(e.target.value)} /></label>
                <label className="block min-w-0"><span className="mb-1 block text-xs text-muted">Tugashi</span><input type="datetime-local" className={FIELD} value={f.endsAt} onChange={(e) => set('endsAt')(e.target.value)} /></label>
              </div>
            </fieldset>
            <fieldset className="min-w-0"><Label hint="Hech biri tanlanmasa — har kuni">Hafta kunlari</Label>
              <div className="flex flex-wrap gap-1.5">{DAYS.map(([d, l]) => <Chip key={d} on={f.weekdays.includes(d)} onClick={() => toggleIn('weekdays', d)}>{l}</Chip>)}</div>
            </fieldset>
            <fieldset className="min-w-0">
              <Label hint="Toshkent vaqti. Bo‘sh = kun bo‘yi. 22 dan 6 gacha — tun ham kiradi">Kun ichida soat</Label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block min-w-0"><span className="mb-1 block text-xs text-muted">Dan (0–23)</span><input className={`${FIELD} ${hourBad ? '!border-red-400' : ''}`} inputMode="numeric" value={f.hourFrom} onChange={(e) => set('hourFrom')(digits(e.target.value).slice(0, 2))} placeholder="11" /></label>
                <label className="block min-w-0"><span className="mb-1 block text-xs text-muted">Gacha (1–24)</span><input className={`${FIELD} ${hourBad ? '!border-red-400' : ''}`} inputMode="numeric" value={f.hourTo} onChange={(e) => set('hourTo')(digits(e.target.value).slice(0, 2))} placeholder="23" /></label>
              </div>
            </fieldset>

            <fieldset className="min-w-0">
              <Label hint="0 yoki bo‘sh = cheklovsiz. Suiste’molni oldini oladi">Cheklovlar</Label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[['perCustomerPerDay', 'Bir mijozga kuniga (buyurtma)'], ['perCustomerTotal', 'Bir mijozga jami (buyurtma)'], ['dailyLimit', 'Kuniga jami (barcha mijozga)'], ['totalLimit', 'Umuman jami (buyurtma)']].map(([k, l]) => (
                  <label key={k} className="block min-w-0"><span className="mb-1 block text-xs text-muted">{l}</span>
                    <input className={FIELD} inputMode="numeric" value={f[k] ? String(f[k]) : ''} onChange={(e) => set(k)(num(e.target.value))} placeholder="Cheklovsiz" />
                  </label>
                ))}
              </div>
              <label className="mt-3 block min-w-0"><span className="mb-1 block text-xs text-muted">Umumiy byudjet — LokmaGo restoranlarga shuncha to‘lagach bonus o‘zi to‘xtaydi (so‘m)</span>
                <input className={FIELD} inputMode="numeric" value={f.budget ? spaced(f.budget) : ''} onChange={(e) => set('budget')(num(e.target.value))} placeholder="Cheklovsiz" />
              </label>
            </fieldset>

            <div className="flex items-center justify-between gap-3 rounded-2xl bg-canvas px-4 py-3.5">
              <div className="min-w-0"><div className="text-sm font-semibold text-ink">Mijozlarga ko‘rsatish</div>
                <div className="text-xs leading-snug text-muted">{canActivate ? (f.active ? 'Saqlangach darhol amal qiladi' : 'O‘chiq: qoralama bo‘lib saqlanadi') : `Allaqachon ${MAX_ACTIVE} ta bonus yoqilgan`}</div></div>
              <Switch on={f.active} disabled={!canActivate} onChange={() => set('active')(!f.active)} />
            </div>
          </div>

          {err && <div role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm leading-snug text-red-700">{err}</div>}
        </div>

        <div className="flex flex-none gap-2 border-t border-line bg-surface px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
          {step > 0 ? <button onClick={() => go(step - 1)} className="h-12 flex-none rounded-xl border border-line px-5 text-sm font-semibold text-ink sm:hidden">Orqaga</button>
            : <button onClick={onClose} className="h-12 flex-none rounded-xl border border-line px-5 text-sm font-semibold text-muted sm:hidden">Bekor</button>}
          <button onClick={onClose} className="hidden h-12 flex-none rounded-xl border border-line px-5 text-sm font-semibold text-muted sm:block">Bekor qilish</button>
          {!last && isNew && <button onClick={next} className="h-12 min-w-0 flex-1 rounded-xl bg-brand-400 text-sm font-semibold text-brand-text active:opacity-80 sm:hidden">Keyingi <i className="ti ti-arrow-right" /></button>}
          <button onClick={save} disabled={busy} className={`h-12 min-w-0 flex-1 rounded-xl bg-brand-400 text-sm font-semibold text-brand-text active:opacity-80 disabled:opacity-40 ${!last && isNew ? 'hidden sm:block' : ''}`}>{busy ? 'Saqlanmoqda...' : 'Saqlash'}</button>
        </div>
      </div>
    </div>
  );
}
