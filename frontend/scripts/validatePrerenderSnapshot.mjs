import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isPublicAdIndexable } from "../src/lib/publicAdIndexing.js";
import { resolveSiteBaseUrl } from "../src/lib/siteUrl.js";

export const PRERENDER_SNAPSHOT_SCHEMA_VERSION = 1;
export const DEFAULT_PRERENDER_SNAPSHOT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../data/seo-prerender-snapshot.json"
);

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const FORBIDDEN_FIELD_PATTERN = /(?:password|passphrase|token|secret|session|cookie|authorization|email|phone|whatsapp|contactinfo|bankaccount|ipaddress|userid|ownerid|createdby|publishedby|adminmanagement|privatekey|apikey|otp|latitude|longitude|coordinates|account|profile|seller|identity|nationalid|passport|document|attachment|credential|payment|transaction|wallet|address)/i;

function normalizeKey(key) {
  return String(key).replace(/[^a-z\d]/gi, "").toLowerCase();
}

function findSensitiveField(value, currentPath = "snapshot") {
  if (!value || typeof value !== "object") return null;

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${currentPath}.${key}`;
    if (FORBIDDEN_FIELD_PATTERN.test(normalizeKey(key))) return childPath;
    const nestedMatch = findSensitiveField(child, childPath);
    if (nestedMatch) return nestedMatch;
  }
  return null;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireString(value, label, { allowEmpty = false } = {}) {
  if (typeof value !== "string" || (!allowEmpty && value.trim().length === 0)) {
    throw new Error(`${label} must be ${allowEmpty ? "a string" : "a non-empty string"}.`);
  }
}

function requireBoolean(record, key, label) {
  if (typeof record[key] !== "boolean") {
    throw new Error(`${label}.${key} must be a boolean.`);
  }
}

function validatePublicImages(images, label) {
  if (!Array.isArray(images)) {
    throw new Error(`${label}.images must be an array of public image path strings.`);
  }
  for (const [index, image] of images.entries()) {
    if (typeof image !== "string" || image.trim() === "") {
      throw new Error(`${label}.images[${index}] must be a non-empty public image path.`);
    }
    let pathname = image;
    if (/^[a-z][a-z\d+.-]*:/i.test(image)) {
      let parsed;
      try {
        parsed = new URL(image);
      } catch {
        throw new Error(`${label}.images[${index}] must be a valid public image URL.`);
      }
      if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
        throw new Error(`${label}.images[${index}] must use a public HTTPS URL.`);
      }
      pathname = parsed.pathname;
    }
    const pathSegments = pathname.split(/[\\/]+/).map((segment) => segment.toLowerCase());
    if (pathSegments.some((segment) => (
      ["private", "identity", "passport", "id-card", "documents", "verification", "kyc"].includes(segment)
    ))) {
      throw new Error(`${label}.images[${index}] appears to reference a private document path.`);
    }
  }
}

function validateCategory(category, label) {
  if (!isRecord(category)) throw new Error(`${label} must be an object.`);
  if (!OBJECT_ID_PATTERN.test(String(category._id || ""))) {
    throw new Error(`${label}._id must be a valid 24-character ObjectId.`);
  }
  requireString(category.slug, `${label}.slug`);
  if (category.slug.includes("/") || category.slug.includes("\\")) {
    throw new Error(`${label}.slug must be a single URL path segment.`);
  }
  requireString(category.name, `${label}.name`);
  requireString(category.description ?? "", `${label}.description`, { allowEmpty: true });
  if (category.image != null && typeof category.image !== "string") {
    throw new Error(`${label}.image must be a string or null.`);
  }
  if (category.image != null) validatePublicImages([category.image], label);
  if (!Array.isArray(category.children)) {
    throw new Error(`${label}.children must be an array.`);
  }
  for (const [index, child] of category.children.entries()) {
    validateCategory(child, `${label}.children[${index}]`);
  }
}

function validateAd(ad, label, { now, requireIndexable }) {
  if (!isRecord(ad)) throw new Error(`${label} must be an object.`);
  if (!OBJECT_ID_PATTERN.test(String(ad._id || ""))) {
    throw new Error(`${label}._id must be a valid 24-character ObjectId.`);
  }
  requireString(ad.slug, `${label}.slug`);
  if (ad.slug.includes("/") || ad.slug.includes("\\")) {
    throw new Error(`${label}.slug must be a single URL path segment.`);
  }
  requireString(ad.title, `${label}.title`);
  requireString(ad.description ?? "", `${label}.description`, { allowEmpty: true });
  requireString(ad.status, `${label}.status`);
  for (const key of ["isDeleted", "isVisible", "isArchived"]) {
    requireBoolean(ad, key, label);
  }
  if (typeof ad.sold !== "boolean" && typeof ad.isSold !== "boolean") {
    throw new Error(`${label} must include a boolean sold or isSold field.`);
  }
  const expiresAt = Date.parse(ad.expiresAt);
  if (typeof ad.expiresAt !== "string" || !Number.isFinite(expiresAt)) {
    throw new Error(`${label}.expiresAt must be a valid date string.`);
  }
  if (ad.adType !== "sell" && ad.adType !== "order") {
    throw new Error(`${label}.adType must be "sell" or "order".`);
  }
  if (typeof ad.price !== "number" || !Number.isFinite(ad.price) || ad.price < 0) {
    throw new Error(`${label}.price must be a finite non-negative number.`);
  }
  requireString(ad.currency, `${label}.currency`);
  if (typeof ad.priceOnContact !== "boolean") {
    throw new Error(`${label}.priceOnContact must be a boolean.`);
  }
  validatePublicImages(ad.images, label);
  if (ad.isAvailable != null && typeof ad.isAvailable !== "boolean") {
    throw new Error(`${label}.isAvailable must be a boolean when supplied.`);
  }
  if (ad.inventoryEnabled != null && typeof ad.inventoryEnabled !== "boolean") {
    throw new Error(`${label}.inventoryEnabled must be a boolean when supplied.`);
  }
  if (ad.stockQuantity != null &&
      (typeof ad.stockQuantity !== "number" || !Number.isFinite(ad.stockQuantity) || ad.stockQuantity < 0)) {
    throw new Error(`${label}.stockQuantity must be a finite non-negative number when supplied.`);
  }
  if (!isRecord(ad.categoryId) ||
      !OBJECT_ID_PATTERN.test(String(ad.categoryId._id || "")) ||
      typeof ad.categoryId.slug !== "string" ||
      typeof ad.categoryId.name !== "string") {
    throw new Error(`${label}.categoryId must include a valid _id, slug, and name.`);
  }
  for (const locationKey of ["governorateId", "cityId"]) {
    const location = ad[locationKey];
    if (location != null && (!isRecord(location) || typeof location.name !== "string")) {
      throw new Error(`${label}.${locationKey} must be a public { name } object or null.`);
    }
  }

  if (requireIndexable && !isPublicAdIndexable(ad, now)) {
    throw new Error(`${label} is not eligible for public indexing.`);
  }
}

function snapshotContext({ snapshot, now, maxAgeMs }) {
  const exportedAt = snapshot?.metadata?.exportedAt ?? "<missing>";
  const currentDate = new Date(now).toISOString();
  const maximumAge = maxAgeMs == null ? "not configured" : `${maxAgeMs} ms`;
  return { exportedAt, currentDate, maximumAge };
}

function failSnapshot(reason, context) {
  throw new Error(
    `Prerender snapshot validation failed: ${reason}; ` +
    `exportedAt=${context.exportedAt}; currentDate=${context.currentDate}; ` +
    `maximumAge=${context.maximumAge}.`
  );
}

export function validatePrerenderSnapshot(snapshot, {
  now = Date.now(),
  maxAgeMs = null,
  expectedSiteBaseUrl
} = {}) {
  const context = snapshotContext({ snapshot, now, maxAgeMs });

  try {
    if (!isRecord(snapshot)) throw new Error("root value must be an object.");
    if (!isRecord(snapshot.metadata)) throw new Error("metadata must be an object.");
    requireString(snapshot.metadata.source, "metadata.source");
    requireString(snapshot.metadata.sourceDatabase, "metadata.sourceDatabase");
    if (snapshot.metadata.schemaVersion !== PRERENDER_SNAPSHOT_SCHEMA_VERSION) {
      throw new Error(
        `unsupported schemaVersion ${String(snapshot.metadata.schemaVersion)}; ` +
        `expected ${PRERENDER_SNAPSHOT_SCHEMA_VERSION}.`
      );
    }

    const exportedAt = Date.parse(snapshot.metadata.exportedAt);
    if (typeof snapshot.metadata.exportedAt !== "string" || !Number.isFinite(exportedAt)) {
      throw new Error("metadata.exportedAt must be a valid date string.");
    }
    if (exportedAt > now) throw new Error("metadata.exportedAt cannot be in the future.");
    if (maxAgeMs != null) {
      if (!Number.isFinite(maxAgeMs) || maxAgeMs < 0) {
        throw new Error("maximum snapshot age must be a non-negative number of milliseconds.");
      }
      const age = now - exportedAt;
      if (age > maxAgeMs) {
        throw new Error(`snapshot age ${age} ms exceeds configured maximum ${maxAgeMs} ms.`);
      }
    }
    if (snapshot.metadata.siteBaseUrl != null) {
      const snapshotSiteBase = resolveSiteBaseUrl(snapshot.metadata.siteBaseUrl);
      if (expectedSiteBaseUrl &&
          snapshotSiteBase !== resolveSiteBaseUrl(expectedSiteBaseUrl)) {
        throw new Error("metadata.siteBaseUrl does not match the configured public site URL.");
      }
    }

    if (!Array.isArray(snapshot.categories) || snapshot.categories.length === 0) {
      throw new Error("categories must be a non-empty array.");
    }
    if (!Array.isArray(snapshot.ads)) {
      throw new Error("ads must be an array.");
    }
    if (!isRecord(snapshot.categorySsgDataBySlug)) {
      throw new Error("categorySsgDataBySlug must be an object.");
    }

    const categorySlugs = new Set();
    const categoryIds = new Set();
    for (const [index, category] of snapshot.categories.entries()) {
      validateCategory(category, `categories[${index}]`);
      if (categorySlugs.has(category.slug)) {
        throw new Error(`duplicate public category slug "${category.slug}".`);
      }
      if (categoryIds.has(category._id.toLowerCase())) {
        throw new Error(`duplicate public category id "${category._id}".`);
      }
      categorySlugs.add(category.slug);
      categoryIds.add(category._id.toLowerCase());
      const ssg = snapshot.categorySsgDataBySlug[category.slug];
      if (!isRecord(ssg) || !isRecord(ssg.category) ||
          ssg.category.slug !== category.slug ||
          String(ssg.category._id).toLowerCase() !== category._id.toLowerCase() ||
          !Array.isArray(ssg.breadcrumbs) ||
          !Array.isArray(ssg.subcategories) ||
          !Array.isArray(ssg.ads)) {
        throw new Error(`categorySsgDataBySlug["${category.slug}"] is incomplete or mismatched.`);
      }
      validateCategory(ssg.category, `categorySsgDataBySlug["${category.slug}"].category`);
      for (const [crumbIndex, breadcrumb] of ssg.breadcrumbs.entries()) {
        if (!isRecord(breadcrumb) || typeof breadcrumb.name !== "string" ||
            typeof breadcrumb.slug !== "string") {
          throw new Error(
            `categorySsgDataBySlug["${category.slug}"].breadcrumbs[${crumbIndex}] is incomplete.`
          );
        }
      }
      for (const [subcategoryIndex, subcategory] of ssg.subcategories.entries()) {
        validateCategory(
          subcategory,
          `categorySsgDataBySlug["${category.slug}"].subcategories[${subcategoryIndex}]`
        );
      }
      for (const [adIndex, ad] of ssg.ads.entries()) {
        validateAd(ad, `categorySsgDataBySlug["${category.slug}"].ads[${adIndex}]`, {
          now,
          requireIndexable: true
        });
        if (
          ad.categoryId.slug !== category.slug ||
          ad.categoryId._id.toLowerCase() !== category._id.toLowerCase()
        ) {
          throw new Error(
            `categorySsgDataBySlug["${category.slug}"].ads[${adIndex}] references a different category.`
          );
        }
      }
    }
    const ssgCategorySlugs = Object.keys(snapshot.categorySsgDataBySlug);
    if (ssgCategorySlugs.length !== categorySlugs.size ||
        ssgCategorySlugs.some((slug) => !categorySlugs.has(slug))) {
      throw new Error("categorySsgDataBySlug must contain exactly the public category slugs.");
    }

    const adIds = new Set();
    for (const [index, ad] of snapshot.ads.entries()) {
      validateAd(ad, `ads[${index}]`, { now, requireIndexable: true });
      if (adIds.has(ad._id)) throw new Error(`duplicate public ad id "${ad._id}".`);
      adIds.add(ad._id);
      const category = snapshot.categories.find((item) => item.slug === ad.categoryId.slug);
      if (!category || category._id.toLowerCase() !== ad.categoryId._id.toLowerCase()) {
        throw new Error(`ads[${index}].categoryId has no matching public category.`);
      }
    }

    const sensitiveField = findSensitiveField(snapshot);
    if (sensitiveField) {
      throw new Error(`sensitive field "${sensitiveField}" is not allowed in a public snapshot.`);
    }

    return snapshot;
  } catch (error) {
    failSnapshot(error.message, context);
  }
}

export async function loadPrerenderSnapshot(snapshotPath, options = {}) {
  if (typeof snapshotPath !== "string" || snapshotPath.trim() === "") {
    throw new Error("SEO_PRERENDER_SNAPSHOT_PATH must identify a local snapshot file.");
  }

  const resolvedPath = path.resolve(snapshotPath);
  let source;
  try {
    source = await fs.readFile(resolvedPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`Prerender snapshot does not exist: ${resolvedPath}.`);
    }
    throw error;
  }

  let snapshot;
  try {
    snapshot = JSON.parse(source);
  } catch (error) {
    throw new Error(`Prerender snapshot is not valid JSON at ${resolvedPath}: ${error.message}`);
  }

  return validatePrerenderSnapshot(snapshot, options);
}
