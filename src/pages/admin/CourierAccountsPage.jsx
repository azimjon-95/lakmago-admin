import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { adminApi } from '@/api';
import { confirm } from '@/components/ui/confirm';
import { useAuth } from '@/store/auth';
import { DistrictPicker } from '@/components/delivery/DistrictPicker';
import { CourierLiveMap } from '@/components/delivery/CourierLiveMap';
import { useDistricts, districtName, som } from '@/components/delivery/districts';
import { usePolling } from '@/components/delivery/usePolling';
import {
  Sheet, ScrollTabs, Badge, Avatar, Stat, Skeleton, EmptyState, Btn, Banner, Field, MoneyInput, SearchBox, Fab, Steps, when, useDebounced,
} from '@/components/delivery/ui';

/**
 * ═══ LOKMAGO KURYERLARI ═══ (mobil ilovadagi «Kuryer» bo'limiga login/parol bilan kiradigan ishchi kuryerlar)
 * Server: controllers/courierApp.js (akkauntlar), controllers/delivery.js (kassa, quti, nazorat), services/courierPool.js, courierTrack.js.
 * MOBIL-BIRINCHI: telefonda asosiy foydalanish (admin yo'lda ham kuzatadi) — katta teginish maydonlari, pastdan chiqadigan oynalar,
 * gorizontal tablar, suzuvchi «+» tugma; kompyuterda shu komponentlar kengayadi.
 *
 *  Kuryerlar   — ro'yxat, qidiruv, holat, balans; akkaunt yaratish (login/parol), ish tumanlari, naqd chegarasi, kassa.
 *  Jonli       — smenadagi kuryerlar xaritada: qayerda, qaysi taomni qayerdan qayerga olib ketyapti.
 *  Quti        — olinmagan buyurtmalar; admin qo'lda kuryerga beradi yoki qaytaradi.
 *  Nazorat     — shubhali voqealar (uzoqdan «oldim/topshirdim», joylashuvsiz) va buyurtma izi.
 *  Sozlamalar  — LokmaGo foizi, naqd chegarasi, bir vaqtdagi buyurtmalar (FAQAT bosh admin).
 * BALANS: musbat — LokmaGo kuryerga qarzdor; manfiy — kuryer qo'lidagi LokmaGo puli (topshirishi kerak).
 */
