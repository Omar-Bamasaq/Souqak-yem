import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createAdStructuredData,
  createAuctionStructuredData,
  createCategoryStructuredData,
  createPublicSiteStructuredData,
  createStoreStructuredData,
  createWebPageStructuredData,
  serializeJsonLd
} from "../../shared/seoRules.mjs";

const siteBaseUrl = "https://souqak-yem.com";

test("homepage JSON-LD contains only official Organization and WebSite entities", () => {
  const graph = createPublicSiteStructuredData({ siteBaseUrl });
  assert.equal(graph["@context"], "https://schema.org");
  assert.deepEqual(
    graph["@graph"].map((entity) => entity["@type"]),
    ["Organization", "WebSite"]
  );
  assert.equal(graph["@graph"][0].name, "سوقك");
  assert.equal(graph["@graph"][0].url, siteBaseUrl);
  assert.equal(graph["@graph"][1].publisher["@id"], `${siteBaseUrl}/#organization`);
  assert.doesNotMatch(JSON.stringify(graph), /AggregateRating|potentialAction|SearchAction|telephone|address/);
});

test("physical product ads produce Product and real ISO currency Offers", () => {
  const base = {
    _id: "0123456789abcdef01234567",
    adType: "sell",
    title: "سيارة اصطناعية",
    description: "وصف عام ومشروع للاختبار",
    status: "approved",
    isDeleted: false,
    isVisible: true,
    isArchived: false,
    sold: false,
    isAvailable: true,
    expiresAt: "2099-01-01T00:00:00.000Z",
    price: 125000,
    priceOnContact: false,
    categoryId: { _id: "aaaaaaaaaaaaaaaaaaaaaaaa", slug: "cars", name: "سيارات" }
  };
  for (const [currency, iso] of [["YER_ADEN", "YER"], ["YER_SANAA", "YER"], ["SAR", "SAR"], ["USD", "USD"]]) {
    const data = createAdStructuredData({
      ad: { ...base, currency },
      url: "/ad/0123456789abcdef01234567/synthetic-car",
      siteBaseUrl
    });
    assert.equal(data["@type"], "Product");
    assert.equal(data.offers.priceCurrency, iso);
  }
});

test("non-products, orders, negotiated prices and unavailable ads do not create fake Offers", () => {
  const common = {
    _id: "0123456789abcdef01234567",
    status: "approved",
    isDeleted: false,
    isVisible: true,
    isArchived: false,
    sold: false,
    isAvailable: true,
    expiresAt: "2099-01-01T00:00:00.000Z",
    price: 100,
    priceOnContact: false,
    currency: "USD"
  };
  const url = "/ad/0123456789abcdef01234567/synthetic";
  const service = createAdStructuredData({
    ad: { ...common, adType: "sell", title: "خدمة تركيب", description: "خدمة عامة", categoryId: { slug: "services", name: "خدمات" } },
    url,
    siteBaseUrl
  });
  assert.equal(service["@type"], "WebPage");
  assert.equal("offers" in service, false);

  const order = createAdStructuredData({
    ad: { ...common, adType: "order", title: "طلب سلعة", categoryId: { slug: "cars", name: "سيارات" } },
    url,
    siteBaseUrl
  });
  assert.equal(order["@type"], "WebPage");

  const negotiated = createAdStructuredData({
    ad: { ...common, adType: "sell", title: "قابل للتفاوض", priceOnContact: true, categoryId: { slug: "electronics", name: "إلكترونيات" } },
    url,
    siteBaseUrl
  });
  assert.equal(negotiated["@type"], "Product");
  assert.equal("offers" in negotiated, false);

  const unavailable = createAdStructuredData({
    ad: { ...common, adType: "sell", title: "سلعة مباع", sold: true, categoryId: { slug: "electronics", name: "إلكترونيات" } },
    url,
    siteBaseUrl
  });
  assert.equal(unavailable["@type"], "WebPage");
  assert.equal("offers" in unavailable, false);
});

