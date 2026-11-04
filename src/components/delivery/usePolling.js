import { useEffect, useRef } from 'react';

/**
 * Davriy yangilash: sahifa ko'rinib turgandagina ishlaydi (fon tabda/qulflangan telefonda so'rov yubormaydi — batareya va server),
 * qaytib kelganda darhol yangilaydi. `fn` har render yangilansa ham interval qayta o'rnatilmaydi (ref orqali).
 */
export function usePolling(fn, ms, { immediate = true } = {}) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    let timer = null;
    const run = () => { if (!document.hidden) ref.current(); };
    const start = () => { stop(); timer = setInterval(run, ms); };
    const stop = () => { if (timer) clearInterval(timer); timer = null; };
    const onVis = () => { if (document.hidden) stop(); else { ref.current(); start(); } };
    if (immediate) ref.current();
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, [ms, immediate]);
}
