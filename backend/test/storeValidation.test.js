import test from "node:test";
import assert from "node:assert/strict";
import storesRouter from "../src/routes/stores.js";
import StoreProfile from "../src/models/StoreProfile.js";
import Plan from "../src/models/Plan.js";
import PurchaseRequest from "../src/models/PurchaseRequest.js";
import Category from "../src/models/Category.js";
import City from "../src/models/City.js";
import User from "../src/models/User.js";
import {
  normalizeStoreSlug,
  validateSelectedCategories,
  validateStoreSubmission,
  validateStoreEmail,
  validateCoordinates,
  getStorePlanSnapshot,
  validateStoreSlug
} from "../src/utils/storeValidation.js";

function query(value) {
  return {
    select() { return this; },
    populate() { return this; },
    sort() { return this; },
    lean() { return Promise.resolve(value); }
  };
}

async function invokeStoreCreate(maxCategories, selectedCategories, coordinates = {}, notificationEmail = "owner@example.com") {
  const originals = {
    storeFindOne: StoreProfile.findOne,
    storeExists: StoreProfile.exists,
    storeCreate: StoreProfile.create,
    planFindById: Plan.findById,
    requestFindOne: PurchaseRequest.findOne,
    requestCreate: PurchaseRequest.create,
    categoryFind: Category.find,
    cityFind: City.find,
    userFindById: User.findById
  };
  StoreProfile.findOne = () => query(null);
  StoreProfile.exists = async () => null;
  StoreProfile.create = async (data) => ({ _id: "store-id", ...data });
  Plan.findById = () => query({ _id: "plan-id", type: "store", isActive: true, limits: { maxCategories }, price: 0, currency: "YER_ADEN", durationInDays: 30 });
  PurchaseRequest.findOne = () => query(null);
  PurchaseRequest.create = async (data) => data;
  Category.find = (filter) => query(filter._id.$in.map((_id, index) => ({
    _id,
    slug: ["cars-for-sale", "cars-for-rent", "cars-transfer"][index]
  })));
  City.find = () => query([]);
  User.findById = () => ({ select() { return this; }, lean: async () => null });

  try {
    const route = storesRouter.stack.find((layer) => layer.route?.path === "/" && layer.route.methods.post);
    const handler = route.route.stack.at(-1).handle;
    const result = { statusCode: 201, body: null };
    const res = { status(code) { result.statusCode = code; return this; }, json(body) { result.body = body; return this; } };
    await handler({
      user: { id: "owner-id" },
      body: {
        storeName: "متجر تجريبي",
        slug: "matjar-tajrebi",
        activityKey: "cars",
        planId: "plan-id",
        email: "",
        notificationEmail,
        selectedCategories: JSON.stringify(selectedCategories),
        customCityName: "صنعاء",
        ...coordinates
      },
      files: [],
      app: null
    }, res);
    return result;
  } finally {
    StoreProfile.findOne = originals.storeFindOne;
    StoreProfile.exists = originals.storeExists;
    StoreProfile.create = originals.storeCreate;
    Plan.findById = originals.planFindById;
    PurchaseRequest.findOne = originals.requestFindOne;
    PurchaseRequest.create = originals.requestCreate;
    Category.find = originals.categoryFind;
    City.find = originals.cityFind;
    User.findById = originals.userFindById;
  }
}

test("normalizeStoreSlug lowers and strips unsafe characters", () => {
  assert.equal(normalizeStoreSlug("  My Store 123! "), "my-store-123");
  assert.equal(normalizeStoreSlug("سوقك متجر"), "سوقك-متجر");
});

test("store slugs allow only unique-safe lowercase English words and hyphens", () => {
  assert.deepEqual(validateStoreSlug("matjar-albamasaq"), { valid: true, slug: "matjar-albamasaq" });
  for (const slug of ["ab", "-matjar", "matjar-", "matjar--store", "https://example.com", "store.name", "admin"]) {
    assert.equal(validateStoreSlug(slug).valid, false, slug);
  }
});

