import test from "node:test";
import assert from "node:assert/strict";
import storesRouter from "../src/routes/stores.js";
import StoreProfile from "../src/models/StoreProfile.js";
import StoreSubscription from "../src/models/StoreSubscription.js";
import Ad from "../src/models/Ad.js";
import ListingService from "../src/services/listingService.js";
import { hasStoreFeature } from "../src/utils/storeFeatureUtils.js";

function publicStoreHandlerSource() {
  const routeLayer = storesRouter.stack.find(
    (layer) => layer.route?.path === "/:slug" && layer.route.methods.get
  );
  assert.ok(routeLayer, "GET /api/stores/:slug route must exist");
  return routeLayer.route.stack.map((layer) => layer.handle.toString()).join("\n");
}

function query(value) {
  let skip = 0;
  let limit = Infinity;
  return {
    select() { return this; },
    populate() { return this; },
    sort() { return this; },
    skip(value) { skip = value; return this; },
    limit(value) { limit = value; return this; },
    lean() { return Promise.resolve(Array.isArray(value) ? value.slice(skip, skip + limit) : value); }
  };
}

async function invokePublicStore({ queryParams = {}, ads = [], planFeatures = ["pwa"], subscriptionEndDate = new Date(Date.now() + 86400000), phones = [], whatsapp = [], activityKey = null, businessActivity = "متجر تجريبي", attributesById = {}, storeType = "store", advancedCustomization = null }) {
  const originals = {
    storeFindOne: StoreProfile.findOne,
    storeFindById: StoreProfile.findById,
    subscriptionFindOne: StoreSubscription.findOne,
    adFind: Ad.find,
    adCount: Ad.countDocuments,
    listingAttributesForListings: ListingService.getListingAttributesForListings
  };
  const store = {
    _id: "store-id",
    userId: "owner-id",
    storeName: "متجر تجريبي",
    slug: "test-store",
    status: "active",
    storeType,
    activityKey,
    businessActivity,
    selectedCategories: [],
    legacyListingsCutoffAt: new Date("2026-09-30T00:00:00.000Z")
  };
  let capturedFilter;
  StoreProfile.findOne = () => query(store);
  StoreProfile.findById = () => query({ phones, whatsapp, primaryColor: "#0b89ed", advancedCustomization });
  StoreSubscription.findOne = () => query({
    status: "active",
    endDate: subscriptionEndDate,
    planId: { type: storeType, features: planFeatures }
  });
  Ad.find = (filter) => {
    capturedFilter = filter;
    if (filter._id?.$in) {
      return query(ads.filter((ad) => (
        filter._id.$in.map(String).includes(String(ad._id))
        && String(ad.storeProfileId) === String(filter.storeProfileId)
        && ad.status === "approved"
        && ad.isArchived !== true
        && ad.isDeleted !== true
        && ad.sold !== true
      )));
    }
    const matches = ads.filter((ad) => {
      const scopes = filter.$or || filter.$and?.[0]?.$or || [];
      const inStoreScope = scopes.some((scope) =>
        scope.storeProfileId && String(ad.storeProfileId) === String(scope.storeProfileId)
      );
      if (!inStoreScope) return false;
      if (filter.categoryId && String(ad.categoryId) !== String(filter.categoryId)) return false;
      if (filter.$and?.[1]?.$or && !filter.$and[1].$or.some((condition) => condition.title?.test(ad.title) || condition.description?.test(ad.description))) return false;
      return true;
    });
    return query(matches);
  };
  Ad.countDocuments = async (filter) => ads.filter((ad) => {
    const scopes = filter.$or || filter.$and?.[0]?.$or || [];
    const inStoreScope = scopes.some((scope) =>
      scope.storeProfileId && String(ad.storeProfileId) === String(scope.storeProfileId)
    );
    if (!inStoreScope) return false;
    if (filter.categoryId && String(ad.categoryId) !== String(filter.categoryId)) return false;
    if (filter.$and?.[1]?.$or && !filter.$and[1].$or.some((condition) => condition.title?.test(ad.title) || condition.description?.test(ad.description))) return false;
    return true;
  }).length;
  ListingService.getListingAttributesForListings = async () => attributesById;

  try {
    const route = storesRouter.stack.find((layer) => layer.route?.path === "/:slug" && layer.route.methods.get);
    const handler = route.route.stack.at(-1).handle;
    const result = { statusCode: 200, body: null };
    const res = {
      status(code) { result.statusCode = code; return this; },
      json(body) { result.body = body; return this; }
    };
    await handler({ params: { slug: store.slug }, query: queryParams }, res);
    return { ...result, filter: capturedFilter };
  } finally {
    StoreProfile.findOne = originals.storeFindOne;
    StoreProfile.findById = originals.storeFindById;
    StoreSubscription.findOne = originals.subscriptionFindOne;
    Ad.find = originals.adFind;
    Ad.countDocuments = originals.adCount;
    ListingService.getListingAttributesForListings = originals.listingAttributesForListings;
  }
}

