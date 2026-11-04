export const GENERAL_STORE_TEMPLATE = "general-retail";

const templateConfigs = {
  "vehicle-dealer": {
    presentationVariant: "automotive",
    catalogTitle: "سيارات المعرض",
    catalogDescription: "السيارات والمركبات التي يعرضها هذا المعرض.",
    searchLabel: "البحث في سيارات المعرض",
    searchPlaceholder: "ابحث عن سيارة أو موديل...",
    categoryLabel: "تصفح المركبات",
    emptyTitle: "لا توجد سيارات في هذا العرض",
    emptyDescription: "جرّب فئة أخرى أو امسح البحث الحالي.",
    gridClassName: "grid-cols-2 sm:grid-cols-2 xl:grid-cols-3",
    productBadge: { icon: "🚘", label: "السيارات والمركبات", className: "border-emerald-200 bg-emerald-50/95 text-emerald-900" }
  },
  "furniture-store": {
    presentationVariant: "home-furnishings",
    catalogTitle: "أثاث المتجر",
    catalogDescription: "تصفح قطع الأثاث حسب أقسام المتجر.",
    searchLabel: "البحث في منتجات الأثاث",
    searchPlaceholder: "ابحث عن قطعة أثاث...",
    categoryLabel: "أقسام الأثاث",
    emptyTitle: "لا توجد قطع في هذا القسم",
    emptyDescription: "اختر قسمًا آخر أو ابحث باسم المنتج.",
    gridClassName: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
    productBadge: { icon: "🛋️", label: "الأثاث والمفروشات", className: "border-amber-200 bg-amber-50/95 text-amber-900" }
  },
  "electronics-retail": {
    presentationVariant: "consumer-electronics",
    catalogTitle: "الجوالات والإلكترونيات",
    catalogDescription: "الأجهزة والملحقات المعروضة لدى المتجر.",
    searchLabel: "البحث في أجهزة المتجر",
    searchPlaceholder: "ابحث عن جهاز أو ماركة...",
    categoryLabel: "فئات الأجهزة",
    emptyTitle: "لا توجد أجهزة مطابقة",
    emptyDescription: "غيّر الفئة أو كلمات البحث لمشاهدة منتجات أخرى.",
    gridClassName: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
    productBadge: { icon: "📱", label: "الجوالات والإلكترونيات", className: "border-sky-200 bg-sky-50/95 text-sky-900" }
  },
  "family-food": {
    presentationVariant: "family-food",
    catalogTitle: "منتجات المطبخ المنزلي",
    catalogDescription: "منتجات منزلية معدّة بعناية من هذا المشروع.",
    searchLabel: "البحث في منتجات المشروع",
    searchPlaceholder: "ابحث عن مأكولة أو منتج...",
    categoryLabel: "أنواع المنتجات",
    emptyTitle: "لا توجد منتجات معروضة حاليًا",
    emptyDescription: "تابع المشروع لاحقًا للاطلاع على المنتجات الجديدة.",
    gridClassName: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
    icon: "🍲",
    label: "مأكولات منزلية",
    accent: "from-orange-100 via-yellow-50 to-orange-50",
    chip: "border-orange-200 bg-orange-50 text-orange-900",
    highlight: "طازجة · منزلية",
    productBadge: { icon: "🍲", label: "مأكولات منزلية", className: "border-orange-200 bg-orange-50/95 text-orange-900" }
  },
  "family-handicrafts": {
    presentationVariant: "family-handicrafts",
    catalogTitle: "أعمال وحرف يدوية",
    catalogDescription: "قطع مصنوعة يدويًا من مشروع أسرة منتجة.",
    searchLabel: "البحث في الحرف اليدوية",
    searchPlaceholder: "ابحث عن قطعة أو حرفة...",
    categoryLabel: "أقسام المنتجات",
    emptyTitle: "لا توجد أعمال معروضة حاليًا",
    emptyDescription: "تابع المشروع لاحقًا للاطلاع على الأعمال الجديدة.",
    gridClassName: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
    icon: "🧵",
    label: "حرف يدوية",
    accent: "from-fuchsia-100 via-pink-50 to-violet-50",
    chip: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900",
    highlight: "يدوية · فريدة · مصنوعة يدويًا",
    productBadge: { icon: "🧵", label: "حرف يدوية", className: "border-fuchsia-200 bg-fuchsia-50/95 text-fuchsia-900" }
  },
  "family-tailoring": {
    presentationVariant: "family-tailoring",
    catalogTitle: "منتجات الخياطة والمنسوجات",
    catalogDescription: "تصاميم ومنتجات نسيجية من تنفيذ المشروع.",
    searchLabel: "البحث في منتجات الخياطة",
    searchPlaceholder: "ابحث عن تصميم أو منتج...",
    categoryLabel: "أنواع المنتجات",
    emptyTitle: "لا توجد منتجات معروضة حاليًا",
    emptyDescription: "تابع المشروع لاحقًا للاطلاع على التصاميم الجديدة.",
    gridClassName: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
    icon: "🧥",
    label: "خياطة ومنسوجات",
    accent: "from-teal-100 via-emerald-50 to-cyan-50",
    chip: "border-teal-200 bg-teal-50 text-teal-900",
    highlight: "مخصصة · أنيقة · نسيجية",
    productBadge: { icon: "🧥", label: "خياطة ومنسوجات", className: "border-teal-200 bg-teal-50/95 text-teal-900" }
  }
};

