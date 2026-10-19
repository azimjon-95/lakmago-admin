/*
 * Faol tarmoq so'rovlari hisoblagichi (resilientFetch ichida yuritiladi).
 * "Tortib yangilash" animatsiyasi shu bilan HAQIQIY yuklanish tugaguncha turadi: so'rovlar ketayotgan
 * bo'lsa — "Yangilanmoqda", hammasi tugasa — "Yangilandi".
 */
let inflight = 0;
let failures = 0; // tarmoq xatosi yoki server xatosi (5xx) bilan tugagan so'rovlar soni
const listeners = new Set();

export const netBegin = () => { inflight += 1; };
export const netFailed = () => failures;
export const netEnd = (ok = true) => {
  if (!ok) failures += 1;
  inflight = Math.max(0, inflight - 1);
  if (inflight === 0) listeners.forEach((f) => f());
};
export const netInflight = () => inflight;

/**
 * Tarmoq `grace` ms davomida bo'sh turganda yoki `timeout` o'tganda hal bo'ladi (hech qachon osilib qolmaydi).
 */
export function whenIdle({ grace = 300, timeout = 9000 } = {}) {
  return new Promise((resolve) => {
    let timer = null;
    let hard = null;
    const done = () => { clearTimeout(timer); clearTimeout(hard); listeners.delete(check); resolve(); };
    function check() {
      clearTimeout(timer);
      if (inflight === 0) timer = setTimeout(() => { if (inflight === 0) done(); }, grace);
    }
    hard = setTimeout(done, timeout);
    listeners.add(check);
    check();
  });
}
