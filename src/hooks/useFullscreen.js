import { useSyncExternalStore, useCallback, useEffect } from 'react';

/**
 * Fullscreen (to'liq ekran) boshqaruvi.
 *
 * Ikki narsa bir vaqtda o'zgaradi:
 *  1. Brauzerning haqiqiy fullscreen rejimi (Fullscreen API)
 *  2. Panel ko'rinishi — sidebar yashiriladi, sahifa butun ekranni oladi
 *
 * MUHIM cheklov: brauzer fullscreen'ni faqat foydalanuvchi harakati
 * (klik/tugma) bilan yoqishga ruxsat beradi. Shuning uchun sahifa
 * yangilangandan keyin uni AVTOMATIK tiklab bo'lmaydi.
 * Yechim: rejim localStorage'da saqlanadi — yangilangach panel
 * ko'rinishi darhol tiklanadi, haqiqiy fullscreen esa foydalanuvchining
 * birinchi harakatida qayta yoqiladi.
 */

const KEY = 'lokmago-fullscreen';

/* ─── Kichik store: bir nechta komponent bitta holatni ko'radi ─── */
const listeners = new Set();
let state = { active: readSaved(), native: false };

function readSaved() {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

function save(v) {
  try {
    if (v) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch { /* private rejim — saqlanmasa ham ishlayveradi */ }
}

function setState(patch) {
  const next = { ...state, ...patch };
  if (next.active === state.active && next.native === state.native) return;
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const getSnapshot = () => state;

/* ─── Fullscreen API — brauzerlar bo'yicha ─── */
function isNativeOn() {
  return Boolean(
    document.fullscreenElement || document.webkitFullscreenElement,
  );
}

async function enterNative() {
  const el = document.documentElement;
  const fn = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!fn) return false;
  try {
    await fn.call(el);
    return true;
  } catch {
    // Brauzer rad etdi (masalan, foydalanuvchi harakatisiz chaqirilgan)
    return false;
  }
}

async function exitNative() {
  if (!isNativeOn()) return;
  const fn = document.exitFullscreen || document.webkitExitFullscreen;
  if (!fn) return;
  try { await fn.call(document); } catch { /* ignore */ }
}

/* ─── Brauzer holatini kuzatish ───
   ESC bosilsa yoki foydalanuvchi boshqa yo'l bilan chiqsa —
   panel ko'rinishi ham normal holatga qaytadi. */
let bound = false;
function bindOnce() {
  if (bound || typeof document === 'undefined') return;
  bound = true;

  const onChange = () => {
    const native = isNativeOn();
    if (!native && state.active) {
      // ESC yoki brauzer tugmasi orqali chiqildi
      save(false);
      setState({ native: false, active: false });
      return;
    }
    // MUHIM: `active` (sidebar yashirish) faqat tugma orqali
    // yoqiladi. Mobilda fullscreen avtomatik yoqiladi, lekin
    // menyular ko'rinib turishi kerak.
    setState({ native });
  };

  document.addEventListener('fullscreenchange', onChange);
  document.addEventListener('webkitfullscreenchange', onChange);

  // Sahifa yangilangach: rejim yoqilgan bo'lsa, foydalanuvchining
  // birinchi bosishida haqiqiy fullscreen qaytariladi.
  // (Brauzer buni faqat foydalanuvchi harakati bilan ruxsat etadi.)
  if (state.active && !isNativeOn()) {
    const cleanup = () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };

    const onPointer = async () => {
      if (!state.active) return cleanup();
      if (await enterNative()) cleanup();
    };

    // ESC — chiqish tugmasi. Uni tiklash uchun ishlatib bo'lmaydi,
    // aks holda foydalanuvchi rejimdan chiqa olmay qoladi.
    const onKey = async (e) => {
      if (e.key === 'Escape') {
        save(false);
        setState({ active: false, native: false });
        return cleanup();
      }
      if (!state.active) return cleanup();
      if (await enterNative()) cleanup();
    };

    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
  }
}

export function useFullscreen() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => { bindOnce(); }, []);

  const toggle = useCallback(async () => {
    if (state.active) {
      save(false);
      setState({ active: false });
      await exitNative();
      return;
    }
    save(true);
    setState({ active: true });
    await enterNative();
  }, []);

  return { active: snap.active, native: snap.native, toggle };
}


/* ═══════════════════════════════════════════
   Ekran o'lchami
   ═══════════════════════════════════════════ */

const MOBILE_Q = '(max-width: 1023px)';

function subscribeMobile(cb) {
  const mq = window.matchMedia(MOBILE_Q);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

const getMobile = () => window.matchMedia(MOBILE_Q).matches;

/** lg dan kichik ekran — sidebar o'rniga pastki menyu chiziladi. */
export function useIsMobile() {
  return useSyncExternalStore(subscribeMobile, getMobile, () => false);
}

/* ═══════════════════════════════════════════
   Mobilda avtomatik to'liq ekran
   ═══════════════════════════════════════════ */

const OPT_OUT = 'lokmago-fs-off';

/**
 * Telefonda brauzer paneli joy egallaydi va aylantirganda
 * paydo bo'lib-yo'qoladi — panel "sakraydi". Shuning uchun
 * fullscreen avtomatik yoqiladi.
 *
 * Brauzer buni faqat foydalanuvchi harakatidan keyin beradi,
 * shuning uchun sahifa ochilishida emas, birinchi tegishda.
 * Sidebar yashirilmaydi — menyular joyida qoladi.
 *
 * iOS Safari'da Fullscreen API yo'q; u yerda hech narsa
 * o'zgarmaydi va ilova oddiy holicha ishlaydi.
 */
export function useAutoFullscreenOnMobile() {
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isMobile) return;
    const el = document.documentElement;
    if (!(el.requestFullscreen || el.webkitRequestFullscreen)) return;

    const onTap = async () => {
      if (sessionStorage.getItem(OPT_OUT)) return;
      if (isNativeOn()) return;
      await enterNative();
    };

    // Har tegishda tekshiriladi: ESC yoki sahifa almashuvida
    // rejim tushib qolsa, keyingi tegishda qaytadi
    document.addEventListener('pointerdown', onTap);
    return () => document.removeEventListener('pointerdown', onTap);
  }, [isMobile]);
}
