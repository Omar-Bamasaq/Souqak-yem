import test from "node:test";
import assert from "node:assert/strict";
import storesRouter from "../src/routes/stores.js";
import StoreAnalyticsDaily from "../src/models/StoreAnalyticsDaily.js";
import StorePwaInstall from "../src/models/StorePwaInstall.js";
import StoreProfile from "../src/models/StoreProfile.js";
import StoreSubscription from "../src/models/StoreSubscription.js";
import Ad from "../src/models/Ad.js";
import Order from "../src/models/Order.js";
import StoreFollow from "../src/models/StoreFollow.js";

const OWNER_ID = "222222222222222222222222";
const OTHER_USER_ID = "111111111111111111111111";
const STORE_ID = "333333333333333333333333";
const PRODUCT_ID = "555555555555555555555555";

function query(value) {
  return {
    sort() { return this; },
    populate() { return this; },
    select() { return this; },
    lean() { return Promise.resolve(value); }
  };
}

function getHandler(method, path) {
  const route = storesRouter.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);
  assert.ok(route, `${method.toUpperCase()} ${path} route exists`);
  return route.route.stack.at(-1).handle;
}

async function invoke(handler, req) {
  const result = { statusCode: 200, body: null };
  const res = {
    status(code) { result.statusCode = code; return this; },
    json(body) { result.body = body; return this; }
  };
  await handler(req, res);
  return result;
}

async function withAnalyticsMocks(options, run) {
  const config = {
    features: { analytics: true, pwa: true },
    store: { _id: STORE_ID, userId: OWNER_ID, status: "active", storeType: "store" },
    viewTotals: [{ _id: "store_view", views: 6 }, { _id: "product_view", views: 11 }],
    dailyTotals: [],
    topProducts: [{ _id: PRODUCT_ID, views: 8 }],
    products: [{ _id: PRODUCT_ID, title: "منتج تجريبي" }],
    orderTotals: [{
      _id: "YER_ADEN",
      count: 3,
      newOrders: 1,
      completedOrders: 1,
      totalValue: 750
    }],
    productExists: true,
    pwaInstallCount: 15,
    ...options
  };
  const originals = {
    profileFindOne: StoreProfile.findOne,
    subscriptionFindOne: StoreSubscription.findOne,
    analyticsAggregate: StoreAnalyticsDaily.aggregate,
    analyticsUpdateOne: StoreAnalyticsDaily.updateOne,
    pwaInstallCountDocuments: StorePwaInstall.countDocuments,
    pwaInstallUpdateOne: StorePwaInstall.updateOne,
    adExists: Ad.exists,
    adCountDocuments: Ad.countDocuments,
    adFind: Ad.find,
    orderAggregate: Order.aggregate,
    storeFollowCountDocuments: StoreFollow.countDocuments
  };
  const captured = { ownerFilter: null, viewUpdate: null, pwaInstallUpdate: null, analyticsFilters: [], orderPipeline: null };

  StoreProfile.findOne = (filter) => {
    if (Object.prototype.hasOwnProperty.call(filter, "userId")) {
      captured.ownerFilter = filter;
      return query(String(filter.userId) === OWNER_ID ? config.store : null);
    }
    return query(config.store);
  };
  StoreSubscription.findOne = () => query({
    status: "active",
    endDate: config.subscriptionEndDate || new Date(Date.now() + 86400000),
    planId: { type: "store", features: config.features }
  });
  StoreAnalyticsDaily.aggregate = async (pipeline) => {
    captured.analyticsFilters.push(pipeline[0].$match);
    if (pipeline.at(-1).$limit === 5) return config.topProducts;
    if (pipeline.at(-1).$group?._id === "$type") return config.viewTotals;
    return config.dailyTotals;
  };
  StoreAnalyticsDaily.updateOne = async (filter, update, updateOptions) => {
    captured.viewUpdate = { filter, update, updateOptions };
    return { acknowledged: true };
  };
  StorePwaInstall.countDocuments = async () => config.pwaInstallCount;
  StorePwaInstall.updateOne = async (filter, update, updateOptions) => {
    captured.pwaInstallUpdate = { filter, update, updateOptions };
    return { acknowledged: true };
  };
  Ad.exists = async () => config.productExists ? { _id: PRODUCT_ID } : null;
  Ad.countDocuments = async () => 4;
  Ad.find = () => ({
    select() { return this; },
    lean() { return Promise.resolve(config.products); }
  });
  Order.aggregate = async (pipeline) => {
    captured.orderPipeline = pipeline;
    return config.orderTotals;
  };
  StoreFollow.countDocuments = async () => 9;

  try {
    await run({ config, captured });
  } finally {
    StoreProfile.findOne = originals.profileFindOne;
    StoreSubscription.findOne = originals.subscriptionFindOne;
    StoreAnalyticsDaily.aggregate = originals.analyticsAggregate;
    StoreAnalyticsDaily.updateOne = originals.analyticsUpdateOne;
    StorePwaInstall.countDocuments = originals.pwaInstallCountDocuments;
    StorePwaInstall.updateOne = originals.pwaInstallUpdateOne;
    Ad.exists = originals.adExists;
    Ad.countDocuments = originals.adCountDocuments;
    Ad.find = originals.adFind;
    Order.aggregate = originals.orderAggregate;
    StoreFollow.countDocuments = originals.storeFollowCountDocuments;
  }
}

