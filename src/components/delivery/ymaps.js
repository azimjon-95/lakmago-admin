import { adminApi } from '@/api';

/*
 * Yandex xaritani BIR MARTA yuklash (kalit serverdan — /api/maps/config). MapPicker bilan bir xil manba: ikkinchi <script>
 * qo'shilmaydi (window.ymaps bor bo'lsa shuni ishlatadi).
 */
let promise = null;

export function loadYmaps() {
  if (typeof window !== 'undefined' && window.ymaps?.Map) return Promise.resolve(window.ymaps);
  if (promise) return promise;
  promise = adminApi.getMapsConfig().then((cfg) => {
    if (!cfg?.enabled || !cfg?.mapsKey) throw new Error('Xarita sozlanmagan');
    return new Promise((resolve, reject) => {
      if (window.ymaps?.Map) return resolve(window.ymaps);
      const script = document.createElement('script');
      script.src = `https://api-maps.yandex.ru/2.1/?apikey=${cfg.mapsKey}&lang=ru_RU`;
      script.async = true;
      script.onload = () => (window.ymaps ? window.ymaps.ready(() => resolve(window.ymaps)) : reject(new Error('Xarita yuklanmadi')));
      script.onerror = () => reject(new Error('Xaritaga ulanib bo‘lmadi'));
      document.head.appendChild(script);
    });
  }).catch((e) => { promise = null; throw e; });
  return promise;
}
