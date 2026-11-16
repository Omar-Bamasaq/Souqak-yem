import test, { after } from "node:test";
import assert from "node:assert/strict";

const originalSecrets = {
  access: process.env.JWT_ACCESS_SECRET,
  refresh: process.env.JWT_REFRESH_SECRET
};
process.env.JWT_ACCESS_SECRET = "test-access-secret-for-auth-middleware";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-for-auth-middleware";

const [
  { default: auth, disconnectAuthSessionSockets, sendAuthResponse },
  { default: User },
  { default: AuthSession },
  { default: StorePwaHandoff },
  sessionService,
  jwtConfig
] = await Promise.all([
  import("../src/middleware/auth.js"),
  import("../src/models/User.js"),
  import("../src/models/AuthSession.js"),
  import("../src/models/StorePwaHandoff.js"),
  import("../src/services/authSessions.js"),
  import("../src/config/jwt.js")
]);

after(() => {
  if (originalSecrets.access === undefined) delete process.env.JWT_ACCESS_SECRET;
  else process.env.JWT_ACCESS_SECRET = originalSecrets.access;
  if (originalSecrets.refresh === undefined) delete process.env.JWT_REFRESH_SECRET;
  else process.env.JWT_REFRESH_SECRET = originalSecrets.refresh;
});

test("authenticated user context preserves phone and verification fields", async () => {
  const originalFindById = User.findById;
  const originalExists = AuthSession.exists;
  const phoneVerifiedAt = new Date("2026-10-01T00:00:00.000Z");
  const verificationExpiryDate = new Date("2027-10-01T00:00:00.000Z");
  User.findById = () => ({
    lean: async () => ({
      _id: "64d3d93a1a2b3c4d5e6f7788",
      role: "user",
      permissions: ["basic"],
      name: "Test User",
      phone: "777123456",
      phoneVerifiedAt,
      identityStatus: "verified",
      isVerifiedSeller: true,
      verificationStatus: "approved",
      verificationExpiryDate,
      isDisabled: false,
      isDeleted: false
    })
  });
  AuthSession.exists = async () => false;

  try {
    const req = {
      cookies: {
        accessToken: jwtConfig.signAccessToken({ id: "64d3d93a1a2b3c4d5e6f7788" })
      },
      headers: {},
      method: "GET",
      path: "/api/test"
    };
    const res = {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      }
    };
    let continued = false;

    await auth(req, res, () => {
      continued = true;
    });

    assert.equal(continued, true);
    assert.equal(req.user.phone, "777123456");
    assert.equal(req.user.phoneVerifiedAt, phoneVerifiedAt);
    assert.equal(req.user.identityStatus, "verified");
    assert.equal(req.user.verificationStatus, "approved");
    assert.equal(req.user.verificationExpiryDate, verificationExpiryDate);
    assert.equal(req.user.isDisabled, false);
    assert.equal(req.user.isDeleted, false);
  } finally {
    User.findById = originalFindById;
    AuthSession.exists = originalExists;
  }
});

test("bearer identity takes precedence over a different API access cookie", async () => {
  const originalFindById = User.findById;
  const originalExists = AuthSession.exists;
  User.findById = (id) => ({
    lean: async () => ({
      _id: id,
      role: "user",
      permissions: [],
      name: "Bearer User",
      isDisabled: false,
      isDeleted: false
    })
  });

  AuthSession.exists = async () => false;
  try {
    const bearerId = "64d3d93a1a2b3c4d5e6f7788";
    const cookieId = "64d3d93a1a2b3c4d5e6f7799";
    const req = {
      cookies: { accessToken: jwtConfig.signAccessToken({ id: cookieId }) },
      headers: { authorization: `Bearer ${jwtConfig.signAccessToken({ id: bearerId })}` },
      method: "GET",
      path: "/api/test"
    };
    const res = {
      statusCode: null,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; }
    };
    await auth(req, res, () => {});
    assert.equal(req.user.id, bearerId);
  } finally {
    User.findById = originalFindById;
    AuthSession.exists = originalExists;
  }
});

