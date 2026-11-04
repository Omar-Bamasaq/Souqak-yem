import test from "node:test";
import assert from "node:assert/strict";
import bookingsRouter from "../src/routes/bookings.js";
import BookingService, { BOOKING_SERVICE_TYPES } from "../src/models/BookingService.js";
import BookingServiceRating from "../src/models/BookingServiceRating.js";
import Governorate from "../src/models/Governorate.js";
import City from "../src/models/City.js";
import AdminNotification from "../src/models/AdminNotification.js";
import { ADMIN_PERMISSIONS, permissionForRequest } from "../src/config/adminPermissions.js";

const validBody = {
  name: "استراحة الوادي",
  type: "استراحة",
  governorateId: "64d3d93a1a2b3c4d5e6f7788",
  cityId: "64d3d93a1a2b3c4d5e6f7789",
  location: "شارع المطار، جوار الحديقة",
  lat: "15.3694",
  lng: "44.1910",
  phones: JSON.stringify([{ type: "mobile", value: "777123456" }]),
  whatsapp: JSON.stringify([{ type: "whatsapp", value: "967777123456" }]),
  note: "الحجز المسبق متاح"
};

function responseRecorder() {
  const result = { statusCode: 200, body: null };
  return {
    result,
    status(code) { result.statusCode = code; return this; },
    json(body) { result.body = body; return this; }
  };
}

function routeHandler(path, method) {
  const route = bookingsRouter.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);
  assert.ok(route, `route ${method.toUpperCase()} ${path} should exist`);
  return route.route.stack.at(-1).handle;
}

test("booking service types include common accommodation options", () => {
  assert.ok(BOOKING_SERVICE_TYPES.includes("فندق"));
  assert.ok(BOOKING_SERVICE_TYPES.includes("استراحة"));
  assert.ok(BOOKING_SERVICE_TYPES.includes("شاليه"));
});

test("user submission creates a pending listing and informs admins", async () => {
  const originals = {
    governorateFindOne: Governorate.findOne,
    cityFindOne: City.findOne,
    bookingCreate: BookingService.create,
    notificationCreate: AdminNotification.create
  };
  let createdData;
  let notification;
  Governorate.findOne = () => ({ select() { return this; }, lean: async () => ({ _id: validBody.governorateId }) });
  City.findOne = () => ({ select() { return this; }, lean: async () => ({ _id: validBody.cityId }) });
  BookingService.create = async (data) => { createdData = data; return { _id: "service-id", ...data }; };
  AdminNotification.create = async (data) => { notification = data; return data; };

  try {
    const res = responseRecorder();
    await routeHandler("/", "post")({
      body: validBody,
      files: [{ filename: "main.webp" }, { filename: "inside.webp" }],
      user: { id: "owner-id" }
    }, res);

    assert.equal(res.result.statusCode, 201);
    assert.match(res.result.body.message, /مراجعة الطلب من قبل الإدارة/);
    assert.equal(createdData.status, "pending");
    assert.equal(createdData.ownerId, "owner-id");
    assert.equal(createdData.mainImage, "/uploads/main.webp");
    assert.deepEqual(createdData.images, ["/uploads/inside.webp"]);
    assert.equal(createdData.lat, 15.3694);
    assert.equal(createdData.lng, 44.191);
    assert.equal(createdData.phones.length, 2);
    assert.equal(notification.type, "booking_submission");
    assert.equal(notification.link, "/admin/bookings");
  } finally {
    Governorate.findOne = originals.governorateFindOne;
    City.findOne = originals.cityFindOne;
    BookingService.create = originals.bookingCreate;
    AdminNotification.create = originals.notificationCreate;
  }
});

test("service submission rejects invalid coordinates before saving", async () => {
  const invalidBody = { ...validBody, lat: "91" };
  const res = responseRecorder();
  await routeHandler("/", "post")({
    body: invalidBody,
    files: [{ filename: "main.webp" }],
    user: { id: "owner-id" }
  }, res);
  assert.equal(res.result.statusCode, 400);
  assert.match(res.result.body.error, /إحداثيات موقع/);
});

test("service submission does not require loading or selecting a map point", async () => {
  const originals = {
    governorateFindOne: Governorate.findOne,
    cityFindOne: City.findOne,
    bookingCreate: BookingService.create,
    notificationCreate: AdminNotification.create
  };
  let createdData;
  Governorate.findOne = () => ({ select() { return this; }, lean: async () => ({ _id: validBody.governorateId }) });
  City.findOne = () => ({ select() { return this; }, lean: async () => ({ _id: validBody.cityId }) });
  BookingService.create = async (data) => { createdData = data; return { _id: "service-id", ...data }; };
  AdminNotification.create = async (data) => data;

  try {
    const { lat, lng, ...bodyWithoutCoordinates } = validBody;
    const res = responseRecorder();
    await routeHandler("/", "post")({
      body: bodyWithoutCoordinates,
      files: [{ filename: "main.webp" }],
      user: { id: "owner-id" }
    }, res);
    assert.equal(res.result.statusCode, 201);
    assert.equal(createdData.lat, null);
    assert.equal(createdData.lng, null);
  } finally {
    Governorate.findOne = originals.governorateFindOne;
    City.findOne = originals.cityFindOne;
    BookingService.create = originals.bookingCreate;
    AdminNotification.create = originals.notificationCreate;
  }
});

test("rating is created once per user and cannot be changed", async () => {
  const originals = {
    bookingFindOne: BookingService.findOne,
    ratingCreate: BookingServiceRating.create
  };
  let savedRating;
  BookingService.findOne = () => ({ select() { return this; }, lean: async () => ({ _id: "64d3d93a1a2b3c4d5e6f7788" }) });
  BookingServiceRating.create = async (rating) => {
    if (savedRating) {
      const duplicateError = new Error("Duplicate rating");
      duplicateError.code = 11000;
      throw duplicateError;
    }
    savedRating = rating;
    return rating;
  };

  try {
    const res = responseRecorder();
    await routeHandler("/:id/rating", "post")({
      params: { id: "64d3d93a1a2b3c4d5e6f7788" },
      body: { stars: 5 },
      user: { id: "user-id" }
    }, res);
    assert.equal(res.result.statusCode, 201);
    assert.equal(savedRating.userId, "user-id");
    assert.equal(savedRating.stars, 5);

    const invalid = responseRecorder();
    await routeHandler("/:id/rating", "post")({
      params: { id: "64d3d93a1a2b3c4d5e6f7788" },
      body: { stars: 6 },
      user: { id: "user-id" }
    }, invalid);
    assert.equal(invalid.result.statusCode, 400);

    const duplicate = responseRecorder();
    await routeHandler("/:id/rating", "post")({
      params: { id: "64d3d93a1a2b3c4d5e6f7788" },
      body: { stars: 3 },
      user: { id: "user-id" }
    }, duplicate);
    assert.equal(duplicate.result.statusCode, 409);
    assert.match(duplicate.result.body.error, /لا يمكن تعديل التقييم أو حذفه/);
    assert.equal(savedRating.stars, 5);
  } finally {
    BookingService.findOne = originals.bookingFindOne;
    BookingServiceRating.create = originals.ratingCreate;
  }
});

test("booking moderation permission is assignable to supervisors", () => {
  assert.ok(ADMIN_PERMISSIONS.some(({ key }) => key === "bookings"));
  assert.equal(permissionForRequest({ originalUrl: "/api/bookings/admin?status=pending" }), "bookings");
});
