export const DEFAULT_SITE_BASE_URL = "https://souqak-yem.com";
export const MIN_PUBLIC_ADS_FOR_SUBCATEGORY = 1;
export const ROBOTS_DISALLOW_PATHS = Object.freeze([
  "/api/",
  "/admin",
  "/admin-login",
  "/login",
  "/register",
  "/forgot-password",
  "/phone-forgot-password",
  "/verify-email",
  "/set-new-password",
  "/seller",
  "/messages",
  "/notifications",
  "/favorites",
  "/following",
  "/wallet",
  "/wallet-services",
  "/account",
  "/account-settings",
  "/my-ads",
  "/my-quote-requests",
  "/my-quote-offers",
  "/my-store",
  "/my-family-production",
  "/orders",
  "/chat",
  "/cart",
  "/add-product",
  "/choose-add-type",
  "/edit-ad",
  "/commission/pay",
  "/brokerage",
  "/referrals",
  "/auctions/new",
  "/my-auctions"
]);

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const SLUG_ALLOWED_PATTERN = /[^\w\s\u0600-\u06ff-]/g;
const TRACKING_QUERY_PARAMETER_PATTERN = /^utm_/i;
const TRACKING_QUERY_PARAMETERS = new Set([
  "ref",
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "ttclid",
  "wbraid",
  "gbraid",
  "_ga",
  "_gl",
  "yclid"
]);

export const INDEXABLE_STATIC_PATHS = Object.freeze([
  "/",
  "/categories",
  "/how-it-works",
  "/secure-deal-explanation",
  "/refund-escrow",
  "/platform-reviews",
  "/pricing",
  "/terms",
  "/privacy",
  "/bookings",
  "/stores",
  "/family-production",
  "/auctions"
]);

export const NON_INDEXABLE_STATIC_PATHS = Object.freeze([
  "/login",
  "/admin-login",
  "/register",
  "/forgot-password",
  "/phone-forgot-password",
  "/verify-email",
  "/set-new-password",
  "/admin",
  "/seller",
  "/messages",
  "/notifications",
  "/favorites",
  "/following",
  "/wallet",
  "/wallet-services",
  "/account",
  "/account-settings",
  "/my-ads",
  "/my-quote-requests",
  "/my-quote-offers",
  "/my-store",
  "/my-family-production",
  "/orders",
  "/chat",
  "/cart",
  "/add-product",
  "/choose-add-type",
  "/commission/pay",
  "/quote-requests",
  "/search",
  "/tag",
  "/user",
  "/s",
  "/auctions/new",
  "/my-auctions"
]);

export function resolveSiteBaseUrl(configuredUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(configuredUrl || DEFAULT_SITE_BASE_URL);
  } catch {
    throw new Error("The public site URL must be a valid HTTPS URL.");
  }
  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    throw new Error("The public site URL must use HTTPS without credentials, query, or fragment.");
  }
  return `${parsedUrl.origin}${parsedUrl.pathname.replace(/\/+$/, "")}`;
}

export function resolveMinimumPublicAdsForSubcategory(value) {
  if (value == null || value === "") return MIN_PUBLIC_ADS_FOR_SUBCATEGORY;
  const minimum = Number(value);
  if (!Number.isSafeInteger(minimum) || minimum < MIN_PUBLIC_ADS_FOR_SUBCATEGORY) {
    throw new Error("The minimum public ads for subcategories must be a positive integer.");
  }
  return minimum;
}

export function generateRobotsTxt(siteBaseUrl = DEFAULT_SITE_BASE_URL) {
  const sitemapUrl = `${resolveSiteBaseUrl(siteBaseUrl)}/sitemap.xml`;
  return [
    "User-agent: *",
    "Allow: /",
    "Allow: /assets/",
    "Allow: /uploads/",
    ...ROBOTS_DISALLOW_PATHS.map((path) => `Disallow: ${path}`),
    `Sitemap: ${sitemapUrl}`,
    ""
  ].join("\n");
}

export function isTrackingQueryParameter(name) {
  const normalizedName = String(name || "").toLowerCase();
  return TRACKING_QUERY_PARAMETER_PATTERN.test(normalizedName) ||
    TRACKING_QUERY_PARAMETERS.has(normalizedName);
}

export function stripTrackingQueryParameters(searchParams) {
  const params = searchParams instanceof URLSearchParams
    ? new URLSearchParams(searchParams)
    : new URLSearchParams(String(searchParams || "").replace(/^\?/, ""));
  for (const key of [...params.keys()]) {
    if (isTrackingQueryParameter(key)) params.delete(key);
  }
  return params;
}

export function hasMeaningfulQueryParameters(searchParams) {
  const params = searchParams instanceof URLSearchParams
    ? searchParams
    : new URLSearchParams(String(searchParams || "").replace(/^\?/, ""));
  return [...params.keys()].some((key) => !isTrackingQueryParameter(key));
}

export function hasOnlyCategorySubcategoryParameter(searchParams, subcategorySlug) {
  const params = searchParams instanceof URLSearchParams
    ? searchParams
    : new URLSearchParams(String(searchParams || "").replace(/^\?/, ""));
  const meaningfulEntries = [...params.entries()]
    .filter(([key]) => !isTrackingQueryParameter(key));
  if (!subcategorySlug) return meaningfulEntries.length === 0;
  return meaningfulEntries.length === 1 &&
    meaningfulEntries[0][0] === "sub" &&
    meaningfulEntries[0][1] === subcategorySlug;
}

