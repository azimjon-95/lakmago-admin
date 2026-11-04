import { useState, useEffect, useCallback, useMemo } from 'react';
import { adminApi } from '@/api';
import { confirm } from '@/components/ui/confirm';
import { useAuth } from '@/store/auth';
import { DistrictPicker } from '@/components/delivery/DistrictPicker';
import { CourierLiveMap } from '@/components/delivery/CourierLiveMap';
import { useDistricts, districtName, som } from '@/components/delivery/districts';

/**
 * ═══ LOKMAGO KURYERLARI ═══ (mobil ilovadagi «Kuryer» bo'limiga login/parol bilan kiradigan ishchi kuryerlar)
 * Server: controllers/courierApp.js (akkauntlar), controllers/delivery.js (kassa, quti, nazorat), services/courierPool.js, courierTrack.js.
 *
 *  Kuryerlar   — akkaunt yaratish (login/parol), ish tumanlari, naqd chegarasi, bloklash, balans va kassa.
 *  Jonli       — smenadagi kuryerlar xaritada: qayerda, qaysi taomni qayerdan qayerga olib ketyapti; kuryer yo'li.
 *  Quti        — olinmagan buyurtmalar; admin qo'lda kuryerga beradi yoki qaytaradi.
 *  Nazorat     — shubhali voqealar (uzoqdan «oldim/topshirdim», joylashuvsiz) va buyurtma izi.
 *  Sozlamalar  — LokmaGo foizi, naqd chegarasi, bir vaqtdagi buyurtmalar (FAQAT bosh admin).
 *
 * BALANS: musbat — LokmaGo kuryerga qarzdor; manfiy — kuryer qo'lidagi LokmaGo puli (topshirishi kerak).
 */
const VEHICLES = { '': '—', scooter: 'Skuter', bike: 'Velosiped', car: 'Mashina', foot: 'Piyoda' };
const ORDER_STATUS = { accepted: 'Qabul qilindi', preparing: 'Tayyorlanmoqda', ready: 'Tayyor', delivering: 'Yo‘lda' };
const LEDGER_LABEL = {
  courier_cash: 'Mijozdan naqd olindi', courier_earning: 'Yetkazish ulushi', courier_handover: 'Naqd topshirildi',
  courier_payout: 'Kuryerga to‘landi', courier_adjustment: 'Tuzatish',
};
const EVENT_LABEL = { claimed: 'Oldi (qutidan)', released: 'Qaytardi', picked_up: 'Taomni oldi', delivered: 'Topshirdi', admin_assigned: 'Admin biriktirdi', admin_released: 'Admin qaytardi' };
const FLAG_LABEL = {
  far_from_restaurant: 'Restorandan uzoqda «oldim» bosdi', far_from_customer: 'Mijoz manzilidan uzoqda «topshirdim» bosdi',
  no_location: 'Joylashuv yo‘q edi', stale_location: 'Joylashuv eskirgan edi',
};
const SIGNAL = { ok: ['Signal bor', 'text-green-700'], stale: ['Signal eskirgan', 'text-amber-700'], none: ['Signal yo‘q', 'text-red-600'] };
const errText = (e) => e?.message || 'Xatolik yuz berdi';
const fmtTime = (d) => (d ? new Date(d).toLocaleString('ru-RU', { hour12: false, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const dist = (m) => (m == null ? '—' : m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`);

export function CourierAccountsPage() {
  const [tab, setTab] = useState('list');
  const isAdmin = useAuth((s) => s.user?.role === 'admin');
  const tabs = [['list', 'Kuryerlar'], ['live', 'Jonli'], ['pool', 'Quti'], ['control', 'Nazorat'], ...(isAdmin ? [['settings', 'Sozlamalar']] : [])];
  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-ink">LokmaGo kuryerlari</h1>
        <p className="text-sm text-muted">Umumiy quti — kim ulgursa o‘sha oladi. Kuryer faqat o‘z tumanlaridagi (yoki o‘ziga biriktirilgan restoranlardagi) buyurtmalarni ko‘radi.</p>
      </div>
      <div className="mb-5 inline-flex flex-wrap rounded-xl border border-line bg-surface p-1" role="tablist">
        {tabs.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium ${tab === k ? 'bg-brand-400 text-brand-text' : 'text-muted hover:text-ink'}`}>{l}</button>
        ))}
      </div>
      {tab === 'list' && <CourierList />}
      {tab === 'live' && <LiveView />}
      {tab === 'pool' && <PoolView />}
      {tab === 'control' && <ControlView />}
      {tab === 'settings' && isAdmin && <CourierSettings />}
    </div>
  );
}

