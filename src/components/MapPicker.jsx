import { useEffect, useRef, useState } from 'react';
import { useLockScroll } from '@/hooks/useLockScroll';

/**
 * Xaritada joylashuv tanlash.
 *
 * Leaflet + OpenStreetMap ishlatiladi — API kalit kerak emas,
 * bepul va cheklovsiz. Yandex Maps 2023 dan beri kalit talab
 * qiladi, shuning uchun u ishlatilmadi.
 *
 * Manzil Nominatim (OSM) orqali aniqlanadi.
 */

// Toshkent markazi
const DEFAULT_CENTER = [41.311081, 69.240562];

// Yandex kaliti bo'lsa Yandex plitkalari ishlatiladi (O'zbekiston
// uchun aniqroq). Bo'lmasa OpenStreetMap — kalit kerak emas.
const YANDEX_KEY = import.meta.env.VITE_YANDEX_MAPS_KEY || '';

let loadPromise = null;

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    // CSS
    if (!document.querySelector('link[data-leaflet]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.setAttribute('data-leaflet', '1');
      document.head.appendChild(link);
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error('Xarita yuklanmadi'));
    document.head.appendChild(script);
  });
  return loadPromise;
}

// Koordinatadan manzil (teskari geokodlash)
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=uz,ru`,
      { headers: { 'Accept-Language': 'uz,ru' } },
    );
    const data = await res.json();
    return data.display_name || '';
  } catch {
    return '';
  }
}

// Manzil bo'yicha qidirish
async function searchPlace(query) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&accept-language=uz,ru&countrycodes=uz`,
    );
    return await res.json();
  } catch {
    return [];
  }
}

export function MapPicker({ lat, lng, address, onPick, onClose }) {
  useLockScroll();

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [picked, setPicked] = useState(
    lat && lng
      ? { lat: Number(lat), lng: Number(lng), address: address || '' }
      : null,
  );

  useEffect(() => {
    let cancelled = false;

    loadLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current) return;

        const start = picked ? [picked.lat, picked.lng] : DEFAULT_CENTER;
        const map = L.map(containerRef.current, {
          center: start,
          zoom: picked ? 17 : 12,
          zoomControl: true,
        });

        // Plitka manbasi
        if (YANDEX_KEY) {
          L.tileLayer(
            `https://core-renderer-tiles.maps.yandex.net/tiles?l=map&x={x}&y={y}&z={z}&scale=1&lang=uz_UZ`,
            { attribution: '© Yandex', maxZoom: 19 },
          ).addTo(map);
        } else {
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap',
            maxZoom: 19,
          }).addTo(map);
        }

        mapRef.current = map;

        if (picked) {
          markerRef.current = L.marker(start, { draggable: true }).addTo(map);
          markerRef.current.on('dragend', (e) => {
            const { lat: la, lng: ln } = e.target.getLatLng();
            selectPoint(la, ln);
          });
        }

        map.on('click', (e) => {
          selectPoint(e.latlng.lat, e.latlng.lng);
        });

        // Konteyner o'lchami o'zgargach xarita qayta chizilsin
        setTimeout(() => map.invalidateSize(), 200);
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
      mapRef.current?.remove?.();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nuqta tanlash
  const selectPoint = async (la, ln) => {
    const L = window.L;
    if (!L || !mapRef.current) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([la, ln]);
    } else {
      markerRef.current = L.marker([la, ln], { draggable: true }).addTo(mapRef.current);
      markerRef.current.on('dragend', (e) => {
        const p = e.target.getLatLng();
        selectPoint(p.lat, p.lng);
      });
    }

    setPicked({ lat: la, lng: ln, address: '' });
    setResolving(true);
    const addr = await reverseGeocode(la, ln);
    setPicked({ lat: la, lng: ln, address: addr });
    setResolving(false);
  };

  // Qidirish
  const doSearch = async (e) => {
    e?.preventDefault?.();
    if (!query.trim()) return;
    setSearching(true);
    const found = await searchPlace(query.trim());
    setResults(found);
    setSearching(false);
  };

  const goTo = (r) => {
    const la = Number(r.lat);
    const ln = Number(r.lon);
    mapRef.current?.setView([la, ln], 17);
    selectPoint(la, ln);
    setResults([]);
    setQuery('');
  };

  // Hozirgi joy
  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        mapRef.current?.setView([latitude, longitude], 17);
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
        {/* Sarlavha */}
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

        {/* Qidiruv */}
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
              type="button"
              onClick={doSearch}
              disabled={searching}
              className="px-3 rounded-xl border border-line text-muted hover:bg-canvas flex-none"
            >
              <i className={`ti ${searching ? 'ti-loader-2 animate-spin' : 'ti-search'}`} />
            </button>
            <button
              type="button"
              onClick={useMyLocation}
              className="px-3 rounded-xl border border-line text-muted hover:bg-canvas flex-none"
              title="Hozirgi joyim"
            >
              <i className="ti ti-current-location" />
            </button>
          </div>

          {results.length > 0 && (
            <div className="mt-2 max-h-36 overflow-y-auto border border-line rounded-xl">
              {results.map((r) => (
                <button
                  key={r.place_id}
                  onClick={() => goTo(r)}
                  className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-canvas border-b border-line last:border-0"
                >
                  {r.display_name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Xarita */}
        <div className="relative flex-1 min-h-[300px]">
          <div ref={containerRef} className="absolute inset-0" />

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-canvas z-[500]">
              <div className="text-muted text-sm">Xarita yuklanmoqda...</div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-canvas p-6 z-[500]">
              <div className="text-center">
                <i className="ti ti-map-off text-3xl text-muted mb-2 block" />
                <div className="text-sm text-ink font-medium">{error}</div>
                <p className="text-xs text-muted mt-1">Internet aloqasini tekshiring</p>
              </div>
            </div>
          )}
        </div>

        {/* Natija va tugmalar */}
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
