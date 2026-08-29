const CACHE_NAME = 'seedflix-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/site.webmanifest',
  '/favicon.svg',
  '/favicon-96x96.png',
  '/apple-touch-icon.png',
  '/web-app-manifest-192x192.png',
  '/web-app-manifest-512x512.png',
];

// Install: precache offline assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

// Activate: clean up old caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Fetch handler: Network-First for navigation / API bypass, Cache-First for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass non-GET requests and API calls / SSE streams
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  // Navigation requests: try network first, fallback to cached index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match('/index.html');
        return cachedResponse || Response.error();
      }),
    );
    return;
  }

  // Static assets (images, icons, scripts, styles): Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === 'basic'
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    }),
  );
});

// Push Notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    event.waitUntil(
      self.registration.showNotification(payload.title || 'SeedFlix', {
        body: payload.message || '',
        icon: '/web-app-manifest-192x192.png',
        badge: '/favicon-96x96.png',
        data: { url: payload.url || '/notifications' },
        tag: `seedflix-${payload.type || 'info'}`,
      }),
    );
  } catch (err) {
    console.error('Error handling push event:', err);
  }
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(
    event.notification.data?.url || '/notifications',
    self.location.origin,
  ).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const existingClient = clients.find((client) =>
          client.url.startsWith(self.location.origin),
        );
        if (existingClient) {
          existingClient.navigate(targetUrl);
          return existingClient.focus();
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});