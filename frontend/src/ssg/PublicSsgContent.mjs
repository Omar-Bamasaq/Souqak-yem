import React from "react";
import { DEFAULT_SITE_BASE_URL, resolveSiteUrl } from "../lib/siteUrl.js";
import { PUBLIC_PAGE_METADATA } from "../lib/publicPageMetadata.mjs";
import { PublicPrivacyContent, PublicTermsContent } from "./PublicLegalContent.mjs";
import {
  buildAdPath,
  encodeSeoPathSegment,
  getPublicAdContentModel,
  renderPublicAuctionContentHtml,
  renderPublicCategoryContentHtml,
  renderPublicStoreContentHtml
} from "../../../shared/seoRules.mjs";

const e = React.createElement;

const absoluteUrl = (path, siteBaseUrl) => resolveSiteUrl(path || "/", siteBaseUrl);
const internalUrl = (path, siteBaseUrl) => (
  typeof path === "string" &&
  path.startsWith("/") &&
  !path.startsWith("//") &&
  !/[\\?#\u0000-\u001f]/.test(path)
    ? absoluteUrl(path, siteBaseUrl)
    : null
);

const DIRECTORY_PATHS = {
  "/": [
    "/categories",
    "/stores",
    "/family-production",
    "/auctions",
    "/bookings",
    "/pricing",
    "/how-it-works",
    "/secure-deal-explanation",
    "/platform-reviews",
    "/terms",
    "/privacy"
  ],
  "/categories": ["/stores", "/family-production", "/auctions", "/bookings"],
  "/how-it-works": ["/categories", "/stores", "/bookings", "/pricing"],
  "/secure-deal-explanation": ["/how-it-works", "/refund-escrow", "/terms"],
  "/refund-escrow": ["/secure-deal-explanation", "/terms", "/privacy"],
  "/platform-reviews": ["/how-it-works", "/terms"],
  "/pricing": ["/categories", "/how-it-works", "/terms"],
  "/terms": ["/privacy", "/how-it-works"],
  "/privacy": ["/terms", "/how-it-works"],
  "/bookings": ["/stores", "/family-production", "/terms"],
  "/stores": ["/family-production", "/categories"],
  "/family-production": ["/stores", "/categories"],
  "/auctions": ["/categories", "/how-it-works", "/terms"]
};

function PageLinks({ paths = [], siteBaseUrl }) {
  const links = [...new Set(paths)]
    .map((path) => {
      const href = internalUrl(path, siteBaseUrl);
      const metadata = PUBLIC_PAGE_METADATA[path];
      return href && metadata ? { href, label: metadata.heading } : null;
    })
    .filter(Boolean);
  if (!links.length) return null;
  return e("nav", { "aria-label": "صفحات ذات صلة", className: "mt-6" },
    e("h2", { className: "mb-2 text-lg font-bold" }, "قد يهمك أيضًا"),
    e("ul", { className: "flex flex-wrap gap-3" },
      links.map(({ href, label }) => e("li", { key: href },
        e("a", { href, className: "font-bold text-blue-700 underline" }, label)
      ))
    )
  );
}

function PublicInfoPage({ path, siteBaseUrl, lastUpdated }) {
  const metadata = PUBLIC_PAGE_METADATA[path];
  if (!metadata) return null;

  if (path === "/terms") return e(PublicTermsContent, { lastUpdated });
  if (path === "/privacy") return e(PublicPrivacyContent, { lastUpdated });

  const details = {
    "/how-it-works": [
      ["تصفّح ما يناسبك", "ابدأ من التصنيفات أو الأدلة العامة، ثم استخدم خيارات البحث والتصفية التي تعرضها الصفحة."],
      ["راجع تفاصيل العملية", "تختلف خطوات النشر والطلب بحسب نوع الخدمة؛ راجع الرسوم والشروط والخيارات الظاهرة قبل تأكيد أي إجراء."]
    ],
    "/secure-deal-explanation": [
      ["تابع الطلب والشحن", "تُعرض متابعة الطلبات المقدمة عبر خيار الشراء الآمن في صفحة العملية داخل سوقك."],
      ["هوية خدمة الوساطة", "تظهر أمانة بهوية خدمة الوساطة المرتبطة بخيار الشراء الآمن. لا يعني ذلك وحده اكتمال تكامل مالي خارجي."]
    ],
    "/platform-reviews": [
      ["آراء المستخدمين", "تظهر المراجعات المنشورة بعد تحميل البيانات المتاحة؛ لا تُعرض أرقام تقييمات ثابتة أو افتراضية في هذا المحتوى الأولي."],
      ["شارك رأيك", "استخدم خيار إضافة تقييم الموجود في الصفحة بعد تحميل التطبيق."]
    ],
    "/pricing": [
      ["راجع الخيارات الحالية", "تُحمّل الخطط وخيارات الترويج من بيانات التطبيق، وقد تتغير تفاصيلها وأسعارها."],
      ["قبل تقديم الطلب", "راجع السعر والشروط المعروضة داخل التطبيق قبل المتابعة؛ لا يتضمن هذا المحتوى أسعارًا محفوظة من وقت البناء."]
    ],
    "/bookings": [
      ["تصفّح دليل الخدمات", "يعرض التطبيق الخدمات المنشورة وخيارات التصفية المتاحة حسب النوع والمحافظة والمدينة والتقييم."],
      ["بيانات الخدمات", "تعرض تفاصيل الخدمة البيانات العامة المصرح بها في الصفحة، ولا يضيف هذا المحتوى الأولي بيانات اتصال أو موقعًا خاصًا."]
    ],
    "/stores": [
      ["تصفّح المتاجر", "يعرض التطبيق المتاجر العامة وخيارات النشاط والمحافظة والمدينة والعروض المتاحة."],
      ["المنتجات والتفاصيل", "تُحمّل بيانات المتاجر ومنتجاتها من التطبيق، وتبقى تفاصيلها الحالية مرتبطة بالبيانات المنشورة."]
    ],
    "/family-production": [
      ["اكتشف المشاريع", "يعرض التطبيق مشاريع الأسر المنتجة العامة وخيارات النشاط والمحافظة والمدينة والعروض المتاحة."],
      ["تعرّف على المنتجات", "تُحمّل معلومات المشاريع والمنتجات من التطبيق وفق البيانات العامة المنشورة."]
    ],
    "/auctions": [
      ["ابحث عن مزاد", "تتيح الصفحة خيارات البحث والتصفية المتاحة حسب الفئة والموقع والحالة."],
      ["راجع الحالة والتفاصيل", "تُعرض حالة المزاد وتفاصيله من البيانات الحالية؛ لا يتضمن هذا المحتوى الأولي مزادات منتهية أو بيانات مزاد قديمة."]
    ]
  }[path] || [];

  return e("main", {
    className: "ssg-public-content mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6",
    dir: "rtl"
  },
  e("header", { className: "space-y-4" },
    e("h1", { className: "text-3xl font-black text-gray-900" }, metadata.heading),
    e("p", { className: "text-base font-bold leading-relaxed text-gray-700" }, metadata.intro)
  ),
  details.map(([heading, text]) => e("section", { key: heading, className: "space-y-2" },
    e("h2", { className: "text-xl font-black text-gray-900" }, heading),
    e("p", { className: "font-medium leading-relaxed text-gray-700" }, text)
  )),
  e(PageLinks, { paths: DIRECTORY_PATHS[path], siteBaseUrl })
  );
}

const AdLink = ({ ad, siteBaseUrl = DEFAULT_SITE_BASE_URL }) => {
  const adPath = buildAdPath(ad);
  if (!adPath) return null;
  const href = absoluteUrl(adPath, siteBaseUrl);
  return e("li", { key: ad._id }, e("a", { href }, ad.title || "إعلان في سوقك"));
};

export function PublicHomeContent({ categories = [], siteBaseUrl = DEFAULT_SITE_BASE_URL }) {
  const directoryPaths = DIRECTORY_PATHS["/"];
  return e("main", { className: "ssg-public-content", dir: "rtl" },
    e("h1", { className: "text-2xl font-black text-gray-900 sm:text-4xl" }, PUBLIC_PAGE_METADATA["/"].heading),
    e("p", null, PUBLIC_PAGE_METADATA["/"].intro),
    e("section", { "aria-labelledby": "ssg-home-categories" },
      e("h2", { id: "ssg-home-categories" }, "التصنيفات العامة"),
      categories.length
        ? e("ul", { className: "flex flex-wrap gap-3" }, categories.map((category) => {
          const href = internalUrl(category.path, siteBaseUrl);
          return href ? e("li", { key: href },
            e("a", { href, className: "font-bold text-blue-700 underline" }, category.name)
          ) : null;
        }))
        : e("p", null, "تعرّف على التصنيفات العامة وانتقل إلى الفئات المؤهلة من دليل التصنيفات.")
    ),
    e(PageLinks, { paths: directoryPaths, siteBaseUrl })
  );
}

export function PublicCategoriesContent({ categories = [], subcategories = [], siteBaseUrl = DEFAULT_SITE_BASE_URL }) {
  return e("main", { className: "ssg-public-content mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6", dir: "rtl" },
    e("header", { className: "space-y-3" },
      e("h1", null, PUBLIC_PAGE_METADATA["/categories"].heading),
      e("p", null, PUBLIC_PAGE_METADATA["/categories"].intro)
    ),
    e("section", { "aria-labelledby": "ssg-public-main-categories" },
      e("h2", { id: "ssg-public-main-categories", className: "mb-3 text-xl font-black" }, "التصنيفات الرئيسية"),
      categories.length
        ? e("ul", { className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-3" }, categories.map((category) => {
          const href = internalUrl(category.path, siteBaseUrl);
          return href ? e("li", { key: href },
            e("a", { href, className: "font-bold text-blue-700 underline" }, category.name)
          ) : null;
        }))
        : e("p", null, "لا تتوفر حاليًا صفحات تصنيف رئيسية مؤهلة في بيانات هذه النسخة.")
    ),
    subcategories.length ? e("section", { "aria-labelledby": "ssg-public-subcategories" },
      e("h2", { id: "ssg-public-subcategories", className: "mb-3 text-xl font-black" }, "تصنيفات فرعية مؤهلة"),
      e("ul", { className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-3" }, subcategories.map((category) => {
        const href = internalUrl(category.path, siteBaseUrl);
        return href ? e("li", { key: href },
          e("a", { href, className: "font-bold text-blue-700 underline" }, `${category.name} — ${category.parentName}`)
        ) : null;
      }))
    ) : null,
    e(PageLinks, { paths: DIRECTORY_PATHS["/categories"], siteBaseUrl })
  );
}

