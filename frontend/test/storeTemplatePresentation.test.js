import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getStoreProductAttributeSummary, getStoreTemplateConfig } from "../src/utils/storeTemplates.js";
import { getStoreActivityCategoryOptions, getStoreCategoriesForActivity } from "../src/utils/storeCategories.js";
import { getStoreAdvancedPalette, normalizeStoreAdvancedTheme, STORE_ADVANCED_PALETTES } from "../src/utils/storeAdvancedThemes.js";
import { FAMILY_PRODUCTION_ACTIVITY_REGISTRY, STORE_ACTIVITY_REGISTRY } from "../../backend/src/utils/storeActivityRegistry.js";

const root = process.cwd();

test("supported Storefront templates have distinct section copy and card grids", () => {
  const cars = getStoreTemplateConfig("vehicle-dealer");
  const furniture = getStoreTemplateConfig("furniture-store");
  const electronics = getStoreTemplateConfig("electronics-retail");

  assert.equal(cars.presentationVariant, "automotive");
  assert.equal(furniture.presentationVariant, "home-furnishings");
  assert.equal(electronics.presentationVariant, "consumer-electronics");
  assert.notEqual(cars.catalogTitle, furniture.catalogTitle);
  assert.notEqual(furniture.catalogTitle, electronics.catalogTitle);
  assert.notEqual(cars.gridClassName, furniture.gridClassName);
  assert.notEqual(cars.emptyTitle, furniture.emptyTitle);
});

test("family production activity templates present separate catalogs and delivery badge styles", () => {
  const food = getStoreTemplateConfig("family-food");
  const handicrafts = getStoreTemplateConfig("family-handicrafts");
  const tailoring = getStoreTemplateConfig("family-tailoring");
  const cardSource = fs.readFileSync(path.join(root, "src", "components", "ProductCard.jsx"), "utf8");
  const rendererSource = fs.readFileSync(path.join(root, "src", "components", "StoreTemplateRenderer.jsx"), "utf8");
  const detailSource = fs.readFileSync(path.join(root, "src", "pages", "ProductDetail.jsx"), "utf8");

  assert.equal(food.presentationVariant, "family-food");
  assert.equal(handicrafts.presentationVariant, "family-handicrafts");
  assert.equal(tailoring.presentationVariant, "family-tailoring");
  assert.notEqual(food.catalogTitle, handicrafts.catalogTitle);
  assert.match(cardSource, /family-food/);
  assert.match(cardSource, /family-handicrafts/);
  assert.match(cardSource, /storeProfile\.storeType === "family-production" \? "أسرة منتجة" : "متجر"/);
  assert.match(cardSource, /absolute bottom-2 right-2[\s\S]*توصيل متاح/);
  assert.match(cardSource, /product\.isAvailableForDelivery === true/);
  assert.match(cardSource, /product\.unitPrice/);
  assert.match(cardSource, /product\.originalPrice \?\? product\.price/);
  assert.doesNotMatch(rendererSource, /store\.deliveryAvailable/);
  assert.match(detailSource, /absolute bottom-4 right-4[\s\S]*توصيل متاح/);
  assert.match(detailSource, /p\.isAvailableForDelivery === true/);
  assert.match(detailSource, /p\.unitPrice/);
  assert.match(detailSource, /p\.originalPrice/);
});

