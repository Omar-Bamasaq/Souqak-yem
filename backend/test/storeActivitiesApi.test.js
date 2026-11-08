import test from "node:test";
import assert from "node:assert/strict";
import storesRouter from "../src/routes/stores.js";
import StoreProfile from "../src/models/StoreProfile.js";
import Plan from "../src/models/Plan.js";
import City from "../src/models/City.js";
import Category from "../src/models/Category.js";
import PurchaseRequest from "../src/models/PurchaseRequest.js";
import AdminNotification from "../src/models/AdminNotification.js";
import User from "../src/models/User.js";
import { STORE_ACTIVITY_REGISTRY } from "../src/utils/storeActivityRegistry.js";

function routeHandler(method, routePath) {
  const route = storesRouter.stack.find((layer) => layer.route?.path === routePath && layer.route.methods[method]);
  assert.ok(route, `Expected ${method.toUpperCase()} ${routePath} to exist`);
  return route.route.stack.at(-1).handle;
}

async function invoke(handler, request) {
  const result = { statusCode: 200, body: null };
  const response = {
    status(code) { result.statusCode = code; return this; },
    json(body) { result.body = body; return this; }
  };
  await handler(request, response);
  return result;
}

function resolvedQuery(value) {
  return {
    select() { return this; },
    lean() { return Promise.resolve(value); }
  };
}

async function invokeStoreCreation(categorySlug, options = {}) {
  const {
    storeType = "store",
    activityKey = "cars",
    planType = "store",
    phoneNumber = "123456789",
    whatsappNumber = "987654321",
    planFeatures = [],
    deliveryAvailable = false,
    profiles = []
  } = options;
  const originals = {
    storeFindOne: StoreProfile.findOne,
    storeExists: StoreProfile.exists,
    storeCreate: StoreProfile.create,
    planFindById: Plan.findById,
    cityFind: City.find,
    categoryFind: Category.find,
    requestFindOne: PurchaseRequest.findOne,
    requestCreate: PurchaseRequest.create,
    userFindById: User.findById,
    userFind: User.find,
    adminNotificationCreate: AdminNotification.create
  };
  let createdStore;
  const adminNotifications = [];
  StoreProfile.findOne = (filter) => {
    const matchesStoreType = (profile) => filter.storeType
      ? profile.storeType === filter.storeType
      : profile.storeType === "store";
    return resolvedQuery(profiles.find((profile) => profile.userId === "owner-id" && matchesStoreType(profile)) || null);
  };
  StoreProfile.exists = async () => false;
  StoreProfile.create = async (data) => {
    createdStore = data;
    profiles.push({ _id: `store-${profiles.length + 1}`, userId: "owner-id", status: "pending", ...data });
    return { _id: `store-${profiles.length}`, ...data };
  };
  Plan.findById = () => resolvedQuery({ _id: "store-plan", isActive: true, type: planType, price: 0, currency: "SAR", durationInDays: 30, limits: { maxCategories: 3 }, features: planFeatures });
  City.find = () => resolvedQuery([]);
  Category.find = () => resolvedQuery([{ _id: "category-id", slug: categorySlug }]);
  PurchaseRequest.findOne = () => resolvedQuery(null);
  PurchaseRequest.create = async (data) => ({ _id: "request-id", ...data });
  User.findById = () => ({
    select() { return this; },
    lean: async () => ({ notificationPrefs: { purchase_approved: { inApp: false, push: false } } })
  });
  User.find = () => ({ select: async () => [] });
  AdminNotification.create = async (data) => {
    adminNotifications.push(data);
    return { toObject: () => data };
  };

  try {
    const result = await invoke(routeHandler("post", "/"), {
      user: { id: "owner-id" },
      body: {
        storeName: "معرض تجريبي",
        slug: "test-store",
        storeType,
        activityKey,
        planId: "store-plan",
        selectedCategories: ["category-id"],
        notificationEmail: "orders@example.com",
        phones: JSON.stringify([{ type: "mobile", value: phoneNumber }]),
        whatsapp: JSON.stringify([{ type: "whatsapp", value: whatsappNumber }]),
        deliveryAvailable: String(deliveryAvailable)
      },
      files: [],
      app: null
    });
    return { ...result, createdStore, adminNotifications };
  } finally {
    StoreProfile.findOne = originals.storeFindOne;
    StoreProfile.exists = originals.storeExists;
    StoreProfile.create = originals.storeCreate;
    Plan.findById = originals.planFindById;
    City.find = originals.cityFind;
    Category.find = originals.categoryFind;
    PurchaseRequest.findOne = originals.requestFindOne;
    PurchaseRequest.create = originals.requestCreate;
    User.findById = originals.userFindById;
    User.find = originals.userFind;
    AdminNotification.create = originals.adminNotificationCreate;
  }
}

