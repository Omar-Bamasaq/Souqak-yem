import Ad from "../models/Ad.js";
import StoreProfile from "../models/StoreProfile.js";
import StoreSubscription from "../models/StoreSubscription.js";
import {
  encodeSeoPathSegment,
  createStoreStructuredData,
  getPublicAdImageUrl,
  hasMeaningfulQueryParameters,
  isPublicAdIndexable,
  isPublicStoreIndexable,
  renderPublicStoreContentHtml,
  resolveCanonicalUrl,
  sanitizeSeoAdDescription
} from "../../../shared/seoRules.mjs";
import {
  getFamilyProductionActivity,
  getStoreActivity
} from "../utils/storeActivityRegistry.js";
import { isPublicStoreEligible } from "../utils/storePublicVisibility.js";
import { parseDynamicSeoRouteTarget, sendDynamicSeoPage } from "./dynamicSeoRenderer.js";
import { applySeoQueryTimeout } from "./seoCache.js";

const STORE_FIELDS = "_id storeName slug storeType activityKey businessActivity description logo cover selectedCategories status";
const STORE_AD_FIELDS = "_id title slug images status isDeleted isVisible isArchived sold isSold isAvailable scheduledPublishAt expiresAt inventoryEnabled stockQuantity";
const STORE_PRODUCT_LIMIT = 12;

