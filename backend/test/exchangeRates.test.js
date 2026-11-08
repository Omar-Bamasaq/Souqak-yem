import test from "node:test";
import assert from "node:assert/strict";
import {
  getExchangeRate,
  normalizeExchangeRatePairs,
  normalizeExchangeRates
} from "../src/utils/exchangeRates.js";

test("exchange rates expose exactly the canonical currencies and migrate legacy YER as Sanaa", () => {
  assert.deepEqual(normalizeExchangeRates({
    USD: 7,
    SAR: 3.8,
    YER: 600,
    YER_ADEN: 1700
  }), {
    USD: 1,
    SAR: 3.8,
    YER_SANAA: 600,
    YER_ADEN: 1700
  });
});

test("canonical Sanaa rate takes precedence over the legacy YER rate", () => {
  assert.equal(getExchangeRate({ YER: 600, YER_SANAA: 650 }, "YER_SANAA"), 650);
  assert.equal(getExchangeRate({ YER: 600 }, "YER"), 600);
});

test("buy and sell quotes are normalized independently and the sell quote is used for USD valuation", () => {
  const pairs = normalizeExchangeRatePairs(
    { YER_SANAA: { buy: 535, sell: 540 } }
  );

  assert.deepEqual(pairs.YER_SANAA, { buy: 535, sell: 540 });
  assert.equal(getExchangeRate({}, "YER_SANAA", pairs), 540);
  assert.equal(getExchangeRate({}, "YER", pairs), 540);
});

test("legacy single rates are not presented as verified buy and sell quotes", () => {
  assert.deepEqual(normalizeExchangeRatePairs(), {
    SAR: { buy: null, sell: null },
    YER_SANAA: { buy: null, sell: null },
    YER_ADEN: { buy: null, sell: null }
  });
});

test("exchange rates retain documented defaults and reject invalid or unsupported rates", () => {
  assert.deepEqual(normalizeExchangeRates(), {
    USD: 1,
    SAR: 3.75,
    YER_SANAA: 530,
    YER_ADEN: 1600
  });
  assert.throws(() => getExchangeRate({ YER_ADEN: 0 }, "YER_ADEN"), /سعر الصرف غير صالح/);
  assert.throws(() => getExchangeRate({}, "EUR"), /سعر الصرف غير صالح/);
});
