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
        exchangeRates
      } = req.body;
      let settings = await SystemSettings.getSettings();
      
      if (adReviewMode) settings.adReviewMode = adReviewMode;
      if (adReviewDelayMinutes !== undefined) settings.adReviewDelayMinutes = adReviewDelayMinutes;
      if (prohibitedKeywords) settings.prohibitedKeywords = prohibitedKeywords;
      if (withdrawalIdentityThresholdUsd !== undefined) settings.withdrawalIdentityThresholdUsd = withdrawalIdentityThresholdUsd;
      if (exchangeRates) settings.exchangeRates = { ...settings.exchangeRates, ...exchangeRates };
      
      settings.updatedBy = req.user.id;
      await settings.save();
      
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Server error" });
    }
  }
);

export default router;
