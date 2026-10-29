import { useEffect, useRef } from 'react';
import { ProductCardSkeleton } from './CatalogCards';

/*
 * Mahsulotlar to'ri + cheksiz aylantirish (YouTube kabi): pastga tushilganda KEYINGI sahifa so'raladi, shu orada pastda
 * skelet kartochkalar ko'rinadi, kelgach ro'yxatga qo'shiladi (mavjud kartochkalar qayta chizilmaydi, aylanish joyi sakramaydi).
 * Kuzatuvchi sahifa tubidan 900 px OLDIN ishga tushadi — foydalanuvchi odatda skeletni ko'rmaydi ham.
 * `pager` — hooks/useCatalogPager natijasi; `renderCard(p)` — kartochka.
 */
export function InfiniteGrid({ pager, renderCard, skeletons = 6, cols = 'grid-cols-2 sm:grid-cols-3' }) {
  const { items, hasMore, phase, moreError, loadMore, offset } = pager;
  const sentinel = useRef(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || moreError || typeof IntersectionObserver === 'undefined') return undefined;
    // Har yangi sahifadan keyin kuzatuvchi qayta yaratiladi: sentinel hamon ko'rinib tursa (baland ekran) — darhol keyingisi
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) loadMore(); }, { rootMargin: '900px 0px 900px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, moreError, loadMore, items.length, offset]);

  return (
    <>
      <div className={`grid gap-3 transition-opacity duration-200 sm:gap-4 ${cols} ${phase === 'refreshing' ? 'opacity-50' : ''}`} aria-busy={phase !== 'ready'}>
        {items.map(renderCard)}
        {phase === 'more' && Array.from({ length: skeletons }, (_, i) => <ProductCardSkeleton key={`sk${i}`} />)}
      </div>
      {hasMore && !moreError && <div ref={sentinel} aria-hidden="true" className="h-px" data-sentinel="" />}
      {moreError && (
        <div className="mt-4 flex items-center justify-center gap-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {moreError}
          <button type="button" onClick={loadMore} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 font-medium">Qayta urinish</button>
        </div>
      )}
    </>
  );
}
