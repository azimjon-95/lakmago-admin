import { useState } from 'react';
import { weddingApi } from '@/api';
import { MoneyInput } from '@/components/form/NumberInput';
import { Modal, Field, PAY_METHOD, som, thisMonth } from './common';

/* 'YYYY-MM' + n oy */
function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

/*
 * To'yxonadan oylik to'lov qabul qilish.
 * Davr avtomatik taklif qilinadi: to'langan muddatdan keyingi oy
 * (to'lov bo'lmagan bo'lsa — hisob boshlangan oy yoki joriy oy).
 * Summa = oylik × oylar soni (o'zgartirish mumkin). Saqlangach server
 * `paid_until` ni qayta hisoblaydi.
 */
export function PaymentModal({ venue, onClose, onSaved }) {
  const fee = venue.subscription?.monthly_fee || 0;
  const paidUntil = venue.subscription?.paid_until || '';
  const startDefault = paidUntil ? addMonths(paidUntil.slice(0, 7), 1) : (venue.subscription?.billing_start || thisMonth());
  const [f, setF] = useState({ period_from: startDefault, months: 1, amount: fee || null, method: 'cash', note: '' });
  const [amountTouched, setAmountTouched] = useState(false);
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const setMonths = (n) => {
    const months = Math.max(1, Math.min(24, Number(n) || 1));
    setF((x) => ({ ...x, months, amount: amountTouched || !fee ? x.amount : fee * months }));
  };
  const until = addMonths(f.period_from || thisMonth(), f.months - 1);

  const save = async () => {
    if (!/^\d{4}-\d{2}$/.test(f.period_from)) { setErr('Davrni tanlang'); return; }
    if (!(f.amount > 0)) { setErr('Summani kiriting'); return; }
    setErr(null); setSaving(true);
    try {
      await weddingApi.addPayment({
        venue_id: venue._id, amount: Number(f.amount), period_from: f.period_from,
        months: f.months, method: f.method, note: f.note.trim(),
      });
      onSaved();
    } catch (e) { setErr(e.message); setSaving(false); }
  };

  return (
    <Modal title="To'lov qabul qilish" onClose={onClose} footer={(
      <>
        <button onClick={onClose} className="px-4 py-2.5 border border-line text-muted rounded-xl">Bekor</button>
        <button onClick={save} disabled={saving} className="flex-1 bg-green-600 text-white font-medium py-2.5 rounded-xl disabled:opacity-50">
          {saving ? 'Saqlanmoqda...' : `${som(f.amount)} so'm qabul qilindi`}
        </button>
      </>
    )}>
      <div className="mb-4 rounded-xl bg-canvas p-3 text-sm">
        <div className="font-medium text-ink">{venue.name}</div>
        <div className="text-xs text-muted mt-0.5">
          Oylik: {fee ? `${som(fee)} so'm` : 'belgilanmagan'} · To'langan: {paidUntil || "hali yo'q"}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Qaysi oydan"><input className="inp" type="month" value={f.period_from} onChange={(e) => set('period_from', e.target.value)} /></Field>
        <Field label="Necha oy"><input className="inp" type="number" min="1" max="24" value={f.months} onChange={(e) => setMonths(e.target.value)} /></Field>
      </div>
      <p className="text-[11px] text-muted -mt-1 mb-3">Qoplanadi: <b className="text-ink">{f.period_from} — {until}</b></p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Summa (so'm)"><MoneyInput value={f.amount} onChange={(v) => { setAmountTouched(true); set('amount', v); }} /></Field>
        <Field label="Usul">
          <select className="inp" value={f.method} onChange={(e) => set('method', e.target.value)}>
            {Object.entries(PAY_METHOD).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Izoh"><input className="inp" value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="Chek raqami, kim topshirdi" maxLength={300} /></Field>
      {err && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</div>}
    </Modal>
  );
}
