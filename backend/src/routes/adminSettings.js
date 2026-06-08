import { Router } from "express";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import adminAudit from "../middleware/adminAudit.js";
import SystemSettings from "../models/SystemSettings.js";
import Joi from "joi";
import { validateBody } from "../middleware/validate.js";

const router = Router();

// Get public settings (withdrawal threshold, exchange rates) - Public access
router.get("/public", async (req, res) => {
  try {
    const settings = await SystemSettings.getSettings();
    res.json({
      withdrawalIdentityThresholdUsd: settings.withdrawalIdentityThresholdUsd,
      exchangeRates: settings.exchangeRates
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
    res.json(settings);
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
        USD: Joi.number().min(0),
        SAR: Joi.number().min(0),
        YER: Joi.number().min(0),
        YER_ADEN: Joi.number().min(0)
      }).optional(),
      welcomePromotion: Joi.object({
        enabled: Joi.boolean(),
        durationHours: Joi.number().min(1),
        maxBeneficiaries: Joi.number().min(0),
        endDate: Joi.date().allow(null)
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
        welcomePromotion
      } = req.body;
      let settings = await SystemSettings.getSettings();
      
      if (adReviewMode) settings.adReviewMode = adReviewMode;
      if (adReviewDelayMinutes !== undefined) settings.adReviewDelayMinutes = adReviewDelayMinutes;
      if (prohibitedKeywords) settings.prohibitedKeywords = prohibitedKeywords;
      if (withdrawalIdentityThresholdUsd !== undefined) settings.withdrawalIdentityThresholdUsd = withdrawalIdentityThresholdUsd;
      if (exchangeRates) settings.exchangeRates = { ...settings.exchangeRates, ...exchangeRates };
      if (welcomePromotion) {
        settings.welcomePromotion = { ...settings.welcomePromotion, ...welcomePromotion };
      }
      
      settings.updatedBy = req.user.id;
      await settings.save();
      
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Server error" });
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
