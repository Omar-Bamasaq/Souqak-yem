import test from "node:test";
import assert from "node:assert/strict";
import { isUserVerificationCurrent } from "../userVerification.js";

const now = new Date("2026-10-31T12:00:00.000Z");

test("verification is current only when verified and not expired", () => {
  assert.equal(isUserVerificationCurrent({
    verificationStatus: "verified",
    verificationExpiryDate: "2026-11-01T00:00:00.000Z"
  }, now), true);
  assert.equal(isUserVerificationCurrent({
    verificationStatus: "verified",
    verificationExpiryDate: "2026-10-31T12:00:00.000Z"
  }, now), false);
  assert.equal(isUserVerificationCurrent({
    verificationStatus: "expired",
    verificationExpiryDate: "2026-11-01T00:00:00.000Z"
  }, now), false);
});

test("disabled, deleted, and invalidly dated accounts are not currently verified", () => {
  const verifiedUser = {
    verificationStatus: "verified",
    verificationExpiryDate: "2026-11-01T00:00:00.000Z"
  };
  assert.equal(isUserVerificationCurrent({ ...verifiedUser, isDisabled: true }, now), false);
  assert.equal(isUserVerificationCurrent({ ...verifiedUser, isDeleted: true }, now), false);
  assert.equal(isUserVerificationCurrent({ ...verifiedUser, verificationExpiryDate: "invalid" }, now), false);
});
