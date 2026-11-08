import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  GENERAL_STORE_TEMPLATE,
  FAMILY_PRODUCTION_ACTIVITY_REGISTRY,
  STORE_ACTIVITY_REGISTRY,
  getFamilyProductionActivity,
  getStoreActivity,
  listFamilyProductionActivities,
  listStoreActivities,
  resolveStoreActivity
} from "../src/utils/storeActivityRegistry.js";

test("supported store activities have unique stable keys and valid template/category mappings", () => {
  const keys = STORE_ACTIVITY_REGISTRY.map(({ activityKey }) => activityKey);
  assert.equal(keys.length, 20);
  assert.deepEqual(keys, [
    "cars", "mobile-electronics", "furniture", "clothing-fashion", "perfumes-cosmetics",
    "food-grocery", "home-appliances-store", "building-materials", "books-stationery",
    "children-toys", "jewelry-watches", "sports-fitness", "agriculture-supplies",
    "household-decor", "gifts-flowers", "computers-networks", "spare-parts-equipment",
    "pet-supplies", "local-products", "general-variety"
  ]);
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual(
    STORE_ACTIVITY_REGISTRY.slice(0, 3).map(({ templateKey }) => templateKey),
    ["vehicle-dealer", "electronics-retail", "furniture-store"]
  );
  assert.deepEqual(getStoreActivity("cars").nameAr, "معرض سيارات");
  assert.deepEqual(getStoreActivity("furniture").nameAr, "متجر أثاث");
  assert.deepEqual(getStoreActivity("mobile-electronics").nameAr, "جوالات وإلكترونيات");
  assert.deepEqual(getStoreActivity("cars").allowedCategorySlugs.slice(0, 3), ["cars-for-sale", "cars-for-rent", "cars-transfer"]);
  assert.deepEqual(getStoreActivity("furniture").allowedCategorySlugs, ["bedrooms", "majalis", "kitchens", "tables-chairs", "office-furniture", "other-furniture"]);
  assert.ok(getStoreActivity("mobile-electronics").allowedCategorySlugs.includes("mobiles"));
  assert.ok(getStoreActivity("mobile-electronics").allowedCategorySlugs.includes("tablets"));
  for (const activity of STORE_ACTIVITY_REGISTRY) {
    assert.ok(activity.nameAr);
    assert.ok(activity.description);
    assert.ok(activity.presentationVariant);
    assert.ok(activity.allowedCategorySlugs.length > 0);
    assert.equal(new Set(activity.allowedCategorySlugs).size, activity.allowedCategorySlugs.length);
  }
});

test("activity lookup rejects unsupported keys and never accepts client template keys", () => {
  assert.equal(getStoreActivity("not-supported"), null);
  assert.equal(getStoreActivity({ activityKey: "cars", templateKey: "furniture-store" }), null);
  assert.equal(getStoreActivity("cars").templateKey, "vehicle-dealer");
  for (const activity of FAMILY_PRODUCTION_ACTIVITY_REGISTRY) {
    assert.equal(getStoreActivity(activity.activityKey), null);
  }
  for (const activity of STORE_ACTIVITY_REGISTRY) {
    assert.equal(getFamilyProductionActivity(activity.activityKey), null);
  }
});

test("legacy stores keep their old label and resolve to general-retail without assigning an activity", () => {
  assert.deepEqual(resolveStoreActivity({ businessActivity: "هواتف" }), {
    key: null,
    name: "هواتف",
    templateKey: GENERAL_STORE_TEMPLATE
  });
  assert.throws(() => resolveStoreActivity({ activityKey: "unknown-new-activity" }), /Unknown store activity/);
});

test("activity API projection does not expose mutable registry arrays", () => {
  const activities = listStoreActivities();
  activities[0].allowedCategorySlugs.push("client-added-category");
  assert.equal(getStoreActivity("cars").allowedCategorySlugs.includes("client-added-category"), false);
});

test("family production activities have dedicated templates and category allowlists", () => {
  assert.equal(FAMILY_PRODUCTION_ACTIVITY_REGISTRY.length, 18);
  assert.deepEqual(FAMILY_PRODUCTION_ACTIVITY_REGISTRY.map(({ activityKey }) => activityKey), [
    "family-food", "family-bakery", "family-preserved-food", "family-local-products",
    "family-handicrafts", "family-tailoring", "family-textiles", "family-perfumes",
    "family-care-products", "family-jewelry", "family-wood-pottery", "family-leather",
    "family-gifts-events", "family-candles-decor", "family-plants", "family-educational-toys",
    "family-art-calligraphy", "family-yemeni-crafts"
  ]);
  assert.equal(getFamilyProductionActivity("family-food").templateKey, "family-food");
  assert.ok(getFamilyProductionActivity("family-food").allowedCategorySlugs.includes("dry-foods"));
  assert.equal(getFamilyProductionActivity("cars"), null);
  assert.equal(listFamilyProductionActivities().length, 18);
  assert.equal(
    resolveStoreActivity({ storeType: "family-production", activityKey: "family-food" }).templateKey,
    "family-food"
  );
});

test("activity category allowlists only reference slugs present in category seeds", () => {
  const seedSource = fs.readFileSync(new URL("../seedCategories.js", import.meta.url), "utf8");
  for (const activity of [...STORE_ACTIVITY_REGISTRY, ...FAMILY_PRODUCTION_ACTIVITY_REGISTRY]) {
    for (const slug of activity.allowedCategorySlugs) {
      const categoryLine = seedSource.split("\n").find((line) => line.includes(`slug: "${slug}"`));
      assert.ok(categoryLine, `${activity.activityKey} references missing category ${slug}`);
      assert.match(categoryLine, /attributes\s*:/, `${slug} should define its product attributes`);
    }
  }
});