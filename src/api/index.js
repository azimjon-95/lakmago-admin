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
  updateReservationStatus: (id, status) =>
    apiFetch(`/panel/reservations/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};

// ===== Admin paneli API (role: admin) =====
export const adminApi = {
  getStats: () => apiFetch('/admin/stats'),
  getRestaurants: (status) => apiFetch(`/admin/restaurants${status ? `?status=${status}` : ''}`),
  createRestaurant: (data) => apiFetch('/admin/restaurants', { method: 'POST', body: JSON.stringify(data) }),
  updateRestaurant: (id, data) => apiFetch(`/admin/restaurants/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  resetPassword: (id, password) =>
    apiFetch(`/admin/restaurants/${id}/password`, { method: 'PATCH', body: JSON.stringify({ password }) }),
  deleteRestaurant: (id) => apiFetch(`/admin/restaurants/${id}`, { method: 'DELETE' }),
  getOrders: (status) => apiFetch(`/admin/orders${status ? `?status=${status}` : ''}`),
  getUsers: () => apiFetch('/admin/users'),
};
