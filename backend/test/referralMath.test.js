import test from "node:test";
import assert from "node:assert/strict";
import { calculateReferralReward } from "../src/utils/referralMath.js";

test("sale reward is 10% of the 1% platform commission", () => {
  assert.equal(calculateReferralReward(1000, 10), 100);
});

test("safe purchase reward is 10% of buyer protection fee only", () => {
  assert.equal(calculateReferralReward(3000, 10), 300);
  assert.notEqual(calculateReferralReward(4000, 10), 300);
});

test("promotion reward uses eligible promotion revenue", () => {
  assert.equal(calculateReferralReward(10000, 10), 1000);
});
