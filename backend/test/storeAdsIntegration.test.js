import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import adsRouter from "../src/routes/ads.js";
import Ad from "../src/models/Ad.js";
import StoreProfile from "../src/models/StoreProfile.js";
import StoreSubscription from "../src/models/StoreSubscription.js";
import Category from "../src/models/Category.js";
import Plan from "../src/models/Plan.js";
import Commission from "../src/models/Commission.js";
import SystemSettings from "../src/models/SystemSettings.js";
import AdminNotification from "../src/models/AdminNotification.js";
import User from "../src/models/User.js";
import ListingService from "../src/services/listingService.js";
import { getStoreProductPricing } from "../src/utils/storeProductPricing.js";

const adsRouteSource = fs.readFileSync(new URL("../src/routes/ads.js", import.meta.url), "utf8");

function getCreateRouteSource() {
  const routeLayer = adsRouter.stack.find(
    (layer) => layer.route?.path === "/" && layer.route.methods.post
  );
  assert.ok(routeLayer, "POST /api/ads route must exist");
  return routeLayer.route.stack.map((layer) => layer.handle.toString()).join("\n");
}

function getUpdateRouteSource() {
  const routeLayer = adsRouter.stack.find(
    (layer) => layer.route?.path === "/:id" && layer.route.methods.patch
  );
  assert.ok(routeLayer, "PATCH /api/ads/:id route must exist");
  return routeLayer.route.stack.map((layer) => layer.handle.toString()).join("\n");
}

function resolvedQuery(value) {
  return {
    select() { return this; },
    sort() { return this; },
    populate() { return this; },
    limit() { return this; },
    lean() { return Promise.resolve(value); }
  };
}

async function createAdWithStoreMode(storeProduct, { maxProducts = 0, currentVisibleCount = 0, activityKey = null, storeType = "store", categorySlug = "cars-for-sale", selectedCategories = ["category-id"], attributes = [], sendAttributes = true, dynamicAttributesFeature = true, subscriptionStatus = "active", subscriptionEndDate = new Date(Date.now() + 86400000), payloadFeatures, deliveryFeature = false, discountsFeature = false, inventoryFeature = false, isAvailableForDelivery, deliveryAlias, discountEnabled, discountType, discountValue, inventoryEnabled, stockQuantity } = {}) {
  const store = {
    _id: "store-owner-profile",
    userId: "owner-id",
    status: "active",
    activityKey,
    storeType,
    selectedCategories,
    governorateId: "governorate-id",
    cityId: "city-id"
  };
  const createdAds = [];
  const savedAttributeCalls = [];
  let countCalls = 0;
  const originals = {
    adFindOne: Ad.findOne,
    adCreate: Ad.create,
    adCount: Ad.countDocuments,
    storeFindOne: StoreProfile.findOne,
    categoryFindById: Category.findById,
    subscriptionFindOne: StoreSubscription.findOne,
    planFindById: Plan.findById,
    commissionFind: Commission.find,
    settings: SystemSettings.getSettings,
    notificationCreate: AdminNotification.create,
    userFind: User.find,
    saveAttributeValues: ListingService.saveAttributeValues
  };

  Ad.findOne = async () => null;
  Ad.create = async (data) => {
    createdAds.push(data);
    return { _id: `ad-${createdAds.length}`, ...data };
  };
  StoreProfile.findOne = () => ({ ...resolvedQuery(store), select() { return this; } });
  Category.findById = () => ({ select() { return this; }, lean: async () => ({ _id: "category-id", slug: categorySlug }) });
  StoreSubscription.findOne = () => ({
    ...resolvedQuery({ status: subscriptionStatus, endDate: subscriptionEndDate, planId: "plan-id" }),
    sort() { return this; }
  });
  Plan.findById = () => resolvedQuery({ type: storeType, features: { dynamicAttributes: dynamicAttributesFeature, delivery: deliveryFeature, discounts: discountsFeature, inventory: inventoryFeature }, limits: { maxProducts } });
  Ad.countDocuments = async () => { countCalls += 1; return currentVisibleCount; };
  Commission.find = () => resolvedQuery([]);
  SystemSettings.getSettings = async () => ({ prohibitedKeywords: [], adReviewMode: "auto", adReviewDelayMinutes: 0 });
  AdminNotification.create = async (data) => ({ toObject: () => data });
  User.find = () => ({ select: async () => [] });
  ListingService.saveAttributeValues = async (...args) => { savedAttributeCalls.push(args); return []; };

  try {
    const route = adsRouter.stack.find((layer) => layer.route?.path === "/" && layer.route.methods.post);
    const handler = route.route.stack.at(-1).handle;
    const result = { statusCode: 201, body: null };
    const res = {
      status(code) { result.statusCode = code; return this; },
      json(body) { result.body = body; return this; }
    };
    await handler({
      user: { id: "owner-id" },
      body: {
        title: storeProduct ? "Store item" : "Normal listing",
        description: "",
        price: 100,
        currency: "YER_ADEN",
        categoryId: "category-id",
        storeType,
        governorateId: "governorate-id",
        cityId: "city-id",
        storeProduct: String(storeProduct),
        isAvailable: "false",
        ...(typeof isAvailableForDelivery !== "undefined" ? { isAvailableForDelivery: String(isAvailableForDelivery) } : {}),
        ...(typeof deliveryAlias !== "undefined" ? { delivery: deliveryAlias } : {}),
        ...(typeof discountEnabled !== "undefined" ? { discountEnabled: String(discountEnabled) } : {}),
        ...(typeof discountType !== "undefined" ? { discountType } : {}),
        ...(typeof discountValue !== "undefined" ? { discountValue: String(discountValue) } : {}),
        ...(typeof inventoryEnabled !== "undefined" ? { inventoryEnabled: String(inventoryEnabled) } : {}),
        ...(typeof stockQuantity !== "undefined" ? { stockQuantity: String(stockQuantity) } : {}),
        ...(sendAttributes ? { attributes } : {}),
        ...(payloadFeatures ? { features: payloadFeatures } : {}),
        ...(typeof payloadFeatures?.dynamicAttributes === "boolean"
          ? { dynamicAttributes: payloadFeatures.dynamicAttributes }
          : {}),
        storeProfileId: "attacker-selected-store"
      },
      files: [],
      app: null
    }, res);
    return { result, ad: createdAds[0], store, countCalls, createdAds, savedAttributeCalls };
  } finally {
    Ad.findOne = originals.adFindOne;
    Ad.create = originals.adCreate;
    Ad.countDocuments = originals.adCount;
    StoreProfile.findOne = originals.storeFindOne;
    Category.findById = originals.categoryFindById;
    StoreSubscription.findOne = originals.subscriptionFindOne;
    Plan.findById = originals.planFindById;
    Commission.find = originals.commissionFind;
    SystemSettings.getSettings = originals.settings;
    AdminNotification.create = originals.notificationCreate;
    User.find = originals.userFind;
    ListingService.saveAttributeValues = originals.saveAttributeValues;
  }
}

