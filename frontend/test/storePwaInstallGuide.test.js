import test from "node:test";
import assert from "node:assert/strict";
import {
  canShowStorePwaInstallGuide,
  createStorePwaInstallGuideController,
  dismissStorePwaInstallGuide,
  getStorePwaInstallGuideDismissalKey,
  isStorePwaInstallGuideDismissed,
  shouldShowStorePwaInstallGuide,
  STORE_PWA_INSTALL_GUIDE_DELAY_MS,
  STORE_PWA_INSTALL_GUIDE_DISMISSAL_MS
} from "../src/utils/storePwaInstallGuide.js";

const storeContext = {
  isAndroid: true,
  storeId: "store-123",
  appStoreId: "store-123",
  storeType: "store",
  pwaEnabled: true,
  isStandalone: false
};

test("install guidance eligibility requires Android, matching store PWA identity, and a non-standalone page", () => {
  assert.equal(canShowStorePwaInstallGuide(storeContext), true);
  assert.equal(canShowStorePwaInstallGuide({ ...storeContext, storeType: "family-production" }), true);
  assert.equal(canShowStorePwaInstallGuide({ ...storeContext, isAndroid: false }), false);
  assert.equal(canShowStorePwaInstallGuide({ ...storeContext, appStoreId: "another-store" }), false);
  assert.equal(canShowStorePwaInstallGuide({ ...storeContext, isStandalone: true }), false);
  assert.equal(canShowStorePwaInstallGuide({ ...storeContext, pwaEnabled: false }), false);
  assert.equal(canShowStorePwaInstallGuide({ ...storeContext, storeType: "ordinary-page" }), false);
});

test("guidance waits eight seconds and appears only once for an install attempt", () => {
  let timerCallback;
  let scheduledDelay;
  let guideShows = 0;
  let nativeShows = 0;
  const controller = createStorePwaInstallGuideController({
    setTimer(callback, delay) {
      timerCallback = callback;
      scheduledDelay = delay;
      return 1;
    },
    clearTimer() {},
    onGuide() { guideShows += 1; },
    onNativeInstall() { nativeShows += 1; }
  });

  controller.request();
  assert.equal(controller.getState(), "waiting");
  assert.equal(scheduledDelay, STORE_PWA_INSTALL_GUIDE_DELAY_MS);
  timerCallback();
  assert.equal(controller.getState(), "guide");
  assert.equal(guideShows, 1);
  assert.equal(nativeShows, 0);
  timerCallback();
  assert.equal(guideShows, 1);

  controller.dismiss();
  assert.equal(controller.getState(), "idle");
  assert.equal(guideShows, 1);
  controller.request();
  timerCallback();
  assert.equal(guideShows, 2);
});

test("the dedicated method button shows guidance immediately when native install is unavailable", () => {
  const events = [];
  const controller = createStorePwaInstallGuideController({
    setTimer() {
      throw new Error("Immediate guidance must not schedule a timer");
    },
    clearTimer() {},
    onGuide() { events.push("guide"); },
    onNativeInstall() { events.push("native"); }
  });

  controller.request(false, 0);
  assert.deepEqual(events, ["guide"]);
  assert.equal(controller.getState(), "guide");
});

test("a native install event cancels the guide timer and takes precedence", () => {
  let timerCallback;
  let timerCleared = false;
  const events = [];
  const controller = createStorePwaInstallGuideController({
    setTimer(callback) {
      timerCallback = callback;
      return 2;
    },
    clearTimer(id) {
      assert.equal(id, 2);
      timerCleared = true;
    },
    onGuide() { events.push("guide"); },
    onNativeInstall() { events.push("native"); }
  });

  controller.request();
  assert.equal(controller.nativeInstallAvailable(), true);
  timerCallback();
  assert.deepEqual(events, ["native"]);
  assert.equal(timerCleared, true);
  assert.equal(controller.getState(), "native");
});

test("a late native event replaces an already visible guide", () => {
  let timerCallback;
  const events = [];
  const controller = createStorePwaInstallGuideController({
    setTimer(callback) {
      timerCallback = callback;
      return 3;
    },
    clearTimer() {},
    onGuide() { events.push("guide"); },
    onNativeInstall() { events.push("native"); }
  });

  controller.request();
  timerCallback();
  assert.equal(controller.getState(), "guide");
  assert.equal(controller.nativeInstallAvailable(), true);
  assert.deepEqual(events, ["guide", "native"]);
  assert.equal(controller.getState(), "native");
});

test("closing guidance persists a seven-day dismissal independently for each app", () => {
  const values = new Map();
  const storage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); }
  };
  const now = 1_800_000_000_000;
  const firstKey = getStorePwaInstallGuideDismissalKey("store-123");

  dismissStorePwaInstallGuide("store-123", storage, now);
  assert.equal(isStorePwaInstallGuideDismissed("store-123", storage, now), true);
  assert.equal(isStorePwaInstallGuideDismissed("store-456", storage, now), false);
  assert.equal(shouldShowStorePwaInstallGuide("store-123", "market-install", storage, now), false);
  assert.equal(shouldShowStorePwaInstallGuide("store-123", "method-button", storage, now), true);
  assert.equal(shouldShowStorePwaInstallGuide("store-456", "market-install", storage, now), true);
  assert.equal(
    Number(values.get(firstKey)),
    now + STORE_PWA_INSTALL_GUIDE_DISMISSAL_MS
  );
  assert.equal(
    isStorePwaInstallGuideDismissed(
      "store-123",
      storage,
      now + STORE_PWA_INSTALL_GUIDE_DISMISSAL_MS
    ),
    false
  );
  assert.equal(
    shouldShowStorePwaInstallGuide(
      "store-123",
      "market-install",
      storage,
      now + STORE_PWA_INSTALL_GUIDE_DISMISSAL_MS
    ),
    true
  );
  assert.equal(values.has(firstKey), false);
});

test("canceling an attempt prevents a pending timer from showing guidance", () => {
  let timerCallback;
  let cleared = false;
  let guideShows = 0;
  const controller = createStorePwaInstallGuideController({
    setTimer(callback) {
      timerCallback = callback;
      return 4;
    },
    clearTimer(id) {
      assert.equal(id, 4);
      cleared = true;
    },
    onGuide() { guideShows += 1; },
    onNativeInstall() {}
  });

  controller.request();
  controller.cancel();
  timerCallback();
  assert.equal(cleared, true);
  assert.equal(guideShows, 0);
  assert.equal(controller.getState(), "idle");
});
