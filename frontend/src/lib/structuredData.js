import { resolveCanonicalUrl } from "./siteUrl.js";

const CURRENCY_CODES = Object.freeze({
  YER_ADEN: "YER",
  YER_SANAA: "YER",
  YER: "YER",
  SAR: "SAR",
  USD: "USD"
});

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
  const offer = createOffer(ad, url, siteBaseUrl);
  const product = ad?.adType === "sell" && ad.title
    ? {
      "@context": "https://schema.org",
      "@type": "Product",
      name: ad.title,
      ...(ad.description ? { description: ad.description } : {}),
      ...(image ? { image } : {}),
      url: resolveCanonicalUrl(url, siteBaseUrl),
      ...(offer ? { offers: offer } : {})
    }
    : null;

  if (!product) return breadcrumbList;
  if (!breadcrumbList) return product;
  return { "@context": "https://schema.org", "@graph": [product, breadcrumbList] };
}

function createOffer(ad, url, siteBaseUrl) {
  const currency = CURRENCY_CODES[ad.currency];
  const expiresAt = ad.expiresAt instanceof Date
    ? ad.expiresAt.getTime()
    : Date.parse(ad.expiresAt);
  if (
    ad.priceOnContact === true ||
    typeof ad.price !== "number" ||
    !Number.isFinite(ad.price) ||
    ad.price <= 0 ||
    !currency ||
    ad.status !== "approved" ||
    ad.sold === true ||
    ad.isAvailable === false ||
    ad.isDeleted === true ||
    ad.isArchived === true ||
    ad.isVisible === false ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= Date.now() ||
    (ad.inventoryEnabled === true && (!Number.isFinite(Number(ad.stockQuantity)) || Number(ad.stockQuantity) <= 0))
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
