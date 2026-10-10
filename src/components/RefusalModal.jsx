import { useEffect, useState } from 'react';
import { panelApi } from '@/api';
import { useLockScroll } from '@/hooks/useLockScroll';

/*
 * "Mijoz rad etdi" — restoran qabul qilgan buyurtmadan mijoz voz kechganda.
 * Buyurtma DARHOL bekor qilinmaydi: so'rov LokmaGo adminiga boradi (guruh +
 * admin panel), admin tasdiqlasa bekor qilinadi va xohlasa mijozning naqd
 * to'lovini o'chiradi yoki bloklaydi. Server: POST /panel/orders/:id/cancel-request
 */
const som = (n) => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/,/g, ' ');

export function RefusalModal({ order, onClose, onSent }) {
  useLockScroll();
  const [reasons, setReasons] = useState([]);
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    panelApi.refusalReasons().then(setReasons).catch((e) => setErr(e.message));
  }, []);

  const send = async () => {
    if (!code) { setErr('Sababni tanlang'); return; }
    if (code === 'other' && note.trim().length < 3) { setErr('Sababni qisqacha yozing'); return; }
    setSaving(true); setErr(null);
    try {
      const r = await panelApi.cancelRequest(order._id, { reasonCode: code, note: note.trim() });
      onSent?.(r);
    } catch (e) { setErr(e.message); setSaving(false); }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4">
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-2xl bg-white sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">Mijoz buyurtmadan voz kechdi</h2>
            <p className="text-xs text-muted">#{order.dailyNumber || String(order._id).slice(-4)} · {som(order.total)} so'm · {order.paymentMethod === 'cash' ? 'Naqd' : 'Karta'}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink" aria-label="Yopish"><i className="ti ti-x text-xl" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-3 rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800">
            <i className="ti ti-info-circle" /> Buyurtma darhol bekor qilinmaydi. So‘rov <b>LokmaGo adminiga</b> boradi — u tasdiqlasa bekor qilinadi.
            Qaror chiqquncha taomni bermang.
          </div>
          <div className="space-y-2">
            {reasons.map((r) => (
              <label key={r.value} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm ${code === r.value ? 'border-red-300 bg-red-50 text-red-700' : 'border-line text-ink'}`}>
                <input type="radio" name="reason" value={r.value} checked={code === r.value} onChange={() => setCode(r.value)} className="accent-red-600" />
                {r.label}
              </label>
            ))}
            {!reasons.length && !err && <div className="py-4 text-center text-sm text-muted">Yuklanmoqda...</div>}
          </div>
          <textarea
            value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500}
            placeholder={code === 'other' ? 'Sababni yozing (majburiy)' : 'Izoh (ixtiyoriy): mijoz nima dedi, qachon qo‘ng‘iroq qilindi...'}
            className="inp mt-3 resize-none"
          />
          {err && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}
        </div>
        <div className="flex gap-2 border-t border-line px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button onClick={onClose} className="rounded-xl border border-line px-4 py-2.5 text-muted">Bekor</button>
          <button onClick={send} disabled={saving} className="flex-1 rounded-xl bg-red-600 py-2.5 font-semibold text-white disabled:opacity-50">
            {saving ? 'Yuborilmoqda...' : 'Adminga yuborish'}
          </button>
        </div>
      </div>
    </div>
  );
}