test("category structured data includes only public visible ads and breadcrumb hierarchy", () => {
  const category = {
    name: "سيارات",
    description: "تصنيف السيارات العامة والبيانات المفيدة.",
    slug: "cars"
  };
  const ads = [
    { _id: "aaaaaaaaaaaaaaaaaaaaaaaa", slug: "same-title", title: "سيارة 1", status: "approved", isDeleted: false, isVisible: true, isArchived: false, sold: false, expiresAt: "2099-01-01T00:00:00.000Z" },
    { _id: "bbbbbbbbbbbbbbbbbbbbbbbb", slug: "same-title", title: "سيارة 2", status: "approved", isDeleted: false, isVisible: true, isArchived: false, sold: false, expiresAt: "2099-01-01T00:00:00.000Z" },
    { _id: "cccccccccccccccccccccccc", slug: "sold", title: "سيارة مباع", status: "approved", isDeleted: false, isVisible: true, isArchived: false, sold: true, expiresAt: "2099-01-01T00:00:00.000Z" }
  ];
  const data = createCategoryStructuredData({
    category,
    url: "/category/cars",
    ads,
    breadcrumbs: [
      { name: "الرئيسية", url: "/" },
      { name: "سيارات", url: "/category/cars" }
    ],
    siteBaseUrl
  });
  const itemList = data["@graph"].find((entity) => entity["@type"] === "ItemList");
  assert.equal(itemList.numberOfItems, 2);
  assert.equal(itemList.itemListElement.length, 2);
  assert.ok(data["@graph"].some((entity) => entity["@type"] === "BreadcrumbList"));
});

test("store and auction structured data avoid private fields and fake availability", () => {
  const store = createStoreStructuredData({
    store: {
      slug: "synthetic-store",
      storeName: "متجر اصطناعي",
      description: "متجر عام للاختبار",
      businessActivity: "إلكترونيات",
      ownerId: "owner-must-not-appear",
      phone: "967700000000"
    },
    url: "/store/synthetic-store",
    products: [],
    siteBaseUrl
  });
  assert.equal(store["@graph"][0]["@type"], "OnlineStore");
  const serializedStore = JSON.stringify(store);
  assert.doesNotMatch(serializedStore, /owner-must-not-appear|967700000000|AggregateRating|address|telephone/);

  const auction = createAuctionStructuredData({
    auction: {
      title: "مزاد اصطناعي",
      description: "سلعة مزاد عامة للاختبار",
      status: "live",
      reviewStatus: "approved",
      publiclyAccessible: true,
      startAt: "2020-01-01T00:00:00.000Z",
      endAt: "2099-01-01T00:00:00.000Z",
      winnerId: "winner-must-not-appear",
      bidCount: 999
    },
    url: "/auctions/0123456789abcdef01234567",
    siteBaseUrl
  });
  assert.equal(auction["@graph"][0]["@type"], "WebPage");
  assert.doesNotMatch(JSON.stringify(auction), /winner-must-not-appear|999|AggregateRating|Offer/);

  const ended = createAuctionStructuredData({
    auction: {
      title: "مزاد منتهي",
      status: "ended",
      reviewStatus: "approved",
      publiclyAccessible: true,
      startAt: "2020-01-01T00:00:00.000Z",
      endAt: "2020-02-01T00:00:00.000Z"
    },
    url: "/auctions/0123456789abcdef01234567",
    siteBaseUrl
  });
  assert.equal(ended, null);
});

test("JSON-LD serialization closes script tags and XSS metacharacters", () => {
  const data = createWebPageStructuredData({
    name: "</script><script>alert(1)</script>",
    description: "XSS & <b>raw</b>",
    url: "/terms",
    siteBaseUrl
  });
  const serialized = serializeJsonLd(data);
  assert.doesNotMatch(serialized, /<\/script>/i);
  assert.match(serialized, /\\u003c\/script\\u003e/);
  assert.doesNotMatch(serialized, /&b/);
});

test("PublicPageSEO adds route-specific WebPage or homepage graph without SearchAction", () => {
  const source = fs.readFileSync(
    new URL("../src/components/PublicPageSEO.jsx", import.meta.url),
    "utf8"
  );
  assert.match(source, /createPublicSiteStructuredData/);
  assert.match(source, /createWebPageStructuredData/);
});
