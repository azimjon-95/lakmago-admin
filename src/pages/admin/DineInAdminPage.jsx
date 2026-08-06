import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/api';
import { getSocket } from '@/lib/socket';

const fmtDT = (d) => d ? new Date(d).toLocaleString('ru-RU', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
}) : '—';

const STATUS = {
  pending: { label: "Ko'rib chiqilmoqda", cls: 'bg-amber-50 text-amber-700' },
  approved: { label: 'Tasdiqlangan', cls: 'bg-blue-50 text-blue-700' },
  payment_required: { label: "To'lov kutilmoqda", cls: 'bg-amber-50 text-amber-700' },
  active: { label: 'Faol', cls: 'bg-green-50 text-green-700' },
  suspended: { label: "To'xtatilgan", cls: 'bg-red-50 text-red-600' },
};

// Keyingi bosqichlar
const NEXT = {
  pending: [['approved', 'Tasdiqlash'], ['suspended', 'Rad etish']],
  approved: [['payment_required', "To'lov so'rash"], ['active', 'Darhol yoqish']],
  payment_required: [['active', 'Yoqish']],
  active: [['suspended', "To'xtatish"]],
  suspended: [['active', 'Qayta yoqish']],
};

export function DineInAdminPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.getDineInRequests()
      .then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const socket = getSocket();
    socket.on('dinein:request', load);
    return () => socket.off('dinein:request', load);
  }, [load]);

  const setStatus = async (item, status, label) => {
    const name = item.restaurant?.name || 'Restoran';
    let reason = '';

    if (status === 'suspended') {
      reason = prompt(`${name} — sabab (ixtiyoriy):`) ?? '';
    } else if (!window.confirm(`${name}: ${label}?`)) {
      return;
    }

    setBusy(item._id);
    try {
      await adminApi.setDineInStatus(item.restaurantId, status, reason);
      load();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="p-6 text-muted text-sm">Yuklanmoqda...</div>;

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl font-semibold text-ink mb-1">Dine-in</h1>
      <p className="text-sm text-muted mb-5">
        Restoranlarning joyida buyurtma xizmati
      </p>

      {items.length === 0 ? (
        <div className="text-center py-14">
          <i className="ti ti-armchair text-4xl text-muted mb-3 block" />
          <div className="text-ink font-medium">So'rov yo'q</div>
          <p className="text-sm text-muted mt-1">
            Restoranlar panelidan Dine-in so'rovi yuboradi
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((c) => {
            const st = STATUS[c.status] || STATUS.pending;
            const actions = NEXT[c.status] || [];

            return (
              <div key={c._id} className="bg-surface border border-line rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="font-medium text-ink truncate">
                      {c.restaurant?.name || 'Restoran'}
                    </div>
                    {c.restaurant?.phone && (
                      <div className="text-xs text-muted">{c.restaurant.phone}</div>
                    )}
                  </div>
                  <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full flex-none ${st.cls}`}>
                    {st.label}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center my-3">
                  <div className="bg-canvas rounded-lg py-2">
                    <div className="text-[10px] text-muted">Stollar</div>
                    <div className="text-sm font-semibold text-ink">{c.tables}</div>
                  </div>
                  <div className="bg-canvas rounded-lg py-2">
                    <div className="text-[10px] text-muted">So'rov</div>
                    <div className="text-[11px] text-ink">{fmtDT(c.requestedAt)}</div>
                  </div>
                  <div className="bg-canvas rounded-lg py-2">
                    <div className="text-[10px] text-muted">Yoqilgan</div>
                    <div className="text-[11px] text-ink">{fmtDT(c.activatedAt)}</div>
                  </div>
                </div>

                {c.suspendReason && (
                  <div className="text-xs text-red-600 mb-3">
                    Sabab: {c.suspendReason}
                  </div>
                )}

                {actions.length > 0 && (
                  <div className="flex gap-2">
                    {actions.map(([status, label]) => (
                      <button
                        key={status}
                        onClick={() => setStatus(c, status, label)}
                        disabled={busy === c._id}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50 ${
                          status === 'active'
                            ? 'bg-green-500 text-white'
                            : status === 'suspended'
                              ? 'border border-red-200 text-red-600'
                              : 'border border-line text-muted'
                        }`}
                      >
                        {busy === c._id ? '...' : label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
