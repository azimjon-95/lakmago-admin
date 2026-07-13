





























const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

// Restoran token'i (login orqali olinadi). Demo uchun localStorage.
function token() {
  return localStorage.getItem('lokmago_panel_token') ?? '';
}

async function req(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token()}`,
      ...options.headers
    }
  });
  if (!res.ok) throw new Error(`API xatosi: ${res.status}`);
  return await res.json();
}

export const panelApi = {
  // Restoran buyurtmalari — backend'da restaurantId bo'yicha filter qo'shiladi
  getOrders: (restaurantId) =>
  req(`/restaurants/${restaurantId}/orders`),

  updateStatus: (orderId, status) =>
  req(`/orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  }),

  getDishes: (restaurantId) =>
  req(`/restaurants/${restaurantId}/dishes`),

  toggleDish: (dishId, isAvailable) =>
  req(`/dishes/${dishId}`, {
    method: 'PATCH',
    body: JSON.stringify({ isAvailable })
  })
};
