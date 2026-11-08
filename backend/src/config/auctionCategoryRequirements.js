const field = (key, label, type, options = {}) => ({
  key,
  label,
  type,
  required: false,
  public: true,
  ...options
});

const vehicle = {
  type: "vehicle",
  supported: true,
  publicListingEnabled: true,
  documentPolicyApproved: true,
  documents: ["ownership", "owner-identity"],
  documentRequirements: [
    {
      key: "ownership",
      label: "إثبات ملكية المركبة / استمارة المركبة",
      required: true,
      oneOfGroup: null,
      manualReview: true,
      confidential: true,
      expiryMatters: false,
      reReviewFields: [
        "manufacturer", "model", "year", "vehicleType",
        "registrationStatus", "vin"
      ]
    },
    {
      key: "owner-identity",
      label: "هوية مالك المركبة",
      required: true,
      oneOfGroup: null,
      manualReview: true,
      confidential: true,
      expiryMatters: false,
      reReviewFields: [
        "manufacturer", "model", "year", "vehicleType",
        "registrationStatus", "vin"
      ]
    }
  ],
  documentPolicyVersion: 2,
  requiredDocumentCount: 2,
  fields: [
    field("manufacturer", "الشركة المصنعة", "text", { required: true }),
    field("model", "الموديل", "text", { required: true }),
    field("trim", "الفئة أو الطراز الفرعي", "text", { maxLength: 120 }),
    field("year", "سنة الصنع", "number", { required: true }),
    field("vehicleType", "نوع المركبة", "select", {
      required: true,
      options: [
        { value: "car", label: "سيارة" },
        { value: "motorcycle", label: "دراجة نارية" },
        { value: "truck", label: "شاحنة" },
        { value: "other", label: "أخرى" }
      ]
    }),
    field("fuelType", "نوع الوقود", "select", {
      required: true,
      options: [
        { value: "petrol", label: "بنزين" },
        { value: "diesel", label: "ديزل" },
        { value: "electric", label: "كهرباء" },
        { value: "hybrid", label: "هجين" },
        { value: "other", label: "أخرى" }
      ]
    }),
    field("transmission", "ناقل الحركة", "select", {
      required: true,
      options: [
        { value: "manual", label: "يدوي" },
        { value: "automatic", label: "أوتوماتيكي" },
        { value: "other", label: "أخرى" }
      ]
    }),
    field("engineCapacityCc", "سعة المحرك (سم³، عند انطباقها)", "number", {
      visibleWhen: { key: "vehicleType", oneOf: ["car", "motorcycle", "truck"] }
    }),
    field("mileageKm", "المسافة المقطوعة (كم)", "number", { required: true }),
    field("registrationStatus", "حالة التسجيل", "select", {
      required: true,
      options: [
        { value: "valid", label: "ساري" },
        { value: "expired", label: "منتهي" },
        { value: "unregistered", label: "غير مسجل" },
        { value: "unknown", label: "غير معروف" }
      ]
    }),
    field("vehicleCondition", "الحالة العامة للمركبة", "textarea", { required: true }),
    field("engineCondition", "حالة المحرك", "textarea", { required: true }),
    field("transmissionCondition", "حالة ناقل الحركة", "textarea", { required: true }),
    field("bodyCondition", "حالة الهيكل", "textarea", { required: true }),
    field("hasAccidentHistory", "هل توجد حوادث سابقة معروفة؟", "boolean", { required: true }),
    field("accidentDetails", "تفاصيل الحوادث السابقة", "textarea", {
      visibleWhen: { key: "hasAccidentHistory", equals: true },
      requiredWhen: { key: "hasAccidentHistory", equals: true }
    }),
    field("hasKnownDamage", "هل توجد أضرار أو أعطال حالية؟", "boolean", { required: true }),
    field("knownDefects", "تفاصيل الأضرار أو الأعطال الحالية", "textarea", {
      visibleWhen: { key: "hasKnownDamage", equals: true },
      requiredWhen: { key: "hasKnownDamage", equals: true }
    }),
    field("hasMajorRepairs", "هل توجد إصلاحات جوهرية أو إعادة طلاء؟", "boolean", { required: true }),
    field("majorRepairsDetails", "تفاصيل الإصلاحات الجوهرية أو إعادة الطلاء", "textarea", {
      visibleWhen: { key: "hasMajorRepairs", equals: true },
      requiredWhen: { key: "hasMajorRepairs", equals: true }
    }),
    field("exteriorColor", "اللون الخارجي (اختياري)", "text"),
    field("vin", "رقم الهيكل (خاص، اختياري)", "text", {
      public: false,
      maxLength: 32
    }),
    field("inspectionLocation", "مكان معاينة المركبة", "text", { required: true })
  ],
  requiredImageLabels: ["front", "rear", "left_side", "right_side", "interior", "dashboard"],
  optionalImageLabels: ["reported_damage"]
};

