import test, { after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";

const originalAccessSecret = process.env.JWT_ACCESS_SECRET;
const originalRefreshSecret = process.env.JWT_REFRESH_SECRET;
process.env.JWT_ACCESS_SECRET = "admin-settings-test-access-secret";
process.env.JWT_REFRESH_SECRET = "admin-settings-test-refresh-secret";

const [
  { default: adminSettingsRouter },
  { default: User },
  { default: AuthSession },
  { default: SystemSettings },
  { default: AdminAuditLog },
  { signAccessToken }
] = await Promise.all([
  import("../src/routes/adminSettings.js"),
  import("../src/models/User.js"),
  import("../src/models/AuthSession.js"),
  import("../src/models/SystemSettings.js"),
  import("../src/models/AdminAuditLog.js"),
  import("../src/config/jwt.js")
]);

after(() => {
  if (originalAccessSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
  else process.env.JWT_ACCESS_SECRET = originalAccessSecret;
  if (originalRefreshSecret === undefined) delete process.env.JWT_REFRESH_SECRET;
  else process.env.JWT_REFRESH_SECRET = originalRefreshSecret;
});

test("admin settings save the phone gate, deny unauthorized changes, and keep supervisor settings access", async () => {
  const originals = {
    findUserById: User.findById,
    authSessionExists: AuthSession.exists,
    getSettings: SystemSettings.getSettings,
    findOneAndUpdate: SystemSettings.findOneAndUpdate,
    createAuditLog: AdminAuditLog.create
  };
  const accountIds = {
    admin: "64d3d93a1a2b3c4d5e6f7788",
    supervisor: "64d3d93a1a2b3c4d5e6f7789",
    user: "64d3d93a1a2b3c4d5e6f7790"
  };
  const accounts = new Map([
    [accountIds.admin, { role: "admin", permissions: [] }],
    [accountIds.supervisor, { role: "supervisor", permissions: ["system"] }],
    [accountIds.user, { role: "user", permissions: [] }]
  ]);
  let settings = {
    _id: "settings-global",
    requirePhoneVerificationForAds: true,
    adReviewMode: "manual",
    exchangeRates: { USD: 1, SAR: 3.75, YER: 530, YER_SANAA: 530, YER_ADEN: 1600 },
    exchangeRatePairs: {
      SAR: { buy: 3.75, sell: 3.75 },
      YER_SANAA: { buy: 530, sell: 530 },
      YER_ADEN: { buy: 1600, sell: 1600 }
    }
  };
  const auditEntries = [];
  let updateCount = 0;
  let server;

  const settingsDocument = () => ({
    ...settings,
    toObject: () => ({
      ...settings,
      exchangeRates: { ...settings.exchangeRates },
      exchangeRatePairs: Object.fromEntries(
        Object.entries(settings.exchangeRatePairs).map(([currency, pair]) => [currency, { ...pair }])
      )
    })
  });

  try {
    User.findById = (id) => ({
      lean: async () => ({
        _id: String(id),
        name: "Settings test account",
        permissions: [],
        isDisabled: false,
        isDeleted: false,
        ...accounts.get(String(id))
      })
    });
    AuthSession.exists = async () => false;
    SystemSettings.getSettings = async () => settingsDocument();
    SystemSettings.findOneAndUpdate = async (filter, update) => {
      assert.equal(String(filter._id), settings._id);
      updateCount += 1;
      settings = { ...settings, ...update };
      return settingsDocument();
    };
    AdminAuditLog.create = async (entry) => {
      auditEntries.push(entry);
      return entry;
    };

    const app = express();
    app.use(express.json());
    app.use("/api/admin/settings", adminSettingsRouter);
    server = http.createServer(app);
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });

    const baseUrl = `http://127.0.0.1:${server.address().port}/api/admin/settings`;
    const request = async (role, method, body) => {
      const response = await fetch(baseUrl, {
        method,
        headers: {
          Authorization: `Bearer ${signAccessToken({ id: accountIds[role], role })}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" })
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      return { status: response.status, data: await response.json() };
    };

    const disabled = await request("admin", "PATCH", { requirePhoneVerificationForAds: false });
    assert.equal(disabled.status, 200);
    assert.equal(disabled.data.requirePhoneVerificationForAds, false);

    const reread = await request("admin", "GET");
    assert.equal(reread.status, 200);
    assert.equal(reread.data.requirePhoneVerificationForAds, false);

    const userAttempt = await request("user", "PATCH", { requirePhoneVerificationForAds: true });
    assert.equal(userAttempt.status, 403);
    assert.equal(updateCount, 1);

    const supervisorAttempt = await request("supervisor", "PATCH", { requirePhoneVerificationForAds: true });
    assert.equal(supervisorAttempt.status, 403);
    assert.equal(updateCount, 1);

    const supervisorOtherSetting = await request("supervisor", "PATCH", { adReviewMode: "auto" });
    assert.equal(supervisorOtherSetting.status, 200);
    assert.equal(updateCount, 2);

    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(auditEntries.length, 1);
    assert.equal(auditEntries[0].adminId, accountIds.admin);
    assert.equal(settings.requirePhoneVerificationForAds, false);
  } finally {
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    User.findById = originals.findUserById;
    AuthSession.exists = originals.authSessionExists;
    SystemSettings.getSettings = originals.getSettings;
    SystemSettings.findOneAndUpdate = originals.findOneAndUpdate;
    AdminAuditLog.create = originals.createAuditLog;
  }
});
