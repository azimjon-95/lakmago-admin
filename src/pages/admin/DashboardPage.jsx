import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/api';
import { getSocket, joinAdmin } from '@/lib/socket';

/* ═══════════════════════════════════════════════════
   Boshqaruv paneli — platforma nazorati
   Savol: bugun nima bo'lyapti va nimaga aralashish kerak?
   Shuning uchun ekran uchga bo'lingan:
     1. Bugungi ko'rsatkichlar (kechagi bilan solishtirib)
     2. Muassasalar reytingi — bugun kimga ko'p taom berilyapti
     3. Buyurtmalar oqimi — holat bo'yicha filtr bilan
   ═══════════════════════════════════════════════════ */

const OPEN_STATUSES = ['pending', 'accepted', 'preparing', 'ready', 'delivering'];

const STATUS = {
  awaiting_payment: { label: "To'lov kutilmoqda", color: '#8E8E93' },
  pending: { label: 'Yangi', color: '#FF9500' },
  accepted: { label: 'Qabul qilindi', color: '#FF9500' },
  preparing: { label: 'Tayyorlanmoqda', color: '#007AFF' },
  ready: { label: 'Tayyor', color: '#5856D6' },
  delivering: { label: "Yo'lda", color: '#AF52DE' },
  delivered: { label: 'Yetkazildi', color: '#34C759' },
  cancelled: { label: 'Bekor', color: '#8E8E93' },
};

const FILTERS = [
  ['open', 'Jarayonda'],
  ['all', 'Hammasi'],
  ['delivered', 'Yetkazilgan'],
  ['cancelled', 'Bekor'],
];

const som = (n) => (n ?? 0).toLocaleString('ru-RU').replace(/,/g, ' ');

/* Brauzerlarda uz-UZ lokali har doim ham to'g'ri ishlamaydi
   ("M08 7, Fri" kabi chiqadi), shuning uchun o'zimiz yozamiz. */
const OYLAR = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const KUNLAR = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba',
  'payshanba', 'juma', 'shanba'];

function uzDate(d = new Date()) {
  return `${KUNLAR[d.getDay()]}, ${d.getDate()}-${OYLAR[d.getMonth()]}`;
}

const tint = (hex, a = 0.14) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/** Kecha bilan farq: {pct, up} yoki null (taqqoslash mumkin bo'lmasa). */
function delta(now, before) {
  if (!before) return now ? { pct: 100, up: true } : null;
  const d = Math.round(((now - before) / before) * 100);
  if (d === 0) return { pct: 0, up: true };
  return { pct: Math.abs(d), up: d > 0 };
}