const phone = {
  type: "phone",
  supported: true,
  publicListingEnabled: true,
  documentPolicyApproved: true,
  documents: [],
  fields: [
    field("manufacturer", "الشركة المصنعة", "text", { required: true }),
    field("model", "الموديل", "text", { required: true }),
    field("storage", "السعة التخزينية", "text", { required: true }),
    field("deviceCondition", "حالة الجهاز", "text", { required: true }),
    field("color", "اللون", "text"),
    field("batteryCondition", "حالة البطارية (عند توفر المعلومة)", "text"),
    field("repairs", "الأعطال والإصلاحات", "textarea"),
    field("lockStatus", "حالة القفل أو الحساب المرتبط", "select", {
      options: [
        { value: "unlocked", label: "غير مقفل" },
        { value: "locked", label: "مقفل أو مرتبط بحساب" },
        { value: "unknown", label: "غير معروف" }
      ]
    }),
    field("defects", "العيوب", "textarea"),
    field("accessories", "الملحقات", "textarea"),
    field("imei", "رقم IMEI (خاص، اختياري؛ لا يظهر للمشترين)", "text", {
      public: false,
      maxLength: 32
    })
  ],
  requiredImageLabels: ["actual_item"],
  optionalImageLabels: []
};

const computer = (isLaptop = false) => ({
  type: "computer",
  supported: true,
  publicListingEnabled: true,
  documentPolicyApproved: true,
  documents: [],
  fields: [
    field("manufacturer", "الشركة", "text", { required: true }),
    field("model", "الموديل", "text", { required: true }),
    field("processor", "المعالج", "text", { required: true }),
    field("memory", "الذاكرة", "text", { required: true }),
    field("storage", "التخزين", "text", { required: true }),
    field("graphicsCard", "كرت الشاشة (اختياري)", "text"),
    ...(isLaptop ? [field("batteryCondition", "حالة البطارية (عند توفرها)", "text")] : []),
    field("deviceCondition", "حالة الجهاز", "text", { required: true }),
    field("accessories", "الملحقات", "textarea"),
    field("specifications", "مواصفات إضافية", "textarea"),
    field("repairs", "الإصلاحات", "textarea"),
    field("defects", "العيوب", "textarea")
  ],
  requiredImageLabels: ["actual_item"],
  optionalImageLabels: []
});

const camera = {
  type: "camera",
  supported: true,
  publicListingEnabled: true,
  documentPolicyApproved: true,
  documents: [],
  fields: [
    field("manufacturer", "الشركة", "text", { required: true }),
    field("model", "الموديل", "text", { required: true }),
    field("deviceCondition", "الحالة العامة", "text", { required: true }),
    field("lensCondition", "حالة العدسة", "text"),
    field("sensorCondition", "حالة المستشعر", "text"),
    field("screenCondition", "حالة الشاشة", "text"),
    field("shutterCount", "عداد الالتقاطات (عند توفره)", "number"),
    field("accessories", "الملحقات", "textarea"),
    field("repairs", "الإصلاحات", "textarea"),
    field("defects", "العيوب", "textarea")
  ],
  requiredImageLabels: ["actual_item"],
  optionalImageLabels: []
};

const electronics = {
  type: "electronics",
  supported: true,
  publicListingEnabled: true,
  documentPolicyApproved: true,
  documents: [],
  fields: [
    field("deviceType", "نوع الجهاز", "text", { required: true }),
    field("manufacturer", "الشركة (عند توفرها)", "text"),
    field("model", "الموديل (عند توفره)", "text"),
    field("deviceCondition", "الحالة", "text", { required: true }),
    field("accessories", "الملحقات", "textarea"),
    field("specifications", "المواصفات", "textarea"),
    field("repairs", "الإصلاحات", "textarea"),
    field("defects", "العيوب", "textarea")
  ],
  requiredImageLabels: ["actual_item"],
  optionalImageLabels: []
};

const property = {
  type: "property",
  supported: true,
  publicListingEnabled: false,
  documentPolicyApproved: false,
  documents: [],
  documentRequirements: [],
  documentPolicyVersion: 0,
  requiredDocumentCount: 0,
  fields: [
    field("propertyType", "نوع العقار", "text", { required: true }),
    field("area", "المساحة", "text", { required: true }),
    field("rooms", "عدد الغرف (عند انطباقه)", "number"),
    field("propertyCondition", "حالة العقار", "text", { required: true }),
    field("services", "الخدمات", "textarea", { required: true }),
    field("defects", "العيوب", "textarea", { required: true })
  ],
  requiredImageLabels: ["actual_item"],
  optionalImageLabels: []
};

