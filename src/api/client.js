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

    // Yuklash foizi har doim kuzatiladi: tarmoq xatosining SABABINI aynan shu ajratadi (pastga qarang)
    let sent = 0; let total = 0;
    if (xhr.upload) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total) { sent = e.loaded / e.total; total = e.total; onProgress?.(sent); }
      };
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
    xhr.onerror = () => reject(uploadNetworkError(sent, total));
    xhr.ontimeout = () => reject(new Error('Vaqt tugadi. Video hajmini kamaytiring yoki qayta urining.'));
    xhr.onabort = () => reject(new Error('Bekor qilindi'));
    xhr.send(formData);
  });
}

/*
 * "Tarmoq xatosi"ning SABABI. Brauzer javob o'qib bo'lmaganda (ulanish uzildi YOKI proksi
 * CORS sarlavhasisiz xato qaytardi: nginx 413/502/504, Cloudflare 524) bitta bir xil xato
 * beradi — adminga hech narsa demaydi. Haqiqiy brauzerda takrorlab o'lchandi:
 *   nginx `client_max_body_size` kichik (413)     → xato 0% da, bir zumda
 *   ulanish yuklash o'rtasida uzildi (LTE, Wi-Fi) → xato o'rtada (masalan 30%)
 *   to'liq yuklandi, lekin javob kelmadi (504)     → xato 100% da
 * Shu foizdan sababni ajratamiz. (Kod `err.code` — kerak bo'lsa interfeys foydalanadi.)
 */
export function uploadNetworkError(sent, total, online = typeof navigator === 'undefined' || navigator.onLine !== false) {
  const mb = total ? `${(total / 1024 / 1024).toFixed(1)} MB` : '';
  let code; let msg;
  if (!online) {
    code = 'OFFLINE'; msg = 'Internet aloqasi yo‘q. Ulanishni tekshirib, qayta urining.';
  } else if (!total) {
    code = 'NETWORK'; msg = 'Tarmoq xatosi. Ulanishni tekshiring.';
  } else if (sent >= 0.99) {
    // Hammasi yuborildi, javob yo'q: server/proksi vaqti tugagan bo'lishi mumkin, reklama esa ketgan bo'lishi mumkin
    code = 'NO_RESPONSE';
    msg = `Video (${mb}) yuklandi, lekin server javob bermadi (proksi vaqt chegarasi). Reklama guruhga yuborilgan bo‘lishi mumkin — AVVAL GURUHNI TEKSHIRING, takror yubormang.`;
  } else if (sent < 0.1) {
    code = 'REJECTED_EARLY';
    msg = `Server faylni (${mb}) qabul qilmadi. Ko‘pincha sabab — serverdagi nginx \`client_max_body_size\` kichik: uni 55M qiling. (Internet uzilgan bo‘lsa, qayta urinib ko‘ring.)`;
  } else {
    code = 'CONNECTION_LOST';
    msg = `Ulanish yuklash paytida uzildi (${Math.round(sent * 100)}% yuklangan edi). Barqaror Wi‑Fi bilan qayta urining.`;
  }
  return Object.assign(new Error(msg), { code, status: 0 });
}

/*
 * ═══ VIDEO'NI BO'LAKLAB YUKLASH ═══
 * Server: middleware/adUpload.js (adUploadController).
 *
 * Bitta katta so'rov o'rniga 512 KB lik bo'laklar:
 *  • nginx `client_max_body_size` (standart 1 MB) chegarasiga urilmaydi —
 *    avval 8.9 MB video ~11% (≈1 MB) da "ulanish uzildi" bo'lardi;
 *  • mobil internet bir lahza uzilsa — faqat o'sha bo'lak qayta ketadi
 *    (6 martagacha, oshib boruvchi kutish bilan), boshidan emas;
 *  • 3 ta bo'lak parallel — tezroq.
 * Natija: `uploadId` — reklama so'roviga JSON maydon sifatida qo'shiladi.
 */
const CHUNK_PARALLEL = 3;
const CHUNK_RETRY_MS = [800, 1600, 3000, 5000, 8000, 12000];
const CHUNK_TIMEOUT_MS = 60_000;

