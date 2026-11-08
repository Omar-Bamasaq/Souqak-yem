export function isValidStoreDiscount(price, discountType, discountValue) {
  const basePrice = Number(price);
  const value = Number(discountValue);
  if (!Number.isFinite(basePrice) || basePrice <= 0 || !Number.isFinite(value) || value <= 0) return false;
  if (discountType === "percentage") {
    return Number.isInteger(value) && value <= 99;
  }
  return discountType === "fixed" && value <= basePrice;
}

export function getStoreProductPricing(product) {
  const originalPrice = Number(product?.price);
  const discountEnabled = product?.discountEnabled === true
    && isValidStoreDiscount(originalPrice, product?.discountType || "percentage", product?.discountValue);
  const discountType = discountEnabled ? (product?.discountType || "percentage") : "percentage";
  const discountValue = discountEnabled ? product.discountValue : 0;
  const unitPrice = !discountEnabled
    ? originalPrice
    : discountType === "percentage"
      ? Math.round(originalPrice * (100 - discountValue) / 100)
      : originalPrice - discountValue;

  return {
    discountEnabled,
    discountType,
    discountValue,
    originalPrice,
    unitPrice
  };
}
