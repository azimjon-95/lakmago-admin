import { useEffect, useState } from 'react';
import { panelApi } from '@/api';
import { useLockScroll } from '@/hooks/useLockScroll';

/*
 * Qabul qilinmagan buyurtmani rad etish — sabab tanlanadi (restoran boti bilan bir xil ro'yxat).
 * Sabab buyurtmaga yoziladi: takroriy "javob bermadi / tasdiqlamadi" holatlarini tahlil qilish uchun.
 */
export function RejectReasonModal({ order, onClose, onPick }) {
  useLockScroll();
  const [reasons, setReasons] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { panelApi.rejectReasons().then(setReasons).catch((e) => setErr(e.message)); }, []);

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-2xl bg-white sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">Buyurtmani rad etish</h2>
            <p className="text-xs text-muted">#{order.dailyNumber || String(order._id).slice(-4)} · sababni tanlang</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink" aria-label="Yopish"><i className="ti ti-x text-xl" /></button>
        </div>
        <div className="space-y-2 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}
          {!reasons && !err && <div className="py-4 text-center text-sm text-muted">Yuklanmoqda...</div>}
          {reasons?.map((r) => (
            <button key={r.value} onClick={() => onPick(r.value)} className="w-full rounded-xl border border-line px-4 py-3 text-left text-sm text-ink hover:border-red-300 hover:bg-red-50">
              ❌ {r.label}
            </button>
          ))}
          {/* Sabablar yuklanmasa ham rad etish ishlaydi (avvalgidek, sababsiz) */}
          {err && <button onClick={() => onPick(undefined)} className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white">Sababsiz rad etish</button>}
        </div>
      </div>
    </div>
  );
}
