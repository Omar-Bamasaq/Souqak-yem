import test from "node:test";
import assert from "node:assert/strict";
import {
  AD_COMMISSION_ENABLED,
  AD_COMMISSION_RATE,
  calculateBuyerServiceFee,
  calculateSellerCommission
} from "../src/config/commission.js";

test("advertising commission is disabled without changing buyer fees", () => {
  assert.equal(AD_COMMISSION_ENABLED, false);
  assert.equal(AD_COMMISSION_RATE, 0.01);
  assert.equal(calculateBuyerServiceFee(1000), 30);
  assert.equal(calculateSellerCommission(100000), 0);
  assert.equal(1000 + calculateBuyerServiceFee(1000), 1030);
  assert.equal(1000 - calculateSellerCommission(1000), 1000);
});

test("reactivating advertising commission restores 1% only", () => {
  assert.equal(calculateSellerCommission(1000, true), 10);
  assert.equal(calculateBuyerServiceFee(1000), 30);
});
