import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { applyStoreManifest, buildStoreManifest, buildStorePwaIconUrl, restoreGlobalManifest } from "../src/utils/storePwa.js";

test("store manifest uses store identity, isolated scope, and size-specific PNG endpoints", () => {
  const slug = "بامسق-للأثاث";
  const iconUrls = {
    192: buildStorePwaIconUrl(slug, 192, "https://api.example.test/api/"),
    512: buildStorePwaIconUrl(slug, 512, "https://api.example.test/api/")
  };
  const manifest = buildStoreManifest({
    storeName: "بامسق للأثاث",
    slug,
    shortName: "بامسق للأثاث",
    iconUrls,
    origin: "https://shop.example.test"
  });

  assert.equal(manifest.name, "بامسق للأثاث");
  assert.equal(manifest.short_name, "بامسق للأثاث");
  assert.equal(manifest.id, manifest.start_url);
  assert.equal(manifest.start_url, "https://shop.example.test/store/%D8%A8%D8%A7%D9%85%D8%B3%D9%82-%D9%84%D9%84%D8%A3%D8%AB%D8%A7%D8%AB/");
  assert.equal(manifest.scope, manifest.start_url);
  assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ["192x192", "512x512"]);
  assert.ok(manifest.icons.every((icon) => icon.type === "image/png"));
  assert.ok(manifest.icons.every((icon) => icon.src.includes("/pwa-icon/")));
  assert.ok(manifest.icons.every((icon) => new URL(icon.src).origin === "https://api.example.test"));
});

test("applying a store manifest does not use global market icon paths", () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const elements = {
    manifest: { href: "/manifest.json" },
    theme: { content: "#0b89ed", setAttribute(_name, value) { this.content = value; } },
    apple: { content: "سوقك", setAttribute(_name, value) { this.content = value; } }
  };
  globalThis.document = {
    querySelector(selector) {
      if (selector === 'link[rel="manifest"]') return elements.manifest;
      if (selector === 'meta[name="theme-color"]') return elements.theme;
      if (selector === 'meta[name="apple-mobile-web-app-title"]') return elements.apple;
      return null;
    },
    createElement() { return { setAttribute(name, value) { this[name] = value; } }; },
    head: { appendChild() {} }
  };
  globalThis.window = { location: { origin: "https://shop.example.test" } };

  try {
    applyStoreManifest({ storeName: "بامسق للأثاث", slug: "بامسق", logo: "uploads/logos/store.webp", pwaEnabled: true }, "https://api.example.test/api/");
    const json = decodeURIComponent(elements.manifest.href.split(",")[1]);
    const manifest = JSON.parse(json);
    assert.equal(manifest.name, "بامسق للأثاث");
    assert.ok(manifest.icons.every((icon) => !icon.src.includes("/pwa/icon-")));
    assert.equal(elements.apple.content, "بامسق للأثاث");
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

test("store manifest is not applied when the active plan does not enable Store PWA", () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const elements = {
    manifest: { href: "data:application/manifest+json,previous-store" },
    theme: { setAttribute(_name, value) { this.content = value; } },
    apple: { setAttribute(_name, value) { this.content = value; } }
  };
  globalThis.document = {
    querySelector(selector) {
      if (selector === 'link[rel="manifest"]') return elements.manifest;
      if (selector === 'meta[name="theme-color"]') return elements.theme;
      if (selector === 'meta[name="apple-mobile-web-app-title"]') return elements.apple;
      return null;
    }
  };
  globalThis.window = { location: { origin: "https://shop.example.test" } };

  try {
    applyStoreManifest({ storeName: "متجر عادي", slug: "regular-store", pwaEnabled: false }, "https://api.example.test/api/");
    assert.equal(elements.manifest.href, "/manifest.json");
    assert.equal(elements.theme.content, "#0b89ed");
    assert.equal(elements.apple.content, "سوقك");
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

test("restoring the global PWA leaves its manifest and branding unchanged", () => {
  const originalDocument = globalThis.document;
  const elements = {
    manifest: { href: "data:application/manifest+json,store" },
    theme: { setAttribute(_name, value) { this.content = value; } },
    apple: { setAttribute(_name, value) { this.content = value; } }
  };
  globalThis.document = {
    querySelector(selector) {
      if (selector === 'link[rel="manifest"]') return elements.manifest;
      if (selector === 'meta[name="theme-color"]') return elements.theme;
      if (selector === 'meta[name="apple-mobile-web-app-title"]') return elements.apple;
      return null;
    }
  };

  try {
    restoreGlobalManifest();
    assert.equal(elements.manifest.href, "/manifest.json");
    assert.equal(elements.theme.content, "#0b89ed");
    assert.equal(elements.apple.content, "سوقك");
  } finally {
    globalThis.document = originalDocument;
  }
});

test("Storefront install CTA and manifest behavior are gated without changing the global PWA", () => {
  const root = process.cwd();
  const storefront = fs.readFileSync(path.join(root, "src", "pages", "Storefront.jsx"), "utf8");
  const globalPrompt = fs.readFileSync(path.join(root, "src", "components", "PWAInstallPrompt.jsx"), "utf8");
  const main = fs.readFileSync(path.join(root, "src", "main.jsx"), "utf8");
  const globalManifest = JSON.parse(fs.readFileSync(path.join(root, "public", "manifest.json"), "utf8"));
  const serviceWorker = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");

  assert.match(storefront, /if \(!installTarget\) \{\s*setPWAInstallTarget\("souqak"\);\s*restoreGlobalManifest\(\);/);
  assert.match(storefront, /applyStoreManifest\(data\.store, api\.defaults\.baseURL\)/);
  assert.match(storefront, /canInstallPWA\(installTarget\)/);
  assert.match(storefront, /installPWA\(installTarget\)/);
  assert.match(storefront, /\(canInstall \|\| isPWAStandalone\(\)\) && store\.pwaEnabled && <div[\s\S]*?تثبيت المتجر<\/button>/);
  assert.match(storefront, /if \(isPWAStandalone\(\)\) setShowBrowserInstallGuidance\(true\)/);
  assert.match(storefront, /setPWAInstallTarget\(installTarget\)/);
  assert.match(storefront, /<PWAInstallPrompt store=\{store\} apiBase=\{api\.defaults\.baseURL\} \/>/);
  assert.match(globalPrompt, /لتثبيت \$\{installAppName\}، افتح الصفحة في Google Chrome/);
  assert.match(globalPrompt, /if \(\(!isStorePrompt && isStoreRoute\) \|\| \(isStorePrompt && \(!isStoreRoute \|\| !installTarget\)\)\) return null/);
  assert.match(main, /navigator\.serviceWorker\.register\("\/sw\.js"\)/);
  assert.equal(globalManifest.start_url, "/");
  assert.match(serviceWorker, /"\/manifest\.json"/);
});