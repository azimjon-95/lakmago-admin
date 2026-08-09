import { useState, useEffect, useCallback, useRef } from 'react';
import { panelApi } from '@/api';
import { getSocket, joinRestaurant } from '@/lib/socket';
import { useAuth } from '@/store/auth';
import { confirm } from '@/components/ui/confirm';

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
    const socket = getSocket();
    joinRestaurant(restaurant?._id);

    const onNew = (order) => {
      setOrders((prev) => {
        if (prev.find((o) => o._id === order._id)) return prev;
        return [order, ...prev];
      });
      // Ovoz endi markaziy bildirishnoma tizimida (lib/notificationCenter).
      // Bu yerda faqat kartani yoritamiz.
      if (!knownIds.current.has(order._id)) {
        knownIds.current.add(order._id);
        setFlashId(order._id);
        setTimeout(() => setFlashId(null), 5000);
      }
    };
    const onUpdate = (order) => {
      setOrders((prev) => prev.map((o) => (o._id === order._id ? order : o)));
    };
    socket.on('order:new', onNew);
    socket.on('order:update', onUpdate);

    const poll = setInterval(load, 25000);
    return () => {
      clearInterval(poll);
      socket.off('order:new', onNew);
      socket.off('order:update', onUpdate);
    };
  }, [load, restaurant]);

  // Ayni paytda so'rov ketayotgan buyurtmalar — takror bosishni bloklaydi
  const [busyIds, setBusyIds] = useState(() => new Set());

  const advance = async (o) => {
    const next = flow[o.status]?.next;
    if (!next) return;
    // Tugma ikki marta bosilsa ikkinchi so'rov ketmaydi
    if (busyIds.has(o._id)) return;
    setBusyIds((prev) => new Set(prev).add(o._id));

    // Optimistik yangilash
    setOrders((prev) => prev.map((x) => (x._id === o._id ? { ...x, status: next } : x)));
    try {
      await panelApi.updateOrderStatus(o._id, next);
    } catch {
      load();
    } finally {
      setBusyIds((prev) => {
        const n = new Set(prev);
        n.delete(o._id);
        return n;
      });
    }
  };

  // Naqd to'lov qabul qilindi deb belgilash
  const markPaid = async (id) => {
    try {
      await panelApi.markOrderPaid(id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const cancel = async (o) => {
    if (!await confirm({ title: 'Buyurtma bekor qilinsinmi?' })) return;
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
        <div className="flex flex-none items-center gap-3">
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
              <OrderCard key={o._id} order={o} flash={flashId === o._id} busy={busyIds.has(o._id)} onAdvance={advance} onCancel={cancel} onPaid={markPaid} />
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

function OrderCard({ order: o, flash, busy, onAdvance, onCancel, onPaid }) {
  const meta = flow[o.status] || {};
  const canCancel = ['pending', 'accepted', 'preparing'].includes(o.status);
  // Qancha vaqt o'tgani — daqiqa/soat/kun bilan
  const elapsedMin = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 60000);
  const elapsed = elapsedMin < 60
    ? `${elapsedMin} daq`
    : elapsedMin < 1440
      ? `${Math.floor(elapsedMin / 60)} soat`
      : `${Math.floor(elapsedMin / 1440)} kun`;

  return (
    <div
      className={`bg-surface border rounded-xl overflow-hidden transition-all ${
        flash || o.status === 'pending' ? 'border-red-400 ring-2 ring-red-400/20' : 'border-line'
      }`}
    >
      {/* Sarlavha */}
      <div className="p-4 flex items-start justify-between gap-2 border-b border-line">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: `${meta.color}20`, color: meta.color }}>
            {meta.label}
          </span>
          <span className="text-xs text-muted whitespace-nowrap">
            {new Date(o.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            {elapsedMin > 0 && ` · ${elapsed} oldin`}
          </span>
        </div>
        <div className="text-right flex-none">
          <div className="font-semibold text-ink whitespace-nowrap">{som(o.total)} so'm</div>
          {/* To'lov: usuli va holati */}
          <div className={`text-[11px] font-medium ${o.isPaid ? 'text-green-600' : 'text-amber-600'}`}>
            {o.paymentMethod === 'cash' ? '💵 Naqd' : '💳 Karta'}
            {' · '}
            {o.isPaid ? "To'langan" : "To'lanmagan"}
          </div>
        </div>
      </div>

      {/* ===== ASOSIY KO'RSATKICH — restoran adashmasligi uchun ===== */}
      <div className={`px-4 py-3 flex items-center gap-3 ${
        o.fulfillment === 'pickup' ? 'bg-violet-50' : 'bg-blue-50'
      }`}>
        <i className={`ti ${o.fulfillment === 'pickup' ? 'ti-shopping-bag' : 'ti-bike'} text-2xl flex-none ${
          o.fulfillment === 'pickup' ? 'text-violet-700' : 'text-blue-700'
        }`} />
        <div className="min-w-0 flex-1">
          <div className={`font-semibold text-sm ${
            o.fulfillment === 'pickup' ? 'text-violet-800' : 'text-blue-800'
          }`}>
            {o.fulfillment === 'pickup' ? "MIJOZ O'ZI OLIB KETADI" : 'YETKAZIB BERISH'}
          </div>
          <div className={`text-xs mt-0.5 ${
            o.fulfillment === 'pickup' ? 'text-violet-700' : 'text-blue-700'
          }`}>
            {o.timingMode === 'scheduled' && o.scheduledFor ? (
              <>
                <b>{new Date(o.scheduledFor).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</b>
                {new Date(o.scheduledFor).toDateString() !== new Date().toDateString()
                  ? ` · ${new Date(o.scheduledFor).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}`
                  : ' (bugun)'}
                {o.fulfillment === 'pickup' ? ' ga mijoz keladi' : ' ga yetkazish'}
              </>
            ) : (
              <>Imkon qadar tez {o.fulfillment === 'pickup' ? '— mijoz kutmoqda' : ''}</>
            )}
          </div>
        </div>
        {/* Belgilangan vaqtga qancha qolgani */}
        {o.timingMode === 'scheduled' && o.scheduledFor && (
          <div className="text-right flex-none">
            <div className="text-[10px] text-muted">qoldi</div>
            <div className={`text-sm font-bold ${
              (new Date(o.scheduledFor) - Date.now()) / 60000 < 30 ? 'text-red-600' : 'text-ink'
            }`}>
              {(() => {
                const min = Math.round((new Date(o.scheduledFor) - Date.now()) / 60000);
                if (min < 0) return "o'tdi";
                if (min < 60) return `${min} daq`;
                return `${Math.floor(min / 60)} soat`;
              })()}
            </div>
          </div>
        )}
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
        {/* Hisob taqsimoti — bonus yoki qo'shimcha haq bo'lsa */}
        {(o.deliveryFee > 0 || o.serviceFee > 0 || o.bonusUsed > 0) && (
          <div className="mt-2 pt-2 border-t border-line text-xs text-muted">
            <div className="flex justify-between py-0.5">
              <span>Taomlar</span><span>{som(o.subtotal)}</span>
            </div>
            {o.deliveryFee > 0 && (
              <div className="flex justify-between py-0.5">
                <span>Yetkazish</span><span>{som(o.deliveryFee)}</span>
              </div>
            )}
            {o.serviceFee > 0 && (
              <div className="flex justify-between py-0.5">
                <span>Xizmat haqi</span><span>{som(o.serviceFee)}</span>
              </div>
            )}
            {o.bonusUsed > 0 && (
              <div className="flex justify-between py-0.5 text-green-600">
                <span>Bonus bilan to'landi</span><span>−{som(o.bonusUsed)}</span>
              </div>
            )}
            <div className="flex justify-between py-1 mt-1 border-t border-line font-semibold text-ink">
              <span>Mijoz to'laydi</span><span>{som(o.total)} so'm</span>
            </div>
          </div>
        )}

        {/* To'lov qabul qilindi — naqd uchun */}
        {!o.isPaid && o.paymentMethod === 'cash' && (
          <button
            onClick={() => onPaid?.(o._id)}
            className="w-full mt-3 py-2 rounded-lg border border-green-300 text-green-700 text-xs font-medium hover:bg-green-50"
          >
            <i className="ti ti-cash" /> To'lov qabul qilindi deb belgilash
          </button>
        )}

        {/* ===== MIJOZ MA'LUMOTLARI ===== */}
        <div className="mt-2 pt-3 border-t border-line">
          {/* Ism va aloqa */}
          <div className="flex items-center gap-2.5 mb-2">
            {o.customer?.photoUrl ? (
              <img
                src={o.customer.photoUrl}
                alt=""
                className="w-8 h-8 rounded-full object-cover flex-none"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center flex-none">
                <i className="ti ti-user text-brand-600 text-sm" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-ink truncate">
                {o.customer?.name || 'Mijoz'}
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {(o.phone || o.customer?.phone) && (
                  <a
                    href={`tel:${o.phone || o.customer.phone}`}
                    className="text-xs font-medium text-brand-600 hover:underline whitespace-nowrap"
                  >
                    {o.phone || o.customer.phone}
                  </a>
                )}
                {o.customer?.username && (
                  <a
                    href={`https://t.me/${o.customer.username}`}
                    target="_blank" rel="noreferrer"
                    className="text-xs text-blue-600 hover:underline inline-flex min-w-0 items-center gap-1"
                  >
                    <i className="ti ti-brand-telegram text-[11px] flex-none" />
                    <span className="truncate">@{o.customer.username}</span>
                  </a>
                )}
              </div>
            </div>

            {/* Qo'ng'iroq */}
            {(o.phone || o.customer?.phone) && (
              <a
                href={`tel:${o.phone || o.customer.phone}`}
                className="flex-none w-9 h-9 rounded-lg bg-green-50 text-green-700 flex items-center justify-center hover:bg-green-100"
                title="Qo'ng'iroq qilish"
              >
                <i className="ti ti-phone" />
              </a>
            )}
          </div>

          {/* Manzil — faqat yetkazishda. Olib ketish tepada
              katta harflar bilan allaqachon yozilgan. */}
          {o.fulfillment !== 'pickup' && (
          <div className="flex items-start gap-2 text-xs text-muted">
            <i className="ti ti-map-pin mt-0.5 flex-none" />
            <div className="flex-1 min-w-0">
              {(
                <>
                  <div className="break-words text-ink">
                    {o.address || 'Manzil ko\'rsatilmagan'}
                  </div>
                  {o.addressNote && (
                    <div className="mt-0.5">{o.addressNote}</div>
                  )}
                  {/* Xaritada ko'rish */}
                  {o.addressLat && o.addressLng && (
                    <a
                      href={`https://yandex.uz/maps/?pt=${o.addressLng},${o.addressLat}&z=17&l=map`}
                      target="_blank" rel="noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1.5 text-brand-600 hover:underline font-medium"
                    >
                      <i className="ti ti-map-2 text-[13px]" />
                      Xaritada ko'rish
                    </a>
                  )}
                </>
              )}
            </div>
          </div>
          )}
        </div>
      </div>

      {/* Amal tugmalari */}
      {meta.next && (
        <div className="px-4 pb-4 flex gap-2">
          <button
            onClick={() => onAdvance(o)}
            disabled={busy}
            className="min-w-0 flex-1 truncate rounded-xl py-3 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
            style={{ background: meta.color }}
          >
            {busy ? '...' : meta.nextLabel}
          </button>
          {canCancel && (
            <button onClick={() => onCancel(o)} className="flex-none rounded-xl border border-line px-4 py-3 text-sm text-muted hover:bg-red-50 hover:text-red-600">
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
