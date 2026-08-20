import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { Sidebar } from '@/components/Sidebar';
import { NotificationCenter } from '@/components/NotificationCenter';
import { LoginPage } from '@/pages/LoginPage';

/*
 * KOD BO'LINISHI (code splitting) — 2026-08 optimizatsiya.
 *
 * Avval 37 ta sahifa bitta faylga (554 KB) qo'shilib, foydalanuvchi
 * qaysi sahifaga kirishidan qat'i nazar HAMMASI birdan yuklanardi —
 * "panel og'ir ochiladi" shikoyatining asosiy sababi shu edi.
 *
 * Endi har bir sahifa alohida bo'lak: faqat ochilgan sahifa
 * yuklanadi. Login sahifasi ataylab lazy EMAS — u birinchi
 * ko'rinadigan ekran, uni kechiktirish mantiqsiz.
 */
const DashboardPage = lazy(() => import('@/pages/admin/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const RestaurantsPage = lazy(() => import('@/pages/admin/RestaurantsPage').then((m) => ({ default: m.RestaurantsPage })));
const CreateRestaurantLayout = lazy(() => import('@/pages/admin/create-restaurant/context').then((m) => ({ default: m.CreateRestaurantLayout })));
const Step1Basic = lazy(() => import('@/pages/admin/create-restaurant/Step1Basic').then((m) => ({ default: m.Step1Basic })));
const Step2Address = lazy(() => import('@/pages/admin/create-restaurant/Step2Address').then((m) => ({ default: m.Step2Address })));
const Step3Settings = lazy(() => import('@/pages/admin/create-restaurant/Step3Settings').then((m) => ({ default: m.Step3Settings })));
const Step4Review = lazy(() => import('@/pages/admin/create-restaurant/Step4Review').then((m) => ({ default: m.Step4Review })));
const RestaurantSettingsPage = lazy(() => import('@/pages/admin/RestaurantSettingsPage').then((m) => ({ default: m.RestaurantSettingsPage })));
const RestaurantDetailPage = lazy(() => import('@/pages/admin/RestaurantDetailPage').then((m) => ({ default: m.RestaurantDetailPage })));
const UsersPage = lazy(() => import('@/pages/admin/UsersPage').then((m) => ({ default: m.UsersPage })));
const SettingsPage = lazy(() => import('@/pages/admin/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const BillingPage = lazy(() => import('@/pages/admin/BillingPage').then((m) => ({ default: m.BillingPage })));
const StaffPage = lazy(() => import('@/pages/admin/StaffPage').then((m) => ({ default: m.StaffPage })));
const CatalogPage = lazy(() => import('@/pages/admin/CatalogPage').then((m) => ({ default: m.CatalogPage })));
const PromoAdminPage = lazy(() => import('@/pages/admin/PromoAdminPage').then((m) => ({ default: m.PromoAdminPage })));
const DineInAdminPage = lazy(() => import('@/pages/admin/DineInAdminPage').then((m) => ({ default: m.DineInAdminPage })));
const RevenuePage = lazy(() => import('@/pages/admin/RevenuePage').then((m) => ({ default: m.RevenuePage })));
const BannersPage = lazy(() => import('@/pages/admin/BannersPage').then((m) => ({ default: m.BannersPage })));
const OrdersMonitorPage = lazy(() => import('@/pages/admin/OrdersMonitorPage').then((m) => ({ default: m.OrdersMonitorPage })));
const GroupsPage = lazy(() => import('@/pages/admin/GroupsPage').then((m) => ({ default: m.GroupsPage })));
const SupportPage = lazy(() => import('@/pages/admin/SupportPage').then((m) => ({ default: m.SupportPage })));
const RestaurantOrdersPage = lazy(() => import('@/pages/restaurant/OrdersPage').then((m) => ({ default: m.RestaurantOrdersPage })));
const RestaurantMenuPage = lazy(() => import('@/pages/restaurant/MenuPage').then((m) => ({ default: m.RestaurantMenuPage })));
const RestaurantBannerPage = lazy(() => import('@/pages/restaurant/BannerPage').then((m) => ({ default: m.RestaurantBannerPage })));
const RestaurantProfilePage = lazy(() => import('@/pages/restaurant/ProfilePage').then((m) => ({ default: m.RestaurantProfilePage })));
const StopListPage = lazy(() => import('@/pages/restaurant/StopListPage').then((m) => ({ default: m.StopListPage })));
const DineInPage = lazy(() => import('@/pages/restaurant/DineInPage').then((m) => ({ default: m.DineInPage })));
const DineInLivePage = lazy(() => import('@/pages/restaurant/DineInLivePage').then((m) => ({ default: m.DineInLivePage })));
const DineInHistoryPage = lazy(() => import('@/pages/restaurant/DineInHistoryPage').then((m) => ({ default: m.DineInHistoryPage })));
const MenuTransferPage = lazy(() => import('@/pages/restaurant/MenuTransferPage').then((m) => ({ default: m.MenuTransferPage })));
const PromotionPage = lazy(() => import('@/pages/restaurant/PromotionPage').then((m) => ({ default: m.PromotionPage })));
const ReservationsPage = lazy(() => import('@/pages/restaurant/ReservationsPage').then((m) => ({ default: m.ReservationsPage })));

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

/** Sahifa bo'lagi yuklanayotganda ko'rinadigan yengil ko'rsatkich. */
function PageLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-7 w-7 animate-spin rounded-full border-[2.5px] border-line border-t-brand-400" />
    </div>
  );
}

function Shell({ children }) {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-canvas lg:block lg:h-auto lg:min-h-screen lg:overflow-visible">

      <Sidebar />

      {/* Bildirishnoma markazi — sahifa almashsa ham yashamaydi,
          shuning uchun karkas darajasida turadi */}
      <NotificationCenter />

      {/* Kontent. Mobilda aynan shu maydon suriladi. */}
      <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain lg:ml-[280px] lg:min-h-screen lg:flex-none lg:overflow-visible lg:pb-0">
        {/* Pastki menyu fixed — oxirgi element uning ostida
            qolib ketmasligi uchun bo'shliq qoldiramiz */}
        <div className="w-full pb-[calc(64px+env(safe-area-inset-bottom,0px))] lg:min-h-screen lg:pb-0">
          {/* Sahifa bo'lagi yuklanguncha — yengil ko'rsatkich.
              Kod bo'linishi tufayli bu odatda bir lahza (bo'lak
              kichik va keshlanadi). */}
          <Suspense fallback={<PageLoading />}>
            {children}
          </Suspense>
        </div>
      </main>

    </div>
  );
}

// Admin va LokmaGo xodimi (staff) uchun himoyalangan sahifalar.
// Xodim uchun HAR BIR sahifa `allowedPages` orqali qayta
// tekshiriladi — sidebar'da yashirilgan bo'lsa ham, to'g'ridan-
// to'g'ri URL orqali kirishga urinilsa qayta yo'naltiriladi
// (server API'si baribir 403 qaytaradi, lekin bo'sh/singan
// sahifa ko'rsatish o'rniga tozaroq tajriba).
function Guarded({ page, children }) {
  const user = useAuth((s) => s.user);
  if (user?.role === 'admin') return children;
  if (user?.role === 'staff' && user?.allowedPages?.includes(page)) return children;
  return <Navigate to="/" replace />;
}

function AdminRoutes() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/restaurants" element={<Guarded page="restaurants"><RestaurantsPage /></Guarded>} />
        <Route path="/restaurants/new" element={<Guarded page="restaurants"><CreateRestaurantLayout /></Guarded>}>
          <Route index element={<Navigate to="asosiy" replace />} />
          <Route path="asosiy" element={<Step1Basic />} />
          <Route path="manzil" element={<Step2Address />} />
          <Route path="sozlamalar" element={<Step3Settings />} />
          <Route path="tekshiruv" element={<Step4Review />} />
        </Route>
        <Route path="/restaurants/:id/settings" element={<Guarded page="restaurants"><RestaurantSettingsPage /></Guarded>} />
        <Route path="/restaurants/:id" element={<Guarded page="restaurants"><RestaurantDetailPage /></Guarded>} />
        <Route path="/orders" element={<Guarded page="orders"><OrdersMonitorPage /></Guarded>} />
        <Route path="/groups" element={<Guarded page="groups"><GroupsPage /></Guarded>} />
        <Route path="/support" element={<Guarded page="notifications"><SupportPage /></Guarded>} />
        <Route path="/revenue" element={<Guarded page="revenue"><RevenuePage /></Guarded>} />
        <Route path="/banners" element={<Guarded page="banners"><BannersPage /></Guarded>} />
        <Route path="/settings" element={<Guarded page="settings"><SettingsPage /></Guarded>} />
        <Route path="/billing" element={<Guarded page="billing"><BillingPage /></Guarded>} />
        <Route path="/staff" element={<Guarded page="staff"><StaffPage /></Guarded>} />
        <Route path="/catalog" element={<Guarded page="catalog"><CatalogPage /></Guarded>} />
        <Route path="/promo-admin" element={<Guarded page="marketing"><PromoAdminPage /></Guarded>} />
        <Route path="/dine-in-admin" element={<Guarded page="dinein"><DineInAdminPage /></Guarded>} />
        <Route path="/users" element={<Guarded page="settings"><UsersPage /></Guarded>} />
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
  if (user?.role === 'admin' || user?.role === 'staff') return <AdminRoutes />;
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
