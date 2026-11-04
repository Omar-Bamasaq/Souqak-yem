import test from "node:test";
import assert from "node:assert/strict";
import storesRouter from "../src/routes/stores.js";
import StoreNotificationSubscription from "../src/models/StoreNotificationSubscription.js";
import StoreProfile from "../src/models/StoreProfile.js";
import StoreSubscription from "../src/models/StoreSubscription.js";
import Notification from "../src/models/Notification.js";
import {
  createStoreNotification,
  STORE_NOTIFICATION_TYPES
} from "../src/services/notificationService.js";

const USER_ID = "111111111111111111111111";
const OWNER_ID = "222222222222222222222222";
const STORE_ID = "333333333333333333333333";
const ENDPOINT = "https://fcm.googleapis.com/fcm/send/test-endpoint";
const PUSH = {
  endpoint: ENDPOINT,
  keys: { p256dh: "valid-p256dh", auth: "valid-auth" }
};

function query(value) {
  return {
    sort() { return this; },
    populate() { return this; },
    select() { return this; },
    lean() { return Promise.resolve(value); },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
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

async function withStoreMocks(options, run) {
  const config = {
    store: { _id: STORE_ID, userId: OWNER_ID, slug: "shop", status: "active", storeType: "store" },
    features: { notifications: true },
    endDate: new Date(Date.now() + 86400000),
    ...options
  };
  const originals = {
    storeFindById: StoreProfile.findById,
    subscriptionFindOne: StoreSubscription.findOne,
    subscriptionStatus: StoreSubscription.getStoreSubscriptionStatus,
    storeSubFind: StoreNotificationSubscription.find,
    storeSubFindOne: StoreNotificationSubscription.findOne,
    storeSubFindOneAndUpdate: StoreNotificationSubscription.findOneAndUpdate,
    storeSubUpdateOne: StoreNotificationSubscription.updateOne,
    storeSubUpdateMany: StoreNotificationSubscription.updateMany,
    storeSubDeleteOne: StoreNotificationSubscription.deleteOne,
    notificationCreate: Notification.create
  };
  const captured = { filters: [], update: null, preferencesUpdate: null, created: [], deletedSubscriptionIds: [] };
  StoreProfile.findById = () => query(config.store);
  StoreSubscription.findOne = () => ({
    ...query({
      status: "active",
      endDate: config.endDate,
      planId: { type: "store", features: config.features }
    }),
    sort() { return this; },
    populate() { return this; }
  });
  StoreNotificationSubscription.find = (filter) => {
    captured.filters.push(filter);
    return {
      cursor() {
        return (async function* iterate() {
          for (const subscription of config.subscribers || []) yield subscription;
        }());
      }
    };
  };
  StoreNotificationSubscription.findOne = () => query(config.currentPreferences || null);
  StoreNotificationSubscription.findOneAndUpdate = (filter, update) => {
    captured.update = { filter, update };
    return {
      select() { return this; },
      lean() { return Promise.resolve({ enabled: true, orderNotifications: true, messageNotifications: true, marketingNotifications: true }); }
    };
  };
  StoreNotificationSubscription.updateOne = async () => ({ modifiedCount: 1 });
  StoreNotificationSubscription.updateMany = async (filter, update) => {
    captured.preferencesUpdate = { filter, update };
    return { matchedCount: 1, modifiedCount: 1 };
  };
  StoreNotificationSubscription.deleteOne = async (filter) => {
    captured.deletedSubscriptionIds.push(String(filter._id));
    return { deletedCount: 1 };
  };
  Notification.create = async (input) => {
    captured.created.push(input);
    return { ...input, toObject() { return this; } };
  };

  try {
    await run({ config, captured });
  } finally {
    StoreProfile.findById = originals.storeFindById;
    StoreSubscription.findOne = originals.subscriptionFindOne;
    StoreSubscription.getStoreSubscriptionStatus = originals.subscriptionStatus;
    StoreNotificationSubscription.find = originals.storeSubFind;
    StoreNotificationSubscription.findOne = originals.storeSubFindOne;
    StoreNotificationSubscription.findOneAndUpdate = originals.storeSubFindOneAndUpdate;
    StoreNotificationSubscription.updateOne = originals.storeSubUpdateOne;
    StoreNotificationSubscription.updateMany = originals.storeSubUpdateMany;
    StoreNotificationSubscription.deleteOne = originals.storeSubDeleteOne;
    Notification.create = originals.notificationCreate;
  }
}

test("store notification opt-in is restricted to the signed-in user and active plan", async () => {
  await withStoreMocks({}, async ({ captured }) => {
    const result = await invoke(getHandler("put", "/:storeId/notifications/subscription"), {
      params: { storeId: STORE_ID },
      user: { id: USER_ID },
      body: { subscription: PUSH }
    });
    assert.equal(result.statusCode, 200);
    assert.equal(String(captured.update.filter.userId), USER_ID);
    assert.equal(String(captured.update.filter.storeProfileId), STORE_ID);
    assert.equal(captured.update.update.$set.orderNotifications, true);
    assert.equal(captured.update.update.$set.messageNotifications, true);
    assert.equal(captured.update.update.$set.marketingNotifications, true);
  });

  for (const options of [
    { features: { notifications: false } },
    { endDate: new Date(Date.now() - 86400000) },
    { store: { _id: STORE_ID, userId: OWNER_ID, slug: "shop", status: "suspended" } }
  ]) {
    await withStoreMocks(options, async ({ captured }) => {
      const result = await invoke(getHandler("put", "/:storeId/notifications/subscription"), {
        params: { storeId: STORE_ID },
        user: { id: USER_ID },
        body: { subscription: PUSH }
      });
      assert.equal(result.statusCode, 403);
      assert.equal(captured.update, null);
    });
  }
});

test("store notification opt-in rejects unsupported endpoints and unknown settings", async () => {
  await withStoreMocks({}, async () => {
    const unsupportedEndpoint = await invoke(getHandler("put", "/:storeId/notifications/subscription"), {
      params: { storeId: STORE_ID },
      user: { id: USER_ID },
      body: { subscription: { ...PUSH, endpoint: "https://attacker.example/push" } }
    });
    assert.equal(unsupportedEndpoint.statusCode, 400);

    const unknownSetting = await invoke(getHandler("put", "/:storeId/notifications/subscription"), {
      params: { storeId: STORE_ID },
      user: { id: USER_ID },
      body: { subscription: PUSH, broadcast: true }
    });
    assert.equal(unknownSetting.statusCode, 400);
  });
});

test("notification eligibility gates creation when the plan, store, or subscription is inactive", async () => {
  for (const options of [
    { features: { notifications: false } },
    { endDate: new Date(Date.now() - 86400000) },
    { store: { _id: STORE_ID, userId: OWNER_ID, slug: "shop", status: "suspended" } }
  ]) {
    await withStoreMocks(options, async ({ captured }) => {
      const notifications = await createStoreNotification(null, {
        storeProfileId: STORE_ID,
        recipient: "owner",
        type: STORE_NOTIFICATION_TYPES.ORDER_NEW,
        title: "طلب جديد",
        body: "لديك طلب جديد",
        data: { orderId: "555555555555555555555555" },
        ownerPushSender: async () => assert.fail("Push must not be sent for an ineligible store")
      });
      assert.deepEqual(notifications, []);
      assert.deepEqual(captured.created, []);
    });
  }
});

test("store owner receives the notification for the owned store without a customer follow", async () => {
  const pushCalls = [];
  await withStoreMocks({}, async ({ captured }) => {
    const notifications = await createStoreNotification(null, {
      storeProfileId: STORE_ID,
      recipient: "owner",
      type: STORE_NOTIFICATION_TYPES.ORDER_NEW,
      title: "طلب جديد",
      body: "لديك طلب جديد",
      data: { orderId: "555555555555555555555555" },
      ownerPushSender: async (userId, payload) => { pushCalls.push({ userId, payload }); }
    });
    assert.equal(notifications.length, 1);
    assert.equal(String(captured.created[0].userId), OWNER_ID);
    assert.equal(String(captured.created[0].storeProfileId), STORE_ID);
  });
  assert.equal(pushCalls.length, 1);
  assert.equal(String(pushCalls[0].userId), OWNER_ID);
  assert.equal(pushCalls[0].payload.data.storeProfileId, STORE_ID);
});

test("a customer can follow a store internally without granting browser Push permission", async () => {
  await withStoreMocks({}, async ({ captured }) => {
    const result = await invoke(getHandler("put", "/:storeId/notifications/subscription"), {
      params: { storeId: STORE_ID },
      user: { id: USER_ID },
      body: { orderNotifications: true, messageNotifications: true, marketingNotifications: true }
    });
    assert.equal(result.statusCode, 200);
    assert.deepEqual(captured.update.filter, {
      userId: USER_ID,
      storeProfileId: STORE_ID,
      endpoint: { $exists: false }
    });
    assert.equal(captured.update.update.$set.enabled, true);
    assert.equal("keys" in captured.update.update.$set, false);
  });
});

test("store notification preference updates affect only the current user's subscriptions for that store", async () => {
  await withStoreMocks({
    currentPreferences: {
      enabled: true,
      orderNotifications: false,
      messageNotifications: true,
      marketingNotifications: true
    }
  }, async ({ captured }) => {
    const result = await invoke(getHandler("patch", "/:storeId/notifications/subscription"), {
      params: { storeId: STORE_ID },
      user: { id: USER_ID },
      body: { marketingNotifications: false }
    });
    assert.equal(result.statusCode, 200);
    assert.equal(String(captured.preferencesUpdate.filter.userId), USER_ID);
    assert.equal(String(captured.preferencesUpdate.filter.storeProfileId), STORE_ID);
    assert.deepEqual(captured.preferencesUpdate.update, { $set: { marketingNotifications: false } });
  });
});

test("a customer can unsubscribe from only the selected store", async () => {
  await withStoreMocks({}, async ({ captured }) => {
    const result = await invoke(getHandler("delete", "/:storeId/notifications/subscription"), {
      params: { storeId: STORE_ID },
      user: { id: USER_ID }
    });
    assert.equal(result.statusCode, 200);
    assert.deepEqual(captured.preferencesUpdate.filter, {
      userId: USER_ID,
      storeProfileId: STORE_ID,
      enabled: true
    });
    assert.deepEqual(captured.preferencesUpdate.update, { $set: { enabled: false } });
  });
});

test("internal store subscriptions receive in-app notifications without a Push endpoint", async () => {
  const subscriber = { _id: "444444444444444444444444", userId: USER_ID };
  let pushCalls = 0;
  await withStoreMocks({ subscribers: [subscriber] }, async ({ captured }) => {
    const notifications = await createStoreNotification(null, {
      storeProfileId: STORE_ID,
      type: STORE_NOTIFICATION_TYPES.DISCOUNT_ACTIVATED,
      title: "عرض جديد",
      body: "خصم جديد",
      data: { productId: "555555555555555555555555" },
      pushSender: async () => { pushCalls += 1; return { success: true }; }
    });
    assert.equal(notifications.length, 1);
    assert.equal(String(captured.created[0].userId), USER_ID);
    assert.equal(String(captured.created[0].storeProfileId), STORE_ID);
  });
  assert.equal(pushCalls, 0);
});

test("store notifications carry an idempotency key scoped to the store, event, and recipient", async () => {
  const subscriber = {
    _id: "444444444444444444444444",
    userId: USER_ID,
    endpoint: ENDPOINT,
    keys: PUSH.keys
  };
  await withStoreMocks({ subscribers: [subscriber] }, async ({ captured }) => {
    await createStoreNotification(null, {
      storeProfileId: STORE_ID,
      type: STORE_NOTIFICATION_TYPES.ORDER_CONFIRMED,
      title: "تم تأكيد طلبك",
      body: "بدأ المتجر تجهيز طلبك.",
      data: { orderId: "555555555555555555555555", status: "processing" },
      pushSender: async () => ({ success: true })
    });
    assert.equal(
      captured.created[0].eventKey,
      `${STORE_ID}:store_order_confirmed:555555555555555555555555:processing:${USER_ID}`
    );
  });
});

test("marketing notifications are limited to opted-in subscribers for the correct store", async () => {
  const subscriber = {
    _id: "444444444444444444444444",
    userId: USER_ID,
    endpoint: ENDPOINT,
    keys: PUSH.keys
  };
  let deletedSubscriptionIds = [];
  await withStoreMocks({ subscribers: [subscriber] }, async ({ captured }) => {
    const notifications = await createStoreNotification(null, {
      storeProfileId: STORE_ID,
      type: STORE_NOTIFICATION_TYPES.DISCOUNT_ACTIVATED,
      title: "عرض جديد",
      body: "خصم جديد",
      data: { productId: "555555555555555555555555" },
      pushSender: async () => ({ success: false, expired: true, statusCode: 410 })
    });
    assert.equal(notifications.length, 1);
    assert.equal(String(captured.created[0].userId), USER_ID);
    assert.equal(String(captured.created[0].storeProfileId), STORE_ID);
    assert.equal(captured.filters[0].marketingNotifications, true);
    assert.deepEqual(captured.filters[0].userId, { $ne: OWNER_ID });
    deletedSubscriptionIds = captured.deletedSubscriptionIds;
  });
  assert.deepEqual(deletedSubscriptionIds, [subscriber._id]);
});

test("transactional order notices are sent only to the subscribed buyer", async () => {
  const subscriber = {
    _id: "444444444444444444444444",
    userId: USER_ID,
    endpoint: ENDPOINT,
    keys: PUSH.keys
  };
  await withStoreMocks({ subscribers: [subscriber] }, async ({ captured }) => {
    const notifications = await createStoreNotification(null, {
      storeProfileId: STORE_ID,
      recipientUserId: USER_ID,
      type: STORE_NOTIFICATION_TYPES.ORDER_CONFIRMED,
      title: "تم تأكيد طلبك",
      body: "بدأ المتجر تجهيز طلبك.",
      data: { orderId: "555555555555555555555555" },
      pushSender: async () => ({ success: true })
    });
    assert.equal(notifications.length, 1);
    assert.equal(captured.filters[0].storeProfileId, STORE_ID);
    assert.equal(captured.filters[0].orderNotifications, true);
    assert.deepEqual(captured.filters[0].userId, {
      $eq: USER_ID,
      $ne: OWNER_ID
    });
    assert.equal(String(captured.created[0].relatedOrderId), "555555555555555555555555");
  });

  await withStoreMocks({ subscribers: [] }, async ({ captured }) => {
    const notifications = await createStoreNotification(null, {
      storeProfileId: STORE_ID,
      recipientUserId: USER_ID,
      type: STORE_NOTIFICATION_TYPES.ORDER_CONFIRMED,
      title: "تم تأكيد طلبك",
      body: "بدأ المتجر تجهيز طلبك.",
      data: { orderId: "555555555555555555555555" },
      pushSender: async () => ({ success: true })
    });
    assert.deepEqual(notifications, []);
    assert.deepEqual(captured.created, []);
  });
});