async function updateStoreAdCategory({ previousCategoryId, categoryId, selectedCategories, categorySlug }) {
  const store = {
    _id: "store-owner-profile",
    userId: "owner-id",
    status: "active",
    activityKey: "cars",
    storeType: "store",
    selectedCategories,
    governorateId: "governorate-id",
    cityId: "city-id",
    slug: "store"
  };
  const ad = {
    _id: "store-ad-id",
    userId: "owner-id",
    storeProfileId: store._id,
    categoryId: previousCategoryId,
    status: "pending",
    save: async () => {}
  };
  const originals = {
    adFindById: Ad.findById,
    storeFindOne: StoreProfile.findOne,
    categoryFindById: Category.findById,
    subscriptionFindOne: StoreSubscription.findOne,
    subscriptionStatus: StoreSubscription.getStoreSubscriptionStatus
  };
  Ad.findById = () => {
    if (ad._hasBeenSaved) {
      return {
        populate() { return this; },
        lean: async () => ({ ...ad })
      };
    }
    return Promise.resolve(ad);
  };
  const originalSave = ad.save;
  ad.save = async () => {
    ad._hasBeenSaved = true;
    await originalSave();
  };
  StoreProfile.findOne = () => ({
    select() { return this; },
    lean: async () => store
  });
  Category.findById = () => ({
    select() { return this; },
    lean: async () => ({ _id: categoryId, slug: categorySlug })
  });
  StoreSubscription.findOne = () => ({
    sort() { return this; },
    lean: async () => ({
      status: "active",
      endDate: new Date(Date.now() + 86400000),
      planId: "store-plan"
    })
  });
  StoreSubscription.getStoreSubscriptionStatus = (subscription) => subscription?.status || "inactive";

  try {
    const route = adsRouter.stack.find((layer) => layer.route?.path === "/:id" && layer.route.methods.patch);
    const handler = route.route.stack.at(-1).handle;
    const response = { statusCode: 200, body: null };
    const res = {
      status(code) { response.statusCode = code; return this; },
      json(body) { response.body = body; return this; }
    };
    await handler({
      params: { id: ad._id },
      user: { id: "owner-id", role: "seller" },
      body: { categoryId },
      files: []
    }, res);
    return { response, ad };
  } finally {
    Ad.findById = originals.adFindById;
    StoreProfile.findOne = originals.storeFindOne;
    Category.findById = originals.categoryFindById;
    StoreSubscription.findOne = originals.subscriptionFindOne;
    StoreSubscription.getStoreSubscriptionStatus = originals.subscriptionStatus;
  }
}

