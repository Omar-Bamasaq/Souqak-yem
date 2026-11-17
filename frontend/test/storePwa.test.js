import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {
  buildStorePwaAppUrl,
  buildStorePwaLaunchUrl,
  buildStorePwaIconUrl,
  getStorePwaInstallInstructions,
  getStorePwaNotificationLink
} from "../src/utils/storePwa.js";

const STORE_ID = "64d3d93a1a2b3c4d5e6f7701";
const OTHER_STORE_ID = "64d3d93a1a2b3c4d5e6f7702";

test("store app URLs are fixed by database ID and reject mutable slugs", () => {
  assert.equal(
    buildStorePwaAppUrl(STORE_ID),
    `https://apps.souqak-yem.com/store/${STORE_ID}/`
  );
  assert.equal(
    buildStorePwaAppUrl(STORE_ID, "http://localhost:5000"),
    `http://localhost:5000/store/${STORE_ID}/`
  );
  assert.throws(() => buildStorePwaAppUrl("a-changeable-store-slug"), /database ID/);
  assert.throws(() => buildStorePwaAppUrl(STORE_ID, "https://apps.example.test/path"), /origin/);
});

test("store app icons use the immutable database ID and manual instructions are platform-aware", () => {
  assert.equal(
    buildStorePwaIconUrl(STORE_ID, 192, "https://api.example.test/api/"),
    `https://api.example.test/api/stores/by-id/${STORE_ID}/pwa-icon/192.png`
  );
  assert.match(
    getStorePwaInstallInstructions({ userAgent: "Mozilla/5.0 (iPhone)" }),
    /إضافة إلى الشاشة الرئيسية/
  );
  assert.match(
    getStorePwaInstallInstructions({ userAgent: "Mozilla/5.0 (Windows NT 10.0)" }),
    /قائمة المتصفح/
  );
  assert.match(
    getStorePwaInstallInstructions({ userAgent: "Mozilla/5.0 (Linux; Android 14)" }),
    /قائمة Chrome/
  );
  assert.match(
    getStorePwaInstallInstructions({ userAgent: "Mozilla/5.0 (iPhone)" }),
    /Safari/
  );
});

