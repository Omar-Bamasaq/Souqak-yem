import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import walletServicesRouter from "../src/routes/walletServices.js";
import DigitalServiceCategory from "../src/models/DigitalServiceCategory.js";
import WalletService from "../src/models/WalletService.js";
import WalletServiceOrder from "../src/models/WalletServiceOrder.js";
import WalletServiceFeeSettings from "../src/models/WalletServiceFeeSettings.js";
import DraftAction from "../src/models/DraftAction.js";
import AdminNotification from "../src/models/AdminNotification.js";
import Notification from "../src/models/Notification.js";
import User from "../src/models/User.js";

function routeHandler(method, routePath) {
  const route = walletServicesRouter.stack.find(
    (layer) => layer.route?.path === routePath && layer.route.methods[method]
  );
  assert.ok(route, `Expected ${method.toUpperCase()} ${routePath} to exist`);
  return route.route.stack.at(-1).handle;
}

function routeMiddleware(method, routePath, index) {
  const route = walletServicesRouter.stack.find(
    (layer) => layer.route?.path === routePath && layer.route.methods[method]
  );
  assert.ok(route, `Expected ${method.toUpperCase()} ${routePath} to exist`);
  return route.route.stack[index].handle;
}

async function invoke(handler, request, { autoIdempotency = true } = {}) {
  const headers = { ...(request.headers || {}) };
  if (autoIdempotency && request.body?.orderType && !headers["idempotency-key"] && !headers["Idempotency-Key"]) {
    headers["idempotency-key"] = `test-order-key-${randomUUID()}`;
  }
  const result = { statusCode: 200, body: null };
  const response = {
    status(code) { result.statusCode = code; return this; },
    json(body) { result.body = body; return this; }
  };
  await handler({ ...request, headers }, response);
  return result;
}

function matches(query, order) {
  return Object.entries(query).every(([key, value]) => {
    if (key === "$or" && Array.isArray(value)) {
      return value.some((condition) => matches(condition, order));
    }
    if (value && typeof value === "object" && "$in" in value) {
      return value.$in.includes(order[key]);
    }
    if (value && typeof value === "object" && "$exists" in value) {
      return (order[key] !== undefined) === value.$exists;
    }
    return order[key] === value;
  });
}

function mockWalletServices({ feeBands, feeBandVersion = 2, service, beforeServiceReservation } = {}) {
  const originals = {
    orderCreate: WalletServiceOrder.create,
    orderFindOne: WalletServiceOrder.findOne,
    orderFindOneAndUpdate: WalletServiceOrder.findOneAndUpdate,
    serviceFindOne: WalletService.findOne,
    serviceFindOneAndUpdate: WalletService.findOneAndUpdate,
    serviceFind: WalletService.find,
    categoryFind: DigitalServiceCategory.find,
    categoryFindOne: DigitalServiceCategory.findOne,
    feeFindOne: WalletServiceFeeSettings.findOne,
    feeUpdateOne: WalletServiceFeeSettings.updateOne,
    userFindById: User.findById,
    userFind: User.find,
    adminNotificationCreate: AdminNotification.create,
    notificationCreate: Notification.create,
    fetch: globalThis.fetch,
    cloudflareAccountId: process.env.CLOUDFLARE_URL_SCANNER_ACCOUNT_ID,
    cloudflareApiToken: process.env.CLOUDFLARE_URL_SCANNER_API_TOKEN
  };
  const orders = new Map();
  const notifications = [];
  const adminNotifications = [];
  let nextOrderId = 0;
  if (service) {
    Object.assign(service, {
      isActive: service.isActive ?? true,
      isArchived: service.isArchived ?? false,
      serviceVersion: service.serviceVersion ?? 1,
      formSchemaVersion: service.formSchemaVersion ?? 1,
      orderCreationRevision: service.orderCreationRevision ?? 0,
      createdAt: service.createdAt || new Date(Date.now() - 60_000)
    });
  }

  WalletServiceOrder.create = async (data) => {
    if (data.idempotencyKey && [...orders.values()].some((order) =>
      order.user === data.user && order.idempotencyKey === data.idempotencyKey
    )) {
      throw Object.assign(new Error("duplicate idempotency key"), { code: 11000 });
    }
    const order = { _id: `order-${++nextOrderId}`, previousPaymentReceipts: [], ...data };
    orders.set(order._id, order);
    return order;
  };
  WalletServiceOrder.findOne = (query) => {
    const result = [...orders.values()].find((order) => matches(query, order)) || null;
    return {
      select() { return this; },
      lean: async () => result
    };
  };
  WalletServiceOrder.findOneAndUpdate = async (query, update) => {
    const order = orders.get(query._id);
    if (!order || !matches(query, order)) return null;
    Object.assign(order, update.$set || {});
    for (const [field, value] of Object.entries(update.$push || {})) {
      order[field] ||= [];
      order[field].push(value);
    }
    return order;
  };
  WalletService.findOne = async (query) => {
    if (!service || String(query?._id || "") !== String(service._id)
      || (query?.isActive === true && service.isActive !== true)
      || (query?.isArchived?.$ne === true && service.isArchived === true)) return null;
    return service;
  };
  WalletService.findOneAndUpdate = async (query, update) => {
    beforeServiceReservation?.(service);
    if (!service || String(query._id) !== String(service._id)
      || service.isActive !== query.isActive
      || service.isArchived === true
      || Number(service.serviceVersion || 1) !== query.serviceVersion
      || (query.$or && !query.$or.some((condition) =>
        condition.orderCreationRevision === service.orderCreationRevision
        || (condition.orderCreationRevision?.$exists === false && service.orderCreationRevision === undefined)
      ))) return null;
    Object.assign(service, update.$set || {});
    for (const [field, amount] of Object.entries(update.$inc || {})) {
      service[field] = Number(service[field] || 0) + amount;
    }
    return service;
  };
  WalletService.find = () => ({
    sort() { return this; },
    lean: async () => []
  });
  DigitalServiceCategory.find = () => ({
    select() { return this; },
    sort() { return this; },
    lean: async () => []
  });
  DigitalServiceCategory.findOne = () => ({
    lean: async () => null
  });
  WalletServiceFeeSettings.findOne = () => ({
    lean: async () => ({ _id: "settings", feeBands: feeBands || [], feeBandVersion })
  });
  let feeWrites = 0;
  WalletServiceFeeSettings.updateOne = async () => {
    feeWrites += 1;
    return { modifiedCount: 1 };
  };
  User.findById = () => ({
    select() { return this; },
    lean: async () => ({ notificationPrefs: {} })
  });
  User.find = () => ({ select: async () => [] });
  AdminNotification.create = async (data) => {
    const notification = { _id: `admin-notification-${adminNotifications.length + 1}`, ...data, toObject() { return this; } };
    adminNotifications.push(notification);
    return notification;
  };
  Notification.create = async (data) => {
    notifications.push(data);
    return { ...data, toObject() { return this; } };
  };
  process.env.CLOUDFLARE_URL_SCANNER_ACCOUNT_ID = "1234567890abcdef1234567890abcdef";
  process.env.CLOUDFLARE_URL_SCANNER_API_TOKEN = "test-cloudflare-api-token";
  globalThis.fetch = async (requestUrl, options) => {
    if (options.method === "POST") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          uuid: "12345678-1234-1234-1234-123456789abc",
          visibility: "unlisted",
          result: "https://radar.cloudflare.com/scan/12345678-1234-1234-1234-123456789abc"
        })
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        task: { status: "Finished", success: true },
        verdicts: { overall: { malicious: false } }
      })
    };
  };

  return {
    orders,
    notifications,
    adminNotifications,
    get feeWrites() { return feeWrites; },
    restore() {
      WalletServiceOrder.create = originals.orderCreate;
      WalletServiceOrder.findOne = originals.orderFindOne;
      WalletServiceOrder.findOneAndUpdate = originals.orderFindOneAndUpdate;
      WalletService.findOne = originals.serviceFindOne;
      WalletService.findOneAndUpdate = originals.serviceFindOneAndUpdate;
      WalletService.find = originals.serviceFind;
      DigitalServiceCategory.find = originals.categoryFind;
      DigitalServiceCategory.findOne = originals.categoryFindOne;
      WalletServiceFeeSettings.findOne = originals.feeFindOne;
      WalletServiceFeeSettings.updateOne = originals.feeUpdateOne;
      User.findById = originals.userFindById;
      User.find = originals.userFind;
      AdminNotification.create = originals.adminNotificationCreate;
      Notification.create = originals.notificationCreate;
      globalThis.fetch = originals.fetch;
      if (originals.cloudflareAccountId === undefined) delete process.env.CLOUDFLARE_URL_SCANNER_ACCOUNT_ID;
      else process.env.CLOUDFLARE_URL_SCANNER_ACCOUNT_ID = originals.cloudflareAccountId;
      if (originals.cloudflareApiToken === undefined) delete process.env.CLOUDFLARE_URL_SCANNER_API_TOKEN;
      else process.env.CLOUDFLARE_URL_SCANNER_API_TOKEN = originals.cloudflareApiToken;
    }
  };
}