function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={`w-full ${wide ? 'sm:max-w-xl' : 'sm:max-w-md'} max-h-[92vh] overflow-y-auto sm:rounded-2xl rounded-t-2xl bg-white p-5`}>
        <h2 className="mb-4 text-lg font-semibold text-ink">{title}</h2>
        {children}
      </div>
    </div>
  );
}
const Field = ({ label, hint, children }) => (
  <div className="mb-3">
    <label className="mb-1 block text-xs font-medium text-ink">{label}</label>
    {children}
    {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
  </div>
);
const inputCls = 'w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm';

/* ─────────────── Kuryerlar ─────────────── */
function CourierList() {
  const districts = useDistricts();
  const [data, setData] = useState({ onlineNow: 0, couriers: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(undefined);     // undefined — yopiq, null — yangi
  const [ledgerOf, setLedgerOf] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try { setData(await adminApi.getCourierAccounts()); } catch (e) { setError(errText(e)); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  const toggle = async (c) => {
    if (c.isActive) {
      const ok = await confirm({ title: 'Kuryer bloklansinmi?', content: `${c.name} ilovadan darhol chiqariladi, smenasi yopiladi va buyurtma ololmaydi.`, tone: 'danger', okText: 'Bloklash' });
      if (!ok) return;
    }
    try { await adminApi.updateCourierAccount(c.id, { isActive: !c.isActive }); load(); } catch (e) { setError(errText(e)); }
  };

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-muted">{data.couriers.length} ta kuryer · hozir smenada <b className="text-green-700">{data.onlineNow}</b></div>
        <button onClick={() => setEditing(null)} className="rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-brand-text">+ Kuryer qo‘shish</button>
      </div>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      {loading ? <div className="py-10 text-center text-sm text-muted">Yuklanmoqda...</div>
        : data.couriers.length === 0 ? <div className="py-10 text-center text-sm text-muted">Hali kuryer akkaunti yo‘q</div> : (
          <div className="space-y-2">
            {data.couriers.map((c) => (
              <div key={c.id} className="rounded-xl border border-line bg-surface p-3.5" data-testid="courier-row">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-10 w-10 flex-none items-center justify-center rounded-full bg-brand-tint text-sm font-bold text-brand-600">
                    {c.name?.[0]?.toUpperCase() || '?'}
                    {c.onShift && c.isActive && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-green-500" title="Smenada" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium text-ink">{c.name}</span>
                      <span className="text-[11px] text-muted">@{c.login}</span>
                      {!c.isActive ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">Bloklangan</span>
                        : c.onShift ? <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">Smenada</span> : null}
                    </div>
                    <div className="truncate text-xs text-muted">
                      {c.phone || 'Telefon yo‘q'} · {VEHICLES[c.vehicle] || '—'}{c.activeOrders ? ` · hozir ${c.activeOrders} ta buyurtma` : ''} · oxirgi kirish {fmtTime(c.lastLoginAt)}
                    </div>
                  </div>
                  <button onClick={() => setLedgerOf(c)} className="flex-none text-right" title="Kassa">
                    <div className={`text-sm font-semibold ${c.balanceSom < 0 ? 'text-red-600' : c.balanceSom > 0 ? 'text-green-700' : 'text-muted'}`}>{som(c.balanceSom)}</div>
                    <div className="text-[11px] text-muted">{c.balanceSom < 0 ? 'qo‘lidagi naqd' : c.balanceSom > 0 ? 'LokmaGo qarzi' : 'balans'}</div>
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {(c.workDistricts || []).length === 0
                    ? <span className="text-[11px] text-amber-700">Tuman tanlanmagan{c.boundRestaurants?.length ? '' : ' — buyurtma ko‘rmaydi'}</span>
                    : c.workDistricts.map((d) => <span key={d} className="rounded-full bg-canvas px-2 py-0.5 text-[11px] text-ink">{districtName(districts, d)}</span>)}
                  {(c.boundRestaurants || []).map((r) => <span key={r.id} className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] text-orange-700" title="Biriktirilgan restoran">🍽 {r.name}</span>)}
                  <div className="ml-auto flex gap-1">
                    <button onClick={() => setLedgerOf(c)} className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-canvas hover:text-ink"><i className="ti ti-cash" /> Kassa</button>
                    <button onClick={() => setEditing(c)} className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-canvas hover:text-ink"><i className="ti ti-pencil" /> Tahrir</button>
                    <button onClick={() => toggle(c)} className={`rounded-lg px-2 py-1 text-xs ${c.isActive ? 'text-red-600 hover:bg-red-50' : 'text-green-700 hover:bg-green-50'}`}>{c.isActive ? 'Bloklash' : 'Faollashtirish'}</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      {editing !== undefined && <CourierForm courier={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); load(); }} />}
      {ledgerOf && <LedgerModal courier={ledgerOf} onClose={() => { setLedgerOf(null); load(); }} />}
    </>
  );
}

function CourierForm({ courier, onClose, onSaved }) {
  const isNew = !courier;
  const [f, setF] = useState({
    login: courier?.login || '', password: '', name: courier?.name || '', phone: courier?.phone || '', vehicle: courier?.vehicle || '',
    workDistricts: courier?.workDistricts || [], debtLimitSom: courier?.debtLimitSom ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const save = async () => {
    setError('');
    if (f.name.trim().length < 2) return setError('Ism kiritilishi shart');
    if (isNew && f.login.trim().length < 3) return setError('Login kamida 3 belgi');
    if ((isNew || f.password) && f.password.length < 8) return setError('Parol kamida 8 belgi');
    const debt = f.debtLimitSom === '' ? null : Number(f.debtLimitSom);
    if (debt !== null && (!Number.isFinite(debt) || debt < 0)) return setError('Naqd chegarasi noto‘g‘ri');
    const common = { name: f.name.trim(), phone: f.phone.trim(), vehicle: f.vehicle, workDistricts: f.workDistricts, debtLimitSom: debt };
    setSaving(true);
    try {
      if (isNew) await adminApi.createCourierAccount({ login: f.login.trim(), password: f.password, ...common, phone: common.phone || undefined });
      else await adminApi.updateCourierAccount(courier.id, { ...common, ...(f.password ? { password: f.password } : {}) });
      onSaved();
    } catch (e) { setError(errText(e)); }
    setSaving(false);
  };

  return (
    <Modal title={isNew ? 'Yangi kuryer' : 'Kuryerni tahrirlash'} onClose={onClose} wide>
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Field label="Login (ilovaga kirish)"><input value={f.login} disabled={!isNew} onChange={(e) => set('login', e.target.value)} placeholder="ali.kuryer" autoCapitalize="none" className={`${inputCls} ${!isNew ? 'opacity-60' : ''}`} /></Field>
        <Field label={isNew ? 'Parol (kamida 8 belgi)' : 'Yangi parol (ixtiyoriy)'} hint={isNew ? 'Kuryerga alohida ayting.' : 'Almashtirilsa — kuryerning eski sessiyalari darhol tugaydi.'}>
          <input value={f.password} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" className={inputCls} />
        </Field>
        <Field label="Ism"><input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Aliyev Vali" className={inputCls} /></Field>
        <Field label="Telefon"><input value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+998 90 123 45 67" inputMode="tel" className={inputCls} /></Field>
        <Field label="Transport">
          <select value={f.vehicle} onChange={(e) => set('vehicle', e.target.value)} className={inputCls}>
            {Object.entries(VEHICLES).map(([k, v]) => <option key={k} value={k}>{k ? v : '—'}</option>)}
          </select>
        </Field>
        <Field label="Naqd chegarasi (so‘m)" hint="Bo‘sh — umumiy sozlama. Qo‘lidagi LokmaGo puli shundan oshsa — yangi naqd buyurtma ololmaydi.">
          <input value={f.debtLimitSom} onChange={(e) => set('debtLimitSom', e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="umumiy" className={inputCls} />
        </Field>
      </div>
      <Field label="Ish tumanlari" hint="Kuryer ilovada o‘zi ham o‘zgartira oladi (masalan bugun Chust tumanida ishlaydi). Restoranga biriktirilgan kuryer o‘sha restoranni tumanidan qat‘i nazar oladi.">
        <DistrictPicker multiple value={f.workDistricts} onChange={(v) => set('workDistricts', v)} />
      </Field>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 rounded-lg border border-line py-2 text-sm">Bekor</button>
        <button onClick={save} disabled={saving} className="flex-1 rounded-lg bg-brand-400 py-2 text-sm font-semibold text-brand-text disabled:opacity-50">{saving ? '...' : 'Saqlash'}</button>
      </div>
    </Modal>
  );
}

/* ─────────────── Kassa ─────────────── */
function LedgerModal({ courier, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [type, setType] = useState('courier_handover');
  const [amount, setAmount] = useState('');
  const [sign, setSign] = useState(1);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => adminApi.getCourierLedger(courier.id).then(setData).catch((e) => setError(errText(e))), [courier.id]);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    setError('');
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return setError('Summani kiriting');
    if (type === 'courier_adjustment' && note.trim().length < 5) return setError('Tuzatish sababini yozing');
    const ok = await confirm({ title: 'Tasdiqlaysizmi?', content: `${LEDGER_LABEL[type]}: ${som(n)}. Yozuv o‘chirilmaydi — xato bo‘lsa teskari tuzatish kiritiladi.`, okText: 'Yozish' });
    if (!ok) return;
    setSaving(true);
    try {
      await adminApi.addCourierLedger(courier.id, { type, amountSom: type === 'courier_adjustment' ? sign * n : n, note: note.trim() || undefined });
      setAmount(''); setNote(''); await load();
    } catch (e) { setError(e?.status === 403 ? 'Kassa yozuvlari faqat moliya bo‘limiga ruxsat etilgan' : errText(e)); }
    setSaving(false);
  };

  return (
    <Modal title={`Kassa — ${courier.name}`} onClose={onClose} wide>
      {!data ? <div className="py-6 text-center text-sm text-muted">{error || 'Yuklanmoqda...'}</div> : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[['Balans', data.balanceSom, data.balanceSom < 0 ? 'text-red-600' : 'text-green-700'], ['Yo‘ldagi naqd', -data.openCashSom, 'text-ink'],
              ['Naqd chegarasi', data.debtLimitSom, 'text-ink'], ['Yana olishi mumkin', data.cashRoomSom, data.cashRoomSom <= 0 ? 'text-red-600' : 'text-ink']].map(([l, v, cls]) => (
              <div key={l} className="rounded-xl bg-canvas p-3"><div className="text-[11px] text-muted">{l}</div><div className={`text-sm font-semibold ${cls}`}>{som(v)}</div></div>
            ))}
          </div>
          <div className="mb-4 rounded-xl border border-line p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {['courier_handover', 'courier_payout', 'courier_adjustment'].map((t) => (
                <button key={t} onClick={() => setType(t)} className={`rounded-full border px-3 py-1 text-xs ${type === t ? 'border-brand-400 bg-brand-tint text-brand-600' : 'border-line'}`}>{LEDGER_LABEL[t]}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {type === 'courier_adjustment' && (
                <select value={sign} onChange={(e) => setSign(Number(e.target.value))} className="rounded-lg border border-line px-2 py-2 text-sm">
                  <option value={1}>+ (kuryer foydasiga)</option><option value={-1}>− (kuryerdan)</option>
                </select>
              )}
              <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="Summa, so‘m" className="w-40 rounded-lg border border-line px-3 py-2 text-sm" />
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === 'courier_adjustment' ? 'Sabab (majburiy)' : 'Izoh'} className="min-w-[140px] flex-1 rounded-lg border border-line px-3 py-2 text-sm" />
              <button onClick={submit} disabled={saving} className="rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-brand-text disabled:opacity-50">Yozish</button>
            </div>
            <p className="mt-2 text-[11px] text-muted">«Naqd topshirildi» — kuryer qo‘lidagi pulni berdi (balans oshadi). «Kuryerga to‘landi» — LokmaGo ulushini to‘ladi (balans kamayadi).</p>
          </div>
          {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
          <div className="divide-y divide-line rounded-xl border border-line">
            {data.entries.length === 0 && <div className="p-4 text-center text-sm text-muted">Harakat yo‘q</div>}
            {data.entries.map((e) => (
              <div key={e._id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0"><div className="text-ink">{LEDGER_LABEL[e.type] || e.type}</div><div className="truncate text-[11px] text-muted">{fmtTime(e.createdAt)}{e.meta?.note ? ` · ${e.meta.note}` : ''}</div></div>
                <div className={`flex-none font-semibold ${e.amount < 0 ? 'text-red-600' : 'text-green-700'}`}>{e.amount > 0 ? '+' : ''}{som(e.amount)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

/* ─────────────── Jonli nazorat ─────────────── */
function LiveView() {
  const [live, setLive] = useState({ couriers: [], at: null });
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [track, setTrack] = useState(null);
  const load = useCallback(() => adminApi.getCourierLive().then((r) => { setLive(r); setError(''); }).catch((e) => setError(errText(e))), []);
  useEffect(() => { load(); const t = setInterval(load, 7000); return () => clearInterval(t); }, [load]);

  const sel = useMemo(() => live.couriers.find((c) => c.id === selected) || null, [live, selected]);
  const showTrack = async () => {
    if (!sel) return;
    try {
      const to = new Date(); const from = new Date(Date.now() - 12 * 3600_000);
      const r = await adminApi.getCourierTrack(sel.id, from.toISOString(), to.toISOString());
      setTrack(r.points.map((p) => ({ lat: p.lat, lng: p.lng })));
    } catch (e) { setError(errText(e)); }
  };
  useEffect(() => { setTrack(null); }, [selected]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
        <span><b className="text-ink">{live.couriers.length}</b> kuryer smenada</span>
        <span className="text-green-700">● signal bor</span><span className="text-amber-700">● eskirgan</span><span className="text-red-600">● signal yo‘q</span>
        <span className="ml-auto">Har 7 soniyada yangilanadi{live.at ? ` · ${fmtTime(live.at)}` : ''}</span>
      </div>
      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      <CourierLiveMap couriers={live.couriers} selectedId={selected} onSelect={setSelected} track={track} />
      {live.couriers.length === 0 && <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">Hozir smenada kuryer yo‘q</div>}
      <div className="grid gap-2 sm:grid-cols-2">
        {live.couriers.map((c) => {
          const [sl, sc] = SIGNAL[c.signal];
          return (
            <button key={c.id} onClick={() => setSelected(c.id === selected ? null : c.id)} data-testid="live-courier"
              className={`rounded-xl border p-3 text-left ${c.id === selected ? 'border-brand-400 bg-brand-tint' : 'border-line bg-surface'}`}>
              <div className="flex items-center justify-between"><b className="text-sm text-ink">{c.name}</b><span className={`text-[11px] font-medium ${sc}`}>{sl}{c.location ? ` · ${c.location.ageSec} s` : ''}</span></div>
              {c.orders.length === 0 && <div className="mt-1 text-xs text-muted">Buyurtma yo‘q — bo‘sh</div>}
              {c.orders.map((o) => (
                <div key={o.id} className="mt-2 rounded-lg bg-canvas p-2 text-xs">
                  <div className="flex justify-between"><b>#{o.number ?? '—'} · {o.restaurant.name}</b><span className={o.stage === 'to_customer' ? 'text-red-600' : 'text-orange-600'}>{o.stage === 'to_customer' ? 'Mijozga ketyapti' : 'Restoranga ketyapti'}</span></div>
                  <div className="mt-0.5 text-ink">{o.itemsLine}</div>
                  <div className="text-muted">{o.stage === 'to_customer' ? `Manzil: ${o.customer.address}` : `Restoran: ${o.restaurant.address}`} · maqsadgacha {dist(o.distanceToTargetM)}</div>
                  <div className="text-muted">{o.pickedUpAt ? `Taomni oldi: ${fmtTime(o.pickedUpAt)}` : `Oldi (qutidan): ${fmtTime(o.claimedAt)} — taom hali olinmagan`}{o.paymentMethod === 'cash' ? ` · naqd ${som(o.cashToCollect)}` : ''}</div>
                </div>
              ))}
            </button>
          );
        })}
      </div>
      {sel && (
        <div className="flex items-center gap-3">
          <button onClick={showTrack} className="rounded-lg border border-line px-3 py-1.5 text-sm"><i className="ti ti-route" /> {sel.name}: oxirgi 12 soat yo‘li</button>
          {sel.phone && <a href={`tel:${sel.phone}`} className="text-sm text-brand-600 underline">{sel.phone}</a>}
          {track && <span className="text-xs text-muted">{track.length} nuqta</span>}
        </div>
      )}
    </div>
  );
}

/* ─────────────── Quti ─────────────── */
function PoolView() {
  const districts = useDistricts();
  const [district, setDistrict] = useState('');
  const [data, setData] = useState(null);
  const [couriers, setCouriers] = useState([]);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setError('');
    return Promise.all([adminApi.getCourierPool(district), adminApi.getCourierAccounts()])
      .then(([p, c]) => { setData(p); setCouriers(c.couriers.filter((x) => x.isActive)); })
      .catch((e) => setError(errText(e)));
  }, [district]);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  const assign = async (orderId, courierId) => {
    if (!courierId) return;
    try { await adminApi.assignCourier(orderId, courierId); load(); } catch (e) { setError(errText(e)); }
  };
  const release = async (o) => {
    const ok = await confirm({ title: 'Kuryerdan qaytarilsinmi?', content: `#${o.number ?? ''} buyurtma qutiga qaytadi va boshqa kuryer olishi mumkin.`, okText: 'Qaytarish' });
    if (!ok) return;
    try { await adminApi.releaseCourier(o.id); load(); } catch (e) { setError(errText(e)); }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={district} onChange={(e) => setDistrict(e.target.value)} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
          <option value="">Barcha tumanlar</option>
          {districts.map((d) => <option key={d.id} value={d.id}>{d.uz}</option>)}
        </select>
        <button onClick={load} className="rounded-lg border border-line px-3 py-2 text-sm"><i className="ti ti-refresh" /> Yangilash</button>
        <span className="text-xs text-muted">Har 15 soniyada avtomatik yangilanadi</span>
      </div>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      {!data ? <div className="py-10 text-center text-sm text-muted">Yuklanmoqda...</div> : (
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Qutida — kuryer kutilmoqda ({data.waiting.length})</h3>
            {data.waiting.length === 0 && <div className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-muted">Bo‘sh</div>}
            <div className="space-y-2">
              {data.waiting.map((o) => (
                <div key={o.id} className="rounded-xl border border-line bg-surface p-3 text-sm">
                  <div className="flex items-center justify-between"><b className="text-ink">#{o.number ?? '—'} · {o.restaurant.name}</b><span className="text-xs text-muted">{ORDER_STATUS[o.status] || o.status}</span></div>
                  <div className="mt-1 text-xs text-muted">{o.itemsSummary}</div>
                  <div className="mt-1 text-xs text-muted">
                    {districtName(districts, o.district)}{o.distanceKm != null ? ` · ~${o.distanceKm} km` : ''} · kuryerga {som(o.earningSom)}
                    {o.paymentMethod === 'cash' ? ` · naqd ${som(o.cashToCollectSom)}` : ' · karta'}{o.freeDelivery ? ' · tekin yetkazish' : ''}
                  </div>
                  <select defaultValue="" onChange={(e) => assign(o.id, e.target.value)} className="mt-2 w-full rounded-lg border border-line px-2 py-1.5 text-xs">
                    <option value="">Kuryerga berish…</option>
                    {couriers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.onShift ? ' · smenada' : ''}{(c.workDistricts || []).includes(o.district) ? '' : ' · boshqa tuman'}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Kuryerda ({data.assigned.length})</h3>
            {data.assigned.length === 0 && <div className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-muted">Bo‘sh</div>}
            <div className="space-y-2">
              {data.assigned.map((o) => (
                <div key={o.id} className="rounded-xl border border-line bg-surface p-3 text-sm">
                  <div className="flex items-center justify-between"><b className="text-ink">#{o.number ?? '—'} · {o.restaurantName}</b><span className="text-xs text-muted">{ORDER_STATUS[o.status] || o.status}</span></div>
                  <div className="mt-1 text-xs text-muted">{o.itemsLine}</div>
                  <div className="mt-1 text-xs text-muted">{o.courier ? `${o.courier.name} · ${o.courier.phone || ''}` : '—'}{o.paymentMethod === 'cash' ? ` · naqd ${som(o.cashToCollectSom)}` : ''}</div>
                  {!o.pickedUpAt && <button onClick={() => release(o)} className="mt-2 text-xs text-red-600 hover:underline">Qutiga qaytarish</button>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─────────────── Nazorat: shubhali voqealar va buyurtma izi ─────────────── */
function ControlView() {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState('');
  const [trace, setTrace] = useState(null);
  const load = useCallback(() => adminApi.getCourierEvents().then((r) => { setEvents(r.events); setError(''); }).catch((e) => setError(errText(e))), []);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  const open = async (orderId) => {
    try { setTrace(await adminApi.getCourierTrace(orderId)); } catch (e) { setError(errText(e)); }
  };
  return (
    <>
      <p className="mb-3 text-sm text-muted">Kuryer «taomni oldim» yoki «topshirdim»ni restoran/mijoz manzilidan uzoqda (yoki joylashuvsiz) bosgan voqealar. Bloklanmaydi — GPS xato berishi mumkin — lekin shu yerda ko‘rinadi.</p>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      {!events ? <div className="py-10 text-center text-sm text-muted">Yuklanmoqda...</div> : events.length === 0
        ? <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">Shubhali voqea yo‘q ✓</div> : (
          <div className="divide-y divide-line rounded-xl border border-line bg-surface">
            {events.map((e) => (
              <button key={e.id} onClick={() => open(e.orderId)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-canvas" data-testid="flagged-event">
                <div className="min-w-0">
                  <div className="text-ink"><b>{e.courierName || 'Kuryer'}</b> — {EVENT_LABEL[e.type] || e.type}</div>
                  <div className="truncate text-xs text-red-600">{FLAG_LABEL[e.flagReason] || e.flagReason}{e.targetDistanceM != null ? ` · maqsadgacha ${dist(e.targetDistanceM)}` : ''}</div>
                </div>
                <div className="flex-none text-xs text-muted">{fmtTime(e.at)}</div>
              </button>
            ))}
          </div>
        )}
      {trace && <TraceModal trace={trace} onClose={() => setTrace(null)} />}
    </>
  );
}

function TraceModal({ trace, onClose }) {
  const o = trace.order;
  const pts = trace.points.map((p) => ({ lat: p.lat, lng: p.lng }));
  const live = trace.courier ? [{ id: 'c', name: trace.courier.name, phone: trace.courier.phone, signal: 'ok', location: pts.length ? { ...pts[pts.length - 1] } : null, orders: [] }] : [];
  return (
    <Modal title={`Buyurtma #${o.number ?? ''} izi`} onClose={onClose} wide>
      <div className="mb-3 text-xs text-muted">{o.restaurant.name} → {o.customer.address} · {o.itemsLine} · kuryer: <b className="text-ink">{trace.courier?.name || '—'}</b> · yo‘l ~{dist(trace.distanceM)}</div>
      {pts.length > 1 && <div className="mb-3"><CourierLiveMap couriers={live} selectedId="c" track={pts} /></div>}
      <div className="divide-y divide-line rounded-xl border border-line">
        {trace.events.length === 0 && <div className="p-3 text-center text-sm text-muted">Voqea yo‘q</div>}
        {trace.events.map((e, i) => (
          <div key={i} className="px-3 py-2 text-sm">
            <div className="flex justify-between"><b className={e.flagged ? 'text-red-600' : 'text-ink'}>{EVENT_LABEL[e.type] || e.type}</b><span className="text-xs text-muted">{fmtTime(e.at)}</span></div>
            <div className="text-xs text-muted">
              {e.targetDistanceM != null ? `maqsadgacha ${dist(e.targetDistanceM)}` : e.lat ? 'joylashuv yozilgan' : 'joylashuv yo‘q'}
              {e.locAgeSec != null ? ` · nuqta ${e.locAgeSec} s oldin` : ''}{e.flagged ? ` · ⚠ ${FLAG_LABEL[e.flagReason] || e.flagReason}` : ''}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/* ─────────────── Sozlamalar (faqat bosh admin) ─────────────── */
function CourierSettings() {
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { adminApi.getCourierSettings().then(setS).catch((e) => setMsg({ type: 'err', text: errText(e) })); }, []);
  if (!s) return <div className="py-10 text-center text-sm text-muted">{msg?.text || 'Yuklanmoqda...'}</div>;
  const set = (k, v) => setS((x) => ({ ...x, [k]: v }));
  const save = async () => {
    const body = { commissionPercent: Number(s.commissionPercent), debtLimitSom: Number(s.debtLimitSom), maxActiveOrders: Number(s.maxActiveOrders) };
    if (!(body.commissionPercent >= 0 && body.commissionPercent <= 100)) return setMsg({ type: 'err', text: 'Foiz 0–100' });
    if (!(body.debtLimitSom >= 0)) return setMsg({ type: 'err', text: 'Naqd chegarasi noto‘g‘ri' });
    if (!(body.maxActiveOrders >= 1 && body.maxActiveOrders <= 10)) return setMsg({ type: 'err', text: 'Bir vaqtdagi buyurtmalar 1–10' });
    setSaving(true); setMsg(null);
    try { setS(await adminApi.updateCourierSettings(body)); setMsg({ type: 'ok', text: 'Saqlandi. Yangi buyurtmalarga qo‘llanadi.' }); }
    catch (e) { setMsg({ type: 'err', text: errText(e) }); }
    setSaving(false);
  };
  const ex = Math.round(30000 * (1 - Number(s.commissionPercent || 0) / 100));
  return (
    <div className="max-w-md rounded-2xl border border-line bg-surface p-5">
      <Field label="LokmaGo foizi (har yetkazishdan), %" hint={`Masalan yetkazish 30 000 so‘m → kuryerga ${ex.toLocaleString('ru-RU')} so‘m. Restoranga alohida foiz uning sozlamalarida beriladi.`}>
        <input type="number" min="0" max="100" step="0.5" value={s.commissionPercent} onChange={(e) => set('commissionPercent', e.target.value)} className={inputCls} />
      </Field>
      <Field label="Naqd chegarasi (so‘m)" hint="Kuryer qo‘lidagi LokmaGo puli shundan oshsa — yangi naqd buyurtma olmaydi (avval topshiradi). 0 — oldindan to‘ldirilgan balans talab qilinadi.">
        <input type="number" min="0" step="10000" value={s.debtLimitSom} onChange={(e) => set('debtLimitSom', e.target.value)} className={inputCls} />
      </Field>
      <Field label="Bir vaqtda nechta buyurtma" hint="Mobil ilova hozircha bitta faol buyurtmani ko‘rsatadi — 1 qoldiring.">
        <input type="number" min="1" max="10" value={s.maxActiveOrders} onChange={(e) => set('maxActiveOrders', e.target.value)} className={inputCls} />
      </Field>
      {msg && <div className={`mb-3 rounded-lg px-3 py-2 text-sm ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{msg.text}</div>}
      <button onClick={save} disabled={saving} className="rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-brand-text disabled:opacity-50">{saving ? '...' : 'Saqlash'}</button>
    </div>
  );
}
