export const GENERAL_STORE_TEMPLATE = "general-retail";

function defineActivity(activityKey, nameAr, description, allowedCategorySlugs, presentationVariant) {
  return Object.freeze({
    activityKey,
    nameAr,
    description,
    templateKey: activityKey,
    allowedCategorySlugs: Object.freeze([...allowedCategorySlugs]),
    presentationVariant
  });
}

const existingStoreActivities = [
  Object.freeze({
    activityKey: "cars",
    nameAr: "معرض سيارات",
    description: "متجر متخصص في عرض السيارات ومركبات الركوب.",
    templateKey: "vehicle-dealer",
    allowedCategorySlugs: Object.freeze(["cars-for-sale", "cars-for-rent", "cars-transfer", "motorcycles", "trucks-heavy-equipment", "other-cars"]),
    presentationVariant: "automotive"
  }),
  Object.freeze({
    activityKey: "furniture",
    nameAr: "متجر أثاث",
    description: "متجر للأثاث والمفروشات المنزلية والمكتبية.",
    templateKey: "furniture-store",
    allowedCategorySlugs: Object.freeze([
      "bedrooms",
      "majalis",
      "kitchens",
      "tables-chairs",
      "office-furniture",
      "other-furniture"
    ]),
    presentationVariant: "home-furnishings"
  }),
  Object.freeze({
    activityKey: "mobile-electronics",
    nameAr: "جوالات وإلكترونيات",
    description: "متجر للجوالات وأجهزة الإلكترونيات وملحقاتها.",
    templateKey: "electronics-retail",
    allowedCategorySlugs: Object.freeze([
      "mobiles",
      "computers",
      "laptops",
      "screens",
      "cameras",
      "gaming-consoles",
      "other-electronics",
      "desktop-computers",
      "computer-accessories",
      "networks-communications",
      "audio-devices",
      "printers-scanners",
      "smart-watches",
      "tablets"
    ]),
    presentationVariant: "consumer-electronics"
  })
];

const newStoreActivities = [
  ["clothing-fashion", "الملابس والأزياء", "متجر للملابس والأحذية والأزياء والإكسسوارات.", ["mens-wear", "womens-wear", "kids-wear", "shoes", "accessories", "other-fashion"]],
  ["perfumes-cosmetics", "العطور ومستحضرات التجميل", "متجر للعطور ومستحضرات التجميل والعناية الشخصية.", ["perfumes", "cosmetics", "skin-care", "hair-care", "beauty-tools", "other-beauty"]],
  ["food-grocery", "المواد الغذائية والبقالات", "متجر للمواد الغذائية والبقالة والمنتجات اليومية.", ["dry-foods", "vegetables-fruits", "meat-poultry", "dairy-products", "wholesale-foods", "other-food"]],
  ["home-appliances-store", "الأجهزة المنزلية", "متجر للأجهزة المنزلية والكهربائية ومستلزماتها.", ["refrigerators", "washing-machines", "air-conditioners", "ovens-microwaves", "kitchen-appliances", "small-appliances", "vacuum-cleaners", "water-heaters", "other-appliances"]],
  ["building-materials", "مواد البناء والسباكة والكهرباء", "متجر لمواد البناء والسباكة والتجهيزات الكهربائية.", ["building-supplies", "plumbing-supplies", "electrical-supplies"]],
  ["books-stationery", "المكتبات والقرطاسية", "مكتبة للكتب والقرطاسية واللوازم المدرسية والمكتبية.", ["educational-books", "religious-books", "literary-books", "kids-books", "pens-notebooks", "office-supplies", "school-supplies", "other-books"]],
  ["children-toys", "الأطفال والألعاب", "متجر لمنتجات الأطفال والألعاب والكتب والملابس.", ["kids-games", "kids-books", "kids-wear", "educational-toys"]],
  ["jewelry-watches", "الذهب والمجوهرات والساعات", "متجر للذهب والمجوهرات والساعات والإكسسوارات.", ["gold-jewelry", "jewelry", "watches", "other-jewelry"]],
  ["sports-fitness", "الرياضة واللياقة", "متجر للمعدات والملابس والمستلزمات الرياضية.", ["sports-gear", "sports-clothing", "food-supplements", "bodybuilding-supplies", "other-sports"]],
  ["agriculture-supplies", "الزراعة ومستلزماتها", "متجر للبذور والنباتات وأدوات ومستلزمات الزراعة.", ["seeds-plants", "fertilizers-soil", "irrigation-supplies", "agricultural-tools", "garden-tools"]],
  ["household-decor", "الأدوات المنزلية والديكور", "متجر للأدوات المنزلية وأدوات المطبخ والديكور.", ["home-equipment", "kitchenware", "home-decor-items", "lighting-decor", "textiles-linens"]],
  ["gifts-flowers", "الهدايا والزهور", "متجر للهدايا والزهور وتنسيقات المناسبات.", ["gifts", "flowers", "gift-arrangements"]],
  ["computers-networks", "الحواسيب والشبكات", "متجر للحواسيب ومكوناتها والشبكات والاتصالات.", ["computers", "desktop-computers", "laptops", "computer-accessories", "networks-communications", "screens", "printers-scanners"]],
  ["spare-parts-equipment", "قطع الغيار والمعدات", "متجر لقطع غيار المركبات والمعدات والأدوات المهنية.", ["car-parts", "special-plates", "electric-tools", "mechanical-tools", "industrial-equipment", "trucks-heavy-equipment"]],
  ["pet-supplies", "مستلزمات الحيوانات", "متجر لأغذية الحيوانات الأليفة ومستلزماتها.", ["pets", "pet-food", "pet-accessories"]],
  ["local-products", "العسل والبن والتوابل والمنتجات المحلية", "متجر للمنتجات المحلية والعسل والبن والتوابل.", ["honey", "coffee", "spices", "dry-foods", "other-food"]],
  ["general-variety", "المتاجر المتنوعة", "متجر لمنتجات متنوعة ضمن فئات البيع المسموح بها.", ["other-furniture", "other-fashion", "other-electronics", "other-appliances", "other-books", "other-sports", "home-equipment", "kitchenware", "gifts"]]
].map(([activityKey, nameAr, description, categories]) =>
  defineActivity(activityKey, nameAr, description, categories, activityKey)
);

