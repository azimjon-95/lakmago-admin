// LokmaGo panel — markaziy API klienti (admin + restoran uchun umumiy)
const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

const TOKEN_KEY = 'lokmago_panel_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) ?? '';
}
export function setToken(t) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    clearToken();
    throw new Error('Sessiya tugadi. Qaytadan kiring.');
  }
  if (!res.ok) {
    let msg = `Xato: ${res.status}`;
    try {
      const j = await res.json();
      if (j.error) msg = j.error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  return res.json();
}

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000';

/**
 * Faylni token bilan yuklab oladi.
 *
 * window.open ishlatib bo'lmaydi — u Authorization sarlavhasini
 * yubormaydi va 401 qaytadi.
 */
export async function downloadFile(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
  });

  if (!res.ok) {
    let msg = 'Yuklab bo‘lmadi';
    try {
      const data = await res.json();
      msg = data.error || msg;
    } catch { /* JSON emas */ }
    throw new Error(msg);
  }

  return res.blob();
}
