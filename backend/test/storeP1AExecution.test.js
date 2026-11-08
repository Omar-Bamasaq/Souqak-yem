import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import adsRouter from "../src/routes/ads.js";
import adminStoresRouter from "../src/routes/adminStores.js";
import storesRouter from "../src/routes/stores.js";
import Ad from "../src/models/Ad.js";
import Category from "../src/models/Category.js";
import City from "../src/models/City.js";
import ListingService from "../src/services/listingService.js";
import Plan from "../src/models/Plan.js";
import PurchaseRequest from "../src/models/PurchaseRequest.js";
import StoreProfile from "../src/models/StoreProfile.js";
import StoreSubscription from "../src/models/StoreSubscription.js";
import User from "../src/models/User.js";

const OWNER_ID = "owner-id";
const STORE_ID = "store-id";
const REQUEST_ID = "request-id";
const CATEGORY_ID = "64d3d93a1a2b3c4d5e6f7788";
const NEXT_CATEGORY_ID = "64d3d93a1a2b3c4d5e6f7789";

function routeHandler(router, method, routePath) {
  const route = router.stack.find((layer) => layer.route?.path === routePath && layer.route.methods[method]);
  assert.ok(route, `Expected ${method.toUpperCase()} ${routePath} route`);
  return route.route.stack.at(-1).handle;
}

function query(value) {
  return {
    select() { return this; },
    populate() { return this; },
    sort() { return this; },
    lean() { return Promise.resolve(value); },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
  };
}

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

async function invoke(handler, req) {
  const res = response();
  await handler(req, res);
  return res;
}

async function withStoreCreateMocks({ planPrice = 0, existingStore = null, category = { _id: CATEGORY_ID, slug: "cars-for-sale", status: "active" }, pendingRequest = null, receiptPath = null } = {}, run) {
  const originals = {
    storeFindOne: StoreProfile.findOne,
    storeExists: StoreProfile.exists,
    storeCreate: StoreProfile.create,
    storeUpdate: StoreProfile.findByIdAndUpdate,
    storeDelete: StoreProfile.findByIdAndDelete,
    planFind: Plan.findById,
    requestFind: PurchaseRequest.findOne,
    requestCreate: PurchaseRequest.create,
    categoryFind: Category.find,
    cityFind: City.find,
    userFind: User.findById
  };
  const requests = [];
  const createdStores = [];
  let updatedStore = existingStore ? { ...existingStore } : null;
  StoreProfile.findOne = () => query(existingStore);
  StoreProfile.exists = async () => false;
  StoreProfile.create = async (data) => {
    const store = { _id: STORE_ID, ...data };
    createdStores.push(store);
    return store;
  };
  StoreProfile.findByIdAndUpdate = (_id, update) => {
    updatedStore = { ...updatedStore, ...update };
    return query(updatedStore);
  };
  StoreProfile.findByIdAndDelete = async (_id) => { updatedStore = null; return null; };
  Plan.findById = () => query({
    _id: "store-plan",
    type: "store",
    isActive: true,
    price: planPrice,
    currency: "YER_ADEN",
    durationInDays: 30,
    limits: { maxCategories: 5 },
    features: []
  });
  PurchaseRequest.findOne = () => query(pendingRequest);
  PurchaseRequest.create = async (data) => {
    const request = { _id: `request-${requests.length + 1}`, ...data };
    requests.push(request);
    return request;
  };
  Category.find = (filter) => query(category && (!filter.status || category.status === filter.status) ? [category] : []);
  City.find = () => ({ select() { return this; }, lean: async () => [] });
  User.findById = () => ({ select() { return this; }, lean: async () => null });

  try {
    const files = receiptPath ? [{ path: receiptPath }] : [];
    const res = await invoke(routeHandler(storesRouter, "post", "/"), {
      user: { id: OWNER_ID },
      body: {
        storeName: "معرض تجريبي",
        slug: "test-store",
        notificationEmail: "orders@example.com",
        activityKey: "cars",
        planId: "store-plan",
        selectedCategories: [CATEGORY_ID],
        customCityName: "صنعاء"
      },
      files,
      app: null
    });
    return await run({ res, requests, createdStores, updatedStore, existingStore });
  } finally {
    StoreProfile.findOne = originals.storeFindOne;
    StoreProfile.exists = originals.storeExists;
    StoreProfile.create = originals.storeCreate;
    StoreProfile.findByIdAndUpdate = originals.storeUpdate;
    StoreProfile.findByIdAndDelete = originals.storeDelete;
    Plan.findById = originals.planFind;
    PurchaseRequest.findOne = originals.requestFind;
    PurchaseRequest.create = originals.requestCreate;
    Category.find = originals.categoryFind;
    City.find = originals.cityFind;
    User.findById = originals.userFind;
  }
}

