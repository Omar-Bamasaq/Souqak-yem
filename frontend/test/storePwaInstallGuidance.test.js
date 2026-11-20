import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  continueStorePwaInstallNavigation,
  getStorePwaInstallGuidePlatform,
  hasStorePwaInstallAttempt
} from "../src/utils/storePwaInstallGuide.js";

const root = process.cwd();

test("install guidance selects Android and iPhone instructions without identifying browser brands", () => {
  assert.equal(getStorePwaInstallGuidePlatform({
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36"
  }), "android");
  assert.equal(getStorePwaInstallGuidePlatform({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"
  }), "iphone");
  assert.equal(getStorePwaInstallGuidePlatform({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
    platform: "MacIntel",
    maxTouchPoints: 5
  }), "iphone");
});

test("the existing launch marker identifies pre-guided navigation and is consumed on app arrival", () => {
  assert.equal(hasStorePwaInstallAttempt("?pwaInstallAttempt=1"), true);
  assert.equal(hasStorePwaInstallAttempt("?other=1&pwaInstallAttempt=1"), true);
  assert.equal(hasStorePwaInstallAttempt("?pwaInstallAttempt=0"), false);
  assert.equal(hasStorePwaInstallAttempt(""), false);

  const prompt = fs.readFileSync(path.join(root, "src", "components", "PWAInstallPrompt.jsx"), "utf8");
  assert.match(prompt, /hasStorePwaInstallAttempt\(location\.search\)/);
  assert.match(prompt, /params\.delete\("pwaInstallAttempt"\)/);
  assert.doesNotMatch(prompt, /source:\s*"market-install"/);
});

test("continuing the guide opens the exact current link with its original target", () => {
  const opened = [];
  const assigned = [];
  const fakeWindow = {
    open(...args) { opened.push(args); },
    location: { assign(url) { assigned.push(url); } }
  };
  const intentUrl = "intent://apps.souqak-yem.com/store/store-id/?pwaInstallAttempt=1#Intent;package=com.android.chrome;end";
  const regularUrl = "https://apps.souqak-yem.com/store/store-id/";

  continueStorePwaInstallNavigation(intentUrl, "_self", fakeWindow);
  continueStorePwaInstallNavigation(regularUrl, "_blank", fakeWindow);

  assert.deepEqual(assigned, [intentUrl]);
  assert.deepEqual(opened, [[regularUrl, "_blank", "noopener,noreferrer"]]);
});

test("store download UI uses one guide, preserves native install priority and hides in standalone", () => {
  const storefront = fs.readFileSync(path.join(root, "src", "pages", "Storefront.jsx"), "utf8");
  const modal = fs.readFileSync(path.join(root, "src", "components", "StorePwaInstallGuideModal.jsx"), "utf8");

  assert.match(storefront, /تنزيل التطبيق/);
  assert.match(storefront, /مساعدة تنزيل تطبيق المتجر/);
  assert.match(storefront, /onClick=\{\(event\) => handleExternalStorePwaClick\(event, storeAppLaunchUrl, "_self"\)\}/);
  assert.match(storefront, /onClick=\{\(event\) => handleExternalStorePwaClick\(event, storeAppUrl, "_blank"\)\}/);
  assert.match(storefront, /if \(canInstallPWA\(installTarget\)\)[\s\S]*?void installPWA\(installTarget\);[\s\S]*?if \(!isMobileInstallGuidePlatform\) return/);
  assert.match(storefront, /isDedicatedStorePwa \|\| !isStandalonePWA\(\)/);
  assert.match(storefront, /preparedHandoffIsCurrent/);
  assert.match(modal, /تنزيل تطبيق المتجر/);
  assert.match(modal, /إذا لم يظهر خيار تنزيل التطبيق/);
  assert.match(modal, /اختر فتح في Chrome/);
  assert.match(modal, /إضافة إلى الشاشة الرئيسية/);
  assert.match(modal, /aria-pressed=\{isAndroid\}/);
  assert.match(modal, /إكمال التنزيل/);
  assert.match(modal, /onContinue/);
});
