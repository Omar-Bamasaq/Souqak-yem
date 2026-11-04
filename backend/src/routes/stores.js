import { Router } from "express";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import StoreProfile from "../models/StoreProfile.js";
import StoreSubscription from "../models/StoreSubscription.js";
import StoreAnalyticsDaily from "../models/StoreAnalyticsDaily.js";
import StorePwaInstall from "../models/StorePwaInstall.js";
import StoreNotificationSubscription from "../models/StoreNotificationSubscription.js";
import StoreFollow from "../models/StoreFollow.js";
import Plan from "../models/Plan.js";
import PurchaseRequest from "../models/PurchaseRequest.js";
import Category from "../models/Category.js";
import Ad from "../models/Ad.js";
import Order from "../models/Order.js";
import ListingService from "../services/listingService.js";
import User from "../models/User.js";
import { createAdminNotification, createNotification, getStoreNotificationContext } from "../services/notificationService.js";
import { getFinalPrice } from "../utils/planUtils.js";
import { uploadReceipt, uploadImages, processImage } from "../middleware/upload.js";
import { validateSelectedCategories, validateStoreSubmission, validateStoreCustomization, validateStoreEmail, sanitizeStoreText, validateStoreSlug, getStorePlanSnapshot, validateStoreLocation, validateCoordinates } from "../utils/storeValidation.js";
import { hasStoreFeature, planSupportsStoreFeature } from "../utils/storeFeatureUtils.js";
import {
  STORE_ADVANCED_DEFAULTS,
  normalizeStoreAdvancedCustomization
} from "../utils/storeAdvancedCustomization.js";
import { getStoreProductPricing, isValidStoreDiscount } from "../utils/storeProductPricing.js";
import { getPublicStoreProfileIds } from "../utils/storePublicVisibility.js";
import { findDraftActionResult, getIncompleteDraftForSubmission, markDraftCompleted } from "../services/draftActions.js";
import {
  getFamilyProductionActivity,
  getStoreActivity,
  listFamilyProductionActivities,
  listStoreActivities,
  resolveStoreActivity
} from "../utils/storeActivityRegistry.js";
import City from "../models/City.js";
import fs from "node:fs/promises";
import path from "path";
import sharp from "sharp";

const router = Router();

function normalizeContactEntries(value, fallbackType = "mobile") {
  const rawItems = Array.isArray(value) ? value : (() => {
    if (value === undefined || value === null || value === "") return [];
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return value
          .split(/[;,]/)
          .map((entry) => entry.trim())
          .filter(Boolean);
      }
    }
    return [value];
  })();

  const entries = [];
  for (const item of rawItems) {
    if (typeof item === "string") {
      const text = String(item).trim();
      if (!text) continue;
      entries.push({ type: fallbackType, value: text });
      continue;
    }
    if (item && typeof item === "object") {
      const nextValue = String(item.value ?? item.phone ?? item.number ?? "").trim();
      if (!nextValue) continue;
      entries.push({
        type: item.type === "phone" ? "phone" : (fallbackType === "whatsapp" ? "whatsapp" : "mobile"),
        value: nextValue
      });
    }
  }

  return entries.slice(0, 5);
}

const STORE_SOCIAL_PLATFORMS = ["facebook", "instagram", "tiktok", "youtube", "whatsappChannel"];
const STORE_BANK_CURRENCIES = ["YER", "SAR", "USD"];

function normalizeStoreBankAccounts(value, existingAccounts = []) {
  let accounts = value;
  if (typeof accounts === "string") {
    try {
      accounts = JSON.parse(accounts);
    } catch {
      return { error: "قائمة الحسابات البنكية غير صالحة." };
    }
  }
  if (!Array.isArray(accounts)) return { error: "قائمة الحسابات البنكية يجب أن تكون مصفوفة." };

  const knownAccounts = new Map((existingAccounts || []).map((account) => [String(account._id), account]));
  const seenIds = new Set();
  const normalizedAccounts = [];
  const allowedKeys = new Set(["_id", "bankName", "accountHolderName", "accountNumber", "currency"]);

  for (const account of accounts) {
    if (!account || typeof account !== "object" || Array.isArray(account)) {
      return { error: "بيانات الحساب البنكي غير صالحة." };
    }
    if (Object.keys(account).some((key) => !allowedKeys.has(key))) {
      return { error: "تحتوي بيانات الحساب البنكي على حقول غير مسموحة." };
    }

    const bankName = sanitizeStoreText(account.bankName, { maxLength: 120, allowEmpty: false });
    const accountHolderName = sanitizeStoreText(account.accountHolderName, { maxLength: 120, allowEmpty: false });
    const accountNumber = sanitizeStoreText(account.accountNumber, { maxLength: 80, allowEmpty: false });
    if (!bankName || !accountHolderName || !accountNumber) {
      return { error: "اسم البنك واسم صاحب الحساب ورقم الحساب حقول مطلوبة." };
    }
    if (!STORE_BANK_CURRENCIES.includes(account.currency)) {
      return { error: "عملة الحساب يجب أن تكون YER أو SAR أو USD." };
    }

    let accountId;
    if (account._id !== undefined && account._id !== null && account._id !== "") {
      const requestedId = String(account._id);
      if (!mongoose.isValidObjectId(requestedId) || !knownAccounts.has(requestedId) || seenIds.has(requestedId)) {
        return { error: "معرّف الحساب البنكي غير صالح." };
      }
      accountId = knownAccounts.get(requestedId)._id;
      seenIds.add(requestedId);
    } else {
      accountId = new mongoose.Types.ObjectId();
    }

    normalizedAccounts.push({
      _id: accountId,
      bankName,
      accountHolderName,
      accountNumber,
      currency: account.currency
    });
  }

  return { bankAccounts: normalizedAccounts };
}

function normalizeStoreSocialLinks(value) {
  let links = value;
  if (typeof links === "string") {
    try {
      links = JSON.parse(links);
    } catch {
      return { error: "روابط التواصل الاجتماعي غير صالحة." };
    }
  }
  if (!links || typeof links !== "object" || Array.isArray(links)) {
    return { error: "روابط التواصل الاجتماعي غير صالحة." };
  }
  const unknownPlatforms = Object.keys(links).filter((platform) => !STORE_SOCIAL_PLATFORMS.includes(platform));
  if (unknownPlatforms.length) return { error: "منصة تواصل اجتماعي غير مدعومة." };

  const social = {};
  for (const platform of STORE_SOCIAL_PLATFORMS) {
    const value = sanitizeStoreText(links[platform], { maxLength: 300, allowEmpty: true });
    if (!value) {
      social[platform] = "";
      continue;
    }
    try {
      const url = new URL(value);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("Unsupported protocol");
      if (platform === "whatsappChannel" && (
        url.protocol !== "https:" ||
        !["whatsapp.com", "www.whatsapp.com", "chat.whatsapp.com", "wa.me"].includes(url.hostname.toLowerCase())
      )) {
        return { error: "رابط قناة أو مجموعة WhatsApp يجب أن يكون رابط WhatsApp صالحًا." };
      }
      social[platform] = url.toString();
    } catch {
      return { error: `رابط ${platform} يجب أن يبدأ بـ https:// أو http://.` };
    }
  }
  return { social };
}

function escapeSvgText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function createStorePwaFallbackSvg(storeName, size) {
  const initial = escapeSvgText(Array.from(String(storeName || "متجر").trim())[0] || "م");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#0f766e"/><path d="M96 210 132 112h248l36 98v42H96z" fill="#ecfdf5"/><path d="M96 210h320v46a32 32 0 0 1-32 32 32 32 0 0 1-32-32 32 32 0 0 1-32 32 32 32 0 0 1-32-32 32 32 0 0 1-32 32 32 32 0 0 1-32-32 32 32 0 0 1-32 32 32 32 0 0 1-32-32 32 32 0 0 1-32 32 32 32 0 0 1-32-32z" fill="#5eead4"/><path d="M128 288h256v128H128z" fill="#fff"/><path d="M166 324h76v92h-76zM270 324h76v64h-76z" fill="#99f6e4"/><text x="256" y="490" text-anchor="middle" font-family="sans-serif" font-size="48" font-weight="700" fill="#fff">${initial}</text></svg>`;
}

router.get("/:slug/pwa-icon/:size.png", async (req, res) => {
  try {
    const size = Number(req.params.size);
    if (![192, 512].includes(size)) return res.status(404).json({ error: "Store icon not found" });

    const slug = String(req.params.slug || "").trim().toLowerCase();
    const store = await StoreProfile.findOne({ slug, status: "active" }).select("_id storeName slug logo status").lean();
    if (!store) return res.status(404).json({ error: "Store icon not found" });

    const subscription = await StoreSubscription.findOne({ storeId: store._id })
      .sort({ createdAt: -1 })
      .populate("planId", "type features")
      .lean();
    if (!hasStoreFeature({ status: store.status, subscription }, "pwa")) {
      return res.status(404).json({ error: "Store icon not found" });
    }

    let iconSource;
    if (store.logo) {
      const uploadsRoot = path.resolve(process.cwd(), "uploads");
      const logoPath = path.resolve(process.cwd(), store.logo);
      if (logoPath.startsWith(`${uploadsRoot}${path.sep}`)) {
        try {
          iconSource = await fs.readFile(logoPath);
        } catch {}
      }
    }
    if (!iconSource) iconSource = Buffer.from(createStorePwaFallbackSvg(store.storeName, size));

    const icon = await sharp(iconSource)
      .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toBuffer();

    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "public, max-age=300");
    return res.send(icon);
  } catch (error) {
    console.error("Store PWA icon error:", error);
    return res.status(500).json({ error: "Unable to generate store icon" });
  }
});

function normalizePrimaryColor(input) {
  const value = String(input || "").trim();
  if (!value) return "#0b89ed";
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) return null;
  if (value.length === 4) return `#${[...value.slice(1)].map((digit) => digit + digit).join("")}`;
  return value;
}

