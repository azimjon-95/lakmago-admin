import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/api/admin';

const demoStats = {
  restaurants: 24,
  pendingRestaurants: 3,
  users: 1840,
  orders: 5620,
  totalRevenue: 284000000,
  commission: 34080000
};

const demoRestaurants = [
{ _id: 'p1', name: 'Osh Markazi', cuisine: 'Milliy oshxona', category: 'milliy', isApproved: false, createdAt: new Date().toISOString() },
{ _id: 'p2', name: 'Pizza Time', cuisine: 'Italyan', category: 'fastfood', isApproved: false, createdAt: new Date().toISOString() },
{ _id: 'p3', name: 'Choyxona 24', cuisine: 'Milliy', category: 'milliy', isApproved: false, createdAt: new Date().toISOString() }];


function formatSom(v) {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + ' mln';
  return v.toLocaleString('ru-RU').replace(/,/g, ' ');
}

export function AdminPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('pending');

  const { data: stats = demoStats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      try {
        return await adminApi.getStats();
      } catch {
        return demoStats;
      }
    }
  });

  const { data: restaurants = demoRestaurants } = useQuery({
    queryKey: ['admin-restaurants', tab],
    queryFn: async () => {
      try {
        return await adminApi.getRestaurants(tab);
      } catch {
        return tab === 'pending' ? demoRestaurants : [];
      }
    }
  });

  const mutation = useMutation({
    mutationFn: ({ id, approved }) =>
    adminApi.approve(id, approved),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-restaurants'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
    }
  });

  return (
    <div className="flex-1 p-5 min-w-0">
      <h1 className="text-lg font-medium text-ink mb-4">Admin panel</h1>

      <div className="grid grid-cols-4 gap-3 mb-5">
        <Stat label="Restoranlar" value={String(stats.restaurants)} />
        <Stat label="Foydalanuvchilar" value={stats.users.toLocaleString('ru-RU').replace(/,/g, ' ')} />
        <Stat label="Buyurtmalar" value={stats.orders.toLocaleString('ru-RU').replace(/,/g, ' ')} />
        <Stat label="Komissiya" value={formatSom(stats.commission) + ' so‘m'} highlight />
      </div>

      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setTab('pending')}
          className="text-sm px-3.5 py-1.5 rounded-full"
          style={
          tab === 'pending' ?
          { background: '#411E00', color: '#FAEEDA', fontWeight: 500 } :
          { border: '0.5px solid #EAE7DF', color: '#6B6B66' }
          }>
          
          Tasdiqlanmagan ({stats.pendingRestaurants})
        </button>
        <button
          onClick={() => setTab('approved')}
          className="text-sm px-3.5 py-1.5 rounded-full"
          style={
          tab === 'approved' ?
          { background: '#411E00', color: '#FAEEDA', fontWeight: 500 } :
          { border: '0.5px solid #EAE7DF', color: '#6B6B66' }
          }>
          
          Tasdiqlangan
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {restaurants.length === 0 &&
        <div className="text-center text-muted text-sm py-8">Bu bo‘limda restoran yo‘q.</div>
        }
        {restaurants.map((r) =>
        <div
          key={r._id}
          className="bg-surface border border-line rounded-xl p-3.5 flex items-center gap-3">
          
            <div className="w-11 h-11 rounded-lg bg-brand-50 flex items-center justify-center flex-none">
              <i className="ti ti-building-store text-xl" style={{ color: '#EF9F27' }} aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-ink">{r.name}</div>
              <div className="text-xs text-muted">{r.cuisine}</div>
            </div>
            {r.isApproved ?
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#E1F5EE] text-[#0F6E56]">
                Tasdiqlangan
              </span> :

          <div className="flex gap-2">
                <button
              onClick={() => mutation.mutate({ id: r._id, approved: true })}
              className="bg-brand-400 text-brand-text text-[13px] font-medium px-3.5 py-1.5 rounded-lg">
              
                  Tasdiqlash
                </button>
                <button
              onClick={() => mutation.mutate({ id: r._id, approved: false })}
              className="border border-line text-muted text-[13px] px-3 py-1.5 rounded-lg">
              
                  Rad etish
                </button>
              </div>
          }
          </div>
        )}
      </div>
    </div>);

}

function Stat({ label, value, highlight }) {
  return (
    <div className="bg-surface rounded-lg p-3 border border-line">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-[22px] font-medium mt-0.5" style={{ color: highlight ? '#BA7517' : '#1A1A17' }}>
        {value}
      </div>
    </div>);

}