test("GET /stores/activities returns only server registry activities", async () => {
  const result = await invoke(routeHandler("get", "/activities"), { query: {} });
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.length, 20);
  assert.deepEqual(result.body.slice(0, 3).map(({ activityKey }) => activityKey), ["cars", "mobile-electronics", "furniture"]);
  assert.equal(result.body[0].templateKey, "vehicle-dealer");
});

test("GET /stores/activities returns dedicated family production templates", async () => {
  const result = await invoke(routeHandler("get", "/activities"), { query: { type: "family-production" } });
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.length, 18);
  assert.equal(result.body[0].activityKey, "family-food");
  assert.equal(result.body[0].templateKey, "family-food");
});

test("new store creation rejects invalid activity keys before database access", async () => {
  const result = await invoke(routeHandler("post", "/"), {
    body: { activityKey: "free-text", notificationEmail: "orders@example.com" },
    user: { id: "owner" }
  });
  assert.equal(result.statusCode, 400);
  assert.match(result.body.error, /activityKey/);
});

test("new store creation rejects any client-supplied templateKey", async () => {
  const result = await invoke(routeHandler("post", "/"), {
    body: { activityKey: "cars", templateKey: "furniture-store" },
    user: { id: "owner" }
  });
  assert.equal(result.statusCode, 400);
  assert.match(result.body.error, /derived from activityKey/);
});

test("store create route persists the Registry key and derives businessActivity and allowed categories", () => {
  const source = routeHandler("post", "/").toString();
  assert.match(source, /activityKey:\s*activity\.activityKey/);
  assert.match(source, /businessActivity:\s*activity\.nameAr/);
  assert.match(source, /activity\.allowedCategorySlugs\.includes\(category\.slug\)/);
  assert.doesNotMatch(source, /templateKey:\s*req\.body/);
});

test("existing store activities cannot be changed through profile customization", () => {
  const source = routeHandler("patch", "/me").toString();
  assert.match(source, /protectedKeys\s*=\s*\[[^\]]*"activityKey"/);
  assert.doesNotMatch(source, /update\.activityKey\s*=/);
  assert.match(source, /if\s*\(body\.selectedCategories\s*!==\s*undefined\)/);
  assert.ok(StoreProfile.schema.path("activityKey"));
  assert.equal(StoreProfile.schema.path("activityKey").defaultValue, null);
  assert.equal(STORE_ACTIVITY_REGISTRY.length, 20);
  assert.deepEqual(STORE_ACTIVITY_REGISTRY.slice(0, 3).map(({ activityKey }) => activityKey), ["cars", "mobile-electronics", "furniture"]);
});

test("valid CreateStore request saves the selected Registry key and derived Arabic activity", async () => {
  const result = await invokeStoreCreation("cars-for-sale");
  assert.equal(result.statusCode, 201);
  assert.equal(result.createdStore.activityKey, "cars");
  assert.equal(result.createdStore.businessActivity, "معرض سيارات");
  assert.deepEqual(result.createdStore.selectedCategories, ["category-id"]);
});

test("new store registration notifies admins with a link to store requests", async () => {
  const result = await invokeStoreCreation("cars-for-sale");
  assert.equal(result.adminNotifications.length, 1);
  assert.equal(result.adminNotifications[0].type, "store_subscription");
  assert.equal(result.adminNotifications[0].title, "طلب إنشاء متجر جديد");
  assert.equal(result.adminNotifications[0].link, "/admin/store-requests");
  assert.deepEqual(result.adminNotifications[0].data, {
    requestId: "request-id",
    storeId: "store-1",
    storeType: "store",
    renewal: false
  });
  assert.ok(AdminNotification.schema.path("type").enumValues.includes("store_subscription"));
});