function getSafeAdvancedCustomization(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return normalizeStoreAdvancedCustomization({}, {}).value;
  }
  const normalized = normalizeStoreAdvancedCustomization({
    theme: value.theme,
    primaryColor: value.primaryColor,
    secondaryColor: value.secondaryColor,
    pageBackgroundColor: value.pageBackgroundColor,
    storeInfoBackgroundColor: value.storeInfoBackgroundColor,
    sectionBackgroundColor: value.sectionBackgroundColor,
    productCardBackgroundColor: value.productCardBackgroundColor,
    hero: {
      title: value.hero?.title,
      text: value.hero?.text,
      buttonLabel: value.hero?.buttonLabel,
      buttonTarget: value.hero?.buttonTarget
    },
    story: { text: value.story?.text },
    featuredProductIds: Array.isArray(value.featuredProductIds) ? value.featuredProductIds.map(String) : [],
    sectionOrder: value.sectionOrder,
    hiddenSections: value.hiddenSections
  }, STORE_ADVANCED_DEFAULTS);
  if (!normalized.value) return normalizeStoreAdvancedCustomization({}, {}).value;
  normalized.value.hero.image = typeof value.hero?.image === "string" ? value.hero.image : null;
  normalized.value.story.images = Array.isArray(value.story?.images)
    ? value.story.images.filter((image) => typeof image === "string").slice(0, 3)
    : [];
  return normalized.value;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ensureOwner(req, userId) {
  return String(req.user.id) === String(userId);
}

function getStoreTypeFromRequest(req) {
  const requestedType = String(req.query?.storeType || req.body?.storeType || "store");
  return ["store", "family-production"].includes(requestedType) ? requestedType : null;
}

function getAnalyticsDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Aden",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function getDateKeyOffset(dateKey, offset) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + offset));
  return date.toISOString().slice(0, 10);
}

function getAnalyticsRange(range, now = new Date()) {
  const days = range === "1d" ? 1 : range === "7d" ? 7 : 30;
  const todayKey = getAnalyticsDateKey(now);
  const startKey = getDateKeyOffset(todayKey, 1 - days);
  return {
    days,
    startKey,
    endKey: todayKey,
    startDate: new Date(`${startKey}T00:00:00+03:00`),
    endDate: now
  };
}

async function getAnalyticsSubscription(store) {
  return StoreSubscription.findOne({ storeId: store._id })
    .sort({ createdAt: -1 })
    .populate("planId", "type features")
    .lean();
}

function analyticsFeatureEnabled(store, subscription) {
  return hasStoreFeature({ status: store.status, subscription }, "analytics");
}

async function incrementStoreAnalyticsView({ storeProfileId, type, adId = null, dateKey = getAnalyticsDateKey() }) {
  const filter = { storeProfileId, dateKey, type, adId };
  await StoreAnalyticsDaily.updateOne(
    filter,
    { $inc: { views: 1 }, $setOnInsert: filter },
    { upsert: true }
  );
}

function ownerStoreFilter(userId, storeType) {
  const filter = { userId };
  if (storeType === "family-production") {
    filter.storeType = "family-production";
  } else {
    filter.$or = [{ storeType: "store" }, { storeType: { $exists: false } }];
  }
  return filter;
}

router.get("/activities", (req, res) => {
  if (req.query.type === "family-production") return res.json(listFamilyProductionActivities());
  return res.json(listStoreActivities());
});