const activityPalettes = {
  pink: { accent: "border-pink-200 bg-gradient-to-r from-pink-50 via-rose-50 to-fuchsia-100 text-pink-950", chip: "border-pink-200 bg-pink-50 text-pink-900", badge: "border-pink-200 bg-pink-50/95 text-pink-900" },
  violet: { accent: "border-violet-200 bg-gradient-to-r from-violet-50 via-purple-50 to-fuchsia-100 text-violet-950", chip: "border-violet-200 bg-violet-50 text-violet-900", badge: "border-violet-200 bg-violet-50/95 text-violet-900" },
  green: { accent: "border-emerald-200 bg-gradient-to-r from-emerald-50 via-green-50 to-lime-100 text-emerald-950", chip: "border-emerald-200 bg-emerald-50 text-emerald-900", badge: "border-emerald-200 bg-emerald-50/95 text-emerald-900" },
  blue: { accent: "border-blue-200 bg-gradient-to-r from-blue-50 via-sky-50 to-cyan-100 text-blue-950", chip: "border-blue-200 bg-blue-50 text-blue-900", badge: "border-blue-200 bg-blue-50/95 text-blue-900" },
  amber: { accent: "border-amber-200 bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-100 text-amber-950", chip: "border-amber-200 bg-amber-50 text-amber-900", badge: "border-amber-200 bg-amber-50/95 text-amber-900" },
  cyan: { accent: "border-cyan-200 bg-gradient-to-r from-cyan-50 via-sky-50 to-blue-100 text-cyan-950", chip: "border-cyan-200 bg-cyan-50 text-cyan-900", badge: "border-cyan-200 bg-cyan-50/95 text-cyan-900" },
  orange: { accent: "border-orange-200 bg-gradient-to-r from-orange-50 via-amber-50 to-yellow-100 text-orange-950", chip: "border-orange-200 bg-orange-50 text-orange-900", badge: "border-orange-200 bg-orange-50/95 text-orange-900" },
  teal: { accent: "border-teal-200 bg-gradient-to-r from-teal-50 via-emerald-50 to-cyan-100 text-teal-950", chip: "border-teal-200 bg-teal-50 text-teal-900", badge: "border-teal-200 bg-teal-50/95 text-teal-900" },
  indigo: { accent: "border-indigo-200 bg-gradient-to-r from-indigo-50 via-blue-50 to-violet-100 text-indigo-950", chip: "border-indigo-200 bg-indigo-50 text-indigo-900", badge: "border-indigo-200 bg-indigo-50/95 text-indigo-900" },
  rose: { accent: "border-rose-200 bg-gradient-to-r from-rose-50 via-red-50 to-orange-100 text-rose-950", chip: "border-rose-200 bg-rose-50 text-rose-900", badge: "border-rose-200 bg-rose-50/95 text-rose-900" }
};

function createActivityTemplate({ label, icon, palette, catalogTitle, description, searchPlaceholder, emptyTitle, highlight, buttonLabel }) {
  const colors = activityPalettes[palette];
  return {
    presentationVariant: label,
    catalogTitle,
    catalogDescription: description,
    searchLabel: `البحث في ${label}`,
    searchPlaceholder,
    categoryLabel: `أقسام ${label}`,
    emptyTitle,
    emptyDescription: `تابع هذا المتجر للاطلاع على منتجات ${label} الجديدة.`,
    gridClassName: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
    intro: { eyebrow: label, title: label, description, icon, label, accent: colors.accent, chip: colors.chip, highlight, buttonLabel },
    productBadge: { icon, label, className: colors.badge }
  };
}