export function resolveSiteUrl(pathOrUrl, baseUrl = DEFAULT_SITE_BASE_URL) {
  const normalizedBaseUrl = resolveSiteBaseUrl(baseUrl);
  const base = new URL(`${normalizedBaseUrl}/`);
  let resolved;
  try {
    resolved = new URL(pathOrUrl || "/", base);
  } catch {
    throw new Error("Public SEO URLs must be valid URLs.");
  }
  if (
    resolved.origin !== base.origin ||
    resolved.username ||
    resolved.password
  ) {
    throw new Error("Public SEO URLs must use the configured site origin.");
  }
  try {
    decodeURI(resolved.pathname);
  } catch {
    throw new Error("Public SEO URLs must use valid encoded path text.");
  }

  const basePath = base.pathname.replace(/\/+$/, "");
  const alreadyHasBasePath = !basePath ||
    resolved.pathname === basePath ||
    resolved.pathname.startsWith(`${basePath}/`);
  const pathname = alreadyHasBasePath
    ? resolved.pathname
    : `${basePath}${resolved.pathname.startsWith("/") ? resolved.pathname : `/${resolved.pathname}`}`;
  return `${base.origin}${pathname}${resolved.search}${resolved.hash}`;
}

export function resolveCanonicalUrl(canonicalUrl, baseUrl = DEFAULT_SITE_BASE_URL) {
  const resolved = new URL(resolveSiteUrl(canonicalUrl || "/", baseUrl));
  const normalizedBaseUrl = resolveSiteBaseUrl(baseUrl);
  const basePath = new URL(`${normalizedBaseUrl}/`).pathname.replace(/\/+$/, "");
  const isHomePath = resolved.pathname === "/" || (basePath && resolved.pathname === `${basePath}/`);
  if (!isHomePath) resolved.pathname = resolved.pathname.replace(/\/+$/, "") || "/";
  resolved.search = stripTrackingQueryParameters(resolved.search).toString();
  resolved.hash = "";
  return `${resolved.origin}${resolved.pathname}${resolved.search}`;
}