const customer = { id: "customer-id", name: "عميل", role: "user" };
const admin = { id: "admin-id", name: "مدير", role: "admin" };
const catalogServiceId = "507f1f77bcf86cd799439011";
const fees = [
  { currency: "USD", minimumAmount: 1, maximumAmount: 5.99, feeAmount: 0.5 },
  { currency: "USD", minimumAmount: 6, maximumAmount: 100, feeAmount: 1 }
];

test("custom request lifecycle records history and notifies the customer through proof correction and completion", async () => {
  const mocks = mockWalletServices({ feeBands: fees });
  const receiptPath = path.join(os.tmpdir(), `wallet-service-${randomUUID()}.pdf`);
  await fs.writeFile(receiptPath, "%PDF-test");

  try {
    const created = await invoke(routeHandler("post", "/orders"), {
      user: customer,
      app: null,
      body: {
        orderType: "custom",
        serviceName: "خدمة غير متوفرة",
        serviceUrl: "https://example.com/service",
        whatsappNumber: "123456789",
        customerNotes: "ملاحظة"
      }
    });
    assert.equal(created.statusCode, 201);
    assert.equal(created.body.status, "CUSTOM_QUOTE_PENDING");
    assert.equal(created.body.serviceUrlSafety, "cloudflare_unlisted_clean");
    assert.ok(created.body.serviceUrlCheckedAt instanceof Date);
    assert.equal(created.body.statusHistory.length, 1);

    const id = created.body._id;
    const quote = await invoke(routeHandler("post", "/admin/orders/:id/quote"), {
      params: { id }, user: admin, app: null,
      body: { serviceAmount: 5.5, currency: "USD", quoteNote: "السعر النهائي" }
    });
    assert.equal(quote.statusCode, 200);
    assert.equal(quote.body.platformFee, 0.5);
    assert.equal(quote.body.statusHistory.at(-1).status, "QUOTE_OFFERED");

    const accepted = await invoke(routeHandler("post", "/orders/:id/accept-quote"), {
      params: { id }, user: customer
    });
    assert.equal(accepted.body.status, "AWAITING_PAYMENT");

    const sendReceipt = () => invoke(routeHandler("post", "/orders/:id/payment"), {
      params: { id }, user: customer, app: null, file: { path: receiptPath }
    });
    const firstReceipt = await sendReceipt();
    assert.equal(firstReceipt.statusCode, 200);
    assert.equal(firstReceipt.body.status, "PAYMENT_REVIEW");
    const firstReceiptPath = firstReceipt.body.paymentReceipt;

    const correction = await invoke(routeHandler("post", "/admin/orders/:id/request-proof-correction"), {
      params: { id }, user: admin, app: null, body: { reason: "رقم العملية غير واضح" }
    });
    assert.equal(correction.body.status, "PAYMENT_NEEDS_CORRECTION");
    assert.equal(correction.body.paymentCorrectionReason, "رقم العملية غير واضح");

    const correctedReceipt = await sendReceipt();
    assert.equal(correctedReceipt.statusCode, 200);
    assert.equal(correctedReceipt.body.status, "PAYMENT_REVIEW");
    assert.equal(correctedReceipt.body.paymentCorrectionReason, "");
    assert.equal(correctedReceipt.body.previousPaymentReceipts.length, 1);
    assert.equal(correctedReceipt.body.previousPaymentReceipts[0].path, firstReceiptPath);

    const confirmed = await invoke(routeHandler("post", "/admin/orders/:id/confirm-payment"), {
      params: { id }, user: admin, app: null
    });
    assert.equal(confirmed.body.status, "IN_PROGRESS");

    const completed = await invoke(routeHandler("post", "/admin/orders/:id/complete"), {
      params: { id }, user: admin, app: null, body: { completionNote: "تم تنفيذ الخدمة" }
    });
    assert.equal(completed.body.status, "COMPLETED");
    assert.deepEqual(
      completed.body.statusHistory.map((event) => event.status),
      [
        "CUSTOM_QUOTE_PENDING", "QUOTE_OFFERED", "AWAITING_PAYMENT", "PAYMENT_REVIEW",
        "PAYMENT_NEEDS_CORRECTION", "PAYMENT_REVIEW", "IN_PROGRESS", "COMPLETED"
      ]
    );
    assert.equal(completed.body.statusHistory.at(-1).actorRole, "admin");
    assert.equal(completed.body.statusHistory.at(-1).note, "اكتمل الطلب: تم تنفيذ الخدمة");
    assert.equal(mocks.notifications.length, 6);
    assert.ok(mocks.notifications.every((notification) => notification.type === "wallet_service"));
    assert.ok(mocks.notifications.every((notification) => notification.data.walletServiceOrderId === id));
    assert.equal(mocks.adminNotifications.length, 3);

    const rejectedCreation = await invoke(routeHandler("post", "/orders"), {
      user: customer, app: null,
      body: {
        orderType: "custom", serviceName: "خدمة ثانية",
        serviceUrl: "https://example.com/second", whatsappNumber: "123456789"
      }
    });
    const rejected = await invoke(routeHandler("post", "/admin/orders/:id/reject"), {
      params: { id: rejectedCreation.body._id },
      user: admin, app: null, body: { rejectionReason: "الخدمة غير متاحة" }
    });
    assert.equal(rejected.body.status, "REJECTED");
    assert.equal(rejected.body.statusHistory.at(-1).note, "رفضت الإدارة الطلب: الخدمة غير متاحة");
    assert.equal(mocks.notifications.at(-1).title, "تحديث على طلب خدمة سوقك");
  } finally {
    mocks.restore();
    await fs.rm(receiptPath, { force: true });
  }
});

