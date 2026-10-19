import { create } from 'zustand';

/*
 * "Tortib yangilash" (PullToRefresh) kaliti. `key` oshganda RefreshBoundary ichidagi butun sahifa
 * QAYTA MOUNT bo'ladi — har sahifaning o'z so'rovlari (useEffect, react-query) serverdan yangidan ketadi.
 * Karkas (sidebar, sarlavha, auth) qayta yuklanmaydi: oq ekran ham, tizimdan chiqish ham yo'q.
 */
export const useRefreshKey = create((set) => ({
  key: 0,
  bump: () => set((s) => ({ key: s.key + 1 })),
}));
