const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

function token() {
  return localStorage.getItem('lokmago_admin_token') ?? '';
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

export interface AdminStats {
  restaurants: number;
  pendingRestaurants: number;
  users: number;
  orders: number;
  totalRevenue: number;
  commission: number;
}

export interface AdminRestaurant {
  _id: string;
  name: string;
  cuisine: string;
  category: string;
  isApproved: boolean;
  createdAt: string;
}

export const adminApi = {
  getStats: () => req<AdminStats>('/admin/stats'),
  getRestaurants: (status?: string) =>
    req<AdminRestaurant[]>(`/admin/restaurants${status ? `?status=${status}` : ''}`),
  approve: (id: string, approved: boolean) =>
    req<AdminRestaurant>(`/admin/restaurants/${id}/approve`, {
      method: 'PATCH',
      body: JSON.stringify({ approved }),
    }),
};
