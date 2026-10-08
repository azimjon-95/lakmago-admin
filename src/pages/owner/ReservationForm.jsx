import { useEffect, useState, useMemo } from 'react';
import { ownerApi } from '@/api';
import { MoneyInput } from '@/components/form/NumberInput';
import { confirm } from '@/components/ui/confirm';
import { Modal, Field, SESSION_LABEL, EVENT_LABEL, PRICING_MODE, som, todayIso } from '@/pages/wedding/common';

/*
 * Seansni band qilish / tahrirlash (egasi).
 *   Holat: Band / Kelishilmoqda / Yopiq (ta'mir va h.k.)
 *   Narx: mehmon boshiga (mehmon × narx) yoki aniq summa
 *   To'lovlar: avans, qolgani, qaytarish — naqd / karta / hisob raqamiga
 * Ilova orqali kelgan bron — faqat ko'rish (o'zgartirish admin orqali).
 */
const METHOD = { cash: 'Naqd', card: 'Karta', transfer: 'Hisob raqamiga', click: 'Click', payme: 'Payme', other: 'Boshqa' };
const KIND = { deposit: 'Avans', payment: "To'lov", refund: 'Qaytarildi' };
const STATUS = { booked: 'Band', tentative: 'Kelishilmoqda', closed: 'Yopiq' };

