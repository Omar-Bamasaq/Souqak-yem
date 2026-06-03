const CACHE_NAME = "suqaq-pwa-v3";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/favicon.svg",
  "/icon-cart.svg",
  "/manifest.json"
];

// Install Event - Pre-cache critical assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Pre-caching assets...");
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event - Clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 1. Skip non-GET requests, API, and Socket.io
  if (
    event.request.method !== "GET" || 
    url.pathname.startsWith("/api") || 
    url.pathname.startsWith("/socket.io") ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  // 2. Strategy: Stale-While-Revalidate for most assets
  // This is best for Yemen's weak internet as it shows content immediately 
  // from cache while updating it in the background.
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchedResponse = fetch(event.request).then((networkResponse) => {
          // Only cache successful responses
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // If network fails and no cache, return offline fallback
          if (event.request.mode === "navigate") {
            return caches.match("/index.html");
          }
        });

        return cachedResponse || fetchedResponse;
      });
    })
  );
});
