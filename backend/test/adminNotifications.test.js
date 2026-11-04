import test from "node:test";
import assert from "node:assert/strict";
import AdminNotification from "../src/models/AdminNotification.js";
import User from "../src/models/User.js";
import { createAdminNotification } from "../src/services/notificationService.js";

test("admin notification types used by request workflows are accepted by the schema", () => {
  const supportedTypes = AdminNotification.schema.path("type").enumValues;

  for (const type of ["booking_submission", "quote_request_report", "phone_verification_request"]) {
    assert.ok(supportedTypes.includes(type), `${type} is a supported admin notification type`);
  }
});

test("new admin notifications are persisted and emitted only to the admin room", async () => {
  const originalCreate = AdminNotification.create;
  const originalFind = User.find;
  const notificationData = {
    type: "quote_request_report",
    title: "بلاغ جديد",
    message: "تم الإبلاغ عن طلب تسعير",
    link: "/admin/quote-requests",
    data: { requestId: "request-1" }
  };
  const rooms = [];
  const emittedEvents = [];
  const app = {
    get: () => ({
      to(room) {
        rooms.push(room);
        return {
          emit(event, notification) {
            emittedEvents.push({ event, notification });
          }
        };
      },
      emit() {
        assert.fail("admin notification must not be broadcast globally");
      }
    })
  };

  try {
    AdminNotification.create = async (data) => ({
      ...data,
      _id: "notification-1",
      toObject() {
        return { ...this, toObject: undefined };
      }
    });
    User.find = () => ({
      select: async () => []
    });

    const notification = await createAdminNotification(app, notificationData);

    assert.equal(notification.type, notificationData.type);
    assert.deepEqual(rooms, ["role:admin"]);
    assert.equal(emittedEvents.length, 1);
    assert.equal(emittedEvents[0].event, "admin_notification:new");
    assert.equal(emittedEvents[0].notification.type, notificationData.type);
  } finally {
    AdminNotification.create = originalCreate;
    User.find = originalFind;
  }
});
