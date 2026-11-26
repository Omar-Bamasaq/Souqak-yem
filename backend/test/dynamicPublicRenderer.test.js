import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { createDynamicCategoryResource } from "../src/services/dynamicCategoryRenderer.js";
import { createDynamicStoreResource } from "../src/services/dynamicStoreRenderer.js";
import { createDynamicAuctionResource } from "../src/services/dynamicAuctionRenderer.js";
import { createDynamicSeoRenderer } from "../src/services/dynamicSeoRenderer.js";
import { BoundedLruCache, BoundedSeoWorkLimiter } from "../src/services/seoCache.js";

const ID = "0123456789abcdef01234567";
const PARENT_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const CHILD_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const SITE = "https://souqak-yem.com";
const API_ORIGIN = "https://api.souqak-yem.com";
const TEMPLATE = `<!doctype html><html lang="ar" dir="rtl"><head>
<title>Homepage</title><meta name="description" content="Homepage description"/>
<meta name="robots" content="noindex,nofollow"/>
<link rel="stylesheet" href="/assets/index-a1b2.css"/>
</head><body><div id="root"></div>
<script type="module" crossorigin src="/assets/index-c3d4.js"></script>
</body></html>`;

function makeCategory(overrides = {}) {
  return {
    _id: PARENT_ID,
    name: "سيارات",
    slug: "cars",
    description: "سيارات ومركبات للبيع والشراء",
    parentId: null,
    status: "active",
    image: null,
    ...overrides
  };
}

function makeSubcategory(overrides = {}) {
  return {
    _id: CHILD_ID,
    name: "سيارات مستعملة",
    slug: "used-cars",
    description: "سيارات مستعملة بحالة جيدة للبيع",
    parentId: PARENT_ID,
    status: "active",
    image: null,
    ...overrides
  };
}

function makeStore(overrides = {}) {
  return {
    _id: ID,
    storeName: "معرض السيارات",
    slug: "car-showroom",
    storeType: "store",
    activityKey: "cars",
    businessActivity: "بيع السيارات",
    description: "سيارات مختارة للبيع",
    logo: "stores/logo.webp",
    cover: "stores/cover.webp",
    status: "active",
    selectedCategories: [{ _id: PARENT_ID, name: "سيارات", slug: "cars" }],
    owner: { email: "private@example.test", phone: "967771234567" },
    ...overrides
  };
}

function makeAuction(overrides = {}) {
  const now = Date.now();
  return {
    _id: ID,
    title: "مزاد سيارة",
    description: "سيارة بحالة جيدة للمزاد",
    itemCondition: "مستعملة",
    defectsNotes: "",
    deliveryMethod: "pickup",
    deliveryDetails: "",
    images: ["auctions/car.webp"],
    categoryId: { name: "سيارات", slug: "cars" },
    governorateId: { name: "صنعاء" },
    cityId: { name: "حدة" },
    currency: "YER",
    startingPrice: 100,
    currentPrice: 150,
    minimumIncrement: 10,
    durationDays: 3,
    startAt: new Date(now - 60_000),
    endAt: new Date(now + 60_000),
    status: "live",
    reviewStatus: "approved",
    createdAt: new Date(now - 120_000),
    bidCount: 2,
    ownerId: { name: "بائع عام", avatar: null, email: "private@example.test" },
    winnerId: "private-winner-id",
    approvedBy: "private-admin-id",
    categoryDocuments: [{ url: "/uploads/auction-documents/private.pdf" }],
    ...overrides
  };
}

async function startTestServer(resources, options = {}) {
  const app = express();
  app.use(createDynamicSeoRenderer({
    resources,
    template: TEMPLATE,
    siteBaseUrl: SITE,
    apiOrigin: API_ORIGIN,
    ...options
  }));
  app.use((_req, res) => res.status(404).send("fallback"));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    request(path) {
      return new Promise((resolve, reject) => {
        const request = http.request({
          hostname: "127.0.0.1",
          port: address.port,
          path,
          method: "GET",
          headers: { accept: "text/html" }
        }, (response) => {
          const chunks = [];
          response.on("data", (chunk) => chunks.push(chunk));
          response.on("end", () => resolve({
            status: response.statusCode,
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8")
          }));
        });
        request.on("error", reject);
        request.end();
      });
    },
    close() {
      return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  };
}