test("public store endpoint is unauthenticated and returns only active stores", () => {
  const source = publicStoreHandlerSource();
  assert.doesNotMatch(source, /auth\s*\(/);
  assert.match(source, /status:\s*["']active["']/);
  assert.match(source, /expiresAt:\s*\{\s*\$gt/);
  assert.match(source, /isVisible:\s*\{\s*\$ne:\s*false/);
});

test("public store endpoint scopes ads to products linked to the store and paginates", () => {
  const source = publicStoreHandlerSource();
  assert.match(source, /storeProfileId:\s*store\._id/);
  assert.doesNotMatch(source, /legacyListingsCutoffAt|userId:\s*store\.userId/);
  assert.match(source, /\.skip\(\(page - 1\) \* limit\)/);
  assert.match(source, /\.limit\(limit\)/);
  assert.match(source, /Math\.min\(Math\.max\(parseInt\(req\.query\.limit/);
});

test("public store projection excludes private user data and payment details", () => {
  const source = publicStoreHandlerSource();
  assert.match(source, /\.select\("storeName slug storeType activityKey description businessActivity logo cover location selectedCategories status phone email social userId deliveryAvailable"\)/);
  assert.match(source, /\.select\("_id title description price currency priceOnContact images condition isAvailable isAvailableForDelivery inventoryEnabled stockQuantity discountEnabled discountType discountValue adType categoryId governorateId cityId storeProfileId featured isWelcomePromoted createdAt publishedAt expiresAt"\)/);
  assert.match(source, /const \{ userId, phone, email, \.\.\.publicStore \} = store/);
  assert.match(source, /isLegacyStoreListing:\s*!ad\.storeProfileId/);
  assert.doesNotMatch(source, /paymentReceipt|password|permissions|purchaseRequest/);
});

test("public store response derives a supported activity and falls back for legacy stores", async () => {
  const cars = await invokePublicStore({ ads: [], activityKey: "cars", businessActivity: "client-supplied label" });
  assert.deepEqual(cars.body.store.activity, { key: "cars", name: "معرض سيارات", templateKey: "vehicle-dealer" });
  assert.equal(cars.body.store.businessActivity, "client-supplied label");

  const legacy = await invokePublicStore({ ads: [], businessActivity: "هواتف" });
  assert.deepEqual(legacy.body.store.activity, { key: null, name: "هواتف", templateKey: "general-retail" });
});

test("Store PWA is enabled only by an active subscription plan feature", async () => {
  const enabled = await invokePublicStore({ planFeatures: ["pwa"] });
  assert.equal(enabled.body.store.pwaEnabled, true);

  const disabled = await invokePublicStore({ planFeatures: [] });
  assert.equal(disabled.body.store.pwaEnabled, false);
  assert.equal(disabled.body.store.storeName, "متجر تجريبي");
  assert.equal(disabled.body.store.status, "active");

  const expired = await invokePublicStore({
    planFeatures: ["pwa"],
    subscriptionEndDate: new Date(Date.now() - 86400000)
  });
  assert.equal(expired.statusCode, 404);
  assert.equal(hasStoreFeature({
    status: "active",
    subscription: {
      status: "active",
      endDate: new Date(Date.now() - 86400000),
      planId: { type: "store", features: ["pwa"] }
    }
  }, "pwa"), false);
});

test("store search finds products beyond the first page and never crosses store ownership", async () => {
  const now = new Date(Date.now() + 86400000);
  const result = await invokePublicStore({
    queryParams: { q: "rare engine", categoryId: "507f1f77bcf86cd799439011", page: "1", limit: "1" },
    ads: [
      { _id: "first-page", userId: "owner-id", storeProfileId: "store-id", title: "Ordinary item", description: "Common stock", categoryId: "507f1f77bcf86cd799439011", status: "approved", expiresAt: now, createdAt: new Date("2026-09-01") },
      { _id: "second-page-match", userId: "owner-id", storeProfileId: "store-id", title: "Part from stock", description: "Rare engine component", categoryId: "507f1f77bcf86cd799439011", status: "approved", expiresAt: now, createdAt: new Date("2026-09-01") },
      { _id: "legacy-personal-match", userId: "owner-id", title: "Rare engine", description: "Rare engine", categoryId: "507f1f77bcf86cd799439011", status: "approved", expiresAt: now, createdAt: new Date("2026-09-01") },
      { _id: "new-normal-ad", userId: "owner-id", title: "Rare engine", description: "Rare engine", categoryId: "507f1f77bcf86cd799439011", status: "approved", expiresAt: now, createdAt: new Date("2026-10-01") },
      { _id: "new-store-product", userId: "owner-id", storeProfileId: "store-id", title: "New store item", description: "New stock", categoryId: "507f1f77bcf86cd799439011", status: "approved", expiresAt: now, createdAt: new Date("2026-10-01") },
      { _id: "other-store-match", userId: "another-owner", title: "Rare engine", description: "Rare engine", categoryId: "507f1f77bcf86cd799439011", status: "approved", expiresAt: now, createdAt: new Date("2026-09-01") }
    ]
  });

  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body.ads.map((ad) => ad._id), ["second-page-match"]);
  assert.equal(result.body.total, 1);
  assert.equal(result.body.pages, 1);
  assert.equal(result.body.limit, 1);
  assert.deepEqual(result.filter.$and[0].$or, [{ storeProfileId: "store-id" }]);
  assert.equal(String(result.filter.categoryId), "507f1f77bcf86cd799439011");
  assert.equal(result.filter.$and[1].$or[0].title.test("rare engine"), true);
  assert.equal(result.filter.$and[1].$or[1].description.test("rare engine"), true);
});

test("family-production storefront excludes the owner's unrelated legacy ads", async () => {
  const now = new Date(Date.now() + 86400000);
  const result = await invokePublicStore({
    storeType: "family-production",
    ads: [
      { _id: "legacy-personal-ad", userId: "owner-id", storeProfileId: null, createdAt: new Date("2026-09-01"), status: "approved", expiresAt: now },
      { _id: "family-product", userId: "owner-id", storeProfileId: "store-id", createdAt: new Date("2026-10-01"), status: "approved", expiresAt: now }
    ]
  });
  assert.deepEqual(result.body.ads.map((ad) => ad._id), ["family-product"]);
  assert.deepEqual(result.filter.$or, [{ storeProfileId: "store-id" }]);
});

test("storefront excludes personal ads regardless of when they were posted", async () => {
  const now = new Date(Date.now() + 86400000);
  const result = await invokePublicStore({
    ads: [
      { _id: "legacy", userId: "owner-id", title: "Old item", description: "", createdAt: new Date("2026-09-01"), status: "approved", expiresAt: now },
      { _id: "new-normal", userId: "owner-id", title: "Normal ad", description: "", createdAt: new Date("2026-10-01"), status: "approved", expiresAt: now },
      { _id: "new-store", userId: "owner-id", storeProfileId: "store-id", title: "Store product", description: "", createdAt: new Date("2026-10-01"), status: "approved", expiresAt: now }
    ]
  });

  assert.deepEqual(result.body.ads.map((ad) => ad._id), ["new-store"]);
  assert.equal(result.body.ads[0].isLegacyStoreListing, false);
});

test("public storefront reveals advanced design only when both customization features are active", async () => {
  const productId = "507f1f77bcf86cd799439013";
  const featuredProduct = {
    _id: productId,
    storeProfileId: "store-id",
    title: "منتج مميز",
    status: "approved",
    expiresAt: new Date(Date.now() + 86400000),
    price: 150,
    currency: "YER_ADEN"
  };
  const advancedCustomization = {
    theme: "artisan",
    primaryColor: "#123456",
    secondaryColor: "#654321",
    hero: { title: "أهلًا بكم", text: "منتجات محلية", buttonLabel: "تسوق", buttonTarget: "products" },
    story: { text: "قصتنا" },
    featuredProductIds: [productId],
    sectionOrder: ["hero", "intro", "story", "featuredProducts", "products"],
    hiddenSections: []
  };
  const enabled = await invokePublicStore({
    ads: [featuredProduct],
    planFeatures: { customization: true, advancedCustomization: true },
    advancedCustomization
  });

  assert.equal(enabled.body.store.advancedCustomizationEnabled, true);
  assert.equal(enabled.body.store.primaryColor, "#123456");
  assert.equal(enabled.body.store.advancedCustomization.theme, "custom");
  assert.equal(enabled.body.store.advancedCustomization.featuredProducts[0]._id, productId);

  const disabled = await invokePublicStore({
    ads: [featuredProduct],
    planFeatures: { customization: true, advancedCustomization: false },
    advancedCustomization
  });
  assert.equal(disabled.body.store.advancedCustomizationEnabled, false);
  assert.equal(Object.hasOwn(disabled.body.store, "advancedCustomization"), false);
  assert.equal(disabled.body.ads.length, 1);
});

test("public store behavior turns PWA and multiple contacts on and off with the active plan", async () => {
  const contacts = [{ value: "700000001" }, { value: "700000002" }];
  const enabled = await invokePublicStore({
    ads: [],
    planFeatures: ["pwa", "multipleContacts"],
    phones: contacts,
    whatsapp: contacts
  });
  const disabled = await invokePublicStore({
    ads: [],
    planFeatures: [],
    phones: contacts,
    whatsapp: contacts
  });

  assert.equal(enabled.body.store.pwaEnabled, true);
  assert.equal(enabled.body.store.contact.phones.length, 2);
  assert.equal(enabled.body.store.contact.whatsapp.length, 2);
  assert.equal(disabled.body.store.pwaEnabled, false);
  assert.equal(disabled.body.store.contact.phones.length, 1);
  assert.equal(disabled.body.store.contact.whatsapp.length, 1);
});

test("public Store Products expose delivery only when both product and plan allow it", async () => {
  const product = {
    _id: "delivery-product",
    userId: "owner-id",
    storeProfileId: "store-id",
    title: "منتج",
    description: "",
    isAvailableForDelivery: true,
    createdAt: new Date("2026-09-01"),
    status: "approved",
    expiresAt: new Date(Date.now() + 86400000)
  };
  const enabled = await invokePublicStore({
    ads: [product],
    planFeatures: ["delivery"]
  });
  const disabled = await invokePublicStore({
    ads: [product],
    planFeatures: []
  });
  assert.equal(enabled.body.store.deliveryEnabled, true);
  assert.equal(enabled.body.ads[0].isAvailableForDelivery, true);
  assert.equal(disabled.body.store.deliveryEnabled, false);
  assert.equal(disabled.body.ads[0].isAvailableForDelivery, false);
});

test("public Store Products expose discounted prices only when the plan feature is enabled", async () => {
  const product = {
    _id: "discount-product",
    userId: "owner-id",
    storeProfileId: "store-id",
    title: "منتج مخفض",
    description: "",
    price: 100000,
    discountEnabled: true,
    discountType: "percentage",
    discountValue: 10,
    createdAt: new Date("2026-09-01"),
    status: "approved",
    expiresAt: new Date(Date.now() + 86400000)
  };
  const enabled = await invokePublicStore({
    ads: [product],
    planFeatures: { discounts: true }
  });
  const disabled = await invokePublicStore({
    ads: [product],
    planFeatures: { discounts: false }
  });
  assert.equal(enabled.body.store.discountsEnabled, true);
  assert.equal(enabled.body.ads[0].discountEnabled, true);
  assert.equal(enabled.body.ads[0].originalPrice, 100000);
  assert.equal(enabled.body.ads[0].unitPrice, 90000);
  assert.equal(disabled.body.ads[0].discountEnabled, false);
  assert.equal(disabled.body.ads[0].unitPrice, 100000);
});

test("public store products include existing category attribute values", async () => {
  const result = await invokePublicStore({
    ads: [{ _id: "product", userId: "owner-id", storeProfileId: "store-id", title: "Car", description: "", createdAt: new Date("2026-09-01"), status: "approved", expiresAt: new Date(Date.now() + 86400000) }],
    attributesById: { product: [{ attributeId: { name: "brand", label: "الماركة" }, value: "Toyota" }] }
  });
  assert.deepEqual(result.body.ads[0].attributes, [{ attributeId: { name: "brand", label: "الماركة" }, value: "Toyota" }]);
});