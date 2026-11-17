import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {
  canReloadPwaBuild,
  createPwaUpdateSafetyTracker,
  createPwaUpdateCheckScheduler,
  PWA_FORCE_CHECK_INTERVAL_MS,
  PWA_UPDATE_CHECK_INTERVAL_MS,
  shouldCheckForPwaUpdate,
  resolvePwaRegistrationScope,
  shouldReloadForPwaController
} from "../src/utils/pwaUpdate.js";

const serviceWorkerSource = fs.readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8");
const legacyServiceWorkerSource = fs.readFileSync(
  path.join(process.cwd(), "test", "fixtures", "sw.v6.js.txt"),
  "utf8"
);

function createServiceWorkerContext({
  clients = [],
  caches = {},
  buildId = "test-build",
  origin = "https://souqak.example.test",
  source = serviceWorkerSource
} = {}) {
  const listeners = new Map();
  const calls = { skipWaiting: 0, claimed: 0, deleted: [] };
  const context = {
    self: {
      location: { origin },
      addEventListener(name, callback) { listeners.set(name, callback); },
      clients: {
        async matchAll() { return clients; },
        claim() { calls.claimed += 1; }
      },
      skipWaiting() { calls.skipWaiting += 1; },
      registration: { showNotification: async () => {} }
    },
    caches: {
      async keys() { return Object.keys(caches); },
      async has(name) { return Object.prototype.hasOwnProperty.call(caches, name); },
      async open(name) {
        if (!caches[name]) caches[name] = new Map();
        const cache = caches[name];
        return {
          async match(request) {
            const response = cache.get(typeof request === "string" ? request : request.url);
            return response?.clone() || null;
          },
          async keys() {
            return Array.from(cache.keys()).map((url) => new Request(url));
          },
          async put(request, response) {
            cache.set(
              typeof request === "string" ? request : request.url,
              response.clone()
            );
          },
          async delete(request) {
            return cache.delete(typeof request === "string" ? request : request.url);
          },
          async addAll(requests) {
            for (const request of requests) cache.set(request, new Response("legacy asset"));
          }
        };
      },
      async delete(name) {
        calls.deleted.push(name);
        delete caches[name];
      }
    },
    URL,
    Request,
    Response,
    Map,
    Promise,
    Date,
    Math,
    queueMicrotask,
    setTimeout,
    clearTimeout,
    fetch: async () => { throw new Error("Unexpected network request"); },
    console
  };
  vm.runInNewContext(source.replace("__SOUQAK_BUILD_ID__", buildId), context);
  return { listeners, calls, context, caches };
}

function createFakeDocument() {
  const listeners = new Map();
  return {
    activeElement: null,
    addEventListener(name, callback) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(callback);
    },
    removeEventListener(name, callback) {
      listeners.get(name)?.delete(callback);
    },
    dispatch(name, target) {
      for (const callback of listeners.get(name) || []) callback({ target });
    }
  };
}

function createForm() {
  const control = {
    name: "description",
    type: "text",
    tagName: "INPUT",
    value: "",
    isConnected: true,
    matches(selector) { return selector.includes("input"); },
    closest() { return form; }
  };
  const form = {
    elements: [control],
    isConnected: true
  };
  control.form = form;
  return { form, control };
}

test("update checks happen on startup and are throttled while offline or recently checked", () => {
  assert.equal(shouldCheckForPwaUpdate(10_000, 0), true);
  assert.equal(shouldCheckForPwaUpdate(20_000, 10_000), false);
  assert.equal(
    shouldCheckForPwaUpdate(10_000 + PWA_UPDATE_CHECK_INTERVAL_MS, 10_000),
    true
  );
  assert.equal(shouldCheckForPwaUpdate(2_000_000, 0, false), false);
});

