import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { panelApi } from '@/api';
import { NumberInput, MoneyInput } from '@/components/form/NumberInput';
import { ImageUpload } from '@/components/ImageUpload';
import { useLockScroll } from '@/hooks/useLockScroll';
import { getSocket } from '@/lib/socket';
import { confirm } from '@/components/ui/confirm';
import { useAuth } from '@/store/auth';
import { Img } from '@/components/Img';
import { useTempValue } from '@/hooks/useTempFlag';

/* ═══════════════════════════════════════════════════
   Dine-in — iOS 26 (Liquid Glass)
   Mobilda: katta sarlavha, yopishqoq segment, 2 ustunli
   stol to'ri. Kattaroq ekranda: chapda doimiy boshqaruv
   paneli, o'ngda 5 ustungacha kengayadigan to'r.
   ═══════════════════════════════════════════════════ */

const STATUS = {
  none: { label: 'Yoqilmagan', color: '#8E8E93' },
  pending: { label: "Ko'rib chiqilmoqda", color: '#FF9500' },
  approved: { label: 'Tasdiqlandi', color: '#007AFF' },
  payment_required: { label: "To'lov kutilmoqda", color: '#FF9500' },
  active: { label: 'Faol', color: '#34C759' },
  suspended: { label: "To'xtatilgan", color: '#FF3B30' },
};

const TABLE_STATUS = {
  available: { label: "Bo'sh", color: '#34C759' },
  occupied: { label: 'Band', color: '#FF9500' },
  ordering: { label: 'Tanlamoqda', color: '#007AFF' },
  waiting: { label: 'Kutmoqda', color: '#AF52DE' },
  closed: { label: 'Yopiq', color: '#8E8E93' },
};

const TABS = [
  // [kalit, to'liq nom, ikonka, mobil uchun qisqa nom]
  ['tables', 'Stollar', 'ti-armchair', 'Stollar'],
  ['waiters', 'Ofitsiantlar', 'ti-users', 'Ofitsiant'],
  ['earnings', 'Daromad', 'ti-coins', 'Daromad'],
  ['settings', 'Xizmat haqi', 'ti-adjustments', 'Xizmat'],
];

/** Rangdan shaffof fon — inline, chunki qiymat dinamik. */
const tint = (hex, a = 0.14) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