const VEHICLES = { scooter: ['🛵', 'Skuter'], bike: ['🚲', 'Velosiped'], car: ['🚗', 'Mashina'], foot: ['🚶', 'Piyoda'] };
const ORDER_STATUS = { accepted: 'Qabul qilindi', preparing: 'Tayyorlanmoqda', ready: 'Tayyor', delivering: 'Yo‘lda' };
const LEDGER = {
  courier_cash: ['Mijozdan naqd olindi', 'ti-cash', 'text-red-600 bg-red-50'], courier_earning: ['Yetkazish ulushi', 'ti-moped', 'text-green-700 bg-green-50'],
  courier_handover: ['Naqd topshirildi', 'ti-arrow-down-circle', 'text-green-700 bg-green-50'], courier_payout: ['Kuryerga to‘landi', 'ti-arrow-up-circle', 'text-blue-700 bg-blue-50'],
  courier_adjustment: ['Tuzatish', 'ti-adjustments', 'text-amber-700 bg-amber-50'],
};
const EVENT_LABEL = { claimed: 'Oldi (qutidan)', released: 'Qaytardi', picked_up: 'Taomni oldi', delivered: 'Topshirdi', admin_assigned: 'Admin biriktirdi', admin_released: 'Admin qaytardi' };
const FLAG_LABEL = {
  far_from_restaurant: 'Restorandan uzoqda «oldim» bosdi', far_from_customer: 'Mijoz manzilidan uzoqda «topshirdim» bosdi',
  no_location: 'Joylashuv yo‘q edi', stale_location: 'Joylashuv eskirgan edi',
};
const SIGNAL = { ok: ['Signal bor', 'bg-green-500', 'text-green-700'], stale: ['Signal eskirgan', 'bg-amber-500', 'text-amber-700'], none: ['Signal yo‘q', 'bg-red-500', 'text-red-600'] };
const errText = (e) => e?.message || 'Xatolik yuz berdi';
const dist = (m) => (m == null ? '—' : m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`);
const isoAgo = (h) => new Date(Date.now() - h * 3600_000).toISOString();
/** Statistika kartalari uchun ixcham summa: 1 250 000 → "1,25 mln so‘m" (tor ekranda sig'adi) */
const somTile = (n) => (Math.abs(n) >= 1_000_000 ? `${(n / 1_000_000).toFixed(n % 1_000_000 ? 2 : 0).replace('.', ',')} mln so‘m` : som(n));

export function CourierAccountsPage() {
  const isAdmin = useAuth((s) => s.user?.role === 'admin');
  const [tab, setTab] = useState('list');
  const [newTick, setNewTick] = useState(0);
  const [badges, setBadges] = useState({ pool: 0, control: 0 });

  // Tab belgilari (quti navbati, so'nggi 24 soatdagi shubhali voqealar) — sahifa ochiq turganda 30 s da bir
  usePolling(() => {
    Promise.all([adminApi.getCourierPool(), adminApi.getCourierEvents(isoAgo(24))])
      .then(([p, e]) => setBadges({ pool: p.waiting?.length || 0, control: e.events?.length || 0 }))
      .catch(() => {});
  }, 30000);

  const tabs = [
    { id: 'list', label: 'Kuryerlar', icon: 'ti-users' },
    { id: 'live', label: 'Jonli', icon: 'ti-map-pin' },
    { id: 'pool', label: 'Quti', icon: 'ti-package', badge: badges.pool },
    { id: 'control', label: 'Nazorat', icon: 'ti-shield-check', badge: badges.control, alert: true },
    ...(isAdmin ? [{ id: 'settings', label: 'Sozlamalar', icon: 'ti-adjustments' }] : []),
  ];

  return (
    <div className={`mx-auto max-w-5xl px-4 pt-4 sm:px-6 sm:pt-6 lg:pb-8 ${tab === 'list' ? 'pb-28' : 'pb-8'}`}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold leading-tight text-ink">LokmaGo kuryerlari</h1>
          <p className="mt-1 text-sm text-muted">Umumiy quti: kim ulgursa — o‘sha oladi</p>
        </div>
        {tab === 'list' && (
          <Btn tone="primary" icon="ti-plus" onClick={() => setNewTick((n) => n + 1)} className="hidden flex-none lg:flex">Kuryer qo‘shish</Btn>
        )}
      </header>

      <div className="mb-4"><ScrollTabs tabs={tabs} value={tab} onChange={setTab} /></div>

      {tab === 'list' && <CourierList newTick={newTick} />}
      {tab === 'live' && <LiveView />}
      {tab === 'pool' && <PoolView />}
      {tab === 'control' && <ControlView />}
      {tab === 'settings' && isAdmin && <CourierSettings />}
      {tab === 'list' && <Fab label="Kuryer" onClick={() => setNewTick((n) => n + 1)} />}
    </div>
  );
}

/* ═══════════════════════════ KURYERLAR ═══════════════════════════ */
function CourierList({ newTick }) {
  const districts = useDistricts();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 150).trim().toLowerCase();
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(undefined);        // undefined — yopiq, null — yangi
  const [ledgerOf, setLedgerOf] = useState(null);

  const load = useCallback(async () => {
    try { setData(await adminApi.getCourierAccounts()); setError(''); } catch (e) { setError(errText(e)); setData((d) => d || { couriers: [] }); }
  }, []);
  usePolling(load, 15000);
  useEffect(() => { if (newTick > 0) setEditing(null); }, [newTick]);

  const list = useMemo(() => data?.couriers ?? [], [data]);
  const stats = useMemo(() => ({
    total: list.length,
    onShift: list.filter((c) => c.onShift && c.isActive).length,
    blocked: list.filter((c) => !c.isActive).length,
    cash: list.reduce((s, c) => s + (c.balanceSom < 0 ? -c.balanceSom : 0), 0),
    debt: list.reduce((s, c) => s + (c.balanceSom > 0 ? c.balanceSom : 0), 0),
    active: list.reduce((s, c) => s + (c.activeOrders || 0), 0),
  }), [list]);

  const shown = useMemo(() => list.filter((c) => {
    if (filter === 'shift' && !(c.onShift && c.isActive)) return false;
    if (filter === 'blocked' && c.isActive) return false;
    if (!dq) return true;
    return `${c.name} ${c.login} ${c.phone || ''}`.toLowerCase().includes(dq) || (c.phone || '').replace(/\D/g, '').includes(dq.replace(/\D/g, '') || '§');
  }), [list, filter, dq]);

  const toggle = async (c) => {
    if (c.isActive) {
      const ok = await confirm({ title: 'Kuryer bloklansinmi?', content: `${c.name} ilovadan darhol chiqariladi, smenasi yopiladi va buyurtma ololmaydi.`, tone: 'danger', okText: 'Bloklash' });
      if (!ok) return;
    }
    try { await adminApi.updateCourierAccount(c.id, { isActive: !c.isActive }); load(); } catch (e) { setError(errText(e)); }
  };

  if (!data) return <div className="space-y-3"><div className="grid grid-cols-2 gap-2.5"><Skeleton className="h-24" /><Skeleton className="h-24" /></div><Skeleton className="h-44" /><Skeleton className="h-44" /></div>;

  const filters = [['all', 'Hammasi', stats.total], ['shift', 'Smenada', stats.onShift], ['blocked', 'Bloklangan', stats.blocked]];
  return (
    <>
      {error && <div className="mb-3"><Banner>{error}</Banner></div>}
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat icon="ti-bolt" label="Smenada" value={`${stats.onShift} / ${stats.total}`} tone={stats.onShift ? 'green' : 'ink'} sub={stats.active ? `${stats.active} ta buyurtma yo‘lda` : 'buyurtma yo‘q'} />
        <Stat icon="ti-package" label="Faol buyurtma" value={stats.active} />
        <Stat icon="ti-cash" label="Qo‘lidagi naqd" value={somTile(stats.cash)} tone={stats.cash ? 'red' : 'ink'} sub="topshirishi kerak" />
        <Stat icon="ti-wallet" label="LokmaGo qarzi" value={somTile(stats.debt)} sub="kuryerlarga to‘lanadi" />
      </div>

      {list.length > 0 && (
        <div className="mb-4 space-y-3">
          <SearchBox value={q} onChange={setQ} placeholder="Ism, login yoki telefon" />
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1 sm:mx-0 sm:px-1" role="group" aria-label="Filtr">
            {filters.map(([id, label, n]) => (
              <button key={id} onClick={() => setFilter(id)} aria-pressed={filter === id}
                className={`cs-tap h-10 flex-none rounded-full px-4 text-sm font-semibold ${filter === id ? 'bg-brand-50 text-brand-800 ring-1 ring-brand-400' : 'border border-line bg-white text-muted'}`}>
                {label} <span className="opacity-60">{n}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState icon="ti-moped" title="Hali kuryer yo‘q" text="Kuryer akkaunti yarating: u mobil ilovada «Kuryer» bo‘limiga login va parol bilan kiradi va buyurtmalarni umumiy qutidan oladi."
          action={<Btn tone="primary" icon="ti-plus" onClick={() => setEditing(null)}>Birinchi kuryerni qo‘shish</Btn>} />
      ) : shown.length === 0 ? (
        <EmptyState icon="ti-search" title="Hech narsa topilmadi" text="Qidiruv yoki filtrni o‘zgartiring." action={<Btn onClick={() => { setQ(''); setFilter('all'); }}>Tozalash</Btn>} />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {shown.map((c) => <CourierCard key={c.id} c={c} districts={districts} onLedger={() => setLedgerOf(c)} onEdit={() => setEditing(c)} onToggle={() => toggle(c)} />)}
        </div>
      )}

      {editing !== undefined && <CourierForm courier={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); load(); }} />}
      {ledgerOf && <LedgerSheet courier={ledgerOf} onClose={() => { setLedgerOf(null); load(); }} />}
    </>
  );
}

function CourierCard({ c, districts, onLedger, onEdit, onToggle }) {
  const online = c.onShift && c.isActive;
  const veh = VEHICLES[c.vehicle];
  const dList = c.workDistricts || [];
  const bound = c.boundRestaurants || [];
  return (
    <article className={`min-w-0 rounded-3xl border bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] ${c.isActive ? 'border-line' : 'border-red-200 bg-red-50/30'}`} data-testid="courier-row">
      <div className="flex items-start gap-3.5">
        <Avatar name={c.name} online={online} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="truncate text-[16px] font-bold text-ink">{c.name}</h3>
            {!c.isActive ? <Badge tone="red" icon="ti-lock">Bloklangan</Badge> : online ? <Badge tone="green" icon="ti-bolt">Smenada</Badge> : <Badge>Dam olyapti</Badge>}
          </div>
          <div className="mt-0.5 truncate text-[13px] text-muted">@{c.login}{veh ? ` · ${veh[0]}` : ''}</div>
        </div>
        <button onClick={onLedger} className="cs-tap -mr-1 hidden flex-none rounded-2xl px-2 py-1 text-right sm:block" aria-label={`Kassa: ${som(c.balanceSom)}`}>
          <div className={`text-[17px] font-bold tabular-nums leading-tight ${c.balanceSom < 0 ? 'text-red-600' : c.balanceSom > 0 ? 'text-green-700' : 'text-ink'}`}>{som(Math.abs(c.balanceSom))}</div>
          <div className="text-[11px] font-medium text-muted">{c.balanceSom < 0 ? 'qo‘lida naqd' : c.balanceSom > 0 ? 'LokmaGo qarzi' : 'balans 0'}</div>
        </button>
      </div>

      {/* Telefonda balans alohida qatorda (ism qirqilmasin); ≥640 px da sarlavha o'ngida */}
      <button onClick={onLedger} className={`cs-tap mt-3 flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-2.5 sm:hidden ${c.balanceSom < 0 ? 'bg-red-50' : c.balanceSom > 0 ? 'bg-green-50' : 'bg-canvas'}`}>
        <span className="text-[13px] font-medium text-muted">{c.balanceSom < 0 ? 'Qo‘lida LokmaGo puli' : c.balanceSom > 0 ? 'LokmaGo qarzi' : 'Balans'}</span>
        <span className={`text-[16px] font-bold tabular-nums ${c.balanceSom < 0 ? 'text-red-600' : c.balanceSom > 0 ? 'text-green-700' : 'text-ink'}`}>{som(Math.abs(c.balanceSom))}</span>
      </button>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {c.phone
          ? <a href={`tel:${c.phone}`} className="cs-tap inline-flex h-10 items-center gap-1.5 rounded-full bg-canvas px-3.5 text-[14px] font-semibold text-ink"><i className="ti ti-phone text-base text-green-700" />{c.phone}</a>
          : <Badge tone="amber" icon="ti-phone-off">Telefon yo‘q</Badge>}
        {c.activeOrders > 0 && <Badge tone="orange" icon="ti-package">{c.activeOrders} ta buyurtma</Badge>}
        <span className="text-[12px] text-muted">kirdi: {when(c.lastLoginAt)}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {dList.length === 0 && bound.length === 0
          ? <Badge tone="amber" icon="ti-alert-triangle">Tuman tanlanmagan — buyurtma ko‘rmaydi</Badge>
          : (
            <>
              {dList.slice(0, 3).map((d) => <Badge key={d} icon="ti-map-pin">{districtName(districts, d).replace(' tumani', '')}</Badge>)}
              {dList.length > 3 && <Badge>+{dList.length - 3}</Badge>}
              {bound.slice(0, 2).map((r) => <Badge key={r.id} tone="orange" icon="ti-tools-kitchen-2">{r.name}</Badge>)}
              {bound.length > 2 && <Badge tone="orange">+{bound.length - 2}</Badge>}
            </>
          )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Btn icon="ti-cash" onClick={onLedger} className="px-2 text-[14px]">Kassa</Btn>
        <Btn icon="ti-pencil" onClick={onEdit} className="px-2 text-[14px]">Tahrir</Btn>
        <Btn tone={c.isActive ? 'danger' : 'success'} icon={c.isActive ? 'ti-lock' : 'ti-lock-open'} onClick={onToggle} className="px-2 text-[14px]">{c.isActive ? 'Blok' : 'Ochish'}</Btn>
      </div>
    </article>
  );
}

/* ───────────── Akkaunt formasi ───────────── */
const genPassword = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const buf = new Uint32Array(10);
  (globalThis.crypto || window.crypto).getRandomValues(buf);
  return [...buf].map((n) => chars[n % chars.length]).join('');
};

function CourierForm({ courier, onClose, onSaved }) {
  const isNew = !courier;
  const [f, setF] = useState({
    login: courier?.login || '', password: '', name: courier?.name || '', phone: courier?.phone || '', vehicle: courier?.vehicle || '',
    workDistricts: courier?.workDistricts || [], debtLimitSom: courier?.debtLimitSom != null ? String(courier.debtLimitSom) : '',
  });
  const [show, setShow] = useState(isNew);
  const [errs, setErrs] = useState({});
  const [saving, setSaving] = useState(false);
  const [top, setTop] = useState('');
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setErrs((e) => ({ ...e, [k]: undefined })); };

  const save = async () => {
    const e = {};
    if (f.name.trim().length < 2) e.name = 'Ism kiritilishi shart';
    if (isNew && f.login.trim().length < 3) e.login = 'Login kamida 3 belgi';
    if ((isNew || f.password) && f.password.length < 8) e.password = 'Parol kamida 8 belgi';
    if (f.phone && f.phone.replace(/\D/g, '').length < 9) e.phone = 'Telefon to‘liq emas';
    setErrs(e);
    if (Object.keys(e).length) return;
    const debt = f.debtLimitSom === '' ? null : Number(f.debtLimitSom);
    const common = { name: f.name.trim(), vehicle: f.vehicle, workDistricts: f.workDistricts, debtLimitSom: debt };
    setSaving(true); setTop('');
    try {
      if (isNew) await adminApi.createCourierAccount({ login: f.login.trim(), password: f.password, ...common, ...(f.phone.trim() ? { phone: f.phone.trim() } : {}) });
      else await adminApi.updateCourierAccount(courier.id, { ...common, phone: f.phone.trim(), ...(f.password ? { password: f.password } : {}) });
      onSaved();
    } catch (err) { setTop(errText(err)); }
    setSaving(false);
  };

  return (
    <Sheet title={isNew ? 'Yangi kuryer' : 'Kuryerni tahrirlash'} subtitle={isNew ? 'Mobil ilovaga kirish uchun akkaunt' : `@${courier.login}`} onClose={onClose} tall
      footer={<div className="grid grid-cols-[1fr_2fr] gap-3"><Btn onClick={onClose}>Bekor</Btn><Btn tone="primary" onClick={save} disabled={saving}>{saving ? 'Saqlanmoqda…' : 'Saqlash'}</Btn></div>}>
      {top && <div className="mb-4"><Banner>{top}</Banner></div>}

      <h3 className="mb-3 mt-1 text-[12px] font-bold uppercase tracking-wider text-muted">Kirish</h3>
      <Field label="Login" error={errs.login}>
        <input className="cs-input" value={f.login} disabled={!isNew} onChange={(e) => set('login', e.target.value)} placeholder="ali.kuryer" autoCapitalize="none" autoCorrect="off" aria-invalid={Boolean(errs.login)} />
      </Field>
      <Field label={isNew ? 'Parol' : 'Yangi parol (ixtiyoriy)'} error={errs.password} hint={isNew ? 'Kamida 8 belgi. Kuryerga alohida ayting.' : 'Almashtirilsa kuryerning eski sessiyalari darhol tugaydi.'}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input className="cs-input pr-12" type={show ? 'text' : 'password'} value={f.password} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" autoCapitalize="none" aria-invalid={Boolean(errs.password)} />
            <button type="button" onClick={() => setShow((v) => !v)} className="cs-tap absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-muted" aria-label={show ? 'Yashirish' : 'Ko‘rsatish'}><i className={`ti ${show ? 'ti-eye-off' : 'ti-eye'} text-lg`} /></button>
          </div>
          <button type="button" onClick={() => { set('password', genPassword()); setShow(true); }} className="cs-tap flex h-12 flex-none items-center gap-1.5 rounded-2xl bg-canvas px-3.5 text-sm font-semibold"><i className="ti ti-wand text-lg" />Yaratish</button>
        </div>
      </Field>

      <h3 className="mb-3 mt-6 text-[12px] font-bold uppercase tracking-wider text-muted">Shaxsiy</h3>
      <Field label="Ism familiya" error={errs.name}><input className="cs-input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Aliyev Vali" aria-invalid={Boolean(errs.name)} /></Field>
      <Field label="Telefon" error={errs.phone}><input className="cs-input" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+998 90 123 45 67" inputMode="tel" aria-invalid={Boolean(errs.phone)} /></Field>
      <Field label="Transport">
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(VEHICLES).map(([k, [emoji, label]]) => (
            <button type="button" key={k} onClick={() => set('vehicle', f.vehicle === k ? '' : k)} aria-pressed={f.vehicle === k}
              className={`cs-tap flex h-[68px] flex-col items-center justify-center gap-0.5 rounded-2xl border-[1.5px] text-[12px] font-semibold ${f.vehicle === k ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-transparent bg-canvas text-muted'}`}>
              <span className="text-2xl leading-none">{emoji}</span>{label}
            </button>
          ))}
        </div>
      </Field>

      <h3 className="mb-3 mt-6 text-[12px] font-bold uppercase tracking-wider text-muted">Ish sozlamalari</h3>
      <Field label="Ish tumanlari" hint="Kuryer ilovada o‘zi ham o‘zgartira oladi. Restoranga biriktirilgan kuryer o‘sha restoranni tumanidan qat‘i nazar oladi.">
        <DistrictPicker multiple value={f.workDistricts} onChange={(v) => set('workDistricts', v)} />
      </Field>
      <Field label="Naqd chegarasi" hint="Qo‘lidagi LokmaGo puli shundan oshsa — yangi naqd buyurtma ololmaydi. Bo‘sh — umumiy sozlama.">
        <MoneyInput value={f.debtLimitSom} onChange={(v) => set('debtLimitSom', v)} placeholder="umumiy" />
        <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
          {[['', 'Umumiy'], ['300000', '300 000'], ['500000', '500 000'], ['1000000', '1 000 000']].map(([v, l]) => (
            <button type="button" key={l} onClick={() => set('debtLimitSom', v)} className={`cs-tap h-9 flex-none rounded-full px-3.5 text-[13px] font-semibold ${f.debtLimitSom === v ? 'bg-ink text-white' : 'bg-canvas text-muted'}`}>{l}</button>
          ))}
        </div>
      </Field>
    </Sheet>
  );
}