export function PublicCategoryContent({
  category,
  activeSubcategory,
  breadcrumbs = [],
  subcategories = [],
  ads = [],
  siteBaseUrl = DEFAULT_SITE_BASE_URL
}) {
  if (!category) return null;
  const activeCategory = activeSubcategory || category;
  return e("main", { className: "ssg-public-content", dir: "rtl" },
    e("nav", { "aria-label": "مسار التنقل" },
      breadcrumbs.map((breadcrumb) => e("a", { key: breadcrumb.url, href: absoluteUrl(breadcrumb.url, siteBaseUrl) }, breadcrumb.name))
    ),
    e("h1", null, `${activeCategory.name} للبيع في اليمن`),
    activeCategory.description ? e("p", null, activeCategory.description) : null,
    e("section", { "aria-labelledby": "ssg-category-children" },
      e("h2", { id: "ssg-category-children" }, "الأقسام الفرعية"),
      e("ul", null, subcategories.map((subcategory) => e("li", { key: subcategory.id || subcategory._id || subcategory.slug },
        e("a", {
          href: absoluteUrl(
            `/category/${encodeSeoPathSegment(category.slug)}/${encodeSeoPathSegment(subcategory.slug)}`,
            siteBaseUrl
          )
        }, subcategory.name)
      )))
    ),
    e("section", { "aria-labelledby": "ssg-category-ads" },
      e("h2", { id: "ssg-category-ads" }, "أحدث الإعلانات"),
      e("ul", null, ads.map((ad) => e(AdLink, { key: ad._id, ad, siteBaseUrl })))
    )
  );
}

