import Ad from "../models/Ad.js";
import StoreSubscription from "../models/StoreSubscription.js";
import { isPublicStoreEligible } from "../utils/storePublicVisibility.js";
import {
  buildAdPath,
  createAdStructuredData,
  encodeSeoPathSegment,
  getPublicAdContentModel,
  getPublicAdImageUrl,
  isPublicAdIndexable,
  normalizePublicObjectId,
  renderPublicAdContentHtml,
  resolveCanonicalUrl,
  sanitizeSeoAdDescription
} from "../../../shared/seoRules.mjs";
import { isPublicAdVisible } from "./publicAdAccess.js";
import {
  applySeoQueryTimeout,
  SEO_QUERY_TIMEOUT_MS
} from "./seoCache.js";
import {
  createDynamicSeoRenderer,
  renderDynamicSeoHtml,
  sendDynamicSeoPage,
  validateFrontendTemplate
} from "./dynamicSeoRenderer.js";

const MAX_REQUEST_TARGET_LENGTH = 4096;
const MAX_SLUG_LENGTH = 120;
const PUBLIC_AD_FIELDS = [
  "_id",
  "title",
  "slug",
  "description",
  "images",
  "price",
  "currency",
  "priceOnContact",
  "status",
  "isDeleted",
  "isVisible",
  "isArchived",
  "sold",
  "isSold",
  "isAvailable",
  "scheduledPublishAt",
  "expiresAt",
  "inventoryEnabled",
  "stockQuantity",
  "adType",
  "categoryId",
  "governorateId",
  "cityId",
  "storeProfileId"
].join(" ");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function renderShell(template, {
  status,
  siteBaseUrl,
  routePath,
  ad,
  apiOrigin,
  indexable
}) {
  const isFound = ad !== null;
  const adPath = isFound ? buildAdPath(ad) : null;
  const canonical = isFound ? resolveCanonicalUrl(adPath, siteBaseUrl) : null;
  const robots = isFound && indexable ? "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" : "noindex,nofollow";
  const breadcrumbs = isFound
    ? [
      { name: "الرئيسية", url: "/" },
      ...(ad.categoryId?.slug
        ? [{
          name: ad.subcategory?.name || ad.categoryId.name,
          url: ad.parentCategory?.slug
            ? `/category/${encodeSeoPathSegment(ad.parentCategory.slug)}/${encodeSeoPathSegment(ad.categoryId.slug)}`
            : `/category/${encodeSeoPathSegment(ad.categoryId.slug)}`
        }]
        : []),
      { name: ad.title, url: adPath }
    ]
    : [];
  const contentModel = isFound
    ? getPublicAdContentModel(ad, { breadcrumbs, siteBaseUrl, apiOrigin })
    : null;
  const schema = isFound
    ? createAdStructuredData({
      ad,
      url: adPath,
      image: contentModel?.image,
      breadcrumbs,
      siteBaseUrl
    })
    : null;
  const title = isFound ? `${ad.title} | سوقك` : "الإعلان غير موجود | سوقك";
  const description = isFound
    ? sanitizeSeoAdDescription(ad.description, 160)
    : "عذراً، الإعلان الذي تبحث عنه غير موجود أو غير متاح.";
  const body = isFound
    ? renderPublicAdContentHtml(ad, { breadcrumbs, siteBaseUrl, apiOrigin })
    : `<main class="ssg-public-content" dir="rtl"><h1>${status === 503 ? "تعذر تحميل الإعلان حالياً" : "الإعلان غير موجود"}</h1><p>${status === 503 ? "يرجى المحاولة مرة أخرى بعد قليل." : "عذراً، الإعلان الذي تبحث عنه غير موجود أو غير متاح."}</p><p><a href="${escapeHtml(siteBaseUrl)}/">العودة إلى الرئيسية</a></p></main>`;
  return renderDynamicSeoHtml(template, {
    title,
    description,
    canonical,
    image: contentModel?.image,
    robots,
    structuredData: schema,
    type: "product",
    prerenderedPath: isFound ? new URL(canonical).pathname : "",
    body,
    ...(isFound ? {
      hydrationData: {
      kind: "ad",
      data: { ad: toHydrationAd(ad, apiOrigin), breadcrumbs },
      apiOrigin
      },
      dynamicAd: true
    } : {})
  });
}

