export function isUserVerificationCurrent(user, now = new Date()) {
  if (!user || user.isDisabled || user.isDeleted || user.verificationStatus !== "verified") {
    return false;
  }

  const expiryTime = new Date(user.verificationExpiryDate).getTime();
  return Number.isFinite(expiryTime) && expiryTime > now.getTime();
}

export function getExpiredVerificationFilter(now) {
  return {
    verificationStatus: "verified",
    verificationExpiryDate: { $lte: now }
  };
}

export const expiredVerificationFields = Object.freeze({
  verificationStatus: "expired",
  verified: false,
  isVerifiedSeller: false
});
