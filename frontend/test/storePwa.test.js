import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {
  buildStorePwaAppUrl,
  buildStorePwaIconUrl,
  getStorePwaInstallInstructions
} from "../src/utils/storePwa.js";

const STORE_ID = "64d3d93a1a2b3c4d5e6f7701";

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
});

test("storefront delegates installation to the dedicated app without mutating the market manifest", () => {
  const root = process.cwd();
  const storefront = fs.readFileSync(path.join(root, "src", "pages", "Storefront.jsx"), "utf8");
  const main = fs.readFileSync(path.join(root, "src", "main.jsx"), "utf8");
  const globalManifest = JSON.parse(fs.readFileSync(path.join(root, "public", "manifest.json"), "utf8"));
  const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");

  assert.match(storefront, /buildStorePwaAppUrl\(store\._id/);
  assert.match(storefront, /store:\$\{data\.store\._id\}/);
  assert.match(storefront, /storePwaAppContext\?\.slug/);
  assert.doesNotMatch(storefront, /applyStoreManifest|restoreGlobalManifest|getStorePwaInstallFallback/);
  assert.match(main, /basename=\{window\.__SOUQAK_STORE_PWA_APP__\?\.basePath\}/);
  assert.match(main, /utils\/pwaInstall\.js/);
  assert.equal(globalManifest.start_url, "/");
  assert.match(indexHtml, /href="\/manifest\.json"/);
});

test("service-worker activation removes only its own prior cache versions", async () => {
  const source = fs.readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8");
  const listeners = new Map();
  const deletedCaches = [];
  let activationPromise;
  const context = {
    self: {
      addEventListener(name, callback) { listeners.set(name, callback); },
      clients: { claim() {} },
      skipWaiting() {}
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

  assert.deepEqual(deletedCaches, ["suqaq-pwa-v5"]);
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