test("active store owner can create ad using authenticated user ownership only", () => {
  const source = getCreateRouteSource();
  assert.match(source, /StoreProfile/);
  assert.match(source, /userId:\s*req\.user\.id/);
  assert.match(source, /status:\s*["']active["']/);
  assert.doesNotMatch(source, /req\.body\.?storeId|req\.body\.?userId/);
});

test("store product creation uses the server store reference and keeps availability separate from condition", async () => {
  const { result, ad, store, savedAttributeCalls } = await createAdWithStoreMode(true);

  assert.equal(result.statusCode, 201, JSON.stringify(result.body));
  assert.equal(String(ad.storeProfileId), String(store._id));
  assert.equal(ad.isAvailable, false);
  assert.equal(ad.condition, null);
  assert.deepEqual(savedAttributeCalls[0], [`ad-1`, [], { strictCategory: true }]);
});

test("dynamicAttributes plan feature gates Store Product attribute writes on creation", async () => {
  const attribute = { attributeId: "64d3d93a1a2b3c4d5e6f7701", value: "مميز" };
  const allowed = await createAdWithStoreMode(true, {
    attributes: [attribute],
    dynamicAttributesFeature: true
  });
  assert.equal(allowed.result.statusCode, 201, JSON.stringify(allowed.result.body));
  assert.deepEqual(allowed.savedAttributeCalls[0], [
    "ad-1",
    [attribute],
    { strictCategory: true }
  ]);

  for (const attributes of [[attribute], []]) {
    const denied = await createAdWithStoreMode(true, {
      attributes,
      dynamicAttributesFeature: false
    });
    assert.equal(denied.result.statusCode, 403);
    assert.match(denied.result.body.error, /الخصائص الديناميكية/);
    assert.equal(denied.createdAds.length, 0);
    assert.equal(denied.savedAttributeCalls.length, 0);
  }
});

test("dynamicAttributes cannot be enabled by payload and expired subscription rejects Store Product attributes", async () => {
  const forgedPlan = await createAdWithStoreMode(true, {
    attributes: [{ attributeId: "64d3d93a1a2b3c4d5e6f7701", value: "مزيف" }],
    dynamicAttributesFeature: false,
    payloadFeatures: { dynamicAttributes: true }
  });
  assert.equal(forgedPlan.result.statusCode, 403);
  assert.equal(forgedPlan.createdAds.length, 0);

  const expired = await createAdWithStoreMode(true, {
    attributes: [{ attributeId: "64d3d93a1a2b3c4d5e6f7701", value: "قديمة" }],
    subscriptionStatus: "active",
    subscriptionEndDate: new Date(Date.now() - 1)
  });
  assert.equal(expired.result.statusCode, 403);
  assert.equal(expired.createdAds.length, 0);
});

test("Store Product creation without attributes does not require the dynamicAttributes feature", async () => {
  const result = await createAdWithStoreMode(true, {
    sendAttributes: false,
    dynamicAttributesFeature: false
  });

  assert.equal(result.result.statusCode, 201, JSON.stringify(result.result.body));
  assert.equal(result.createdAds.length, 1);
  assert.equal(result.savedAttributeCalls.length, 0);
});

test("dynamicAttributes plan feature does not gate normal Marketplace ad attribute writes", async () => {
  const attribute = { attributeId: "64d3d93a1a2b3c4d5e6f7701", value: "عادي" };
  const result = await createAdWithStoreMode(false, {
    attributes: [attribute],
    dynamicAttributesFeature: false
  });

  assert.equal(result.result.statusCode, 201);
  assert.equal(result.ad.storeProfileId, null);
  assert.deepEqual(result.savedAttributeCalls[0], ["ad-1", [attribute], { strictCategory: false }]);
});

test("delivery is enabled per Store Product only when its plan includes the feature", async () => {
  const blocked = await createAdWithStoreMode(true, { isAvailableForDelivery: true });
  assert.equal(blocked.result.statusCode, 403);
  assert.match(blocked.result.body.error, /خطة متجر تشمل ميزة التوصيل/);
  assert.equal(blocked.createdAds.length, 0);

  const allowed = await createAdWithStoreMode(true, { isAvailableForDelivery: true, deliveryFeature: true });
  assert.equal(allowed.result.statusCode, 201, JSON.stringify(allowed.result.body));
  assert.equal(allowed.ad.isAvailableForDelivery, true);

  const normalAd = await createAdWithStoreMode(false, { isAvailableForDelivery: true });
  assert.equal(normalAd.result.statusCode, 201);
  assert.equal(normalAd.ad.isAvailableForDelivery, undefined);
});

test("legacy delivery input is explicitly rejected for Store Products", async () => {
  const result = await createAdWithStoreMode(true, { deliveryAlias: "true" });
  assert.equal(result.result.statusCode, 400);
  assert.match(result.result.body.error, /isAvailableForDelivery/);
  assert.equal(result.createdAds.length, 0);
});

test("inventory settings require an enabled store plan and valid quantities", async () => {
  const blocked = await createAdWithStoreMode(true, { inventoryEnabled: true, stockQuantity: 5 });
  assert.equal(blocked.result.statusCode, 403);
  assert.match(blocked.result.body.error, /إدارة مخزون المنتجات غير مفعّلة/);
  assert.equal(blocked.createdAds.length, 0);

  const allowed = await createAdWithStoreMode(true, { inventoryFeature: true, inventoryEnabled: true, stockQuantity: 5 });
  assert.equal(allowed.result.statusCode, 201, JSON.stringify(allowed.result.body));
  assert.equal(allowed.ad.inventoryEnabled, true);
  assert.equal(allowed.ad.stockQuantity, 5);

  const negative = await createAdWithStoreMode(true, { inventoryFeature: true, inventoryEnabled: true, stockQuantity: -1 });
  assert.equal(negative.result.statusCode, 400);
  assert.equal(negative.createdAds.length, 0);

  const fractional = await createAdWithStoreMode(true, { inventoryFeature: true, inventoryEnabled: true, stockQuantity: 1.5 });
  assert.equal(fractional.result.statusCode, 400);
  assert.equal(fractional.createdAds.length, 0);
});

test("store product discounts are feature-gated and Marketplace ads ignore discount data", async () => {
  const blocked = await createAdWithStoreMode(true, {
    discountEnabled: true,
    discountType: "percentage",
    discountValue: 10
  });
  assert.equal(blocked.result.statusCode, 403);
  assert.equal(blocked.createdAds.length, 0);

  const enabled = await createAdWithStoreMode(true, {
    discountsFeature: true,
    discountEnabled: true,
    discountType: "percentage",
    discountValue: 10
  });
  assert.equal(enabled.result.statusCode, 201);
  assert.equal(enabled.ad.discountEnabled, true);
  assert.equal(enabled.ad.discountValue, 10);
  assert.equal(enabled.ad.price, 100);

  const fixed = await createAdWithStoreMode(true, {
    discountsFeature: true,
    discountEnabled: true,
    discountType: "fixed",
    discountValue: 25
  });
  assert.equal(fixed.result.statusCode, 201, JSON.stringify(fixed.result.body));
  assert.equal(fixed.ad.discountType, "fixed");
  assert.equal(fixed.ad.discountValue, 25);
  assert.equal(getStoreProductPricing(fixed.ad).unitPrice, 75);

  const tooLargeFixed = await createAdWithStoreMode(true, {
    discountsFeature: true,
    discountEnabled: true,
    discountType: "fixed",
    discountValue: 101
  });
  assert.equal(tooLargeFixed.result.statusCode, 400);

  const normalAd = await createAdWithStoreMode(false, {
    discountEnabled: true,
    discountType: "percentage",
    discountValue: 10
  });
  assert.equal(normalAd.result.statusCode, 201);
  assert.equal(normalAd.ad.discountEnabled, undefined);
  assert.equal(normalAd.ad.price, 100);
});

test("store product discount validation rejects zero and values above 99", async () => {
  for (const discountValue of [0, 100]) {
    const result = await createAdWithStoreMode(true, {
      discountsFeature: true,
      discountEnabled: true,
      discountType: "percentage",
      discountValue
    });
    assert.equal(result.result.statusCode, 400);
    assert.equal(result.createdAds.length, 0);
  }
});

test("store product pricing calculates percentage and fixed discounts from original price", () => {
  assert.deepEqual(getStoreProductPricing({
    price: 100000,
    discountEnabled: true,
    discountType: "percentage",
    discountValue: 10
  }), {
    discountEnabled: true,
    discountType: "percentage",
    discountValue: 10,
    originalPrice: 100000,
    unitPrice: 90000
  });
  assert.deepEqual(getStoreProductPricing({
    price: 100000,
    discountEnabled: true,
    discountType: "fixed",
    discountValue: 15000
  }), {
    discountEnabled: true,
    discountType: "fixed",
    discountValue: 15000,
    originalPrice: 100000,
    unitPrice: 85000
  });
});

test("Store Product categories must match activity while normal Marketplace ads remain unrestricted", async () => {
  const allowed = await createAdWithStoreMode(true, { activityKey: "cars", categorySlug: "cars-for-sale" });
  assert.equal(allowed.result.statusCode, 201);

  const blocked = await createAdWithStoreMode(true, { activityKey: "cars", categorySlug: "bedrooms" });
  assert.equal(blocked.result.statusCode, 403);
  assert.equal(blocked.createdAds.length, 0);

  const publicAd = await createAdWithStoreMode(false, { activityKey: "cars", categorySlug: "bedrooms" });
  assert.equal(publicAd.result.statusCode, 201);
  assert.equal(publicAd.ad.storeProfileId, null);
});

test("Store Product update retains a selected historical category for its activity", async () => {
  const result = await updateStoreAdCategory({
    previousCategoryId: "historical-category",
    categoryId: "historical-category",
    selectedCategories: ["historical-category"],
    categorySlug: "cars-for-sale"
  });

  assert.equal(result.response.statusCode, 200);
  assert.equal(result.ad.categoryId, "historical-category");
});

test("Store Product update rejects a selected category outside its activity", async () => {
  const result = await updateStoreAdCategory({
    previousCategoryId: "historical-category",
    categoryId: "other-selected-category",
    selectedCategories: ["historical-category", "other-selected-category"],
    categorySlug: "bedrooms"
  });

  assert.equal(result.response.statusCode, 403);
  assert.equal(result.ad.categoryId, "historical-category");
});

test("Store Product update accepts an allowed activity category", async () => {
  const result = await updateStoreAdCategory({
    previousCategoryId: "historical-category",
    categoryId: "allowed-category",
    selectedCategories: ["historical-category", "allowed-category"],
    categorySlug: "cars-for-sale"
  });

  assert.equal(result.response.statusCode, 200);
  assert.equal(result.ad.categoryId, "allowed-category");
});

test("family production Store Products use the family activity allowlist", async () => {
  const allowed = await createAdWithStoreMode(true, {
    storeType: "family-production",
    activityKey: "family-food",
    categorySlug: "dry-foods"
  });
  assert.equal(allowed.result.statusCode, 201, JSON.stringify(allowed.result.body));

  const blocked = await createAdWithStoreMode(true, {
    storeType: "family-production",
    activityKey: "family-food",
    categorySlug: "cars-for-sale"
  });
  assert.equal(blocked.result.statusCode, 403, JSON.stringify(blocked.result.body));
});

test("Store Product creation saves category-driven car values without adding fields to Ad", async () => {
  const attributes = [
    { attributeId: "brand-id", value: "Toyota" },
    { attributeId: "model-id", value: "Corolla" },
    { attributeId: "year-id", value: "2020" },
    { attributeId: "mileage-id", value: "45000" },
    { attributeId: "fuel-id", value: "بنزين" }
  ];
  const { result, ad, store, savedAttributeCalls } = await createAdWithStoreMode(true, { attributes });
  assert.equal(result.statusCode, 201);
  assert.equal(String(ad.storeProfileId), String(store._id));
  assert.deepEqual(savedAttributeCalls[0], [`ad-1`, attributes, { strictCategory: true }]);
  assert.equal(Object.hasOwn(ad, "brand"), false);
  assert.equal(Object.hasOwn(ad, "model"), false);
  assert.equal(Object.hasOwn(ad, "year"), false);
});

test("Store Product creation rejects a category not selected for its store", async () => {
  const { result, createdAds } = await createAdWithStoreMode(true, { selectedCategories: ["different-category"] });
  assert.equal(result.statusCode, 403);
  assert.equal(createdAds.length, 0);
});

test("Store Product category changes replace allowed attribute values and clear only old-category values", async () => {
  const oldCategoryId = "old-category";
  const newCategoryId = "new-category";
  const store = {
    _id: "store-owner-profile",
    userId: "owner-id",
    status: "active",
    activityKey: null,
    selectedCategories: [newCategoryId],
    governorateId: "governorate-id",
    cityId: "city-id"
  };
  const ad = {
    _id: "store-ad-id",
    userId: "owner-id",
    storeProfileId: store._id,
    categoryId: oldCategoryId,
    status: "approved",
    save: async () => {}
  };
  const originals = {
    adFindById: Ad.findById,
    storeFindOne: StoreProfile.findOne,
    subscriptionFindOne: StoreSubscription.findOne,
    subscriptionStatus: StoreSubscription.getStoreSubscriptionStatus,
    planFindById: Plan.findById,
    saveAttributeValues: ListingService.saveAttributeValues,
    deleteAttributeValuesForCategory: ListingService.deleteAttributeValuesForCategory
  };
  let findCount = 0;
  const saveCalls = [];
  const deletedCategories = [];
  Ad.findById = () => {
    findCount += 1;
    if (findCount === 1) return Promise.resolve(ad);
    return { populate() { return this; }, lean: async () => ({ ...ad }) };
  };
  StoreProfile.findOne = () => ({ select() { return this; }, lean: async () => store });
  StoreSubscription.getStoreSubscriptionStatus = (subscription) => subscription?.status || "inactive";
  StoreSubscription.findOne = () => ({ sort() { return this; }, lean: async () => ({
    status: "active",
    endDate: new Date(Date.now() + 86400000),
    planId: "store-plan"
  }) });
  Plan.findById = () => resolvedQuery({ type: "store", features: { dynamicAttributes: true } });
  ListingService.saveAttributeValues = async (...args) => { saveCalls.push(args); return []; };
  ListingService.deleteAttributeValuesForCategory = async (listingId, categoryId) => { deletedCategories.push({ listingId, categoryId }); };

  try {
    const route = adsRouter.stack.find((layer) => layer.route?.path === "/:id" && layer.route.methods.patch);
    const handler = route.route.stack.at(-1).handle;
    const response = { statusCode: 200, body: null };
    const res = { status(code) { response.statusCode = code; return this; }, json(body) { response.body = body; return this; } };
    await handler({
      params: { id: ad._id },
      user: { id: "owner-id", role: "seller" },
      body: { categoryId: newCategoryId, attributes: [{ attributeId: "new-brand", value: "Honda" }] },
      files: []
    }, res);

    assert.equal(response.statusCode, 200);
    assert.equal(ad.categoryId, newCategoryId);
    assert.deepEqual(saveCalls[0], [ad._id, [{ attributeId: "new-brand", value: "Honda" }], { strictCategory: true }]);
    assert.deepEqual(deletedCategories, [{ listingId: ad._id, categoryId: oldCategoryId }]);
  } finally {
    Ad.findById = originals.adFindById;
    StoreProfile.findOne = originals.storeFindOne;
    StoreSubscription.findOne = originals.subscriptionFindOne;
    StoreSubscription.getStoreSubscriptionStatus = originals.subscriptionStatus;
    Plan.findById = originals.planFindById;
    ListingService.saveAttributeValues = originals.saveAttributeValues;
    ListingService.deleteAttributeValuesForCategory = originals.deleteAttributeValuesForCategory;
  }
});

test("Store Product updates cannot enable delivery unless the active plan supports it", async () => {
  async function updateDelivery(deliveryFeature) {
    const ad = {
      _id: "store-ad-id",
      userId: "owner-id",
      storeProfileId: "store-owner-profile",
      categoryId: "category-id",
      status: "approved",
      isAvailableForDelivery: false,
      save: async () => {}
    };
    const originals = {
      adFindById: Ad.findById,
      storeFindOne: StoreProfile.findOne,
      subscriptionFindOne: StoreSubscription.findOne,
      planFindById: Plan.findById
    };
    let findCount = 0;
    Ad.findById = () => {
      findCount += 1;
      if (findCount === 1) return Promise.resolve(ad);
      return { populate() { return this; }, lean: async () => ({ ...ad }) };
    };
    StoreProfile.findOne = () => ({ select() { return this; }, lean: async () => ({
      _id: ad.storeProfileId,
      status: "active",
      selectedCategories: ["category-id"]
    }) });
    StoreSubscription.findOne = () => ({ sort() { return this; }, lean: async () => ({
      status: "active",
      endDate: new Date(Date.now() + 86400000),
      planId: "plan-id"
    }) });
    Plan.findById = () => resolvedQuery({ type: "store", features: { delivery: deliveryFeature } });

    try {
      const route = adsRouter.stack.find((layer) => layer.route?.path === "/:id" && layer.route.methods.patch);
      const handler = route.route.stack.at(-1).handle;
      const response = { statusCode: 200, body: null };
      const res = { status(code) { response.statusCode = code; return this; }, json(body) { response.body = body; return this; } };
      await handler({
        params: { id: ad._id },
        user: { id: "owner-id", role: "seller" },
        body: { categoryId: "category-id", isAvailableForDelivery: "true" },
        files: []
      }, res);
      return { response, ad };
    } finally {
      Ad.findById = originals.adFindById;
      StoreProfile.findOne = originals.storeFindOne;
      StoreSubscription.findOne = originals.subscriptionFindOne;
      Plan.findById = originals.planFindById;
    }
  }

  const blocked = await updateDelivery(false);
  assert.equal(blocked.response.statusCode, 403);
  assert.equal(blocked.ad.isAvailableForDelivery, false);

  const allowed = await updateDelivery(true);
  assert.equal(allowed.response.statusCode, 200);
  assert.equal(allowed.ad.isAvailableForDelivery, true);
});

test("Store Product updates can enable a percentage discount only under an active discounts plan", async () => {
  async function updateDiscount(discountsFeature, discountValue = 10, discountType = "percentage") {
    const ad = {
      _id: "store-ad-id",
      userId: "owner-id",
      storeProfileId: "store-owner-profile",
      categoryId: "category-id",
      status: "approved",
      price: 100000,
      discountEnabled: false,
      save: async () => {}
    };
    const originals = {
      adFindById: Ad.findById,
      storeFindOne: StoreProfile.findOne,
      subscriptionFindOne: StoreSubscription.findOne,
      planFindById: Plan.findById
    };
    let findCount = 0;
    Ad.findById = () => {
      findCount += 1;
      if (findCount === 1) return Promise.resolve(ad);
      return { populate() { return this; }, lean: async () => ({ ...ad }) };
    };
    StoreProfile.findOne = () => ({ select() { return this; }, lean: async () => ({
      _id: ad.storeProfileId,
      status: "active",
      selectedCategories: ["category-id"]
    }) });
    StoreSubscription.findOne = () => ({
      sort() { return this; },
      lean: async () => ({
        status: "active",
        endDate: new Date(Date.now() + 86400000),
        planId: "plan-id"
      })
    });
    Plan.findById = () => resolvedQuery({ type: "store", features: { discounts: discountsFeature } });

    try {
      const route = adsRouter.stack.find((layer) => layer.route?.path === "/:id" && layer.route.methods.patch);
      const handler = route.route.stack.at(-1).handle;
      const response = { statusCode: 200, body: null };
      const res = { status(code) { response.statusCode = code; return this; }, json(body) { response.body = body; return this; } };
      await handler({
        params: { id: ad._id },
        user: { id: "owner-id", role: "seller" },
        body: {
          categoryId: "category-id",
          discountEnabled: "true",
          discountType,
          discountValue: String(discountValue)
        },
        files: []
      }, res);
      return { response, ad };
    } finally {
      Ad.findById = originals.adFindById;
      StoreProfile.findOne = originals.storeFindOne;
      StoreSubscription.findOne = originals.subscriptionFindOne;
      Plan.findById = originals.planFindById;
    }
  }

  const blocked = await updateDiscount(false);
  assert.equal(blocked.response.statusCode, 403);
  assert.equal(blocked.ad.discountEnabled, false);

  const allowed = await updateDiscount(true);
  assert.equal(allowed.response.statusCode, 200);
  assert.equal(allowed.ad.discountEnabled, true);
  assert.equal(allowed.ad.discountValue, 10);

  const fixed = await updateDiscount(true, 25000, "fixed");
  assert.equal(fixed.response.statusCode, 200);
  assert.equal(fixed.ad.discountType, "fixed");
  assert.equal(fixed.ad.discountValue, 25000);
});

test("normal ad from a store owner never receives store context from a client reference", async () => {
  const { result, ad } = await createAdWithStoreMode(false);

  assert.equal(result.statusCode, 201, JSON.stringify(result.body));
  assert.equal(ad.storeProfileId, null);
  assert.equal(ad.isAvailable, undefined);
  assert.equal(ad.condition, "used");
});

test("maxProducts zero is unlimited and store product limits do not constrain normal Ads", async () => {
  const unlimited = await createAdWithStoreMode(true, { maxProducts: 0, currentVisibleCount: 100 });
  assert.equal(unlimited.result.statusCode, 201);
  assert.equal(unlimited.countCalls, 0);

  const normalAd = await createAdWithStoreMode(false, { maxProducts: 1, currentVisibleCount: 1 });
  assert.equal(normalAd.result.statusCode, 201);
  assert.equal(normalAd.countCalls, 0);
});

test("maxProducts blocks a Store Product only after its linked product count reaches the limit", async () => {
  const blocked = await createAdWithStoreMode(true, { maxProducts: 1, currentVisibleCount: 1 });
  assert.equal(blocked.result.statusCode, 403);
  assert.equal(blocked.countCalls, 1);
  assert.equal(blocked.createdAds.length, 0);
});

test("GET /ads includes trusted StoreProfile context and availability only for linked store products", async () => {
  const originals = {
    find: Ad.find,
    count: Ad.countDocuments,
    subscriptionFind: StoreSubscription.find,
    storeFind: StoreProfile.find
  };
  const records = [
    { _id: "store-ad", title: "Store item", storeProfileId: "store-id", isAvailable: false, isAvailableForDelivery: true, condition: null },
    { _id: "normal-ad", title: "Normal item", storeProfileId: null, isAvailable: true, condition: "used" }
  ];
  const store = { _id: "store-id", status: "active", storeName: "متجر موثوق", slug: "trusted-store", logo: "store.png", businessActivity: "أجهزة" };
  const populated = [];
  Ad.find = () => {
    const chain = {
      select() { return this; },
      populate(path) { populated.push(typeof path === "string" ? path : path.path); return this; },
      sort() { return this; },
      skip() { return this; },
      limit() { return this; },
      lean() { return Promise.resolve(records.map((ad) => ({ ...ad, storeProfileId: ad.storeProfileId ? store : null }))); }
    };
    return chain;
  };
  Ad.countDocuments = async () => records.length;
  StoreProfile.find = () => ({
    select() { return this; },
    lean: async () => [{ _id: "store-id" }]
  });
  StoreSubscription.find = () => ({
    sort() { return this; },
    select() { return this; },
    populate() { return this; },
    lean: async () => [{ storeId: "store-id", status: "active", endDate: new Date(Date.now() + 86400000), planId: { type: "store", features: { delivery: true } } }]
  });

  try {
    const route = adsRouter.stack.find((layer) => layer.route?.path === "/" && layer.route.methods.get);
    const handler = route.route.stack.at(-1).handle;
    const result = { statusCode: 200, body: null };
    const res = { status(code) { result.statusCode = code; return this; }, json(body) { result.body = body; return this; } };
    await handler({ query: {} }, res);

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.items[0].storeProfileId.storeName, "متجر موثوق");
    assert.equal(result.body.items[0].isAvailable, false);
    assert.equal(result.body.items[0].isAvailableForDelivery, true);
    assert.equal(result.body.items[0].storeProfileId.deliveryEnabled, true);
    assert.equal(result.body.items[1].storeProfileId, null);
    assert.ok(populated.includes("storeProfileId"));
  } finally {
    Ad.find = originals.find;
    Ad.countDocuments = originals.count;
    StoreSubscription.find = originals.subscriptionFind;
    StoreProfile.find = originals.storeFind;
  }
});

test("smart search populates trusted store context without inferring it from user ownership", async () => {
  const originals = {
    find: Ad.find,
    subscriptionFind: StoreSubscription.find,
    storeFind: StoreProfile.find
  };
  const records = [
    { _id: "store-ad", title: "Store item", userId: "owner-id", storeProfileId: "store-id", isAvailable: true, isAvailableForDelivery: true },
    { _id: "normal-ad", title: "Normal item", userId: "owner-id", storeProfileId: null, isAvailable: true }
  ];
  const store = { _id: "store-id", status: "active", storeName: "متجر موثوق", slug: "trusted-store", logo: "store.png", businessActivity: "أجهزة" };
  const populated = [];
  Ad.find = () => ({
    populate(path) { populated.push(typeof path === "string" ? path : path.path); return this; },
    lean() { return Promise.resolve(records.map((ad) => ({ ...ad, storeProfileId: ad.storeProfileId ? store : null }))); }
  });
  StoreProfile.find = () => ({
    select() { return this; },
    lean: async () => [{ _id: "store-id" }]
  });
  StoreSubscription.find = () => ({
    sort() { return this; },
    select() { return this; },
    populate() { return this; },
    lean: async () => [{ storeId: "store-id", status: "active", endDate: new Date(Date.now() + 86400000), planId: { type: "store", features: { delivery: true } } }]
  });

  try {
    const route = adsRouter.stack.find((layer) => layer.route?.path === "/smart-search" && layer.route.methods.get);
    const handler = route.route.stack.at(-1).handle;
    const response = { statusCode: 200, body: null };
    const res = { status(code) { response.statusCode = code; return this; }, json(body) { response.body = body; return this; } };
    await handler({ query: {}, user: null }, res);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.items.find((ad) => ad._id === "store-ad").storeProfileId.storeName, "متجر موثوق");
    assert.equal(response.body.items.find((ad) => ad._id === "store-ad").isAvailableForDelivery, true);
    assert.equal(response.body.items.find((ad) => ad._id === "normal-ad").storeProfileId, null);
    assert.ok(populated.includes("storeProfileId"));
  } finally {
    Ad.find = originals.find;
    StoreSubscription.find = originals.subscriptionFind;
    StoreProfile.find = originals.storeFind;
  }
});