export const STORE_ACTIVITY_REGISTRY = Object.freeze([
  existingStoreActivities[0],
  existingStoreActivities[2],
  existingStoreActivities[1],
  ...newStoreActivities
]);

const existingFamilyActivities = [
  Object.freeze({
    activityKey: "family-food",
    nameAr: "مأكولات منزلية",
    description: "مشروع لإعداد وبيع المأكولات المنزلية والمنتجات الغذائية.",
    templateKey: "family-food",
    allowedCategorySlugs: Object.freeze(["dry-foods", "dairy-products", "other-food", "homemade-meals"]),
    presentationVariant: "family-food"
  }),
  Object.freeze({
    activityKey: "family-handicrafts",
    nameAr: "حرف يدوية",
    description: "مشروع للحرف اليدوية والمنتجات المصنوعة منزليًا.",
    templateKey: "family-handicrafts",
    allowedCategorySlugs: Object.freeze([
      "accessories",
      "hobbies",
      "other-furniture",
      "other-fashion",
      "handmade-textiles",
      "leather-goods",
      "wooden-products",
      "pottery",
      "handmade-jewelry",
      "handmade-gifts",
      "handmade-decor",
      "educational-toys",
      "art-calligraphy",
      "yemeni-traditional"
    ]),
    presentationVariant: "family-handicrafts"
  }),
  Object.freeze({
    activityKey: "family-tailoring",
    nameAr: "خياطة ومنسوجات",
    description: "مشروع للخياطة والتطريز والمنتجات النسيجية.",
    templateKey: "family-tailoring",
    allowedCategorySlugs: Object.freeze(["mens-wear", "womens-wear", "kids-wear", "accessories", "handmade-textiles"]),
    presentationVariant: "family-tailoring"
  })
];