test("selected categories rejects duplicates, empty input, and over-limit values", () => {
  const empty = validateSelectedCategories([], 5);
  assert.equal(empty.valid, false);
  assert.match(empty.message, /at least one|empty/i);

  const unlimited = validateSelectedCategories(["a", "b", "c"], 0);
  assert.equal(unlimited.valid, true);

  const valid = validateSelectedCategories(["64d3d93a1a2b3c4d5e6f7788", "64d3d93a1a2b3c4d5e6f7789"], 2);
  assert.equal(valid.valid, true);

  const dup = validateSelectedCategories(["a", "a"], 2);
  assert.equal(dup.valid, false);
  assert.match(dup.message, /duplicate/i);

  const over = validateSelectedCategories(["a", "b", "c"], 2);
  assert.equal(over.valid, false);
  assert.match(over.message, /maximum/i);
});

test("store map coordinates are optional but must be a valid pair within geographic bounds", () => {
  assert.deepEqual(validateCoordinates("", ""), { valid: true, lat: null, lng: null });
  assert.deepEqual(validateCoordinates("15.3694", "44.1910"), {
    valid: true,
    lat: 15.3694,
    lng: 44.191
  });
  assert.equal(validateCoordinates("15", "").valid, false);
  assert.equal(validateCoordinates("91", "44").valid, false);
  assert.equal(validateCoordinates("15", "-181").valid, false);
});

test("store creation accepts unlimited categories at zero and enforces positive plan limits", async () => {
  const categories = ["64d3d93a1a2b3c4d5e6f7788", "64d3d93a1a2b3c4d5e6f7789", "64d3d93a1a2b3c4d5e6f7790"];
  const unlimited = await invokeStoreCreate(0, categories);
  const capped = await invokeStoreCreate(2, categories);

  assert.equal(unlimited.statusCode, 201);
  assert.equal(unlimited.body.store.notificationEmail, "owner@example.com");
  assert.equal(unlimited.body.store.slug, "matjar-tajrebi");
  assert.equal(capped.statusCode, 400);
  assert.match(capped.body.message || capped.body.error, /Maximum allowed categories/i);

  const invalidCoordinates = await invokeStoreCreate(0, categories, { lat: "91", lng: "44" });
  assert.equal(invalidCoordinates.statusCode, 400);
  assert.match(invalidCoordinates.body.error, /Latitude/);
});

test("store creation requires a valid private notification email", async () => {
  const categories = ["64d3d93a1a2b3c4d5e6f7788"];
  const missing = await invokeStoreCreate(0, categories, {}, "");
  const invalid = await invokeStoreCreate(0, categories, {}, "not-an-email");

  assert.equal(missing.statusCode, 400);
  assert.equal(invalid.statusCode, 400);
  assert.match(missing.body.error, /بريد/);
  assert.match(invalid.body.error, /البريد الإلكتروني/);
  assert.deepEqual(validateStoreEmail(""), { valid: true, email: "" });
  assert.equal(validateStoreEmail("owner@example.com", { required: true }).valid, true);
  assert.equal(StoreProfile.schema.path("notificationEmail").options.select, false);
});

test("store submission validation requires required fields and valid plan constraints", () => {
  const result = validateStoreSubmission({
    storeName: "",
    businessActivity: "",
    selectedCategories: ["a", "b", "c"],
    plan: { type: "store", maxCategories: 2 }
  });

  assert.equal(result.valid, false);
  assert.match(result.message, /storeName|businessActivity|maximum/i);
});

test("plan snapshot keeps the server-side price and duration for store approval", () => {
  const snapshot = getStorePlanSnapshot({
    price: 5000,
    currency: "YER_ADEN",
    durationInDays: 30,
    isActive: true
  });

  assert.deepEqual(snapshot, {
    price: 5000,
    currency: "YER_ADEN",
    duration: 30
  });
});

test("store request snapshot includes duration independently of later plan changes", () => {
  const snapshot = getStorePlanSnapshot({
    price: 7000,
    currency: "USD",
    durationInDays: 90
  });

  assert.equal(snapshot.price, 7000);
  assert.equal(snapshot.currency, "USD");
  assert.equal(snapshot.duration, 90);
});
