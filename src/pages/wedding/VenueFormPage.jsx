import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { weddingApi } from '@/api';
import { MoneyInput } from '@/components/form/NumberInput';
import { ImageUpload } from '@/components/ImageUpload';
import { confirm } from '@/components/ui/confirm';
import {
  PageHeader, ErrorBox, Section, Field, Badge, SubBadge, VENUE_STATUS, SESSION_LABEL, EVENT_LABEL,
  SESSION_HINT, SESSION_ICON, PRICING_MODE,
  PAY_METHOD, som, fmtDate,
} from './common';
import { PaymentModal } from './PaymentModal';

/*
 * ═══ TO'YXONA: yaratish / tahrirlash ═══
 * To'yxona serveri sxemasi (venue.model.ts) bo'yicha to'liq: asosiy ma'lumot,
 * joylashuv, egasi, rasmlar, qulayliklar, zallar, seanslar, menyu, narx
 * qoidalari, oylik to'lov. Tahrirda — to'lovlar tarixi va to'lov qo'shish.
 */
const AMENITIES = ['Avtoturargoh', 'Konditsioner', 'Sahna', 'Jonli musiqa', 'Ovoz tizimi', 'Yorug‘lik shousi',
  'Kelin xonasi', 'Bolalar xonasi', 'Namozxona', 'Wi-Fi', 'Generator', 'Nogironlar uchun kirish', 'Bezak xizmati', 'Ochiq maydon'];

const EMPTY = {
  name: '', slug: '', district: '', address: '', phone: '', description: '',
  lat: '', lng: '', photos: [], amenities: [], parking_spots: 0,
  halls: [{ name: 'Asosiy zal', capacity_min: 150, capacity_max: 500 }],
  /*
   * 3 asosiy seans + maxsus tadbir. Narx turi har seansda alohida:
   * mehmon boshiga / aniq narx / kelishiladi (server lib/sessions.ts).
   */
  sessions: [
    { code: 'morning', on: true, start_time: '06:00', end_time: '10:00', event_types: ['nahorgi_osh'], price_factor: 0.6, min_guests: 100, pricing_mode: 'per_guest', fixed_price: 0, note: '' },
    { code: 'day', on: true, start_time: '12:00', end_time: '16:00', event_types: ['nikoh', 'kunduzgi'], price_factor: 0.8, min_guests: 100, pricing_mode: 'per_guest', fixed_price: 0, note: '' },
    { code: 'evening', on: true, start_time: '18:00', end_time: '23:00', event_types: ['kechki'], price_factor: 1, min_guests: 150, pricing_mode: 'per_guest', fixed_price: 0, note: '' },
    { code: 'special', on: false, start_time: '10:00', end_time: '22:00', event_types: ['tadbir'], price_factor: 1, min_guests: 1, pricing_mode: 'negotiable', fixed_price: 0, note: 'Konsert, shou, majlislar — narx kelishiladi' },
  ],
  menu_packages: [{ name: 'Standart', items_text: '', price_per_guest: 150000 }],
  weekend_factor: 1.15, deposit_percent: 30, guests_min: 150, status: 'active',
  owner: { name: '', phone: '', telegram: '', note: '' },
  subscription: { monthly_fee: 0, billing_start: '' },
};

