import test from "node:test";
import assert from "node:assert/strict";
import ordersRouter from "../src/routes/orders.js";
import Ad from "../src/models/Ad.js";
import Order from "../src/models/Order.js";
import User from "../src/models/User.js";

const BUYER_ID = "111111111111111111111111";
const SELLER_ID = "222222222222222222222222";
const AD_ID = "333333333333333333333333";
const STORE_ID = "444444444444444444444444";

function marketplaceOrderHandler() {
  const route = ordersRouter.stack.find((layer) => layer.route?.path === "/" && layer.route.methods.post);
  assert.ok(route, "Expected POST /api/orders route");
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

async function withOrderMocks({ ad, body }, run) {
  const originals = {
    adFindById: Ad.findById,
    orderCreate: Order.create,
    userFindById: User.findById
  };
  const createdOrders = [];
  Ad.findById = () => ({ lean: async () => ad });
  Order.create = async (data) => {
    createdOrders.push(data);
    return { _id: "555555555555555555555555", ...data };
  };
  User.findById = () => ({
    select() { return this; },
    lean: async () => ({ name: "مستخدم", email: "", notificationPrefs: {
      order: { inApp: false, push: false, email: false }
    } })
  });

  try {
    const result = await invoke(marketplaceOrderHandler(), {
      user: { id: BUYER_ID },
      body: {
        adId: AD_ID,
        finalPrice: 100,
        agreedTerms: true,
        ...body
      },
      app: null
    });
    await run({ result, createdOrders });
  } finally {
    Ad.findById = originals.adFindById;
    Order.create = originals.orderCreate;
    User.findById = originals.userFindById;
  }
}

function createAd(overrides = {}) {
  return {
    _id: AD_ID,
    userId: SELLER_ID,
    title: "إعلان سوق",
    price: 100,
    currency: "YER_ADEN",
    status: "approved",
    ...overrides
  };
}

const standardOrderBody = {
  shippingFee: 0,
  shippingCurrency: "YER_ADEN",
  shippingPayer: "none",
  currency: "YER_ADEN",
  notes: ""
};

test("regular Marketplace ads still create orders with the existing price behavior", async () => {
  await withOrderMocks({ ad: createAd(), body: { ...standardOrderBody, finalPrice: 125 } }, async ({ result, createdOrders }) => {
    assert.equal(result.statusCode, 201);
    assert.equal(createdOrders.length, 1);
    assert.equal(createdOrders[0].amount, 125);
    assert.equal(createdOrders[0].status, "PENDING_SELLER_APPROVAL");
    assert.equal(createdOrders[0].ad, AD_ID);
  });
});

test("Marketplace order API rejects Store Products based on the database ad", async () => {
  await withOrderMocks({
    ad: createAd({ storeProfileId: STORE_ID }),
    body: { ...standardOrderBody }
  }, async ({ result, createdOrders }) => {
    assert.equal(result.statusCode, 400);
    assert.match(result.body.error, /منتج تابع لمتجر/);
    assert.equal(createdOrders.length, 0);
  });
});

test("fake finalPrice and fake storeProfileId cannot route a Store Product through Marketplace orders", async () => {
  await withOrderMocks({
    ad: createAd({ storeProfileId: STORE_ID }),
    body: {
      ...standardOrderBody,
      finalPrice: 1,
      storeProfileId: "666666666666666666666666"
    }
  }, async ({ result, createdOrders }) => {
    assert.equal(result.statusCode, 400);
    assert.match(result.body.error, /سلة المتجر/);
    assert.equal(createdOrders.length, 0);
  });
});

test("omitting storeProfileId from the request does not bypass the database check", async () => {
  await withOrderMocks({
    ad: createAd({ storeProfileId: STORE_ID }),
    body: { ...standardOrderBody, finalPrice: 999999 }
  }, async ({ result, createdOrders }) => {
    assert.equal(result.statusCode, 400);
    assert.match(result.body.error, /صفحة المتجر/);
    assert.equal(createdOrders.length, 0);
  });
});
