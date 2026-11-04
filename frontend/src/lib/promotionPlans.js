export const PROMOTION_SERVICE_GROUPS = [
  {
    key: "featured",
    title: "تثبيت وتمييز الإعلان",
    description: "أبرز إعلانك بشارة «مميز» ولمدة الباقة المختارة.",
    icon: "⭐",
    theme: {
      section: "border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-stone-100",
      divider: "border-amber-200",
      icon: "bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-900/15",
      card: "border-amber-200 bg-gradient-to-br from-white via-amber-50/90 to-orange-50 hover:border-amber-300",
      price: "border-amber-100",
      button: "bg-amber-600 hover:bg-amber-700"
    }
  },
  {
    key: "interstitial",
    title: "الإعلان المؤقت",
    description: "اعرض إعلانك في نافذة مؤقتة وفق وقت الانتظار وحد التكرار المحددين.",
    icon: "⏱️",
    theme: {
      section: "border-violet-200 bg-gradient-to-br from-violet-50 via-purple-50 to-slate-100",
      divider: "border-violet-200",
      icon: "bg-gradient-to-br from-violet-600 to-purple-700 shadow-violet-900/15",
      card: "border-violet-200 bg-gradient-to-br from-white via-violet-50/90 to-purple-50 hover:border-violet-300",
      price: "border-violet-100",
      button: "bg-violet-700 hover:bg-violet-800"
    }
  },
  {
    key: "placement",
    title: "المساحات الإعلانية",
    description: "اعرض إعلانك الممول في المواضع المحددة داخل التطبيق.",
    icon: "📣",
    theme: {
      section: "border-teal-200 bg-gradient-to-br from-teal-50 via-cyan-50 to-slate-100",
      divider: "border-teal-200",
      icon: "bg-gradient-to-br from-teal-600 to-cyan-700 shadow-teal-900/15",
      card: "border-teal-200 bg-gradient-to-br from-white via-teal-50/90 to-cyan-50 hover:border-teal-300",
      price: "border-teal-100",
      button: "bg-teal-700 hover:bg-teal-800"
    }
  }
];

const PLACEMENT_LABELS = {
  home: "الصفحة الرئيسية",
  between_ads: "بين بطاقات الإعلانات",
  category: "صفحات التصنيفات"
};

export function groupPromotionPlans(plans) {
  const activePlans = (Array.isArray(plans) ? plans : []).filter(
    (plan) => plan?.type === "featured" && plan.isActive === true
  );

  return PROMOTION_SERVICE_GROUPS.map((group) => ({
    ...group,
    plans: activePlans.filter((plan) =>
      (plan.adServiceType || "featured") === group.key
    )
  }));
}

export function getPromotionPlanFeatures(plan) {
  const features = [];

  if (plan.adServiceType === "interstitial") {
    features.push(`يبدأ العرض بعد انتظار ${plan.interstitialDelaySeconds ?? 8} ثوانٍ`);
    features.push(`حد إعادة العرض: مرة كل ${plan.frequencyCapHours ?? 24} ساعة`);
  } else if (plan.adServiceType === "placement") {
    const positions = (plan.adPositions || [])
      .map((position) => PLACEMENT_LABELS[position])
      .filter(Boolean);
    if (positions.length) features.push(`ظهور ممول في: ${positions.join("، ")}`);
    features.push("النقر يفتح صفحة الإعلان الأصلية");
  } else {
    features.push("شارة «مميز» وإبراز بصري للإعلان");
  }

  if (plan.socialPromotionIncluded) {
    features.push("طلب ترويج يدوي عبر حسابات سوقك الرسمية مشمول");
  } else if (Number(plan.socialPromotionPrice) > 0) {
    features.push("يتاح طلب ترويج يدوي كإضافة مدفوعة");
  }

  if (Array.isArray(plan.features)) {
    features.push(...plan.features.filter((feature) => typeof feature === "string" && feature.trim()));
  }

  return features;
}

export function promotionCurrencyLabel(currency) {
  return {
    YER_ADEN: "ريال يمني (عدن)",
    YER_SANAA: "ريال يمني (صنعاء)",
    YER: "ريال يمني",
    SAR: "ريال سعودي",
    USD: "دولار أمريكي"
  }[currency] || "ريال يمني";
}

export function getPromotionPlanCardData(plan) {
  return {
    name: plan.name,
    description: plan.description || "",
    price: Number(plan.isSaleRunning ? plan.finalPrice ?? plan.price ?? 0 : plan.price ?? 0),
    originalPrice: Number(plan.originalPrice ?? plan.price ?? 0),
    durationInDays: plan.durationInDays,
    currency: promotionCurrencyLabel(plan.currency),
    features: getPromotionPlanFeatures(plan)
  };
}
