const MONGO_OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

export function isPublicAdIndexable(ad, now = Date.now()) {
  if (!ad || !MONGO_OBJECT_ID_PATTERN.test(String(ad._id || ""))) return false;
  if (ad.status !== "approved") return false;
  if (
    ad.isDeleted === true ||
    ad.isVisible === false ||
    ad.isArchived === true ||
    ad.sold === true ||
    ad.isSold === true
  ) return false;
  if (ad.isAvailable === false) return false;

  const expiresAt = ad.expiresAt instanceof Date
    ? ad.expiresAt.getTime()
    : Date.parse(ad.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > now;
}
