export function buildAdShareUrl(origin, adId) {
  return `${String(origin).replace(/\/$/, "")}/ad/${encodeURIComponent(adId)}`;
}
