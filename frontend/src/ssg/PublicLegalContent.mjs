import React from "react";

const e = React.createElement;

function PolicyIcon({ className, path }) {
  return e("svg", {
    className,
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor",
    "aria-hidden": "true"
  }, e("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: path
  }));
}

function PolicySection({ color, icon, title, children }) {
  return e("section", {
    className: "bg-white p-6 sm:p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
  },
  e("div", { className: "flex items-center gap-3 mb-4" },
    e("div", { className: `w-10 h-10 rounded-xl ${color} flex items-center justify-center` },
      e(PolicyIcon, { className: "w-6 h-6", path: icon })
    ),
    e("h2", { className: "text-xl font-black text-gray-900" }, title)
  ),
  children);
}

function PolicyPageHeader({ title, lastUpdated }) {
  return e("div", { className: "text-center space-y-4 mb-12" },
    e("h1", { className: "text-3xl md:text-4xl font-black text-gray-900" }, title),
    e("p", { className: "text-gray-500 font-bold" }, `آخر تحديث: ${lastUpdated}`),
    e("div", { className: "h-1.5 w-20 bg-blue-600 mx-auto rounded-full" })
  );
}

export function PublicTermsContent({ lastUpdated = "" }) {
  return e("main", {
    className: "ssg-public-content mx-auto max-w-4xl space-y-8 py-10 px-4 sm:px-6",
    dir: "rtl"
  },
  e(PolicyPageHeader, { title: "الشروط والأحكام لمنصة سوقك", lastUpdated }),
  e("div", { className: "grid gap-6 sm:gap-8" },
    e(PolicySection, {
      color: "bg-blue-50 text-blue-600",
      icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
      title: "1. مقدمة"
    },
    e("p", { className: "text-sm sm:text-base text-gray-600 font-bold leading-relaxed" },
      "باستخدامك منصة سوقك، فإنك توافق على هذه الشروط والأحكام. سوقك منصة للإعلانات والطلبات ومتابعة الشحن بين البائعين والمشترين في اليمن."
    )),
    e(PolicySection, {
      color: "bg-emerald-50 text-emerald-600",
      icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
      title: "2. نظام الضمان والوساطة (Escrow)"
    },
    e("div", { className: "space-y-4" },
      e("p", { className: "text-sm sm:text-base text-gray-600 font-bold leading-relaxed" },
        'يظهر خيار "الشراء الآمن" في سوقك بهوية خدمة الوساطة عبر أمانة:'
      ),
      e("ul", { className: "list-disc space-y-3 px-5 text-sm sm:text-base text-gray-600 font-bold" },
        e("li", null, "سوقك مخصصة لعرض الإعلانات وإنشاء الطلبات ومتابعة الشحن، وتُستخدم هوية أمانة لخدمة الوساطة المرتبطة بالشراء الآمن."),
        e("li", null, "تتم متابعة الطلبات والنزاعات وفق الإجراءات الحالية المعروضة في صفحة العملية. ظهور هوية أمانة لا يثبت بذاته حيازة الأموال لديها أو اكتمال ربط مالي خارجي."),
        e("li", null, "تمام باي شريك مستقل لخدمات الدفع الإلكتروني. لا يعني ذكره توفر تكامل دفع في جميع المسارات أو أنه يتولى حيازة الأموال أو الاسترداد أو تحويلها للبائع."),
        e("li", null, "تُعرض رسوم الشراء الآمن ضمن تفاصيل الطلب قبل إرساله.")
      )
    )),
    e(PolicySection, {
      color: "bg-amber-50 text-amber-600",
      icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
      title: "3. المحتوى والإعلانات المحظورة"
    },
    e("ul", { className: "list-disc space-y-3 px-5 text-sm sm:text-base text-gray-600 font-bold" },
      e("li", null, "يمنع منعاً باتاً نشر إعلانات الأسلحة، المواد المخدرة، الأدوية غير المرخصة، أو أي محتوى يخالف القوانين اليمنية أو الآداب العامة."),
      e("li", null, "يجب أن تكون الصور حقيقية للمنتج وتعبر عن حالته الفعلية."),
      e("li", null, "يحق للإدارة حذف أي إعلان أو حظر أي مستخدم يخالف هذه السياسات دون إنذار مسبق.")
    )),
    e(PolicySection, {
      color: "bg-purple-50 text-purple-600",
      icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z",
      title: "4. المحفظة والعمليات المالية"
    },
    e("ul", { className: "list-disc space-y-3 px-5 text-sm sm:text-base text-gray-600 font-bold" },
      e("li", null, "تستخدم المحفظة لاستلام أرباح البيع أو استرداد الأموال في حالات النزاع."),
      e("li", null, "يمكن طلب سحب الرصيد إلى الحسابات البنكية أو مكاتب الصرافة المعتمدة، وتستغرق المعالجة من 24-48 ساعة عمل."),
      e("li", null, "يجب تقديم هوية صحيحة (بطاقة شخصية/جواز سفر) عند طلب سحب مبالغ كبيرة لضمان أمان الحساب.")
    )),
    e("section", { className: "bg-gray-900 p-8 rounded-[2.5rem] text-white shadow-xl shadow-blue-500/10" },
      e("h2", { className: "text-2xl font-black mb-6 flex items-center gap-3" },
        e("span", { className: "w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-sm" }, "!"),
        "تنبيه هام"
      ),
      e("p", { className: "text-sm sm:text-base text-blue-100 font-bold leading-relaxed" },
        "سوقك منصة للإعلانات والطلبات ومتابعة الشحن. عند اختيار الشراء الآمن تظهر هوية أمانة لخدمة الوساطة المرتبطة به؛ ولا تعني هذه الهوية وحدها اكتمال تكامل مالي خارجي أو تقديم ضمان مالي مستقل. عند التعامل خارج مسار الشراء الآمن، لا تكون تفاصيل العملية ضمن طلبات الشراء الآمن في سوقك."
      )
    ),
    e("p", { className: "text-sm font-bold text-gray-600" },
      e("a", { href: "/privacy", className: "text-blue-700 underline" }, "اقرأ سياسة الخصوصية"),
      " · ",
      e("a", { href: "/how-it-works", className: "text-blue-700 underline" }, "طريقة استخدام سوقك")
    )
  ));
}

