
const CACHE_NAME = 'ai-agent-lab-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  // Removed icon paths to prevent caching errors if files don't exist:
  // '/icons/icon-192x192.png',
  // '/icons/icon-512x512.png',
  // '/icons/icon-maskable-192x192.png',
  // '/icons/icon-maskable-512x512.png',
  // Note: JS/TSX files are bundled, so direct caching of source files like /index.tsx is not typical.
  // The browser will cache the bundled JS output.
  // Add paths to your bundled JS and CSS files here if they have stable names.
  // For example: '/assets/index.js', '/assets/index.css'
  // For now, we'll rely on the browser's default caching for bundled assets and Tailwind from CDN.
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // Use catch to prevent install failure if some resources are unavailable.
        // This is more forgiving but means some items might not be cached.
        return cache.addAll(urlsToCache).catch(error => {
          console.warn('Failed to cache some resources during install:', error);
          // Optionally, re-throw if critical resources failed, or handle gracefully.
        });
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // Serve from cache
        }
        return fetch(event.request).then(
          networkResponse => {
            // Optional: Cache new requests dynamically
            // Ensure we only cache GET requests and successful responses
            if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
              // Check if the request URL is something we want to cache dynamically.
              // Avoid caching e.g. API calls unless explicitly designed for it.
              const url = new URL(event.request.url);
              if (url.protocol.startsWith('http')) { // Only cache http/https resources
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME)
                  .then(cache => {
                    cache.put(event.request, responseToCache);
                  });
              }
            }
            return networkResponse;
          }
        ).catch(() => {
          // If both cache and network fail, you could return a fallback offline page.
          // For example: return caches.match('/offline.html');
          // For this app, we'll just let the network failure propagate.
          // This means if a cached resource is not found and network fails, user gets browser error.
        });
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
          return null;
        })
      );
    })
  );
});
