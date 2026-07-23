import { io } from 'socket.io-client';
import { SOCKET_URL } from '@/api/client';

// Butun panel uchun BITTA socket ulanishi.
let socket = null;
const rooms = new Set();

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    });
    // Uzilib qayta ulansa — barcha xonalarga qayta qo'shilamiz
    socket.on('connect', () => {
      rooms.forEach((r) => {
        const [event, arg] = r.split('|');
        socket.emit(event, arg || undefined);
      });
    });
  }
  return socket;
}

// Admin barcha hodisalarni eshitadi
export function joinAdmin() {
  rooms.add('join:admin|');
  const s = getSocket();
  if (s.connected) s.emit('join:admin');
}

// Restoran o'z buyurtma va bronlarini eshitadi
export function joinRestaurant(restaurantId) {
  if (!restaurantId) return;
  rooms.add(`join:restaurant|${restaurantId}`);
  const s = getSocket();
  if (s.connected) s.emit('join:restaurant', String(restaurantId));
}
