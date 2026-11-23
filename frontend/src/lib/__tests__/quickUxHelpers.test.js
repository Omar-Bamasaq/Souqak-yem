import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  getAuthorizedActiveStoreChoices,
  getRouteServiceStatus,
  getStoreSetupProgress,
  isAuthorizedActiveStore
} from "../quickUxHelpers.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(testDir, "..", "..");
const readSource = (relativePath) => fs.readFileSync(path.join(srcDir, relativePath), "utf8");

test("active and authorized regular store states are distinguished", () => {
  assert.equal(isAuthorizedActiveStore({ status: "active", subscriptionStatus: "active" }), true);
  assert.equal(isAuthorizedActiveStore({ status: "active", subscriptionStatus: "inactive" }), false);
  assert.equal(isAuthorizedActiveStore({ status: "pending", subscriptionStatus: "active" }), false);

  const activeStore = { status: "fulfilled", value: { data: { status: "active", subscriptionStatus: "active" } } };
  const inactiveStore = { status: "fulfilled", value: { data: { status: "active", subscriptionStatus: "inactive" } } };
  assert.deepEqual(getAuthorizedActiveStoreChoices(activeStore, inactiveStore), [
    { storeType: "store", label: "منتج للمتجر" }
  ]);
  assert.equal(getAuthorizedActiveStoreChoices({ status: "rejected" }, inactiveStore).length, 0);
});

test("active and authorized family-production project states are distinguished independently", () => {
  const noStore = { status: "fulfilled", value: { data: null } };
  const activeFamily = {
    status: "fulfilled",
    value: { data: { status: "active", subscriptionStatus: "active", storeType: "family-production" } }
  };
  const pendingFamily = {
    status: "fulfilled",
    value: { data: { status: "pending", subscriptionStatus: "active", storeType: "family-production" } }
  };

  assert.deepEqual(getAuthorizedActiveStoreChoices(noStore, activeFamily), [
    { storeType: "family-production", label: "منتج لمشروعي" }
  ]);
  assert.equal(getAuthorizedActiveStoreChoices(noStore, pendingFamily).length, 0);
});

test("multiple active store destinations require an explicit choice", () => {
  const activeStore = { status: "fulfilled", value: { data: { status: "active", subscriptionStatus: "active" } } };
  const activeFamily = { status: "fulfilled", value: { data: { status: "active", subscriptionStatus: "active" } } };
  assert.deepEqual(getAuthorizedActiveStoreChoices(activeStore, activeFamily), [
    { storeType: "store", label: "منتج للمتجر" },
    { storeType: "family-production", label: "منتج لمشروعي" }
  ]);
  assert.match(readSource("components/BottomNavBar.jsx"), /else setShowStoreChoices\(true\)/);
});

test("bottom add button waits for fresh store authorization and has no stale user-object dependency", () => {
  const bottomNav = readSource("components/BottomNavBar.jsx");
  assert.match(bottomNav, /disabled=\{Boolean\(userId && storeCheckLoading\)\}/);
  assert.match(bottomNav, /aria-busy=\{Boolean\(userId && storeCheckLoading\)\}/);
  assert.match(bottomNav, /activeStoreOwnerId !== String\(userId\)/);
  assert.match(bottomNav, /setActiveStoreOwnerId\(String\(userId\)\)/);
  assert.match(bottomNav, /\[api, userId\]/);
  assert.doesNotMatch(bottomNav, /\[api, user\]/);
});

test("bottom add menu navigates to the personal ad and active store product routes", () => {
  const bottomNav = readSource("components/BottomNavBar.jsx");
  assert.match(bottomNav, /navigate\("\/choose-add-type"\)/);
  const chooseAddType = readSource("pages/ChooseAddType.jsx");
  assert.match(chooseAddType, /\/add-product\?type=sell/);
  assert.match(chooseAddType, /\/add-product\?type=order/);
  assert.match(bottomNav, /\/add-product\?storeProduct=1&storeType=/);
  assert.match(bottomNav, /إعلان شخصي/);
  assert.match(bottomNav, /منتج للمتجر/);
  assert.match(bottomNav, /منتج لمشروعي/);
  assert.match(bottomNav, /storeType === "family-production"/);

  const addProduct = readSource("pages/AddProduct.jsx");
  assert.match(addProduct, /searchParams\.get\("storeType"\) === "family-production"/);
  assert.match(addProduct, /storeProductMode\s*=\s*searchParams\.get\("storeProduct"\) === "1"/);
  assert.match(addProduct, /storeType\s*=\s*searchParams\.get\("storeType"\) === "family-production"/);
});

test("store setup guide calculates independent regular and family project progress", () => {
  const incompleteStore = {
    storeName: "متجر اختبار",
    description: "",
    location: "",
    phone: "",
    logo: null
  };
  const regularProgress = getStoreSetupProgress(incompleteStore, []);
  assert.equal(regularProgress.completedCount, 0);
  assert.equal(regularProgress.complete, false);

  const completeFamilyProject = {
    _id: "family-current",
    storeName: "مشروع أسرة",
    description: "منتجات منزلية",
    location: "صنعاء",
    whatsapp: [{ value: "777777777" }],
    logo: "/logos/family.png"
  };
  const familyProgress = getStoreSetupProgress(completeFamilyProject, [{
    _id: "product-1",
    storeProfileId: "family-current"
  }], completeFamilyProject._id);
  assert.equal(familyProgress.completedCount, 4);
  assert.equal(familyProgress.complete, true);
});

