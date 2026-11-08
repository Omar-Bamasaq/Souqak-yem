export function isUserVerificationCurrent(user, now = new Date()) {
  if (!user || user.isDisabled || user.isDeleted || user.verificationStatus !== "verified") {
    return false;
  }

  const expiryTime = new Date(user.verificationExpiryDate).getTime();
  return Number.isFinite(expiryTime) && expiryTime > now.getTime();
}