test("revoked session socket rooms are disconnected once", () => {
  const disconnectedRooms = [];
  const io = {
    in(room) {
      return {
        disconnectSockets(force) {
          disconnectedRooms.push({ room, force });
        }
      };
    }
  };
  disconnectAuthSessionSockets({ app: { get: () => io } }, ["main-session", "store-session", "main-session"]);
  assert.deepEqual(disconnectedRooms, [
    { room: "session:main-session", force: true },
    { room: "session:store-session", force: true }
  ]);
});

test("main app login removes any retained legacy refresh token", async () => {
  const originals = {
    create: AuthSession.create,
    updateUser: User.updateOne
  };
  let userUpdate;
  AuthSession.create = async (document) => document;
  User.updateOne = async (filter, update) => {
    userUpdate = { filter, update };
    return { modifiedCount: 1 };
  };
  try {
    await sendAuthResponse(
      {
        _id: "64d3d93a1a2b3c4d5e6f7788",
        role: "user",
        refreshToken: "legacy-refresh-token",
        legacyRefreshTokenDisabledAt: null
      },
      { cookie() {} },
      { req: { headers: {}, cookies: {} } }
    );

    assert.equal(userUpdate.filter.refreshToken, "legacy-refresh-token");
    assert.equal(userUpdate.update.$unset.refreshToken, 1);
    assert.ok(userUpdate.update.$set.legacyRefreshTokenDisabledAt instanceof Date);
  } finally {
    AuthSession.create = originals.create;
    User.updateOne = originals.updateUser;
  }
});

test("legacy refresh migration clears the token that the previous release could reuse", async () => {
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
  let claimUpdate;
  AuthSession.findOne = async () => null;
  AuthSession.create = async (document) => {
    inserted = document;
    return { _id: "legacy-session-document", ...document };
  };
  User.findById = async () => user;
  User.findOneAndUpdate = async (_filter, update) => {
    claimUpdate = update;
    user.legacyRefreshTokenDisabledAt = new Date();
    user.refreshToken = undefined;
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
    assert.equal(user.refreshToken, undefined);
    assert.equal(claimUpdate.$unset.refreshToken, 1);
    assert.notEqual(user.refreshToken, legacyRefreshToken);
  } finally {
    AuthSession.findOne = originals.findOne;
    AuthSession.create = originals.create;
    AuthSession.findOneAndUpdate = originals.findOneAndUpdate;
    User.findById = originals.findUser;
    User.findOneAndUpdate = originals.claimUser;
  }
});

test("legacy refresh migration can recover after a session is created before the user update", async () => {
  const originals = {
    findOne: AuthSession.findOne,
    create: AuthSession.create,
    findOneAndUpdate: AuthSession.findOneAndUpdate,
    findUser: User.findById,
    claimUser: User.findOneAndUpdate,
    updateUser: User.updateOne
  };
  const userId = "64d3d93a1a2b3c4d5e6f7788";
  const legacyRefreshToken = jwtConfig.signRefreshToken({ id: userId });
  const user = {
    _id: userId,
    role: "user",
    authVersion: 0,
    refreshToken: legacyRefreshToken,
    legacyRefreshTokenDisabledAt: null,
    isDisabled: false,
    isDeleted: false
  };
  let inserted;
  AuthSession.findOne = async (filter) => (
    (filter.initialRefreshTokenHash
      && inserted?.initialRefreshTokenHash === filter.initialRefreshTokenHash)
    || (filter.currentRefreshTokenHash
      && inserted?.currentRefreshTokenHash === filter.currentRefreshTokenHash)
      ? inserted
      : null
  );
  AuthSession.create = async (document) => {
    inserted = {
      _id: "recoverable-legacy-session",
      ...document,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000)
    };
    return inserted;
  };
  User.findById = async () => user;
  User.findOneAndUpdate = async () => {
    throw new Error("simulated interruption after session creation");
  };
  User.updateOne = async (_filter, update) => {
    assert.equal(update.$unset.refreshToken, 1);
    user.refreshToken = undefined;
    user.legacyRefreshTokenDisabledAt = new Date();
    return { modifiedCount: 1 };
  };
  AuthSession.findOneAndUpdate = async (_filter, update) => ({
    ...inserted,
    ...update.$set,
    usedRefreshTokenHashes: [inserted.currentRefreshTokenHash]
  });

  try {
    await assert.rejects(
      sessionService.rotateRefreshSession(
        legacyRefreshToken,
        { appType: "main", storeProfileId: null }
      ),
      /simulated interruption/
    );

    const recovered = await sessionService.rotateRefreshSession(
      legacyRefreshToken,
      { appType: "main", storeProfileId: null }
    );
    assert.equal(recovered.status, "ok");
    assert.equal(user.refreshToken, undefined);
  } finally {
    AuthSession.findOne = originals.findOne;
    AuthSession.create = originals.create;
    AuthSession.findOneAndUpdate = originals.findOneAndUpdate;
    User.findById = originals.findUser;
    User.findOneAndUpdate = originals.claimUser;
    User.updateOne = originals.updateUser;
  }
});