export function DashboardPage() {
  const [filter, setFilter] = useState('open');
  const [flash, setFlash] = useState(null);
  const qc = useQueryClient();

  /*
   * REACT QUERY (2026-08 optimizatsiya).
   *
   * Avval useState+useEffect+setInterval(20s) edi. Muammolari:
   *  - sahifadan chiqib qaytilsa hamma narsa NOLDAN yuklanardi
   *  - 20 soniyalik polling sahifa ochiq turganda TO'XTOVSIZ
   *    ishlardi, hattoki brauzer fonda bo'lsa ham
   *
   * Endi kesh bor: qaytib kelinganda darhol ko'rinadi (eski
   * ma'lumot ekranda, yangisi fonda kelib almashadi).
   *
   * refetchInterval 30s ga uzaytirildi VA socket orqali yangi
   * buyurtma kelganda darhol yangilanadi — polling faqat zaxira
   * (socket uzilib qolgan holat uchun).
   */
  const { data: stats, dataUpdatedAt } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminApi.getStats(),
    refetchInterval: 30_000,
  });

  const { data: ordersRaw } = useQuery({
    queryKey: ['admin', 'orders'],
    queryFn: () => adminApi.getOrders(),
    refetchInterval: 30_000,
  });
  /*
   * HIMOYA: server kutilmagan shakl qaytarsa ham sahifa
   * yiqilmasin.
   *
   * Sinov paytida aniqlandi: agar API massiv o'rniga obyekt
   * qaytarsa (server xatosi, proxy xato sahifasi, noto'g'ri
   * marshrut), `orders.filter(...)` xato tashlab BUTUN SAHIFA
   * OQ bo'lib qolardi — ishlab chiqarishda eng yomon nosozlik
   * turi (foydalanuvchi nima bo'lganini tushunmaydi).
   * Endi bunday holatda shunchaki bo'sh ro'yxat ko'rsatiladi.
   */
  const orders = Array.isArray(ordersRaw) ? ordersRaw : [];

  const updatedAt = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  useEffect(() => {
    const socket = getSocket();
    joinAdmin();
    const onNewOrder = (order) => {
      // Keshni to'g'ridan-to'g'ri yangilaymiz — qayta so'rovsiz,
      // buyurtma DARHOL ekranda paydo bo'ladi
      qc.setQueryData(['admin', 'orders'], (prev = []) =>
        [order, ...prev.filter((o) => o._id !== order._id)]);
      setFlash(order._id);
      setTimeout(() => setFlash(null), 3000);
      // Statistika o'zgardi — uni qayta so'raymiz
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    };
    socket.on('order:new', onNewOrder);

    return () => {
      // Faqat shu sahifa qo'ygan tinglovchi olib tashlanadi.
      // removeAllListeners() markaziy bildirishnoma tizimining
      // tinglovchisini ham o'chirib yuborardi.
      socket.off('order:new', onNewOrder);
    };
  }, [qc]);

  const today = stats?.today;
  const counts = useMemo(() => ({
    open: orders.filter((o) => OPEN_STATUSES.includes(o.status)).length,
    all: orders.length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
  }), [orders]);

  const shown = useMemo(() => {
    if (filter === 'all') return orders;
    if (filter === 'open') return orders.filter((o) => OPEN_STATUSES.includes(o.status));
    return orders.filter((o) => o.status === filter);
  }, [orders, filter]);

  return (
    <div className="ios26 relative min-w-0 flex-1">
      <Ambient />

      <div className="relative z-10 mx-auto max-w-[1700px] px-3 pb-8 pt-4 sm:px-5 lg:px-7 lg:pt-6">
        {/* ═══ Sarlavha ═══ */}
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3 lg:mb-5">
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold leading-none tracking-[-0.02em] text-ink lg:text-[32px]">
              Boshqaruv paneli
            </h1>
            <p className="mt-1.5 text-[13px] text-muted">
              {uzDate()}
            </p>
          </div>

          <div className="g flex flex-none items-center gap-2 rounded-full px-3 py-1.5">
            <span className="ios26-live h-1.5 w-1.5 rounded-full" style={{ background: '#34C759' }} />
            <span className="text-[12px] font-semibold" style={{ color: '#248A3D' }}>Jonli</span>
            {updatedAt && (
              <span className="text-[11px] text-muted">
                · {updatedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </header>

        {/* ═══ Diqqat talab qiladigan buyurtmalar ═══ */}
        {today?.open > 0 && (
          <button onClick={() => setFilter('open')}
            className="tap g mb-3 flex w-full items-center gap-3 rounded-[18px] px-4 py-3 text-left">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[13px]"
              style={{ background: tint('#FF9500', 0.16) }}>
              <i className="ti ti-clock-play text-lg" style={{ color: '#C86A00' }} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-ink">
                Bugun {today.open} ta buyurtma yopilmagan
              </span>
              <span className="block text-[12px] leading-snug text-muted">
                Tayyorlanmoqda yoki yo'lda
              </span>
            </span>
            <i className="ti ti-chevron-right flex-none text-muted" />
          </button>
        )}

        {/* ═══ Bugungi ko'rsatkichlar ═══ */}
        <section className="mb-4">
          <SectionTitle>Bugun</SectionTitle>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Kpi label="Buyurtma" value={today?.orders} icon="ti-clipboard-list"
              delta={stats?.yesterday && delta(today.orders, stats.yesterday?.orders)}
              sub={today ? `${today.delivered} yetkazildi` : null} />

            <Kpi label="Berilgan taom" value={today?.dishes} icon="ti-tools-kitchen-2"
              accent
              sub={stats ? `${stats.activeRestaurantsToday} muassasa` : null} />

            <Kpi label="Aylanma" value={today ? som(today.revenue) : null} unit="so'm"
              icon="ti-cash" small
              delta={stats?.yesterday && delta(today.revenue, stats.yesterday?.revenue)}
              sub={today ? `O'rtacha chek ${som(today.avgCheck)}` : null} />

            <Kpi label={`Komissiya (${stats?.commissionPercent ?? 0}%)`}
              value={today ? som(today.commission) : null} unit="so'm"
              icon="ti-percentage" small
              sub={today ? `Jami ${som(stats.commission)}` : null} />
          </div>
        </section>

        {/* ═══ Asosiy: reyting + oqim ═══ */}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <section className="min-w-0">
            <SectionTitle
              hint={stats?.today?.dishes ? `${som(stats.today.dishes)} ta taom` : null}>
              Bugun ko'p taom bergan muassasalar
            </SectionTitle>
            <Leaderboard rows={stats?.todayByRestaurant} />
          </section>

          <section className="min-w-0">
            <SectionTitle hint="so'nggi 100">Buyurtmalar oqimi</SectionTitle>

            <div className="-mx-3 mb-2.5 flex gap-1.5 overflow-x-auto px-3 pb-0.5 sm:mx-0 sm:px-0">
              {FILTERS.map(([k, label]) => {
                const on = filter === k;
                return (
                  <button key={k} onClick={() => setFilter(k)}
                    className={`tap flex flex-none items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${
                      on ? 'bg-brand-400 text-brand-text' : 'g text-muted'
                    }`}>
                    {label}
                    <span className={`tabular-nums ${on ? 'opacity-70' : 'opacity-60'}`}>
                      {counts[k]}
                    </span>
                  </button>
                );
              })}
            </div>

            <OrderFeed orders={shown} flash={flash} filter={filter} />
          </section>
        </div>
      </div>
    </div>
  );
}

/* ═══ Fon yorug'ligi ═══ */
function Ambient() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <span className="ios26-glow -left-24 -top-24 h-72 w-72"
        style={{ background: 'rgba(239,159,39,0.28)' }} />
      <span className="ios26-glow right-[-5rem] top-52 h-80 w-80"
        style={{ background: 'rgba(23,99,94,0.18)' }} />
      <span className="ios26-glow bottom-20 left-1/2 h-72 w-72"
        style={{ background: 'rgba(88,86,214,0.13)' }} />
    </div>
  );
}

