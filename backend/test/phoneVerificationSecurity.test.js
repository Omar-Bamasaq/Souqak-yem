import test from "node:test";
import assert from "node:assert/strict";
import User from "../src/models/User.js";
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

test("ad creation phone guard rejects unverified accounts and allows verified accounts", () => {
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

  requirePhoneVerification({ user: { phone: "771234567", phoneVerifiedAt: null } }, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(statusCode, 403);
  assert.equal(body.code, "PHONE_VERIFICATION_REQUIRED");

  statusCode = null;
  requirePhoneVerification({ user: { phone: "771234567", phoneVerifiedAt: new Date() } }, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.equal(statusCode, null);
});
