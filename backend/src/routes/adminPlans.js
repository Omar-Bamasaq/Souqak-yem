import { Router } from "express";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import Plan from "../models/Plan.js";
import PurchaseRequest from "../models/PurchaseRequest.js";
import { getFinalPrice } from "../utils/planUtils.js";
import { getLegacyStorePlanFeatures, normalizeStorePlanFeatures, STORE_PLAN_FEATURE_KEYS } from "../utils/storeFeatureUtils.js";

const router = Router();

class PlanValidationError extends Error {}

function normalizeStorePlanLimits(rawLimits = {}, fallback = {}) {
  if (!rawLimits || typeof rawLimits !== "object" || Array.isArray(rawLimits)) {
    throw new PlanValidationError("Store plan limits must be an object");
  }
  const knownLimitKeys = new Set(["maxCategories", "maxProducts", "max_categories", "max_products"]);
  if (Object.keys(rawLimits).some((key) => !knownLimitKeys.has(key))) {
    throw new PlanValidationError("Store plan limits contain an unknown field");
  }

  const next = {
    maxCategories: Number(fallback.maxCategories ?? 0),
    maxProducts: Number(fallback.maxProducts ?? 0)
  };

  const maxCategories = rawLimits.maxCategories ?? rawLimits.max_categories;
  const maxProducts = rawLimits.maxProducts ?? rawLimits.max_products;

  if (maxCategories !== undefined) {
    if (typeof maxCategories !== "number" || !Number.isInteger(maxCategories) || maxCategories < 0) {
      throw new PlanValidationError("Store plan maxCategories must be a non-negative integer");
    }
    next.maxCategories = maxCategories;
  }

  if (maxProducts !== undefined) {
    if (typeof maxProducts !== "number" || !Number.isInteger(maxProducts) || maxProducts < 0) {
      throw new PlanValidationError("Store plan maxProducts must be a non-negative integer");
    }
    next.maxProducts = maxProducts;
  }

  return next;
}

function validateStorePlanFeatures(features, fallback = {}) {
  if (!features || typeof features !== "object" || Array.isArray(features)) {
    throw new PlanValidationError("Store plan features must be an object");
  }
  const knownFeatures = new Set(STORE_PLAN_FEATURE_KEYS);
  if (Object.keys(features).some((feature) => !knownFeatures.has(feature))) {
    throw new PlanValidationError("Store plan features contain an unknown field");
  }
  if (Object.values(features).some((enabled) => typeof enabled !== "boolean")) {
    throw new PlanValidationError("Store plan feature values must be boolean");
  }
  return { ...normalizeStorePlanFeatures(fallback), ...features };
}

function isPlanValidationError(error) {
  return error instanceof PlanValidationError;
}

function normalizeStorePlanDesignStyle(style) {
  if (!["free", "normal", "business", "professional"].includes(style)) {
    throw new PlanValidationError("Invalid store plan design style");
  }
  return style;
}

function normalizeStorePlanCardCopy(tagline = "", highlights = []) {
  if (typeof tagline !== "string" || tagline.trim().length > 240) {
    throw new PlanValidationError("Plan card tagline must be 240 characters or fewer");
  }
  if (!Array.isArray(highlights) || highlights.length > 6
    || highlights.some((item) => typeof item !== "string" || item.trim().length > 120)) {
    throw new PlanValidationError("Plan card highlights must contain up to 6 short text items");
  }
  return {
    cardTagline: tagline.trim(),
    cardHighlights: highlights.map((item) => item.trim()).filter(Boolean)
  };
}

