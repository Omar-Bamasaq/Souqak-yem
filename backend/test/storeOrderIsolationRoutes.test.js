import test from "node:test";
import assert from "node:assert/strict";
import ordersRouter from "../src/routes/orders.js";
import adminEscrowRouter from "../src/routes/adminEscrow.js";
import Order from "../src/models/Order.js";
import Dispute from "../src/models/Dispute.js";

const ORDER_ID = "666666666666666666666666";
const BUYER_ID = "111111111111111111111111";
const SELLER_ID = "222222222222222222222222";

function getHandler(router, method, routePath) {
  const layer = router.stack.find((entry) =>
    entry.route?.path === routePath && entry.route.methods[method]
  );
  assert.ok(layer, `${method.toUpperCase()} ${routePath} route exists`);
  return layer.route.stack.at(-1).handle;
}

function query(value) {
  return {
    populate() { return this; },
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    lean() { return Promise.resolve(value); },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
  };
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

test("Marketplace buyer and seller lists exclude Store Orders but preserve secure orders", async () => {
  const originalFind = Order.find;
  const filters = [];
  Order.find = (filter) => {
    filters.push(filter);
    return query([{ _id: ORDER_ID, orderType: "secure" }]);
  };
  try {
    for (const [routePath, userField] of [["/buyer", "buyer"], ["/seller", "seller"]]) {
      const result = await invoke(getHandler(ordersRouter, "get", routePath), {
        user: { id: userField === "buyer" ? BUYER_ID : SELLER_ID }
      });
      assert.equal(result.statusCode, 200);
      assert.equal(result.body[0].orderType, "secure");
    }
    assert.equal(filters.length, 2);
    for (const filter of filters) {
      assert.deepEqual(filter.orderType, { $ne: "store" });
      assert.equal(filter.storeProfileId, null);
    }
  } finally {
    Order.find = originalFind;
  }
});

test("Marketplace order detail and buyer actions cannot load Store Orders", async () => {
  const originalFindOne = Order.findOne;
  const filters = [];
  Order.findOne = (filter) => {
    filters.push(filter);
    return query(null);
  };
  try {
    const detail = await invoke(getHandler(ordersRouter, "get", "/:id"), {
      params: { id: ORDER_ID },
      user: { id: BUYER_ID, role: "buyer" }
    });
    const payment = await invoke(getHandler(ordersRouter, "patch", "/:id/pay"), {
      params: { id: ORDER_ID },
      user: { id: BUYER_ID, role: "buyer" },
      body: { bankName: "بنك", transactionNumber: "123" },
      files: []
    });
    assert.equal(detail.statusCode, 404);
    assert.equal(payment.statusCode, 404);
    assert.equal(filters.length, 2);
    for (const filter of filters) {
      assert.deepEqual(filter.orderType, { $ne: "store" });
      assert.equal(filter.storeProfileId, null);
    }
  } finally {
    Order.findOne = originalFindOne;
  }
});

test("Marketplace order detail still returns a secure order to its buyer", async () => {
  const originalFindOne = Order.findOne;
  Order.findOne = () => query({
    _id: ORDER_ID,
    orderType: "secure",
    buyer: { _id: BUYER_ID },
    seller: { _id: SELLER_ID }
  });
  try {
    const result = await invoke(getHandler(ordersRouter, "get", "/:id"), {
      params: { id: ORDER_ID },
      user: { id: BUYER_ID, role: "buyer" }
    });
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.orderType, "secure");
  } finally {
    Order.findOne = originalFindOne;
  }
});

test("Admin escrow list and payment actions exclude Store Orders", async () => {
  const originals = {
    find: Order.find,
    findOne: Order.findOne,
    countDocuments: Order.countDocuments,
    findOneAndUpdate: Order.findOneAndUpdate
  };
  const filters = [];
  Order.find = (filter) => {
    filters.push(filter);
    return query([]);
  };
  Order.countDocuments = async (filter) => {
    filters.push(filter);
    return 0;
  };
  Order.findOne = (filter) => {
    filters.push(filter);
    return query(null);
  };
  Order.findOneAndUpdate = async (filter) => {
    filters.push(filter);
    return null;
  };
  try {
    const list = await invoke(getHandler(adminEscrowRouter, "get", "/orders"), {
      query: {}
    });
    const confirm = await invoke(getHandler(adminEscrowRouter, "patch", "/orders/:id/confirm-payment"), {
      params: { id: ORDER_ID },
      user: { id: "admin-id" }
    });
    const reject = await invoke(getHandler(adminEscrowRouter, "patch", "/orders/:id/reject-payment"), {
      params: { id: ORDER_ID },
      user: { id: "admin-id" },
      body: { reason: "رفض" }
    });
    const complete = await invoke(getHandler(adminEscrowRouter, "patch", "/orders/:id/complete"), {
      params: { id: ORDER_ID },
      user: { id: "admin-id" }
    });
    assert.equal(list.statusCode, 200);
    assert.equal(confirm.statusCode, 400);
    assert.equal(reject.statusCode, 400);
    assert.equal(complete.statusCode, 400);
    assert.equal(filters.length, 5);
    for (const filter of filters) {
      assert.deepEqual(filter.orderType, { $ne: "store" });
      assert.equal(filter.storeProfileId, null);
    }
  } finally {
    Order.find = originals.find;
    Order.findOne = originals.findOne;
    Order.countDocuments = originals.countDocuments;
    Order.findOneAndUpdate = originals.findOneAndUpdate;
  }
});

test("Admin escrow refuses to resolve a Store Order dispute through Marketplace escrow", async () => {
  const originalFindOne = Dispute.findOne;
  const originalFindOneAndUpdate = Dispute.findOneAndUpdate;
  let updatedDispute = false;
  Dispute.findOne = () => query({
    order: { orderType: "store", storeProfileId: "444444444444444444444444" }
  });
  Dispute.findOneAndUpdate = () => {
    updatedDispute = true;
    return query(null);
  };
  try {
    const result = await invoke(getHandler(adminEscrowRouter, "patch", "/disputes/:id/resolve"), {
      params: { id: ORDER_ID },
      user: { id: "admin-id" },
      body: { resolution: "REFUND_TO_BUYER", notes: "سبب" }
    });
    assert.equal(result.statusCode, 400);
    assert.equal(updatedDispute, false);
  } finally {
    Dispute.findOne = originalFindOne;
    Dispute.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test("Admin escrow dispute list excludes Store Order disputes", async () => {
  const originalFind = Dispute.find;
  Dispute.find = () => query([
    { _id: "dispute-store", order: { orderType: "store", storeProfileId: "444444444444444444444444" } },
    { _id: "dispute-secure", order: { orderType: "secure", storeProfileId: null } }
  ]);
  try {
    const result = await invoke(getHandler(adminEscrowRouter, "get", "/disputes"), {
      query: {}
    });
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body.map((dispute) => dispute._id), ["dispute-secure"]);
  } finally {
    Dispute.find = originalFind;
  }
});
