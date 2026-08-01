import { useEffect, useRef, useState } from 'react';
import { useLockScroll } from '@/hooks/useLockScroll';
import { adminApi } from '@/api';

/**
 * Yandex xaritada joylashuv tanlash.
 *
 * API kaliti serverdan olinadi (/api/maps/config) — kodda
 * saqlanmaydi. Manzil qidirish va aniqlash ham server orqali
 * ketadi, shunda geocoder kaliti brauzerga chiqmaydi.
 */

const DEFAULT_CENTER = [41.311081, 69.240562]; // Toshkent

let loadPromise = null;

function loadYmaps(apiKey) {
  if (window.ymaps?.Map) return Promise.resolve(window.ymaps);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=ru_RU`;
    script.async = true;
    script.onload = () => {
      if (!window.ymaps) return reject(new Error('Xarita yuklanmadi'));
      window.ymaps.ready(() => resolve(window.ymaps));
    };
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Xaritaga ulanib bo\u2018lmadi'));
    };
    document.head.appendChild(script);
  });
  return loadPromise;
}

export function MapPicker({ lat, lng, address, onPick, onClose }) {
  useLockScroll();

  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const markRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [picked, setPicked] = useState(
    lat && lng ? { lat: Number(lat), lng: Number(lng), address: address || '' } : null,
  );

  useEffect(() => {
    let dead = false;

    (async () => {
      try {
        // Kalitni serverdan olamiz
        const cfg = await adminApi.getMapsConfig();
        if (dead) return;

        if (!cfg.enabled || !cfg.mapsKey) {
          setError('Xarita sozlanmagan');
          setLoading(false);
          return;
        }

        const ymaps = await loadYmaps(cfg.mapsKey);
        if (dead || !boxRef.current) return;

        const start = picked ? [picked.lat, picked.lng] : DEFAULT_CENTER;
        const map = new ymaps.Map(boxRef.current, {
          center: start,
          zoom: picked ? 17 : 12,
          controls: ['zoomControl', 'geolocationControl'],
        });
        mapRef.current = map;

        if (picked) addMarker(ymaps, start);

        map.events.add('click', (e) => {
          const [la, ln] = e.get('coords');
          selectPoint(la, ln);
        });

        setLoading(false);
      } catch (e) {
        if (!dead) {
          setError(e.message);
          setLoading(false);
        }
      }
    })();

    return () => {
      dead = true;
      mapRef.current?.destroy?.();
      mapRef.current = null;
      markRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addMarker = (ymaps, coords) => {
    const pm = new ymaps.Placemark(coords, {}, {
      preset: 'islands#redDotIcon',
      draggable: true,
    });
    mapRef.current.geoObjects.add(pm);
    markRef.current = pm;
    pm.events.add('dragend', () => {
      const [la, ln] = pm.geometry.getCoordinates();
      selectPoint(la, ln);
    });
  };

  const selectPoint = async (la, ln) => {
    const ymaps = window.ymaps;
    if (!ymaps || !mapRef.current) return;

    if (markRef.current) markRef.current.geometry.setCoordinates([la, ln]);
    else addMarker(ymaps, [la, ln]);

    setPicked({ lat: la, lng: ln, address: '' });
    setResolving(true);

    try {
      const { address: addr } = await adminApi.reverseGeocode(la, ln);
      setPicked({ lat: la, lng: ln, address: addr || '' });
    } catch {
      setPicked({ lat: la, lng: ln, address: '' });
    } finally {
      setResolving(false);
    }
  };

  const doSearch = async (e) => {
    e?.preventDefault?.();
    if (!query.trim()) return;
    setSearching(true);
    try {
      setResults(await adminApi.geocode(query.trim()));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const goTo = (r) => {
    mapRef.current?.setCenter([r.lat, r.lng], 17);
    selectPoint(r.lat, r.lng);
    setResults([]);
    setQuery('');
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        mapRef.current?.setCenter([latitude, longitude], 17);
        selectPoint(latitude, longitude);
      },
      () => alert('Joylashuvni aniqlab bo\u2018lmadi'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
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
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-2xl rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[92dvh]"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-line flex-none">
          <div className="min-w-0">
            <h3 className="font-semibold text-ink">Joylashuvni tanlang</h3>
            <p className="text-xs text-muted mt-0.5">
              Xaritada binoni bosing yoki belgini suring
            </p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink p-1 flex-none">
            <i className="ti ti-x text-xl" />
          </button>
        </div>

        <div className="px-4 py-2.5 border-b border-line flex-none">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doSearch(e)}
              placeholder="Manzil qidirish..."
              className="inp flex-1"
            />
            <button
              type="button" onClick={doSearch} disabled={searching}
              className="px-3 rounded-xl border border-line text-muted hover:bg-canvas flex-none"
            >
              <i className={`ti ${searching ? 'ti-loader-2 animate-spin' : 'ti-search'}`} />
            </button>
            <button
              type="button" onClick={useMyLocation}
              className="px-3 rounded-xl border border-line text-muted hover:bg-canvas flex-none"
              title="Hozirgi joyim"
            >
              <i className="ti ti-current-location" />
            </button>
          </div>

          {results.length > 0 && (
            <div className="mt-2 max-h-36 overflow-y-auto border border-line rounded-xl">
              {results.map((r, i) => (
                <button
                  key={i}
                  onClick={() => goTo(r)}
                  className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-canvas border-b border-line last:border-0"
                >
                  {r.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative flex-1 min-h-[300px]">
          <div ref={boxRef} className="absolute inset-0" />

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-canvas z-[500]">
              <div className="text-muted text-sm">Xarita yuklanmoqda...</div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-canvas p-6 z-[500]">
              <div className="text-center max-w-xs">
                <i className="ti ti-map-off text-3xl text-muted mb-2 block" />
                <div className="text-sm text-ink font-medium">{error}</div>
                <p className="text-xs text-muted mt-2 leading-relaxed">
                  Server .env fayliga <b>YANDEX_MAPS_KEY</b> qo'shing.
                  Kalit developer.tech.yandex.ru dan olinadi.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-line flex-none">
          {picked ? (
            <div className="mb-3">
              <div className="text-sm text-ink break-words line-clamp-2">
                {resolving
                  ? <span className="text-muted">Manzil aniqlanmoqda...</span>
                  : (picked.address || 'Manzil aniqlanmadi')}
              </div>
              <div className="text-[11px] text-muted mt-0.5 font-mono">
                {picked.lat.toFixed(6)}, {picked.lng.toFixed(6)}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted mb-3">Xaritada binoni bosing</p>
          )}

          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 border border-line text-muted py-2.5 rounded-xl hover:bg-canvas">
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
