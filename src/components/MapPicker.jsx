import { useEffect, useRef, useState } from 'react';
import { useLockScroll } from '@/hooks/useLockScroll';

/**
 * Yandex xaritada joylashuv tanlash.
 *
 * Xarita bosilganda nuqta qo'yiladi va manzil avtomatik aniqlanadi
 * (teskari geokodlash). Kalitsiz ishlaydi — Yandex ochiq API.
 */

// Toshkent markazi — boshlang'ich nuqta
const DEFAULT_CENTER = [41.311081, 69.240562];

let scriptPromise = null;

function loadYandexMaps() {
  if (window.ymaps?.ready) return Promise.resolve(window.ymaps);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    // lang=uz_UZ — manzillar o'zbekcha keladi
    script.src = 'https://api-maps.yandex.ru/2.1/?lang=ru_RU';
    script.async = true;
    script.onload = () => window.ymaps.ready(() => resolve(window.ymaps));
    script.onerror = () => reject(new Error('Xarita yuklanmadi'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function MapPicker({ lat, lng, address, onPick, onClose }) {
  useLockScroll();

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const placemarkRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [picked, setPicked] = useState(
    lat && lng ? { lat: Number(lat), lng: Number(lng), address: address || '' } : null,
  );
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadYandexMaps()
      .then((ymaps) => {
        if (cancelled || !containerRef.current) return;

        const center = picked ? [picked.lat, picked.lng] : DEFAULT_CENTER;

        const map = new ymaps.Map(containerRef.current, {
          center,
          zoom: picked ? 17 : 12,
          controls: ['zoomControl', 'geolocationControl', 'searchControl'],
        });
        mapRef.current = map;

        // Mavjud nuqta bo'lsa ko'rsatamiz
        if (picked) {
          const pm = new ymaps.Placemark(center, {}, {
            preset: 'islands#redDotIcon',
            draggable: true,
          });
          map.geoObjects.add(pm);
          placemarkRef.current = pm;
          pm.events.add('dragend', () => {
            const c = pm.geometry.getCoordinates();
            selectPoint(c, ymaps);
          });
        }

        // Xarita bosilganda nuqta qo'yamiz
        map.events.add('click', (e) => {
          selectPoint(e.get('coords'), ymaps);
        });

        setLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      mapRef.current?.destroy?.();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nuqta tanlash + manzilni aniqlash
  const selectPoint = async (coords, ymaps) => {
    const [la, ln] = coords;

    // Belgini ko'chiramiz yoki yaratamiz
    if (placemarkRef.current) {
      placemarkRef.current.geometry.setCoordinates(coords);
    } else {
      const pm = new ymaps.Placemark(coords, {}, {
        preset: 'islands#redDotIcon',
        draggable: true,
      });
      mapRef.current.geoObjects.add(pm);
      placemarkRef.current = pm;
      pm.events.add('dragend', () => {
        selectPoint(pm.geometry.getCoordinates(), ymaps);
      });
    }

    setPicked({ lat: la, lng: ln, address: '' });
    setResolving(true);

    // Teskari geokodlash — koordinatadan manzil
    try {
      const res = await ymaps.geocode(coords, { results: 1 });
      const obj = res.geoObjects.get(0);
      const addr = obj?.getAddressLine?.() || '';
      setPicked({ lat: la, lng: ln, address: addr });
    } catch {
      // Manzil aniqlanmasa ham koordinata qoladi
    } finally {
      setResolving(false);
    }
  };

  const confirm = () => {
    if (!picked) return;
    onPick({
      lat: Number(picked.lat.toFixed(6)),
      lng: Number(picked.lng.toFixed(6)),
      address: picked.address,
    });
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-2xl rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col
                   max-h-[92dvh] sm:max-h-[88dvh]"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-line flex-none">
          <div>
            <h3 className="font-semibold text-ink">Joylashuvni tanlang</h3>
            <p className="text-xs text-muted mt-0.5">
              Binoni xaritada bosing yoki belgini suring
            </p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink p-1">
            <i className="ti ti-x text-xl" />
          </button>
        </div>

        <div className="relative flex-1 min-h-[320px]">
          <div ref={containerRef} className="absolute inset-0" />

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-canvas">
              <div className="text-muted text-sm">Xarita yuklanmoqda...</div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-canvas p-6">
              <div className="text-center">
                <i className="ti ti-map-off text-3xl text-muted mb-2 block" />
                <div className="text-sm text-ink font-medium">{error}</div>
                <p className="text-xs text-muted mt-1">
                  Internet aloqasini tekshiring
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-line flex-none">
          {picked ? (
            <div className="mb-3">
              <div className="text-sm text-ink break-words">
                {resolving ? (
                  <span className="text-muted">Manzil aniqlanmoqda...</span>
                ) : (
                  picked.address || 'Manzil aniqlanmadi'
                )}
              </div>
              <div className="text-[11px] text-muted mt-0.5 font-mono">
                {picked.lat.toFixed(6)}, {picked.lng.toFixed(6)}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted mb-3">
              Xaritada binoni bosing
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 border border-line text-muted py-2.5 rounded-xl hover:bg-canvas"
            >
              Bekor
            </button>
            <button
              onClick={confirm}
              disabled={!picked}
              className="flex-[1.5] bg-brand-400 text-brand-text font-medium py-2.5 rounded-xl disabled:opacity-50"
            >
              Tanlash
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
