import test, { after } from "node:test";
import assert from "node:assert/strict";

const originalEnv = {
  access: process.env.JWT_ACCESS_SECRET,
  refresh: process.env.JWT_REFRESH_SECRET,
  storeOrigin: process.env.STORE_PWA_ORIGIN,
  nodeEnv: process.env.NODE_ENV
};
process.env.JWT_ACCESS_SECRET = "test-access-secret-for-session-management";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-for-session-management";
process.env.STORE_PWA_ORIGIN = "https://apps.souqak-yem.com";

const [
  sessionService,
  { default: AuthSession },
  { default: StorePwaHandoff },
  { default: User },
  jwtConfig
] = await Promise.all([
  import("../src/services/authSessions.js"),
  import("../src/models/AuthSession.js"),
  import("../src/models/StorePwaHandoff.js"),
  import("../src/models/User.js"),
  import("../src/config/jwt.js")
]);

after(() => {
  if (originalEnv.access === undefined) delete process.env.JWT_ACCESS_SECRET;
  else process.env.JWT_ACCESS_SECRET = originalEnv.access;
  if (originalEnv.refresh === undefined) delete process.env.JWT_REFRESH_SECRET;
  else process.env.JWT_REFRESH_SECRET = originalEnv.refresh;
  if (originalEnv.storeOrigin === undefined) delete process.env.STORE_PWA_ORIGIN;
  else process.env.STORE_PWA_ORIGIN = originalEnv.storeOrigin;
  if (originalEnv.nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalEnv.nodeEnv;
});

test("refresh tokens are opaque and only their hashes are persisted", async () => {
  const originalCreate = AuthSession.create;
  let inserted;
  AuthSession.create = async (document) => {
    inserted = document;
    return document;
  };
  try {
    const user = { _id: "64d3d93a1a2b3c4d5e6f7788", role: "user" };
    const context = {
      appType: "store-pwa",
      storeProfileId: "64d3d93a1a2b3c4d5e6f7789"
    };
    const result = await sessionService.createAuthSession({ user, context });

    assert.ok(result.refreshToken);
    assert.notEqual(result.refreshToken, inserted.currentRefreshTokenHash);
    assert.equal(inserted.currentRefreshTokenHash, sessionService.hashAuthToken(result.refreshToken));
    assert.equal(inserted.appType, "store-pwa");
    assert.equal(String(inserted.storeProfileId), context.storeProfileId);
    assert.equal(inserted.userId, user._id);
  } finally {
    AuthSession.create = originalCreate;
  }
});

test("refresh cookies are isolated per store PWA and use a narrow API path", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const first = { appType: "store-pwa", storeProfileId: "64d3d93a1a2b3c4d5e6f7788" };
  const second = { appType: "store-pwa", storeProfileId: "64d3d93a1a2b3c4d5e6f7799" };
  try {
    process.env.NODE_ENV = "production";
    assert.notEqual(sessionService.getRefreshCookieName(first), sessionService.getRefreshCookieName(second));
    assert.notEqual(sessionService.getRefreshCookiePath(first), sessionService.getRefreshCookiePath(second));
    assert.equal(sessionService.getRefreshCookieName({ appType: "main" }), "refreshToken");
    assert.equal(
      sessionService.getRefreshCookiePath(first),
      `/api/auth/store-pwa/${first.storeProfileId}`
    );
    const cookieOptions = sessionService.getRefreshCookieOptions(first);
    assert.equal(cookieOptions.httpOnly, true);
    assert.equal(cookieOptions.secure, true);
    assert.equal(cookieOptions.sameSite, "strict");
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
});

test("store PWA session context requires the configured origin and a valid store id", () => {
  assert.equal(
    sessionService.getAuthSessionContext({
      headers: {
        origin: "https://apps.souqak-yem.com",
        "x-souqak-store-pwa-id": "64d3d93a1a2b3c4d5e6f7788"
      }
    }).appType,
    "store-pwa"
  );
  assert.throws(() => sessionService.getAuthSessionContext({
    headers: {
      origin: "https://attacker.example",
      "x-souqak-store-pwa-id": "64d3d93a1a2b3c4d5e6f7788"
    }
  }), { status: 403 });
  assert.throws(() => sessionService.getAuthSessionContext({
    headers: {
      origin: "https://apps.souqak-yem.com",
      "x-souqak-store-pwa-id": "not-a-store"
    }
  }), { status: 400 });
});

test("refresh rotation stores hashes and returns a distinct opaque replacement", async () => {
  const originals = {
    findOne: AuthSession.findOne,
    findOneAndUpdate: AuthSession.findOneAndUpdate,
    findUser: User.findById
  };
  const refreshToken = "prior-opaque-refresh-token";
  const tokenHash = sessionService.hashAuthToken(refreshToken);
  const session = {
    _id: "session-document",
    sessionId: "session-id",
    userId: "64d3d93a1a2b3c4d5e6f7788",
    appType: "main",
    storeProfileId: null,
    currentRefreshTokenHash: tokenHash,
    usedRefreshTokenHashes: [],
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000)
  };
  const user = { _id: session.userId, role: "user", isDisabled: false, isDeleted: false };
  AuthSession.findOne = async () => session;
  User.findById = async () => user;
  AuthSession.findOneAndUpdate = async (_filter, update) => ({
    ...session,
    ...update.$set,
    usedRefreshTokenHashes: [tokenHash]
  });

  try {
    const result = await sessionService.rotateRefreshSession(
      refreshToken,
      { appType: "main", storeProfileId: null }
    );
    assert.equal(result.status, "ok");
    assert.notEqual(result.refreshToken, refreshToken);
    assert.equal(result.session.previousRefreshTokenHash, tokenHash);
    assert.equal(
      result.session.currentRefreshTokenHash,
      sessionService.hashAuthToken(result.refreshToken)
    );
    assert.ok(!result.session.currentRefreshTokenHash.includes(result.refreshToken));
  } finally {
    AuthSession.findOne = originals.findOne;
    AuthSession.findOneAndUpdate = originals.findOneAndUpdate;
    User.findById = originals.findUser;
  }
});

