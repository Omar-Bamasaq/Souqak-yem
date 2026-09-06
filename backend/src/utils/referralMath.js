export function calculateReferralReward(platformRevenueAmount, referralRate) {
  const revenue = Number(platformRevenueAmount);
  const rate = Number(referralRate);
  if (!Number.isFinite(revenue) || revenue < 0 || !Number.isFinite(rate) || rate < 0 || rate > 100) {
    throw new Error("Invalid referral calculation inputs");
  }
  return Math.round((revenue * rate) / 100);
}
