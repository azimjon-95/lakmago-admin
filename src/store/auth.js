import { create } from 'zustand';
import { auth, panelApi } from '@/api';
import { getToken } from '@/api/client';

// Panel autentifikatsiya holati (admin yoki restoran)
export const useAuth = create((set, get) => ({
  user: null,         // { _id, login, role, restaurantId }
  restaurant: null,   // restoran roli uchun profil
  status: getToken() ? 'checking' : 'guest', // guest | checking | authed
  error: null,

  // Sahifa yuklanganda tokenni tekshirish
  init: async () => {
    if (!getToken()) {
      set({ status: 'guest' });
      return;
    }
    try {
      const user = await auth.me();
      let restaurant = null;
      if (user.role === 'restaurant') {
        restaurant = await panelApi.profile().catch(() => null);
      }
      set({ user, restaurant, status: 'authed', error: null });
    } catch {
      auth.logout();
      set({ user: null, restaurant: null, status: 'guest' });
    }
  },

  login: async (login, password) => {
    set({ error: null });
    try {
      const { token, user } = await auth.login(login, password);
      auth.saveToken(token);
      let restaurant = null;
      if (user.role === 'restaurant') {
        restaurant = await panelApi.profile().catch(() => null);
      }
      set({ user, restaurant, status: 'authed', error: null });
      return user;
    } catch (e) {
      set({ error: e.message });
      throw e;
    }
  },

  logout: () => {
    auth.logout();
    set({ user: null, restaurant: null, status: 'guest' });
  },

  setRestaurant: (r) => set({ restaurant: r }),
}));