router.get("/directory", async (req, res) => {
  try {
    const storeType = String(req.query.storeType || "");
    const view = String(req.query.view || "stores");
    const activityKey = String(req.query.activityKey || "").trim();
    const governorateId = String(req.query.governorateId || "").trim();
    const cityId = String(req.query.cityId || "").trim();
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(24, Math.max(1, Number.parseInt(req.query.limit, 10) || 12));
    if (!["store", "family-production"].includes(storeType) || !["stores", "discounts"].includes(view)) {
      return res.status(400).json({ error: "Invalid store directory request" });
    }
    if (activityKey && !(storeType === "family-production"
      ? getFamilyProductionActivity(activityKey)
      : getStoreActivity(activityKey))) {
      return res.status(400).json({ error: "Invalid store activity filter" });
    }
    if ((governorateId && !mongoose.isValidObjectId(governorateId))
      || (cityId && !mongoose.isValidObjectId(cityId))) {
      return res.status(400).json({ error: "Invalid location filter" });
    }
    if (cityId && governorateId) {
      const city = await City.findById(cityId).select("governorateId").lean();
      if (city && String(city.governorateId) !== governorateId) {
        return res.status(400).json({ error: "Selected city does not belong to the selected governorate" });
      }
    }

    const publicStoreIds = await getPublicStoreProfileIds();
    const storeFilter = {
      _id: { $in: publicStoreIds },
      status: "active",
      ...(activityKey ? { activityKey } : {}),
      ...(view === "stores" && governorateId ? { governorateId } : {}),
      ...(view === "stores" && cityId ? { cityId } : {}),
      ...(storeType === "store"
        ? { $or: [{ storeType: "store" }, { storeType: { $exists: false } }] }
        : { storeType })
    };

    if (view === "stores") {
      const [stores, total] = await Promise.all([
        StoreProfile.find(storeFilter)
          .select("storeName slug storeType businessActivity description logo cover location governorateId cityId")
          .populate("governorateId", "name")
          .populate("cityId", "name")
          .sort({ approvedAt: -1, createdAt: -1, _id: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        StoreProfile.countDocuments(storeFilter)
      ]);

      return res.json({
        items: stores.map((store) => ({
          _id: store._id,
          storeName: store.storeName,
          slug: store.slug,
          storeType: store.storeType,
          businessActivity: store.businessActivity,
          description: store.description,
          logo: store.logo,
          cover: store.cover,
          location: store.governorateId?.name && (store.cityId?.name || store.location)
            ? `${store.governorateId.name} - ${store.cityId?.name || store.location}`
            : store.location || ""
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total
        }
      });
    }

    const eligibleStores = await StoreProfile.find(storeFilter).select("_id status").lean();
    if (!eligibleStores.length) {
      return res.json({ items: [], pagination: { page, limit, total: 0, totalPages: 0, hasNextPage: false } });
    }

    const subscriptions = await StoreSubscription.find({
      storeId: { $in: eligibleStores.map((store) => store._id) }
    })
      .sort({ createdAt: -1, _id: -1 })
      .populate("planId", "type features")
      .lean();
    const latestSubscriptionByStore = new Map();
    for (const subscription of subscriptions) {
      const storeId = String(subscription.storeId);
      if (!latestSubscriptionByStore.has(storeId)) latestSubscriptionByStore.set(storeId, subscription);
    }
    const discountEnabledStoreIds = eligibleStores
      .filter((store) => hasStoreFeature({
        status: store.status,
        subscription: latestSubscriptionByStore.get(String(store._id))
      }, "discounts"))
      .map((store) => store._id);

    if (!discountEnabledStoreIds.length) {
      return res.json({ items: [], pagination: { page, limit, total: 0, totalPages: 0, hasNextPage: false } });
    }

    const discountFilter = {
      storeProfileId: { $in: discountEnabledStoreIds },
      status: "approved",
      adType: "sell",
      expiresAt: { $gt: new Date() },
      isVisible: { $ne: false },
      isArchived: { $ne: true },
      sold: { $ne: true },
      isAvailable: { $ne: false },
      isDeleted: { $ne: true },
      discountEnabled: true,
      price: { $gt: 0 },
      ...(governorateId ? { governorateId } : {}),
      ...(cityId ? { cityId } : {}),
      $or: [
        { discountType: { $in: ["percentage", null] }, discountValue: { $gt: 0, $lte: 99 } },
        { discountType: "fixed", discountValue: { $gt: 0 }, $expr: { $lte: ["$discountValue", "$price"] } }
      ]
    };
    const [ads, total] = await Promise.all([
      Ad.find(discountFilter)
        .select("_id title description price currency images discountEnabled discountType discountValue storeProfileId governorateId cityId createdAt publishedAt expiresAt")
        .populate("storeProfileId", "storeName slug logo storeType")
        .populate("governorateId", "name")
        .populate("cityId", "name")
        .sort({ publishedAt: -1, createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Ad.countDocuments(discountFilter)
    ]);

    const items = ads.flatMap((ad) => {
      const pricing = getStoreProductPricing(ad);
      if (!pricing.discountEnabled || !isValidStoreDiscount(pricing.originalPrice, pricing.discountType, pricing.discountValue)) return [];
      return [{
        ...ad,
        discountEnabled: true,
        discountType: pricing.discountType,
        discountValue: pricing.discountValue,
        originalPrice: pricing.originalPrice,
        unitPrice: pricing.unitPrice,
        location: ad.governorateId?.name
          ? `${ad.governorateId.name}${ad.cityId?.name ? ` - ${ad.cityId.name}` : ""}`
          : ""
      }];
    });

    return res.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total
      }
    });
  } catch (error) {
    console.error("Public store directory error:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/me", auth, async (req, res) => {
  try {
    const storeType = getStoreTypeFromRequest(req);
    if (!storeType) return res.status(400).json({ error: "Invalid store type" });
    const store = await StoreProfile.findOne(ownerStoreFilter(req.user.id, storeType))
      .select("+notificationEmail +bankAccounts")
      .populate("selectedCategories", "name slug")
      .lean();

    if (!store) return res.json(null);

    const subscription = await StoreSubscription.findOne({ storeId: store._id })
      .populate("planId", "name type durationInDays price currency features limits")
      .sort({ createdAt: -1 })
      .lean();

    const pendingRenewal = await PurchaseRequest.findOne({
      user: req.user.id,
      storeProfile: store._id,
      status: "Pending"
    }).sort({ createdAt: -1 }).lean();

    const subscriptionStatus = StoreSubscription.getStoreSubscriptionStatus(subscription);
    const effectiveStatus = store.status === "active" && subscriptionStatus !== "active" ? "inactive" : store.status;
    const { bankAccounts, advancedCustomization: storedAdvancedCustomization, ...ownerStore } = store;
    const mayReadBankAccounts = store.status === "active"
      && subscriptionStatus === "active"
      && hasStoreFeature({ status: store.status, subscription }, "customization");
    const mayReadAdvancedCustomization = store.status === "active"
      && subscriptionStatus === "active"
      && hasStoreFeature({ status: store.status, subscription }, "customization")
      && hasStoreFeature({ status: store.status, subscription }, "advancedCustomization");

    res.json({
      ...ownerStore,
      ...(mayReadBankAccounts ? { bankAccounts: bankAccounts || [] } : {}),
      advancedCustomizationEnabled: mayReadAdvancedCustomization,
      ...(mayReadAdvancedCustomization ? { advancedCustomization: getSafeAdvancedCustomization(storedAdvancedCustomization) } : {}),
      activity: resolveStoreActivity(store),
      effectiveStatus,
      subscriptionStatus,
      isSubscriptionActive: subscriptionStatus === "active",
      pendingRenewal,
      subscription: subscription ? {
        ...subscription,
        plan: subscription.planId || null,
        planId: subscription.planId?._id || subscription.planId || null
      } : null
    });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/owner/analytics", auth, requireRole(["user", "seller", "buyer"]), async (req, res) => {
  try {
    const storeType = getStoreTypeFromRequest(req);
    if (!storeType) return res.status(400).json({ error: "Invalid store type" });
    const store = await StoreProfile.findOne(ownerStoreFilter(req.user.id, storeType)).lean();
    if (!store || store.status !== "active") {
      return res.status(403).json({ error: "تحليلات المتجر غير متاحة للمتجر غير النشط." });
    }

    const subscription = await getAnalyticsSubscription(store);
    if (!analyticsFeatureEnabled(store, subscription)) {
      return res.status(403).json({ error: "إحصائيات المتجر غير مفعّلة أو انتهى الاشتراك." });
    }

    const requestedRange = String(req.query.range || "7d");
    if (!["1d", "7d", "30d"].includes(requestedRange)) {
      return res.status(400).json({ error: "الفترة الزمنية غير صالحة." });
    }
    const range = getAnalyticsRange(requestedRange);
    const dateFilter = {
      storeProfileId: store._id,
      dateKey: { $gte: range.startKey, $lte: range.endKey }
    };
    const [viewTotals, dailyTotals, topProducts, productsCount, orderTotals, followers] = await Promise.all([
      StoreAnalyticsDaily.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$type", views: { $sum: "$views" } } }
      ]),
      StoreAnalyticsDaily.aggregate([
        { $match: dateFilter },
        { $group: { _id: { dateKey: "$dateKey", type: "$type" }, views: { $sum: "$views" } } }
      ]),
      StoreAnalyticsDaily.aggregate([
        { $match: { ...dateFilter, type: "product_view", adId: { $ne: null } } },
        { $group: { _id: "$adId", views: { $sum: "$views" } } },
        { $sort: { views: -1 } },
        { $limit: 5 }
      ]),
      Ad.countDocuments({ storeProfileId: store._id, isDeleted: { $ne: true } }),
      Order.aggregate([
        {
          $match: {
            orderType: "store",
            storeProfileId: store._id,
            isDeleted: { $ne: true },
            createdAt: { $gte: range.startDate, $lte: range.endDate }
          }
        },
        {
          $group: {
            _id: "$currency",
            count: { $sum: 1 },
            newOrders: { $sum: { $cond: [{ $eq: ["$status", "new"] }, 1, 0] } },
            completedOrders: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
            totalValue: { $sum: { $ifNull: ["$total", { $ifNull: ["$totalAmount", "$amount"] }] } }
          }
        }
      ]),
      StoreFollow.countDocuments({ storeProfileId: store._id })
    ]);
    const pwaInstallations = hasStoreFeature({ status: store.status, subscription }, "pwa")
      ? await StorePwaInstall.countDocuments({ storeProfileId: store._id })
      : 0;

    const topProductIds = topProducts.map((item) => item._id).filter(Boolean);
    const productRows = topProductIds.length
      ? await Ad.find({ _id: { $in: topProductIds }, storeProfileId: store._id }).select("_id title").lean()
      : [];
    const productById = new Map(productRows.map((product) => [String(product._id), product]));
    const viewsByType = new Map(viewTotals.map((item) => [item._id, item.views]));
    const dailyByKey = new Map(dailyTotals.map((item) => [
      `${item._id.dateKey}:${item._id.type}`,
      item.views
    ]));
    const dailyViews = Array.from({ length: range.days }, (_, index) => {
      const dateKey = getDateKeyOffset(range.startKey, index);
      const storeViews = dailyByKey.get(`${dateKey}:store_view`) || 0;
      const productViews = dailyByKey.get(`${dateKey}:product_view`) || 0;
      return { date: dateKey, storeViews, productViews, views: storeViews + productViews };
    });

    return res.json({
      range: requestedRange,
      storeViews: viewsByType.get("store_view") || 0,
      productViews: viewsByType.get("product_view") || 0,
      productsCount,
      followers,
      pwaInstallations,
      orders: {
        total: orderTotals.reduce((sum, item) => sum + item.count, 0),
        new: orderTotals.reduce((sum, item) => sum + item.newOrders, 0),
        completed: orderTotals.reduce((sum, item) => sum + item.completedOrders, 0),
        totalValueByCurrency: orderTotals.map(({ _id, totalValue }) => ({ currency: _id, total: totalValue }))
      },
      dailyViews,
      topProducts: topProducts.flatMap((item) => {
        const product = productById.get(String(item._id));
        return product ? [{ productId: product._id, title: product.title, views: item.views }] : [];
      })
    });
  } catch (error) {
    console.error("Store owner analytics error:", error);
    return res.status(500).json({ error: "تعذر تحميل إحصائيات المتجر." });
  }
});

router.get("/:storeId/notifications/subscription", auth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.storeId)) {
      return res.status(400).json({ error: "معرّف المتجر غير صالح." });
    }
    const context = await getStoreNotificationContext(req.params.storeId);
    if (!context) return res.status(403).json({ error: "إشعارات المتجر غير مفعّلة أو انتهى الاشتراك." });
    const subscriptions = await StoreNotificationSubscription.find({
      userId: req.user.id,
      storeProfileId: context.store._id
    }).select("enabled orderNotifications messageNotifications marketingNotifications").lean();
    const active = subscriptions.find((subscription) => subscription.enabled) || null;
    return res.json({
      enabled: Boolean(active),
      orderNotifications: active?.orderNotifications ?? true,
      messageNotifications: active?.messageNotifications ?? true,
      marketingNotifications: active?.marketingNotifications ?? true
    });
  } catch (error) {
    console.error("Store notification subscription lookup error:", error);
    return res.status(500).json({ error: "تعذر تحميل إعدادات إشعارات المتجر." });
  }
});

router.put(
  "/:storeId/notifications/subscription",
  auth,
  rateLimit({
    windowMs: 60_000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false
  }),
  async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.storeId)) {
      return res.status(400).json({ error: "معرّف المتجر غير صالح." });
    }
    const context = await getStoreNotificationContext(req.params.storeId);
    if (!context) return res.status(403).json({ error: "إشعارات المتجر غير مفعّلة أو انتهى الاشتراك." });

    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ error: "بيانات اشتراك الإشعارات غير صالحة." });
    }
    const subscription = req.body?.subscription;
    const endpoint = subscription?.endpoint;
    const keys = subscription?.keys;
    if (subscription !== undefined && subscription !== null) {
      if (typeof endpoint !== "string" || endpoint.length > 2048) {
        return res.status(400).json({ error: "رابط اشتراك الإشعارات غير صالح." });
      }
      let endpointProtocol = "";
      try {
        const parsedEndpoint = new URL(endpoint);
        endpointProtocol = parsedEndpoint.protocol;
        const host = parsedEndpoint.hostname.toLowerCase();
        const supportedPushHost = host === "fcm.googleapis.com"
          || host === "web.push.apple.com"
          || host === "push.services.mozilla.com"
          || host.endsWith(".push.services.mozilla.com")
          || host.endsWith(".notify.windows.com");
        if (!supportedPushHost || parsedEndpoint.port || parsedEndpoint.username || parsedEndpoint.password) {
          return res.status(400).json({ error: "مزوّد إشعارات المتصفح غير مدعوم." });
        }
      } catch {
        return res.status(400).json({ error: "رابط اشتراك الإشعارات غير صالح." });
      }
      if (endpointProtocol !== "https:"
        || typeof keys?.p256dh !== "string" || keys.p256dh.length > 256 || !keys.p256dh
        || typeof keys?.auth !== "string" || keys.auth.length > 128 || !keys.auth) {
        return res.status(400).json({ error: "بيانات اشتراك الإشعارات غير صالحة." });
      }
    }
    const preferences = ["orderNotifications", "messageNotifications", "marketingNotifications"];
    if (preferences.some((key) => req.body[key] !== undefined && typeof req.body[key] !== "boolean")) {
      return res.status(400).json({ error: "إعدادات الإشعارات يجب أن تكون قيمًا منطقية." });
    }
    if (Object.keys(req.body || {}).some((key) => !["subscription", ...preferences].includes(key))) {
      return res.status(400).json({ error: "هناك حقول غير مسموح بها." });
    }

    const currentPreferences = await StoreNotificationSubscription.findOne({
      userId: req.user.id,
      storeProfileId: context.store._id,
      enabled: true
    }).select("orderNotifications messageNotifications marketingNotifications").lean();
    const filter = endpoint
      ? { userId: req.user.id, storeProfileId: context.store._id, endpoint }
      : { userId: req.user.id, storeProfileId: context.store._id, endpoint: { $exists: false } };
    const enabledSubscription = await StoreNotificationSubscription.findOneAndUpdate(
      filter,
      {
        $set: {
          ...(endpoint ? { keys } : {}),
          enabled: true,
          orderNotifications: req.body.orderNotifications ?? currentPreferences?.orderNotifications ?? true,
          messageNotifications: req.body.messageNotifications ?? currentPreferences?.messageNotifications ?? true,
          marketingNotifications: req.body.marketingNotifications ?? currentPreferences?.marketingNotifications ?? true
        },
        $setOnInsert: { userId: req.user.id, storeProfileId: context.store._id, ...(endpoint ? { endpoint } : {}) }
      },
      { upsert: true, new: true, runValidators: true }
    ).select("enabled orderNotifications messageNotifications marketingNotifications").lean();
    return res.json(enabledSubscription);
  } catch (error) {
    console.error("Store notification subscription update error:", error);
    return res.status(500).json({ error: "تعذر تفعيل إشعارات المتجر." });
  }
  }
);