export function ReservationForm({ venue, date, hallId, session, entry, onClose, onSaved }) {
  const isBooking = entry?.kind === 'booking';
  const isAdminClosed = entry?.kind === 'closed';
  const isEdit = entry?.kind === 'reservation';
  const sessionCfg = venue?.sessions?.find((s) => s.code === session);
  const defaultMode = sessionCfg?.pricing_mode === 'fixed' ? 'fixed' : sessionCfg?.pricing_mode === 'negotiable' ? 'negotiable' : 'per_guest';

  const [f, setF] = useState({
    status: 'booked', customer_name: '', customer_phone: '', event_type: sessionCfg?.event_types?.[0] || '',
    guests: '', pricing_mode: defaultMode, price_per_guest: null,
    total_price: sessionCfg?.pricing_mode === 'fixed' ? sessionCfg.fixed_price || null : null,
    payments: [], description: '',
  });
  const [loading, setLoading] = useState(isEdit || isBooking);
  const [booking, setBooking] = useState(null);
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pay, setPay] = useState({ amount: null, method: 'cash', kind: 'deposit', date: todayIso(), note: '' });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (isEdit) {
      ownerApi.reservation(entry.id).then((r) => setF({
        status: r.status, customer_name: r.customer_name || '', customer_phone: r.customer_phone || '',
        event_type: r.event_type || '', guests: r.guests || '', pricing_mode: r.pricing_mode || 'per_guest',
        price_per_guest: r.price_per_guest || null, total_price: r.total_price || null,
        payments: (r.payments || []).map(({ _id, ...p }) => p), description: r.description || '',
      })).catch((e) => setErr(e.message)).finally(() => setLoading(false));
    } else if (isBooking) {
      ownerApi.booking(entry.id).then(setBooking).catch((e) => setErr(e.message)).finally(() => setLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, isBooking, entry?.id]);

  // Mehmon boshiga bo'lsa — jami avtomatik
  const total = useMemo(() => {
    if (f.pricing_mode === 'per_guest') return (Number(f.guests) || 0) * (Number(f.price_per_guest) || 0);
    return Number(f.total_price) || 0;
  }, [f]);
  const paid = f.payments.reduce((s, p) => s + (p.kind === 'refund' ? -p.amount : p.amount), 0);

  const addPayment = () => {
    if (!(pay.amount > 0)) { setErr("To'lov summasini kiriting"); return; }
    setErr(null);
    setF((x) => ({ ...x, payments: [...x.payments, { ...pay, amount: Number(pay.amount) }] }));
    setPay((p) => ({ ...p, amount: null, kind: 'payment', note: '' }));
  };

  const save = async () => {
    if (f.status !== 'closed' && !f.customer_name.trim()) { setErr('Mijoz ismini kiriting'); return; }
    setErr(null); setSaving(true);
    // Yozilgan, lekin "To'lov qo'shish" bosilmagan to'lov ham saqlanadi
    const payments = pay.amount > 0 ? [...f.payments, { ...pay, amount: Number(pay.amount) }] : f.payments;
    const body = {
      hall_id: hallId, date, session, status: f.status,
      ...(f.event_type ? { event_type: f.event_type } : {}),
      customer_name: f.customer_name.trim(), customer_phone: f.customer_phone.trim(),
      guests: Number(f.guests) || 0, pricing_mode: f.pricing_mode,
      price_per_guest: f.pricing_mode === 'per_guest' ? Number(f.price_per_guest) || 0 : 0,
      total_price: total, payments, description: f.description.trim(),
    };
    try {
      if (isEdit) await ownerApi.updateReservation(entry.id, body);
      else await ownerApi.createReservation(body);
      onSaved();
    } catch (e) { setErr(e.message); setSaving(false); }
  };

  const remove = async () => {
    if (!await confirm({ title: 'Bron o‘chirilsinmi? Seans bo‘shaydi.', tone: 'danger' })) return;
    setSaving(true);
    try { await ownerApi.deleteReservation(entry.id); onSaved(); } catch (e) { setErr(e.message); setSaving(false); }
  };

  const title = `${SESSION_LABEL[session]} · ${date.split('-').reverse().join('.')}`;

  if (isBooking || isAdminClosed) {
    return (
      <Modal title={title} onClose={onClose}>
        {isAdminClosed ? (
          <p className="text-sm text-muted">Bu seans administrator tomonidan yopilgan{entry.title ? `: ${entry.title}` : ''}.</p>
        ) : loading ? <div className="text-sm text-muted py-6 text-center">Yuklanmoqda...</div> : booking && (
          <div className="space-y-2 text-sm">
            <div className="rounded-xl bg-blue-50 text-blue-800 px-3 py-2 text-xs"><i className="ti ti-device-mobile" /> Lokma ilovasi orqali bron · #{booking.number}</div>
            <Row k="Mijoz" v={booking.customer_name} />
            <Row k="Telefon" v={<a href={`tel:${booking.customer_phone}`} className="text-brand-600">{booking.customer_phone}</a>} />
            <Row k="Mehmonlar" v={booking.guests} />
            <Row k="Menyu" v={booking.menu?.name} />
            <Row k="Jami" v={`${som(booking.total)} so'm`} />
            <Row k="Avans" v={`${som(booking.deposit)} so'm${booking.status === 'confirmed' ? ' · to‘langan' : ' · kutilmoqda'}`} />
            {booking.extras?.length > 0 && <Row k="Qo'shimcha" v={booking.extras.map((e) => e.name).join(', ')} />}
          </div>
        )}
        {err && <div className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</div>}
      </Modal>
    );
  }

  return (
    <Modal title={title} onClose={onClose} footer={(
      <>
        {isEdit && <button onClick={remove} disabled={saving} className="px-3 py-2.5 rounded-xl border border-red-200 text-red-600" aria-label="O'chirish"><i className="ti ti-trash" /></button>}
        <button onClick={onClose} className="px-4 py-2.5 border border-line text-muted rounded-xl">Bekor</button>
        <button onClick={save} disabled={saving || loading} className="flex-1 bg-brand-400 text-brand-text font-semibold py-2.5 rounded-xl disabled:opacity-50">
          {saving ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
      </>
    )}>
      {loading ? <div className="text-sm text-muted py-6 text-center">Yuklanmoqda...</div> : (
        <>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-canvas p-1 mb-3">
            {Object.entries(STATUS).map(([k, l]) => (
              <button key={k} type="button" onClick={() => set('status', k)}
                className={`rounded-lg py-2.5 text-sm font-semibold ${f.status === k ? (k === 'booked' ? 'bg-red-500 text-white' : k === 'tentative' ? 'bg-amber-400 text-ink' : 'bg-gray-500 text-white') : 'text-muted'}`}>{l}</button>
            ))}
          </div>

          {f.status !== 'closed' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Mijoz *"><input className="inp" value={f.customer_name} onChange={(e) => set('customer_name', e.target.value)} placeholder="Ism familiya" /></Field>
                <Field label="Telefon"><input className="inp" value={f.customer_phone} onChange={(e) => set('customer_phone', e.target.value)} inputMode="tel" placeholder="+998" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Tadbir">
                  <select className="inp" value={f.event_type} onChange={(e) => set('event_type', e.target.value)}>
                    <option value="">—</option>
                    {Object.entries(EVENT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </Field>
                <Field label="Mehmonlar"><input className="inp" type="number" inputMode="numeric" min="0" value={f.guests} onChange={(e) => set('guests', e.target.value)} /></Field>
              </div>

              <Field label="Narx">
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-canvas p-1">
                  {Object.entries(PRICING_MODE).map(([k, m]) => (
                    <button key={k} type="button" onClick={() => set('pricing_mode', k)}
                      className={`rounded-lg py-2 text-[12px] font-semibold ${f.pricing_mode === k ? 'bg-white text-ink shadow-sm' : 'text-muted'}`}>{m.label}</button>
                  ))}
                </div>
              </Field>
              {f.pricing_mode === 'per_guest' ? (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="1 kishiga (so'm)"><MoneyInput value={f.price_per_guest} onChange={(v) => set('price_per_guest', v)} /></Field>
                  <Field label="Jami"><div className="h-10 flex items-center font-semibold text-ink">{som(total)} so'm</div></Field>
                </div>
              ) : (
                <Field label={f.pricing_mode === 'fixed' ? "Aniq narx (so'm)" : "Kelishilgan summa (so'm)"}>
                  <MoneyInput value={f.total_price} onChange={(v) => set('total_price', v)} />
                </Field>
              )}

              {/* To'lovlar */}
              <div className="rounded-xl border border-line p-3 mb-3">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-semibold text-ink">To'lovlar</span>
                  <span className="text-xs">
                    to'langan <b className="text-green-700">{som(paid)}</b>
                    {total - paid > 0 && <> · qoldiq <b className="text-red-600">{som(total - paid)}</b></>}
                  </span>
                </div>
                {f.payments.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 border-b border-line last:border-0 text-sm">
                    <span className={`text-[11px] px-1.5 py-0.5 rounded ${p.kind === 'refund' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>{KIND[p.kind]}</span>
                    <span className="font-medium">{som(p.amount)}</span>
                    <span className="text-xs text-muted truncate flex-1">{METHOD[p.method]} · {p.date.split('-').reverse().join('.')}{p.note && ` · ${p.note}`}</span>
                    <button type="button" onClick={() => set('payments', f.payments.filter((_, j) => j !== i))} className="text-red-500 w-7 h-7" aria-label="O'chirish"><i className="ti ti-x" /></button>
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <MoneyInput value={pay.amount} onChange={(v) => setPay((p) => ({ ...p, amount: v }))} placeholder="Summa" />
                  <select className="inp" value={pay.kind} onChange={(e) => setPay((p) => ({ ...p, kind: e.target.value }))}>
                    {Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                  <select className="inp" value={pay.method} onChange={(e) => setPay((p) => ({ ...p, method: e.target.value }))}>
                    {Object.entries(METHOD).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                  <input className="inp" type="date" value={pay.date} onChange={(e) => setPay((p) => ({ ...p, date: e.target.value }))} />
                </div>
                <button type="button" onClick={addPayment} className="mt-2 w-full rounded-xl border border-green-300 bg-green-50 py-2 text-sm font-semibold text-green-700">
                  <i className="ti ti-plus" /> To'lov qo'shish
                </button>
              </div>
            </>
          )}

          <Field label={f.status === 'closed' ? 'Sababi' : 'Izoh / tafsilotlar'}>
            <textarea className="inp resize-none" rows={3} value={f.description} onChange={(e) => set('description', e.target.value)}
              placeholder={f.status === 'closed' ? "Ta'mir, shaxsiy tadbir..." : 'Menyu, bezak, karnay-surnay, maxsus talablar...'} />
          </Field>
          {err && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</div>}
        </>
      )}
    </Modal>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line pb-1.5">
      <span className="text-muted">{k}</span><span className="text-ink text-right">{v ?? '—'}</span>
    </div>
  );
}
