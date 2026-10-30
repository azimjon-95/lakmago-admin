/*
 * ═══ GOOGLE MAPS (admin paneli) ═══
 * Maps JavaScript API — faqat joylashuv tanlash xaritasi (MapPicker). Manzil qidirish va aniqlash SERVER orqali
 * (/api/maps/geocode, /api/maps/reverse) — Geocoding kaliti brauzerga chiqmaydi.
 *
 * BRAUZER kaliti (HTTP referrer bo'yicha cheklangan, faqat Maps JavaScript API): build vaqtida VITE_GOOGLE_MAPS_KEY
 * yoki serverning GET /maps/config javobi (provider: 'google', GOOGLE_MAPS_BROWSER_KEY).
 */
const ENV_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || '';
const LOAD_TIMEOUT_MS = 15000;
let loading = null;
let authFailed = false;

export function googleKeyFrom(cfg) {
  if (ENV_KEY) return ENV_KEY;
  return cfg?.provider === 'google' && cfg?.enabled && cfg?.mapsKey ? cfg.mapsKey : '';
}

export const ll = (p) => ({ lat: p[0], lng: p[1] });

export function loadGoogleMaps(apiKey) {
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
  if (authFailed) return Promise.reject(new Error('Google Maps kaliti ruxsat bermadi'));
  if (!apiKey) return Promise.reject(new Error('Google Maps API kaliti mavjud emas'));
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    let done = false;
    let script = null;
    const fail = (msg) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      loading = null;
      script?.remove();
      reject(new Error(msg));
    };
    const timer = setTimeout(() => fail('Xarita yuklanishi uchun ajratilgan vaqt tugadi'), LOAD_TIMEOUT_MS);
    window.gm_authFailure = () => { authFailed = true; fail('Google Maps kaliti ruxsat bermadi (kalit yoki domen cheklovini tekshiring)'); };
    window.__lokmaGmapsReady = async () => {
      try {
        await window.google.maps.importLibrary('maps');
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(window.google.maps);
      } catch { fail('Google xaritasini ishga tushirib bo‘lmadi'); }
    };
    script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&language=uz&region=UZ&callback=__lokmaGmapsReady`;
    script.onerror = () => fail('Xaritaga ulanib bo‘lmadi');
    document.head.appendChild(script);
  });
  return loading;
}
