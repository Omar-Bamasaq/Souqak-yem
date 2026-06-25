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
import { requireRole } from "../middleware/roles.js";
import { uploadImages } from "../middleware/upload.js";
import City from "../models/City.js";
import fs from "fs";
import path from "path";
import Notification from "../models/Notification.js";
import { createNotification, createAdminNotification } from "../services/notificationService.js";
import User from "../models/User.js";
import rateLimit from "../middleware/rateLimit.js";
import optionalAuth from "../middleware/optionalAuth.js";
import AdView from "../models/AdView.js";
import SystemSettings from "../models/SystemSettings.js";
import Commission from "../models/Commission.js";
import Joi from "joi";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import processImages from "../middleware/processImages.js";
import ListingService from "../services/listingService.js";
import SmartSearchService from "../services/smartSearchService.js";
import Favorite from "../models/Favorite.js";
import { logActivity } from "../services/activityLogService.js";
import { protectSensitiveFields } from "../middleware/protectSensitiveFields.js";

const router = Router();

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
  subCategoryId: Joi.string().length(24).hex().optional(), // Used in smart-search
  userLat: Joi.number().optional(), // Used in smart-search
  userLng: Joi.number().optional() // Used in smart-search
}).pattern(/^attr_/, Joi.string().max(200)) // السماح بمفاتيح attr_* كقيمة نصية فقط
  .unknown(false); // رفض أي مفاتيح غير معروفة

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

    const filter = { 
      status: "approved", 
      isArchived: { $ne: true }, 
      sold: { $ne: true },
      isVisible: { $ne: false },
      isDeleted: { $ne: true }
    };
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
    let sortSpec = { featured: -1, createdAt: -1 };
    if (sort === "price_asc" || sort === "cheap") sortSpec = { featured: -1, price: 1, createdAt: -1 };
    else if (sort === "price_desc" || sort === "expensive") sortSpec = { featured: -1, price: -1, createdAt: -1 };
    else if (sort === "old") sortSpec = { featured: -1, createdAt: 1 };
    else if (sort === "views") sortSpec = { featured: -1, viewCount: -1, createdAt: -1 };
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
      .populate("userId", "name avatar isVerifiedSeller sellerRating sellerReviewsCount")
      .sort(sortSpec)
      .skip((p - 1) * l)
      .limit(l)
      .lean();
    countQuery = Ad.countDocuments(filter);

    const [list, total] = await Promise.all([baseQuery, countQuery]);
    res.json({ items: list, page: p, limit: l, total, pages: Math.ceil(total / l) });
  } catch (error) {
    console.error("Ads GET error:", error);
    res.status(500).json({ error: error.message || "Server error" });
  }
});

