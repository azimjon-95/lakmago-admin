import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useNotifications, startNotificationCenter } from '@/lib/notificationCenter';
import { useAuth } from '@/store/auth';
import { useNotifSettings } from '@/lib/notifSettings';
import { applyVolume } from '@/lib/soundQueue';
import { subscribePush, unsubscribePush, pushSupported } from '@/lib/push';

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

/**
 * Qaysi sahifaga olib borishi.
 *
 * MUHIM: restoran paneli marshrutida buyurtmalar '/orders'
 * emas — TUBIDA ('/') joylashgan (App.jsx: RestaurantRoutes).
 * '/orders' faqat admin monitoringida bor. Avval bu xato
 * tufayli 'Qabul qilish' bosilganda mavjud bo'lmagan sahifaga
 * yo'naltirilardi (amaldagi natija: catch-all qoida uni "/"
 * ga qaytarardi — tasodifan ishlab turgan, ataylab emas).
 */
function routeFor(n) {
  if (n.refType === 'reservation') return '/reservations';
  if (n.refType === 'table') return '/dine-in-live';
  if (n.type === 'hall_order') return '/dine-in-live';
  return '/';
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
  const [settingsOpen, setSettingsOpen] = useState(false);

  /*
   * Bildirishnoma markazi FAQAT restoran panelida ishlaydi.
   *
   * Super admin uchun umuman ishga tushmaydi: unga zал
   * chaqiruvlari va buyurtma signallari kerak emas, ovoz esa
   * xalaqit beradi. Admin barcha ma'lumotni Boshqaruv
   * sahifasidan ko'radi.
   */
  const authStatus = useAuth((s) => s.status);
  const role = useAuth((s) => s.user?.role);
  const enabled = authStatus === 'authed' && role === 'restaurant';

  useEffect(() => {
    if (enabled) startNotificationCenter();
  }, [enabled]);

  // Javob berilmaganlar soni
  const pending = items.filter((n) => ['NEW', 'DELIVERED', 'SEEN'].includes(n.status));

  const openItem = (n) => {
    patch(n.notificationId, 'SEEN');
    hush();
    setOpen(false);
    navigate(routeFor(n));
  };

  // Adminda hech narsa chizilmaydi va ovoz chalinmaydi
  if (!enabled) return null;

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
          title={connected ? 'Ulangan' : 'Ulanish yo‘q'}
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
                onClick={() => setSettingsOpen((v) => !v)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  settingsOpen ? 'bg-brand-400/20 text-brand-600' : 'bg-black/5 text-muted'
                }`}
                title="Sozlamalar"
              >
                <i className="ti ti-settings text-base" />
              </button>

              <button
                onClick={toggleMute}
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  muted ? 'bg-red-500/15 text-red-500' : 'bg-black/5 text-muted'
                }`}
                title={muted ? 'Ovoz o‘chirilgan' : 'Ovozni o‘chirish'}
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

            {settingsOpen && <SettingsPanel />}

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
                      /*
                        "Qabul qilish" endi shu yerda hal
                        qilmaydi — haqiqiy sahifaga olib boradi
                        (masalan Buyurtmalar yoki Dine-in).
                        Bildirishnoma o'sha sahifada real amal
                        bajarilganda (resolveNotification orqali)
                        avtomatik yopiladi va ovoz to'xtaydi.
                      */
                      onOpen={() => openItem(n)}
                      onAccept={() => openItem(n)}
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

/**
 * Bildirishnoma sozlamalari.
 *
 * Qurilmaga bog'liq: bitta admin telefonda ovozni o'chirib,
 * kompyuterda yoqib qo'yishi mumkin.
 */
function SettingsPanel() {
  const s = useNotifSettings();
  const [pushState, setPushState] = useState('');

  const toggle = (key) => () => s.set({ [key]: !s[key] });

  const onVolume = (e) => {
    s.set({ volume: Number(e.target.value) });
    applyVolume();
  };

  const onPushToggle = async () => {
    const next = !s.pushNotifications;
    s.set({ pushNotifications: next });
    if (next) {
      const r = await subscribePush();
      setPushState(
        r === 'ok' ? 'Yoqildi'
          : r === 'denied' ? 'Brauzer ruxsat bermadi'
            : r === 'unsupported' ? 'Bu brauzer qo‘llamaydi'
              : 'Xatolik',
      );
    } else {
      await unsubscribePush();
      setPushState('');
    }
  };

  const rows = [
    ['soundOrders', 'Buyurtma ovozi'],
    ['soundHallOrders', 'Zal buyurtmasi ovozi'],
    ['soundReservations', 'Bron ovozi'],
    ['soundWaiterCall', 'Ofitsiant chaqiruvi ovozi'],
    ['soundShot', 'Yordam so‘rovi ovozi'],
  ];

  return (
    <div className="flex-none border-b border-line bg-surface px-4 py-3">
      <Toggle label="Ovoz (asosiy)" on={s.masterSound} onClick={toggle('masterSound')} />

      <div className="my-2.5 flex items-center gap-3">
        <span className="text-[12.5px] text-muted">Balandlik</span>
        <input
          type="range" min="0" max="1" step="0.05"
          value={s.volume} onChange={onVolume}
          className="flex-1 accent-brand-400"
          disabled={!s.masterSound}
        />
        <span className="w-8 text-right text-[12px] tabular-nums text-muted">
          {Math.round(s.volume * 100)}%
        </span>
      </div>

      <div className={s.masterSound ? '' : 'pointer-events-none opacity-40'}>
        {rows.map(([key, label]) => (
          <Toggle key={key} label={label} on={s[key]} onClick={toggle(key)} small />
        ))}
      </div>

      <div className="my-2 h-px bg-line" />

      <Toggle
        label="Brauzer bildirishnomasi"
        on={s.desktopNotifications}
        onClick={toggle('desktopNotifications')}
        small
      />
      <Toggle
        label={`Push (ilova yopiq bo‘lganda)${pushState ? ` — ${pushState}` : ''}`}
        on={s.pushNotifications}
        onClick={onPushToggle}
        small
        disabled={!pushSupported()}
      />

      <div className="mt-2 flex items-center gap-3">
        <span className="text-[12.5px] text-muted">Muhimlarini takrorlash</span>
        <select
          value={s.repeatInterval}
          onChange={(e) => s.set({ repeatInterval: Number(e.target.value) })}
          className="ml-auto rounded-lg border border-line bg-canvas px-2 py-1 text-[12.5px]"
        >
          <option value={0}>O&apos;chiq</option>
          <option value={15}>15 soniya</option>
          <option value={30}>30 soniya</option>
          <option value={60}>1 daqiqa</option>
        </select>
      </div>
    </div>
  );
}

function Toggle({ label, on, onClick, small, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center justify-between gap-3 py-1.5 text-left ${
        disabled ? 'opacity-40' : ''
      }`}
    >
      <span className={`${small ? 'text-[12.5px]' : 'text-[13.5px] font-medium'} text-ink`}>
        {label}
      </span>
      <span
        className="relative h-[22px] w-[38px] flex-none rounded-full transition-colors"
        style={{ background: on ? '#34C759' : 'rgba(120,120,128,0.28)' }}
      >
        <span
          className="absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-transform"
          style={{ left: 2, transform: `translateX(${on ? 16 : 0}px)` }}
        />
      </span>
    </button>
  );
}
