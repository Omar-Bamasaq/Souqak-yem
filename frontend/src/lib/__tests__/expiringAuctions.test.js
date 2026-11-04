import test from "node:test";
import assert from "node:assert/strict";
import {
  AUCTION_EXPIRY_PROMOTION_WINDOW_MS,
  formatAuctionCountdown,
  getExpiringAuctions
} from "../expiringAuctions.js";

const now = Date.parse("2026-10-31T12:00:00.000Z");

test("promotes only live auctions ending within the next 24 hours", () => {
  const auctions = [
    { id: "later", status: "live", endAt: new Date(now + AUCTION_EXPIRY_PROMOTION_WINDOW_MS + 1).toISOString() },
    { id: "later-ending", status: "live", endAt: new Date(now + 60 * 60 * 1000).toISOString() },
    { id: "soonest", status: "live", endAt: new Date(now + 10 * 60 * 1000).toISOString() },
    { id: "scheduled", status: "scheduled", endAt: new Date(now + 5 * 60 * 1000).toISOString() },
    { id: "ended", status: "live", endAt: new Date(now).toISOString() }
  ];

  assert.deepEqual(getExpiringAuctions(auctions, now).map(({ id }) => id), ["soonest", "later-ending"]);
});

test("formats a live auction countdown as hours, minutes, and seconds", () => {
  assert.equal(formatAuctionCountdown(new Date(now + 90_061_000).toISOString(), now), "25:01:01");
  assert.equal(formatAuctionCountdown(new Date(now - 1).toISOString(), now), "00:00:00");
});