test("store setup products only count ads owned by the current store or family project", () => {
  const store = {
    _id: "store-current",
    storeName: "متجر حالي",
    description: "وصف المتجر",
    location: "شارع رئيسي",
    logo: "/logos/store.png",
    phone: "777777777"
  };
  const personalAd = { _id: "ad-1", storeProfileId: null };
  const otherProjectAd = { _id: "ad-2", storeProfileId: "store-other" };
  const currentStoreAd = { _id: "ad-3", storeProfileId: { _id: "store-current" } };

  assert.equal(getStoreSetupProgress(store, [personalAd, otherProjectAd], store._id).items
    .find((item) => item.id === "products").complete, false);
  assert.equal(getStoreSetupProgress(store, [personalAd, currentStoreAd], store._id).items
    .find((item) => item.id === "products").complete, true);
});

test("store setup fields match MyStore form fields and hide before products load or when complete", () => {
  const myStore = readSource("pages/MyStore.jsx");
  assert.match(myStore, /setProductsLoaded\(false\)/);
  assert.match(myStore, /setProductsLoaded\(true\)/);
  assert.match(myStore, /productsLoaded && !setupProgress\.complete/);
  assert.match(myStore, /getStoreSetupProgress\(store, ads, store\?\._id\)/);
  assert.match(myStore, /storeProfileId/);

  assert.match(myStore, /name="description"/);
  assert.match(myStore, /name="location"/);
  assert.match(myStore, /store\.logo/);
  assert.match(myStore, /form\.phones/);
  assert.match(myStore, /form\.whatsapp/);
});

test("store management uses existing customization and products sections for setup guidance", () => {
  const myStore = readSource("pages/MyStore.jsx");
  assert.match(myStore, /getStoreSetupProgress\(store, ads, store\?\._id\)/);
  assert.match(myStore, /إكمال: \{item\.label\}/);
  assert.match(myStore, /setActiveMobileTab\(tab\)/);
  assert.match(myStore, /customizationDetailsRef\.current\.open = true/);
  assert.match(myStore, /id="customization"/);
  assert.match(myStore, /id="products"/);

  const accountHub = readSource("pages/AccountHub.jsx");
  assert.match(accountHub, /إدارة وتجهيز متجري/);
  assert.match(accountHub, /إدارة وتجهيز مشروع الأسرة/);
});

test("digital service label is unified without changing real payment text", () => {
  assert.match(readSource("pages/Home.jsx"), /الخدمات الرقمية/);
  assert.match(readSource("components/NavBar.jsx"), /الخدمات الرقمية/);
  assert.match(readSource("pages/AccountHub.jsx"), /label: "الخدمات الرقمية"/);
  assert.match(readSource("lib/serviceFeatureBanners.js"), /title: "الخدمات الرقمية وتمام باي"/);
  assert.match(readSource("pages/WalletServices.jsx"), /خدمات الدفع الإلكتروني/);
});

test("digital route status separates loading, connection failure, success, and unavailable", () => {
  const services = [{ _id: "pubg" }];
  assert.equal(getRouteServiceStatus({
    loading: true, referencesLoaded: false, dataLoadStatus: "loading",
    routeServiceId: "pubg", services, selectedId: ""
  }), "loading");
  assert.equal(getRouteServiceStatus({
    loading: false, referencesLoaded: true, dataLoadStatus: "error",
    routeServiceId: "pubg", services, selectedId: ""
  }), "error");
  assert.equal(getRouteServiceStatus({
    loading: false, referencesLoaded: true, dataLoadStatus: "success",
    routeServiceId: "missing", services, selectedId: ""
  }), "unavailable");
  assert.equal(getRouteServiceStatus({
    loading: false, referencesLoaded: true, dataLoadStatus: "success",
    routeServiceId: "pubg", services, selectedId: "pubg"
  }), "success");

  const walletServices = readSource("pages/WalletServices.jsx");
  assert.doesNotMatch(walletServices.slice(walletServices.indexOf("جارٍ تحميل تفاصيل الخدمة"), walletServices.indexOf("جارٍ تحميل تفاصيل الخدمة") + 500), /الخدمة المطلوبة غير متاحة حاليًا/);
  assert.match(walletServices, /إعادة المحاولة/);
  assert.match(walletServices, /الخدمة المطلوبة غير متاحة حاليًا/);
});

test("catalog loading has request guards and no stale unavailable warning in loading markup", () => {
  const walletServices = readSource("pages/WalletServices.jsx");
  assert.match(walletServices, /catalogLoadRequestRef/);
  assert.match(walletServices, /catalogLoadRequestRef\.current !== requestId/);
  assert.match(walletServices, /تعذر تحميل خدمات سوقك الرقمية بسبب مشكلة في الاتصال/);
  assert.match(walletServices, /تعذر تحميل تفاصيل الخدمة بسبب مشكلة في الاتصال/);
  assert.match(walletServices, /تعذر التحقق من وجود طلبات غير مكتملة/);
  assert.doesNotMatch(walletServices, /تعذر التحقق من طلباتك غير المكتملة/);

  const loadingMarkup = walletServices.slice(
    walletServices.indexOf('routeServiceStatus === "loading"'),
    walletServices.indexOf('routeServiceStatus === "error"')
  );
  assert.doesNotMatch(loadingMarkup, /الخدمة المطلوبة غير متاحة حاليًا/);

  const draftRequestSection = walletServices.slice(
    walletServices.indexOf('api.get("/draft-actions")'),
    walletServices.indexOf("return () => { cancelled = true; };", walletServices.indexOf('api.get("/draft-actions")'))
  );
  assert.match(draftRequestSection, /if \(cancelled\) return/);
});

test("TikTok account icon uses explicit black and white inline colors", () => {
  const accountSettings = readSource("pages/AccountSettings.jsx");
  const tikTokCard = accountSettings.slice(accountSettings.indexOf("https://www.tiktok.com"));
  assert.match(tikTokCard, /backgroundColor:\s*'#000000'/);
  assert.match(tikTokCard, /color:\s*'#ffffff'/);
});