router.patch("/:storeId/notifications/subscription", auth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.storeId)) {
      return res.status(400).json({ error: "معرّف المتجر غير صالح." });
    }
    const context = await getStoreNotificationContext(req.params.storeId);
    if (!context) return res.status(403).json({ error: "إشعارات المتجر غير مفعّلة أو انتهى الاشتراك." });
    const allowedKeys = ["orderNotifications", "messageNotifications", "marketingNotifications"];
    const keys = Object.keys(req.body || {});
    if (!keys.length || keys.some((key) => !allowedKeys.includes(key) || typeof req.body[key] !== "boolean")) {
      return res.status(400).json({ error: "إعدادات الإشعارات غير صالحة." });
    }
    const filter = { userId: req.user.id, storeProfileId: context.store._id, enabled: true };
    const updateResult = await StoreNotificationSubscription.updateMany(filter, { $set: req.body });
    if (!updateResult.matchedCount) return res.status(404).json({ error: "اشتراك إشعارات هذا المتجر غير موجود." });
    const updated = await StoreNotificationSubscription.findOne(filter)
      .select("enabled orderNotifications messageNotifications marketingNotifications").lean();
    if (!updated) return res.status(404).json({ error: "اشتراك إشعارات هذا المتجر غير موجود." });
    return res.json(updated);
  } catch (error) {
    console.error("Store notification preferences update error:", error);
    return res.status(500).json({ error: "تعذر تحديث تفضيلات إشعارات المتجر." });
  }
});

router.delete("/:storeId/notifications/subscription", auth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.storeId)) {
      return res.status(400).json({ error: "معرّف المتجر غير صالح." });
    }
    await StoreNotificationSubscription.updateMany(
      { userId: req.user.id, storeProfileId: req.params.storeId, enabled: true },
      { $set: { enabled: false } }
    );
    return res.json({ ok: true });
  } catch (error) {
    console.error("Store notification unsubscribe error:", error);
    return res.status(500).json({ error: "تعذر إلغاء اشتراك إشعارات المتجر." });
  }
});

router.post(
  "/:storeId/pwa-installs",
  rateLimit({
    windowMs: 60_000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "تم تجاوز عدد طلبات تسجيل التثبيت؛ حاول لاحقًا." }
  }),
  async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.storeId)) {
        return res.status(400).json({ error: "معرّف المتجر غير صالح." });
      }
      const installationId = req.body?.installationId;
      if (typeof installationId !== "string"
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(installationId)) {
        return res.status(400).json({ error: "معرّف التثبيت غير صالح." });
      }

      const store = await StoreProfile.findOne({ _id: req.params.storeId, status: "active" }).lean();
      if (!store) return res.status(404).json({ error: "المتجر غير متاح." });
      const subscription = await getAnalyticsSubscription(store);
      if (!analyticsFeatureEnabled(store, subscription)
        || !hasStoreFeature({ status: store.status, subscription }, "pwa")) {
        return res.status(403).json({ error: "تطبيق المتجر أو التحليلات غير مفعّلة أو انتهى الاشتراك." });
      }

      try {
        await StorePwaInstall.updateOne(
          { storeProfileId: store._id, installationId },
          { $setOnInsert: { storeProfileId: store._id, installationId } },
          { upsert: true }
        );
      } catch (error) {
        if (error?.code !== 11000) throw error;
      }
      return res.status(202).json({ counted: true });
    } catch (error) {
      console.error("Store PWA install tracking error:", error);
      return res.status(500).json({ error: "تعذر تسجيل تثبيت تطبيق المتجر." });
    }
  }
);

router.post(
  "/:storeId/analytics/views",
  rateLimit({
    windowMs: 60_000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "تم تجاوز عدد طلبات تسجيل المشاهدات؛ حاول لاحقًا." }
  }),
  async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.storeId)) {
      return res.status(400).json({ error: "معرّف المتجر غير صالح." });
    }
    const productId = req.body?.productId;
    if (productId !== undefined && !mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ error: "معرّف المنتج غير صالح." });
    }

    const store = await StoreProfile.findOne({ _id: req.params.storeId, status: "active" }).lean();
    if (!store) return res.status(404).json({ error: "المتجر غير متاح." });
    const subscription = await getAnalyticsSubscription(store);
    if (!analyticsFeatureEnabled(store, subscription)) {
      return res.status(403).json({ error: "تحليلات المتجر غير مفعّلة أو انتهى الاشتراك." });
    }

    if (productId) {
      const productExists = await Ad.exists({
        _id: productId,
        storeProfileId: store._id,
        status: "approved",
        isVisible: { $ne: false },
        isArchived: { $ne: true },
        isDeleted: { $ne: true },
        sold: { $ne: true },
        expiresAt: { $gt: new Date() }
        }
      );
      if (!productExists) return res.status(404).json({ error: "المنتج غير متاح." });
    }

    await incrementStoreAnalyticsView({
      storeProfileId: store._id,
      type: productId ? "product_view" : "store_view",
      adId: productId || null
    });
    return res.status(202).json({ counted: true });
  } catch (error) {
    console.error("Store view tracking error:", error);
    return res.status(500).json({ error: "تعذر تسجيل المشاهدة." });
  }
});