const furniture = {
  type: "furniture",
  supported: true,
  publicListingEnabled: true,
  documentPolicyApproved: true,
  documents: [],
  fields: [
    field("productType", "نوع الأثاث", "text", { required: true }),
    field("dimensions", "الأبعاد التقريبية", "text", { required: true }),
    field("material", "المادة (عند توفرها)", "text"),
    field("productCondition", "الحالة", "text", { required: true }),
    field("approximateAge", "العمر التقريبي", "text"),
    field("defects", "العيوب", "textarea")
  ],
  requiredImageLabels: ["actual_item"],
  optionalImageLabels: []
};

const homeAppliance = {
  type: "home_appliance",
  supported: true,
  publicListingEnabled: true,
  documentPolicyApproved: true,
  documents: [],
  fields: [
    field("productType", "نوع الجهاز المنزلي", "text", { required: true }),
    field("manufacturer", "الشركة (عند توفرها)", "text"),
    field("model", "الموديل (عند توفره)", "text"),
    field("specifications", "السعة أو المواصفات المناسبة", "textarea"),
    field("productCondition", "الحالة", "text", { required: true }),
    field("defects", "العيوب", "textarea"),
    field("repairs", "الإصلاحات", "textarea"),
    field("accessories", "الملحقات", "textarea")
  ],
  requiredImageLabels: ["actual_item"],
  optionalImageLabels: []
};

export const AUCTION_CATEGORY_SLUGS = [
  "cars-for-sale",
  "real-estate",
  "mobiles",
  "desktop-computers",
  "laptops",
  "cameras",
  "electronics",
  "furniture",
  "home-appliances"
];

const bySlug = {
  "cars-for-sale": vehicle,
  mobiles: phone,
  "desktop-computers": computer(),
  laptops: computer(true),
  cameras: camera,
  "real-estate": property,
  electronics,
  furniture,
  "home-appliances": homeAppliance
};

export function getCategoryAuctionRequirements(categorySlugs = []) {
  const slug = categorySlugs[0];
  if (AUCTION_CATEGORY_SLUGS.includes(slug) && bySlug[slug]) return bySlug[slug];
  return {
    type: "unsupported",
    supported: false,
    publicListingEnabled: false,
    documentPolicyApproved: false,
    documents: [],
    fields: [],
    requiredImageLabels: [],
    optionalImageLabels: []
  };
}

export function publicCategoryAuctionRequirements(requirements) {
  return {
    type: requirements.type,
    supported: requirements.supported === true,
    publicListingEnabled: requirements.publicListingEnabled,
    fields: requirements.fields,
    requiredImageLabels: requirements.requiredImageLabels,
    optionalImageLabels: requirements.optionalImageLabels,
    documentsRequired: requirements.requiredDocumentCount || 0,
    documentTypes: (requirements.documentRequirements || []).map((requirement) => ({
      key: requirement.key,
      label: requirement.label,
      required: requirement.required,
      oneOfGroup: requirement.oneOfGroup || null,
      expiryMatters: requirement.expiryMatters === true
    })),
    documentPolicyApproved: requirements.documentPolicyApproved === true,
    documentPolicyVersion: requirements.documentPolicyVersion || 0
  };
}

function conditionMatches(condition, details) {
  if (!condition) return true;
  const value = details[condition.key];
  if (Object.hasOwn(condition, "equals")) return value === condition.equals;
  if (condition.oneOf) return condition.oneOf.includes(value);
  return false;
}

export function isCategoryAuctionFieldVisible(field, details = {}) {
  return conditionMatches(field.visibleWhen, details);
}

export function isCategoryAuctionFieldRequired(field, details = {}) {
  return field.required === true ||
    Boolean(field.requiredWhen && conditionMatches(field.requiredWhen, details));
}

export function categoryDocumentsNeedReview(requirements, previousDetails = {}, nextDetails = {}) {
  const identityFields = requirements?.type === "vehicle"
    ? ["manufacturer", "model", "year", "vehicleType", "registrationStatus", "vin"]
    : requirements?.type === "property"
      ? ["propertyType", "area", "governorateId", "cityId"]
      : [];
  const configuredFields = (requirements?.documentRequirements || [])
    .flatMap((requirement) => requirement.reReviewFields || []);
  return identityFields.some((key) =>
    (previousDetails[key] ?? null) !== (nextDetails[key] ?? null)
  ) || configuredFields.some((key) =>
    (previousDetails[key] ?? null) !== (nextDetails[key] ?? null)
  );
}

