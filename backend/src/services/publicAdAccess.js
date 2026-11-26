export function isPublicAdVisible(ad, now = new Date()) {
  if (!ad) return false;
  const isExpired = ad.expiresAt && new Date(ad.expiresAt) <= now;
  return ad.status === "approved"
    && !isExpired
    && ad.isVisible !== false
    && ad.isArchived !== true
    && ad.sold !== true
    && ad.isDeleted !== true;
}
