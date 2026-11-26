import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Ad from "../models/Ad.js";
import Auction from "../models/Auction.js";
import Category from "../models/Category.js";
import StoreProfile from "../models/StoreProfile.js";
import StoreSubscription from "../models/StoreSubscription.js";
import User from "../models/User.js";
import {
  DEFAULT_SITE_BASE_URL,
  INDEXABLE_STATIC_PATHS,
  MIN_PUBLIC_ADS_FOR_SUBCATEGORY,
  buildAdPath,
  encodeSeoPathSegment,
  isPublicAdIndexable,
  isPublicAuctionIndexable,
  isPublicCategoryIndexable,
  isPublicStoreIndexable,
  normalizePublicObjectId,
  resolveCanonicalUrl,
  resolveSiteBaseUrl,
  resolveMinimumPublicAdsForSubcategory
} from "../../../shared/seoRules.mjs";
import { getAuctionCategoryRequirementsForCategory } from "./auctionCategoryRequirements.js";
import { isPublicationEligible } from "./auctionPublicationEligibility.js";
import {
  BoundedSeoWorkLimiter,
  SeoWorkLimitError,
  seoWorkLimiter as sharedSeoWorkLimiter
} from "./seoCache.js";

const SITEMAP_XML_NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9";
const DEFAULT_MAX_URLS_PER_FILE = 5_000;
const DEFAULT_MAX_FILE_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_CACHE_BYTES = 512 * 1024 * 1024;
const DEFAULT_MAX_BUILD_DURATION_MS = 90_000;
const DEFAULT_MAX_CATEGORY_COUNT = 20_000;
const DEFAULT_CURSOR_BATCH_SIZE = 500;
const DEFAULT_CACHE_TTL_MS = 60_000;
const MAX_CACHE_TTL_MS = 5 * 60_000;
const MAX_SITEMAP_INDEX_FILES = 50_000;
const PUBLIC_AD_FIELDS = [
  "_id",
  "slug",
  "title",
  "categoryId",
  "expiresAt",
  "storeSubscriptionEndDate",
  "scheduledPublishAt",
  "inventoryEnabled",
  "stockQuantity",
  "status",
  "isDeleted",
  "isVisible",
  "isArchived",
  "sold",
  "isSold",
  "isAvailable"
].join(" ");

function isPositiveSafeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive safe integer.`);
  }
  return value;
}

export function resolveSitemapCacheTtlMs(value) {
  if (value == null || (typeof value === "string" && value.trim() === "")) {
    return DEFAULT_CACHE_TTL_MS;
  }
  const cacheTtlMs = Number(value);
  if (!Number.isSafeInteger(cacheTtlMs) || cacheTtlMs < 1 || cacheTtlMs > MAX_CACHE_TTL_MS) {
    throw new Error(`SEO_SITEMAP_CACHE_TTL_MS must be an integer from 1 to ${MAX_CACHE_TTL_MS}.`);
  }
  return cacheTtlMs;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function serializeUrlRecord(record, siteBaseUrl) {
  if (!record || typeof record.path !== "string" ||
    !record.path.startsWith("/") || record.path.startsWith("//") ||
    /[?#\u0000-\u001f\u007f]/u.test(record.path)) {
    throw new Error("A sitemap record contained an invalid local path.");
  }
  const url = resolveCanonicalUrl(record.path, siteBaseUrl);
  return `  <url><loc>${escapeXml(url)}</loc></url>`;
}

function serializeSitemapIndex(paths, siteBaseUrl) {
  const entries = paths.map((mapPath) => (
    `  <sitemap><loc>${escapeXml(resolveCanonicalUrl(mapPath, siteBaseUrl))}</loc></sitemap>`
  ));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="${SITEMAP_XML_NAMESPACE}">\n${entries.join("\n")}\n</sitemapindex>\n`;
}

