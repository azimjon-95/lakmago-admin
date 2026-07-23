import { useState, useEffect, useCallback, useRef } from 'react';
import { adminApi } from '@/api';
import { getSocket, joinAdmin } from '@/lib/socket';

const som = (n) => (n ?? 0).toLocaleString('ru-RU').replace(/,/g, ' ');

const STATUS = {
  pending: { label: 'Yangi', color: '#E24B4A' },
  accepted: { label: 'Qabul qilindi', color: '#EF9F27' },
  preparing: { label: 'Tayyorlanmoqda', color: '#6BA8F0' },
  ready: { label: 'Tayyor', color: '#5DCAA5' },
  delivering: { label: 'Yo\u2018lda', color: '#9B8FE0' },
  delivered: { label: 'Yetkazildi', color: '#5DCAA5' },
  cancelled: { label: 'Bekor', color: '#9A9A96' },
};

export function OrdersMonitorPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('live'); // live | all
  const socketRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = filter === 'live' ? await adminApi.getLiveOrders() : await adminApi.getOrders('?limit=100');
      setOrders(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // Real-time — yangi buyurtma va status yangilanishi
  useEffect(() => {
    const socket = getSocket();
    joinAdmin();
    socket.on('order:new', () => load());
    socket.on('order:update', () => load());
    socketRef.current = socket;
    return () => socket.removeAllListeners();
  }, [load]);

  // groupId bo'yicha guruhlash (bitta mijoz buyurtmasi = bir necha restoran)
  const groups = {};
  orders.forEach((o) => {
    const g = o.groupId || o._id;
    if (!groups[g]) groups[g] = [];
    groups[g].push(o);
  });

  return (
    <div className="flex-1 p-4 sm:p-6 min-w-0">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-ink">Buyurtmalar nazorati</h1>
          <p className="text-sm text-muted mt-0.5">Kim, qaysi muassasaga, nima buyurtma qildi — jonli kuzatuv</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-canvas rounded-lg p-0.5 border border-line">
            <button onClick={() => setFilter('live')} className={`px-3 py-1.5 rounded-md text-sm ${filter === 'live' ? 'bg-brand-400 text-brand-text font-medium' : 'text-muted'}`}>Faol</button>
            <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-md text-sm ${filter === 'all' ? 'bg-brand-400 text-brand-text font-medium' : 'text-muted'}`}>Barchasi</button>
          </div>
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Jonli
          </span>
        </div>
      </div>

      {loading ? (
        <div className="text-muted text-sm py-10 text-center">Yuklanmoqda...</div>
      ) : Object.keys(groups).length === 0 ? (
        <div className="text-center text-muted text-sm py-12 border border-dashed border-line rounded-xl">
          {filter === 'live' ? 'Faol buyurtma yo\u2018q' : 'Buyurtmalar yo\u2018q'}
        </div>
      ) : (
        <div className="grid gap-4">
          {Object.entries(groups).map(([gid, subs]) => {
            const first = subs[0];
            const user = first.userId;
            const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || 'Mijoz' : 'Mijoz';
            const total = subs.reduce((s, o) => s + o.total, 0);
            return (
              <div key={gid} className="bg-surface border border-line rounded-xl overflow-hidden">
                {/* Mijoz sarlavhasi */}
                <div className="px-4 py-3 bg-canvas border-b border-line flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-text flex items-center justify-center text-xs font-semibold">
                      {userName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-ink">{userName}</div>
                      <div className="text-[11px] text-muted">
                        {user?.phone && <span><i className="ti ti-phone text-[10px]" /> {user.phone} · </span>}
                        {new Date(first.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        {subs.length > 1 && <span> · {subs.length} ta muassasa</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-ink">{som(total)} so'm</div>
                    <div className="text-[11px] text-muted">{first.address}</div>
                  </div>
                </div>

                {/* Har restoran buyurtmasi */}
                <div className="divide-y divide-line">
                  {subs.map((o) => {
                    const st = STATUS[o.status] || {};
                    return (
                      <div key={o._id} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <i className="ti ti-building-store text-muted text-sm" />
                            <span className="text-sm font-medium text-ink">{o.restaurantName}</span>
                          </div>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: `${st.color}20`, color: st.color }}>
                            {st.label}
                          </span>
                        </div>
                        <div className="text-xs text-muted pl-6">
                          {o.items?.map((it) => `${it.name}×${it.quantity}`).join(', ')}
                        </div>
                        {o.courierName && ['delivering', 'ready'].includes(o.status) && (
                          <div className="text-[11px] text-purple-600 pl-6 mt-1">🛵 Kuryer: {o.courierName}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
