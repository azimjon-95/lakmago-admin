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
  // Yetkazish ustamasi — restoran o'zi belgilaydi
  getAgreement: () => apiFetch('/panel/agreement'),

  // Kuryer tizimi (2026-08, BOSQICH 1 — ulashish orqali)
  createDeliveryLink: (orderId) => apiFetch(`/panel/orders/${orderId}/create-delivery-link`, { method: 'POST' }),
  getDispatchStatus: (orderId) => apiFetch(`/panel/orders/${orderId}/dispatch-status`),
  setDeliveryMarkup: (percent) => apiFetch('/panel/delivery-markup', {
    method: 'PATCH', body: JSON.stringify({ deliveryMarkupPercent: percent }),
  }),

  // Reklama (banner) so'rovlari — ikki tur: restoran yoki taom
  getAds: () => apiFetch('/panel/ads'),
  getAdPrice: () => apiFetch('/panel/ads/price'),
  getAdImages: () => apiFetch('/panel/ads/images'),
  createAd: (data) => apiFetch('/panel/ads', { method: 'POST', body: JSON.stringify(data) }),
  cancelAd: (id) => apiFetch(`/panel/ads/${id}`, { method: 'DELETE' }),

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

  /*
   * Stol boshqaruvi — restoran admini o'zi mehmon qabul qilib,
   * taom kiritib, chekni yopa oladi (ofitsiant kabi, 2026-08).
   */
  getTableDetail: (id) => apiFetch(`/panel/dinein/tables/${id}`),
  setTableGuests: (id, count) => apiFetch(`/panel/dinein/tables/${id}/guests`, {
    method: 'PATCH', body: JSON.stringify({ count }),
  }),
  createDineInOrder: (d) => apiFetch('/panel/dinein/orders', { method: 'POST', body: JSON.stringify(d) }),
  updateDineInOrderStatus: (id, status) => apiFetch(`/panel/dinein/orders/${id}/status`, {
    method: 'PATCH', body: JSON.stringify({ status }),
  }),
  closeDineInTable: (tableId, opts = {}) => apiFetch(`/panel/dinein/tables/${tableId}/close`, {
    method: 'POST', body: JSON.stringify(opts),
  }),
  getDineInMenu: (restaurantId) => apiFetch(`/panel/dinein/menu/${restaurantId}`),

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

  /** Keyingi kursni (podacha) oshxonaga yuborish. */
  fireDineInCourse: (orderId, course) =>
    apiFetch(`/panel/dinein/orders/${orderId}/fire`, {
      method: 'PATCH',
      body: JSON.stringify({ course }),
    }),

  /*
   * Kiosk linklar — zaldagi planshet uchun.
   *
   * To'liq havola ATAYLAB ro'yxatda kelmaydi: `getKioskLinks`
   * faqat qisqartirilgan tokenni qaytaradi, to'lig'i esa
   * `revealKioskLink` orqali so'ralganda. Panel ekrani zalda
   * ochiq turgan bo'lishi mumkin.
   */
  getKioskLinks: () => apiFetch('/panel/kiosk'),
  createKioskLink: (d) => apiFetch('/panel/kiosk', { method: 'POST', body: JSON.stringify(d) }),
  revealKioskLink: (id) => apiFetch(`/panel/kiosk/${id}/reveal`),
  updateKioskLink: (id, d) => apiFetch(`/panel/kiosk/${id}`, { method: 'PATCH', body: JSON.stringify(d) }),
  rotateKioskLink: (id) => apiFetch(`/panel/kiosk/${id}/rotate`, { method: 'POST' }),
  resetKioskDevices: (id) => apiFetch(`/panel/kiosk/${id}/reset-devices`, { method: 'POST' }),
  deleteKioskLink: (id) => apiFetch(`/panel/kiosk/${id}`, { method: 'DELETE' }),
  kioskQrPath: (id) => `/panel/kiosk/${id}/qr`,

  // Mijozlarni jalb qilish — Super Admin
  // Dine-in — Super Admin
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

  /*
   * Restoranning o'z moliyaviy hisoboti.
   * from/to berilmasa server standart qiymat qo'yadi
   * (summary -> bugun, daily -> shu oy).
   */
  getBillingSummary: (from, to) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const qs = q.toString();
    return apiFetch(`/panel/billing/summary${qs ? `?${qs}` : ''}`);
  },
  getBillingDaily: (from, to) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const qs = q.toString();
    return apiFetch(`/panel/billing/daily${qs ? `?${qs}` : ''}`);
  },
  getBillingLedger: (params = {}) => {
    const q = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== ''),
    );
    const qs = q.toString();
    return apiFetch(`/panel/billing/ledger${qs ? `?${qs}` : ''}`);
  },
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
  // ===== Dine-in =====
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

  // Kunlik hisob-kitob — Click/Paynet ajratilgan, qo'lda tasdiqlash
  getDailySettlement: (date) => apiFetch(`/admin/settlement/daily${date ? `?date=${date}` : ''}`),
  confirmSettlement: (data) => apiFetch('/admin/settlement/confirm', { method: 'POST', body: JSON.stringify(data) }),

  // Kirim-chiqim (platformaning o'z xarajatlari)
  getExpenses: (q = '') => apiFetch(`/admin/expenses${q}`),
  createExpense: (data) => apiFetch('/admin/expenses', { method: 'POST', body: JSON.stringify(data) }),
  deleteExpense: (id) => apiFetch(`/admin/expenses/${id}`, { method: 'DELETE' }),

  // Xodimlar (LokmaGo jamoasi) — faqat admin
  getStaff: () => apiFetch('/admin/staff'),
  getStaffDepartments: () => apiFetch('/admin/staff/departments'),
  createStaff: (data) => apiFetch('/admin/staff', { method: 'POST', body: JSON.stringify(data) }),
  updateStaff: (id, data) => apiFetch(`/admin/staff/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteStaff: (id) => apiFetch(`/admin/staff/${id}`, { method: 'DELETE' }),

  // Kuryerlar ro'yxati (2026-08)
  getCouriers: () => apiFetch('/admin/couriers'),
  createCourier: (data) => apiFetch('/admin/couriers', { method: 'POST', body: JSON.stringify(data) }),
  updateCourier: (id, data) => apiFetch(`/admin/couriers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCourier: (id) => apiFetch(`/admin/couriers/${id}`, { method: 'DELETE' }),

  // Reklama (banner) so'rovlari — tasdiqlash/rad etish
  getAllAds: (status) => apiFetch(`/admin/ads${status ? `?status=${status}` : ''}`),
  approveAd: (id) => apiFetch(`/admin/ads/${id}/approve`, { method: 'PATCH' }),
  rejectAd: (id, reason) => apiFetch(`/admin/ads/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) }),

  // Komissiya shartnomalari (restoran bo'yicha alohida kelishuv)
  getAgreements: () => apiFetch('/admin/agreements'),
  setAgreement: (restaurantId, data) => apiFetch(`/admin/agreements/${restaurantId}`, {
    method: 'PUT', body: JSON.stringify(data),
  }),
  agreementHistory: (restaurantId) => apiFetch(`/admin/agreements/${restaurantId}/history`),
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