function serializeUrlSet(records) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="${SITEMAP_XML_NAMESPACE}">\n${records.join("\n")}\n</urlset>\n`;
}

function createSitemapFile(xml, sitemapPath, directory) {
  const buffer = Buffer.from(xml, "utf8");
  return {
    path: sitemapPath,
    filePath: path.join(directory, sitemapPath.slice(1)),
    bytes: buffer.byteLength,
    etag: `"${crypto.createHash("sha256").update(buffer).digest("hex")}"`
  };
}

function createPublicAdMatch(now) {
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

export function buildPublicAdSitemapPipeline(now, { countByCategory = false } = {}) {
  const pipeline = [
    { $match: createPublicAdMatch(now) },
    {
      $lookup: {
        from: StoreProfile.collection.name,
        localField: "storeProfileId",
        foreignField: "_id",
        as: "_seoStore"
      }
    },
    { $unwind: { path: "$_seoStore", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: StoreSubscription.collection.name,
        let: { storeId: "$storeProfileId" },
        pipeline: [
          { $match: { $expr: { $eq: ["$storeId", "$$storeId"] } } },
          { $sort: { createdAt: -1, _id: -1 } },
          { $limit: 1 },
          { $project: { _id: 0, status: 1, endDate: 1 } }
        ],
        as: "_seoSubscription"
      }
    },
    { $unwind: { path: "$_seoSubscription", preserveNullAndEmptyArrays: true } },
    {
      $match: {
        $or: [
          { storeProfileId: null },
          { storeProfileId: { $exists: false } },
          {
            $and: [
              { "_seoStore.status": "active" },
              { "_seoSubscription.status": "active" },
              {
                $or: [
                  { "_seoSubscription.endDate": null },
                  { "_seoSubscription.endDate": { $gt: now } }
                ]
              }
            ]
          }
        ]
      }
    }
  ];

  if (countByCategory) {
    pipeline.push({
      $group: {
        _id: "$categoryId",
        count: { $sum: 1 }
      }
    });
    return pipeline;
  }

  const projection = Object.fromEntries(
    PUBLIC_AD_FIELDS.split(" ").map((field) => [field, 1])
  );
  projection.storeSubscriptionEndDate = "$_seoSubscription.endDate";
  pipeline.push({ $project: projection });
  return pipeline;
}

export function buildPublicStoreSitemapPipeline(now) {
  return [
    {
      $match: {
        status: "active",
        $or: [
          { storeType: { $in: ["store", "family-production"] } },
          { storeType: { $exists: false } }
        ]
      }
    },
    {
      $lookup: {
        from: StoreSubscription.collection.name,
        let: { storeId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$storeId", "$$storeId"] } } },
          { $sort: { createdAt: -1, _id: -1 } },
          { $limit: 1 },
          { $project: { _id: 0, status: 1, endDate: 1 } }
        ],
        as: "_seoSubscription"
      }
    },
    { $unwind: "$_seoSubscription" },
    {
      $match: {
        "_seoSubscription.status": "active",
        $or: [
          { "_seoSubscription.endDate": null },
          { "_seoSubscription.endDate": { $gt: now } }
        ]
      }
    },
    {
      $project: {
        _id: 1,
        slug: 1,
        status: 1,
        storeType: { $ifNull: ["$storeType", "store"] },
        subscriptionEndDate: "$_seoSubscription.endDate"
      }
    }
  ];
}

export function buildPublicAuctionSitemapPipeline(now) {
  return [
    {
      $match: {
        reviewStatus: "approved",
        status: "live",
        startAt: { $lte: now },
        endAt: { $gt: now },
        isDeleted: { $ne: true },
        isHidden: { $ne: true },
        isVisible: { $ne: false },
        publiclyAccessible: { $ne: false }
      }
    },
    {
      $lookup: {
        from: User.collection.name,
        let: { ownerId: "$ownerId" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$ownerId"] } } },
          {
            $project: {
              verificationStatus: 1,
              verificationExpiryDate: 1,
              isDisabled: 1,
              isDeleted: 1
            }
          }
        ],
        as: "_seoOwner"
      }
    },
    {
      $addFields: {
        ownerId: {
          _id: { $arrayElemAt: ["$_seoOwner._id", 0] },
          verificationStatus: {
            $ifNull: [{ $arrayElemAt: ["$_seoOwner.verificationStatus", 0] }, null]
          },
          verificationExpiryDate: {
            $arrayElemAt: ["$_seoOwner.verificationExpiryDate", 0]
          },
          isDisabled: { $arrayElemAt: ["$_seoOwner.isDisabled", 0] },
          isDeleted: { $arrayElemAt: ["$_seoOwner.isDeleted", 0] }
        }
      }
    },
    {
      $lookup: {
        from: Category.collection.name,
        let: { categoryId: "$categoryId" },
        pipeline: [
          {
            $match: {
              status: "active",
              $expr: { $eq: ["$_id", "$$categoryId"] }
            }
          },
          { $project: { _id: 1, slug: 1, status: 1 } }
        ],
        as: "_seoCategory"
      }
    },
    { $addFields: { categoryId: { $arrayElemAt: ["$_seoCategory", 0] } } },
    {
      $project: {
        _id: 1,
        reviewStatus: 1,
        approvedAt: 1,
        approvedBy: 1,
        status: 1,
        isDeleted: 1,
        isHidden: 1,
        isVisible: 1,
        publiclyAccessible: 1,
        startAt: 1,
        endAt: 1,
        durationDays: 1,
        ownerId: 1,
        categoryId: 1,
        categoryDetails: 1,
        imageLabels: 1,
        "categoryDocuments.type": 1,
        "categoryDocuments.policyVersion": 1,
        "categoryDocuments.reviewStatus": 1,
        "categoryDocuments.isCurrent": 1,
        "categoryDocuments.expiresAt": 1
      }
    }
  ];
}

async function* cursorRows(cursor) {
  if (!cursor || typeof cursor[Symbol.asyncIterator] !== "function") {
    throw new TypeError("Sitemap database queries must return an async cursor.");
  }
  for await (const row of cursor) yield row;
}

function encodeSegmentOrNull(value) {
  try {
    return encodeSeoPathSegment(value);
  } catch {
    return null;
  }
}

function categoryCountsBySubtree(categories, directCounts) {
  const childrenByParent = new Map();
  for (const category of categories) {
    if (category.parentId == null) continue;
    const parentId = String(category.parentId);
    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
    childrenByParent.get(parentId).push(category);
  }

  const descendantIdsByCategory = new Map();
  for (const category of categories) {
    const foundIds = [];
    const visited = new Set([String(category._id)]);
    const queue = [{ id: String(category._id), depth: 0 }];
    for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
      const current = queue[queueIndex];
      if (current.depth > 16) continue;
      foundIds.push(current.id);
      for (const child of childrenByParent.get(current.id) || []) {
        const childId = String(child._id);
        if (visited.has(childId)) continue;
        visited.add(childId);
        queue.push({ id: childId, depth: current.depth + 1 });
      }
    }
    descendantIdsByCategory.set(String(category._id), foundIds);
  }
  return { childrenByParent, descendantIdsByCategory };
}

function getEarliestExpiry(...values) {
  const timestamps = values
    .map((value) => getExpiryTimestamp({ expiresAt: value }))
    .filter((timestamp) => timestamp !== null);
  return timestamps.length ? new Date(Math.min(...timestamps)) : null;
}

export function createMongoSitemapRecordSources({
  AdModel = Ad,
  AuctionModel = Auction,
  CategoryModel = Category,
  StoreProfileModel = StoreProfile,
  minimumPublicAdsForSubcategory = MIN_PUBLIC_ADS_FOR_SUBCATEGORY,
  maxCategoryCount = DEFAULT_MAX_CATEGORY_COUNT,
  cursorBatchSize = DEFAULT_CURSOR_BATCH_SIZE,
  maxBuildDurationMs = DEFAULT_MAX_BUILD_DURATION_MS
} = {}) {
  return {
    async *pages({ staticPaths = INDEXABLE_STATIC_PATHS }) {
      for (const routePath of staticPaths) yield { path: routePath };
    },

    async *categories({ now }) {
      const categoryCursor = CategoryModel.find({ status: "active" })
        .select("_id name slug description parentId status")
        .sort({ _id: 1 })
        .lean()
        .setOptions({ maxTimeMS: maxBuildDurationMs, timeoutMS: maxBuildDurationMs })
        .cursor({ batchSize: cursorBatchSize });
      const categories = [];
      for await (const category of cursorRows(categoryCursor)) {
        categories.push(category);
        if (categories.length > maxCategoryCount) {
          throw new Error(`The active category count exceeded the configured limit of ${maxCategoryCount}.`);
        }
      }

      const countCursor = AdModel.aggregate(buildPublicAdSitemapPipeline(now, {
        countByCategory: true
      }))
        .allowDiskUse(true)
        .option({ maxTimeMS: maxBuildDurationMs, timeoutMS: maxBuildDurationMs })
        .cursor({ batchSize: cursorBatchSize });
      const directCounts = new Map();
      for await (const result of cursorRows(countCursor)) {
        if (result?._id != null) directCounts.set(String(result._id), Number(result.count) || 0);
      }

      const {
        childrenByParent,
        descendantIdsByCategory
      } = categoryCountsBySubtree(categories, directCounts);
      const roots = categories.filter((category) => category.parentId == null);
      for (const root of roots) {
        const rootSlug = encodeSegmentOrNull(root.slug);
        if (rootSlug && isPublicCategoryIndexable({
          category: root,
          isMainCategory: true
        })) {
          yield { path: `/category/${rootSlug}` };
        }

        const children = childrenByParent.get(String(root._id)) || [];
        for (const child of children) {
          const childSlug = encodeSegmentOrNull(child.slug);
          const childPath = childSlug && rootSlug
            ? `/category/${rootSlug}/${childSlug}`
            : null;
          if (!childPath) continue;
          const relatedCategories = [
            root,
            ...children.filter((sibling) => String(sibling._id) !== String(child._id))
          ];
          const descendantIds = descendantIdsByCategory.get(String(child._id)) || [];
          const publicAdCount = descendantIds.reduce(
            (total, id) => total + (directCounts.get(id) || 0),
            0
          );
          if (isPublicCategoryIndexable({
            category: child,
            isMainCategory: false,
            parentCategory: root,
            relatedCategories,
            publicAdCount,
            minimumPublicAds: minimumPublicAdsForSubcategory
          })) {
            yield { path: childPath };
          }
        }
      }
    },

    async *ads({ now }) {
      const cursor = AdModel.aggregate(buildPublicAdSitemapPipeline(now))
        .allowDiskUse(true)
        .option({ maxTimeMS: maxBuildDurationMs, timeoutMS: maxBuildDurationMs })
        .cursor({ batchSize: cursorBatchSize });
      for await (const ad of cursorRows(cursor)) {
        if (!isPublicAdIndexable(ad, now)) continue;
        const adPath = buildAdPath(ad);
        if (adPath) {
          yield {
            path: adPath,
            expiresAt: getEarliestExpiry(ad.expiresAt, ad.storeSubscriptionEndDate)
          };
        }
      }
    },

    async *stores({ now }) {
      const cursor = StoreProfileModel.aggregate(buildPublicStoreSitemapPipeline(now))
        .allowDiskUse(true)
        .option({ maxTimeMS: maxBuildDurationMs, timeoutMS: maxBuildDurationMs })
        .cursor({ batchSize: cursorBatchSize });
      for await (const store of cursorRows(cursor)) {
        if (!isPublicStoreIndexable({
          store,
          hasActiveSubscription: true
        })) continue;
        if (store.subscriptionEndDate != null) {
          const subscriptionEndDate = new Date(store.subscriptionEndDate).getTime();
          if (!Number.isFinite(subscriptionEndDate) || subscriptionEndDate <= now.getTime()) {
            continue;
          }
        }
        if (/^[a-f\d]{24}$/i.test(String(store.slug || ""))) continue;
        const slug = encodeSegmentOrNull(store.slug);
        if (!slug) continue;
        yield {
          path: `/store/${slug}`,
          expiresAt: store.subscriptionEndDate || null
        };
      }
    },

    async *auctions({ now }) {
      const cursor = AuctionModel.aggregate(buildPublicAuctionSitemapPipeline(now))
        .allowDiskUse(true)
        .option({ maxTimeMS: maxBuildDurationMs, timeoutMS: maxBuildDurationMs })
        .cursor({ batchSize: cursorBatchSize });
      for await (const auction of cursorRows(cursor)) {
        if (!normalizePublicObjectId(auction?._id) ||
          !isPublicAuctionIndexable(auction, now)) continue;
        const eligible = await isPublicationEligible(auction, now, {
          resolveCategoryRequirements: async () => (
            getAuctionCategoryRequirementsForCategory(auction.categoryId)
          )
        });
        if (eligible) {
          yield {
            path: `/auctions/${normalizePublicObjectId(auction._id)}`,
            expiresAt: auction.endAt
          };
        }
      }
    }
  };
}

function getExpiryTimestamp(record) {
  if (record?.expiresAt == null) return null;
  const value = record.expiresAt instanceof Date
    ? record.expiresAt.getTime()
    : Date.parse(record.expiresAt);
  return Number.isFinite(value) ? value : null;
}

function matchesEtag(header, etag) {
  if (typeof header !== "string") return false;
  return header.split(",").some((candidate) => {
    const normalized = candidate.trim();
    return normalized === "*" || normalized === etag || normalized === `W/${etag}`;
  });
}

export function createDynamicSitemapService({
  siteBaseUrl = DEFAULT_SITE_BASE_URL,
  staticPaths = INDEXABLE_STATIC_PATHS,
  recordSources,
  minimumPublicAdsForSubcategory,
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
  maxUrlsPerFile = DEFAULT_MAX_URLS_PER_FILE,
  maxFileBytes = DEFAULT_MAX_FILE_BYTES,
  maxCacheBytes = DEFAULT_MAX_CACHE_BYTES,
  maxBuildDurationMs = DEFAULT_MAX_BUILD_DURATION_MS,
  maxCategoryCount = DEFAULT_MAX_CATEGORY_COUNT,
  cursorBatchSize = DEFAULT_CURSOR_BATCH_SIZE,
  tempRoot = os.tmpdir(),
  logger = console,
  nowProvider = () => new Date(),
  clock = () => Date.now(),
  workLimiter = sharedSeoWorkLimiter
} = {}) {
  const normalizedSiteBaseUrl = resolveSiteBaseUrl(siteBaseUrl);
  const sitemapWorkLimiter = workLimiter || new BoundedSeoWorkLimiter(16);
  const minimumPublicAds = resolveMinimumPublicAdsForSubcategory(
    minimumPublicAdsForSubcategory
  );
  isPositiveSafeInteger(cacheTtlMs, "cacheTtlMs");
  isPositiveSafeInteger(maxUrlsPerFile, "maxUrlsPerFile");
  isPositiveSafeInteger(maxFileBytes, "maxFileBytes");
  isPositiveSafeInteger(maxCacheBytes, "maxCacheBytes");
  isPositiveSafeInteger(maxBuildDurationMs, "maxBuildDurationMs");
  isPositiveSafeInteger(maxCategoryCount, "maxCategoryCount");
  isPositiveSafeInteger(cursorBatchSize, "cursorBatchSize");
  if (maxUrlsPerFile > 50_000 || maxFileBytes > 50 * 1024 * 1024) {
    throw new Error("Sitemap shard limits exceed the protocol safety bounds.");
  }

  const sources = recordSources || createMongoSitemapRecordSources({
    minimumPublicAdsForSubcategory: minimumPublicAds,
    maxCategoryCount,
    cursorBatchSize,
    maxBuildDurationMs
  });
  let currentSnapshot = null;
  let snapshotPromise = null;
  let snapshotGeneration = 0;

  async function buildSnapshot() {
    const startedAt = clock();
    const generationAtStart = snapshotGeneration;
    const now = nowProvider();
    const validUntil = { value: startedAt + cacheTtlMs };
    const directory = await fs.mkdtemp(path.join(tempRoot, "souqak-sitemap-"));
    const files = new Map();
    let totalBytes = 0;
    const checkBuildLimit = () => {
      if (clock() - startedAt > maxBuildDurationMs) {
        throw new Error(`Sitemap generation exceeded ${maxBuildDurationMs}ms.`);
      }
    };

    async function addFile(xml, sitemapPath) {
      const file = createSitemapFile(xml, sitemapPath, directory);
      if (file.bytes > maxFileBytes) {
        throw new Error(`Sitemap shard ${sitemapPath} exceeded the configured file-size limit.`);
      }
      totalBytes += file.bytes;
      if (totalBytes > maxCacheBytes) {
        throw new Error(`Sitemap generation exceeded the configured ${maxCacheBytes}-byte cache limit.`);
      }
      await fs.writeFile(file.filePath, xml, { encoding: "utf8", flag: "wx" });
      files.set(file.path, file);
    }

    try {
      for (const [dataset, sourceName] of [
        ["pages", "pages"],
        ["categories", "categories"],
        ["ads", "ads"],
        ["stores", "stores"],
        ["auctions", "auctions"]
      ]) {
        const source = sources[sourceName];
        if (typeof source !== "function") {
          throw new TypeError(`The ${sourceName} sitemap record source is not configured.`);
        }
        let partNumber = 0;
        let entries = [];
        let entryBytes = Buffer.byteLength(
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="${SITEMAP_XML_NAMESPACE}">\n</urlset>\n`
        );

        const flush = async () => {
          if (!entries.length) return;
          if (files.size >= MAX_SITEMAP_INDEX_FILES) {
            throw new Error("Sitemap generation exceeded the protocol sitemap-index limit.");
          }
          partNumber += 1;
          const sitemapPath = `/sitemap-${dataset}-${partNumber}.xml`;
          const xml = serializeUrlSet(entries);
          await addFile(xml, sitemapPath);
          entries = [];
          entryBytes = Buffer.byteLength(
            `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="${SITEMAP_XML_NAMESPACE}">\n</urlset>\n`
          );
        };

        for await (const record of source({
          now,
          staticPaths,
          minimumPublicAdsForSubcategory: minimumPublicAds
        })) {
          checkBuildLimit();
          const entry = serializeUrlRecord(record, normalizedSiteBaseUrl);
          const entryBytesToAdd = Buffer.byteLength(entry) + 1;
          const emptyFileBytes = Buffer.byteLength(
            `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="${SITEMAP_XML_NAMESPACE}">\n</urlset>\n`
          );
          if (entryBytesToAdd + emptyFileBytes > maxFileBytes) {
            throw new Error(`A ${dataset} sitemap entry exceeds the configured file-size limit.`);
          }
          if (entries.length && (
            entries.length >= maxUrlsPerFile ||
            entryBytes + entryBytesToAdd > maxFileBytes
          )) {
            await flush();
          }
          entries.push(entry);
          entryBytes += entryBytesToAdd;
          const expiresAt = getExpiryTimestamp(record);
          if (expiresAt != null) validUntil.value = Math.min(validUntil.value, expiresAt);
        }
        await flush();
        if (partNumber > MAX_SITEMAP_INDEX_FILES) {
          throw new Error("Sitemap generation exceeded the protocol sitemap-index limit.");
        }
      }

      if (validUntil.value <= clock()) {
        throw new Error("The generated sitemap became stale before it could be served.");
      }
      const indexPath = "/sitemap.xml";
      const indexXml = serializeSitemapIndex([...files.keys()], normalizedSiteBaseUrl);
      await addFile(indexXml, indexPath);
      if (files.size - 1 > MAX_SITEMAP_INDEX_FILES) {
        throw new Error("Sitemap generation exceeded the protocol sitemap-index limit.");
      }

      const snapshot = {
        directory,
        files,
        validUntil: validUntil.value,
        totalBytes
      };
      if (generationAtStart !== snapshotGeneration) {
        await fs.rm(directory, { recursive: true, force: true });
        throw new Error("Sitemap generation was invalidated before publication.");
      }
      const previousSnapshot = currentSnapshot;
      currentSnapshot = snapshot;
      if (previousSnapshot?.directory) {
        try {
          await fs.rm(previousSnapshot.directory, { recursive: true, force: true });
        } catch (error) {
          logger.warn?.({
            event: "sitemap_previous_snapshot_cleanup_failed",
            error: error instanceof Error ? error.message : "Unknown cleanup error"
          });
        }
      }
      logger.info?.({
        event: "sitemap_generated",
        fileCount: files.size - 1,
        totalBytes,
        durationMs: clock() - startedAt
      });
      return snapshot;
    } catch (error) {
      await fs.rm(directory, { recursive: true, force: true });
      throw error;
    }
  }

  async function getSnapshot() {
    const now = clock();
    if (currentSnapshot && now < currentSnapshot.validUntil) return currentSnapshot;
    if (!snapshotPromise) {
      snapshotPromise = buildSnapshot().finally(() => {
        snapshotPromise = null;
      });
    }
    return snapshotPromise;
  }

  async function middleware(req, res, next) {
    const requestPath = req.path;
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (!/^\/sitemap(?:-[^/]+)?\.xml$/i.test(requestPath)) return next();

    const release = sitemapWorkLimiter.tryAcquire();
    if (!release) {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Retry-After", "30");
      return res.status(503).type("text/plain").send("Sitemap temporarily unavailable.");
    }

    try {
      const snapshot = await getSnapshot();
      const file = snapshot.files.get(requestPath);
      if (!file) {
        res.setHeader("Cache-Control", "no-store");
        return res.status(404).type("text/plain").send("Sitemap not found.");
      }
      const body = await fs.readFile(file.filePath);
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Content-Length", body.byteLength);
      res.setHeader("ETag", file.etag);
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      if (matchesEtag(req.headers["if-none-match"], file.etag)) {
        return res.status(304).end();
      }
      if (req.method === "HEAD") return res.status(200).end();
      return res.status(200).send(body);
    } catch (error) {
      logger.error?.({
        event: "sitemap_generation_failed",
        error: error instanceof Error ? error.message : "Unknown sitemap error"
      });
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Retry-After", "30");
      return res.status(503).type("text/plain").send("Sitemap temporarily unavailable.");
    } finally {
      release();
    }
  }

  async function close() {
    snapshotGeneration += 1;
    if (currentSnapshot?.directory) {
      await fs.rm(currentSnapshot.directory, { recursive: true, force: true });
      currentSnapshot = null;
    }
    snapshotPromise = null;
  }

  function invalidate() {
    snapshotGeneration += 1;
    const previousSnapshot = currentSnapshot;
    currentSnapshot = null;
    if (previousSnapshot?.directory) {
      fs.rm(previousSnapshot.directory, { recursive: true, force: true }).catch((error) => {
        logger.warn?.({
          event: "sitemap_invalidation_cleanup_failed",
          error: error instanceof Error ? error.message : "Unknown cleanup error"
        });
      });
    }
  }

  return { middleware, close, invalidate };
}
