const BUILD_ID = "__SOUQAK_BUILD_ID__";
const ASSET_CACHE = "suqaq-pwa-assets-v1";
const SHELL_CACHE = "suqaq-pwa-shell-v1";
const LEGACY_ASSET_CACHES = ["suqaq-pwa-v6"];
const MAX_CACHED_ASSETS = 200;
const MAX_CACHED_PAGES = 40;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  const message = event.data || {};
  if (message.type === "GET_BUILD_ID") {
    event.source?.postMessage({
      type: "BUILD_ID_RESPONSE",
      requestId: message.requestId,
      buildId: BUILD_ID
    });
  }
});

async function getCachedResponse(cacheName, request) {
  const cache = await caches.open(cacheName);
  return cache.match(request);
}

async function putBounded(cacheName, request, response, limit) {
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
  const requests = await cache.keys();
  for (let index = 0; index < requests.length - limit; index += 1) {
    await cache.delete(requests[index]);
  }
}

function reportCacheFailure(action, error) {
  console.warn(`[PWA] ${action} failed; continuing without the cache.`, {
    name: error?.name || "CacheOperationFailed"
  });
}

async function fetchNavigation(event) {
  const url = new URL(event.request.url);
  const cacheKey = new Request(`${url.origin}${url.pathname}`, {
    method: "GET",
    credentials: "same-origin"
  });
  let response;
  try {
    response = await fetch(event.request, { cache: "no-cache" });
  } catch {
    try {
      let cachedPage = await getCachedResponse(SHELL_CACHE, cacheKey);
      if (!cachedPage && !url.pathname.startsWith("/store/")) {
        cachedPage = await getCachedResponse(
          SHELL_CACHE,
          new Request(`${url.origin}/`, { method: "GET", credentials: "same-origin" })
        );
      }
      if (cachedPage) return cachedPage;
    } catch (error) {
      reportCacheFailure("Offline shell lookup", error);
    }
    return new Response("Offline", {
      status: 503,
      statusText: "Offline",
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }

  const contentType = response.headers.get("content-type") || "";
  if (response.ok && /text\/html/i.test(contentType)) {
    try {
      await putBounded(SHELL_CACHE, cacheKey, response.clone(), MAX_CACHED_PAGES);
    } catch (error) {
      reportCacheFailure("Navigation cache write", error);
    }
  }
  return response;
}

async function findCachedAsset(request) {
  for (const cacheName of [ASSET_CACHE, ...LEGACY_ASSET_CACHES]) {
    let response;
    try {
      if (cacheName !== ASSET_CACHE && !(await caches.has(cacheName))) continue;
      response = await getCachedResponse(cacheName, request);
    } catch (error) {
      reportCacheFailure("Asset cache lookup", error);
      continue;
    }
    if (!response) continue;
    if (cacheName !== ASSET_CACHE) {
      try {
        await putBounded(ASSET_CACHE, request, response.clone(), MAX_CACHED_ASSETS);
      } catch (error) {
        reportCacheFailure("Legacy asset migration", error);
      }
    }
    return response;
  }
  return null;
}

async function fetchVersionedAsset(event, url) {
  let cachedResponse = null;
  try {
    cachedResponse = await findCachedAsset(event.request);
  } catch (error) {
    reportCacheFailure("Asset cache lookup", error);
  }
  if (cachedResponse) return cachedResponse;

  let networkResponse;
  try {
    networkResponse = await fetch(event.request);
  } catch {
    return new Response("Asset unavailable", {
      status: 503,
      statusText: "Asset Unavailable",
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
  const contentType = networkResponse.headers.get("content-type") || "";
  const isJavaScript = url.pathname.endsWith(".js") && /javascript|ecmascript/i.test(contentType);
  const isStylesheet = url.pathname.endsWith(".css") && /text\/css/i.test(contentType);
  if (networkResponse.ok && (isJavaScript || isStylesheet)) {
    try {
      await putBounded(ASSET_CACHE, event.request, networkResponse.clone(), MAX_CACHED_ASSETS);
    } catch (error) {
      reportCacheFailure("Asset cache write", error);
    }
  }
  return networkResponse;
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET"
    || url.pathname.startsWith("/api")
    || url.pathname.startsWith("/socket.io")
    || url.origin !== self.location.origin
  ) return;

  if (event.request.mode === "navigate") {
    event.respondWith(fetchNavigation(event));
    return;
  }

  const isContentHashedAsset = url.pathname.startsWith("/assets/")
    && url.pathname !== "/assets/store-pwa-entry.js"
    && url.pathname !== "/assets/store-pwa.css"
    && /-[A-Za-z0-9_-]{8}\.(js|css)$/.test(url.pathname);
  if (isContentHashedAsset) {
    event.respondWith(fetchVersionedAsset(event, url));
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "سوقك", body: event.data.text() };
    }
  }

  let notificationUrl = data.data?.url || "/";
  const storeId = String(data.data?.storeProfileId || "");
  if (/^[a-f\d]{24}$/i.test(storeId) && typeof data.data?.storePwaUrl === "string") {
    try {
      const storePwaUrl = new URL(data.data.storePwaUrl);
      if (storePwaUrl.origin === self.location.origin
        && storePwaUrl.pathname === `/store/${storeId}/`
        && !storePwaUrl.search
        && !storePwaUrl.hash) {
        notificationUrl = storePwaUrl.href;
      }
    } catch {}
  }

  const title = data.title || "سوقك";
  const options = {
    body: data.body || "",
    icon: data.icon || "/pwa/icon-192x192.png",
    badge: data.badge || "/pwa/icon-96x96.png",
    silent: data.silent === true,
    vibrate: Array.isArray(data.vibrate) ? data.vibrate : [100, 50, 100],
    data: {
      ...data.data,
      url: notificationUrl
    },
    actions: [
      { action: "open", title: "عرض الآن" },
      { action: "close", title: "إغلاق" }
    ],
    requireInteraction: true
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  const notification = event.notification;
  const action = event.action;
  notification.close();
  if (action === "close") return;

  let urlToOpen = new URL("/", self.location.origin).href;
  try {
    const targetUrl = new URL(notification.data?.url || "/", self.location.origin);
    if (targetUrl.origin === self.location.origin) urlToOpen = targetUrl.href;
  } catch {}

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === urlToOpen && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(urlToOpen);
    })
  );
});
