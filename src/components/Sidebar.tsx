import { NavLink } from 'react-router-dom';

const nav = [
  { to: '/', icon: 'ti-clipboard-list', label: 'Buyurtmalar', badge: true },
  { to: '/menu', icon: 'ti-book', label: 'Menyu' },
  { to: '/reservations', icon: 'ti-calendar', label: 'Bronlar' },
  { to: '/promos', icon: 'ti-discount-2', label: 'Aksiyalar' },
  { to: '/stats', icon: 'ti-chart-bar', label: 'Statistika' },
  { to: '/admin', icon: 'ti-shield-check', label: 'Admin' },
  { to: '/settings', icon: 'ti-settings', label: 'Sozlamalar' },
];

export function Sidebar({ newCount }: { newCount: number }) {
  return (
    <aside className="w-[190px] bg-sidebar flex-none p-3 flex flex-col min-h-screen">
      <div className="flex items-center gap-2 px-2 pb-4">
        <div className="w-[30px] h-[30px] rounded-lg bg-brand-400 flex items-center justify-center">
          <i className="ti ti-tools-kitchen-2 text-brand-text text-lg" aria-hidden="true" />
        </div>
        <div className="text-white font-medium text-[15px]">LokmaGo</div>
      </div>

      <nav className="flex flex-col gap-0.5">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-brand-400/20 text-brand-100'
                  : 'text-[#D9B98C] hover:text-brand-100'
              }`
            }
          >
            <i className={`ti ${item.icon} text-lg`} aria-hidden="true" />
            {item.label}
            {item.badge && newCount > 0 && (
              <span className="ml-auto bg-brand-400 text-brand-text text-[11px] px-[7px] rounded-full">
                {newCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex items-center gap-2.5 px-2.5 py-2 border-t border-white/10">
        <div className="w-[30px] h-[30px] rounded-full bg-brand-400 text-brand-text flex items-center justify-center font-medium text-xs">
          MT
        </div>
        <div className="text-white text-xs leading-tight">
          Milliy Taomlar
          <br />
          <span className="text-[#D9B98C] text-[11px]">Restoran</span>
        </div>
      </div>
    </aside>
  );
}