function toHydrationAd(ad, apiOrigin) {
  return {
    _id: String(ad._id),
    title: String(ad.title || ""),
    slug: String(ad.slug || ""),
    description: sanitizeSeoAdDescription(ad.description),
    images: Array.isArray(ad.images)
      ? ad.images.slice(0, 8).filter((image) => (
        typeof image === "string" &&
        image.length <= 2048 &&
        getPublicAdImageUrl(image, { apiOrigin })
      ))
      : [],
    price: ad.price,
    currency: ad.currency,
    priceOnContact: ad.priceOnContact === true,
    status: ad.status,
    isDeleted: ad.isDeleted === true,
    isVisible: ad.isVisible !== false,
    isArchived: ad.isArchived === true,
    sold: ad.sold === true,
    isSold: ad.isSold === true,
    isAvailable: ad.isAvailable !== false,
    scheduledPublishAt: ad.scheduledPublishAt,
    expiresAt: ad.expiresAt,
    inventoryEnabled: ad.inventoryEnabled === true,
    stockQuantity: ad.stockQuantity,
    adType: ad.adType,
    categoryId: ad.categoryId ? {
      name: ad.categoryId.name || "",
      slug: ad.categoryId.slug || "",
      ...(ad.parentCategory ? {
        parentId: {
          name: ad.parentCategory.name || "",
          slug: ad.parentCategory.slug || ""
        }
      } : {})
    } : null,
    parentCategory: ad.parentCategory ? {
      name: ad.parentCategory.name || "",
      slug: ad.parentCategory.slug || ""
    } : null,
    subcategory: ad.subcategory ? {
      name: ad.subcategory.name || "",
      slug: ad.subcategory.slug || ""
    } : null,
    governorateId: ad.governorateId ? { name: ad.governorateId.name || "" } : null,
    cityId: ad.cityId ? { name: ad.cityId.name || "" } : null
  };
}

export async function loadPublicSeoAd(id, {
  AdModel = Ad,
  StoreSubscriptionModel = StoreSubscription,
  now = new Date()
} = {}) {
  const ad = await applySeoQueryTimeout(AdModel.findById(id))
    .select(PUBLIC_AD_FIELDS)
    .populate("governorateId", "name")
    .populate("cityId", "name")
    .populate({
      path: "categoryId",
      select: "name slug parentId",
      populate: { path: "parentId", select: "name slug" }
    })
    .populate({
      path: "storeProfileId",
      select: "storeName slug logo status"
    })
    .lean();
  if (!ad) return { kind: "not_found" };
  if (!isPublicAdVisible(ad, now)) return { kind: "not_public" };

  if (ad.storeProfileId?._id) {
    const subscription = await applySeoQueryTimeout(
      StoreSubscriptionModel.findOne({ storeId: ad.storeProfileId._id }),
      SEO_QUERY_TIMEOUT_MS
    )
      .sort({ createdAt: -1, _id: -1 })
      .select("status endDate")
      .lean();
    if (!isPublicStoreEligible(ad.storeProfileId, subscription, now)) {
      return { kind: "not_public" };
    }
    ad.storeProfileId = {
      storeName: ad.storeProfileId.storeName || "",
      slug: ad.storeProfileId.slug || "",
      logo: ad.storeProfileId.logo || ""
    };
  } else {
    ad.storeProfileId = null;
  }

  if (ad.categoryId?.parentId) {
    ad.parentCategory = ad.categoryId.parentId;
    ad.subcategory = {
      name: ad.categoryId.name,
      slug: ad.categoryId.slug
    };
  }
  return { kind: "found", ad };
}

function parseAdRequestTarget(requestTarget) {
  if (
    typeof requestTarget !== "string" ||
    requestTarget.length > MAX_REQUEST_TARGET_LENGTH
  ) return { matched: true, valid: false };
  const queryIndex = requestTarget.indexOf("?");
  const rawPath = queryIndex === -1 ? requestTarget : requestTarget.slice(0, queryIndex);
  const queryString = queryIndex === -1 ? "" : requestTarget.slice(queryIndex + 1);
  if (!/^\/(?:ad|ads|product)(?:\/|$)/i.test(rawPath)) return { matched: false };

  const match = rawPath.match(/^\/(ad|ads|product)\/([^/]+)(?:\/([^/]+))?\/?$/i);
  if (!match) return { matched: true, valid: false, rawPath, queryString };
  let id;
  let slug;
  try {
    id = decodeURIComponent(match[2]);
    slug = match[3] === undefined ? null : decodeURIComponent(match[3]);
  } catch {
    return { matched: true, valid: false, rawPath, queryString };
  }
  const normalizedId = normalizePublicObjectId(id);
  if (!normalizedId || (slug !== null && (slug.length === 0 || slug.length > MAX_SLUG_LENGTH))) {
    return { matched: true, valid: false, rawPath, queryString };
  }
  return {
    matched: true,
    valid: true,
    alias: match[1].toLowerCase() !== "ad" || slug === null,
    id: normalizedId,
    slug,
    rawPath,
    queryString
  };
}

