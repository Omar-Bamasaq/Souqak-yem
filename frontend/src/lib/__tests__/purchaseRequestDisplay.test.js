import test from "node:test";
import assert from "node:assert/strict";
import { getPurchaseRequestDisplay } from "../purchaseRequestDisplay.js";

test("purchase request display distinguishes advertising service types and target ad", () => {
  const display = getPurchaseRequestDisplay({
    planSnapshot: {
      type: "featured",
      adServiceType: "placement",
      name: "باقة 180 يوم",
      durationInDays: 180,
      socialPromotionRequested: true
    },
    product: { title: "سيارة للبيع" }
  });

  assert.deepEqual(display, {
    serviceLabel: "تثبيت الإعلان",
    targetName: "سيارة للبيع",
    planName: "باقة 180 يوم",
    durationInDays: 180,
    includesSocialPromotion: true
  });
});

test("purchase request display identifies other plan types and handles legacy records", () => {
  assert.equal(
    getPurchaseRequestDisplay({ plan: { type: "store", name: "الباقة المتقدمة" } }).serviceLabel,
    "اشتراك متجر سوقك"
  );
  assert.equal(
    getPurchaseRequestDisplay({ plan: { type: "family-production" } }).serviceLabel,
    "اشتراك صناعات سوقك"
  );
  assert.equal(
    getPurchaseRequestDisplay({ plan: { name: "خدمة قديمة" } }).serviceLabel,
    "خدمة قديمة"
  );
});