export function PublicPrivacyContent({ lastUpdated = "" }) {
  return e("main", {
    className: "ssg-public-content mx-auto max-w-4xl space-y-8 py-10 px-4 sm:px-6",
    dir: "rtl"
  },
  e(PolicyPageHeader, { title: "سياسة الخصوصية لمنصة سوقك", lastUpdated }),
  e("div", { className: "grid gap-6 sm:gap-8" },
    e(PolicySection, {
      color: "bg-blue-50 text-blue-600",
      icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a2 2 0 01.707.293l5.414 5.414a2 2 0 01.293.707V19a2 2 0 01-2 2z",
      title: "1. البيانات التي نجمعها"
    },
    e("ul", { className: "list-disc space-y-3 px-5 text-sm sm:text-base text-gray-600 font-bold" },
      e("li", null, "المعلومات الشخصية: الاسم، رقم الهاتف، والبريد الإلكتروني عند التسجيل."),
      e("li", null, "بيانات التحقق: صور الهوية الوطنية (عند طلب توثيق الحساب أو سحب الرصيد) لضمان أمان العمليات المالية."),
      e("li", null, "بيانات المعاملات: تفاصيل السلع، الصور، والموقع الجغرافي (إذا تم تفعيله) لتسهيل عمليات البيع والشراء."),
      e("li", null, "سجلات التواصل: الرسائل والمحادثات داخل المنصة لحل النزاعات وضمان جودة الخدمة.")
    )),
    e(PolicySection, {
      color: "bg-emerald-50 text-emerald-600",
      icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
      title: "2. كيف نستخدم معلوماتك"
    },
    e(React.Fragment, null,
      e("p", { className: "text-sm sm:text-base text-gray-600 font-bold leading-relaxed mb-4" },
        "نستخدم البيانات لتقديم تجربة آمنة وموثوقة، بما في ذلك:"
      ),
      e("ul", { className: "list-disc space-y-3 px-5 text-sm sm:text-base text-gray-600 font-bold" },
        e("li", null, "تفعيل ميزات الشراء الآمن والوساطة المالية."),
        e("li", null, "التحقق من هوية البائعين والمشترين لمنع الاحتيال."),
        e("li", null, "تحسين أداء المنصة وتقديم اقتراحات مخصصة بناءً على اهتماماتك."),
        e("li", null, "التواصل معك بخصوص التحديثات الأمنية أو حالة طلباتك المالية.")
      )
    )),
    e(PolicySection, {
      color: "bg-purple-50 text-purple-600",
      icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
      title: "3. أمن وحماية البيانات"
    },
    e("p", { className: "text-sm sm:text-base text-gray-600 font-bold leading-relaxed" },
      "نحن نطبق معايير أمنية عالية لحماية بياناتك من الوصول غير المصرح به. يتم تشفير جميع المعلومات الحساسة (مثل صور الهوية) ولا يتم الاطلاع عليها إلا من قبل موظفي الإدارة المختصين عند الحاجة الضرورية فقط (مثل مراجعة طلب سحب رصيد)."
    )),
    e(PolicySection, {
      color: "bg-amber-50 text-amber-600",
      icon: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
      title: "4. حذف البيانات"
    },
    e("p", { className: "text-sm sm:text-base text-gray-600 font-bold leading-relaxed" },
      "يحق لك في أي وقت طلب حذف حسابك نهائياً من المنصة. عند القيام بذلك، سنقوم بحذف جميع بياناتك الشخصية من خوادمنا النشطة، مع الاحتفاظ ببعض سجلات المعاملات المالية فقط إذا كانت مطلوبة قانوناً أو لأغراض المحاسبة الإدارية."
    )),
    e("p", { className: "text-sm font-bold text-gray-600" },
      e("a", { href: "/terms", className: "text-blue-700 underline" }, "اقرأ الشروط والأحكام"),
      " · ",
      e("a", { href: "/how-it-works", className: "text-blue-700 underline" }, "طريقة استخدام سوقك")
    )
  ));
}