export function validateCategoryAuctionData(
  requirements,
  details = {},
  imageLabels = [],
  { checkRequired = true } = {}
) {
  if (requirements.supported !== true) {
    return "هذا التصنيف غير مفعّل للمزادات.";
  }

  const allowedFields = new Set(requirements.fields.map((item) => item.key));
  const unknownFields = Object.keys(details).filter((key) => !allowedFields.has(key));
  if (unknownFields.length) {
    return `حقول غير متوافقة مع الفئة: ${unknownFields.join(", ")}`;
  }

  for (const item of requirements.fields) {
    const value = details[item.key];
    const visible = isCategoryAuctionFieldVisible(item, details);
    const required = isCategoryAuctionFieldRequired(item, details);
    if (!visible) {
      if (value !== undefined && value !== null && value !== "") {
        return `الحقل ${item.label} لا ينطبق على الإجابات المحددة.`;
      }
      continue;
    }
    if (checkRequired && required && (value === undefined || value === null || value === "")) {
      return `الحقل ${item.label} مطلوب.`;
    }
    if (value === undefined || value === null || value === "") continue;
    if (item.type === "number" && (!Number.isSafeInteger(Number(value)) || Number(value) < 0)) {
      return `قيمة الحقل ${item.label} غير صالحة.`;
    }
    if (item.type === "boolean" && typeof value !== "boolean") {
      return `قيمة الحقل ${item.label} غير صالحة.`;
    }
    if (item.type === "select" && !item.options.some((option) => option.value === value)) {
      return `قيمة الحقل ${item.label} غير معروفة.`;
    }
    if (["text", "textarea"].includes(item.type) &&
      (typeof value !== "string" || !value.trim() ||
        value.length > (item.maxLength || 2_000))) {
      return `قيمة الحقل ${item.label} غير صالحة.`;
    }
  }

  const allowedLabels = new Set([
    ...requirements.requiredImageLabels,
    ...requirements.optionalImageLabels
  ]);
  if (imageLabels.some((label) => !allowedLabels.has(label))) {
    return "توجد تسمية صورة غير متوافقة مع الفئة.";
  }
  if (checkRequired) {
    for (const label of requirements.requiredImageLabels) {
      if (!imageLabels.includes(label)) return `الصورة المطلوبة غير موجودة: ${label}.`;
    }
  }
  if (checkRequired && requirements.type === "vehicle" &&
    details.hasKnownDamage && !imageLabels.includes("reported_damage")) {
    return "أضف صورة للعيوب أو الأضرار المعلنة.";
  }
  return null;
}

export function categoryHasUnapprovedDocumentPolicy(requirements) {
  return ["vehicle", "property"].includes(requirements.type) &&
    requirements.documentPolicyApproved !== true;
}

function requiredDocumentGroups(requirements) {
  const groups = new Map();
  for (const requirement of requirements.documentRequirements || []) {
    if (!requirement.required) continue;
    const group = requirement.oneOfGroup || requirement.key;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(requirement.key);
  }
  return [...groups.values()];
}

function currentValidDocuments(requirements, documents, now = new Date()) {
  const configured = new Map(
    (requirements.documentRequirements || []).map((requirement) => [
      requirement.key,
      requirement
    ])
  );
  return documents.filter((document) => {
    if (document.isCurrent === false ||
      document.policyVersion !== requirements.documentPolicyVersion) return false;
    const requirement = configured.get(document.type);
    if (!requirement) return false;
    return !requirement.expiryMatters ||
      (document.expiresAt instanceof Date && document.expiresAt > now);
  });
}

export function hasRequiredReviewedDocuments(requirements, documents = []) {
  const groups = requiredDocumentGroups(requirements);
  if (!groups.length) return true;
  const approvedTypes = new Set(
    currentValidDocuments(requirements, documents)
      .filter((document) => document.reviewStatus === "approved")
      .map((document) => document.type)
  );
  return groups.every((group) => group.some((type) => approvedTypes.has(type)));
}

export function hasRequiredDocuments(requirements, documents = []) {
  const groups = requiredDocumentGroups(requirements);
  if (!groups.length) return true;
  const presentTypes = new Set(
    currentValidDocuments(requirements, documents).map((document) => document.type)
  );
  return groups.every((group) => group.some((type) => presentTypes.has(type)));
}
