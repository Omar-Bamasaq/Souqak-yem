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
      secureTrade: { title: "بيع وشراء آمن", desc: "معاملات محمية بضمان داخلي لحماية البائع والمشتري." },
      safePurchase: { title: "الشراء الآمن (الوساطة)", desc: "ادفع للمنصة وسنقوم بحجز المبلغ حتى تستلم المنتج وتفحصه بنفسك." },
      contactSellers: { title: "التواصل مع البائعين", desc: "دردشة فورية مع البائعين دون كشف بياناتك الشخصية." },
      unlimitedAds: { title: "إعلانات غير محدودة", desc: "انشر إعلاناتك بدون حد أقصى ووصل لملايين المشترين." },
      manualReview: { title: "متابعة يدوية من المشرفين", desc: "كل إعلان يُراجع قبل النشر لضمان الجودة والمصداقية." },
      featuredAds: { title: "تمييز الإعلانات", desc: "اجعل إعلانك مميزاً ليظهر في الصدارة ويزيد المبيعات." },
      verifiedSellers: { title: "توثيق حسابات البائعين", desc: "نظام توثيق بالهوية لحماية المجتمع من المحتالين." },
      secureSelling: { title: "خيار البيع الآمن", desc: "نظام ضمان (Escrow) يحجز المبلغ حتى تأكيد الاستلام." },
      instantNotifications: { title: "إشعارات لحظية", desc: "استقبل الرسائل والعروض فوراً ولا تفوّت أي فرصة." },
      searchByLocation: { title: "بحث حسب الموقع", desc: "ابحث عن المنتجات حسب المحافظة والمدينة القريبة منك." },
      favoritesAndFollow: { title: "المفضلة والمتابعة", desc: "احفظ إعلاناتك المفضلة وتابع البائعين الموثوقين." },
      simpleInterface: { title: "واجهة بسيطة وسريعة", desc: "تصميم حديث يعمل بسلاسة على الجوال والكمبيوتر." },
      affiliateMarketing: { title: "التسويق بالعمولة", desc: "اربح عمولات مجزية من خلال إعادة بيع المنتجات المتوفرة." }
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
