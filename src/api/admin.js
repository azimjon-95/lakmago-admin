const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

function token() {
  return localStorage.getItem('lokmago_admin_token') ?? '';
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



















export const adminApi = {
  getStats: () => req('/admin/stats'),
  getRestaurants: (status) =>
  req(`/admin/restaurants${status ? `?status=${status}` : ''}`),
  approve: (id, approved) =>
  req(`/admin/restaurants/${id}/approve`, {
    method: 'PATCH',
    body: JSON.stringify({ approved })
  })
};