router.post("/renew", auth, uploadReceipt, async (req, res) => {
  try {
    const storeType = getStoreTypeFromRequest(req);
    if (!storeType) return res.status(400).json({ error: "Invalid store type" });
    const store = await StoreProfile.findOne(ownerStoreFilter(req.user.id, storeType)).lean();
    if (!store) return res.status(404).json({ error: "Store not found" });

    const currentSubscription = await StoreSubscription.findOne({ storeId: store._id }).sort({ createdAt: -1 }).lean();
    if (!currentSubscription) {
      return res.status(400).json({ error: "No active or expired store subscription exists to renew" });
    }

    const currentStatus = StoreSubscription.getStoreSubscriptionStatus(currentSubscription);
    if (!["active", "expired"].includes(currentStatus)) {
      return res.status(400).json({ error: "Store subscription is not eligible for renewal" });
    }

    const selectedPlanId = String(req.body?.planId || "").trim();
    if (!mongoose.isValidObjectId(selectedPlanId)) {
      return res.status(400).json({ error: "اختر باقة صالحة للتجديد." });
    }
    const selectedPlan = await Plan.findById(selectedPlanId).lean();
    const expectedPlanType = store.storeType === "family-production" ? "family-production" : "store";
    if (!selectedPlan || !selectedPlan.isActive || selectedPlan.type !== expectedPlanType) {
      return res.status(400).json({ error: "الباقة المحددة غير متاحة لهذا النوع من المتاجر." });
    }
    if (Number(selectedPlan.price || 0) <= 0) {
      return res.status(400).json({ error: "الباقة المجانية متاحة عند إنشاء المتجر فقط. اختر باقة مدفوعة للتجديد." });
    }

    const existingPending = await PurchaseRequest.findOne({
      user: req.user.id,
      storeProfile: store._id,
      status: "Pending"
    }).sort({ createdAt: -1 }).lean();

    if (existingPending) {
      return res.status(409).json({ error: "There is already a pending renewal request for this store", request: existingPending });
    }

    const pricing = getFinalPrice(selectedPlan);
    const receiptFiles = req.files || [];
    const paymentReceipt = receiptFiles[0] ? await processImage(receiptFiles[0].path, "receipts") : null;
    if (pricing.finalPrice > 0 && !paymentReceipt) {
      return res.status(400).json({ error: "Bank receipt is required for renewal" });
    }

    const snapshot = {
      price: pricing.finalPrice,
      originalPrice: pricing.originalPrice,
      currency: selectedPlan.currency || "YER_ADEN",
      duration: Number(selectedPlan.durationInDays || 0)
    };

    const renewalRequest = await PurchaseRequest.create({
      user: req.user.id,
      plan: selectedPlan._id,
      storeProfile: store._id,
      storeName: store.storeName,
      businessActivity: store.businessActivity,
      status: "Pending",
      price: snapshot.price,
      originalPrice: snapshot.originalPrice,
      currency: snapshot.currency,
      duration: snapshot.duration,
      ...(paymentReceipt ? { paymentReceipt: `receipts/${path.basename(paymentReceipt)}` } : {})
    });

    await createAdminNotification(req.app, {
      type: "store_subscription",
      title: "طلب تجديد اشتراك متجر جديد",
      message: `طلب ${store.storeType === "family-production" ? "تجديد صناعات سوقك" : "تجديد متجر"} من ${req.user.name || "مستخدم"}`,
      link: "/admin/store-requests",
      data: { requestId: renewalRequest._id, storeId: store._id, storeType: store.storeType, renewal: true }
    });

    res.status(201).json({ store, request: renewalRequest, pendingRenewal: renewalRequest });
  } catch (error) {
    console.error("Store renewal create error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/slug-availability/:slug", auth, async (req, res) => {
  try {
    const storeType = String(req.query.storeType || "store");
    if (!["store", "family-production"].includes(storeType)) {
      return res.status(400).json({ error: "Invalid store type" });
    }
    const validation = validateStoreSlug(req.params.slug);
    if (!validation.valid) return res.json({ available: false, error: validation.message });
    const ownerStore = await StoreProfile.findOne(ownerStoreFilter(req.user.id, storeType)).select("_id slug").lean();
    const existing = await StoreProfile.exists({
      slug: validation.slug,
      ...(ownerStore?._id ? { _id: { $ne: ownerStore._id } } : {})
    });
    return res.json({ available: !existing });
  } catch (error) {
    console.error("Store slug availability error:", error);
    return res.status(500).json({ error: "تعذر التحقق من توفر النطاق." });
  }
});

router.get("/:slug", async (req, res) => {
  try {
    const slug = String(req.params.slug || "").trim().toLowerCase();
    if (!slug || slug.length > 120 || !/^[a-z0-9\u0600-\u06FF-]+$/.test(slug)) {
      return res.status(404).json({ error: "Store not found" });
    }

    const store = await StoreProfile.findOne({ slug, status: "active" })
      .select("storeName slug storeType activityKey description businessActivity logo cover location selectedCategories status phone email social userId deliveryAvailable")
      .populate("selectedCategories", "name slug")
      .lean();
    if (!store) return res.status(404).json({ error: "Store not found" });

    const storeDetails = await StoreProfile.findById(store._id)
      .select("governorateId cityId customCityName lat lng phones whatsapp primaryColor advancedCustomization userId")
      .populate("governorateId", "name")
      .populate("cityId", "name")
      .lean();

    const storeWithDetails = { ...store, ...(storeDetails || {}) };

    const subscription = await StoreSubscription.findOne({ storeId: store._id })
      .sort({ createdAt: -1 })
      .populate("planId", "name type durationInDays price currency features")
      .lean();
    const subscriptionStatus = StoreSubscription.getStoreSubscriptionStatus(subscription);
    if (subscriptionStatus !== "active") {
      return res.status(404).json({ error: "Store not found" });
    }

    const productView = String(req.query.view || "products");
    if (!["products", "discounts"].includes(productView)) {
      return res.status(400).json({ error: "Invalid store product view" });
    }
    const discountsEnabled = hasStoreFeature({ status: store.status, subscription }, "discounts");
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 24);
    const searchQuery = String(req.query.q || "").trim().slice(0, 100);
    const categoryId = String(req.query.categoryId || "").trim();
    if (categoryId && !/^[a-f\d]{24}$/i.test(categoryId)) {
      return res.status(400).json({ error: "Invalid store category" });
    }
    const storeListingScopes = [{ storeProfileId: store._id }];
    const filter = {
      $or: storeListingScopes,
      status: "approved",
      expiresAt: { $gt: new Date() },
      isVisible: { $ne: false },
      isArchived: { $ne: true },
      sold: { $ne: true },
      isDeleted: { $ne: true }
    };
    if (searchQuery) {
      const searchRegex = new RegExp(escapeRegExp(searchQuery), "i");
      filter.$and = [
        { $or: storeListingScopes },
        { $or: [{ title: searchRegex }, { description: searchRegex }] }
      ];
      delete filter.$or;
    }
    if (categoryId) filter.categoryId = categoryId;
    if (productView === "discounts") {
      filter.storeProfileId = store._id;
      filter.discountEnabled = true;
      filter.adType = "sell";
      filter.price = { $gt: 0 };
      if (!discountsEnabled) {
        filter._id = { $in: [] };
      } else {
        filter.$and = [
          ...(filter.$and || []),
          {
            $or: [
              { discountType: "percentage", discountValue: { $gt: 0, $lte: 99 } },
              {
                discountType: "fixed",
                $expr: { $and: [{ $gt: ["$discountValue", 0] }, { $lte: ["$discountValue", "$price"] }] }
              },
              { discountType: { $exists: false }, discountValue: { $gt: 0, $lte: 99 } }
            ]
          }
        ];
      }
    }
    const [ads, total] = await Promise.all([
      Ad.find(filter)
        .select("_id title description price currency priceOnContact images condition isAvailable isAvailableForDelivery inventoryEnabled stockQuantity discountEnabled discountType discountValue adType categoryId governorateId cityId storeProfileId featured isWelcomePromoted createdAt publishedAt expiresAt")
        .populate("categoryId", "name slug parentId")
        .populate("governorateId", "name")
        .populate("cityId", "name")
        .populate("storeProfileId", "storeName slug logo businessActivity storeType deliveryAvailable")
        .sort(productView === "discounts"
          ? { publishedAt: -1, createdAt: -1, _id: -1 }
          : { featured: -1, publishedAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Ad.countDocuments(filter)
    ]);
    const listingAttributesById = await ListingService.getListingAttributesForListings(ads.map((ad) => ad._id));

    const { userId, phone, email, ...publicStore } = store;
    publicStore.activity = resolveStoreActivity(store);
    const customizationEnabled = hasStoreFeature({ status: store.status, subscription }, "customization");
    const advancedCustomizationEnabled = customizationEnabled
      && hasStoreFeature({ status: store.status, subscription }, "advancedCustomization");
    const supportsMultipleContacts = hasStoreFeature({ status: store.status, subscription }, "multipleContacts");
    const allContactPhones = Array.isArray(storeWithDetails.phones) ? storeWithDetails.phones.filter((item) => item?.value).map((item) => ({ ...item, value: String(item.value).trim() })) : [];
    const allWhatsappEntries = Array.isArray(storeWithDetails.whatsapp) ? storeWithDetails.whatsapp.filter((item) => item?.value).map((item) => ({ ...item, value: String(item.value).trim() })) : [];
    const contactPhones = supportsMultipleContacts ? allContactPhones : allContactPhones.slice(0, 1);
    const whatsappEntries = supportsMultipleContacts ? allWhatsappEntries : allWhatsappEntries.slice(0, 1);
    const primaryPhone = (contactPhones[0]?.value || phone || "").trim();
    const primaryWhatsApp = (whatsappEntries[0]?.value || "").trim();
    const storeLocation = storeWithDetails.governorateId?.name && (storeWithDetails.cityId?.name || storeWithDetails.customCityName)
      ? `${storeWithDetails.governorateId.name} - ${storeWithDetails.cityId?.name || storeWithDetails.customCityName}`
      : (storeWithDetails.location || "");

    publicStore.location = storeLocation || publicStore.location || "";
    const advancedCustomization = advancedCustomizationEnabled
      ? getSafeAdvancedCustomization(storeWithDetails.advancedCustomization)
      : null;
    if (advancedCustomizationEnabled) {
      advancedCustomization.featuredProducts = [];
      publicStore.advancedCustomization = advancedCustomization;
    }
    publicStore.customizationEnabled = customizationEnabled;
    publicStore.advancedCustomizationEnabled = advancedCustomizationEnabled;
    publicStore.primaryColor = advancedCustomizationEnabled
      ? advancedCustomization.primaryColor
      : (normalizePrimaryColor(storeWithDetails.primaryColor) || "#0b89ed");
    publicStore.secondaryColor = advancedCustomizationEnabled ? advancedCustomization.secondaryColor : "#0f172a";
    publicStore.contact = {
      phone: primaryPhone || null,
      phones: contactPhones,
      whatsapp: whatsappEntries,
      primaryWhatsApp: primaryWhatsApp || null,
      email: email || null,
      lat: storeWithDetails.lat ?? null,
      lng: storeWithDetails.lng ?? null,
      mapsUrl: storeWithDetails.lat != null && storeWithDetails.lng != null ? `https://www.google.com/maps?q=${storeWithDetails.lat},${storeWithDetails.lng}` : null
    };

    publicStore.pwaEnabled = hasStoreFeature({ status: store.status, subscription }, "pwa");
    publicStore.cartEnabled = hasStoreFeature({ status: store.status, subscription }, "cart");
    publicStore.ordersEnabled = hasStoreFeature({ status: store.status, subscription }, "orders");
    publicStore.whatsappOrderingEnabled = hasStoreFeature({ status: store.status, subscription }, "whatsappOrdering");
    publicStore.deliveryEnabled = hasStoreFeature({ status: store.status, subscription }, "delivery");
    publicStore.discountsEnabled = discountsEnabled;
    publicStore.inventoryEnabled = hasStoreFeature({ status: store.status, subscription }, "inventory");
    publicStore.analyticsEnabled = hasStoreFeature({ status: store.status, subscription }, "analytics");
    publicStore.notificationsEnabled = hasStoreFeature({ status: store.status, subscription }, "notifications");

    if (advancedCustomizationEnabled && advancedCustomization.featuredProductIds.length) {
      const featuredAds = await Ad.find({
        _id: { $in: advancedCustomization.featuredProductIds },
        storeProfileId: store._id,
        status: "approved",
        expiresAt: { $gt: new Date() },
        isVisible: { $ne: false },
        isArchived: { $ne: true },
        sold: { $ne: true },
        isDeleted: { $ne: true }
      })
        .select("_id title description price currency priceOnContact images condition isAvailable isAvailableForDelivery inventoryEnabled stockQuantity discountEnabled discountType discountValue adType categoryId storeProfileId featured createdAt publishedAt expiresAt")
        .populate("categoryId", "name slug")
        .populate("storeProfileId", "storeName slug logo businessActivity storeType")
        .lean();
      const featuredById = new Map(featuredAds.map((ad) => [String(ad._id), ad]));
      advancedCustomization.featuredProducts = advancedCustomization.featuredProductIds
        .map((id) => featuredById.get(String(id)))
        .filter(Boolean)
        .map((ad) => {
          const pricing = getStoreProductPricing(ad);
          const hasDiscount = publicStore.discountsEnabled && pricing.discountEnabled;
          return {
            ...ad,
            inventoryEnabled: publicStore.inventoryEnabled && ad.inventoryEnabled === true,
            stockQuantity: publicStore.inventoryEnabled && ad.inventoryEnabled === true ? ad.stockQuantity : undefined,
            discountEnabled: hasDiscount,
            discountType: hasDiscount ? pricing.discountType : null,
            discountValue: hasDiscount ? pricing.discountValue : 0,
            originalPrice: pricing.originalPrice,
            unitPrice: hasDiscount ? pricing.unitPrice : pricing.originalPrice
          };
        });
    }

    if (storeWithDetails.governorateId) publicStore.governorate = storeWithDetails.governorateId;
    if (storeWithDetails.cityId) publicStore.city = storeWithDetails.cityId;
    if (storeWithDetails.customCityName) publicStore.customCityName = storeWithDetails.customCityName;
    const publicAds = ads.map((ad) => {
      const pricing = getStoreProductPricing(ad);
      const hasDiscount = publicStore.discountsEnabled && pricing.discountEnabled && Boolean(ad.storeProfileId);
      return {
        ...ad,
        isAvailableForDelivery: publicStore.deliveryEnabled && ad.isAvailableForDelivery === true,
        ...(ad.storeProfileId ? {
          inventoryEnabled: publicStore.inventoryEnabled && ad.inventoryEnabled === true,
          stockQuantity: publicStore.inventoryEnabled && ad.inventoryEnabled === true ? ad.stockQuantity : undefined,
          discountEnabled: hasDiscount,
          discountType: hasDiscount ? pricing.discountType : null,
          discountValue: hasDiscount ? pricing.discountValue : 0,
          originalPrice: pricing.originalPrice,
          unitPrice: hasDiscount ? pricing.unitPrice : pricing.originalPrice
        } : {}),
        attributes: listingAttributesById[String(ad._id)] || [],
        isLegacyStoreListing: !ad.storeProfileId
      };
    });
    res.json({ store: publicStore, ads: publicAds, page, limit, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("Public store GET error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", auth, requireRole(["user", "seller", "buyer"]), uploadReceipt, async (req, res) => {
  try {
    let {
      storeName,
      storeType = "store",
      activityKey,
      description = "",
      selectedCategories = [],
      location = "",
      phone = "",
      email = "",
      notificationEmail = "",
      planId,
      governorateId,
      cityId,
      customCityName,
      lat,
      lng,
      primaryColor,
      phones,
      whatsapp,
      deliveryAvailable
    } = req.body || {};

    const draftType = storeType === "family-production"
      ? "family_production_registration"
      : "store_creation";
    const draftActionId = req.body?.draftActionId;
    if (draftActionId) {
      const existingRequest = await findDraftActionResult(PurchaseRequest, draftActionId, req.user.id);
      if (existingRequest) {
        const existingStore = await StoreProfile.findOne({
          _id: existingRequest.storeProfile,
          userId: req.user.id
        }).lean();
        if (!existingStore) {
          return res.status(500).json({ error: "تعذر استرجاع نتيجة إنشاء المتجر." });
        }
        await markDraftCompleted(
          draftActionId,
          req.user.id,
          draftType,
          existingRequest._id,
          "purchase_request",
          existingStore._id
        );
        return res.status(200).json({ store: existingStore, purchaseRequest: existingRequest });
      }
    }
    const draftResult = await getIncompleteDraftForSubmission(req.body?.draftActionId, req.user.id, draftType);
    if (draftResult.error) return res.status(draftResult.status).json({ error: draftResult.error });
    if (draftResult.draft && String(draftResult.draft.planId || "") !== String(req.body?.planId || "")) {
      return res.status(409).json({ error: "بيانات المسودة لا تطابق الطلب الحالي. يرجى استئناف العملية من جديد." });
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "templateKey")) {
      return res.status(400).json({ error: "templateKey is derived from activityKey" });
    }
    if (!["store", "family-production"].includes(storeType)) {
      return res.status(400).json({ error: "Invalid store type" });
    }
    const notificationEmailValidation = validateStoreEmail(notificationEmail, { required: true });
    if (!notificationEmailValidation.valid) {
      return res.status(400).json({ error: notificationEmailValidation.message });
    }
    notificationEmail = notificationEmailValidation.email;
    const publicEmailValidation = validateStoreEmail(email);
    if (!publicEmailValidation.valid) {
      return res.status(400).json({ error: "صيغة بريد التواصل العام غير صحيحة." });
    }
    email = publicEmailValidation.email;
    if (typeof selectedCategories === "string") {
      try {
        const parsed = JSON.parse(selectedCategories);
        selectedCategories = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        selectedCategories = String(selectedCategories)
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean);
      }
    }

    const existingDraftStore = draftActionId
      ? await StoreProfile.findOne({ draftActionId, userId: req.user.id }).lean()
      : null;
    const existing = existingDraftStore || await StoreProfile.findOne(ownerStoreFilter(req.user.id, storeType)).lean();
    if (existing && existing.status !== "rejected" && !existingDraftStore) {
      return res.status(409).json({ error: "You already have a profile for this service" });
    }
    if (existing?.status === "rejected") {
      storeName = existing.storeName;
      activityKey = existing.activityKey;
    }

    const activity = storeType === "family-production"
      ? getFamilyProductionActivity(activityKey)
      : getStoreActivity(activityKey);
    if (!activity) return res.status(400).json({ error: "A valid activityKey is required" });

    const slugValidation = existing?.status === "rejected"
      ? { valid: true, slug: existing.slug }
      : validateStoreSlug(req.body?.slug);
    if (!slugValidation.valid) return res.status(400).json({ error: slugValidation.message });
    const slugCollision = await StoreProfile.exists({
      slug: slugValidation.slug,
      ...(existing?.status === "rejected" ? { _id: { $ne: existing._id } } : {})
    });
    if (slugCollision) return res.status(409).json({ error: "هذا النطاق مستخدم بالفعل. اختر نطاقًا آخر." });

    const plan = await Plan.findById(planId).lean();
    const expectedPlanType = storeType === "family-production" ? "family-production" : "store";
    if (!plan || !plan.isActive || plan.type !== expectedPlanType) {
      return res.status(400).json({ error: "Invalid or inactive plan for the selected service" });
    }
    const normalizedDeliveryAvailable = deliveryAvailable === true || deliveryAvailable === "true";
    if (normalizedDeliveryAvailable && !planSupportsStoreFeature(plan, "delivery")) {
      return res.status(403).json({ error: "الخطة المحددة لا تشمل ميزة التوصيل." });
    }
    if (primaryColor && !normalizePrimaryColor(primaryColor)) {
      return res.status(400).json({ error: "primaryColor must be a valid hex color" });
    }

    const validation = validateStoreSubmission({
      storeName,
      businessActivity: activity.nameAr,
      selectedCategories,
      plan: { maxCategories: plan.limits?.maxCategories ?? 0 }
    });
    if (!validation.valid) return res.status(400).json({ error: validation.message });

    const cityMap = await City.find({ _id: { $in: Array.isArray(cityId) ? cityId : [cityId].filter(Boolean) } }).select("_id governorateId name").lean();
    const cityLookup = Object.fromEntries(cityMap.map((city) => [String(city._id), city]));
    const locationValidation = validateStoreLocation({ governorateId, cityId, customCityName, cityMap: cityLookup });
    if (!locationValidation.valid) return res.status(400).json({ error: locationValidation.message });

    const categoryIds = Array.isArray(selectedCategories) ? selectedCategories.map((id) => String(id)) : [];
    const categories = await Category.find({ _id: { $in: categoryIds }, status: "active" }).select("_id slug").lean();
    if (categories.length !== categoryIds.length) return res.status(400).json({ error: "One or more selected categories are invalid" });
    if (categories.some((category) => !activity.allowedCategorySlugs.includes(category.slug))) {
      return res.status(400).json({ error: "Selected categories are not allowed for this store activity" });
    }

    const coordinates = validateCoordinates(lat, lng);
    if (!coordinates.valid) return res.status(400).json({ error: coordinates.message });
    const normalizedLat = coordinates.lat;
    const normalizedLng = coordinates.lng;
    const normalizedPhones = normalizeContactEntries(phones ?? phone, "mobile");
    const normalizedWhatsapp = normalizeContactEntries(whatsapp, "whatsapp");
    if (storeType === "family-production") {
      const allContactNumbers = [...normalizedPhones, ...normalizedWhatsapp];
      if (!normalizedPhones.length || !normalizedWhatsapp.length
        || allContactNumbers.some((entry) => !/^\d{9}$/.test(entry.value))) {
        return res.status(400).json({ error: "أدخل رقم هاتف ورقم WhatsApp، ويتكون كل رقم من 9 أرقام." });
      }
    }
    if (storeType !== "family-production" && (normalizedPhones.length > 1 || normalizedWhatsapp.length > 1) && !planSupportsStoreFeature(plan, "multipleContacts")) {
      return res.status(403).json({ error: "خطة المتجر لا تدعم أرقام الاتصال المتعددة." });
    }
    const safePhone = (Array.isArray(normalizedPhones) && normalizedPhones[0]?.value) || String(phone || "").trim();
    const receiptFiles = req.files || [];
    const paymentReceipt = receiptFiles[0] ? await processImage(receiptFiles[0].path, "receipts") : null;
    if (Number(plan.price || 0) > 0 && !paymentReceipt) {
      return res.status(400).json({ error: "Bank receipt is required for paid store plans" });
    }

    let store;
    if (existingDraftStore && existingDraftStore.status !== "rejected") {
      store = await StoreProfile.findByIdAndUpdate(
        existingDraftStore._id,
        { notificationEmail },
        { new: true, runValidators: true }
      ).select("+notificationEmail").lean();
    } else if (existing && existing.status === "rejected") {
      const updatedStore = await StoreProfile.findByIdAndUpdate(existing._id, {
        userId: req.user.id,
        storeType,
        storeName: String(storeName).trim(),
        slug: slugValidation.slug,
        activityKey: activity.activityKey,
        businessActivity: activity.nameAr,
        description: String(description).trim(),
        selectedCategories: categoryIds,
        location: String(location).trim(),
        governorateId: governorateId || null,
        cityId: cityId || null,
        customCityName: customCityName ? String(customCityName).trim() : "",
        lat: normalizedLat,
        lng: normalizedLng,
        phone: safePhone,
        phones: normalizedPhones,
        whatsapp: normalizedWhatsapp,
        email,
        notificationEmail,
        deliveryAvailable: normalizedDeliveryAvailable,
        primaryColor: normalizePrimaryColor(primaryColor),
        status: "pending",
        draftActionId: draftActionId || null,
        rejectedReason: "",
        rejectedAt: null,
        rejectedBy: null,
        approvedAt: null,
        approvedBy: null
      }, { new: true, runValidators: true }).select("+notificationEmail").lean();
      store = updatedStore;
    } else {
      try {
        store = await StoreProfile.create({
          userId: req.user.id,
          ...(draftActionId ? { draftActionId } : {}),
          storeType,
          storeName: String(storeName).trim(),
          slug: slugValidation.slug,
          activityKey: activity.activityKey,
          businessActivity: activity.nameAr,
          description: String(description).trim(),
          selectedCategories: categoryIds,
          location: String(location).trim(),
          governorateId: governorateId || null,
          cityId: cityId || null,
          customCityName: customCityName ? String(customCityName).trim() : "",
          lat: normalizedLat,
          lng: normalizedLng,
          phone: safePhone,
          phones: normalizedPhones,
          whatsapp: normalizedWhatsapp,
          email,
          notificationEmail,
          deliveryAvailable: normalizedDeliveryAvailable,
          primaryColor: normalizePrimaryColor(primaryColor),
          status: "pending"
        });
      } catch (error) {
        if (error.code === 11000 && error.keyPattern?.slug) {
          return res.status(409).json({ error: "هذا النطاق مستخدم بالفعل. اختر نطاقًا آخر." });
        }
        if (draftActionId && error.code === 11000) {
          store = await StoreProfile.findOne({ draftActionId, userId: req.user.id }).lean();
        }
        if (!store) throw error;
      }
    }

    const snapshot = getStorePlanSnapshot(plan);

    const existingPending = await PurchaseRequest.findOne({
      user: req.user.id,
      plan: plan._id,
      status: "Pending",
      storeProfile: store._id
    }).lean();
    if (existingPending?.draftActionId && String(existingPending.draftActionId) === String(draftActionId || "")) {
      await markDraftCompleted(
        draftActionId,
        req.user.id,
        draftType,
        existingPending._id,
        "purchase_request",
        store._id
      );
      return res.status(200).json({ store, purchaseRequest: existingPending });
    }
    if (existingPending) {
      if (!existingDraftStore) await StoreProfile.findByIdAndDelete(store._id);
      return res.status(409).json({ error: "You already have a store request pending review" });
    }

    let purchaseRequest;
    try {
      purchaseRequest = await PurchaseRequest.create({
        user: req.user.id,
        ...(draftActionId ? { draftActionId } : {}),
        plan: plan._id,
        storeProfile: store._id,
        storeName: store.storeName,
        businessActivity: store.businessActivity,
        status: "Pending",
        price: snapshot.price,
        originalPrice: snapshot.price,
        currency: snapshot.currency,
        duration: snapshot.duration,
        paymentReceipt: paymentReceipt ? `receipts/${path.basename(paymentReceipt)}` : undefined
      });
    } catch (error) {
      if (draftActionId && error.code === 11000) {
        purchaseRequest = await findDraftActionResult(PurchaseRequest, draftActionId, req.user.id);
      }
      if (!purchaseRequest) throw error;
      await markDraftCompleted(
        draftActionId,
        req.user.id,
        draftType,
        purchaseRequest._id,
        "purchase_request",
        store._id
      );
      return res.status(200).json({ store, purchaseRequest });
    }

    await markDraftCompleted(
      req.body?.draftActionId,
      req.user.id,
      draftType,
      purchaseRequest._id,
      "purchase_request",
      store._id
    );

    await createNotification(req.app, {
      userId: req.user.id,
      type: "store_subscription",
      title: "تم استلام طلب متجر جديد",
      body: "تم استلام طلب إنشاء المتجر بنجاح وهو قيد المراجعة.",
      data: { requestId: purchaseRequest._id, storeId: store._id, storeType }
    });

    await createAdminNotification(req.app, {
      type: "store_subscription",
      title: "طلب إنشاء متجر جديد",
      message: `طلب ${storeType === "family-production" ? "تسجيل صناعات سوقك" : "إنشاء متجر"} من ${req.user.name || "مستخدم"}`,
      link: "/admin/store-requests",
      data: { requestId: purchaseRequest._id, storeId: store._id, storeType, renewal: false }
    });

    res.status(201).json({ store, purchaseRequest });
  } catch (error) {
    console.error("Store create error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/me", auth, uploadImages.fields([
  { name: "logo", maxCount: 1 },
  { name: "cover", maxCount: 1 },
  { name: "heroImage", maxCount: 1 },
  { name: "storyImages", maxCount: 3 }
]), async (req, res) => {
  try {
    const storeType = getStoreTypeFromRequest(req);
    if (!storeType) return res.status(400).json({ error: "Invalid store type" });
    const store = await StoreProfile.findOne(ownerStoreFilter(req.user.id, storeType))
      .select("+bankAccounts +notificationEmail")
      .lean();
    if (!store) return res.status(404).json({ error: "Store not found" });
    if (!ensureOwner(req, store.userId)) return res.status(403).json({ error: "Ownership required" });

    const body = req.body || {};
    if (typeof body.advancedCustomization === "string") {
      try {
        body.advancedCustomization = JSON.parse(body.advancedCustomization);
      } catch {
        return res.status(400).json({ error: "إعدادات التخصيص المتقدم غير صالحة." });
      }
    }
    if (Object.prototype.hasOwnProperty.call(body, "templateKey")) {
      return res.status(400).json({ error: "templateKey is derived from activityKey" });
    }
    if (typeof body.selectedCategories === "string") {
      try {
        body.selectedCategories = JSON.parse(body.selectedCategories);
      } catch {
        return res.status(400).json({ error: "selectedCategories must be a valid array" });
      }
      if (!Array.isArray(body.selectedCategories)) {
        return res.status(400).json({ error: "selectedCategories must be a valid array" });
      }
    }
    const update = {};
    let submittedBankAccounts = null;
    if (body.bankAccounts !== undefined) {
      const result = normalizeStoreBankAccounts(body.bankAccounts, store.bankAccounts);
      if (result.error) return res.status(400).json({ error: result.error });
      submittedBankAccounts = result.bankAccounts;
    }
    const cityMap = await City.find({ _id: { $in: [body.cityId, store.cityId].filter(Boolean) } }).select("_id governorateId name").lean();
    const cityLookup = Object.fromEntries(cityMap.map((city) => [String(city._id), city]));
    const protectedKeys = ["slug", "storeName", "storeType", "activityKey", "businessActivity", "status", "userId", "approvedAt", "approvedBy", "rejectedAt", "rejectedBy", "rejectedReason", "createdAt", "updatedAt"];
    const forbiddenBodyKeys = Object.keys(body).filter((key) => protectedKeys.includes(key));
    if (forbiddenBodyKeys.length) {
      return res.status(400).json({ error: `Protected fields cannot be changed: ${forbiddenBodyKeys.join(", ")}` });
    }

    const customizationFields = [
      "description", "location",
      "phone", "phones", "whatsapp", "email", "notificationEmail", "governorateId", "cityId",
      "customCityName", "lat", "lng", "primaryColor", "social", "selectedCategories", "bankAccounts"
    ];
    const customizationRequested = customizationFields.some((field) => body[field] !== undefined)
      || Boolean(req.files?.logo?.length || req.files?.cover?.length)
      || body.logo === "remove"
      || body.cover === "remove";
    const advancedCustomizationRequested = body.advancedCustomization !== undefined
      || body.clearHeroImage !== undefined
      || body.clearStoryImages !== undefined
      || Boolean(req.files?.heroImage?.length || req.files?.storyImages?.length);
    let activeSubscription = null;
    if (customizationRequested || advancedCustomizationRequested) {
      activeSubscription = await StoreSubscription.findOne({ storeId: store._id })
        .sort({ createdAt: -1 })
        .populate("planId", "type features")
        .lean();
      if (StoreSubscription.getStoreSubscriptionStatus(activeSubscription) !== "active") {
        return res.status(403).json({ error: "يجب أن يكون اشتراك المتجر نشطًا لتعديل بيانات التخصيص." });
      }
      const customizationEnabled = hasStoreFeature({ status: store.status, subscription: activeSubscription }, "customization");
      if (customizationRequested && !customizationEnabled) {
        return res.status(403).json({ error: "ميزة تخصيص المتجر غير متاحة في باقتك الحالية." });
      }
      if (advancedCustomizationRequested) {
        if (store.status !== "active") {
          return res.status(403).json({ error: "لا يمكن تعديل التخصيص المتقدم لمتجر غير نشط." });
        }
        if (!customizationEnabled
          || !hasStoreFeature({ status: store.status, subscription: activeSubscription }, "advancedCustomization")) {
          return res.status(403).json({ error: "ميزة التخصيص المتقدم غير متاحة في باقتك الحالية." });
        }
      }
    }

    if (advancedCustomizationRequested) {
      const clearHeroImage = body.clearHeroImage === true || body.clearHeroImage === "true";
      const clearStoryImages = body.clearStoryImages === true || body.clearStoryImages === "true";
      if (body.clearHeroImage !== undefined && ![true, false, "true", "false"].includes(body.clearHeroImage)) {
        return res.status(400).json({ error: "قيمة حذف صورة القسم الرئيسي غير صالحة." });
      }
      if (body.clearStoryImages !== undefined && ![true, false, "true", "false"].includes(body.clearStoryImages)) {
        return res.status(400).json({ error: "قيمة حذف صور قصتنا غير صالحة." });
      }

      const currentAdvanced = getSafeAdvancedCustomization(store.advancedCustomization);
      const normalized = normalizeStoreAdvancedCustomization(body.advancedCustomization || {}, currentAdvanced);
      if (normalized.error) return res.status(400).json({ error: normalized.error });
      const nextAdvanced = normalized.value;
      const featuredIds = nextAdvanced.featuredProductIds;
      if (featuredIds.length) {
        const ownedProducts = await Ad.find({
          _id: { $in: featuredIds },
          storeProfileId: store._id,
          isDeleted: { $ne: true }
        }).select("_id").lean();
        if (ownedProducts.length !== featuredIds.length) {
          return res.status(400).json({ error: "يجب اختيار المنتجات التابعة لهذا المتجر فقط." });
        }
      }

      if (clearHeroImage) nextAdvanced.hero.image = null;
      if (clearStoryImages) nextAdvanced.story.images = [];
      if (req.files?.heroImage?.[0]) {
        nextAdvanced.hero.image = path.relative(process.cwd(), req.files.heroImage[0].path).replace(/\\/g, "/");
      }
      if (req.files?.storyImages?.length) {
        nextAdvanced.story.images = req.files.storyImages
          .slice(0, 3)
          .map((file) => path.relative(process.cwd(), file.path).replace(/\\/g, "/"));
      }
      update.advancedCustomization = nextAdvanced;
    }

    if (submittedBankAccounts !== null) update.bankAccounts = submittedBankAccounts;

    if (body.description !== undefined) {
      const safeDescription = sanitizeStoreText(body.description, { maxLength: 1000, allowEmpty: true });
      update.description = safeDescription;
    }
    if (body.location !== undefined) {
      update.location = sanitizeStoreText(body.location, { maxLength: 200, allowEmpty: true });
    }
    if (body.governorateId !== undefined) update.governorateId = body.governorateId || null;
    if (body.cityId !== undefined) update.cityId = body.cityId || null;
    if (body.customCityName !== undefined) update.customCityName = sanitizeStoreText(body.customCityName, { maxLength: 80, allowEmpty: true });
    if (body.lat !== undefined || body.lng !== undefined) {
      const nextLat = body.lat !== undefined ? body.lat : store.lat ?? null;
      const nextLng = body.lng !== undefined ? body.lng : store.lng ?? null;
      const coordinates = validateCoordinates(nextLat, nextLng);
      if (!coordinates.valid) return res.status(400).json({ error: coordinates.message });
      update.lat = coordinates.lat;
      update.lng = coordinates.lng;
    }
    if (body.phone !== undefined) {
      const safePhone = sanitizeStoreText(body.phone, { maxLength: 30, allowEmpty: true });
      if (safePhone && !/^\+?[0-9\s\-()]+$/.test(safePhone)) {
        return res.status(400).json({ error: "phone contains invalid characters" });
      }
      update.phone = safePhone;
    }
    const submittedPhones = body.phones !== undefined ? normalizeContactEntries(body.phones, "mobile") : null;
    const submittedWhatsapp = body.whatsapp !== undefined ? normalizeContactEntries(body.whatsapp, "whatsapp") : null;
    if (store.storeType === "family-production") {
      const effectivePhones = submittedPhones || normalizeContactEntries(store.phones?.length ? store.phones : store.phone, "mobile");
      const effectiveWhatsapp = submittedWhatsapp || normalizeContactEntries(store.whatsapp, "whatsapp");
      if (!effectivePhones.length || !effectiveWhatsapp.length
        || [...effectivePhones, ...effectiveWhatsapp].some((entry) => !/^\d{9}$/.test(entry.value))) {
        return res.status(400).json({ error: "أدخل رقم هاتف ورقم WhatsApp، ويتكون كل رقم من 9 أرقام." });
      }
    }
    if (submittedPhones?.length > 1 || submittedWhatsapp?.length > 1) {
      if (!activeSubscription) {
        activeSubscription = await StoreSubscription.findOne({ storeId: store._id })
          .sort({ createdAt: -1 })
          .populate("planId", "type features")
          .lean();
      }
      if (store.storeType !== "family-production" && !hasStoreFeature({ status: store.status, subscription: activeSubscription }, "multipleContacts")) {
        const storedPhones = normalizeContactEntries(store.phones?.length ? store.phones : store.phone, "mobile");
        const storedWhatsapp = normalizeContactEntries(store.whatsapp, "whatsapp");
        const addsExtraPhone = submittedPhones?.slice(1).some((entry) => !storedPhones.some((stored) => stored.value === entry.value));
        const addsExtraWhatsapp = submittedWhatsapp?.slice(1).some((entry) => !storedWhatsapp.some((stored) => stored.value === entry.value));
        if (addsExtraPhone || addsExtraWhatsapp) {
          return res.status(403).json({ error: "خطة المتجر لا تدعم أرقام الاتصال المتعددة." });
        }
      }
    }
    if (body.phones !== undefined) {
      update.phones = submittedPhones;
      update.phone = submittedPhones[0]?.value || "";
    }
    if (body.whatsapp !== undefined) {
      update.whatsapp = submittedWhatsapp;
    }
    if (body.email !== undefined) {
      const emailValidation = validateStoreEmail(body.email);
      if (!emailValidation.valid) return res.status(400).json({ error: "email is invalid" });
      update.email = emailValidation.email;
    }
    if (body.notificationEmail !== undefined) {
      const emailValidation = validateStoreEmail(body.notificationEmail, { required: true });
      if (!emailValidation.valid) return res.status(400).json({ error: emailValidation.message });
      update.notificationEmail = emailValidation.email;
    }
    if (body.social !== undefined) {
      const result = normalizeStoreSocialLinks(body.social);
      if (result.error) return res.status(400).json({ error: result.error });
      update.social = result.social;
    }
    if (body.primaryColor !== undefined) {
      const nextColor = normalizePrimaryColor(body.primaryColor);
      if (!nextColor) return res.status(400).json({ error: "primaryColor must be a valid hex color" });
      update.primaryColor = nextColor;
    }

    const files = req.files || {};
    if (files.logo && files.logo[0]) {
      const relativeLogo = path.relative(process.cwd(), files.logo[0].path).replace(/\\/g, "/");
      update.logo = relativeLogo;
    } else if (body.logo === "remove") {
      update.logo = null;
    }

    if (files.cover && files.cover[0]) {
      const relativeCover = path.relative(process.cwd(), files.cover[0].path).replace(/\\/g, "/");
      update.cover = relativeCover;
    } else if (body.cover === "remove") {
      update.cover = null;
    }

    const finalLocationValidation = validateStoreLocation({
      governorateId: body.governorateId !== undefined ? body.governorateId : store.governorateId,
      cityId: body.cityId !== undefined ? body.cityId : store.cityId,
      customCityName: body.customCityName !== undefined ? body.customCityName : store.customCityName,
      cityMap: cityLookup
    });
    if (!finalLocationValidation.valid) return res.status(400).json({ error: finalLocationValidation.message });

    if (body.selectedCategories !== undefined) {
      const ids = Array.isArray(body.selectedCategories) ? body.selectedCategories.map((id) => String(id)) : [];
      const categoryCheck = await Category.find({ _id: { $in: ids } }).select("_id slug").lean();
      if (categoryCheck.length !== ids.length) return res.status(400).json({ error: "One or more selected categories are invalid" });
      if (new Set(ids).size !== ids.length) return res.status(400).json({ error: "Duplicate categories are not allowed" });
      const activityForCategories = store.storeType === "family-production"
        ? getFamilyProductionActivity(update.activityKey ?? store.activityKey)
        : getStoreActivity(update.activityKey ?? store.activityKey);
      const previouslySelected = new Set((store.selectedCategories || []).map((id) => String(id)));
      if (activityForCategories && categoryCheck.some((category) => (
        !previouslySelected.has(String(category._id)) && !activityForCategories.allowedCategorySlugs.includes(category.slug)
      ))) {
        return res.status(400).json({ error: "New categories must match the selected store activity" });
      }
      const activeSubscription = await StoreSubscription.findOne({ storeId: store._id, status: "active" }).sort({ createdAt: -1 }).populate("planId").lean();
      const pendingRequest = activeSubscription ? null : await PurchaseRequest.findOne({ storeProfile: store._id, status: "Pending" }).sort({ createdAt: -1 }).populate("plan").lean();
      const storePlan = activeSubscription?.planId || pendingRequest?.plan;
      const categoryLimit = Number(storePlan?.limits?.maxCategories ?? 0);
      const categoryLimitCheck = validateSelectedCategories(ids, categoryLimit);
      if (!categoryLimitCheck.valid) return res.status(400).json({ error: categoryLimitCheck.message });
      update.selectedCategories = ids;
    }

    if (body.deliveryAvailable !== undefined) {
      if (![true, false, "true", "false"].includes(body.deliveryAvailable)) {
        return res.status(400).json({ error: "deliveryAvailable must be a boolean" });
      }
      const nextDeliveryAvailable = body.deliveryAvailable === true || body.deliveryAvailable === "true";
      if (nextDeliveryAvailable && !store.deliveryAvailable) {
        const deliverySubscription = activeSubscription || await StoreSubscription.findOne({ storeId: store._id })
          .sort({ createdAt: -1 })
          .populate("planId", "type features")
          .lean();
        if (!hasStoreFeature({ status: store.status, subscription: deliverySubscription }, "delivery")) {
          return res.status(403).json({ error: "الخطة الحالية لا تشمل ميزة التوصيل." });
        }
      }
      update.deliveryAvailable = nextDeliveryAvailable;
    }

    const validation = validateStoreCustomization({
      storeName: store.storeName,
      businessActivity: update.businessActivity ?? store.businessActivity,
      description: update.description ?? store.description,
      location: update.location ?? store.location,
      phone: update.phone ?? store.phone,
      email: update.email ?? store.email
    });
    if (!validation.valid) return res.status(400).json({ error: validation.message });

    const updated = await StoreProfile.findByIdAndUpdate(store._id, update, { new: true, runValidators: true })
      .select("+bankAccounts +notificationEmail")
      .populate("selectedCategories", "name slug")
      .lean();
    res.json(updated);
  } catch (error) {
    console.error("Store update error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/mine/requests", auth, async (req, res) => {
  try {
    const items = await PurchaseRequest.find({ user: req.user.id }).populate("plan", "name type durationInDays price currency").populate("storeProfile", "storeName status").sort({ createdAt: -1 }).lean();
    res.json(items);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/subscriptions/mine", auth, async (req, res) => {
  try {
    const subs = await StoreSubscription.find({ userId: req.user.id }).populate("planId", "name type durationInDays price currency").populate("storeId", "storeName slug status").sort({ createdAt: -1 }).lean();
    res.json(subs);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/requests/:id", auth, async (req, res) => {
  try {
    const storeRequest = await PurchaseRequest.findById(req.params.id).populate("plan", "name type durationInDays price currency").populate("storeProfile", "storeName businessActivity selectedCategories").lean();
    if (!storeRequest) return res.status(404).json({ error: "Not found" });
    if (String(storeRequest.user) !== String(req.user.id) && req.user.role !== "admin") return res.status(403).json({ error: "Ownership required" });
    res.json(storeRequest);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
