import { useEffect, useState } from 'react';
import { ownerApi } from '@/api';

/*
 * Egasining to'yxonasi (zallar, seans sozlamalari) — bir marta yuklanadi
 * va sahifalar orasida qayta so'ralmaydi.
 */
let cache = null;
let inflight = null;

export function useOwnerVenue() {
  const [venue, setVenue] = useState(cache);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (cache) return;
    inflight = inflight || ownerApi.me().then((r) => { cache = r.venue; return cache; });
    inflight.then(setVenue).catch((e) => { inflight = null; setError(e.message); });
  }, []);
  return { venue, error };
}

/** Chiqishda tozalash */
export function resetOwnerVenue() { cache = null; inflight = null; }
