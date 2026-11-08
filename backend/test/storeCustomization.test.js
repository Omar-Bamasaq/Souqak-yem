import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import storesRouter from "../src/routes/stores.js";
import StoreProfile from "../src/models/StoreProfile.js";
import StoreSubscription from "../src/models/StoreSubscription.js";
import PurchaseRequest from "../src/models/PurchaseRequest.js";
import City from "../src/models/City.js";
import Ad from "../src/models/Ad.js";
import { sanitizeStoreText, validateStoreCustomization } from "../src/utils/storeValidation.js";
import {
  normalizeStoreAdvancedCustomization,
  STORE_ADVANCED_DEFAULTS,
  STORE_ADVANCED_PALETTES,
  STORE_ADVANCED_THEMES
} from "../src/utils/storeAdvancedCustomization.js";

function sourceFor(router, method, pathName) {
  const layer = router.stack.find((entry) => entry.route?.path === pathName && entry.route.methods[method]);
  assert.ok(layer, `Expected ${method.toUpperCase()} ${pathName} route to exist`);
  return layer.route.stack.map((entry) => entry.handle.toString()).join("\n");
}

function query(value) {
  return {
    select() { return this; },
    sort() { return this; },
    populate() { return this; },
    lean() { return Promise.resolve(value); }
  };
}