const newFamilyActivities = [
  ["family-bakery", "المخبوزات والحلويات", "مشروع منزلي للمخبوزات والحلويات الطازجة.", ["bakery-products", "sweets-desserts"]],
  ["family-preserved-food", "الأغذية المحفوظة والمجهزة", "منتجات غذائية منزلية مجهزة أو محفوظة.", ["preserved-foods", "dry-foods"]],
  ["family-local-products", "البن والعسل والتوابل", "منتجات منزلية ومحلية من البن والعسل والتوابل.", ["honey", "coffee", "spices"]],
  ["family-textiles", "المنسوجات والمفروشات اليدوية", "منسوجات ومفروشات منزلية مصنوعة يدويًا.", ["handmade-textiles", "textiles-linens"]],
  ["family-perfumes", "العطور والبخور", "عطور وبخور ومنتجات عطرية مصنوعة منزليًا.", ["perfumes", "incense"]],
  ["family-care-products", "الصابون ومستحضرات العناية", "صابون ومنتجات عناية شخصية منزلية الصنع.", ["handmade-soap", "skin-care", "hair-care"]],
  ["family-jewelry", "الإكسسوارات والمجوهرات اليدوية", "إكسسوارات ومجوهرات مصنوعة يدويًا.", ["handmade-jewelry", "accessories"]],
  ["family-wood-pottery", "المنتجات الخشبية والفخارية", "قطع خشبية وفخارية مصنوعة يدويًا.", ["wooden-products", "pottery"]],
  ["family-leather", "المنتجات الجلدية", "منتجات جلدية مصنوعة يدويًا.", ["leather-goods"]],
  ["family-gifts-events", "الهدايا وتنسيق المناسبات", "هدايا وتنسيقات يدوية للمناسبات.", ["handmade-gifts", "gift-arrangements", "flowers"]],
  ["family-candles-decor", "الشموع والديكورات المنزلية", "شموع وقطع ديكور منزلية مصنوعة يدويًا.", ["candles", "handmade-decor"]],
  ["family-plants", "النباتات والمنتجات الزراعية المنزلية", "نباتات ومنتجات زراعية منزلية.", ["indoor-plants", "garden-produce"]],
  ["family-educational-toys", "ألعاب الأطفال والمنتجات التعليمية اليدوية", "ألعاب وأدوات تعليمية للأطفال مصنوعة يدويًا.", ["educational-toys", "kids-games"]],
  ["family-art-calligraphy", "الرسم والفنون والخط", "أعمال فنية ورسوم ولوحات ومنتجات للخط.", ["art-calligraphy"]],
  ["family-yemeni-crafts", "الصناعات التقليدية اليمنية", "منتجات حرفية مستوحاة من الصناعات التقليدية اليمنية.", ["yemeni-traditional", "hobbies"]]
].map(([activityKey, nameAr, description, categories]) =>
  defineActivity(activityKey, nameAr, description, categories, activityKey)
);

export const FAMILY_PRODUCTION_ACTIVITY_REGISTRY = Object.freeze([
  existingFamilyActivities[0],
  newFamilyActivities[0],
  newFamilyActivities[1],
  newFamilyActivities[2],
  existingFamilyActivities[1],
  existingFamilyActivities[2],
  newFamilyActivities[3],
  newFamilyActivities[4],
  newFamilyActivities[5],
  newFamilyActivities[6],
  newFamilyActivities[7],
  newFamilyActivities[8],
  newFamilyActivities[9],
  newFamilyActivities[10],
  newFamilyActivities[11],
  newFamilyActivities[12],
  newFamilyActivities[13],
  newFamilyActivities[14]
]);

const activityByKey = new Map(STORE_ACTIVITY_REGISTRY.map((activity) => [activity.activityKey, activity]));
const familyProductionActivityByKey = new Map(FAMILY_PRODUCTION_ACTIVITY_REGISTRY.map((activity) => [activity.activityKey, activity]));

export function getStoreActivity(activityKey) {
  return typeof activityKey === "string" ? activityByKey.get(activityKey) || null : null;
}

export function getFamilyProductionActivity(activityKey) {
  return typeof activityKey === "string" ? familyProductionActivityByKey.get(activityKey) || null : null;
}

export function listFamilyProductionActivities() {
  return FAMILY_PRODUCTION_ACTIVITY_REGISTRY.map((activity) => ({
    activityKey: activity.activityKey,
    nameAr: activity.nameAr,
    description: activity.description,
    templateKey: activity.templateKey,
    allowedCategorySlugs: [...activity.allowedCategorySlugs],
    presentationVariant: activity.presentationVariant
  }));
}

export function listStoreActivities() {
  return STORE_ACTIVITY_REGISTRY.map((activity) => ({
    activityKey: activity.activityKey,
    nameAr: activity.nameAr,
    description: activity.description,
    templateKey: activity.templateKey,
    allowedCategorySlugs: [...activity.allowedCategorySlugs],
    presentationVariant: activity.presentationVariant
  }));
}

export function resolveStoreActivity(store = {}) {
  const registeredActivity = store.storeType === "family-production"
    ? getFamilyProductionActivity(store.activityKey)
    : getStoreActivity(store.activityKey);
  if (registeredActivity) {
    return {
      key: registeredActivity.activityKey,
      name: registeredActivity.nameAr,
      templateKey: registeredActivity.templateKey
    };
  }
  if (store.activityKey) {
    throw new Error(`Unknown store activity: ${store.activityKey}`);
  }

  return {
    key: null,
    name: String(store.businessActivity || "متجر"),
    templateKey: GENERAL_STORE_TEMPLATE
  };
}