import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { Sidebar } from '@/components/Sidebar';
import { FullscreenButton } from '@/components/FullscreenButton';
import { useFullscreen, useIsMobile, useAutoFullscreenOnMobile } from '@/hooks/useFullscreen';
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

// To'liq ekran tugmasi ko'rinadigan bo'limlar.
// Bular kun bo'yi ochiq turadigan nazorat ekranlari — sidebar
// ular uchun keraksiz joy egallaydi.
const FULLSCREEN_ROUTES = [
  '/',                // Boshqaruv paneli (admin) / Buyurtmalar (restoran)
  '/orders',          // Jonli buyurtmalar
  '/dine-in',         // Dine-in
  '/dine-in-live',    // Zal buyurtmalari
  '/dine-in-admin',   // Dine-in (admin)
];

// Panel karkasi (sidebar + sahifa).
//
// Mobil va desktop farqi:
//   • Desktop — tugma bosilsa sidebar yashirinadi va sahifa butun
//     ekranni oladi. Sichqoncha bilan chiqish oson.
//   • Mobil — to'liq ekran avtomatik yoqiladi (brauzer paneli
//     aylantirganda paydo bo'lib-yo'qolib panelni sakratardi),
//     lekin ilovaning O'Z menyulari yashirilmaydi: ular yagona
//     navigatsiya vositasi.
//
// Mobilda sahifa emas, ichki maydon suriladi — yuqori panel va
// pastki menyu joyida qotib turadi.
function Shell({ children }) {
  const { pathname } = useLocation();
  const { active: fullscreen } = useFullscreen();
  const isMobile = useIsMobile();

  useAutoFullscreenOnMobile();

  // Sidebar faqat desktopda yashiriladi
  const hideChrome = fullscreen && !isMobile;

  // Tugma mobilda kerak emas — u yerda rejim o'zi yoqiladi va
  // tugma yuqori panel ustiga tushib qolardi.
  const showButton = !isMobile && (fullscreen || FULLSCREEN_ROUTES.includes(pathname));

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-canvas lg:block lg:h-auto lg:min-h-screen lg:overflow-visible">

      {/* Sidebar — desktopda to'liq ekranda yashiriladi */}
      {!hideChrome && <Sidebar />}

      {showButton && <FullscreenButton />}

      {/* Kontent. Mobilda aynan shu maydon suriladi. */}
      <main
        className={`min-h-0 flex-1 overflow-y-auto overscroll-contain lg:min-h-screen lg:flex-none lg:overflow-visible ${
          hideChrome ? '' : 'lg:ml-[280px] lg:pb-0'
        }`}
      >
        {/* Pastki menyu fixed — oxirgi element uning ostida
            qolib ketmasligi uchun bo'shliq qoldiramiz */}
        <div
          className={`w-full pb-[calc(64px+env(safe-area-inset-bottom,0px))] lg:min-h-screen lg:pb-0 ${
            showButton ? 'pr-14' : ''
          }`}
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
