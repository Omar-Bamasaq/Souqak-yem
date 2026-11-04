import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { subscribeToPush } from "../src/utils/pushNotifications.js";

const root = process.cwd();

test("store notification controls only allow subscribing or unsubscribing from one store", () => {
  const storefront = fs.readFileSync(path.join(root, "src", "pages", "Storefront.jsx"), "utf8");
  const pushUtility = fs.readFileSync(path.join(root, "src", "utils", "pushNotifications.js"), "utf8");
  const notificationsPage = fs.readFileSync(path.join(root, "src", "pages", "Notifications.jsx"), "utf8");

  assert.match(storefront, /store\.notificationsEnabled/);
  assert.match(storefront, /subscribeToPush\(api, \{ storeScoped: true \}\)/);
  assert.match(storefront, /marketingNotifications: true/);
  assert.match(storefront, /enabled: true/);
  assert.doesNotMatch(storefront, /الطلبات وتحديثاتها|الرسائل والردود|العروض والخصومات والمنتجات الجديدة|type="checkbox"/);
  assert.match(storefront, /إشعارات المتجر/);
  assert.match(storefront, /stores\/\$\{store\._id\}\/notifications\/subscription/);
  assert.match(storefront, /تمت متابعة المتجر داخل مركز الإشعارات فقط/);
  assert.match(pushUtility, /getActiveServiceWorkerRegistration\(\)/);
  assert.match(pushUtility, /if \(!registration\) \{\s*return null;/);
  assert.match(pushUtility, /if \(!storeScoped\)\s*\{\s*await api\.post\("\/auth\/subscribe"/);
  assert.match(notificationsPage, /if \(n\.storeProfileId && n\.link\)/);
});

test("global push permission is not requested while opening a store page", () => {
  const manager = fs.readFileSync(path.join(root, "src", "components", "PushSubscriptionManager.jsx"), "utf8");
  const prompt = fs.readFileSync(path.join(root, "src", "components", "NotificationPrompt.jsx"), "utf8");

  assert.match(manager, /Notification\.permission === "default" && !isStoreRoute/);
  assert.match(prompt, /hasSeenNotificationPrompt === false && !isStoreRoute/);
  assert.match(prompt, /if \(!show \|\| isStoreRoute\) return null/);
});

test("Push setup returns promptly when development has no registered service worker", async () => {
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { serviceWorker: { getRegistration: async () => null } }
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { PushManager: class PushManager {} }
  });

  try {
    const result = await Promise.race([
      subscribeToPush({}),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Push setup did not finish")), 1000))
    ]);
    assert.equal(result, null);
  } finally {
    if (previousNavigator) Object.defineProperty(globalThis, "navigator", previousNavigator);
    else delete globalThis.navigator;
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else delete globalThis.window;
  }
});

test("store owner notification controls are gated by an active store plan and require an explicit action", () => {
  const ownerPage = fs.readFileSync(path.join(root, "src", "pages", "MyStore.jsx"), "utf8");

  assert.match(ownerPage, /store\?\.status === "active"[\s\S]*hasStorePlanFeature[\s\S]*"notifications"/);
  assert.match(ownerPage, /onClick=\{enableOwnerPush\}/);
  assert.match(ownerPage, /إشعارات المتصفح:/);
  assert.match(ownerPage, /subscribeToPush\(api\)/);
});
