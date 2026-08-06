import { apiFetch, setToken, clearToken, getToken, downloadFile } from './client.js';

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
  getProfile: () => apiFetch('/panel/me'),
  // Dine-in
  downloadFile,
  getDineInConfig: () => apiFetch('/panel/dine-in'),
  requestDineIn: () => apiFetch('/panel/dine-in/request', { method: 'POST' }),
  updateDineInSettings: (d) => apiFetch('/panel/dine-in/settings', { method: 'PATCH', body: JSON.stringify(d) }),
  updateQrTheme: (d) => apiFetch('/panel/dine-in/theme', { method: 'PATCH', body: JSON.stringify(d) }),
  getTables: () => apiFetch('/panel/tables'),
  createTable: (d) => apiFetch('/panel/tables', { method: 'POST', body: JSON.stringify(d) }),
  createTablesBulk: (d) => apiFetch('/panel/tables/bulk', { method: 'POST', body: JSON.stringify(d) }),
  updateTable: (id, d) => apiFetch(`/panel/tables/${id}`, { method: 'PATCH', body: JSON.stringify(d) }),
  deleteTable: (id) => apiFetch(`/panel/tables/${id}`, { method: 'DELETE' }),
  regenerateQr: (id) => apiFetch(`/panel/tables/${id}/regenerate`, { method: 'POST' }),

  // Ofitsiantlar
  getWaiters: () => apiFetch('/panel/waiters'),
  createWaiter: (d) => apiFetch('/panel/waiters', { method: 'POST', body: JSON.stringify(d) }),
  updateWaiter: (id, d) => apiFetch(`/panel/waiters/${id}`, { method: 'PATCH', body: JSON.stringify(d) }),
  resetWaiterDevice: (id) => apiFetch(`/panel/waiters/${id}/reset-device`, { method: 'POST' }),
  deleteWaiter: (id) => apiFetch(`/panel/waiters/${id}`, { method: 'DELETE' }),

  // Dine-in jonli
  getDineInDashboard: () => apiFetch('/panel/dine-in/dashboard'),
  getTableRequests: () => apiFetch('/panel/dine-in/requests'),
  updateTableRequest: (id, status) => apiFetch(`/panel/dine-in/requests/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  closeTable: (tableId, force) => apiFetch(`/panel/dine-in/tables/${tableId}/close`, { method: 'POST', body: JSON.stringify({ force }) }),
  getReceipt: (sessionId) => apiFetch(`/dine-in/receipt/${sessionId}`),
  getWaiterEarnings: (period) => apiFetch(`/panel/waiters/earnings?period=${period}`),
  payWaiter: (id, amount, note) => apiFetch(`/panel/waiters/${id}/payout`, { method: 'POST', body: JSON.stringify({ amount, note }) }),

  // Dine-in buyurtmalar
  getDineInOrders: (active) => apiFetch(`/panel/dine-in/orders${active ? '?active=1' : ''}`),
  getDineInHistory: (q) => apiFetch(`/panel/dine-in/orders?${new URLSearchParams(q)}`),
  getWaiterEarningsRange: (from, to) => apiFetch(`/panel/waiters/earnings?period=custom&from=${from}&to=${to}`),
  setDineInOrderStatus: (id, status) => apiFetch(`/panel/dine-in/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  getStoppedDishes: () => apiFetch('/panel/dishes/stopped'),

  // Mijozlarni jalb qilish — Super Admin
  // Dine-in — Super Admin
  getDineInRequests: () => apiFetch('/admin/dine-in'),
  setDineInStatus: (id, status, reason) => apiFetch(`/admin/dine-in/${id}`, { method: 'PATCH', body: JSON.stringify({ status, reason }) }),

  getDineInTariff: () => apiFetch('/admin/dine-in/tariff'),
  updateDineInTariff: (d) => apiFetch('/admin/dine-in/tariff', { method: 'PATCH', body: JSON.stringify(d) }),
  getDineInBilling: (id) => apiFetch(`/admin/dine-in/billing/${id}`),
  markDineInPaid: (id) => apiFetch(`/admin/dine-in/billing/${id}/pay`, { method: 'POST' }),

  getPromoAdminOverview: () => apiFetch('/admin/promo/overview'),
  getPromoRestaurants: (q = '') => apiFetch(`/admin/promo/restaurants${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getPromoBilling: (id) => apiFetch(`/admin/promo/billing/${id}`),
  markPromoPaid: (id) => apiFetch(`/admin/promo/billing/${id}/pay`, { method: 'POST' }),
  setPromoStatus: (id, status, reason) => apiFetch(`/admin/promo/subscription/${id}`, { method: 'PATCH', body: JSON.stringify({ status, reason }) }),
  getPromoTariff: () => apiFetch('/admin/promo/tariff'),
  updatePromoTariff: (d) => apiFetch('/admin/promo/tariff', { method: 'PATCH', body: JSON.stringify(d) }),

  // Продвижение
  getPromoOverview: () => apiFetch('/panel/promo/overview'),
  getPromotions: () => apiFetch('/panel/promotions'),
  createPromotion: (d) => apiFetch('/panel/promotions', { method: 'POST', body: JSON.stringify(d) }),
  updatePromotion: (id, d) => apiFetch(`/panel/promotions/${id}`, { method: 'PATCH', body: JSON.stringify(d) }),
  deletePromotion: (id) => apiFetch(`/panel/promotions/${id}`, { method: 'DELETE' }),

  getBonuses: () => apiFetch('/panel/bonuses'),
  createBonus: (d) => apiFetch('/panel/bonuses', { method: 'POST', body: JSON.stringify(d) }),
  updateBonus: (id, d) => apiFetch(`/panel/bonuses/${id}`, { method: 'PATCH', body: JSON.stringify(d) }),
  deleteBonus: (id) => apiFetch(`/panel/bonuses/${id}`, { method: 'DELETE' }),

  getAds: () => apiFetch('/panel/ads'),
  createAd: (d) => apiFetch('/panel/ads', { method: 'POST', body: JSON.stringify(d) }),
  updateAd: (id, d) => apiFetch(`/panel/ads/${id}`, { method: 'PATCH', body: JSON.stringify(d) }),
  deleteAd: (id) => apiFetch(`/panel/ads/${id}`, { method: 'DELETE' }),

  // Menyu ko'chirish
  searchBranches: (q) => apiFetch(`/panel/restaurants/search?q=${encodeURIComponent(q)}`),
  createTransfer: (d) => apiFetch('/panel/menu-transfers', { method: 'POST', body: JSON.stringify(d) }),
  getTransfers: (box) => apiFetch(`/panel/menu-transfers?box=${box}`),
  getTransfer: (id) => apiFetch(`/panel/menu-transfers/${id}`),
  respondTransfer: (id, action, reason) => apiFetch(`/panel/menu-transfers/${id}/respond`, { method: 'PATCH', body: JSON.stringify({ action, reason }) }),
  getPendingTransfers: () => apiFetch('/panel/menu-transfers/pending/count'),
  getStoppedCount: () => apiFetch('/panel/dishes/stopped/count'),
  getPanelCatalog: (q = '') => apiFetch(`/panel/catalog${q}`),
  addFromCatalog: (id, data) => apiFetch(`/panel/catalog/${id}/add`, { method: 'POST', body: JSON.stringify(data) }),
  updateProfile: (data) => apiFetch('/panel/me', { method: 'PATCH', body: JSON.stringify(data) }),
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
  markOrderPaid: (id, paid = true) => apiFetch(`/panel/orders/${id}/paid`, { method: 'PATCH', body: JSON.stringify({ paid }) }),
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
  // ===== Umumiy katalog =====
  getCatalog: (q = '') => apiFetch(`/admin/catalog${q}`),
  createCatalogProduct: (d) => apiFetch('/admin/catalog', { method: 'POST', body: JSON.stringify(d) }),
  updateCatalogProduct: (id, d) => apiFetch(`/admin/catalog/${id}`, { method: 'PATCH', body: JSON.stringify(d) }),
  deleteCatalogProduct: (id) => apiFetch(`/admin/catalog/${id}`, { method: 'DELETE' }),

  // ===== Xarita =====
  getMapsConfig: () => apiFetch('/maps/config'),
  geocode: (q) => apiFetch(`/maps/geocode?q=${encodeURIComponent(q)}`),
  reverseGeocode: (lat, lng) => apiFetch(`/maps/reverse?lat=${lat}&lng=${lng}`),

  getSettings: () => apiFetch('/admin/settings'),

  // ===== Moliya =====
  getBillingOverview: (q = '') => apiFetch(`/admin/billing/overview${q}`),
  getBillingByRestaurant: () => apiFetch('/admin/billing/restaurants'),
  getLedger: (q = '') => apiFetch(`/admin/billing/ledger${q}`),
  payout: (data) => apiFetch('/admin/billing/payout', { method: 'POST', body: JSON.stringify(data) }),
  setCommission: (id, data) => apiFetch(`/admin/restaurants/${id}/commission`, { method: 'PATCH', body: JSON.stringify(data) }),
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
  addGroup: (chatId) => apiFetch('/admin/groups/add', { method: 'POST', body: JSON.stringify({ chatId }) }),
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
