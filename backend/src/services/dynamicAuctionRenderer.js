import mongoose from "mongoose";
import Auction from "../models/Auction.js";
import {
  getPublicAdImageUrl,
  createAuctionStructuredData,
  hasMeaningfulQueryParameters,
  isPublicAuctionIndexable,
  normalizePublicObjectId,
  renderPublicAuctionContentHtml,
  resolveCanonicalUrl,
  sanitizeSeoAdDescription
} from "../../../shared/seoRules.mjs";
import { isPublicationEligible } from "./auctionPublicationEligibility.js";
import { resolveAuctionCategoryRequirements } from "./auctionCategoryRequirements.js";
import { applySeoQueryTimeout, SEO_QUERY_TIMEOUT_MS } from "./seoCache.js";
import { addAuctionAmounts, serializeAuctionAmount } from "../utils/auctionMoney.js";
import { parseDynamicSeoRouteTarget, sendDynamicSeoPage } from "./dynamicSeoRenderer.js";

const PUBLIC_AUCTION_STATES = ["live", "scheduled", "ended"];
const AUCTION_FIELDS = [
  "_id",
  "title",
  "description",
  "itemCondition",
  "defectsNotes",
  "deliveryMethod",
  "deliveryDetails",
  "images",
  "categoryDetails",
  "imageLabels",
  "categoryDocuments",
  "categoryDocumentStatus",
  "categoryId",
  "governorateId",
  "cityId",
  "currency",
  "startingPrice",
  "currentPrice",
  "minimumIncrement",
  "durationDays",
  "startAt",
  "endAt",
  "status",
  "createdAt",
  "reviewStatus",
  "approvedAt",
  "approvedBy",
  "ownerId",
  "bidCount",
  "endedAt",
  "winnerId",
  "saleStatus"
].join(" ");

function isSafePublicImage(image, options) {
  return typeof image === "string" &&
    image.length <= 2048 &&
    Boolean(getPublicAdImageUrl(image, options));
}

function toPublicSeoAuction(auction, { siteBaseUrl, apiOrigin }) {
  const images = Array.isArray(auction.images)
    ? auction.images.filter((image) => isSafePublicImage(image, { siteBaseUrl, apiOrigin })).slice(0, 10)
    : [];
  const owner = auction.ownerId && typeof auction.ownerId === "object"
    ? auction.ownerId
    : null;
  return {
    id: String(auction._id),
    title: String(auction.title || ""),
    description: sanitizeSeoAdDescription(auction.description, 2000),
    itemCondition: sanitizeSeoAdDescription(auction.itemCondition, 500),
    defectsNotes: sanitizeSeoAdDescription(auction.defectsNotes, 1000),
    deliveryMethod: auction.deliveryMethod,
    deliveryDetails: sanitizeSeoAdDescription(auction.deliveryDetails, 1000),
    images,
    category: auction.categoryId
      ? { name: String(auction.categoryId.name || ""), slug: String(auction.categoryId.slug || "") }
      : null,
    governorate: auction.governorateId
      ? { name: String(auction.governorateId.name || "") }
      : null,
    city: auction.cityId ? { name: String(auction.cityId.name || "") } : null,
    seller: owner ? {
      name: sanitizeSeoAdDescription(owner.name, 120),
      avatar: isSafePublicImage(owner.avatar, { siteBaseUrl, apiOrigin }) ? owner.avatar : null
    } : null,
    currency: String(auction.currency || ""),
    startingPrice: serializeAuctionAmount(auction.startingPrice),
    currentPrice: serializeAuctionAmount(auction.currentPrice),
    minimumIncrement: serializeAuctionAmount(auction.minimumIncrement),
    durationDays: Number(auction.durationDays),
    startAt: auction.startAt,
    endAt: auction.endAt,
    status: auction.status,
    bidCount: Number(auction.bidCount || 0),
    createdAt: auction.createdAt,
    endedAt: auction.endedAt || null,
    minimumBidAmount: addAuctionAmounts(
      auction.currentPrice,
      auction.minimumIncrement
    ).toString(),
    winner: auction.status === "ended" && auction.winnerId
      ? { label: "تم تحديد الفائز", amount: serializeAuctionAmount(auction.currentPrice) }
      : null,
    saleStatus: auction.saleStatus || "not_applicable"
  };
}

