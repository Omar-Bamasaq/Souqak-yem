export const i18n = {
  navbar: {
    home: "الرئيسية",
    pricing: "الأسعار",
    seller: "البائع",
    buyerOrders: "طلباتي",
    admin: "الإدارة",
    messages: "الرسائل",
    addAd: "أضف إعلان",
    login: "تسجيل الدخول",
    register: "إنشاء حساب",
    logout: "تسجيل الخروج",
    verifyEmail: "توثيق البريد الإلكتروني",
    sellerDashboard: "لوحة البائع",
    sellerOrders: "طلبات البائع"
  },
  home: {
    heroTitle: "سوق اليمن الأول للبيع والشراء",
    heroSubtitle: "منصة نظيفة حديثة للتداول الآمن بين البائعين والمشترين.",
    heroTagline: "آمن • سريع • موثوق",
    heroStats: {
      users: "+10,000 مستخدم",
      ads: "+50,000 إعلان",
      daily: "+500 يومياً"
    },
    startSelling: "ابدأ البيع الآن",
    explore: "استكشف المنتجات",
    searchPlaceholder: "ابحث عن سيارات، عقارات، إلكترونيات...",
    whyTitle: "لماذا تختار سوقك؟",
    categoriesTitle: "الفئات",
    latestProducts: "أحدث المنتجات",
    noProducts: "لا توجد منتجات.",
    categories: ["سيارات", "عقارات", "إلكترونيات", "أثاث", "وظائف", "خدمات"]
  },
  generic: {
    loading: "جاري التحميل...",
    all: "الكل",
    pending: "قيد المراجعة",
    approved: "مقبول",
    rejected: "مرفوض",
    seller: "البائع",
    product: "المنتج",
    status: "الحالة",
    view: "عرض",
    delete: "حذف",
    document: "عرض المستند",
    noData: "لا توجد بيانات.",
    error: "حدث خطأ غير متوقع.",
    registered: "تم التسجيل بنجاح",
    notFound: "الصفحة غير موجودة"
  },
  pricing: {
    title: "الخطط والأسعار",
    typeVerification: "التحقق",
    typeFeatured: "إعلان مميز",
    subscribeNow: "اشترك الآن",
    chooseProduct: "اختر المنتج",
    sellerOnly: "الاشتراك متاح للبائعين فقط",
    needProduct: "يرجى اختيار المنتج للإعلان المميز",
    requestSent: "تم إرسال طلب الاشتراك للمراجعة",
    requestActivated: "تم تفعيل الباقة فورًا لأغراض الاختبار",
    requestError: "تعذر إرسال الطلب"
  },
  admin: {
    title: "لوحة الإدارة",
    totalUsers: "إجمالي المستخدمين",
    totalProducts: "إجمالي المنتجات",
    pendingProducts: "إعلانات بانتظار المراجعة",
    products: "المنتجات",
    users: "المستخدمون",
    identity: "التحقق من الهوية",
    purchaseRequests: "طلبات الاشتراك",
    noProducts: "لا توجد منتجات.",
    noUsers: "لا يوجد مستخدمون.",
    noIdentities: "لا توجد طلبات هوية.",
    noRequests: "لا توجد طلبات.",
    approve: "اعتماد",
    reject: "رفض",
    pending: "إرجاع للمراجعة",
    sellerLabel: "البائع:"
  },
  product: {
    loading: "جاري التحميل...",
    images: "الصور",
    comments: "التعليقات",
    noComments: "لا توجد تعليقات بعد.",
    contactSeller: "تواصل مع البائع",
    messagePlaceholder: "رسالة إلى البائع",
    send: "إرسال",
    messaging: "المراسلة",
    chatSeller: "راسل البائع",
    requestPurchase: "طلب شراء",
    orderCreated: "تم إنشاء الطلب",
    orderFailed: "فشل إنشاء الطلب",
    messageSent: "تم إرسال الرسالة"
  },
  seller: {
    title: "لوحة البائع",
    total: "الإجمالي",
    pending: "قيد المراجعة",
    approved: "مقبول",
    rejected: "مرفوض",
    myProducts: "منتجاتي",
    noProductsYet: "لا توجد منتجات بعد."
  },
  auth: {
    invalidCredentials: "بيانات الدخول غير صحيحة"
  },
  login: {
    featuresTitle: "ميزات المنصة",
    features: {
      createListing: { title: "إضافة إعلان", desc: "اعرض منتجك أو خدمتك بإضافة التفاصيل والصور والموقع." },
      safePurchase: { title: "الشراء الآمن", desc: "تعرّف على خطوات إنشاء الصفقة ومتابعة الدفع والاستلام والنزاعات عبر المنصة." },
      contactSellers: { title: "مراسلة البائعين", desc: "تواصل عبر المحادثات لمناقشة تفاصيل الإعلان والشراء." },
      manageListings: { title: "إدارة إعلاناتك", desc: "راجع إعلاناتك وتابع حالتها وعدّل بياناتها أو أرشفها." },
      productSearch: { title: "البحث عن المنتجات", desc: "ابحث في الإعلانات وصَفِّ النتائج بالسعر والحالة وغيرها من الخيارات." },
      browseCategories: { title: "الفئات والوسوم", desc: "تصفّح الفئات والفئات الفرعية واكتشف الإعلانات حسب موضوعها." },
      manualReview: { title: "مراجعة الإعلانات", desc: "تُراجع الإعلانات قبل إتاحتها للمشترين." },
      featuredAds: { title: "إبراز الإعلانات", desc: "اطلب ترقية إعلانك عبر باقات الإبراز المتاحة." },
      verifiedSellers: { title: "توثيق حساب البائع", desc: "قدّم طلب توثيق حسابك بهويتك، وتابع مراجعته من المنصة." },
      searchByLocation: { title: "البحث حسب الموقع", desc: "صفِّ الإعلانات حسب المحافظة والمدينة." },
      saveFavorites: { title: "الإعلانات المفضلة", desc: "احفظ الإعلانات التي تهمك وارجع إليها من قائمة المفضلة." },
      followSellers: { title: "متابعة البائعين", desc: "تابع البائعين واطّلع على حساباتهم وإعلاناتهم." },
      storeCart: { title: "سلة المتاجر", desc: "اجمع منتجات المتاجر في السلة وتابع خطوات إرسال الطلب." },
      wallet: { title: "المحفظة والمعاملات", desc: "راجع أرصدتك وسجل الحركات وتابع طلبات السحب." },
      instantNotifications: { title: "الإشعارات", desc: "تابع إشعارات الحساب والرسائل والأحداث المدعومة من المنصة." },
      bookingServices: { title: "دليل الخدمات والحجوزات", desc: "اكتشف مقدمي الخدمات حسب الموقع، وتعرّف على بيانات التواصل والتقييمات." },
      digitalPaymentServices: { title: "خدمات الدفع الإلكتروني", desc: "تصفّح خدمات سوقك وتعرّف على تمام باي كشريك مستقل للدفع الإلكتروني. الدفع عبره غير مفعّل في مسارات الطلب الحالية." },
      quoteRequests: { title: "طلبات التسعير", desc: "اطلب تسعيرة للسلع أو استعرض طلبات المشترين وقدّم عرضًا." },
      auctions: { title: "المزادات", desc: "تصفّح المزادات المتاحة، وشارك بالمزايدة أو أنشئ مزادًا." },
      promoteListings: { title: "ترويج الإعلانات", desc: "تصفّح باقات التمييز والمساحات الإعلانية النشطة وأرسل طلب الترويج." },
      sellerSubscriptions: { title: "باقات وخدمات البائع", desc: "استعرض باقات البائع المتاحة وتابع اشتراكاتك وطلباتها." },
      browseStores: { title: "دليل المتاجر", desc: "اكتشف المتاجر ومنتجاتها وتصفّح صفحاتها المستقلة." },
      familyProduction: { title: "الأسر المنتجة", desc: "تصفّح منتجات الأسر المنتجة أو تعرّف على خطوات التسجيل." },
      createStore: { title: "إنشاء متجر", desc: "قدّم طلب إنشاء متجر واختر من الخيارات المتاحة للمراجعة." },
      platformReviews: { title: "تقييمات المنصة", desc: "اطّلع على آراء المستخدمين حول تجربتهم مع سوقك." },
      referrals: { title: "الإحالات", desc: "أنشئ رابط إحالة وراجع الدعوات والنشاط المسجّل لحسابك." }
    }
  },
  addProduct: {
    formTitle: "إضافة إعلان",
    emailNotVerified: "بريدك الإلكتروني غير موثّق.",
    verifyNow: "قم بتوثيق البريد الآن",
    fillAll: "الرجاء تعبئة جميع الحقول المطلوبة.",
    submitted: "تم إرسال الإعلان للمراجعة.",
    error: "حدث خطأ غير متوقع.",
    labels: {
      title: "عنوان المنتج",
      titlePh: "مثال: هاتف iPhone 13 Pro",
      description: "الوصف",
      descriptionPh: "اكتب وصفًا واضحًا للمنتج",
      price: "السعر",
      currency: "العملة",
      category: "الفئة",
      location: "الموقع",
      locationPh: "المدينة / المنطقة",
      images: "الصور"
    },
    publish: "نشر الإعلان",
    publishing: "جاري النشر..."
  }
};

export function t(path) {
  const parts = path.split(".");
  let cur = i18n;
  for (const p of parts) {
    if (cur && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p];
    else return path;
  }
  return cur;
}
