import Ad from "../models/Ad.js";
import Category from "../models/Category.js";
import {
  MIN_PUBLIC_ADS_FOR_SUBCATEGORY,
  encodeSeoPathSegment,
  createCategoryStructuredData,
  getPublicAdImageUrl,
  isPublicAdIndexable,
  isPublicCategoryIndexable,
  isTrackingQueryParameter,
  renderPublicCategoryContentHtml,
  resolveCanonicalUrl,
  sanitizeSeoAdDescription
} from "../../../shared/seoRules.mjs";
import { getPublicStoreProfileIds, applyPublicStoreFilter } from "../utils/storePublicVisibility.js";
import { parseDynamicSeoRouteTarget, sendDynamicSeoPage } from "./dynamicSeoRenderer.js";
import {
  applySeoQueryTimeout,
  SEO_QUERY_TIMEOUT_MS
} from "./seoCache.js";

const CATEGORY_FIELDS = "_id name slug description parentId image status sortOrder";
const CATEGORY_AD_FIELDS = "_id title slug status isDeleted isVisible isArchived sold isSold isAvailable scheduledPublishAt expiresAt inventoryEnabled stockQuantity";
const CATEGORY_AD_LIMIT = 12;

function isIndexableAdFilter(now) {
  return {
    status: "approved",
    expiresAt: { $gt: now },
    isArchived: { $ne: true },
    sold: { $ne: true },
    isSold: { $ne: true },
    isVisible: { $ne: false },
    isDeleted: { $ne: true },
    isAvailable: { $ne: false },
    $and: [
      {
        $or: [
          { scheduledPublishAt: null },
          { scheduledPublishAt: { $exists: false } },
          { scheduledPublishAt: { $lte: now } }
        ]
      },
      {
        $or: [
          { inventoryEnabled: { $ne: true } },
          { stockQuantity: { $gt: 0 } }
        ]
      }
    ]
  };
}

async function findActiveDescendantIds(parentId, CategoryModel) {
  const found = [];
  const visited = new Set([String(parentId)]);
  let frontier = [parentId];
  for (let depth = 0; frontier.length && depth < 16; depth += 1) {
    const children = await applySeoQueryTimeout(CategoryModel.find({
      parentId: { $in: frontier },
      status: "active"
    })).select("_id").lean();
    frontier = children
      .filter((child) => !visited.has(String(child._id)))
      .map((child) => child._id);
    frontier.forEach((id) => {
      visited.add(String(id));
      found.push(id);
    });
  }
  return found;
}

function publicCategory(category, children = []) {
  return {
    _id: String(category._id),
    id: String(category._id),
    name: String(category.name || ""),
    slug: String(category.slug || ""),
    description: String(category.description || ""),
    parentId: category.parentId == null ? null : String(category.parentId),
    status: category.status,
    image: category.image || null,
    children: children.map((child) => publicCategory(child))
  };
}

function getRequestedSubcategory(target) {
  if (target.pathSegments[1]) return target.pathSegments[1];
  const params = new URLSearchParams(target.queryString);
  return params.get("sub");
}

