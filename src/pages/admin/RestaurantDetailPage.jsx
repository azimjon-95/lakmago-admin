import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApi } from '@/api';
import { getSocket, joinAdmin } from '@/lib/socket';

const som = (n) => (n ?? 0).toLocaleString('ru-RU');

const RESV_STATUS = {
  pending: { label: 'Kutilmoqda', cls: 'bg-amber-100 text-amber-700' },
  confirmed: { label: 'Tasdiqlangan', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rad etilgan', cls: 'bg-red-100 text-red-600' },
  cancelled: { label: 'Bekor qilingan', cls: 'bg-gray-100 text-gray-500' },
  coming: { label: 'Boramiz', cls: 'bg-green-100 text-green-700' },
  not_coming: { label: 'Bora olmaymiz', cls: 'bg-red-100 text-red-600' },
  on_way: { label: "Yo'ldamiz", cls: 'bg-violet-100 text-violet-700' },
  arrived: { label: 'Keldik', cls: 'bg-green-100 text-green-700' },
  completed: { label: 'Yakunlangan', cls: 'bg-gray-100 text-gray-500' },
};

export function RestaurantDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('menu');
  const [data, setData] = useState({ restaurant: null, dishes: [], reservations: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      adminApi.getRestaurantDishes(id),
      adminApi.getRestaurantReservations(id),
    ])
      .then(([d, r]) => {
        if (cancelled) return;
        setData({
          restaurant: d.restaurant || r.restaurant,
          dishes: d.dishes || [],
          reservations: r.reservations || [],
        });
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [id]);

  // Real-time: menyu yoki bron o'zgarsa darhol yangilanadi
  useEffect(() => {
    const socket = getSocket();
    joinAdmin();
    const refresh = () => {
      Promise.all([
        adminApi.getRestaurantDishes(id),
        adminApi.getRestaurantReservations(id),
      ]).then(([d, r]) => setData({
        restaurant: d.restaurant || r.restaurant,
        dishes: d.dishes || [],
        reservations: r.reservations || [],
      })).catch(() => {});
    };
    socket.on('dish:update', refresh);
    socket.on('reservation:update', refresh);
    socket.on('reservation:new', refresh);
    return () => {
      socket.off('dish:update', refresh);
      socket.off('reservation:update', refresh);
      socket.off('reservation:new', refresh);
    };
  }, [id]);

  const { restaurant, dishes, reservations } = data;

  // Menyuni bo'limlarga guruhlash
  const sections = dishes.reduce((acc, d) => {
    (acc[d.section] ||= []).push(d);
    return acc;
  }, {});

  return (
    <div className="flex-1 p-4 sm:p-6 min-w-0">
      {/* Sarlavha */}
      <div className="flex items-center gap-3 mb-5 min-w-0">
        <button
          onClick={() => navigate('/restaurants')}
          className="w-9 h-9 rounded-lg border border-line hover:bg-surface flex items-center justify-center text-muted flex-none"
          aria-label="Orqaga"
        >
          <i className="ti ti-arrow-left" />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold text-ink truncate">
            {restaurant?.name || 'Muassasa'}
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-0.5 truncate">
            {restaurant?.cuisine || 'Menyu va bronlar nazorati'}
          </p>
        </div>
      </div>

      {/* Tab almashtirgich */}
      <div className="flex bg-canvas rounded-xl p-1 border border-line mb-5 max-w-md">
        <button
          onClick={() => setTab('menu')}
          className={`flex-1 px-4 py-2 rounded-lg text-sm transition-colors ${
            tab === 'menu' ? 'bg-brand-400 text-brand-text font-medium' : 'text-muted'
          }`}
        >
          Menyu ({dishes.length})
        </button>
        <button
          onClick={() => setTab('resv')}
          className={`flex-1 px-4 py-2 rounded-lg text-sm transition-colors ${
            tab === 'resv' ? 'bg-brand-400 text-brand-text font-medium' : 'text-muted'
          }`}
        >
          Bronlar ({reservations.length})
        </button>
      </div>

      {loading ? (
        <div className="text-center text-muted text-sm py-12">Yuklanmoqda...</div>
      ) : tab === 'menu' ? (
        dishes.length === 0 ? (
          <Empty text="Bu muassasada hali taom qo'shilmagan" />
        ) : (
          <div className="grid gap-5">
            {Object.entries(sections).map(([section, items]) => (
              <div key={section}>
                <h2 className="text-sm font-semibold text-ink mb-2">{section}</h2>
                <div className="grid gap-2">
                  {items.map((d) => (
                    <div
                      key={d._id}
                      className={`bg-surface border rounded-xl p-3 flex items-center gap-3 min-w-0 ${
                        d.isAvailable ? 'border-line' : 'border-red-200 bg-red-50/40'
                      }`}
                    >
                      <div
                        className="w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center flex-none"
                        style={{ background: d.tint || '#FAEEDA' }}
                      >
                        {d.imageUrl ? (
                          <img src={d.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <i className={`ti ${d.icon || 'ti-bowl'} text-brand-600`} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-ink break-all">{d.name}</span>
                          {!d.isAvailable && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium flex-none">
                              STOP
                            </span>
                          )}
                        </div>
                        {d.description && (
                          <div className="text-xs text-muted truncate mt-0.5">{d.description}</div>
                        )}
                      </div>
                      <div className="text-right flex-none">
                        <div className="text-sm font-semibold text-ink whitespace-nowrap">
                          {som(d.price)} so'm
                        </div>
                        {d.oldPrice > 0 && (
                          <div className="text-[11px] text-muted line-through whitespace-nowrap">
                            {som(d.oldPrice)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      ) : reservations.length === 0 ? (
        <Empty text="Bu muassasada hali bron yo'q" />
      ) : (
        <div className="grid gap-2">
          {reservations.map((r) => {
            const st = RESV_STATUS[r.status] || { label: r.status, cls: 'bg-gray-100 text-gray-500' };
            return (
              <div key={r._id} className="bg-surface border border-line rounded-xl p-3 sm:p-4 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-sm font-medium text-ink break-all">{r.name}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full flex-none ${st.cls}`}>
                    {st.label}
                  </span>
                </div>
                <div className="text-xs text-muted break-all">
                  <i className="ti ti-phone text-[11px]" /> {r.phone}
                </div>
                <div className="text-sm text-ink mt-1.5 flex items-center gap-3 flex-wrap">
                  <span><i className="ti ti-calendar text-xs" /> {r.date} · {r.time}</span>
                  <span><i className="ti ti-users text-xs" /> {r.guests} kishi</span>
                </div>
                {r.note && <div className="text-xs text-muted mt-1">Izoh: {r.note}</div>}
                {r.rejectReason && (
                  <div className="text-xs text-red-600 mt-1">Rad sababi: {r.rejectReason}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Empty({ text }) {
  return (
    <div className="text-center text-muted text-sm py-12 border border-dashed border-line rounded-xl">
      {text}
    </div>
  );
}
