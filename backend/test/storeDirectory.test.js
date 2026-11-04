import test from "node:test";
import assert from "node:assert/strict";
import storesRouter from "../src/routes/stores.js";
import StoreProfile from "../src/models/StoreProfile.js";
import StoreSubscription from "../src/models/StoreSubscription.js";
import City from "../src/models/City.js";
import Ad from "../src/models/Ad.js";

const STORE_ID = "507f1f77bcf86cd799439011";
const GOVERNORATE_ID = "507f1f77bcf86cd799439012";
const CITY_ID = "507f1f77bcf86cd799439013";

function query(value) {
  return {
    select() { return this; },
    populate() { return this; },
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    lean() { return Promise.resolve(value); }
  };
}

test("store directory applies activity and profile location filters", async () => {
  const route = storesRouter.stack.find(
    (layer) => layer.route?.path === "/directory" && layer.route.methods.get
  );
  assert.ok(route, "Expected GET /directory route");
  const handler = route.route.stack.at(-1).handle;
  const originals = {
    storeFind: StoreProfile.find,
    storeCount: StoreProfile.countDocuments,
    subscriptionFind: StoreSubscription.find,
    subscriptionStatus: StoreSubscription.getStoreSubscriptionStatus,
    cityFindById: City.findById
  };
  let directoryFilter;
  StoreProfile.find = (filter) => {
    if (filter?._id?.$in) {
      directoryFilter = filter;
      return query([{
        _id: STORE_ID,
        storeName: "متجر تجريبي",
        slug: "matjar-tajrebi",
        businessActivity: "معرض سيارات",
        governorateId: { name: "صنعاء" },
        cityId: { name: "صنعاء" }
      }]);
    }
    return query([{ _id: STORE_ID, status: "active" }]);
  };
  StoreProfile.countDocuments = async () => 1;
  StoreSubscription.find = () => query([{ storeId: STORE_ID, status: "active" }]);
  StoreSubscription.getStoreSubscriptionStatus = () => "active";
  City.findById = () => query({ governorateId: GOVERNORATE_ID });
  const result = { statusCode: 200, body: null };
  const res = {
    status(code) { result.statusCode = code; return this; },
    json(body) { result.body = body; return this; }
  };

  try {
    await handler({
      query: {
        storeType: "store",
        view: "stores",
        activityKey: "cars",
        governorateId: GOVERNORATE_ID,
        cityId: CITY_ID
      }
    }, res);

    assert.equal(result.statusCode, 200);
    assert.equal(directoryFilter.activityKey, "cars");
    assert.equal(directoryFilter.governorateId, GOVERNORATE_ID);
    assert.equal(directoryFilter.cityId, CITY_ID);
    assert.equal(result.body.items[0].slug, "matjar-tajrebi");
  } finally {
    StoreProfile.find = originals.storeFind;
    StoreProfile.countDocuments = originals.storeCount;
    StoreSubscription.find = originals.subscriptionFind;
    StoreSubscription.getStoreSubscriptionStatus = originals.subscriptionStatus;
    City.findById = originals.cityFindById;
  }
});

test("discount directory filters owner activity and offer location", async () => {
  const route = storesRouter.stack.find(
    (layer) => layer.route?.path === "/directory" && layer.route.methods.get
  );
  const handler = route.route.stack.at(-1).handle;
  const originals = {
    storeFind: StoreProfile.find,
    subscriptionFind: StoreSubscription.find,
    subscriptionStatus: StoreSubscription.getStoreSubscriptionStatus,
    cityFindById: City.findById,
    adFind: Ad.find,
    adCount: Ad.countDocuments
  };
  let eligibleStoreFilter;
  let discountFilter;
  let subscriptionLookup = 0;
  StoreProfile.find = (filter) => {
    if (filter?._id?.$in) {
      eligibleStoreFilter = filter;
      return query([{ _id: STORE_ID, status: "active" }]);
    }
    return query([{ _id: STORE_ID, status: "active" }]);
  };
  StoreSubscription.find = () => {
    subscriptionLookup += 1;
    return query(subscriptionLookup === 1
      ? [{ storeId: STORE_ID, status: "active" }]
      : [{ storeId: STORE_ID, status: "active", planId: { type: "store", features: { discounts: true } } }]);
  };
  StoreSubscription.getStoreSubscriptionStatus = () => "active";
  City.findById = () => query({ governorateId: GOVERNORATE_ID });
  Ad.find = (filter) => {
    discountFilter = filter;
    return query([]);
  };
  Ad.countDocuments = async () => 0;
  const result = { statusCode: 200, body: null };
  const res = {
    status(code) { result.statusCode = code; return this; },
    json(body) { result.body = body; return this; }
  };

  try {
    await handler({
      query: {
        storeType: "store",
        view: "discounts",
        activityKey: "cars",
        governorateId: GOVERNORATE_ID,
        cityId: CITY_ID
      }
    }, res);

    assert.equal(result.statusCode, 200);
    assert.equal(eligibleStoreFilter.activityKey, "cars");
    assert.equal(eligibleStoreFilter.governorateId, undefined);
    assert.equal(eligibleStoreFilter.cityId, undefined);
    assert.equal(discountFilter.governorateId, GOVERNORATE_ID);
    assert.equal(discountFilter.cityId, CITY_ID);
  } finally {
    StoreProfile.find = originals.storeFind;
    StoreSubscription.find = originals.subscriptionFind;
    StoreSubscription.getStoreSubscriptionStatus = originals.subscriptionStatus;
    City.findById = originals.cityFindById;
    Ad.find = originals.adFind;
    Ad.countDocuments = originals.adCount;
  }
});
