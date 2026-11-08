import test from "node:test";
import assert from "node:assert/strict";
import adsRouter from "../src/routes/ads.js";
import Ad from "../src/models/Ad.js";
import StoreProfile from "../src/models/StoreProfile.js";
import StoreSubscription from "../src/models/StoreSubscription.js";
import SystemSettings from "../src/models/SystemSettings.js";
import ListingService from "../src/services/listingService.js";
import {
  applyPublicStoreFilter,
  getPublicStoreProfileIds,
  isPublicStoreEligible
} from "../src/utils/storePublicVisibility.js";

const STORE_ID = "64d3d93a1a2b3c4d5e6f7701";
const OWNER_ID = "owner-id";
const NOW = new Date("2026-10-09T06:00:00.000Z");

function query(value) {
  return {
    select() { return this; },
    populate() { return this; },
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    lean: async () => value,
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
  };
}

function projectedQuery(value) {
  let projectedValue = value;
  return {
    select(fields) {
      const includedFields = new Set(["_id", ...fields.split(/\s+/).filter(Boolean)]);
      projectedValue = value.map((record) =>
        Object.fromEntries(Object.entries(record).filter(([key]) => includedFields.has(key)))
      );
      return this;
    },
    sort() { return this; },
    lean: async () => projectedValue
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

function handler(router, method, path) {
  const route = router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);
  assert.ok(route, `Expected ${method.toUpperCase()} ${path}`);
  return route.route.stack.at(-1).handle;
}

function subscription(overrides = {}) {
  return {
    status: "active",
    endDate: new Date(Date.now() + 86_400_000),
    ...overrides
  };
}

function publicStore(overrides = {}) {
  return { _id: STORE_ID, status: "active", storeType: "store", ...overrides };
}

function storeAd(overrides = {}) {
  return {
    _id: "ad-id",
    userId: { _id: OWNER_ID },
    title: "منتج متجر",
    status: "approved",
    tagNames: [],
    expiresAt: new Date(Date.now() + 86_400_000),
    isVisible: true,
    isArchived: false,
    sold: false,
    isDeleted: false,
    storeProfileId: publicStore(),
    ...overrides
  };
}

function matchesStoreVisibilityFilter(ad, filter) {
  if (!ad.storeProfileId) return true;
  const clause = filter.$and.find((entry) => Array.isArray(entry.$or));
  return clause.$or.some((entry) =>
    entry.storeProfileId?.$in?.some((id) => String(id) === String(ad.storeProfileId?._id || ad.storeProfileId))
    && ad.isVisible !== false
  );
}

test("public store eligibility requires active profile and active, unexpired subscription", () => {
  assert.equal(isPublicStoreEligible(publicStore(), subscription()), true);
  assert.equal(isPublicStoreEligible(publicStore(), subscription({ endDate: new Date(Date.now() - 1) })), false);
  assert.equal(isPublicStoreEligible(publicStore(), subscription({ status: "expired" })), false);
  assert.equal(isPublicStoreEligible(publicStore({ status: "inactive" }), subscription()), false);
});

test("listing filter keeps ordinary ads and allows only eligible visible store products", () => {
  const filter = applyPublicStoreFilter({ status: "approved" }, [STORE_ID]);
  const clause = filter.$and[0].$or;
  assert.ok(clause.some((entry) => entry.storeProfileId === null));
  assert.ok(clause.some((entry) => entry.storeProfileId?.$exists === false));
  assert.ok(clause.some((entry) =>
    entry.storeProfileId?.$in?.includes(STORE_ID) && entry.isVisible?.$ne === false
  ));
});

test("expired active-status subscription is excluded from public store IDs", async () => {
  const originals = { storeFind: StoreProfile.find, subscriptionFind: StoreSubscription.find };
  StoreProfile.find = () => query([{ _id: STORE_ID }]);
  StoreSubscription.find = () => query([{
    storeId: STORE_ID,
    status: "active",
    endDate: new Date(Date.now() - 1)
  }]);
  try {
    assert.deepEqual(await getPublicStoreProfileIds(), []);
  } finally {
    StoreProfile.find = originals.storeFind;
    StoreSubscription.find = originals.subscriptionFind;
  }
});

test("public store IDs keep profile status in the query projection for eligibility checks", async () => {
  const originals = { storeFind: StoreProfile.find, subscriptionFind: StoreSubscription.find };
  StoreProfile.find = () => projectedQuery([publicStore()]);
  StoreSubscription.find = () => projectedQuery([
    subscription({ storeId: STORE_ID, endDate: new Date(NOW.getTime() + 86_400_000) })
  ]);
  try {
    assert.deepEqual(await getPublicStoreProfileIds(NOW), [STORE_ID]);
  } finally {
    StoreProfile.find = originals.storeFind;
    StoreSubscription.find = originals.subscriptionFind;
  }
});

async function withMarketplaceListMocks({ stores, subscriptions, ads, queryParams = {} }, run) {
  const originals = {
    adFind: Ad.find,
    adCount: Ad.countDocuments,
    storeFind: StoreProfile.find,
    subscriptionFind: StoreSubscription.find
  };
  let capturedFilter;
  let capturedSort;
  StoreProfile.find = () => query(stores);
  StoreSubscription.find = () => query(subscriptions);
  Ad.find = (filter) => {
    capturedFilter = filter;
    let matches = ads.filter((ad) => matchesStoreVisibilityFilter(ad, filter));
    let skip = 0;
    let limit = matches.length;
    return {
      select() { return this; },
      populate() { return this; },
      sort(sortSpec) {
        capturedSort = sortSpec;
        const fields = Object.entries(sortSpec);
        matches = [...matches].sort((left, right) => {
          for (const [field, direction] of fields) {
            const leftValue = left[field] instanceof Date ? left[field].getTime() : left[field];
            const rightValue = right[field] instanceof Date ? right[field].getTime() : right[field];
            if (leftValue === rightValue) continue;
            if (leftValue == null) return 1;
            if (rightValue == null) return -1;
            return (leftValue < rightValue ? -1 : 1) * direction;
          }
          return 0;
        });
        return this;
      },
      skip(value) { skip = value; return this; },
      limit(value) { limit = value; return this; },
      lean: async () => matches.slice(skip, skip + limit)
    };
  };
  Ad.countDocuments = async (filter) => ads.filter((ad) => matchesStoreVisibilityFilter(ad, filter)).length;
  try {
    const res = response();
    await handler(adsRouter, "get", "/")({ query: queryParams }, res);
    return await run({ res, capturedFilter, capturedSort });
  } finally {
    Ad.find = originals.adFind;
    Ad.countDocuments = originals.adCount;
    StoreProfile.find = originals.storeFind;
    StoreSubscription.find = originals.subscriptionFind;
  }
}

test("latest Marketplace page includes newest eligible Store Products before older featured ads", async () => {
  const now = Date.now();
  const olderFeatured = Array.from({ length: 21 }, (_, index) => storeAd({
    _id: `featured-${index}`,
    storeProfileId: null,
    featured: true,
    publishedAt: new Date(now - (index + 2) * 60_000),
    createdAt: new Date(now - (index + 2) * 60_000)
  }));
  const newestStoreProduct = storeAd({
    _id: "newest-store-product",
    storeProfileId: publicStore({ storeName: "متجر موثوق", slug: "trusted-store" }),
    featured: false,
    publishedAt: new Date(now - 60_000),
    createdAt: new Date(now - 60_000)
  });

  await withMarketplaceListMocks({
    stores: [publicStore()],
    subscriptions: [subscription({ storeId: STORE_ID })],
    ads: [...olderFeatured, newestStoreProduct],
    queryParams: { page: "1", limit: "20", sort: "new" }
  }, async ({ res, capturedFilter, capturedSort }) => {
    assert.equal(res.statusCode, 200);
    assert.equal(capturedSort.publishedAt, -1);
    assert.equal(capturedSort.featured, -1);
    assert.equal(res.body.items[0]._id, newestStoreProduct._id);
    assert.equal(res.body.items[0].storeProfileId.storeName, "متجر موثوق");
    assert.equal(res.body.items[0].storeProfileId.slug, "trusted-store");
    assert.equal(res.body.items.length, 20);
    assert.equal(capturedFilter.status, "approved");
    assert.equal(capturedFilter.expiresAt.$gt instanceof Date, true);
    assert.equal(capturedFilter.isVisible.$ne, false);
    assert.equal(capturedFilter.isArchived.$ne, true);
    assert.equal(capturedFilter.sold.$ne, true);
    assert.equal(capturedFilter.isDeleted.$ne, true);
  });
});

test("Marketplace query constrains store items but leaves ordinary ads available", async () => {
  const eligible = storeAd();
  const ordinary = storeAd({ _id: "ordinary-ad", storeProfileId: null });
  await withMarketplaceListMocks({
    stores: [publicStore()],
    subscriptions: [subscription({ storeId: STORE_ID })],
    ads: [eligible, ordinary]
  }, async ({ res, capturedFilter }) => {
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.items.map((item) => item._id), [eligible._id, ordinary._id]);
    const storeClause = capturedFilter.$and.find((entry) => Array.isArray(entry.$or)).$or;
    assert.ok(storeClause.some((entry) => entry.storeProfileId?.$in?.includes(STORE_ID)));
    assert.equal(capturedFilter.isVisible.$ne, false);
    assert.equal(capturedFilter.isArchived.$ne, true);
    assert.equal(capturedFilter.isDeleted.$ne, true);
  });
});