test("GET /ads/:id returns StoreProfile contacts and enforces multipleContacts on the response", async () => {
  const originals = {
    findById: Ad.findById,
    subscriptionFindOne: StoreSubscription.findOne,
    getAttributes: ListingService.getListingAttributes
  };
  const ad = {
    _id: "store-ad",
    title: "Store item",
    status: "approved",
    expiresAt: new Date(Date.now() + 86400000),
    categoryId: null,
    userId: { _id: "owner-id" },
    storeProfileId: {
      _id: "store-id",
      status: "active",
      storeName: "متجر موثوق",
      slug: "trusted-store",
      logo: "store.png",
      businessActivity: "أجهزة",
      phones: [{ value: "700000001" }, { value: "700000002" }],
      whatsapp: [{ value: "700000003" }, { value: "700000004" }]
    }
  };
  Ad.findById = () => ({ populate() { return this; }, lean: async () => ({ ...ad, storeProfileId: { ...ad.storeProfileId, phones: [...ad.storeProfileId.phones], whatsapp: [...ad.storeProfileId.whatsapp] } }) });
  StoreSubscription.findOne = () => ({
    sort() { return this; },
    populate() { return this; },
    lean: async () => ({ status: "active", endDate: new Date(Date.now() + 86400000), planId: { features: [] } })
  });
  ListingService.getListingAttributes = async () => [];

  try {
    const route = adsRouter.stack.find((layer) => layer.route?.path === "/:id" && layer.route.methods.get);
    const handler = route.route.stack.at(-1).handle;
    const result = { statusCode: 200, body: null };
    const res = { status(code) { result.statusCode = code; return this; }, json(body) { result.body = body; return this; } };
    await handler({ params: { id: "store-ad" } }, res);

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.storeProfileId.storeName, "متجر موثوق");
    assert.equal(result.body.storeProfileId.phones.length, 1);
    assert.equal(result.body.storeProfileId.whatsapp.length, 1);
  } finally {
    Ad.findById = originals.findById;
    StoreSubscription.findOne = originals.subscriptionFindOne;
    ListingService.getListingAttributes = originals.getAttributes;
  }
});

