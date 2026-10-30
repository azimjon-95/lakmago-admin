import { useEffect, useRef, useState } from 'react';
import { useLockScroll } from '@/hooks/useLockScroll';
import { adminApi } from '@/api';
import { loadGoogleMaps, googleKeyFrom, ll } from '@/lib/googleMaps';

/**
 * Google xaritada joylashuv tanlash.
 *
 * API kaliti serverdan olinadi (/api/maps/config) — kodda
 * saqlanmaydi. Manzil qidirish va aniqlash ham server orqali
 * ketadi, shunda geocoder kaliti brauzerga chiqmaydi.
 */

const DEFAULT_CENTER = [41.311081, 69.240562]; // Toshkent

export function MapPicker({ lat, lng, address, onPick, onClose }) {
  useLockScroll();

  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const markRef = useRef(null);
  const mapsRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [nearMe, setNearMe] = useState(false);

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

        const key = googleKeyFrom(cfg);
        if (!key) {
          setError('Xarita sozlanmagan');
          setLoading(false);
          return;
        }

        const maps = await loadGoogleMaps(key);
        if (dead || !boxRef.current) return;

        const start = picked ? [picked.lat, picked.lng] : DEFAULT_CENTER;
        const map = new maps.Map(boxRef.current, {
          center: ll(start),
          zoom: picked ? 17 : 12,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: 'greedy',
        });
        mapRef.current = map;
        mapsRef.current = maps;

        if (picked) addMarker(maps, start);

        // Joylashuv oldindan tanlanmagan bo'lsa foydalanuvchi
        // turgan joyni ko'rsatamiz — u yerdan izlash qulayroq.
        // Nuqta QO'YILMAYDI, faqat xarita markazi ko'chadi.
        if (!picked && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (dead || !mapRef.current) return;
              const { latitude, longitude } = pos.coords;
              mapRef.current.panTo(ll([latitude, longitude]));
              mapRef.current.setZoom(16);
              setNearMe(true);
            },
            () => {
              // Ruxsat berilmadi yoki aniqlanmadi — Toshkent markazi qoladi
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
          );
        }

        // Xaritani bosish — nuqta qo'yish (Google: e.latLng)
        map.addListener('click', (e) => {
          if (e.latLng) selectPoint(e.latLng.lat(), e.latLng.lng());
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
      try { mapsRef.current?.event?.clearInstanceListeners(mapRef.current); } catch { /* */ }
      if (markRef.current) { markRef.current.setMap(null); }
      if (boxRef.current) boxRef.current.innerHTML = '';
      mapRef.current = null;
      mapsRef.current = null;
      markRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addMarker = (maps, coords) => {
    const pm = new maps.Marker({ position: ll(coords), map: mapRef.current, draggable: true });
    markRef.current = pm;
    pm.addListener('dragend', () => {
      const p = pm.getPosition();
      selectPoint(p.lat(), p.lng());
    });
  };

  const selectPoint = async (la, ln) => {
    const maps = mapsRef.current;
    if (!maps || !mapRef.current) return;

    if (markRef.current) markRef.current.setPosition(ll([la, ln]));
    else addMarker(maps, [la, ln]);

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
    if (mapRef.current) { mapRef.current.panTo(ll([r.lat, r.lng])); mapRef.current.setZoom(17); }
    selectPoint(r.lat, r.lng);
    setResults([]);
    setQuery('');
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (mapRef.current) { mapRef.current.panTo(ll([latitude, longitude])); mapRef.current.setZoom(17); }
        selectPoint(latitude, longitude);
      },
      () => alert('Joylashuvni aniqlab bo‘lmadi'),
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
                  Server .env fayliga <b>GOOGLE_MAPS_BROWSER_KEY</b> qo'shing (yoki admin build'ida <b>VITE_GOOGLE_MAPS_KEY</b>).
                  Kalit Google Cloud Console → Credentials dan olinadi (Maps JavaScript API).
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
            <p className="text-sm text-muted mb-3">
              {nearMe
                ? 'Siz turgan joy ko\'rsatildi. Kerakli binoni bosing'
                : 'Xaritada binoni bosing'}
            </p>
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
