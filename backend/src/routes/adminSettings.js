import { Router } from "express";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import adminAudit from "../middleware/adminAudit.js";
import SystemSettings from "../models/SystemSettings.js";
import { normalizeExchangeRatePairs, normalizeExchangeRates } from "../utils/exchangeRates.js";
import Joi from "joi";
import { validateBody } from "../middleware/validate.js";

const router = Router();

// Get public settings (withdrawal threshold, exchange rates, brokerage status) - Public access
router.get("/public", async (req, res) => {
  try {
    const settings = await SystemSettings.getSettings();
    res.json({
      withdrawalIdentityThresholdUsd: settings.withdrawalIdentityThresholdUsd,
      exchangeRates: normalizeExchangeRates(
        settings.exchangeRates?.toObject?.() || settings.exchangeRates,
        settings.exchangeRatePairs?.toObject?.() || settings.exchangeRatePairs
      ),
      exchangeRatePairs: normalizeExchangeRatePairs(
        settings.exchangeRatePairs?.toObject?.() || settings.exchangeRatePairs
      ),
      brokerageEnabled: settings.brokerageEnabled !== false,
      exchangeRatesUpdatedAt: settings.exchangeRatesUpdatedAt
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Admin-only routes below
router.use(auth, requireRole(["admin"]));

// Get current settings
router.get("/", async (req, res) => {
  try {
    const settings = await SystemSettings.getSettings();
    const response = settings.toObject();
    const legacyRates = settings.exchangeRates?.toObject?.() || settings.exchangeRates;
    const ratePairs = settings.exchangeRatePairs?.toObject?.() || settings.exchangeRatePairs;
    response.exchangeRates = normalizeExchangeRates(legacyRates, ratePairs);
    response.exchangeRatePairs = normalizeExchangeRatePairs(ratePairs);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Update settings
router.patch(
  "/",
  adminAudit(),
  validateBody(
    Joi.object({
      adReviewMode: Joi.string().valid("manual", "auto").optional(),
      adReviewDelayMinutes: Joi.number().valid(0, 5, 10, 15, -1).optional(),
      prohibitedKeywords: Joi.array().items(Joi.string()).optional(),
      withdrawalIdentityThresholdUsd: Joi.number().min(0).optional(),
      exchangeRates: Joi.object({
        USD: Joi.number().valid(1).optional(),
        SAR: Joi.number().positive().optional(),
        YER: Joi.number().positive().optional(),
        YER_SANAA: Joi.number().positive().optional(),
        YER_ADEN: Joi.number().positive().optional()
      }).optional(),
      exchangeRatePairs: Joi.object({
        SAR: Joi.object({
          buy: Joi.number().positive().required(),
          sell: Joi.number().positive().required()
        }).required(),
        YER_SANAA: Joi.object({
          buy: Joi.number().positive().required(),
          sell: Joi.number().positive().required()
        }).required(),
        YER_ADEN: Joi.object({
          buy: Joi.number().positive().required(),
          sell: Joi.number().positive().required()
        }).required()
      }).optional(),
      welcomePromotion: Joi.object({
        enabled: Joi.boolean().optional(),
        durationHours: Joi.number().min(1).optional(),
        maxBeneficiaries: Joi.number().min(0).optional(),
        endDate: Joi.date().allow(null).optional()
      }).optional(),
      brokerageEnabled: Joi.boolean().optional()
      ,referralProgram: Joi.object({
        programEnabled: Joi.boolean().optional(),
        defaultReferralRate: Joi.number().min(0).max(100).optional(),
        saleReferralRate: Joi.number().min(0).max(100).optional(),
        safePurchaseReferralRate: Joi.number().min(0).max(100).optional(),
        promotionReferralRate: Joi.number().min(0).max(100).optional(),
        minimumWithdrawal: Joi.object().optional(),
        pendingPeriod: Joi.number().min(0).optional(),
        maxDailyReferralRewards: Joi.number().min(0).optional(),
        maxDailyWithdrawals: Joi.number().min(0).optional(),
        fraudReviewEnabled: Joi.boolean().optional()
      }).optional()
    })
  ),
  async (req, res) => {
    try {
      const { 
        adReviewMode, 
        adReviewDelayMinutes, 
        prohibitedKeywords,
        withdrawalIdentityThresholdUsd,
        exchangeRates,
        exchangeRatePairs,
        welcomePromotion,
        brokerageEnabled,
        referralProgram
      } = req.body;
      
      // Get existing settings first
      let settings = await SystemSettings.getSettings();
      
      // Prepare update object
      const updateData = {
        updatedBy: req.user.id
      };
      
      if (adReviewMode) updateData.adReviewMode = adReviewMode;
      if (adReviewDelayMinutes !== undefined) updateData.adReviewDelayMinutes = adReviewDelayMinutes;
      if (prohibitedKeywords) updateData.prohibitedKeywords = prohibitedKeywords;
      if (withdrawalIdentityThresholdUsd !== undefined) updateData.withdrawalIdentityThresholdUsd = withdrawalIdentityThresholdUsd;
      if (exchangeRates) {
        const existingRates = settings.exchangeRates?.toObject?.() || settings.exchangeRates || {};
        const mergedRates = { ...existingRates, ...exchangeRates };
        if (exchangeRates.YER !== undefined && exchangeRates.YER_SANAA === undefined) {
          mergedRates.YER_SANAA = exchangeRates.YER;
        }
        updateData.exchangeRates = mergedRates;
        updateData.exchangeRatesUpdatedAt = new Date();
      }
      if (exchangeRatePairs) {
        const existingPairs = settings.exchangeRatePairs?.toObject?.() || settings.exchangeRatePairs || {};
        updateData.exchangeRatePairs = {
          ...normalizeExchangeRatePairs(existingPairs),
          ...exchangeRatePairs
        };
        updateData.exchangeRatesUpdatedAt = new Date();
      }
      if (welcomePromotion) {
        updateData.welcomePromotion = { ...settings.welcomePromotion, ...welcomePromotion };
      }
      if (brokerageEnabled !== undefined) {
        updateData.brokerageEnabled = brokerageEnabled;
      }
      if (referralProgram) {
        updateData.referralProgram = {
          ...settings.referralProgram?.toObject?.() || settings.referralProgram,
          ...referralProgram,
          minimumWithdrawal: {
            ...settings.referralProgram?.minimumWithdrawal?.toObject?.() || settings.referralProgram?.minimumWithdrawal,
            ...referralProgram.minimumWithdrawal
          }
        };
      }
      
      // Update and return new document
      const updatedSettings = await SystemSettings.findOneAndUpdate(
        { _id: settings._id },
        updateData,
        { new: true, runValidators: true }
      );
      
      const response = updatedSettings.toObject();
      const legacyRates = updatedSettings.exchangeRates?.toObject?.() || updatedSettings.exchangeRates;
      const ratePairs = updatedSettings.exchangeRatePairs?.toObject?.() || updatedSettings.exchangeRatePairs;
      response.exchangeRates = normalizeExchangeRates(legacyRates, ratePairs);
      response.exchangeRatePairs = normalizeExchangeRatePairs(ratePairs);
      res.json(response);
    } catch (error) {
      console.error("Error updating admin settings:", error);
      res.status(500).json({ error: "Server error", details: error.message });
    }
  }
);

// Reset Welcome Promotion Counter
router.post("/welcome-promotion/reset", async (req, res) => {
  try {
    let settings = await SystemSettings.getSettings();
    settings.welcomePromotion.usedCount = 0;
    await settings.save();
    res.json({ success: true, usedCount: 0 });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Get Welcome Promotion Stats
router.get("/welcome-promotion/stats", async (req, res) => {
  try {
    const Ad = (await import("../models/Ad.js")).default;
    const settings = await SystemSettings.getSettings();
    const wp = settings.welcomePromotion || {};
    const wpStats = wp.stats || {};
    
    // إجمالي المستفيدين (تاريخياً) - الذين استخدموا التجربة المجانية فعلياً
    const totalBeneficiaries = wp.usedCount || 0;

    // المتبقي من الكوتا
    const remainingQuota = Math.max(0, wp.maxBeneficiaries - wp.usedCount);

    // العروض النشطة حالياً
    const activePromotions = await Ad.countDocuments({ isWelcomePromoted: true });

    // عدد الذين اشتروا التمييز بعد التجربة
    const convertedAds = wpStats.totalConversions || 0;

    res.json({
      totalBeneficiaries,
      activePromotions,
      remainingQuota,
      convertedAds,
      purchasedAfterTrialCount: convertedAds, // Alias for clarity as requested
      conversionRate: totalBeneficiaries > 0 ? (convertedAds / totalBeneficiaries * 100).toFixed(2) : 0,
      summaryShownCount: wpStats.summaryShownCount || 0,
      promoteClickCount: wpStats.promoteClickCount || 0,
      clickThroughRate: wpStats.summaryShownCount > 0 ? (wpStats.promoteClickCount / wpStats.summaryShownCount * 100).toFixed(2) : 0
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
