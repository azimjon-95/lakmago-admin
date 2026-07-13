import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Sidebar } from '@/components/Sidebar';
import { OrdersPage } from '@/pages/OrdersPage';
import { MenuPage } from '@/pages/MenuPage';
import { ReservationsPage } from '@/pages/ReservationsPage';
import { AdminPage } from '@/pages/AdminPage';
import { PromosPage, StatsPage, SettingsPage } from '@/pages/StubPages';
import { panelApi } from '@/api';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: false } },
});

const RESTAURANT_ID = import.meta.env.VITE_RESTAURANT_ID ?? 'demo';

function Shell() {
  const { data: newCount = 1 } = useQuery({
    queryKey: ['new-count'],
    queryFn: async () => {
      try {
        const orders = await panelApi.getOrders(RESTAURANT_ID);
        return orders.filter((o) => o.status === 'accepted').length;
      } catch {
        return 1;
      }
    },
    refetchInterval: 15000,
  });

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar newCount={newCount} />
      <Routes>
        <Route path="/" element={<OrdersPage />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/reservations" element={<ReservationsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/promos" element={<PromosPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
