import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const backendDirectory = path.resolve(testDirectory, "..");
const localEnvPath = path.join(backendDirectory, ".env.local");
let localUri = null;
let localUriError = "backend/.env.local does not contain a local MongoDB URI.";

if (fs.existsSync(localEnvPath)) {
  const localConfig = dotenv.parse(fs.readFileSync(localEnvPath, "utf8"));
  for (const [key, value] of Object.entries(localConfig)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  try {
    const uri = new URL(localConfig.MONGODB_URI);
    if (!["127.0.0.1", "localhost", "::1"].includes(uri.hostname)) {
      localUriError = "Refusing to run phone verification integration tests against a non-local database.";
    } else {
      const originalDatabase = decodeURIComponent(uri.pathname.slice(1));
      if (uri.username && !uri.searchParams.has("authSource")) {
        uri.searchParams.set("authSource", originalDatabase);
      }
      uri.pathname = `/souqak_phone_verification_test_${process.pid}_${Date.now()}`;
      uri.searchParams.set("replicaSet", "rs0");
      localUri = uri.toString();
    }
  } catch {
    localUriError = "The local MongoDB URI is invalid.";
  }
}

test(
  "phone verification request, approval, rejection, and one-time code flow",
  { skip: localUri ? false : localUriError },
  async () => {
    const mongoose = (await import("mongoose")).default;
    mongoose.set("autoIndex", false);
    const express = (await import("express")).default;
    const { signAccessToken } = await import("../src/config/jwt.js");
    const User = (await import("../src/models/User.js")).default;
    const AdminNotification = (await import("../src/models/AdminNotification.js")).default;
    const Notification = (await import("../src/models/Notification.js")).default;
    const SystemSettings = (await import("../src/models/SystemSettings.js")).default;
    const PhoneVerificationRequest = (await import("../src/models/PhoneVerificationRequest.js")).default;
    const phoneVerificationRouter = (await import("../src/routes/phoneVerification.js")).default;
    const authRouter = (await import("../src/routes/auth.js")).default;

    const originalHmacSecret = process.env.PHONE_VERIFICATION_HMAC_SECRET;
    process.env.PHONE_VERIFICATION_HMAC_SECRET = "local-integration-secret-with-at-least-32-bytes";
    let server;

    try {
      await mongoose.connect(localUri, { serverSelectionTimeoutMS: 5_000 });
      const hello = await mongoose.connection.db.admin().command({ hello: 1 });
      assert.equal(hello.setName, "rs0", "local MongoDB must be a replica set");
      assert.equal(hello.isWritablePrimary, true, "local replica set must have a primary");
      await SystemSettings.create({ singletonKey: "global" });
      await Promise.all([
        User.collection.createIndex(
          { phone: 1 },
          {
            unique: true,
            partialFilterExpression: { phone: { $type: "string", $gt: "" } },
            name: "phone_1"
          }
        ),
        PhoneVerificationRequest.collection.createIndex(
          { user: 1 },
          {
            unique: true,
            partialFilterExpression: { status: { $in: ["pending_admin_review", "code_issued"] } },
            name: "one_active_phone_verification_request_per_user"
          }
        )
      ]);

      const app = express();
      const adminSocketEvents = [];
      app.set("trust proxy", 1);
      app.set("io", {
        to: (room) => ({
          emit: (event, notification) => adminSocketEvents.push({ room, event, notification })
        })
      });
      app.use(express.json());
      app.use("/api/auth", authRouter);
      app.use("/api/phone-verification", phoneVerificationRouter);
      server = http.createServer(app);
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });

      const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
      const suffix = `${process.pid}-${Date.now()}`;
      const user = await User.create({
        name: `Phone Verify User ${suffix}`,
        email: `phone-verify-${suffix}@local.test`,
        password: "unchanged-local-password",
        phone: "771234567",
        phoneRegistrationMode: "instant",
        phoneTrial: false,
        phoneTrialStatus: "Approved"
      });
      const otherUser = await User.create({
        name: `Phone Verify Other ${suffix}`,
        email: `phone-verify-other-${suffix}@local.test`,
        password: "unchanged-other-password",
        phone: "779876543",
        phoneRegistrationMode: "instant",
        phoneTrial: false,
        phoneTrialStatus: "Approved"
      });
      const admin = await User.create({
        name: `Phone Verify Admin ${suffix}`,
        email: `phone-verify-admin-${suffix}@local.test`,
        password: "local-admin-password",
        role: "admin"
      });
      const tokenFor = (account) => signAccessToken({ id: String(account._id), role: account.role });
      const request = async (route, { method = "GET", account, body } = {}) => {
        const headers = {};
        if (account) headers.Authorization = `Bearer ${tokenFor(account)}`;
        if (body !== undefined) headers["Content-Type"] = "application/json";
        const response = await fetch(`${baseUrl}${route}`, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body)
        });
        return { status: response.status, data: await response.json() };
      };

      const phoneSignup = await request("/auth/phone-register", {
        method: "POST",
        body: {
          name: `Immediate Phone Signup ${suffix}`,
          phone: "771111111",
          password: "Abc12345"
        }
      });
      assert.equal(phoneSignup.status, 201);
      assert.equal(phoneSignup.data.user.phoneVerifiedAt, null);
      const createdPhoneUser = await User.findById(phoneSignup.data.user.id).lean();
      assert.equal(createdPhoneUser.phoneRegistrationMode, "instant");
      assert.equal(createdPhoneUser.phoneTrial, false);
      assert.equal(createdPhoneUser.phoneTrialStatus, "Approved");

      const loginByPhone = await request("/auth/phone-login", {
        method: "POST",
        body: { identifier: "771111111", password: "Abc12345" }
      });
      assert.equal(loginByPhone.status, 200);
      assert.equal(loginByPhone.data.user.phoneVerifiedAt, null);
      const loginByUsername = await request("/auth/phone-login", {
        method: "POST",
        body: { identifier: `Immediate Phone Signup ${suffix}`, password: "Abc12345" }
      });
      assert.equal(loginByUsername.status, 200);
      const invalidSignupPassword = await request("/auth/phone-register", {
        method: "POST",
        body: {
          name: `Invalid Password Signup ${suffix}`,
          phone: "771111112",
          password: "كلمة12345"
        }
      });
      assert.equal(invalidSignupPassword.status, 400);
      const duplicateSignupPhone = await request("/auth/phone-register", {
        method: "POST",
        body: {
          name: `Duplicate Phone Signup ${suffix}`,
          phone: "967 771 111 111",
          password: "Abc12345"
        }
      });
      assert.equal(duplicateSignupPhone.status, 409);

      const initialPasswordHash = user.password;
      const firstRequest = await request("/phone-verification/request", { method: "POST", account: user });
      assert.equal(firstRequest.status, 201);
      assert.equal(firstRequest.data.request.status, "pending_admin_review");
      const adminNotification = await AdminNotification.findOne({
        type: "phone_verification_request",
        "data.requestId": firstRequest.data.request.id
      }).lean();
      assert.ok(adminNotification);
      assert.equal(adminNotification.link, "/admin/phone-verification");
      assert.ok(adminSocketEvents.some(({ room, event, notification }) =>
        room === "role:admin"
        && event === "admin_notification:new"
        && notification.type === "phone_verification_request"
        && notification.data.requestId === firstRequest.data.request.id
      ));
      const duplicateRequest = await request("/phone-verification/request", { method: "POST", account: user });
      assert.equal(duplicateRequest.status, 200);
      assert.equal(duplicateRequest.data.existing, true);
      assert.equal(await AdminNotification.countDocuments({
        type: "phone_verification_request",
        "data.requestId": firstRequest.data.request.id
      }), 1);

      const adminList = await request("/phone-verification/admin?status=pending_admin_review", { account: admin });
      assert.equal(adminList.status, 200);
      assert.ok(adminList.data.some((item) => item.id === firstRequest.data.request.id));

      const configuredHmacSecret = process.env.PHONE_VERIFICATION_HMAC_SECRET;
      delete process.env.PHONE_VERIFICATION_HMAC_SECRET;
      const missingSecretApproval = await request(
        `/phone-verification/admin/${firstRequest.data.request.id}/approve`,
        { method: "PATCH", account: admin }
      );
      assert.equal(missingSecretApproval.status, 503);
      const unchangedRequest = await PhoneVerificationRequest.findById(firstRequest.data.request.id)
        .select("+codeHash")
        .lean();
      assert.equal(unchangedRequest.status, "pending_admin_review");
      assert.equal(unchangedRequest.codeHash, null);
      assert.equal(unchangedRequest.codeIssueHistory.length, 0);
      process.env.PHONE_VERIFICATION_HMAC_SECRET = configuredHmacSecret;

      const approved = await request(`/phone-verification/admin/${firstRequest.data.request.id}/approve`, {
        method: "PATCH",
        account: admin
      });
      assert.equal(approved.status, 200);
      assert.match(approved.data.code, /^\d{6}$/);
      assert.equal(approved.data.manualSendRequired, true);
      assert.match(approved.data.waLink, /^https:\/\/wa\.me\//);
      assert.equal(await Notification.countDocuments({ userId: user._id, type: "system" }), 1);
      const duplicateApproval = await request(
        `/phone-verification/admin/${firstRequest.data.request.id}/approve`,
        { method: "PATCH", account: admin }
      );
      assert.equal(duplicateApproval.status, 409);
      const issuedOnce = await PhoneVerificationRequest.findById(firstRequest.data.request.id).lean();
      assert.equal(issuedOnce.codeIssueHistory.length, 1);
      assert.equal(issuedOnce.status, "code_issued");

      const crossAccountAttempt = await request("/phone-verification/verify", {
        method: "POST",
        account: otherUser,
        body: { code: approved.data.code }
      });
      assert.equal(crossAccountAttempt.status, 400);

      const wrongCode = await request("/phone-verification/verify", {
        method: "POST",
        account: user,
        body: { code: approved.data.code === "000000" ? "000001" : "000000" }
      });
      assert.equal(wrongCode.status, 400);

      const verified = await request("/phone-verification/verify", {
        method: "POST",
        account: user,
        body: { code: approved.data.code }
      });
      assert.equal(verified.status, 200);
      assert.ok(verified.data.phoneVerifiedAt);
      const updatedUser = await User.findById(user._id).lean();
      assert.ok(updatedUser.phoneVerifiedAt);
      assert.equal(updatedUser.password, initialPasswordHash);
      assert.equal(await PhoneVerificationRequest.countDocuments({ user: user._id, status: "verified" }), 1);

      const expiryUser = await User.create({
        name: `Phone Verify Expiry ${suffix}`,
        email: `phone-verify-expiry-${suffix}@local.test`,
        password: "unchanged-expiry-password",
        phone: "778765431",
        phoneRegistrationMode: "instant"
      });
      const expiryRequest = await request("/phone-verification/request", {
        method: "POST",
        account: expiryUser
      });
      assert.equal(expiryRequest.status, 201);
      const expiryApproval = await request(
        `/phone-verification/admin/${expiryRequest.data.request.id}/approve`,
        { method: "PATCH", account: admin }
      );
      assert.equal(expiryApproval.status, 200);
      await PhoneVerificationRequest.updateOne(
        { _id: expiryRequest.data.request.id },
        { $set: { codeExpiresAt: new Date(Date.now() - 1_000) } }
      );
      const expiredCodeAttempt = await request("/phone-verification/verify", {
        method: "POST",
        account: expiryUser,
        body: { code: expiryApproval.data.code }
      });
      assert.equal(expiredCodeAttempt.status, 400);
      const expiredRequest = await PhoneVerificationRequest.findById(expiryRequest.data.request.id)
        .select("+codeHash")
        .lean();
      assert.equal(expiredRequest.status, "expired");
      assert.equal(expiredRequest.codeHash, undefined);

      const rejectionUser = await User.create({
        name: `Phone Verify Rejected ${suffix}`,
        email: `phone-verify-rejected-${suffix}@local.test`,
        password: "unchanged-rejected-password",
        phone: "778765432",
        phoneRegistrationMode: "instant"
      });
      const pendingRejection = await request("/phone-verification/request", { method: "POST", account: rejectionUser });
      assert.equal(pendingRejection.status, 201);
      const rejected = await request(`/phone-verification/admin/${pendingRejection.data.request.id}/reject`, {
        method: "PATCH",
        account: admin,
        body: { rejectionReason: "تعذر مطابقة البيانات" }
      });
      assert.equal(rejected.status, 200);
      assert.equal(await Notification.countDocuments({ userId: rejectionUser._id, type: "system" }), 1);
      assert.equal(rejected.data.request.status, "rejected");
      const rejectedAccount = await User.findById(rejectionUser._id).lean();
      assert.equal(rejectedAccount.isDisabled, false);
      assert.equal(rejectedAccount.phoneVerifiedAt, null);
    } finally {
      if (server?.listening) await new Promise((resolve) => server.close(resolve));
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
      }
      if (originalHmacSecret === undefined) delete process.env.PHONE_VERIFICATION_HMAC_SECRET;
      else process.env.PHONE_VERIFICATION_HMAC_SECRET = originalHmacSecret;
    }
  }
);
