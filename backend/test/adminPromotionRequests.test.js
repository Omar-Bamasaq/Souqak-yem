import test from "node:test";
import assert from "node:assert/strict";
import adminRouter from "../src/routes/admin.js";
import Plan from "../src/models/Plan.js";
import PurchaseRequest from "../src/models/PurchaseRequest.js";
import User from "../src/models/User.js";
import Ad from "../src/models/Ad.js";

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
