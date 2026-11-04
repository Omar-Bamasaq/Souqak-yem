import test from "node:test";
import assert from "node:assert/strict";
import Order from "../src/models/Order.js";
import {
  createStoreOrderStatusNotification,
  sendStoreOrderEmailNotification
} from "../src/services/notificationService.js";

const store = {
  _id: "111111111111111111111111",
  userId: "222222222222222222222222",
  storeType: "store",
  storeName: "متجر تجريبي",
  notificationEmail: "owner@example.com"
};
const order = {
  _id: "333333333333333333333333",
  buyer: "444444444444444444444444",
  seller: store.userId,
  storeProfileId: store._id,
  orderType: "store",
  status: "processing"
};

test("new store order email is deduplicated and restricted to the owning profile", async () => {
  const originalUpdateOne = Order.updateOne;
  const updateFilters = [];
  const sentMessages = [];
  try {
    Order.updateOne = async (filter, update) => {
      updateFilters.push({ filter, update });
      return { modifiedCount: 1 };
    };
    const sent = await sendStoreOrderEmailNotification(store, order, async (message) => {
      sentMessages.push(message);
      return true;
    });

    assert.equal(sent, true);
    assert.equal(sentMessages.length, 1);
    assert.equal(sentMessages[0].to, "owner@example.com");
    assert.equal(updateFilters[0].filter.orderType, "store");
    assert.equal(String(updateFilters[0].filter.storeProfileId), store._id);
    assert.equal(String(updateFilters[0].filter.seller), store.userId);
    assert.equal(updateFilters[0].filter.storeOwnerEmailNotificationAttemptedAt, null);
    assert.ok(updateFilters[0].update.$set.storeOwnerEmailNotificationAttemptedAt instanceof Date);
  } finally {
    Order.updateOne = originalUpdateOne;
  }
});

test("a duplicate owner-email claim and SMTP failure do not send again or throw", async () => {
  const originalUpdateOne = Order.updateOne;
  let sendCount = 0;
  try {
    Order.updateOne = async () => ({ modifiedCount: 0 });
    assert.equal(await sendStoreOrderEmailNotification(store, order, async () => {
      sendCount += 1;
      return true;
    }), false);
    assert.equal(sendCount, 0);

    Order.updateOne = async () => ({ modifiedCount: 1 });
    assert.equal(await sendStoreOrderEmailNotification(store, order, async () => {
      sendCount += 1;
      return false;
    }), false);
    assert.equal(sendCount, 1);
  } finally {
    Order.updateOne = originalUpdateOne;
  }
});

test("store order status notification targets the order buyer and disables email", async () => {
  let captured;
  const result = await createStoreOrderStatusNotification(null, {
    store,
    order,
    notificationSender: async (_app, payload) => {
      captured = payload;
      return "created";
    }
  });

  assert.equal(result, "created");
  assert.equal(String(captured.userId), order.buyer);
  assert.equal(captured.type, "order");
  assert.equal(captured.email, false);
  assert.equal(captured.eventKey, `store-order-status:${order._id}:${order.status}`);
  assert.equal(captured.data.storeProfileId, store._id);
});

test("completed store orders notify buyers that the order is complete", async () => {
  let captured;
  const result = await createStoreOrderStatusNotification(null, {
    store,
    order: { ...order, status: "completed" },
    notificationSender: async (_app, payload) => {
      captured = payload;
      return "created";
    }
  });

  assert.equal(result, "created");
  assert.equal(captured.title, "اكتمل طلبك");
  assert.equal(captured.body, "أكمل المتجر تجهيز طلبك.");
  assert.equal(captured.data.status, "completed");
});
