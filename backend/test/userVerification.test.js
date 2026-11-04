import test from "node:test";
import assert from "node:assert/strict";
import {
  expiredVerificationFields,
  getExpiredVerificationFilter,
  isUserVerificationCurrent
} from "../src/services/userVerification.js";
import User from "../src/models/User.js";

const now = new Date("2025-01-01T00:00:00.000Z");

test("user schema persists identity documents and review status", () => {
  assert.ok(User.schema.path("idDocument"));
  assert.deepEqual(User.schema.path("identityStatus").enumValues, ["Pending", "Approved", "Rejected"]);
  assert.ok(User.schema.path("isIdentityVerified"));
});

function verifiedUser(overrides = {}) {
  return {
    verificationStatus: "verified",
    verificationExpiryDate: new Date("2025-01-02T00:00:00.000Z"),
    isDisabled: false,
    isDeleted: false,
    ...overrides
  };
}

test("verification requires the current status and a future expiry date", () => {
  assert.equal(isUserVerificationCurrent(verifiedUser(), now), true);
  for (const verificationStatus of ["unverified", "expired", "pending", "rejected", "unknown"]) {
    assert.equal(
      isUserVerificationCurrent(verifiedUser({ verificationStatus }), now),
      false,
      `${verificationStatus} must not count as current verification`
    );
  }
  assert.equal(
    isUserVerificationCurrent(
      verifiedUser({ verificationExpiryDate: new Date("2024-12-31T23:59:59.999Z") }),
      now
    ),
    false
  );
  assert.equal(
    isUserVerificationCurrent(verifiedUser({ verificationExpiryDate: now }), now),
    false
  );
});

test("missing and invalid expiry dates are not treated as current verification", () => {
  assert.equal(isUserVerificationCurrent(verifiedUser({ verificationExpiryDate: null }), now), false);
  assert.equal(
    isUserVerificationCurrent(verifiedUser({ verificationExpiryDate: "not-a-date" }), now),
    false
  );
});

test("disabled or deleted accounts are not currently verified", () => {
  assert.equal(isUserVerificationCurrent(verifiedUser({ isDisabled: true }), now), false);
  assert.equal(isUserVerificationCurrent(verifiedUser({ isDeleted: true }), now), false);
});

test("legacy fields and email verification alone do not confer current verification", () => {
  assert.equal(
    isUserVerificationCurrent({
      verified: true,
      isVerifiedSeller: true,
      verificationExpiresAt: new Date("2025-01-02T00:00:00.000Z"),
      isEmailVerified: true
    }, now),
    false
  );
});

test("expiration query and compatibility flags use the canonical verification fields", () => {
  assert.deepEqual(getExpiredVerificationFilter(now), {
    verificationStatus: "verified",
    verificationExpiryDate: { $lte: now }
  });
  assert.deepEqual(expiredVerificationFields, {
    verificationStatus: "expired",
    verified: false,
    isVerifiedSeller: false
  });
});

test("renewal to a future expiry immediately restores current verification", () => {
  const renewedUser = verifiedUser({
    verificationStatus: "verified",
    verificationExpiryDate: new Date("2026-01-01T00:00:00.000Z")
  });
  assert.equal(isUserVerificationCurrent(renewedUser, now), true);
});
