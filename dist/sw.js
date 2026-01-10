const CACHE_NAME = 'v25';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/manifest.json',
  '/js/app.js',
  '/js/title.js',
  '/js/settings.js',
  '/js/sync.js',
  '/js/autoupdate.js',
  '/js/config.js',
  '/js/vendor/firebase-app.js',
  '/js/vendor/firebase-auth.js',
  '/js/vendor/firebase-firestore.js',
  /* App Icons */
  '/appicons/32.png',
  '/appicons/152.png',
  '/appicons/167.png',
  '/appicons/180.png',
  '/appicons/192.png',
  '/appicons/512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachePromises = ASSETS_TO_CACHE.map(async (url) => {
        try {
          // Bypasses browser cache to ensure fresh assets
          const freshUrl = `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`;
          const response = await fetch(freshUrl, { cache: 'no-store' });
          if (response.ok) {
            return cache.put(url, response);
          }
        } catch (error) {
          console.error('failed to cache:', url, error);
        }
      });
      return Promise.all(cachePromises);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
    .then(() => self.clients.claim()) 
    .then(async () => {
      // Notifies autoupdate.js to reload the page
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(client => {
        client.postMessage({ type: 'RELOAD_PAGE' });
      });
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);

  // --- NUCLEAR FIX 1: IGNORE FIREBASE AUTH ---
  // This is the missing piece! It stops SW from breaking the login iframe.
  if (url.pathname.startsWith('/__/auth/') || url.pathname.includes('googleapis.com')) {
      return; 
  }

  // --- NUCLEAR FIX 2: SAME-ORIGIN ONLY ---
  if (url.origin !== location.origin) {
      return; 
  }

  // Only handle http/https requests
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          const cacheCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, cacheCopy));
        }
        return networkResponse;
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});