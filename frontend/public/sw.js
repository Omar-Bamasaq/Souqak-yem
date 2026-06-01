const CACHE_NAME = "suqaq-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/favicon.svg",
  "/icon-cart.svg"
];

// Install Event
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event
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

// Fetch Event - Cache First Strategy for Static Assets
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip API requests and Socket.io
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/socket.io")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) return response;

      return fetch(event.request).then((fetchResponse) => {
        // Cache images and static assets dynamically
        if (
          event.request.destination === "image" ||
          event.request.destination === "font" ||
          url.pathname.endsWith(".js") ||
          url.pathname.endsWith(".css")
        ) {
          const responseToCache = fetchResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return fetchResponse;
      });
    }).catch(() => {
      // Offline fallback for navigation requests
      if (event.request.mode === "navigate") {
        return caches.match("/index.html");
      }
    })
  );
});