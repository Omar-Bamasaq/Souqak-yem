import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CATEGORY_ICON_ALIASES,
  CATEGORY_ICON_BY_SLUG,
  getCategoryIconKey,
} from "../src/components/categoryIconMap.js";

test("maps all categories defined by the current seed to an SVG artwork key", () => {
  const seedSource = readFileSync(
    new URL("../../backend/seedCategories.js", import.meta.url),
    "utf8"
  );
  const seededSlugs = [...seedSource.matchAll(/slug:\s*"([^"]+)"/g)].map(
    ([, slug]) => slug
  );

  assert.equal(new Set(seededSlugs).size, seededSlugs.length);
  assert.deepEqual(
    Object.keys(CATEGORY_ICON_BY_SLUG).sort(),
    [...new Set(seededSlugs)].sort()
  );
  assert.ok(Object.values(CATEGORY_ICON_BY_SLUG).every(Boolean));
});

test("resolves known slugs, live Arabic aliases, and category keys", () => {
  assert.equal(getCategoryIconKey("cars"), "marketCars");
  assert.equal(getCategoryIconKey({ slug: "mobiles" }), "phone");
  assert.equal(getCategoryIconKey({ key: "real-estate" }), "marketProperty");
  assert.equal(getCategoryIconKey({ slug: "المركبات" }), "marketCars");
  assert.equal(getCategoryIconKey({ slug: "المركبات-الخاصة" }), "marketSpecialVehicles");
  assert.equal(getCategoryIconKey({ name: "الأدوات المكتبية" }), "marketStationery");
});

test("uses branded artwork for every current main category slug", () => {
  const mainCategories = [
    ["المركبات", "marketCars"],
    ["real-estate", "marketProperty"],
    ["electronics", "marketElectronics"],
    ["furniture", "marketFurniture"],
    ["jobs", "marketJobs"],
    ["animals", "marketAnimals"],
    ["fashion", "marketFashion"],
    ["games-entertainment", "marketGames"],
    ["services", "marketServices"],
    ["tools-equipment", "marketTools"],
    ["special-vehicles", "marketSpecialVehicles"],
    ["travel-tourism", "marketTravel"],
    ["الأدوات-المكتبية", "marketStationery"],
    ["sports-equipment", "marketSports"],
    ["health-beauty", "marketBeauty"],
    ["books-magazines", "marketBooks"],
    ["musical-instruments", "marketMusic"],
    ["foodstuffs", "marketFood"],
    ["home-appliances", "marketAppliances"],
    ["home-energy-systems", "marketEnergy"],
    ["purchase-orders", "marketOrders"],
    ["other-main", "marketOther"],
  ];

  for (const [slug, artwork] of mainCategories) {
    assert.equal(getCategoryIconKey({ slug }), artwork, `expected artwork for ${slug}`);
  }
});

test("every mapped artwork key has an SVG renderer", () => {
  const componentSource = readFileSync(
    new URL("../src/components/CategoryIcon.jsx", import.meta.url),
    "utf8"
  );
  const artworkKeys = new Set(
    [...componentSource.matchAll(/case "([^"]+)":/g)].map(([, key]) => key)
  );

  for (const artwork of new Set(Object.values(CATEGORY_ICON_BY_SLUG))) {
    assert.ok(artworkKeys.has(artwork), `missing SVG renderer for ${artwork}`);
  }
  for (const artwork of new Set(Object.values(CATEGORY_ICON_ALIASES))) {
    assert.ok(artworkKeys.has(artwork), `missing SVG renderer for alias artwork ${artwork}`);
  }
});

test("returns no mapping for unknown or incomplete categories", () => {
  assert.equal(getCategoryIconKey({ slug: "future-category" }), null);
  assert.equal(getCategoryIconKey({ slug: "" }), null);
  assert.equal(getCategoryIconKey({ image: "/uploads/old.jpg" }), null);
  assert.equal(getCategoryIconKey(null), null);
  assert.equal(getCategoryIconKey(undefined), null);
});
