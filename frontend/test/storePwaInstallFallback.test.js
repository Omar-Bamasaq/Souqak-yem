import test from "node:test";
import assert from "node:assert/strict";

import {
  getStorePwaInstallFallback,
  STORE_PWA_FALLBACK_QUERY
} from "../src/utils/storePwaInstallFallback.js";

test("builds a Chrome intent for the current Android store URL with a browser fallback", () => {
  const result = getStorePwaInstallFallback({
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/127.0.0.0 Mobile Safari/537.36",
    pageUrl: "https://souqak.example/store/market?view=discounts&souqakInstallFallback=chrome-unavailable#products"
  });

  assert.equal(result.platform, "android");
  assert.equal(result.pageUrl, "https://souqak.example/store/market?view=discounts#products");
  assert.match(result.url, /^intent:\/\/souqak\.example\/store\/market\?view=discounts#Intent;/);
  assert.match(result.url, /package=com\.android\.chrome/);
  const fallback = new URL(decodeURIComponent(result.url.match(/browser_fallback_url=([^;]+)/)[1]));
  assert.equal(fallback.pathname, "/store/market");
  assert.equal(fallback.searchParams.get("view"), "discounts");
  assert.equal(fallback.searchParams.get(STORE_PWA_FALLBACK_QUERY), "chrome-unavailable");
});

test("returns the current page URL for iPhone, iPad, and iPadOS desktop-mode user agents", () => {
  const iphone = getStorePwaInstallFallback({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)",
    pageUrl: "https://souqak.example/store/market"
  });
  const ipadDesktopMode = getStorePwaInstallFallback({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
    platform: "MacIntel",
    maxTouchPoints: 5,
    pageUrl: "https://souqak.example/store/family"
  });

  assert.deepEqual(iphone, {
    platform: "ios",
    url: "https://souqak.example/store/market",
    pageUrl: "https://souqak.example/store/market"
  });
  assert.deepEqual(ipadDesktopMode, {
    platform: "ios",
    url: "https://souqak.example/store/family",
    pageUrl: "https://souqak.example/store/family"
  });
});

test("uses a regular page URL on platforms without a specialized fallback", () => {
  const result = getStorePwaInstallFallback({
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) Chrome/127.0.0.0",
    pageUrl: "https://souqak.example/store/market?s=one"
  });

  assert.deepEqual(result, {
    platform: "other",
    url: "https://souqak.example/store/market?s=one",
    pageUrl: "https://souqak.example/store/market?s=one"
  });
});
