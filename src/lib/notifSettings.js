import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Bildirishnoma sozlamalari.
 *
 * Qurilmaga bog'liq (localStorage): bitta admin uyda telefonda
 * ovozni o'chirib, restoranda kompyuterda yoqib qo'yishi mumkin.
 *
 * Master Sound o'chsa — barcha foreground ovozlar o'chadi.
 * Alohida tur o'chsa — faqat o'sha tur jim bo'ladi.
 */

export const DEFAULTS = {
  masterSound: true,
  volume: 0.8,

  // Har tur uchun alohida
  soundOrders: true,
  soundReservations: true,
  soundHallOrders: true,
  soundWaiterCall: true,
  soundShot: true,

  desktopNotifications: true,   // ilova ochiq — brauzer bildirishnomasi
  pushNotifications: true,      // ilova yopiq — Web Push

  /*
   * Javob berilmagan (ko'rilmagan) bildirishnoma shu oraliqda
   * QAYTA-QAYTA eslatiladi — telefon jiringlagani kabi, admin
   * ko'rib ulgurmasa ovoz o'zi to'xtamaydi. 0 — takrorlamaslik.
   */
  repeatInterval: 8,
};

/** Bildirishnoma turi → qaysi sozlama uni boshqaradi. */
const TYPE_SETTING = {
  order: 'soundOrders',
  hall_order: 'soundHallOrders',
  reservation: 'soundReservations',
  waiter_call: 'soundWaiterCall',
  bill_request: 'soundWaiterCall',
  support: 'soundShot',
};

export const useNotifSettings = create(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (patch) => set(patch),
      reset: () => set({ ...DEFAULTS }),
    }),
    { name: 'lokmago_notif_settings' },
  ),
);

/** Shu tur uchun ovoz chalinadimi. */
export function soundAllowed(type) {
  const s = useNotifSettings.getState();
  if (!s.masterSound) return false;
  const key = TYPE_SETTING[type];
  return key ? s[key] !== false : true;
}

export function currentVolume() {
  const v = useNotifSettings.getState().volume;
  return Math.min(1, Math.max(0, Number(v) || 0));
}
