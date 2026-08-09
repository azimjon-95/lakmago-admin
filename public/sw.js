/* eslint-disable no-restricted-globals */

/**
 * Service Worker — brauzer yopiq bo'lganda ham bildirishnoma.
 *
 * Muhim cheklov: brauzer yopiq holatda o'z MP3 faylimizni
 * chalib bo'lmaydi. Bu platforma qoidasi, aylanib o'tishga
 * urinmaymiz — operatsion tizimning o'z bildirishnoma ovozi
 * ishlatiladi.
 *
 * Ilova ochiq bo'lsa push ko'rsatilmaydi: u holda Phase 1
 * dagi markaziy tizim o'z MP3 sini chaladi va ikki marta
 * bildirishnoma chiqmaydi.
 */

const TAG_PREFIX = 'lokmago-';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* bo'sh push */ }

  event.waitUntil(handlePush(data));
});

async function handlePush(data) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

  // Ilova ochiq va ko'rinib turibdimi
  const visible = clients.some((c) => c.visibilityState === 'visible');

  if (visible) {
    // Markaziy tizim o'zi ko'rsatadi va MP3 chaladi
    clients.forEach((c) => c.postMessage({ source: 'push', payload: data }));
    return;
  }

  const title = data.title || 'LokmaGo';
  await self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    // tag: bir hodisa ikki marta kelsa ustiga yozadi, ikkita
    // bildirishnoma chiqmaydi
    tag: TAG_PREFIX + (data.notificationId || Date.now()),
    renotify: data.priority === 'CRITICAL',
    requireInteraction: data.priority === 'CRITICAL',
    vibrate: data.priority === 'CRITICAL' ? [200, 100, 200, 100, 200] : [150, 80, 150],
    data: {
      url: data.url || '/',
      notificationId: data.notificationId || '',
    },
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    // Ilova allaqachon ochiq bo'lsa — yangi oyna ochmaymiz,
    // borini fokusga olib kerakli sahifaga o'tkazamiz
    for (const c of clients) {
      if ('focus' in c) {
        await c.focus();
        c.postMessage({ source: 'push-click', url });
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
});
