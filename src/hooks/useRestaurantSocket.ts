import { useEffect } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000';

// Restoran yangi buyurtmalarni real-time eshitadi
export function useRestaurantSocket(restaurantId: string | null, onNewOrder: () => void) {
  useEffect(() => {
    if (!restaurantId) return;
    const socket = io(SOCKET_URL, { transports: ['websocket'] });

    socket.emit('join:restaurant', restaurantId);
    socket.on('order:new', () => {
      onNewOrder();
      // Ovozli/vizual ogohlantirish shu yerda qo'shilishi mumkin
    });

    return () => {
      socket.disconnect();
    };
  }, [restaurantId, onNewOrder]);
}