function getHydrationData(html) {
  const match = html.match(/window\.__SOUQAK_SSG_DATA__=([\s\S]*?);<\/script>/);
  assert.ok(match, "expected serialized SSG data");
  return JSON.parse(match[1]);
}

test("disabled HTML cache cannot bypass the bounded renderer work limit", async (t) => {
  let finish;
  const resource = {
    resourceLabel: "اختبار",
    match(req) {
      return req.path.startsWith("/public/")
        ? { valid: true, rawPath: req.path, queryString: "", pathSegments: [] }
        : null;
    },
    async render({ res }) {
      await new Promise((resolve) => { finish = resolve; });
      return res.status(200).send("synthetic public page");
    }
  };
  const server = await startTestServer([resource], {
    cache: new BoundedLruCache({ enabled: false, maxInFlight: 4 }),
    workLimiter: new BoundedSeoWorkLimiter(1)
  });
  t.after(() => server.close());

  const first = server.request("/public/one");
  while (!finish) await new Promise((resolve) => setImmediate(resolve));
  const overloaded = await server.request("/public/two");
  assert.equal(overloaded.status, 503);
  assert.equal(overloaded.headers["retry-after"], "30");
  assert.match(overloaded.headers["x-robots-tag"], /noindex/);
  assert.equal(overloaded.headers["cache-control"], "no-store, max-age=0");

  finish();
  assert.equal((await first).status, 200);
});

