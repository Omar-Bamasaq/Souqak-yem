function getAdenDateKey(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Aden",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function claimStoreAnalyticsView({ storeId, productId = null, storage, now = new Date() }) {
  if (!storeId) return false;

  const resourceId = productId || "store";
  const key = `souqak:store-analytics:${storeId}:${resourceId}:${getAdenDateKey(now)}`;
  try {
    const targetStorage = storage || window.sessionStorage;
    if (targetStorage.getItem(key)) return false;
    targetStorage.setItem(key, "1");
    return true;
  } catch {
    return false;
  }
}
