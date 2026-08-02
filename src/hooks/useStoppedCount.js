import { useState, useEffect, useCallback } from 'react';
import { panelApi } from '@/api';
import { getSocket, joinRestaurant } from '@/lib/socket';
import { useAuth } from '@/store/auth';

/**
 * Stop'dagi taomlar soni — sidebar badge uchun.
 *
 * Bir marta yuklanadi, keyin socket orqali yangilanadi.
 * Polling YO'Q — keraksiz so'rov yubormaydi.
 */
export function useStoppedCount(enabled = true) {
  const [count, setCount] = useState(0);
  const restaurantId = useAuth((s) => s.restaurant?._id);

  const load = useCallback(() => {
    panelApi.getStoppedCount()
      .then((r) => setCount(r?.count ?? 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Admin panelida bu endpoint yo'q — so'rov yubormaymiz
    if (!enabled) return undefined;

    load();

    const socket = getSocket();
    // Xonaga ulanamiz — boshqa sahifada stop qo'yilsa ham
    // badge yangilanadi
    if (restaurantId) joinRestaurant(restaurantId);
    // Taom stop'ga qo'yilganda yoki chiqarilganda son keladi
    const onStop = (data) => {
      if (typeof data?.stoppedCount === 'number') setCount(data.stoppedCount);
      else load();
    };

    socket.on('dish:stop', onStop);
    return () => socket.off('dish:stop', onStop);
  }, [load, enabled, restaurantId]);

  return { count, refresh: load };
}
