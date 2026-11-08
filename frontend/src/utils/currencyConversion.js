export const CURRENCIES = [
  { code: "YER_SANAA", label: "ريال يمني (صنعاء)" },
  { code: "YER_ADEN", label: "ريال يمني (عدن)" },
  { code: "USD", label: "دولار أمريكي" },
  { code: "SAR", label: "ريال سعودي" }
];

export function normalizeCurrencyCode(code) {
  return code === "YER" ? "YER_SANAA" : code;
}

export function formatConvertedAmount(amount, currency) {
  const maximumFractionDigits = currency === "USD" || currency === "SAR" ? 2 : 0;
  return Number(amount).toLocaleString("en-US", { maximumFractionDigits });
}

export function convertCurrency(amount, fromCurrency, toCurrency, rates) {
  const normalizedFrom = normalizeCurrencyCode(fromCurrency);
  const normalizedTo = normalizeCurrencyCode(toCurrency);
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount < 0) return null;
  if (normalizedFrom === normalizedTo) return numericAmount;

  const fromSellRate = normalizedFrom === "USD" ? 1 : Number(rates?.[normalizedFrom]?.sell);
  const toBuyRate = normalizedTo === "USD" ? 1 : Number(rates?.[normalizedTo]?.buy);

  if (
    !Number.isFinite(fromSellRate) ||
    fromSellRate <= 0 ||
    !Number.isFinite(toBuyRate) ||
    toBuyRate <= 0
  ) {
    return null;
  }

  const amountInUsd = normalizedFrom === "USD" ? numericAmount : numericAmount / fromSellRate;
  return normalizedTo === "USD" ? amountInUsd : amountInUsd * toBuyRate;
}