test("Marketplace filters hide store products with stale subscriptions and preserve common public-state guards", async () => {
  const staleStoreProduct = storeAd();
  const ordinary = storeAd({ _id: "ordinary-ad", storeProfileId: null });
  await withMarketplaceListMocks({
    stores: [publicStore()],
    subscriptions: [subscription({ storeId: STORE_ID, endDate: new Date(Date.now() - 1) })],
    ads: [staleStoreProduct, ordinary]
  }, async ({ res, capturedFilter }) => {
    assert.equal(res.statusCode, 200);
    const storeClause = capturedFilter.$and.find((entry) => Array.isArray(entry.$or)).$or;
    assert.deepEqual(storeClause.find((entry) => entry.storeProfileId?.$in)?.storeProfileId.$in, []);
    assert.equal(capturedFilter.status, "approved");
    assert.equal(capturedFilter.sold.$ne, true);
    assert.equal(capturedFilter.isArchived.$ne, true);
    assert.equal(capturedFilter.isDeleted.$ne, true);
    assert.deepEqual(res.body.items.map((item) => item._id), [ordinary._id]);
  });
});

async function withDetailMocks(ad, { storedSubscription = subscription(), user = null } = {}, run) {
  const originals = { adFind: Ad.findById, subscriptionFind: StoreSubscription.findOne, attributes: ListingService.getListingAttributes };
  Ad.findById = () => query(ad);
  StoreSubscription.findOne = () => ({
    sort() { return this; },
    populate() { return this; },
    lean: async () => storedSubscription
  });
  ListingService.getListingAttributes = async () => [];
  try {
    const res = response();
    await handler(adsRouter, "get", "/:id")({ params: { id: ad._id }, user }, res);
    return await run(res);
  } finally {
    Ad.findById = originals.adFind;
    StoreSubscription.findOne = originals.subscriptionFind;
    ListingService.getListingAttributes = originals.attributes;
  }
}

