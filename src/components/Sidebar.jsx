import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/store/auth';

// Rolga qarab menyu: admin (dastur egasi) yoki restaurant (restoran)
const adminNav = [
  { to: '/', icon: 'ti-layout-dashboard', label: 'Boshqaruv', end: true },
  { to: '/restaurants', icon: 'ti-building-store', label: 'Muassasalar' },
  { to: '/orders', icon: 'ti-clipboard-list', label: 'Buyurtmalar' },
  { to: '/revenue', icon: 'ti-cash', label: 'Daromad' },
  { to: '/banners', icon: 'ti-photo', label: 'Bannerlar' },
  { to: '/support', icon: 'ti-message-circle', label: 'Xabarlar' },
  { to: '/groups', icon: 'ti-brand-telegram', label: 'Guruhlar' },
  { to: '/settings', icon: 'ti-settings', label: 'Komissiya' },
  { to: '/users', icon: 'ti-users', label: 'Mijozlar' },
];
const restaurantNav = [
  { to: '/', icon: 'ti-clipboard-list', label: 'Buyurtmalar', end: true },
  { to: '/menu', icon: 'ti-book', label: 'Menyu' },
  { to: '/reservations', icon: 'ti-calendar-check', label: 'Bronlar' },
  { to: '/banner', icon: 'ti-photo', label: 'Banner' },
];

// Mobilda pastki panelda ko'rinadigan asosiy bandlar soni (qolgani "Ko'proq"da)
const MOBILE_PRIMARY_COUNT = 4;

export function Sidebar() {
  const user = useAuth((s) => s.user);
  const restaurant = useAuth((s) => s.restaurant);
  const logout = useAuth((s) => s.logout);
  const isAdmin = user?.role === 'admin';
  const nav = isAdmin ? adminNav : restaurantNav;
  const location = useLocation();

  const [open, setOpen] = useState(false); // mobil drawer holati

  // Sahifa almashganda drawer avtomatik yopiladi
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Drawer ochiqda orqa fon scroll bo'lmasin
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const title = isAdmin ? 'Administrator' : restaurant?.name || 'Restoran';
  const subtitle = isAdmin ? 'Dastur egasi' : 'Restoran paneli';
  const initials = (isAdmin ? 'AD' : (restaurant?.name || 'R')).slice(0, 2).toUpperCase();

  const primaryNav = nav.slice(0, MOBILE_PRIMARY_COUNT);
  const moreNav = nav.slice(MOBILE_PRIMARY_COUNT);

  const NavItem = ({ item, onClick }) => (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-sm transition-colors ${
          isActive ? 'bg-brand-400/20 text-brand-100' : 'text-[#D9B98C] hover:text-brand-100'
        }`
      }
    >
      <i className={`ti ${item.icon} text-lg`} />
      {item.label}
    </NavLink>
  );

  const BrandRow = () => (
    <div className="flex items-center gap-2 px-2 pb-5 pt-1">
      <div className="w-[32px] h-[32px] rounded-lg bg-brand-400 flex items-center justify-center flex-none">
        <i className="ti ti-tools-kitchen-2 text-brand-text text-lg" />
      </div>
      <div className="text-white font-semibold text-[15px]">LokmaGo</div>
    </div>
  );

  const AccountRow = () => (
    <div className="mt-auto">
      <div className="flex items-center gap-2.5 px-2.5 py-3 border-t border-white/10">
        <div className="w-[32px] h-[32px] rounded-full bg-brand-400 text-brand-text flex items-center justify-center font-medium text-xs flex-none">
          {initials}
        </div>
        <div className="text-white text-xs leading-tight min-w-0">
          <div className="truncate">{title}</div>
          <span className="text-[#D9B98C] text-[11px]">{subtitle}</span>
        </div>
      </div>
      <button
        onClick={logout}
        className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-sm text-[#D9B98C] hover:text-white hover:bg-white/5 transition-colors"
      >
        <i className="ti ti-logout text-lg" /> Chiqish
      </button>
    </div>
  );

  return (
    <>
      {/* ===== DESKTOP: qattiq yon panel (lg va undan katta) ===== */}
      <aside className="hidden lg:flex w-[210px] bg-sidebar flex-none p-3 flex-col min-h-screen">
        <BrandRow />
        <nav className="flex flex-col gap-0.5">
          {nav.map((item) => <NavItem key={item.to} item={item} />)}
        </nav>
        <AccountRow />
      </aside>

      {/* ===== MOBIL: yuqori panel (lg dan kichik) ===== */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-2 px-4 py-3 bg-sidebar">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-[30px] h-[30px] rounded-lg bg-brand-400 flex items-center justify-center flex-none">
            <i className="ti ti-tools-kitchen-2 text-brand-text text-base" />
          </div>
          <div className="text-white font-semibold text-sm truncate">{title}</div>
        </div>
        <button
          onClick={() => setOpen(true)}
          aria-label="Menyu"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-white flex-none active:bg-white/10"
        >
          <i className="ti ti-menu-2 text-xl" />
        </button>
      </header>

      {/* Pastki tez-kirish paneli (asosiy bandlar + "Ko'proq") */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex items-stretch bg-sidebar border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
        {primaryNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] ${
                isActive ? 'text-brand-100' : 'text-[#D9B98C]'
              }`
            }
          >
            <i className={`ti ${item.icon} text-lg`} />
            <span className="truncate max-w-full px-1">{item.label}</span>
          </NavLink>
        ))}
        {moreNav.length > 0 && (
          <button
            onClick={() => setOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] text-[#D9B98C]"
          >
            <i className="ti ti-dots text-lg" />
            <span>Ko'proq</span>
          </button>
        )}
      </nav>

      {/* To'liq drawer (menyu tugmasi yoki "Ko'proq" bosilganda) */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-[260px] max-w-[80vw] bg-sidebar p-3 flex flex-col h-full overflow-y-auto">
            <div className="flex items-center justify-between pb-2">
              <BrandRow />
              <button
                onClick={() => setOpen(false)}
                aria-label="Yopish"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:text-white flex-none -mt-4"
              >
                <i className="ti ti-x text-lg" />
              </button>
            </div>
            <nav className="flex flex-col gap-0.5">
              {nav.map((item) => (
                <NavItem key={item.to} item={item} onClick={() => setOpen(false)} />
              ))}
            </nav>
            <AccountRow />
          </aside>
        </div>
      )}
    </>
  );
}