function normalizeAdServiceSettings(settings = {}) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    throw new PlanValidationError("Ad service settings must be an object");
  }
  const serviceType = settings.adServiceType ?? "featured";
  const positions = settings.adPositions ?? [];
  const rotationInterval = settings.rotationIntervalSeconds ?? 5;
  const delay = settings.interstitialDelaySeconds ?? 8;
  const frequencyCap = settings.frequencyCapHours ?? 24;
  const socialIncluded = settings.socialPromotionIncluded ?? false;
  const socialPrice = settings.socialPromotionPrice ?? 0;
  if (!["featured", "placement", "interstitial"].includes(serviceType)) {
    throw new PlanValidationError("Invalid ad service type");
  }
  if (!Array.isArray(positions) || positions.some((position) => !["home", "between_ads", "category"].includes(position))) {
    throw new PlanValidationError("Invalid ad placements");
  }
  if (serviceType === "placement" && positions.length === 0) {
    throw new PlanValidationError("Select at least one ad placement");
  }
  if (!Number.isInteger(rotationInterval) || rotationInterval < 1 || rotationInterval > 60) {
    throw new PlanValidationError("Placement rotation interval must be between 1 and 60 seconds");
  }
  if (!Number.isInteger(delay) || delay < 0 || delay > 120) {
    throw new PlanValidationError("Interstitial delay must be between 0 and 120 seconds");
  }
  if (!Number.isInteger(frequencyCap) || frequencyCap < 1 || frequencyCap > 720) {
    throw new PlanValidationError("Frequency cap must be between 1 and 720 hours");
  }
  if (typeof socialIncluded !== "boolean" || typeof socialPrice !== "number" || !Number.isSafeInteger(socialPrice) || socialPrice < 0) {
    throw new PlanValidationError("Invalid social promotion settings");
  }
  return {
    adServiceType: serviceType,
    adPositions: [...new Set(positions)],
    rotationIntervalSeconds: rotationInterval,
    interstitialDelaySeconds: delay,
    frequencyCapHours: frequencyCap,
    socialPromotionIncluded: socialIncluded,
    socialPromotionPrice: socialPrice
  };
}

router.use(auth, requireRole(["admin"]));