test("legacy refresh token migrates once without replacing the retained User field", async () => {
  const originals = {
    findOne: AuthSession.findOne,
    create: AuthSession.create,
    findOneAndUpdate: AuthSession.findOneAndUpdate,
    findUser: User.findById,
    claimUser: User.findOneAndUpdate
  };
  const userId = "64d3d93a1a2b3c4d5e6f7788";
  const legacyRefreshToken = jwtConfig.signRefreshToken({ id: userId });
  const user = {
    _id: userId,
    role: "user",
    refreshToken: legacyRefreshToken,
    legacyRefreshTokenDisabledAt: null,
    isDisabled: false,
    isDeleted: false
  };
  let inserted;
  let claimFilter;
  AuthSession.findOne = async () => null;
  AuthSession.create = async (document) => {
    inserted = document;
    return { _id: "legacy-session-document", ...document };
  };
  User.findById = async () => user;
  User.findOneAndUpdate = async (filter) => {
    claimFilter = filter;
    user.legacyRefreshTokenDisabledAt = new Date();
    return user;
  };
  AuthSession.findOneAndUpdate = async (_filter, update) => ({
    _id: "legacy-session-document",
    ...inserted,
    ...update.$set,
    usedRefreshTokenHashes: [inserted.currentRefreshTokenHash]
  });

  try {
    const result = await sessionService.rotateRefreshSession(
      legacyRefreshToken,
      { appType: "main", storeProfileId: null }
    );
    assert.equal(result.status, "ok");
    assert.equal(user.refreshToken, legacyRefreshToken);
    assert.equal(inserted.legacyMigrated, true);
    assert.equal(inserted.currentRefreshTokenHash, sessionService.hashAuthToken(legacyRefreshToken));
    assert.ok(claimFilter.$or);
    assert.notEqual(result.refreshToken, legacyRefreshToken);
  } finally {
    AuthSession.findOne = originals.findOne;
    AuthSession.create = originals.create;
    AuthSession.findOneAndUpdate = originals.findOneAndUpdate;
    User.findById = originals.findUser;
    User.findOneAndUpdate = originals.claimUser;
  }
});

test("concurrent use of the just-rotated token is recoverable without revocation", async () => {
  const originalFindOne = AuthSession.findOne;
  const refreshToken = "concurrent-old-token";
  const tokenHash = sessionService.hashAuthToken(refreshToken);
  const session = {
    sessionId: "session-id",
    appType: "main",
    storeProfileId: null,
    usedRefreshTokenHashes: [tokenHash],
    previousRefreshTokenHash: tokenHash,
    previousTokenValidUntil: new Date(Date.now() + 5_000),
    revokedAt: null
  };
  AuthSession.findOne = async (filter) => (
    filter.usedRefreshTokenHashes ? session : null
  );
  try {
    const result = await sessionService.rotateRefreshSession(
      refreshToken,
      { appType: "main", storeProfileId: null }
    );
    assert.equal(result.status, "rotated");
    assert.equal(result.retryAfterMs, 150);
  } finally {
    AuthSession.findOne = originalFindOne;
  }
});