test("password changes unset legacy refresh tokens for query and document updates", async () => {
  const originals = {
    find: User.find,
    updateMany: AuthSession.updateMany,
    handoffUpdateMany: StorePwaHandoff.updateMany
  };
  User.find = () => ({
    select: () => ({ lean: async () => [{ _id: "64d3d93a1a2b3c4d5e6f7788" }] })
  });
  let sessionsRevoked = false;
  AuthSession.updateMany = async () => {
    sessionsRevoked = true;
    return { modifiedCount: 0 };
  };
  StorePwaHandoff.updateMany = async () => ({ modifiedCount: 0 });

  try {
    const query = User.updateOne(
      { _id: "64d3d93a1a2b3c4d5e6f7788" },
      { $set: { password: "new-password-hash" } }
    );
    await new Promise((resolve, reject) => {
      User.schema.s.hooks.execPre("updateOne", query, (error) => (
        error ? reject(error) : resolve()
      ));
    });
    assert.equal(query.getUpdate().$unset.refreshToken, 1);
    assert.equal(query.getUpdate().$inc.authVersion, 1);
    assert.equal(sessionsRevoked, false);
    await new Promise((resolve, reject) => {
      User.schema.s.hooks.execPost(
        "updateOne",
        query,
        [{ matchedCount: 1 }],
        (error) => (error ? reject(error) : resolve())
      );
    });
    assert.equal(sessionsRevoked, true);

    const user = new User({
      name: "Test User",
      email: "test@example.com",
      password: "new-password-hash",
      refreshToken: "legacy-refresh-token"
    });
    user.$isNew = false;
    sessionsRevoked = false;
    await new Promise((resolve, reject) => {
      User.schema.s.hooks.execPre("save", user, (error) => (
        error ? reject(error) : resolve()
      ));
    });
    assert.equal(user.refreshToken, undefined);
    const [, saveUpdate] = user.$__delta();
    assert.equal(saveUpdate.$inc.authVersion, 1);
    assert.equal(sessionsRevoked, false);
    await new Promise((resolve, reject) => {
      User.schema.s.hooks.execPost("save", user, [user], (error) => (
        error ? reject(error) : resolve()
      ));
    });
    assert.equal(sessionsRevoked, true);
  } finally {
    User.find = originals.find;
    AuthSession.updateMany = originals.updateMany;
    StorePwaHandoff.updateMany = originals.handoffUpdateMany;
  }
});

test("auth sessions issued before a password change are rejected by auth version", async () => {
  const originals = {
    findOne: AuthSession.findOne,
    find: AuthSession.find,
    updateMany: AuthSession.updateMany,
    handoffUpdateMany: StorePwaHandoff.updateMany,
    findUser: User.findById
  };
  AuthSession.findOne = () => ({
    lean: async () => ({
      sessionId: "stale-session",
      userId: "64d3d93a1a2b3c4d5e6f7788",
      authVersion: 3
    })
  });
  AuthSession.find = () => ({ distinct: async () => [] });
  AuthSession.updateMany = async () => ({ modifiedCount: 1 });
  StorePwaHandoff.updateMany = async () => ({ modifiedCount: 0 });
  User.findById = () => ({
    select: () => ({ lean: async () => ({ authVersion: 4 }) })
  });

  try {
    assert.equal(
      await sessionService.isAuthSessionActive(
        "stale-session",
        "64d3d93a1a2b3c4d5e6f7788"
      ),
      false
    );
  } finally {
    AuthSession.findOne = originals.findOne;
    AuthSession.find = originals.find;
    AuthSession.updateMany = originals.updateMany;
    StorePwaHandoff.updateMany = originals.handoffUpdateMany;
    User.findById = originals.findUser;
  }
});
