import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateWalletServiceTotals,
  isWalletServiceQuantityAllowed,
  normalizeFeeBands,
  upgradeLegacyFeeBands
} from "../src/utils/walletServicePricing.js";

test("fee bands match inclusive cent boundaries and select the next band at its start", () => {
  const bands = normalizeFeeBands([
    { currency: "USD", minimumAmount: 1, maximumAmount: 5.99, feeAmount: 0.5 },
    { currency: "USD", minimumAmount: 6, maximumAmount: 10, feeAmount: 1 }
  ]);

  assert.deepEqual(calculateWalletServiceTotals(5.99, "USD", bands), {
    serviceAmount: 5.99, platformFee: 0.5, totalAmount: 6.49
  });
  assert.deepEqual(calculateWalletServiceTotals(5.995, "USD", bands), {
    serviceAmount: 6, platformFee: 1, totalAmount: 7
  });
  assert.deepEqual(calculateWalletServiceTotals(6, "USD", bands), {
    serviceAmount: 6, platformFee: 1, totalAmount: 7
  });
});

test("fee bands reject overlaps and any one-cent gap for the same currency", () => {
  assert.throws(() => normalizeFeeBands([
    { currency: "USD", minimumAmount: 1, maximumAmount: 5.99, feeAmount: 0.5 },
    { currency: "USD", minimumAmount: 5.99, maximumAmount: 10, feeAmount: 1 }
  ]), /لا يجوز أن تتداخل/);

  assert.throws(() => normalizeFeeBands([
    { currency: "USD", minimumAmount: 1, maximumAmount: 5.99, feeAmount: 0.5 },
    { currency: "USD", minimumAmount: 6.01, maximumAmount: 10, feeAmount: 1 }
  ]), /دون فجوات/);
});

test("fee ranges remain independent across currencies and reject precision below one cent", () => {
  const bands = normalizeFeeBands([
    { currency: "SAR", minimumAmount: 0, maximumAmount: 20, feeAmount: 0.25 },
    { currency: "USD", minimumAmount: 0, maximumAmount: 20, feeAmount: 0.5 }
  ]);

  assert.deepEqual(calculateWalletServiceTotals(3.335, "USD", bands), {
    serviceAmount: 3.34, platformFee: 0.5, totalAmount: 3.84
  });
  assert.throws(() => normalizeFeeBands([
    { currency: "USD", minimumAmount: 0.001, maximumAmount: 20, feeAmount: 0.5 }
  ]), /قيم شريحة الرسوم غير صالحة/);
  assert.throws(() => calculateWalletServiceTotals(21, "USD", bands), /لا توجد شريحة رسوم/);
});

test("legacy fee settings are bridged at one-cent precision without changing the later band's start", () => {
  const legacy = [
    { currency: "USD", minimumAmount: 6, maximumAmount: 10, feeAmount: 1 },
    { currency: "USD", minimumAmount: 1, maximumAmount: 5, feeAmount: 0.5 }
  ];
  const upgraded = normalizeFeeBands(upgradeLegacyFeeBands(legacy));

  assert.deepEqual(upgraded, [
    { currency: "USD", minimumAmount: 1, maximumAmount: 5.99, feeAmount: 0.5 },
    { currency: "USD", minimumAmount: 6, maximumAmount: 10, feeAmount: 1 }
  ]);
  assert.deepEqual(calculateWalletServiceTotals(5.5, "USD", upgraded), {
    serviceAmount: 5.5, platformFee: 0.5, totalAmount: 6
  });
  assert.throws(() => upgradeLegacyFeeBands([
    { currency: "USD", minimumAmount: 1, maximumAmount: 5, feeAmount: 0.5 },
    { currency: "USD", minimumAmount: 4, maximumAmount: 10, feeAmount: 1 }
  ]), /تداخل/);
});

test("quantity minimum and maximum can be disabled independently", () => {
  const service = {
    minimumQuantityEnabled: true,
    minimumQuantity: 3,
    maximumQuantityEnabled: false,
    maximumQuantity: 5
  };

  assert.equal(isWalletServiceQuantityAllowed(2, service), false);
  assert.equal(isWalletServiceQuantityAllowed(3, service), true);
  assert.equal(isWalletServiceQuantityAllowed(6, service), true);
  assert.equal(isWalletServiceQuantityAllowed(2, { ...service, minimumQuantityEnabled: false }), true);
  assert.equal(isWalletServiceQuantityAllowed(0, { ...service, minimumQuantityEnabled: false }), false);
  assert.equal(isWalletServiceQuantityAllowed(1.5, { ...service, minimumQuantityEnabled: false }), false);
  assert.equal(isWalletServiceQuantityAllowed(Number.MAX_SAFE_INTEGER + 1, { ...service, minimumQuantityEnabled: false }), false);
});
