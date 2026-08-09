import { apiFetch } from '@/api/client';

/**
 * Web Push obunasi.
 *
 * Brauzer yopiq bo'lganda ham xabar yetib borishi uchun.
 * Ruxsat berilmasa yoki platforma qo'llamasa — jim o'tib
 * ketamiz, ilova baribir ishlaydi (foreground ovoz qoladi).
 */

const DEVICE_KEY = 'lokmago_device_id';

/** Shu brauzer uchun barqaror identifikator. */
export function deviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = `dev_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function pushSupported() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

/** VAPID kalitini brauzer kutgan formatga o'girish. */
function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

let registration = null;

/** Service Worker'ni ro'yxatdan o'tkazish (bir marta). */
export async function registerServiceWorker() {
  if (!pushSupported()) return null;
  if (registration) return registration;
  try {
    registration = await navigator.serviceWorker.register('/sw.js');
    return registration;
  } catch (e) {
    console.warn('[push] SW ro\u2018yxatdan o\u2018tmadi:', e.message);
    return null;
  }
}

/**
 * Obuna bo'lish. Ruxsat so'raladi.
 * @returns {'ok'|'denied'|'unsupported'|'error'}
 */
export async function subscribePush() {
  if (!pushSupported()) return 'unsupported';

  // Ruxsat rad etilgan bo'lsa qayta so'ramaymiz — brauzer
  // baribir bermaydi va foydalanuvchini bezovta qilamiz
  if (Notification.permission === 'denied') return 'denied';

  try {
    const reg = await registerServiceWorker();
    if (!reg) return 'unsupported';

    if (Notification.permission === 'default') {
      const res = await Notification.requestPermission();
      if (res !== 'granted') return 'denied';
    }

    const { key } = await apiFetch('/panel/push/key');
    if (!key) return 'unsupported';   // serverda VAPID sozlanmagan

    const existing = await reg.pushManager.getSubscription();
    const sub = existing || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });

    const json = sub.toJSON();
    await apiFetch('/panel/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
        deviceId: deviceId(),
      }),
    });

    return 'ok';
  } catch (e) {
    console.warn('[push] obuna bo\u2018lmadi:', e.message);
    return 'error';
  }
}

/** Chiqishda yoki push o'chirilganda. */
export async function unsubscribePush() {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;

    await apiFetch('/panel/push/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {});

    await sub.unsubscribe();
  } catch { /* ignore */ }
}