test("custom request idempotency returns the original order and rejects key reuse with different input", async () => {
  const mocks = mockWalletServices({ feeBands: fees });
  const body = {
    orderType: "custom",
    serviceName: "خدمة غير متوفرة",
    serviceUrl: "https://example.com/service",
    whatsappNumber: "123456789",
    customerNotes: "ملاحظة"
  };
  const request = {
    user: customer,
    app: null,
    headers: { "idempotency-key": "custom-order-0001" },
    body
  };
  try {
    const first = await invoke(routeHandler("post", "/orders"), request);
    const retry = await invoke(routeHandler("post", "/orders"), request);
    assert.equal(first.statusCode, 201);
    assert.equal(retry.statusCode, 200);
    assert.equal(retry.body._id, first.body._id);
    assert.equal(mocks.orders.size, 1);
    assert.equal(mocks.adminNotifications.length, 1);

    const conflictingRetry = await invoke(routeHandler("post", "/orders"), {
      ...request,
      body: { ...body, serviceName: "طلب مختلف" }
    });
    assert.equal(conflictingRetry.statusCode, 409);

    const conflictingOrderType = await invoke(routeHandler("post", "/orders"), {
      user: customer,
      headers: request.headers,
      body: {
        orderType: "catalog",
        serviceId: catalogServiceId,
        quantity: 1,
        whatsappNumber: "123456789"
      }
    });
    assert.equal(conflictingOrderType.statusCode, 409);

    const sameKeyFromAnotherUser = await invoke(routeHandler("post", "/orders"), {
      ...request,
      user: { ...customer, id: "another-customer-id" }
    });
    assert.equal(sameKeyFromAnotherUser.statusCode, 201);
    assert.equal(mocks.orders.size, 2);
  } finally {
    mocks.restore();
  }
});

test("concurrent custom requests with one idempotency key create at most one order", async () => {
  const mocks = mockWalletServices();
  const request = {
    user: customer,
    app: null,
    headers: { "idempotency-key": "concurrent-custom-key-01" },
    body: {
      orderType: "custom",
      serviceName: "خدمة مخصصة",
      serviceUrl: "https://example.com/service",
      whatsappNumber: "123456789",
      customerNotes: ""
    }
  };
  try {
    const [first, second] = await Promise.all([
      invoke(routeHandler("post", "/orders"), request),
      invoke(routeHandler("post", "/orders"), request)
    ]);
    assert.deepEqual([first.statusCode, second.statusCode].sort(), [200, 201]);
    assert.equal(first.body._id, second.body._id);
    assert.equal(mocks.orders.size, 1);
  } finally {
    mocks.restore();
  }
});

test("wallet-service receipt route validates before upload and accepts only one file", async () => {
  const mocks = mockWalletServices({ feeBands: fees });
  const route = walletServicesRouter.stack.find(
    (layer) => layer.route?.path === "/orders/:id/payment" && layer.route.methods.post
  );
  assert.ok(route);
  const preUploadValidation = routeMiddleware("post", "/orders/:id/payment", 1);
  const uploadMiddleware = route.route.stack[2].handle;
  const originalFindOne = WalletServiceOrder.findOne;
  WalletServiceOrder.findOne = (query) => {
    const result = [...mocks.orders.values()].find((order) => matches(query, order)) || null;
    return {
      select() { return this; },
      lean: async () => result
    };
  };
  try {
    const missingOrder = await invoke(preUploadValidation, {
      params: { id: "507f1f77bcf86cd799439099" },
      user: customer
    });
    assert.equal(missingOrder.statusCode, 400);
    mocks.orders.set("507f1f77bcf86cd799439097", {
      _id: "507f1f77bcf86cd799439097",
      user: "another-customer-id",
      status: "AWAITING_PAYMENT"
    });
    const anotherUsersOrder = await invoke(preUploadValidation, {
      params: { id: "507f1f77bcf86cd799439097" },
      user: customer
    });
    assert.equal(anotherUsersOrder.statusCode, 400);
    assert.equal(uploadMiddleware.uploadMethod, "single");
    assert.equal(uploadMiddleware.uploadField, "paymentReceipt");
  } finally {
    WalletServiceOrder.findOne = originalFindOne;
    mocks.restore();
  }
});

