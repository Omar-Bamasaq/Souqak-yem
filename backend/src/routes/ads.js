import { Router } from "express";
import mongoose from "mongoose";
import Ad from "../models/Ad.js";
import SoldListing from "../models/SoldListing.js";
import Category from "../models/Category.js";
import CategoryAttribute from "../models/CategoryAttribute.js";
import ListingAttributeValue from "../models/ListingAttributeValue.js";
import AdComment from "../models/AdComment.js";
import AdReport from "../models/AdReport.js";
import auth from "../middleware/auth.js";
import requirePhoneVerification from "../middleware/requirePhoneVerification.js";
import { requireRole } from "../middleware/roles.js";
import { uploadImages } from "../middleware/upload.js";
import City from "../models/City.js";
import fs from "fs";
import path from "path";
import Notification from "../models/Notification.js";
import {
  createNotification,
  createAdminNotification,
  createStoreNotification,
  STORE_NOTIFICATION_TYPES
} from "../services/notificationService.js";
import User from "../models/User.js";
import rateLimit from "../middleware/rateLimit.js";
import optionalAuth from "../middleware/optionalAuth.js";
import AdView from "../models/AdView.js";
import SystemSettings from "../models/SystemSettings.js";
import Commission from "../models/Commission.js";
import Joi from "joi";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import processImages, { validateProcessedImages } from "../middleware/processImages.js";
import ListingService from "../services/listingService.js";
import SmartSearchService from "../services/smartSearchService.js";
import Favorite from "../models/Favorite.js";
import { logActivity } from "../services/activityLogService.js";
import { protectSensitiveFields } from "../middleware/protectSensitiveFields.js";
import { hasOutstandingCommission } from "../utils/commissionAccess.js";
import { AD_COMMISSION_ENABLED, calculateSellerCommission } from "../config/commission.js";
import { getFrontendBaseUrl } from "../utils/siteUrl.js";
import StoreProfile from "../models/StoreProfile.js";
import StoreSubscription from "../models/StoreSubscription.js";
import { hasStoreFeature } from "../utils/storeFeatureUtils.js";
import { getStoreProductPricing, isValidStoreDiscount } from "../utils/storeProductPricing.js";
import Plan from "../models/Plan.js";
import { getFamilyProductionActivity, getStoreActivity } from "../utils/storeActivityRegistry.js";
import {
  applyPublicStoreFilter,
  getPublicStoreProfileIds,
  isPublicStoreEligible
} from "../utils/storePublicVisibility.js";

