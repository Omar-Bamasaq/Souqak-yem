import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  hasReachedPasswordResetOtpAttemptLimit,
  isPasswordResetOtpLocked,
  PASSWORD_RESET_OTP_LOCK_MS,
  PASSWORD_RESET_OTP_MAX_ATTEMPTS,
  recordInvalidPasswordResetOtpAttempt
} from "../src/services/passwordResetOtp.js";

test("password reset attempts increment atomically and lock after the fifth failure", async () => {
  const record = { _id: "otp-1", attempts: 0 };
  const updates = [];
  const OtpCode = {
    async findOneAndUpdate(filter, update) {
      assert.equal(filter._id, record._id);
      assert.ok(filter.$and.some((condition) => condition.$or.some((choice) =>
        choice.attempts?.$lt === PASSWORD_RESET_OTP_MAX_ATTEMPTS
      )));
      record.attempts += update.$inc.attempts;
      return { ...record };
    },
    async updateOne(filter, update) {
      updates.push({ filter, update });
      record.lockedUntil = update.$set.lockedUntil;
      return { modifiedCount: 1 };
    }
  };
  const now = new Date("2026-10-21T00:00:00.000Z");

  for (let attempt = 1; attempt < PASSWORD_RESET_OTP_MAX_ATTEMPTS; attempt += 1) {
    assert.deepEqual(
      await recordInvalidPasswordResetOtpAttempt(OtpCode, record._id, now),
      { locked: false }
    );
  }
  assert.deepEqual(
    await recordInvalidPasswordResetOtpAttempt(OtpCode, record._id, now),
    { locked: true }
  );

  assert.equal(record.attempts, PASSWORD_RESET_OTP_MAX_ATTEMPTS);
  assert.equal(updates.length, 1);
  assert.equal(record.lockedUntil.getTime(), now.getTime() + PASSWORD_RESET_OTP_LOCK_MS);
  assert.equal(isPasswordResetOtpLocked(record, now), true);
});

test("password reset attempt limit includes attempts across recently issued codes", async () => {
  let aggregatePipeline;
  const OtpCode = {
    async aggregate(pipeline) {
      aggregatePipeline = pipeline;
      return [{ attempts: 5 }];
    }
  };

  assert.equal(
    await hasReachedPasswordResetOtpAttemptLimit(
      OtpCode,
      "owner@example.invalid",
      new Date("2026-10-21T00:00:00.000Z")
    ),
    true
  );
  assert.deepEqual(aggregatePipeline[0].$match.email, "owner@example.invalid");
  assert.equal(aggregatePipeline[1].$group.attempts.$sum.$ifNull[0], "$attempts");
});

test("password reset request history is retained and codes are not logged", () => {
  const authSource = fs.readFileSync(new URL("../src/routes/auth.js", import.meta.url), "utf8");
  const forgotRoute = authSource.split('router.post("/forgot-password"')[1].split('router.post("/verify-reset-otp"')[0];

  assert.match(forgotRoute, /OtpCode\.countDocuments/);
  assert.doesNotMatch(forgotRoute, /OtpCode\.deleteMany/);
  assert.doesNotMatch(forgotRoute, /console\.(?:log|info|warn|error).*code/i);

  const verifyRoute = authSource.split('router.post("/verify-reset-otp"')[1].split('router.post("/reset-password"')[0];
  const resetRoute = authSource.split('router.post("/reset-password"')[1].split('router.post("/test-email"')[0];
  assert.match(verifyRoute, /hasReachedPasswordResetOtpAttemptLimit/);
  assert.match(verifyRoute, /recordInvalidPasswordResetOtpAttempt/);
  assert.match(resetRoute, /hasReachedPasswordResetOtpAttemptLimit/);
  assert.match(resetRoute, /recordInvalidPasswordResetOtpAttempt/);
});