test("registration accepts new store and family activity/category pairs", async () => {
  const store = await invokeStoreCreation("building-supplies", {
    activityKey: "building-materials"
  });
  assert.equal(store.statusCode, 201, JSON.stringify(store.body));
  assert.equal(store.createdStore.activityKey, "building-materials");

  const family = await invokeStoreCreation("bakery-products", {
    activityKey: "family-bakery",
    storeType: "family-production",
    planType: "family-production"
  });
  assert.equal(family.statusCode, 201, JSON.stringify(family.body));
  assert.equal(family.createdStore.activityKey, "family-bakery");
  assert.equal(family.createdStore.storeType, "family-production");
});

test("CreateStore rejects a Category outside the selected activity without creating a store", async () => {
  const result = await invokeStoreCreation("bedrooms");
  assert.equal(result.statusCode, 400);
  assert.equal(result.createdStore, undefined);
});

test("family production registration stores the separate type, delivery option, and linked plan", async () => {
  const result = await invokeStoreCreation("dry-foods", {
    storeType: "family-production",
    activityKey: "family-food",
    planType: "family-production",
    planFeatures: ["delivery"],
    deliveryAvailable: true
  });
  assert.equal(result.statusCode, 201);
  assert.equal(result.createdStore.storeType, "family-production");
  assert.equal(result.createdStore.businessActivity, "مأكولات منزلية");
  assert.equal(result.createdStore.deliveryAvailable, true);
});

test("delivery is rejected at registration unless the selected plan includes it", async () => {
  const permitted = await invokeStoreCreation("cars-for-sale", {
    planFeatures: ["delivery"],
    deliveryAvailable: true
  });
  const blocked = await invokeStoreCreation("cars-for-sale", {
    deliveryAvailable: true
  });

  assert.equal(permitted.statusCode, 201);
  assert.equal(permitted.createdStore.deliveryAvailable, true);
  assert.equal(blocked.statusCode, 403);
  assert.equal(blocked.createdStore, undefined);
});

test("store and family-production registration only enables delivery on a plan with the feature", async () => {
  const permitted = await invokeStoreCreation("cars-for-sale", {
    planFeatures: ["delivery"],
    deliveryAvailable: true
  });
  const blocked = await invokeStoreCreation("cars-for-sale", {
    deliveryAvailable: true
  });

  assert.equal(permitted.statusCode, 201);
  assert.equal(permitted.createdStore.deliveryAvailable, true);
  assert.equal(blocked.statusCode, 403);
  assert.equal(blocked.createdStore, undefined);
});

test("one account can register both a regular store and a family production project", async () => {
  const profiles = [];
  const store = await invokeStoreCreation("cars-for-sale", { profiles });
  const family = await invokeStoreCreation("dry-foods", {
    storeType: "family-production",
    activityKey: "family-food",
    planType: "family-production",
    profiles
  });

  assert.equal(store.statusCode, 201);
  assert.equal(family.statusCode, 201);
  assert.deepEqual(profiles.map(({ storeType }) => storeType), ["store", "family-production"]);
  const compoundIndex = StoreProfile.schema.indexes().find(([keys]) => keys.userId === 1 && keys.storeType === 1);
  assert.ok(compoundIndex);
  assert.equal(compoundIndex[1].unique, true);
});

test("family production registration rejects a store plan and non-nine-digit contacts", async () => {
  const wrongPlan = await invokeStoreCreation("dry-foods", {
    storeType: "family-production",
    activityKey: "family-food",
    planType: "store"
  });
  assert.equal(wrongPlan.statusCode, 400);
  assert.equal(wrongPlan.createdStore, undefined);

  const invalidContact = await invokeStoreCreation("dry-foods", {
    storeType: "family-production",
    activityKey: "family-food",
    planType: "family-production",
    phoneNumber: "12345"
  });
  assert.equal(invalidContact.statusCode, 400);
  assert.equal(invalidContact.createdStore, undefined);
});