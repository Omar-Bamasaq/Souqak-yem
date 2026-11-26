import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SITE_BASE_URL,
  INDEXABLE_STATIC_PATHS,
  ROBOTS_DISALLOW_PATHS,
  buildAdPath,
  classifySeoResource,
  generateRobotsTxt,
  getAdSlug,
  getSeoRoutePolicy,
  getAppRobotsDirective,
  hasOnlyCategorySubcategoryParameter,
  hasMeaningfulQueryParameters,
  isPublicAdIndexable,
  isPublicAuctionIndexable,
  isPublicBookingServiceIndexable,
  isPublicCategoryIndexable,
  isPublicStoreIndexable,
  normalizePublicObjectId,
  resolveCanonicalUrl,
  resolveMinimumPublicAdsForSubcategory,
  resolveSiteUrl,
  shouldNoIndexAppPath,
  stripTrackingQueryParameters
} from "../../shared/seoRules.mjs";

const now = Date.parse("2026-11-25T10:00:00.000Z");
const validId = "0123456789abcdef01234567";

test("canonical URLs normalize slashes and retain only non-tracking query parameters", () => {
  assert.equal(resolveCanonicalUrl("/"), `${DEFAULT_SITE_BASE_URL}/`);
  assert.equal(
    resolveCanonicalUrl("/category/cars/?utm_source=newsletter&sub=sedan#list"),
    `${DEFAULT_SITE_BASE_URL}/category/cars?sub=sedan`
  );
  assert.equal(
    resolveCanonicalUrl("/catalog/category/cars/", "https://preview.example.test/catalog/"),
    "https://preview.example.test/catalog/category/cars"
  );
  assert.equal(
    resolveSiteUrl("/search?q=سيارة&page=2&utm_campaign=fall"),
    `${DEFAULT_SITE_BASE_URL}/search?q=%D8%B3%D9%8A%D8%A7%D8%B1%D8%A9&page=2&utm_campaign=fall`
  );
  assert.equal(
    stripTrackingQueryParameters("?utm_source=x&fbclid=abc&category=cars").toString(),
    "category=cars"
  );
  assert.equal(hasMeaningfulQueryParameters("?utm_source=x&gclid=y"), false);
  assert.equal(hasMeaningfulQueryParameters("?category=cars"), true);
  assert.equal(hasOnlyCategorySubcategoryParameter("?sub=sedan&utm_source=campaign", "sedan"), true);
  assert.equal(hasOnlyCategorySubcategoryParameter("?sub=sedan&page=1", "sedan"), false);
  assert.equal(hasOnlyCategorySubcategoryParameter("?sub=other", "sedan"), false);
  assert.equal(hasOnlyCategorySubcategoryParameter("?sub=sedan&sub=truck", "sedan"), false);
  assert.equal(hasOnlyCategorySubcategoryParameter("?utm_source=campaign", null), true);
});

