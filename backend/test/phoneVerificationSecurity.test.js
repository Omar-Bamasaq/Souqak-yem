import test from "node:test";
import assert from "node:assert/strict";
import User from "../src/models/User.js";
import SystemSettings from "../src/models/SystemSettings.js";
import requirePhoneVerification from "../src/middleware/requirePhoneVerification.js";
import {
  buildPhoneVerificationWhatsAppLink,
  generatePhoneVerificationCode,
  hashPhoneVerificationCode,
  phoneVerificationCodeMatches,
  PHONE_VERIFICATION_CODE_TTL_MS
} from "../src/services/phoneVerification.js";

test("phone verification codes are six digits and expire after ten minutes", () => {
  assert.equal(PHONE_VERIFICATION_CODE_TTL_MS, 10 * 60 * 1000);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    assert.match(generatePhoneVerificationCode(), /^\d{6}$/);
  }
});

test("verification code hashes are bound to one request, user, and phone", () => {
  const previousSecret = process.env.PHONE_VERIFICATION_HMAC_SECRET;
  process.env.PHONE_VERIFICATION_HMAC_SECRET = "local-test-secret-with-at-least-32-bytes";
  try {
    const identity = {
      requestId: "request-one",
      userId: "user-one",
      phone: "771234567"
    };
    const code = "004271";
    const hash = hashPhoneVerificationCode({ ...identity, code });
    assert.equal(phoneVerificationCodeMatches(code, hash, identity), true);
    assert.equal(phoneVerificationCodeMatches("004272", hash, identity), false);
    assert.equal(phoneVerificationCodeMatches(code, hash, { ...identity, userId: "user-two" }), false);
    assert.equal(phoneVerificationCodeMatches(code, hash, { ...identity, requestId: "request-two" }), false);
    assert.equal(phoneVerificationCodeMatches(code, hash, { ...identity, phone: "779876543" }), false);
  } finally {
    if (previousSecret === undefined) delete process.env.PHONE_VERIFICATION_HMAC_SECRET;
    else process.env.PHONE_VERIFICATION_HMAC_SECRET = previousSecret;
  }
});

test("phone verification service fails explicitly without its HMAC secret", () => {
  const previousSecret = process.env.PHONE_VERIFICATION_HMAC_SECRET;
  delete process.env.PHONE_VERIFICATION_HMAC_SECRET;
  try {
    assert.throws(
      () => hashPhoneVerificationCode({ requestId: "r", userId: "u", phone: "771234567", code: "123456" }),
      (error) => error.code === "PHONE_VERIFICATION_SECRET_MISSING"
    );
  } finally {
    if (previousSecret !== undefined) process.env.PHONE_VERIFICATION_HMAC_SECRET = previousSecret;
  }
});

test("manual WhatsApp link contains the recipient and code but does not send it", () => {
  const link = buildPhoneVerificationWhatsAppLink("771234567", "004271");
  assert.match(link, /^https:\/\/wa\.me\/967771234567\?/);
  assert.match(decodeURIComponent(link), /004271/);
});

test("the phone number unique index ignores empty or absent values", () => {
  const phoneIndex = User.schema.indexes().find(([keys]) => keys.phone === 1);
  assert.ok(phoneIndex);
  assert.equal(phoneIndex[1].unique, true);
  assert.deepEqual(phoneIndex[1].partialFilterExpression, {
    phone: { $type: "string", $gt: "" }
  });
});

async function runPhoneGuard(user) {
  let nextCalled = false;
  let statusCode = null;
  let body = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      body = value;
      return this;
    }
  };

  await requirePhoneVerification({ user }, res, () => {
    nextCalled = true;
  });
  return { nextCalled, statusCode, body };
}

test("ad creation requires verification by default, including settings without the new field", async () => {
  const originalGetSettings = SystemSettings.getSettings;
  try {
    for (const settings of [{ requirePhoneVerificationForAds: true }, {}]) {
      SystemSettings.getSettings = async () => settings;
      const result = await runPhoneGuard({ phone: "771234567", phoneVerifiedAt: null });
      assert.equal(result.nextCalled, false);
      assert.equal(result.statusCode, 403);
      assert.equal(result.body.code, "PHONE_VERIFICATION_REQUIRED");

      const verified = await runPhoneGuard({ phone: "771234567", phoneVerifiedAt: new Date() });
      assert.equal(verified.nextCalled, true);
    }
    assert.equal(SystemSettings.schema.path("requirePhoneVerificationForAds").defaultValue, true);
  } finally {
    SystemSettings.getSettings = originalGetSettings;
  }
});

test("disabling ad verification only bypasses verification for users with a valid phone", async () => {
  const originalGetSettings = SystemSettings.getSettings;
  SystemSettings.getSettings = async () => ({ requirePhoneVerificationForAds: false });
  try {
    const unverified = await runPhoneGuard({ phone: "771234567", phoneVerifiedAt: null });
    assert.equal(unverified.nextCalled, true);

    const verified = await runPhoneGuard({ phone: "771234567", phoneVerifiedAt: new Date() });
    assert.equal(verified.nextCalled, true);

    const invalidPhone = await runPhoneGuard({ phone: "", phoneVerifiedAt: null });
    assert.equal(invalidPhone.nextCalled, false);
    assert.equal(invalidPhone.statusCode, 403);
    assert.equal(invalidPhone.body.code, "PHONE_VERIFICATION_REQUIRED");
  } finally {
    SystemSettings.getSettings = originalGetSettings;
  }
});

test("a settings read failure falls back to requiring phone verification", async () => {
  const originalGetSettings = SystemSettings.getSettings;
  const originalConsoleError = console.error;
  SystemSettings.getSettings = async () => {
    throw new Error("local settings read failure");
  };
  console.error = () => {};
  try {
    const result = await runPhoneGuard({ phone: "771234567", phoneVerifiedAt: null });
    assert.equal(result.nextCalled, false);
    assert.equal(result.statusCode, 403);
    assert.equal(result.body.code, "PHONE_VERIFICATION_REQUIRED");
  } finally {
    SystemSettings.getSettings = originalGetSettings;
    console.error = originalConsoleError;
  }
});
