const LEGACY_ACTIVE_FEATURES = new Set(["pwa", "multipleContacts", "delivery"]);

export function hasStorePlanFeature(plan, feature) {
  const features = plan?.features;
  if (Array.isArray(features)) {
    return LEGACY_ACTIVE_FEATURES.has(feature) && features.includes(feature);
  }
  return Object.prototype.hasOwnProperty.call(features || {}, feature) && typeof features[feature] === "boolean"
    ? features[feature]
    : false;
}

export function getEnabledStorePlanFeatures(plan) {
  const features = plan?.features;
  if (Array.isArray(features)) {
    return features.filter((feature) => LEGACY_ACTIVE_FEATURES.has(feature));
  }
  if (!features || typeof features !== "object") return [];
  return Object.entries(features).filter(([, enabled]) => enabled === true).map(([feature]) => feature);
}