function isIndexableProductFilter(storeId, now) {
  return {
    storeProfileId: storeId,
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

function publicStore(store) {
  const activity = store.storeType === "family-production"
    ? getFamilyProductionActivity(store.activityKey)
    : getStoreActivity(store.activityKey);
  return {
    _id: String(store._id),
    storeName: String(store.storeName || ""),
    slug: String(store.slug || ""),
    storeType: store.storeType || "store",
    activityKey: store.activityKey || "",
    businessActivity: String(store.businessActivity || ""),
    description: String(store.description || ""),
    logo: store.logo || null,
    cover: store.cover || null,
    status: store.status,
    selectedCategories: (store.selectedCategories || []).map((category) => ({
      _id: String(category._id || category.id || ""),
      id: String(category._id || category.id || ""),
      name: String(category.name || ""),
      slug: String(category.slug || "")
    })),
    activity: {
      name: String(activity?.nameAr || store.businessActivity || "")
    }
  };
}

export async function loadPublicSeoStore(target, {
  StoreProfileModel = StoreProfile,
  StoreSubscriptionModel = StoreSubscription,
  AdModel = Ad,
  includeProducts = true,
  now = new Date()
} = {}) {
  const store = await applySeoQueryTimeout(
    StoreProfileModel.findOne({ slug: target.pathSegments[0] })
  )
    .select(STORE_FIELDS)
    .populate("selectedCategories", "name slug")
    .lean();
  if (!store) return { kind: "not_found" };
  if (
    store.status !== "active" ||
    !["store", "family-production"].includes(store.storeType || "store")
  ) return { kind: "not_public" };

  const subscription = await applySeoQueryTimeout(
    StoreSubscriptionModel.findOne({ storeId: store._id })
  )
    .sort({ createdAt: -1, _id: -1 })
    .select("status endDate")
    .lean();
  if (!isPublicStoreEligible(store, subscription, now)) return { kind: "not_public" };

  if (!includeProducts) {
    return {
      kind: "found",
      store: publicStore(store),
      products: [],
      total: 0
    };
  }

  const filter = isIndexableProductFilter(store._id, now);
  const [products, total] = await Promise.all([
    applySeoQueryTimeout(AdModel.find(filter))
      .select(STORE_AD_FIELDS)
      .sort({ featured: -1, publishedAt: -1, createdAt: -1, _id: -1 })
      .limit(STORE_PRODUCT_LIMIT)
      .lean(),
    applySeoQueryTimeout(AdModel.countDocuments(filter))
  ]);
  return {
    kind: "found",
    store: publicStore(store),
    products: products
      .filter((product) => isPublicAdIndexable(product, now))
      .map((product) => ({
        _id: String(product._id),
        slug: String(product.slug || ""),
        title: String(product.title || ""),
        images: Array.isArray(product.images) ? product.images.slice(0, 8) : []
      })),
    total
  };
}

export function createDynamicStoreResource({
  loadStore = loadPublicSeoStore
} = {}) {
  return {
    resourceLabel: "المتجر",
    async revalidate(target) {
      if (!target?.valid) return false;
      const resource = await loadStore(target, { includeProducts: false });
      return Boolean(resource?.kind === "found" && resource.store);
    },
    match(req) {
      const target = parseDynamicSeoRouteTarget(req.url, "store", 1);
      if (!target || target.pathSegmentCount !== 1) return null;
      if (target.valid && /^[a-f\d]{24}$/i.test(target.pathSegments[0])) return null;
      return target;
    },
    async render({ res, target, template, siteBaseUrl, apiOrigin }) {
      if (!target.valid) {
        return sendDynamicSeoPage(res, template, {
          status: 404,
          title: "المتجر غير موجود | سوقك",
          description: "المتجر المطلوب غير موجود أو غير متاح.",
          body: "<main class=\"ssg-public-content\" dir=\"rtl\"><h1>المتجر غير موجود</h1></main>"
        });
      }

      const hasMeaningfulFilters = hasMeaningfulQueryParameters(target.queryString);
      const resource = await loadStore(target, {
        includeProducts: !hasMeaningfulFilters
      });
      if (!resource || resource.kind === "not_found" || resource.kind === "not_public") {
        return sendDynamicSeoPage(res, template, {
          status: 404,
          routePath: target.rawPath,
          title: "المتجر غير موجود | سوقك",
          description: "المتجر المطلوب غير موجود أو غير متاح.",
          body: "<main class=\"ssg-public-content\" dir=\"rtl\"><h1>المتجر غير موجود</h1></main>"
        });
      }
      if (resource.kind !== "found" || !resource.store) {
        throw new Error("The public store lookup returned an invalid result.");
      }

      const store = publicStore(resource.store);
      const canonicalPath = `/store/${encodeSeoPathSegment(store.slug)}`;
      const canonical = resolveCanonicalUrl(canonicalPath, siteBaseUrl);
      const indexable = isPublicStoreIndexable({
        store,
        hasActiveSubscription: true,
        hasMeaningfulFilters
      });
      const title = `${sanitizeSeoAdDescription(store.storeName, 120)} | سوقك`;
      const description = sanitizeSeoAdDescription(
        store.description || store.businessActivity,
        160
      );
      const image = getPublicAdImageUrl(store.cover || store.logo, { siteBaseUrl, apiOrigin });
      if (hasMeaningfulFilters) {
        return sendDynamicSeoPage(res, template, {
          status: 200,
          routePath: target.rawPath,
          title,
          description,
          canonical,
          image,
          robots: "noindex,nofollow",
          body: `<main class="ssg-public-content" dir="rtl"><h1>${sanitizeSeoAdDescription(store.storeName, 120)}</h1><p>جارٍ تحميل منتجات المتجر.</p></main>`
        });
      }

      const products = resource.products.map((product) => ({
        _id: String(product._id || ""),
        slug: String(product.slug || ""),
        title: String(product.title || ""),
        images: (Array.isArray(product.images) ? product.images : []).filter((productImage) => (
          getPublicAdImageUrl(productImage, { siteBaseUrl, apiOrigin })
        ))
      }));
      const contentData = { store, products };
      const bodyHtml = renderPublicStoreContentHtml({
        ...contentData,
        siteBaseUrl,
        apiOrigin
      });
      return sendDynamicSeoPage(res, template, {
        status: 200,
        routePath: target.rawPath,
        title,
        description,
        canonical,
        image,
        structuredData: indexable ? createStoreStructuredData({
          store,
          url: canonical,
          products,
          image,
          siteBaseUrl
        }) : null,
        robots: indexable
          ? "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
          : "noindex,nofollow",
        body: `<div data-ssg-content="true">${bodyHtml}</div>`,
        hydrationData: {
          kind: "store-static",
          data: contentData,
          apiOrigin
        }
      });
    }
  };
}
