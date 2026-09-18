// Central switch for the legacy 1% seller advertising commission.
export const AD_COMMISSION_ENABLED = false;
export const AD_COMMISSION_RATE = 0.01;

export function calculateSellerCommission(amount, enabled = AD_COMMISSION_ENABLED) {
  return enabled ? Math.round(Number(amount) * AD_COMMISSION_RATE) : 0;
}

export function calculateBuyerServiceFee(amount) {
  return Math.round(Number(amount) * 0.03);
}