test("reuse outside the concurrency window revokes only the matching app session", async () => {
  const originals = {
    findOne: AuthSession.findOne,
    find: AuthSession.find,
    updateMany: AuthSession.updateMany,
    handoffUpdateMany: StorePwaHandoff.updateMany
  };
  const refreshToken = "replayed-refresh-token";
  const tokenHash = sessionService.hashAuthToken(refreshToken);
  const session = {
    sessionId: "store-session-id",
    appType: "store-pwa",
    storeProfileId: "64d3d93a1a2b3c4d5e6f7788",
    usedRefreshTokenHashes: [tokenHash],
    previousRefreshTokenHash: tokenHash,
    previousTokenValidUntil: new Date(Date.now() - 1),
    revokedAt: null
  };
  let revokedFilter;
  AuthSession.findOne = async (filter) => (
    filter.usedRefreshTokenHashes ? session : null
  );
  AuthSession.find = () => ({ distinct: async () => [] });
  AuthSession.updateMany = async (filter, update) => {
    revokedFilter = { filter, update };
    return { modifiedCount: 1 };
  };
  StorePwaHandoff.updateMany = async () => ({ modifiedCount: 0 });
  try {
    const result = await sessionService.rotateRefreshSession(
      refreshToken,
      { appType: "store-pwa", storeProfileId: session.storeProfileId }
    );
    assert.equal(result.status, "reused");
    assert.deepEqual(revokedFilter.filter, {
      $or: [{ sessionId: "store-session-id" }, { sourceSessionId: "store-session-id" }],
      revokedAt: null
    });
    assert.equal(revokedFilter.update.$set.revokeReason, "refresh_token_reuse");
  } finally {
    AuthSession.findOne = originals.findOne;
    AuthSession.find = originals.find;
    AuthSession.updateMany = originals.updateMany;
    StorePwaHandoff.updateMany = originals.handoffUpdateMany;
  }
});

test("revoking a source session returns its linked app sessions for socket disconnection", async () => {
  const originals = {
    find: AuthSession.find,
    updateMany: AuthSession.updateMany,
    handoffUpdateMany: StorePwaHandoff.updateMany
  };
  let sessionUpdate;
  AuthSession.find = (filter) => {
    assert.deepEqual(filter, { sourceSessionId: "main-session", revokedAt: null });
    return { distinct: async () => ["store-session-a", "store-session-b"] };
  };
  AuthSession.updateMany = async (filter) => {
    sessionUpdate = filter;
    return { modifiedCount: 3 };
  };
  StorePwaHandoff.updateMany = async () => ({ modifiedCount: 0 });
  try {
    const revoked = await sessionService.revokeAuthSession("main-session");
    assert.deepEqual(revoked, ["main-session", "store-session-a", "store-session-b"]);
    assert.deepEqual(sessionUpdate, {
      $or: [{ sessionId: "main-session" }, { sourceSessionId: "main-session" }],
      revokedAt: null
    });
  } finally {
    AuthSession.find = originals.find;
    AuthSession.updateMany = originals.updateMany;
    StorePwaHandoff.updateMany = originals.handoffUpdateMany;
  }
});

test("handoff consumption is one-time, target-bound, and stores only a grant hash", async () => {
  const originalCreate = StorePwaHandoff.create;
  const originalConsume = StorePwaHandoff.findOneAndUpdate;
  let inserted;
  let consumeFilter;
  StorePwaHandoff.create = async (document) => {
    inserted = document;
    return document;
  };
  StorePwaHandoff.findOneAndUpdate = async (filter) => {
    consumeFilter = filter;
    return { _id: "handoff-id", ...filter };
  };
  try {
    const result = await sessionService.createStorePwaHandoff({
      userId: "64d3d93a1a2b3c4d5e6f7788",
      targetStoreId: "64d3d93a1a2b3c4d5e6f7789",
      sourceSessionId: "source-session"
    });
    assert.equal(inserted.grantHash, sessionService.hashAuthToken(result.grant));
    assert.notEqual(inserted.grantHash, result.grant);
    await sessionService.consumeStorePwaHandoff({
      grant: result.grant,
      targetStoreId: inserted.targetStoreId
    });
    assert.equal(consumeFilter.grantHash, inserted.grantHash);
    assert.equal(consumeFilter.targetStoreId, inserted.targetStoreId);
    assert.ok(consumeFilter.expiresAt.$gt instanceof Date);
    assert.equal(consumeFilter.consumedAt, null);
    assert.equal(consumeFilter.revokedAt, null);
  } finally {
    StorePwaHandoff.create = originalCreate;
    StorePwaHandoff.findOneAndUpdate = originalConsume;
  }
});
