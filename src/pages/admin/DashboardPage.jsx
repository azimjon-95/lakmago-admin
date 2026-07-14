import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { adminApi } from '@/api';
import { SOCKET_URL } from '@/api/client';

const STATUS_LABEL = {
  accepted: 'Yangi', preparing: 'Tayyorlanmoqda', delivering: "Yo'lda",
  delivered: 'Yetkazildi', cancelled: 'Bekor',
};
const STATUS_COLOR = {
  accepted: 'bg-amber-50 text-amber-700',
  preparing: 'bg-blue-50 text-blue-700',
  delivering: 'bg-purple-50 text-purple-700',
  delivered: 'bg-green-50 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

function som(n) {
  return (n ?? 0).toLocaleString('ru-RU').replace(/,/g, ' ');
}

export function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [flash, setFlash] = useState(null);
  const audioRef = useRef(null);

  const loadStats = useCallback(async () => {
    try { setStats(await adminApi.getStats()); } catch { /* ignore */ }
  }, []);
  const loadOrders = useCallback(async () => {
    try { setOrders(await adminApi.getOrders()); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadStats();
    loadOrders();
    const t = setInterval(() => { loadStats(); loadOrders(); }, 20000);

    // Live: yangi buyurtmalar
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socket.emit('join:admin');
    socket.on('order:new', (order) => {
      setOrders((prev) => [order, ...prev.filter((o) => o._id !== order._id)]);
      setFlash(order._id);
      setTimeout(() => setFlash(null), 3000);
      loadStats();
    });

    return () => { clearInterval(t); socket.disconnect(); };
  }, [loadStats, loadOrders]);

  return (
    <div className="flex-1 p-6 min-w-0">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-ink">Boshqaruv paneli</h1>
          <p className="text-sm text-muted mt-0.5">Barcha buyurtmalar — jonli nazorat</p>
        </div>
        <span className="flex items-center gap-2 text-sm text-green-600">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Jonli
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Muassasalar" value={stats?.restaurants ?? '—'} icon="ti-building-store" />
        <Stat label="Bugungi buyurtma" value={stats?.todayOrders ?? '—'} icon="ti-clipboard-list" />
        <Stat label="Jami buyurtma" value={stats?.orders ?? '—'} icon="ti-receipt" />
        <Stat label="Komissiya (12%)" value={`${som(stats?.commission)} so'm`} icon="ti-cash" highlight />
      </div>

      {/* Eng ko'p buyurtma qilingan taomlar (marketing/psixologiya) */}
      {stats?.topDishes && stats.topDishes.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-ink mb-3">🔥 Eng ko'p buyurtma qilinayotgan taomlar</h2>
          <div className="bg-surface border border-line rounded-xl p-4">
            {stats.topDishes.map((d, i) => {
              const max = stats.topDishes[0].count || 1;
              const pct = Math.round((d.count / max) * 100);
              return (
                <div key={d.name} className="mb-3 last:mb-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-ink flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-semibold ${i < 3 ? 'bg-brand-400 text-brand-text' : 'bg-brand-50 text-brand-600'}`}>{i + 1}</span>
                      {d.name}
                    </span>
                    <span className="text-sm text-muted">{d.count} marta</span>
                  </div>
                  <div className="h-1.5 bg-canvas rounded-full overflow-hidden">
                    <div className="h-full bg-brand-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <h2 className="text-sm font-medium text-ink mb-3">So'nggi buyurtmalar</h2>
      <div className="grid gap-2">
        {orders.length === 0 && (
          <div className="text-center text-muted text-sm py-10 border border-dashed border-line rounded-xl">
            Hozircha buyurtma yo'q. Yangi buyurtma kelganda shu yerda jonli ko'rinadi.
          </div>
        )}
        {orders.map((o) => (
          <div
            key={o._id}
            className={`bg-surface border rounded-xl p-4 flex items-center gap-4 transition-all ${
              flash === o._id ? 'border-brand-400 ring-2 ring-brand-400/20' : 'border-line'
            }`}
          >
            <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center flex-none">
              <i className="ti ti-receipt text-lg text-brand-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-ink truncate">{o.restaurantName}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS_COLOR[o.status]}`}>
                  {STATUS_LABEL[o.status] || o.status}
                </span>
              </div>
              <div className="text-sm text-muted truncate mt-0.5">
                {o.items?.map((i) => `${i.name} ×${i.quantity}`).join(', ')}
              </div>
              <div className="text-xs text-muted mt-0.5">
                <i className="ti ti-map-pin text-[11px]" /> {o.address}
              </div>
            </div>
            <div className="text-right flex-none">
              <div className="font-semibold text-ink">{som(o.total)} so'm</div>
              <div className="text-xs text-muted mt-0.5">
                {new Date(o.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, icon, highlight }) {
  return (
    <div className="bg-surface border border-line rounded-xl p-4">
      <div className="flex items-center gap-2 text-muted text-xs mb-2">
        <i className={`ti ${icon}`} /> {label}
      </div>
      <div className={`text-2xl font-semibold ${highlight ? 'text-brand-600' : 'text-ink'}`}>{value}</div>
    </div>
  );
}
