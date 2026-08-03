import { useState, useEffect, useCallback } from 'react';
import { panelApi } from '@/api';
import { getSocket } from '@/lib/socket';

/**
 * Javob kutayotgan menyu so'rovlari soni — sidebar badge uchun.
 * Socket orqali yangilanadi, polling yo'q.
 */
export function usePendingTransfers(enabled = true) {
  const [count, setCount] = useState(0);

  const load = useCallback(() => {
    panelApi.getPendingTransfers()
      .then((r) => setCount(r?.count ?? 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    load();

    const socket = getSocket();
    socket.on('transfer:new', load);
    socket.on('transfer:update', load);
    return () => {
      socket.off('transfer:new', load);
      socket.off('transfer:update', load);
    };
  }, [load, enabled]);

  return { count, refresh: load };
}
