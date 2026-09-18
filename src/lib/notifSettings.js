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
  /*
   * ═══ OVOZ STANDART HOLATDA O'CHIRILGAN ═══
   *
   * Restoran panelga kirganda hech qanday ovoz chalinmasligi
   * kerak — kutilmagan musiqa foydalanuvchini cho'chitadi va
   * ish joyida noqulay. Ovozni restoranning O'ZI dinamik
   * tugmasidan yoqadi, shundan keyingina chalinadi.
   *
   * Tanlov qurilmada saqlanadi: bir marta yoqilsa, keyingi
   * kirishlarda ham yoqiq qoladi.
   */
  masterSound: false,
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
    {
      name: 'lokmago_notif_settings',
      /*
       * Versiya 2: ovoz standart holatda O'CHIRILDI.
       *
       * Migratsiya kerak, chunki avvalgi versiyada `masterSound`
       * standart `true` edi va u har bir qurilmada allaqachon
       * saqlanib qolgan. Versiyasiz eski qurilmalarda ovoz
       * yoqiq qolaverardi va "hamma restoranda jim bo'lsin"
       * talabi bajarilmasdi.
       *
       * Ataylab bir martalik majburiy o'chirish: kim ovozni
       * xohlasa, dinamik tugmasidan qayta yoqadi.
       */
      version: 2,
      migrate: (state, from) => {
        if (from < 2) return { ...state, masterSound: false };
        return state;
      },
    },
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
