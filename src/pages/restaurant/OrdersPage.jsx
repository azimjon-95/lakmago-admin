import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { panelApi } from '@/api';
import { SOCKET_URL } from '@/api/client';
import { useAuth } from '@/store/auth';
import { playNewOrderSound, playAcceptSound } from '@/lib/sound';

const som = (n) => (n ?? 0).toLocaleString('ru-RU').replace(/,/g, ' ');

// Status oqimi: pending → accepted → preparing → ready → delivering → delivered
const flow = {
  pending: { label: 'Yangi buyurtma', color: '#E24B4A', next: 'accepted', nextLabel: '✓ Qabul qilish', glow: true },
  accepted: { label: 'Qabul qilindi', color: '#EF9F27', next: 'preparing', nextLabel: 'Tayyorlashni boshlash' },
  preparing: { label: 'Tayyorlanmoqda', color: '#6BA8F0', next: 'ready', nextLabel: '🍽 Tayyor bo\u2018ldi' },
  ready: { label: 'Tayyor', color: '#5DCAA5', next: 'delivering', nextLabel: '🛵 Kuryer olib ketdi' },
  delivering: { label: 'Kuryer yo\u2018lda', color: '#9B8FE0', next: null, nextLabel: 'Mijoz qabul qilishini kuting' },
  delivered: { label: 'Yetkazildi', color: '#5DCAA5', next: null },
  cancelled: { label: 'Bekor qilindi', color: '#9A9A96', next: null },
};