router.get("/", async (req, res) => {
  try {
    const plans = await Plan.find().sort({ type: 1, durationInDays: 1 }).lean();
    const plansWithCalculated = plans.map(p => ({
      ...p,
      ...(["store", "family-production"].includes(p.type) ? { features: normalizeStorePlanFeatures(p.features) } : {}),
      ...getFinalPrice(p)
    }));
    res.json(plansWithCalculated);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { 
      name, description, type, durationInDays, price, currency,
      discountType, discountValue, isSaleActive, saleStartDate, saleEndDate,
      saleLabel, saleType, applyToAllPlans, remainingSlots, isPopularOffer,
      isMostPopular, designStyle, cardTagline, cardHighlights,
      maxProducts, maxCategories, limits, features,
      adServiceType, adPositions, rotationIntervalSeconds, interstitialDelaySeconds, frequencyCapHours,
      socialPromotionIncluded, socialPromotionPrice
    } = req.body || {};
    
    if (!name || !type || durationInDays == null) return res.status(400).json({ error: "Missing fields" });
    if (!["verification", "featured", "store", "family-production"].includes(type)) return res.status(400).json({ error: "Invalid type" });
    if (isMostPopular !== undefined && typeof isMostPopular !== "boolean") {
      return res.status(400).json({ error: "Most popular setting must be boolean" });
    }
    if (String(name).trim().length > 120 || String(description || "").trim().length > 1000) {
      return res.status(400).json({ error: "Invalid plan name or description length" });
    }
    const normalizedPrice = Number(price ?? 0);
    if (!Number.isSafeInteger(normalizedPrice) || normalizedPrice < 0) {
      return res.status(400).json({ error: "Plan price must be a non-negative whole number" });
    }
    if (!Number.isInteger(Number(durationInDays)) || Number(durationInDays) < 1) {
      return res.status(400).json({ error: "Plan duration must be a positive integer" });
    }
    let normalizedLimits;
    if (["store", "family-production"].includes(type)) {
      normalizedLimits = normalizeStorePlanLimits(
        limits !== undefined ? limits : { maxProducts, maxCategories },
        {}
      );
    }

    const normalizedFeatures = ["store", "family-production"].includes(type)
      ? validateStorePlanFeatures(features === undefined ? {} : features)
      : (Array.isArray(features) ? features.map((feature) => String(feature).trim()).filter(Boolean) : []);
    const normalizedDesignStyle = ["store", "family-production"].includes(type)
      ? normalizeStorePlanDesignStyle(designStyle ?? "normal")
      : "normal";
    let cardCopy = { cardTagline: "", cardHighlights: [] };
    if (["store", "family-production"].includes(type)) {
      cardCopy = normalizeStorePlanCardCopy(cardTagline ?? "", cardHighlights ?? []);
    }
    const adServiceSettings = type === "featured"
      ? normalizeAdServiceSettings({
        adServiceType, adPositions, rotationIntervalSeconds, interstitialDelaySeconds, frequencyCapHours,
        socialPromotionIncluded, socialPromotionPrice
      })
      : {};
    if (type === "featured" && adServiceSettings.adServiceType !== "featured" && currency && currency !== "YER_ADEN") {
      return res.status(400).json({ error: "Advertising plans must use Yemeni rial" });
    }
    if (type === "featured" && adServiceSettings.adServiceType === "featured"
      && currency != null && !["YER_ADEN", "YER_SANAA"].includes(currency)) {
      return res.status(400).json({ error: "Advertising plans must use Yemeni rial" });
    }
    const planCurrency = type === "featured" && adServiceSettings.adServiceType !== "featured"
      ? "YER_ADEN"
      : (["SAR", "YER_ADEN", "YER_SANAA", "USD"].includes(currency) ? currency : "YER_ADEN");
    
    const planData = { 
      name: String(name).trim(), description: String(description || "").trim(),
      type, durationInDays: Number(durationInDays), price: normalizedPrice, currency: planCurrency,
      discountType, discountValue, isSaleActive, saleStartDate, saleEndDate,
      saleLabel, saleType, applyToAllPlans, remainingSlots, isPopularOffer,
      designStyle: normalizedDesignStyle,
      ...cardCopy,
      isMostPopular: false,
      features: normalizedFeatures,
      ...adServiceSettings,
      ...(normalizedLimits ? { limits: normalizedLimits } : {})
    };

    const plan = await Plan.create(planData);

    if (isMostPopular === true) {
      await Plan.updateMany({ _id: { $ne: plan._id }, type }, { $set: { isMostPopular: false } });
      await Plan.updateOne({ _id: plan._id }, { $set: { isMostPopular: true } });
      plan.isMostPopular = true;
    }

    // If applyToAllPlans is true, update all other plans with these sale settings
    if (applyToAllPlans) {
      await Plan.updateMany(
        { _id: { $ne: plan._id }, type },
        { 
          isSaleActive, 
          discountType, 
          discountValue, 
          saleStartDate, 
          saleEndDate, 
          saleLabel, 
          saleType,
          applyToAllPlans: true
        }
      );
    }

    res.status(201).json(plan);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Another plan of this service is already marked as most popular" });
    }
    res.status(isPlanValidationError(err) ? 400 : 500).json({
      error: isPlanValidationError(err) ? err.message : "Server error"
    });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const { 
      name, description, type, durationInDays, price, currency, isActive,
      discountType, discountValue, isSaleActive, saleStartDate, saleEndDate,
      saleLabel, saleType, applyToAllPlans, remainingSlots, isPopularOffer,
      isMostPopular, designStyle, cardTagline, cardHighlights,
      maxProducts, maxCategories, limits, features
      , adServiceType, adPositions, rotationIntervalSeconds, interstitialDelaySeconds, frequencyCapHours,
      socialPromotionIncluded, socialPromotionPrice
    } = req.body || {};

    const existingPlan = await Plan.findById(req.params.id).lean();
    if (!existingPlan) return res.status(404).json({ error: "Not found" });
    if (isMostPopular !== undefined && typeof isMostPopular !== "boolean") {
      return res.status(400).json({ error: "Most popular setting must be boolean" });
    }
    if (type != null && type !== existingPlan.type && await PurchaseRequest.exists({ plan: existingPlan._id })) {
      return res.status(409).json({ error: "A plan with existing requests cannot change service type" });
    }
    
    const update = {};
    if (name != null) {
      const normalizedName = String(name).trim();
      if (!normalizedName || normalizedName.length > 120) return res.status(400).json({ error: "Invalid plan name" });
      update.name = normalizedName;
    }
    if (description != null) {
      const normalizedDescription = String(description).trim();
      if (normalizedDescription.length > 1000) return res.status(400).json({ error: "Plan description must be 1000 characters or fewer" });
      update.description = normalizedDescription;
    }
    if (type != null) {
      if (!["verification", "featured", "store", "family-production"].includes(type)) {
        return res.status(400).json({ error: "Invalid type" });
      }
      update.type = type;
    }
    const resultingType = update.type || existingPlan.type;
    if (isMostPopular !== undefined) update.isMostPopular = isMostPopular;
    else if (resultingType !== existingPlan.type) update.isMostPopular = false;
    if (designStyle != null && ["store", "family-production"].includes(resultingType)) {
      try {
        update.designStyle = normalizeStorePlanDesignStyle(designStyle);
      } catch (error) {
        if (isPlanValidationError(error)) return res.status(400).json({ error: error.message });
        throw error;
      }
    }
    if (["store", "family-production"].includes(resultingType)
      && (cardTagline !== undefined || cardHighlights !== undefined)) {
      try {
        Object.assign(update, normalizeStorePlanCardCopy(
          cardTagline ?? existingPlan.cardTagline ?? "",
          cardHighlights ?? existingPlan.cardHighlights ?? []
        ));
      } catch (error) {
        if (isPlanValidationError(error)) return res.status(400).json({ error: error.message });
        throw error;
      }
    } else if (!["store", "family-production"].includes(resultingType) && type !== undefined) {
      update.cardTagline = "";
      update.cardHighlights = [];
    }
    if (durationInDays != null) {
      if (!Number.isInteger(Number(durationInDays)) || Number(durationInDays) < 1) {
        return res.status(400).json({ error: "Plan duration must be a positive integer" });
      }
      update.durationInDays = Number(durationInDays);
    }
    if ((update.type || existingPlan.type) === "featured"
      && durationInDays != null
      && (!Number.isInteger(durationInDays) || durationInDays < 1)) {
      return res.status(400).json({ error: "Ad plan duration must be a positive integer" });
    }
    if (price != null) {
      const normalizedPrice = Number(price);
      if (!Number.isSafeInteger(normalizedPrice) || normalizedPrice < 0) {
        return res.status(400).json({ error: "Plan price must be a non-negative whole number" });
      }
      update.price = normalizedPrice;
    }
    if (currency != null) {
      if (!["SAR", "YER_ADEN", "YER_SANAA", "USD"].includes(currency)) {
        return res.status(400).json({ error: "Invalid currency" });
      }
      update.currency = currency;
    }
    if (isActive != null) update.isActive = isActive;
    
    // Discount fields
    if (discountType != null) update.discountType = discountType;
    if (discountValue != null) update.discountValue = discountValue;
    if (isSaleActive != null) update.isSaleActive = isSaleActive;
    if (saleStartDate !== undefined) update.saleStartDate = saleStartDate;
    if (saleEndDate !== undefined) update.saleEndDate = saleEndDate;
    if (saleLabel != null) update.saleLabel = saleLabel;
    if (saleType != null) update.saleType = saleType;
    if (applyToAllPlans != null) update.applyToAllPlans = applyToAllPlans;
    if (remainingSlots != null) update.remainingSlots = remainingSlots;
    if (isPopularOffer != null) update.isPopularOffer = isPopularOffer;

    const isStorePlan = ["store", "family-production"].includes(update.type || existingPlan.type);
    const isAdPlan = (update.type || existingPlan.type) === "featured";
    if (isAdPlan && [
      adServiceType, adPositions, rotationIntervalSeconds, interstitialDelaySeconds, frequencyCapHours,
      socialPromotionIncluded, socialPromotionPrice
    ].some((value) => value !== undefined)) {
      Object.assign(update, normalizeAdServiceSettings({
        adServiceType: adServiceType ?? existingPlan.adServiceType,
        adPositions: adPositions ?? existingPlan.adPositions,
        rotationIntervalSeconds: rotationIntervalSeconds ?? existingPlan.rotationIntervalSeconds,
        interstitialDelaySeconds: interstitialDelaySeconds ?? existingPlan.interstitialDelaySeconds,
        frequencyCapHours: frequencyCapHours ?? existingPlan.frequencyCapHours,
        socialPromotionIncluded: socialPromotionIncluded ?? existingPlan.socialPromotionIncluded,
        socialPromotionPrice: socialPromotionPrice ?? existingPlan.socialPromotionPrice
      }));
      const resultingServiceType = update.adServiceType || existingPlan.adServiceType || "featured";
      if (resultingServiceType !== "featured") {
        if (currency != null && currency !== "YER_ADEN") {
          return res.status(400).json({ error: "Advertising plans must use Yemeni rial" });
        }
        update.currency = "YER_ADEN";
      }
    } else if (!isAdPlan && type !== undefined) {
      Object.assign(update, normalizeAdServiceSettings());
    }
    if (isStorePlan) {
      const normalizedLimits = normalizeStorePlanLimits(
        limits !== undefined ? limits : { maxProducts, maxCategories },
        existingPlan?.limits || {}
      );
      update.limits = normalizedLimits;
    } else if (type !== undefined && !["store", "family-production"].includes(type)) {
      update.limits = undefined;
    }

    if (features !== undefined) {
      update.features = isStorePlan
        ? validateStorePlanFeatures(features, existingPlan.features)
        : (Array.isArray(features) ? features.map((feature) => String(feature).trim()).filter(Boolean) : existingPlan.features);
      if (isStorePlan) {
        update.legacyFeatures = getLegacyStorePlanFeatures(existingPlan.features, existingPlan.legacyFeatures);
      }
    }

    if (update.isMostPopular === true) {
      await Plan.updateMany(
        { _id: { $ne: existingPlan._id }, type: resultingType },
        { $set: { isMostPopular: false } }
      );
    }

    const plan = await Plan.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
    if (!plan) return res.status(404).json({ error: "Not found" });

    // If applyToAllPlans is true, update all other plans
    if (applyToAllPlans && isSaleActive !== undefined) {
      const saleUpdate = {
        isSaleActive,
        discountType: discountType || plan.discountType,
        discountValue: discountValue || plan.discountValue,
        saleStartDate: saleStartDate !== undefined ? saleStartDate : plan.saleStartDate,
        saleEndDate: saleEndDate !== undefined ? saleEndDate : plan.saleEndDate,
        saleLabel: saleLabel || plan.saleLabel,
        saleType: saleType || plan.saleType,
        applyToAllPlans: true
      };
      await Plan.updateMany({ _id: { $ne: plan._id }, type: plan.type }, saleUpdate);
    }

    res.json(plan);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Another plan of this service is already marked as most popular" });
    }
    const validationError = isPlanValidationError(err);
    res.status(validationError ? 400 : 500).json({
      error: validationError ? message : "Server error"
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ error: "Not found" });
    const hasRequests = await PurchaseRequest.exists({ plan: plan._id });
    if (hasRequests) {
      plan.isActive = false;
      await plan.save();
      return res.json({ ok: true, archived: true, isActive: false });
    }
    await Plan.findByIdAndDelete(req.params.id);
    res.json({ ok: true, archived: false });
  } catch (error) {
    console.error("Failed to delete or archive plan:", error);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