/* ───────────── Kassa ───────────── */
function LedgerSheet({ courier, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [type, setType] = useState('courier_handover');
  const [amount, setAmount] = useState('');
  const [sign, setSign] = useState(1);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => adminApi.getCourierLedger(courier.id).then((d) => { setData(d); setError(''); }).catch((e) => setError(errText(e))), [courier.id]);
  useEffect(() => { load(); }, [load]);

  const bal = data?.balanceSom ?? 0;
  const quick = type === 'courier_handover' && bal < 0 ? Math.round(-bal) : type === 'courier_payout' && bal > 0 ? Math.round(bal) : 0;

  const submit = async () => {
    setError('');
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return setError('Summani kiriting');
    if (type === 'courier_adjustment' && note.trim().length < 5) return setError('Tuzatish sababini yozing (kamida 5 belgi)');
    const ok = await confirm({ title: 'Tasdiqlaysizmi?', content: `${LEDGER[type][0]}: ${som(n)}. Yozuv o‘chirilmaydi — xato bo‘lsa teskari tuzatish kiritiladi.`, okText: 'Yozish' });
    if (!ok) return;
    setSaving(true);
    try {
      await adminApi.addCourierLedger(courier.id, { type, amountSom: type === 'courier_adjustment' ? sign * n : n, note: note.trim() || undefined });
      setAmount(''); setNote(''); await load();
    } catch (e) { setError(e?.status === 403 ? 'Kassa yozuvlari faqat moliya bo‘limiga ruxsat etilgan' : errText(e)); }
    setSaving(false);
  };

  const groups = useMemo(() => {
    const g = []; let last = '';
    for (const e of data?.entries || []) {
      const label = when(e.createdAt).replace(/ \d\d:\d\d$/, '');
      if (label !== last) { g.push({ label, items: [] }); last = label; }
      g.at(-1).items.push(e);
    }
    return g;
  }, [data]);

  return (
    <Sheet title="Kassa" subtitle={courier.name} onClose={onClose} tall>
      {!data ? <div className="space-y-3 pt-2"><Skeleton className="h-28" /><Skeleton className="h-40" /></div> : (
        <>
          <div className={`rounded-3xl p-5 ${bal < 0 ? 'bg-red-50' : bal > 0 ? 'bg-green-50' : 'bg-canvas'}`}>
            <div className="text-[13px] font-semibold text-muted">{bal < 0 ? 'Kuryer qo‘lidagi LokmaGo puli' : bal > 0 ? 'LokmaGo kuryerga qarzdor' : 'Hisob teng'}</div>
            <div className={`mt-1 text-[34px] font-bold leading-none tabular-nums ${bal < 0 ? 'text-red-600' : bal > 0 ? 'text-green-700' : 'text-ink'}`}>{som(Math.abs(bal))}</div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[['Yo‘ldagi naqd', som(data.openCashSom)], ['Chegara', som(data.debtLimitSom)], ['Yana oladi', som(data.cashRoomSom)]].map(([l, v]) => (
                <div key={l} className="rounded-2xl bg-white/80 px-1 py-2"><div className="text-[10.5px] text-muted">{l}</div><div className="text-[12.5px] font-bold tabular-nums text-ink">{v}</div></div>
              ))}
            </div>
          </div>

          <h3 className="mb-2 mt-6 text-[12px] font-bold uppercase tracking-wider text-muted">Yozuv qo‘shish</h3>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Yozuv turi">
            {[['courier_handover', 'ti-arrow-down-circle', 'Naqd oldim'], ['courier_payout', 'ti-arrow-up-circle', 'To‘ladim'], ['courier_adjustment', 'ti-adjustments', 'Tuzatish']].map(([t, ic, l]) => (
              <button key={t} onClick={() => { setType(t); setAmount(''); }} aria-pressed={type === t}
                className={`cs-tap flex h-[62px] flex-col items-center justify-center gap-0.5 rounded-2xl border-[1.5px] text-[12.5px] font-semibold ${type === t ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-transparent bg-canvas text-muted'}`}>
                <i className={`ti ${ic} text-xl`} />{l}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px] leading-snug text-muted">
            {type === 'courier_handover' ? 'Kuryer qo‘lidagi LokmaGo pulini topshirdi — balans oshadi.' : type === 'courier_payout' ? 'LokmaGo kuryerga ulushini to‘ladi — balans kamayadi.' : 'Qo‘lda tuzatish. Sabab majburiy.'}
          </p>
          <div className="mt-3 space-y-3">
            {type === 'courier_adjustment' && (
              <div className="grid grid-cols-2 gap-2">
                {[[1, '+ Kuryer foydasiga'], [-1, '− Kuryerdan']].map(([v, l]) => (
                  <button key={v} onClick={() => setSign(v)} aria-pressed={sign === v} className={`cs-tap h-11 rounded-2xl text-sm font-semibold ${sign === v ? 'bg-ink text-white' : 'bg-canvas text-muted'}`}>{l}</button>
                ))}
              </div>
            )}
            <MoneyInput value={amount} onChange={setAmount} placeholder="Summa" />
            {quick > 0 && <button onClick={() => setAmount(String(quick))} className="cs-tap h-9 rounded-full bg-brand-50 px-4 text-[13px] font-bold text-brand-800">Hammasi: {som(quick)}</button>}
            <input className="cs-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === 'courier_adjustment' ? 'Sabab (majburiy)' : 'Izoh (ixtiyoriy)'} />
            {error && <Banner>{error}</Banner>}
            <Btn tone="primary" full onClick={submit} disabled={saving} icon="ti-check">{saving ? 'Yozilmoqda…' : 'Yozish'}</Btn>
          </div>

          <h3 className="mb-2 mt-7 text-[12px] font-bold uppercase tracking-wider text-muted">Tarix</h3>
          {groups.length === 0 && <div className="rounded-2xl bg-canvas p-5 text-center text-sm text-muted">Harakat yo‘q</div>}
          {groups.map((g) => (
            <div key={g.label} className="mb-4">
              <div className="mb-1.5 text-[12px] font-semibold capitalize text-muted">{g.label}</div>
              <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
                {g.items.map((e) => {
                  const [label, icon, cls] = LEDGER[e.type] || [e.type, 'ti-circle', 'text-muted bg-canvas'];
                  return (
                    <div key={e._id} className="flex items-center gap-3 bg-white px-3 py-3">
                      <div className={`flex h-10 w-10 flex-none items-center justify-center rounded-full ${cls}`}><i className={`ti ${icon} text-lg`} /></div>
                      <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-semibold text-ink">{label}</div><div className="truncate text-[12px] text-muted">{when(e.createdAt).split(' ').pop()}{e.meta?.note ? ` · ${e.meta.note}` : ''}</div></div>
                      <div className={`flex-none text-[15px] font-bold tabular-nums ${e.amount < 0 ? 'text-red-600' : 'text-green-700'}`}>{e.amount > 0 ? '+' : '−'}{som(Math.abs(e.amount))}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </Sheet>
  );
}

/* ═══════════════════════════ JONLI ═══════════════════════════ */
function LiveView() {
  const [live, setLive] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [track, setTrack] = useState(null);
  const mapBox = useRef(null);

  const load = useCallback(() => adminApi.getCourierLive().then((r) => { setLive(r); setError(''); }).catch((e) => { setError(errText(e)); setLive((l) => l || { couriers: [] }); }), []);
  usePolling(load, 7000);

  const couriers = live?.couriers || [];
  const sel = useMemo(() => couriers.find((c) => c.id === selected) || null, [couriers, selected]);
  useEffect(() => { setTrack(null); }, [selected]);

  const pick = (id) => { setSelected((s) => (s === id ? null : id)); mapBox.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }); };
  const showTrack = async () => {
    if (!sel) return;
    try { const r = await adminApi.getCourierTrack(sel.id, isoAgo(12), new Date().toISOString()); setTrack(r.points.map((p) => ({ lat: p.lat, lng: p.lng }))); } catch (e) { setError(errText(e)); }
  };

  const problems = couriers.filter((c) => c.signal !== 'ok').length;
  return (
    <div className="space-y-4">
      {error && <Banner>{error}</Banner>}
      <div ref={mapBox} className="scroll-mt-20">
        <CourierLiveMap couriers={couriers} selectedId={selected} onSelect={pick} track={track} className="h-[40dvh] min-h-[260px] sm:h-[440px]" />
        <div className="mt-2 flex items-center gap-3 text-[12px] text-muted">
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-green-500" />bor</span>
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-amber-500" />eskirgan</span>
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-red-500" />yo‘q</span>
          <span className="ml-auto">7 s da yangilanadi</span>
        </div>
      </div>

      {!live ? <div className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
        : couriers.length === 0 ? <EmptyState icon="ti-moon" title="Hozir smenada kuryer yo‘q" text="Kuryerlar mobil ilovada «Ishni boshladim»ni bosganda shu yerda va xaritada paydo bo‘ladi." />
          : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-bold text-ink">Smenada: {couriers.length}</h2>
                {problems > 0 && <Badge tone="red" icon="ti-antenna-bars-off">{problems} ta signal muammosi</Badge>}
              </div>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {couriers.map((c) => <LiveCard key={c.id} c={c} open={c.id === selected} onToggle={() => pick(c.id)} onTrack={showTrack} hasTrack={Boolean(track) && c.id === selected} />)}
              </div>
            </>
          )}
    </div>
  );
}

function LiveCard({ c, open, onToggle, onTrack, hasTrack }) {
  const [label, dot, txt] = SIGNAL[c.signal];
  return (
    <article className={`min-w-0 rounded-3xl border bg-white p-4 ${open ? 'border-brand-400 shadow-md' : 'border-line'}`} data-testid="live-courier">
      <button onClick={onToggle} className="cs-tap flex w-full items-center gap-3 text-left">
        <Avatar name={c.name} online={c.signal === 'ok'} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[16px] font-bold text-ink">{c.name}</div>
          <div className={`flex items-center gap-1.5 text-[12.5px] font-medium ${txt}`}><i className={`h-2 w-2 rounded-full ${dot}`} />{label}{c.location ? ` · ${c.location.ageSec} s oldin` : ''}</div>
        </div>
        <div className="text-right"><div className="text-[18px] font-bold leading-none text-ink">{c.orders.length}</div><div className="text-[11px] text-muted">buyurtma</div></div>
      </button>

      {c.orders.length === 0 && <div className="mt-3 rounded-2xl bg-canvas px-4 py-3 text-[13px] text-muted">Bo‘sh — buyurtma kutyapti</div>}
      {c.orders.map((o) => {
        const picked = Boolean(o.pickedUpAt);
        return (
          <div key={o.id} className="mt-3 rounded-2xl bg-canvas p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="truncate text-[14px] font-bold text-ink">#{o.number ?? '—'} · {o.restaurant.name}</div>
              <Badge tone={picked ? 'red' : 'orange'}>{picked ? 'Mijozga' : 'Restoranga'}</Badge>
            </div>
            <div className="mt-1 text-[13.5px] font-medium text-ink">{o.itemsLine}</div>
            <div className="mt-2.5 space-y-1.5 text-[12.5px] text-muted">
              <div className="flex gap-2"><i className="ti ti-building-store mt-0.5 text-base text-orange-600" /><span className="min-w-0">{o.restaurant.address || o.restaurant.name}</span></div>
              <div className="flex gap-2"><i className="ti ti-home mt-0.5 text-base text-red-600" /><span className="min-w-0">{o.customer.address || '—'}</span></div>
            </div>
            <div className="mt-3"><Steps steps={[{ label: 'Qabul', done: true }, { label: 'Taom olindi', done: picked, active: !picked }, { label: 'Topshirildi', done: false, active: picked }]} /></div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
              <span>maqsadgacha <b className="text-ink">{dist(o.distanceToTargetM)}</b></span>
              <span>{picked ? `olindi ${when(o.pickedUpAt)}` : `qabul ${when(o.claimedAt)}`}</span>
              {o.paymentMethod === 'cash' && <Badge tone="amber" icon="ti-cash">naqd {som(o.cashToCollect)}</Badge>}
            </div>
          </div>
        );
      })}

      {open && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {c.phone ? <a href={`tel:${c.phone}`} className="cs-tap flex h-12 items-center justify-center gap-2 rounded-2xl bg-green-50 text-[15px] font-semibold text-green-700"><i className="ti ti-phone text-lg" />Qo‘ng‘iroq</a> : <span />}
          <Btn icon="ti-route" onClick={onTrack}>{hasTrack ? 'Yo‘l ko‘rsatilgan' : 'Yo‘li (12 soat)'}</Btn>
        </div>
      )}
    </article>
  );
}

/* ═══════════════════════════ QUTI ═══════════════════════════ */
function PoolView() {
  const districts = useDistricts();
  const [district, setDistrict] = useState('');
  const [data, setData] = useState(null);
  const [couriers, setCouriers] = useState([]);
  const [error, setError] = useState('');
  const [assigning, setAssigning] = useState(null);

  const load = useCallback(() => Promise.all([adminApi.getCourierPool(district), adminApi.getCourierAccounts()])
    .then(([p, c]) => { setData(p); setCouriers(c.couriers.filter((x) => x.isActive)); setError(''); })
    .catch((e) => { setError(errText(e)); setData((d) => d || { waiting: [], assigned: [] }); }), [district]);
  usePolling(load, 15000);

  const assign = async (order, courier) => {
    setAssigning(null);
    try { await adminApi.assignCourier(order.id, courier.id); load(); } catch (e) { setError(errText(e)); }
  };
  const release = async (o) => {
    const ok = await confirm({ title: 'Kuryerdan qaytarilsinmi?', content: `#${o.number ?? ''} buyurtma qutiga qaytadi va boshqa kuryer olishi mumkin.`, okText: 'Qaytarish' });
    if (!ok) return;
    try { await adminApi.releaseCourier(o.id); load(); } catch (e) { setError(errText(e)); }
  };

  return (
    <>
      <div className="mb-4">
        <select className="cs-input cs-on-canvas" value={district} onChange={(e) => { setDistrict(e.target.value); setData(null); }} aria-label="Tuman">
          <option value="">Barcha tumanlar</option>
          {districts.map((d) => <option key={d.id} value={d.id}>{d.uz}</option>)}
        </select>
      </div>
      {error && <div className="mb-3"><Banner>{error}</Banner></div>}
      {!data ? <div className="space-y-3"><Skeleton className="h-40" /><Skeleton className="h-40" /></div> : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-2.5 flex items-center gap-2 text-[15px] font-bold text-ink">Qutida — kuryer kutilmoqda {data.waiting.length > 0 && <Badge tone="orange">{data.waiting.length}</Badge>}</h2>
            {data.waiting.length === 0 ? <div className="rounded-3xl border border-dashed border-line bg-white p-6 text-center text-sm text-muted"><i className="ti ti-circle-check mb-1 block text-3xl text-green-600" />Quti bo‘sh — hamma buyurtma kuryerda</div> : (
              <div className="space-y-3">
                {data.waiting.map((o) => (
                  <article key={o.id} className="rounded-3xl border border-line bg-white p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0"><div className="truncate text-[16px] font-bold text-ink">#{o.number ?? '—'} · {o.restaurant.name}</div><div className="mt-0.5 text-[13px] text-muted">{o.itemsSummary}</div></div>
                      <Badge tone="gray">{ORDER_STATUS[o.status] || o.status}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Badge icon="ti-map-pin">{districtName(districts, o.district).replace(' tumani', '')}</Badge>
                      {o.distanceKm != null && <Badge icon="ti-route">~{o.distanceKm} km</Badge>}
                      <Badge tone="green" icon="ti-moped">kuryerga {som(o.earningSom)}</Badge>
                      {o.paymentMethod === 'cash' ? <Badge tone="amber" icon="ti-cash">naqd {som(o.cashToCollectSom)}</Badge> : <Badge tone="blue" icon="ti-credit-card">karta</Badge>}
                      {o.freeDelivery && <Badge tone="orange" icon="ti-gift">tekin yetkazish</Badge>}
                    </div>
                    <Btn full icon="ti-user-plus" onClick={() => setAssigning(o)} className="mt-3.5">Kuryerga berish</Btn>
                  </article>
                ))}
              </div>
            )}
          </section>
          <section>
            <h2 className="mb-2.5 flex items-center gap-2 text-[15px] font-bold text-ink">Kuryerda {data.assigned.length > 0 && <Badge tone="blue">{data.assigned.length}</Badge>}</h2>
            {data.assigned.length === 0 ? <div className="rounded-3xl border border-dashed border-line bg-white p-6 text-center text-sm text-muted">Hozir yo‘lda buyurtma yo‘q</div> : (
              <div className="space-y-3">
                {data.assigned.map((o) => (
                  <article key={o.id} className="rounded-3xl border border-line bg-white p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0"><div className="truncate text-[16px] font-bold text-ink">#{o.number ?? '—'} · {o.restaurantName}</div><div className="mt-0.5 text-[13px] text-muted">{o.itemsLine}</div></div>
                      <Badge tone={o.pickedUpAt ? 'red' : 'orange'}>{o.pickedUpAt ? 'Yo‘lda' : ORDER_STATUS[o.status] || o.status}</Badge>
                    </div>
                    <div className="mt-3 flex items-center gap-3 rounded-2xl bg-canvas p-3">
                      <Avatar name={o.courier?.name || '?'} size={36} />
                      <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-semibold text-ink">{o.courier?.name || '—'}</div><div className="text-[12px] text-muted">{o.pickedUpAt ? `taom olindi ${when(o.pickedUpAt)}` : `qabul ${when(o.claimedAt)}`}{o.paymentMethod === 'cash' ? ` · naqd ${som(o.cashToCollectSom)}` : ''}</div></div>
                      {o.courier?.phone && <a href={`tel:${o.courier.phone}`} aria-label="Qo‘ng‘iroq" className="cs-tap flex h-11 w-11 flex-none items-center justify-center rounded-full bg-green-50 text-green-700"><i className="ti ti-phone text-xl" /></a>}
                    </div>
                    {!o.pickedUpAt && <button onClick={() => release(o)} className="cs-tap mt-2 h-11 w-full rounded-2xl text-[14px] font-semibold text-red-600">Qutiga qaytarish</button>}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
      {assigning && <CourierPicker order={assigning} couriers={couriers} onPick={(c) => assign(assigning, c)} onClose={() => setAssigning(null)} />}
    </>
  );
}

function CourierPicker({ order, couriers, onPick, onClose }) {
  const [q, setQ] = useState('');
  const dq = q.trim().toLowerCase();
  const sorted = useMemo(() => [...couriers]
    .filter((c) => !dq || `${c.name} ${c.login}`.toLowerCase().includes(dq))
    .sort((a, b) => Number(b.onShift) - Number(a.onShift) || Number((b.workDistricts || []).includes(order.district)) - Number((a.workDistricts || []).includes(order.district))), [couriers, dq, order.district]);
  return (
    <Sheet title="Kuryerni tanlang" subtitle={`#${order.number ?? ''} · ${order.restaurant.name}`} onClose={onClose} tall>
      {couriers.length > 6 && <div className="mb-3"><SearchBox value={q} onChange={setQ} placeholder="Qidirish" /></div>}
      {sorted.length === 0 ? <EmptyState icon="ti-user-off" title="Kuryer topilmadi" /> : (
        <div className="space-y-2">
          {sorted.map((c) => {
            const match = (c.workDistricts || []).includes(order.district);
            return (
              <button key={c.id} onClick={() => onPick(c)} className="cs-tap flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-3 text-left">
                <Avatar name={c.name} online={c.onShift} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold text-ink">{c.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {c.onShift ? <Badge tone="green">Smenada</Badge> : <Badge>Smenada emas</Badge>}
                    {match ? <Badge tone="blue">shu tuman</Badge> : <Badge tone="amber">boshqa tuman</Badge>}
                    {c.activeOrders > 0 && <Badge tone="orange">{c.activeOrders} ta band</Badge>}
                  </div>
                </div>
                <i className="ti ti-chevron-right text-xl text-muted" />
              </button>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}

/* ═══════════════════════════ NAZORAT ═══════════════════════════ */
function ControlView() {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState('');
  const [trace, setTrace] = useState(null);
  const [opening, setOpening] = useState(null);
  const load = useCallback(() => adminApi.getCourierEvents(isoAgo(24 * 7)).then((r) => { setEvents(r.events); setError(''); }).catch((e) => { setError(errText(e)); setEvents((x) => x || []); }), []);
  usePolling(load, 30000);
  const open = async (e) => {
    setOpening(e.id);
    try { setTrace(await adminApi.getCourierTrace(e.orderId)); } catch (err) { setError(errText(err)); }
    setOpening(null);
  };
  return (
    <>
      <div className="mb-4 flex items-start gap-3 rounded-3xl bg-brand-50 p-4 text-[13px] leading-relaxed text-brand-800">
        <i className="ti ti-info-circle mt-0.5 text-xl" />
        <p>So‘nggi 7 kun. Kuryer «taomni oldim» yoki «topshirdim»ni restoran/mijoz manzilidan uzoqda (yoki joylashuvsiz) bosgan voqealar. Bloklanmaydi — GPS xato berishi mumkin — lekin shu yerda ko‘rinadi.</p>
      </div>
      {error && <div className="mb-3"><Banner>{error}</Banner></div>}
      {!events ? <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div> : events.length === 0
        ? <EmptyState icon="ti-shield-check" title="Hammasi joyida" text="So‘nggi 7 kunda shubhali voqea bo‘lmadi." />
        : (
          <div className="space-y-2.5">
            {events.map((e) => (
              <button key={e.id} onClick={() => open(e)} disabled={opening === e.id} className="cs-tap flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-3.5 text-left disabled:opacity-60" data-testid="flagged-event">
                <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-red-50 text-red-600"><i className="ti ti-alert-triangle text-xl" /></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold text-ink">{e.courierName || 'Kuryer'} · {EVENT_LABEL[e.type] || e.type}</div>
                  <div className="text-[13px] font-medium text-red-600">{FLAG_LABEL[e.flagReason] || e.flagReason}</div>
                  <div className="mt-0.5 text-[12px] text-muted">{when(e.at)}{e.targetDistanceM != null ? ` · maqsadgacha ${dist(e.targetDistanceM)}` : ''}</div>
                </div>
                <i className="ti ti-chevron-right text-xl text-muted" />
              </button>
            ))}
          </div>
        )}
      {trace && <TraceSheet trace={trace} onClose={() => setTrace(null)} />}
    </>
  );
}

function TraceSheet({ trace, onClose }) {
  const o = trace.order;
  const pts = trace.points.map((p) => ({ lat: p.lat, lng: p.lng }));
  const live = trace.courier ? [{ id: 'c', name: trace.courier.name, phone: trace.courier.phone, signal: 'ok', location: pts.length ? { ...pts[pts.length - 1] } : null, orders: [] }] : [];
  return (
    <Sheet title={`Buyurtma #${o.number ?? ''} izi`} subtitle={trace.courier ? `Kuryer: ${trace.courier.name}` : 'Kuryer yo‘q'} onClose={onClose} tall>
      <div className="rounded-2xl bg-canvas p-3.5 text-[13px]">
        <div className="font-semibold text-ink">{o.itemsLine}</div>
        <div className="mt-1.5 flex gap-2 text-muted"><i className="ti ti-building-store text-base text-orange-600" />{o.restaurant.name}</div>
        <div className="mt-1 flex gap-2 text-muted"><i className="ti ti-home text-base text-red-600" />{o.customer.address || '—'}</div>
        {trace.distanceM > 0 && <div className="mt-1.5 text-muted">Kuryer yo‘li: <b className="text-ink">{dist(trace.distanceM)}</b></div>}
      </div>
      {pts.length > 1 && <div className="mt-3"><CourierLiveMap couriers={live} selectedId="c" track={pts} className="h-[240px]" /></div>}
      <h3 className="mb-2 mt-5 text-[12px] font-bold uppercase tracking-wider text-muted">Voqealar</h3>
      {trace.events.length === 0 ? <div className="rounded-2xl bg-canvas p-4 text-center text-sm text-muted">Voqea yo‘q</div> : (
        <ol className="relative ml-3 border-l-2 border-line pl-5">
          {trace.events.map((e, i) => (
            <li key={i} className="relative pb-5 last:pb-0">
              <span className={`absolute -left-[31px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white ${e.flagged ? 'bg-red-500' : 'bg-green-500'}`} />
              <div className="flex items-baseline justify-between gap-2"><b className={`text-[14.5px] ${e.flagged ? 'text-red-600' : 'text-ink'}`}>{EVENT_LABEL[e.type] || e.type}</b><span className="flex-none text-[12px] text-muted">{when(e.at)}</span></div>
              <div className="mt-0.5 text-[12.5px] text-muted">
                {e.targetDistanceM != null ? `maqsadgacha ${dist(e.targetDistanceM)}` : e.lat ? 'joylashuv yozilgan' : 'joylashuv yo‘q'}{e.locAgeSec != null ? ` · nuqta ${e.locAgeSec} s oldin` : ''}
              </div>
              {e.flagged && <div className="mt-1"><Badge tone="red" icon="ti-alert-triangle">{FLAG_LABEL[e.flagReason] || e.flagReason}</Badge></div>}
            </li>
          ))}
        </ol>
      )}
    </Sheet>
  );
}

/* ═══════════════════════════ SOZLAMALAR (faqat bosh admin) ═══════════════════════════ */
function CourierSettings() {
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { adminApi.getCourierSettings().then((r) => setS({ commissionPercent: String(r.commissionPercent), debtLimitSom: String(r.debtLimitSom), maxActiveOrders: String(r.maxActiveOrders) })).catch((e) => setMsg({ type: 'err', text: errText(e) })); }, []);
  if (!s) return msg ? <Banner>{msg.text}</Banner> : <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>;
  const set = (k, v) => { setS((x) => ({ ...x, [k]: v })); setMsg(null); };
  const save = async () => {
    const body = { commissionPercent: Number(s.commissionPercent), debtLimitSom: Number(s.debtLimitSom), maxActiveOrders: Number(s.maxActiveOrders) };
    if (!(body.commissionPercent >= 0 && body.commissionPercent <= 100)) return setMsg({ type: 'err', text: 'Foiz 0 dan 100 gacha bo‘lsin' });
    if (!(body.debtLimitSom >= 0)) return setMsg({ type: 'err', text: 'Naqd chegarasi noto‘g‘ri' });
    if (!(body.maxActiveOrders >= 1 && body.maxActiveOrders <= 10)) return setMsg({ type: 'err', text: 'Bir vaqtdagi buyurtmalar 1–10 bo‘lsin' });
    setSaving(true); setMsg(null);
    try { const r = await adminApi.updateCourierSettings(body); setS({ commissionPercent: String(r.commissionPercent), debtLimitSom: String(r.debtLimitSom), maxActiveOrders: String(r.maxActiveOrders) }); setMsg({ type: 'ok', text: 'Saqlandi. Yangi buyurtmalarga qo‘llanadi.' }); }
    catch (e) { setMsg({ type: 'err', text: errText(e) }); }
    setSaving(false);
  };
  const pct = Number(s.commissionPercent || 0);
  const ex = Math.round(30000 * (1 - pct / 100));
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="rounded-3xl border border-line bg-white p-5">
        <Field label="LokmaGo foizi (har yetkazishdan)" hint="Restoranga alohida foiz uning sozlamalarida beriladi.">
          <div className="relative"><input className="cs-input pr-10 tabular-nums" type="number" inputMode="decimal" min="0" max="100" step="0.5" value={s.commissionPercent} onChange={(e) => set('commissionPercent', e.target.value)} /><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted">%</span></div>
        </Field>
        <div className="-mt-1 mb-5 flex items-center justify-between rounded-2xl bg-brand-50 px-4 py-3 text-[13px] text-brand-800"><span>30 000 so‘mlik yetkazishdan</span><b className="tabular-nums">kuryerga {som(ex)}</b></div>
        <Field label="Naqd chegarasi" hint="Kuryer qo‘lidagi LokmaGo puli shundan oshsa — yangi naqd buyurtma olmaydi. 0 — oldindan to‘ldirilgan balans talab qilinadi.">
          <MoneyInput value={s.debtLimitSom} onChange={(v) => set('debtLimitSom', v)} />
        </Field>
        <Field label="Bir vaqtda nechta buyurtma" hint="Mobil ilova hozircha bitta faol buyurtmani ko‘rsatadi — 1 qoldiring.">
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => set('maxActiveOrders', String(n))} aria-pressed={Number(s.maxActiveOrders) === n} className={`cs-tap h-12 rounded-2xl text-base font-bold ${Number(s.maxActiveOrders) === n ? 'bg-ink text-white' : 'bg-canvas text-muted'}`}>{n}</button>)}
          </div>
        </Field>
        {msg && <div className="mb-3"><Banner tone={msg.type === 'ok' ? 'green' : 'red'}>{msg.text}</Banner></div>}
        <Btn tone="primary" full onClick={save} disabled={saving} icon="ti-device-floppy">{saving ? 'Saqlanmoqda…' : 'Saqlash'}</Btn>
      </div>
    </div>
  );
}