export async function loadPublicSeoAuction(id, {
  AuctionModel = Auction,
  isEligible = isPublicationEligible,
  now = new Date()
} = {}) {
  const normalizedId = normalizePublicObjectId(id);
  if (!normalizedId || !mongoose.isValidObjectId(normalizedId)) return { kind: "not_found" };
  const auction = await applySeoQueryTimeout(AuctionModel.findOne({
    _id: normalizedId,
    reviewStatus: "approved",
    status: { $in: PUBLIC_AUCTION_STATES }
  }))
    .select(AUCTION_FIELDS)
    .populate("categoryId", "name slug")
    .populate("governorateId", "name")
    .populate("cityId", "name")
    .populate(
      "ownerId",
      "name avatar verificationStatus verificationExpiryDate isDisabled isDeleted"
    )
    .lean();
  if (!auction) return { kind: "not_found" };
  if (!(await isEligible(auction, now, {
    resolveCategoryRequirements: (categoryId) => (
      resolveAuctionCategoryRequirements(categoryId, {
        maxTimeMS: SEO_QUERY_TIMEOUT_MS
      })
    )
  }))) return { kind: "not_public" };
  return { kind: "found", auction };
}

export function createDynamicAuctionResource({
  loadAuction = loadPublicSeoAuction
} = {}) {
  return {
    resourceLabel: "المزاد",
    match(req) {
      const target = parseDynamicSeoRouteTarget(req.url, "auctions", 1);
      if (target?.valid && target.pathSegments[0].toLowerCase() === "new") return null;
      return target;
    },
    async render({ res, target, template, siteBaseUrl, apiOrigin }) {
      if (!target.valid) {
        return sendDynamicSeoPage(res, template, {
          status: 404,
          title: "المزاد غير موجود | سوقك",
          description: "المزاد المطلوب غير موجود أو غير متاح.",
          body: "<main class=\"ssg-public-content\" dir=\"rtl\"><h1>المزاد غير موجود</h1></main>"
        });
      }

      const id = normalizePublicObjectId(target.pathSegments[0]);
      if (!id) {
        return sendDynamicSeoPage(res, template, {
          status: 404,
          routePath: target.rawPath,
          title: "المزاد غير موجود | سوقك",
          description: "المزاد المطلوب غير موجود أو غير متاح.",
          body: "<main class=\"ssg-public-content\" dir=\"rtl\"><h1>المزاد غير موجود</h1></main>"
        });
      }
      const resource = await loadAuction(id);
      if (!resource || resource.kind === "not_found" || resource.kind === "not_public") {
        return sendDynamicSeoPage(res, template, {
          status: 404,
          routePath: target.rawPath,
          title: "المزاد غير موجود | سوقك",
          description: "المزاد المطلوب غير موجود أو غير متاح.",
          body: "<main class=\"ssg-public-content\" dir=\"rtl\"><h1>المزاد غير موجود</h1></main>"
        });
      }
      if (resource.kind !== "found" || !resource.auction) {
        throw new Error("The public auction lookup returned an invalid result.");
      }

      const auction = toPublicSeoAuction(resource.auction, { siteBaseUrl, apiOrigin });
      const canonicalPath = `/auctions/${id}`;
      const canonical = resolveCanonicalUrl(canonicalPath, siteBaseUrl);
      const indexable = isPublicAuctionIndexable(auction, Date.now(), {
        publiclyAccessible: true
      }) && !hasMeaningfulQueryParameters(target.queryString);
      const title = `${sanitizeSeoAdDescription(auction.title, 120)} | سوقك`;
      const description = sanitizeSeoAdDescription(auction.description, 160);
      const image = auction.images.length
        ? getPublicAdImageUrl(auction.images[0], { siteBaseUrl, apiOrigin })
        : null;
      const contentData = { auction };
      const bodyHtml = renderPublicAuctionContentHtml({
        auction,
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
        structuredData: indexable ? createAuctionStructuredData({
          auction,
          url: canonical,
          image,
          siteBaseUrl
        }) : null,
        robots: indexable
          ? "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
          : "noindex,nofollow",
        body: `<div data-ssg-content="true">${bodyHtml}</div>`,
        hydrationData: {
          kind: "auction",
          data: { ...contentData, bids: [] },
          apiOrigin
        }
      });
    }
  };
}
