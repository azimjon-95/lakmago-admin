import { apiFetch, setToken, clearToken, getToken } from './client.js';

// ===== Autentifikatsiya =====
export const auth = {
  login: (login, password) =>
    apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) }),
  me: () => apiFetch('/auth/me'),
  logout: () => clearToken(),
  saveToken: (t) => setToken(t),
  token: getToken,
};

// ===== Restoran paneli API (role: restaurant) =====
export const panelApi = {
  profile: () => apiFetch('/panel/me'),
  toggleActive: (isActive) =>
    apiFetch('/panel/me/active', { method: 'PATCH', body: JSON.stringify({ isActive }) }),

  getDishes: () => apiFetch('/panel/dishes'),
  createDish: (data) => apiFetch('/panel/dishes', { method: 'POST', body: JSON.stringify(data) }),
  updateDish: (id, data) => apiFetch(`/panel/dishes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  toggleStop: (id, stop) => apiFetch(`/panel/dishes/${id}/stop`, { method: 'PATCH', body: JSON.stringify({ stop }) }),
  deleteDish: (id) => apiFetch(`/panel/dishes/${id}`, { method: 'DELETE' }),

  getOrders: (status) => apiFetch(`/panel/orders${status ? `?status=${status}` : ''}`),
  updateOrderStatus: (id, status) =>
    apiFetch(`/panel/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  getReservations: () => apiFetch('/panel/reservations'),
  updateReservationStatus: (id, status, reason = '') =>
    apiFetch(`/panel/reservations/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, reason }) }),

  // O'z banneri
  getBanner: () => apiFetch('/panel/banner'),
  setBanner: (data) => apiFetch('/panel/banner', { method: 'PUT', body: JSON.stringify(data) }),
  deleteBanner: () => apiFetch('/panel/banner', { method: 'DELETE' }),
};

// ===== Admin paneli API (role: admin) =====
export const adminApi = {
  getStats: () => apiFetch('/admin/stats'),
  getRestaurants: (status) => apiFetch(`/admin/restaurants${status ? `?status=${status}` : ''}`),
  createRestaurant: (data) => apiFetch('/admin/restaurants', { method: 'POST', body: JSON.stringify(data) }),
  updateRestaurant: (id, data) => apiFetch(`/admin/restaurants/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  toggleBlock: (id, blocked) => apiFetch(`/admin/restaurants/${id}/block`, { method: 'PATCH', body: JSON.stringify({ blocked }) }),
  resetPassword: (id, password) =>
    apiFetch(`/admin/restaurants/${id}/password`, { method: 'PATCH', body: JSON.stringify({ password }) }),
  deleteRestaurant: (id) => apiFetch(`/admin/restaurants/${id}`, { method: 'DELETE' }),
  getOrders: (status) => apiFetch(`/admin/orders${status ? `?status=${status}` : ''}`),
  getUsers: () => apiFetch('/admin/users'),

  // Komissiya sozlamasi
  getSettings: () => apiFetch('/admin/settings'),
  updateSettings: (data) => apiFetch('/admin/settings', { method: 'PATCH', body: JSON.stringify(data) }),

  // Daromad hisobi
  getRevenue: () => apiFetch('/admin/revenue'),

  // Banner boshqaruvi
  getBanners: () => apiFetch('/admin/banners'),
  createBanner: (data) => apiFetch('/admin/banners', { method: 'POST', body: JSON.stringify(data) }),
  updateBanner: (id, data) => apiFetch(`/admin/banners/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBanner: (id) => apiFetch(`/admin/banners/${id}`, { method: 'DELETE' }),

  // Telegram guruhlar
  getGroups: () => apiFetch('/admin/groups'),
  resendGroupPromo: (chatId) => apiFetch(`/admin/groups/${chatId}/resend`, { method: 'POST' }),
  runGroupCheck: () => apiFetch('/admin/groups/check', { method: 'POST' }),
  // Moslashuvchan reklama (rasm/matn/tugma)
  broadcastToGroup: (chatId, data) => apiFetch(`/admin/groups/${chatId}/broadcast`, { method: 'POST', body: JSON.stringify(data) }),
  broadcastToAll: (data) => apiFetch('/admin/groups/broadcast-all', { method: 'POST', body: JSON.stringify(data) }),

  // Muassasa ichi — menyu va bronlar (admin nazorati)
  getRestaurantDishes: (id) => apiFetch(`/admin/restaurants/${id}/dishes`),
  getRestaurantReservations: (id) => apiFetch(`/admin/restaurants/${id}/reservations`),

  // Qo'llab-quvvatlash chati
  getSupportChats: (resolved = false) => apiFetch(`/admin/support?resolved=${resolved}`),
  getSupportChat: (id) => apiFetch(`/admin/support/${id}`),
  replySupport: (id, text) => apiFetch(`/admin/support/${id}/reply`, { method: 'POST', body: JSON.stringify({ text }) }),
  resolveSupport: (id, resolved = true) => apiFetch(`/admin/support/${id}/resolve`, { method: 'PATCH', body: JSON.stringify({ resolved }) }),

  // Buyurtmalar nazorati (kim → qaysi restoran → nima)
  getOrders: (params = '') => apiFetch(`/admin/orders${params}`),
  getLiveOrders: () => apiFetch('/admin/orders/live'),
};