test("MyStore product listing includes only products linked to the store", async () => {
  const originals = { find: Ad.find, storeFindOne: StoreProfile.findOne };
  const store = { _id: "store-id" };
  const ads = [
    { _id: "legacy", userId: "owner-id", storeProfileId: null, createdAt: new Date("2026-09-01") },
    { _id: "new-normal", userId: "owner-id", storeProfileId: null, createdAt: new Date("2026-10-01") },
    { _id: "store-product", userId: "owner-id", storeProfileId: "store-id", createdAt: new Date("2026-10-01") }
  ];
  let capturedFilter;
  StoreProfile.findOne = () => ({ ...resolvedQuery(store), select() { return this; } });
  Ad.find = (filter) => {
    capturedFilter = filter;
    const matches = ads.filter((ad) => ad.userId === filter.userId
      && String(ad.storeProfileId) === String(filter.storeProfileId));
    return { ...resolvedQuery(matches), sort() { return this; } };
  };

  try {
    const route = adsRouter.stack.find((layer) => layer.route?.path === "/my" && layer.route.methods.get);
    const handler = route.route.stack.at(-1).handle;
    const result = { statusCode: 200, body: null };
    const res = { status(code) { result.statusCode = code; return this; }, json(body) { result.body = body; return this; } };
    await handler({ user: { id: "owner-id" }, query: { storeProducts: "true" } }, res);

    assert.deepEqual(result.body.map((ad) => ad._id), ["store-product"]);
    assert.equal(capturedFilter.storeProfileId, "store-id");
    assert.equal(capturedFilter.$or, undefined);
  } finally {
    Ad.find = originals.find;
    StoreProfile.findOne = originals.storeFindOne;
  }
});