test("the release commit, not build time or randomness, versions the worker and bundle", () => {
  const viteConfig = fs.readFileSync(path.join(process.cwd(), "vite.config.js"), "utf8");
  assert.match(viteConfig, /process\.env\.SOUQAK_BUILD_ID/);
  assert.match(viteConfig, /git",\s*\["rev-parse",\s*"--verify",\s*"HEAD"\]/);
  assert.doesNotMatch(viteConfig, /Date\.now|randomUUID/);
});

test("returning from background checks after the throttle and retries after connectivity returns", async () => {
  let currentTime = 100_000;
  let online = true;
  let checks = 0;
  const check = createPwaUpdateCheckScheduler({
    now: () => currentTime,
    isOnline: () => online,
    async update() { checks += 1; }
  });

  assert.equal(await check(true), true);
  currentTime += PWA_UPDATE_CHECK_INTERVAL_MS - 1;
  assert.equal(await check(), false);
  assert.equal(checks, 1);
  online = false;
  currentTime += PWA_UPDATE_CHECK_INTERVAL_MS;
  assert.equal(await check(), false);
  online = true;
  assert.equal(await check(), true);
  assert.equal(checks, 2);
});

test("reconnection checks coalesce and forced retries respect a cooldown", async () => {
  let currentTime = 100_000;
  let online = true;
  let checks = 0;
  const check = createPwaUpdateCheckScheduler({
    now: () => currentTime,
    isOnline: () => online,
    async update() {
      checks += 1;
      await Promise.resolve();
    }
  });

  await Promise.all([check(true), check(true), check(true)]);
  assert.equal(checks, 1);
  currentTime += PWA_FORCE_CHECK_INTERVAL_MS - 1;
  await check(true);
  assert.equal(checks, 1);
  currentTime += 1;
  online = false;
  assert.equal(await check(true), false);
  online = true;
  await check();
  assert.equal(checks, 1);
  currentTime += PWA_UPDATE_CHECK_INTERVAL_MS;
  await check();
  assert.equal(checks, 2);
});

test("failed checks back off on unstable connectivity instead of retrying on every online event", async () => {
  let currentTime = 500_000;
  let checks = 0;
  const check = createPwaUpdateCheckScheduler({
    now: () => currentTime,
    isOnline: () => true,
    async update() {
      checks += 1;
      throw new Error("temporary network failure");
    },
    onError() {}
  });

  assert.equal(await check(), false);
  assert.equal(await check(), false);
  assert.equal(checks, 1);
  currentTime += PWA_FORCE_CHECK_INTERVAL_MS;
  assert.equal(await check(), false);
  assert.equal(checks, 2);
});

test("build reloads are blocked while unsafe and limited to once per build", () => {
  assert.equal(canReloadPwaBuild("new-build", null, false), false);
  assert.equal(canReloadPwaBuild("new-build", null, true), true);
  assert.equal(canReloadPwaBuild("new-build", "new-build", true), false);
});

test("store apps update the applicable same-origin scope and do not reload repeatedly", () => {
  const origin = "https://apps.souqak-yem.com";
  const storeBasePath = "/store/6afb32817b4c1d7be10e0718";
  assert.equal(
    resolvePwaRegistrationScope(origin, storeBasePath, `${origin}${storeBasePath}/`),
    `${storeBasePath}/`
  );
  assert.equal(resolvePwaRegistrationScope(origin, storeBasePath, `${origin}/`), "/");
  assert.equal(
    resolvePwaRegistrationScope(
      origin,
      storeBasePath,
      `${origin}${storeBasePath}/products/`
    ),
    `${storeBasePath}/products/`
  );
  assert.equal(
    resolvePwaRegistrationScope(
      origin,
      storeBasePath,
      `${origin}/store/64d3d93a1a2b3c4d5e6f7701/`
    ),
    "/"
  );
  assert.equal(
    resolvePwaRegistrationScope(origin, storeBasePath, "https://souqak-yem.com/"),
    "/"
  );

  assert.equal(shouldReloadForPwaController("build-a", "build-b", null), true);
  assert.equal(shouldReloadForPwaController("build-a", "build-b", "build-a"), false);
  assert.equal(shouldReloadForPwaController("build-a", "build-a", null), false);
});

test("unsaved form edits defer updates and restoring the original value becomes safe", () => {
  const document = createFakeDocument();
  const tracker = createPwaUpdateSafetyTracker({ document });
  const { control } = createForm();

  document.activeElement = control;
  document.dispatch("focusin", control);
  assert.equal(tracker.isSafe(), false);
  control.value = "غير محفوظ";
  document.dispatch("input", control);
  document.activeElement = null;
  assert.equal(tracker.isSafe(), false);

  control.value = "";
  document.dispatch("input", control);
  assert.equal(tracker.isSafe(), true);
  tracker.destroy();
});

test("submitted forms remain protected during mutations and become safe after successful save", () => {
  const document = createFakeDocument();
  const tracker = createPwaUpdateSafetyTracker({ document });
  const { form, control } = createForm();
  document.activeElement = control;
  document.dispatch("focusin", control);
  control.value = "محفوظ";
  document.dispatch("input", control);
  document.activeElement = null;
  document.dispatch("submit", form);
  assert.equal(tracker.isSafe(), false);

  const request = { method: "post" };
  tracker.beginMutation(request);
  assert.equal(tracker.isSafe(), false);
  tracker.finishMutation(request, true);
  assert.equal(tracker.isSafe(), true);
  tracker.destroy();
});

test("failed form mutations preserve edited values without leaving a pending request lock", () => {
  const document = createFakeDocument();
  const tracker = createPwaUpdateSafetyTracker({ document });
  const { form, control } = createForm();
  document.activeElement = control;
  document.dispatch("focusin", control);
  control.value = "احتفظ بهذا النص";
  document.dispatch("input", control);
  document.activeElement = null;
  document.dispatch("submit", form);

  const request = { method: "post" };
  tracker.beginMutation(request);
  tracker.finishMutation(request, false);
  assert.equal(tracker.isSafe(), false);
  tracker.destroy();
});

test("the actual v6 worker and a nonresponsive legacy tab cannot block the new worker", async () => {
  const legacyCache = new Map([
    ["https://souqak.example.test/assets/Legacy-12345678.js", new Response("legacy cached chunk")]
  ]);
  const caches = { "suqaq-pwa-v6": legacyCache, "foreign-app-cache": new Map() };
  let clientMessages = 0;
  const unresponsiveLegacyTab = { id: "legacy-tab", postMessage() { clientMessages += 1; } };
  const differentBuildTab = { id: "different-build-tab", postMessage() { clientMessages += 1; } };
  const legacy = createServiceWorkerContext({
    caches,
    clients: [unresponsiveLegacyTab, differentBuildTab],
    source: legacyServiceWorkerSource,
    buildId: "v6"
  });
  let legacyInstall;
  legacy.listeners.get("install")({
    waitUntil(promise) { legacyInstall = promise; }
  });
  await legacyInstall;
  assert.equal(legacy.calls.skipWaiting, 1);

  const current = createServiceWorkerContext({
    caches,
    clients: [unresponsiveLegacyTab, differentBuildTab],
    buildId: "new-release"
  });
  let install;
  current.listeners.get("install")({ waitUntil(promise) { install = promise; } });
  await install;
  assert.equal(current.calls.skipWaiting, 1);
  let activate;
  current.listeners.get("activate")({ waitUntil(promise) { activate = promise; } });
  await activate;
  assert.equal(current.calls.claimed, 1);
  assert.equal(clientMessages, 0);
  assert.ok(caches["suqaq-pwa-v6"]);
  assert.ok(caches["foreign-app-cache"]);
});

test("assets migrate lazily from v6 and unchanged fingerprints are reused across builds", async () => {
  const assetUrl = "https://souqak.example.test/assets/Home-12345678.js";
  const previousResponse = new Response("unchanged-content", {
    headers: { "content-type": "text/javascript" }
  });
  const caches = {
    "suqaq-pwa-v6": new Map([[assetUrl, previousResponse]])
  };
  for (const buildId of ["release-1", "release-2", "release-3"]) {
    const worker = createServiceWorkerContext({ caches, buildId });
    let responsePromise;
    worker.listeners.get("fetch")({
      request: new Request(assetUrl),
      respondWith(promise) { responsePromise = promise; }
    });
    const response = await responsePromise;
    assert.equal(await response.text(), "unchanged-content");
  }
  assert.equal(Object.keys(caches).filter((name) => name.startsWith("suqaq-pwa-")).length, 2);
  assert.equal(caches["suqaq-pwa-assets-v1"].has(assetUrl), true);
  assert.equal(caches["suqaq-pwa-v6"].has(assetUrl), true);
  assert.equal(caches["suqaq-pwa-assets-v1"].size, 1);
});

test("asset cache has a fixed entry limit through consecutive releases", async () => {
  const caches = {};
  for (let release = 1; release <= 3; release += 1) {
    const worker = createServiceWorkerContext({ caches, buildId: `release-${release}` });
    for (let index = 0; index < 205; index += 1) {
      const suffix = String(index).padStart(8, "0");
      const request = new Request(
        `https://souqak.example.test/assets/Chunk${release}-${suffix}.js`
      );
      let responsePromise;
      worker.context.fetch = async () => new Response(`release-${release}-${index}`, {
        headers: { "content-type": "text/javascript" }
      });
      worker.listeners.get("fetch")({
        request,
        respondWith(promise) { responsePromise = promise; }
      });
      await responsePromise;
    }
  }
  assert.equal(caches["suqaq-pwa-assets-v1"].size, 200);
  assert.deepEqual(
    Object.keys(caches).filter((name) => name.startsWith("suqaq-pwa-")),
    ["suqaq-pwa-assets-v1"]
  );
  assert.equal(
    caches["suqaq-pwa-assets-v1"].has(
      "https://souqak.example.test/assets/Chunk3-00000204.js"
    ),
    true
  );
});

test("main and apps origins keep same-named caches isolated", async () => {
  const mainCaches = {};
  const appsCaches = {};
  const mainWorker = createServiceWorkerContext({
    caches: mainCaches,
    buildId: "main-release"
  });
  const appsWorker = createServiceWorkerContext({
    caches: appsCaches,
    buildId: "apps-release",
    origin: "https://apps.souqak-yem.com"
  });
  const mainAssetUrl = "https://souqak.example.test/assets/Shared-12345678.js";
  const appsAssetUrl = "https://apps.souqak-yem.com/assets/Shared-12345678.js";
  mainWorker.context.fetch = async () => new Response("main origin", {
    headers: { "content-type": "text/javascript" }
  });
  appsWorker.context.fetch = async () => new Response("apps origin", {
    headers: { "content-type": "text/javascript" }
  });
  const fetchAsset = async (worker, url) => {
    let responsePromise;
    worker.listeners.get("fetch")({
      request: new Request(url),
      respondWith(promise) { responsePromise = promise; }
    });
    return responsePromise;
  };

  assert.equal(await (await fetchAsset(mainWorker, mainAssetUrl)).text(), "main origin");
  assert.equal(await (await fetchAsset(appsWorker, appsAssetUrl)).text(), "apps origin");
  assert.equal(mainCaches["suqaq-pwa-assets-v1"].has(mainAssetUrl), true);
  assert.equal(appsCaches["suqaq-pwa-assets-v1"].has(appsAssetUrl), true);
  assert.notEqual(mainCaches, appsCaches);
});

test("offline navigation falls back to a previously cached app shell", async () => {
  const rootUrl = "https://souqak.example.test/";
  const cachedShell = new Response("<html>cached shell</html>", {
    headers: { "content-type": "text/html" }
  });
  const worker = createServiceWorkerContext({
    caches: { "suqaq-pwa-shell-v1": new Map([[rootUrl, cachedShell]]) }
  });
  let responsePromise;
  const request = new Request("https://souqak.example.test/orders/42");
  Object.defineProperty(request, "mode", { value: "navigate" });
  worker.listeners.get("fetch")({
    request,
    respondWith(promise) { responsePromise = promise; }
  });
  const response = await responsePromise;
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "<html>cached shell</html>");
});

