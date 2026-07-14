import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { panelApi } from '@/api';
import { SOCKET_URL } from '@/api/client';
import { useAuth } from '@/store/auth';

const statusMeta = {
  accepted: { label: 'Yangi', cls: 'bg-amber-50 text-amber-700' },
  preparing: { label: 'Tayyorlanmoqda', cls: 'bg-blue-50 text-blue-700' },
  delivering: { label: "Yo'lda", cls: 'bg-purple-50 text-purple-700' },
  delivered: { label: 'Yetkazildi', cls: 'bg-green-50 text-green-700' },
  cancelled: { label: 'Bekor qilindi', cls: 'bg-gray-100 text-gray-500' },
};
const nextStatus = { accepted: 'preparing', preparing: 'delivering', delivering: 'delivered' };
const nextLabel = { accepted: 'Qabul qilish', preparing: "Yo'lga chiqarish", delivering: 'Yetkazildi deb belgilash' };

const som = (n) => (n ?? 0).toLocaleString('ru-RU').replace(/,/g, ' ');

export function RestaurantOrdersPage() {
  const restaurant = useAuth((s) => s.restaurant);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState(null);

  const load = useCallback(async () => {
    try { setOrders(await panelApi.getOrders()); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    if (restaurant?._id) socket.emit('join:restaurant', restaurant._id);
    socket.on('order:new', (order) => {
      setOrders((prev) => [order, ...prev.filter((o) => o._id !== order._id)]);
      setFlash(order._id);
      setTimeout(() => setFlash(null), 4000);
    });
    const t = setInterval(load, 20000);
    return () => { clearInterval(t); socket.disconnect(); };
  }, [load, restaurant]);

  const advance = async (o) => {
    const ns = nextStatus[o.status];
    if (!ns) return;
    await panelApi.updateOrderStatus(o._id, ns);
    load();
  };
  const cancel = async (o) => {
    if (!confirm('Buyurtma bekor qilinsinmi?')) return;
    await panelApi.updateOrderStatus(o._id, 'cancelled');
    load();
  };

  return (
    <div className="flex-1 p-6 min-w-0">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-ink">Buyurtmalar</h1>
          <p className="text-sm text-muted mt-0.5">{restaurant?.name} — jonli buyurtmalar</p>
        </div>
        <span className="flex items-center gap-2 text-sm text-green-600">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Jonli
        </span>
      </div>

      {loading ? (
        <div className="text-muted text-sm py-10 text-center">Yuklanmoqda...</div>
      ) : (
        <div className="grid gap-3">
          {orders.length === 0 && (
            <div className="text-center text-muted text-sm py-12 border border-dashed border-line rounded-xl">
              Hozircha buyurtma yo'q. Yangi buyurtma kelganda shu yerda jonli ko'rinadi.
            </div>
          )}
          {orders.map((o) => (
            <div
              key={o._id}
              className={`bg-surface border rounded-xl p-4 transition-all ${
                flash === o._id ? 'border-brand-400 ring-2 ring-brand-400/20' : 'border-line'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${statusMeta[o.status]?.cls}`}>
                      {statusMeta[o.status]?.label || o.status}
                    </span>
                    <span className="text-xs text-muted">
                      {new Date(o.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-sm text-ink">
                    {o.items?.map((i, idx) => (
                      <div key={idx} className="flex justify-between py-0.5">
                        <span>{i.name} ×{i.quantity}</span>
                        <span className="text-muted">{som(i.unitPrice * i.quantity)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-muted mt-2">
                    <i className="ti ti-map-pin text-[11px]" /> {o.address}
                  </div>
                </div>
                <div className="text-right flex-none">
                  <div className="font-semibold text-ink">{som(o.total)} so'm</div>
                </div>
              </div>

              {o.status !== 'delivered' && o.status !== 'cancelled' && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-line">
                  {nextStatus[o.status] && (
                    <button
                      onClick={() => advance(o)}
                      className="flex-1 bg-brand-400 text-brand-text text-sm font-medium py-2 rounded-lg hover:bg-brand-600 hover:text-white transition-colors"
                    >
                      {nextLabel[o.status]}
                    </button>
                  )}
                  <button
                    onClick={() => cancel(o)}
                    className="px-4 border border-line text-muted text-sm rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                  >
                    Bekor
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
