import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { Sidebar } from '@/components/Sidebar';
import { LoginPage } from '@/pages/LoginPage';
// Admin sahifalari
import { DashboardPage } from '@/pages/admin/DashboardPage';
import { RestaurantsPage } from '@/pages/admin/RestaurantsPage';
import { CreateRestaurantLayout } from '@/pages/admin/create-restaurant/context';
import { Step1Basic } from '@/pages/admin/create-restaurant/Step1Basic';
import { Step2Address } from '@/pages/admin/create-restaurant/Step2Address';
import { Step3Settings } from '@/pages/admin/create-restaurant/Step3Settings';
import { Step4Review } from '@/pages/admin/create-restaurant/Step4Review';
import { RestaurantSettingsPage } from '@/pages/admin/RestaurantSettingsPage';
import { RestaurantDetailPage } from '@/pages/admin/RestaurantDetailPage';
import { UsersPage } from '@/pages/admin/UsersPage';
import { SettingsPage } from '@/pages/admin/SettingsPage';
import { BillingPage } from '@/pages/admin/BillingPage';
import { CatalogPage } from '@/pages/admin/CatalogPage';
import { PromoAdminPage } from '@/pages/admin/PromoAdminPage';
import { DineInAdminPage } from '@/pages/admin/DineInAdminPage';
import { RevenuePage } from '@/pages/admin/RevenuePage';
import { BannersPage } from '@/pages/admin/BannersPage';
import { OrdersMonitorPage } from '@/pages/admin/OrdersMonitorPage';
import { GroupsPage } from '@/pages/admin/GroupsPage';
import { SupportPage } from '@/pages/admin/SupportPage';
// Restoran sahifalari
import { RestaurantOrdersPage } from '@/pages/restaurant/OrdersPage';
import { RestaurantMenuPage } from '@/pages/restaurant/MenuPage';
import { RestaurantBannerPage } from '@/pages/restaurant/BannerPage';
import { RestaurantProfilePage } from '@/pages/restaurant/ProfilePage';
import { StopListPage } from '@/pages/restaurant/StopListPage';
import { DineInPage } from '@/pages/restaurant/DineInPage';
import { DineInLivePage } from '@/pages/restaurant/DineInLivePage';
import { DineInHistoryPage } from '@/pages/restaurant/DineInHistoryPage';
import { MenuTransferPage } from '@/pages/restaurant/MenuTransferPage';
import { PromotionPage } from '@/pages/restaurant/PromotionPage';
import { ReservationsPage } from '@/pages/restaurant/ReservationsPage';

// Panel karkasi (sidebar + sahifa).
// Mobilda: yuqori panel + pastki tez-kirish sidebar ichida chiziladi,
// shuning uchun kontentga pastdan bo'shliq beramiz (pastki nav bosib qolmasin).
// Panel karkasi (sidebar + sahifa)
function Shell({ children }) {
  return (
    <div className="min-h-screen bg-canvas">

      {/* Sidebar */}
      <Sidebar />


      {/* Content */}
      <main
        className="
          min-h-screen
          lg:ml-[280px]
          pb-16
          lg:pb-0
          transition-all
        "
      >
        <div
          className="
            w-full
            min-h-screen
            p-4
            sm:p-5
            lg:p-8
          "
        >
          {children}
        </div>
      </main>

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
        <Route path="/restaurants/new" element={<CreateRestaurantLayout />}>
          <Route index element={<Navigate to="asosiy" replace />} />
          <Route path="asosiy" element={<Step1Basic />} />
          <Route path="manzil" element={<Step2Address />} />
          <Route path="sozlamalar" element={<Step3Settings />} />
          <Route path="tekshiruv" element={<Step4Review />} />
        </Route>
        <Route path="/restaurants/:id/settings" element={<RestaurantSettingsPage />} />
        <Route path="/restaurants/:id" element={<RestaurantDetailPage />} />
        <Route path="/orders" element={<OrdersMonitorPage />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/revenue" element={<RevenuePage />} />
        <Route path="/banners" element={<BannersPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/promo-admin" element={<PromoAdminPage />} />
        <Route path="/dine-in-admin" element={<DineInAdminPage />} />
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
        <Route path="/profile" element={<RestaurantProfilePage />} />
        <Route path="/stop-list" element={<StopListPage />} />
        <Route path="/dine-in" element={<DineInPage />} />
        <Route path="/dine-in-live" element={<DineInLivePage />} />
        <Route path="/dine-in-history" element={<DineInHistoryPage />} />
        <Route path="/menu-transfer" element={<MenuTransferPage />} />
        <Route path="/promotion" element={<PromotionPage />} />
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