export function RestaurantOrdersPage() {
  const restaurant = useAuth((s) => s.restaurant);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [flashId, setFlashId] = useState(null);
  const [soundOn, setSoundOn] = useState(true);
  const soundOnRef = useRef(true);
  const knownIds = useRef(new Set());

  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);

  const load = useCallback(async () => {
    try {
      const data = await panelApi.getOrders();
      setOrders(data);
      data.forEach((o) => knownIds.current.add(o._id));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    if (restaurant?._id) socket.emit('join:restaurant', restaurant._id);

    socket.on('order:new', (order) => {
      setOrders((prev) => {
        if (prev.find((o) => o._id === order._id)) return prev;
        return [order, ...prev];
      });
      // Yangi buyurtma — signal chaladi
      if (!knownIds.current.has(order._id)) {
        knownIds.current.add(order._id);
        if (soundOnRef.current) playNewOrderSound();
        setFlashId(order._id);
        setTimeout(() => setFlashId(null), 5000);
      }
    });

    socket.on('order:update', (order) => {
      setOrders((prev) => prev.map((o) => (o._id === order._id ? order : o)));
    });

    const poll = setInterval(load, 25000);
    return () => { clearInterval(poll); socket.disconnect(); };
  }, [load, restaurant]);

  const advance = async (o) => {
    const next = flow[o.status]?.next;
    if (!next) return;
    if (next === 'accepted') playAcceptSound();
    // Optimistik yangilash
    setOrders((prev) => prev.map((x) => (x._id === o._id ? { ...x, status: next } : x)));
    try { await panelApi.updateOrderStatus(o._id, next); } catch { load(); }
  };

  const cancel = async (o) => {
    if (!confirm('Buyurtma bekor qilinsinmi?')) return;
    setOrders((prev) => prev.map((x) => (x._id === o._id ? { ...x, status: 'cancelled' } : x)));
    try { await panelApi.updateOrderStatus(o._id, 'cancelled'); } catch { load(); }
  };

  // Faol buyurtmalar tepada, yakunlangan/bekor pastda
  const active = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status));
  const done = orders.filter((o) => ['delivered', 'cancelled'].includes(o.status));
  const pendingCount = orders.filter((o) => o.status === 'pending').length;

  return (
    <div className="flex-1 p-4 sm:p-6 min-w-0">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold text-ink flex items-center gap-2 flex-wrap">
            Buyurtmalar
            {pendingCount > 0 && (
              <span className="text-xs font-semibold bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                {pendingCount} yangi
              </span>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-0.5 truncate">{restaurant?.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundOn((s) => !s)}
            title={soundOn ? 'Ovozni o\u2018chirish' : 'Ovozni yoqish'}
            className={`w-10 h-10 rounded-xl border flex items-center justify-center ${soundOn ? 'border-brand-400 text-brand-600 bg-brand-50' : 'border-line text-muted'}`}
          >
            <i className={`ti ${soundOn ? 'ti-volume' : 'ti-volume-off'} text-lg`} />
          </button>
          <span className="flex items-center gap-2 text-sm text-green-600">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Jonli
          </span>
        </div>
      </div>

      {loading ? (
        <div className="text-muted text-sm py-10 text-center">Yuklanmoqda...</div>
      ) : (
        <>
          <div className="grid gap-3">
            {active.length === 0 && (
              <div className="text-center text-muted text-sm py-12 border border-dashed border-line rounded-xl">
                Faol buyurtma yo'q. Yangi buyurtma kelganda signal chalinadi va shu yerda ko'rinadi.
              </div>
            )}
            {active.map((o) => (
              <OrderCard key={o._id} order={o} flash={flashId === o._id} onAdvance={advance} onCancel={cancel} />
            ))}
          </div>

          {done.length > 0 && (
            <>
              <div className="text-sm font-medium text-muted mt-6 mb-3">Yakunlangan</div>
              <div className="grid gap-2">
                {done.slice(0, 10).map((o) => (
                  <div key={o._id} className="bg-surface border border-line rounded-xl p-3 flex items-center gap-3 opacity-70">
                    <span className="text-xs px-2 py-0.5 rounded-full flex-none" style={{ background: `${flow[o.status]?.color}20`, color: flow[o.status]?.color }}>
                      {flow[o.status]?.label}
                    </span>
                    <span className="text-sm text-ink truncate flex-1 min-w-0">{o.items?.map((i) => `${i.name}×${i.quantity}`).join(', ')}</span>
                    <span className="text-sm font-medium text-ink flex-none whitespace-nowrap">{som(o.total)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function OrderCard({ order: o, flash, onAdvance, onCancel }) {
  const meta = flow[o.status] || {};
  const canCancel = ['pending', 'accepted', 'preparing'].includes(o.status);
  const elapsed = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 60000);

  return (
    <div
      className={`bg-surface border rounded-xl overflow-hidden transition-all ${
        flash || o.status === 'pending' ? 'border-red-400 ring-2 ring-red-400/20' : 'border-line'
      }`}
    >
      {/* Sarlavha */}
      <div className="p-4 flex items-start justify-between gap-3 border-b border-line">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: `${meta.color}20`, color: meta.color }}>
            {meta.label}
          </span>
          <span className="text-xs text-muted">
            {new Date(o.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            {elapsed > 0 && ` · ${elapsed} daq oldin`}
          </span>
        </div>
        <div className="text-right">
          <div className="font-semibold text-ink">{som(o.total)} so'm</div>
          <div className="text-[11px] text-muted">{o.paymentMethod === 'cash' ? 'Naqd' : 'Karta'}</div>
        </div>
      </div>

      {/* Taomlar */}
      <div className="p-4">
        {o.items?.map((it, idx) => (
          <div key={idx} className="flex justify-between text-sm py-0.5">
            <span className="text-ink">{it.name} <span className="text-muted">×{it.quantity}</span>
              {it.note && <span className="text-amber-600 text-xs"> · {it.note}</span>}
            </span>
            <span className="text-muted">{som(it.unitPrice * it.quantity)}</span>
          </div>
        ))}
        <div className="flex items-start gap-2 mt-3 pt-3 border-t border-line text-xs text-muted">
          <i className="ti ti-map-pin mt-0.5" />
          <div className="flex-1">
            <div>{o.address}</div>
            {o.phone && <div className="mt-0.5"><i className="ti ti-phone text-[11px]" /> {o.phone}</div>}
          </div>
        </div>
      </div>

      {/* Amal tugmalari */}
      {meta.next && (
        <div className="px-4 pb-4 flex gap-2">
          <button
            onClick={() => onAdvance(o)}
            className="flex-1 text-white text-sm font-semibold py-2.5 rounded-lg transition-transform active:scale-[0.98]"
            style={{ background: meta.color }}
          >
            {meta.nextLabel}
          </button>
          {canCancel && (
            <button onClick={() => onCancel(o)} className="px-4 border border-line text-muted text-sm rounded-lg hover:bg-red-50 hover:text-red-600">
              Bekor
            </button>
          )}
        </div>
      )}
      {!meta.next && o.status === 'delivering' && (
        <div className="px-4 pb-4">
          <div className="text-center text-sm text-purple-600 bg-purple-50 py-2.5 rounded-lg">
            🛵 {o.courierName} yo'lda — mijoz qabul qilishini kuting
          </div>
        </div>
      )}
    </div>
  );
}
