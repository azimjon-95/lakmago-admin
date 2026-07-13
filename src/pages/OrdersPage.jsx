import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { panelApi } from '@/api';
import { useRestaurantSocket } from '@/hooks/useRestaurantSocket';

const RESTAURANT_ID = import.meta.env.VITE_RESTAURANT_ID ?? 'demo';

// Backend ulanmaganda ko'rsatiladigan demo buyurtmalar
const demoOrders = [
{
  _id: 'A2481',
  restaurantName: 'Milliy Taomlar',
  items: [
  { name: 'Osh (Palov)', quantity: 2, unitPrice: 38000 },
  { name: 'Lag‘mon', quantity: 1, unitPrice: 32000 }],

  total: 108000,
  status: 'accepted',
  address: 'Amir Temur ko‘chasi, 12',
  createdAt: new Date(Date.now() - 2 * 60000).toISOString()
},
{
  _id: 'A2480',
  restaurantName: 'Milliy Taomlar',
  items: [
  { name: 'Manti (5 dona)', quantity: 5, unitPrice: 28000 },
  { name: 'Kabob set', quantity: 1, unitPrice: 45000 }],

  total: 73000,
  status: 'preparing',
  address: 'Chilonzor, 7-kvartal',
  createdAt: new Date(Date.now() - 11 * 60000).toISOString()
},
{
  _id: 'A2479',
  restaurantName: 'Milliy Taomlar',
  items: [{ name: 'Osh (Palov)', quantity: 1, unitPrice: 38000 }],
  total: 55000,
  status: 'delivered',
  address: 'Yunusobod, 19',
  createdAt: new Date(Date.now() - 42 * 60000).toISOString()
}];


const statusMeta = {
  accepted: { label: 'Yangi', bg: '#FAEEDA', color: '#854F0B' },
  preparing: { label: 'Tayyorlanmoqda', bg: '#E1F5EE', color: '#0F6E56' },
  delivering: { label: 'Yo‘lda', bg: '#E6F1FB', color: '#185FA5' },
  delivered: { label: 'Yetkazildi', bg: '#F1EFE8', color: '#5F5E5A' },
  cancelled: { label: 'Bekor qilindi', bg: '#FCEBEB', color: '#A32D2D' }
};

// Keyingi status oqimi
const nextStatus = {
  accepted: 'preparing',
  preparing: 'delivering',
  delivering: 'delivered'
};
const nextLabel = {
  accepted: 'Qabul qilish',
  preparing: 'Yo‘lga chiqarish',
  delivering: 'Yetkazildi deb belgilash'
};

function formatSom(v) {
  return v.toLocaleString('ru-RU').replace(/,/g, ' ') + ' so‘m';
}

function timeAgo(iso) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return `${min} daqiqa oldin`;
}

export function OrdersPage() {
  const qc = useQueryClient();

  const { data: orders = demoOrders } = useQuery({
    queryKey: ['panel-orders', RESTAURANT_ID],
    queryFn: async () => {
      try {
        return await panelApi.getOrders(RESTAURANT_ID);
      } catch {
        return demoOrders; // backend yo'q — demo
      }
    },
    refetchInterval: 15000
  });

  const refetch = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['panel-orders'] });
  }, [qc]);

  useRestaurantSocket(RESTAURANT_ID === 'demo' ? null : RESTAURANT_ID, refetch);

  const mutation = useMutation({
    mutationFn: ({ id, status }) =>
    panelApi.updateStatus(id, status),
    onSuccess: refetch
  });

  function advance(order) {
    const next = nextStatus[order.status];
    if (next) mutation.mutate({ id: order._id, status: next });
  }

  const newCount = orders.filter((o) => o.status === 'accepted').length;
  const todayRevenue = orders.reduce((s, o) => s + o.total, 0);

  return (
    <div className="flex-1 p-5 min-w-0">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-medium text-ink">Buyurtmalar</h1>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="w-2 h-2 rounded-full bg-[#1D9E75]" /> Real-time yoqilgan
        </div>
      </div>

      {/* Statistika */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <Stat label="Bugungi buyurtma" value={String(orders.length)} />
        <Stat label="Tushum" value={formatSom(todayRevenue)} />
        <Stat label="Yangi" value={String(newCount)} highlight />
        <Stat label="Reyting" value="4.8" />
      </div>

      {/* Buyurtmalar */}
      <div className="flex flex-col gap-2.5">
        {orders.map((order) => {
          const meta = statusMeta[order.status];
          const isNew = order.status === 'accepted';
          const isDone = order.status === 'delivered' || order.status === 'cancelled';
          const itemsText = order.items.
          map((i) => `${i.name} ×${i.quantity}`).
          join(' · ');

          return (
            <div
              key={order._id}
              className={`bg-surface rounded-xl p-3.5 ${
              isNew ? 'border border-brand-400 animate-fade' : 'border border-line'} ${
              isDone ? 'opacity-70' : ''}`}>
              
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink">#{order._id}</span>
                  <span
                    className="text-[11px] px-2.5 py-0.5 rounded-full"
                    style={{ background: meta.bg, color: meta.color }}>
                    
                    {meta.label}
                  </span>
                </div>
                <span className="text-xs text-muted">{timeAgo(order.createdAt)}</span>
              </div>

              {!isDone &&
              <>
                  <div className="text-[13px] text-muted mb-1">{itemsText}</div>
                  <div className="text-[13px] text-muted mb-2.5">
                    <i className="ti ti-map-pin text-xs align-[-1px]" aria-hidden="true" />{' '}
                    {order.address} ·{' '}
                    <span className="text-ink font-medium">{formatSom(order.total)}</span>
                  </div>
                </>
              }
              {isDone &&
              <div className="text-xs text-muted">
                  {itemsText} · {formatSom(order.total)}
                </div>
              }

              {nextStatus[order.status] &&
              <div className="flex gap-2 mt-1">
                  <button
                  onClick={() => advance(order)}
                  disabled={mutation.isPending}
                  className={`flex-1 rounded-lg py-2 font-medium text-[13px] transition-colors ${
                  isNew ?
                  'bg-brand-400 text-brand-text' :
                  'bg-brand-ink text-white'}`
                  }>
                  
                    {nextLabel[order.status]}
                    {!isNew && ' →'}
                  </button>
                  {isNew &&
                <button
                  onClick={() =>
                  mutation.mutate({ id: order._id, status: 'cancelled' })
                  }
                  className="border border-line rounded-lg px-4 text-[13px] text-muted hover:bg-canvas">
                  
                      Rad etish
                    </button>
                }
                </div>
              }
            </div>);

        })}
      </div>
    </div>);

}

function Stat({
  label,
  value,
  highlight




}) {
  return (
    <div className="bg-surface rounded-lg p-3 border border-line">
      <div className="text-xs text-muted">{label}</div>
      <div
        className="text-[22px] font-medium mt-0.5"
        style={{ color: highlight ? '#BA7517' : '#1A1A17' }}>
        
        {value}
      </div>
    </div>);

}
