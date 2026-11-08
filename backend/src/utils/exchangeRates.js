const DEFAULT_EXCHANGE_RATES = {
  USD: 1,
  SAR: 3.75,
  YER_SANAA: 530,
  YER_ADEN: 1600
};

const CURRENCIES = ["SAR", "YER_SANAA", "YER_ADEN"];

export function normalizeExchangeRatePairs(pairs = {}) {
  pairs = pairs || {};
  return Object.fromEntries(CURRENCIES.map((currency) => {
    return [currency, {
      buy: pairs[currency]?.buy ?? null,
      sell: pairs[currency]?.sell ?? null
    }];
  }));
}

export function normalizeExchangeRates(rates = {}, pairs = {}) {
  rates = rates || {};
  const normalizedPairs = normalizeExchangeRatePairs(pairs);
  return {
    USD: 1,
    SAR: normalizedPairs.SAR.sell ?? rates.SAR ?? DEFAULT_EXCHANGE_RATES.SAR,
    YER_SANAA: normalizedPairs.YER_SANAA.sell ?? rates.YER_SANAA ?? rates.YER ?? DEFAULT_EXCHANGE_RATES.YER_SANAA,
    YER_ADEN: normalizedPairs.YER_ADEN.sell ?? rates.YER_ADEN ?? DEFAULT_EXCHANGE_RATES.YER_ADEN
  };
}

export function getExchangeRate(rates, currency, pairs = {}) {
  const normalizedCurrency = currency === "YER" ? "YER_SANAA" : currency;
  const legacyRates = rates || {};
  const pairRate = normalizeExchangeRatePairs(pairs)[normalizedCurrency]?.sell;
  const rate = normalizedCurrency === "USD"
    ? 1
    : pairRate ?? normalizeExchangeRates(legacyRates)[normalizedCurrency];
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`سعر الصرف غير صالح للعملة ${currency}`);
  }
  return rate;
}
