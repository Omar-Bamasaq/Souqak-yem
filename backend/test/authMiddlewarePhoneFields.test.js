import test, { after } from "node:test";
import assert from "node:assert/strict";

const originalSecrets = {
  access: process.env.JWT_ACCESS_SECRET,
  refresh: process.env.JWT_REFRESH_SECRET
};
process.env.JWT_ACCESS_SECRET = "test-access-secret-for-auth-middleware";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-for-auth-middleware";

const [{ default: auth }, { default: User }, jwtConfig] = await Promise.all([
  import("../src/middleware/auth.js"),
  import("../src/models/User.js"),
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
  }
});