test("every registered activity has an explicit storefront catalog and product badge", () => {
  const rendererSource = fs.readFileSync(path.join(root, "src", "components", "StoreTemplateRenderer.jsx"), "utf8");
  const activities = [...STORE_ACTIVITY_REGISTRY, ...FAMILY_PRODUCTION_ACTIVITY_REGISTRY];
  assert.equal(activities.length, 38);
  for (const activity of activities) {
    const config = getStoreTemplateConfig(activity.templateKey);
    assert.ok(config.catalogTitle, `${activity.activityKey} needs a catalog title`);
    assert.ok(config.catalogDescription, `${activity.activityKey} needs catalog copy`);
    assert.ok(config.searchLabel, `${activity.activityKey} needs search text`);
    assert.ok(config.categoryLabel, `${activity.activityKey} needs a category label`);
    assert.ok(config.emptyTitle, `${activity.activityKey} needs an empty-state title`);
    assert.ok(config.presentationVariant, `${activity.activityKey} needs a presentation variant`);
    assert.equal(config.presentationVariant, activity.presentationVariant);
    assert.ok(config.productBadge?.icon, `${activity.activityKey} needs a badge icon`);
    assert.ok(config.productBadge?.label, `${activity.activityKey} needs a badge label`);
    assert.ok(config.productBadge?.className, `${activity.activityKey} needs badge colors`);
    if (!["cars", "mobile-electronics", "furniture", "family-food", "family-handicrafts", "family-tailoring"].includes(activity.activityKey)) {
      assert.ok(config.intro?.eyebrow, `${activity.activityKey} needs an activity intro`);
      assert.ok(config.intro?.title, `${activity.activityKey} needs an activity title`);
      assert.ok(config.intro?.description, `${activity.activityKey} needs intro copy`);
      assert.ok(config.intro?.icon, `${activity.activityKey} needs an intro icon`);
      assert.ok(config.intro?.label, `${activity.activityKey} needs an intro badge`);
      assert.ok(config.intro?.accent, `${activity.activityKey} needs hero colors`);
      assert.ok(config.intro?.chip, `${activity.activityKey} needs a hero badge`);
      assert.ok(config.intro?.highlight, `${activity.activityKey} needs a hero highlight`);
      assert.ok(config.intro?.buttonLabel, `${activity.activityKey} needs a hero action`);
    }
  }
  assert.throws(() => getStoreTemplateConfig("unregistered-activity"), /Unknown store template/);
  assert.doesNotMatch(rendererSource, /startsWith\(["']family-/);
});

test("discount prices render only for active Store Product discounts and cart shows the original price", () => {
  const cardSource = fs.readFileSync(path.join(root, "src", "components", "ProductCard.jsx"), "utf8");
  const detailSource = fs.readFileSync(path.join(root, "src", "pages", "ProductDetail.jsx"), "utf8");
  const cartSource = fs.readFileSync(path.join(root, "src", "pages", "StoreCart.jsx"), "utf8");
  assert.match(cardSource, /storeProfile && product\.discountEnabled === true/);
  assert.match(detailSource, /p\.storeProfileId && p\.discountEnabled === true/);
  assert.match(cartSource, /item\.discountEnabled === true/);
  assert.match(cartSource, /item\.originalPrice\.toLocaleString\("ar-EG"\)/);
  assert.match(cartSource, /item\.price\.toLocaleString\("ar-EG"\)/);
  assert.match(cardSource, /<s className=.*text-blue-700 decoration-red-500/);
  assert.match(cardSource, /hasStoreDiscount \? "text-rose-700"/);
  assert.doesNotMatch(cardSource, /خصم \{product\.discountType/);
  for (const source of [detailSource, cartSource]) {
    assert.match(source, /discountType === "fixed"/);
  }
});

test("Marketplace ProductCard links Store Products to their trusted public store", () => {
  const cardSource = fs.readFileSync(path.join(root, "src", "components", "ProductCard.jsx"), "utf8");
  assert.match(cardSource, /product\.storeProfileId\?\.storeName/);
  assert.match(cardSource, /to=\{`\/store\/\$\{storeProfile\.slug\}`\}/);
  assert.match(cardSource, /storeProfile\.storeName/);
});

test("inventory status is shown only for enabled store inventory and zero stock blocks cart actions", () => {
  const cardSource = fs.readFileSync(path.join(root, "src", "components", "ProductCard.jsx"), "utf8");
  const detailSource = fs.readFileSync(path.join(root, "src", "pages", "ProductDetail.jsx"), "utf8");
  const cartSource = fs.readFileSync(path.join(root, "src", "pages", "StoreCart.jsx"), "utf8");
  assert.match(cardSource, /product\.inventoryEnabled === true/);
  assert.match(cardSource, /isOutOfStock \? "نفد المخزون"/);
  assert.match(cardSource, /disabled=\{isOutOfStock\}/);
  assert.match(detailSource, /p\.inventoryEnabled === true/);
  assert.match(detailSource, /"نفد المخزون"/);
  assert.match(cartSource, /item\.inventoryEnabled === true/);
  assert.match(cartSource, /المتوفر: \$\{item\.stockQuantity\}/);
});

test("template summaries display only values supplied by the selected category", () => {
  const product = {
    attributes: [
      { attributeId: { name: "brand", label: "الماركة" }, value: "Toyota" },
      { attributeId: { name: "model", label: "الموديل" }, value: "Corolla" },
      { attributeId: { name: "year", label: "سنة الصنع" }, value: 2020 },
      { attributeId: { name: "mileage", label: "المسافة المقطوعة (كم)" }, value: 45000 },
      { attributeId: { name: "fuel_type", label: "نوع الوقود" }, value: "بنزين" },
      { attributeId: { name: "sunroof", label: "فتحة سقف" }, value: true }
    ]
  };
  const summary = getStoreProductAttributeSummary(product, "automotive");
  assert.deepEqual(summary.map(({ label }) => label), ["الماركة", "الموديل", "سنة الصنع", "المسافة المقطوعة (كم)", "نوع الوقود"]);
  assert.deepEqual(getStoreProductAttributeSummary({ attributes: [] }, "automotive"), []);
  assert.deepEqual(getStoreProductAttributeSummary(product, null), summary);
});

test("registration and store editing share activity options while retaining selected historical categories", () => {
  const categories = [
    { _id: "root", slug: "root", name: "Root", children: [
      { _id: "allowed", slug: "allowed", name: "Allowed" },
      { _id: "legacy", slug: "legacy", name: "Legacy" }
    ] }
  ];
  const activity = { activityKey: "test", allowedCategorySlugs: ["allowed"] };
  assert.deepEqual(
    getStoreActivityCategoryOptions(categories, activity, ["legacy"]).map(({ _id }) => _id),
    ["allowed", "legacy"]
  );
  assert.deepEqual(
    getStoreActivityCategoryOptions(categories, activity).map(({ _id }) => _id),
    ["allowed"]
  );
  assert.deepEqual(
    getStoreActivityCategoryOptions(categories, null, ["legacy"]).map(({ _id }) => _id),
    ["legacy"]
  );
});

test("furniture and electronics presentations do not hard-code category attribute names", () => {
  const product = {
    attributes: [
      { attributeId: { name: "brand", label: "الماركة" }, value: "Brand" },
      { attributeId: { name: "model", label: "الموديل" }, value: "Model" },
      { attributeId: { name: "material", label: "المادة" }, value: "خشب" },
      { attributeId: { name: "storage", label: "سعة التخزين" }, value: "256 GB" }
    ]
  };
  const labels = ["الماركة", "الموديل", "المادة", "سعة التخزين"];
  assert.deepEqual(getStoreProductAttributeSummary(product, "home-furnishings").map(({ label }) => label), labels);
  assert.deepEqual(getStoreProductAttributeSummary(product, "consumer-electronics").map(({ label }) => label), labels);
  assert.deepEqual(getStoreProductAttributeSummary({ attributes: [{ attributeId: { name: "charger_type", label: "نوع الشاحن" }, value: "USB-C" }] }, "consumer-electronics"), [{ label: "نوع الشاحن", value: "USB-C" }]);
});

test("ProductCard keeps the un-themed Marketplace presentation by default", () => {
  const cardSource = fs.readFileSync(path.join(root, "src", "components", "ProductCard.jsx"), "utf8");
  const rendererSource = fs.readFileSync(path.join(root, "src", "components", "StoreTemplateRenderer.jsx"), "utf8");
  assert.match(cardSource, /presentationVariant = null/);
  assert.match(cardSource, /storeProfile \? getStoreProductAttributeSummary\(product\) : \[\]/);
  assert.match(rendererSource, /presentationVariant=\{presentationVariant\}/);
});

test("advanced Storefront colors are scoped to the store information, sections, and product cards", () => {
  const storefrontSource = fs.readFileSync(path.join(root, "src", "pages", "Storefront.jsx"), "utf8");
  const rendererSource = fs.readFileSync(path.join(root, "src", "components", "StoreTemplateRenderer.jsx"), "utf8");
  const cardSource = fs.readFileSync(path.join(root, "src", "components", "ProductCard.jsx"), "utf8");

  assert.match(storefrontSource, /pageBackgroundColor/);
  assert.match(storefrontSource, /storeInfoBackgroundColor/);
  assert.match(rendererSource, /sectionBackgroundColor/);
  assert.match(rendererSource, /storefrontCardColors=\{storeCardColors\}/);
  assert.match(rendererSource, /secondaryColor: advanced\.secondaryColor/);
  assert.match(cardSource, /storefrontCardColors = null/);
  assert.match(cardSource, /backgroundColor: storefrontCardColors\.backgroundColor/);
});

test("advanced store themes provide three fixed palettes and a six-color custom option", () => {
  assert.deepEqual(Object.keys(STORE_ADVANCED_PALETTES), ["classic", "calm", "professional"]);
  for (const palette of Object.values(STORE_ADVANCED_PALETTES)) {
    assert.deepEqual(Object.keys(palette), [
      "primaryColor",
      "secondaryColor",
      "pageBackgroundColor",
      "storeInfoBackgroundColor",
      "sectionBackgroundColor",
      "productCardBackgroundColor"
    ]);
  }
  assert.equal(STORE_ADVANCED_PALETTES.calm.primaryColor, "#587967");
  assert.equal(STORE_ADVANCED_PALETTES.calm.pageBackgroundColor, "#f2f5f0");
  assert.equal(STORE_ADVANCED_PALETTES.professional.primaryColor, "#6d28d9");
  assert.equal(STORE_ADVANCED_PALETTES.professional.secondaryColor, "#1e1b4b");
  assert.equal(STORE_ADVANCED_PALETTES.professional.storeInfoBackgroundColor, "#ecfeff");
  assert.equal(STORE_ADVANCED_PALETTES.professional.productCardBackgroundColor, "#fffbeb");
  const custom = {
    theme: "custom",
    primaryColor: "#123456",
    secondaryColor: "#234567",
    pageBackgroundColor: "#345678",
    storeInfoBackgroundColor: "#456789",
    sectionBackgroundColor: "#56789a",
    productCardBackgroundColor: "#6789ab"
  };
  assert.equal(normalizeStoreAdvancedTheme("editorial"), "custom");
  assert.equal(normalizeStoreAdvancedTheme("artisan"), "custom");
  assert.deepEqual(getStoreAdvancedPalette("calm"), STORE_ADVANCED_PALETTES.calm);
  assert.deepEqual(getStoreAdvancedPalette("custom", custom), {
    primaryColor: "#123456",
    secondaryColor: "#234567",
    pageBackgroundColor: "#345678",
    storeInfoBackgroundColor: "#456789",
    sectionBackgroundColor: "#56789a",
    productCardBackgroundColor: "#6789ab"
  });

  const myStoreSource = fs.readFileSync(path.join(root, "src", "pages", "MyStore.jsx"), "utf8");
  assert.match(myStoreSource, /"classic", "كلاسيكي"/);
  assert.match(myStoreSource, /"calm", "هادئ"/);
  assert.match(myStoreSource, /"professional", "احترافي"/);
  assert.match(myStoreSource, /"custom", "مخصص"/);
  assert.match(myStoreSource, /advancedDraft\.theme === "custom" \?/);
  assert.match(myStoreSource, /معاينة ألوان \$\{label\}/);
});

test("Store Product pickers filter supported activities but preserve legacy selected categories", () => {
  const selectedCategories = [
    { slug: "cars-for-sale", name: "سيارات للبيع" },
    { slug: "bedrooms", name: "غرف نوم" }
  ];
  const activities = [{ activityKey: "cars", allowedCategorySlugs: ["cars-for-sale"] }];
  assert.deepEqual(getStoreCategoriesForActivity({ activityKey: "cars", selectedCategories }, activities), [selectedCategories[0]]);
  assert.deepEqual(getStoreCategoriesForActivity({ businessActivity: "معرض قديم", selectedCategories }, activities), selectedCategories);
});

test("template rendering leaves the shared Store PWA and SEO lifecycle in Storefront", () => {
  const storefrontSource = fs.readFileSync(path.join(root, "src", "pages", "Storefront.jsx"), "utf8");
  const rendererSource = fs.readFileSync(path.join(root, "src", "components", "StoreTemplateRenderer.jsx"), "utf8");
  assert.match(storefrontSource, /applyStoreManifest\(data\.store, api\.defaults\.baseURL\)/);
  assert.match(storefrontSource, /restoreGlobalManifest\(\)/);
  assert.match(storefrontSource, /<SEO[\s\S]*?canonicalUrl=\{`\/store\/\$\{store\.slug\}`\}/);
  assert.doesNotMatch(rendererSource, /applyStoreManifest|restoreGlobalManifest|buildStoreManifest/);
});