async function withAdminMocks({ request, latestSubscription = null }, run) {
  const originals = {
    requestFind: PurchaseRequest.findById,
    requestUpdate: PurchaseRequest.findByIdAndUpdate,
    subscriptionFind: StoreSubscription.findOne,
    subscriptionCreate: StoreSubscription.create,
    subscriptionStatus: StoreSubscription.getStoreSubscriptionStatus,
    storeUpdate: StoreProfile.findByIdAndUpdate,
    userFind: User.findById
  };
  const subscriptions = [];
  let store = { _id: STORE_ID, status: "pending" };
  let currentRequest = { ...request };
  let storeUpdateCount = 0;
  let requestUpdateCount = 0;
  PurchaseRequest.findById = () => ({
    populate() { return this; },
    lean: async () => ({ ...currentRequest, storeProfile: request.storeProfileObject || { _id: request.storeProfile } })
  });
  PurchaseRequest.findByIdAndUpdate = async (_id, update) => {
    requestUpdateCount += 1;
    currentRequest = { ...currentRequest, ...update };
    return { ...currentRequest };
  };
  StoreSubscription.findOne = (filter) => ({
    sort() { return this; },
    populate() { return this; },
    lean: async () => filter.purchaseRequestId ? null : latestSubscription
  });
  StoreSubscription.getStoreSubscriptionStatus = (subscription) => subscription?.status || "inactive";
  StoreSubscription.create = async (data) => {
    const created = { _id: `subscription-${subscriptions.length + 1}`, ...data };
    subscriptions.push(created);
    return created;
  };
  StoreProfile.findByIdAndUpdate = async (_id, update) => {
    storeUpdateCount += 1;
    store = { ...store, ...update };
    return store;
  };
  User.findById = () => ({ select() { return this; }, lean: async () => null });

  try {
    const result = await run({
      subscriptions,
      get store() { return store; },
      get request() { return currentRequest; },
      get storeUpdateCount() { return storeUpdateCount; },
      get requestUpdateCount() { return requestUpdateCount; }
    });
    return result;
  } finally {
    PurchaseRequest.findById = originals.requestFind;
    PurchaseRequest.findByIdAndUpdate = originals.requestUpdate;
    StoreSubscription.findOne = originals.subscriptionFind;
    StoreSubscription.create = originals.subscriptionCreate;
    StoreSubscription.getStoreSubscriptionStatus = originals.subscriptionStatus;
    StoreProfile.findByIdAndUpdate = originals.storeUpdate;
    User.findById = originals.userFind;
  }
}

test("paid store request rejects a missing receipt", async () => {
  await withStoreCreateMocks({ planPrice: 500 }, async ({ res, requests }) => {
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /receipt/i);
    assert.equal(requests.length, 0);
  });
});

test("paid store request accepts a valid PDF receipt", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "store-receipt-"));
  const receiptPath = path.join(directory, "receipt.pdf");
  await fs.writeFile(receiptPath, "%PDF-1.4\nlocal test receipt\n");
  try {
    await withStoreCreateMocks({ planPrice: 500, receiptPath }, async ({ res, requests }) => {
      assert.equal(res.statusCode, 201);
      assert.equal(requests.length, 1);
      assert.equal(requests[0].paymentReceipt, "receipts/receipt.pdf");
    });
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("free store request accepts no receipt", async () => {
  await withStoreCreateMocks({ planPrice: 0 }, async ({ res, requests }) => {
    assert.equal(res.statusCode, 201);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].paymentReceipt, undefined);
  });
});