test("receipt replacement preserves the previous proof and failed persistence removes the unlinked file", async () => {
  const mocks = mockWalletServices({ feeBands: fees });
  const originalOrderFindOne = WalletServiceOrder.findOne;
  const originalOrderUpdate = WalletServiceOrder.findOneAndUpdate;
  const orderId = "507f1f77bcf86cd799439098";
  const order = {
    _id: orderId,
    user: customer.id,
    orderType: "catalog",
    status: "PAYMENT_NEEDS_CORRECTION",
    serviceName: "خدمة",
    paymentReceipt: "receipts/previous.pdf",
    paymentSubmittedAt: new Date(Date.now() - 10_000),
    previousPaymentReceipts: [],
    statusHistory: []
  };
  mocks.orders.set(orderId, order);
  WalletServiceOrder.findOne = (query) => {
    const result = [...mocks.orders.values()].find((item) => matches(query, item)) || null;
    return {
      select() { return this; },
      lean: async () => result
    };
  };
  const receiptPath = path.join(os.tmpdir(), `wallet-service-proof-${randomUUID()}.pdf`);
  await fs.writeFile(receiptPath, "%PDF-test");
  try {
    const submitted = await invoke(routeHandler("post", "/orders/:id/payment"), {
      params: { id: orderId },
      user: customer,
      app: null,
      file: { path: receiptPath }
    });
    assert.equal(submitted.statusCode, 200);
    assert.equal(submitted.body.status, "PAYMENT_REVIEW");
    assert.equal(submitted.body.previousPaymentReceipts[0].path, "receipts/previous.pdf");

    const failedPath = path.join(os.tmpdir(), `wallet-service-orphan-${randomUUID()}.pdf`);
    await fs.writeFile(failedPath, "%PDF-test");
    order.status = "PAYMENT_NEEDS_CORRECTION";
    WalletServiceOrder.findOneAndUpdate = async () => null;
    const failed = await invoke(routeHandler("post", "/orders/:id/payment"), {
      params: { id: orderId },
      user: customer,
      app: null,
      file: { path: failedPath }
    });
    assert.equal(failed.statusCode, 409);
    await assert.rejects(fs.access(failedPath));
  } finally {
    WalletServiceOrder.findOne = originalOrderFindOne;
    WalletServiceOrder.findOneAndUpdate = originalOrderUpdate;
    await fs.rm(receiptPath, { force: true });
    mocks.restore();
  }
});

test("catalog order computes fee from the matching cent-contiguous band and validates quantity", async () => {
  const service = {
    _id: catalogServiceId,
    name: "شحن رصيد",
    currency: "USD",
    unitLabel: "وحدة",
    unitPrice: 2,
    minimumQuantityEnabled: false,
    minimumQuantity: 1,
    maximumQuantityEnabled: false,
    maximumQuantity: 50000,
    sections: { length: 0 }
  };
  const mocks = mockWalletServices({ feeBands: fees, service });
  try {
    const invalidQuantity = await invoke(routeHandler("post", "/orders"), {
      user: customer,
      body: {
        orderType: "catalog", serviceId: catalogServiceId, quantity: 0,
        whatsappNumber: "123456789"
      }
    });
    assert.equal(invalidQuantity.statusCode, 400);
    assert.equal(mocks.orders.size, 0);

    const created = await invoke(routeHandler("post", "/orders"), {
      user: customer,
      body: {
        orderType: "catalog", serviceId: catalogServiceId, quantity: 3,
        whatsappNumber: "123456789"
      }
    });
    assert.equal(created.statusCode, 201);
    assert.equal(created.body.serviceAmount, 6);
    assert.equal(created.body.platformFee, 1);
    assert.equal(created.body.totalAmount, 7);
    assert.deepEqual(created.body.statusHistory.map((event) => event.status), ["AWAITING_PAYMENT"]);
  } finally {
    mocks.restore();
  }
});

test("catalog orders require a stable idempotency key", async () => {
  const mocks = mockWalletServices({ feeBands: fees });
  try {
    const result = await invoke(routeHandler("post", "/orders"), {
      user: customer,
      body: {
        orderType: "catalog",
        serviceId: catalogServiceId,
        quantity: 1,
        whatsappNumber: "123456789"
      }
    }, { autoIdempotency: false });
    assert.equal(result.statusCode, 400);
    assert.match(result.body.error, /مفتاح منع تكرار الطلب مطلوب/);
    assert.equal(mocks.orders.size, 0);
  } finally {
    mocks.restore();
  }
});

test("catalog idempotency returns retries, rejects changed payloads, and is user-scoped", async () => {
  const service = {
    _id: catalogServiceId,
    name: "شحن رصيد",
    currency: "USD",
    unitLabel: "وحدة",
    unitPrice: 2,
    minimumQuantityEnabled: false,
    maximumQuantityEnabled: false,
    sections: []
  };
  const mocks = mockWalletServices({ feeBands: fees, service });
  const handler = routeHandler("post", "/orders");
  const headers = { "idempotency-key": "catalog-retry-key-01" };
  const body = {
    orderType: "catalog",
    serviceId: catalogServiceId,
    quantity: 3,
    whatsappNumber: "123456789"
  };
  try {
    const first = await invoke(handler, { user: customer, body, headers });
    const retry = await invoke(handler, { user: customer, body, headers });
    const conflict = await invoke(handler, {
      user: customer,
      body: { ...body, quantity: 4 },
      headers
    });
    const otherUser = await invoke(handler, {
      user: { ...customer, id: "another-customer-id" },
      body,
      headers
    });

    assert.equal(first.statusCode, 201);
    assert.equal(retry.statusCode, 200);
    assert.equal(retry.body._id, first.body._id);
    assert.equal(conflict.statusCode, 409);
    assert.equal(otherUser.statusCode, 201);
    assert.equal(mocks.orders.size, 2);
  } finally {
    mocks.restore();
  }
});

