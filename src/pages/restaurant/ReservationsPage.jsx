import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { panelApi } from '@/api';
import { SOCKET_URL, getToken } from '@/api/client';

// Mijoz javoblari va holatlar
const STATUS = {
  pending: { label: 'Kutilmoqda', color: '#F59E0B', bg: '#FEF3C7' },
  confirmed: { label: 'Tasdiqlandi', color: '#059669', bg: '#D1FAE5' },
  rejected: { label: 'Rad etildi', color: '#DC2626', bg: '#FEE2E2' },
  cancelled: { label: 'Bekor qilindi', color: '#6B7280', bg: '#F3F4F6' },
  coming: { label: '✅ Boramiz', color: '#059669', bg: '#D1FAE5' },
  not_coming: { label: '❌ Bora olmaymiz', color: '#DC2626', bg: '#FEE2E2' },
  on_way: { label: '🚗 Yo\u2018ldamiz', color: '#7C3AED', bg: '#EDE9FE' },
  arrived: { label: '🎉 Keldik', color: '#059669', bg: '#D1FAE5' },
  completed: { label: 'Yakunlandi', color: '#6B7280', bg: '#F3F4F6' },
};

export function ReservationsPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');
  const [busyId, setBusyId] = useState(null);
  const socketRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await panelApi.getReservations();
      setList(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Real-time: yangi bron va mijoz javoblari
  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    const token = getToken();
    if (token) socket.emit('join:restaurant', { token });
    socket.on('reservation:new', () => load());
    socket.on('reservation:update', () => load());
    socketRef.current = socket;
    return () => socket.disconnect();
  }, [load]);

  const decide = async (id, status) => {
    let reason = '';
    if (status === 'rejected') {
      reason = prompt('Rad etish sababi (mijozga yuboriladi):') || '';
    }
    setBusyId(id);
    try {
      await panelApi.updateReservationStatus(id, status, reason);
      await load();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const ACTIVE = ['pending', 'confirmed', 'coming', 'on_way', 'arrived'];
  const shown = filter === 'active'
    ? list.filter((r) => ACTIVE.includes(r.status))
    : list;

  return (
    <div className="flex-1 p-4 sm:p-6 min-w-0">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-ink">Stol bronlari</h1>
          <p className="text-sm text-muted mt-0.5">Mijoz javoblari real vaqtda ko'rinadi</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-canvas rounded-lg p-0.5 border border-line">
            <button onClick={() => setFilter('active')} className={`px-3 py-1.5 rounded-md text-sm ${filter === 'active' ? 'bg-brand-400 text-brand-text font-medium' : 'text-muted'}`}>Faol</button>
            <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-md text-sm ${filter === 'all' ? 'bg-brand-400 text-brand-text font-medium' : 'text-muted'}`}>Barchasi</button>
          </div>
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Jonli
          </span>
        </div>
      </div>

      {loading ? (
        <div className="text-muted text-sm py-10 text-center">Yuklanmoqda...</div>
      ) : shown.length === 0 ? (
        <div className="text-center text-muted text-sm py-12 border border-dashed border-line rounded-xl">
          {filter === 'active' ? 'Faol bron yo\u2018q' : 'Bronlar yo\u2018q'}
        </div>
      ) : (
        <div className="grid gap-3">
          {shown.map((r) => {
            const st = STATUS[r.status] || {};
            return (
              <div key={r._id} className="bg-surface border border-line rounded-xl p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base font-semibold text-ink">{r.name}</span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ background: st.bg, color: st.color }}>
                        {st.label || r.status}
                      </span>
                    </div>
                    <div className="text-sm text-muted">
                      <i className="ti ti-phone text-xs" /> {r.phone}
                    </div>
                    <div className="text-sm text-ink mt-1.5">
                      <i className="ti ti-calendar text-xs" /> {r.date} · {r.time}
                      <span className="mx-2 text-muted">|</span>
                      <i className="ti ti-users text-xs" /> {r.guests} kishi
                    </div>
                    {r.note && <div className="text-xs text-muted mt-1">Izoh: {r.note}</div>}
                    {r.rejectReason && (
                      <div className="text-xs text-red-600 mt-1">Rad sababi: {r.rejectReason}</div>
                    )}
                  </div>

                  {/* Amallar — faqat kutilayotgan bronlar uchun */}
                  {r.status === 'pending' && (
                    <div className="flex gap-2 flex-none">
                      <button
                        onClick={() => decide(r._id, 'confirmed')}
                        disabled={busyId === r._id}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                      >
                        Tasdiqlash
                      </button>
                      <button
                        onClick={() => decide(r._id, 'rejected')}
                        disabled={busyId === r._id}
                        className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50"
                      >
                        Rad etish
                      </button>
                    </div>
                  )}

                  {['confirmed', 'coming', 'on_way', 'arrived'].includes(r.status) && (
                    <button
                      onClick={() => decide(r._id, 'completed')}
                      disabled={busyId === r._id}
                      className="px-4 py-2 border border-line text-muted rounded-lg text-sm hover:bg-canvas disabled:opacity-50 flex-none"
                    >
                      Yakunlash
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
