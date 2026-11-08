import test from "node:test";
import assert from "node:assert/strict";
import Notification from "../src/models/Notification.js";
import User from "../src/models/User.js";
import { createNotification, getUserNotificationLink } from "../src/services/notificationService.js";

test("notification types emitted by scheduled user jobs are accepted by the schema", () => {
  const supportedTypes = Notification.schema.path("type").enumValues;

  for (const type of [
    "ad_status_followup",
    "verification_expired",
    "verification_warning",
    "welcome_promotion_expired"
  ]) {
    assert.ok(supportedTypes.includes(type), `${type} is a supported user notification type`);
  }
});

test("user notifications resolve to safe in-app and push destinations", () => {
  assert.equal(
    getUserNotificationLink("message", { conversationId: "abc 123" }),
    "/messages?chat=abc%20123"
  );
  assert.equal(
    getUserNotificationLink("order", { orderId: "order-1" }),
    "/orders/order-1"
  );
  assert.equal(
    getUserNotificationLink("quote_status", { quoteRequestId: "quote-1" }),
    "/quote-requests/quote-1"
  );
  assert.equal(
    getUserNotificationLink("comment", { adId: "ad-1" }, "https://example.com"),
    "/ad/ad-1"
  );
  assert.equal(
    getUserNotificationLink("comment", { url: "//example.com" }),
    "/notifications"
  );
  assert.equal(
    getUserNotificationLink("comment", { url: "/\\example.com" }),
    "/notifications"
  );
});

test("brokerage notification preferences are persisted for account settings", () => {
  for (const category of [
    "broker_request",
    "broker_approved",
    "deal_pending",
    "deal_confirmed",
    "complaint_resolved"
  ]) {
    assert.ok(User.schema.path(`notificationPrefs.${category}`), `${category} preference path exists`);
  }
});

test("new user notifications persist the same destination used by push delivery", async () => {
  const originalFindById = User.findById;
  const originalFindOne = Notification.findOne;
  const originalCreate = Notification.create;
  const userId = "111111111111111111111111";
  let created;
  let emitted;

  try {
    User.findById = () => ({
      select() {
        return { lean: async () => ({ notificationPrefs: {} }) };
      }
    });
    Notification.findOne = () => ({ lean: async () => null });
    Notification.create = async (value) => {
      created = value;
      return { ...value, toObject() { return value; } };
    };

    await createNotification(
      { get: () => ({ to: () => ({ emit: (_event, payload) => { emitted = payload.notification; } }) }) },
      {
        userId,
        type: "message",
        title: "رسالة جديدة",
        body: "وصلتك رسالة",
        data: { conversationId: "conversation-1" },
        push: false
      }
    );

    assert.equal(created.link, "/messages?chat=conversation-1");
    assert.equal(created.data.url, created.link);
    assert.equal(emitted.link, created.link);
  } finally {
    User.findById = originalFindById;
    Notification.findOne = originalFindOne;
    Notification.create = originalCreate;
  }
});

test("duplicate scheduled notifications do not create another in-app event", async () => {
  const originalFindById = User.findById;
  const originalFindOne = Notification.findOne;
  const originalCreate = Notification.create;
  const existing = { _id: "notification-1", eventKey: "ad-followup:ad-1" };

  try {
    User.findById = () => ({
      select() {
        return { lean: async () => ({ notificationPrefs: {} }) };
      }
    });
    Notification.findOne = (filter) => {
      assert.equal(filter.eventKey, existing.eventKey);
      return { lean: async () => existing };
    };
    Notification.create = async () => {
      assert.fail("duplicate notification should not be inserted");
    };

    const result = await createNotification(null, {
      userId: "111111111111111111111111",
      type: "ad_status_followup",
      title: "هل تم بيع إعلانك؟",
      body: "يرجى تحديث حالة الإعلان",
      eventKey: existing.eventKey,
      push: false
    });

    assert.equal(result, existing);
  } finally {
    User.findById = originalFindById;
    Notification.findOne = originalFindOne;
    Notification.create = originalCreate;
  }
});
