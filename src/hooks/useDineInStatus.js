import { useState, useEffect, useCallback } from 'react';
import { panelApi } from '@/api';
import { getSocket } from '@/lib/socket';

/**
 * Dine-in holati — sidebar bo'limlarini ko'rsatish uchun.
 *
 * Faqat 'active' bo'lganda Zal boshqaruvi va Zal tarixi
 * ko'rinadi.
 */
export function useDineInStatus(enabled = true) {
  const [status, setStatus] = useState(null);

  const load = useCallback(() => {
    panelApi.getDineInConfig()
      .then((c) => setStatus(c?.status || 'none'))
      .catch(() => setStatus('none'));
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    load();

    // Admin tasdiqlasa darhol ochiladi
    const socket = getSocket();
    const onStatus = (d) => setStatus(d?.status || 'none');
    socket.on('dinein:status', onStatus);
    return () => socket.off('dinein:status', onStatus);
  }, [load, enabled]);

  return {
    status,
    isActive: status === 'active',
    refresh: load,
  };
}
