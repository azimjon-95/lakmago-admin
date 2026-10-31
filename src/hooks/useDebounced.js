import { useEffect, useState } from 'react';

/** Qiymatni `ms` kechiktiradi (qidiruvda har harfga so'rov ketmasin). */
export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