test("active store product appears in public details; expired subscription is hidden", async () => {
  const ad = storeAd();
  await withDetailMocks(ad, {}, async (res) => {
    assert.equal(res.statusCode, 200);
    assert.equal(res.body._id, ad._id);
  });
  await withDetailMocks(ad, { storedSubscription: subscription({ endDate: new Date(Date.now() - 1) }) }, async (res) => {
    assert.equal(res.statusCode, 404);
  });
});

test("ordinary Marketplace ad detail remains available", async () => {
  const ad = storeAd({ storeProfileId: null });
  await withDetailMocks(ad, {}, async (res) => {
    assert.equal(res.statusCode, 200);
    assert.equal(res.body._id, ad._id);
  });
});

test("hidden, archived, deleted, and sold store products are unavailable to the public", async () => {
  const cases = [
    storeAd({ isVisible: false }),
    storeAd({ isArchived: true }),
    storeAd({ isDeleted: true }),
    storeAd({ sold: true }),
    storeAd({ status: "sold" })
  ];
  for (const ad of cases) {
    await withDetailMocks(ad, {}, async (res) => {
      assert.equal(res.statusCode, 404);
    });
  }
});

test("owner and admin retain authorized access to hidden store product details", async () => {
  const ad = storeAd({ isVisible: false, isArchived: true });
  for (const user of [{ id: OWNER_ID, role: "seller" }, { id: "admin-id", role: "admin" }]) {
    await withDetailMocks(ad, { storedSubscription: subscription({ endDate: new Date(Date.now() - 1) }), user }, async (res) => {
      assert.equal(res.statusCode, 200);
    });
  }
});