export async function loadPublicSeoCategory(target, {
  CategoryModel = Category,
  AdModel = Ad,
  getPublicStoreIds = getPublicStoreProfileIds,
  now = new Date()
} = {}) {
  const category = await applySeoQueryTimeout(
    CategoryModel.findOne({ slug: target.pathSegments[0] })
  )
    .select(CATEGORY_FIELDS)
    .lean();
  if (!category) return { kind: "not_found" };
  if (category.status !== "active") return { kind: "not_public" };

  const childCategories = await applySeoQueryTimeout(
    CategoryModel.find({ parentId: category._id })
  )
    .select(CATEGORY_FIELDS)
    .sort({ sortOrder: 1, name: 1 })
    .lean();
  const activeChildren = childCategories.filter((child) => child.status === "active");
  const requestedSubcategorySlug = getRequestedSubcategory(target);
  const selectedSubcategory = requestedSubcategorySlug
    ? activeChildren.find((child) => child.slug === requestedSubcategorySlug) || null
    : null;
  const activeCategory = selectedSubcategory || category;
  const descendantIds = await findActiveDescendantIds(activeCategory._id, CategoryModel);
  const categoryIds = [activeCategory._id, ...descendantIds];
  const storeProfileIds = await getPublicStoreIds(now, {
    maxTimeMS: SEO_QUERY_TIMEOUT_MS
  });
  const filter = applyPublicStoreFilter({
    ...isIndexableAdFilter(now),
    categoryId: { $in: categoryIds }
  }, storeProfileIds);
  const [ads, total] = await Promise.all([
    applySeoQueryTimeout(AdModel.find(filter))
      .select(CATEGORY_AD_FIELDS)
      .sort({ publishedAt: -1, createdAt: -1, _id: -1 })
      .limit(CATEGORY_AD_LIMIT)
      .lean(),
    applySeoQueryTimeout(AdModel.countDocuments(filter))
  ]);
  const publicAds = ads
    .filter((ad) => isPublicAdIndexable(ad, now))
    .map((ad) => ({
      _id: String(ad._id),
      slug: String(ad.slug || ""),
      title: String(ad.title || "")
    }));

  const breadcrumbs = [
    { name: "الرئيسية", url: "/" },
    {
      name: String(category.name || ""),
      url: `/category/${encodeSeoPathSegment(category.slug)}`
    },
    ...(selectedSubcategory ? [{
      name: String(selectedSubcategory.name || ""),
      url: `/category/${encodeSeoPathSegment(category.slug)}/${encodeSeoPathSegment(selectedSubcategory.slug)}`
    }] : [])
  ];

  return {
    kind: "found",
    category,
    children: activeChildren,
    selectedSubcategory,
    ads: publicAds,
    total,
    breadcrumbs
  };
}

function hasOnlyIndexableCategorySelection(target, selectedSubcategory) {
  const params = new URLSearchParams(target.queryString);
  const meaningfulEntries = [...params.entries()]
    .filter(([key]) => !isTrackingQueryParameter(key));
  const otherFilters = meaningfulEntries.filter(([key]) => key !== "sub");
  const subEntries = meaningfulEntries.filter(([key]) => key === "sub");
  const validSubParameter = subEntries.length === 0 || (
    subEntries.length === 1 &&
    selectedSubcategory &&
    subEntries[0][1] === selectedSubcategory.slug
  );
  const routeMatches = !target.pathSegments[1] ||
    target.pathSegments[1] === selectedSubcategory?.slug;
  return otherFilters.length === 0 && validSubParameter && routeMatches;
}

function categoryBody(resource, siteBaseUrl, apiOrigin) {
  const category = publicCategory(resource.category, resource.children);
  const selectedSubcategory = resource.selectedSubcategory
    ? publicCategory(resource.selectedSubcategory)
    : null;
  const activeSubcategories = resource.selectedSubcategory
    ? resource.children.filter((child) => String(child._id) !== String(resource.selectedSubcategory._id))
    : resource.children;
  const data = {
    category,
    activeSubcategory: selectedSubcategory,
    breadcrumbs: resource.breadcrumbs.map((breadcrumb) => ({
      name: String(breadcrumb.name || ""),
      url: String(breadcrumb.url || "")
    })),
    subcategories: activeSubcategories.map((child) => publicCategory(child)),
    ads: resource.ads.map((ad) => ({
      _id: String(ad._id || ""),
      slug: String(ad.slug || ""),
      title: String(ad.title || "")
    }))
  };
  const bodyHtml = renderPublicCategoryContentHtml({ ...data, siteBaseUrl, apiOrigin });
  return {
    data: { kind: "category-static", data },
    body: `<div data-ssg-content="true">${bodyHtml}</div>`
  };
}

