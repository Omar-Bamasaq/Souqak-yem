const AD_SERVICE_LABELS = {
  featured: "تمييز الإعلان",
  placement: "تثبيت الإعلان",
  interstitial: "إعلان ترويجي"
};

const PLAN_TYPE_LABELS = {
  verification: "توثيق الحساب",
  store: "اشتراك متجر سوقك",
  "family-production": "اشتراك صناعات سوقك"
};

export function getPurchaseRequestDisplay(request) {
  const planType = request.planSnapshot?.type || request.plan?.type;
  const serviceType = request.campaign?.serviceType
    || request.planSnapshot?.adServiceType
    || request.plan?.adServiceType
    || "featured";
  const serviceLabel = planType === "featured"
    ? AD_SERVICE_LABELS[serviceType] || "خدمة إعلانية"
    : PLAN_TYPE_LABELS[planType] || request.planSnapshot?.name || request.plan?.name || "طلب خدمة";

  return {
    serviceLabel,
    targetName: request.product?.title || request.storeName || request.storeProfile?.storeName || "",
    planName: request.planSnapshot?.name || request.plan?.name || "",
    durationInDays: request.duration
      || request.planSnapshot?.durationInDays
      || request.plan?.durationInDays
      || 0,
    includesSocialPromotion: Boolean(
      request.campaign?.socialPromotionRequested
      || request.planSnapshot?.socialPromotionRequested
    )
  };
}
