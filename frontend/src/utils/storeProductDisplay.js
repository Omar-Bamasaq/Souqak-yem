export function getStoreProductAvailabilityLabel(product) {
  if (!product?.storeProfileId) return null;
  return product.isAvailable === false ? "غير متوفر" : "متوفر";
}