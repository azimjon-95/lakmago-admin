import { resilientFetch } from '@/lib/resilientFetch';
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
  // Vaqt chegarasi + o'qishda qayta urinish (lib/resilientFetch.js)
  const res = await resilientFetch(`${API_BASE}${path}`, {
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
  /*
   * Katta hisobot (Excel) tayyorlanishi 15 soniyadan oshishi
   * mumkin — yuklab olish uchun chegara 60 soniya.
   */
  const res = await resilientFetch(`${API_BASE}${path}`, {
    timeoutMs: 60000,
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

/**
 * FormData (fayl) yuborish — YUKLASH PROGRESSI bilan.
 *
 * apiFetch bu ish uchun yaramaydi: u `Content-Type: application/json`
 * majburlaydi (multipart chegarasi yo'qoladi), qisqa vaqt chegarasi bor va
 * fetch yuklash progressini bermaydi. 50 MB video mobil tarmoqda daqiqalab
 * yuklanadi — admin "qotib qoldi"mi yoki ketyaptimi bilishi kerak.
 *
 * @param {string} path
 * @param {FormData} formData
 * @param {{ onProgress?: (fraction: number) => void, timeoutMs?: number, signal?: AbortSignal }} [opts]
 *   onProgress(0..1) — fayl serverga yuklanish ulushi. 1 bo'lgach server hali
 *   Telegram'ga uzatyapti bo'lishi mumkin (javob kelguncha).
 */
export function uploadForm(path, formData, { onProgress, timeoutMs = 10 * 60_000, signal } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}${path}`);
    // Content-Type QO'YILMAYDI — brauzer multipart chegarasini o'zi qo'yadi
    if (getToken()) xhr.setRequestHeader('Authorization', `Bearer ${getToken()}`);
    xhr.timeout = timeoutMs;

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => { if (e.lengthComputable && e.total) onProgress(e.loaded / e.total); };
    }
    if (signal) {
      if (signal.aborted) { reject(new Error('Bekor qilindi')); return; }
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }

    xhr.onload = () => {
      let json = null;
      try { json = JSON.parse(xhr.responseText); } catch { /* JSON emas */ }
      if (xhr.status === 401) { clearToken(); reject(new Error('Sessiya tugadi. Qaytadan kiring.')); return; }
      if (xhr.status >= 200 && xhr.status < 300) { resolve(json ?? {}); return; }
      const err = new Error(json?.error || `Xato: ${xhr.status}`);
      err.code = json?.code;
      err.status = xhr.status;
      reject(err);
    };
    xhr.onerror = () => reject(new Error('Tarmoq xatosi. Ulanishni tekshiring.'));
    xhr.ontimeout = () => reject(new Error('Vaqt tugadi. Video hajmini kamaytiring yoki qayta urining.'));
    xhr.onabort = () => reject(new Error('Bekor qilindi'));
    xhr.send(formData);
  });
}