async function withRepublishMocks(ad, { store = publicStore(), currentSubscription = subscription() } = {}, run) {
  const originals = {
    adFind: Ad.findById,
    storeFind: StoreProfile.findById,
    subscriptionFind: StoreSubscription.findOne,
    settings: SystemSettings.getSettings
  };
  let findCount = 0;
  let saveCount = 0;
  ad.userId = OWNER_ID;
  ad.save = async () => { saveCount += 1; };
  Ad.findById = () => {
    findCount += 1;
    if (findCount === 1) return Promise.resolve(ad);
    return query({ ...ad });
  };
  StoreProfile.findById = () => ({
    select() { return this; },
    lean: async () => store
  });
  StoreSubscription.findOne = () => ({
    sort() { return this; },
    lean: async () => currentSubscription
  });
  SystemSettings.getSettings = async () => ({
    prohibitedKeywords: [],
    adReviewMode: "auto",
    adReviewDelayMinutes: 0
  });
  try {
    const res = response();
    await handler(adsRouter, "patch", "/:id/republish")({
      params: { id: ad._id },
      user: { id: OWNER_ID, role: "seller" },
      body: { storeProfileId: "attacker-store", status: "approved" }
    }, res);
    return await run({ res, ad, get saveCount() { return saveCount; } });
  } finally {
    Ad.findById = originals.adFind;
    StoreProfile.findById = originals.storeFind;
    StoreSubscription.findOne = originals.subscriptionFind;
    SystemSettings.getSettings = originals.settings;
  }
}

test("republish rejects expired store subscription before changing product status", async () => {
  const ad = storeAd({ status: "expired" });
  const previousStatus = ad.status;
  await withRepublishMocks(ad, {
    currentSubscription: subscription({ endDate: new Date(Date.now() - 1) })
  }, async ({ res, ad: current, saveCount }) => {
    assert.equal(res.statusCode, 403);
    assert.equal(current.status, previousStatus);
    assert.equal(saveCount, 0);
  });
});

test("republish rejects ineligible store products and leaves ordinary ad republish unchanged", async () => {
  for (const ad of [
    storeAd({ isArchived: true, status: "expired" }),
    storeAd({ isVisible: false, status: "expired" }),
    storeAd({ sold: true, status: "expired" }),
    storeAd({ status: "sold" }),
    storeAd({ isDeleted: true, status: "expired" })
  ]) {
    await withRepublishMocks(ad, {}, async ({ res, saveCount }) => {
      assert.equal(res.statusCode, 400);
      assert.equal(saveCount, 0);
    });
  }
  const ordinary = storeAd({ storeProfileId: null, status: "expired" });
  await withRepublishMocks(ordinary, {}, async ({ res, ad, saveCount }) => {
    assert.equal(res.statusCode, 200);
    assert.equal(ad.status, "approved");
    assert.equal(saveCount, 1);
  });
});
