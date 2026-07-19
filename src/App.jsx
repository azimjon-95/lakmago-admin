import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { Sidebar } from '@/components/Sidebar';
import { LoginPage } from '@/pages/LoginPage';
// Admin sahifalari
import { DashboardPage } from '@/pages/admin/DashboardPage';
import { RestaurantsPage } from '@/pages/admin/RestaurantsPage';
import { CreateRestaurantPage } from '@/pages/admin/CreateRestaurantPage';
import { RestaurantSettingsPage } from '@/pages/admin/RestaurantSettingsPage';
import { UsersPage } from '@/pages/admin/UsersPage';
import { SettingsPage } from '@/pages/admin/SettingsPage';
import { RevenuePage } from '@/pages/admin/RevenuePage';
import { BannersPage } from '@/pages/admin/BannersPage';
import { OrdersMonitorPage } from '@/pages/admin/OrdersMonitorPage';
import { GroupsPage } from '@/pages/admin/GroupsPage';
// Restoran sahifalari
import { RestaurantOrdersPage } from '@/pages/restaurant/OrdersPage';
import { RestaurantMenuPage } from '@/pages/restaurant/MenuPage';
import { RestaurantBannerPage } from '@/pages/restaurant/BannerPage';
import { ReservationsPage } from '@/pages/restaurant/ReservationsPage';

// Panel karkasi (sidebar + sahifa)
function Shell({ children }) {
  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar />
      <main className="flex-1 flex min-w-0">{children}</main>
    </div>
  );
}

// Admin uchun himoyalangan sahifalar
function AdminRoutes() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/restaurants" element={<RestaurantsPage />} />
        <Route path="/restaurants/new" element={<CreateRestaurantPage />} />
        <Route path="/restaurants/:id/settings" element={<RestaurantSettingsPage />} />
        <Route path="/orders" element={<OrdersMonitorPage />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/revenue" element={<RevenuePage />} />
        <Route path="/banners" element={<BannersPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

// Restoran uchun himoyalangan sahifalar
function RestaurantRoutes() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<RestaurantOrdersPage />} />
        <Route path="/menu" element={<RestaurantMenuPage />} />
        <Route path="/banner" element={<RestaurantBannerPage />} />
        <Route path="/reservations" element={<ReservationsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

function AppInner() {
  const status = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);
  const init = useAuth((s) => s.init);

  useEffect(() => { init(); }, [init]);

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas text-muted">
        <i className="ti ti-loader-2 animate-spin text-2xl" />
      </div>
    );
  }

  // Kirmagan bo'lsa — login. /eka bo'lsa admin ko'rinishi.
  if (status === 'guest') {
    return (
      <Routes>
        <Route path="/eka" element={<LoginPage isAdminRoute />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  // Kirgan — rolga qarab
  if (user?.role === 'admin') return <AdminRoutes />;
  if (user?.role === 'restaurant') return <RestaurantRoutes />;

  return <div className="p-10 text-center text-muted">Noma'lum rol</div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}