function putChunk(url, blob, { onProgress, signal }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    if (getToken()) xhr.setRequestHeader('Authorization', `Bearer ${getToken()}`);
    xhr.timeout = CHUNK_TIMEOUT_MS;
    if (xhr.upload) xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded); };
    const onAbort = () => xhr.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    const done = (fn) => (arg) => { signal?.removeEventListener('abort', onAbort); fn(arg); };
    xhr.onload = done(() => {
      let json = null;
      try { json = JSON.parse(xhr.responseText); } catch { /* JSON emas */ }
      if (xhr.status >= 200 && xhr.status < 300) { resolve(json); return; }
      const err = new Error(json?.error || `Xato: ${xhr.status}`);
      err.status = xhr.status;
      err.code = json?.code;
      err.retryAfter = Number(xhr.getResponseHeader('Retry-After')) || 0;
      reject(err);
    });
    xhr.onerror = done(() => reject(Object.assign(new Error('Tarmoq xatosi'), { status: 0 })));
    xhr.ontimeout = done(() => reject(Object.assign(new Error('Vaqt tugadi'), { status: 0 })));
    xhr.onabort = done(() => reject(Object.assign(new Error('Bekor qilindi'), { status: -1 })));
    xhr.send(blob);
  });
}

// Qayta urinsa bo'ladigan xato: tarmoq, vaqt, 408/429/5xx va "bo'lak to'liq kelmadi"
const retriable = (e) => e.status === 0 || e.status === 408 || e.status === 429 || e.status >= 500 || e.code === 'CHUNK_SIZE';
const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(Object.assign(new Error('Bekor qilindi'), { status: -1 })); }, { once: true });
});

/**
 * @param {File} file
 * @param {{ mimeType: string, onProgress?: (0..1)=>void, signal?: AbortSignal }} opts
 * @returns {Promise<string>} uploadId
 */
export async function uploadVideoChunked(file, { mimeType, onProgress, signal } = {}) {
  const init = await apiFetch('/admin/ad-uploads', {
    method: 'POST',
    body: JSON.stringify({ fileName: file.name || 'video', mimeType, size: file.size }),
  });
  const { uploadId, chunkSize, totalChunks } = init;

  const doneBytes = new Array(totalChunks).fill(0);   // har bo'lakning yuklangan qismi
  const report = () => onProgress?.(Math.min(1, doneBytes.reduce((a, b) => a + b, 0) / file.size));
  report();

  // Bitta bo'lak butunlay yiqilsa — qolganlari ham darhol to'xtaydi
  const ctrl = new AbortController();
  const onOuter = () => ctrl.abort();
  if (signal?.aborted) ctrl.abort(); else signal?.addEventListener('abort', onOuter, { once: true });
  const inner = ctrl.signal;
  let firstError = null;

  let next = 0;
  const worker = async () => {
    while (next < totalChunks) {
      const i = next++;
      const blob = file.slice(i * chunkSize, Math.min(file.size, (i + 1) * chunkSize));
      for (let attempt = 0; ; attempt += 1) {
        if (inner.aborted) throw Object.assign(new Error('Bekor qilindi'), { status: -1 });
        try {
          await putChunk(`${API_BASE}/admin/ad-uploads/${uploadId}/chunks/${i}`, blob, {
            signal: inner,
            onProgress: (loaded) => { doneBytes[i] = Math.min(loaded, blob.size); report(); },
          });
          doneBytes[i] = blob.size;
          report();
          break;
        } catch (e) {
          doneBytes[i] = 0;
          report();
          if (e.status === 401) { clearToken(); throw new Error('Sessiya tugadi. Qaytadan kiring.'); }
          if (!retriable(e) || attempt >= CHUNK_RETRY_MS.length) {
            if (e.status === 0) {
              throw Object.assign(new Error(typeof navigator !== 'undefined' && navigator.onLine === false
                ? 'Internet aloqasi yo‘q. Ulanishni tekshirib, qayta urining.'
                : 'Internet juda beqaror — video yuklanmadi. Birozdan keyin qayta urining.'), { code: 'CONNECTION_LOST', status: 0 });
            }
            throw e;
          }
          await sleep(Math.max(CHUNK_RETRY_MS[attempt], (e.retryAfter || 0) * 1000), inner);
        }
      }
    }
  };
  const guarded = () => worker().catch((e) => {
    if (!firstError && e.status !== -1) firstError = e;
    ctrl.abort();
    throw e;
  });
  try {
    await Promise.all(Array.from({ length: Math.min(CHUNK_PARALLEL, totalChunks) }, guarded));
  } catch (e) {
    throw firstError || e;
  } finally {
    signal?.removeEventListener('abort', onOuter);
  }
  onProgress?.(1);
  return uploadId;
}
