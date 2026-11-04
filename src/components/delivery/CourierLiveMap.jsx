import { useEffect, useRef, useState } from 'react';
import { loadYmaps } from './ymaps';

/**
 * JONLI XARITA: smenadagi kuryerlar (rangi — signal holati), tanlangan kuryerning buyurtmalari: restoran va mijoz nuqtalari,
 * kuryerdan maqsadgacha chiziq. `couriers` har 5–10 s da yangilanadi — xarita QAYTA YARATILMAYDI, faqat belgilar yangilanadi.
 *   yashil — signal bor · sariq — signal eskirgan (>60 s) · qizil — signal yo'q
 * `track` — tanlangan kuryerning yo'li (nuqtalar massivi [{lat,lng}]).
 */
const COLOR = { ok: '#16a34a', stale: '#d97706', none: '#dc2626' };
const CENTER = [40.9983, 71.6726];        // Namangan

export function CourierLiveMap({ couriers, selectedId, onSelect, track, className = 'h-[420px]' }) {
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [state, setState] = useState({ loading: true, error: '' });
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    let dead = false;
    loadYmaps().then((ymaps) => {
      if (dead || !boxRef.current) return;
      const map = new ymaps.Map(boxRef.current, { center: CENTER, zoom: 11, controls: ['zoomControl', 'fullscreenControl'] });
      mapRef.current = map;
      layerRef.current = new ymaps.GeoObjectCollection();
      map.geoObjects.add(layerRef.current);
      setState({ loading: false, error: '' });
    }).catch((e) => !dead && setState({ loading: false, error: e.message || 'Xarita yuklanmadi' }));
    return () => { dead = true; mapRef.current?.destroy?.(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const ymaps = window.ymaps;
    const layer = layerRef.current;
    if (!ymaps || !layer || state.loading) return;
    layer.removeAll();
    const pts = [];
    for (const c of couriers) {
      if (!c.location) continue;
      const sel = c.id === selectedId;
      const pm = new ymaps.Placemark([c.location.lat, c.location.lng], {
        hintContent: c.name,
        balloonContent: `<b>${c.name}</b><br/>${c.phone || ''}<br/>${c.orders.length ? c.orders.map((o) => `#${o.number ?? ''} ${o.itemsLine}`).join('<br/>') : 'Buyurtma yo‘q'}`,
        iconCaption: c.name,
      }, { preset: sel ? 'islands#blueCircleDotIconWithCaption' : 'islands#circleDotIcon', iconColor: sel ? '#2563eb' : COLOR[c.signal] });
      pm.events.add('click', () => onSelectRef.current?.(c.id));
      layer.add(pm);
      pts.push([c.location.lat, c.location.lng]);
      if (sel) {
        for (const o of c.orders) {
          const toCustomer = o.stage === 'to_customer';
          if (Number.isFinite(o.restaurant.lat)) layer.add(new ymaps.Placemark([o.restaurant.lat, o.restaurant.lng], { hintContent: `Restoran: ${o.restaurant.name}` }, { preset: 'islands#orangeFoodIcon' }));
          if (Number.isFinite(o.customer.lat)) layer.add(new ymaps.Placemark([o.customer.lat, o.customer.lng], { hintContent: `Mijoz: ${o.customer.address}` }, { preset: 'islands#redHomeIcon' }));
          const target = toCustomer ? o.customer : o.restaurant;
          if (Number.isFinite(target.lat)) {
            layer.add(new ymaps.Polyline([[c.location.lat, c.location.lng], [target.lat, target.lng]], {}, { strokeColor: toCustomer ? '#dc2626' : '#ea580c', strokeWidth: 3, strokeStyle: 'dash', strokeOpacity: 0.8 }));
            pts.push([target.lat, target.lng]);
          }
        }
      }
    }
    if (track?.length > 1) {
      layer.add(new ymaps.Polyline(track.map((p) => [p.lat, p.lng]), {}, { strokeColor: '#2563eb', strokeWidth: 4, strokeOpacity: 0.7 }));
      track.forEach((p) => pts.push([p.lat, p.lng]));
    }
    // Tanlangan bo'lsa unga, aks holda hammasiga moslab (faqat nuqtalar soni/tanlov o'zgarganda — foydalanuvchi suraganini buzmaslik uchun)
    if (pts.length && layer.__fitKey !== `${selectedId}|${pts.length}|${track?.length || 0}`) {
      layer.__fitKey = `${selectedId}|${pts.length}|${track?.length || 0}`;
      const b = ymaps.util.bounds.fromPoints(pts);
      mapRef.current?.setBounds(b, { checkZoomRange: true, zoomMargin: 60 }).then(() => { if (mapRef.current?.getZoom() > 16) mapRef.current.setZoom(16); });
    }
  }, [couriers, selectedId, track, state.loading]);

  return (
    <div className={`relative w-full overflow-hidden rounded-2xl border border-line bg-canvas ${className}`} data-testid="courier-live-map">
      <div ref={boxRef} className="h-full w-full" />
      {state.loading && <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">Xarita yuklanmoqda…</div>}
      {state.error && <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-red-600">{state.error}</div>}
    </div>
  );
}
