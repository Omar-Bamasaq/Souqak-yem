import test from "node:test";
import assert from "node:assert/strict";

import {
  CHROME_NOTICE_DISMISSED_KEY,
  isGoogleChrome,
  shouldShowChromeBrowserNotice
} from "../src/utils/chromeBrowserNotice.js";

const makeWindow = ({ userAgent, standalone = false, dismissed = false } = {}) => {
  const storage = {};
  if (dismissed) storage[CHROME_NOTICE_DISMISSED_KEY] = "true";

  return {
    navigator: {
      userAgent,
      standalone
    },
    sessionStorage: {
      getItem: (key) => storage[key] ?? null,
      setItem: (key, value) => {
        storage[key] = String(value);
      }
    },
    matchMedia: () => ({ matches: standalone })
  };
};

test("recognizes Google Chrome on Android and iPhone as exempt from the notice", () => {
  const iphoneChrome = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/127.0.0.0 Mobile/15E148 Safari/604.1";
  const androidChrome = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36";

  assert.equal(isGoogleChrome(iphoneChrome), true);
  assert.equal(isGoogleChrome(androidChrome), true);
  assert.equal(shouldShowChromeBrowserNotice(makeWindow({ userAgent: iphoneChrome })), false);
  assert.equal(shouldShowChromeBrowserNotice(makeWindow({ userAgent: androidChrome })), false);
});

test("excludes Android WebView and in-app Chromium browsers from the Chrome exemption", () => {
  const androidWebView = "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/127.0.0.0 Mobile Safari/537.36";
  const facebookInApp = "Mozilla/5.0 (Linux; Android 10; Pixel 4; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/127.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/394.0.0.18.90;]";
  const samsungBrowser = "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36";

  assert.equal(isGoogleChrome(androidWebView), false);
  assert.equal(isGoogleChrome(facebookInApp), false);
  assert.equal(isGoogleChrome(samsungBrowser), false);
  assert.equal(shouldShowChromeBrowserNotice(makeWindow({ userAgent: androidWebView })), true);
});

test("shows the notice for unsupported mobile browsers and suppresses it after dismissal", () => {
  const safariIphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

  assert.equal(shouldShowChromeBrowserNotice(makeWindow({ userAgent: safariIphone })), true);
  assert.equal(shouldShowChromeBrowserNotice(makeWindow({ userAgent: safariIphone, dismissed: true })), false);
});

test("suppresses the notice when the site is running as a standalone PWA", () => {
  const safariIphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

  assert.equal(shouldShowChromeBrowserNotice(makeWindow({ userAgent: safariIphone, standalone: true })), false);
});