test("admin cannot approve a paid store request without a receipt", async () => {
  await withAdminMocks({
    request: {
      _id: REQUEST_ID,
      user: OWNER_ID,
      status: "Pending",
      price: 500,
      duration: 30,
      currency: "YER_ADEN",
      plan: { _id: "store-plan", type: "store", isActive: true, price: 500, durationInDays: 30 },
      storeProfile: STORE_ID
    }
  }, async (state) => {
    const res = await invoke(routeHandler(adminStoresRouter, "post", "/requests/:id/approve"), {
      params: { id: REQUEST_ID },
      user: { id: "admin-id", role: "admin" },
      app: null
    });
    assert.equal(res.statusCode, 400);
    assert.equal(state.subscriptions.length, 0);
    assert.equal(state.store.status, "pending");
    assert.equal(state.storeUpdateCount, 0);
    assert.equal(state.request.status, "Pending");
    assert.equal(state.requestUpdateCount, 0);
  });
});

test("admin can approve a paid store request with a receipt", async () => {
  await withAdminMocks({
    request: {
      _id: REQUEST_ID,
      user: OWNER_ID,
      status: "Pending",
      price: 500,
      duration: 30,
      currency: "YER_ADEN",
      paymentReceipt: "receipts/paid-proof.webp",
      plan: { _id: "store-plan", type: "store", isActive: true, price: 500, durationInDays: 30 },
      storeProfile: STORE_ID
    }
  }, async (state) => {
    const res = await invoke(routeHandler(adminStoresRouter, "post", "/requests/:id/approve"), {
      params: { id: REQUEST_ID },
      user: { id: "admin-id", role: "admin" },
      app: null
    });
    assert.equal(res.statusCode, 200);
    assert.equal(state.subscriptions.length, 1);
    assert.equal(state.subscriptions[0].status, "active");
    assert.equal(state.subscriptions[0].storeId, STORE_ID);
    assert.equal(state.store.status, "active");
    assert.equal(state.storeUpdateCount, 1);
    assert.equal(state.request.status, "Approved");
  });
});

test("admin can approve a free store request without a receipt", async () => {
  await withAdminMocks({
    request: {
      _id: REQUEST_ID,
      user: OWNER_ID,
      status: "Pending",
      price: 0,
      duration: 30,
      currency: "YER_ADEN",
      plan: { _id: "store-plan", type: "store", isActive: true, price: 0, durationInDays: 30 },
      storeProfile: STORE_ID
    }
  }, async (state) => {
    const res = await invoke(routeHandler(adminStoresRouter, "post", "/requests/:id/approve"), {
      params: { id: REQUEST_ID },
      user: { id: "admin-id", role: "admin" },
      app: null
    });
    assert.equal(res.statusCode, 200);
    assert.equal(state.subscriptions.length, 1);
    assert.equal(state.subscriptions[0].price, 0);
    assert.equal(state.store.status, "active");
    assert.equal(state.storeUpdateCount, 1);
    assert.equal(state.request.status, "Approved");
  });
});

async function withRejectMocks({ requests, store, latestSubscription = null }, run) {
  const originals = {
    requestFind: PurchaseRequest.findById,
    requestUpdate: PurchaseRequest.findByIdAndUpdate,
    requestList: PurchaseRequest.find,
    subscriptionFind: StoreSubscription.findOne,
    subscriptionStatus: StoreSubscription.getStoreSubscriptionStatus,
    storeUpdate: StoreProfile.findByIdAndUpdate,
    userFind: User.findById
  };
  let profile = { ...store };
  const history = requests.map((entry) => ({ ...entry }));
  let selectedRequest = null;
  PurchaseRequest.findById = (id) => ({
    populate() { return this; },
    lean: async () => {
      selectedRequest = history.find((entry) => String(entry._id) === String(id));
      return selectedRequest || null;
    }
  });
  PurchaseRequest.findByIdAndUpdate = (_id, update) => {
    Object.assign(selectedRequest, update);
    return { lean: async () => ({ ...selectedRequest }) };
  };
  PurchaseRequest.find = () => ({ lean: async () => history.map((entry) => ({ ...entry })) });
  StoreSubscription.findOne = () => ({ sort() { return this; }, lean: async () => latestSubscription });
  StoreSubscription.getStoreSubscriptionStatus = (subscription) => subscription?.status || "inactive";
  StoreProfile.findByIdAndUpdate = async (_id, update) => {
    profile = { ...profile, ...update };
    return profile;
  };
  User.findById = () => ({ select() { return this; }, lean: async () => null });
  try {
    return await run({ history, get profile() { return profile; } });
  } finally {
    PurchaseRequest.findById = originals.requestFind;
    PurchaseRequest.findByIdAndUpdate = originals.requestUpdate;
    PurchaseRequest.find = originals.requestList;
    StoreSubscription.findOne = originals.subscriptionFind;
    StoreSubscription.getStoreSubscriptionStatus = originals.subscriptionStatus;
    StoreProfile.findByIdAndUpdate = originals.storeUpdate;
    User.findById = originals.userFind;
  }
}

