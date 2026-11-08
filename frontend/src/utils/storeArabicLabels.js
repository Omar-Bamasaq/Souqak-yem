const CURRENCY_LABELS = {
  YER: "ريال يمني",
  YER_ADEN: "ريال يمني (عدن)",
  YER_SANAA: "ريال يمني (صنعاء)",
  SAR: "ريال سعودي",
  USD: "دولار أمريكي"
};

const STATUS_LABELS = {
  pending: "قيد المراجعة",
  active: "نشط",
  suspended: "موقوف",
  rejected: "مرفوض",
  inactive: "غير نشط",
  expired: "منتهي",
  cancelled: "ملغى",
  approved: "معتمد",
  new: "جديد",
  processing: "قيد التجهيز",
  completed: "مكتمل"
};

const PLAN_TYPE_LABELS = {
  store: "متجر",
  "family-production": "أسرة منتجة",
  featured: "إعلان مميز",
  verification: "توثيق"
};

export function getStoreCurrencyLabel(currency) {
  return CURRENCY_LABELS[currency] || "عملة غير محددة";
}

export function getStoreStatusLabel(status) {
  return STATUS_LABELS[String(status || "").toLowerCase()] || "غير محدد";
}

export function getStorePlanTypeLabel(type) {
  return PLAN_TYPE_LABELS[type] || "غير محدد";
}
