import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/api';
import { getSocket, joinAdmin } from '@/lib/socket';
import { useTempValue } from '@/hooks/useTempFlag';
import { useAuth } from '@/store/auth';
import { OrderFullInfo } from '@/components/OrderFullInfo';
import { itemLine, orderSearchText, minutesBetween, durationText } from '@/lib/orderInfo';

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
  ['awaiting_payment', "To'lov kutilmoqda"], // faqat bo'lsa ko'rinadi
  ['open', 'Jarayonda'],
  ['all', 'Hammasi'],
  ['delivered', 'Yetkazilgan'],
  ['cancelled', 'Bekor'],
];

/* Ochiq buyurtma shuncha daqiqadan oshsa — kechikish belgisi */
const LATE_MIN = 45;

/* Ixcham/to'liq ko'rinish tanlovi brauzerda eslab qolinadi */
const VIEW_KEY = 'dash:feedCompact';
const readCompact = () => { try { return localStorage.getItem(VIEW_KEY) === '1'; } catch { return false; } };
const saveCompact = (v) => { try { localStorage.setItem(VIEW_KEY, v ? '1' : '0'); } catch { /* yo'q */ } };

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
  const [query, setQuery] = useState('');
  const [compact, setCompact] = useState(readCompact);
  const toggleCompact = () => setCompact((v) => { saveCompact(!v); return !v; });
  // Kutish vaqti belgilari yangilanib tursin (30 s)
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  // 3 soniya yonib turadi; ketma-ket buyurtma kelsa avvalgi
  // taymer bekor bo'ladi va ikkinchi karta to'liq yonadi
  const [flash, flashOrder] = useTempValue(3000);
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
   * POLLING 30s -> 120s (2026-08).
   *
   * Buni qilish uchun avval socket TO'LIQ qilindi: ilgari faqat
   * 'order:new' tinglanardi, holat o'zgarishlari ('order:update')
   * esa polling kelguncha ekranda ko'rinmasdi. Ya'ni 30 soniya
   * ASOSIY yo'l edi, zaxira emas.
   *
   * Endi ikkala hodisa ham keshni to'g'ridan-to'g'ri yangilaydi,
   * shuning uchun polling haqiqiy zaxiraga aylandi — u faqat
   * socket butunlay uzilib qolgan holat uchun.
   *
   * Eslatma: React Query fon tabida refetch qilmaydi
   * (refetchIntervalInBackground standart holatda false), ya'ni
   * ko'rinmayotgan panel tarmoqni umuman bezovta qilmaydi.
   */
  const { data: stats, dataUpdatedAt } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminApi.getStats(),
    refetchInterval: 120_000,
  });

  /*
   * '/admin/orders' individual buyurtma tafsilotlarini
   * qaytaradi (mijoz, manzil, telefon) — bu 'orders' sahifasiga
   * tegishli ma'lumot, 'dashboard'ga emas. Faqat shu sahifaga
   * ruxsati bor xodim (yoki admin) so'raydi.
   *
   * `enabled: false` bo'lganda so'rov UMUMAN yuborilmaydi —
   * 403 kelib keshni "xato" holatida ushlab turishning
   * o'rniga, so'rovning o'zi qilinmaydi.
   */
  const user = useAuth((s) => s.user);
  /*
   * Boolean() bilan ATAYLAB o'raladi.
   *
   * `user` hali yuklanmagan bo'lsa (sahifa birinchi ochilganda,
   * useAuth qaytarayotgan holat) ifoda `undefined` bo'lib
   * qolardi — aniq `false` emas. `enabled: undefined` esa
   * React Query'da ishonchsiz: ba'zi versiyalarda "berilmagan"
   * deb qabul qilinib, so'rov baribir yuborilib ketishi mumkin.
   * Boolean() har doim aniq true/false qaytaradi.
   */
  const canSeeOrders = Boolean(
    user?.role === 'admin' || user?.allowedPages?.includes('orders'),
  );

  const { data: ordersRaw } = useQuery({
    queryKey: ['admin', 'orders'],
    queryFn: () => adminApi.getOrders(),
    refetchInterval: 120_000,
    enabled: canSeeOrders,
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
    /*
     * `order:new` / `order:update` ba'zan `userId`ni oddiy MATN (id) bilan yuboradi —
     * ro'yxatdagi populate qilingan mijoz (ism, @username, telefon) shu bilan bosib
     * ketilmasin, va kelmagan ma'lumot (mijoz yangi buyurtmada, bekor sababi)
     * bir zumda bitta so'rov bilan to'ldirilsin (ketma-ket hodisalar birlashtiriladi).
     */
    let refetchTimer;
    const refetchSoon = () => {
      clearTimeout(refetchTimer);
      refetchTimer = setTimeout(() => qc.invalidateQueries({ queryKey: ['admin', 'orders'] }), 800);
    };
    const onNewOrder = (order) => {
      // Ruxsati bo'lmagan xodim uchun buyurtma keshini
      // umuman TO'LDIRMAYMIZ — u baribir ko'rsatilmaydi,
      // lekin xotirada individual buyurtma (mijoz, manzil)
      // saqlanib qolmasin
      if (canSeeOrders) {
        qc.setQueryData(['admin', 'orders'], (prev = []) =>
          [order, ...prev.filter((o) => o._id !== order._id)]);
        flashOrder(order._id);
        if (typeof order.userId !== 'object') refetchSoon();
      }
      // Statistika o'zgardi — uni qayta so'raymiz (bu hammaga tegishli)
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    };
    /*
     * Holat o'zgarishi (tayyor, yo'lda, yetkazildi, bekor).
     *
     * Ilgari bu hodisa TINGLANMAGAN edi: kuryer buyurtmani
     * yetkazsa ham dashboard'da eski holat 30 soniyagacha
     * turaverardi. Endi darhol almashadi va polling'ga
     * ehtiyoj qolmaydi.
     */
    const onUpdate = (patch) => {
      if (!patch?._id || !canSeeOrders) return;
      qc.setQueryData(['admin', 'orders'], (prev = []) => {
        if (!Array.isArray(prev)) return prev;
        let found = false;
        const next = prev.map((o) => {
          if (o._id !== patch._id) return o;
                    found = true;
          const userId = patch.userId && typeof patch.userId === 'object' ? patch.userId : o.userId;
          return { ...o, ...patch, userId };
        });
        // Keshda yo'q buyurtma haqida xabar keldi — ro'yxat
        // eskirgan, qayta so'raymiz
        if (!found) qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
        return next;
      });
      // Bekor qilindi, lekin sabab/vaqt kelmadi (mijoz bekor qilsa yengil hodisa keladi) — to'ldiramiz
      if (patch.status === 'cancelled' && patch.cancelReason === undefined) refetchSoon();
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    };

    socket.on('order:new', onNewOrder);
    socket.on('order:update', onUpdate);

    return () => {
      // Faqat shu sahifa qo'ygan tinglovchi olib tashlanadi.
      // removeAllListeners() markaziy bildirishnoma tizimining
      // tinglovchisini ham o'chirib yuborardi.
      clearTimeout(refetchTimer);
      socket.off('order:new', onNewOrder);
      socket.off('order:update', onUpdate);
    };
  }, [qc, canSeeOrders, flashOrder]);

  const today = stats?.today;
  // Qidiruv: restoran, mijoz, telefon, manzil, #raqam, taom, kuryer, sabab
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    const words = q.split(/\s+/);
    return orders.filter((o) => {
      const t = orderSearchText(o);
      return words.every((w) => t.includes(w));
    });
  }, [orders, query]);

  const counts = useMemo(() => ({
    awaiting_payment: searched.filter((o) => o.status === 'awaiting_payment').length,
    open: searched.filter((o) => OPEN_STATUSES.includes(o.status)).length,
    all: searched.length,
    delivered: searched.filter((o) => o.status === 'delivered').length,
    cancelled: searched.filter((o) => o.status === 'cancelled').length,
  }), [searched]);

  const shown = useMemo(() => {
    if (filter === 'all') return searched;
    if (filter === 'open') return searched.filter((o) => OPEN_STATUSES.includes(o.status));
    return searched.filter((o) => o.status === filter);
  }, [searched, filter]);

  // Kechikayotgan ochiq buyurtmalar (diqqat banneri uchun)
  const lateCount = useMemo(
    () => orders.filter((o) => OPEN_STATUSES.includes(o.status) && minutesBetween(o.createdAt) >= LATE_MIN).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, Math.floor(Date.now() / 30_000)],
  );

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
                {lateCount > 0 && (
                  <span className="font-semibold text-red-600"> · {lateCount} tasi {LATE_MIN} daqiqadan oshdi</span>
                )}
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

            <Kpi label="Komissiya"
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
            <Leaderboard rows={stats?.todayByRestaurant}
              onPick={canSeeOrders ? (name) => { setQuery(name); setFilter('all'); } : undefined} />
          </section>

          {/*
            Individual buyurtma ro'yxati faqat 'orders'
            sahifasiga ruxsati bor xodimga ko'rinadi — u yerda
            mijozning ismi, telefoni va manzili bor. Buxgalter
            kabi umumiy statistikagagina ruxsati bor xodim bu
            bo'limni butunlay ko'rmaydi, "403" yozuvi o'rniga.
          */}
          {canSeeOrders ? (
            <section className="min-w-0">
              <SectionTitle hint="so'nggi 100">Buyurtmalar oqimi</SectionTitle>

              <div className="mb-2 flex items-center gap-1.5">
                <label className="g flex min-w-0 flex-1 items-center gap-2 rounded-full px-3 py-1.5">
                  <i className="ti ti-search flex-none text-[14px] text-muted" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Restoran, mijoz, telefon, manzil, #raqam"
                    className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted"
                    aria-label="Buyurtmalarni qidirish"
                  />
                  {query && (
                    <button type="button" onClick={() => setQuery('')} aria-label="Qidiruvni tozalash"
                      className="flex-none text-muted">
                      <i className="ti ti-x text-[14px]" />
                    </button>
                  )}
                </label>
                <button type="button" onClick={toggleCompact}
                  className="tap g flex flex-none items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold text-muted"
                  title={compact ? 'To‘liq ma’lumotni ko‘rsatish' : 'Ixcham ko‘rinish'}>
                  <i className={`ti ${compact ? 'ti-layout-list' : 'ti-layout-rows'} text-[14px]`} />
                  {compact ? 'To‘liq' : 'Ixcham'}
                </button>
              </div>

              <div className="-mx-3 mb-2.5 flex gap-1.5 overflow-x-auto px-3 pb-0.5 sm:mx-0 sm:px-0">
                {FILTERS.map(([k, label]) => {
                  const on = filter === k;
                  if (k === 'awaiting_payment' && !counts[k] && !on) return null;
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

              <OrderFeed orders={shown} flash={flash} filter={filter} compact={compact} searching={Boolean(query.trim())} />
            </section>
          ) : null}
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
function Leaderboard({ rows, onPick }) {
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
            role={onPick ? 'button' : undefined}
            tabIndex={onPick ? 0 : undefined}
            onClick={onPick ? () => onPick(r.name) : undefined}
            onKeyDown={onPick ? (e) => { if (e.key === 'Enter') onPick(r.name); } : undefined}
            title={onPick ? 'Shu muassasa buyurtmalarini ko‘rsatish' : undefined}
            className={`relative border-b border-black/[0.05] px-3.5 py-3 last:border-0 ${onPick ? 'tap cursor-pointer' : ''}`}>
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
/*
 * Dashboard lentasi.
 *
 * Server 100 tagacha buyurtma qaytaradi va ilgari HAMMASI
 * chizilardi. Dashboard esa "nima bo'lyapti" degan savolga
 * javob beradigan ekran — 100-chi buyurtmani bu yerda hech
 * kim qidirmaydi, uning uchun Buyurtmalar sahifasi bor.
 *
 * 40 ta yetarli: ekranga 5-6 tasi sig'adi, qolgani zaxira.
 * Virtualizatsiya (react-virtual) ATAYLAB qo'shilmadi —
 * u 500+ element uchun ma'noga ega; 40 ta uchun esa faqat
 * bog'liqlik va murakkablik qo'shadi, foyda bermaydi.
 */
const FEED_LIMIT = 40;

export function OrderFeed({ orders, flash, filter, compact = false, searching = false }) {
  const hidden = Math.max(0, orders.length - FEED_LIMIT);
  const visible = hidden ? orders.slice(0, FEED_LIMIT) : orders;

  if (orders.length === 0) {
    return (
      <div className="g rounded-[20px] px-6 py-10 text-center">
        <i className="ti ti-receipt-off mb-2 block text-2xl text-muted" />
        <div className="text-[14px] font-semibold text-ink">
          {searching ? 'Qidiruv bo‘yicha topilmadi'
            : filter === 'open' ? 'Jarayondagi buyurtma yo‘q' : 'Buyurtma yo‘q'}
        </div>
        <p className="mt-1 text-[12.5px] text-muted">
          {searching ? 'Boshqa so‘z bilan qidiring yoki filtrni “Hammasi”ga o‘tkazing'
            : 'Yangi buyurtma kelganda shu yerda jonli ko‘rinadi'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {visible.map((o) => {
        const st = STATUS[o.status] || { label: o.status, color: '#8E8E93' };
        const isFlash = flash === o._id;
        const isOpen = OPEN_STATUSES.includes(o.status) || o.status === 'awaiting_payment';
        const waitMin = isOpen ? minutesBetween(o.createdAt) : null;
        const late = waitMin !== null && waitMin >= LATE_MIN && o.status !== 'awaiting_payment';

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
                  {o.items?.map(itemLine).join(', ')}
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
                {waitMin !== null && (
                  <div className={`mt-0.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-[1px] text-[10.5px] font-semibold tabular-nums ${
                    late ? 'bg-red-50 text-red-700' : 'bg-black/[0.04] text-muted'}`}
                    title="Buyurtma berilganidan beri">
                    <i className="ti ti-hourglass text-[11px]" />{durationText(waitMin)}
                  </div>
                )}
              </div>
            </div>

            {/* Har bir holatda to'liq ma'lumot (bekor sababi faqat bekorda) */}
            <OrderFullInfo order={o} compact={compact} />
          </article>
        );
      })}

      {hidden > 0 && (
        <Link
          to="/orders"
          className="g flex items-center justify-center gap-1.5 rounded-[18px]
                     px-4 py-3 text-[13px] font-semibold text-ink transition-shadow"
        >
          Yana {hidden} ta buyurtma
          <i className="ti ti-arrow-right text-base" />
        </Link>
      )}
    </div>
  );
}