async function rejectRequest(requestId) {
  return invoke(routeHandler(adminStoresRouter, "post", "/requests/:id/reject"), {
    params: { id: requestId },
    user: { id: "admin-id", role: "admin" },
    body: { rejectionReason: "Receipt invalid" },
    app: null
  });
}

test("initial store rejection leaves StoreProfile rejected", async () => {
  const request = { _id: REQUEST_ID, user: OWNER_ID, status: "Pending", storeProfile: STORE_ID };
  await withRejectMocks({ requests: [request], store: { _id: STORE_ID, status: "pending" } }, async (state) => {
    const res = await rejectRequest(REQUEST_ID);
    assert.equal(res.statusCode, 200);
    assert.equal(state.profile.status, "rejected");
    assert.equal(state.profile.rejectedReason, "Receipt invalid");
  });
});

test("rejected store resubmission reuses its profile and preserves rejected request history", async () => {
  const oldRequest = { _id: "old-request", user: OWNER_ID, status: "Rejected", storeProfile: STORE_ID, rejectionReason: "Old reason" };
  await withStoreCreateMocks({
    existingStore: { _id: STORE_ID, userId: OWNER_ID, storeName: "Old", status: "rejected", rejectedReason: "Old reason" }
  }, async ({ res, createdStores, requests, updatedStore }) => {
    assert.equal(res.statusCode, 201);
    assert.equal(createdStores.length, 0);
    assert.equal(res.body.store._id, STORE_ID);
    assert.equal(res.body.store.status, "pending");
    assert.equal(updatedStore._id, STORE_ID);
    assert.equal(requests.length, 1);
    const requestHistory = [oldRequest, ...requests];
    assert.equal(requestHistory[0].status, "Rejected");
    assert.equal(requestHistory[0].rejectionReason, "Old reason");
    assert.equal(requestHistory[1].storeProfile, STORE_ID);
  });
});

test("pending store profile blocks duplicate submission without creating profile or request", async () => {
  await withStoreCreateMocks({
    existingStore: { _id: STORE_ID, userId: OWNER_ID, status: "pending" }
  }, async ({ res, createdStores, requests }) => {
    assert.equal(res.statusCode, 409);
    assert.equal(createdStores.length, 0);
    assert.equal(requests.length, 0);
  });
});

test("second rejection leaves prior rejected request and current profile state intact", async () => {
  const requests = [
    { _id: "old-request", user: OWNER_ID, status: "Rejected", storeProfile: STORE_ID, rejectionReason: "First" },
    { _id: "new-request", user: OWNER_ID, status: "Pending", storeProfile: STORE_ID }
  ];
  await withRejectMocks({ requests, store: { _id: STORE_ID, status: "pending", rejectedReason: "" } }, async ({ history, profile }) => {
    const first = await rejectRequest("new-request");
    assert.equal(first.statusCode, 200);
    const profileAfterFirst = { ...profile };
    const second = await rejectRequest("new-request");
    assert.equal(second.statusCode, 400);
    assert.deepEqual(profile, profileAfterFirst);
    assert.equal(history[0].status, "Rejected");
    assert.equal(history[0].rejectionReason, "First");
    assert.equal(history[1].status, "Rejected");
  });
});

test("rejected renewal keeps active StoreProfile active", async () => {
  const request = { _id: REQUEST_ID, user: OWNER_ID, status: "Pending", storeProfile: STORE_ID };
  await withRejectMocks({
    requests: [request],
    store: { _id: STORE_ID, status: "active" },
    latestSubscription: { _id: "active-sub", status: "active", endDate: new Date(Date.now() + 86400000) }
  }, async ({ profile }) => {
    const res = await rejectRequest(REQUEST_ID);
    assert.equal(res.statusCode, 200);
    assert.equal(profile.status, "active");
  });
});

async function withAdDetailMocks(ad, run) {
  const originals = { findById: Ad.findById, attributes: ListingService.getListingAttributes };
  Ad.findById = () => ({ populate() { return this; }, lean: async () => ad });
  ListingService.getListingAttributes = async () => [];
  try {
    const res = await invoke(routeHandler(adsRouter, "get", "/:id"), {
      params: { id: ad._id }, user: null
    });
    return await run(res);
  } finally {
    Ad.findById = originals.findById;
    ListingService.getListingAttributes = originals.attributes;
  }
}

