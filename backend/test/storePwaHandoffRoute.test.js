import test, { after } from "node:test";
import assert from "node:assert/strict";

const originalEnv = {
  access: process.env.JWT_ACCESS_SECRET,
  refresh: process.env.JWT_REFRESH_SECRET,
  storeOrigin: process.env.STORE_PWA_ORIGIN
};
process.env.JWT_ACCESS_SECRET = "test-access-secret-for-store-pwa-handoff";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-for-store-pwa-handoff";
process.env.STORE_PWA_ORIGIN = "https://apps.souqak-yem.com";

const [
  { default: authRouter },
  { default: AuthSession },
  { default: StorePwaHandoff },
  { default: StoreProfile },
  { default: StoreSubscription },
  { default: User }
] = await Promise.all([
  import("../src/routes/auth.js"),
  import("../src/models/AuthSession.js"),
  import("../src/models/StorePwaHandoff.js"),
  import("../src/models/StoreProfile.js"),
  import("../src/models/StoreSubscription.js"),
  import("../src/models/User.js")
]);

after(() => {
  if (originalEnv.access === undefined) delete process.env.JWT_ACCESS_SECRET;
  else process.env.JWT_ACCESS_SECRET = originalEnv.access;
  if (originalEnv.refresh === undefined) delete process.env.JWT_REFRESH_SECRET;
  else process.env.JWT_REFRESH_SECRET = originalEnv.refresh;
  if (originalEnv.storeOrigin === undefined) delete process.env.STORE_PWA_ORIGIN;
  else process.env.STORE_PWA_ORIGIN = originalEnv.storeOrigin;
});

test("a successful handoff does not revoke the existing store session", async () => {
  const storeId = "64d3d93a1a2b3c4d5e6f7788";
  const userId = "64d3d93a1a2b3c4d5e6f7789";
  const sourceSessionId = "main-source-session";
  const user = { _id: userId, role: "user", authVersion: 0 };
  const store = { _id: storeId, status: "active", storeType: "store" };
  const handoff = {
    _id: "handoff-record",
    userId,
    targetStoreId: storeId,
    sourceSessionId,
    sourceAccessTokenHash: "source-token-hash",
    revokedAt: null
  };
  const originals = {
    authCreate: AuthSession.create,
    authFindOne: AuthSession.findOne,
    authUpdateMany: AuthSession.updateMany,
    handoffFindOneAndUpdate: StorePwaHandoff.findOneAndUpdate,
    handoffFindById: StorePwaHandoff.findById,
    handoffUpdateMany: StorePwaHandoff.updateMany,
    storeFindOne: StoreProfile.findOne,
    subscriptionFindOne: StoreSubscription.findOne,
    subscriptionStatus: StoreSubscription.getStoreSubscriptionStatus,
    userFindById: User.findById
  };
  const createdSessions = [];
  let revokeAttempts = 0;
  AuthSession.create = async (document) => {
    createdSessions.push(document);
    return document;
  };
  AuthSession.findOne = (filter) => ({
    lean: async () => filter.sessionId === sourceSessionId
      ? {
          sessionId: sourceSessionId,
          userId,
          authVersion: 0,
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: null
        }
      : null,
    select() {
      return { lean: async () => null };
    }
  });

  AuthSession.updateMany = async () => {
    revokeAttempts += 1;
    return { modifiedCount: 1 };
  };
  StorePwaHandoff.findOneAndUpdate = async () => handoff;
  StorePwaHandoff.findById = () => ({
    select() {
      return { lean: async () => ({ revokedAt: null }) };
    }
  });

  StorePwaHandoff.updateMany = async () => {
    revokeAttempts += 1;
    return { modifiedCount: 1 };
  };
  StoreProfile.findOne = () => ({
    select() { return { lean: async () => store }; }
  });
  StoreSubscription.findOne = () => ({
    sort() { return this; },
    populate() { return this; },
    lean: async () => ({
      status: "active",
      planId: { type: "store", features: ["pwa"] }
    })
  });
  StoreSubscription.getStoreSubscriptionStatus = () => "active";
  User.findById = () => ({
    ...user,
    select() { return { lean: async () => ({ authVersion: 0 }) }; }
  });

  const route = authRouter.stack.find(
    (layer) => layer.route?.path === "/store-pwa/:storeId/handoff/exchange"
      && layer.route.methods.post
  );
  assert.ok(route, "POST handoff exchange route exists");
  const handler = route.route.stack.at(-1).handle;
  const response = { statusCode: 200, cookies: [], clearedCookies: [], body: null };
  const res = {
    status(statusCode) { response.statusCode = statusCode; return this; },
    cookie(name, value, options) { response.cookies.push({ name, value, options }); return this; },
    clearCookie(name, options) { response.clearedCookies.push({ name, options }); return this; },
    set() { return this; },
    json(body) { response.body = body; return this; }
  };

  try {
    await handler({
      params: { storeId },
      headers: {
        origin: "https://apps.souqak-yem.com",
        "x-souqak-store-pwa-id": storeId
      },
      cookies: {
        [`storePwaHandoff_${storeId}`]: "opaque-handoff-grant",
        [`storeRefresh_${storeId}`]: "existing-store-refresh-token"
      }
    }, res);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.token !== undefined, true);
    assert.equal(createdSessions.length, 1);
    assert.equal(createdSessions[0].appType, "store-pwa");
    assert.equal(createdSessions[0].storeProfileId.toString(), storeId);
    assert.equal(revokeAttempts, 0);
    assert.equal(response.cookies.some(({ name }) => name === `storeRefresh_${storeId}`), true);
  } finally {
    AuthSession.create = originals.authCreate;
    AuthSession.findOne = originals.authFindOne;
    AuthSession.updateMany = originals.authUpdateMany;
    StorePwaHandoff.findOneAndUpdate = originals.handoffFindOneAndUpdate;
    StorePwaHandoff.findById = originals.handoffFindById;
    StorePwaHandoff.updateMany = originals.handoffUpdateMany;
    StoreProfile.findOne = originals.storeFindOne;
    StoreSubscription.findOne = originals.subscriptionFindOne;
    StoreSubscription.getStoreSubscriptionStatus = originals.subscriptionStatus;
    User.findById = originals.userFindById;
  }
});

