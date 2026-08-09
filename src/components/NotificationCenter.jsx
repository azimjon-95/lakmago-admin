import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications, startNotificationCenter } from '@/lib/notificationCenter';
import { useAuth } from '@/store/auth';

/**
 * Bildirishnoma markazi.
 *
 * Asosiy UI'ga bog'liq emas: qaysi sahifada bo'lishidan qat'i
 * nazar ishlaydi va sahifa almashganda holatini yo'qotmaydi.
 */

const TYPE_META = {
  order:        { label: 'Buyurtma',   icon: 'ti-clipboard-list',  color: '#F5A524' },
  hall_order:   { label: 'Zal',        icon: 'ti-armchair',        color: '#3B82F6' },
  reservation:  { label: 'Bron',       icon: 'ti-calendar-check',  color: '#AF52DE' },
  waiter_call:  { label: 'Chaqiruv',   icon: 'ti-bell',            color: '#E14B42' },
  bill_request: { label: 'Hisob',      icon: 'ti-receipt',         color: '#34C759' },
  support:      { label: 'Yordam',     icon: 'ti-message',         color: '#8E8E93' },
};

/** Qaysi sahifaga olib borishi. */
function routeFor(n) {
  if (n.refType === 'reservation') return '/reservations';
  if (n.refType === 'table') return '/dine-in-live';
  if (n.type === 'hall_order') return '/dine-in-live';
  return '/orders';
}

const timeOf = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('ru-RU', {
    hour: '2-digit', minute: '2-digit',
  });
};

export function NotificationCenter() {
  const navigate = useNavigate();
  const { items, open, connected, muted, setOpen, patch, toggleMute, hush } =
    useNotifications();

  // Autentifikatsiya tugagach ishga tushadi
  const authStatus = useAuth((s) => s.status);
  useEffect(() => {
    if (authStatus === 'authed') startNotificationCenter();
  }, [authStatus]);

  // Javob berilmaganlar soni
  const pending = items.filter((n) => ['NEW', 'DELIVERED', 'SEEN'].includes(n.status));

  const openItem = (n) => {
    patch(n.notificationId, 'SEEN');
    hush();
    setOpen(false);
    navigate(routeFor(n));
  };

  return (
    <>
      {/* Qo'ng'iroq tugmasi */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed right-4 top-3 z-[60] flex h-10 w-10 items-center justify-center rounded-full bg-sidebar/90 text-brand-100 shadow-lg backdrop-blur lg:right-6 lg:top-4"
        aria-label="Bildirishnomalar"
      >
        <i className="ti ti-bell text-lg" />
        {pending.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {pending.length > 99 ? '99+' : pending.length}
          </span>
        )}
        {/* Ulanish holati */}
        <span
          className={`absolute -bottom-0.5 -left-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar ${
            connected ? 'bg-green-500' : 'bg-red-500'
          }`}
          title={connected ? 'Ulangan' : 'Ulanish yo\u2018q'}
        />
      </button>

      {!open ? null : (
        <div className="fixed inset-0 z-[70] flex justify-end" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          <aside
            onClick={(e) => e.stopPropagation()}
            className="relative flex h-full w-full max-w-[400px] flex-col bg-canvas shadow-2xl"
          >
            <header className="flex flex-none items-center gap-2 border-b border-line px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold text-ink">Bildirishnomalar</div>
                <div className="text-[11.5px] text-muted">
                  {connected ? 'Jonli ulanish' : 'Ulanish tiklanmoqda...'}
                  {pending.length > 0 && ` · ${pending.length} ta javobsiz`}
                </div>
              </div>

              <button
                onClick={toggleMute}
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  muted ? 'bg-red-500/15 text-red-500' : 'bg-black/5 text-muted'
                }`}
                title={muted ? 'Ovoz o\u2018chirilgan' : 'Ovozni o\u2018chirish'}
              >
                <i className={`ti ${muted ? 'ti-volume-off' : 'ti-volume'} text-base`} />
              </button>

              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/5 text-muted"
                aria-label="Yopish"
              >
                <i className="ti ti-x text-base" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
              {items.length === 0 ? (
                <div className="py-16 text-center text-[13px] text-muted">
                  Bildirishnoma yo&apos;q
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((n) => (
                    <NotificationRow
                      key={n.notificationId}
                      n={n}
                      onOpen={() => openItem(n)}
                      onAccept={() => patch(n.notificationId, 'ACCEPTED')}
                      onCancel={() => patch(n.notificationId, 'CANCELLED')}
                      onMute={() => patch(n.notificationId, 'MUTED')}
                    />
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function NotificationRow({ n, onOpen, onAccept, onCancel, onMute }) {
  const meta = TYPE_META[n.type] || TYPE_META.order;
  const done = ['ACCEPTED', 'CANCELLED', 'MUTED'].includes(n.status);

  return (
    <article
      data-nid={n.notificationId}
      data-status={n.status}
      className={`rounded-[14px] border bg-surface p-3 transition-opacity ${
        done ? 'border-line opacity-60' : 'border-line'
      }`}
      style={done ? undefined : { borderColor: `${meta.color}55` }}
    >
      <button onClick={onOpen} className="flex w-full items-start gap-2.5 text-left">
        <span
          className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px]"
          style={{ background: `${meta.color}1F`, color: meta.color }}
        >
          <i className={`ti ${meta.icon} text-base`} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[14px] font-semibold text-ink">{n.title}</span>
            <span className="ml-auto flex-none text-[11px] tabular-nums text-muted">
              {timeOf(n.createdAt)}
            </span>
          </span>
          {n.body && (
            <span className="mt-0.5 block truncate text-[12.5px] text-muted">{n.body}</span>
          )}
        </span>
      </button>

      {!done ? (
        <div className="mt-2.5 flex gap-1.5">
          <button
            onClick={onAccept}
            data-act="accept"
            className="flex-1 rounded-[10px] py-2 text-[12.5px] font-semibold text-white"
            style={{ background: meta.color }}
          >
            Qabul qilish
          </button>
          <button
            onClick={onCancel}
            data-act="cancel"
            className="rounded-[10px] border border-line px-3 py-2 text-[12.5px] text-muted"
          >
            Bekor
          </button>
          <button
            onClick={onMute}
            data-act="mute"
            className="flex w-9 items-center justify-center rounded-[10px] border border-line text-muted"
            title="Ovozni o&apos;chirish"
          >
            <i className="ti ti-volume-off text-sm" />
          </button>
        </div>
      ) : (
        <div className="mt-2 text-[11.5px] text-muted">
          {n.status === 'ACCEPTED' && 'Qabul qilindi'}
          {n.status === 'CANCELLED' && 'Bekor qilindi'}
          {n.status === 'MUTED' && 'Ovozsiz qilindi'}
        </div>
      )}
    </article>
  );
}