function normalAd(overrides = {}) {
  return {
    _id: "ad-id",
    userId: OWNER_ID,
    title: "Listing",
    status: "approved",
    expiresAt: new Date(Date.now() + 86400000),
    ...overrides
  };
}

test("public ad detail hides archived and explicitly invisible ads", async () => {
  for (const ad of [normalAd({ isArchived: true }), normalAd({ isVisible: false })]) {
    await withAdDetailMocks(ad, async (res) => {
      assert.equal(res.statusCode, 404);
      assert.equal(res.body.error, "Not found");
    });
  }
});

test("owner and admin can still view a non-public ad", async () => {
  const ad = normalAd({ isArchived: true });
  const handler = routeHandler(adsRouter, "get", "/:id");
  const originals = { findById: Ad.findById, attributes: ListingService.getListingAttributes };
  Ad.findById = () => ({ populate() { return this; }, lean: async () => ad });
  ListingService.getListingAttributes = async () => [];
  try {
    for (const user of [{ id: OWNER_ID, role: "seller" }, { id: "admin-id", role: "admin" }]) {
      const res = await invoke(handler, { params: { id: ad._id }, user });
      assert.equal(res.statusCode, 200);
      assert.equal(res.body._id, ad._id);
    }
  } finally {
    Ad.findById = originals.findById;
    ListingService.getListingAttributes = originals.attributes;
  }
});

test("store creation rejects a hidden category", async () => {
  await withStoreCreateMocks({ category: { _id: CATEGORY_ID, slug: "cars-for-sale", status: "hidden" } }, async ({ res, createdStores, requests }) => {
    assert.equal(res.statusCode, 400);
    assert.equal(createdStores.length, 0);
    assert.equal(requests.length, 0);
  });
});

test("store creation accepts a valid active category", async () => {
  await withStoreCreateMocks({ category: { _id: CATEGORY_ID, slug: "cars-for-sale", status: "active" } }, async ({ res, createdStores, requests }) => {
    assert.equal(res.statusCode, 201);
    assert.equal(createdStores.length, 1);
    assert.equal(requests.length, 1);
  });
});

async function withStorePatch(body, run, {
  dynamicAttributesFeature = true,
  subscriptionStatus = "active",
  subscriptionEndDate = new Date(Date.now() + 86400000)
} = {}) {
  const originals = {
    adFind: Ad.findById,
    storeFind: StoreProfile.findOne,
    subscriptionFind: StoreSubscription.findOne,
    subscriptionStatus: StoreSubscription.getStoreSubscriptionStatus,
    planFind: Plan.findById,
    saveAttributes: ListingService.saveAttributeValues,
    deleteCategory: ListingService.deleteAttributeValuesForCategory
  };
  const savedValues = [{ attributeId: "existing-attribute", value: "kept" }];
  const deletedCategories = [];
  let findCount = 0;
  const ad = {
    _id: "ad-id",
    userId: OWNER_ID,
    title: "Before",
    description: "Description",
    price: 100,
    currency: "YER_ADEN",
    governorateId: "64d3d93a1a2b3c4d5e6f7791",
    cityId: "64d3d93a1a2b3c4d5e6f7792",
    categoryId: CATEGORY_ID,
    storeProfileId: STORE_ID,
    images: [],
    status: "approved",
    save: async () => {}
  };
  Ad.findById = () => {
    findCount += 1;
    return findCount === 1 ? Promise.resolve(ad) : query({ ...ad });
  };
  StoreProfile.findOne = () => ({ select() { return this; }, lean: async () => ({
    _id: STORE_ID,
    status: "active",
    selectedCategories: [CATEGORY_ID, NEXT_CATEGORY_ID],
    activityKey: null,
    governorateId: ad.governorateId,
    cityId: ad.cityId
  }) });
  StoreSubscription.findOne = () => ({
    sort() { return this; },
    lean: async () => ({ status: subscriptionStatus, endDate: subscriptionEndDate, planId: "store-plan" })
  });
  Plan.findById = () => query({
    type: "store",
    features: { dynamicAttributes: dynamicAttributesFeature }
  });
  ListingService.saveAttributeValues = async (_id, values) => {
    savedValues.splice(0, savedValues.length, ...values);
  };
  ListingService.deleteAttributeValuesForCategory = async (_id, categoryId) => {
    deletedCategories.push(categoryId);
    savedValues.splice(0, savedValues.length);
  };

  try {
    const route = adsRouter.stack.find((layer) => layer.route?.path === "/:id" && layer.route.methods.patch);
    const layers = route.route.stack;
    const roleGuard = layers.find((layer) => layer.handle.toString().includes("roles.includes(req.user.role)")).handle;
    const protectFields = layers.find((layer) => layer.handle.toString().includes("sensitiveFields")).handle;
    const validateBody = layers.find((layer) => layer.handle.toString().includes("schema.validate(req.body")).handle;
    const result = await invoke(routeHandler(adsRouter, "patch", "/:id"), {
      params: { id: ad._id }, user: { id: OWNER_ID, role: "seller" }, body, files: []
    });
    roleGuard;
    protectFields;
    validateBody;
    return await run({ res: result, ad, savedValues, deletedCategories });
  } finally {
    Ad.findById = originals.adFind;
    StoreProfile.findOne = originals.storeFind;
    StoreSubscription.findOne = originals.subscriptionFind;
    StoreSubscription.getStoreSubscriptionStatus = originals.subscriptionStatus;
    Plan.findById = originals.planFind;
    ListingService.saveAttributeValues = originals.saveAttributes;
    ListingService.deleteAttributeValuesForCategory = originals.deleteCategory;
  }
}

