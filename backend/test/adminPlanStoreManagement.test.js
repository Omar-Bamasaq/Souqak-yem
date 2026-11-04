import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import adminPlansRouter from "../src/routes/adminPlans.js";
import publicPlansRouter from "../src/routes/plans.js";
import Plan from "../src/models/Plan.js";
import PurchaseRequest from "../src/models/PurchaseRequest.js";

const adminPlansSource = fs.readFileSync(new URL("../src/routes/adminPlans.js", import.meta.url), "utf8");
const planModelSource = fs.readFileSync(new URL("../src/models/Plan.js", import.meta.url), "utf8");
const adminPlansUiSource = fs.readFileSync(new URL("../../frontend/src/pages/AdminPlans.jsx", import.meta.url), "utf8");

test("admin store plan creation accepts object features and non-negative integer limits", () => {
  assert.match(adminPlansSource, /\["verification", "featured", "store", "family-production"\]/);
  assert.match(adminPlansSource, /\["store", "family-production"\]\.includes\(type\)/);
  assert.match(adminPlansSource, /"family-production"/);
  assert.match(adminPlansSource, /maxProducts|maxCategories/);
  assert.match(adminPlansSource, /Number\.isInteger|>=\s*0|non-negative/);
});

test("plan model already exposes the limits object used by store plans", () => {
  assert.match(planModelSource, /limits\s*:\s*\{\s*maxCategories|maxProducts/);
});

test("admin UI exposes store plan limits inputs without changing other plan types", () => {
  assert.match(adminPlansUiSource, /maxProducts|maxCategories/);
  assert.match(adminPlansUiSource, /value=\{form\.type\}|option value="store"/);
  assert.match(adminPlansUiSource, /option value="family-production"/);
  assert.match(adminPlansUiSource, /dynamicAttributes/);
  assert.match(adminPlansUiSource, /multipleContacts/);
  assert.match(adminPlansUiSource, /rotationIntervalSeconds/);
});

test("placement carousel rotation is configurable through the admin plan API", async () => {
  const originalCreate = Plan.create;
  let createdPlan;
  Plan.create = async (data) => { createdPlan = data; return data; };
  const route = adminPlansRouter.stack.find((entry) => entry.route?.path === "/" && entry.route.methods.post);
  const handler = route.route.stack.at(-1).handle;
  const invoke = async (body) => {
    const result = { statusCode: 201, body: null };
    const res = { status(code) { result.statusCode = code; return this; }, json(value) { result.body = value; return this; } };
    await handler({ body }, res);
    return result;
  };

  try {
    const response = await invoke({
      name: "Rotating placement",
      type: "featured",
      adServiceType: "placement",
      adPositions: ["home"],
      rotationIntervalSeconds: 9,
      durationInDays: 1,
      price: 2000,
      currency: "YER_ADEN"
    });
    assert.equal(response.statusCode, 201);
    assert.equal(createdPlan.rotationIntervalSeconds, 9);
    assert.equal(createdPlan.interstitialDelaySeconds, 8);

    const invalid = await invoke({
      name: "Invalid placement",
      type: "featured",
      adServiceType: "placement",
      adPositions: ["home"],
      rotationIntervalSeconds: 61,
      durationInDays: 1,
      price: 2000,
      currency: "YER_ADEN"
    });
    assert.equal(invalid.statusCode, 400);
  } finally {
    Plan.create = originalCreate;
  }
});

test("admin plan creation stores object features and limits", async () => {
  const originalCreate = Plan.create;
  let createdPlan;
  Plan.create = async (data) => { createdPlan = data; return data; };

  try {
    const route = adminPlansRouter.stack.find((entry) => entry.route?.path === "/" && entry.route.methods.post);
    const handler = route.route.stack.at(-1).handle;
    const result = { statusCode: 201, body: null };
    const res = { status(code) { result.statusCode = code; return this; }, json(body) { result.body = body; return this; } };
    await handler({
      body: {
        name: "Store",
        type: "store",
        durationInDays: 30,
        limits: { maxProducts: 12, maxCategories: 4 },
        features: { pwa: true, delivery: false }
      }
    }, res);

    assert.equal(result.statusCode, 201);
    assert.equal(createdPlan.features.pwa, true);
    assert.equal(createdPlan.features.delivery, false);
    assert.equal(createdPlan.features.cart, false);
    assert.deepEqual(createdPlan.limits, { maxProducts: 12, maxCategories: 4 });
  } finally {
    Plan.create = originalCreate;
  }
});

test("editing a store plan updates features without changing unsubmitted feature values", async () => {
  const originals = { findById: Plan.findById, update: Plan.findByIdAndUpdate };
  const existing = {
    _id: "plan-id",
    type: "store",
    features: { ...Object.fromEntries(["dynamicAttributes", "cart", "orders", "whatsappOrdering", "delivery", "discounts", "inventory", "customization", "advancedCustomization", "pwa", "analytics", "notifications", "multipleContacts"].map((key) => [key, false])), pwa: true },
    limits: { maxProducts: 5, maxCategories: 3 }
  };
  let savedUpdate;
  Plan.findById = () => ({ lean: async () => existing });
  Plan.findByIdAndUpdate = (_id, update) => {
    savedUpdate = update;
    return { lean: async () => ({ ...existing, ...update }) };
  };

  try {
    const route = adminPlansRouter.stack.find((entry) => entry.route?.path === "/:id" && entry.route.methods.patch);
    const handler = route.route.stack.at(-1).handle;
    const result = { statusCode: 200, body: null };
    const res = { status(code) { result.statusCode = code; return this; }, json(body) { result.body = body; return this; } };
    await handler({ params: { id: "plan-id" }, body: { features: { multipleContacts: true, delivery: true } } }, res);

    assert.equal(result.statusCode, 200);
    assert.equal(savedUpdate.features.multipleContacts, true);
    assert.equal(savedUpdate.features.delivery, true);
    assert.equal(savedUpdate.features.pwa, true);
    assert.deepEqual(savedUpdate.limits, { maxProducts: 5, maxCategories: 3 });
  } finally {
    Plan.findById = originals.findById;
    Plan.findByIdAndUpdate = originals.update;
  }
});

test("admin API rejects non-boolean features and negative limits", async () => {
  const originalCreate = Plan.create;
  Plan.create = async (data) => data;
  const postRoute = adminPlansRouter.stack.find((entry) => entry.route?.path === "/" && entry.route.methods.post);
  const handler = postRoute.route.stack.at(-1).handle;

  try {
    const invoke = async (body) => {
      const result = { statusCode: 201, body: null };
      const res = { status(code) { result.statusCode = code; return this; }, json(value) { result.body = value; return this; } };
      await handler({ body }, res);
      return result;
    };
    const invalidFeature = await invoke({ name: "Store", type: "store", durationInDays: 30, features: { cart: "yes" } });
    assert.equal(invalidFeature.statusCode, 400);
    const negativeLimit = await invoke({ name: "Store", type: "store", durationInDays: 30, limits: { maxProducts: -1 } });
    assert.equal(negativeLimit.statusCode, 400);
    const unknownLimit = await invoke({ name: "Store", type: "store", durationInDays: 30, limits: { maxProducts: 2, maxOrders: 10 } });
    assert.equal(unknownLimit.statusCode, 400);
    const unknownFeature = await invoke({ name: "Store", type: "store", durationInDays: 30, features: { unknown: true } });
    assert.equal(unknownFeature.statusCode, 400);
  } finally {
    Plan.create = originalCreate;
  }
});

test("customer plans keep only previously active legacy features enabled", async () => {
  const originalFind = Plan.find;
  Plan.find = () => ({
    sort() { return this; },
    lean: async () => [{ _id: "store-plan", type: "store", name: "Store", price: 100, features: ["pwa", "analytics", "storefront"] }]
  });

  try {
    const route = publicPlansRouter.stack.find((entry) => entry.route?.path === "/" && entry.route.methods.get);
    const handler = route.route.stack.at(-1).handle;
    const result = { statusCode: 200, body: null };
    const res = { status(code) { result.statusCode = code; return this; }, json(body) { result.body = body; return this; } };
    await handler({ query: { type: "store" } }, res);

    assert.equal(result.body[0].features.pwa, true);
    assert.equal(result.body[0].features.analytics, false);
    assert.equal(result.body[0].features.cart, false);
  } finally {
    Plan.find = originalFind;
  }
});

test("editing a legacy store plan archives unsupported feature strings without activating them", async () => {
  const originals = { findById: Plan.findById, update: Plan.findByIdAndUpdate };
  const existing = { _id: "legacy-id", type: "store", features: ["pwa", "pushNotifications", "storefront"] };
  let savedUpdate;
  Plan.findById = () => ({ lean: async () => existing });
  Plan.findByIdAndUpdate = (_id, update) => {
    savedUpdate = update;
    return { lean: async () => ({ ...existing, ...update }) };
  };

  try {
    const route = adminPlansRouter.stack.find((entry) => entry.route?.path === "/:id" && entry.route.methods.patch);
    const handler = route.route.stack.at(-1).handle;
    const result = { statusCode: 200, body: null };
    const res = { status(code) { result.statusCode = code; return this; }, json(body) { result.body = body; return this; } };
    await handler({ params: { id: "legacy-id" }, body: { features: { analytics: true } } }, res);

    assert.equal(result.statusCode, 200);
    assert.equal(savedUpdate.features.pwa, true);
    assert.equal(savedUpdate.features.analytics, true);
    assert.deepEqual(savedUpdate.legacyFeatures, ["pushNotifications", "storefront"]);
  } finally {
    Plan.findById = originals.findById;
    Plan.findByIdAndUpdate = originals.update;
  }
});

test("new placement plan creation stores its description and server-validated Yemeni rial price", async () => {
  const originalCreate = Plan.create;
  let createdPlan;
  Plan.create = async (data) => { createdPlan = data; return data; };
  const route = adminPlansRouter.stack.find((entry) => entry.route?.path === "/" && entry.route.methods.post);
  const handler = route.route.stack.at(-1).handle;
  const result = { statusCode: 201, body: null };
  const res = { status(code) { result.statusCode = code; return this; }, json(body) { result.body = body; return this; } };

  try {
    await handler({
      body: {
        name: "مساحة رئيسية",
        description: "إعلان ممول داخل الصفحة الرئيسية",
        type: "featured",
        adServiceType: "placement",
        adPositions: ["home"],
        durationInDays: 1,
        price: 2000,
        currency: "YER_ADEN"
      }
    }, res);
    assert.equal(result.statusCode, 201);
    assert.equal(createdPlan.name, "مساحة رئيسية");
    assert.equal(createdPlan.description, "إعلان ممول داخل الصفحة الرئيسية");
    assert.equal(createdPlan.price, 2000);
    assert.equal(createdPlan.currency, "YER_ADEN");
    assert.equal(createdPlan.durationInDays, 1);
  } finally {
    Plan.create = originalCreate;
  }
});

test("new featured promotion plans reject non-Yemeni currencies", async () => {
  const originalCreate = Plan.create;
  Plan.create = async (data) => data;
  const route = adminPlansRouter.stack.find((entry) => entry.route?.path === "/" && entry.route.methods.post);
  const handler = route.route.stack.at(-1).handle;
  const result = { statusCode: 201, body: null };
  const res = { status(code) { result.statusCode = code; return this; }, json(body) { result.body = body; return this; } };
  try {
    await handler({
      body: {
        name: "باقة تمييز",
        type: "featured",
        adServiceType: "featured",
        durationInDays: 1,
        price: 2000,
        currency: "SAR"
      }
    }, res);
    assert.equal(result.statusCode, 400);
  } finally {
    Plan.create = originalCreate;
  }
});

test("admin can pause and reactivate a promotion plan through the protected plan API", async () => {
  const originals = { findById: Plan.findById, update: Plan.findByIdAndUpdate };
  const existing = { _id: "plan-id", type: "featured", isActive: true };
  let savedUpdate;
  Plan.findById = () => ({ lean: async () => existing });
  Plan.findByIdAndUpdate = (_id, update) => {
    savedUpdate = update;
    return { lean: async () => ({ ...existing, ...update }) };
  };
  const route = adminPlansRouter.stack.find((entry) => entry.route?.path === "/:id" && entry.route.methods.patch);
  const handler = route.route.stack.at(-1).handle;
  const result = { statusCode: 200, body: null };
  const res = { status(code) { result.statusCode = code; return this; }, json(body) { result.body = body; return this; } };

  try {
    await handler({ params: { id: "plan-id" }, body: { isActive: false } }, res);
    assert.equal(result.statusCode, 200);
    assert.equal(savedUpdate.isActive, false);
    assert.equal(result.body.isActive, false);
    const authMiddleware = adminPlansRouter.stack.find((layer) => layer.name === "auth");
    const roleMiddleware = adminPlansRouter.stack.find((layer) => !layer.route && layer.name === "<anonymous>");
    assert.ok(authMiddleware, "the router retains authentication middleware");
    assert.ok(roleMiddleware, "the router retains admin-role middleware");
  } finally {
    Plan.findById = originals.findById;
    Plan.findByIdAndUpdate = originals.update;
  }
});

test("deleting a promotion plan with linked requests archives rather than erases it", async () => {
  const originals = { findById: Plan.findById, findByIdAndDelete: Plan.findByIdAndDelete, exists: PurchaseRequest.exists };
  const plan = { _id: "used-plan", isActive: true, save: async () => {} };
  let physicallyDeleted = false;
  Plan.findById = async () => plan;
  Plan.findByIdAndDelete = async () => { physicallyDeleted = true; };
  PurchaseRequest.exists = async () => true;
  const route = adminPlansRouter.stack.find((entry) => entry.route?.path === "/:id" && entry.route.methods.delete);
  const handler = route.route.stack.at(-1).handle;
  const result = { statusCode: 200, body: null };
  const res = { status(code) { result.statusCode = code; return this; }, json(body) { result.body = body; return this; } };

  try {
    await handler({ params: { id: "used-plan" } }, res);
    assert.equal(result.statusCode, 200);
    assert.equal(plan.isActive, false);
    assert.equal(result.body.archived, true);
    assert.equal(physicallyDeleted, false);
  } finally {
    Plan.findById = originals.findById;
    Plan.findByIdAndDelete = originals.findByIdAndDelete;
    PurchaseRequest.exists = originals.exists;
  }
});

test("purchase request schema stores an immutable pricing and service snapshot", () => {
  assert.ok(PurchaseRequest.schema.path("planSnapshot.name"));
  assert.ok(PurchaseRequest.schema.path("planSnapshot.price"));
  assert.ok(PurchaseRequest.schema.path("planSnapshot.durationInDays"));
  assert.ok(PurchaseRequest.schema.path("planSnapshot.adPositions"));
  assert.ok(PurchaseRequest.schema.path("planSnapshot.rotationIntervalSeconds"));
  assert.ok(PurchaseRequest.schema.path("campaign.rotationIntervalSeconds"));
  assert.ok(PurchaseRequest.schema.path("planSnapshot.socialPromotionRequested"));
});
