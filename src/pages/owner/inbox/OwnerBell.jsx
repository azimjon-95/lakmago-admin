import { useEffect, useState } from 'react';
import { ownerApi } from '@/api';
import { Modal, Empty } from '@/pages/wedding/common';
import { useOwnerInbox } from '@/store/ownerInbox';
import { ago } from './helpers';

/* Qo'ng'iroqcha: o'qilmagan bildirishnomalar soni; bosilsa — ro'yxat, elementga bosilsa shu bron ochiladi */
const ICON = { booking_new: ['ti-bell-ringing', 'bg-amber-50 text-amber-600'], booking_unanswered: ['ti-hourglass', 'bg-red-50 text-red-600'], booking_expired: ['ti-clock-off', 'bg-gray-100 text-gray-600'] };

export function OwnerBell({ dark = false }) {
  const unread = useOwnerInbox((s) => s.summary.unread);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Bildirishnomalar" className={`relative flex h-9 w-9 flex-none items-center justify-center rounded-full active:scale-90 ${dark ? 'bg-white/10 text-white' : 'border border-line bg-surface text-ink'}`}>
        <i className="ti ti-bell text-lg" />
        {unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && <NotificationsModal onClose={() => setOpen(false)} />}
    </>
  );
}

function NotificationsModal({ onClose }) {
  const openBooking = useOwnerInbox((s) => s.openBooking);
  const touch = useOwnerInbox((s) => s.touch);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { ownerApi.notifications().then(setData).catch((e) => setErr(e.message)); }, []);

  const readAll = async () => { await ownerApi.readNotifications().catch(() => {}); setData((d) => d && { ...d, unread: 0, items: d.items.map((n) => ({ ...n, read: true })) }); touch(); };
  const pick = async (n) => {
    if (!n.read) ownerApi.readNotifications([n.id]).then(touch).catch(() => {});
    onClose();
    if (n.booking_id) openBooking(n.booking_id);
  };

  return (
    <Modal title="Bildirishnomalar" onClose={onClose} footer={data?.unread > 0 && <button onClick={readAll} className="flex-1 rounded-xl border border-line py-2.5 text-sm font-medium text-ink">Hammasini o'qilgan deb belgilash</button>}>
      {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      {!data && !err && <div className="py-8 text-center text-sm text-muted">Yuklanmoqda...</div>}
      {data && data.items.length === 0 && <Empty icon="ti-bell-off">Bildirishnoma yo'q</Empty>}
      {data && data.items.length > 0 && (
        <ul className="-mx-2 divide-y divide-line">
          {data.items.map((n) => {
            const [icon, cls] = ICON[n.kind] || ICON.booking_new;
            return (
              <li key={n.id}>
                <button onClick={() => pick(n)} className="flex w-full items-start gap-3 px-2 py-3 text-left active:bg-canvas">
                  <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-full text-lg ${cls}`}><i className={`ti ${icon}`} /></span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${n.read ? 'text-muted' : 'font-semibold text-ink'}`}>{n.title}</span>
                    <span className="block truncate text-xs text-muted">{n.body}</span>
                    <span className="text-[11px] text-muted">{ago(n.at)}</span>
                  </span>
                  {!n.read && <span className="mt-2 h-2 w-2 flex-none rounded-full bg-red-500" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