test("store owner analytics are gated and aggregate views, products, and store orders", async () => {
  await withAnalyticsMocks({}, async ({ captured }) => {
    const result = await invoke(getHandler("get", "/owner/analytics"), {
      user: { id: OWNER_ID },
      query: { range: "7d" }
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.storeViews, 6);
    assert.equal(result.body.productViews, 11);
    assert.equal(result.body.productsCount, 4);
    assert.equal(result.body.followers, 9);
    assert.equal(result.body.pwaInstallations, 15);
    assert.deepEqual(result.body.orders, {
      total: 3,
      new: 1,
      completed: 1,
      totalValueByCurrency: [{ currency: "YER_ADEN", total: 750 }]
    });
    assert.equal(result.body.dailyViews.length, 7);
    assert.equal(result.body.topProducts[0].title, "منتج تجريبي");
    assert.equal(captured.ownerFilter.userId, OWNER_ID);
    assert.equal(captured.orderPipeline[0].$match.storeProfileId, STORE_ID);
    assert.equal(captured.orderPipeline[0].$match.orderType, "store");
  });
});

test("store PWA installation counts are hidden when the plan does not enable PWA", async () => {
  await withAnalyticsMocks({ features: { analytics: true, pwa: false } }, async () => {
    const result = await invoke(getHandler("get", "/owner/analytics"), {
      user: { id: OWNER_ID },
      query: { range: "7d" }
    });
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.pwaInstallations, 0);
  });
});

test("PWA install tracking accepts an idempotent browser installation key only for enabled stores", async () => {
  await withAnalyticsMocks({}, async ({ captured }) => {
    const result = await invoke(getHandler("post", "/:storeId/pwa-installs"), {
      params: { storeId: STORE_ID },
      body: { installationId: "e9f6a04d-6c9b-4d7e-9f0f-64e09cabd32f" }
    });
    assert.equal(result.statusCode, 202);
    assert.equal(result.body.counted, true);
    assert.deepEqual(captured.pwaInstallUpdate.filter, {
      storeProfileId: STORE_ID,
      installationId: "e9f6a04d-6c9b-4d7e-9f0f-64e09cabd32f"
    });
    assert.equal(captured.pwaInstallUpdate.updateOptions.upsert, true);

    const invalid = await invoke(getHandler("post", "/:storeId/pwa-installs"), {
      params: { storeId: STORE_ID },
      body: { installationId: "not-a-uuid" }
    });
    assert.equal(invalid.statusCode, 400);
  });

  await withAnalyticsMocks({ features: { analytics: true, pwa: false } }, async ({ captured }) => {
    const result = await invoke(getHandler("post", "/:storeId/pwa-installs"), {
      params: { storeId: STORE_ID },
      body: { installationId: "e9f6a04d-6c9b-4d7e-9f0f-64e09cabd32f" }
    });
    assert.equal(result.statusCode, 403);
    assert.equal(captured.pwaInstallUpdate, null);
  });

  await withAnalyticsMocks({ features: { analytics: false, pwa: true } }, async ({ captured }) => {
    const result = await invoke(getHandler("post", "/:storeId/pwa-installs"), {
      params: { storeId: STORE_ID },
      body: { installationId: "e9f6a04d-6c9b-4d7e-9f0f-64e09cabd32f" }
    });
    assert.equal(result.statusCode, 403);
    assert.equal(captured.pwaInstallUpdate, null);
  });
});

