import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import adminRouter from "../src/routes/admin.js";
import Plan from "../src/models/Plan.js";
import PurchaseRequest from "../src/models/PurchaseRequest.js";
import User from "../src/models/User.js";
import Ad from "../src/models/Ad.js";
import PasswordResetRequest from "../src/models/PasswordResetRequest.js";

const route = adminRouter.stack.find((entry) => entry.route?.path === "/purchase-requests" && entry.route.methods.get);
const handler = route.route.stack.at(-1).handle;

test("admin promotion requests accept service, status, and date filters and return snapshot data", async () => {
  const originals = {
    planFind: Plan.find,
    requestFind: PurchaseRequest.find
  };
  let query;
  Plan.find = () => ({ distinct: async () => ["featured-plan"] });
  PurchaseRequest.find = (filter) => {
    query = filter;
    return {
      populate() { return this; },
      sort() { return this; },
      lean: async () => [{
        _id: "request-id",
        status: "Pending",
        createdAt: new Date("2026-01-15T12:00:00Z"),
        price: 3000,
        planSnapshot: {
          type: "featured",
          name: "مساحة رئيسية",
          adServiceType: "placement",
          durationInDays: 2
        },
        plan: null,
        user: { name: "مستخدم" },
        product: { title: "إعلان" }
      }]
    };
  };
  const result = { statusCode: 200, body: null };
  const res = { status(code) { result.statusCode = code; return this; }, json(body) { result.body = body; return this; } };

  try {
    await handler({ query: { serviceType: "placement", status: "Pending", from: "2026-01-01", to: "2026-01-31" } }, res);
    assert.equal(result.statusCode, 200);
    assert.equal(result.body[0].planSnapshot.name, "مساحة رئيسية");
    assert.equal(result.body[0].price, 3000);
    assert.equal(query.status, "Pending");
    assert.ok(query.createdAt.$gte instanceof Date);
    assert.ok(query.createdAt.$lte instanceof Date);
    assert.ok(query.$and.some((item) => item.$or?.some((filter) => filter["planSnapshot.adServiceType"] === "placement")));
  } finally {
    Plan.find = originals.planFind;
    PurchaseRequest.find = originals.requestFind;
  }
});

test("admin promotion request filtering rejects unknown service types", async () => {
  const result = { statusCode: 200, body: null };
  const res = { status(code) { result.statusCode = code; return this; }, json(body) { result.body = body; return this; } };
  await handler({ query: { serviceType: "unknown" } }, res);
  assert.equal(result.statusCode, 400);
});

test("search input is escaped before it is used in promotion-request filters", async () => {
  const originals = {
    planFind: Plan.find,
    requestFind: PurchaseRequest.find,
    userFind: User.find,
    adFind: Ad.find
  };
  let query;
  Plan.find = () => ({ distinct: async () => [] });
  User.find = () => ({ distinct: async () => [] });
  Ad.find = () => ({ distinct: async () => [] });
  PurchaseRequest.find = (filter) => {
    query = filter;
    return { populate() { return this; }, sort() { return this; }, lean: async () => [] };
  };
  const res = { status() { return this; }, json() { return this; } };

  try {
    await handler({ query: { q: ".*" } }, res);
    const searchFilter = query.$and.find((item) => item.$or?.some((field) => field["planSnapshot.name"]));
    const searchRegex = searchFilter.$or.find((field) => field["planSnapshot.name"])["planSnapshot.name"];
    assert.equal(searchRegex.test("anything"), false);
    assert.equal(searchRegex.test(".*"), true);
  } finally {
    Plan.find = originals.planFind;
    PurchaseRequest.find = originals.requestFind;
    User.find = originals.userFind;
    Ad.find = originals.adFind;
  }
});

test("admin password reset disconnects the user's sockets after saving the password", async () => {
  const resetRoute = adminRouter.stack.find(
    (entry) => entry.route?.path === "/password-reset-requests/:id/status"
      && entry.route.methods.patch
  );
  assert.ok(resetRoute, "password reset review route exists");
  const handler = resetRoute.route.stack.at(-1).handle;
  const originals = {
    findRequest: PasswordResetRequest.findById,
    findUser: User.findOne,
    findUserById: User.findById,
    bcryptHash: bcrypt.hash
  };
  const events = [];
  const user = {
    _id: "64d3d93a1a2b3c4d5e6f7788",
    name: "Test User",
    phone: "777123456",
    role: "user",
    save: async () => { events.push("password-saved"); }
  };
  const request = {
    username: user.name,
    phone: user.phone,
    save: async () => {}
  };
  PasswordResetRequest.findById = async () => request;
  User.findOne = async () => user;
  User.findById = () => ({
    select() {
      return {
        lean: async () => ({
          notificationPrefs: { new_user: { inApp: false, push: false } }
        })
      };
    }
  });

  bcrypt.hash = async () => "temporary-password-hash";
  const responseResult = { statusCode: 200, body: null };
  const response = {
    status(statusCode) { responseResult.statusCode = statusCode; return this; },
    json(body) { responseResult.body = body; return this; }
  };
  const io = {
    in(room) {
      return {
        disconnectSockets(force) {
          events.push({ room, force });
        }
      };
    }
  };

  try {
    await handler(
      {
        params: { id: "reset-request" },
        body: { status: "approved" },
        user: { id: "admin-id" },
        app: { get: () => io }
      },
      response
    );

    assert.equal(responseResult.statusCode, 200);
    assert.deepEqual(events, [
      "password-saved",
      { room: `user:${user._id}`, force: true }
    ]);
  } finally {
    PasswordResetRequest.findById = originals.findRequest;
    User.findOne = originals.findUser;
    User.findById = originals.findUserById;
    bcrypt.hash = originals.bcryptHash;
  }
});

test("admin password reset disconnects sockets when post-save revocation fails", async () => {
  const resetRoute = adminRouter.stack.find(
    (entry) => entry.route?.path === "/password-reset-requests/:id/status"
      && entry.route.methods.patch
  );
  const handler = resetRoute.route.stack.at(-1).handle;
  const originals = {
    findRequest: PasswordResetRequest.findById,
    findUser: User.findOne,
    bcryptHash: bcrypt.hash
  };
  const events = [];
  const user = {
    _id: "64d3d93a1a2b3c4d5e6f7788",
    name: "Test User",
    phone: "777123456",
    role: "user",
    save: async () => {
      events.push("password-persisted");
      throw new Error("simulated post-save revocation failure");
    }
  };
  PasswordResetRequest.findById = async () => ({
    username: user.name,
    phone: user.phone,
    save: async () => {}
  });
  User.findOne = async () => user;
  bcrypt.hash = async () => "temporary-password-hash";
  const responseResult = { statusCode: 200, body: null };
  const response = {
    status(statusCode) { responseResult.statusCode = statusCode; return this; },
    json(body) { responseResult.body = body; return this; }
  };
  const io = {
    in(room) {
      return {
        disconnectSockets(force) {
          events.push({ room, force });
        }
      };
    }
  };

  try {
    await handler(
      {
        params: { id: "reset-request" },
        body: { status: "approved" },
        user: { id: "admin-id" },
        app: { get: () => io }
      },
      response
    );

    assert.equal(responseResult.statusCode, 500);
    assert.deepEqual(events, [
      "password-persisted",
      { room: `user:${user._id}`, force: true }
    ]);
  } finally {
    PasswordResetRequest.findById = originals.findRequest;
    User.findOne = originals.findUser;
    bcrypt.hash = originals.bcryptHash;
  }
});