function SectionTitle({ children, hint }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
      <h2 className="text-[11px] font-semibold uppercase leading-tight tracking-[0.06em] text-muted">
        {children}
      </h2>
      {hint && <span className="flex-none text-[11px] tabular-nums text-muted">{hint}</span>}
    </div>
  );
}

/* ═══ Ko'rsatkich kartasi ═══ */
function Kpi({ label, value, unit, icon, sub, delta: d, accent, small }) {
  const loading = value === null || value === undefined;

  return (
    <div className="g min-w-0 rounded-[18px] p-3.5">
      <div className="mb-2 flex items-center gap-1.5">
        <i className={`ti ${icon} flex-none text-[15px] text-muted`} />
        <span className="truncate text-[11.5px] text-muted">{label}</span>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className={`font-bold leading-none tabular-nums ${small ? 'text-[20px]' : 'text-[27px]'}`}
          style={{ color: accent ? '#BA7517' : '#1A1A17' }}>
          {loading ? '—' : value}
        </span>
        {unit && !loading && (
          <span className="text-[11px] font-medium text-muted">{unit}</span>
        )}
        {d && (
          <span className="ml-auto flex flex-none items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums"
            style={{
              background: tint(d.up ? '#34C759' : '#FF3B30', 0.12),
              color: d.up ? '#248A3D' : '#D70015',
            }}>
            <i className={`ti ti-arrow-${d.up ? 'up' : 'down'} text-[11px]`} />
            {d.pct}%
          </span>
        )}
      </div>

      {sub && <p className="mt-1.5 truncate text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

/* ═══ Muassasalar reytingi ═══
 * Ustunlar: taom (asosiy), buyurtma, aylanma.
 * Ulush chizig'i birinchi o'ringa nisbatan.
 */
function Leaderboard({ rows }) {
  if (!rows) {
    return (
      <div className="g rounded-[20px] p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="mb-3 h-9 animate-pulse rounded-[10px] bg-black/[0.04] last:mb-0" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="g rounded-[20px] px-6 py-10 text-center">
        <i className="ti ti-tools-kitchen-2 mb-2 block text-2xl text-muted" />
        <div className="text-[14px] font-semibold text-ink">Bugun taom berilmagan</div>
        <p className="mt-1 text-[12.5px] text-muted">
          Birinchi buyurtma kelgach reyting shu yerda paydo bo'ladi
        </p>
      </div>
    );
  }

  const max = rows[0].dishes || 1;
  const total = rows.reduce((s, r) => s + r.dishes, 0);

  return (
    <div className="g overflow-hidden rounded-[20px]">
      {rows.map((r, i) => {
        const pct = Math.round((r.dishes / max) * 100);
        const share = total ? Math.round((r.dishes / total) * 100) : 0;
        const lead = i < 3;

        return (
          <div key={r.id}
            className="relative border-b border-black/[0.05] px-3.5 py-3 last:border-0">
            {/* Ulush — fon chizig'i, alohida qator egallamaydi */}
            <span aria-hidden
              className="absolute inset-y-0 left-0 transition-[width] duration-700"
              style={{
                width: `${pct}%`,
                background: `linear-gradient(90deg, ${tint('#EF9F27', lead ? 0.16 : 0.08)}, transparent)`,
              }} />

            <div className="relative flex items-center gap-3">
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-[9px] text-[12px] font-bold tabular-nums"
                style={{
                  background: lead ? '#EF9F27' : 'rgba(120,120,128,0.12)',
                  color: lead ? '#2C1400' : '#6B6B66',
                }}>
                {i + 1}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[14.5px] font-semibold text-ink">
                    {r.name}
                  </span>
                  {r.open > 0 && (
                    <span className="flex-none rounded-full px-1.5 py-[1px] text-[10px] font-bold"
                      style={{ background: tint('#FF9500', 0.16), color: '#C86A00' }}>
                      {r.open}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-[11.5px] text-muted">
                  {r.orders} buyurtma · {som(r.revenue)} so'm · {share}%
                </div>
              </div>

              <div className="flex-none text-right">
                <div className="text-[19px] font-bold leading-none tabular-nums text-ink">
                  {r.dishes}
                </div>
                <div className="text-[10px] text-muted">taom</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══ Buyurtmalar oqimi ═══ */
function OrderFeed({ orders, flash, filter }) {
  if (orders.length === 0) {
    return (
      <div className="g rounded-[20px] px-6 py-10 text-center">
        <i className="ti ti-receipt-off mb-2 block text-2xl text-muted" />
        <div className="text-[14px] font-semibold text-ink">
          {filter === 'open' ? 'Jarayondagi buyurtma yo\u2018q' : 'Buyurtma yo\u2018q'}
        </div>
        <p className="mt-1 text-[12.5px] text-muted">
          Yangi buyurtma kelganda shu yerda jonli ko'rinadi
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {orders.map((o) => {
        const st = STATUS[o.status] || { label: o.status, color: '#8E8E93' };
        const isFlash = flash === o._id;

        return (
          <article key={o._id}
            className="g relative overflow-hidden rounded-[18px] p-3 transition-shadow"
            style={isFlash ? { boxShadow: '0 0 0 2px rgba(239,159,39,0.55)' } : undefined}>
            <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]"
              style={{ background: st.color }} />

            <div className="flex items-start gap-2.5 pl-1.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[14.5px] font-semibold text-ink">
                    {o.restaurantName}
                  </span>
                  <span className="flex-none rounded-full px-2 py-[2px] text-[10.5px] font-semibold"
                    style={{ background: tint(st.color), color: st.color }}>
                    {st.label}
                  </span>
                </div>

                <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-muted">
                  {o.items?.map((i) => `${i.name} ×${i.quantity}`).join(', ')}
                </p>
              </div>

              <div className="flex-none text-right">
                <div className="whitespace-nowrap text-[15px] font-bold tabular-nums text-ink">
                  {som(o.total)}
                </div>
                <div className="text-[11px] tabular-nums text-muted">
                  {new Date(o.createdAt).toLocaleTimeString('ru-RU', {
                    hour: '2-digit', minute: '2-digit',
                  })}
                </div>
              </div>
            </div>

            {o.address && (
              <div className="mt-2 flex items-start gap-1.5 border-t border-black/[0.05] pl-1.5 pt-2 text-[11.5px] text-muted">
                <i className="ti ti-map-pin mt-[2px] flex-none text-[12px]" />
                <span className="break-words">{o.address}</span>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