test("main categories render useful indexable HTML even with no ads", async (t) => {
  const server = await startTestServer([
    createDynamicCategoryResource({
      loadCategory: async () => ({
        kind: "found",
        category: makeCategory(),
        children: [],
        selectedSubcategory: null,
        ads: [],
        total: 0,
        breadcrumbs: [{ name: "الرئيسية", url: "/" }, { name: "سيارات", url: "/category/cars" }]
      })
    })
  ]);
  t.after(() => server.close());

  const response = await server.request("/category/cars");
  assert.equal(response.status, 200);
  assert.match(response.body, /name="robots" content="index,follow/);
  assert.match(response.body, new RegExp(`rel="canonical" href="${SITE}/category/cars"`));
  assert.match(response.body, /سيارات ومركبات للبيع والشراء/);
  assert.equal(getHydrationData(response.body).kind, "category-static");
  const trailingSlash = await server.request("/category/cars/");
  assert.match(trailingSlash.body, /name="souqak-prerendered-path" content="\/category\/cars\/"/);
  assert.match(trailingSlash.body, new RegExp(`rel="canonical" href="${SITE}/category/cars"`));
});

test("subcategory threshold is configurable and meaningful filters remain noindex", async (t) => {
  let publicAdCount = 1;
  const loadCategory = async (target) => ({
    kind: "found",
    category: makeCategory(),
    children: [makeSubcategory()],
    selectedSubcategory: target.pathSegments[1] === "used-cars" ||
      new URLSearchParams(target.queryString).get("sub") === "used-cars"
      ? makeSubcategory()
      : null,
    ads: [{ _id: ID, slug: "used-car", title: "سيارة مستعملة" }],
    total: publicAdCount,
    breadcrumbs: [{ name: "الرئيسية", url: "/" }, { name: "سيارات", url: "/category/cars" }]
  });
  const server = await startTestServer([
    createDynamicCategoryResource({ loadCategory, minimumPublicAds: 2 })
  ]);
  t.after(() => server.close());

  const belowThreshold = await server.request("/category/cars/used-cars");
  assert.equal(belowThreshold.status, 200);
  assert.match(belowThreshold.body, /name="robots" content="noindex,nofollow"/);
  publicAdCount = 2;
  const eligible = await server.request("/category/cars/used-cars");
  assert.match(eligible.body, /name="robots" content="index,follow/);
  const trackingOnly = await server.request("/category/cars/used-cars?utm_source=test");
  assert.match(trackingOnly.body, /name="robots" content="index,follow/);
  const legacySubcategory = await server.request("/category/cars?sub=used-cars");
  assert.match(legacySubcategory.body, /name="robots" content="index,follow/);
  assert.match(legacySubcategory.body, /name="souqak-prerendered-path" content="\/category\/cars"/);
  const filtered = await server.request("/category/cars/used-cars?page=2");
  assert.match(filtered.body, /name="robots" content="noindex,nofollow"/);
  assert.doesNotMatch(filtered.body, /window\.__SOUQAK_SSG_DATA__/);
  const missingSubcategory = await server.request("/category/cars/not-a-subcategory");
  assert.equal(missingSubcategory.status, 404);
  assert.match(missingSubcategory.headers["x-robots-tag"], /noindex/);
  assert.doesNotMatch(missingSubcategory.body, /rel="canonical"/);
});

test("store HTML and hydration data expose only the public allowlist", async (t) => {
  const server = await startTestServer([
    createDynamicStoreResource({
      loadStore: async () => ({
        kind: "found",
        store: makeStore(),
        products: [{
          _id: CHILD_ID,
          slug: "public-car",
          title: "سيارة للبيع",
          images: ["ads/car.webp"],
          phone: "967771234567",
          owner: { email: "private@example.test" }
        }],
        total: 1
      })
    })
  ]);
  t.after(() => server.close());

  const response = await server.request("/store/car-showroom");
  assert.equal(response.status, 200);
  assert.match(response.body, /name="robots" content="index,follow/);
  assert.match(response.body, new RegExp(`rel="canonical" href="${SITE}/store/car-showroom"`));
  assert.doesNotMatch(response.body, /private@example\.test|967771234567|private-winner-id/);
  const data = getHydrationData(response.body).data;
  assert.equal(data.store.storeName, "معرض السيارات");
  assert.equal("owner" in data.store, false);
  assert.equal("phone" in data.products[0], false);
});

test("private stores render noindex not-found HTML", async (t) => {
  const server = await startTestServer([
    createDynamicStoreResource({
      loadStore: async () => ({ kind: "not_public" })
    })
  ]);
  t.after(() => server.close());

  const response = await server.request("/store/private-store");
  assert.equal(response.status, 404);
  assert.match(response.headers["x-robots-tag"], /noindex/);
  assert.match(response.body, /name="robots" content="noindex,nofollow"/);
  assert.doesNotMatch(response.body, /rel="canonical"/);
});

test("store PWA ID and nested routes bypass the storefront HTML resource", () => {
  const resource = createDynamicStoreResource();
  assert.equal(resource.match({ url: `/store/${ID}` }), null);
  assert.equal(resource.match({ url: `/store/${ID}/manifest.webmanifest` }), null);
});

test("only currently live, approved auctions receive index directives", async (t) => {
  let auction = makeAuction();
  const server = await startTestServer([
    createDynamicAuctionResource({
      loadAuction: async () => ({ kind: "found", auction })
    })
  ]);
  t.after(() => server.close());

  const live = await server.request(`/auctions/${ID}`);
  assert.equal(live.status, 200);
  assert.match(live.body, /name="robots" content="index,follow/);
  assert.match(live.body, new RegExp(`rel="canonical" href="${SITE}/auctions/${ID}"`));
  assert.doesNotMatch(live.body, /private@example\.test|private-winner-id|private-admin-id|auction-documents/);

  auction = makeAuction({ status: "scheduled", startAt: new Date(Date.now() + 60_000) });
  const scheduled = await server.request(`/auctions/${ID}`);
  assert.equal(scheduled.status, 200);
  assert.match(scheduled.body, /name="robots" content="noindex,nofollow"/);

  auction = makeAuction({
    status: "ended",
    endAt: new Date(Date.now() - 60_000),
    endedAt: new Date()
  });
  const ended = await server.request(`/auctions/${ID}`);
  assert.equal(ended.status, 200);
  assert.match(ended.body, /name="robots" content="noindex,nofollow"/);
});

test("resource lookup errors are retryable and never produce indexable HTML", async (t) => {
  const server = await startTestServer([
    createDynamicCategoryResource({
      loadCategory: async () => { throw Object.assign(new Error("private db details"), { code: "ECONNRESET" }); }
    })
  ]);
  t.after(() => server.close());

  const response = await server.request("/category/cars");
  assert.equal(response.status, 503);
  assert.equal(response.headers["retry-after"], "30");
  assert.match(response.headers["x-robots-tag"], /noindex/);
  assert.match(response.body, /تعذر تحميل الفئة حالياً/);
  assert.doesNotMatch(response.body, /private db details|ECONNRESET/);
});
