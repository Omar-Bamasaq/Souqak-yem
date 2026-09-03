const CACHE_NAME = "suqaq-pwa-v4";
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
            return caches.match("/index.html").then((fallback) =>
              fallback || new Response("Offline", {
                status: 503,
                statusText: "Offline",
                headers: { "Content-Type": "text/plain; charset=utf-8" }
              })
            );
          }
          return new Response("", { status: 503, statusText: "Service Unavailable" });
        });

        return cachedResponse || fetchedResponse;
      });
    })
  );
});

// Push Event - Handle incoming push notifications
self.addEventListener("push", (event) => {
  if (!(self.Notification && self.Notification.permission === "granted")) {
    return;
  }

  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "سوقك", body: event.data.text() };
    }
  }

  const title = data.title || "سوقك";
  const options = {
    body: data.body || "",
    icon: data.icon || "/pwa/icon-192x192.png",
    badge: data.badge || "/pwa/icon-96x96.png",
    silent: data.silent === true,
    vibrate: Array.isArray(data.vibrate) ? data.vibrate : [100, 50, 100],
    data: {
      url: data.data?.url || "/",
      ...data.data
    },
    actions: [
      { action: "open", title: "عرض الآن" },
      { action: "close", title: "إغلاق" }
    ],
    // Ensure notification stays until interacted with (good for important alerts)
    requireInteraction: true 
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification Click Event - Handle user interaction
self.addEventListener("notificationclick", (event) => {
  const notification = event.notification;
  const action = event.action;

  notification.close();

  if (action === "close") return;

  const urlToOpen = notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open with the same URL, focus it
      for (let client of windowClients) {
        if (client.url === urlToOpen && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
