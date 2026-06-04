/**
 * Calculates the final price of a plan after applying any active discounts.
 * 
 * @param {Object} plan - The plan object from database
 * @returns {Object} Calculated price details
 */
export const getFinalPrice = (plan) => {
  const originalPrice = plan.price || 0;
  let finalPrice = originalPrice;
  let discountAmount = 0;
  let discountPercent = 0;
  let isSaleRunning = false;

  const now = new Date();
  
  // Check if sale is active and within date range
  const isActive = plan.isSaleActive;
  const isStarted = !plan.saleStartDate || now >= new Date(plan.saleStartDate);
  const isNotEnded = !plan.saleEndDate || now <= new Date(plan.saleEndDate);

  if (isActive && isStarted && isNotEnded) {
    isSaleRunning = true;

    if (plan.discountType === 'percentage') {
      discountPercent = plan.discountValue || 0;
      discountAmount = (originalPrice * discountPercent) / 100;
    } else if (plan.discountType === 'fixed') {
      discountAmount = plan.discountValue || 0;
      discountPercent = originalPrice > 0 ? Math.round((discountAmount / originalPrice) * 100) : 0;
    }

    finalPrice = originalPrice - discountAmount;
  }

  // Ensure price is not below zero
  if (finalPrice < 0) {
    finalPrice = 0;
    discountAmount = originalPrice;
  }

  return {
    originalPrice,
    finalPrice: Math.round(finalPrice),
    discountAmount: Math.round(discountAmount),
    discountPercent: Math.round(discountPercent),
    isSaleRunning,
    saleLabel: plan.saleLabel,
    saleType: plan.saleType,
    saleEndDate: plan.saleEndDate,
    remainingSlots: plan.remainingSlots,
    isPopularOffer: plan.isPopularOffer
  };
};
