export const SERVICE_FEATURE_BANNERS = [
  {
    id: "promotion",
    title: "خلّ إعلانك يلفت الانتباه",
    description: "اختر التمييز أو الإعلان المؤقت أو مساحة إعلانية من الباقات المتاحة.",
    action: "استكشف الترويج",
    to: "/seller/featured-ad",
    servicePaths: ["/seller/featured-ad", "/seller/feature-ad"],
    detailHeading: "اختر طريقة الترويج المناسبة لإعلانك",
    details: [
      "قارن بين باقات التثبيت والتمييز، والإعلان المؤقت، والمساحات الإعلانية.",
      "تعرض الباقات النشطة وأسعارها ومددها وإعداداتها كما تحددها الإدارة.",
      "اختر إعلانًا معتمدًا، ثم أرسل الطلب وسند الدفع لمراجعة الإدارة."
    ],
    theme: "from-blue-700 via-indigo-700 to-violet-800",
    glow: "bg-blue-300/20"
  },
  {
    id: "secure-deal",
    title: "تعرّف على الشراء الآمن",
    description: "تعرّف على خدمة الوساطة عبر أمانة، وتابع الطلب والشحن من سوقك.",
    action: "اكتشف الشراء الآمن",
    to: "/secure-deal-explanation",
    servicePaths: ["/secure-deal-explanation"],
    detailHeading: "كيف تساعدك خدمة الشراء الآمن؟",
    details: [
      "سوقك للإعلانات والطلبات ومتابعة الشحن؛ وخدمة الوساطة المرتبطة بالشراء الآمن تحمل هوية أمانة.",
      "راجع آلية تأكيد الاستلام والتعامل مع حالات النزاع.",
      "اقرأ الشروط والتفاصيل قبل بدء صفقة مؤهلة."
    ],
    theme: "from-emerald-700 via-teal-700 to-cyan-800",
    glow: "bg-emerald-300/20"
  },
  {
    id: "store",
    title: "أنشئ مساحة خاصة لمتجرك",
    description: "قدّم طلب إنشاء متجر، وتعرّف على خيارات الباقات المتاحة.",
    action: "إنشاء متجر",
    to: "/seller/store/create",
    servicePaths: ["/seller/store/create"],
    detailHeading: "أنشئ واجهة لمتجرك داخل سوقك",
    details: [
      "قدّم بيانات المتجر واختر الباقة المتاحة المناسبة.",
      "تخضع طلبات إنشاء المتاجر لمراجعة الإدارة.",
      "تختلف خصائص المتجر وحدوده حسب الباقة المعتمدة."
    ],
    theme: "from-orange-600 via-amber-600 to-rose-700",
    glow: "bg-amber-200/20"
  },
  {
    id: "family-production",
    title: "منتجاتك المنزلية تستحق الظهور",
    description: "سجّل في صناعات سوقك لعرض منتجاتك ضمن مسارها المخصص.",
    action: "انضم إلى صناعات سوقك",
    to: "/family-production/register",
    servicePaths: ["/family-production/register"],
    detailHeading: "اعرض منتجاتك ضمن صناعات سوقك",
    details: [
      "قدّم طلب تسجيل نشاطك ومنتجاتك المنزلية.",
      "اختر من الباقات المتاحة عند إكمال خطوات التسجيل.",
      "تتم مراجعة الطلب قبل تفعيل ملف المشروع."
    ],
    theme: "from-fuchsia-700 via-purple-700 to-indigo-800",
    glow: "bg-fuchsia-300/20"
  },
  {
    id: "wallet-services",
    title: "خدمات الدفع الإلكتروني وتمام باي",
    description: "تمام باي شريك مستقل لخدمات الدفع الإلكتروني؛ طلبات هذا الكتالوج لا تزال تستخدم طريقة الدفع الموضحة بكل طلب.",
    action: "تصفّح الخدمات",
    to: "/wallet-services",
    servicePaths: ["/wallet-services"],
    detailHeading: "تمام باي — شريك سوقك لخدمات الدفع الإلكتروني",
    details: [
      "تمام باي شريك مستقل لخدمات الدفع الإلكتروني في سوقك.",
      "الدفع عبر تمام باي غير مفعّل في مسارات الكتالوج الحالية؛ اتبع الطريقة الموضحة في كل طلب.",
      "تصفّح الخدمات والأسعار وأرسل طلبك لمراجعته وتنفيذه."
    ],
    theme: "from-cyan-700 via-sky-700 to-blue-800",
    glow: "bg-cyan-200/20"
  },
  {
    id: "verification",
    title: "وثّق حسابك في سوقك",
    description: "أرسل طلب التوثيق واتبع خطوات تقديم بياناتك.",
    action: "طلب التوثيق",
    to: "/seller/verification",
    servicePaths: ["/seller/verification"],
    detailHeading: "أرسل طلب توثيق حسابك",
    details: [
      "أكمل بيانات الهوية المطلوبة وارفع المستندات الداعمة.",
      "تتم مراجعة الطلب من الإدارة قبل تحديث حالة الحساب.",
      "التوثيق مجاني وفق نموذج الطلب الحالي."
    ],
    theme: "from-slate-700 via-blue-800 to-indigo-900",
    glow: "bg-blue-200/20"
  },
  {
    id: "seller-services",
    title: "خدمات البائع في سوقك",
    description: "أدوات وخدمات تساعدك على إدارة متجرك وتنمية أعمالك.",
    action: "تصفّح الخدمات",
    to: "/seller/subscriptions",
    servicePaths: ["/seller/subscriptions"],
    detailHeading: "اكتشف أدوات إدارة نشاطك",
    details: [
      "تابع طلباتك وخدمات البائع من لوحة واحدة.",
      "أنشئ متجرًا أو سجّل في صناعات سوقك.",
      "انتقل إلى الخدمة التي تحتاجها لمعرفة تفاصيلها وخياراتها."
    ],
    theme: "from-sky-700 via-blue-700 to-indigo-800",
    glow: "bg-sky-200/20"
  },
  {
    id: "wallet",
    title: "تابع محفظتك ومعاملاتك",
    description: "راجع الأرصدة والحركات وطلبات السحب من محفظتك.",
    action: "عرض المحفظة",
    to: "/wallet",
    servicePaths: ["/wallet"],
    detailHeading: "إدارة رصيدك من صفحة المحفظة",
    details: [
      "راجع الأرصدة المتاحة حسب العملة.",
      "تابع سجل المعاملات وحالة طلباتك.",
      "قدّم طلب سحب وفق الحدود والبيانات المطلوبة."
    ],
    theme: "from-emerald-700 via-green-700 to-teal-800",
    glow: "bg-emerald-200/20"
  },
  {
    id: "referrals",
    title: "شارك سوقك واكسب من الإحالات",
    description: "تابع رابط الإحالة ونشاط الدعوات والعمولات من لوحة الإحالات.",
    action: "عرض الإحالات",
    to: "/referrals",
    servicePaths: ["/referrals"],
    detailHeading: "تابع إحالاتك من لوحة واحدة",
    details: [
      "اعثر على رابط الإحالة الخاص بك وشاركه.",
      "تابع الزيارات والعلاقات الإحالية المسجلة لحسابك.",
      "راجع العمولات المرتبطة بالإحالات وحالتها."
    ],
    theme: "from-violet-700 via-purple-700 to-fuchsia-800",
    glow: "bg-fuchsia-300/20"
  },
  {
    id: "auctions",
    title: "شارك في مزادات سوقك",
    description: "استعرض المزادات المعتمدة، أو أنشئ مزادًا وتابع عروضك.",
    action: "استعرض المزادات",
    to: "/auctions",
    servicePaths: ["/auctions", "/auctions/new", "/my-auctions"],
    detailHeading: "اكتشف المزادات وتابعها",
    details: [
      "تصفّح المزادات المعتمدة وتفاصيلها.",
      "شارك بعروضك على المزادات المتاحة.",
      "أنشئ مزادًا أو تابع حالة مزاداتك من حسابك."
    ],
    theme: "from-amber-600 via-orange-600 to-red-700",
    glow: "bg-amber-200/20"
  },
  {
    id: "quote-requests",
    title: "تسعيرة سوقك للتجار والموردين",
    description: "اطلب أسعار السلع أو قدّم عروضك كمورد، وتواصل مباشرة لإتمام الاتفاق.",
    action: "استعرض طلبات التسعير",
    to: "/quote-requests",
    servicePaths: ["/quote-requests", "/quote-requests/new", "/my-quote-requests", "/my-quote-offers"],
    servicePathPrefixes: ["/quote-requests/"],
    detailHeading: "اربط المشترين بالتجار والموردين",
    details: [
      "أنشئ طلبًا يوضح السلعة والكمية والموقع والمواصفات.",
      "قدّم عرضك بسعرك والكمية المتاحة وتكلفة التوصيل.",
      "قارن العروض واختر الأنسب وتواصل مباشرة."
    ],
    theme: "from-indigo-700 via-blue-700 to-cyan-800",
    glow: "bg-cyan-200/20"
  }
];

export function getServicePageBanner(pathname) {
  return SERVICE_FEATURE_BANNERS.find((banner) =>
    banner.servicePaths?.includes(pathname)
    || banner.servicePathPrefixes?.some((prefix) => pathname.startsWith(prefix))
    || (banner.id === "auctions" && pathname.startsWith("/auctions/"))
  ) || null;
}
