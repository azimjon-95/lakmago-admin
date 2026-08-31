import { useNavigate, useLocation } from 'react-router-dom';

/**
 * "Buyurtmalar / Hisobotlar" almashtirgichi.
 *
 * Ikkala sahifada (OrdersPage, RestaurantBillingPage) bir xil
 * joyda, bir xil ko'rinishda chiqadi — restoran qaysi sahifada
 * turganini yo'qotmaydi.
 */
export function OrdersBillingTabs() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isBilling = pathname === '/billing';

  return (
    <div className="obt-tabs" role="tablist">
      <button
        role="tab"
        aria-selected={!isBilling}
        onClick={() => navigate('/')}
        className={`obt-tab ${!isBilling ? 'is-active' : ''}`}
      >
        <i className="ti ti-clipboard" />
        Buyurtmalar
      </button>
      <button
        role="tab"
        aria-selected={isBilling}
        onClick={() => navigate('/billing')}
        className={`obt-tab ${isBilling ? 'is-active' : ''}`}
      >
        <i className="ti ti-cash" />
        Hisobotlar
      </button>
    </div>
  );
}
