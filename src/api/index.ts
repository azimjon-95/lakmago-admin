export type OrderStatus = 'accepted' | 'preparing' | 'delivering' | 'delivered' | 'cancelled';

export interface OrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface PanelOrder {
  _id: string;
  restaurantName: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  address: string;
  createdAt: string;
}

export interface PanelDish {
  _id: string;
  section: string;
  name: string;
  description: string;
  price: number;
  oldPrice?: number;
  icon: string;
  tint: string;
  isAvailable: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

// Restoran token'i (login orqali olinadi). Demo uchun localStorage.
function token() {
  return localStorage.getItem('lokmago_panel_token') ?? '';
}

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token()}`,
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`API xatosi: ${res.status}`);
  return (await res.json()) as T;
}

export const panelApi = {
  // Restoran buyurtmalari — backend'da restaurantId bo'yicha filter qo'shiladi
  getOrders: (restaurantId: string) =>
    req<PanelOrder[]>(`/restaurants/${restaurantId}/orders`),

  updateStatus: (orderId: string, status: OrderStatus) =>
    req<PanelOrder>(`/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  getDishes: (restaurantId: string) =>
    req<PanelDish[]>(`/restaurants/${restaurantId}/dishes`),

  toggleDish: (dishId: string, isAvailable: boolean) =>
    req<PanelDish>(`/dishes/${dishId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isAvailable }),
    }),
};
