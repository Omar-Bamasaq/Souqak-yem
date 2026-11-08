import test from "node:test";
import assert from "node:assert/strict";
import Notification from "../src/models/Notification.js";
import notificationsRouter from "../src/routes/notifications.js";

const OWNER_ID = "222222222222222222222222";
const OTHER_OWNER_ID = "888888888888888888888888";
const NOTIFICATION_ID = "999999999999999999999999";

function query(value) {
  return {
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    lean() { return Promise.resolve(value); }
  };
}

function getHandler(method, path) {
  const layer = notificationsRouter.stack.find((entry) => entry.route?.path === path && entry.route.methods[method]);
  assert.ok(layer, `${method.toUpperCase()} ${path} route exists`);
  return layer.route.stack.at(-1).handle;
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

test("store order notifications can only be listed and marked read by their recipient", async () => {
  const originalFind = Notification.find;
  const originalCount = Notification.countDocuments;
  const originalFindOneAndUpdate = Notification.findOneAndUpdate;
  const ownNotification = {
    _id: NOTIFICATION_ID,
    userId: OWNER_ID,
    type: "store_order",
    storeProfileId: "333333333333333333333333",
    relatedOrderId: "666666666666666666666666"
  };

  try {
    Notification.find = (filter) => {
      assert.equal(String(filter.userId), OWNER_ID);
      return query([ownNotification]);
    };
    Notification.countDocuments = (filter) => {
      assert.equal(String(filter.userId), OWNER_ID);
      return Promise.resolve(1);
    };
    const list = await invoke(getHandler("get", "/"), {
      user: { id: OWNER_ID },
      query: {}
    });
    assert.equal(list.statusCode, 200);
    assert.deepEqual(list.body.items, [ownNotification]);

    Notification.findOneAndUpdate = (filter) => {
      assert.equal(String(filter._id), NOTIFICATION_ID);
      assert.equal(String(filter.userId), OTHER_OWNER_ID);
      return query(null);
    };
    const foreignRead = await invoke(getHandler("patch", "/:id/read"), {
      user: { id: OTHER_OWNER_ID },
      params: { id: NOTIFICATION_ID }
    });
    assert.equal(foreignRead.statusCode, 404);
  } finally {
    Notification.find = originalFind;
    Notification.countDocuments = originalCount;
    Notification.findOneAndUpdate = originalFindOneAndUpdate;
  }
});