// Lotin slug: "Navro'z Saroyi" → "navroz-saroyi"
const slugify = (s) => String(s || '').toLowerCase()
  .replace(/[ʻʼ'`‘’]/g, '').replace(/o‘|g‘/g, (m) => m[0])
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

function fromServer(v) {
  const sessions = EMPTY.sessions.map((def) => {
    const s = (v.sessions || []).find((x) => x.code === def.code);
    return s ? { ...def, ...s, on: true } : { ...def, on: false };
  });
  return {
    ...EMPTY, ...v,
    lat: v.lat ?? '', lng: v.lng ?? '',
    sessions,
    owner: { ...EMPTY.owner, ...(v.owner || {}) },
    subscription: { monthly_fee: v.subscription?.monthly_fee || 0, billing_start: v.subscription?.billing_start || '' },
    status: v.status === 'blocked' ? 'active' : v.status, // blok alohida tugma bilan boshqariladi
  };
}

export function VenueFormPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const [f, setF] = useState(EMPTY);
  const [server, setServer] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(null);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [payments, setPayments] = useState([]);
  const [payOpen, setPayOpen] = useState(false);

  const loadPayments = useCallback(() => {
    if (isNew) return;
    weddingApi.payments({ venue_id: id }).then(setPayments).catch(() => {});
  }, [id, isNew]);

  useEffect(() => {
    if (isNew) return;
    weddingApi.venue(id)
      .then((v) => { setServer(v); setF(fromServer(v)); })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
    loadPayments();
  }, [id, isNew, loadPayments]);

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setIn = (k, sub, v) => setF((x) => ({ ...x, [k]: { ...x[k], [sub]: v } }));
  const setArr = (k, i, patch) => setF((x) => ({ ...x, [k]: x[k].map((it, j) => (j === i ? { ...it, ...patch } : it)) }));
  const addArr = (k, item) => setF((x) => ({ ...x, [k]: [...x[k], item] }));
  const delArr = (k, i) => setF((x) => ({ ...x, [k]: x[k].filter((_, j) => j !== i) }));

  const validate = () => {
    if (f.name.trim().length < 2) return 'Nomini kiriting';
    if (!/^[a-z0-9-]+$/.test(f.slug)) return 'Havola nomi (slug) faqat lotin harf, raqam va "-"';
    if (f.district.trim().length < 2) return 'Tumanni kiriting';
    const lat = Number(f.lat); const lng = Number(f.lng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180 || (!lat && !lng)) return 'Koordinatani kiriting (xaritadan)';
    if (!f.halls.length) return 'Kamida bitta zal kerak';
    for (const h of f.halls) {
      if (!h.name.trim()) return 'Zal nomini kiriting';
      if (!(h.capacity_min > 0) || !(h.capacity_max >= h.capacity_min)) return `"${h.name}" sig'imi noto'g'ri`;
    }
    const ss = f.sessions.filter((s) => s.on);
    if (!ss.length) return 'Kamida bitta seans yoqilgan bo‘lsin';
    for (const s of ss) {
      if (!/^\d{2}:\d{2}$/.test(s.start_time) || !/^\d{2}:\d{2}$/.test(s.end_time)) return `${SESSION_LABEL[s.code]}: vaqt noto'g'ri`;
      if (!s.event_types.length) return `${SESSION_LABEL[s.code]}: tadbir turini tanlang`;
      if (s.pricing_mode === 'fixed' && !(Number(s.fixed_price) > 0)) return `${SESSION_LABEL[s.code]}: aniq narxni kiriting`;
    }
    if (!f.menu_packages.length) return 'Kamida bitta menyu paketi kerak';
    for (const m of f.menu_packages) if (!m.name.trim() || !(m.price_per_guest >= 0)) return 'Menyu paketi noto‘g‘ri';
    return null;
  };

  const save = async () => {
    const v = validate();
    if (v) { setErr(v); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    setErr(null); setSaving(true);
    const payload = {
      name: f.name.trim(), slug: f.slug, district: f.district.trim(), address: f.address.trim(),
      phone: f.phone.trim(), description: f.description.trim(),
      lat: Number(f.lat), lng: Number(f.lng),
      photos: f.photos.filter(Boolean), amenities: f.amenities, parking_spots: Number(f.parking_spots) || 0,
      halls: f.halls.map((h) => ({ name: h.name.trim(), capacity_min: Number(h.capacity_min), capacity_max: Number(h.capacity_max) })),
      sessions: f.sessions.filter((s) => s.on).map(({ on, ...s }) => ({
        code: s.code, start_time: s.start_time, end_time: s.end_time, event_types: s.event_types,
        price_factor: Number(s.price_factor) || 1, min_guests: Number(s.min_guests) || 1,
        pricing_mode: s.pricing_mode || 'per_guest',
        fixed_price: s.pricing_mode === 'fixed' ? Number(s.fixed_price) || 0 : 0,
        note: (s.note || '').trim(),
      })),
      menu_packages: f.menu_packages.map((m) => ({ name: m.name.trim(), items_text: m.items_text || '', price_per_guest: Number(m.price_per_guest) || 0 })),
      weekend_factor: Number(f.weekend_factor), deposit_percent: Number(f.deposit_percent), guests_min: Number(f.guests_min),
      owner: { name: f.owner.name.trim(), phone: f.owner.phone.trim(), telegram: f.owner.telegram.trim().replace(/^@/, ''), note: f.owner.note.trim() },
      subscription: { monthly_fee: Number(f.subscription.monthly_fee) || 0, billing_start: f.subscription.billing_start || '' },
    };
    if (server?.status !== 'blocked') payload.status = f.status;
    try {
      if (isNew) {
        const created = await weddingApi.createVenue(payload);
        navigate(`/weddings/venues/${created._id}`, { replace: true });
      } else {
        const updated = await weddingApi.updateVenue(id, payload);
        setServer(updated); setF(fromServer(updated));
        setOk('Saqlandi'); setTimeout(() => setOk(null), 2500);
      }
    } catch (e) { setErr(e.message); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    finally { setSaving(false); }
  };

  const removePayment = async (p) => {
    if (!await confirm({ title: `${som(p.amount)} so'mlik to'lov o'chirilsinmi?`, tone: 'danger' })) return;
    try {
      const r = await weddingApi.deletePayment(p._id);
      setPayments((l) => l.filter((x) => x._id !== p._id));
      setServer((s) => s && ({ ...s, subscription: { ...s.subscription, paid_until: r.paid_until } }));
      weddingApi.venue(id).then(setServer).catch(() => {});
    } catch (e) { setErr(e.message); }
  };

  if (loading) return <div className="flex-1 p-6 text-sm text-muted">Yuklanmoqda...</div>;

  const st = server ? VENUE_STATUS[server.status] : null;
  const inp = 'inp';

  return (
    <div className="flex-1 p-4 sm:p-6 min-w-0 max-w-4xl">
      <button onClick={() => navigate('/weddings/venues')} className="text-sm text-muted hover:text-ink mb-3 flex items-center gap-1">
        <i className="ti ti-arrow-left" /> To'yxonalar
      </button>
      <PageHeader title={isNew ? "Yangi to'yxona" : f.name || "To'yxona"} subtitle={server && (
        <span className="inline-flex items-center gap-1.5 flex-wrap">
          <Badge cls={st.cls}>{st.label}</Badge><SubBadge s={server.subscription_state} />
          {server.status === 'blocked' && server.block_reason && <span className="text-red-600">· {server.block_reason}</span>}
        </span>
      )}>
        <button onClick={save} disabled={saving}
          className="bg-brand-400 text-brand-text font-medium px-5 py-2.5 rounded-xl hover:bg-brand-600 hover:text-white disabled:opacity-50">
          {saving ? 'Saqlanmoqda...' : isNew ? 'Yaratish' : 'Saqlash'}
        </button>
      </PageHeader>

      <ErrorBox error={err} />
      {ok && <div className="mb-4 rounded-xl bg-green-50 text-green-700 px-3 py-2.5 text-sm"><i className="ti ti-check" /> {ok}</div>}

      <Section title="Asosiy ma'lumot" icon="ti-info-circle">
        <div className="grid sm:grid-cols-2 gap-x-3">
          <Field label="Nomi *">
            <input className={inp} value={f.name} onChange={(e) => { set('name', e.target.value); if (!slugTouched) set('slug', slugify(e.target.value)); }} placeholder="Navro'z saroyi" />
          </Field>
          <Field label="Havola nomi (slug) *" hint="Ilovadagi manzil: lotin, raqam, -">
            <input className={inp} value={f.slug} onChange={(e) => { setSlugTouched(true); set('slug', slugify(e.target.value)); }} placeholder="navroz-saroyi" />
          </Field>
          <Field label="Tuman *"><input className={inp} value={f.district} onChange={(e) => set('district', e.target.value)} placeholder="Chilonzor" /></Field>
          <Field label="Telefon (mijozlar uchun)"><input className={inp} value={f.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" placeholder="+998 90 123 45 67" /></Field>
          <Field label="Manzil" className="sm:col-span-2"><input className={inp} value={f.address} onChange={(e) => set('address', e.target.value)} /></Field>
          <Field label="Tavsif" className="sm:col-span-2">
            <textarea className={`${inp} resize-none`} rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
          <Field label="Kenglik (lat) *"><input className={inp} value={f.lat} onChange={(e) => set('lat', e.target.value)} inputMode="decimal" placeholder="41.2995" /></Field>
          <Field label="Uzunlik (lng) *" hint={<>Google/Yandex xaritada nuqtani bosib nusxalang{f.lat && f.lng && <> · <a className="text-brand-600 underline" target="_blank" rel="noreferrer" href={`https://yandex.uz/maps/?pt=${f.lng},${f.lat}&z=17`}>xaritada ko'rish</a></>}</>}>
            <input className={inp} value={f.lng} onChange={(e) => set('lng', e.target.value)} inputMode="decimal" placeholder="69.2401" />
          </Field>
          <Field label="Ko'rinish">
            <select className={inp} value={f.status} onChange={(e) => set('status', e.target.value)} disabled={server?.status === 'blocked'}>
              <option value="active">Faol — mijozlarga ko'rinadi</option>
              <option value="hidden">Yashirin — vaqtincha ko'rinmaydi</option>
            </select>
          </Field>
          <Field label="Avtoturargoh (joy)"><input className={inp} type="number" min="0" value={f.parking_spots} onChange={(e) => set('parking_spots', e.target.value)} /></Field>
        </div>
      </Section>

      <Section title="Rasmlar" icon="ti-photo" right={<span className="text-xs text-muted">{f.photos.length}/20</span>}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {f.photos.map((url, i) => (
            <div key={url + i} className="relative rounded-xl overflow-hidden border border-line aspect-[4/3]">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button onClick={() => set('photos', f.photos.filter((_, j) => j !== i))}
                className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center" aria-label="O'chirish">
                <i className="ti ti-x text-sm" />
              </button>
              {i === 0 && <span className="absolute bottom-1.5 left-1.5 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">Asosiy</span>}
            </div>
          ))}
          {f.photos.length < 20 && (
            <ImageUpload key={f.photos.length} value="" onChange={(url) => url && set('photos', [...f.photos, url])} folder="weddings" label="Rasm qo'shish" aspect="4/3" />
          )}
        </div>
      </Section>

      <Section title="Qulayliklar" icon="ti-sparkles">
        <div className="flex flex-wrap gap-2">
          {[...new Set([...AMENITIES, ...f.amenities])].map((a) => {
            const on = f.amenities.includes(a);
            return (
              <button key={a} type="button" onClick={() => set('amenities', on ? f.amenities.filter((x) => x !== a) : [...f.amenities, a])}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium ${on ? 'border-brand-400 bg-brand-100 text-brand-text' : 'border-line text-muted'}`}>
                {on && <i className="ti ti-check" />} {a}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Zallar" icon="ti-layout-board" right={
        <button onClick={() => addArr('halls', { name: '', capacity_min: 100, capacity_max: 300 })} className="text-sm text-brand-600 font-medium"><i className="ti ti-plus" /> Zal</button>
      }>
        {f.halls.map((h, i) => (
          <div key={i} className="grid grid-cols-[1fr_90px_90px_auto] gap-2 items-end mb-2">
            <Field label={i === 0 ? 'Nomi' : ''} className="mb-0"><input className={inp} value={h.name} onChange={(e) => setArr('halls', i, { name: e.target.value })} placeholder="Katta zal" /></Field>
            <Field label={i === 0 ? 'Kamida' : ''} className="mb-0"><input className={inp} type="number" min="1" value={h.capacity_min} onChange={(e) => setArr('halls', i, { capacity_min: Number(e.target.value) })} /></Field>
            <Field label={i === 0 ? "Ko'pi bilan" : ''} className="mb-0"><input className={inp} type="number" min="1" value={h.capacity_max} onChange={(e) => setArr('halls', i, { capacity_max: Number(e.target.value) })} /></Field>
            <button onClick={() => delArr('halls', i)} disabled={f.halls.length === 1} className="h-10 w-10 rounded-lg border border-line text-red-500 disabled:opacity-30" aria-label="O'chirish"><i className="ti ti-trash" /></button>
          </div>
        ))}
        {!isNew && <p className="text-[11px] text-muted mt-1">Zalni o'chirish bronlar tarixiga ta'sir qilmaydi, lekin uning kalendari yo'qoladi.</p>}
      </Section>

      <Section title="Seanslar" icon="ti-clock" right={<span className="text-[11px] text-muted">{f.sessions.filter((x) => x.on).length} ta yoqilgan</span>}>
        <div className="grid gap-3 lg:grid-cols-2">
          {f.sessions.map((s, i) => <SessionCard key={s.code} s={s} onChange={(patch) => setArr('sessions', i, patch)} />)}
        </div>
      </Section>

      <Section title="Menyu paketlari" icon="ti-tools-kitchen-2" right={
        <button onClick={() => addArr('menu_packages', { name: '', items_text: '', price_per_guest: 0 })} className="text-sm text-brand-600 font-medium"><i className="ti ti-plus" /> Paket</button>
      }>
        {f.menu_packages.map((m, i) => (
          <div key={i} className="rounded-xl border border-line p-3 mb-2">
            <div className="grid grid-cols-[1fr_150px_auto] gap-2 items-end">
              <Field label="Nomi" className="mb-0"><input className={inp} value={m.name} onChange={(e) => setArr('menu_packages', i, { name: e.target.value })} placeholder="Premium" /></Field>
              <Field label="1 mehmonga (so'm)" className="mb-0"><MoneyInput value={m.price_per_guest} onChange={(v) => setArr('menu_packages', i, { price_per_guest: v || 0 })} /></Field>
              <button onClick={() => delArr('menu_packages', i)} disabled={f.menu_packages.length === 1} className="h-10 w-10 rounded-lg border border-line text-red-500 disabled:opacity-30" aria-label="O'chirish"><i className="ti ti-trash" /></button>
            </div>
            <textarea className={`${inp} resize-none mt-2`} rows={2} value={m.items_text} onChange={(e) => setArr('menu_packages', i, { items_text: e.target.value })} placeholder="Tarkibi: osh, salatlar, shirinlik..." />
          </div>
        ))}
      </Section>

      <Section title="Narx qoidalari" icon="ti-calculator">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Dam olish kuni ×" hint="Shanba-yakshanba"><input className={inp} type="number" step="0.05" min="1" max="3" value={f.weekend_factor} onChange={(e) => set('weekend_factor', e.target.value)} /></Field>
          <Field label="Avans %"><input className={inp} type="number" min="0" max="100" value={f.deposit_percent} onChange={(e) => set('deposit_percent', e.target.value)} /></Field>
          <Field label="Min. mehmon"><input className={inp} type="number" min="1" value={f.guests_min} onChange={(e) => set('guests_min', e.target.value)} /></Field>
        </div>
      </Section>

      <Section title="Egasi / mas'ul shaxs" icon="ti-user" right={<span className="text-[11px] text-muted">mijozga ko'rinmaydi</span>}>
        <div className="grid sm:grid-cols-3 gap-x-3">
          <Field label="Ism"><input className={inp} value={f.owner.name} onChange={(e) => setIn('owner', 'name', e.target.value)} /></Field>
          <Field label="Telefon"><input className={inp} value={f.owner.phone} onChange={(e) => setIn('owner', 'phone', e.target.value)} inputMode="tel" /></Field>
          <Field label="Telegram"><input className={inp} value={f.owner.telegram} onChange={(e) => setIn('owner', 'telegram', e.target.value)} placeholder="@username" /></Field>
          <Field label="Izoh" className="sm:col-span-3"><input className={inp} value={f.owner.note} onChange={(e) => setIn('owner', 'note', e.target.value)} placeholder="Shartnoma raqami, kelishuvlar" /></Field>
        </div>
      </Section>

      <Section title="Oylik to'lov" icon="ti-receipt" right={!isNew && (
        <button onClick={() => setPayOpen(true)} className="text-sm bg-green-600 text-white px-3 py-1.5 rounded-lg"><i className="ti ti-plus" /> To'lov qabul qilish</button>
      )}>
        <div className="grid sm:grid-cols-3 gap-x-3">
          <Field label="Oylik to'lov (so'm)" hint="0 — bepul"><MoneyInput value={f.subscription.monthly_fee} onChange={(v) => setIn('subscription', 'monthly_fee', v || 0)} /></Field>
          <Field label="Hisob boshlanadi (oy)"><input className={inp} type="month" value={f.subscription.billing_start} onChange={(e) => setIn('subscription', 'billing_start', e.target.value)} /></Field>
          <Field label="To'langan muddat">
            <div className="h-10 flex items-center text-sm text-ink">{server?.subscription?.paid_until || '—'}</div>
          </Field>
        </div>
        {!isNew && (
          payments.length === 0 ? <p className="text-xs text-muted">To'lovlar hali yo'q.</p> : (
            <div className="divide-y divide-line border border-line rounded-xl">
              {payments.map((p) => (
                <div key={p._id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-ink">{som(p.amount)} so'm <span className="text-xs font-normal text-muted">· {PAY_METHOD[p.method] || p.method}</span></div>
                    <div className="text-xs text-muted">{p.period_from}{p.months > 1 ? ` dan ${p.months} oy` : ''} · {fmtDate(p.paid_at)}{p.note && ` · ${p.note}`}</div>
                  </div>
                  <button onClick={() => removePayment(p)} className="w-8 h-8 rounded-lg border border-line text-red-500" aria-label="O'chirish"><i className="ti ti-trash" /></button>
                </div>
              ))}
            </div>
          )
        )}
        {isNew && <p className="text-xs text-muted">To'lovlarni to'yxona yaratilgandan keyin qabul qilasiz.</p>}
      </Section>

      <div className="flex justify-end pb-6">
        <button onClick={save} disabled={saving} className="bg-brand-400 text-brand-text font-medium px-6 py-3 rounded-xl hover:bg-brand-600 hover:text-white disabled:opacity-50">
          {saving ? 'Saqlanmoqda...' : isNew ? "To'yxonani yaratish" : 'Saqlash'}
        </button>
      </div>

      {payOpen && server && (
        <PaymentModal
          venue={server}
          onClose={() => setPayOpen(false)}
          onSaved={() => { setPayOpen(false); loadPayments(); weddingApi.venue(id).then(setServer).catch(() => {}); }}
        />
      )}
    </div>
  );
}



/*
 * Seans kartasi — telefonga moslangan: hamma maydon to'liq kenglikda,
 * vaqtlar ikki ustunda (min-w-0 — iOS vaqt maydoni kartadan chiqib ketmaydi),
 * narx turi segment tugma bilan, faqat kerakli maydonlar ko'rinadi.
 */
function SessionCard({ s, onChange }) {
  const mode = s.pricing_mode || 'per_guest';
  return (
    <div className={`min-w-0 rounded-2xl border p-3.5 transition-colors ${s.on ? 'border-line bg-surface' : 'border-dashed border-line bg-canvas/60'}`}>
      <button type="button" onClick={() => onChange({ on: !s.on })} className="flex w-full items-center gap-3 text-left">
        <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${s.on ? 'bg-brand-100 text-brand-text' : 'bg-canvas text-muted'}`}>
          <i className={`ti ${SESSION_ICON[s.code]} text-xl`} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-[15px] font-semibold ${s.on ? 'text-ink' : 'text-muted'}`}>{SESSION_LABEL[s.code]}</span>
          <span className="block truncate text-xs text-muted">{SESSION_HINT[s.code]}</span>
        </span>
        {/* Yoqish/o'chirish */}
        <span className={`relative h-6 w-11 flex-none rounded-full transition-colors ${s.on ? 'bg-green-500' : 'bg-black/15'}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${s.on ? 'left-[22px]' : 'left-0.5'}`} />
        </span>
      </button>

      {s.on && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="min-w-0">
              <span className="mb-1 block text-xs font-medium text-ink">Boshlanish</span>
              <input className="inp w-full min-w-0 text-center" type="time" value={s.start_time} onChange={(e) => onChange({ start_time: e.target.value })} />
            </label>
            <label className="min-w-0">
              <span className="mb-1 block text-xs font-medium text-ink">Tugash</span>
              <input className="inp w-full min-w-0 text-center" type="time" value={s.end_time} onChange={(e) => onChange({ end_time: e.target.value })} />
            </label>
          </div>

          <div>
            <span className="mb-1 block text-xs font-medium text-ink">Narx</span>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-canvas p-1">
              {Object.entries(PRICING_MODE).map(([k, m]) => (
                <button key={k} type="button" onClick={() => onChange({ pricing_mode: k })}
                  className={`rounded-lg px-1 py-2 text-[12px] font-semibold leading-tight ${mode === k ? 'bg-white text-ink shadow-sm' : 'text-muted'}`}>
                  {m.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-muted">{PRICING_MODE[mode].hint}</p>
          </div>

          {mode === 'per_guest' && (
            <div className="grid grid-cols-2 gap-2">
              <label className="min-w-0">
                <span className="mb-1 block text-xs font-medium text-ink">Koeffitsient</span>
                <input className="inp w-full min-w-0" type="number" inputMode="decimal" step="0.05" min="0.1" max="5" value={s.price_factor} onChange={(e) => onChange({ price_factor: e.target.value })} />
              </label>
              <label className="min-w-0">
                <span className="mb-1 block text-xs font-medium text-ink">Min. mehmon</span>
                <input className="inp w-full min-w-0" type="number" inputMode="numeric" min="1" value={s.min_guests} onChange={(e) => onChange({ min_guests: e.target.value })} />
              </label>
            </div>
          )}
          {mode === 'fixed' && (
            <div className="grid grid-cols-2 gap-2">
              <label className="min-w-0">
                <span className="mb-1 block text-xs font-medium text-ink">Seans narxi (so'm)</span>
                <MoneyInput value={s.fixed_price || null} onChange={(v) => onChange({ fixed_price: v || 0 })} placeholder="25 000 000" />
              </label>
              <label className="min-w-0">
                <span className="mb-1 block text-xs font-medium text-ink">Min. mehmon</span>
                <input className="inp w-full min-w-0" type="number" inputMode="numeric" min="1" value={s.min_guests} onChange={(e) => onChange({ min_guests: e.target.value })} />
              </label>
            </div>
          )}
          {mode === 'negotiable' && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink">Mijozga izoh</span>
              <input className="inp w-full" value={s.note || ''} maxLength={200} onChange={(e) => onChange({ note: e.target.value })} placeholder="Narx kelishiladi — qo'ng'iroq qiling" />
            </label>
          )}

          <div>
            <span className="mb-1 block text-xs font-medium text-ink">Tadbir turlari</span>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(EVENT_LABEL).map(([k, l]) => {
                const on = s.event_types.includes(k);
                return (
                  <button key={k} type="button" onClick={() => onChange({ event_types: on ? s.event_types.filter((x) => x !== k) : [...s.event_types, k] })}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${on ? 'border-brand-400 bg-brand-100 text-brand-text' : 'border-line text-muted'}`}>
                    {on && <i className="ti ti-check mr-0.5" />}{l}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