test("navigations bypass the browser HTTP cache for fresh HTML", async () => {
  let fetchOptions;
  const worker = createServiceWorkerContext();
  worker.context.fetch = async (_request, options) => {
    fetchOptions = options.cache;
    return new Response("<html>fresh</html>", {
      headers: { "content-type": "text/html" }
    });
  };
  let responsePromise;
  const request = new Request("https://souqak.example.test/");
  Object.defineProperty(request, "mode", { value: "navigate" });
  worker.listeners.get("fetch")({
    request,
    respondWith(promise) { responsePromise = promise; }
  });
  const response = await responsePromise;
  assert.equal(fetchOptions, "no-cache");
  assert.equal(response.status, 200);
});

test("old chunk failures remain recoverable without reloading unsafe or looping pages", async () => {
  const worker = createServiceWorkerContext();
  worker.context.fetch = async () => new Response("missing chunk", {
    status: 404,
    headers: { "content-type": "text/plain" }
  });
  let responsePromise;
  worker.listeners.get("fetch")({
    request: new Request("https://souqak.example.test/assets/OldChunk-12345678.js"),
    respondWith(promise) { responsePromise = promise; }
  });
  assert.equal((await responsePromise).status, 404);
  assert.equal(canReloadPwaBuild("old-release", null, false), false);
  assert.equal(canReloadPwaBuild("old-release", null, true), true);
  assert.equal(canReloadPwaBuild("old-release", "old-release", true), false);
});