router.get("/my", auth, async (req, res) => {
  try {
    const { status } = req.query || {};
    const filter = { userId: req.user.id, isDeleted: { $ne: true } };
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
      sort: sort || "relevance"
    });

    if (q) {
      SmartSearchService.trackSearch(userId, q).catch(console.error);
    }

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

router.get("/:id/owner", auth, requireRole(["seller"]), async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id)
      .populate("governorateId", "name")
      .populate("cityId", "name")
      .lean();
    if (!ad) return res.status(404).json({ error: "Not found" });
    if (String(ad.userId) !== String(req.user.id)) return res.status(403).json({ error: "Forbidden" });
    const values = await ListingService.getListingAttributes(ad._id);
    res.json({ ...ad, attributes: values });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/:id/unfeature", auth, requireRole(["seller"]), async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);
    if (!ad) return res.status(404).json({ error: "Not found" });
    if (String(ad.userId) !== String(req.user.id)) return res.status(403).json({ error: "Forbidden" });
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

router.get("/:id", optionalAuth, async (req, res) => {
  try {
    const adId = req.params.id;
    let ad = await Ad.findById(adId)
      .populate("governorateId", "name")
      .populate("cityId", "name")
      .populate("categoryId", "name slug image parentId")
      .populate("userId", "name avatar isVerifiedSeller isTrustedReseller createdAt")
      .lean();
    
    if (!ad) return res.status(404).json({ error: "Not found" });

    // Logic for restricted ads (only owner or admin can see)
    if (ad.status !== "approved") {
      const isAdmin = req.user?.role === "admin";
      const isOwner = req.user && String(ad.userId?._id || ad.userId) === String(req.user.id);
      
      if (!isAdmin && !isOwner) {
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
      attributes = await ListingService.getListingAttributes(ad._id);
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
    price: Joi.number().min(0).optional() // تجاهل القيمة واستخدام سعر قاعدة البيانات
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
        const CommissionModel = mongoose.model("Commission");
        let commission = await CommissionModel.findOne({ adId: updatedAd._id });
        
        // استخدام السعر من قاعدة البيانات حصراً لمنع التلاعب بالعمولات
        const price = Number(updatedAd.price) || 0;
        const commissionAmount = Math.round(price * 0.01);

        if (!commission) {
          commission = await CommissionModel.create({
            adId: updatedAd._id,
            sellerId: updatedAd.userId,
            price: price,
            currency: updatedAd.currency || "YER_ADEN",
            commissionAmount: commissionAmount,
            status: "unpaid",
            commissionStatus: "pending_payment",
            soldAt: updatedAd.soldAt,
          });
        }

        // Create SoldListing snapshot
        await SoldListing.findOneAndUpdate(
          { adId: updatedAd._id },
          {
            adId: updatedAd._id,
            sellerId: updatedAd.userId,
            title: updatedAd.title,
            price: price,
            currency: updatedAd.currency || "YER_ADEN",
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
    const { status } = req.body; // 'sold' or 'still_available'
    const ad = await Ad.findById(req.params.id);
    if (!ad) return res.status(404).json({ error: "الإعلان غير موجود" });
    if (String(ad.userId) !== String(req.user.id)) return res.status(403).json({ error: "غير مصرح لك بتعديل هذا الإعلان" });

    ad.followUpStatus = "responded";
    
    if (status === "sold") {
      ad.sold = true;
      ad.status = "sold";
      ad.soldAt = new Date();
      await ad.save();

      // إنشاء العمولة تلقائياً
      try {
        const CommissionModel = mongoose.model("Commission");
        const price = Number(ad.price) || 0;
        const commissionAmount = Math.round(price * 0.01);

        const commission = await CommissionModel.create({
          adId: ad._id,
          sellerId: ad.userId,
          price: price,
          currency: ad.currency || "YER_ADEN",
          commissionAmount: commissionAmount,
          status: "unpaid",
          commissionStatus: "pending_payment",
          soldAt: ad.soldAt,
        });

        // إنشاء نسخة في SoldListing
        const adWithCategory = await Ad.findById(ad._id).populate("categoryId", "name").lean();
        await SoldListing.create({
          adId: ad._id,
          sellerId: ad.userId,
          title: ad.title,
          price: price,
          currency: ad.currency || "YER_ADEN",
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
      // إذا كان لا يزال متاحاً، نقوم بتحديث تاريخ النشر ليعود للمقدمة (اختياري)
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

      // Record the new view
      await AdView.create({ adId, userId, ip });

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

const createAdRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 ads per 15 mins
  message: "لقد تجاوزت الحد المسموح به لنشر الإعلانات. يرجى الانتظار قليلاً."
});

router.post(
  "/",
  auth,
  requireRole(["seller"]),
  createAdRateLimit,
  uploadImages.array("images", 10),
  processImages(),
  parseJsonAttributes,
  validateBody(
    Joi.object({
      title: Joi.string().trim().min(3).max(120).required(),
      description: Joi.string().allow("").max(2000).optional(),
      price: Joi.number().min(0).optional().default(0),
      currency: Joi.string().valid("YER", "YER_ADEN", "YER_SANAA", "SAR", "USD").default("USD"),
      governorateId: Joi.string().length(24).hex().required(),
      cityId: Joi.string().length(24).hex().required(),
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
      isResellEnabled, commissionType, commissionValue, maxResellPrice, allowAutoApproval, maxResellers
    } = req.body || {};

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
      governorateId,
      cityId,
      categoryId: categoryId || null,
      adType: adType || "sell",
      location: (typeof lat !== "undefined" && typeof lng !== "undefined" && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)))
        ? { type: "Point", coordinates: [Number(lng), Number(lat)] }
        : undefined,
      images: filenames,
      status,
      scheduledPublishAt,
      publishedAt,
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
      condition: condition || "used",
      negotiable: !!negotiable,
      priceOnContact: !!priceOnContact,
      contactInfo: {
        showPhone: showPhone || false,
        phone: phone || "",
        showWhatsApp: showWhatsApp || false,
        whatsapp: whatsapp || ""
      }
    });
    if (Array.isArray(attributes) && attributes.length > 0) {
      // Save attributes using the new consolidated system
      await ListingService.saveAttributeValues(ad._id, attributes);
    }

    // Send admin notification for new ad (especially if pending)
    await createAdminNotification(req.app, {
      type: status === "pending" ? "ad_pending" : "new_ad",
      title: status === "pending" ? "إعلان جديد قيد المراجعة" : "إعلان جديد تم نشره",
      message: `تم إضافة إعلان جديد: ${title}`,
      link: "/admin/products",
      data: { adId: ad._id }
    });

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
router.patch(
  "/:id",
  auth,
  requireRole(["seller"]),
  protectSensitiveFields,
  uploadImages.array("images", 10),
  processImages(),
  validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })),
  parseJsonAttributes,
  validateBody(
    Joi.object({
      title: Joi.string().trim().min(3).max(120).optional(),
      description: Joi.string().allow("").max(2000).optional(),
      price: Joi.number().min(0).optional(),
      currency: Joi.string().valid("YER", "YER_ADEN", "YER_SANAA", "SAR", "USD").optional(),
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
      isResellEnabled: Joi.boolean().optional(),
      commissionType: Joi.string().valid("fixed", "percentage").optional(),
      commissionValue: Joi.number().min(0).optional(),
      maxResellPrice: Joi.number().min(0).optional().allow(null, ""),
      allowAutoApproval: Joi.boolean().optional(),
      maxResellers: Joi.number().min(1).optional(),
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
      showPhone, phone, showWhatsApp, whatsapp, negotiable, priceOnContact,
      isResellEnabled, commissionType, commissionValue, maxResellPrice, allowAutoApproval, maxResellers
    } = req.body || {};
    const ad = await Ad.findById(req.params.id);
    if (!ad) return res.status(404).json({ error: "Not found" });
    if (String(ad.userId) !== String(req.user.id)) return res.status(403).json({ error: "Forbidden" });
    if (governorateId && cityId) {
      const city = await City.findById(cityId).lean();
      if (!city) return res.status(400).json({ error: "Invalid city" });
      if (String(city.governorateId) !== String(governorateId)) {
        return res.status(400).json({ error: "City does not belong to governorate" });
      }
    }
    if (title) ad.title = title;
    if (typeof description !== "undefined") ad.description = description;
    if (price) ad.price = price;
    if (currency) ad.currency = currency;
    if (governorateId) ad.governorateId = governorateId;
    if (cityId) ad.cityId = cityId;
    if (categoryId !== undefined) ad.categoryId = categoryId || null;
    if (typeof lat !== "undefined" && typeof lng !== "undefined" && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
      ad.location = { type: "Point", coordinates: [Number(lng), Number(lat)] };
    }
    if (condition) ad.condition = condition;
    if (tags) ad.tags = tags;
    if (tagNames) ad.tagNames = tagNames;
    if (typeof showPhone !== "undefined") ad.contactInfo.showPhone = showPhone;
    if (phone) ad.contactInfo.phone = phone;
    if (typeof showWhatsApp !== "undefined") ad.contactInfo.showWhatsApp = showWhatsApp;
    if (whatsapp) ad.contactInfo.whatsapp = whatsapp;
    if (typeof negotiable !== "undefined") ad.negotiable = !!negotiable;
    if (typeof priceOnContact !== "undefined") ad.priceOnContact = !!priceOnContact;
    
    // Update Resell fields
    if (typeof isResellEnabled !== "undefined") ad.isResellEnabled = isResellEnabled === true || isResellEnabled === "true";
    if (commissionType) ad.commissionType = commissionType;
    if (typeof commissionValue !== "undefined") ad.commissionValue = Number(commissionValue);
    if (typeof maxResellPrice !== "undefined") ad.maxResellPrice = (maxResellPrice && maxResellPrice !== "") ? Number(maxResellPrice) : undefined;
    if (typeof allowAutoApproval !== "undefined") ad.allowAutoApproval = allowAutoApproval !== false && allowAutoApproval !== "false";
    if (maxResellers) ad.maxResellers = Number(maxResellers);

    const filenames = (req.files || []).map((f) => f.optimizedFilename || f.filename);
    if (filenames.length > 0) {
      ad.images = [...(ad.images || []), ...filenames];
    }
    if (ad.status === "rejected" || ad.status === "expired") {
      ad.status = "pending";
      ad.publishedAt = undefined;
      ad.expiresAt = undefined;
      ad.expireReminderSent = false;
      
      // Auto-approval logic for edited ads that go back to pending
      const settings = await SystemSettings.getSettings();
      const contentToSearch = `${ad.title} ${ad.description || ""} ${ad.tagNames.join(" ")}`.toLowerCase();
      const hasProhibited = settings.prohibitedKeywords.some(keyword => contentToSearch.includes(keyword.toLowerCase()));

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
    if (Array.isArray(attributes) && attributes.length > 0) {
      // Save attributes using the consolidated system
      await ListingService.saveAttributeValues(ad._id, attributes);
    }
    const updated = await Ad.findById(req.params.id)
      .populate("governorateId", "name")
      .populate("cityId", "name")
      .lean();
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: e && e.message ? e.message : "Update error" });
  }
});

router.delete(
  "/:id/images/:filename",
  auth,
  requireRole(["seller"]),
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
      isArchived: { $ne: true },
      sold: { $ne: true },
      isDeleted: { $ne: true },
      categoryId: ad.categoryId, // نفس الفئة (شرط أساسي)
    };

    // جلب المرشحين (نفس الفئة)
    let similarAds = await Ad.find(query)
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
      .populate("userId", "name avatar isVerifiedSeller")
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
    buyerType: Joi.string().valid("DIRECT", "SECURE").default("DIRECT")
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

      // Create Commission and SoldListing snapshot
      try {
        const CommissionModel = mongoose.model("Commission");
        let commission = await CommissionModel.findOne({ adId: ad._id });
        
        const price = Number(ad.price) || 0;
        const commissionAmount = Math.round(price * 0.01);

        if (!commission) {
          commission = await CommissionModel.create({
            adId: ad._id,
            sellerId: ad.userId,
            buyerId: buyerId,
            price: price,
            currency: ad.currency || "YER_ADEN",
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
            currency: ad.currency || "YER_ADEN",
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
