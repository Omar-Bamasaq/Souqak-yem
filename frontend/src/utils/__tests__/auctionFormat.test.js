import test from "node:test";
import assert from "node:assert/strict";
import {
  compareAuctionAmounts,
  getAuctionError,
  stepAuctionBidAmount
} from "../auctionFormat.js";

test("auction timeout errors explain that the draft may already exist", () => {
  const message = getAuctionError({ code: "ECONNABORTED", message: "timeout of 60000ms exceeded" });
  assert.match(message, /تحقق من مسوداتك/);
  assert.match(message, /مسودة مكررة/);
});

test("auction API errors keep their server message", () => {
  assert.equal(getAuctionError({ response: { data: { error: "بيانات المزاد غير صالحة." } } }), "بيانات المزاد غير صالحة.");
});

test("bid controls add and subtract exactly one minimum increment", () => {
  assert.equal(stepAuctionBidAmount("550", "50", "550", 1), "600");
  assert.equal(stepAuctionBidAmount("600", "50", "550", -1), "550");
});

test("decreasing a bid never crosses its minimum amount", () => {
  assert.equal(stepAuctionBidAmount("550", "50", "550", -1), "550");
  assert.equal(stepAuctionBidAmount("575", "50", "550", -1), "550");
});

test("bid controls preserve exact decimal values", () => {
  assert.equal(stepAuctionBidAmount("10.10", "0.05", "10.15", 1), "10.15");
  assert.equal(stepAuctionBidAmount("10.15", "0.05", "10.15", -1), "10.15");
  assert.equal(compareAuctionAmounts("10.15", "10.150"), 0);
});
