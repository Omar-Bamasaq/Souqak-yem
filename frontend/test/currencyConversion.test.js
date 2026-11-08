import test from "node:test";
import assert from "node:assert/strict";
import {
  CURRENCIES,
  convertCurrency,
  formatConvertedAmount,
  normalizeCurrencyCode
} from "../src/utils/currencyConversion.js";

const rates = {
  SAR: { buy: 3.74, sell: 3.76 },
  YER_SANAA: { buy: 535, sell: 540 },
  YER_ADEN: { buy: 1590, sell: 1610 }
};

test("currency calculator offers only the four supported currencies", () => {
  assert.deepEqual(CURRENCIES.map(({ code }) => code), ["YER_SANAA", "YER_ADEN", "USD", "SAR"]);
});

test("converts accurately through the USD reference rate", () => {
  assert.equal(convertCurrency(1, "USD", "YER_SANAA", rates), 535);
  assert.equal(convertCurrency(540, "YER_SANAA", "USD", rates), 1);
  assert.equal(convertCurrency(1, "USD", "YER_ADEN", rates), 1590);
  assert.equal(convertCurrency(1610, "YER_ADEN", "USD", rates), 1);
  assert.equal(convertCurrency(540, "YER_SANAA", "SAR", rates), 3.74);
  assert.equal(convertCurrency(3.76, "SAR", "USD", rates), 1);
});

test("maps legacy YER to Sanaa and keeps same-currency conversion exact", () => {
  assert.equal(normalizeCurrencyCode("YER"), "YER_SANAA");
  assert.equal(convertCurrency(540, "YER", "USD", rates), 1);
  assert.equal(convertCurrency(100, "YER", "YER_SANAA", rates), 100);
});

test("returns no estimate for invalid amounts or missing/invalid exchange rates", () => {
  assert.equal(convertCurrency(-1, "USD", "SAR", rates), null);
  assert.equal(convertCurrency("abc", "USD", "SAR", rates), null);
  assert.equal(convertCurrency(10, "EUR", "USD", rates), null);
  assert.equal(convertCurrency(10, "USD", "SAR", { ...rates, SAR: { buy: 0, sell: 3.76 } }), null);
});

test("formats decimal digits only for USD and SAR, with a whole-number display for Yemeni rials", () => {
  assert.equal(formatConvertedAmount(18746004.01, "YER_ADEN"), "18,746,004");
  assert.equal(formatConvertedAmount(18746004.99, "YER_SANAA"), "18,746,005");
  assert.equal(formatConvertedAmount(1196.23, "USD"), "1,196.23");
  assert.equal(formatConvertedAmount(12567.5, "SAR"), "12,567.5");
});