const router = Router();
function parseStockQuantity(value) {
  if (typeof value === "string" && !value.trim()) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

// Helper middleware: parse JSON-encoded attributes coming from multipart/form-data
const parseJsonAttributes = (req, _res, next) => {
  if (typeof req.body?.attributes === "string") {
    try {
      const parsed = JSON.parse(req.body.attributes);
      if (Array.isArray(parsed)) {
        req.body.attributes = parsed;
      }
    } catch {
      // Leave as-is; Joi validation will handle invalid format
    }
  }
  next();
};

async function categoryAllowedForStoreActivity(store, categoryId, historicalCategoryId = null) {
  const activity = store.storeType === "family-production"
    ? getFamilyProductionActivity(store.activityKey)
    : getStoreActivity(store.activityKey);
  if (!activity) return false;
  const selectedCategoryIds = (store.selectedCategories || []).map((id) => String(id));
  if (String(historicalCategoryId || "") === String(categoryId)
    && selectedCategoryIds.includes(String(categoryId))) return true;
  const category = await Category.findById(categoryId).select("slug").lean();
  return Boolean(category && activity.allowedCategorySlugs.includes(category.slug));
}

async function applyStorePlanFeatures(ads) {
  const storeIds = [...new Set(ads
    .map((ad) => ad.storeProfileId?._id || ad.storeProfileId)
    .filter(Boolean)
    .map(String))];
  if (!storeIds.length) return ads;

  const subscriptions = await StoreSubscription.find({ storeId: { $in: storeIds } })
    .sort({ createdAt: -1, _id: -1 })
    .populate("planId", "type features")
    .lean();
  const latestSubscriptionByStore = new Map();
  for (const subscription of subscriptions) {
    const storeId = String(subscription.storeId);
    if (!latestSubscriptionByStore.has(storeId)) latestSubscriptionByStore.set(storeId, subscription);
  }

  return ads.map((ad) => {
    if (!ad.storeProfileId) return ad;
    const profile = ad.storeProfileId?.status || ad.storeProfileId?.storeName
      ? ad.storeProfileId
      : { _id: ad.storeProfileId };
    const subscription = latestSubscriptionByStore.get(String(profile._id));
    const deliveryEnabled = hasStoreFeature({
      status: profile.status,
      subscription
    }, "delivery");
    const discountEnabledForPlan = hasStoreFeature({
      status: profile.status,
      subscription
    }, "discounts");
    const inventoryEnabledForPlan = hasStoreFeature({
      status: profile.status,
      subscription
    }, "inventory");
    const whatsappOrderingEnabled = hasStoreFeature({
      status: profile.status,
      subscription
    }, "whatsappOrdering");
    const pricing = getStoreProductPricing(ad);
    const hasDiscount = discountEnabledForPlan && pricing.discountEnabled;
    return {
      ...ad,
      isAvailableForDelivery: deliveryEnabled && ad.isAvailableForDelivery === true,
      discountEnabled: hasDiscount,
      discountType: hasDiscount ? pricing.discountType : null,
      discountValue: hasDiscount ? pricing.discountValue : 0,
      originalPrice: pricing.originalPrice,
      unitPrice: hasDiscount ? pricing.unitPrice : pricing.originalPrice,
      inventoryEnabled: inventoryEnabledForPlan && ad.inventoryEnabled === true,
      stockQuantity: inventoryEnabledForPlan && ad.inventoryEnabled === true ? ad.stockQuantity : undefined,
      storeProfileId: {
        ...profile,
        deliveryEnabled,
        discountsEnabled: discountEnabledForPlan,
        inventoryEnabled: inventoryEnabledForPlan,
        whatsappOrderingEnabled
      }
    };
  });
}

const publicAdsRateLimit = rateLimit({
  windowMs: 60_000,
  max: 30, // 30 searches per minute per IP
  message: "لقد تجاوزت حد البحث المسموح به. يرجى الانتظار قليلاً."
});

const adsSearchQuerySchema = Joi.object({
  q: Joi.string().max(100).allow("").optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  categoryId: Joi.string().length(24).hex().optional(),
  governorateId: Joi.string().length(24).hex().optional(),
  cityId: Joi.string().length(24).hex().optional(),
  cities: Joi.string().optional(),
  minPrice: Joi.number().min(0).optional(),
  maxPrice: Joi.number().min(0).optional(),
  conditions: Joi.string().optional(),
  verifiedOnly: Joi.string().valid("true", "false").optional(),
  featuredOnly: Joi.string().valid("true", "false").optional(),
  lat: Joi.number().optional(),
  lng: Joi.number().optional(),
  radiusKm: Joi.number().optional(),
  sort: Joi.string().valid("new", "old", "cheap", "expensive", "views", "price_asc", "price_desc").optional(),
  adType: Joi.string().valid("sell", "order").optional(),
  currency: Joi.string().valid("YER", "YER_ADEN", "YER_SANAA", "SAR", "USD").optional(),
  isResellEnabled: Joi.string().valid("true", "false").optional(),
  subCategoryId: Joi.string().length(24).hex().optional(),
  userLat: Joi.number().optional(),
  userLng: Joi.number().optional(),
  status: Joi.string().valid("pending", "approved", "rejected", "sold").optional()
}).pattern(/^attr_/, Joi.string().max(200));

router.get("/", 
  publicAdsRateLimit, 
  validateQuery(adsSearchQuerySchema),
  async (req, res) => {
  try {
    let {
      q,
      governorateId,
      cityId,
      cities,
      categoryId,
      minPrice,
      maxPrice,
      conditions,
      verifiedOnly,
      featuredOnly,
      lat,
      lng,
      radiusKm,
      page,
      limit,
      sort,
      adType,
      currency,
      isResellEnabled
    } = req.query;

    // 1. Mandatory Pagination & Limit Enforcement
    page = Math.max(1, parseInt(page) || 1);
    limit = Math.min(50, Math.max(1, parseInt(limit) || 20)); // Max 50 per page

    // 2. Anti-Scraping: Detect high page crawling
    if (page > 100) {
      logSecurityEvent("Suspicious scraping: deep pagination", req, { page });
      return res.status(403).json({ error: "Access denied. Please contact support for bulk data access." });
    }

    let filter = { 
      status: "approved", 
      expiresAt: { $gt: new Date() },
      isArchived: { $ne: true }, 
      sold: { $ne: true },
      isVisible: { $ne: false },
      isDeleted: { $ne: true }
    };
    filter = applyPublicStoreFilter(filter, await getPublicStoreProfileIds());
    if (adType) filter.adType = adType;
    if (currency) filter.currency = currency;
    
    // Strict Marketable Ads Filter
    if (isResellEnabled === "true" || isResellEnabled === true) {
      filter.isResellEnabled = true;
    }

    if (governorateId) filter.governorateId = governorateId;
    if (cityId) filter.cityId = cityId;
    if (categoryId) {
      // Get the category and its children to include subcategory ads
      const Category = (await import("../models/Category.js")).default;
      const category = await Category.findById(categoryId).lean();
      if (category) {
        // Recursive function to get all descendant IDs
        const getAllDescendants = async (parentIds) => {
          const children = await Category.find({ parentId: { $in: parentIds } }).select("_id").lean();
          if (children.length === 0) return [];
          const childIds = children.map(c => c._id);
          const descendants = await getAllDescendants(childIds);
          return [...childIds, ...descendants];
        };

        const descendantIds = await getAllDescendants([categoryId]);
        const allCategoryIds = [String(categoryId), ...descendantIds.map(id => String(id))];
        filter.categoryId = { $in: allCategoryIds.map(id => new mongoose.Types.ObjectId(id)) };
      } else {
        filter.categoryId = new mongoose.Types.ObjectId(categoryId);
      }
    }
    if (cities) {
      const arr = String(cities).split(",").map((s) => s.trim()).filter(Boolean);
      if (arr.length) filter.cityId = { $in: arr };
    }
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    if (q) filter.title = { $regex: q, $options: "i" };
    if (conditions) {
      const condValues = String(conditions).split(",").map((s) => s.trim()).filter(Boolean);
      if (condValues.length) filter.condition = { $in: condValues };
    }
    if (featuredOnly === "true") filter.featured = true;
    const hasGeo = typeof lat !== "undefined" && typeof lng !== "undefined" && typeof radiusKm !== "undefined";
    if (hasGeo) {
      const la = Number(lat);
      const ln = Number(lng);
      const r = Number(radiusKm);
      if (Number.isFinite(la) && Number.isFinite(ln) && Number.isFinite(r) && r > 0) {
        const rad = r / 6378.1;
        filter.location = { $geoWithin: { $centerSphere: [[ln, la], rad] } };
      }
    }

    // Advanced search: filter by dynamic category attributes (attr_<attributeId>=value)
    const attributeQueryEntries = Object.entries(req.query || {}).filter(
      ([key, value]) => key.startsWith("attr_") && typeof value !== "undefined" && String(value).trim() !== ""
    );

    if (attributeQueryEntries.length > 0) {
      const idSets = [];

      for (const [key, rawVal] of attributeQueryEntries) {
        const attributeId = key.slice("attr_".length);
        const values = String(rawVal)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        if (!attributeId || values.length === 0) continue;

        const valueFilter = values.length === 1 ? values[0] : { $in: values };

        const rows = await ListingAttributeValue.find({
          attributeId,
          value: valueFilter
        })
          .select("listingId")
          .lean();

        const ids = rows.map((r) => String(r.listingId));
        idSets.push(new Set(ids));
      }

      if (idSets.length > 0) {
        let common = idSets[0];
        for (let i = 1; i < idSets.length; i++) {
          const next = idSets[i];
          common = new Set([...common].filter((id) => next.has(id)));
          if (!common.size) break;
        }

        // If no listing matches all attribute filters, force an empty result
        if (!common.size) {
          filter._id = { $in: [] };
        } else {
          filter._id = {
            $in: [...common].map((id) => new mongoose.Types.ObjectId(id))
          };
        }
      }
    }
    let sortSpec = { publishedAt: -1, featured: -1, createdAt: -1 };
    if (sort === "price_asc" || sort === "cheap") sortSpec = { featured: -1, price: 1, publishedAt: -1, createdAt: -1 };
    else if (sort === "price_desc" || sort === "expensive") sortSpec = { featured: -1, price: -1, publishedAt: -1, createdAt: -1 };
    else if (sort === "old") sortSpec = { featured: -1, publishedAt: 1, createdAt: 1 };
    else if (sort === "views") sortSpec = { featured: -1, viewCount: -1, publishedAt: -1, createdAt: -1 };
    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    
    // If verifiedOnly, we need to join with User collection
    let baseQuery;
    let countQuery;
    
    if (verifiedOnly === "true") {
      const User = (await import("../models/User.js")).default;
      const verifiedUsers = await User.find({ isVerifiedSeller: true }).select("_id").lean();
      const verifiedUserIds = verifiedUsers.map(u => u._id);
      filter.userId = { $in: verifiedUserIds };
    }
    
    baseQuery = Ad.find(filter)
      .select("_id title price currency priceOnContact images condition isAvailable isAvailableForDelivery inventoryEnabled stockQuantity discountEnabled discountType discountValue adType categoryId governorateId cityId userId storeProfileId featured isWelcomePromoted viewCount views contactsCount createdAt publishedAt expiresAt")
      .populate("governorateId", "name")
      .populate("cityId", "name")
      .populate({
        path: "categoryId",
        select: "name slug parentId",
        populate: {
          path: "parentId",
          select: "name"
        }
      })
      .populate("userId", "name avatar verificationStatus role isVerifiedSeller isTrustedReseller sellerRating resellerRating sellerReviewsCount")
      .populate("storeProfileId", "storeName slug logo businessActivity storeType status")
      .sort(sortSpec)
      .skip((p - 1) * l)
      .limit(l)
      .lean();
    countQuery = Ad.countDocuments(filter);

    const [rawList, total] = await Promise.all([baseQuery, countQuery]);
    const list = await applyStorePlanFeatures(rawList);
    res.json({ items: list, page: p, limit: l, total, pages: Math.ceil(total / l) });
  } catch (error) {
    console.error("Ads GET error:", error);
    res.status(500).json({ error: error.message || "Server error" });
  }
});

router.get("/my", auth, async (req, res) => {
  try {
    const { status, storeProducts } = req.query || {};
    const filter = { userId: req.user.id, isDeleted: { $ne: true } };
    if (storeProducts === "true") {
      const storeType = String(req.query?.storeType || "store");
      if (!["store", "family-production"].includes(storeType)) return res.status(400).json({ error: "Invalid store type" });
      const typeFilter = storeType === "family-production"
        ? { storeType: "family-production" }
        : { $or: [{ storeType: "store" }, { storeType: { $exists: false } }] };
      const store = await StoreProfile.findOne({ userId: req.user.id, ...typeFilter }).select("_id").lean();
      if (!store) return res.json([]);
      filter.storeProfileId = store._id;
    } else {
      filter.storeProfileId = null;
    }
    if (status && ["pending", "approved", "rejected", "sold"].includes(status)) filter.status = status;
    const list = await Ad.find(filter)
      .populate("governorateId", "name")
      .populate("cityId", "name")
      .sort({ createdAt: -1 })
      .lean();
    const forty = 40 * 24 * 60 * 60 * 1000;
    const enriched = list.map((a) => {
      const publishedAt = a.publishedAt || a.createdAt || null;
      const expiresAt = a.expiresAt || (publishedAt ? new Date(new Date(publishedAt).getTime() + forty) : null);
      return { ...a, publishedAt, expiresAt };
    });
    res.json(enriched);
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

// Smart Search API Endpoint
router.get("/smart-search", 
  optionalAuth, 
  validateQuery(adsSearchQuerySchema),
  async (req, res) => {
  try {
    const {
      q,
      categoryId,
      subCategoryId,
      governorateId,
      cityId,
      minPrice,
      maxPrice,
      conditions,
      verifiedOnly,
      featuredOnly,
      userLat,
      userLng,
      sort,
      adType,
      isResellEnabled,
      page,
      limit
    } = req.query;

    const userId = req.user?.id || null;

    const result = await SmartSearchService.search({
      query: q,
      categoryId,
      subCategoryId,
      governorateId,
      cityId,
      minPrice,
      maxPrice,
      conditions,
      verifiedOnly,
      featuredOnly,
      userLat: userLat ? parseFloat(userLat) : null,
      userLng: userLng ? parseFloat(userLng) : null,
      userId,
      adType,
      isResellEnabled,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      sort: sort || "new"
    });

    if (q) {
      SmartSearchService.trackSearch(userId, q).catch(console.error);
    }

    if (Array.isArray(result.items)) result.items = await applyStorePlanFeatures(result.items);
    res.json(result);
  } catch (error) {
    console.error("Smart search error:", error);
    res.status(500).json({ error: "Search failed", message: error.message });
  }
});

// Get search suggestions (autocomplete)
router.get("/search-suggestions", async (req, res) => {
  try {
    const { q, limit = 5 } = req.query;

    if (!q || q.length < 2) {
      return res.json({ suggestions: [], corrections: [], synonyms: [] });
    }

    const suggestions = await SmartSearchService.getSuggestions(q, parseInt(limit, 10));

    res.json(suggestions);
  } catch (error) {
    console.error("Search suggestions error:", error);
    res.status(500).json({ error: "Failed to get suggestions" });
  }
});

router.get("/:id/owner", auth, requireRole(["seller", "user"]), async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id)
      .populate("governorateId", "name")
      .populate("cityId", "name")
      .lean();
    if (!ad) return res.status(404).json({ error: "Not found" });
    if (String(ad.userId) !== String(req.user.id) && req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    const values = await ListingService.getListingAttributes(ad._id, {
      categoryId: ad.categoryId,
      strictCategory: Boolean(ad.storeProfileId),
    });
    res.json({ ...ad, attributes: values });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.patch(
  "/:id",
  auth,
  requireRole(["seller", "user"]),
  protectSensitiveFields,
  uploadImages.array("images", 10),
  processImages(),
  validateProcessedImages,
  validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })),
  parseJsonAttributes,
  validateBody(
    Joi.object({
      title: Joi.string().trim().min(3).max(120).optional(),
      description: Joi.string().allow("").max(2000).optional(),
      price: Joi.number().min(0).optional(),
      currency: Joi.string().valid("YER", "YER_ADEN", "YER_SANAA", "SAR", "USD").optional(),
      storeProduct: Joi.boolean().optional(),
      isAvailable: Joi.boolean().optional(),
      isAvailableForDelivery: Joi.boolean().optional(),
      inventoryEnabled: Joi.boolean().optional(),
      stockQuantity: Joi.number().integer().min(0).optional(),
      discountEnabled: Joi.boolean().optional(),
      discountType: Joi.string().valid("percentage", "fixed").optional(),
      discountValue: Joi.number().greater(0).optional(),
      delivery: Joi.boolean().optional(),
      deliveryAvailable: Joi.boolean().optional(),
      governorateId: Joi.string().length(24).hex().optional(),
      cityId: Joi.string().length(24).hex().optional(),
      categoryId: Joi.string().length(24).hex().optional(),
      lat: Joi.number().optional(),
      lng: Joi.number().optional(),
      tags: Joi.array().items(Joi.string().length(24).hex()).optional(),
      tagNames: Joi.array().items(Joi.string()).optional(),
      condition: Joi.string().valid("new", "used", "like_new").optional(),
      negotiable: Joi.boolean().optional(),
      priceOnContact: Joi.boolean().optional(),
      showPhone: Joi.boolean().optional(),
      phone: Joi.string().optional(),
      showWhatsApp: Joi.boolean().optional(),
      whatsapp: Joi.string().optional(),
      attributes: Joi.array()
        .items(
          Joi.object({
            attributeId: Joi.string().length(24).hex().required(),
            value: Joi.alternatives(Joi.string(), Joi.number(), Joi.boolean()).required()
          })
        )
        .optional()
    })
  ),
  async (req, res) => {
    try {
      const {
        title, description, price, currency, attributes, governorateId, cityId, categoryId, lat, lng, tags, tagNames,
        condition, showPhone, phone, showWhatsApp, whatsapp, negotiable, priceOnContact, storeProduct, isAvailable,
        isAvailableForDelivery, inventoryEnabled, stockQuantity, discountEnabled, discountType, discountValue
      } = req.body || {};
      const hasExplicitAttributes = Object.prototype.hasOwnProperty.call(req.body || {}, "attributes");
      const ad = await Ad.findById(req.params.id);

      if (!ad) return res.status(404).json({ error: "Not found" });
      if (String(ad.userId) !== String(req.user.id) && req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
      const previousCategoryId = String(ad.categoryId || "");
      const previousStatus = ad.status;
      const previousDiscountEnabled = ad.discountEnabled === true;
      const previousStockQuantity = Number(ad.stockQuantity);

      const storeProductMode = Boolean(ad.storeProfileId);
      if (storeProductMode && (Object.prototype.hasOwnProperty.call(req.body || {}, "delivery")
        || Object.prototype.hasOwnProperty.call(req.body || {}, "deliveryAvailable"))) {
        return res.status(400).json({ error: "استخدم isAvailableForDelivery لتحديد التوصيل لكل منتج." });
      }
      const discountFieldsSent = ["discountEnabled", "discountType", "discountValue"]
        .some((field) => Object.prototype.hasOwnProperty.call(req.body || {}, field));
      const discountTypeToValidate = discountType || ad.discountType || "percentage";
      const discountValueToValidate = typeof discountValue === "undefined" ? ad.discountValue : discountValue;
      const inventoryFieldsSent = ["inventoryEnabled", "stockQuantity"]
        .some((field) => Object.prototype.hasOwnProperty.call(req.body || {}, field));
      const activeStore = storeProductMode
        ? await StoreProfile.findOne({ _id: ad.storeProfileId, userId: req.user.id, status: "active" })
          .select("selectedCategories activityKey storeType _id governorateId cityId slug").lean()
        : null;
      if (storeProductMode && (!activeStore || String(ad.storeProfileId) !== String(activeStore._id))) {
        return res.status(403).json({ error: "لا يمكن تعديل منتج متجر غير مرتبط بمتجرك النشط." });
      }
      if (storeProductMode && !activeStore) {
        return res.status(403).json({ error: "يجب أن يكون لديك متجر نشط لتعديل منتج متجر." });
      }
      if (storeProductMode && hasExplicitAttributes) {
        const attributesSubscription = await StoreSubscription.findOne({ storeId: activeStore._id })
          .sort({ createdAt: -1 })
          .lean();
        const attributesPlan = attributesSubscription?.planId
          ? await Plan.findById(attributesSubscription.planId).lean()
          : null;
        if (StoreSubscription.getStoreSubscriptionStatus(attributesSubscription) !== "active"
          || !hasStoreFeature({
            status: activeStore.status,
            subscription: { ...attributesSubscription, planId: attributesPlan }
          }, "dynamicAttributes")) {
          return res.status(403).json({ error: "الخصائص الديناميكية غير مفعّلة أو أن اشتراك المتجر منتهٍ." });
        }
      }
      if (storeProductMode && (isAvailableForDelivery === true || isAvailableForDelivery === "true")) {
        const deliverySubscription = await StoreSubscription.findOne({ storeId: activeStore._id }).sort({ createdAt: -1 }).lean();
        const deliveryPlan = deliverySubscription?.planId
          ? await Plan.findById(deliverySubscription.planId).lean()
          : null;
        if (!hasStoreFeature({
          status: activeStore.status,
          subscription: { ...deliverySubscription, planId: deliveryPlan }
        }, "delivery")) {
          return res.status(403).json({ error: "تفعيل التوصيل لكل منتج يتطلب خطة متجر تشمل ميزة التوصيل." });
        }
      }
      if (storeProductMode && discountFieldsSent) {
        const discountSubscription = await StoreSubscription.findOne({ storeId: activeStore._id }).sort({ createdAt: -1 }).lean();
        const discountPlan = discountSubscription?.planId
          ? await Plan.findById(discountSubscription.planId).lean()
          : null;
        if (StoreSubscription.getStoreSubscriptionStatus(discountSubscription) !== "active"
          || !hasStoreFeature({
            status: activeStore.status,
            subscription: { ...discountSubscription, planId: discountPlan }
          }, "discounts")) {
          return res.status(403).json({ error: "خصومات المنتجات غير مفعّلة في خطة هذا المتجر." });
        }
        const discountRequested = discountEnabled === true || discountEnabled === "true";
        const discountBasePrice = typeof price === "undefined" ? ad.price : price;
        if (discountRequested && !isValidStoreDiscount(discountBasePrice, discountTypeToValidate, discountValueToValidate)) {
          return res.status(400).json({ error: "قيمة الخصم غير صالحة؛ النسبة من 1 إلى 99% أو المبلغ أقل من أو يساوي سعر المنتج." });
        }
      }
      if (storeProductMode && inventoryFieldsSent) {
        const inventorySubscription = await StoreSubscription.findOne({ storeId: activeStore._id }).sort({ createdAt: -1 }).lean();
        const inventoryPlan = inventorySubscription?.planId
          ? await Plan.findById(inventorySubscription.planId).lean()
          : null;
        if (StoreSubscription.getStoreSubscriptionStatus(inventorySubscription) !== "active"
          || !hasStoreFeature({
            status: activeStore.status,
            subscription: { ...inventorySubscription, planId: inventoryPlan }
          }, "inventory")) {
          return res.status(403).json({ error: "إدارة مخزون المنتجات غير مفعّلة في خطة هذا المتجر." });
        }
        const inventoryRequested = inventoryEnabled === true || inventoryEnabled === "true";
        const parsedStockQuantity = typeof stockQuantity === "undefined" ? null : parseStockQuantity(stockQuantity);
        if ((typeof stockQuantity !== "undefined" && parsedStockQuantity === null)
          || (inventoryRequested && parsedStockQuantity === null)) {
          return res.status(400).json({ error: "أدخل كمية مخزون صحيحة (عدد صحيح لا يقل عن صفر)." });
        }
      }
      if (storeProductMode && !activeStore.selectedCategories?.length) {
        return res.status(400).json({ error: "يجب اختيار تصنيف من تصنيفات المتجر." });
      }
      const shouldCheckStoreCategory = typeof categoryId !== "undefined" && categoryId !== null;
      if (storeProductMode && shouldCheckStoreCategory) {
        if (activeStore) {
          const subscription = await StoreSubscription.findOne({ storeId: activeStore._id }).sort({ createdAt: -1 }).lean();
          const subscriptionStatus = StoreSubscription.getStoreSubscriptionStatus(subscription);
          if (subscriptionStatus !== "active") {
            return res.status(403).json({ error: "اشتراك المتجر منتهي، لا يمكنك إنشاء أو تعديل إعلانات المتجر." });
          }
          if (Array.isArray(activeStore.selectedCategories) && activeStore.selectedCategories.length > 0) {
            const allowedCategories = activeStore.selectedCategories.map((id) => String(id));
            if (categoryId && !allowedCategories.includes(String(categoryId))) {
              return res.status(403).json({ error: "هذا التصنيف غير مسموح به في المتجر النشط." });
            }
          }
          if (activeStore.activityKey && !(await categoryAllowedForStoreActivity(activeStore, categoryId, previousCategoryId))) {
            return res.status(403).json({ error: "هذا التصنيف لا يتوافق مع نوع المتجر المختار." });
          }
        }
      }

      if (governorateId || cityId) {
        const resolvedGovernorateId = governorateId || String(ad.governorateId);
        const resolvedCityId = cityId || String(ad.cityId);
        const city = await City.findById(resolvedCityId).lean();
        if (!city) return res.status(400).json({ error: "Invalid city" });
        if (String(city.governorateId) !== String(resolvedGovernorateId)) {
          return res.status(400).json({ error: "City does not belong to governorate" });
        }
      }

      if (typeof title !== "undefined") ad.title = title;
      if (typeof description !== "undefined") ad.description = description;
      if (typeof price !== "undefined") ad.price = price;
      if (typeof currency !== "undefined") ad.currency = currency;
      if (typeof governorateId !== "undefined") ad.governorateId = governorateId;
      if (typeof cityId !== "undefined") ad.cityId = cityId;
      if (typeof categoryId !== "undefined") ad.categoryId = categoryId || null;
      if (typeof lat !== "undefined" && typeof lng !== "undefined" && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
        ad.location = { type: "Point", coordinates: [Number(lng), Number(lat)] };
      }
      if (storeProductMode) ad.condition = null;
      else if (typeof condition !== "undefined") ad.condition = condition;
      if (typeof tags !== "undefined") ad.tags = tags;
      if (typeof tagNames !== "undefined") ad.tagNames = tagNames;
      if (storeProductMode) {
        ad.contactInfo = { showPhone: false, phone: "", showWhatsApp: false, whatsapp: "" };
      } else {
        if (typeof showPhone !== "undefined") ad.contactInfo.showPhone = showPhone;
        if (typeof phone !== "undefined") ad.contactInfo.phone = phone;
        if (typeof showWhatsApp !== "undefined") ad.contactInfo.showWhatsApp = showWhatsApp;
        if (typeof whatsapp !== "undefined") ad.contactInfo.whatsapp = whatsapp;
      }
      if (typeof negotiable !== "undefined") ad.negotiable = !!negotiable;
      if (typeof priceOnContact !== "undefined") ad.priceOnContact = !!priceOnContact;
      if (storeProductMode && typeof isAvailable !== "undefined") ad.isAvailable = isAvailable === true || isAvailable === "true";
      if (storeProductMode && typeof isAvailableForDelivery !== "undefined") {
        ad.isAvailableForDelivery = isAvailableForDelivery === true || isAvailableForDelivery === "true";
      }
      if (storeProductMode && discountFieldsSent) {
        ad.discountEnabled = discountEnabled === true || discountEnabled === "true";
        if (ad.discountEnabled) {
          ad.discountType = discountTypeToValidate;
          ad.discountValue = Number(discountValueToValidate);
        } else if (typeof discountType !== "undefined") {
          ad.discountType = discountType;
        }
      }
      if (storeProductMode && inventoryFieldsSent) {
        ad.inventoryEnabled = inventoryEnabled === true || inventoryEnabled === "true";
        if (typeof stockQuantity !== "undefined") ad.stockQuantity = parseStockQuantity(stockQuantity);
      }
      if (storeProductMode) {
        ad.governorateId = activeStore.governorateId;
        ad.cityId = activeStore.cityId;
        ad.location = undefined;
      }

      const filenames = (req.files || []).map((file) => file.optimizedFilename || file.filename);
      if (filenames.length > 0) ad.images = [...(ad.images || []), ...filenames];

      if (ad.status === "rejected" || ad.status === "expired") {
        ad.status = "pending";
        ad.publishedAt = undefined;
        ad.expiresAt = undefined;
        ad.expireReminderSent = false;

        const settings = await SystemSettings.getSettings();
        const contentToSearch = `${ad.title} ${ad.description || ""} ${(ad.tagNames || []).join(" ")}`.toLowerCase();
        const hasProhibited = settings.prohibitedKeywords.some((keyword) => contentToSearch.includes(keyword.toLowerCase()));

        if (!hasProhibited && settings.adReviewMode === "auto") {
          if (settings.adReviewDelayMinutes === 0) {
            ad.status = "approved";
            ad.publishedAt = new Date();
          } else {
            let delay = settings.adReviewDelayMinutes;
            if (delay === -1) {
              const options = [5, 10, 15];
              delay = options[Math.floor(Math.random() * options.length)];
            }
            ad.scheduledPublishAt = new Date(Date.now() + delay * 60 * 1000);
          }
        }
      }

      await ad.save();
      if (storeProductMode) {
        if (hasExplicitAttributes) {
          try {
            await ListingService.saveAttributeValues(ad._id, Array.isArray(attributes) ? attributes : [], { strictCategory: true });
          } catch (error) {
            if (previousCategoryId !== String(ad.categoryId)) {
              ad.categoryId = previousCategoryId || null;
              await ad.save();
            }
            throw error;
          }
        }
        if (hasExplicitAttributes && previousCategoryId && previousCategoryId !== String(ad.categoryId)) {
          await ListingService.deleteAttributeValuesForCategory(ad._id, previousCategoryId);
        }
      } else if (hasExplicitAttributes) {
        await ListingService.saveAttributeValues(ad._id, Array.isArray(attributes) ? attributes : []);
      }

      const updated = await Ad.findById(ad._id)
        .populate("governorateId", "name")
        .populate("cityId", "name")
        .lean();
      if (storeProductMode && ad.status === "approved") {
        if (previousStatus !== "approved") {
          await createStoreNotification(req.app, {
            storeProfileId: ad.storeProfileId,
            type: STORE_NOTIFICATION_TYPES.NEW_ARRIVAL,
            title: "منتج جديد في المتجر",
            body: `أُضيف ${ad.title} إلى المتجر.`,
            link: `/store/${encodeURIComponent(activeStore.slug || "")}`,
            data: { productId: String(ad._id), eventId: `${ad._id}:${ad.publishedAt?.getTime() || ad.updatedAt?.getTime() || "published"}` }
          });
        }
        if ((!previousDiscountEnabled || previousStatus !== "approved") && ad.discountEnabled === true) {
          await createStoreNotification(req.app, {
            storeProfileId: ad.storeProfileId,
            type: STORE_NOTIFICATION_TYPES.DISCOUNT_ACTIVATED,
            title: "عرض جديد من المتجر",
            body: `تم تفعيل خصم على ${ad.title}.`,
            link: `/store/${encodeURIComponent(activeStore.slug || "")}`,
            data: { productId: String(ad._id), eventId: `${ad._id}:${ad.updatedAt?.getTime() || "discount"}` }
          });
        }
        if (previousStockQuantity <= 0 && Number(ad.stockQuantity) > 0) {
          await createStoreNotification(req.app, {
            storeProfileId: ad.storeProfileId,
            type: STORE_NOTIFICATION_TYPES.PRODUCT_RESTOCKED,
            title: "عاد المنتج إلى المخزون",
            body: `أصبح ${ad.title} متاحًا من جديد.`,
            link: `/store/${encodeURIComponent(activeStore.slug || "")}`,
            data: { productId: String(ad._id), eventId: `${ad._id}:${ad.updatedAt?.getTime() || "restock"}` }
          });
        }
      }
      res.json(updated);
    } catch (error) {
      console.error("Update ad error:", error);
      res.status(400).json({ error: error?.message || "Update error" });
    }
  }
);

router.patch("/:id/unfeature", auth, requireRole(["seller"]), async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);
    if (!ad) return res.status(404).json({ error: "Not found" });
    if (String(ad.userId) !== String(req.user.id) && req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    if (!ad.featured) return res.json(await Ad.findById(req.params.id).lean());
    ad.featured = false;
    ad.featuredUntil = undefined;
    await ad.save();
    const updated = await Ad.findById(req.params.id).lean();
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/pending-followups", auth, requireRole(["seller", "user"]), async (req, res) => {
  try {
    const ads = await Ad.find({
      userId: req.user.id,
      followUpStatus: "sent",
      sold: false,
      status: "approved"
    }).select("title images price currency createdAt").lean();
    res.json(ads);
  } catch (error) {
    console.error("Pending followups error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/share/:id", async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id).select("title slug description images price currency status isArchived sold isVisible expiresAt").lean();
    const isUnavailable = !ad || ad.status !== "approved" || ad.isArchived || ad.sold || ad.isVisible === false || (ad.expiresAt && new Date(ad.expiresAt) <= new Date());
    if (isUnavailable) return res.status(404).send("Not found");

    const frontendBase = getFrontendBaseUrl();
    const backendBase = (process.env.BACKEND_URL || "https://api.souqak-yem.com").replace(/\/+$/, "");
    const slug = String(ad.slug || ad.title || "ad")
      .toLowerCase()
      .replace(/[^\w\s\u0600-\u06ff-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/, "") || "ad";
    const adUrl = `${frontendBase}/ad/${ad._id}/${encodeURIComponent(slug)}`;
    const image = ad.images?.[0];
    const imageUrl = image
      ? (String(image).startsWith("http")
        ? String(image)
        : `${backendBase}/uploads/${String(image).replace(/^\/?uploads\//, "")}`)
      : `${frontendBase}/logo.png`;
    const title = ad.title || "إعلان في سوقك";
    const description = String(ad.description || `شاهد هذا الإعلان على سوقك: ${title}`)
      .replace(/<[^>]*>/g, "")
      .trim()
      .slice(0, 160);
    const escapeHtml = (value) => String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
    const safe = {
      title: escapeHtml(`${title} | سوقك`),
      description: escapeHtml(description),
      url: escapeHtml(adUrl),
      image: escapeHtml(imageUrl)
    };

    res.type("html").send(`<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta property="og:type" content="product" />
    <meta property="og:url" content="${safe.url}" />
    <meta property="og:title" content="${safe.title}" />
    <meta property="og:description" content="${safe.description}" />
    <meta property="og:image" content="${safe.image}" />
    <meta property="og:image:alt" content="${safe.title}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${safe.image}" />
    <meta http-equiv="refresh" content="0;url=${safe.url}" />
    <title>${safe.title}</title>
  </head>
  <body><a href="${safe.url}">فتح الإعلان</a></body>
</html>`);
  } catch (error) {
    console.error("Ad share preview error:", error);
    res.status(500).send("Server error");
  }
});

router.get("/:id", optionalAuth, async (req, res) => {
  try {
    const adId = req.params.id;
    let ad = await Ad.findById(adId)
      .populate("governorateId", "name")
      .populate("cityId", "name")
      .populate("categoryId", "name slug image parentId")
      .populate("userId", "name avatar isVerifiedSeller isTrustedReseller createdAt")
      .populate({
        path: "storeProfileId",
        select: "storeName slug logo businessActivity storeType deliveryAvailable location phone phones whatsapp email governorateId cityId customCityName status",
        populate: [
          { path: "governorateId", select: "name" },
          { path: "cityId", select: "name" }
        ]
      })
      .lean();
    
    if (!ad) return res.status(404).json({ error: "Not found" });

    let storeSubscription = null;
    if (ad.storeProfileId?._id) {
      storeSubscription = await StoreSubscription.findOne({ storeId: ad.storeProfileId._id })
        .sort({ createdAt: -1, _id: -1 })
        .populate("planId", "type features")
        .lean();
      ad.storeProfileId.analyticsEnabled = hasStoreFeature({
        status: ad.storeProfileId.status,
        subscription: storeSubscription
      }, "analytics");
      if (!hasStoreFeature({ status: ad.storeProfileId.status, subscription: storeSubscription }, "multipleContacts")) {
        ad.storeProfileId.phones = (ad.storeProfileId.phones || []).slice(0, 1);
        ad.storeProfileId.whatsapp = (ad.storeProfileId.whatsapp || []).slice(0, 1);
      }
      ad.storeProfileId.deliveryEnabled = hasStoreFeature({ status: ad.storeProfileId.status, subscription: storeSubscription }, "delivery");
      if (!ad.storeProfileId.deliveryEnabled) ad.isAvailableForDelivery = false;
      const discountsEnabled = hasStoreFeature({ status: ad.storeProfileId.status, subscription: storeSubscription }, "discounts");
      const pricing = getStoreProductPricing(ad);
      const hasDiscount = discountsEnabled && pricing.discountEnabled;
      ad.discountEnabled = hasDiscount;
      ad.discountType = pricing.discountType;
      ad.discountValue = hasDiscount ? pricing.discountValue : 0;
      ad.originalPrice = pricing.originalPrice;
      ad.unitPrice = hasDiscount ? pricing.unitPrice : pricing.originalPrice;
      ad.storeProfileId.discountsEnabled = discountsEnabled;
    }

    // Logic for restricted ads (only owner or admin can see)
    const isAdmin = req.user?.role === "admin";
    const isOwner = req.user && String(ad.userId?._id || ad.userId) === String(req.user.id);
    const isExpired = ad.expiresAt && new Date(ad.expiresAt) <= new Date();
    const isPubliclyVisible = ad.status === "approved" && !isExpired && ad.isVisible !== false && ad.isArchived !== true && ad.sold !== true && ad.isDeleted !== true;
    if (!isPubliclyVisible) {
      if (!isAdmin && !isOwner) {
        return res.status(404).json({ error: "Not found" });
      }
    }
    if (ad.storeProfileId?._id) {
      const isStoreVisible = isPublicStoreEligible(ad.storeProfileId, storeSubscription);
      if (!isStoreVisible && !isAdmin && !isOwner) {
        return res.status(404).json({ error: "Not found" });
      }
    }
    
    // Get parent category if exists
    let parentCategory = null;
    const currentCategory = ad.categoryId;
    if (currentCategory?.parentId) {
      try {
        parentCategory = await Category.findById(currentCategory.parentId).select("name slug").lean();
      } catch (catErr) {
        console.error("Error fetching parent category:", catErr);
      }
    }
    
    // Get attributes
    let attributes = [];
    try {
      attributes = await ListingService.getListingAttributes(ad._id, {
        categoryId: ad.categoryId?._id || ad.categoryId,
        strictCategory: Boolean(ad.storeProfileId),
      });
    } catch (attrErr) {
      console.error("Error fetching attributes:", attrErr);
    }

    res.json({ ...ad, attributes, parentCategory });
  } catch (error) {
    console.error("Get ad detail error:", error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

router.get("/:id/seller-view", auth, requireRole(["seller"]), async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id).lean();
    if (!ad) {
      return res.status(404).json({ error: "Ad not found" });
    }
    // Ensure the user requesting is the owner of the ad
    if (String(ad.userId) !== String(req.user.id)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    res.json(ad);
  } catch (error) {
    console.error("Get ad for seller failed:", error);
    res.status(500).json({ error: "Server error" });
  }
});


router.patch(
  "/:id/close",
  auth,
  requireRole(["seller"]),
  validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })),
  validateBody(Joi.object({ 
    reason: Joi.string().valid("sold", "archive", "sold_out", "archived").required(),
    price: Joi.number().min(0).optional(),
    currency: Joi.string().valid("YER", "YER_ADEN", "YER_SANAA", "SAR", "USD").optional()
  })),
  async (req, res) => {
  try {
    const { reason } = req.body || {};
    const ad = await Ad.findById(req.params.id);
    if (!ad) return res.status(404).json({ error: "Not found" });
    if (String(ad.userId) !== String(req.user.id)) return res.status(403).json({ error: "Forbidden" });
    
    if (reason === "sold" || reason === "sold_out") {
      const updatedAd = await Ad.findByIdAndUpdate(
        req.params.id,
        { $set: { sold: true, status: "sold", soldAt: new Date() } },
        { new: true }
      ).populate("categoryId", "name").lean();

      if (!updatedAd) {
        return res.status(404).json({ error: "Ad not found after update." });
      }

      try {
        if (!AD_COMMISSION_ENABLED) return res.json(updatedAd);
        const CommissionModel = mongoose.model("Commission");
        let commission = await CommissionModel.findOne({ adId: updatedAd._id });
        
        const { price: providedPrice, currency: providedCurrency } = req.body || {};
        const price = (providedPrice && Number(providedPrice) > 0) ? Number(providedPrice) : (Number(updatedAd.price) || 0);
        const resolvedCurrency = providedCurrency || updatedAd.currency || "YER_ADEN";
        const commissionAmount = calculateSellerCommission(price);

        if (!commission) {
          commission = await CommissionModel.create({
            adId: updatedAd._id,
            sellerId: updatedAd.userId,
            price: price,
            currency: resolvedCurrency,
            commissionAmount: commissionAmount,
            status: "unpaid",
            commissionStatus: "pending_payment",
            soldAt: updatedAd.soldAt,
          });
        }

        await SoldListing.findOneAndUpdate(
          { adId: updatedAd._id },
          {
            adId: updatedAd._id,
            sellerId: updatedAd.userId,
            title: updatedAd.title,
            price: price,
            currency: resolvedCurrency,
            categoryName: updatedAd.categoryId?.name || "N/A",
            images: updatedAd.images || [],
            commissionId: commission._id,
            commissionAmount: commissionAmount,
            commissionStatus: commission.status,
            soldAt: updatedAd.soldAt,
            buyerType: "DIRECT"
          },
          { upsert: true, new: true }
        );
      } catch (commErr) {
        console.error(`Commission/SoldListing creation failed for adId ${updatedAd._id} but ad was marked sold.`, commErr);
      }

      return res.json(updatedAd);
    } else {
      const archivedAd = await Ad.findByIdAndUpdate(
        req.params.id,
        { $set: { isArchived: true } },
        { new: true }
      ).lean();
      return res.json(archivedAd);
    }
  } catch (error) {
      console.error("Close ad error:", error);
      res.status(500).json({ error: "Server error" });
    }
  });

router.patch("/:id/keep-active", auth, requireRole(["seller"]), async (req, res) => {
   try {
     const ad = await Ad.findById(req.params.id);
     if (!ad) return res.status(404).json({ error: "Not found" });
     if (String(ad.userId) !== String(req.user.id)) return res.status(403).json({ error: "Forbidden" });
    
     ad.lastSoldReminderAt = new Date();
     ad.soldReminderCount = (ad.soldReminderCount || 0) + 1;
     await ad.save();
     res.json({ success: true });
   } catch (error) {
     console.error("Keep active error:", error);
     res.status(500).json({ error: "Server error" });
   }
 });

router.patch("/:id/followup-response", auth, requireRole(["seller", "user"]), async (req, res) => {
  try {
    const { status } = req.body;
    const ad = await Ad.findById(req.params.id);
    if (!ad) return res.status(404).json({ error: "الإعلان غير موجود" });
    if (String(ad.userId) !== String(req.user.id)) return res.status(403).json({ error: "غير مصرح لك بتعديل هذا الإعلان" });

    ad.followUpStatus = "responded";
    
    if (status === "sold") {
      ad.sold = true;
      ad.status = "sold";
      ad.soldAt = new Date();
      await ad.save();

      try {
        if (!AD_COMMISSION_ENABLED) {
          return res.json({ success: true, message: "تم تحديث حالة الإعلان إلى مباع." });
        }
        const CommissionModel = mongoose.model("Commission");
        const { price: providedPrice, currency: providedCurrency } = req.body || {};
        const price = (providedPrice && Number(providedPrice) > 0) ? Number(providedPrice) : (Number(ad.price) || 0);
        const resolvedCurrency = providedCurrency || ad.currency || "YER_ADEN";
        const commissionAmount = calculateSellerCommission(price);

        const commission = await CommissionModel.create({
          adId: ad._id,
          sellerId: ad.userId,
          price: price,
          currency: resolvedCurrency,
          commissionAmount: commissionAmount,
          status: "unpaid",
          commissionStatus: "pending_payment",
          soldAt: ad.soldAt,
        });

        const adWithCategory = await Ad.findById(ad._id).populate("categoryId", "name").lean();
        await SoldListing.create({
          adId: ad._id,
          sellerId: ad.userId,
          title: ad.title,
          price: price,
          currency: resolvedCurrency,
          categoryName: adWithCategory?.categoryId?.name || "N/A",
          images: ad.images || [],
          commissionId: commission._id,
          commissionAmount: commissionAmount,
          commissionStatus: commission.status,
          soldAt: ad.soldAt,
          buyerType: "DIRECT"
        });
      } catch (commErr) {
        console.error("Commission/SoldListing creation error:", commErr);
      }

      return res.json({ success: true, message: "تم تحديث حالة الإعلان إلى مباع، نذكرك بدفع العمولة لضمان استمرارية خدماتنا." });
    } else {
      ad.publishedAt = new Date();
      await ad.save();
      return res.json({ success: true, message: "تم تحديث إعلانك ليبقى في المقدمة. هل فكرت في تمييزه لبيعه بشكل أسرع؟" });
    }
  } catch (error) {
    console.error("Follow-up response error:", error);
    res.status(500).json({ error: "خطأ في السيرفر" });
  }
});

router.get("/:id/comments", async (req, res) => {
  try {
    const adId = req.params.id;
    
    // Check if it's a regular ad
    let ad = await Ad.findById(adId).lean();
    if (!ad) return res.status(404).json({ error: "الإعلان غير موجود" });

    const { page = 1, limit = 20 } = req.query || {};
    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    
    const [list, total] = await Promise.all([
      AdComment
      .find({ adId, adModel: "Ad" })
      .populate("userId", "name avatar")
      .sort({ createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .lean(),
      AdComment.countDocuments({ adId, adModel: "Ad" })
    ]);
    res.json({ items: list, page: p, limit: l, total, pages: Math.ceil(total / l) });
  } catch (error) {
    console.error("Get comments error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get Welcome Promotion Summary for User
router.get("/welcome-promotion/summary", auth, async (req, res) => {
  try {
    const ad = await Ad.findOne({ 
      userId: req.user.id, 
      welcomePromotionStartDate: { $ne: null },
      isWelcomePromoted: false,
      freePromotionSummaryShown: false
    }).sort({ welcomePromotionEndDate: -1 });

    if (!ad) return res.json(null);

    res.json(ad);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Mark Welcome Promotion Summary as Shown
router.post("/welcome-promotion/summary/:id/shown", auth, async (req, res) => {
  try {
    await Ad.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { freePromotionSummaryShown: true }
    );
    
    // Increment global stat
    const settings = await SystemSettings.getSettings();
    if (settings.welcomePromotion && settings.welcomePromotion.stats) {
      settings.welcomePromotion.stats.summaryShownCount += 1;
      await settings.save();
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Track Click on "Promote Now" from Summary
router.post("/welcome-promotion/summary/:id/promote-click", auth, async (req, res) => {
  try {
    const settings = await SystemSettings.getSettings();
    if (settings.welcomePromotion && settings.welcomePromotion.stats) {
      settings.welcomePromotion.stats.promoteClickCount += 1;
      await settings.save();
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Check Welcome Promotion Eligibility
router.get("/welcome-promotion/eligibility", auth, async (req, res) => {
  try {
    const settings = await SystemSettings.getSettings();
    const user = await User.findById(req.user.id);
    
    if (!settings.welcomePromotion || !settings.welcomePromotion.enabled) {
      return res.json({ eligible: false, reason: "disabled" });
    }

    if (user.hasUsedWelcomePromotion) {
      return res.json({ eligible: false, reason: "already_used" });
    }

    if (settings.welcomePromotion.usedCount >= settings.welcomePromotion.maxBeneficiaries) {
      return res.json({ eligible: false, reason: "quota_full", remaining: 0 });
    }

    const now = new Date();
    if (settings.welcomePromotion.endDate && now > new Date(settings.welcomePromotion.endDate)) {
      return res.json({ eligible: false, reason: "expired" });
    }

    res.json({ 
      eligible: true, 
      durationHours: settings.welcomePromotion.durationHours,
      remaining: settings.welcomePromotion.maxBeneficiaries - settings.welcomePromotion.usedCount
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Activate Welcome Promotion (Trial) for a specific Ad
router.post("/welcome-promotion/activate", auth, async (req, res) => {
  try {
    const { adId } = req.body;
    if (!adId) return res.status(400).json({ error: "معرف الإعلان مطلوب" });

    const settings = await SystemSettings.getSettings();
    const wp = settings.welcomePromotion;

    if (!wp || !wp.enabled) {
      return res.status(400).json({ error: "التجربة المجانية غير مفعلة حالياً." });
    }

    const now = new Date();
    if (wp.endDate && now > new Date(wp.endDate)) {
      return res.status(400).json({ error: "انتهت فترة عرض التجربة المجانية." });
    }

    if (wp.usedCount >= wp.maxBeneficiaries) {
      return res.status(400).json({ error: "عذراً، انتهت جميع التجارب المجانية المتاحة حالياً." });
    }

    const user = await User.findById(req.user.id);
    if (user.hasUsedWelcomePromotion) {
      return res.status(400).json({ error: "لقد استخدمت التجربة المجانية مسبقاً." });
    }

    const ad = await Ad.findOne({ _id: adId, userId: req.user.id, isDeleted: false });
    if (!ad) return res.status(404).json({ error: "الإعلان غير موجود." });

    if (ad.status !== "approved") {
      return res.status(400).json({ error: "يجب أن يكون الإعلان مقبولاً أولاً لتتمكن من تمييزه." });
    }

    // Activate Promotion
    ad.featured = true;
    ad.isWelcomePromoted = true;
    ad.welcomePromotionStartDate = now;
    ad.welcomePromotionEndDate = new Date(now.getTime() + wp.durationHours * 60 * 60 * 1000);
    await ad.save();

    // Update User
    user.hasUsedWelcomePromotion = true;
    user.welcomePromotionUsedAt = now;
    await user.save();

    // Update Global Counter
    settings.welcomePromotion.usedCount += 1;
    await settings.save();

    res.json({ 
      success: true, 
      message: "تم تفعيل التجربة المجانية بنجاح لمدة 6 ساعات!",
      endDate: ad.welcomePromotionEndDate 
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post(
  "/:id/comments",
  auth,
  rateLimit({ windowMs: 60_000, max: 8 }),
  validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })),
  validateBody(Joi.object({ text: Joi.string().trim().min(1).max(1000).required() })),
  async (req, res) => {
  try {
    const adId = req.params.id;
    const { text } = req.body || {};
    
    // Check if it's a regular ad
    let ad = await Ad.findById(adId).lean();
    if (!ad) return res.status(404).json({ error: "الإعلان غير موجود" });
    let notifyUserId = ad.userId;
    
    const c = await AdComment.create({ 
      adId: adId, 
      adModel: "Ad", 
      userId: req.user.id, 
      text: String(text).trim() 
    });
    
    const populated = await AdComment.findById(c._id).populate("userId", "name avatar").lean();
    
    // If user is owner of the ad being commented on
    const isOwner = String(notifyUserId || "") === String(req.user.id || "");
    
    if (isOwner) {
      return res.status(201).json(populated);
    }

    try {
      const u = await User.findById(req.user.id).select("name").lean();
      const title = "تعليق جديد على إعلانك";
      const adTitle = ad.title || "إعلان";
      const body = `${u?.name || "مستخدم"} علّق على إعلان ${adTitle}: ${String(text).trim()}`;
      
      // Notify seller
      await createNotification(req.app, {
        userId: notifyUserId,
        type: "comment",
        title,
        body,
        data: { adId, adModel: "Ad", commentId: c._id }
      });
    } catch (notifErr) {
      console.error("Comment notification failed:", notifErr);
    }
    
    res.status(201).json(populated);
  } catch (error) {
    console.error("Post comment error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.post(
  "/:id/report",
  auth,
  rateLimit({ windowMs: 60_000, max: 5 }),
  validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })),
  validateBody(Joi.object({ 
    category: Joi.string().trim().required(),
    reason: Joi.string().trim().min(3).max(300).required(),
    details: Joi.string().trim().max(1000).allow("").optional()
  })),
  async (req, res) => {
  try {
    const { category, reason, details } = req.body || {};
    const ad = await Ad.findById(req.params.id).lean();
    if (!ad || ad.status !== "approved") return res.status(404).json({ error: "Not found" });
    const r = await AdReport.create({ 
      adId: req.params.id, 
      reporterId: req.user.id, 
      category: String(category).trim(),
      reason: String(reason).trim(),
      details: String(details || "").trim()
    });

    // Send admin notification for new ad report
    await createAdminNotification(req.app, {
      type: "new_ad_report",
      title: "بلاغ جديد على إعلان",
      message: `تم إرسال بلاغ على إعلان: ${ad.title}`,
      link: "/admin/reports",
      data: { reportId: r._id, adId: ad._id }
    });

    res.status(201).json(r);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post(
  "/:id/view",
  optionalAuth,
  rateLimit({ windowMs: 60_000, max: 20 }),
  validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })),
  async (req, res) => {
    try {
      const adId = req.params.id;
      const userId = req.user?.id;
      const ip = req.ip;

      // Check if this user/IP has already viewed this ad
      const filter = userId ? { adId, userId } : { adId, ip };
      
      const existingView = await AdView.findOne(filter);
      if (existingView) {
        return res.json({ counted: false, reason: "duplicate" });
      }

      // Check if it's a regular ad
      let ad = await Ad.findById(adId);
      if (!ad) return res.status(404).json({ error: "الإعلان غير موجود" });

      const viewIdentity = userId ? { adId, userId } : { adId, ip };
      await AdView.create(viewIdentity);

      // Increment view count in ad model
      const updateObj = { $inc: { viewCount: 1 } };
      if (ad.isWelcomePromoted) {
        updateObj.$inc["promotionStats.views"] = 1;
      }
      const updatedAd = await Ad.findByIdAndUpdate(
        adId,
        updateObj,
        { new: true }
      ).select("viewCount");

      res.json({ counted: true, viewCount: updatedAd.viewCount });
    } catch (err) {
      if (err.code === 11000) {
        return res.json({ counted: false, reason: "duplicate" });
      }
      res.status(500).json({ error: "Server error" });
    }
  }
);

router.post(
  "/:id/click",
  optionalAuth,
  validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })),
  validateBody(Joi.object({ type: Joi.string().valid("whatsapp", "phone").required() })),
  async (req, res) => {
    try {
      const { type } = req.body;
      const ad = await Ad.findById(req.params.id);
      if (!ad) return res.status(404).json({ error: "Not found" });

      if (type === "whatsapp") {
        ad.whatsappClicks = (ad.whatsappClicks || 0) + 1;
        if (ad.isWelcomePromoted) {
          ad.promotionStats.whatsappClicks = (ad.promotionStats.whatsappClicks || 0) + 1;
        }
      } else if (type === "phone") {
        ad.phoneClicks = (ad.phoneClicks || 0) + 1;
        if (ad.isWelcomePromoted) {
          ad.promotionStats.phoneClicks = (ad.promotionStats.phoneClicks || 0) + 1;
        }
      }
      
      await ad.save();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  }
);

const storeVisibleAdFilter = (storeId) => ({
  storeProfileId: storeId,
  status: "approved",
  expiresAt: { $gt: new Date() },
  isVisible: { $ne: false },
  isArchived: { $ne: true },
  sold: { $ne: true },
  isDeleted: { $ne: true }
});

const createAdRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 ads per 15 mins
  message: "لقد تجاوزت الحد المسموح به لنشر الإعلانات. يرجى الانتظار قليلاً."
});

router.post(
  "/",
  auth,
  requireRole(["seller", "user"]),
  requirePhoneVerification,
  createAdRateLimit,
  uploadImages.array("images", 10),
  processImages(),
  validateProcessedImages,
  parseJsonAttributes,
  validateBody(
    Joi.object({
      title: Joi.string().trim().min(3).max(120).required(),
      description: Joi.string().allow("").max(2000).optional(),
      price: Joi.number().min(0).optional().default(0),
      currency: Joi.string().valid("YER", "YER_ADEN", "YER_SANAA", "SAR", "USD").default("USD"),
      storeProduct: Joi.boolean().optional(),
      storeType: Joi.string().valid("store", "family-production").optional(),
      isAvailable: Joi.boolean().optional(),
      isAvailableForDelivery: Joi.boolean().optional(),
      inventoryEnabled: Joi.boolean().optional(),
      stockQuantity: Joi.number().integer().min(0).optional(),
      discountEnabled: Joi.boolean().optional(),
      discountType: Joi.string().valid("percentage", "fixed").optional(),
      discountValue: Joi.number().greater(0).optional(),
      delivery: Joi.boolean().optional(),
      deliveryAvailable: Joi.boolean().optional(),
      governorateId: Joi.when("storeProduct", { is: true, then: Joi.string().length(24).hex().optional(), otherwise: Joi.string().length(24).hex().required() }),
      cityId: Joi.when("storeProduct", { is: true, then: Joi.string().length(24).hex().optional(), otherwise: Joi.string().length(24).hex().required() }),
      categoryId: Joi.string().length(24).hex().optional(),
      lat: Joi.number().optional(),
      lng: Joi.number().optional(),
      tags: Joi.array().items(Joi.string().length(24).hex()).optional(),
      tagNames: Joi.array().items(Joi.string()).optional(),
      condition: Joi.string().valid("new", "used", "like_new").optional(),
      negotiable: Joi.boolean().optional(),
      priceOnContact: Joi.boolean().optional(),
      showPhone: Joi.boolean().optional(),
      phone: Joi.string().optional(),
      showWhatsApp: Joi.boolean().optional(),
      whatsapp: Joi.string().optional(),
      adType: Joi.string().valid("sell", "order").optional(),
      isResellEnabled: Joi.boolean().optional(),
      commissionType: Joi.string().valid("fixed", "percentage").optional(),
      commissionValue: Joi.number().min(0).optional().allow(null, ""),
      maxResellPrice: Joi.number().min(0).optional().allow(null, ""),
      allowAutoApproval: Joi.boolean().optional(),
      maxResellers: Joi.number().min(1).optional().allow(null, ""),
      attributes: Joi.array()
        .items(
          Joi.object({
            attributeId: Joi.string().length(24).hex().required(),
            value: Joi.alternatives(Joi.string(), Joi.number(), Joi.boolean()).required()
          })
        )
        .optional()
    })
  ),
  async (req, res) => {
  try {
    const { 
      title, description, price, currency, attributes, governorateId, cityId, categoryId, lat, lng, tags, tagNames, condition, 
      showPhone, phone, showWhatsApp, whatsapp, negotiable, priceOnContact, adType,
      isResellEnabled, commissionType, commissionValue, maxResellPrice, maxResellers, allowAutoApproval, storeProduct,
      isAvailable, isAvailableForDelivery, inventoryEnabled, stockQuantity, discountEnabled, discountType, discountValue, storeType = "store"
    } = req.body || {};

    const unpaidCommissions = await Commission.find({
      sellerId: req.user.id,
      $or: [
        { status: { $in: ["unpaid", "overdue"] } },
        { commissionStatus: { $in: ["pending_payment", "pending_review", "rejected"] } }
      ],
      isDeleted: { $ne: true }
    }).lean();

    if (hasOutstandingCommission(unpaidCommissions)) {
      return res.status(403).json({
        error: "لا يمكنك إضافة إعلان حتى تقوم بدفع عمولة المنصة."
      });
    }

    // Business Logic Protection: Duplicate Ad Check
    const duplicateAd = await Ad.findOne({
      userId: req.user.id,
      title: title.trim(),
      price: Number(price),
      createdAt: { $gt: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
    });

    if (duplicateAd) {
      return res.status(400).json({ error: "لقد قمت بنشر إعلان مشابه مؤخراً." });
    }

    const storeProductMode = storeProduct === true || storeProduct === "true";
    const attributesWereSent = Object.prototype.hasOwnProperty.call(req.body || {}, "attributes");
    const deliveryRequested = isAvailableForDelivery === true || isAvailableForDelivery === "true";
    const discountFieldsSent = ["discountEnabled", "discountType", "discountValue"]
      .some((field) => Object.prototype.hasOwnProperty.call(req.body || {}, field));
    const inventoryFieldsSent = ["inventoryEnabled", "stockQuantity"]
      .some((field) => Object.prototype.hasOwnProperty.call(req.body || {}, field));
    if (storeProductMode && (Object.prototype.hasOwnProperty.call(req.body || {}, "delivery")
      || Object.prototype.hasOwnProperty.call(req.body || {}, "deliveryAvailable"))) {
      return res.status(400).json({ error: "استخدم isAvailableForDelivery لتحديد التوصيل لكل منتج." });
    }
    if (!["store", "family-production"].includes(storeType)) return res.status(400).json({ error: "Invalid store type" });
    const storeTypeFilter = storeType === "family-production"
      ? { storeType: "family-production" }
      : { $or: [{ storeType: "store" }, { storeType: { $exists: false } }] };
    const store = storeProductMode
      ? await StoreProfile.findOne({ userId: req.user.id, status: "active", ...storeTypeFilter })
        .select("selectedCategories activityKey storeType _id userId governorateId cityId").lean()
      : null;
    let storeDynamicAttributesEnabled = false;
    if (storeProductMode && !store) {
      return res.status(403).json({ error: "يجب أن يكون لديك متجر نشط لإضافة منتج متجر." });
    }
    if (storeProductMode && (!categoryId || !store.selectedCategories?.length)) {
      return res.status(400).json({ error: "يجب اختيار تصنيف من تصنيفات المتجر." });
    }
    if (storeProductMode && store) {
      const subscriptionFilter = { ["storeId"]: store._id };
      const subscription = await StoreSubscription.findOne(subscriptionFilter).sort({ createdAt: -1 }).lean();
      const subscriptionStatus = StoreSubscription.getStoreSubscriptionStatus(subscription);
      if (subscriptionStatus !== "active") {
        return res.status(403).json({ error: "اشتراك المتجر منتهي، لا يمكنك إضافة إعلانات متجر جديدة." });
      }
      const storePlan = subscription?.planId ? await Plan.findById(subscription.planId).lean() : null;
      storeDynamicAttributesEnabled = hasStoreFeature({
        status: store.status,
        subscription: { ...subscription, planId: storePlan }
      }, "dynamicAttributes");
      if (attributesWereSent && !storeDynamicAttributesEnabled) {
        return res.status(403).json({ error: "الخصائص الديناميكية غير مفعّلة في خطة هذا المتجر." });
      }
      if (deliveryRequested && !hasStoreFeature({
        status: store.status,
        subscription: { ...subscription, planId: storePlan }
      }, "delivery")) {
        return res.status(403).json({ error: "تفعيل التوصيل لكل منتج يتطلب خطة متجر تشمل ميزة التوصيل." });
      }
      if (discountFieldsSent && !hasStoreFeature({
        status: store.status,
        subscription: { ...subscription, planId: storePlan }
      }, "discounts")) {
        return res.status(403).json({ error: "خصومات المنتجات غير مفعّلة في خطة هذا المتجر." });
      }
      if (inventoryFieldsSent && !hasStoreFeature({
        status: store.status,
        subscription: { ...subscription, planId: storePlan }
      }, "inventory")) {
        return res.status(403).json({ error: "إدارة مخزون المنتجات غير مفعّلة في خطة هذا المتجر." });
      }
      const inventoryRequested = inventoryEnabled === true || inventoryEnabled === "true";
      const parsedStockQuantity = typeof stockQuantity === "undefined" ? null : parseStockQuantity(stockQuantity);
      if (inventoryFieldsSent && ((typeof stockQuantity !== "undefined" && parsedStockQuantity === null)
        || (inventoryRequested && parsedStockQuantity === null))) {
        return res.status(400).json({ error: "أدخل كمية مخزون صحيحة (عدد صحيح لا يقل عن صفر)." });
      }
      const discountRequested = discountEnabled === true || discountEnabled === "true";
      if (discountRequested && !isValidStoreDiscount(price, discountType || "percentage", discountValue)) {
        return res.status(400).json({ error: "قيمة الخصم غير صالحة؛ النسبة من 1 إلى 99% أو المبلغ أقل من أو يساوي سعر المنتج." });
      }
      if (Array.isArray(store.selectedCategories) && store.selectedCategories.length > 0) {
        const allowedCategories = store.selectedCategories.map((id) => String(id));
        if (categoryId && !allowedCategories.includes(String(categoryId))) {
          return res.status(403).json({ error: "هذا التصنيف غير مسموح به في المتجر النشط." });
        }
      }
      if (store.activityKey && !(await categoryAllowedForStoreActivity(store, categoryId))) {
        return res.status(403).json({ error: "هذا التصنيف لا يتوافق مع نوع المتجر المختار." });
      }

      const rawMaxProducts = storePlan?.limits?.maxProducts;
      const hasExplicitMaxProducts = rawMaxProducts !== undefined && rawMaxProducts !== null && rawMaxProducts !== "" && Number(rawMaxProducts) > 0;
      const maxProductsLimit = hasExplicitMaxProducts ? Number(rawMaxProducts) : null;

      if (maxProductsLimit !== null && Number.isFinite(maxProductsLimit) && maxProductsLimit > 0) {
        const currentVisibleAdCount = await Ad.countDocuments(storeVisibleAdFilter(store._id));
        if (currentVisibleAdCount >= maxProductsLimit) {
          return res.status(403).json({ error: `لقد وصلت إلى الحد الأقصى لعدد المنتجات المتاحة في المتجر (${maxProductsLimit}).` });
        }
      }
    }

    const filenames = (req.files || []).map((f) => f.optimizedFilename || f.filename);

    let finalTagNames = tagNames || [];
    if (tags && tags.length > 0 && finalTagNames.length === 0) {
      const Tag = (await import("../models/Tag.js")).default;
      const tagDocs = await Tag.find({ _id: { $in: tags } });
      finalTagNames = tagDocs.map(t => t.name);
    }
    
    // Auto-approval logic
    const settings = await SystemSettings.getSettings();
    let status = "pending";
    let scheduledPublishAt = undefined;
    let publishedAt = undefined;

    // Welcome Promotion Logic - (إلغاء التفعيل التلقائي، المستخدم يفعله يدوياً الآن)
    let isFeatured = false;
    let isWelcomePromoted = false;
    let welcomePromotionStartDate = null;
    let welcomePromotionEndDate = null;

    // Check for prohibited keywords
    const contentToSearch = `${title} ${description || ""} ${finalTagNames.join(" ")}`.toLowerCase();
    const hasProhibited = settings.prohibitedKeywords.some(keyword => contentToSearch.includes(keyword.toLowerCase()));

    if (!hasProhibited && settings.adReviewMode === "auto") {
      if (settings.adReviewDelayMinutes === 0) {
        status = "approved";
        publishedAt = new Date();
      } else {
        let delay = settings.adReviewDelayMinutes;
        if (delay === -1) {
          const options = [5, 10, 15];
          delay = options[Math.floor(Math.random() * options.length)];
        }
        scheduledPublishAt = new Date(Date.now() + delay * 60 * 1000);
      }
    }

    const ad = await Ad.create({
      title,
      description,
      price,
      currency,
      governorateId: storeProductMode ? store.governorateId : governorateId,
      cityId: storeProductMode ? store.cityId : cityId,
      categoryId: categoryId || null,
      adType: adType || "sell",
      location: (typeof lat !== "undefined" && typeof lng !== "undefined" && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)))
        ? { type: "Point", coordinates: [Number(lng), Number(lat)] }
        : undefined,
      images: filenames,
      status,
      scheduledPublishAt,
      publishedAt,
      expiresAt: publishedAt ? new Date(publishedAt.getTime() + 40 * 24 * 60 * 60 * 1000) : undefined,
      featured: isFeatured,
      isWelcomePromoted,
      welcomePromotionStartDate,
      welcomePromotionEndDate,
      userId: req.user.id,
      tags: tags || [],
      tagNames: finalTagNames,
      isResellEnabled: isResellEnabled === true || isResellEnabled === "true",
      commissionType: commissionType || "percentage",
      commissionValue: Number(commissionValue) || 0,
      maxResellPrice: (maxResellPrice && maxResellPrice !== "") ? Number(maxResellPrice) : undefined,
      allowAutoApproval: allowAutoApproval !== false && allowAutoApproval !== "false",
      maxResellers: Number(maxResellers) || 5,
      storeProfileId: storeProductMode ? store._id : null,
      condition: storeProductMode ? null : condition || "used",
      ...(storeProductMode ? { isAvailable: isAvailable !== false && isAvailable !== "false" } : {}),
      ...(storeProductMode ? { isAvailableForDelivery: isAvailableForDelivery === true || isAvailableForDelivery === "true" } : {}),
      ...(storeProductMode && inventoryFieldsSent ? {
        inventoryEnabled: inventoryEnabled === true || inventoryEnabled === "true",
        ...(typeof stockQuantity !== "undefined" ? { stockQuantity: parseStockQuantity(stockQuantity) } : {})
      } : {}),
      ...(storeProductMode ? {
        discountEnabled: discountEnabled === true || discountEnabled === "true",
        discountType: discountType || "percentage",
        ...((discountEnabled === true || discountEnabled === "true") && typeof discountValue !== "undefined"
          ? { discountValue: Number(discountValue) }
          : {})
      } : {}),
      negotiable: !!negotiable,
      priceOnContact: !!priceOnContact,
      contactInfo: {
        showPhone: storeProductMode ? false : showPhone || false,
        phone: storeProductMode ? "" : phone || "",
        showWhatsApp: storeProductMode ? false : showWhatsApp || false,
        whatsapp: storeProductMode ? "" : whatsapp || ""
      }
    });
    if ((storeProductMode && storeDynamicAttributesEnabled)
      || (!storeProductMode && Array.isArray(attributes) && attributes.length > 0)) {
      // Save attributes using the new consolidated system
      try {
        await ListingService.saveAttributeValues(ad._id, attributes || [], { strictCategory: storeProductMode });
      } catch (error) {
        if (storeProductMode) {
          await ListingService.deleteAttributeValues(ad._id);
          await Ad.findByIdAndDelete(ad._id);
        }
        throw error;
      }
    }

    // Send admin notification for new ad (especially if pending)
    await createAdminNotification(req.app, {
      type: status === "pending" ? "ad_pending" : "new_ad",
      title: status === "pending" ? "إعلان جديد قيد المراجعة" : "إعلان جديد تم نشره",
      message: `تم إضافة إعلان جديد: ${title}`,
      link: "/admin/products",
      data: { adId: ad._id }
    });

    if (storeProductMode && status === "approved") {
      const notificationPayload = {
        storeProfileId: store._id,
        data: { productId: String(ad._id) }
      };
      await createStoreNotification(req.app, {
        ...notificationPayload,
        type: STORE_NOTIFICATION_TYPES.NEW_ARRIVAL,
        title: "منتج جديد في المتجر",
        body: `أُضيف ${ad.title} إلى المتجر.`
      });
      if (ad.discountEnabled === true) {
        await createStoreNotification(req.app, {
          ...notificationPayload,
          type: STORE_NOTIFICATION_TYPES.DISCOUNT_ACTIVATED,
          title: "عرض جديد من المتجر",
          body: `تم نشر ${ad.title} مع خصم.`
        });
      }
    }

    res.status(201).json(ad);
  } catch (e) {
    res.status(400).json({ error: e && e.message ? e.message : "Create error" });
  }
});

router.patch(
  "/:id/republish",
  auth,
  requireRole(["seller"]),
  validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })),
  async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);
    if (!ad) return res.status(404).json({ error: "Not found" });
    if (String(ad.userId) !== String(req.user.id)) return res.status(403).json({ error: "Forbidden" });

    if (ad.storeProfileId) {
      const store = await StoreProfile.findById(ad.storeProfileId).select("_id status").lean();
      const subscription = await StoreSubscription.findOne({ storeId: ad.storeProfileId })
        .sort({ createdAt: -1, _id: -1 })
        .lean();
      if (!isPublicStoreEligible(store, subscription)) {
        return res.status(403).json({ error: "لا يمكن إعادة نشر منتج متجر باشتراك غير نشط أو منتهٍ." });
      }
      if (
        ad.isDeleted === true
        || ad.isArchived === true
        || ad.isVisible === false
        || ad.sold === true
        || ["sold", "SOLD", "deleted", "archived", "blocked"].includes(ad.status)
      ) {
        return res.status(400).json({ error: "هذا المنتج غير مؤهل لإعادة النشر." });
      }
    }
    
    // Auto-approval logic for republishing
    const settings = await SystemSettings.getSettings();
    let status = "pending";
    let scheduledPublishAt = undefined;
    let publishedAt = undefined;

    const contentToSearch = `${ad.title} ${ad.description || ""} ${ad.tagNames.join(" ")}`.toLowerCase();
    const hasProhibited = settings.prohibitedKeywords.some(keyword => contentToSearch.includes(keyword.toLowerCase()));

    if (!hasProhibited && settings.adReviewMode === "auto") {
      if (settings.adReviewDelayMinutes === 0) {
        status = "approved";
        publishedAt = new Date();
      } else {
        let delay = settings.adReviewDelayMinutes;
        if (delay === -1) {
          const options = [5, 10, 15];
          delay = options[Math.floor(Math.random() * options.length)];
        }
        scheduledPublishAt = new Date(Date.now() + delay * 60 * 1000);
      }
    }

    ad.status = status;
    ad.scheduledPublishAt = scheduledPublishAt;
    ad.publishedAt = publishedAt;
    ad.expiresAt = publishedAt ? new Date(publishedAt.getTime() + 40 * 24 * 60 * 60 * 1000) : undefined;
    ad.expireReminderSent = false;
    await ad.save();
    const updated = await Ad.findById(req.params.id)
      .populate("governorateId", "name")
      .populate("cityId", "name")
      .lean();
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});
router.delete(
  "/:id/images/:filename",
  auth,
  requireRole(["seller", "user"]),
  validateParams(
    Joi.object({
      id: Joi.string().length(24).hex().required(),
      filename: Joi.string().pattern(/^[A-Za-z0-9_.-]+$/).required()
    })
  ),
  async (req, res) => {
  try {
    const { id, filename } = req.params;
    const ad = await Ad.findById(id);
    if (!ad) return res.status(404).json({ error: "Not found" });
    if (String(ad.userId) !== String(req.user.id)) return res.status(403).json({ error: "Forbidden" });
    const idx = (ad.images || []).indexOf(filename);
    if (idx === -1) return res.status(404).json({ error: "Image not found" });
    ad.images.splice(idx, 1);
    await ad.save();
    const uploadDir = path.join(process.cwd(), "uploads");
    const filePath = path.join(uploadDir, filename);
    fs.promises.unlink(filePath).catch(() => {});
    const base = filename.replace(/\.webp$/i, "");
    const thumbPath = path.join(uploadDir, `${base}.thumb.webp`);
    fs.promises.unlink(thumbPath).catch(() => {});
    const updated = await Ad.findById(id).lean();
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
  });

// Delete ad -> Soft delete instead of hard delete
router.delete("/:id", auth, async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);
    if (!ad) return res.status(404).json({ error: "Not found" });
    if (String(ad.userId) !== String(req.user.id) && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Protection: Prevent deletion if sold and commission unpaid
    if (ad.sold || ad.status === "sold") {
      const CommissionModel = mongoose.model("Commission");
      const commission = await CommissionModel.findOne({ adId: ad._id });
      if (commission && commission.status !== "paid") {
        return res.status(400).json({ 
          error: "لا يمكن حذف إعلان مباع لم يتم دفع عمولته بعد. يرجى سداد العمولة أولاً أو التواصل مع الإدارة." 
        });
      }
    }

    // Perform Soft Delete
    await ad.softDelete(req.user.id, req.body.reason || "User requested deletion");
    
    // Log activity
    await logActivity({
      action: "DELETE_AD",
      entityType: "Ad",
      entityId: ad._id,
      performedBy: req.user.id,
      targetUser: ad.userId,
      metadata: { reason: req.body.reason },
      req
    });

    // Mark in SoldListing if exists
    try {
      await SoldListing.updateOne(
        { adId: ad._id },
        { $set: { isOriginalAdDeleted: true } }
      );
    } catch (soldErr) {
      console.error("Error updating SoldListing on soft delete:", soldErr);
    }

    res.json({ ok: true, message: "تم حذف الإعلان بنجاح" });
  } catch (error) {
    console.error("Delete ad error:", error);
    res.status(500).json({ error: "Server error" });
  }
});
// Get similar ads based on category, location, price and keywords
router.get("/:id/similar", async (req, res) => {
  try {
    const adId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(adId)) {
      return res.status(400).json({ error: "معرف الإعلان غير صالح" });
    }

    let ad = await Ad.findById(adId).lean();

    if (!ad) return res.status(404).json({ error: "الإعلان غير موجود" });

    const limit = parseInt(req.query.limit) || 10;
    const priceMargin = 0.2; // ±20%
    const minPrice = ad.price * (1 - priceMargin);
    const maxPrice = ad.price * (1 + priceMargin);

    // التحليل الأساسي للكلمات المفتاحية من العنوان
    const keywords = ad.title
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 5);

    // بناء الاستعلام الأساسي
    const query = {
      _id: { $ne: ad._id },
      status: "approved",
      expiresAt: { $gt: new Date() },
      isArchived: { $ne: true },
      sold: { $ne: true },
      isDeleted: { $ne: true },
      categoryId: ad.categoryId, // نفس الفئة (شرط أساسي)
    };

    // جلب المرشحين (نفس الفئة)
    let similarAds = await Ad.find(query)
      .select("_id title price currency priceOnContact images condition adType categoryId governorateId cityId userId featured isWelcomePromoted viewCount views contactsCount createdAt publishedAt expiresAt")
      .populate("governorateId", "name")
      .populate("cityId", "name")
      .populate({
        path: "categoryId",
        select: "name slug parentId",
        populate: {
          path: "parentId",
          select: "name"
        }
      })
      .populate("userId", "name avatar verificationStatus role isVerifiedSeller isTrustedReseller sellerRating resellerRating sellerReviewsCount")
      .limit(50)
      .lean();

    if (similarAds.length === 0) return res.json([]);

    // حساب نقاط التشابه لكل إعلان
    const scoredAds = similarAds.map(item => {
      let score = 0;

      // 1. الموقع (المحافظة والمدينة)
      if (String(item.governorateId?._id || item.governorateId) === String(ad.governorateId?._id || ad.governorateId)) {
        score += 20; // نفس المحافظة
        if (String(item.cityId?._id || item.cityId) === String(ad.cityId?._id || ad.cityId)) {
          score += 30; // نفس المدينة (أولوية أعلى)
        }
      }

      // 2. السعر (ضمن نطاق ±20%)
      if (item.price >= minPrice && item.price <= maxPrice) {
        score += 40;
        // كلما كان السعر أقرب، زادت النقاط
        const priceDiff = Math.abs(item.price - ad.price);
        const priceCloseness = 1 - (priceDiff / (ad.price * priceMargin));
        score += priceCloseness * 20;
      }

      // 3. مطابقة الكلمات المفتاحية في العنوان
      const itemTitle = item.title.toLowerCase();
      let keywordMatches = 0;
      keywords.forEach(kw => {
        if (itemTitle.includes(kw)) keywordMatches++;
      });
      score += (keywordMatches / keywords.length) * 50;

      // 4. الحداثة (إضافة نقاط بسيطة للإعلانات الأحدث)
      const daysOld = (new Date() - new Date(item.createdAt)) / (1000 * 60 * 60 * 24);
      score += Math.max(0, 10 - daysOld);

      return { ...item, score };
    });

    // الترتيب حسب النقاط الأعلى
    const finalAds = scoredAds
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    res.json(finalAds);
  } catch (error) {
    console.error("Similar ads error:", error);
    res.status(500).json({ error: "فشل جلب الإعلانات المشابهة" });
  }
});

router.post("/:id/contact", async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);
    if (!ad) return res.status(404).json({ error: "Ad not found" });
    
    // We don't need authentication here necessarily as any visitor can contact.
    // To prevent abuse, we could check for a flag in session or localStorage.
    
    ad.contactsCount = (ad.contactsCount || 0) + 1;
    await ad.save();
    
    res.json({ success: true, contactsCount: ad.contactsCount });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Mark as sold and select buyer from conversations
router.patch(
  "/:id/mark-sold",
  auth,
  requireRole(["seller"]),
  validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })),
  validateBody(Joi.object({
    buyerId: Joi.string().length(24).hex().required(),
    buyerType: Joi.string().valid("DIRECT", "SECURE").default("DIRECT"),
    price: Joi.number().min(0).optional(),
    currency: Joi.string().valid("YER", "YER_ADEN", "YER_SANAA", "SAR", "USD").optional()
  })),
  async (req, res) => {
    try {
      const ad = await Ad.findById(req.params.id);
      if (!ad) return res.status(404).json({ error: "الإعلان غير موجود" });
      if (String(ad.userId) !== String(req.user.id)) return res.status(403).json({ error: "غير مصرح لك" });
      
      const { buyerId, buyerType } = req.body;
      
      ad.status = "sold";
      ad.sold = true;
      ad.soldAt = new Date();
      ad.buyerId = buyerId;
      ad.buyerType = buyerType;
      await ad.save();

      try {
        if (!AD_COMMISSION_ENABLED) return res.json({ success: true, ad });
        const CommissionModel = mongoose.model("Commission");
        let commission = await CommissionModel.findOne({ adId: ad._id });
        
        const { price: providedPrice, currency: providedCurrency } = req.body || {};
        const price = (providedPrice && Number(providedPrice) > 0) ? Number(providedPrice) : (Number(ad.price) || 0);
        const resolvedCurrency = providedCurrency || ad.currency || "YER_ADEN";
        const commissionAmount = calculateSellerCommission(price);

        if (!commission) {
          commission = await CommissionModel.create({
            adId: ad._id,
            sellerId: ad.userId,
            buyerId: buyerId,
            price: price,
            currency: resolvedCurrency,
            commissionAmount: commissionAmount,
            status: "unpaid",
            commissionStatus: "pending_payment",
            soldAt: ad.soldAt,
          });
        }

        const adWithCategory = await Ad.findById(ad._id).populate("categoryId", "name").lean();
        await SoldListing.findOneAndUpdate(
          { adId: ad._id },
          {
            adId: ad._id,
            sellerId: ad.userId,
            buyerId: buyerId,
            title: ad.title,
            price: price,
            currency: resolvedCurrency,
            categoryName: adWithCategory?.categoryId?.name || "N/A",
            images: ad.images || [],
            commissionId: commission._id,
            commissionAmount: commissionAmount,
            commissionStatus: commission.status,
            soldAt: ad.soldAt,
            buyerType: buyerType
          },
          { upsert: true, new: true }
        );
      } catch (commErr) {
        console.error("Commission/SoldListing creation error in mark-sold:", commErr);
      }

      // Notify the buyer
      try {
        await createNotification(req.app, {
          userId: buyerId,
          type: "ad_status",
          title: "مبروك! تم إتمام عملية الشراء",
          body: `تم تحديدك كمشترٍ لـ: ${ad.title}. يمكنك الآن تقييم التجربة.`,
          data: { adId: ad._id, sellerId: ad.userId }
        });
      } catch (notifErr) {
        console.error("Error notifying buyer about sale:", notifErr);
      }

      res.json({ success: true, ad });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  }
);

// Get potential buyers for an ad (participants in conversations)
router.get(
  "/:id/potential-buyers",
  auth,
  requireRole(["seller"]),
  validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })),
  async (req, res) => {
    try {
      const Conversation = (await import("../models/Conversation.js")).default;
      const conversations = await Conversation.find({ 
        adId: req.params.id,
        participants: req.user.id 
      }).populate("participants", "name avatar email phone").lean();

      const buyers = conversations.map(c => {
        const buyer = c.participants.find(p => String(p._id) !== String(req.user.id));
        return buyer;
      }).filter(Boolean);

      res.json(buyers);
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  }
);

export default router;
