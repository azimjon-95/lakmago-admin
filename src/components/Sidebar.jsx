import { NavLink } from 'react-router-dom';
import { useAuth } from '@/store/auth';

// Rolga qarab menyu: admin (dastur egasi) yoki restaurant (restoran)
const adminNav = [
  { to: '/', icon: 'ti-layout-dashboard', label: 'Boshqaruv', end: true },
  { to: '/restaurants', icon: 'ti-building-store', label: 'Muassasalar' },
  { to: '/orders', icon: 'ti-clipboard-list', label: 'Buyurtmalar' },
  { to: '/revenue', icon: 'ti-cash', label: 'Daromad' },
  { to: '/banners', icon: 'ti-photo', label: 'Bannerlar' },
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

export function Sidebar() {
  const user = useAuth((s) => s.user);
  const restaurant = useAuth((s) => s.restaurant);
  const logout = useAuth((s) => s.logout);
  const isAdmin = user?.role === 'admin';
  const nav = isAdmin ? adminNav : restaurantNav;

  const title = isAdmin ? 'Administrator' : restaurant?.name || 'Restoran';
  const subtitle = isAdmin ? 'Dastur egasi' : 'Restoran paneli';
  const initials = (isAdmin ? 'AD' : (restaurant?.name || 'R')).slice(0, 2).toUpperCase();

  return (
    <aside className="w-[210px] bg-sidebar flex-none p-3 flex flex-col min-h-screen">
      <div className="flex items-center gap-2 px-2 pb-5 pt-1">
        <div className="w-[32px] h-[32px] rounded-lg bg-brand-400 flex items-center justify-center">
          <i className="ti ti-tools-kitchen-2 text-brand-text text-lg" />
        </div>
        <div className="text-white font-semibold text-[15px]">LokmaGo</div>
      </div>

      <nav className="flex flex-col gap-0.5">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-brand-400/20 text-brand-100' : 'text-[#D9B98C] hover:text-brand-100'
              }`
            }
          >
            <i className={`ti ${item.icon} text-lg`} />
            {item.label}
          </NavLink>
        ))}
      </nav>

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
    </aside>
  );
}