test("title-only and price-only PATCH preserve stored attributes", async () => {
  for (const body of [{ title: "After" }, { price: 250 }]) {
    await withStorePatch(body, async ({ res, savedValues, deletedCategories }) => {
      assert.equal(res.statusCode, 200, JSON.stringify(res.body));
      assert.deepEqual(savedValues, [{ attributeId: "existing-attribute", value: "kept" }]);
      assert.deepEqual(deletedCategories, []);
    });
  }
});

test("category change without attributes preserves existing stored attributes", async () => {
  await withStorePatch({ categoryId: NEXT_CATEGORY_ID }, async ({ res, savedValues, deletedCategories }) => {
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.deepEqual(savedValues, [{ attributeId: "existing-attribute", value: "kept" }]);
    assert.deepEqual(deletedCategories, []);
  });
});

test("explicit attributes PATCH replaces stored attributes", async () => {
  const nextAttributes = [{ attributeId: "64d3d93a1a2b3c4d5e6f7793", value: "updated" }];
  await withStorePatch({ attributes: nextAttributes }, async ({ res, savedValues }) => {
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.deepEqual(savedValues, nextAttributes);
  });
});

test("Store Product PATCH rejects explicitly submitted attributes when the plan disables them", async () => {
  for (const attributes of [[], [{ attributeId: "64d3d93a1a2b3c4d5e6f7793", value: "value" }]]) {
    await withStorePatch({
      title: "Must not save",
      attributes,
      features: { dynamicAttributes: true },
      dynamicAttributes: true
    }, async ({ res, ad, savedValues }) => {
      assert.equal(res.statusCode, 403);
      assert.equal(ad.title, "Before");
      assert.deepEqual(savedValues, [{ attributeId: "existing-attribute", value: "kept" }]);
    }, { dynamicAttributesFeature: false });
  }
});

test("Store Product PATCH without attributes preserves stored attributes when the feature is disabled", async () => {
  await withStorePatch({ title: "Changed without attribute edit" }, async ({ res, savedValues, deletedCategories }) => {
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.deepEqual(savedValues, [{ attributeId: "existing-attribute", value: "kept" }]);
    assert.deepEqual(deletedCategories, []);
  }, { dynamicAttributesFeature: false });
});

test("Store Product PATCH rejects submitted attributes when its subscription has expired", async () => {
  await withStorePatch({
    attributes: [{ attributeId: "64d3d93a1a2b3c4d5e6f7793", value: "value" }]
  }, async ({ res, savedValues }) => {
    assert.equal(res.statusCode, 403);
    assert.deepEqual(savedValues, [{ attributeId: "existing-attribute", value: "kept" }]);
  }, {
    dynamicAttributesFeature: true,
    subscriptionStatus: "active",
    subscriptionEndDate: new Date(Date.now() - 1)
  });
});
