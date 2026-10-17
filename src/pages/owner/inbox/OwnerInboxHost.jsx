import { useEffect } from 'react';
import { useOwnerInbox } from '@/store/ownerInbox';
import { BookingSheet } from './BookingSheet';

/*
 * To'yxona egasi paneli bo'ylab bir marta o'rnatiladi:
 *   • polling'ni ishga tushiradi (yangi so'rov → ovoz, toast, tab belgisi);
 *   • toast bosilsa yoki istalgan joydan openBooking(id) chaqirilsa — bron kartasi ochiladi
 *     (kalendar, ro'yxat, bildirishnoma — hammasi bitta joydan).
 */
export function OwnerInboxHost() {
  const start = useOwnerInbox((s) => s.start);
  const stop = useOwnerInbox((s) => s.stop);
  const toast = useOwnerInbox((s) => s.toast);
  const openId = useOwnerInbox((s) => s.openId);
  const openBooking = useOwnerInbox((s) => s.openBooking);
  const closeBooking = useOwnerInbox((s) => s.closeBooking);
  const dismiss = useOwnerInbox((s) => s.dismissToast);

  useEffect(() => { start(); return stop; }, [start, stop]);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(dismiss, 14_000);
    return () => clearTimeout(t);
  }, [toast, dismiss]);

  return (
    <>
      {toast && (
        <div className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[70] mx-auto max-w-md" role="alert">
          <div className="flex items-start gap-3 rounded-2xl bg-ink px-4 py-3 text-white shadow-2xl">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-amber-400 text-lg text-ink"><i className="ti ti-bell-ringing" /></span>
            <button className="min-w-0 flex-1 text-left" onClick={() => (toast.booking_id ? openBooking(toast.booking_id) : dismiss())}>
              <div className="text-sm font-semibold">{toast.title}</div>
              <div className="truncate text-xs text-white/70">{toast.body}</div>
              <div className="mt-1 text-xs font-semibold text-amber-300">Ko'rish →</div>
            </button>
            <button onClick={dismiss} aria-label="Yopish" className="text-white/60"><i className="ti ti-x" /></button>
          </div>
        </div>
      )}
      {openId && <BookingSheet id={openId} onClose={closeBooking} />}
    </>
  );
}
