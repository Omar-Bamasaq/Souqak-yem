import test from "node:test";
import assert from "node:assert/strict";
import { hasStoreFeature, planSupportsStoreFeature, validateStoreLocation } from "../src/utils/storeFeatureUtils.js";

test("hasStoreFeature requires an active store subscription and enabled plan feature", () => {
  const store = {
    status: "active",
    subscription: {
      status: "active",
      planId: { type: "store", features: ["pwa", "multipleContacts", "delivery", "pushNotifications"] }
    }
  };

  assert.equal(hasStoreFeature(store, "pwa"), true);
  assert.equal(hasStoreFeature(store, "multipleContacts"), true);
  assert.equal(hasStoreFeature(store, "delivery"), true);
  assert.equal(hasStoreFeature({ type: "store", features: { delivery: true } }, "delivery"), true);
  assert.equal(hasStoreFeature({ type: "store", features: { delivery: false } }, "delivery"), false);
  assert.equal(hasStoreFeature({ type: "featured", features: { delivery: true } }, "delivery"), false);
  assert.equal(planSupportsStoreFeature({ type: "store", features: ["delivery"] }, "delivery"), true);
  assert.equal(planSupportsStoreFeature({ type: "store", features: [] }, "delivery"), false);
  assert.equal(hasStoreFeature(store, "advancedCustomization"), false);
  assert.equal(hasStoreFeature({
    status: "active",
    subscription: { status: "active", planId: { features: ["pushNotifications", "analytics", "featuredStore"] } }
  }, "pushNotifications"), false);

  const inactive = {
    status: "active",
    subscription: {
      status: "expired",
      planId: { type: "store", features: ["pwa"] }
    }
  };

  assert.equal(hasStoreFeature(inactive, "pwa"), false);
});

test("validateStoreLocation rejects invalid city/governorate mismatch and accepts custom city names", () => {
  const valid = validateStoreLocation({
    governorateId: "g1",
    cityId: "c1",
    customCityName: "",
    cityMap: { c1: { governorateId: "g1" } }
  });
  assert.equal(valid.valid, true);

  const invalid = validateStoreLocation({
    governorateId: "g1",
    cityId: "c2",
    customCityName: "",
    cityMap: { c1: { governorateId: "g1" } }
  });
  assert.equal(invalid.valid, false);
  assert.match(invalid.message, /المحافظة|governorate|city/i);

  const custom = validateStoreLocation({
    governorateId: "g1",
    cityId: "",
    customCityName: "المنصورة",
    cityMap: { c1: { governorateId: "g1" } }
  });
  assert.equal(custom.valid, true);
  assert.equal(custom.normalizedCityName, "المنصورة");
});