test("concurrent catalog requests with one key cannot create duplicates", async () => {
  const service = {
    _id: catalogServiceId,
    name: "شحن رصيد",
    currency: "USD",
    unitLabel: "وحدة",
    unitPrice: 2,
    minimumQuantityEnabled: false,
    maximumQuantityEnabled: false,
    sections: []
  };
  const mocks = mockWalletServices({ feeBands: fees, service });
  const request = {
    user: customer,
    headers: { "idempotency-key": "catalog-concurrent-key-01" },
    body: {
      orderType: "catalog",
      serviceId: catalogServiceId,
      quantity: 2,
      whatsappNumber: "123456789"
    }
  };
  try {
    const [first, second] = await Promise.all([
      invoke(routeHandler("post", "/orders"), request),
      invoke(routeHandler("post", "/orders"), request)
    ]);
    assert.ok([200, 201].includes(first.statusCode));
    assert.ok([200, 201].includes(second.statusCode));
    assert.equal(first.body._id, second.body._id);
    assert.equal(mocks.orders.size, 1);
  } finally {
    mocks.restore();
  }
});

test("catalog orders reject historical pricing without a matching trusted draft", async () => {
  const currentService = {
    _id: catalogServiceId,
    name: "السعر الحالي",
    serviceVersion: 2,
    formSchemaVersion: 1,
    currency: "USD",
    unitLabel: "وحدة",
    unitPrice: 8,
    minimumQuantityEnabled: false,
    maximumQuantityEnabled: false,
    sections: [],
    versionHistory: [{
      version: 1,
      createdAt: new Date(Date.now() - 10_000),
      snapshot: {
        name: "السعر القديم",
        serviceVersion: 1,
        formSchemaVersion: 1,
        pricingType: "UNIT",
        currency: "USD",
        unitLabel: "وحدة",
        unitPrice: 1,
        minimumQuantityEnabled: false,
        maximumQuantityEnabled: false,
        sections: [],
        formSchema: []
      }
    }]
  };
  const mocks = mockWalletServices({ feeBands: fees, service: currentService });
  try {
    const result = await invoke(routeHandler("post", "/orders"), {
      user: customer,
      headers: { "idempotency-key": "historical-price-key-01" },
      body: {
        orderType: "catalog",
        serviceId: catalogServiceId,
        serviceVersion: 1,
        quantity: 1,
        whatsappNumber: "123456789"
      }
    });
    assert.equal(result.statusCode, 409);
    assert.equal(mocks.orders.size, 0);
  } finally {
    mocks.restore();
  }
});

test("catalog orders accept a historical price only through the user's version-pinned draft", async () => {
  const serviceCreatedAt = new Date(Date.now() - 60_000);
  const versionChangedAt = new Date(Date.now() - 10_000);
  const draftCreatedAt = new Date(Date.now() - 20_000);
  const oldConfig = {
    name: "السعر القديم",
    serviceVersion: 1,
    formSchemaVersion: 1,
    pricingType: "UNIT",
    currency: "USD",
    unitLabel: "وحدة",
    unitPrice: 2,
    minimumQuantityEnabled: false,
    maximumQuantityEnabled: false,
    sections: [],
    formSchema: []
  };
  const service = {
    _id: catalogServiceId,
    name: "السعر الحالي",
    serviceVersion: 2,
    formSchemaVersion: 1,
    currency: "USD",
    unitLabel: "وحدة",
    unitPrice: 8,
    minimumQuantityEnabled: false,
    maximumQuantityEnabled: false,
    sections: [],
    createdAt: serviceCreatedAt,
    versionHistory: [{ version: 1, createdAt: versionChangedAt, snapshot: oldConfig }]
  };
  const mocks = mockWalletServices({ feeBands: fees, service });
  const originalDraftFindOne = DraftAction.findOne;
  const originalDraftUpdateOne = DraftAction.updateOne;
  const draftId = "507f1f77bcf86cd799439013";
  const draft = {
    _id: draftId,
    userId: customer.id,
    type: "wallet_service_catalog",
    status: "incomplete",
    createdAt: draftCreatedAt,
    expiresAt: new Date(Date.now() + 60_000),
    serviceId: catalogServiceId,
    sectionId: null,
    data: {
      quantity: 2,
      whatsappNumber: "123456789",
      serviceVersion: 1,
      formSchemaVersion: 1
    }
  };
  DraftAction.findOne = (query) => {
    const result = query._id === draft._id
      && String(query.userId) === String(draft.userId)
      && draft.status === "incomplete"
      && draft.expiresAt > query.expiresAt.$gt
      ? draft
      : null;
    const promise = Promise.resolve(result);
    promise.lean = async () => result;
    return promise;
  };
  DraftAction.updateOne = async (query, update) => {
    if (query._id !== draft._id || String(query.userId) !== String(draft.userId)) {
      return { matchedCount: 0 };
    }
    Object.assign(draft, update.$set);
    return { matchedCount: 1 };
  };

  const handler = routeHandler("post", "/orders");
  const request = {
    orderType: "catalog",
    serviceId: catalogServiceId,
    serviceVersion: 1,
    formSchemaVersion: 1,
    quantity: 2,
    whatsappNumber: "123456789",
    draftActionId: draftId
  };
  try {
    const mismatchedVersion = await invoke(handler, {
      user: customer,
      headers: { "idempotency-key": "historical-draft-wrong-01" },
      body: { ...request, serviceVersion: 2 }
    });
    assert.equal(mismatchedVersion.statusCode, 409);

    const created = await invoke(handler, {
      user: customer,
      headers: { "idempotency-key": "historical-draft-valid-01" },
      body: request
    });
    assert.equal(created.statusCode, 201);
    assert.equal(created.body.serviceVersion, 1);
    assert.equal(created.body.serviceAmount, 4);
    assert.equal(created.body.totalAmount, 4.5);
    assert.equal(created.body.pricingSnapshot.serviceVersion, 1);
    assert.equal(draft.status, "completed");
    assert.equal(mocks.orders.size, 1);
  } finally {
    DraftAction.findOne = originalDraftFindOne;
    DraftAction.updateOne = originalDraftUpdateOne;
    mocks.restore();
  }
});