test("cache quota failures do not replace successful navigation or asset responses", async () => {
  const worker = createServiceWorkerContext();
  worker.context.caches.open = async () => { throw new Error("quota"); };
  worker.context.fetch = async (request) => new Response(
    request.mode === "navigate" ? "<html>online</html>" : "const online = true;",
    {
      headers: {
        "content-type": request.mode === "navigate" ? "text/html" : "text/javascript"
      }
    }
  );
  const dispatch = async (request) => {
    let responsePromise;
    worker.listeners.get("fetch")({
      request,
      respondWith(promise) { responsePromise = promise; }
    });
    return responsePromise;
  };

  const navigation = new Request("https://souqak.example.test/");
  Object.defineProperty(navigation, "mode", { value: "navigate" });
  assert.equal((await dispatch(navigation)).status, 200);
  assert.equal((await dispatch(
    new Request("https://souqak.example.test/assets/Chunk-12345678.js")
  )).status, 200);
});

test("a form and a pending upload or purchase request both defer reload", () => {
  const document = createFakeDocument();
  const tracker = createPwaUpdateSafetyTracker({ document });
  const { form, control } = createForm();
  control.value = "بيانات طلب غير محفوظة";
  document.activeElement = control;
  document.dispatch("focusin", control);
  document.dispatch("input", control);
  document.activeElement = null;
  document.dispatch("submit", form);
  const mutation = { method: "post", data: new FormData() };
  tracker.beginMutation(mutation);

  assert.equal(tracker.isSafe(), false);
  assert.equal(canReloadPwaBuild("new-release", null, tracker.isSafe()), false);
  tracker.finishMutation(mutation, true);
  assert.equal(tracker.isSafe(), true);
  tracker.destroy();
});

test("main and independent store PWAs register the worker on their own origin", () => {
  const main = fs.readFileSync(path.join(process.cwd(), "src", "main.jsx"), "utf8");
  const updateManager = fs.readFileSync(path.join(process.cwd(), "src", "utils", "pwaUpdate.js"), "utf8");
  const storeEntry = fs.readFileSync(path.join(process.cwd(), "src", "storePwaEntry.jsx"), "utf8");
  const storePwa = fs.readFileSync(path.join(process.cwd(), "src", "utils", "storePwa.js"), "utf8");

  assert.match(main, /startPwaUpdateManager\(__SOUQAK_BUILD_ID__\)/);
  assert.match(updateManager, /getRegistration\(window\.location\.href\)/);
  assert.match(updateManager, /resolvePwaRegistrationScope\(/);
  assert.match(updateManager, /handleControllerChange\(\);\s*if \(pendingReload && checked\)/);
  assert.match(updateManager, /shouldReloadForPwaController\(/);
  assert.match(storeEntry, /main\.jsx/);
  assert.match(storePwa, /apps\.souqak-yem\.com/);
  assert.doesNotMatch(updateManager, /https:\/\/souqak-yem\.com/);
});