test("handoff preparation returns its server expiry without exposing the grant", async () => {
  const storeId = "64d3d93a1a2b3c4d5e6f7788";
  const userId = "64d3d93a1a2b3c4d5e6f7789";
  const store = { _id: storeId, status: "active", storeType: "store" };
  const originals = {
    handoffCreate: StorePwaHandoff.create,
    storeFindOne: StoreProfile.findOne,
    subscriptionFindOne: StoreSubscription.findOne,
    subscriptionStatus: StoreSubscription.getStoreSubscriptionStatus
  };
  let createdHandoff;
  StorePwaHandoff.create = async (document) => {
    createdHandoff = document;
    return document;
  };
  StoreProfile.findOne = () => ({
    select() { return { lean: async () => store }; }
  });
  StoreSubscription.findOne = () => ({
    sort() { return this; },
    populate() { return this; },
    lean: async () => ({
      status: "active",
      planId: { type: "store", features: ["pwa"] }
    })
  });
  StoreSubscription.getStoreSubscriptionStatus = () => "active";

  const route = authRouter.stack.find(
    (layer) => layer.route?.path === "/store-pwa/:storeId/handoff"
      && layer.route.methods.post
  );
  assert.ok(route, "POST handoff preparation route exists");
  const handler = route.route.stack.at(-1).handle;
  const response = { statusCode: 200, cookies: [], body: null };
  const res = {
    status(statusCode) { response.statusCode = statusCode; return this; },
    cookie(name, value, options) { response.cookies.push({ name, value, options }); return this; },
    set() { return this; },
    json(body) { response.body = body; return this; }
  };

  try {
    await handler({
      params: { storeId },
      headers: { origin: "https://souqak-yem.com" },
      user: { id: userId },
      authSessionId: "source-session",
      authToken: "source-access-token"
    }, res);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.expiresAt, createdHandoff.expiresAt.toISOString());
    assert.equal(Object.hasOwn(response.body, "grant"), false);
    assert.equal(response.cookies[0].options.maxAge, 60_000);
    assert.equal(response.cookies[0].options.httpOnly, true);
  } finally {
    StorePwaHandoff.create = originals.handoffCreate;
    StoreProfile.findOne = originals.storeFindOne;
    StoreSubscription.findOne = originals.subscriptionFindOne;
    StoreSubscription.getStoreSubscriptionStatus = originals.subscriptionStatus;
  }
});