export function DineInPage() {
  const restaurant = useAuth((s) => s.restaurant);
  const [tab, setTab] = useState('tables');
  const [cfg, setCfg] = useState(null);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [managing, setManaging] = useState(null);   // stol boshqaruv modali (mehmon/taom/chek)
  const [themeOpen, setThemeOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const c = await panelApi.getDineInConfig();
      setCfg(c);
      if (c.status === 'active') {
        setTables(await panelApi.getTables());
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const socket = getSocket();

    /*
     * REAL-TIME ANIQLIGI (2026-08 tuzatish).
     *
     * Avval `socket.on('table:update', load)` edi — ya'ni HAR
     * BIR stol o'zgarishida BUTUN ro'yxat serverdan qayta
     * so'ralardi. Muammolari:
     *   1) load() ichida setLoading(true) bor — ekran har safar
     *      "yuklanmoqda" holatiga o'tib, stollar KO'ZDAN
     *      G'OYIB BO'LARDI (band/bo'sh holati sakrab turardi)
     *   2) Bir vaqtda bir necha stol o'zgarsa — bir necha to'liq
     *      so'rov ketardi (keraksiz yuk)
     *
     * Server ALLAQACHON aniq ma'lumot yuboradi:
     *   { tableId, status }
     * Endi shu ma'lumotdan foydalanib faqat O'SHA stolni
     * yangilaymiz — so'rovsiz, darhol, ko'z oldida.
     */
    const onTableUpdate = (payload) => {
      if (!payload?.tableId) { load(); return; }   // eski format — zaxira
      setTables((prev) => prev.map((t) => (
        String(t._id) === String(payload.tableId)
          ? {
              ...t,
              status: payload.status ?? t.status,
              // Ofitsant mijoz sonini o'zgartirsa ham darhol ko'rinsin
              // (server waiter.js da guestCount ham yuboradi)
              ...(payload.guestCount !== undefined && { guestCount: payload.guestCount }),
            }
          : t
      )));
    };

    // Dine-in xizmati holati o'zgarsa (yoqildi/o'chirildi) —
    // bu kamdan-kam bo'ladi va butun sahifa tuzilishiga ta'sir
    // qiladi, shuning uchun to'liq qayta yuklash o'rinli
    socket.on('table:update', onTableUpdate);
    socket.on('dinein:status', load);
    return () => {
      socket.off('table:update', onTableUpdate);
      socket.off('dinein:status', load);
    };
  }, [load]);

  const request = async () => {
    if (!await confirm({ title: 'Dine-in xizmatini yoqish uchun so\'rov yuborilsinmi?' })) return;
    try { await panelApi.requestDineIn(); load(); }
    catch (e) { alert(e.message); }
  };

  const removeTable = async (t) => {
    if (!await confirm({ title: `Stol ${t.tableNumber} o'chirilsinmi?` })) return;
    try { await panelApi.deleteTable(t._id); load(); }
    catch (e) { alert(e.message); }
  };

  const regenerate = async (t) => {
    if (!await confirm({ title:
      `Stol ${t.tableNumber} QR kodi yangilanadi.\n\n` +
      'Eski QR ISHLAMAY QOLADI — yangisini chop etish kerak.\n\nDavom etilsinmi?',
     })) return;
    try { await panelApi.regenerateQr(t._id); load(); }
    catch (e) { alert(e.message); }
  };

  // Yuklab olish — window.open ishlatib bo'lmaydi, chunki
  // Authorization sarlavhasi yuborilmaydi. Shuning uchun
  // fetch bilan olib blob sifatida saqlaymiz.
  const download = async (url, filename) => {
    try {
      const blob = await panelApi.downloadFile(url);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (e) {
      alert(e.message || 'Yuklab bo\u2018lmadi');
    }
  };

  const downloadQr = (t, format) =>
    download(`/panel/tables/${t._id}/qr?format=${format}`,
      `stol-${t.tableNumber}.${format}`);

  const downloadPdf = () =>
    download('/panel/tables/qr/pdf', 'qr-kodlar.pdf');

  /*
   * TableTile uchun BARQAROR ishlovchilar.
   *
   * Ular stolni ARGUMENT sifatida oladi, shuning uchun bog'liqlik
   * ro'yxati bo'sh bo'la oladi va identifikatori hech qachon
   * o'zgarmaydi. Aynan shu memo(TableTile) ni ishlatadi: socket
   * bitta stolni yangilaganda faqat O'SHA plitka qayta chiziladi,
   * qolgan 20-50 tasi tegilmaydi.
   *
   * useRef ishlatilmadi: quyidagi uchta funksiya (regenerate,
   * removeTable, downloadQr) komponent ichida e'lon qilingan va
   * har renderda yangilanadi — lekin ular FAQAT chaqirilish
   * paytida o'qiladi, ya'ni eskirgan nusxa ushlanib qolmaydi.
   * Buning uchun useRef bilan indirection qo'shish ortiqcha
   * murakkablik bo'lardi.
   */
  const fns = useRef(null);
  fns.current = { setManaging, setEditing, downloadQr, regenerate, removeTable };

  const handleManage = useCallback((t) => fns.current.setManaging(t), []);
  const handleEdit = useCallback((t) => fns.current.setEditing(t), []);
  const handleQr = useCallback((t) => fns.current.downloadQr(t, 'svg'), []);
  const handleRegen = useCallback((t) => fns.current.regenerate(t), []);
  const handleRemove = useCallback((t) => fns.current.removeTable(t), []);

  const stats = useMemo(() => {
    const by = (s) => tables.filter((t) => t.status === s).length;
    return {
      jami: tables.length,
      bosh: by('available'),
      band: by('occupied') + by('ordering') + by('waiting'),
      sessiya: tables.filter((t) => t.activeSession).length,
    };
  }, [tables]);

  if (loading) {
    return (
      <div className="p-6 text-muted text-sm flex items-center gap-2">
        <i className="ti ti-loader-2 animate-spin" /> Yuklanmoqda...
      </div>
    );
  }

  // Hali so'rov yubormagan — tanishtiruv ekrani
  if (!cfg || cfg.status === 'none') {
    return <DineInIntro onRequest={request} />;
  }

  const active = cfg.status === 'active';

  const actionProps = {
    onTheme: () => setThemeOpen(true),
    onPdf: tables.length > 0 ? downloadPdf : null,
    onBulk: () => setBulkOpen(true),
    onAdd: () => setEditing('new'),
  };

  return (
    <div className="ios26 relative min-h-full">
      <Ambient />

      <div className="relative z-10 mx-auto max-w-[1700px] px-3 pt-4 pb-8 sm:px-5 lg:px-7 lg:pt-7">
        {/* Katta sarlavha */}
        <header className="mb-4 lg:mb-6">
          <h1 className="text-[30px] leading-none font-bold tracking-[-0.02em] text-ink lg:text-[34px]">
            Dine-in
          </h1>
          <p className="mt-1.5 text-[13px] text-muted lg:text-sm">
            Stollar, QR kodlar va joyida buyurtma
          </p>
        </header>

        <div className="lg:grid lg:grid-cols-[286px_minmax(0,1fr)] lg:items-start lg:gap-6">
          {/* ═══ Chap panel — faqat kattaroq ekranda ═══ */}
          <aside className="hidden lg:sticky lg:top-6 lg:block lg:space-y-4">
            <StatusCard cfg={cfg} />
            {active && (
              <>
                <nav className="g rounded-[22px] p-1.5">
                  {TABS.map(([k, label, icon]) => {
                    const on = tab === k;
                    return (
                      <button key={k} onClick={() => setTab(k)}
                        className={`tap flex w-full items-center gap-3 rounded-[16px] px-3 py-2.5 text-[15px] font-medium ${
                          on ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'
                        }`}>
                        <i className={`ti ${icon} text-lg`}
                          style={on ? { color: '#EF9F27' } : undefined} />
                        <span className="truncate">{label}</span>
                        {k === 'tables' && stats.jami > 0 && (
                          <span className="ml-auto text-[12px] tabular-nums text-muted">
                            {stats.jami}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>

                {tab === 'tables' && (
                  <div className="g rounded-[22px] p-3">
                    <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                      Amallar
                    </div>
                    <TableActions {...actionProps} layout="rail" />
                  </div>
                )}
              </>
            )}
          </aside>

          {/* ═══ Asosiy ustun ═══ */}
          <main className="min-w-0">
            {/* Mobil: holat + segment */}
            <div className="lg:hidden">
              <StatusCard cfg={cfg} compact />
              {active && (
                <div className="sticky top-2 z-20 my-3">
                  {/* g-live: sticky — ostidan ro'yxat surilib o'tadi,
                      shuning uchun bu yerda blur haqiqatan ko'rinadi */}
                  <div className="g g-live rounded-[17px] p-1">
                    <Segmented value={tab} onChange={setTab}
                      items={TABS.map(([k, , , short]) => [k, short])} />
                  </div>
                </div>
              )}
            </div>

            {active && tab === 'tables' && (
              <>
                {tables.length > 0 && <Stats stats={stats} />}

                <div className="mb-3 lg:hidden">
                  <TableActions {...actionProps} layout="row" />
                </div>

                {tables.length === 0 ? (
                  <EmptyState icon="ti-armchair" title="Stol qo'shilmagan"
                    text="Stol qo'shing — har biriga QR kod avtomatik yaratiladi"
                    action={{ label: 'Birinchi stolni qo\u2018shish', onClick: () => setEditing('new') }} />
                ) : (
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {/*
                      Ishlovchilar STOL OBYEKTINI argument sifatida
                      oladi. Ilgari har stol uchun 5 ta yangi
                      strelka funksiya yaratilardi — bu holda
                      memo() umuman ishlamaydi, chunki proplar
                      har renderda yangi bo'lib chiqadi.
                    */}
                    {tables.map((t) => (
                      <TableTile key={t._id} table={t}
                        onManage={handleManage}
                        onQr={handleQr}
                        onEdit={handleEdit}
                        onRegen={handleRegen}
                        onRemove={handleRemove} />
                    ))}
                  </div>
                )}
              </>
            )}

            {active && tab === 'waiters' && <Waiters tables={tables} />}
            {active && tab === 'earnings' && <Earnings />}
            {active && tab === 'settings' && <ServiceFee cfg={cfg} onSaved={load} />}
          </main>
        </div>
      </div>

      {managing && (
        <TableManageModal
          table={managing}
          restaurantId={restaurant?._id}
          onClose={() => setManaging(null)}
          onChanged={load}
        />
      )}

      {editing && (
        <TableForm
          table={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
      {bulkOpen && (
        <BulkForm onClose={() => setBulkOpen(false)}
          onSaved={() => { setBulkOpen(false); load(); }} />
      )}
      {themeOpen && (
        <ThemeForm theme={cfg?.qrTheme}
          onClose={() => setThemeOpen(false)}
          onSaved={() => { setThemeOpen(false); load(); }} />
      )}
    </div>
  );
}

/* ═══ Fon yorug'ligi — shisha nimanidir sindirishi kerak ═══ */
function Ambient() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <span className="ios26-glow -left-24 -top-20 h-72 w-72"
        style={{ background: 'rgba(239,159,39,0.30)' }} />
      <span className="ios26-glow right-[-6rem] top-40 h-80 w-80"
        style={{ background: 'rgba(23,99,94,0.20)' }} />
      <span className="ios26-glow bottom-10 left-1/3 h-72 w-72"
        style={{ background: 'rgba(175,82,222,0.14)' }} />
    </div>
  );
}

/* ═══ Xizmat holati ═══ */
function StatusCard({ cfg, compact }) {
  const st = STATUS[cfg.status] || STATUS.none;

  const note =
    cfg.status === 'pending'
      ? "So'rovingiz ko'rib chiqilmoqda. Tasdiqlangach xabar beramiz."
      : ['approved', 'payment_required'].includes(cfg.status)
        ? "Tasdiqlandi. Xizmatni yoqish uchun administrator bilan bog'laning."
        : cfg.status === 'suspended'
          ? (cfg.suspendReason || "Xizmat vaqtincha to'xtatilgan")
          : null;

  return (
    <section className={`g rounded-[22px] ${compact ? 'p-3.5' : 'p-4'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
            Xizmat holati
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="h-2 w-2 flex-none rounded-full"
              style={{ background: st.color }} />
            <span className="text-[17px] font-semibold leading-none text-ink">
              {st.label}
            </span>
          </div>
        </div>

        {cfg.status === 'active' && (
          <div className="text-right">
            <div className="text-[22px] font-bold leading-none tabular-nums text-ink">
              {cfg.tables ?? 0}
            </div>
            <div className="text-[11px] text-muted">stol</div>
          </div>
        )}
      </div>

      {note && (
        <p className="mt-2.5 rounded-[13px] px-3 py-2 text-[12px] leading-relaxed"
          style={{ background: tint(st.color, 0.12), color: st.color }}>
          {note}
        </p>
      )}

      {cfg.status === 'active' && cfg.activeSessions > 0 && (
        <div className="mt-2.5 flex items-center gap-2 rounded-[13px] px-3 py-2 text-[12px] font-medium"
          style={{ background: tint('#34C759', 0.12), color: '#248A3D' }}>
          <span className="ios26-live h-1.5 w-1.5 rounded-full"
            style={{ background: '#34C759' }} />
          {cfg.activeSessions} ta faol sessiya
        </div>
      )}
    </section>
  );
}

/* ═══ Tezkor raqamlar ═══ */
function Stats({ stats }) {
  const items = [
    ['Jami', stats.jami, '#1A1A17'],
    ["Bo'sh", stats.bosh, '#34C759'],
    ['Band', stats.band, '#FF9500'],
    ['Sessiya', stats.sessiya, '#007AFF'],
  ];
  return (
    <div className="g mb-3 grid grid-cols-4 divide-x divide-black/[0.06] rounded-[18px] py-2.5">
      {items.map(([label, value, color]) => (
        <div key={label} className="px-2 text-center">
          <div className="text-[19px] font-bold leading-none tabular-nums"
            style={{ color }}>{value}</div>
          <div className="mt-1 truncate text-[10.5px] text-muted">{label}</div>
        </div>
      ))}
    </div>
  );
}

/* ═══ Segment boshqaruvi ═══ */
function Segmented({ items, value, onChange }) {
  const idx = Math.max(0, items.findIndex(([k]) => k === value));
  return (
    <div className="seg" style={{ '--n': items.length, '--i': idx }}>
      <span className="seg-thumb" aria-hidden />
      {items.map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)}
          data-on={value === k ? '1' : '0'}
          className="seg-item truncate text-[12px] sm:text-[14px]">
          {label}
        </button>
      ))}
    </div>
  );
}

/* ═══ Stol amallari — mobilda qator, kattaroqda ustun ═══ */
function TableActions({ onTheme, onPdf, onBulk, onAdd, layout }) {
  const rail = layout === 'rail';
  const items = [
    ['ti-palette', 'QR dizayni', onTheme, false],
    ['ti-file-download', 'PDF yuklash', onPdf, false],
    ['ti-stack-2', "Ko'p stol", onBulk, false],
    ['ti-plus', 'Stol qo\u2018shish', onAdd, true],
  ].filter(([, , fn]) => fn);

  if (rail) {
    return (
      <div className="space-y-1.5">
        {items.map(([icon, label, fn, primary]) => (
          <button key={label} onClick={fn}
            className={`tap flex w-full items-center gap-2.5 rounded-[15px] px-3 py-2.5 text-[14px] font-medium ${
              primary
                ? 'bg-brand-400 text-brand-text'
                : 'bg-white/70 text-ink hover:bg-white'
            }`}>
            <i className={`ti ${icon} text-lg`} />
            {label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-2">
      {items.map(([icon, label, fn, primary]) => (
        <button key={label} onClick={fn} title={label}
          className={`tap flex flex-col items-center justify-center gap-1 rounded-[17px] px-1 py-2.5 ${
            primary ? 'bg-brand-400 text-brand-text' : 'g text-ink'
          }`}>
          <i className={`ti ${icon} text-[19px]`} />
          <span className="w-full truncate text-center text-[10.5px] font-medium leading-none">
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ═══ Stol katakchasi ═══ */
/*
 * Stol plitkasi — memo bilan.
 *
 * Zalda 20-50 stol bo'ladi va 'table:update' socket hodisasi
 * band paytda tez-tez keladi. memo'siz har hodisada BARCHA
 * plitkalar qayta chizilardi; endi faqat o'zgargani.
 *
 * memo ishlashi uchun proplar barqaror bo'lishi SHART —
 * yuqoridagi handleManage/handleQr/... useCallback bilan
 * shu uchun qilingan.
 */
const TableTile = memo(function TableTile({
  table: t, onManage, onQr, onEdit, onRegen, onRemove,
}) {
  const ts = TABLE_STATUS[t.status] || TABLE_STATUS.available;

  const buttons = [
    ['ti-qrcode', 'QR yuklash', onQr, false],
    ['ti-pencil', 'Tahrirlash', onEdit, false],
    ['ti-refresh', 'QR yangilash', onRegen, false],
    ['ti-trash', "O'chirish", onRemove, true],
  ];

  return (
    <article
      onClick={() => onManage(t)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onManage(t); }}
      className="g tap relative overflow-hidden rounded-[20px] p-3 pl-3.5 text-left"
    >
      {/* Holat chizig'i — 40 ta stol orasidan bir qarashda ko'rinadi */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: ts.color }} />

      <h3 className="truncate text-[15px] font-semibold leading-tight text-ink">
        {t.tableName || `Stol ${t.tableNumber}`}
      </h3>

      <div className="mb-2.5 mt-1 flex items-center justify-between gap-1.5">
        <p className="truncate text-[11px] text-muted">
          {t.tableName ? `№${t.tableNumber} · ` : ''}
          {t.guestCount > 0 ? `${t.guestCount}/${t.capacity} kishi` : `${t.capacity} kishi`}
        </p>

        <div className="flex flex-none items-center gap-1.5">
          {t.activeSession && (
            <span className="ios26-live h-2 w-2 rounded-full"
              style={{ background: '#34C759' }} title="Sessiya faol" />
          )}
          <span className="rounded-full px-2 py-[3px] text-[10.5px] font-semibold"
            style={{ background: tint(ts.color), color: ts.color }}>
            {ts.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1">
        {buttons.map(([icon, label, fn, danger]) => (
          <button key={label}
            onClick={(e) => { e.stopPropagation(); fn(t); }}
            title={label} aria-label={label}
            className="tap flex h-8 items-center justify-center rounded-[11px] text-[15px]"
            style={{
              background: danger ? tint('#FF3B30', 0.1) : 'rgba(120,120,128,0.1)',
              color: danger ? '#FF3B30' : '#3A3A38',
            }}>
            <i className={`ti ${icon}`} />
          </button>
        ))}
      </div>
    </article>
  );
});

/* ═══════════════════════════════════════════════════════════
   STOL BOSHQARUVI — mehmon qabul qilish, taom kiritish, chek
   yopish. Restoran admini VA ofitsiant ikkalasi ham ishlata
   oladi (server: waiterOrRestaurantAuth, 2026-08).
   ═══════════════════════════════════════════════════════════ */

const ORDER_STATUS_FLOW = {
  accepted: { next: 'preparing', label: 'Qabul qilindi', nextLabel: 'Tayyorlashni boshlash' },
  preparing: { next: 'ready', label: 'Tayyorlanmoqda', nextLabel: 'Tayyor deb belgilash' },
  ready: { next: 'served', label: 'Tayyor', nextLabel: 'Berildi deb belgilash' },
  served: { next: 'completed', label: 'Berildi', nextLabel: 'Yakunlash' },
  completed: { next: null, label: 'Yakunlangan', nextLabel: null },
  cancelled: { next: null, label: 'Bekor qilingan', nextLabel: null },
};

function TableManageModal({ table, restaurantId, onClose, onChanged }) {
  useLockScroll();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [guestCount, setGuestCount] = useState(table.guestCount || 0);
  const [savingGuests, setSavingGuests] = useState(false);
  const [view, setView] = useState('bill');   // 'bill' | 'menu'
  const [menu, setMenu] = useState(null);      // null = hali yuklanmagan
  const [menuSearch, setMenuSearch] = useState('');
  const [cart, setCart] = useState({});        // { dishId: qty }
  const [submitting, setSubmitting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    try {
      const d = await panelApi.getTableDetail(table._id);
      setDetail(d);
      setGuestCount(d.table?.guestCount ?? 0);
    } catch (e) {
      setErr(e.message);
    }
    setLoading(false);
  }, [table._id]);

  useEffect(() => { load(); }, [load]);

  // Real-time: shu stolga tegishli o'zgarish kelsa yangilaymiz
  useEffect(() => {
    const socket = getSocket();
    const relevant = (payload) => !payload?.tableId || String(payload.tableId) === String(table._id);
    const onOrderEvent = (payload) => { if (relevant(payload)) load(); };
    socket.on('dinein:order', onOrderEvent);
    socket.on('dinein:new', onOrderEvent);
    socket.on('table:update', onOrderEvent);
    return () => {
      socket.off('dinein:order', onOrderEvent);
      socket.off('dinein:new', onOrderEvent);
      socket.off('table:update', onOrderEvent);
    };
  }, [table._id, load]);

  const loadMenu = useCallback(async (force = false) => {
    if (menu !== null && !force) return;

    /*
     * XATO TUZATILDI (2026-08): restaurantId hali kelmagan bo'lsa
     * (masalan tarmoq sekin bo'lsa, /panel/me hali javob
     * bermagan bo'lsa) funksiya jim qaytardi — menu HAM
     * o'zgarmasdi, HECH QANDAY xato ko'rsatilmasdi. Natija:
     * "Menyu yuklanmoqda..." ekranda ABADIY qolib ketardi,
     * foydalanuvchida na xato xabari, na qayta urinish tugmasi
     * bor edi.
     *
     * Endi: restaurantId yo'q bo'lsa ham ANIQ xato holatiga
     * o'tiladi (bo'sh massiv + tushunarli xabar), foydalanuvchi
     * "Qayta urinish" bosishi mumkin (force=true bilan chaqiradi
     * — React holat yangilanishi asinxron bo'lgani uchun oddiy
     * setMenu(null) dan keyin darhol loadMenu() chaqirish ETARLI
     * EMAS, `menu` hali eski qiymatda qoladi).
     */
    if (!restaurantId) {
      setErr('Restoran ma\u2018lumoti hali yuklanmagan. Bir necha soniyadan so\u2018ng qayta urining.');
      setMenu([]);
      return;
    }

    setMenu(null);
    try {
      setErr(null);
      setMenu(await panelApi.getDineInMenu(restaurantId));
    } catch (e) {
      setErr(e.message);
      setMenu([]);
    }
  }, [menu, restaurantId]);

  useEffect(() => { if (view === 'menu') loadMenu(); }, [view, loadMenu]);

  const saveGuests = async (next) => {
    const count = Math.max(0, Math.min(50, next));
    setGuestCount(count);
    setSavingGuests(true);
    try {
      await panelApi.setTableGuests(table._id, count);
      onChanged?.();
    } catch (e) {
      setErr(e.message);
    }
    setSavingGuests(false);
  };

  const addToCart = (dishId) => setCart((c) => ({ ...c, [dishId]: (c[dishId] || 0) + 1 }));
  const removeFromCart = (dishId) => setCart((c) => {
    const next = { ...c };
    if (next[dishId] <= 1) delete next[dishId];
    else next[dishId] -= 1;
    return next;
  });
  const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);

  const submitCart = async () => {
    const items = Object.entries(cart).map(([dishId, quantity]) => ({ dishId, quantity }));
    if (!items.length) return;
    setSubmitting(true); setErr(null);
    try {
      await panelApi.createDineInOrder({ tableId: table._id, items });
      setCart({});
      setView('bill');
      await load();
      onChanged?.();
    } catch (e) {
      setErr(e.message);
    }
    setSubmitting(false);
  };

  const advanceOrder = async (order) => {
    const flow = ORDER_STATUS_FLOW[order.status];
    if (!flow?.next) return;
    try {
      await panelApi.updateDineInOrderStatus(order._id, flow.next);
      await load();
    } catch (e) {
      setErr(e.message);
    }
  };

  const cancelOrder = async (order) => {
    const ok = await confirm({
      title: 'Buyurtma bekor qilinsinmi?',
      content: `${order.dineInNumber || ''} — bu amalni qaytarib bo\u2018lmaydi.`,
      tone: 'danger', okText: 'Bekor qilish',
    });
    if (!ok) return;
    try {
      await panelApi.updateDineInOrderStatus(order._id, 'cancelled');
      await load();
    } catch (e) {
      setErr(e.message);
    }
  };

  const closeTable = async () => {
    const openOrders = (detail?.orders || []).filter(
      (o) => !['completed', 'cancelled'].includes(o.status),
    ).length;

    const ok = await confirm({
      title: 'Chek yopilsinmi?',
      content: openOrders > 0
        ? `${openOrders} ta buyurtma hali yakunlanmagan — baribir yopish uchun tugallanadi deb belgilanadi.`
        : `${table.tableName || `Stol ${table.tableNumber}`} bo\u2018shatiladi.`,
      tone: openOrders > 0 ? 'warning' : 'default',
      okText: 'Yopish',
    });
    if (!ok) return;

    setClosing(true); setErr(null);
    try {
      await panelApi.closeDineInTable(table._id, { force: true, reason: 'Admin yopdi' });
      onChanged?.();
      onClose();
    } catch (e) {
      setErr(e.message);
      setClosing(false);
    }
  };

  const printCheck = () => {
    const orders = (detail?.orders || []).filter((o) => o.status !== 'cancelled');
    const win = window.open('', '_blank', 'width=380,height=600');
    if (!win) return;
    const rows = orders.flatMap((o) => (o.items || []).map((it) => `
      <tr>
        <td>${it.name}</td>
        <td style="text-align:center">${it.quantity}</td>
        <td style="text-align:right">${(it.unitPrice * it.quantity).toLocaleString('ru-RU')}</td>
      </tr>`)).join('');
    win.document.write(`
      <html><head><title>Chek</title><style>
        body{font-family:monospace;padding:16px;font-size:13px}
        h2{text-align:center;margin:0 0 4px}
        p{text-align:center;margin:0 0 12px;color:#555}
        table{width:100%;border-collapse:collapse}
        td{padding:3px 0;border-bottom:1px dashed #ccc}
        .total{font-weight:bold;font-size:15px;border-top:2px solid #000;margin-top:8px;padding-top:8px}
      </style></head><body>
        <h2>LokmaGo</h2>
        <p>${table.tableName || `Stol ${table.tableNumber}`} · ${new Date().toLocaleString('ru-RU')}</p>
        <table>${rows}</table>
        <div class="total">Jami: ${(detail?.summary?.total || 0).toLocaleString('ru-RU')} so'm</div>
        <script>window.print()</script>
      </body></html>`);
    win.document.close();
  };

  /*
   * TEZLIK (2026-08): filteredMenu endi useMemo bilan — avval
   * har render'da (shu jumladan savatga +1 bosilganda ham,
   * chunki cart o'zgarishi butun modalni qayta render qiladi)
   * BUTUN menyu qayta filtrlanardi. Katta menyuda (100+ taom)
   * bu sezilarli sekinlashuvga olib kelardi ("dastur qotib
   * qolyapti" shikoyatining bir sababi).
   */
  const filteredMenu = useMemo(() => {
    const q = menuSearch.trim().toLowerCase();
    return (menu || []).filter((d) => !q || d.name.toLowerCase().includes(q));
  }, [menu, menuSearch]);

  // Kategoriya bo'yicha guruhlash — katta menyuda navigatsiya
  // qilishni osonlashtiradi (bir tekis 100 ta qatordan ko'ra)
  const groupedMenu = useMemo(() => {
    const groups = new Map();
    for (const d of filteredMenu) {
      const key = d.category || d.section || 'Boshqa';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(d);
    }
    return [...groups.entries()];
  }, [filteredMenu]);

  return (
    <Modal title={table.tableName || `Stol ${table.tableNumber}`} onClose={onClose} wide>
      {err && <ErrBox text={err} />}

      {/* Mehmon soni — stepper */}
      <div className="mb-4 flex items-center justify-between rounded-[16px] px-4 py-3"
        style={{ background: 'rgba(120,120,128,0.08)' }}>
        <div>
          <div className="text-[13px] font-semibold text-ink">Mehmonlar soni</div>
          <div className="text-[11px] text-muted">Sig'im: {table.capacity} kishi</div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => saveGuests(guestCount - 1)} disabled={savingGuests || guestCount <= 0}
            className="tap flex h-9 w-9 items-center justify-center rounded-full text-lg font-semibold disabled:opacity-30"
            style={{ background: 'rgba(120,120,128,0.14)' }}>−</button>
          <span className="w-6 text-center text-[17px] font-bold text-ink">{guestCount}</span>
          <button onClick={() => saveGuests(guestCount + 1)} disabled={savingGuests}
            className="tap flex h-9 w-9 items-center justify-center rounded-full text-lg font-semibold"
            style={{ background: 'rgba(120,120,128,0.14)' }}>+</button>
        </div>
      </div>

      {/* Tab: Hisob / Menyu */}
      <div className="mb-3 flex gap-1.5 rounded-[13px] p-1" style={{ background: 'rgba(120,120,128,0.08)' }}>
        {[['bill', 'Hisob'], ['menu', `Taom qo'shish${cartCount ? ` (${cartCount})` : ''}`]].map(([k, label]) => (
          <button key={k} onClick={() => setView(k)}
            className={`tap flex-1 rounded-[10px] py-2 text-[13px] font-semibold ${view === k ? 'bg-white text-ink shadow-sm' : 'text-muted'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-10 text-center text-[13px] text-muted">Yuklanmoqda...</div>
      ) : view === 'bill' ? (
        <>
          {(detail?.orders || []).length === 0 ? (
            <EmptyState icon="ti-receipt-2" title="Hali buyurtma yo'q"
              text="Mehmon uchun taom qo'shish uchun yuqoridagi tabga o'ting" />
          ) : (
            <div className="mb-3 space-y-2">
              {detail.orders.map((o) => {
                const flow = ORDER_STATUS_FLOW[o.status] || {};
                const canAct = !['completed', 'cancelled'].includes(o.status);
                return (
                  <div key={o._id} className="rounded-[15px] px-3.5 py-3" style={{ background: 'rgba(120,120,128,0.06)' }}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-muted">
                        {o.dineInNumber || ''} · {new Date(o.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                        style={{
                          background: tint(o.status === 'cancelled' ? '#FF3B30' : '#007AFF'),
                          color: o.status === 'cancelled' ? '#D70015' : '#007AFF',
                        }}>
                        {flow.label || o.status}
                      </span>
                    </div>
                    {(o.items || []).map((it, i) => (
                      <div key={i} className="flex justify-between text-[13px] text-ink">
                        <span>{it.quantity}× {it.name}</span>
                        <span>{(it.unitPrice * it.quantity).toLocaleString('ru-RU')}</span>
                      </div>
                    ))}
                    {canAct && (
                      <div className="mt-2.5 flex gap-1.5">
                        {flow.next && (
                          <button onClick={() => advanceOrder(o)}
                            className="tap flex-1 rounded-[10px] bg-brand-400 py-1.5 text-[12px] font-semibold text-brand-text">
                            {flow.nextLabel}
                          </button>
                        )}
                        <button onClick={() => cancelOrder(o)}
                          className="tap rounded-[10px] px-3 py-1.5 text-[12px] font-semibold"
                          style={{ background: tint('#FF3B30', 0.1), color: '#D70015' }}>
                          Bekor
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Hisob jami */}
          {detail?.summary && detail.orders.length > 0 && (
            <div className="mb-4 space-y-1 rounded-[15px] px-3.5 py-3" style={{ background: 'rgba(120,120,128,0.06)' }}>
              <div className="flex justify-between text-[13px] text-muted">
                <span>Taomlar</span><span>{detail.summary.subtotal.toLocaleString('ru-RU')} so'm</span>
              </div>
              {detail.summary.serviceFee > 0 && (
                <div className="flex justify-between text-[13px] text-muted">
                  <span>Xizmat haqi</span><span>{detail.summary.serviceFee.toLocaleString('ru-RU')} so'm</span>
                </div>
              )}
              <div className="flex justify-between border-t border-black/10 pt-1.5 text-[15px] font-bold text-ink">
                <span>Jami</span><span>{detail.summary.total.toLocaleString('ru-RU')} so'm</span>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={printCheck} disabled={!detail?.orders?.length}
              className="tap flex-1 rounded-[15px] py-3 text-[15px] font-medium text-ink disabled:opacity-40"
              style={{ background: 'rgba(120,120,128,0.12)' }}>
              <i className="ti ti-printer mr-1.5" />Chek chop etish
            </button>
            <button onClick={closeTable} disabled={closing}
              className="tap flex-1 rounded-[15px] bg-brand-400 py-3 text-[15px] font-semibold text-brand-text disabled:opacity-60">
              {closing ? '...' : "Stolni bo'shatish"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="relative mb-3">
            <i className="ti ti-search absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-muted" />
            <input value={menuSearch} onChange={(e) => setMenuSearch(e.target.value)}
              placeholder="Taom qidirish..."
              className="w-full rounded-[13px] py-2.5 pl-9 pr-3.5 text-[14px]"
              style={{ background: 'rgba(120,120,128,0.08)' }} />
          </div>

          {menu === null ? (
            <div className="py-10 text-center text-[13px] text-muted">Menyu yuklanmoqda...</div>
          ) : groupedMenu.length === 0 && err ? (
            <div className="py-10 text-center">
              <p className="mb-3 text-[13px] text-muted">{err}</p>
              <button
                onClick={() => loadMenu(true)}
                className="tap rounded-[12px] px-4 py-2 text-[13px] font-semibold text-ink"
                style={{ background: 'rgba(120,120,128,0.12)' }}>
                Qayta urinish
              </button>
            </div>
          ) : groupedMenu.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-muted">Taom topilmadi</div>
          ) : (
            <div className="mb-4 max-h-[46vh] space-y-4 overflow-y-auto pr-0.5">
              {groupedMenu.map(([category, dishes]) => (
                <div key={category}>
                  {groupedMenu.length > 1 && (
                    <div className="mb-1.5 px-0.5 text-[11px] font-bold uppercase tracking-wide text-muted">
                      {category}
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {dishes.map((d) => (
                      <MenuRow key={d._id} dish={d} qty={cart[d._id] || 0}
                        onAdd={() => addToCart(d._id)} onRemove={() => removeFromCart(d._id)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button onClick={submitCart} disabled={!cartCount || submitting}
            className="tap w-full rounded-[15px] bg-brand-400 py-3 text-[15px] font-semibold text-brand-text disabled:opacity-40">
            {submitting ? 'Yuborilmoqda...' : cartCount ? `Yuborish (${cartCount} ta)` : 'Taom tanlang'}
          </button>
        </>
      )}
    </Modal>
  );
}


/**
 * Bitta menyu qatori — rasm bilan, chiroyli.
 *
 * memo() bilan o'ralgan: savatga +1 bosilganda FAQAT shu
 * qatorning o'zi qayta render bo'ladi, boshqa 50-100 ta qator
 * tegilmaydi. Katta menyuda bu sezilarli tezlik farqi beradi —
 * avval har bosishda BUTUN ro'yxat qayta chizilardi.
 */
const MenuRow = memo(function MenuRow({ dish: d, qty, onAdd, onRemove }) {
  const price = d.dineInPrice || d.price;
  return (
    <div className={`flex items-center gap-3 rounded-[14px] p-2 pr-2.5 transition-colors ${qty > 0 ? '' : ''}`}
      style={{ background: qty > 0 ? 'rgba(245,166,35,0.10)' : '#fff', border: '1px solid rgba(120,120,128,0.10)' }}>

      {/* Rasm — bo'lmasa taom nomining birinchi harfi bilan chiroyli placeholder */}
      {d.imageUrl ? (
        <Img src={d.imageUrl} w={96}
          className="h-12 w-12 flex-none rounded-[11px] object-cover" />
      ) : (
        <div className="flex h-12 w-12 flex-none items-center justify-center rounded-[11px] text-[17px] font-bold"
          style={{ background: tint('#EF9F27', 0.16), color: '#BA7517' }}>
          {d.name?.[0]?.toUpperCase() || '?'}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold leading-tight text-ink">{d.name}</div>
        <div className="mt-0.5 text-[12px] font-medium text-muted">{price.toLocaleString('ru-RU')} so'm</div>
      </div>

      <div className="flex flex-none items-center gap-1.5">
        {qty > 0 && (
          <>
            <button onClick={onRemove}
              className="tap flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold"
              style={{ background: 'rgba(120,120,128,0.14)' }}>−</button>
            <span className="w-5 text-center text-[13.5px] font-bold text-ink">{qty}</span>
          </>
        )}
        <button onClick={onAdd}
          className="tap flex h-7 w-7 items-center justify-center rounded-full text-[15px] font-semibold text-brand-text shadow-sm"
          style={{ background: '#F5A623' }}>+</button>
      </div>
    </div>
  );
});

function EmptyState({ icon, title, text, action }) {
  return (
    <div className="g rounded-[22px] px-6 py-12 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[18px]"
        style={{ background: tint('#EF9F27', 0.16) }}>
        <i className={`ti ${icon} text-2xl`} style={{ color: '#BA7517' }} />
      </div>
      <div className="text-[17px] font-semibold text-ink">{title}</div>
      <p className="mx-auto mt-1.5 max-w-xs text-[13px] leading-relaxed text-muted">
        {text}
      </p>
      {action && (
        <button onClick={action.onClick}
          className="tap mt-5 rounded-[15px] bg-brand-400 px-5 py-2.5 text-[15px] font-semibold text-brand-text">
          {action.label}
        </button>
      )}
    </div>
  );
}

/* ═══════════ STOL FORMALARI ═══════════ */

function TableForm({ table, onClose, onSaved }) {
  useLockScroll();
  const isEdit = Boolean(table);

  const [form, setForm] = useState({
    tableNumber: table?.tableNumber || '',
    tableName: table?.tableName || '',
    capacity: table?.capacity ?? 4,
    status: table?.status || 'available',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!String(form.tableNumber).trim()) { setErr('Stol raqamini kiriting'); return; }
    setSaving(true); setErr(null);
    try {
      const payload = {
        ...form,
        tableNumber: String(form.tableNumber).trim(),
        capacity: Number(form.capacity) || 4,
      };
      if (isEdit) await panelApi.updateTable(table._id, payload);
      else await panelApi.createTable(payload);
      onSaved();
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? 'Stolni tahrirlash' : 'Yangi stol'} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Stol raqami *">
          <input value={form.tableNumber}
            onChange={(e) => set('tableNumber', e.target.value)}
            placeholder="12" className="inp" />
        </Field>
        <Field label="Sig'imi">
          <NumberInput value={form.capacity}
            onChange={(v) => set('capacity', v)} suffix="kishi" placeholder="4" />
        </Field>
      </div>

      <Field label="Nomi" hint="Ixtiyoriy — masalan 'Deraza yonida'">
        <input value={form.tableName}
          onChange={(e) => set('tableName', e.target.value)}
          placeholder="Deraza yonida" className="inp" />
      </Field>

      {isEdit && (
        <Field label="Holati">
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(TABLE_STATUS).map(([k, v]) => {
              const on = form.status === k;
              return (
                <button key={k} onClick={() => set('status', k)}
                  className="tap flex items-center gap-2 rounded-[13px] px-3 py-2.5 text-[14px] font-medium"
                  style={{
                    background: on ? tint(v.color, 0.16) : 'rgba(120,120,128,0.08)',
                    color: on ? v.color : '#6B6B66',
                  }}>
                  <span className="h-2 w-2 flex-none rounded-full"
                    style={{ background: v.color }} />
                  {v.label}
                </button>
              );
            })}
          </div>
        </Field>
      )}

      {err && <ErrBox text={err} />}
      <Actions onClose={onClose} onSubmit={submit} saving={saving} />
    </Modal>
  );
}

function BulkForm({ onClose, onSaved }) {
  useLockScroll();
  const [form, setForm] = useState({ count: 10, startFrom: 1, capacity: 4 });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true); setErr(null);
    try {
      const r = await panelApi.createTablesBulk({
        count: Number(form.count) || 0,
        startFrom: Number(form.startFrom) || 1,
        capacity: Number(form.capacity) || 4,
      });
      alert(`${r.created} ta stol qo'shildi`);
      onSaved();
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  const from = Number(form.startFrom) || 1;
  const count = Number(form.count) || 0;

  return (
    <Modal title="Bir nechta stol" onClose={onClose}>
      <p className="mb-3 text-[13px] leading-relaxed text-muted">
        Ketma-ket raqamlangan stollar yaratiladi. Mavjud raqamlar
        o'tkazib yuboriladi.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Nechta">
          <NumberInput value={form.count} onChange={(v) => set('count', v)} placeholder="10" />
        </Field>
        <Field label="Boshlanish raqami">
          <NumberInput value={form.startFrom} onChange={(v) => set('startFrom', v)} placeholder="1" />
        </Field>
      </div>

      <Field label="Sig'imi">
        <NumberInput value={form.capacity} onChange={(v) => set('capacity', v)}
          suffix="kishi" placeholder="4" />
      </Field>

      {count > 0 && (
        <div className="mb-3 rounded-[13px] px-3 py-2.5 text-[13px]"
          style={{ background: tint('#007AFF', 0.1), color: '#0A66C2' }}>
          №{from} dan №{from + count - 1} gacha — {count} ta stol
        </div>
      )}

      {err && <ErrBox text={err} />}
      <Actions onClose={onClose} onSubmit={submit} saving={saving} />
    </Modal>
  );
}

/* ═══ QR dizayni ═══
 * Dizayn barcha restoranlarda BIR XIL — ranglar va joylashuv
 * o'zgarmaydi. Restoran faqat fon rasmi, logo va matnlarni
 * almashtira oladi.
 */
const QR_DEFAULTS = {
  eyebrow: 'DIGITAL',
  menuWord: 'MENYU',
  headline: 'QR KODNI SKANERLANG',
  footnote: 'Telefon kamerangizni QR kodga tuting va buyurtma bering',
};

function ThemeForm({ theme, onClose, onSaved }) {
  useLockScroll();

  const [form, setForm] = useState({
    backgroundImage: theme?.backgroundImage || '',
    logoUrl: theme?.logoUrl || '',
    eyebrow: theme?.eyebrow || '',
    menuWord: theme?.menuWord || '',
    headline: theme?.headline || '',
    footnote: theme?.footnote || '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true); setErr(null);
    try {
      await panelApi.updateQrTheme(form);
      onSaved();
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <Modal title="QR dizayni" onClose={onClose} wide>
      <div className="sm:grid sm:grid-cols-[190px_minmax(0,1fr)] sm:gap-5">
        <div className="mb-4 sm:mb-0">
          <QrPreview form={form} />
        </div>

        <div className="min-w-0">
          <p className="mb-3 rounded-[13px] px-3 py-2.5 text-[12px] leading-relaxed"
            style={{ background: 'rgba(120,120,128,0.09)', color: '#6B6B66' }}>
            Dizayn barcha stollarda <b className="text-ink">bir xil</b> chiqadi.
            Siz faqat fon rasmi va matnlarni o'zgartirasiz. QR doim oq maydonda
            turadi — skaner har doim o'qiy oladi.
          </p>

          <div className="grid grid-cols-[minmax(0,1fr)_118px] gap-3">
            <ImageUpload label="Fon rasmi" aspect="16/9" folder="banners"
              value={form.backgroundImage}
              onChange={(url) => set('backgroundImage', url)} />
            <ImageUpload label="Logo" aspect="1/1" folder="banners"
              value={form.logoUrl}
              onChange={(url) => set('logoUrl', url)} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Kichik so'z">
              <input value={form.eyebrow} maxLength={16}
                onChange={(e) => set('eyebrow', e.target.value)}
                placeholder={QR_DEFAULTS.eyebrow} className="inp" />
            </Field>
            <Field label="Menyu so'zi">
              <input value={form.menuWord} maxLength={16}
                onChange={(e) => set('menuWord', e.target.value)}
                placeholder={QR_DEFAULTS.menuWord} className="inp" />
            </Field>
          </div>

          <Field label="Sarlavha" hint="Katta harflarda chiqadi, 2 qatorgacha">
            <input value={form.headline} maxLength={44}
              onChange={(e) => set('headline', e.target.value)}
              placeholder={QR_DEFAULTS.headline} className="inp" />
          </Field>

          <Field label="Izoh" hint="QR ostidagi kichik tushuntirish matni">
            <input value={form.footnote} maxLength={120}
              onChange={(e) => set('footnote', e.target.value)}
              placeholder={QR_DEFAULTS.footnote} className="inp" />
          </Field>
        </div>
      </div>

      {err && <ErrBox text={err} />}
      <Actions onClose={onClose} onSubmit={submit} saving={saving} />
    </Modal>
  );
}

/**
 * Jonli ko'rinish — serverdagi qrDesign.js bilan bir xil nisbatlarda.
 * Ranglar qat'iy: o'zgartirib bo'lmaydi.
 */
function QrPreview({ form }) {
  const eyebrow = (form.eyebrow || QR_DEFAULTS.eyebrow).toUpperCase();
  const menuWord = (form.menuWord || QR_DEFAULTS.menuWord).toUpperCase();
  const headline = (form.headline || QR_DEFAULTS.headline).toUpperCase();
  const footnote = form.footnote || QR_DEFAULTS.footnote;

  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-semibold text-ink">
        Ko'rinish
      </label>
      <div className="mx-auto w-[180px] select-none overflow-hidden rounded-[18px] shadow-lg sm:w-full"
        style={{ aspectRatio: '2 / 3', background: 'linear-gradient(#17635E,#124F4B)' }}>
        <div className="relative h-full w-full">
          {/* Yuqori foto */}
          <div className="absolute inset-x-0 top-0 h-[40%] overflow-hidden bg-[#201915]">
            {form.backgroundImage && (
              <Img src={form.backgroundImage} w={800}
                className="h-full w-full object-cover" />
            )}
            <div className="absolute inset-0"
              style={{ background: 'linear-gradient(rgba(0,0,0,.62),rgba(0,0,0,.28) 45%,rgba(0,0,0,.55))' }} />
            <div className="absolute inset-x-0 top-[9%] flex items-center justify-between px-[9%]">
              <span className="text-[16px] font-bold leading-none text-white">Stol 1</span>
              <div className="flex items-center gap-2">
                <span className="h-6 w-px bg-white/55" />
                <span className="text-right leading-none">
                  <span className="block text-[6px] font-semibold tracking-[0.18em] text-[#EE7A2B]">
                    {eyebrow}
                  </span>
                  <span className="mt-[2px] block text-[9px] font-bold tracking-wide text-white">
                    {menuWord}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Sariq ramka + QR */}
          <div className="absolute left-1/2 top-[24%] w-[60%] -translate-x-1/2 rounded-[10px] bg-[#EE7A2B] p-[5px] shadow-lg">
            <div className="aspect-square w-full rounded-[7px] bg-white p-[7px]">
              <div className="h-full w-full"
                style={{
                  backgroundImage: 'repeating-conic-gradient(#14100E 0% 25%, #fff 0% 50%)',
                  backgroundSize: '11% 11%',
                }} />
            </div>
            <div className="py-[5px] text-center text-[9px] font-bold tracking-[0.14em] text-white">
              {menuWord}
            </div>
          </div>

          {/* Sarlavha + izoh */}
          <div className="absolute inset-x-0 top-[73%] px-[8%] text-center">
            <p className="break-words text-[11px] font-bold leading-tight text-white">
              {headline}
            </p>
            <p className="mt-[6px] break-words text-[6.5px] leading-snug text-white/80">
              {footnote}
            </p>
          </div>

          <p className="absolute inset-x-0 bottom-[3%] text-center text-[5.5px] tracking-[0.2em] text-white/55">
            lokma.uz
          </p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════ UMUMIY ELEMENTLAR ═══════════ */

function Modal({ title, children, onClose, wide }) {
  return (
    <div onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 backdrop-blur-md sm:items-center sm:p-4">
      <div onClick={(e) => e.stopPropagation()}
        className={`ios26-sheet g g-live w-full overflow-y-auto rounded-t-[26px] px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-[26px] sm:pt-5 sm:pb-5 ${
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md'
        } max-h-[92dvh] sm:max-h-[88dvh]`}>
        {/* iOS tortish chizig'i */}
        <div aria-hidden className="mx-auto mb-3 h-1 w-9 rounded-full bg-black/15 sm:hidden" />

        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-[20px] font-bold tracking-[-0.01em] text-ink">{title}</h3>
          <button onClick={onClose} aria-label="Yopish"
            className="tap flex h-8 w-8 flex-none items-center justify-center rounded-full text-muted"
            style={{ background: 'rgba(120,120,128,0.12)' }}>
            <i className="ti ti-x text-lg" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="mb-3">
      <label className="mb-1.5 block text-[13px] font-semibold text-ink">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11.5px] leading-snug text-muted">{hint}</p>}
    </div>
  );
}

function ErrBox({ text }) {
  return (
    <div className="mb-3 flex items-start gap-2 rounded-[13px] px-3 py-2.5 text-[13px]"
      style={{ background: tint('#FF3B30', 0.1), color: '#D70015' }}>
      <i className="ti ti-alert-circle mt-[1px] flex-none" />
      <span>{text}</span>
    </div>
  );
}

function Actions({ onClose, onSubmit, saving }) {
  return (
    <div className="mt-4 flex gap-2">
      <button onClick={onClose}
        className="tap flex-1 rounded-[15px] py-3 text-[15px] font-medium text-ink"
        style={{ background: 'rgba(120,120,128,0.12)' }}>
        Bekor
      </button>
      <button onClick={onSubmit} disabled={saving}
        className="tap flex-[1.6] rounded-[15px] bg-brand-400 py-3 text-[15px] font-semibold text-brand-text disabled:opacity-50">
        {saving ? 'Saqlanmoqda...' : 'Saqlash'}
      </button>
    </div>
  );
}

/** iOS uslubidagi almashtirgich. */
function Toggle({ checked, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative h-[31px] w-[51px] flex-none rounded-full transition-colors duration-300"
      style={{ background: checked ? '#34C759' : 'rgba(120,120,128,0.24)' }}>
      <span className="absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-md transition-transform duration-300"
        style={{ left: 2, transform: `translateX(${checked ? 20 : 0}px)` }} />
    </button>
  );
}

/** Sarlavhali guruh — iOS "grouped list" uslubi. */
function Group({ title, children, className = '' }) {
  return (
    <section className={className}>
      {title && (
        <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
          {title}
        </h2>
      )}
      <div className="g rounded-[20px] p-4">{children}</div>
    </section>
  );
}

/* ═══════════ OFITSIANTLAR ═══════════ */

function Waiters({ tables }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    panelApi.getWaiters()
      .then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetDevice = async (w) => {
    if (!await confirm({ title:
      `${w.fullName} qurilmasi bekor qilinsinmi?\n\n` +
      'Keyingi kirishda yangi qurilma bog\'lanadi.',
     })) return;
    try {
      const r = await panelApi.resetWaiterDevice(w._id);
      alert(r.message);
      load();
    } catch (e) { alert(e.message); }
  };

  const remove = async (w) => {
    if (!await confirm({ title: `${w.fullName} o'chirilsinmi?` })) return;
    try { await panelApi.deleteWaiter(w._id); load(); }
    catch (e) { alert(e.message); }
  };

  if (loading) return <Loading />;

  return (
    <>
      <button onClick={() => setEditing('new')}
        className="tap mb-3 flex w-full items-center justify-center gap-2 rounded-[16px] bg-brand-400 py-3 text-[15px] font-semibold text-brand-text sm:w-auto sm:px-5">
        <i className="ti ti-user-plus text-lg" /> Ofitsiant qo'shish
      </button>

      {items.length === 0 ? (
        <EmptyState icon="ti-users" title="Ofitsiant yo'q"
          text="Ofitsiantlar waiter.lokma.uz orqali kirib buyurtma qabul qiladi" />
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2 2xl:grid-cols-3">
          {items.map((w) => (
            <article key={w._id} className="g rounded-[20px] p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[16px] font-semibold text-ink">
                    {w.fullName}
                  </div>
                  <div className="mt-0.5 truncate text-[12px] text-muted">
                    @{w.login}{w.phone && ` · ${w.phone}`}
                  </div>
                </div>
                <span className="flex-none rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={{
                    background: tint(w.isActive ? '#34C759' : '#8E8E93'),
                    color: w.isActive ? '#248A3D' : '#6B6B66',
                  }}>
                  {w.isActive ? 'Faol' : "O'chiq"}
                </span>
              </div>

              <div className="mb-3 space-y-1.5 rounded-[14px] px-3 py-2.5"
                style={{ background: 'rgba(120,120,128,0.08)' }}>
                <Row icon={w.deviceBound ? 'ti-device-mobile-check' : 'ti-device-mobile-off'}
                  tone={w.deviceBound ? '#248A3D' : '#6B6B66'}
                  text={w.deviceBound
                    ? `Qurilma bog'langan${w.deviceLabel ? ` · ${w.deviceLabel}` : ''}`
                    : "Qurilma bog'lanmagan"} />

                {w.tableIds?.length > 0 && (
                  <Row icon="ti-armchair"
                    text={`Stollar: ${w.tableIds.map((t) => t.tableNumber).join(', ')}`} />
                )}

                {w.earnings?.total > 0 && (
                  <Row icon="ti-coins"
                    text={`${w.earnings.total.toLocaleString('ru-RU')} so'm · ${w.earnings.orders} buyurtma`} />
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={() => setEditing(w)}
                  className="tap flex-1 rounded-[13px] py-2.5 text-[14px] font-medium text-ink"
                  style={{ background: 'rgba(120,120,128,0.12)' }}>
                  Tahrirlash
                </button>
                {w.deviceBound && (
                  <button onClick={() => resetDevice(w)} title="Qurilmani almashtirish"
                    className="tap flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[13px]"
                    style={{ background: tint('#FF9500', 0.12), color: '#C86A00' }}>
                    <i className="ti ti-device-mobile-x text-[17px]" />
                  </button>
                )}
                <button onClick={() => remove(w)} title="O'chirish"
                  className="tap flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[13px]"
                  style={{ background: tint('#FF3B30', 0.1), color: '#FF3B30' }}>
                  <i className="ti ti-trash text-[17px]" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <WaiterForm
          waiter={editing === 'new' ? null : editing}
          tables={tables}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </>
  );
}

function Row({ icon, text, tone }) {
  return (
    <div className="flex items-center gap-2 text-[12px]" style={{ color: tone || '#6B6B66' }}>
      <i className={`ti ${icon} flex-none text-[15px]`} />
      <span className="truncate">{text}</span>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center gap-2 px-1 py-6 text-[14px] text-muted">
      <i className="ti ti-loader-2 animate-spin" /> Yuklanmoqda...
    </div>
  );
}

function WaiterForm({ waiter, tables, onClose, onSaved }) {
  useLockScroll();
  const isEdit = Boolean(waiter);

  const [form, setForm] = useState({
    firstName: waiter?.firstName || '',
    lastName: waiter?.lastName || '',
    phone: waiter?.phone || '',
    login: waiter?.login || '',
    password: '',
    isActive: waiter?.isActive ?? true,
    tableIds: waiter?.tableIds?.map((t) => t._id || t) || [],
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleTable = (id) => {
    setForm((f) => ({
      ...f,
      tableIds: f.tableIds.includes(id)
        ? f.tableIds.filter((x) => x !== id)
        : [...f.tableIds, id],
    }));
  };

  const submit = async () => {
    if (form.firstName.trim().length < 2) { setErr('Ismni kiriting'); return; }
    if (!isEdit && form.login.trim().length < 3) { setErr('Login kiriting'); return; }
    if (!isEdit && form.password.length < 4) { setErr('Parol kamida 4 belgi'); return; }

    setSaving(true); setErr(null);
    try {
      const payload = { ...form };
      if (isEdit) {
        delete payload.login;
        if (!payload.password) delete payload.password;
      }
      if (isEdit) await panelApi.updateWaiter(waiter._id, payload);
      else await panelApi.createWaiter(payload);
      onSaved();
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? 'Ofitsiantni tahrirlash' : 'Yangi ofitsiant'} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ism *">
          <input value={form.firstName} onChange={(e) => set('firstName', e.target.value)}
            className="inp" />
        </Field>
        <Field label="Familiya">
          <input value={form.lastName} onChange={(e) => set('lastName', e.target.value)}
            className="inp" />
        </Field>
      </div>

      <Field label="Telefon">
        <input value={form.phone} onChange={(e) => set('phone', e.target.value)}
          placeholder="+998 90 123 45 67" className="inp" />
      </Field>

      {!isEdit && (
        <Field label="Login *" hint="Faqat harf, raqam va _">
          <input value={form.login}
            onChange={(e) => set('login', e.target.value.toLowerCase())}
            placeholder="aziz" className="inp" />
        </Field>
      )}

      <Field label={isEdit ? 'Yangi parol' : 'Parol *'}
        hint={isEdit ? "Bo'sh qoldirsangiz o'zgarmaydi" : 'Kamida 4 belgi'}>
        <input type="text" value={form.password}
          onChange={(e) => set('password', e.target.value)}
          className="inp" />
      </Field>

      {tables?.length > 0 && (
        <Field label="Biriktirilgan stollar"
          hint="Tanlanmasa barcha stollarga kirish beriladi. Bitta stolga eng ko'pi 3 ofitsiant.">
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {tables.map((t) => {
              const on = form.tableIds.includes(t._id);
              return (
                <button key={t._id} onClick={() => toggleTable(t._id)}
                  className="tap min-w-[38px] rounded-[11px] px-2.5 py-2 text-[13px] font-medium"
                  style={{
                    background: on ? '#EF9F27' : 'rgba(120,120,128,0.1)',
                    color: on ? '#2C1400' : '#6B6B66',
                  }}>
                  {t.tableNumber}
                </button>
              );
            })}
          </div>
        </Field>
      )}

      <div className="mt-1 flex items-center justify-between gap-3 rounded-[14px] px-3.5 py-3"
        style={{ background: 'rgba(120,120,128,0.08)' }}>
        <span className="text-[15px] text-ink">Faol</span>
        <Toggle checked={form.isActive} onChange={(v) => set('isActive', v)} />
      </div>

      {err && <ErrBox text={err} />}
      <Actions onClose={onClose} onSubmit={submit} saving={saving} />
    </Modal>
  );
}

/* ═══════════ XIZMAT HAQI ═══════════ */

function ServiceFee({ cfg, onSaved }) {
  const [form, setForm] = useState({
    serviceFeeEnabled: cfg?.serviceFeeEnabled ?? false,
    serviceFeeType: cfg?.serviceFeeType || 'percentage',
    serviceFeeValue: cfg?.serviceFeeValue ?? 10,
    useGlobalStopList: cfg?.useGlobalStopList !== false,
  });
  const [saving, setSaving] = useState(false);
  const [msg, flashMsg, setMsg] = useTempValue();

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      await panelApi.updateDineInSettings(form);
      flashMsg({ ok: true, text: 'Saqlandi' });
      onSaved?.();
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const example = form.serviceFeeType === 'percentage'
    ? Math.round(150000 * (Number(form.serviceFeeValue) || 0) / 100)
    : (Number(form.serviceFeeValue) || 0);

  return (
    <div className="max-w-2xl space-y-4">
      <Group title="Xizmat haqi">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[15px] text-ink">Xizmat haqi olinsin</div>
            <p className="mt-0.5 text-[12.5px] leading-snug text-muted">
              Faqat ofitsiant qabul qilgan buyurtmalarga qo'llanadi
            </p>
          </div>
          <Toggle checked={form.serviceFeeEnabled}
            onChange={(v) => set('serviceFeeEnabled', v)} />
        </div>

        {form.serviceFeeEnabled && (
          <div className="mt-4 border-t border-black/5 pt-4">
            <div className="mb-3">
              <Segmented value={form.serviceFeeType}
                onChange={(v) => set('serviceFeeType', v)}
                items={[['percentage', 'Foiz (%)'], ['fixed', "Qat'iy summa"]]} />
            </div>

            <Field label="Miqdori">
              <NumberInput value={form.serviceFeeValue}
                onChange={(v) => set('serviceFeeValue', v)}
                suffix={form.serviceFeeType === 'percentage' ? '%' : "so'm"} />
            </Field>

            <div className="rounded-[14px] px-3.5 py-3 text-[12.5px] leading-relaxed"
              style={{ background: tint('#007AFF', 0.09), color: '#0A66C2' }}>
              Taomlar 150 000 so'm bo'lsa, xizmat haqi{' '}
              <b>{example.toLocaleString('ru-RU')} so'm</b>.
              <br />
              QR orqali berilgan buyurtmada xizmat haqi olinmaydi.
            </div>
          </div>
        )}
      </Group>

      <Group title="Menyu">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[15px] text-ink">Stop List ishlatilsin</div>
            <p className="mt-0.5 text-[12.5px] leading-snug text-muted">
              To'xtatilgan taomlar zal menyusida ham ko'rinmaydi
            </p>
          </div>
          <Toggle checked={form.useGlobalStopList}
            onChange={(v) => set('useGlobalStopList', v)} />
        </div>
      </Group>

      {msg && (
        <div className="rounded-[14px] px-3.5 py-3 text-[13.5px] font-medium"
          style={{
            background: tint(msg.ok ? '#34C759' : '#FF3B30', 0.12),
            color: msg.ok ? '#248A3D' : '#D70015',
          }}>
          {msg.text}
        </div>
      )}

      <button onClick={save} disabled={saving}
        className="tap w-full rounded-[16px] bg-brand-400 py-3.5 text-[15px] font-semibold text-brand-text disabled:opacity-50">
        {saving ? 'Saqlanmoqda...' : 'Saqlash'}
      </button>
    </div>
  );
}

/* ═══════════ OFITSIANT DAROMADI ═══════════ */

function Earnings() {
  const [period, setPeriod] = useState('month');
  const [range, setRange] = useState({
    from: new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const req = period === 'custom'
      ? panelApi.getWaiterEarningsRange(range.from, range.to)
      : panelApi.getWaiterEarnings(period);

    req.then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [period, range]);

  useEffect(() => { load(); }, [load]);

  const som = (n) => (n ?? 0).toLocaleString('ru-RU').replace(/,/g, ' ');

  const waiters = data?.waiters || [];
  const totalRemaining = waiters.reduce((s, w) => s + w.qoldiq, 0);

  return (
    <>
      <div className="mb-3">
        <Segmented value={period} onChange={setPeriod}
          items={[['today', 'Bugun'], ['week', 'Hafta'], ['month', 'Oy'], ['custom', 'Davr']]} />
      </div>

      {period === 'custom' && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          <input type="date" value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            className="inp" />
          <input type="date" value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            className="inp" />
        </div>
      )}

      {loading ? <Loading /> : (
        <>
          {totalRemaining > 0 && (
            <div className="g mb-3 rounded-[20px] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                To&apos;lanmagan xizmat haqi
              </div>
              <div className="mt-1 text-[28px] font-bold leading-none tabular-nums"
                style={{ color: '#C86A00' }}>
                {som(totalRemaining)} <span className="text-[15px] font-semibold">so&apos;m</span>
              </div>
            </div>
          )}

          {waiters.length === 0 ? (
            <EmptyState icon="ti-coins" title="Ma'lumot yo'q"
              text="Bu davrda ofitsiantlar bo'yicha daromad qayd etilmagan" />
          ) : (
            <div className="grid gap-2.5 xl:grid-cols-2">
              {waiters.map((w) => (
                <article key={w._id} className="g rounded-[20px] p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="truncate text-[16px] font-semibold text-ink">
                      {w.fullName}
                    </div>
                    {!w.isActive && (
                      <span className="flex-none rounded-full px-2.5 py-1 text-[11px] font-semibold"
                        style={{ background: tint('#8E8E93'), color: '#6B6B66' }}>
                        O&apos;chiq
                      </span>
                    )}
                  </div>

                  <div className="mb-3 grid grid-cols-3 gap-2">
                    {[
                      ['Savdo', som(w.savdo), '#1A1A17'],
                      ['Xizmat haqi', som(w.xizmatHaqi), '#BA7517'],
                      ['Buyurtma', w.buyurtmalar, '#1A1A17'],
                    ].map(([label, value, color]) => (
                      <div key={label} className="rounded-[14px] px-2 py-2.5 text-center"
                        style={{ background: 'rgba(120,120,128,0.08)' }}>
                        <div className="text-[10px] text-muted">{label}</div>
                        <div className="mt-0.5 text-[15px] font-semibold tabular-nums"
                          style={{ color }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  <dl className="mb-3 space-y-1.5 border-t border-black/5 pt-3 text-[13px]">
                    <div className="flex justify-between">
                      <dt className="text-muted">Jami daromad</dt>
                      <dd className="tabular-nums text-ink">{som(w.jamiDaromad)} so&apos;m</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted">To&apos;langan</dt>
                      <dd className="tabular-nums" style={{ color: '#248A3D' }}>
                        {som(w.tolangan)} so&apos;m
                      </dd>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <dt className="text-ink">Qoldiq</dt>
                      <dd className="tabular-nums"
                        style={{ color: w.qoldiq > 0 ? '#C86A00' : '#6B6B66' }}>
                        {som(w.qoldiq)} so&apos;m
                      </dd>
                    </div>
                  </dl>

                  {w.qoldiq > 0 && (
                    <button onClick={() => setPaying(w)}
                      className="tap w-full rounded-[14px] py-2.5 text-[14px] font-semibold text-white"
                      style={{ background: '#34C759' }}>
                      To&apos;lash
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {paying && (
        <PayoutModal
          waiter={paying}
          period={period}
          onClose={() => setPaying(null)}
          onPaid={() => { setPaying(null); load(); }}
        />
      )}
    </>
  );
}

function PayoutModal({ waiter, period, onClose, onPaid }) {
  useLockScroll();
  const [amount, setAmount] = useState(waiter.qoldiq);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const som = (n) => (n ?? 0).toLocaleString('ru-RU').replace(/,/g, ' ');

  const submit = async () => {
    const value = Number(amount);
    if (!value || value <= 0) { setErr('Summani kiriting'); return; }

    setSaving(true); setErr(null);
    try {
      const r = await panelApi.payWaiter(waiter._id, value, note);
      alert(`${som(r.paid)} so'm to'landi. Qoldiq: ${som(r.remaining)} so'm`);
      onPaid();
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <Modal title="Xizmat haqini to'lash" onClose={onClose}>
      <div className="mb-4 rounded-[16px] px-3.5 py-3 text-[14px]"
        style={{ background: 'rgba(120,120,128,0.08)' }}>
        <div className="flex justify-between py-1">
          <span className="text-muted">Ofitsiant</span>
          <span className="text-ink">{waiter.fullName}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-muted">Qoldiq</span>
          <b className="tabular-nums text-ink">{som(waiter.qoldiq)} so&apos;m</b>
        </div>
      </div>

      <Field label="To'lov summasi" hint="Qoldiqdan ko'p bo'lmasligi kerak">
        <MoneyInput value={amount} onChange={setAmount} />
      </Field>

      <Field label="Izoh">
        <input value={note} onChange={(e) => setNote(e.target.value)}
          placeholder={`${period === 'today' ? 'Bugungi' : period === 'week' ? 'Haftalik' : 'Oylik'} to'lov`}
          className="inp" />
      </Field>

      <p className="mb-3 rounded-[14px] px-3.5 py-3 text-[12.5px] leading-relaxed"
        style={{ background: 'rgba(120,120,128,0.08)', color: '#6B6B66' }}>
        To&apos;lov moliyaviy jurnalga yoziladi. Bir summa ikki marta
        to&apos;lanmaydi — qoldiq avtomatik hisoblanadi.
      </p>

      {err && <ErrBox text={err} />}
      <Actions onClose={onClose} onSubmit={submit} saving={saving} />
    </Modal>
  );
}

/* ═══════════ TANISHTIRUV ═══════════ */

function DineInIntro({ onRequest }) {
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    await onRequest();
    setSending(false);
  };

  return (
    <div className="ios26 relative min-h-full">
      <Ambient />

      <div className="relative z-10 mx-auto max-w-5xl px-4 pb-10 pt-6 sm:px-6">
        <header className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px]"
            style={{ background: tint('#EF9F27', 0.18) }}>
            <i className="ti ti-qrcode text-3xl" style={{ color: '#BA7517' }} />
          </div>
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-[34px]">
            Zal ichida QR orqali buyurtma
          </h1>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-muted">
            Mijoz stoldagi QR kodni skanerlab menyuni ochadi va
            ofitsiantni kutmasdan buyurtma beradi
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-2">
          <Group title="Qanday ishlaydi">
            <div className="space-y-4">
              <Step n={1} title="Stollarni yaratasiz"
                text="Har stolga raqam va nom berasiz. Tizim avtomatik QR kod yaratadi." />
              <Step n={2} title="QR kodlarni chop etasiz"
                text="Bitta stol yoki barchasi uchun PDF yuklab olasiz. Fon rasmi va matnlarni o'zingiz sozlaysiz." />
              <Step n={3} title="Mijoz skanerlaydi"
                text="Ilova o'rnatish shart emas. QR bosilishi bilan menyu ochiladi va stol avtomatik aniqlanadi." />
              <Step n={4} title="Buyurtma sizga keladi"
                text="Panelda ovoz bilan bildirishnoma chiqadi. Holatni o'zgartirasiz — mijoz kuzatib turadi." />
            </div>
          </Group>

          <Group title="Mijoz shuni ko'radi">
            <div className="flex items-start gap-4">
              <div className="w-[132px] flex-none overflow-hidden rounded-[16px] bg-[#14110F]">
                <div className="border-b border-white/10 px-3 py-2.5">
                  <div className="text-[11px] font-bold text-white">Sizning kafe</div>
                  <div className="mt-0.5 text-[9px] text-amber-400">Stol 12</div>
                </div>

                <div className="flex gap-1 px-2 py-1.5">
                  <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[8px] font-semibold text-black">
                    Hammasi
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[8px] text-white/60">
                    Issiq
                  </span>
                </div>

                {[['Osh', '32 000'], ['Lag\u2018mon', '28 000']].map(([name, price]) => (
                  <div key={name} className="flex items-center gap-2 px-2 py-1.5">
                    <div className="h-8 w-8 flex-none rounded-lg bg-white/10" />
                    <div className="min-w-0">
                      <div className="truncate text-[9px] text-white">{name}</div>
                      <div className="text-[9px] font-semibold text-amber-400">{price}</div>
                    </div>
                  </div>
                ))}

                <div className="m-2 rounded-lg bg-amber-400 py-1.5 text-center text-[9px] font-bold text-black">
                  Savat · 60 000
                </div>
              </div>

              <ul className="flex-1 space-y-2.5 text-[14px]">
                {[
                  'Menyu zal narxlari bilan',
                  'Bir sessiyada bir necha buyurtma',
                  'Ofitsiant chaqirish tugmasi',
                  'Hisobni so\u2018rash',
                  'Buyurtma holatini kuzatish',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5">
                    <i className="ti ti-circle-check mt-0.5 flex-none text-base"
                      style={{ color: '#34C759' }} />
                    <span className="text-ink">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Group>
        </div>

        <div className="my-4 grid grid-cols-3 gap-2.5">
          {[
            ['ti-clock-hour-3', 'Tezroq', 'Ofitsiant kutilmaydi'],
            ['ti-users', 'Kamroq xodim', 'Bir ofitsiant ko\u2018p stolga'],
            ['ti-receipt-off', 'Xatosiz', 'Buyurtma to\u2018g\u2018ridan tizimga'],
          ].map(([icon, title, text]) => (
            <div key={title} className="g rounded-[18px] p-3.5 text-center">
              <i className={`ti ${icon} mb-1.5 block text-xl`} style={{ color: '#BA7517' }} />
              <div className="text-[14px] font-semibold text-ink">{title}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-muted">{text}</div>
            </div>
          ))}
        </div>

        <div className="g rounded-[22px] p-5">
          <h2 className="text-[18px] font-bold text-ink">
            Ulanish uchun ariza qoldiring
          </h2>
          <p className="mb-4 mt-1 text-[13.5px] leading-relaxed text-muted">
            So&apos;rovingiz LokmaGo administratoriga boradi. Tasdiqlangach
            Dine-in bo&apos;limlari ochiladi va stollarni yarata boshlaysiz.
          </p>

          <button onClick={send} disabled={sending}
            className="tap w-full rounded-[16px] bg-brand-400 py-3.5 text-[15px] font-semibold text-brand-text disabled:opacity-50">
            {sending ? 'Yuborilmoqda...' : 'Ariza qoldirish'}
          </button>

          <p className="mt-3 text-center text-[11.5px] text-muted">
            Ariza bepul. Tarif va shartlar tasdiqlangandan keyin ko&apos;rsatiladi.
          </p>
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, text }) {
  return (
    <div className="flex gap-3.5">
      <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[13px] font-bold"
        style={{ background: '#EF9F27', color: '#2C1400' }}>
        {n}
      </div>
      <div className="min-w-0 pt-0.5">
        <div className="text-[14.5px] font-semibold text-ink">{title}</div>
        <div className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{text}</div>
      </div>
    </div>
  );
}