test("GET /ads/my excludes store products from regular MyAds listing", async () => {
  const originals = { find: Ad.find, storeFindOne: StoreProfile.findOne };
  const ads = [
    { _id: "regular-ad", userId: "owner-id", storeProfileId: null, createdAt: new Date("2026-10-02") },
    { _id: "store-ad", userId: "owner-id", storeProfileId: "store-id", createdAt: new Date("2026-10-02") },
    { _id: "other-user-ad", userId: "other-user", storeProfileId: null, createdAt: new Date("2026-10-02") }
  ];
  let capturedFilter;

  Ad.find = (filter) => {
    capturedFilter = filter;
    const matches = ads.filter((ad) => {
      if (ad.userId !== filter.userId) return false;
      if (filter.$or) {
        return filter.$or.some((scope) => {
          if (scope.storeProfileId) return String(ad.storeProfileId) === String(scope.storeProfileId);
          return ad.storeProfileId === null && ad.createdAt < scope.createdAt.$lt;
        });
      }
      return String(ad.storeProfileId) === String(filter.storeProfileId);
    });
    return {
      ...resolvedQuery(matches),
      sort() { return this; }
    };
  };

  try {
    const route = adsRouter.stack.find((layer) => layer.route?.path === "/my" && layer.route.methods.get);
    const handler = route.route.stack.at(-1).handle;
    const regularResult = { statusCode: 200, body: null };
    const regularRes = { status(code) { regularResult.statusCode = code; return this; }, json(body) { regularResult.body = body; return this; } };
    await handler({ user: { id: "owner-id" }, query: {} }, regularRes);

    assert.equal(capturedFilter.storeProfileId, null);
    assert.deepEqual(regularResult.body.map((ad) => ad._id), ["regular-ad"]);

    const storeResult = { statusCode: 200, body: null };
    const storeRes = { status(code) { storeResult.statusCode = code; return this; }, json(body) { storeResult.body = body; return this; } };
    StoreProfile.findOne = () => ({ ...resolvedQuery({ _id: "store-id" }), select() { return this; } });
    await handler({ user: { id: "owner-id" }, query: { storeProducts: "true" } }, storeRes);

    assert.equal(capturedFilter.storeProfileId, "store-id");
    assert.equal(capturedFilter.$or, undefined);
    assert.deepEqual(storeResult.body.map((ad) => ad._id), ["store-ad"]);
  } finally {
    Ad.find = originals.find;
    StoreProfile.findOne = originals.storeFindOne;
  }
});