export function PublicAdContent({ ad, breadcrumbs = [], similarAds = [], siteBaseUrl = DEFAULT_SITE_BASE_URL, apiOrigin = "" }) {
  const content = getPublicAdContentModel(ad, { breadcrumbs, siteBaseUrl, apiOrigin });
  if (!content) return null;

  return e("main", { className: "ssg-public-content", dir: "rtl" },
    e("nav", { "aria-label": "مسار التنقل" },
      content.breadcrumbs.map((breadcrumb) => e("a", { key: breadcrumb.url, href: breadcrumb.url }, breadcrumb.name))
    ),
    e("article", null,
      e("h1", null, content.title),
      content.image ? e("img", { src: content.image, alt: content.title, loading: "eager" }) : null,
      e("p", null, content.description),
      e("p", null, content.price),
      content.location ? e("p", null, content.location) : null,
      content.categoryUrl ? e("p", null, e("a", { href: content.categoryUrl }, content.categoryName)) : null,
      e("p", null, e("a", { href: content.adUrl }, "رابط الإعلان")),
      similarAds.length > 0 ? e("section", { "aria-labelledby": "ssg-similar-ads" },
        e("h2", { id: "ssg-similar-ads" }, "إعلانات مشابهة"),
        e("ul", null, similarAds.map((similarAd) => e(AdLink, { key: similarAd._id, ad: similarAd, siteBaseUrl })))
      ) : null
    )
  );
}