function getAllowedRedirectQuery(queryString) {
  const params = new URLSearchParams(queryString);
  const refs = params.getAll("ref");
  const allowed = new URLSearchParams();
  if (refs.length === 1 && refs[0].length > 0 && refs[0].length <= 128) {
    allowed.set("ref", refs[0]);
  }

  const seenUtm = new Set();
  for (const [name, value] of params) {
    const normalizedName = name.toLowerCase();
    if (
      !/^utm_[a-z0-9_]{1,32}$/.test(normalizedName) ||
      seenUtm.has(normalizedName) ||
      value.length === 0 ||
      value.length > 128 ||
      seenUtm.size >= 8
    ) continue;
    seenUtm.add(normalizedName);
    allowed.set(normalizedName, value);
    if (allowed.toString().length > 512) allowed.delete(normalizedName);
  }

  const query = allowed.toString();
  return query ? `?${query}` : "";
}

function sendNotFound(res, template, siteBaseUrl, routePath) {
  return sendDynamicSeoPage(res, template, {
    status: 404,
    routePath,
    title: "الإعلان غير موجود | سوقك",
    description: "عذراً، الإعلان الذي تبحث عنه غير موجود أو غير متاح.",
    body: `<main class="ssg-public-content" dir="rtl"><h1>الإعلان غير موجود</h1><p>عذراً، الإعلان الذي تبحث عنه غير موجود أو غير متاح.</p><p><a href="${escapeHtml(siteBaseUrl)}/">العودة إلى الرئيسية</a></p></main>`
  });
}

export function createDynamicAdResource({
  loadAd = loadPublicSeoAd
} = {}) {
  return {
    resourceLabel: "الإعلان",
    async revalidate(target) {
      if (!target?.valid) return false;
      const resource = await loadAd(target.id);
      if (!resource || resource.kind !== "found" || !resource.ad) return false;
      return isPublicAdIndexable(resource.ad);
    },
    match(req) {
      const target = parseAdRequestTarget(req.url);
      return target.matched ? target : null;
    },
    async render({ res, next, target, template, siteBaseUrl, apiOrigin }) {
      if (!target.valid) return sendNotFound(res, template, siteBaseUrl, "");

      const resource = await loadAd(target.id);
      if (!resource || resource.kind === "not_found" || resource.kind === "not_public") {
        return sendNotFound(res, template, siteBaseUrl, target.rawPath);
      }
      if (resource.kind !== "found" || !resource.ad) return next();

      const ad = resource.ad;
      const canonicalPath = buildAdPath(ad);
      if (!canonicalPath) return sendNotFound(res, template, siteBaseUrl, target.rawPath);
      const canonicalUrl = new URL(resolveCanonicalUrl(canonicalPath, siteBaseUrl));
      if (target.rawPath !== canonicalUrl.pathname) {
        const location = `${canonicalUrl.pathname}${getAllowedRedirectQuery(target.queryString)}`;
        if (location === target.rawPath) return sendNotFound(res, template, siteBaseUrl, target.rawPath);
        res.setHeader("Location", `${canonicalUrl.origin}${location}`);
        res.setHeader("X-Robots-Tag", "noindex, nofollow");
        return res.status(301).end();
      }

      const indexable = isPublicAdIndexable(ad);
      const html = renderShell(template, {
        status: 200,
        siteBaseUrl,
        routePath: target.rawPath,
        ad,
        apiOrigin,
        indexable
      });
      if (!indexable) res.setHeader("X-Robots-Tag", "noindex, nofollow");
      return res.status(200).send(html);
    }
  };
}

export function createDynamicAdRenderer(options = {}) {
  return createDynamicSeoRenderer({
    ...options,
    resources: [createDynamicAdResource(options)]
  });
}

export const dynamicAdRendererInternals = Object.freeze({
  parseAdRequestTarget,
  renderShell,
  toHydrationAd,
  validateFrontendTemplate,
  PUBLIC_AD_FIELDS
});
