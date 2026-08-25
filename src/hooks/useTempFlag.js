import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Vaqtinchalik belgi — "Saqlandi", "Nusxalandi" kabi.
 *
 * NIMANI TUZATADI:
 *
 * 1) Taymer tozalanmasdi.
 *    `setSaved(true); setTimeout(() => setSaved(false), 2500)`
 *    naqshi kodda 16 joyda takrorlangan. Komponent shu 2.5
 *    soniya ichida yopilsa, taymer yopilish paytigacha
 *    yashab qolardi.
 *
 * 2) MUHIMROG'I — ketma-ket bosishda xato.
 *    "Saqlash" ni 2.5 soniya ichida IKKI marta bossangiz,
 *    ikkita taymer ishga tushardi. Birinchisi ikkinchi
 *    saqlashdan keyin ham chalinib, "Saqlandi" belgisini
 *    ERTA o'chirib qo'yardi — foydalanuvchi saqlanganini
 *    ko'rmay qolardi.
 *
 * Endi har chaqiruv oldingi taymerni bekor qiladi.
 *
 * Ishlatish:
 *   const [saved, flashSaved] = useTempFlag();
 *   ...
 *   flashSaved();          // 2.5 soniya "true" bo'lib turadi
 *   {saved && <span>Saqlandi</span>}
 */
export function useTempFlag(duration = 2500) {
  const [on, setOn] = useState(false);
  const timer = useRef(null);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const flash = useCallback(() => {
    clear();                       // oldingi taymer bekor
    setOn(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setOn(false);
    }, duration);
  }, [duration, clear]);

  // Komponent yopilganda taymer qolmaydi
  useEffect(() => clear, [clear]);

  return [on, flash, clear];
}

/**
 * Vaqtinchalik qiymat — "qaysi element yonib turibdi".
 *
 * Yangi buyurtma kartasini yoritish uchun: flash(order._id)
 * bir necha soniya davomida shu id ni qaytaradi, so'ng null.
 *
 * Ketma-ket ikkita buyurtma kelsa ikkinchisi birinchisining
 * taymerini bekor qiladi — ilgari birinchi taymer ikkinchi
 * kartaning yoritishini o'chirib yuborardi.
 */
export function useTempValue(duration = 5000) {
  const [value, setValue] = useState(null);
  const timer = useRef(null);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const flash = useCallback((v) => {
    clear();
    setValue(v);
    timer.current = setTimeout(() => {
      timer.current = null;
      setValue(null);
    }, duration);
  }, [duration, clear]);

  /*
   * DOIMIY o'rnatish — o'zi yo'qolmaydi.
   * Xato xabarlari uchun: foydalanuvchi nima bo'lganini
   * o'qib ulgurishi kerak, 2 soniyada yo'qolib ketmasin.
   */
  const set = useCallback((v) => {
    clear();
    setValue(v);
  }, [clear]);

  useEffect(() => clear, [clear]);

  return [value, flash, set];
}
