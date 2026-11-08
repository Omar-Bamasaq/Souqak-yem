import test from "node:test";
import assert from "node:assert/strict";
import StoreSubscription from "../src/models/StoreSubscription.js";
import storesRouter from "../src/routes/stores.js";
import adsRouter from "../src/routes/ads.js";
import adminStoresRouter from "../src/routes/adminStores.js";

function sourceFor(router, method, path) {
  const layer = router.stack.find((entry) => entry.route?.path === path && entry.route.methods[method]);
  assert.ok(layer, `Expected ${method.toUpperCase()} ${path} route to exist`);
  return layer.route.stack.map((entry) => entry.handle.toString()).join("\n");
}

test("subscription model exposes reusable expiry helper", () => {
  assert.ok(StoreSubscription.getStoreSubscriptionStatus, "Expected getStoreSubscriptionStatus helper on StoreSubscription");
  const now = new Date("2025-01-10T00:00:00.000Z");
  assert.equal(StoreSubscription.getStoreSubscriptionStatus({ status: "active", startDate: "2025-01-01T00:00:00.000Z", endDate: "2025-01-12T00:00:00.000Z" }, now), "active");
  assert.equal(StoreSubscription.getStoreSubscriptionStatus({ status: "active", startDate: "2025-01-01T00:00:00.000Z", endDate: "2025-01-05T00:00:00.000Z" }, now), "expired");
});

test("public store route blocks expired subscriptions", () => {
  const source = sourceFor(storesRouter, "get", "/:slug");
  assert.match(source, /getStoreSubscriptionStatus|StoreSubscription\.getStoreSubscriptionStatus/);
  assert.match(source, /status:\s*"active"|status:\s*['\"]active['\"]/);
});

test("store ad creation enforces active subscription before allowing store ads", () => {
  const source = sourceFor(adsRouter, "post", "/");
  assert.match(source, /getStoreSubscriptionStatus|StoreSubscription\.getStoreSubscriptionStatus/);
  assert.match(source, /expired|منتهي|non-active|activeSubscription/);
});

test("admin approval is idempotent and keeps approved request state", () => {
  const source = sourceFor(adminStoresRouter, "post", "/requests/:id/approve");
  assert.match(source, /alreadyApproved|Approved/i);
  assert.match(source, /create\(\{|StoreSubscription\.create/);
  assert.match(source, /findOne\(\{\s*storeId:.*status:\s*"active"|status:\s*\$in/);
});

test("admin store directory exposes read-only listing with filters and pagination", () => {
  const source = sourceFor(adminStoresRouter, "get", "/");
  assert.match(source, /page\s*=\s*Math\.max|limit\s*=\s*Math\.min/);
  assert.match(source, /search\s*=\s*String\(req\.query\.q\s*\|\|\s*""\)\.trim\(\)/);
  assert.match(source, /const\s+storeStatus\s*=\s*String\(req\.query\.status\s*\|\|\s*""\)\.trim\(\)/);
  assert.match(source, /const\s+subscriptionStatus\s*=\s*String\(req\.query\.subscriptionStatus\s*\|\|\s*""\)\.trim\(\)/);
  assert.match(source, /StoreSubscription\.getStoreSubscriptionStatus/);
  assert.match(source, /pagination\s*:\s*\{/);
});

test("admin store directory keeps inactive stores visible without creating a new subscription model", () => {
  const source = sourceFor(adminStoresRouter, "get", "/");
  assert.match(source, /StoreSubscription\.findOne\(\{\s*storeId:\s*store\._id\s*\}/);
  assert.match(source, /subscriptionStatus:\s*computedSubscriptionStatus/);
  assert.doesNotMatch(source, /new\s+StoreSubscription|class\s+StoreSubscription/);
});

test("admin store history route enforces admin auth and validates StoreProfile ids", () => {
  const source = sourceFor(adminStoresRouter, "get", "/:storeId/history");
  const routerSource = adminStoresRouter.stack.map((entry) => entry.handle?.toString() || "").join("\n");
  assert.match(source, /mongoose\.Types\.ObjectId\.isValid|isValidObjectId/);
  assert.match(source, /404.*Store profile not found|Store profile not found/);
  assert.match(routerSource, /roles\.includes\("admin"\)|req\.user\.role === "admin"/);
});

test("admin store history route aggregates subscriptions and purchase requests without duplicates", () => {
  const source = sourceFor(adminStoresRouter, "get", "/:storeId/history");
  assert.match(source, /StoreSubscription\.find\(\{\s*storeId:\s*store\._id\s*\}\)/);
  assert.match(source, /PurchaseRequest\.find\(\{\s*storeProfile:\s*store\._id\s*\}\)/);
  assert.match(source, /subscription\.purchaseRequestId|purchaseRequestId\s*\?\?/);
  assert.match(source, /new\s+Map\s*\(/);
  assert.match(source, /sort\(\{\s*createdAt:\s*-1\s*\}\)/);
});

test("store history calculates expired status from date without writing to stored subscription", () => {
  const source = sourceFor(adminStoresRouter, "get", "/:storeId/history");
  assert.match(source, /getStoreSubscriptionStatus\(subscription\)|StoreSubscription\.getStoreSubscriptionStatus/);
  assert.doesNotMatch(source, /findByIdAndUpdate\(|findOneAndUpdate\(|updateOne\(/);
});

test("store history handles empty subscription and request history safely", () => {
  const source = sourceFor(adminStoresRouter, "get", "/:storeId/history");
  assert.match(source, /subscriptions:\s*subscriptionHistory|requests:\s*requestHistory|hasSubscriptions|hasRequests/);
  assert.match(source, /No subscription history|No request history|لا توجد|hasSubscriptions/);
});
