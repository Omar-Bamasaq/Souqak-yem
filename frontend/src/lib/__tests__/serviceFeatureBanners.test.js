import test from "node:test";
import assert from "node:assert/strict";
import { getServicePageBanner, SERVICE_FEATURE_BANNERS } from "../serviceFeatureBanners.js";

test("service banners point to existing service pages and use unique destinations", () => {
  assert.equal(SERVICE_FEATURE_BANNERS.length, 11);
  assert.equal(new Set(SERVICE_FEATURE_BANNERS.map(({ id }) => id)).size, 11);
  assert.equal(new Set(SERVICE_FEATURE_BANNERS.map(({ to }) => to)).size, 11);
  assert.ok(SERVICE_FEATURE_BANNERS.every(({ title, description, action, theme, details, servicePaths }) =>
    title && description && action && theme && details.length === 3 && servicePaths.length > 0
  ));
});

test("service pages resolve to a detailed banner about the current service", () => {
  for (const banner of SERVICE_FEATURE_BANNERS) {
    for (const servicePath of banner.servicePaths) {
      assert.equal(getServicePageBanner(servicePath), banner);
    }
  }
  assert.equal(getServicePageBanner("/auctions/123"), SERVICE_FEATURE_BANNERS.find(({ id }) => id === "auctions"));
  assert.equal(getServicePageBanner("/quote-requests/123"), SERVICE_FEATURE_BANNERS.find(({ id }) => id === "quote-requests"));
  assert.equal(getServicePageBanner("/my-quote-offers"), SERVICE_FEATURE_BANNERS.find(({ id }) => id === "quote-requests"));
  assert.equal(getServicePageBanner("/"), null);
  assert.equal(getServicePageBanner("/not-a-service"), null);
});
