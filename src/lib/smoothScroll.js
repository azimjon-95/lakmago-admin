/*
 * Yumshoq "tepaga" skroll. Brauzerning `behavior: 'smooth'` iga tayanmaymiz: Safari/Chrome'da uzun ro'yxatda davomiyligi
 * va silliqligi har xil. O'zimizning rAF animatsiya: masofaga mos davomiylik + easeInOutCubic.
 */
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);

/** Masofa (px) → davomiylik (ms): yaqin joy tez (~450), uzoq joy sekinroq, lekin 1.1 s dan oshmaydi. */
export const scrollDuration = (distance) => Math.round(Math.min(1100, Math.max(450, 350 + Math.sqrt(Math.max(0, distance)) * 9)));

/**
 * Haqiqiy skroll qiluvchi element: eng yaqin overflow-y: auto|scroll ota (mobilda admin `<main>` ichida skroll qiladi),
 * bo'lmasa sahifaning o'zi (kompyuterda `main` overflow-visible).
 */
export function findScrollParent(el) {
  for (let n = el?.parentElement; n && n !== document.body; n = n.parentElement) {
    const o = getComputedStyle(n).overflowY;
    if (o === 'auto' || o === 'scroll') return n;
  }
  return document.scrollingElement || document.documentElement;
}

/** Skroll hodisasi tinglanadigan obyekt (sahifa uchun window). */
export const scrollEventTarget = (el) => (el === document.scrollingElement || el === document.documentElement ? window : el);

/**
 * el ni yuqoriga yumshoq suradi. Foydalanuvchi barmoq/g'ildirak/klaviatura bilan aralashsa — to'xtaydi (u bilan "kurashmaydi").
 * reduced (prefers-reduced-motion) — animatsiyasiz, darhol. Qaytaradi: { cancel, done: Promise }.
 */
export function smoothScrollToTop(el, { reduced = false, duration } = {}) {
  const start = el.scrollTop;
  const noop = { cancel() {}, done: Promise.resolve() };
  if (!(start > 0)) return noop;
  if (reduced) { el.scrollTop = 0; return noop; }

  const dur = duration ?? scrollDuration(start);
  const prevBehavior = el.style.scrollBehavior;
  el.style.scrollBehavior = 'auto';                       // CSS smooth bo'lsa har qadam yana animatsiyalanib, qotib qolmasin
  const target = scrollEventTarget(el);
  const events = ['wheel', 'touchstart', 'mousedown', 'keydown'];
  let raf = 0; let finished = false; let resolveDone;
  const finish = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    events.forEach((ev) => target.removeEventListener(ev, finish));
    el.style.scrollBehavior = prevBehavior;
    resolveDone();
  };
  const done = new Promise((r) => { resolveDone = r; });
  events.forEach((ev) => target.addEventListener(ev, finish, { passive: true }));
  const t0 = performance.now();
  const step = (now) => {
    if (finished) return;
    const p = Math.min(1, (now - t0) / dur);
    el.scrollTop = start * (1 - easeInOutCubic(p));
    if (p < 1) raf = requestAnimationFrame(step); else finish();
  };
  raf = requestAnimationFrame(step);
  return { cancel: finish, done };
}