const newActivityTemplateConfigs = {
  "clothing-fashion": createActivityTemplate({ label: "الملابس والأزياء", icon: "👗", palette: "pink", catalogTitle: "الملابس والأزياء", description: "تصفح الملابس والأحذية والإكسسوارات المعروضة لدى المتجر.", searchPlaceholder: "ابحث عن قطعة أو مقاس...", emptyTitle: "لا توجد أزياء معروضة حاليًا", highlight: "أناقة · خيارات متنوعة", buttonLabel: "تصفح الأزياء" }),
  "perfumes-cosmetics": createActivityTemplate({ label: "العطور ومستحضرات التجميل", icon: "🌸", palette: "violet", catalogTitle: "العطور ومستحضرات التجميل", description: "عطور ومستحضرات تجميل وعناية شخصية مختارة.", searchPlaceholder: "ابحث عن عطر أو مستحضر...", emptyTitle: "لا توجد منتجات عناية معروضة", highlight: "عناية · جمال · عطور", buttonLabel: "تصفح المنتجات" }),
  "food-grocery": createActivityTemplate({ label: "المواد الغذائية والبقالات", icon: "🛒", palette: "green", catalogTitle: "المواد الغذائية والبقالة", description: "منتجات غذائية وبقالة متاحة لدى المتجر.", searchPlaceholder: "ابحث عن مادة غذائية...", emptyTitle: "لا توجد مواد غذائية معروضة", highlight: "احتياجات يومية · خيارات متنوعة", buttonLabel: "تصفح المنتجات" }),
  "home-appliances-store": createActivityTemplate({ label: "الأجهزة المنزلية", icon: "🧺", palette: "blue", catalogTitle: "الأجهزة المنزلية", description: "أجهزة منزلية وكهربائية ومستلزماتها.", searchPlaceholder: "ابحث عن جهاز منزلي...", emptyTitle: "لا توجد أجهزة منزلية معروضة", highlight: "للمنزل · أجهزة ومستلزمات", buttonLabel: "تصفح الأجهزة" }),
  "building-materials": createActivityTemplate({ label: "مواد البناء والسباكة والكهرباء", icon: "🧱", palette: "amber", catalogTitle: "مواد البناء والتجهيزات", description: "مواد البناء والسباكة والتجهيزات الكهربائية.", searchPlaceholder: "ابحث عن مادة أو مستلزم...", emptyTitle: "لا توجد مواد بناء معروضة", highlight: "بناء · سباكة · كهرباء", buttonLabel: "تصفح المستلزمات" }),
  "books-stationery": createActivityTemplate({ label: "المكتبات والقرطاسية", icon: "📚", palette: "cyan", catalogTitle: "الكتب والقرطاسية", description: "كتب وقرطاسية ولوازم مدرسية ومكتبية.", searchPlaceholder: "ابحث عن كتاب أو أداة...", emptyTitle: "لا توجد كتب أو قرطاسية معروضة", highlight: "قراءة · دراسة · عمل", buttonLabel: "تصفح المكتبة" }),
  "children-toys": createActivityTemplate({ label: "الأطفال والألعاب", icon: "🧸", palette: "rose", catalogTitle: "منتجات الأطفال والألعاب", description: "ألعاب ومنتجات وملابس وكتب للأطفال.", searchPlaceholder: "ابحث عن لعبة أو منتج أطفال...", emptyTitle: "لا توجد منتجات أطفال معروضة", highlight: "لعب · تعلم · اكتشاف", buttonLabel: "تصفح المنتجات" }),
  "jewelry-watches": createActivityTemplate({ label: "الذهب والمجوهرات والساعات", icon: "💍", palette: "amber", catalogTitle: "الذهب والمجوهرات والساعات", description: "مجوهرات وساعات ومنتجات معروضة لدى المتجر.", searchPlaceholder: "ابحث عن قطعة أو ساعة...", emptyTitle: "لا توجد مجوهرات معروضة", highlight: "أناقة · قيمة · تميز", buttonLabel: "تصفح القطع" }),
  "sports-fitness": createActivityTemplate({ label: "الرياضة واللياقة", icon: "🏃", palette: "green", catalogTitle: "الرياضة واللياقة", description: "معدات وملابس ومستلزمات رياضية.", searchPlaceholder: "ابحث عن معدة أو مستلزم رياضي...", emptyTitle: "لا توجد مستلزمات رياضية معروضة", highlight: "حركة · نشاط · لياقة", buttonLabel: "تصفح المستلزمات" }),
  "agriculture-supplies": createActivityTemplate({ label: "الزراعة ومستلزماتها", icon: "🌱", palette: "teal", catalogTitle: "الزراعة ومستلزماتها", description: "بذور ونباتات وأدوات ومستلزمات زراعية.", searchPlaceholder: "ابحث عن بذور أو أداة زراعية...", emptyTitle: "لا توجد مستلزمات زراعية معروضة", highlight: "زراعة · نمو · إنتاج", buttonLabel: "تصفح المستلزمات" }),
  "household-decor": createActivityTemplate({ label: "الأدوات المنزلية والديكور", icon: "🏠", palette: "orange", catalogTitle: "الأدوات المنزلية والديكور", description: "أدوات منزلية ومستلزمات مطبخ وديكور.", searchPlaceholder: "ابحث عن أداة أو قطعة ديكور...", emptyTitle: "لا توجد أدوات منزلية معروضة", highlight: "منزل · ترتيب · ديكور", buttonLabel: "تصفح الأدوات" }),
  "gifts-flowers": createActivityTemplate({ label: "الهدايا والزهور", icon: "💐", palette: "pink", catalogTitle: "الهدايا والزهور", description: "هدايا وزهور وتنسيقات للمناسبات.", searchPlaceholder: "ابحث عن هدية أو تنسيق...", emptyTitle: "لا توجد هدايا أو زهور معروضة", highlight: "مناسبات · هدايا · زهور", buttonLabel: "تصفح الهدايا" }),
  "computers-networks": createActivityTemplate({ label: "الحواسيب والشبكات", icon: "💻", palette: "indigo", catalogTitle: "الحواسيب والشبكات", description: "حواسيب ومكونات وشبكات وملحقات تقنية.", searchPlaceholder: "ابحث عن حاسوب أو قطعة...", emptyTitle: "لا توجد منتجات حاسوب معروضة", highlight: "حوسبة · شبكات · تقنية", buttonLabel: "تصفح الأجهزة" }),
  "spare-parts-equipment": createActivityTemplate({ label: "قطع الغيار والمعدات", icon: "⚙️", palette: "blue", catalogTitle: "قطع الغيار والمعدات", description: "قطع غيار وأدوات ومعدات مهنية وصناعية.", searchPlaceholder: "ابحث عن قطعة أو معدة...", emptyTitle: "لا توجد قطع أو معدات معروضة", highlight: "قطع · معدات · أدوات", buttonLabel: "تصفح القطع" }),
  "pet-supplies": createActivityTemplate({ label: "مستلزمات الحيوانات", icon: "🐾", palette: "orange", catalogTitle: "مستلزمات الحيوانات", description: "أغذية ومستلزمات مخصصة للحيوانات الأليفة.", searchPlaceholder: "ابحث عن مستلزم للحيوان...", emptyTitle: "لا توجد مستلزمات حيوانات معروضة", highlight: "رعاية · غذاء · مستلزمات", buttonLabel: "تصفح المستلزمات" }),
  "local-products": createActivityTemplate({ label: "المنتجات المحلية", icon: "🍯", palette: "amber", catalogTitle: "العسل والبن والتوابل والمنتجات المحلية", description: "عسل وبن وتوابل ومنتجات محلية متنوعة.", searchPlaceholder: "ابحث عن عسل أو بن أو توابل...", emptyTitle: "لا توجد منتجات محلية معروضة", highlight: "محلي · أصيل · متنوع", buttonLabel: "تصفح المنتجات" }),
  "general-variety": createActivityTemplate({ label: "المتاجر المتنوعة", icon: "🏬", palette: "cyan", catalogTitle: "منتجات المتجر المتنوعة", description: "تصفح المنتجات المتنوعة التي يعرضها هذا المتجر.", searchPlaceholder: "ابحث عن منتج داخل المتجر...", emptyTitle: "لا توجد منتجات معروضة حاليًا", highlight: "منتجات متنوعة · خيارات متعددة", buttonLabel: "تصفح المنتجات" }),
  "family-bakery": createActivityTemplate({ label: "المخبوزات والحلويات", icon: "🥐", palette: "amber", catalogTitle: "المخبوزات والحلويات المنزلية", description: "مخبوزات وحلويات محضرة منزليًا.", searchPlaceholder: "ابحث عن مخبوز أو حلوى...", emptyTitle: "لا توجد مخبوزات أو حلويات معروضة", highlight: "طازجة · منزلية · محضرة بعناية", buttonLabel: "تصفح المخبوزات" }),
  "family-preserved-food": createActivityTemplate({ label: "الأغذية المحفوظة والمجهزة", icon: "🫙", palette: "green", catalogTitle: "الأغذية المنزلية المحفوظة والمجهزة", description: "منتجات غذائية منزلية مجهزة أو محفوظة.", searchPlaceholder: "ابحث عن منتج غذائي...", emptyTitle: "لا توجد منتجات محفوظة معروضة", highlight: "منزلي · مجهز · محفوظ", buttonLabel: "تصفح المنتجات" }),
  "family-local-products": createActivityTemplate({ label: "البن والعسل والتوابل", icon: "🍯", palette: "orange", catalogTitle: "البن والعسل والتوابل", description: "منتجات محلية من البن والعسل والتوابل.", searchPlaceholder: "ابحث عن بن أو عسل أو توابل...", emptyTitle: "لا توجد منتجات محلية معروضة", highlight: "محلي · طبيعي · منزلي", buttonLabel: "تصفح المنتجات" }),
  "family-textiles": createActivityTemplate({ label: "المنسوجات والمفروشات اليدوية", icon: "🪡", palette: "teal", catalogTitle: "المنسوجات والمفروشات اليدوية", description: "منسوجات ومفروشات منزلية مصنوعة يدويًا.", searchPlaceholder: "ابحث عن منسوج أو مفرش...", emptyTitle: "لا توجد منسوجات معروضة", highlight: "نسيج يدوي · عناية بالتفاصيل", buttonLabel: "تصفح المنسوجات" }),
  "family-perfumes": createActivityTemplate({ label: "العطور والبخور", icon: "🪔", palette: "violet", catalogTitle: "العطور والبخور", description: "عطور وبخور ومنتجات عطرية مصنوعة منزليًا.", searchPlaceholder: "ابحث عن عطر أو بخور...", emptyTitle: "لا توجد عطور أو أنواع بخور معروضة", highlight: "عطر · بخور · صناعة منزلية", buttonLabel: "تصفح المنتجات" }),
  "family-care-products": createActivityTemplate({ label: "الصابون ومستحضرات العناية", icon: "🧼", palette: "cyan", catalogTitle: "الصابون ومستحضرات العناية", description: "صابون ومنتجات عناية شخصية منزلية الصنع.", searchPlaceholder: "ابحث عن صابون أو منتج عناية...", emptyTitle: "لا توجد منتجات عناية معروضة", highlight: "عناية · مكونات مختارة", buttonLabel: "تصفح المنتجات" }),
  "family-jewelry": createActivityTemplate({ label: "الإكسسوارات والمجوهرات اليدوية", icon: "📿", palette: "pink", catalogTitle: "الإكسسوارات والمجوهرات اليدوية", description: "إكسسوارات ومجوهرات مصنوعة يدويًا.", searchPlaceholder: "ابحث عن إكسسوار أو قطعة...", emptyTitle: "لا توجد مجوهرات يدوية معروضة", highlight: "يدوي · مميز · فريد", buttonLabel: "تصفح القطع" }),
  "family-wood-pottery": createActivityTemplate({ label: "المنتجات الخشبية والفخارية", icon: "🏺", palette: "amber", catalogTitle: "المنتجات الخشبية والفخارية", description: "قطع خشبية وفخارية مصنوعة يدويًا.", searchPlaceholder: "ابحث عن قطعة خشبية أو فخارية...", emptyTitle: "لا توجد منتجات خشبية أو فخارية معروضة", highlight: "حرفة · خامات طبيعية", buttonLabel: "تصفح المنتجات" }),
  "family-leather": createActivityTemplate({ label: "المنتجات الجلدية", icon: "👜", palette: "orange", catalogTitle: "المنتجات الجلدية", description: "منتجات جلدية مصنوعة يدويًا.", searchPlaceholder: "ابحث عن منتج جلدي...", emptyTitle: "لا توجد منتجات جلدية معروضة", highlight: "جلد · صناعة يدوية", buttonLabel: "تصفح المنتجات" }),
  "family-gifts-events": createActivityTemplate({ label: "الهدايا وتنسيق المناسبات", icon: "🎁", palette: "rose", catalogTitle: "الهدايا وتنسيق المناسبات", description: "هدايا وتنسيقات يدوية للمناسبات.", searchPlaceholder: "ابحث عن هدية أو تنسيق...", emptyTitle: "لا توجد هدايا معروضة", highlight: "مناسبات · تنسيق · لمسة يدوية", buttonLabel: "تصفح الهدايا" }),
  "family-candles-decor": createActivityTemplate({ label: "الشموع والديكورات المنزلية", icon: "🕯️", palette: "violet", catalogTitle: "الشموع والديكورات المنزلية", description: "شموع وقطع ديكور منزلية مصنوعة يدويًا.", searchPlaceholder: "ابحث عن شمعة أو قطعة ديكور...", emptyTitle: "لا توجد شموع أو ديكورات معروضة", highlight: "منزلي · يدوي · مميز", buttonLabel: "تصفح الديكور" }),
  "family-plants": createActivityTemplate({ label: "النباتات والمنتجات الزراعية المنزلية", icon: "🪴", palette: "green", catalogTitle: "النباتات والمنتجات الزراعية المنزلية", description: "نباتات ومنتجات زراعية منزلية.", searchPlaceholder: "ابحث عن نبتة أو منتج زراعي...", emptyTitle: "لا توجد نباتات معروضة", highlight: "منزلي · طبيعي · نامٍ", buttonLabel: "تصفح المنتجات" }),
  "family-educational-toys": createActivityTemplate({ label: "ألعاب الأطفال والمنتجات التعليمية اليدوية", icon: "🧩", palette: "blue", catalogTitle: "ألعاب الأطفال والمنتجات التعليمية اليدوية", description: "ألعاب وأدوات تعليمية للأطفال مصنوعة يدويًا.", searchPlaceholder: "ابحث عن لعبة تعليمية...", emptyTitle: "لا توجد ألعاب تعليمية معروضة", highlight: "لعب · تعلم · صناعة يدوية", buttonLabel: "تصفح الألعاب" }),
  "family-art-calligraphy": createActivityTemplate({ label: "الرسم والفنون والخط", icon: "🎨", palette: "indigo", catalogTitle: "الرسم والفنون والخط", description: "أعمال فنية ورسوم ولوحات ومنتجات للخط.", searchPlaceholder: "ابحث عن عمل فني أو لوحة...", emptyTitle: "لا توجد أعمال فنية معروضة", highlight: "فن · إبداع · خط", buttonLabel: "تصفح الأعمال" }),
  "family-yemeni-crafts": createActivityTemplate({ label: "الصناعات التقليدية اليمنية", icon: "🏺", palette: "teal", catalogTitle: "الصناعات التقليدية اليمنية", description: "منتجات حرفية مستوحاة من الصناعات التقليدية اليمنية.", searchPlaceholder: "ابحث عن حرفة أو منتج تقليدي...", emptyTitle: "لا توجد صناعات تقليدية معروضة", highlight: "تراث يمني · حرفة أصيلة", buttonLabel: "تصفح المنتجات" })
};

