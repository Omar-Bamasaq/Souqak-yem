import { DEFAULT_SITE_BASE_URL, resolveSiteBaseUrl } from "../src/lib/siteUrl.js";
import { isPublicAdIndexable } from "../src/lib/publicAdIndexing.js";

export { DEFAULT_SITE_BASE_URL, resolveSiteBaseUrl };
export { isPublicAdIndexable as isIndexableAd };

export const PRERENDER_AD_PAGE_LIMIT = 10;

export const INDEXABLE_STATIC_ROUTES = [
  {
    path: "/",
    title: "سوقك - سوق اليمن للإعلانات والبيع والشراء",
    description: "سوقك هو منصة يمنية موثوقة للبيع والشراء والإعلانات المبوبة مع ميزة الشراء الآمن، وتتيح لك عرض وشراء السيارات، العقارات، الإلكترونيات والمنتجات والخدمات بسهولة.",
    canonical: "/"
  },
  {
    path: "/categories",
    title: "الفئات | سوقك",
    description: "تصفح فئات الإعلانات في سوقك، بما في ذلك السيارات، العقارات، الإلكترونيات، الأثاث والأعمال والخدمات.",
    canonical: "/categories"
  },
  {
    path: "/how-it-works",
    title: "كيف يعمل سوقك | سوقك",
    description: "تعرف على طريقة البيع والشراء، والشراء الآمن، وكيفية حماية المستخدمين في سوقك.",
    canonical: "/how-it-works"
  },
  {
    path: "/secure-deal-explanation",
    title: "الشراء الآمن | سوقك",
    description: "اكتشف كيف يضمن سوقك سلامة المعاملات والرسوم والإجراءات الأمنية في البيع والشراء.",
    canonical: "/secure-deal-explanation"
  },
  {
    path: "/refund-escrow",
    title: "استرداد مبلغ الشراء الآمن | سوقك",
    description: "تعرف على آلية استرداد المبالغ في خدمة الشراء الآمن من سوقك.",
    canonical: "/refund-escrow"
  },
  {
    path: "/platform-reviews",
    title: "آراء المنصة | سوقك",
    description: "اقرأ تقييمات المستخدمين ومراجعات سوقك لتتأكد من الموثوقية والثقة في المنصة.",
    canonical: "/platform-reviews"
  },
  {
    path: "/pricing",
    title: "الأسعار والخطط | سوقك",
    description: "اكتشف خطط سوقك وخدمات الترويج والإعلانات المميزة للأسعار المناسبة.",
    canonical: "/pricing"
  },
  {
    path: "/terms",
    title: "شروط الاستخدام | سوقك",
    description: "اقرأ شروط الاستخدام في سوقك والالتزامات والحقوق المتعلقة بالتطبيق.",
    canonical: "/terms"
  },
  {
    path: "/privacy",
    title: "سياسة الخصوصية | سوقك",
    description: "تعرف على سياسة الخصوصية وكيفية حماية بيانات المستخدمين في سوقك.",
    canonical: "/privacy"
  },
  {
    path: "/bookings",
    title: "دليل الخدمات | سوقك",
    description: "ابحث عن الخدمات والأعمال المحلية في اليمن عبر دليل الخدمات في سوقك.",
    canonical: "/bookings"
  },
  {
    path: "/stores",
    title: "متاجر سوقك | سوقك",
    description: "تصفح المتاجر المعتمدة ومنتجاتها في سوقك.",
    canonical: "/stores"
  },
  {
    path: "/family-production",
    title: "الأسر المنتجة | سوقك",
    description: "اكتشف منتجات ومشاريع الأسر المنتجة في سوقك.",
    canonical: "/family-production"
  },
  {
    path: "/auctions",
    title: "المزادات | سوقك",
    description: "تصفح المزادات المتاحة على السيارات والمنتجات في سوقك.",
    canonical: "/auctions"
  }
];

export const NON_INDEXABLE_STATIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/verify-email",
  "/admin",
  "/seller",
  "/messages",
  "/notifications",
  "/favorites",
  "/following",
  "/wallet",
  "/account-settings",
  "/my-ads",
  "/orders",
  "/chat",
  "/add-product",
  "/choose-add-type",
  "/commission/pay"
];

export const slugify = (value) => String(value || "")
  .toLowerCase()
  .replace(/[^\w\s\u0600-\u06ff-]/g, "")
  .replace(/[\s_-]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 60)
  .replace(/-+$/, "");

const isSafeRouteSegment = (value) => (
  typeof value === "string" &&
  value.length > 0 &&
  value !== "." &&
  value !== ".." &&
  !value.includes("/") &&
  !value.includes("\\")
);

const uniquePagesByUrl = (pages) => [...new Map(pages.map((page) => [page.url, page])).values()];



export function createPublicPrerenderPlan({
  siteBase = DEFAULT_SITE_BASE_URL,
  categories = [],
  categorySsgDataBySlug = new Map(),
  ads = [],
  adLimit = PRERENDER_AD_PAGE_LIMIT
} = {}) {
  const normalizedSiteBase = resolveSiteBaseUrl(siteBase);
  const nonIndexablePaths = new Set(NON_INDEXABLE_STATIC_PATHS);
  const staticPages = uniquePagesByUrl(INDEXABLE_STATIC_ROUTES
    .filter((route) => !nonIndexablePaths.has(route.path))
    .map((route) => ({
      ...route,
      url: `${normalizedSiteBase}${route.canonical}`
    })));
  const categoryPages = uniquePagesByUrl(categories
    .filter((category) => isSafeRouteSegment(category?.slug) && category.name && categorySsgDataBySlug.has(category.slug))
    .map((category) => {
      const encodedSlug = encodeURIComponent(category.slug);
      return {
        category,
        path: `/category/${category.slug}`,
        url: `${normalizedSiteBase}/category/${encodedSlug}`,
        ssgData: categorySsgDataBySlug.get(category.slug)
      };
    }));
  const adPages = uniquePagesByUrl(ads
    .filter((ad) => isSafeRouteSegment(String(ad?._id || "")) && isPublicAdIndexable(ad))
    .map((ad) => {
      const slug = slugify(ad.slug || ad.title) || "ad";
      const path = `/ad/${String(ad._id)}/${slug}`;
      const url = `${normalizedSiteBase}/ad/${encodeURIComponent(String(ad._id))}/${encodeURIComponent(slug)}`;
      return { ad, path, url };
    })).slice(0, adLimit);
  const sitemapUrls = [...new Set([
    ...staticPages.map((page) => page.url),
    ...categoryPages.map((page) => page.url),
    ...adPages.map((page) => page.url)
  ])];

  return { staticPages, categoryPages, adPages, sitemapUrls };
}