test("store customization route is owner-scoped and blocks protected store fields", () => {
  const source = sourceFor(storesRouter, "patch", "/me");
  const storesSource = fs.readFileSync(path.resolve(process.cwd(), "src/routes/stores.js"), "utf8");
  assert.match(source, /ownerStoreFilter\(req\.user\.id, storeType\)/);
  assert.match(source, /Ownership required|Store not found/);
  assert.match(source, /slug|storeName|storeType|activityKey|status|approvedAt|rejectedReason/);
  assert.match(storesSource, /router\.patch\("\/me", auth, uploadImages\.fields/);
  assert.match(source, /const customizationFields = \[\s*"description", "location"/);
});

test("store identity details are displayed without editable name or activity fields", () => {
  const myStorePath = path.resolve(process.cwd(), "../frontend/src/pages/MyStore.jsx");
  const source = fs.readFileSync(myStorePath, "utf8");
  const modelSource = fs.readFileSync(path.resolve(process.cwd(), "src/models/StoreProfile.js"), "utf8");
  assert.match(source, /رابط سوقك · ثابت/);
  assert.match(source, /اسم المتجر.{0,30}ثابت/);
  assert.doesNotMatch(source, /name="storeName"|name="activityKey"/);
  assert.match(modelSource, /if \(this\.slug \|\| !this\.storeName\) return next\(\)/);
  assert.doesNotMatch(modelSource, /pre\(\["findOneAndUpdate"/);
});

test("slug availability rejects invalid inputs and checks uniqueness", async () => {
  const route = storesRouter.stack.find(
    (entry) => entry.route?.path === "/slug-availability/:slug" && entry.route.methods.get
  );
  assert.ok(route, "Expected the slug availability route");
  const handler = route.route.stack.at(-1).handle;
  const originals = { storeFindOne: StoreProfile.findOne, storeExists: StoreProfile.exists };
  let existingSlug = null;
  StoreProfile.findOne = () => query(null);
  StoreProfile.exists = async (filter) => filter.slug === existingSlug ? { _id: "store-id" } : null;
  const invoke = async (slug) => {
    const result = { statusCode: 200, body: null };
    const res = {
      status(code) { result.statusCode = code; return this; },
      json(body) { result.body = body; return this; }
    };
    await handler({ params: { slug }, query: { storeType: "store" }, user: { id: "owner-id" } }, res);
    return result;
  };

  try {
    assert.deepEqual((await invoke("matjar-valid")).body, { available: true });
    existingSlug = "matjar-taken";
    assert.deepEqual((await invoke(existingSlug)).body, { available: false });
    assert.equal((await invoke("bad.slug")).body.available, false);
  } finally {
    StoreProfile.findOne = originals.storeFindOne;
    StoreProfile.exists = originals.storeExists;
  }
});

test("store customization sanitizes dangerous content and enforces text validation", () => {
  const cleaned = sanitizeStoreText('<script>alert(1)</script><b>سوقك</b>');
  assert.equal(cleaned, "سوقك");
  assert.doesNotMatch(cleaned, /alert\(1\)|<script|<b>/i);
  const valid = validateStoreCustomization({
    storeName: "متجر عربي",
    businessActivity: "إلكترونيات",
    description: "وصف آمن",
    location: "صنعاء",
    phone: "+966500000000",
    email: "store@example.com"
  });
  assert.equal(valid.valid, true);

  const invalid = validateStoreCustomization({
    storeName: "م",
    businessActivity: "إلكترونيات",
    description: "وصف",
    location: "صنعاء",
    phone: "bad-value",
    email: "store@"
  });
  assert.equal(invalid.valid, false);
});

test("public storefront exposes customization fields without changing the ad model", () => {
  const storefrontPath = path.resolve(process.cwd(), "../frontend/src/pages/Storefront.jsx");
  const source = fs.readFileSync(storefrontPath, "utf8");
  const rendererSource = fs.readFileSync(path.resolve(process.cwd(), "../frontend/src/components/StoreTemplateRenderer.jsx"), "utf8");
  const storesSource = fs.readFileSync(path.resolve(process.cwd(), "src/routes/stores.js"), "utf8");
  assert.match(source, /store\.cover|store\.logo|store\.description|store\.location|selectedCategories/);
  assert.match(rendererSource, /store\?\.advancedCustomizationEnabled/);
  assert.match(rendererSource, /featuredProducts/);
  assert.match(rendererSource, /buttonTargets/);
  assert.match(storesSource, /hasStoreFeature\(\{ status: store\.status, subscription \}, "advancedCustomization"\)/);
  assert.match(storesSource, /storeProfileId: store\._id/);
  assert.doesNotMatch(source, /new Product model|StoreCustomization|new model/i);
});

test("owner dashboard contains the store customization section", () => {
  const myStorePath = path.resolve(process.cwd(), "../frontend/src/pages/MyStore.jsx");
  const source = fs.readFileSync(myStorePath, "utf8");
  assert.match(source, /تخصيص المتجر|إدارة بيانات المتجر|حفظ التعديلات/);
});

test("basic customization requires an active subscription and the customization feature", async () => {
  const patchRoute = storesRouter.stack.find((entry) => entry.route?.path === "/me" && entry.route.methods.patch);
  const handler = patchRoute.route.stack.at(-1).handle;
  const originals = {
    storeFindOne: StoreProfile.findOne,
    storeUpdate: StoreProfile.findByIdAndUpdate,
    subscriptionFindOne: StoreSubscription.findOne,
    subscriptionStatus: StoreSubscription.getStoreSubscriptionStatus,
    cityFind: City.find
  };
  const store = {
    _id: "507f1f77bcf86cd799439011",
    userId: "507f1f77bcf86cd799439012",
    storeType: "store",
    status: "active",
    storeName: "متجر تجريبي",
    businessActivity: "تجارة",
    description: "",
    location: "",
    phone: "",
    email: "",
    governorateId: null,
    cityId: null,
    customCityName: ""
  };
  let savedUpdate;
  const invoke = async ({ userId = store.userId, features, endDate, body = { description: "وصف جديد" } } = {}) => {
    StoreProfile.findOne = (filter) => query(String(filter.userId) === String(store.userId) ? store : null);
    StoreProfile.findByIdAndUpdate = (_id, update) => {
      savedUpdate = update;
      return query({ ...store, ...update });
    };
    StoreSubscription.findOne = () => query({
      status: "active",
      endDate: endDate || new Date(Date.now() + 86400000),
      planId: { type: "store", features }
    });
    StoreSubscription.getStoreSubscriptionStatus = (subscription) => (
      subscription?.endDate && new Date(subscription.endDate) < new Date() ? "expired" : subscription?.status || "inactive"
    );
    City.find = () => query([]);
    const result = { statusCode: 200, body: null };
    const res = {
      status(code) { result.statusCode = code; return this; },
      json(body) { result.body = body; return this; }
    };
    await handler({ user: { id: userId }, body, files: {} }, res);
    return result;
  };

  try {
    const allowed = await invoke({
      features: { customization: true },
      body: {
        social: JSON.stringify({
          instagram: "https://instagram.com/test-store",
          whatsappChannel: "https://chat.whatsapp.com/example-invite"
        })
      }
    });
    assert.equal(allowed.statusCode, 200);
    assert.equal(savedUpdate.storeName, undefined);
    assert.equal(savedUpdate.social.instagram, "https://instagram.com/test-store");
    assert.equal(savedUpdate.social.whatsappChannel, "https://chat.whatsapp.com/example-invite");

    const immutableStoreName = await invoke({
      features: { customization: true },
      body: { storeName: "اسم جديد" }
    });
    assert.equal(immutableStoreName.statusCode, 400);
    assert.match(immutableStoreName.body.error, /Protected fields/);

    const invalidSocialLink = await invoke({
      features: { customization: true },
      body: { social: JSON.stringify({ facebook: "javascript:alert(1)" }) }
    });
    assert.equal(invalidSocialLink.statusCode, 400);

    const invalidWhatsAppLink = await invoke({
      features: { customization: true },
      body: { social: JSON.stringify({ whatsappChannel: "https://example.com/group" }) }
    });
    assert.equal(invalidWhatsAppLink.statusCode, 400);

    const disabled = await invoke({ features: { customization: false } });
    assert.equal(disabled.statusCode, 403);

    const expired = await invoke({
      features: { customization: true },
      endDate: new Date(Date.now() - 86400000)
    });
    assert.equal(expired.statusCode, 403);

    const otherOwner = await invoke({ userId: "111111111111111111111111", features: { customization: true } });
    assert.equal(otherOwner.statusCode, 404);
  } finally {
    StoreProfile.findOne = originals.storeFindOne;
    StoreProfile.findByIdAndUpdate = originals.storeUpdate;
    StoreSubscription.findOne = originals.subscriptionFindOne;
    StoreSubscription.getStoreSubscriptionStatus = originals.subscriptionStatus;
    City.find = originals.cityFind;
  }
});

test("advanced customization requires both plan features and saves only store-owned products", async () => {
  const patchRoute = storesRouter.stack.find((entry) => entry.route?.path === "/me" && entry.route.methods.patch);
  const handler = patchRoute.route.stack.at(-1).handle;
  const originals = {
    storeFindOne: StoreProfile.findOne,
    storeUpdate: StoreProfile.findByIdAndUpdate,
    subscriptionFindOne: StoreSubscription.findOne,
    subscriptionStatus: StoreSubscription.getStoreSubscriptionStatus,
    cityFind: City.find,
    adFind: Ad.find
  };
  const storeId = "507f1f77bcf86cd799439011";
  const userId = "507f1f77bcf86cd799439012";
  const productId = "507f1f77bcf86cd799439013";
  const storedAdvanced = { theme: "editorial", hero: { title: "قديم" } };
  const store = {
    _id: storeId,
    userId,
    storeType: "store",
    status: "active",
    storeName: "متجر تجريبي",
    businessActivity: "تجارة",
    description: "",
    location: "",
    phone: "",
    email: "",
    governorateId: null,
    cityId: null,
    customCityName: "صنعاء",
    advancedCustomization: storedAdvanced
  };
  let features = { customization: true, advancedCustomization: false };
  let subscriptionStatus = "active";
  let updateCalls = 0;
  let adFilter;
  StoreProfile.findOne = () => query(store);
  StoreProfile.findByIdAndUpdate = (_id, update) => {
    updateCalls += 1;
    return query({ ...store, ...update });
  };
  StoreSubscription.findOne = () => query({
    status: subscriptionStatus,
    endDate: new Date(Date.now() + 86400000),
    planId: { type: "store", features }
  });
  StoreSubscription.getStoreSubscriptionStatus = (subscription) => subscription?.status || "inactive";
  City.find = () => query([]);
  Ad.find = (filter) => {
    adFilter = filter;
    return query([{ _id: productId }]);
  };
  const invoke = async () => {
    const result = { statusCode: 200, body: null };
    const res = {
      status(code) { result.statusCode = code; return this; },
      json(body) { result.body = body; return this; }
    };
    await handler({
      user: { id: userId },
      body: {
        advancedCustomization: JSON.stringify({
          theme: "artisan",
          primaryColor: "#123456",
          secondaryColor: "#abcdef",
          hero: { title: "جديد", text: "نص آمن", buttonLabel: "تسوق", buttonTarget: "products" },
          story: { text: "قصتنا" },
          featuredProductIds: [productId],
          sectionOrder: ["hero", "intro", "story", "featuredProducts", "products"],
          hiddenSections: []
        })
      },
      files: {}
    }, res);
    return result;
  };

  try {
    const disabled = await invoke();
    assert.equal(disabled.statusCode, 403);
    assert.equal(updateCalls, 0);
    assert.equal(store.advancedCustomization, storedAdvanced);

    features = { customization: false, advancedCustomization: true };
    const missingBaseFeature = await invoke();
    assert.equal(missingBaseFeature.statusCode, 403);
    assert.equal(updateCalls, 0);

    features = { customization: true, advancedCustomization: true };
    subscriptionStatus = "expired";
    const expired = await invoke();
    assert.equal(expired.statusCode, 403);
    assert.equal(updateCalls, 0);

    subscriptionStatus = "active";
    store.status = "suspended";
    const inactiveStore = await invoke();
    assert.equal(inactiveStore.statusCode, 403);
    assert.equal(updateCalls, 0);

    store.status = "active";
    const allowed = await invoke();
    assert.equal(allowed.statusCode, 200, JSON.stringify(allowed.body));
    assert.equal(updateCalls, 1);
    assert.equal(adFilter.storeProfileId, storeId);
    assert.deepEqual(adFilter._id.$in, [productId]);
    assert.equal(allowed.body.advancedCustomization.theme, "custom");
    assert.equal(allowed.body.advancedCustomization.hero.image, null);
  } finally {
    StoreProfile.findOne = originals.storeFindOne;
    StoreProfile.findByIdAndUpdate = originals.storeUpdate;
    StoreSubscription.findOne = originals.subscriptionFindOne;
    StoreSubscription.getStoreSubscriptionStatus = originals.subscriptionStatus;
    City.find = originals.cityFind;
    Ad.find = originals.adFind;
  }
});

test("owner store read hides advanced settings without both features and supplies defaults for legacy stores", async () => {
  const getRoute = storesRouter.stack.find((entry) => entry.route?.path === "/me" && entry.route.methods.get);
  const handler = getRoute.route.stack.at(-1).handle;
  const originals = {
    storeFindOne: StoreProfile.findOne,
    subscriptionFindOne: StoreSubscription.findOne,
    subscriptionStatus: StoreSubscription.getStoreSubscriptionStatus,
    purchaseFindOne: PurchaseRequest.findOne
  };
  const store = {
    _id: "507f1f77bcf86cd799439011",
    userId: "507f1f77bcf86cd799439012",
    storeType: "store",
    status: "active",
    storeName: "متجر قديم",
    businessActivity: "تجارة",
    bankAccounts: [],
    advancedCustomization: undefined
  };
  let features = { customization: true, advancedCustomization: false };
  StoreProfile.findOne = () => query(store);
  StoreSubscription.findOne = () => query({
    status: "active",
    endDate: new Date(Date.now() + 86400000),
    planId: { type: "store", features }
  });
  StoreSubscription.getStoreSubscriptionStatus = (subscription) => subscription?.status || "inactive";
  PurchaseRequest.findOne = () => query(null);
  const invoke = async () => {
    const result = { statusCode: 200, body: null };
    const res = {
      status(code) { result.statusCode = code; return this; },
      json(body) { result.body = body; return this; }
    };
    await handler({ user: { id: store.userId }, query: { storeType: "store" } }, res);
    return result;
  };

  try {
    const disabled = await invoke();
    assert.equal(disabled.body.advancedCustomizationEnabled, false);
    assert.equal(Object.hasOwn(disabled.body, "advancedCustomization"), false);

    features = { customization: true, advancedCustomization: true };
    const enabled = await invoke();
    assert.equal(enabled.body.advancedCustomizationEnabled, true);
    assert.equal(enabled.body.advancedCustomization.theme, "classic");
    assert.deepEqual(enabled.body.advancedCustomization.featuredProductIds, []);
  } finally {
    StoreProfile.findOne = originals.storeFindOne;
    StoreSubscription.findOne = originals.subscriptionFindOne;
    StoreSubscription.getStoreSubscriptionStatus = originals.subscriptionStatus;
    PurchaseRequest.findOne = originals.purchaseFindOne;
  }
});

test("storefront social links use persisted customization fields and safe external links", () => {
  const modelSource = fs.readFileSync(path.resolve(process.cwd(), "src/models/StoreProfile.js"), "utf8");
  const storesSource = fs.readFileSync(path.resolve(process.cwd(), "src/routes/stores.js"), "utf8");
  const storefrontPath = path.resolve(process.cwd(), "../frontend/src/pages/Storefront.jsx");
  const storefrontSource = fs.readFileSync(storefrontPath, "utf8");
  assert.match(modelSource, /social:\s*\{/);
  assert.match(modelSource, /whatsappChannel:/);
  assert.match(storesSource, /normalizeStoreSocialLinks/);
  assert.match(storesSource, /\["http:",\s*"https:"\]/);
  assert.match(storesSource, /whatsappChannel/);
  assert.match(storefrontSource, /Object\.entries\(store\.social \|\| \{\}\)/);
  assert.match(storefrontSource, /noopener noreferrer/);
});

test("customization UI exposes advanced customization behind both plan features", () => {
  const myStorePath = path.resolve(process.cwd(), "../frontend/src/pages/MyStore.jsx");
  const source = fs.readFileSync(myStorePath, "utf8");
  assert.match(source, /hasStorePlanFeature\(subscription\?\.plan \|\| subscription\?\.planId, "customization"\)/);
  assert.match(source, /supportsCustomization\s*\?\s*\(/);
  assert.match(source, /هذه الميزة غير متاحة في باقتك الحالية/);
  assert.match(source, /"advancedCustomization"/);
  assert.match(source, /التخصيص المتقدم/);
});

test("advanced customization normalizes safe themes, sections, text, and colors", () => {
  assert.deepEqual(STORE_ADVANCED_THEMES, ["classic", "calm", "professional", "custom"]);
  for (const theme of ["classic", "calm", "professional"]) {
    const normalizedTheme = normalizeStoreAdvancedCustomization({ theme });
    assert.deepEqual(
      Object.fromEntries(Object.keys(STORE_ADVANCED_PALETTES.classic).map((field) => [field, normalizedTheme.value[field]])),
      STORE_ADVANCED_PALETTES[theme]
    );
  }
  const normalized = normalizeStoreAdvancedCustomization({
    theme: "artisan",
    primaryColor: "#abc",
    secondaryColor: "#102030",
    pageBackgroundColor: "#f8fafc",
    storeInfoBackgroundColor: "#fef3c7",
    sectionBackgroundColor: "#e0f2fe",
    productCardBackgroundColor: "#ecfdf5",
    hero: { title: "<b>أهلًا</b>", text: "منتجاتنا", buttonLabel: "", buttonTarget: "products" },
    story: { text: "<script>alert(1)</script>قصتنا" },
    featuredProductIds: [],
    sectionOrder: ["story", "intro", "hero", "featuredProducts", "products"],
    hiddenSections: ["intro"]
  });

  assert.equal(normalized.error, undefined);
  assert.equal(normalized.value.theme, "custom");
  assert.equal(normalized.value.primaryColor, "#aabbcc");
  assert.equal(normalized.value.pageBackgroundColor, "#f8fafc");
  assert.equal(normalized.value.storeInfoBackgroundColor, "#fef3c7");
  assert.equal(normalized.value.sectionBackgroundColor, "#e0f2fe");
  assert.equal(normalized.value.productCardBackgroundColor, "#ecfdf5");
  assert.equal(normalized.value.hero.title, "أهلًا");
  assert.equal(normalized.value.story.text, "قصتنا");
  assert.deepEqual(normalized.value.sectionOrder[0], "story");
  assert.deepEqual(normalized.value.hiddenSections, ["intro"]);
  assert.deepEqual(normalized.value.hero.image, null);
  assert.equal(normalizeStoreAdvancedCustomization({}, {}).value.theme, "classic");
  assert.equal(normalizeStoreAdvancedCustomization({}, {}).value.pageBackgroundColor, STORE_ADVANCED_DEFAULTS.pageBackgroundColor);
  assert.equal(normalizeStoreAdvancedCustomization({
    theme: "calm",
    primaryColor: "#123456",
    secondaryColor: "#234567",
    pageBackgroundColor: "#345678",
    storeInfoBackgroundColor: "#456789",
    sectionBackgroundColor: "#56789a",
    productCardBackgroundColor: "#6789ab"
  }).value.primaryColor, STORE_ADVANCED_PALETTES.calm.primaryColor);
  assert.equal(normalizeStoreAdvancedCustomization({ theme: "editorial", primaryColor: "#123456" }).value.theme, "custom");
  assert.equal(normalizeStoreAdvancedCustomization({ theme: "editorial", primaryColor: "#123456" }).value.primaryColor, "#123456");
  assert.match(normalizeStoreAdvancedCustomization({ theme: "custom", primaryColor: "not-a-color" }).error, /الألوان/);
  assert.match(normalizeStoreAdvancedCustomization({ pageBackgroundColor: "url(javascript:alert(1))" }).error, /الألوان/);
  assert.match(normalizeStoreAdvancedCustomization({ pageBackgroundColor: "#fff", unrecognizedColor: "#000" }).error, /حقول/);
});

test("advanced customization rejects unsafe destinations and client image paths", () => {
  assert.match(normalizeStoreAdvancedCustomization({
    ...STORE_ADVANCED_DEFAULTS,
    hero: { title: "متجر", text: "", buttonLabel: "زيارة", buttonTarget: "https://example.com" }
  }).error, /وجهة/);
  assert.match(normalizeStoreAdvancedCustomization({
    ...STORE_ADVANCED_DEFAULTS,
    hero: { ...STORE_ADVANCED_DEFAULTS.hero, image: "uploads/attacker.jpg" }
  }).error, /حقول/);
});

test("client-supplied pwaEnabled cannot change the StoreProfile or override its plan feature", async () => {
  const patchRoute = storesRouter.stack.find((entry) => entry.route?.path === "/me" && entry.route.methods.patch);
  const handler = patchRoute.route.stack.at(-1).handle;
  const originals = {
    storeFindOne: StoreProfile.findOne,
    storeUpdate: StoreProfile.findByIdAndUpdate,
    cityFind: City.find
  };
  const store = {
    _id: "507f1f77bcf86cd799439011",
    userId: "507f1f77bcf86cd799439012",
    storeType: "store",
    status: "active",
    storeName: "متجر تجريبي",
    businessActivity: "تجارة",
    description: "",
    location: "",
    phone: "",
    email: "",
    pwaEnabled: false,
    governorateId: null,
    cityId: null,
    customCityName: ""
  };
  let savedUpdate;
  StoreProfile.findOne = () => query(store);
  StoreProfile.findByIdAndUpdate = (_id, update) => {
    savedUpdate = update;
    return query({ ...store, ...update });
  };
  City.find = () => query([]);
  const result = { statusCode: 200, body: null };
  const res = {
    status(code) { result.statusCode = code; return this; },
    json(body) { result.body = body; return this; }
  };

  try {
    await handler({
      user: { id: store.userId },
      body: { pwaEnabled: true },
      files: {}
    }, res);
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.pwaEnabled, false);
    assert.equal(Object.hasOwn(savedUpdate, "pwaEnabled"), false);
  } finally {
    StoreProfile.findOne = originals.storeFindOne;
    StoreProfile.findByIdAndUpdate = originals.storeUpdate;
    City.find = originals.cityFind;
  }
});

test("multipleContacts feature allows or blocks extra contacts at the store API", async () => {
  const patchRoute = storesRouter.stack.find((entry) => entry.route?.path === "/me" && entry.route.methods.patch);
  const handler = patchRoute.route.stack.at(-1).handle;
  const originals = {
    storeFindOne: StoreProfile.findOne,
    storeUpdate: StoreProfile.findByIdAndUpdate,
    subscriptionFindOne: StoreSubscription.findOne,
    cityFind: City.find
  };
  const store = {
    _id: "507f1f77bcf86cd799439011",
    userId: "507f1f77bcf86cd799439012",
    status: "active",
    storeName: "متجر تجريبي",
    businessActivity: "تجارة",
    description: "",
    location: "",
    phone: "",
    email: "",
    governorateId: null,
    cityId: null,
    customCityName: "صنعاء"
  };

  const invoke = async (features, { storedPhones = [], submittedPhones = [{ value: "777123456" }, { value: "777654321" }] } = {}) => {
    StoreProfile.findOne = () => query({ ...store, phones: storedPhones });
    StoreProfile.findByIdAndUpdate = (_id, update) => query({ ...store, ...update });
    StoreSubscription.findOne = () => query({
      status: "active",
      endDate: new Date(Date.now() + 86400000),
      planId: { type: "store", features }
    });
    City.find = () => query([]);
    const result = { statusCode: 200, body: null };
    const res = {
      status(code) { result.statusCode = code; return this; },
      json(body) { result.body = body; return this; }
    };
    await handler({
      user: { id: store.userId },
      body: { phones: JSON.stringify(submittedPhones) },
      files: {}
    }, res);
    return result;
  };

  try {
    const enabled = await invoke({ customization: true, multipleContacts: true });
    assert.equal(enabled.statusCode, 200);
    assert.equal(enabled.body.phones.length, 2);

    const disabled = await invoke({ customization: true });
    assert.equal(disabled.statusCode, 403);
    assert.match(disabled.body.error, /لا تدعم/);

    const existingContacts = [{ value: "777123456" }, { value: "777654321" }];
    const retained = await invoke({ customization: true }, { storedPhones: existingContacts, submittedPhones: existingContacts });
    assert.equal(retained.statusCode, 200);
    assert.equal(retained.body.phones.length, 2);

    const added = await invoke({ customization: true }, { storedPhones: existingContacts, submittedPhones: [...existingContacts, { value: "777111111" }] });
    assert.equal(added.statusCode, 403);
  } finally {
    StoreProfile.findOne = originals.storeFindOne;
    StoreProfile.findByIdAndUpdate = originals.storeUpdate;
    StoreSubscription.findOne = originals.subscriptionFindOne;
    City.find = originals.cityFind;
  }
});

test("regular store owners can enable delivery only when their active plan includes it", async () => {
  const patchRoute = storesRouter.stack.find((entry) => entry.route?.path === "/me" && entry.route.methods.patch);
  const handler = patchRoute.route.stack.at(-1).handle;
  const originals = {
    storeFindOne: StoreProfile.findOne,
    storeUpdate: StoreProfile.findByIdAndUpdate,
    subscriptionFindOne: StoreSubscription.findOne,
    cityFind: City.find
  };
  const store = {
    _id: "507f1f77bcf86cd799439011",
    userId: "507f1f77bcf86cd799439012",
    storeType: "store",
    status: "active",
    storeName: "متجر تجريبي",
    businessActivity: "تجارة",
    description: "",
    location: "",
    phone: "",
    email: "",
    governorateId: null,
    cityId: null,
    customCityName: "صنعاء",
    deliveryAvailable: false
  };
  const invoke = async (features) => {
    StoreProfile.findOne = () => query(store);
    StoreProfile.findByIdAndUpdate = (_id, update) => query({ ...store, ...update });
    StoreSubscription.findOne = () => query({
      status: "active",
      endDate: new Date(Date.now() + 86400000),
      planId: { type: "store", features }
    });
    City.find = () => query([]);
    const result = { statusCode: 200, body: null };
    const res = {
      status(code) { result.statusCode = code; return this; },
      json(body) { result.body = body; return this; }
    };
    await handler({ user: { id: store.userId }, body: { deliveryAvailable: true }, files: {} }, res);
    return result;
  };

  try {
    const enabled = await invoke(["delivery"]);
    assert.equal(enabled.statusCode, 200);
    assert.equal(enabled.body.deliveryAvailable, true);

    const blocked = await invoke([]);
    assert.equal(blocked.statusCode, 403);
    assert.match(blocked.body.error, /لا تشمل ميزة التوصيل/);
  } finally {
    StoreProfile.findOne = originals.storeFindOne;
    StoreProfile.findByIdAndUpdate = originals.storeUpdate;
    StoreSubscription.findOne = originals.subscriptionFindOne;
    City.find = originals.cityFind;
  }
});

test("store customization accepts only hex primary colors", async () => {
  const patchRoute = storesRouter.stack.find((entry) => entry.route?.path === "/me" && entry.route.methods.patch);
  const handler = patchRoute.route.stack.at(-1).handle;
  const originals = {
    storeFindOne: StoreProfile.findOne,
    storeUpdate: StoreProfile.findByIdAndUpdate,
    subscriptionFindOne: StoreSubscription.findOne,
    cityFind: City.find
  };
  const store = {
    _id: "507f1f77bcf86cd799439011",
    userId: "507f1f77bcf86cd799439012",
    status: "active",
    storeName: "متجر تجريبي",
    businessActivity: "تجارة",
    description: "",
    location: "",
    phone: "",
    email: "",
    governorateId: null,
    cityId: null,
    customCityName: "صنعاء"
  };
  let savedUpdate;
  StoreProfile.findOne = () => query(store);
  StoreProfile.findByIdAndUpdate = (_id, update) => {
    savedUpdate = update;
    return query({ ...store, ...update });
  };
  StoreSubscription.findOne = () => query({
    status: "active",
    endDate: new Date(Date.now() + 86400000),
    planId: { type: "store", features: { customization: true } }
  });
  City.find = () => query([]);

  const invoke = async (primaryColor) => {
    const result = { statusCode: 200, body: null };
    const res = {
      status(code) { result.statusCode = code; return this; },
      json(body) { result.body = body; return this; }
    };
    await handler({ user: { id: store.userId }, body: { primaryColor }, files: {} }, res);
    return result;
  };

  try {
    const valid = await invoke("#abc123");
    assert.equal(valid.statusCode, 200);
    assert.equal(savedUpdate.primaryColor, "#abc123");

    const shortHex = await invoke("#abc");
    assert.equal(shortHex.statusCode, 200);
    assert.equal(savedUpdate.primaryColor, "#aabbcc");

    const invalid = await invoke("red; background:url(javascript:alert(1))");
    assert.equal(invalid.statusCode, 400);
    assert.match(invalid.body.error, /valid hex color/);
  } finally {
    StoreProfile.findOne = originals.storeFindOne;
    StoreProfile.findByIdAndUpdate = originals.storeUpdate;
    StoreSubscription.findOne = originals.subscriptionFindOne;
    City.find = originals.cityFind;
  }
});
