import {
  DEFAULT_SITE_BASE_URL,
  INDEXABLE_STATIC_PATHS as SHARED_INDEXABLE_STATIC_PATHS,
  NON_INDEXABLE_STATIC_PATHS as SHARED_NON_INDEXABLE_STATIC_PATHS,
  buildAdPath,
  encodeSeoPathSegment,
  getAdSlug,
  isPublicAdIndexable,
  isPublicCategoryIndexable,
  MIN_PUBLIC_ADS_FOR_SUBCATEGORY,
  resolveMinimumPublicAdsForSubcategory,
  resolveSiteBaseUrl,
  resolveSiteUrl,
  slugifySeoValue
} from "../../shared/seoRules.mjs";
import { PUBLIC_PAGE_METADATA } from "../src/lib/publicPageMetadata.mjs";

export { DEFAULT_SITE_BASE_URL, resolveSiteBaseUrl };
export { isPublicAdIndexable as isIndexableAd };
export { getAdSlug };

export const PRERENDER_AD_PAGE_LIMIT = 10;

export const INDEXABLE_STATIC_ROUTES = SHARED_INDEXABLE_STATIC_PATHS.map((path) => {
  const metadata = PUBLIC_PAGE_METADATA[path];
  if (!metadata) throw new Error(`Missing public page metadata for ${path}.`);
  return {
    path,
    title: metadata.title,
    description: metadata.description,
    canonical: path
  };
});

export const NON_INDEXABLE_STATIC_PATHS = SHARED_NON_INDEXABLE_STATIC_PATHS;

export const slugify = slugifySeoValue;

const isSafeRouteSegment = (value) => {
  if (typeof value !== "string") return false;
  try {
    encodeSeoPathSegment(value);
    return true;
  } catch {
    return false;
  }
};

const uniquePagesByUrl = (pages) => [...new Map(pages.map((page) => [page.url, page])).values()];



export function createPublicPrerenderPlan({
  siteBase = DEFAULT_SITE_BASE_URL,
  categories = [],
  categorySsgDataBySlug = new Map(),
  ads = [],
  adLimit = PRERENDER_AD_PAGE_LIMIT,
  minimumPublicAdsForSubcategory = MIN_PUBLIC_ADS_FOR_SUBCATEGORY
} = {}) {
  const normalizedSiteBase = resolveSiteBaseUrl(siteBase);
  const minimumPublicAds = resolveMinimumPublicAdsForSubcategory(
    minimumPublicAdsForSubcategory
  );
  const nonIndexablePaths = new Set(NON_INDEXABLE_STATIC_PATHS);
  const staticPages = uniquePagesByUrl(INDEXABLE_STATIC_ROUTES
    .filter((route) => !nonIndexablePaths.has(route.path))
    .map((route) => ({
      ...route,
      url: `${normalizedSiteBase}${route.canonical}`
    })));
  const categoryEntries = categories.flatMap((summary) => {
    const ssgData = categorySsgDataBySlug.get(summary?.slug);
    const category = ssgData?.category || summary;
    if (
      !ssgData ||
      !Array.isArray(ssgData.ads) ||
      !isSafeRouteSegment(category?.slug) ||
      !isPublicCategoryIndexable({ category, isMainCategory: true })
    ) return [];
    const path = `/category/${encodeSeoPathSegment(category.slug)}`;
    return [{
      category,
      path,
      url: resolveSiteUrl(path, normalizedSiteBase),
      ssgData
    }];
  });
  const categoryPages = uniquePagesByUrl(categoryEntries);
  const publicAdsById = new Map();
  for (const ad of [
    ...ads,
    ...categoryEntries.flatMap(({ ssgData }) => Array.isArray(ssgData?.ads) ? ssgData.ads : [])
  ]) {
    if (isPublicAdIndexable(ad)) publicAdsById.set(String(ad._id).toLowerCase(), ad);
  }
  const subcategoryPages = [];
  for (const { category, ssgData } of categoryEntries) {
    const children = Array.isArray(ssgData?.subcategories)
      ? ssgData.subcategories
      : Array.isArray(category.children) ? category.children : [];
    for (const subcategory of children) {
      const relatedCategories = [category, ...children.filter((child) => (
        String(child?._id || child?.id || "") !== String(subcategory?._id || subcategory?.id || "")
      ))];
      const subcategoryAds = [...publicAdsById.values()].filter((ad) => (
        String(ad.subcategory?._id || ad.subcategory?.id || "").toLowerCase() ===
        String(subcategory?._id || subcategory?.id || "").toLowerCase()
      ));
      const subcategoryId = String(subcategory?._id || subcategory?.id || "");
      const subcategorySsgData = ssgData?.subcategorySsgDataById?.[subcategoryId];
      const resolvedAds = subcategorySsgData
        ? subcategorySsgData.ads.filter((ad) => isPublicAdIndexable(ad))
        : subcategoryAds;
      if (
        !isSafeRouteSegment(subcategory?.slug) ||
        !isPublicCategoryIndexable({
          category: subcategory,
          isMainCategory: false,
          parentCategory: category,
          relatedCategories,
          publicAdCount: resolvedAds.length,
          minimumPublicAds
        })
      ) continue;

      const path = `/category/${encodeSeoPathSegment(category.slug)}/${encodeSeoPathSegment(subcategory.slug)}`;
      const breadcrumbUrl = resolveSiteUrl(path, normalizedSiteBase);
      subcategoryPages.push({
        category,
        subcategory,
        path,
        url: breadcrumbUrl,
        ssgData: {
          ...ssgData,
          activeSubcategory: subcategory,
          breadcrumbs: [
            ...(ssgData?.breadcrumbs || []),
            { name: subcategory.name, slug: subcategory.slug, url: breadcrumbUrl }
          ],
          ads: resolvedAds
        }
      });
    }
  }
  const uniqueSubcategoryPages = uniquePagesByUrl(subcategoryPages);
  const adPages = uniquePagesByUrl(ads
    .filter((ad) => isSafeRouteSegment(String(ad?._id || "")) && isPublicAdIndexable(ad))
    .map((ad) => {
      const path = buildAdPath(ad);
      return path ? { ad, path, url: resolveSiteUrl(path, normalizedSiteBase) } : null;
    }).filter(Boolean)).slice(0, adLimit);
  const sitemapUrls = [...new Set([
    ...staticPages.map((page) => page.url),
    ...categoryPages.map((page) => page.url),
    ...uniqueSubcategoryPages.map((page) => page.url),
    ...adPages.map((page) => page.url)
  ])];

  return { staticPages, categoryPages, subcategoryPages: uniqueSubcategoryPages, adPages, sitemapUrls };
}