test("store category enforcement exists for create flow", () => {
  const source = getCreateRouteSource();
  assert.match(source, /selectedCategories/);
  assert.match(source, /[\s\S]*categoryId[\s\S]*selectedCategories|[\s\S]*selectedCategories[\s\S]*categoryId/);
});

test("store category enforcement exists for update flow", () => {
  const source = getUpdateRouteSource();
  assert.match(source, /StoreProfile/);
  assert.match(source, /selectedCategories/);
  assert.match(source, /[\s\S]*categoryId[\s\S]*selectedCategories|[\s\S]*selectedCategories[\s\S]*categoryId/);
});

test("update route rejects ad ownership mismatch", () => {
  const source = getUpdateRouteSource();
  assert.match(source, /String\(ad\.userId\) !== String\(req\.user\.id\)/);
  assert.match(source, /403/);
});

test("create route rejects invalid category for store owner", () => {
  const source = getCreateRouteSource();
  assert.match(source, /res\.status\(403\)|res\.status\(400\)/);
  assert.match(source, /غير مسموح|not allowed|not in selectedCategories|allowed categories|مسموح/i);
});

test("public storefront ads stay user-owned and not storeId dependent", () => {
  const source = getCreateRouteSource();
  assert.match(source, /userId: req\.user\.id/);
  assert.doesNotMatch(source, /storeId:\s*req\.body|storeId:\s*req\.query|storeId:\s*req\.params/);
});