export function slugifySeoValue(value) {
  let text = String(value || "");
  if (/%[a-f\d]{2}/i.test(text)) {
    try {
      text = decodeURIComponent(text);
    } catch {
      return "";
    }
    if (/%[a-f\d]{2}/i.test(text)) return "";
  }
  return text
    .toLowerCase()
    .replace(SLUG_ALLOWED_PATTERN, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export function getAdSlug(ad) {
  return slugifySeoValue(ad?.slug) || slugifySeoValue(ad?.title) || "ad";
}

export function normalizePublicObjectId(value) {
  const id = String(value || "");
  return OBJECT_ID_PATTERN.test(id) ? id.toLowerCase() : null;
}

export function encodeSeoPathSegment(value) {
  let segment = String(value || "");
  if (/%[a-f\d]{2}/i.test(segment)) {
    try {
      segment = decodeURIComponent(segment);
    } catch {
      throw new Error("SEO path segments must be valid URL text.");
    }
    if (/%[a-f\d]{2}/i.test(segment)) {
      throw new Error("SEO path segments must not be double encoded.");
    }
  }
  if (
    !segment ||
    segment === "." ||
    segment === ".." ||
    /[\\/?#\u0000-\u001f\u007f]/u.test(segment)
  ) {
    throw new Error("SEO path segments must contain one safe path segment.");
  }
  return encodeURIComponent(segment);
}

export function buildAdPath(ad) {
  const id = normalizePublicObjectId(ad?._id);
  if (!id) return null;
  return `/ad/${id}/${encodeSeoPathSegment(getAdSlug(ad))}`;
}

export function isPublicAdIndexable(ad, now = Date.now()) {
  if (!normalizePublicObjectId(ad?._id) || ad.status !== "approved") return false;
  if (
    ad.isDeleted === true ||
    ad.isVisible === false ||
    ad.isArchived === true ||
    ad.sold === true ||
    ad.isSold === true ||
    ad.isAvailable === false
  ) return false;

  const expiresAt = ad.expiresAt instanceof Date
    ? ad.expiresAt.getTime()
    : Date.parse(ad.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return false;

  if (ad.scheduledPublishAt != null) {
    const scheduledPublishAt = ad.scheduledPublishAt instanceof Date
      ? ad.scheduledPublishAt.getTime()
      : Date.parse(ad.scheduledPublishAt);
    if (!Number.isFinite(scheduledPublishAt) || scheduledPublishAt > now) return false;
  }

  if (
    ad.inventoryEnabled === true &&
    (!Number.isFinite(Number(ad.stockQuantity)) || Number(ad.stockQuantity) <= 0)
  ) return false;

  return true;
}

export function isPublicCategoryIndexable({
  category,
  isMainCategory,
  parentCategory,
  relatedCategories = [],
  publicAdCount = 0,
  minimumPublicAds = MIN_PUBLIC_ADS_FOR_SUBCATEGORY,
  hasMeaningfulFilters = false
} = {}) {
  if (
    !category ||
    category.status !== "active" ||
    !String(category.name || "").trim() ||
    !String(category.slug || "").trim() ||
    !normalizePublicObjectId(category._id || category.id) ||
    !hasDistinctSeoDescription(category, relatedCategories) ||
    hasMeaningfulFilters === true
  ) return false;

  if (isMainCategory === true) {
    return category.parentId == null;
  }

  const parentId = String(parentCategory?._id || parentCategory?.id || "");
  return Boolean(
    isMainCategory === false &&
    parentCategory?.status === "active" &&
    normalizePublicObjectId(parentId) &&
    normalizePublicObjectId(category.parentId) &&
    String(category.parentId || "") === parentId &&
    Number.isInteger(minimumPublicAds) &&
    minimumPublicAds >= MIN_PUBLIC_ADS_FOR_SUBCATEGORY &&
    Number.isInteger(publicAdCount) &&
    publicAdCount >= minimumPublicAds
  );
}

export function hasDistinctSeoDescription(category, relatedCategories = []) {
  const normalize = (value) => String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
  const description = normalize(category?.description);
  const wordCount = description.match(/[\p{L}\p{N}]+/gu)?.length || 0;
  if (wordCount < 3 || description === normalize(category?.name)) return false;
  return !relatedCategories.some((relatedCategory) => (
    relatedCategory && normalize(relatedCategory.description) === description
  ));
}

export function isPublicStoreIndexable({
  store,
  hasActiveSubscription,
  isDedicatedPwa = false,
  hasMeaningfulFilters = false
} = {}) {
  return Boolean(
    store?.status === "active" &&
    hasActiveSubscription === true &&
    isDedicatedPwa !== true &&
    hasMeaningfulFilters !== true
  );
}

export function isPublicAuctionIndexable(auction, now = Date.now(), { publiclyAccessible = false } = {}) {
  if (
    !auction ||
    (auction.reviewStatus !== "approved" &&
      !(publiclyAccessible === true && auction.reviewStatus == null)) ||
    auction.isDeleted === true ||
    auction.isHidden === true ||
    auction.isVisible === false ||
    auction.publiclyAccessible === false ||
    auction.status !== "live"
  ) return false;

  const startAt = auction.startAt instanceof Date
    ? auction.startAt.getTime()
    : Date.parse(auction.startAt);
  const endAt = auction.endAt instanceof Date
    ? auction.endAt.getTime()
    : Date.parse(auction.endAt);
  return Number.isFinite(startAt) && Number.isFinite(endAt) &&
    startAt <= now && endAt > now;
}

export function isPublicBookingServiceIndexable({ service, publiclyAccessible } = {}) {
  return Boolean(
    service?.status === "approved" &&
    service.isDeleted !== true &&
    service.isHidden !== true &&
    service.isVisible !== false &&
    publiclyAccessible === true &&
    String(service.name || "").trim() &&
    String(service.type || "").trim() &&
    String(service.note || "").trim()
  );
}

export function classifySeoResource({ resource, error, publiclyAccessible, indexable } = {}) {
  if (error) return "temporary_error";
  if (resource == null) return "not_found";
  if (publiclyAccessible !== true) return "not_public";
  return indexable === true ? "indexable" : "not_indexable";
}

export function getSeoRoutePolicy(pathname) {
  const path = typeof pathname === "string" && pathname.length > 1
    ? pathname.replace(/\/+$/, "")
    : pathname || "/";

  if (INDEXABLE_STATIC_PATHS.includes(path)) {
    return { type: "static", indexability: "indexable" };
  }
  if (NON_INDEXABLE_STATIC_PATHS.some((prefix) => (
    path === prefix || path.startsWith(`${prefix}/`)
  ))) {
    return { type: "private-or-search", indexability: "never" };
  }
  if (/^\/(?:product\/[^/]+|ad\/[^/]+)$/.test(path)) {
    return { type: "legacy-ad-alias", indexability: "never" };
  }
  if (/^\/ad\/[^/]+\/[^/]+$/.test(path)) {
    return { type: "ad-detail", indexability: "conditional" };
  }
  if (/^\/category\/[^/]+$/.test(path)) {
    return { type: "category", indexability: "conditional" };
  }
  if (/^\/category\/[^/]+\/[^/]+$/.test(path)) {
    return { type: "subcategory", indexability: "conditional" };
  }
  if (/^\/store\/[^/]+$/.test(path)) {
    return { type: "store", indexability: "conditional" };
  }
  if (/^\/auctions\/[^/]+$/.test(path)) {
    return { type: "auction-detail", indexability: "conditional" };
  }
  return { type: "not-found-or-unclassified", indexability: "never" };
}

export function shouldNoIndexAppPath(pathname) {
  return getSeoRoutePolicy(pathname).indexability !== "indexable";
}

export function getAppRobotsDirective(
  pathname,
  { hasTrustedPrerender = false, isInitialPath = false } = {}
) {
  const policy = getSeoRoutePolicy(pathname);
  if (policy.indexability === "indexable") {
    return "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";
  }
  if (
    policy.indexability === "conditional" &&
    isInitialPath === true &&
    hasTrustedPrerender === true
  ) {
    return null;
  }
  return "noindex,nofollow";
}

export const SAFE_EMPTY_AD_DESCRIPTION = "إعلان مبوب في سوقك.";

export function sanitizeSeoAdDescription(value, maxLength = 2000) {
  if (typeof value !== "string") return SAFE_EMPTY_AD_DESCRIPTION;

  let decoded = value;
  for (let pass = 0; pass < 3; pass += 1) {
    let failed = false;
    const next = decoded.replace(/(?:%[a-f\d]{2})+/gi, (encoded) => {
      try {
        return decodeURIComponent(encoded);
      } catch {
        failed = true;
        return "";
      }
    });
    if (failed) return SAFE_EMPTY_AD_DESCRIPTION;
    if (next === decoded) break;
    decoded = next;
  }
  if (/%[a-f\d]{2}/i.test(decoded)) return SAFE_EMPTY_AD_DESCRIPTION;

  let sanitized = decoded
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#64;|&#x40;/gi, "@")
    .replace(/&#47;|&#x2f;/gi, "/")
    .replace(/&#58;|&#x3a;/gi, ":")
    .replace(/&#61;|&#x3d;/gi, "=")
    .replace(/&commat;/gi, "@")
    .replace(/&(?:period|dot);/gi, ".")
    .replace(/&sol;/gi, "/")
    .replace(/&bsol;/gi, "\\")
    .replace(/&colon;/gi, ":")
    .replace(/&equals;/gi, "=")
    .replace(/&#(?:x([a-f\d]{1,2})|(\d{1,3}));/gi, (entity, hex, decimal) => {
      const codePoint = Number.parseInt(hex || decimal, hex ? 16 : 10);
      return codePoint <= 0x7f ? String.fromCharCode(codePoint) : entity;
    })
    .replace(/&(?:nbsp|#160);/gi, " ")
    .replace(/&(?:amp|quot|apos|lt|gt);/gi, " ");

  sanitized = sanitized
    .replace(/[\w.+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[تم إزالة البريد]")
    .replace(/(?:bearer\s+)?(?:password|passphrase|token|secret|api[_-]?key|session|cookie|authorization)\s*[:=]\s*[^\s,؛;]+/gi, "[تم إزالة اعتماد]")
    .replace(/(?:https?:\/\/|www\.|mailto:|tel:|javascript:|data:)[^\s<>"']+/gi, "[تم إزالة رابط]")
    .replace(/\b(?:[A-Z0-9-]+\.)+[A-Z]{2,}(?:\/[^\s]*)?/gi, "[تم إزالة رابط]")
    .replace(/\b(?:private(?:[_-]?uploads)?|identity|passport|verification|documents|attachments|wallet|admin|account|auth)(?:[\\/]|%2f)[^\s,؛;]+/gi, "[تم إزالة مسار خاص]")
    .replace(/(?:\+?967[\s().-]*)?7(?:[\s().-]*\d){7,8}\b/gi, "[تم إزالة رقم]");

  sanitized = sanitized
    .replace(/\b(?:\+?\d{1,4}[\s().-]?)(?:\d[\s().-]*){7,14}\d\b/g, "[تم إزالة رقم]")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.،؛])/g, "$1")
    .trim()
    .slice(0, maxLength)
    .trim();

  const meaningfulText = sanitized
    .replace(/\[(?:تم إزالة البريد|تم إزالة اعتماد|تم إزالة رابط|تم إزالة مسار خاص|تم إزالة رقم)\]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!meaningfulText || !/[\p{L}\p{N}]/u.test(meaningfulText)) {
    return SAFE_EMPTY_AD_DESCRIPTION;
  }

  return sanitized;
}

export function createBreadcrumbList(breadcrumbs = [], siteBaseUrl) {
  if (!Array.isArray(breadcrumbs) || breadcrumbs.length < 2) return null;
  if (breadcrumbs.some((breadcrumb) => !breadcrumb?.name || !breadcrumb?.url)) return null;

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbs.map((breadcrumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: breadcrumb.name,
      item: resolveCanonicalUrl(breadcrumb.url, siteBaseUrl)
    }))
  };
}

export function createAdStructuredData({
  ad,
  url,
  image,
  breadcrumbs = [],
  siteBaseUrl
}) {
  const breadcrumbList = createBreadcrumbList(breadcrumbs, siteBaseUrl);
  const offer = createAdOffer(ad, url, siteBaseUrl);
  const product = isPublicAdIndexable(ad) && isPhysicalProductAd(ad) && ad.title
    ? {
      "@context": "https://schema.org",
      "@type": "Product",
      name: ad.title,
      ...(ad.description ? { description: sanitizeSeoAdDescription(ad.description) } : {}),
      ...(image ? { image } : {}),
      url: resolveCanonicalUrl(url, siteBaseUrl),
      ...(typeof ad.itemCondition === "string" && ad.itemCondition.trim()
        ? { itemCondition: ad.itemCondition.trim() }
        : {}),
      ...(offer ? { offers: offer } : {})
    }
    : createWebPageStructuredData({
      name: ad?.title,
      description: ad?.description,
      url,
      image,
      siteBaseUrl,
      breadcrumbs
    });

  return product;
}

export function isPhysicalProductAd(ad) {
  if (ad?.adType !== "sell") return false;
  if (ad?.productType === "physical" || ad?.itemType === "physical") return true;
  const categoryText = [
    ad?.categoryId?.slug,
    ad?.categoryId?.name,
    ad?.subcategory?.slug,
    ad?.subcategory?.name,
    ad?.parentCategory?.slug,
    ad?.parentCategory?.name
  ].filter(Boolean).join(" ").toLocaleLowerCase();
  if (!categoryText) return false;
  if (/وظائف?|خدمات?|عقارات?|إيجار|أراضي|شقق|فلل|محلات|مكاتب|استراحات|jobs?|services?|real.?estate|rental|rent|orders?|طلبات؟/i.test(categoryText)) {
    return false;
  }
  return /سيارات?|إلكترونيات?|جوالات?|هواتف?|أثاث|ملابس|أزياء|مجوهرات|حيوانات|طعام|مواد|أجهزة|كمبيوتر|لابتوب|موبايل|motors?|vehicles?|electronics?|furniture|fashion|mobiles?|phones?|computers?|clothing/i.test(categoryText);
}

export function serializeJsonLd(value) {
  if (value == null) return "";
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) => ({
    "<": "\\u003c",
    ">": "\\u003e",
    "&": "\\u0026",
    "\u2028": "\\u2028",
    "\u2029": "\\u2029"
  })[character]);
}

export function createOrganizationStructuredData({
  siteBaseUrl = DEFAULT_SITE_BASE_URL
} = {}) {
  const base = resolveSiteBaseUrl(siteBaseUrl);
  return {
    "@type": "Organization",
    "@id": `${base}/#organization`,
    name: "سوقك",
    alternateName: "Souqak",
    url: base,
    logo: {
      "@type": "ImageObject",
      url: `${base}/logo-full.svg`
    },
    description: "منصة يمنية للإعلانات والبيع والشراء والتجارة والخدمات العامة.",
    sameAs: [
      "https://www.facebook.com/profile.php?id=61595141417781",
      "https://www.tiktok.com/@souqak.yem",
      "https://www.instagram.com/souqak.ye"
    ]
  };
}

export function createWebSiteStructuredData({
  siteBaseUrl = DEFAULT_SITE_BASE_URL
} = {}) {
  const base = resolveSiteBaseUrl(siteBaseUrl);
  return {
    "@type": "WebSite",
    "@id": `${base}/#website`,
    url: base,
    name: "سوقك",
    alternateName: "Souqak",
    inLanguage: "ar-YE",
    publisher: { "@id": `${base}/#organization` }
  };
}

export function createPublicSiteStructuredData({
  siteBaseUrl = DEFAULT_SITE_BASE_URL
} = {}) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      createOrganizationStructuredData({ siteBaseUrl }),
      createWebSiteStructuredData({ siteBaseUrl })
    ]
  };
}

export function createWebPageStructuredData({
  name,
  description,
  url,
  image,
  siteBaseUrl = DEFAULT_SITE_BASE_URL,
  breadcrumbs = []
} = {}) {
  const safeName = String(name || "").trim();
  if (!safeName) return null;
  const canonical = resolveCanonicalUrl(url || "/", siteBaseUrl);
  const breadcrumbList = createBreadcrumbList(breadcrumbs, siteBaseUrl);
  const page = {
    "@type": "WebPage",
    "@id": canonical,
    name: safeName,
    url: canonical,
    inLanguage: "ar-YE",
    isPartOf: { "@id": `${resolveSiteBaseUrl(siteBaseUrl)}/#website` }
  };
  const safeDescription = sanitizeSeoAdDescription(description, 160);
  if (safeDescription && safeDescription !== SAFE_EMPTY_AD_DESCRIPTION) {
    page.description = safeDescription;
  }
  if (typeof image === "string" && /^https:\/\//i.test(image)) {
    page.image = image;
  }
  if (!breadcrumbList) return { "@context": "https://schema.org", ...page };
  return {
    "@context": "https://schema.org",
    "@graph": [page, breadcrumbList]
  };
}

export function createCategoryStructuredData({
  category,
  url,
  ads = [],
  breadcrumbs = [],
  siteBaseUrl = DEFAULT_SITE_BASE_URL
} = {}) {
  if (!category?.name || !url) return null;
  const canonical = resolveCanonicalUrl(url, siteBaseUrl);
  const breadcrumbList = createBreadcrumbList(breadcrumbs, siteBaseUrl);
  const publicAds = Array.isArray(ads)
    ? ads.filter((ad) => isPublicAdIndexable(ad)).slice(0, 20)
    : [];
  const page = {
    "@type": "CollectionPage",
    "@id": canonical,
    name: `${String(category.name).trim()} للبيع في اليمن`,
    url: canonical,
    inLanguage: "ar-YE",
    isPartOf: { "@id": `${resolveSiteBaseUrl(siteBaseUrl)}/#website` }
  };
  if (String(category.description || "").trim()) {
    page.description = sanitizeSeoAdDescription(category.description, 160);
  }
  const graph = [page];
  if (publicAds.length) {
    graph.push({
      "@type": "ItemList",
      itemListOrder: "https://schema.org/ItemListOrderDescending",
      numberOfItems: publicAds.length,
      itemListElement: publicAds.map((ad, index) => {
        const adPath = buildAdPath(ad);
        return {
          "@type": "ListItem",
          position: index + 1,
          name: String(ad.title || "").trim() || "إعلان في سوقك",
          item: adPath ? resolveCanonicalUrl(adPath, siteBaseUrl) : canonical
        };
      })
    });
  }
  if (breadcrumbList) graph.push(breadcrumbList);
  return { "@context": "https://schema.org", "@graph": graph };
}

export function createStoreStructuredData({
  store,
  url,
  products = [],
  image,
  siteBaseUrl = DEFAULT_SITE_BASE_URL
} = {}) {
  if (!store?.slug || !store?.storeName || !url) return null;
  const canonical = resolveCanonicalUrl(url, siteBaseUrl);
  const publicProducts = Array.isArray(products)
    ? products.filter((product) => isPublicAdIndexable(product)).slice(0, 20)
    : [];
  const entity = {
    "@type": "OnlineStore",
    "@id": canonical,
    name: String(store.storeName).trim(),
    url: canonical,
    inLanguage: "ar-YE"
  };
  const description = String(store.description || store.businessActivity || "").trim();
  if (description) entity.description = sanitizeSeoAdDescription(description, 160);
  if (typeof image === "string" && /^https:\/\//i.test(image)) entity.image = image;
  if (publicProducts.length) {
    entity.subjectOf = {
      "@type": "ItemList",
      numberOfItems: publicProducts.length,
      itemListElement: publicProducts.map((product, index) => {
        const adPath = buildAdPath(product);
        return {
          "@type": "ListItem",
          position: index + 1,
          name: String(product.title || "").trim() || "منتج في المتجر",
          item: adPath ? resolveCanonicalUrl(adPath, siteBaseUrl) : canonical
        };
      })
    };
  }
  return { "@context": "https://schema.org", "@graph": [entity] };
}

export function createAuctionStructuredData({
  auction,
  url,
  image,
  siteBaseUrl = DEFAULT_SITE_BASE_URL
} = {}) {
  if (!auction || !url) return null;
  if (!isPublicAuctionIndexable(auction, Date.now(), { publiclyAccessible: true })) return null;
  const canonical = resolveCanonicalUrl(url, siteBaseUrl);
  const page = {
    "@type": "WebPage",
    "@id": canonical,
    name: String(auction.title || "").trim() || "مزاد في سوقك",
    url: canonical,
    inLanguage: "ar-YE"
  };
  if (String(auction.description || "").trim()) {
    page.description = sanitizeSeoAdDescription(auction.description, 160);
  }
  if (typeof image === "string" && /^https:\/\//i.test(image)) page.image = image;
  return { "@context": "https://schema.org", "@graph": [page] };
}

export function createServiceStructuredData({
  service,
  url,
  siteBaseUrl = DEFAULT_SITE_BASE_URL
} = {}) {
  if (!service?.name || !url) return null;
  if (!isPublicBookingServiceIndexable({
    service,
    publiclyAccessible: service.publiclyAccessible === true
  })) return null;
  const canonical = resolveCanonicalUrl(url, siteBaseUrl);
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: String(service.name).trim(),
    description: sanitizeSeoAdDescription(service.note, 160),
    url: canonical,
    serviceType: String(service.type).trim(),
    provider: { "@type": "Organization", "@id": `${resolveSiteBaseUrl(siteBaseUrl)}/#organization` }
  };
}

function createAdOffer(ad, url, siteBaseUrl) {
  const currency = {
    YER_ADEN: "YER",
    YER_SANAA: "YER",
    YER: "YER",
    SAR: "SAR",
    USD: "USD"
  }[ad?.currency];
  if (
    !isPublicAdIndexable(ad) ||
    ad.priceOnContact === true ||
    typeof ad.price !== "number" ||
    !Number.isFinite(ad.price) ||
    ad.price <= 0 ||
    !currency
  ) {
    return null;
  }

  return {
    "@type": "Offer",
    price: ad.price,
    priceCurrency: currency,
    availability: "https://schema.org/InStock",
    url: resolveCanonicalUrl(url, siteBaseUrl)
  };
}

function safePublicImagePath(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return null;
  let pathname;
  try {
    pathname = decodeURIComponent(value).replace(/\\/g, "/");
  } catch {
    return null;
  }
  if (/[\u0000-\u001f\u007f]/u.test(pathname) || /%(?:2e|2f|5c)/i.test(pathname)) return null;
  const segments = pathname.split("/").filter(Boolean);
  if (
    segments.some((segment) => segment === "." || segment === "..") ||
    segments.some((segment) => /^(?:receipts|ids|kyc|documents|identity|private_uploads|message-attachments|auction-documents)$/i.test(segment))
  ) return null;
  return pathname;
}

export function getPublicAdImageUrl(image, { siteBaseUrl = DEFAULT_SITE_BASE_URL, apiOrigin = "" } = {}) {
  if (typeof image !== "string" || image.length === 0 || image.length > 2048) return null;
  if (/^https:\/\//i.test(image)) {
    try {
      const parsed = new URL(image);
      if (parsed.username || parsed.password || !safePublicImagePath(parsed.pathname)) return null;
      return parsed.href;
    } catch {
      return null;
    }
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(image) || image.startsWith("//")) return null;

  const cleaned = image.replace(/^\/?uploads\//, "");
  const safePath = safePublicImagePath(cleaned);
  if (!safePath) return null;
  const encodedPath = safePath.split("/").map(encodeURIComponent).join("/");
  let base = "";
  if (apiOrigin) {
    try {
      const parsed = new URL(apiOrigin);
      if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return null;
      base = parsed.origin;
    } catch {
      return null;
    }
  }
  return `${base}/uploads/${encodedPath}`;
}

export function getPublicAdContentModel(ad, {
  breadcrumbs = [],
  siteBaseUrl = DEFAULT_SITE_BASE_URL,
  apiOrigin = ""
} = {}) {
  if (!ad) return null;
  const title = ad.title || "إعلان في سوقك";
  const category = ad.parentCategory || ad.categoryId?.parentId || ad.categoryId;
  let categoryUrl = null;
  if (category?.slug) {
    try {
      categoryUrl = ad.subcategory?.slug
        ? `/category/${encodeSeoPathSegment(category.slug)}/${encodeSeoPathSegment(ad.subcategory.slug)}`
        : `/category/${encodeSeoPathSegment(category.slug)}`;
    } catch {
      categoryUrl = null;
    }
  }
  const adPath = buildAdPath(ad);
  if (!adPath) return null;
  const image = Array.isArray(ad.images) && ad.images.length
    ? getPublicAdImageUrl(ad.images[0], { siteBaseUrl, apiOrigin })
    : null;

  return {
    title,
    image,
    description: sanitizeSeoAdDescription(ad.description),
    price: ad?.priceOnContact || ad?.price === undefined || ad?.price === null
      ? "السعر عند التواصل"
      : `${Number(ad.price).toLocaleString("ar-EG")} ${ad.currency || "ريال يمني"}`,
    location: [ad.governorateId?.name, ad.cityId?.name].filter(Boolean).join("، "),
    categoryUrl: categoryUrl ? resolveSiteUrl(categoryUrl, siteBaseUrl) : null,
    categoryName: ad.subcategory?.name || category?.name || "",
    adUrl: resolveSiteUrl(adPath, siteBaseUrl),
    breadcrumbs: breadcrumbs.map((breadcrumb) => ({
      name: breadcrumb.name,
      url: resolveSiteUrl(breadcrumb.url, siteBaseUrl)
    }))
  };
}

function escapeAdMarkup(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export function renderPublicAdContentHtml(ad, options = {}) {
  const model = getPublicAdContentModel(ad, options);
  if (!model) return "";
  const breadcrumbs = model.breadcrumbs
    .map(({ name, url }) => `<a href="${escapeAdMarkup(url)}">${escapeAdMarkup(name)}</a>`)
    .join("");
  return `<main class="ssg-public-content" dir="rtl"><nav aria-label="مسار التنقل">${breadcrumbs}</nav><article><h1>${escapeAdMarkup(model.title)}</h1>${model.image ? `<img src="${escapeAdMarkup(model.image)}" alt="${escapeAdMarkup(model.title)}" loading="eager"/>` : ""}<p>${escapeAdMarkup(model.description)}</p><p>${escapeAdMarkup(model.price)}</p>${model.location ? `<p>${escapeAdMarkup(model.location)}</p>` : ""}${model.categoryUrl ? `<p><a href="${escapeAdMarkup(model.categoryUrl)}">${escapeAdMarkup(model.categoryName)}</a></p>` : ""}<p><a href="${escapeAdMarkup(model.adUrl)}">رابط الإعلان</a></p></article></main>`;
}

function safeSeoText(value, maxLength = 500) {
  return escapeAdMarkup(sanitizeSeoAdDescription(value, maxLength));
}

function publicCategoryPath(category, parentCategory) {
  try {
    const rootSlug = parentCategory?.slug || category?.slug;
    const subSlug = parentCategory ? category?.slug : null;
    if (!rootSlug) return null;
    const root = `/category/${encodeSeoPathSegment(rootSlug)}`;
    return subSlug ? `${root}/${encodeSeoPathSegment(subSlug)}` : root;
  } catch {
    return null;
  }
}

function publicAdLink(ad, siteBaseUrl) {
  const adPath = buildAdPath(ad);
  if (!adPath) return "";
  return `<li><a href="${escapeAdMarkup(resolveSiteUrl(adPath, siteBaseUrl))}">${safeSeoText(ad.title || "إعلان في سوقك", 160)}</a></li>`;
}

export function renderPublicCategoryContentHtml({
  category,
  activeSubcategory,
  breadcrumbs = [],
  subcategories = [],
  ads = [],
  siteBaseUrl = DEFAULT_SITE_BASE_URL
} = {}) {
  if (!category) return "";
  const activeCategory = activeSubcategory || category;
  const breadcrumbHtml = breadcrumbs.map((breadcrumb) => {
    const href = breadcrumb?.url && String(breadcrumb.url).startsWith("/")
      ? resolveSiteUrl(breadcrumb.url, siteBaseUrl)
      : publicCategoryPath(breadcrumb, breadcrumb?.parentCategory);
    if (!href) return "";
    return `<a href="${escapeAdMarkup(href)}">${safeSeoText(breadcrumb.name, 120)}</a>`;
  }).join("");
  const subcategoryHtml = subcategories.map((subcategory) => {
    const path = publicCategoryPath(subcategory, category);
    if (!path) return "";
    return `<li><a href="${escapeAdMarkup(resolveSiteUrl(path, siteBaseUrl))}">${safeSeoText(subcategory.name, 120)}</a></li>`;
  }).join("");
  const adHtml = ads.map((ad) => publicAdLink(ad, siteBaseUrl)).join("");
  const description = String(activeCategory.description || "").trim()
    ? `<p>${safeSeoText(activeCategory.description, 1000)}</p>`
    : "";
  return `<main class="ssg-public-content" dir="rtl"><nav aria-label="مسار التنقل">${breadcrumbHtml}</nav><h1>${safeSeoText(activeCategory.name, 120)} للبيع في اليمن</h1>${description}${subcategoryHtml ? `<section aria-labelledby="ssg-category-children"><h2 id="ssg-category-children">الأقسام الفرعية</h2><ul>${subcategoryHtml}</ul></section>` : ""}${adHtml ? `<section aria-labelledby="ssg-category-ads"><h2 id="ssg-category-ads">أحدث الإعلانات</h2><ul>${adHtml}</ul></section>` : ""}</main>`;
}

export function renderPublicStoreContentHtml({
  store,
  products = [],
  siteBaseUrl = DEFAULT_SITE_BASE_URL,
  apiOrigin = ""
} = {}) {
  if (!store?.slug || !store?.storeName) return "";
  let storePath;
  try {
    storePath = `/store/${encodeSeoPathSegment(store.slug)}`;
  } catch {
    return "";
  }
  const cover = getPublicAdImageUrl(store.cover, { siteBaseUrl, apiOrigin });
  const logo = getPublicAdImageUrl(store.logo, { siteBaseUrl, apiOrigin });
  const image = cover || logo;
  const activity = store.activity?.name || store.businessActivity || "";
  const description = String(store.description || "").trim()
    ? `<p>${safeSeoText(store.description, 1000)}</p>`
    : "";
  const productHtml = products.map((product) => {
    const path = buildAdPath(product);
    if (!path) return "";
    const title = safeSeoText(product.title || "منتج في المتجر", 160);
    const productImage = Array.isArray(product.images) && product.images.length
      ? getPublicAdImageUrl(product.images[0], { siteBaseUrl, apiOrigin })
      : null;
    return `<li><a href="${escapeAdMarkup(resolveSiteUrl(path, siteBaseUrl))}">${productImage ? `<img src="${escapeAdMarkup(productImage)}" alt="${title}" loading="lazy"/>` : ""}${title}</a></li>`;
  }).join("");
  return `<main class="ssg-public-content" dir="rtl"><article>${image ? `<img src="${escapeAdMarkup(image)}" alt="${safeSeoText(store.storeName, 120)}" loading="eager"/>` : ""}<h1>${safeSeoText(store.storeName, 120)}</h1>${activity ? `<p>${safeSeoText(activity, 200)}</p>` : ""}${description}<p><a href="${escapeAdMarkup(resolveSiteUrl(storePath, siteBaseUrl))}">زيارة المتجر</a></p></article>${productHtml ? `<section aria-labelledby="ssg-store-products"><h2 id="ssg-store-products">منتجات المتجر</h2><ul>${productHtml}</ul></section>` : ""}</main>`;
}

export function renderPublicAuctionContentHtml({
  auction,
  apiOrigin = "",
  siteBaseUrl = DEFAULT_SITE_BASE_URL
} = {}) {
  const id = normalizePublicObjectId(auction?.id || auction?._id);
  if (!id || !auction?.title) return "";
  const path = `/auctions/${id}`;
  const title = safeSeoText(auction.title, 160);
  const description = String(auction.description || "").trim()
    ? `<p>${safeSeoText(auction.description, 1600)}</p>`
    : "";
  const image = Array.isArray(auction.images) && auction.images.length
    ? getPublicAdImageUrl(auction.images[0], { siteBaseUrl, apiOrigin })
    : null;
  const location = [auction.city?.name, auction.governorate?.name]
    .filter(Boolean)
    .map((value) => safeSeoText(value, 120))
    .join("، ");
  const price = [auction.currentPrice, auction.currency]
    .filter((value) => value !== null && value !== undefined && String(value).length <= 80)
    .map((value) => safeSeoText(value, 80))
    .join(" ");
  return `<main class="ssg-public-content" dir="rtl"><article>${image ? `<img src="${escapeAdMarkup(image)}" alt="${title}" loading="eager"/>` : ""}<h1>${title}</h1>${description}${price ? `<p>${price}</p>` : ""}${location ? `<p>${location}</p>` : ""}<p><a href="${escapeAdMarkup(resolveSiteUrl(path, siteBaseUrl))}">تفاصيل المزاد</a></p></article></main>`;
}