test("analytics API rejects disabled and expired store plans", async () => {
  for (const config of [
    { features: { analytics: false } },
    { features: { analytics: true }, subscriptionEndDate: new Date(Date.now() - 86400000) }
  ]) {
    await withAnalyticsMocks(config, async () => {
      const result = await invoke(getHandler("get", "/owner/analytics"), {
        user: { id: OWNER_ID },
        query: { range: "7d" }
      });
      assert.equal(result.statusCode, 403);
    });
  }
});

test("only the authenticated store owner can read analytics", async () => {
  await withAnalyticsMocks({}, async ({ captured }) => {
    const result = await invoke(getHandler("get", "/owner/analytics"), {
      user: { id: OTHER_USER_ID },
      query: { range: "7d", storeId: STORE_ID }
    });
    assert.equal(result.statusCode, 403);
    assert.equal(captured.ownerFilter.userId, OTHER_USER_ID);
  });
});

test("analytics accepts only 1d, 7d, and 30d ranges", async () => {
  await withAnalyticsMocks({}, async ({ captured }) => {
    const handler = getHandler("get", "/owner/analytics");
    for (const [range, days] of [["1d", 1], ["7d", 7], ["30d", 30]]) {
      const result = await invoke(handler, { user: { id: OWNER_ID }, query: { range } });
      assert.equal(result.statusCode, 200);
      assert.equal(result.body.dailyViews.length, days);
      const rangeFilter = captured.analyticsFilters.at(-3);
      assert.match(rangeFilter.dateKey.$gte, /^\d{4}-\d{2}-\d{2}$/);
      assert.match(rangeFilter.dateKey.$lte, /^\d{4}-\d{2}-\d{2}$/);
    }
    const invalid = await invoke(handler, { user: { id: OWNER_ID }, query: { range: "90d" } });
    assert.equal(invalid.statusCode, 400);
  });
});

test("store and product views are stored as anonymous daily aggregates", async () => {
  await withAnalyticsMocks({}, async ({ captured }) => {
    const handler = getHandler("post", "/:storeId/analytics/views");
    const storeView = await invoke(handler, {
      params: { storeId: STORE_ID },
      body: { userId: OTHER_USER_ID }
    });
    assert.equal(storeView.statusCode, 202);
    assert.equal(captured.viewUpdate.filter.type, "store_view");
    assert.equal(captured.viewUpdate.filter.adId, null);
    assert.equal(captured.viewUpdate.updateOptions.upsert, true);
    assert.equal("userId" in captured.viewUpdate.filter, false);
    assert.equal("ip" in captured.viewUpdate.filter, false);

    const productView = await invoke(handler, {
      params: { storeId: STORE_ID },
      body: { productId: PRODUCT_ID }
    });
    assert.equal(productView.statusCode, 202);
    assert.equal(captured.viewUpdate.filter.type, "product_view");
    assert.equal(captured.viewUpdate.filter.adId, PRODUCT_ID);
  });
});

test("product tracking rejects products that do not belong to the requested store", async () => {
  await withAnalyticsMocks({ productExists: false }, async ({ captured }) => {
    const result = await invoke(getHandler("post", "/:storeId/analytics/views"), {
      params: { storeId: STORE_ID },
      body: { productId: PRODUCT_ID }
    });
    assert.equal(result.statusCode, 404);
    assert.equal(captured.viewUpdate, null);
  });
});

test("disabled analytics does not record store views and normal Marketplace views remain separate", async () => {
  await withAnalyticsMocks({ features: { analytics: false } }, async ({ captured }) => {
    const result = await invoke(getHandler("post", "/:storeId/analytics/views"), {
      params: { storeId: STORE_ID },
      body: {}
    });
    assert.equal(result.statusCode, 403);
    assert.equal(captured.viewUpdate, null);
  });

  const adViewRoute = (await import("../src/routes/ads.js")).default.stack.find(
    (layer) => layer.route?.path === "/:id/view" && layer.route.methods.post
  );
  assert.ok(adViewRoute, "the existing Marketplace ad-view route remains in place");
});