test("Android store launch tries Chrome while preserving a normal URL for other platforms", () => {
  const appUrl = buildStorePwaAppUrl(STORE_ID);
  assert.equal(buildStorePwaLaunchUrl(STORE_ID), appUrl);

  const intentUrl = buildStorePwaLaunchUrl(STORE_ID, {
    userAgent: "Mozilla/5.0 (Linux; Android 14)"
  });
  assert.match(intentUrl, /^intent:\/\/apps\.souqak-yem\.com\/store\//);
  assert.match(intentUrl, /package=com\.android\.chrome/);
  assert.ok(intentUrl.includes(encodeURIComponent(appUrl)));

  const installAttemptUrl = buildStorePwaLaunchUrl(STORE_ID, {
    userAgent: "Mozilla/5.0 (Linux; Android 14)",
    installAttempt: true
  });
  assert.match(installAttemptUrl, /pwaInstallAttempt=1/);
  assert.ok(installAttemptUrl.includes(encodeURIComponent(`${appUrl}?pwaInstallAttempt=1`)));
  assert.doesNotMatch(installAttemptUrl, /accessToken|refreshToken|handoffToken/i);
});

test("store notification links stay on the main app and resolve to the right independent app", () => {
  const notification = {
    link: "/store/old-slug",
    storeProfileId: STORE_ID,
    data: { storeProfileId: STORE_ID, storePwaUrl: `https://apps.souqak-yem.com/store/${STORE_ID}/` }
  };
  assert.equal(getStorePwaNotificationLink(notification, null), notification.link);
  assert.equal(getStorePwaNotificationLink(notification, { storeId: STORE_ID }), "/");
  assert.equal(getStorePwaNotificationLink({
    link: "/store/old-slug",
    storeProfileId: STORE_ID
  }, { storeId: STORE_ID, slug: "old-slug" }), "/");
  assert.equal(
    getStorePwaNotificationLink(notification, { storeId: OTHER_STORE_ID }),
    notification.data.storePwaUrl
  );
  assert.equal(
    getStorePwaNotificationLink({
      ...notification,
      data: { ...notification.data, storePwaUrl: `https://attacker.example/store/${STORE_ID}/` }
    }, { storeId: OTHER_STORE_ID }),
    notification.link
  );
});

test("storefront delegates installation to the dedicated app without mutating the market manifest", () => {
  const root = process.cwd();
  const storefront = fs.readFileSync(path.join(root, "src", "pages", "Storefront.jsx"), "utf8");
  const installPrompt = fs.readFileSync(path.join(root, "src", "components", "PWAInstallPrompt.jsx"), "utf8");
  const main = fs.readFileSync(path.join(root, "src", "main.jsx"), "utf8");
  const globalManifest = JSON.parse(fs.readFileSync(path.join(root, "public", "manifest.json"), "utf8"));
  const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");

  assert.match(storefront, /buildStorePwaLaunchUrl\(store\._id/);
  assert.match(storefront, /preparedHandoffIsCurrent/);
  assert.match(storefront, /href=\{storeAppLaunchUrl\}/);
  assert.match(storefront, /pwa:store-install-request/);
  assert.match(storefront, /installAttempt:\s*true/);
  assert.match(storefront, /"طريقة التثبيت"/);
  assert.match(installPrompt, /canShowStorePwaInstallGuide/);
  assert.match(installPrompt, /params\.get\("pwaInstallAttempt"\)/);
  assert.match(installPrompt, /source:\s*"market-install"/);
  assert.match(installPrompt, /source === "method-button"/);
  assert.match(installPrompt, /ثبّت تطبيق المتجر/);
  assert.match(installPrompt, /اختر «فتح في Chrome»/);
  assert.doesNotMatch(storefront, /window\.open\("about:blank"/);
  assert.match(storefront, /store:\$\{data\.store\._id\}/);
  assert.match(storefront, /storePwaAppContext\?\.slug/);
  assert.doesNotMatch(storefront, /applyStoreManifest|restoreGlobalManifest|getStorePwaInstallFallback/);
  assert.match(main, /basename=\{window\.__SOUQAK_STORE_PWA_APP__\?\.basePath\}/);
  assert.match(main, /utils\/pwaInstall\.js/);
  assert.equal(globalManifest.start_url, "/");
  assert.match(indexHtml, /href="\/manifest\.json"/);
});

test("push notification click targets the store app only on its configured origin", async () => {
  const source = fs.readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8");
  const listeners = new Map();
  const shown = [];
  const storePwaUrl = `https://apps.souqak-yem.com/store/${STORE_ID}/`;
  const context = {
    self: {
      location: { origin: "https://apps.souqak-yem.com" },
      addEventListener(name, callback) { listeners.set(name, callback); },
      registration: { showNotification: async (_title, options) => { shown.push(options); } }
    },
    URL,
    console
  };
  vm.runInNewContext(source, context);

  await listeners.get("push")({
    data: { json: () => ({
      title: "إشعار متجر",
      data: {
        url: "/store/old-slug",
        storeProfileId: STORE_ID,
        storePwaUrl
      }
    }) },
    waitUntil(promise) { return promise; }
  });
  assert.equal(shown[0].data.url, storePwaUrl);

  context.self.location.origin = "https://souqak-yem.com";
  await listeners.get("push")({
    data: { json: () => ({
      title: "إشعار متجر",
      data: {
        url: "/store/old-slug",
        storeProfileId: STORE_ID,
        storePwaUrl
      }
    }) },
    waitUntil(promise) { return promise; }
  });
  assert.equal(shown[1].data.url, "/store/old-slug");
});

test("service-worker activation claims clients and preserves old caches during migration", async () => {
  const source = fs.readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8");
  const listeners = new Map();
  const deletedCaches = [];
  let activationPromise;
  const context = {
    self: {
      addEventListener(name, callback) { listeners.set(name, callback); },
      clients: { claim() {} },
      skipWaiting() { throw new Error("A newly installed worker must wait for safe activation."); }
    },
    caches: {
      keys: async () => ["suqaq-pwa-v5", "suqaq-pwa-v6", "another-app-cache"],
      delete: async (name) => { deletedCaches.push(name); }
    },
    console
  };
  vm.runInNewContext(source, context);

  listeners.get("activate")({ waitUntil(promise) { activationPromise = promise; } });
  await activationPromise;
  assert.deepEqual(deletedCaches, []);
});

test("stable dedicated-store app assets bypass the shared service-worker cache", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8");
  const listeners = new Map();
  const context = {
    self: {
      addEventListener(name, callback) { listeners.set(name, callback); },
      location: { origin: "https://apps.example.test" }
    },
    URL
  };
  vm.runInNewContext(source, context);

  for (const pathname of ["/assets/store-pwa-entry.js", "/assets/store-pwa.css"]) {
    let intercepted = false;
    listeners.get("fetch")({
      request: {
        method: "GET",
        url: `https://apps.example.test${pathname}`,
        mode: "no-cors"
      },
      respondWith() { intercepted = true; }
    });
    assert.equal(intercepted, false, `${pathname} should be fetched fresh by the browser`);
  }
});
