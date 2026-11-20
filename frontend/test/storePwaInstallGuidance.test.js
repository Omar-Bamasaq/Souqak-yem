import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  continueStorePwaInstallNavigation,
  getStorePwaInstallGuidePlatform,
  hasStorePwaInstallAttempt,
  shouldRequestStorePwaInstallGuide,
  canShowStorePwaInstallGuide,
  createStorePwaInstallGuideController
} from "../src/utils/storePwaInstallGuide.js";
import { buildStorePwaLaunchUrl } from "../src/utils/storePwa.js";

const root = process.cwd();
const STORE_ID = "64d3d93a1a2b3c4d5e6f7701";

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

test("direct arrival requests the fallback guide while a guided arrival suppresses a duplicate", () => {
  assert.equal(hasStorePwaInstallAttempt("?pwaInstallAttempt=1"), true);
  assert.equal(hasStorePwaInstallAttempt("?other=1&pwaInstallAttempt=1"), true);
  assert.equal(hasStorePwaInstallAttempt("?pwaInstallAttempt=0"), false);
  assert.equal(hasStorePwaInstallAttempt(""), false);
  assert.equal(shouldRequestStorePwaInstallGuide("?pwaInstallAttempt=1"), true);
  assert.equal(shouldRequestStorePwaInstallGuide("?pwaInstallAttempt=1&pwaInstallGuided=1"), false);

  const prompt = fs.readFileSync(path.join(root, "src", "components", "PWAInstallPrompt.jsx"), "utf8");
  assert.match(prompt, /hasStorePwaInstallAttempt\(location\.search\)/);
  assert.match(prompt, /shouldRequestStorePwaInstallGuide\(location\.search\)/);
  assert.match(prompt, /source:\s*"market-install"/);
  assert.match(prompt, /params\.delete\("pwaInstallAttempt"\)/);
  assert.match(prompt, /params\.delete\("pwaInstallGuided"\)/);
});

test("continuing marks both the Chrome Intent target and its browser fallback as already guided", () => {
  const opened = [];
  const assigned = [];
  const fakeWindow = {
    open(...args) { opened.push(args); },
    location: { assign(url) { assigned.push(url); } }
  };
  const intentUrl = buildStorePwaLaunchUrl(STORE_ID, {
    userAgent: "Mozilla/5.0 (Linux; Android 14)",
    installAttempt: true
  });
  const regularUrl = "https://apps.souqak-yem.com/store/store-id/";

  continueStorePwaInstallNavigation(intentUrl, "_self", fakeWindow);
  continueStorePwaInstallNavigation(regularUrl, "_blank", fakeWindow);

  assert.equal(assigned.length, 1);
  const [intentTarget, intentMetadata] = assigned[0].split("#Intent;");
  assert.match(intentTarget, /^intent:\/\/apps\.souqak-yem\.com\/store\//);
  assert.match(intentTarget, /pwaInstallAttempt=1/);
  assert.match(intentTarget, /pwaInstallGuided=1/);
  assert.match(intentMetadata, /package=com\.android\.chrome/);
  const fallbackMatch = intentMetadata.match(/S\.browser_fallback_url=([^;]+)/);
  assert.ok(fallbackMatch, "Android Intent should keep its browser fallback");
  const fallbackUrl = decodeURIComponent(fallbackMatch[1]);
  assert.equal(new URL(fallbackUrl).searchParams.get("pwaInstallAttempt"), "1");
  assert.equal(new URL(fallbackUrl).searchParams.get("pwaInstallGuided"), "1");
  assert.equal(shouldRequestStorePwaInstallGuide(new URL(fallbackUrl).search), false);
  assert.deepEqual(opened, [[regularUrl, "_blank", "noopener,noreferrer"]]);
});

test("an unmodified Android fallback still requests guidance when the Intent cannot open", () => {
  const intentUrl = buildStorePwaLaunchUrl(STORE_ID, {
    userAgent: "Mozilla/5.0 (Linux; Android 14)",
    installAttempt: true
  });
  const fallbackMatch = intentUrl.match(/S\.browser_fallback_url=([^;]+)/);
  assert.ok(fallbackMatch);
  const fallbackUrl = decodeURIComponent(fallbackMatch[1]);
  assert.equal(new URL(fallbackUrl).searchParams.get("pwaInstallGuided"), null);
  assert.equal(shouldRequestStorePwaInstallGuide(new URL(fallbackUrl).search), true);
});

test("direct marked arrival shows the fallback guide when native install is unavailable", () => {
  let timerCallback;
  let guidesShown = 0;
  let nativeInstallShown = 0;
  const controller = createStorePwaInstallGuideController({
    setTimer(callback) {
      timerCallback = callback;
      return 1;
    },
    clearTimer() {},
    onGuide() { guidesShown += 1; },
    onNativeInstall() { nativeInstallShown += 1; }
  });

  assert.equal(shouldRequestStorePwaInstallGuide("?pwaInstallAttempt=1"), true);
  controller.request(false);
  timerCallback();
  assert.equal(guidesShown, 1);
  assert.equal(nativeInstallShown, 0);
});

test("the install guide remains ineligible for standalone store apps", () => {
  assert.equal(canShowStorePwaInstallGuide({
    isAndroid: true,
    storeId: STORE_ID,
    appStoreId: STORE_ID,
    storeType: "store",
    pwaEnabled: true,
    isStandalone: true
  }), false);
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