test("catalog order creation rejects service changes detected before reservation", async () => {
  const service = {
    _id: catalogServiceId,
    name: "خدمة",
    currency: "USD",
    unitLabel: "وحدة",
    unitPrice: 2,
    minimumQuantityEnabled: false,
    maximumQuantityEnabled: false,
    sections: []
  };
  const mocks = mockWalletServices({
    feeBands: fees,
    service,
    beforeServiceReservation(current) {
      current.serviceVersion += 1;
      current.orderCreationRevision += 1;
      current.unitPrice = 20;
    }
  });
  try {
    const result = await invoke(routeHandler("post", "/orders"), {
      user: customer,
      headers: { "idempotency-key": "service-change-key-01" },
      body: {
        orderType: "catalog",
        serviceId: catalogServiceId,
        quantity: 2,
        whatsappNumber: "123456789"
      }
    });
    assert.equal(result.statusCode, 409);
    assert.equal(mocks.orders.size, 0);
  } finally {
    mocks.restore();
  }
});

test("package catalog orders price from the service snapshot and reject client-supplied totals", async () => {
  const service = {
    _id: catalogServiceId,
    name: "اشتراك برنامج",
    serviceType: "SOFTWARE",
    serviceVersion: 4,
    formSchemaVersion: 2,
    formSchema: [{
      id: "email",
      label: "البريد",
      type: "EMAIL",
      required: true
    }],
    categoryId: null,
    pricingType: "PACKAGE",
    packages: [{
      id: "monthly",
      name: "شهري",
      price: 6,
      currency: "USD",
      isActive: true
    }],
    currency: "USD",
    minimumQuantityEnabled: true,
    minimumQuantity: 1,
    maximumQuantityEnabled: true,
    maximumQuantity: 50000,
    sections: []
  };
  const mocks = mockWalletServices({ feeBands: fees, service });
  try {
    const forgedTotal = await invoke(routeHandler("post", "/orders"), {
      user: customer,
      body: {
        orderType: "catalog",
        serviceId: service._id,
        packageId: "monthly",
        quantity: 1,
        answers: { email: "buyer@example.test" },
        whatsappNumber: "123456789",
        totalAmount: 0
      }
    });
    assert.equal(forgedTotal.statusCode, 400);
    assert.equal(mocks.orders.size, 0);

    const created = await invoke(routeHandler("post", "/orders"), {
      user: customer,
      body: {
        orderType: "catalog",
        serviceId: service._id,
        packageId: "monthly",
        serviceVersion: 4,
        formSchemaVersion: 2,
        quantity: 1,
        answers: { email: "buyer@example.test" },
        whatsappNumber: "123456789"
      }
    });
    assert.equal(created.statusCode, 201);
    assert.equal(created.body.packageName, "شهري");
    assert.equal(created.body.serviceAmount, 6);
    assert.equal(created.body.buyerServiceFee, 1);
    assert.equal(created.body.totalAmount, 7);
    assert.equal(created.body.serviceVersion, 4);
    assert.deepEqual(created.body.answers, { email: "buyer@example.test" });
    assert.equal(created.body.pricingSnapshot.formSchemaVersion, 2);
  } finally {
    mocks.restore();
  }
});

test("subscription catalog orders require affirmative account ownership consent", async () => {
  const service = {
    _id: catalogServiceId,
    name: "اشتراك ترفيهي",
    serviceType: "ENTERTAINMENT",
    serviceVersion: 1,
    formSchemaVersion: 1,
    formSchema: [
      { id: "accountEmail", label: "البريد الإلكتروني", type: "EMAIL", required: true },
      { id: "accountOwnershipConsent", label: "تعهد ملكية الحساب", type: "BOOLEAN", required: true }
    ],
    categoryId: null,
    pricingType: "PACKAGE",
    packages: [{ id: "monthly", name: "شهري", price: 10, currency: "USD", isActive: true }],
    currency: "USD",
    sections: []
  };
  const mocks = mockWalletServices({ feeBands: fees, service });
  try {
    const declined = await invoke(routeHandler("post", "/orders"), {
      user: customer,
      body: {
        orderType: "catalog",
        serviceId: service._id,
        packageId: "monthly",
        quantity: 1,
        answers: { accountEmail: "buyer@example.test", accountOwnershipConsent: false },
        whatsappNumber: "123456789"
      }
    });
    assert.equal(declined.statusCode, 400);
    assert.equal(mocks.orders.size, 0);

    const accepted = await invoke(routeHandler("post", "/orders"), {
      user: customer,
      body: {
        orderType: "catalog",
        serviceId: service._id,
        packageId: "monthly",
        quantity: 1,
        answers: { accountEmail: "buyer@example.test", accountOwnershipConsent: true },
        whatsappNumber: "123456789"
      }
    });
    assert.equal(accepted.statusCode, 201);
    assert.deepEqual(accepted.body.answers, {
      accountEmail: "buyer@example.test",
      accountOwnershipConsent: true
    });
    assert.equal(accepted.body.whatsappNumber, "123456789");
  } finally {
    mocks.restore();
  }
});

test("fixed-price orders charge the configured amount once", async () => {
  const service = {
    _id: catalogServiceId,
    name: "خدمة ثابتة",
    serviceType: "OTHER",
    serviceVersion: 1,
    formSchemaVersion: 1,
    formSchema: [],
    categoryId: null,
    pricingType: "FIXED",
    currency: "USD",
    unitPrice: 4.5,
    minimumQuantityEnabled: true,
    minimumQuantity: 10,
    maximumQuantityEnabled: true,
    maximumQuantity: 20,
    sections: []
  };
  const mocks = mockWalletServices({ feeBands: fees, service });
  try {
    const created = await invoke(routeHandler("post", "/orders"), {
      user: customer,
      body: {
        orderType: "catalog",
        serviceId: catalogServiceId,
        quantity: 1,
        whatsappNumber: "123456789"
      }
    });
    assert.equal(created.statusCode, 201);
    assert.equal(created.body.quantity, 1);
    assert.equal(created.body.serviceAmount, 4.5);
    assert.equal(created.body.platformFee, 0.5);
    assert.equal(created.body.totalAmount, 5);
  } finally {
    mocks.restore();
  }
});

