import test from "node:test";
import assert from "node:assert/strict";
import {
  getStoreCurrencyLabel,
  getStorePlanTypeLabel,
  getStoreStatusLabel
} from "../src/utils/storeArabicLabels.js";

test("store UI labels known currencies, statuses, and plan types in Arabic", () => {
  assert.equal(getStoreCurrencyLabel("YER"), "ريال يمني");
  assert.equal(getStoreCurrencyLabel("YER_ADEN"), "ريال يمني (عدن)");
  assert.equal(getStoreCurrencyLabel("YER_SANAA"), "ريال يمني (صنعاء)");
  assert.equal(getStoreCurrencyLabel("SAR"), "ريال سعودي");
  assert.equal(getStoreCurrencyLabel("USD"), "دولار أمريكي");
  assert.equal(getStoreStatusLabel("Pending"), "قيد المراجعة");
  assert.equal(getStoreStatusLabel("family-production"), "غير محدد");
  assert.equal(getStorePlanTypeLabel("family-production"), "أسرة منتجة");
  assert.equal(getStorePlanTypeLabel("store"), "متجر");
});
