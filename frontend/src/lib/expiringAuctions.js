export const AUCTION_EXPIRY_PROMOTION_WINDOW_MS = 24 * 60 * 60 * 1000;

export function getExpiringAuctions(auctions, now = Date.now()) {
  return (Array.isArray(auctions) ? auctions : [])
    .filter((auction) => {
      if (auction.status !== "live") return false;
      const endTime = new Date(auction.endAt).getTime();
      const remaining = endTime - now;
      return Number.isFinite(endTime) &&
        remaining > 0 &&
        remaining < AUCTION_EXPIRY_PROMOTION_WINDOW_MS;
    })
    .sort((left, right) => new Date(left.endAt).getTime() - new Date(right.endAt).getTime());
}

export function formatAuctionCountdown(endAt, now = Date.now()) {
  const remainingSeconds = Math.max(0, Math.floor((new Date(endAt).getTime() - now) / 1000));
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;
  const format = (value) => String(value).padStart(2, "0");
  return `${format(hours)}:${format(minutes)}:${format(seconds)}`;
}
