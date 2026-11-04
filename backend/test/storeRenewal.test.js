import test from "node:test";
import assert from "node:assert/strict";
import storesRouter from "../src/routes/stores.js";
import adminStoresRouter from "../src/routes/adminStores.js";
import PurchaseRequest from "../src/models/PurchaseRequest.js";
import StoreProfile from "../src/models/StoreProfile.js";
import StoreSubscription from "../src/models/StoreSubscription.js";
import User from "../src/models/User.js";
import Plan from "../src/models/Plan.js";

const OWNER_ID = "renewal-owner";
const STORE_ID = "renewal-store";
const REQUEST_ID = "renewal-request";

function sourceFor(router, method, path) {
  const layer = router.stack.find((entry) => entry.route?.path === path && entry.route.methods[method]);
  assert.ok(layer, `Expected ${method.toUpperCase()} ${path} route to exist`);
  return layer.route.stack.map((entry) => entry.handle.toString()).join("\n");
}

function routeHandler(router, method, path) {
  const layer = router.stack.find((entry) => entry.route?.path === path && entry.route.methods[method]);
  assert.ok(layer, `Expected ${method.toUpperCase()} ${path} route to exist`);
  return layer.route.stack.at(-1).handle;
}

async function approveRenewal({ subscriptions = [], profileStatus = "active" } = {}) {
  const originals = {
    requestFind: PurchaseRequest.findById,
    requestUpdate: PurchaseRequest.findByIdAndUpdate,
    subscriptionFind: StoreSubscription.findOne,
    subscriptionUpdate: StoreSubscription.findByIdAndUpdate,
    subscriptionCreate: StoreSubscription.create,
    profileUpdate: StoreProfile.findByIdAndUpdate,
    userFind: User.findById
  };
  const storedSubscriptions = subscriptions.map((subscription) => ({ ...subscription }));
  const request = {
    _id: REQUEST_ID,
    user: OWNER_ID,
    status: "Pending",
    price: 0,
    duration: 30,
    currency: "YER_ADEN",
    plan: { _id: "renewal-plan", type: "store", isActive: true, price: 0, durationInDays: 30 },
    storeProfile: { _id: STORE_ID, status: profileStatus, storeType: "store" }
  };
  const profile = { _id: STORE_ID, status: profileStatus };

  PurchaseRequest.findById = () => ({
    populate() { return this; },
    lean: async () => request
  });
  PurchaseRequest.findByIdAndUpdate = async (_id, update) => Object.assign(request, update);
  StoreSubscription.findOne = (filter) => {
    let found;
    if (filter.purchaseRequestId) {
      found = storedSubscriptions.find((subscription) => String(subscription.purchaseRequestId) === String(filter.purchaseRequestId));
    } else if (filter.status) {
      found = storedSubscriptions.find((subscription) =>
        String(subscription.storeId) === String(filter.storeId) && subscription.status === filter.status
      );
    } else {
      found = storedSubscriptions
        .filter((subscription) => String(subscription.storeId) === String(filter.storeId))
        .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))[0];
    }
    return {
      sort() { return this; },
      lean: async () => found || null
    };
  };
  StoreSubscription.findByIdAndUpdate = async (id, update) => {
    const found = storedSubscriptions.find((subscription) => String(subscription._id) === String(id));
    if (found) Object.assign(found, update);
    return found || null;
  };
  StoreSubscription.create = async (data) => {
    const created = { _id: `new-${storedSubscriptions.length}`, ...data };
    storedSubscriptions.push(created);
    return created;
  };
  StoreProfile.findByIdAndUpdate = async (_id, update) => Object.assign(profile, update);
  User.findById = () => ({ select() { return this; }, lean: async () => null });

  try {
    const res = {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; }
    };
    await routeHandler(adminStoresRouter, "post", "/requests/:id/approve")({
      params: { id: REQUEST_ID },
      user: { id: "renewal-admin", role: "admin" },
      app: null
    }, res);
    return { res, subscriptions: storedSubscriptions, request, profile };
  } finally {
    PurchaseRequest.findById = originals.requestFind;
    PurchaseRequest.findByIdAndUpdate = originals.requestUpdate;
    StoreSubscription.findOne = originals.subscriptionFind;
    StoreSubscription.findByIdAndUpdate = originals.subscriptionUpdate;
    StoreSubscription.create = originals.subscriptionCreate;
    StoreProfile.findByIdAndUpdate = originals.profileUpdate;
    User.findById = originals.userFind;
  }
}

