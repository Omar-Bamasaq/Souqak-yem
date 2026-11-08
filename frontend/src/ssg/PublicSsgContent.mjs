import React from "react";
import { DEFAULT_SITE_BASE_URL, resolveSiteUrl } from "../lib/siteUrl.js";

const e = React.createElement;

const absoluteUrl = (path, siteBaseUrl) => resolveSiteUrl(path || "/", siteBaseUrl);

const imageUrl = (image, siteBaseUrl, apiOrigin) => {
  if (!image) return absoluteUrl("/logo.png", siteBaseUrl);
  if (image.startsWith("http")) return image;
  return `${apiOrigin}/uploads/${image.replace(/^\/+/, "").replace(/^uploads\//, "")}`;
};

const formatPrice = (ad) => {
  if (ad?.priceOnContact || ad?.price === undefined || ad?.price === null) return "السعر عند التواصل";
  return `${Number(ad.price).toLocaleString("ar-EG")} ${ad.currency || "ريال يمني"}`;
};

const AdLink = ({ ad, siteBaseUrl = DEFAULT_SITE_BASE_URL }) => {
  if (!ad?._id) return null;
  const slug = ad.slug || ad.title || "ad";
  const href = absoluteUrl(`/ad/${ad._id}/${slugify(slug)}`, siteBaseUrl);
  return e("li", { key: ad._id }, e("a", { href }, ad.title || "إعلان في سوقك"));
};

const slugify = (value) => String(value || "")
  .toLowerCase()
  .replace(/[^\w\s\u0600-\u06ff-]/g, "")
  .replace(/[\s_-]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 60)
  .replace(/-+$/, "") || "ad";

export function PublicHomeContent({ categories = [], ads = [], siteBaseUrl = DEFAULT_SITE_BASE_URL }) {
  return e("main", { className: "ssg-public-content", dir: "rtl" },
    e("h1", null, "سوقك، سوق اليمن بين يديك"),
    e("h2", null, "بيع واشترِ بكل سهولة وأمان"),
    e("p", null, "سوقك الموثوق لكل ما تحتاجه في اليمن."),
    e("section", { "aria-labelledby": "ssg-home-categories" },
      e("h2", { id: "ssg-home-categories" }, "تصفح حسب الفئة"),
      e("ul", null, categories.map((category) => e("li", { key: category.id || category._id || category.slug },
        e("a", { href: absoluteUrl(`/category/${category.slug}`, siteBaseUrl) }, category.name)
      )))
    ),
    e("section", { "aria-labelledby": "ssg-home-ads" },
      e("h2", { id: "ssg-home-ads" }, "أحدث الإعلانات"),
      e("ul", null, ads.map((ad) => e(AdLink, { key: ad._id, ad, siteBaseUrl })))
    )
  );
}

export function PublicCategoryContent({ category, breadcrumbs = [], subcategories = [], ads = [], siteBaseUrl = DEFAULT_SITE_BASE_URL }) {
  if (!category) return null;
  return e("main", { className: "ssg-public-content", dir: "rtl" },
    e("nav", { "aria-label": "مسار التنقل" },
      breadcrumbs.map((breadcrumb) => e("a", { key: breadcrumb.url, href: absoluteUrl(breadcrumb.url, siteBaseUrl) }, breadcrumb.name))
    ),
    e("h1", null, `${category.name} للبيع في اليمن`),
    category.description ? e("p", null, category.description) : null,
    e("section", { "aria-labelledby": "ssg-category-children" },
      e("h2", { id: "ssg-category-children" }, "الأقسام الفرعية"),
      e("ul", null, subcategories.map((subcategory) => e("li", { key: subcategory.id || subcategory._id || subcategory.slug },
        e("a", { href: absoluteUrl(`/category/${category.slug}?sub=${encodeURIComponent(subcategory.slug)}`, siteBaseUrl) }, subcategory.name)
      )))
    ),
    e("section", { "aria-labelledby": "ssg-category-ads" },
      e("h2", { id: "ssg-category-ads" }, "أحدث الإعلانات"),
      e("ul", null, ads.map((ad) => e(AdLink, { key: ad._id, ad, siteBaseUrl })))
    )
  );
}

export function PublicAdContent({ ad, breadcrumbs = [], similarAds = [], siteBaseUrl = DEFAULT_SITE_BASE_URL, apiOrigin = "" }) {
  if (!ad) return null;
  const title = ad.title || "إعلان في سوقك";
  const image = Array.isArray(ad.images) && ad.images.length ? ad.images[0] : null;
  const category = ad.categoryId?.parentId || ad.categoryId;
  const adUrl = absoluteUrl(`/ad/${ad._id}/${slugify(ad.slug || title)}`, siteBaseUrl);

  return e("main", { className: "ssg-public-content", dir: "rtl" },
    e("nav", { "aria-label": "مسار التنقل" },
      breadcrumbs.map((breadcrumb) => e("a", { key: breadcrumb.url, href: absoluteUrl(breadcrumb.url, siteBaseUrl) }, breadcrumb.name))
    ),
    e("article", null,
      e("h1", null, title),
      image ? e("img", { src: imageUrl(image, siteBaseUrl, apiOrigin), alt: title, loading: "eager" }) : null,
      e("p", null, ad.description || `إعلان ${title} في سوقك.`),
      e("p", null, formatPrice(ad)),
      ad.governorateId?.name || ad.cityId?.name ? e("p", null, [ad.governorateId?.name, ad.cityId?.name].filter(Boolean).join("، ")) : null,
      category?.slug ? e("p", null, e("a", { href: absoluteUrl(`/category/${category.slug}`, siteBaseUrl) }, category.name)) : null,
      e("p", null, e("a", { href: adUrl }, "رابط الإعلان")),
      similarAds.length > 0 ? e("section", { "aria-labelledby": "ssg-similar-ads" },
        e("h2", { id: "ssg-similar-ads" }, "إعلانات مشابهة"),
        e("ul", null, similarAds.map((similarAd) => e(AdLink, { key: similarAd._id, ad: similarAd, siteBaseUrl })))
      ) : null
    )
  );
}

export function PublicRefundEscrowContent() {
  return e("main", { className: "mx-auto max-w-3xl space-y-6 rounded-lg border bg-white p-6 shadow-sm", dir: "rtl" },
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
    )
  );
}

export function PublicSsgContent({ kind, data, siteBaseUrl, apiOrigin }) {
  const props = { ...data, siteBaseUrl, apiOrigin };
  if (kind === "home") return e(PublicHomeContent, props);
  if (kind === "category") return e(PublicCategoryContent, props);
  if (kind === "ad") return e(PublicAdContent, props);
  if (kind === "refund-escrow") return e(PublicRefundEscrowContent);
  return null;
}