test("backend never trusts client userId or storeId in ad writes", () => {
  const createSource = getCreateRouteSource();
  const updateSource = getUpdateRouteSource();
  assert.doesNotMatch(createSource, /req\.body\.?userId|req\.body\.?storeId/);
  assert.doesNotMatch(updateSource, /req\.body\.?userId|req\.body\.?storeId/);
});

test("store owner creates regular public listing without store-specific product model", () => {
  const source = getCreateRouteSource();
  assert.doesNotMatch(source, /StoreProduct|StoreAd|Product model/);
  assert.match(source, /Ad\.create\(/);
});

test("storefront public listing uses existing user ownership relationship", () => {
  const source = getCreateRouteSource();
  assert.match(source, /userId: req\.user\.id/);
  assert.doesNotMatch(source, /storeId:\s*\w+/);
});

test("store maxProducts enforcement counts only current public-storefront products", () => {
  assert.match(adsRouteSource, /Ad\.countDocuments\(storeVisibleAdFilter\(store\._id\)\)/);
  assert.match(adsRouteSource, /const storeVisibleAdFilter = \(storeId\) => \(\{\s*storeProfileId:\s*storeId/);
  assert.match(adsRouteSource, /status:\s*["']approved["']/);
  assert.match(adsRouteSource, /isArchived:\s*\{\s*\$ne:\s*true\s*\}/);
  assert.match(adsRouteSource, /sold:\s*\{\s*\$ne:\s*true\s*\}/);
  assert.match(adsRouteSource, /isVisible:\s*\{\s*\$ne:\s*false\s*\}/);
  assert.match(adsRouteSource, /expiresAt:\s*\{\s*\$gt:\s*new Date\(\)\s*\}/);
  assert.match(adsRouteSource, /isDeleted:\s*\{\s*\$ne:\s*true\s*\}/);
});

test("store maxProducts enforcement rejects at the limit before creation", () => {
  assert.match(adsRouteSource, /currentVisibleAdCount\s*>=\s*maxProductsLimit/);
  assert.match(adsRouteSource, /res\.status\(403\)\.json\(\{\s*error:\s*`.*\$\{maxProductsLimit\}/);
});

test("store maxProducts enforcement ignores missing/null values instead of inventing a policy", () => {
  assert.match(adsRouteSource, /rawMaxProducts\s*!==\s*undefined\s*&&\s*rawMaxProducts\s*!==\s*null/);
  assert.match(adsRouteSource, /maxProductsLimit\s*!==\s*null/);
});

test("store maxProducts 0 is treated as unlimited, not as zero-cap", () => {
  assert.match(adsRouteSource, /rawMaxProducts\s*!==\s*undefined\s*&&\s*rawMaxProducts\s*!==\s*null\s*&&\s*rawMaxProducts\s*!==\s*""\s*&&\s*Number\(rawMaxProducts\)\s*>\s*0/);
  assert.match(adsRouteSource, /maxProductsLimit\s*>\s*0/);
  assert.doesNotMatch(adsRouteSource, /currentVisibleAdCount\s*>=\s*0/);
});

test("store maxProducts enforcement preserves category and subscription protections", () => {
  assert.match(adsRouteSource, /subscriptionStatus\s*!==\s*["']active["']/);
  assert.match(adsRouteSource, /allowedCategories\.includes\(String\(categoryId\)\)/);
  assert.match(adsRouteSource, /StoreProfile\.findOne\(\{\s*userId:\s*req\.user\.id,\s*status:\s*["']active["']/);
});

test("store product availability is separate from sold and limited to an active store", () => {
  const modelSource = fs.readFileSync(new URL("../src/models/Ad.js", import.meta.url), "utf8");
  const createSource = getCreateRouteSource();
  const updateSource = getUpdateRouteSource();

  assert.match(modelSource, /isAvailable:\s*\{\s*type:\s*Boolean,\s*default:\s*true\s*\}/);
  assert.match(createSource, /storeProductMode\s*=\s*storeProduct\s*===\s*true\s*\|\|\s*storeProduct\s*===\s*["']true["']/);
  assert.match(createSource, /storeProductMode\s*\?\s*\{\s*isAvailable:/);
  assert.match(createSource, /storeProductMode\s*&&\s*\(!categoryId\s*\|\|\s*!store\.selectedCategories\?\.length\)/);
  assert.match(updateSource, /storeProductMode\s*&&\s*!activeStore\.selectedCategories\?\.length/);
  assert.match(updateSource, /if\s*\(storeProductMode\s*&&\s*typeof isAvailable !== "undefined"\)\s*ad\.isAvailable/);
});

test("store products use StoreProfile location while public ads still require their own location", () => {
  assert.match(adsRouteSource, /governorateId:\s*Joi\.when\("storeProduct"[\s\S]*otherwise:\s*Joi\.string\(\)\.length\(24\)\.hex\(\)\.required\(\)/);
  assert.match(adsRouteSource, /cityId:\s*Joi\.when\("storeProduct"[\s\S]*otherwise:\s*Joi\.string\(\)\.length\(24\)\.hex\(\)\.required\(\)/);
  assert.match(adsRouteSource, /governorateId:\s*storeProductMode\s*\?\s*store\.governorateId\s*:\s*governorateId/);
  assert.match(adsRouteSource, /cityId:\s*storeProductMode\s*\?\s*store\.cityId\s*:\s*cityId/);
  assert.match(getUpdateRouteSource(), /if\s*\(storeProductMode\)\s*\{\s*ad\.governorateId\s*=\s*activeStore\.governorateId;\s*ad\.cityId\s*=\s*activeStore\.cityId;\s*ad\.location\s*=\s*undefined;/);
});