for (const [templateKey, config] of Object.entries(newActivityTemplateConfigs)) {
  config.presentationVariant = templateKey;
  templateConfigs[templateKey] = config;
}

const defaultTemplateConfig = {
  presentationVariant: "general-retail",
  catalogTitle: "منتجات المتجر",
  catalogDescription: "تصفح المنتجات التي يعرضها المتجر.",
  searchLabel: "البحث في منتجات المتجر",
  searchPlaceholder: "ابحث عن منتج داخل المتجر...",
  categoryLabel: "تسوق حسب التصنيف",
  emptyTitle: "لا توجد منتجات في هذا التصنيف",
  emptyDescription: "جرّب تصنيفًا آخر أو ابحث بكلمات مختلفة.",
  gridClassName: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  productBadge: { icon: "🏬", label: "منتجات المتجر", className: "border-slate-200 bg-slate-50/95 text-slate-800" }
};

export function getStoreTemplateConfig(templateKey) {
  if (!templateKey || templateKey === GENERAL_STORE_TEMPLATE) return defaultTemplateConfig;
  const config = templateConfigs[templateKey];
  if (!config) throw new Error(`Unknown store template: ${templateKey}`);
  return config;
}

export function getStoreProductAttributeSummary(product) {
  if (!Array.isArray(product?.attributes)) return [];
  return product.attributes
    .filter((attribute) => attribute.value !== null && attribute.value !== undefined && String(attribute.value).trim() !== "")
    .slice(0, 5)
    .map((attribute) => ({
      label: attribute.attributeId?.label || attribute.attributeId?.name,
      value: String(attribute.value) === "true" ? "نعم" : String(attribute.value) === "false" ? "لا" : String(attribute.value)
    }));
}