test("renewal request route accepts a selected compatible plan instead of forcing the current plan", () => {
  const source = sourceFor(storesRouter, "post", "/renew");
  assert.match(source, /StoreProfile\.findOne\(ownerStoreFilter\(req\.user\.id,\s*storeType\)\)/);
  assert.match(source, /StoreSubscription\.findOne\(|findOne\(\{\s*storeId: store\._id/);
  assert.match(source, /const selectedPlanId = String\(req\.body\?\.planId/);
  assert.match(source, /const selectedPlan = await Plan\.findById\(selectedPlanId\)\.lean\(\)/);
  assert.match(source, /selectedPlan\.type !== expectedPlanType/);
  assert.match(source, /plan: selectedPlan\._id/);
  assert.match(source, /selectedPlan\.price \|\| 0\) <= 0/);
  assert.match(source, /getFinalPrice\(selectedPlan\)/);
  assert.match(source, /status:\s*["']Pending["']/);
  assert.match(source, /price:\s*snapshot\.price|duration:\s*snapshot\.duration/);
});

test("renewal plan selection requires a receipt for paid amount and preserves the selected plan price", () => {
  const source = sourceFor(storesRouter, "post", "/renew");
  assert.match(source, /pricing\.finalPrice > 0 && !paymentReceipt/);
  assert.match(source, /originalPrice:\s*snapshot\.originalPrice/);
});

test("renewal request uses the paid plan selected by the owner, not the previous free plan", async () => {
  const originals = {
    storeFind: StoreProfile.findOne,
    subscriptionFind: StoreSubscription.findOne,
    planFind: Plan.findById,
    requestFind: PurchaseRequest.findOne,
    requestCreate: PurchaseRequest.create
  };
  const selectedPlanId = "507f1f77bcf86cd799439012";
  const captured = { created: null };
  StoreProfile.findOne = () => ({ lean: async () => ({
    _id: STORE_ID,
    userId: OWNER_ID,
    storeType: "store",
    storeName: "متجري",
    businessActivity: "نشاط تجاري"
  }) });
  StoreSubscription.findOne = () => ({
    sort() { return this; },
    lean: async () => ({
      _id: "current-subscription",
      planId: "507f1f77bcf86cd799439011",
      status: "active",
      endDate: new Date(Date.now() + 86400000)
    })
  });
  Plan.findById = () => ({
    lean: async () => ({
      _id: selectedPlanId,
      name: "الخطة الاحترافية",
      type: "store",
      isActive: true,
      price: 100,
      durationInDays: 90,
      currency: "YER_ADEN",
      isSaleActive: true,
      discountType: "percentage",
      discountValue: 100
    })
  });
  PurchaseRequest.findOne = () => ({
    sort() { return this; },
    lean: async () => null
  });
  PurchaseRequest.create = async (request) => {
    captured.created = request;
    return request;
  };

  try {
    const res = {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; }
    };
    await routeHandler(storesRouter, "post", "/renew")({
      body: { storeType: "store", planId: selectedPlanId },
      query: {},
      files: [],
      user: { id: OWNER_ID }
    }, res);

    assert.equal(res.statusCode, 201);
    assert.equal(String(captured.created.plan), selectedPlanId);
    assert.equal(captured.created.duration, 90);
    assert.equal(captured.created.originalPrice, 100);
    assert.equal(captured.created.price, 0);
    assert.equal(String(captured.created.storeProfile), STORE_ID);
  } finally {
    StoreProfile.findOne = originals.storeFind;
    StoreSubscription.findOne = originals.subscriptionFind;
    Plan.findById = originals.planFind;
    PurchaseRequest.findOne = originals.requestFind;
    PurchaseRequest.create = originals.requestCreate;
  }
});

test("renewal request rejects duplicate pending requests for the same store", () => {
  const source = sourceFor(storesRouter, "post", "/renew");
  assert.match(source, /already.*pending|pending.*renew|duplicate.*pending|Pending.*renew/i);
});

test("active renewal approval uses current endDate as renewal start", () => {
  const source = sourceFor(adminStoresRouter, "post", "/requests/:id/approve");
  assert.match(source, /latestSubscription|existingStoreSubscription|endDate.*startDate|startDate.*endDate/);
  assert.match(source, /status:\s*["']expired["']/i);
});

test("expired renewal approval starts from now instead of the old endDate", () => {
  const source = sourceFor(adminStoresRouter, "post", "/requests/:id/approve");
  assert.match(source, /getStoreSubscriptionStatus\(|latestStatus.*expired|existingSubscription.*expired/);
  assert.match(source, /new Date\(\)|startDate = new Date/);
});

test("renewal approval remains idempotent and preserves historical subscription records", () => {
  const source = sourceFor(adminStoresRouter, "post", "/requests/:id/approve");
  assert.match(source, /alreadyApproved|Approved/i);
  assert.match(source, /StoreSubscription\.create\(|findOne\(\{\s*purchaseRequestId/);
  assert.match(source, /status:\s*["']active["']/);
});

test("renewal rejection keeps the store active and only rejects non-renewal creation requests", () => {
  const source = sourceFor(adminStoresRouter, "post", "/requests/:id/reject");
  assert.match(source, /isRenewal|latestSubscription|status:\s*["']active["']/i);
  assert.match(source, /StoreProfile\.findByIdAndUpdate\(storeProfileId/);
  assert.match(source, /latestStatus\s*===\s*["']active["']/);

  const createSource = sourceFor(storesRouter, "post", "/");
  assert.match(createSource, /paid|price\s*>\s*0|Bank receipt is required|paymentReceipt.*required/i);
});

test("active renewal advances from the current end date and leaves one active subscription", async () => {
  const endDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
  const result = await approveRenewal({
    subscriptions: [{ _id: "current-active", storeId: STORE_ID, status: "active", endDate }]
  });

  assert.equal(result.res.statusCode, 200);
  assert.equal(result.subscriptions[0].status, "expired");
  assert.equal(result.subscriptions[1].status, "active");
  assert.equal(result.subscriptions[1].startDate.getTime(), endDate.getTime());
  assert.equal(result.subscriptions[1].endDate.getTime(), endDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  assert.equal(result.subscriptions.filter((subscription) => subscription.status === "active").length, 1);
  assert.equal(result.request.status, "Approved");
  assert.equal(result.profile.status, "active");
});

test("date-expired active renewal is expired before inserting the new active subscription", async () => {
  const oldEndDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const beforeApproval = Date.now();
  const result = await approveRenewal({
    subscriptions: [{ _id: "stale-active", storeId: STORE_ID, status: "active", endDate: oldEndDate }]
  });
  const afterApproval = Date.now();

  assert.equal(result.res.statusCode, 200);
  assert.equal(result.subscriptions[0].status, "expired");
  assert.equal(result.subscriptions[1].status, "active");
  assert.ok(result.subscriptions[1].startDate.getTime() >= beforeApproval);
  assert.ok(result.subscriptions[1].startDate.getTime() <= afterApproval);
  assert.equal(result.subscriptions[1].endDate.getTime(), result.subscriptions[1].startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  assert.equal(result.subscriptions.filter((subscription) => subscription.status === "active").length, 1);
  assert.equal(result.request.status, "Approved");
  assert.equal(result.profile.status, "active");
});

test("expired subscription renewal starts from now and preserves the expired history", async () => {
  const oldEndDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const beforeApproval = Date.now();
  const result = await approveRenewal({
    subscriptions: [{ _id: "historical-expired", storeId: STORE_ID, status: "expired", endDate: oldEndDate }]
  });
  const afterApproval = Date.now();

  assert.equal(result.res.statusCode, 200);
  assert.equal(result.subscriptions[0].status, "expired");
  assert.ok(result.subscriptions[1].startDate.getTime() >= beforeApproval);
  assert.ok(result.subscriptions[1].startDate.getTime() <= afterApproval);
  assert.equal(result.subscriptions[1].status, "active");
  assert.equal(result.subscriptions.filter((subscription) => subscription.status === "active").length, 1);
});

test("pending approval recovers an already-created subscription without duplicating it", async () => {
  const result = await approveRenewal({
    subscriptions: [{
      _id: "partially-approved",
      storeId: STORE_ID,
      userId: OWNER_ID,
      planId: "renewal-plan",
      purchaseRequestId: REQUEST_ID,
      status: "active",
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }]
  });

  assert.equal(result.res.statusCode, 200);
  assert.equal(result.res.body.recovered, true);
  assert.equal(result.subscriptions.length, 1);
  assert.equal(result.request.status, "Approved");
  assert.equal(result.profile.status, "active");
});

test("subscription ending exactly now is considered expired", () => {
  const now = new Date("2026-10-08T13:06:21.039Z");
  assert.equal(StoreSubscription.getStoreSubscriptionStatus({
    status: "active",
    endDate: now
  }, now), "expired");
});