export function createDynamicCategoryResource({
  loadCategory = loadPublicSeoCategory,
  minimumPublicAds = MIN_PUBLIC_ADS_FOR_SUBCATEGORY
} = {}) {
  return {
    resourceLabel: "الفئة",
    async revalidate(target) {
      if (!target?.valid) return false;
      const resource = await loadCategory(target);
      if (!resource || resource.kind !== "found" || !resource.category) return false;
      const selectedSubcategory = resource.selectedSubcategory || null;
      const routeIndexable = hasOnlyIndexableCategorySelection(target, selectedSubcategory);
      return isPublicCategoryIndexable({
        category: selectedSubcategory || resource.category,
        isMainCategory: selectedSubcategory ? false : resource.category.parentId == null,
        parentCategory: selectedSubcategory ? resource.category : undefined,
        relatedCategories: selectedSubcategory
          ? [resource.category, ...resource.children.filter((child) => (
            String(child._id) !== String(selectedSubcategory._id)
          ))]
          : [],
        publicAdCount: selectedSubcategory ? resource.total : 0,
        minimumPublicAds,
        hasMeaningfulFilters: !routeIndexable
      });
    },
    match(req) {
      return parseDynamicSeoRouteTarget(req.url, "category", [1, 2]);
    },
    async render({ res, target, template, siteBaseUrl, apiOrigin }) {
      if (!target.valid) {
        return sendDynamicSeoPage(res, template, {
          status: 404,
          title: "الفئة غير موجودة | سوقك",
          description: "الفئة المطلوبة غير موجودة أو غير متاحة.",
          body: "<main class=\"ssg-public-content\" dir=\"rtl\"><h1>الفئة غير موجودة</h1></main>"
        });
      }

      const resource = await loadCategory(target);
      if (!resource || resource.kind === "not_found" || resource.kind === "not_public") {
        return sendDynamicSeoPage(res, template, {
          status: 404,
          routePath: target.rawPath,
          title: "الفئة غير موجودة | سوقك",
          description: "الفئة المطلوبة غير موجودة أو غير متاحة.",
          body: "<main class=\"ssg-public-content\" dir=\"rtl\"><h1>الفئة غير موجودة</h1></main>"
        });
      }
      if (resource.kind !== "found" || !resource.category) {
        throw new Error("The public category lookup returned an invalid result.");
      }

      const selectedSubcategory = resource.selectedSubcategory || null;
      if (target.pathSegments[1] && !selectedSubcategory) {
        return sendDynamicSeoPage(res, template, {
          status: 404,
          routePath: target.rawPath,
          title: "الفئة غير موجودة | سوقك",
          description: "الفئة المطلوبة غير موجودة أو غير متاحة.",
          body: "<main class=\"ssg-public-content\" dir=\"rtl\"><h1>الفئة غير موجودة</h1></main>"
        });
      }
      const activeCategory = selectedSubcategory || resource.category;
      const relatedCategories = selectedSubcategory
        ? [
          resource.category,
          ...resource.children.filter((child) => String(child._id) !== String(selectedSubcategory._id))
        ]
        : [];
      const routeIndexable = hasOnlyIndexableCategorySelection(target, selectedSubcategory);
      const indexable = isPublicCategoryIndexable({
        category: activeCategory,
        isMainCategory: selectedSubcategory ? false : resource.category.parentId == null,
        parentCategory: selectedSubcategory ? resource.category : undefined,
        relatedCategories,
        publicAdCount: selectedSubcategory ? resource.total : 0,
        minimumPublicAds,
        hasMeaningfulFilters: !routeIndexable
      });
      const canonicalPath = selectedSubcategory
        ? `/category/${encodeSeoPathSegment(resource.category.slug)}/${encodeSeoPathSegment(selectedSubcategory.slug)}`
        : `/category/${encodeSeoPathSegment(resource.category.slug)}`;
      const canonical = resolveCanonicalUrl(canonicalPath, siteBaseUrl);
      const title = `${sanitizeSeoAdDescription(activeCategory.name, 120)} للبيع في اليمن | سوقك`;
      const description = sanitizeSeoAdDescription(activeCategory.description, 160);
      const image = getPublicAdImageUrl(activeCategory.image, { siteBaseUrl, apiOrigin });
      const content = categoryBody(resource, siteBaseUrl, apiOrigin);
      const filtered = !routeIndexable;
      const body = filtered
        ? `<main class="ssg-public-content" dir="rtl"><h1>${sanitizeSeoAdDescription(activeCategory.name, 120)}</h1><p>جارٍ تحميل نتائج التصنيف.</p></main>`
        : content.body;
      return sendDynamicSeoPage(res, template, {
        status: 200,
        routePath: target.rawPath,
        title,
        description,
        canonical,
        image,
        structuredData: indexable ? createCategoryStructuredData({
          category: activeCategory,
          url: canonical,
          ads: resource.ads,
          breadcrumbs: resource.breadcrumbs,
          siteBaseUrl
        }) : null,
        robots: indexable
          ? "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
          : "noindex,nofollow",
        body,
        ...(!filtered ? { hydrationData: { ...content.data, apiOrigin } } : {})
      });
    }
  };
}