export function PublicRefundEscrowContent({ siteBaseUrl = DEFAULT_SITE_BASE_URL }) {
  return e("main", { className: "ssg-public-content mx-auto max-w-3xl space-y-6 rounded-lg border bg-white p-6 shadow-sm", dir: "rtl" },
    e("div", { className: "flex items-center gap-3" },
      e("img", { src: "/Amana-Logo.svg", alt: "أمانة", className: "h-10 w-10 rounded-xl bg-white object-contain p-1" }),
      e("h1", { className: "text-2xl font-bold text-gray-900" }, "الشراء الآمن عبر أمانة")
    ),
    e("section", null,
      e("h2", { className: "text-lg font-semibold text-gray-900" }, "مقدمة:"),
      e("p", { className: "text-sm text-gray-700" }, "سوقك منصة للإعلانات والطلبات ومتابعة الشحن، وأمانة هي هوية خدمة الوساطة المرتبطة بخيار الشراء الآمن. تمام باي شريك مستقل لخدمات الدفع الإلكتروني، ولا يعني ذكره توفر تكامل دفع في كل مسار.")
    ),
    e("section", null,
      e("h2", { className: "text-lg font-semibold text-gray-900" }, "المسؤولية:"),
      e("ul", { className: "list-disc space-y-2 px-5 text-sm text-gray-700" },
        e("li", null, "منصة سوقك لا تتحمل أي مسؤولية عن جودة أو سلامة المنتجات أو الخدمات."),
        e("li", null, "تتم متابعة الطلبات المقدمة عبر الشراء الآمن من صفحة العملية في سوقك، وفق الإجراءات الحالية.")
      )
    ),
    e("section", null,
      e("h2", { className: "text-lg font-semibold text-gray-900" }, "الحالات الاستثنائية:"),
      e("ul", { className: "list-disc space-y-2 px-5 text-sm text-gray-700" },
        e("li", null, "في حال وجود مستخدم موثق ارتكب احتيالاً، ستقوم منصة سوقك بمساعدة المتضرر بما تتيحه الأدلة المتوفرة لديها."),
        e("li", null, "يمكن لكل مستخدم رفع نزاع أو شكوى عبر مسارات الطلب المتاحة، وتراجعها الإدارة وفق الإجراء الحالي.")
      )
    ),
    e("section", null,
      e("h2", { className: "text-lg font-semibold text-gray-900" }, "تنويه:"),
      e("ul", { className: "list-disc space-y-2 px-5 text-sm text-gray-700" },
        e("li", null, "يُنصح المستخدمون بالتأكد من المنتج وفحصه قبل إتمام الصفقة."),
        e("li", null, "استخدام هوية أمانة لا يعني بذاته أن الأموال محفوظة في حساب مستقل لديها أو أن تكاملاً مالياً خارجياً قد اكتمل."),
        e("li", null, "لا تغيّر هذه الصفحة آلية معالجة الاسترداد أو قرارات النزاع المعمول بها حالياً."),
        e("li", null, e("a", { href: "https://amana-escrow.infinityfreeapp.com/", target: "_blank", rel: "noopener noreferrer", className: "font-bold text-emerald-700 underline" }, "زيارة موقع أمانة"))
      )
    ),
    e(PageLinks, { paths: DIRECTORY_PATHS["/refund-escrow"], siteBaseUrl })
  );
}

export function PublicSsgContent({ kind, data, siteBaseUrl, apiOrigin }) {
  const props = { ...data, siteBaseUrl, apiOrigin };
  if (kind === "home") return e(PublicHomeContent, props);
  if (kind === "categories") return e(PublicCategoriesContent, props);
  if (kind === "static-page") return e(PublicInfoPage, props);
  if (kind === "category") return e(PublicCategoryContent, props);
  if (kind === "ad") return e(PublicAdContent, props);
  if (kind === "category-static") {
    return e("div", {
      "data-ssg-content": "true",
      dangerouslySetInnerHTML: {
        __html: renderPublicCategoryContentHtml(props)
      }
    });
  }
  if (kind === "store-static") {
    return e("div", {
      "data-ssg-content": "true",
      dangerouslySetInnerHTML: {
        __html: renderPublicStoreContentHtml(props)
      }
    });
  }
  if (kind === "auction") {
    return e("div", {
      "data-ssg-content": "true",
      dangerouslySetInnerHTML: {
        __html: renderPublicAuctionContentHtml(props)
      }
    });
  }
  if (kind === "refund-escrow") return e(PublicRefundEscrowContent, props);
  return null;
}