test("legacy fee settings are normalized in memory during catalog GET without writing", async () => {
  const legacyBands = [
    { currency: "USD", minimumAmount: 1, maximumAmount: 5, feeAmount: 0.5 },
    { currency: "USD", minimumAmount: 6, maximumAmount: 10, feeAmount: 1 }
  ];
  const mocks = mockWalletServices({ feeBands: legacyBands, feeBandVersion: 1 });
  try {
    const result = await invoke(routeHandler("get", "/"), { headers: {} });
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.feeBands[0].maximumAmount, 5.99);
    assert.equal(mocks.feeWrites, 0);
    assert.equal(legacyBands[0].maximumAmount, 5);
  } finally {
    mocks.restore();
  }
});

test("partial service image updates retain legacy sections and append a configuration version", async () => {
  const originalFindById = WalletService.findById;
  const existing = {
    _id: catalogServiceId,
    name: "خدمة قديمة",
    description: "",
    image: "",
    categoryId: null,
    serviceType: "OTHER",
    pricingType: "UNIT",
    formSchema: [],
    formSchemaVersion: 1,
    serviceVersion: 1,
    versionHistory: [],
    packages: [],
    currency: "USD",
    unitLabel: "وحدة",
    minimumQuantityEnabled: true,
    maximumQuantityEnabled: true,
    minimumQuantity: 1,
    maximumQuantity: 20,
    customerInfoLabel: "",
    sections: [{ _id: "section-id", name: "قسم", unitPrice: 3 }],
    isActive: true,
    isArchived: false,
    sortOrder: 0,
    toObject() {
      const { toObject, save, ...source } = this;
      return source;
    },
    async save() { return this; }
  };
  WalletService.findById = async () => existing;
  try {
    const result = await invoke(routeHandler("patch", "/admin/services/:id"), {
      params: { id: existing._id },
      user: admin,
      body: {},
      file: { filename: "updated.png" }
    });
    assert.equal(result.statusCode, 200);
    assert.equal(existing.sections.length, 1);
    assert.equal(existing.sections[0].name, "قسم");
    assert.equal(existing.image, "/uploads/logos/updated.png");
    assert.equal(existing.serviceVersion, 2);
    assert.equal(existing.versionHistory.length, 1);
    assert.equal(existing.versionHistory[0].snapshot.sections[0].name, "قسم");
  } finally {
    WalletService.findById = originalFindById;
  }
});

test("catalog draft submissions are idempotent and scoped to their owner", async () => {
  const service = {
    _id: catalogServiceId,
    name: "شحن رصيد",
    currency: "USD",
    unitLabel: "وحدة",
    unitPrice: 2,
    minimumQuantityEnabled: false,
    minimumQuantity: 1,
    maximumQuantityEnabled: false,
    maximumQuantity: 50000,
    sections: { length: 0 }
  };
  const mocks = mockWalletServices({ feeBands: fees, service });
  const originalFindOne = WalletServiceOrder.findOne;
  const originalDraftFindOne = DraftAction.findOne;
  const originalDraftUpdateOne = DraftAction.updateOne;
  const draftId = "507f1f77bcf86cd799439012";
  const draft = {
    _id: draftId,
    userId: customer.id,
    type: "wallet_service_catalog",
    status: "incomplete",
    currentStep: 2,
    createdAt: new Date(Date.now() - 10_000),
    serviceId: service._id,
    sectionId: null,
    data: { quantity: 3, whatsappNumber: "123456789" }
  };
  let completionAttempts = 0;
  WalletServiceOrder.findOne = (query) => ({
    lean: async () => [...mocks.orders.values()].find((order) =>
      order.draftActionId === query.draftActionId && order.user === query.user
    ) || null
  });
  DraftAction.findOne = (query) => {
    const result = query.userId === draft.userId && query._id === draft._id && draft.status === "incomplete"
      ? draft
      : null;
    const promise = Promise.resolve(result);
    promise.lean = async () => result;
    return promise;
  };
  DraftAction.updateOne = async (query, update) => {
    if (query._id !== draft._id || query.userId !== draft.userId) return { matchedCount: 0 };
    completionAttempts += 1;
    if (completionAttempts === 1) throw new Error("simulated completion write failure");
    Object.assign(draft, update.$set);
    return { matchedCount: 1 };
  };

  const body = {
    orderType: "catalog",
    serviceId: service._id,
    quantity: 3,
    whatsappNumber: "123456789",
    draftActionId: draft._id
  };
  const headers = { "idempotency-key": "catalog-draft-key-0001" };
  try {
    const first = await invoke(routeHandler("post", "/orders"), { user: customer, body, headers });
    assert.equal(first.statusCode, 500);
    assert.equal(mocks.orders.size, 1);
    const createdOrder = [...mocks.orders.values()][0];
    assert.equal(createdOrder.draftActionId, draft._id);

    const retry = await invoke(routeHandler("post", "/orders"), { user: customer, body, headers });
    assert.equal(retry.statusCode, 200);
    assert.equal(retry.body._id, createdOrder._id);
    assert.equal(mocks.orders.size, 1);
    assert.equal(draft.status, "completed");

    const reusedDraft = await invoke(routeHandler("post", "/orders"), {
      user: customer,
      headers: { "idempotency-key": "catalog-draft-key-0002" },
      body
    });
    assert.equal(reusedDraft.statusCode, 200);
    assert.equal(reusedDraft.body._id, createdOrder._id);
    const changedDraftPayload = await invoke(routeHandler("post", "/orders"), {
      user: customer,
      headers: { "idempotency-key": "catalog-draft-key-0003" },
      body: { ...body, quantity: 4 }
    });
    assert.equal(changedDraftPayload.statusCode, 409);
    assert.equal(mocks.orders.size, 1);

    const otherUser = await invoke(routeHandler("post", "/orders"), {
      user: { ...customer, id: "another-customer-id" },
      body,
      headers
    });
    assert.equal(otherUser.statusCode, 404);
    assert.equal(mocks.orders.size, 1);
  } finally {
    WalletServiceOrder.findOne = originalFindOne;
    DraftAction.findOne = originalDraftFindOne;
    DraftAction.updateOne = originalDraftUpdateOne;
    mocks.restore();
  }
});