test("shared robots policy uses the fixed sitemap origin and leaves public noindex routes crawlable", () => {
  const robots = generateRobotsTxt();
  assert.match(robots, /Allow: \/assets\//);
  assert.match(robots, /Allow: \/uploads\//);
  assert.match(robots, /Sitemap: https:\/\/souqak-yem\.com\/sitemap\.xml/);
  assert.doesNotMatch(robots, /Sitemap:.*(?:Host|attacker)/i);
  for (const publicPath of ["/search", "/quote-requests", "/user", "/s", "/category", "/ad", "/store", "/auctions"]) {
    assert.ok(!ROBOTS_DISALLOW_PATHS.some((path) => publicPath === path || publicPath.startsWith(path)));
  }
  assert.equal(resolveMinimumPublicAdsForSubcategory(undefined), 1);
  assert.equal(resolveMinimumPublicAdsForSubcategory("3"), 3);
  assert.throws(() => resolveMinimumPublicAdsForSubcategory("0"), /positive integer/);
  assert.throws(() => resolveMinimumPublicAdsForSubcategory("not-a-number"), /positive integer/);
});

test("same-origin URL resolution rejects malformed and external redirect targets", () => {
  for (const target of [
    "//attacker.example/path",
    "https://attacker.example/path",
    "javascript:alert(1)",
    "https://user@souqak-yem.com/path",
    "http://[",
    "/bad%ZZpath",
    "/%E0%A4%A"
  ]) {
    assert.throws(() => resolveSiteUrl(target), /Public SEO URLs/);
  }
  assert.equal(
    resolveSiteUrl("https://souqak-yem.com/category/cars"),
    `${DEFAULT_SITE_BASE_URL}/category/cars`
  );
});

test("ad slugs encode Arabic and English once and IDs keep duplicate slugs unique", () => {
  const arabicSlug = "%D8%B3%D9%8A%D8%A7%D8%B1%D8%A9";
  assert.equal(getAdSlug({ slug: arabicSlug }), "سيارة");
  assert.equal(getAdSlug({ slug: "Used-Car_2026" }), "used-car-2026");
  assert.equal(getAdSlug({ slug: "%E0%A4%A", title: "Used Car" }), "used-car");

  const firstPath = buildAdPath({ _id: validId, slug: "same-title" });
  const secondPath = buildAdPath({ _id: "fedcba9876543210fedcba98", slug: "same-title" });
  assert.equal(firstPath, `/ad/${validId}/same-title`);
  assert.equal(secondPath, "/ad/fedcba9876543210fedcba98/same-title");
  assert.notEqual(firstPath, secondPath);
  assert.equal(
    buildAdPath({ _id: validId, slug: arabicSlug }),
    `/ad/${validId}/%D8%B3%D9%8A%D8%A7%D8%B1%D8%A9`
  );
  assert.equal(normalizePublicObjectId("invalid-id"), null);
  assert.equal(buildAdPath({ _id: "invalid-id", title: "Listing" }), null);
});

test("ad indexability permits only current public, available listings", () => {
  const publicAd = {
    _id: validId,
    status: "approved",
    expiresAt: new Date(now + 60_000),
    scheduledPublishAt: new Date(now - 60_000),
    isDeleted: false,
    isVisible: true,
    isArchived: false,
    sold: false,
    isAvailable: true
  };
  assert.equal(isPublicAdIndexable(publicAd, now), true);

  for (const patch of [
    { status: "pending" },
    { status: "sold" },
    { status: "expired" },
    { status: "blocked" },
    { isDeleted: true },
    { isVisible: false },
    { isArchived: true },
    { sold: true },
    { isSold: true },
    { isAvailable: false },
    { expiresAt: new Date(now) },
    { expiresAt: "not-a-date" },
    { scheduledPublishAt: new Date(now + 60_000) },
    { scheduledPublishAt: "not-a-date" },
    { inventoryEnabled: true, stockQuantity: 0 },
    { _id: "invalid-id" }
  ]) {
    assert.equal(isPublicAdIndexable({ ...publicAd, ...patch }, now), false, JSON.stringify(patch));
  }
});

test("category, store, and auction policies require public eligible content", () => {
  const rootCategory = {
    _id: validId,
    slug: "vehicles",
    name: "Vehicles",
    description: "Cars, trucks, and transport throughout Yemen",
    status: "active",
    parentId: null
  };
  assert.equal(isPublicCategoryIndexable({
    category: rootCategory,
    isMainCategory: true
  }), true);
  assert.equal(isPublicCategoryIndexable({
    category: { ...rootCategory, description: "" },
    isMainCategory: true
  }), false);
  assert.equal(isPublicCategoryIndexable({
    category: { ...rootCategory, description: rootCategory.name },
    isMainCategory: true
  }), false);
  assert.equal(isPublicCategoryIndexable({
    category: { ...rootCategory, status: "hidden" },
    isMainCategory: true
  }), false);
  const subcategory = {
    _id: "fedcba9876543210fedcba98",
    parentId: validId,
    slug: "cars",
    name: "Cars",
    description: "Cars for daily travel across Yemen",
    status: "active"
  };
  assert.equal(isPublicCategoryIndexable({
    category: subcategory,
    isMainCategory: false,
    parentCategory: rootCategory,
    publicAdCount: 1
  }), true);
  assert.equal(isPublicCategoryIndexable({
    category: subcategory,
    isMainCategory: false,
    parentCategory: rootCategory,
    publicAdCount: 0
  }), false);
  assert.equal(isPublicCategoryIndexable({
    category: { ...subcategory, parentId: "aaaaaaaaaaaaaaaaaaaaaaaa" },
    isMainCategory: false,
    parentCategory: rootCategory,
    publicAdCount: 1
  }), false);
  assert.equal(isPublicCategoryIndexable({
    category: { ...subcategory, description: rootCategory.description },
    isMainCategory: false,
    parentCategory: rootCategory,
    relatedCategories: [rootCategory],
    publicAdCount: 1
  }), false);
  assert.equal(isPublicCategoryIndexable({
    category: subcategory,
    isMainCategory: false,
    parentCategory: rootCategory,
    publicAdCount: 2,
    minimumPublicAds: 3
  }), false);
  assert.equal(isPublicCategoryIndexable({
    category: subcategory,
    isMainCategory: false,
    parentCategory: rootCategory,
    publicAdCount: 3,
    minimumPublicAds: 3
  }), true);
  assert.equal(isPublicCategoryIndexable({
    category: { ...subcategory, description: "Car sales" },
    isMainCategory: false,
    parentCategory: rootCategory,
    publicAdCount: 1
  }), false);

  const publicStore = { status: "active" };
  assert.equal(isPublicStoreIndexable({ store: publicStore, hasActiveSubscription: true }), true);
  assert.equal(isPublicStoreIndexable({ store: publicStore, hasActiveSubscription: false }), false);
  assert.equal(isPublicStoreIndexable({
    store: publicStore,
    hasActiveSubscription: true,
    isDedicatedPwa: true
  }), false);
  assert.equal(isPublicStoreIndexable({
    store: publicStore,
    hasActiveSubscription: true,
    hasMeaningfulFilters: true
  }), false);

  const liveAuction = {
    reviewStatus: "approved",
    status: "live",
    startAt: new Date(now - 60_000),
    endAt: new Date(now + 60_000)
  };
  assert.equal(isPublicAuctionIndexable(liveAuction, now), true);
  const publicApiAuction = { ...liveAuction };
  delete publicApiAuction.reviewStatus;
  assert.equal(isPublicAuctionIndexable(publicApiAuction, now), false);
  assert.equal(isPublicAuctionIndexable(
    publicApiAuction,
    now,
    { publiclyAccessible: true }
  ), true);
  assert.equal(isPublicAuctionIndexable({
    ...publicApiAuction,
    reviewStatus: "pending"
  }, now, { publiclyAccessible: true }), false);
  assert.equal(isPublicAuctionIndexable({ ...liveAuction, status: "draft" }, now), false);
  assert.equal(isPublicAuctionIndexable({ ...liveAuction, status: "scheduled" }, now), false);
  assert.equal(isPublicAuctionIndexable({ ...liveAuction, reviewStatus: "pending" }, now), false);
  assert.equal(isPublicAuctionIndexable({ ...liveAuction, startAt: new Date(now) }, now), true);
  assert.equal(isPublicAuctionIndexable({
    ...liveAuction,
    startAt: new Date(now + 1).toISOString()
  }, now), false);
  assert.equal(isPublicAuctionIndexable({
    ...liveAuction,
    status: "live",
    endAt: new Date(now - 1)
  }, now), false);
  assert.equal(isPublicAuctionIndexable({
    ...liveAuction,
    status: "ended",
    endAt: new Date(now - 1)
  }, now), false);
  assert.equal(isPublicAuctionIndexable({ ...liveAuction, endAt: new Date(now) }, now), false);

  const publicService = {
    status: "approved",
    name: "Home maintenance",
    type: "maintenance",
    note: "Public service details"
  };
  assert.equal(isPublicBookingServiceIndexable({
    service: publicService,
    publiclyAccessible: true
  }), true);
  assert.equal(isPublicBookingServiceIndexable({
    service: publicService,
    publiclyAccessible: false
  }), false);
  assert.equal(isPublicBookingServiceIndexable({
    service: { ...publicService, status: "pending" },
    publiclyAccessible: true
  }), false);
  assert.equal(isPublicBookingServiceIndexable({
    service: { ...publicService, note: "" },
    publiclyAccessible: true
  }), false);
});

test("empty main categories index only when they have useful distinct editorial content", () => {
  const emptyMainCategory = {
    _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
    slug: "vehicles",
    name: "Vehicles",
    description: "Vehicles and cars for daily travel across Yemen",
    status: "active",
    parentId: null
  };
  assert.equal(isPublicCategoryIndexable({
    category: emptyMainCategory,
    isMainCategory: true,
    publicAdCount: 0
  }), true);
  assert.equal(isPublicCategoryIndexable({
    category: { ...emptyMainCategory, description: "" },
    isMainCategory: true,
    publicAdCount: 0
  }), false);
});

test("resource outcomes and route policy distinguish privacy, missing content, and failures", () => {
  assert.equal(classifySeoResource({ resource: null }), "not_found");
  assert.equal(classifySeoResource({ resource: {}, error: new Error("database unavailable") }), "temporary_error");
  assert.equal(classifySeoResource({ resource: {}, publiclyAccessible: false }), "not_public");
  assert.equal(classifySeoResource({ resource: {}, publiclyAccessible: true, indexable: false }), "not_indexable");
  assert.equal(classifySeoResource({ resource: {}, publiclyAccessible: true, indexable: true }), "indexable");

  assert.equal(getSeoRoutePolicy("/ad/id/slug/").type, "ad-detail");
  assert.equal(getSeoRoutePolicy("/product/id").type, "legacy-ad-alias");
  assert.equal(getSeoRoutePolicy("/category/cars/sub").indexability, "conditional");
  assert.equal(getSeoRoutePolicy("/category/cars").indexability, "conditional");
  assert.equal(getSeoRoutePolicy("/store/shop").indexability, "conditional");
  assert.equal(getSeoRoutePolicy("/auctions/123").type, "auction-detail");
  assert.equal(getSeoRoutePolicy("/auctions/new").indexability, "never");
  assert.equal(getSeoRoutePolicy("/user/seller-id").indexability, "never");
  assert.equal(getSeoRoutePolicy("/s/store-id").indexability, "never");
  assert.equal(getSeoRoutePolicy("/bookings/service-id").indexability, "never");
  assert.equal(getSeoRoutePolicy("/search").indexability, "never");
  assert.equal(getSeoRoutePolicy("/nonexistent").type, "not-found-or-unclassified");
  assert.equal(shouldNoIndexAppPath("/category/cars"), true);
  assert.equal(shouldNoIndexAppPath("/auctions/123"), true);
  assert.equal(shouldNoIndexAppPath("/account-settings"), true);
  assert.equal(shouldNoIndexAppPath("/ad/id/slug"), true);
  assert.equal(shouldNoIndexAppPath("/"), false);
  assert.equal(
    getAppRobotsDirective("/ad/id/slug", {
      hasTrustedPrerender: true,
      isInitialPath: true
    }),
    null
  );
  assert.equal(
    getAppRobotsDirective("/ad/id/slug", { isInitialPath: true }),
    "noindex,nofollow"
  );
  assert.equal(
    getAppRobotsDirective("/ad/id/slug", {
      hasTrustedPrerender: true,
      isInitialPath: false
    }),
    "noindex,nofollow"
  );
  assert.match(getAppRobotsDirective("/"), /^index,follow/);
  assert.deepEqual(
    INDEXABLE_STATIC_PATHS,
    ["/", "/categories", "/how-it-works", "/secure-deal-explanation", "/refund-escrow",
      "/platform-reviews", "/pricing", "/terms", "/privacy", "/bookings", "/stores",
      "/family-production", "/auctions"]
  );
});
