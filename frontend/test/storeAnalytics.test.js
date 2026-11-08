import test from "node:test";
import assert from "node:assert/strict";
import { claimStoreAnalyticsView } from "../src/utils/storeAnalyticsTracking.js";
import { getStorePwaInstallationId } from "../src/utils/storePwaInstallTracking.js";
import { hasStorePlanFeature } from "../src/utils/storePlanFeatures.js";

function createStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, value); },
    keys() { return [...values.keys()]; }
  };
}

test("store analytics view keys prevent repeated renders and refreshes from duplicating a daily view", () => {
  const storage = createStorage();
  const args = {
    storeId: "store-1",
    storage,
    now: new Date("2026-10-07T08:00:00+03:00")
  };
  assert.equal(claimStoreAnalyticsView(args), true);
  assert.equal(claimStoreAnalyticsView(args), false);
  assert.equal(claimStoreAnalyticsView({ ...args, now: new Date("2026-10-08T00:00:00+03:00") }), true);
});

test("product views are deduplicated separately without storing viewer identity", () => {
  const storage = createStorage();
  const args = {
    storeId: "store-1",
    productId: "product-1",
    storage,
    now: new Date("2026-10-07T08:00:00+03:00")
  };
  assert.equal(claimStoreAnalyticsView(args), true);
  assert.equal(claimStoreAnalyticsView(args), false);
  assert.equal(claimStoreAnalyticsView({ ...args, productId: "product-2" }), true);
  assert.ok(storage.keys().every((key) => !key.includes("user") && !key.includes("ip")));
});

test("store analytics visibility follows the store plan feature", () => {
  assert.equal(hasStorePlanFeature({ type: "store", features: { analytics: true } }, "analytics"), true);
  assert.equal(hasStorePlanFeature({ type: "store", features: { analytics: false } }, "analytics"), false);
});

test("PWA installation identifiers are stable per store without including viewer identity", () => {
  const storage = createStorage();
  let randomByte = 0;
  const cryptoApi = {
    getRandomValues(bytes) {
      bytes.fill(++randomByte);
      return bytes;
    }
  };
  const first = getStorePwaInstallationId({ storeSlug: "shop-one", storage, cryptoApi });
  const repeated = getStorePwaInstallationId({ storeSlug: "shop-one", storage, cryptoApi });
  const secondStore = getStorePwaInstallationId({ storeSlug: "shop-two", storage, cryptoApi });

  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(repeated, first);
  assert.notEqual(secondStore, first);
  assert.ok(storage.keys().every((key) => !key.includes("user") && !key.includes("ip")));
});