test("custom requests reject malformed contact and unsupported URL schemes", async () => {
  const mocks = mockWalletServices();
  try {
    const invalidContact = await invoke(routeHandler("post", "/orders"), {
      user: customer,
      body: { orderType: "custom", serviceName: "خدمة", serviceUrl: "https://example.com", whatsappNumber: "123" }
    });
    assert.equal(invalidContact.statusCode, 400);

    const invalidUrl = await invoke(routeHandler("post", "/orders"), {
      user: customer,
      body: { orderType: "custom", serviceName: "خدمة", serviceUrl: "javascript:alert(1)", whatsappNumber: "123456789" }
    });
    assert.equal(invalidUrl.statusCode, 400);
    const credentialUrl = await invoke(routeHandler("post", "/orders"), {
      user: customer,
      body: {
        orderType: "custom",
        serviceName: "خدمة",
        serviceUrl: "https://user:password@example.com",
        whatsappNumber: "123456789"
      }
    });
    assert.equal(credentialUrl.statusCode, 400);
    assert.match(credentialUrl.body.error, /اسم مستخدم أو كلمة مرور/);
    assert.equal(mocks.orders.size, 0);
  } finally {
    mocks.restore();
  }
});

test("custom request blocks Cloudflare scan threats before saving an order", async () => {
  const mocks = mockWalletServices();
  let submittedBody;
  let submittedAuthorization;
  globalThis.fetch = async (requestUrl, options) => {
    const request = new URL(requestUrl);
    if (options.method === "POST") {
      submittedBody = JSON.parse(options.body);
      submittedAuthorization = options.headers.Authorization;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          uuid: "12345678-1234-1234-1234-123456789abc",
          visibility: "unlisted",
          result: "https://radar.cloudflare.com/scan/12345678-1234-1234-1234-123456789abc"
        })
      };
    }
    assert.equal(request.pathname, "/client/v4/accounts/1234567890abcdef1234567890abcdef/urlscanner/v2/result/12345678-1234-1234-1234-123456789abc");
    return {
      ok: true,
      status: 200,
      json: async () => ({
        task: { status: "Finished", success: true },
        verdicts: { overall: { malicious: true, categories: [{ name: "malware" }] } }
      })
    };
  };

  try {
    const result = await invoke(routeHandler("post", "/orders"), {
      user: customer,
      app: null,
      body: {
        orderType: "custom",
        serviceName: "رابط ضار",
        serviceUrl: "https://malware.example.test",
        whatsappNumber: "123456789"
      }
    });
    assert.equal(result.statusCode, 400);
    assert.match(result.body.error, /Cloudflare/);
    assert.deepEqual(submittedBody, { url: "https://malware.example.test/", visibility: "Unlisted" });
    assert.match(submittedAuthorization, /^Bearer /);
    assert.equal(mocks.orders.size, 0);
    assert.equal(mocks.adminNotifications.length, 0);
  } finally {
    mocks.restore();
  }
});

test("custom request fails closed if Cloudflare scanner is not configured or rejects requests", async () => {
  const mocks = mockWalletServices();
  try {
    delete process.env.CLOUDFLARE_URL_SCANNER_API_TOKEN;
    const notConfigured = await invoke(routeHandler("post", "/orders"), {
      user: customer,
      body: {
        orderType: "custom",
        serviceName: "خدمة",
        serviceUrl: "https://example.com",
        whatsappNumber: "123456789"
      }
    });
    assert.equal(notConfigured.statusCode, 503);
    assert.equal(mocks.orders.size, 0);

    process.env.CLOUDFLARE_URL_SCANNER_API_TOKEN = "test-cloudflare-api-token";
    globalThis.fetch = async () => ({ ok: false, status: 503 });
    const providerFailure = await invoke(routeHandler("post", "/orders"), {
      user: customer,
      body: {
        orderType: "custom",
        serviceName: "خدمة",
        serviceUrl: "https://example.com",
        whatsappNumber: "123456789"
      }
    });
    assert.equal(providerFailure.statusCode, 503);
    assert.equal(mocks.orders.size, 0);
  } finally {
    mocks.restore();
  }
});

test("public catalog reads and normalizes legacy fee bands without persisting an upgrade", async () => {
  const originals = {
    serviceFind: WalletService.find,
    categoryFind: DigitalServiceCategory.find,
    feeFindOne: WalletServiceFeeSettings.findOne,
    feeUpdateOne: WalletServiceFeeSettings.updateOne
  };
  let feeWrites = 0;
  const legacyBands = [
    { currency: "USD", minimumAmount: 1, maximumAmount: 5, feeAmount: 0.5 },
    { currency: "USD", minimumAmount: 6, maximumAmount: 10, feeAmount: 1 }
  ];
  WalletService.find = () => ({
    sort() { return this; },
    lean: async () => []
  });
  DigitalServiceCategory.find = () => ({
    select() { return this; },
    lean: async () => []
  });
  WalletServiceFeeSettings.findOne = () => ({
    lean: async () => ({
      _id: "legacy-settings",
      feeBands: legacyBands
    })
  });
  WalletServiceFeeSettings.updateOne = async () => {
    feeWrites += 1;
    return { modifiedCount: 1 };
  };

  try {
    const result = await invoke(routeHandler("get", "/"), {});
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.feeBands[0].maximumAmount, 5.99);
    assert.equal(feeWrites, 0);
    assert.equal(legacyBands[0].maximumAmount, 5);
  } finally {
    WalletService.find = originals.serviceFind;
    DigitalServiceCategory.find = originals.categoryFind;
    WalletServiceFeeSettings.findOne = originals.feeFindOne;
    WalletServiceFeeSettings.updateOne = originals.feeUpdateOne;
  }
});

test("catalog order submissions linked to drafts pause before any order or draft write", async () => {
  const mocks = mockWalletServices({ feeBands: [] });
  const previousPause = process.env.DRAFT_ACTIONS_WRITES_PAUSED;
  process.env.DRAFT_ACTIONS_WRITES_PAUSED = "YES";
  try {
    const response = await invoke(routeHandler("post", "/orders"), {
      user: customer,
      body: {
        orderType: "catalog",
        draftActionId: "507f1f77bcf86cd799439011"
      }
    });

    assert.equal(response.statusCode, 503);
    assert.equal(mocks.orders.size, 0);
  } finally {
    if (previousPause === undefined) delete process.env.DRAFT_ACTIONS_WRITES_PAUSED;
    else process.env.DRAFT_ACTIONS_WRITES_PAUSED = previousPause;
    mocks.restore();
  }
});
