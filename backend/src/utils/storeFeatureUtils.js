import StoreSubscription from "../models/StoreSubscription.js";
import { STORE_PLAN_FEATURE_DEFAULTS } from "../models/Plan.js";
import { validateStoreLocation as validateStoreLocationBase } from "./storeValidation.js";

export const STORE_PLAN_FEATURE_KEYS = Object.keys(STORE_PLAN_FEATURE_DEFAULTS);
const LEGACY_ACTIVE_STORE_FEATURE_KEYS = new Set(["pwa", "multipleContacts", "delivery"]);

export function normalizeStorePlanFeatures(features) {
  if (Array.isArray(features)) {
    const normalized = { ...STORE_PLAN_FEATURE_DEFAULTS };
    for (const feature of features) {
      if (typeof feature === "string" && LEGACY_ACTIVE_STORE_FEATURE_KEYS.has(feature)) {
        normalized[feature] = true;
      }
    }
    return normalized;
  }

  if (!features || typeof features !== "object") return { ...STORE_PLAN_FEATURE_DEFAULTS };
  return Object.fromEntries(STORE_PLAN_FEATURE_KEYS.map((feature) => [
    feature,
    typeof features[feature] === "boolean" ? features[feature] : false
  ]));
}

export function getLegacyStorePlanFeatures(features, previousLegacyFeatures = []) {
  const legacyFeatures = Array.isArray(features)
    ? features.filter((feature) => typeof feature === "string" && !LEGACY_ACTIVE_STORE_FEATURE_KEYS.has(feature))
    : (features && typeof features === "object"
      ? Object.keys(features).filter((feature) => !STORE_PLAN_FEATURE_KEYS.includes(feature))
      : []);
  return [...new Set([...previousLegacyFeatures, ...legacyFeatures])];
}

export function hasStorePlanFeature(plan, featureName) {
  if (!plan || typeof featureName !== "string") return false;

  const hasExplicitStoreType = typeof plan.type === "string" && ["store", "family-production"].includes(plan.type);
  const hasPlanFeatureMap = Object.prototype.hasOwnProperty.call(plan, "features") || Array.isArray(plan);
  if (!hasExplicitStoreType && !hasPlanFeatureMap) return false;

  const features = plan.features ?? plan;
  if (Array.isArray(features)) return normalizeStorePlanFeatures(features)[featureName] === true;

  if (features && typeof features === "object") {
    if (Object.prototype.hasOwnProperty.call(features, featureName)
      && typeof features[featureName] === "boolean") {
      return features[featureName];
    }
    return normalizeStorePlanFeatures(features)[featureName] === true;
  }

  return false;
}

export function hasStoreFeature(store, featureName) {
  if (store?.type === "store" || store?.type === "family-production") {
    return hasStorePlanFeature(store, featureName);
  }

  const storeSubscription = store?.subscription || store?.currentSubscription || null;
  const subscription = storeSubscription || store?.subscriptionInfo || null;

  const status = subscription ? StoreSubscription.getStoreSubscriptionStatus(subscription) : "inactive";
  if (status !== "active") return false;

  const plan = subscription?.planId || subscription?.plan || store?.plan || null;
  return hasStorePlanFeature(plan, featureName);
}

export function planSupportsStoreFeature(plan, featureName) {
  return hasStorePlanFeature(plan, featureName);
}

export function validateStoreLocation(args) {
  return validateStoreLocationBase(args);
}
