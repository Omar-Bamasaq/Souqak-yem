import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  createPublicPrerenderPlan,
  INDEXABLE_STATIC_ROUTES,
  NON_INDEXABLE_STATIC_PATHS,
  PRERENDER_AD_PAGE_LIMIT,
  resolveSiteBaseUrl
} from "../scripts/prerenderRoutes.mjs";
import { INDEXABLE_STATIC_PATHS } from "../../shared/seoRules.mjs";
import { resolveCanonicalUrl, resolveSiteUrl } from "../src/lib/siteUrl.js";
import { isPublicAdIndexable } from "../src/lib/publicAdIndexing.js";
import { createAdStructuredData, createBreadcrumbList } from "../src/lib/structuredData.js";
import { runAtomicPrerender, validatePrerenderOutput } from "../scripts/prerenderBuild.mjs";
import {
  loadPrerenderSnapshot,
  PRERENDER_SNAPSHOT_SCHEMA_VERSION,
  validatePrerenderSnapshot
} from "../scripts/validatePrerenderSnapshot.mjs";
import { generateFromPrerenderData, getPrerenderData } from "../scripts/prerenderData.mjs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicSsgContent } from "../src/ssg/PublicSsgContent.mjs";
import os from "node:os";

const projectRoot = process.cwd();
const snapshotNow = Date.parse("2026-10-22T06:00:00.000Z");
const snapshotCategoryId = "aaaaaaaaaaaaaaaaaaaaaaaa";

test("the shared static sitemap route list matches rendered App routes", () => {
  assert.deepEqual(
    INDEXABLE_STATIC_ROUTES.map(({ path: routePath }) => routePath),
    INDEXABLE_STATIC_PATHS
  );
  const appSource = fs.readFileSync(path.join(projectRoot, "src", "App.jsx"), "utf8");
  for (const routePath of INDEXABLE_STATIC_PATHS) {
    assert.ok(appSource.includes(`path="${routePath}"`), `Missing App route ${routePath}`);
  }
});

async function writeCompletePrerenderOutput(directory, indexHtml) {
  const siteBaseUrl = "https://souqak-yem.com";
  const sitemapUrls = INDEXABLE_STATIC_ROUTES.map(({ canonical }) => `${siteBaseUrl}${canonical}`);
  for (const [index, route] of INDEXABLE_STATIC_ROUTES.entries()) {
    const targetDirectory = route.path === "/"
      ? directory
      : path.join(directory, route.path.replace(/^\//, ""));
    await fs.promises.mkdir(targetDirectory, { recursive: true });
    await fs.promises.writeFile(
      path.join(targetDirectory, "index.html"),
      `<html><head><meta name="robots" content="index,follow" /><meta name="souqak-prerendered-path" content="${route.path}" /><link rel="canonical" href="${sitemapUrls[index]}" /></head><body>${indexHtml}</body></html>`,
      "utf8"
    );
  }
  await fs.promises.writeFile(
    path.join(directory, "sitemap.xml"),
    `<?xml version="1.0"?><urlset>${sitemapUrls.map((url) => `<url><loc>${url}</loc></url>`).join("")}</urlset>`,
    "utf8"
  );
  await fs.promises.writeFile(
    path.join(directory, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${siteBaseUrl}/sitemap.xml\n`,
    "utf8"
  );
  await fs.promises.writeFile(
    path.join(directory, "prerender-manifest.json"),
    JSON.stringify({
      version: 1,
      source: "local",
      siteBaseUrl,
      staticPaths: INDEXABLE_STATIC_ROUTES.map(({ path: routePath }) => routePath),
      categoryPaths: [],
      adPaths: [],
      sitemapUrls
    }),
    "utf8"
  );
  await fs.promises.writeFile(
    path.join(directory, "dynamic-ad-renderer-template.html"),
    '<html><head><meta name="robots" content="noindex,nofollow"/></head><body><div id="root"></div></body></html>',
    "utf8"
  );
}

function createSnapshot() {
  const category = {
    _id: snapshotCategoryId,
    slug: "cars",
    name: "Cars",
    description: "Public vehicle listings",
    parentId: null,
    status: "active",
    image: null,
    children: [{
      _id: "bbbbbbbbbbbbbbbbbbbbbbbb",
      slug: "sedans",
      name: "Sedans",
      description: "Public sedan listings",
      parentId: snapshotCategoryId,
      status: "active",
      image: null,
      children: []
    }]
  };
  const ad = {
    _id: "0123456789abcdef01234567",
    slug: "sample-listing",
    title: "Sample listing",
    description: "Public description",
    status: "approved",
    isDeleted: false,
    isVisible: true,
    isArchived: false,
    sold: false,
    expiresAt: "2027-01-01T00:00:00.000Z",
    adType: "sell",
    price: 100,
    currency: "YER_ADEN",
    priceOnContact: false,
    images: [],
    categoryId: { _id: snapshotCategoryId, slug: "cars", name: "Cars" },
    subcategory: {
      _id: "bbbbbbbbbbbbbbbbbbbbbbbb",
      parentId: snapshotCategoryId,
      slug: "sedans",
      name: "Sedans",
      description: "Public sedan listings",
      status: "active"
    },
    governorateId: { name: "Public governorate" },
    cityId: null
  };
  return {
    metadata: {
      source: "authorized-local-export",
      sourceDatabase: "authorized-local-database-export",
      exportedAt: "2026-10-21T06:00:00.000Z",
      schemaVersion: PRERENDER_SNAPSHOT_SCHEMA_VERSION,
      siteBaseUrl: "https://souqak-yem.com"
    },
    categories: [category],
    ads: [ad],
    categorySsgDataBySlug: {
      cars: {
        category,
        breadcrumbs: [
          { name: "الرئيسية", slug: "" },
          { name: "Cars", slug: "cars" }
        ],
        subcategories: category.children,
        ads: []
      }
    }
  };
}

test("platform reviews has a route-specific canonical URL", () => {
  const pageSources = new Map([
    ["PlatformReviews.jsx", /PublicPageSEO path=["']\/platform-reviews["']/],
    ["Home.jsx", /path=["']\/["']/],
    ["CategoryPage.jsx", /canonicalUrl=\{canonicalPath\}/],
    ["ProductDetail.jsx", /canonicalUrl=\{canonicalAdUrl\}/],
    ["Storefront.jsx", /canonicalUrl=\{storePath\}/]
  ]);
  for (const [filename, expectedCanonical] of pageSources) {
    const source = fs.readFileSync(
      path.join(projectRoot, "src", "pages", filename),
      "utf8"
    );
    assert.match(source, expectedCanonical, `${filename} should define a page-specific canonical`);
  }
  const seoSource = fs.readFileSync(
    path.join(projectRoot, "src", "components", "SEO.jsx"),
    "utf8"
  );

  assert.match(seoSource, /resolveCanonicalUrl\(canonicalUrl, baseUrl\)/);
  const publicSeoSource = fs.readFileSync(
    path.join(projectRoot, "src", "components", "PublicPageSEO.jsx"),
    "utf8"
  );
  assert.match(publicSeoSource, /canonicalUrl=\{path\}/);
  assert.equal(resolveCanonicalUrl("/platform-reviews"), "https://souqak-yem.com/platform-reviews");
  assert.equal(
    resolveCanonicalUrl("/platform-reviews", "https://preview.example.test/site/"),
    "https://preview.example.test/site/platform-reviews"
  );
});

test("only explicitly selected public routes are eligible for the sitemap", () => {
  const routes = new Set(INDEXABLE_STATIC_ROUTES.map(({ path: routePath }) => routePath));
  assert.deepEqual([...routes], INDEXABLE_STATIC_PATHS);
  const nonIndexable = new Set(NON_INDEXABLE_STATIC_PATHS);
  const appSource = fs.readFileSync(path.join(projectRoot, "src", "App.jsx"), "utf8");
  const prerenderSource = fs.readFileSync(
    path.join(projectRoot, "scripts", "prerender.mjs"),
    "utf8"
  );
  const prerenderRoutesSource = fs.readFileSync(
    path.join(projectRoot, "scripts", "prerenderRoutes.mjs"),
    "utf8"
  );
  const productPageSource = fs.readFileSync(
    path.join(projectRoot, "src", "pages", "ProductDetail.jsx"),
    "utf8"
  );
  const sitemapSource = fs.readFileSync(
    path.join(projectRoot, "..", "backend", "src", "services", "dynamicSitemap.js"),
    "utf8"
  );
  assert.match(prerenderRoutesSource, /from "\.\.\/\.\.\/shared\/seoRules\.mjs"/);
  assert.match(productPageSource, /indexable=\{isPublicAdIndexable\(p\)\}/);
  assert.match(sitemapSource, /INDEXABLE_STATIC_PATHS/);

  for (const routePath of ["/bookings", "/stores", "/family-production", "/auctions"]) {
    assert.ok(routes.has(routePath), `${routePath} should be in the public route policy`);
    assert.match(appSource, new RegExp(`<Route path="${routePath.replaceAll("/", "\\/")}"`));
  }
  assert.ok(routes.has("/refund-escrow"));
  assert.ok(!nonIndexable.has("/refund-escrow"));
  const refundPage = INDEXABLE_STATIC_ROUTES.find(({ path: routePath }) => routePath === "/refund-escrow");
  assert.ok(refundPage.title);
  assert.ok(refundPage.description);
  const refundMarkup = renderToStaticMarkup(
    React.createElement(PublicSsgContent, { kind: "refund-escrow", data: {} })
  );
  assert.match(refundMarkup, /<h1[^>]*>الشراء الآمن عبر أمانة<\/h1>/);
  assert.match(refundMarkup, /<img[^>]*src="\/Amana-Logo\.svg"/);
  for (const routePath of ["/admin", "/messages", "/wallet", "/my-ads"]) {
    assert.ok(nonIndexable.has(routePath), `${routePath} should be marked non-indexable`);
    assert.ok(!routes.has(routePath), `${routePath} must not be listed as public`);
    assert.ok(prerenderSource.includes(`path: '${routePath}'`));
    assert.ok(prerenderSource.includes(`canonical: '${routePath}'`));
  }

  assert.equal(resolveSiteBaseUrl("https://preview.example.test/"), "https://preview.example.test");
  assert.throws(() => resolveSiteBaseUrl("http://preview.example.test"), /must use HTTPS/);
  assert.equal(
    resolveCanonicalUrl("https://preview.example.test/site/category/cars?sub=used", "https://preview.example.test/site/"),
    "https://preview.example.test/site/category/cars?sub=used"
  );
  assert.equal(
    resolveSiteUrl("https://preview.example.test/site/category/cars", "https://preview.example.test/site/"),
    "https://preview.example.test/site/category/cars"
  );
});

test("prerender validation CLI checks complete output and rejects a missing sitemap page", async () => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "souqak-prerender-cli-"));
  const validatorPath = path.join(projectRoot, "scripts", "prerenderBuild.mjs");
  try {
    await writeCompletePrerenderOutput(
      directory,
      '<main class="ssg-public-content"><h1>محتوى تجريبي</h1><p>محتوى عام مفيد لاختبار التحقق من مخرجات صفحات سوقك العامة قبل تفعيل الفهرسة في HTML الأولي.</p></main>'
    );
    const validResult = spawnSync(process.execPath, [validatorPath, "--validate", directory], {
      encoding: "utf8"
    });
    assert.equal(validResult.status, 0, validResult.stderr);

    const pagePath = path.join(directory, "platform-reviews", "index.html");
    const completePage = await fs.promises.readFile(pagePath, "utf8");
    await fs.promises.writeFile(
      pagePath,
      completePage.replace(/<main\b[^>]*>[\s\S]*?<\/main>/i, "<div>shell only</div>"),
      "utf8"
    );
    await assert.rejects(
      validatePrerenderOutput(directory),
      /visible H1 and useful initial content/
    );

    await fs.promises.rm(path.join(directory, "platform-reviews", "index.html"));
    const invalidResult = spawnSync(process.execPath, [validatorPath, "--validate", directory], {
      encoding: "utf8"
    });
    assert.equal(invalidResult.status, 1);
    assert.match(invalidResult.stderr, /A route listed in the prerender manifest is missing/);
  } finally {
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
});

test("sitemap pages require a matching canonical and an indexable robots directive", async () => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "souqak-prerender-canonical-"));
  try {
    await writeCompletePrerenderOutput(
      directory,
      '<main class="ssg-public-content"><h1>محتوى تجريبي</h1><p>محتوى عام مفيد لاختبار التحقق من مخرجات صفحات سوقك العامة قبل تفعيل الفهرسة في HTML الأولي.</p></main>'
    );
    const pagePath = path.join(directory, "platform-reviews", "index.html");
    const canonicalPage = await fs.promises.readFile(pagePath, "utf8");
    await fs.promises.writeFile(
      pagePath,
      canonicalPage.replace('content="index,follow"', 'content="noindex,follow"'),
      "utf8"
    );
    await assert.rejects(
      validatePrerenderOutput(directory),
      /matching canonical and must not be noindex/
    );
    await fs.promises.writeFile(
      pagePath,
      canonicalPage.replace(
        'content="/platform-reviews"',
        'content="/different-prerendered-path"'
      ),
      "utf8"
    );
    await assert.rejects(
      validatePrerenderOutput(directory),
      /matching canonical and must not be noindex/
    );
    await fs.promises.writeFile(
      pagePath,
      canonicalPage.replace(
        'href="https://souqak-yem.com/platform-reviews"',
        'href="https://external.example/platform-reviews"'
      ),
      "utf8"
    );
    await assert.rejects(
      validatePrerenderOutput(directory),
      /matching canonical and must not be noindex/
    );
  } finally {
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
});

test("duplicate ad slugs still produce distinct sitemap URLs", () => {
  const ads = [
    { _id: "aaaaaaaaaaaaaaaaaaaaaaaa", title: "Same title", slug: "same-title", status: "approved", isVisible: true, isDeleted: false, isArchived: false, sold: false, expiresAt: "2099-01-01" },
    { _id: "bbbbbbbbbbbbbbbbbbbbbbbb", title: "Same title", slug: "same-title", status: "approved", isVisible: true, isDeleted: false, isArchived: false, sold: false, expiresAt: "2099-01-01" }
  ];
  const plan = createPublicPrerenderPlan({
    siteBase: "https://souqak-yem.com/",
    ads
  });
  assert.equal(plan.adPages.length, 2);
  assert.equal(plan.sitemapUrls.filter((url) => url.includes("/ad/")).length, 2);
  assert.equal(new Set(plan.adPages.map((page) => page.url)).size, 2);
  assert.deepEqual(
    plan.adPages.map((page) => page.url).sort(),
    [
      "https://souqak-yem.com/ad/aaaaaaaaaaaaaaaaaaaaaaaa/same-title",
      "https://souqak-yem.com/ad/bbbbbbbbbbbbbbbbbbbbbbbb/same-title"
    ].sort()
  );
});

test("sitemap URLs match category and ad pages with prerender data", () => {
  const cars = {
    _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
    id: "aaaaaaaaaaaaaaaaaaaaaaaa",
    slug: "cars",
    name: "Cars",
    description: "Vehicles offered for sale",
    status: "active",
    parentId: null
  };
  const empty = {
    _id: "bbbbbbbbbbbbbbbbbbbbbbbb",
    id: "bbbbbbbbbbbbbbbbbbbbbbbb",
    slug: "empty",
    name: "Empty",
    description: "A distinct empty category description",
    status: "active",
    parentId: null
  };
  const sedans = {
    _id: "cccccccccccccccccccccccc",
    id: "cccccccccccccccccccccccc",
    slug: "sedans",
    name: "Sedans",
    description: "Descriptions for available sedans",
    status: "active",
    parentId: cars._id
  };
  const subcategoryAd = {
    _id: "dddddddddddddddddddddddd",
    title: "Public sedan",
    slug: "public-sedan",
    status: "approved",
    isDeleted: false,
    isVisible: true,
    isArchived: false,
    sold: false,
    expiresAt: "2099-01-01T00:00:00.000Z",
    categoryId: { _id: cars._id, slug: cars.slug, name: cars.name },
    subcategory: { _id: sedans._id, parentId: cars._id, slug: sedans.slug, name: sedans.name }
  };
  const categorySsgDataBySlug = new Map([
    ["cars", {
      category: cars,
      breadcrumbs: [],
      subcategories: [sedans],
      ads: [subcategoryAd]
    }],
    ["empty", { category: empty, breadcrumbs: [], subcategories: [], ads: [] }]
  ]);
  const ads = Array.from({ length: 12 }, (_, index) => ({
    _id: (index + 1).toString(16).padStart(24, "0"),
    title: `Listing ${index + 1}`,
    status: "approved",
    expiresAt: "2099-01-01T00:00:00.000Z"
  }));
  ads.push(
    { _id: "aaaaaaaaaaaaaaaaaaaaaaaa", status: "pending", expiresAt: "2099-01-01" },
    { _id: "bbbbbbbbbbbbbbbbbbbbbbbb", status: "approved", sold: true, expiresAt: "2099-01-01" },
    { _id: "cccccccccccccccccccccccc", status: "approved", expiresAt: "2000-01-01" },
    { _id: "dddddddddddddddddddddddd", status: "approved", isDeleted: true, expiresAt: "2099-01-01" },
    { _id: "eeeeeeeeeeeeeeeeeeeeeeee", status: "approved", isVisible: false, expiresAt: "2099-01-01" },
    { _id: "ffffffffffffffffffffffff", status: "approved", isArchived: true, expiresAt: "2099-01-01" },
    { _id: "111111111111111111111111", status: "approved", isAvailable: false, expiresAt: "2099-01-01" },
    { _id: "invalid-id", status: "approved", expiresAt: "2099-01-01" }
  );
  const plan = createPublicPrerenderPlan({
    siteBase: "https://souqak-yem.com/",
    categories: [
      cars,
      { slug: "missing-data", name: "Missing data" },
      empty
    ],
    categorySsgDataBySlug,
    ads
  });
  const expectedUrls = [
    ...plan.staticPages.map((page) => page.url),
    ...plan.categoryPages.map((page) => page.url),
    ...plan.subcategoryPages.map((page) => page.url),
    ...plan.adPages.map((page) => page.url)
  ];

  assert.equal(plan.categoryPages.length, 2);
  assert.equal(plan.subcategoryPages.length, 1);
  assert.equal(plan.subcategoryPages[0].path, "/category/cars/sedans");
  assert.equal(plan.subcategoryPages[0].ssgData.ads.length, 1);
  assert.equal(plan.categoryPages[0].ssgData, categorySsgDataBySlug.get("cars"));
  assert.equal(plan.adPages.length, 10);
  assert.equal(PRERENDER_AD_PAGE_LIMIT, 10);
  assert.deepEqual(plan.sitemapUrls, [...new Set(expectedUrls)]);
  assert.ok(plan.adPages.every(({ ad, path: pagePath, url }) => (
    url.endsWith(`/ad/${ad._id}/${ad.title.toLowerCase().replaceAll(" ", "-")}`) &&
    pagePath.startsWith(`/ad/${ad._id}/`)
  )));
  assert.ok(!plan.sitemapUrls.some((url) => /aaaaaaaa|bbbbbbbb|cccccccc|dddddddd|eeeeeeee|ffffffff|11111111|invalid-id/.test(url)));
  assert.ok(plan.sitemapUrls.every((url) => new URL(url).protocol === "https:"));
  assert.equal(new Set(plan.sitemapUrls).size, plan.sitemapUrls.length);
  assert.ok(!plan.sitemapUrls.some((url) => NON_INDEXABLE_STATIC_PATHS.some((routePath) => (
    new URL(url).pathname === routePath
  ))));
  const higherThresholdPlan = createPublicPrerenderPlan({
    siteBase: "https://souqak-yem.com",
    categories: [cars],
    categorySsgDataBySlug: new Map([["cars", categorySsgDataBySlug.get("cars")]]),
    ads,
    minimumPublicAdsForSubcategory: 2
  });
  assert.ok(!higherThresholdPlan.sitemapUrls.includes(
    "https://souqak-yem.com/category/cars/sedans"
  ));

  const prerenderSource = fs.readFileSync(
    path.join(projectRoot, "scripts", "prerender.mjs"),
    "utf8"
  );
  assert.match(prerenderSource, /publicPlan\.adPages\.forEach/);
  assert.match(prerenderSource, /publicPlan\.subcategoryPages/);
  assert.match(prerenderSource, /writeHtml\(page\.path, renderAdPage\(ad, ssgData, page\.url\)\)/);
  assert.match(prerenderSource, /const sitemapUrls = publicPlan\.sitemapUrls/);
  assert.match(prerenderSource, /createAdStructuredData/);
  assert.match(prerenderSource, /runAtomicPrerender/);
});

test("shared ad indexability rejects every non-public state used by the model", () => {
  const publicAd = {
    _id: "0123456789abcdef01234567",
    status: "approved",
    isVisible: true,
    isDeleted: false,
    isArchived: false,
    sold: false,
    isAvailable: true,
    expiresAt: "2099-01-01T00:00:00.000Z"
  };
  assert.equal(isPublicAdIndexable(publicAd), true);
  for (const patch of [
    { _id: undefined },
    { status: "pending" },
    { status: "sold" },
    { isDeleted: true },
    { isVisible: false },
    { isArchived: true },
    { sold: true },
    { sold: false, isSold: true },
    { isAvailable: false },
    { expiresAt: "2000-01-01T00:00:00.000Z" },
    { expiresAt: "invalid" }
  ]) {
    assert.equal(isPublicAdIndexable({ ...publicAd, ...patch }), false, JSON.stringify(patch));
  }
});

test("ad structured data omits synthetic offers and non-product schema", () => {
  const ad = {
    _id: "0123456789abcdef01234567",
    title: "Local listing",
    description: "Description",
    status: "approved",
    adType: "sell",
    price: 0,
    currency: "YER_ADEN",
    isAvailable: true,
    expiresAt: "2099-01-01T00:00:00.000Z",
    categoryId: { _id: "aaaaaaaaaaaaaaaaaaaaaaaa", slug: "cars", name: "سيارات" }
  };
  const url = "/ad/0123456789abcdef01234567/local-listing";
  const noPriceOffer = createAdStructuredData({ ad, url, siteBaseUrl: "https://preview.example.test" });
  assert.equal(noPriceOffer["@type"], "Product");
  assert.equal("offers" in noPriceOffer, false);

  const safeDescriptionData = createAdStructuredData({
    ad: { ...ad, description: "سيارة بحالة ممتازة، البريد owner@example.com والهاتف 967771234567" },
    url,
    siteBaseUrl: "https://preview.example.test"
  });
  assert.match(safeDescriptionData.description, /سيارة بحالة ممتازة/);
  assert.doesNotMatch(safeDescriptionData.description, /owner@example\.com|967771234567/);

  const offer = createAdStructuredData({
    ad: { ...ad, price: 100, currency: "YER_ADEN" },
    url,
    siteBaseUrl: "https://preview.example.test"
  });
  assert.equal(offer.offers.price, 100);
  assert.equal(offer.offers.priceCurrency, "YER");
  assert.equal(offer.offers.url.startsWith("https://preview.example.test/"), true);

  const unavailable = createAdStructuredData({
    ad: { ...ad, price: 100, sold: true },
    url
  });
  assert.equal("offers" in unavailable, false);

  const orderAd = createAdStructuredData({ ad: { ...ad, adType: "order" }, url });
  assert.equal(orderAd["@type"], "WebPage");

  const breadcrumbs = createBreadcrumbList([
    { name: "الرئيسية", url: "/" },
    { name: "الفئة", url: "/category/cars" }
  ], "https://preview.example.test/catalog/");
  assert.deepEqual(
    breadcrumbs.itemListElement.map(({ item }) => item),
    [
      "https://preview.example.test/catalog/",
      "https://preview.example.test/catalog/category/cars"
    ]
  );
});

test("public ad SSG markup sanitizes description without changing other ad content", () => {
  const original = "سيارة بحالة ممتازة، للتواصل 967771234567 أو owner@example.com";
  const markup = renderToStaticMarkup(React.createElement(PublicSsgContent, {
    kind: "ad",
    data: {
      ad: {
        _id: "0123456789abcdef01234567",
        slug: "local-listing",
        title: "سيارة سيدان",
        description: original,
        images: [],
        price: 125000,
        currency: "YER",
        adType: "sell"
      }
    },
    siteBaseUrl: "https://preview.example.test"
  }));

  assert.match(markup, /سيارة بحالة ممتازة/);
  assert.match(markup, /سيارة سيدان/);
  assert.match(markup, /١٢٥٬٠٠٠ YER/);
  assert.doesNotMatch(markup, /967771234567|owner@example\.com/);
});

test("failed prerender generation leaves the existing dist output intact", async () => {
  const temporaryParent = await fs.promises.mkdtemp(path.join(os.tmpdir(), "souqak-prerender-test-"));
  const distDirectory = path.join(temporaryParent, "dist");
  await fs.promises.mkdir(distDirectory);
  await fs.promises.writeFile(path.join(distDirectory, "index.html"), "existing build");
  await fs.promises.writeFile(path.join(distDirectory, "sitemap.xml"), "<existing sitemap />");

  try {
    await assert.rejects(
      runAtomicPrerender({
        distDirectory,
        generate: async (stagingDirectory) => {
          await fs.promises.writeFile(path.join(stagingDirectory, "index.html"), "partial build");
          await fs.promises.writeFile(path.join(stagingDirectory, "sitemap.xml"), "<partial />");
          throw new Error("data source failed");
        }
      }),
      /data source failed/
    );
    assert.equal(
      await fs.promises.readFile(path.join(distDirectory, "index.html"), "utf8"),
      "existing build"
    );
    assert.equal(
      await fs.promises.readFile(path.join(distDirectory, "sitemap.xml"), "utf8"),
      "<existing sitemap />"
    );
    assert.deepEqual(await fs.promises.readdir(temporaryParent), ["dist"]);

    await assert.rejects(
      runAtomicPrerender({
        distDirectory,
        generate: async (stagingDirectory) => {
          await fs.promises.writeFile(path.join(stagingDirectory, "index.html"), "new shell without sitemap");
        }
      }),
      /missing complete prerender, renderer template, sitemap, or robots files/
    );
    assert.equal(
      await fs.promises.readFile(path.join(distDirectory, "index.html"), "utf8"),
      "existing build"
    );
    assert.equal(
      await fs.promises.readFile(path.join(distDirectory, "sitemap.xml"), "utf8"),
      "<existing sitemap />"
    );
    assert.deepEqual(await fs.promises.readdir(temporaryParent), ["dist"]);
  } finally {
    await fs.promises.rm(temporaryParent, { recursive: true, force: true });
  }
});

test("successful output generation replaces dist only after every SEO page is complete", async () => {
  const temporaryParent = await fs.promises.mkdtemp(path.join(os.tmpdir(), "souqak-prerender-success-"));
  const distDirectory = path.join(temporaryParent, "dist");
  await fs.promises.mkdir(distDirectory);
  await fs.promises.writeFile(path.join(distDirectory, "index.html"), "old build");

  try {
    await runAtomicPrerender({
      distDirectory,
      generate: async (stagingDirectory) => {
        await writeCompletePrerenderOutput(
          stagingDirectory,
          '<main class="ssg-public-content"><h1>محتوى تجريبي</h1><p>محتوى عام مفيد لاختبار التحقق من مخرجات صفحات سوقك العامة قبل تفعيل الفهرسة في HTML الأولي.</p></main>'
        );
      }
    });
    assert.match(
      await fs.promises.readFile(path.join(distDirectory, "index.html"), "utf8"),
      /canonical" href="https:\/\/souqak-yem\.com\/"/
    );
    assert.match(
      await fs.promises.readFile(path.join(distDirectory, "sitemap.xml"), "utf8"),
      /<urlset>/
    );
    assert.match(
      await fs.promises.readFile(path.join(distDirectory, "robots.txt"), "utf8"),
      /Sitemap: https:\/\/souqak-yem\.com\/sitemap\.xml/
    );
    assert.ok(fs.existsSync(path.join(distDirectory, "prerender-manifest.json")));
    assert.deepEqual(await fs.promises.readdir(temporaryParent), ["dist"]);
  } finally {
    await fs.promises.rm(temporaryParent, { recursive: true, force: true });
  }
});

test("SEO validation rejects missing robots directives and missing sitemap page files", async () => {
  const temporaryParent = await fs.promises.mkdtemp(path.join(os.tmpdir(), "souqak-prerender-incomplete-"));
  const distDirectory = path.join(temporaryParent, "dist");

  try {
    await assert.rejects(runAtomicPrerender({
      distDirectory,
      generate: async (stagingDirectory) => {
        await writeCompletePrerenderOutput(stagingDirectory, "<html><body>page</body></html>");
        await fs.promises.rm(path.join(stagingDirectory, "robots.txt"));
      }
    }), /missing complete prerender, renderer template, sitemap, or robots files/);
    assert.deepEqual(await fs.promises.readdir(temporaryParent), []);

    await assert.rejects(runAtomicPrerender({
      distDirectory,
      generate: async (stagingDirectory) => {
        await writeCompletePrerenderOutput(stagingDirectory, "<html><body>page</body></html>");
        await fs.promises.rm(path.join(stagingDirectory, "categories", "index.html"));
      }
    }), /route listed in the prerender manifest is missing/);
    assert.deepEqual(await fs.promises.readdir(temporaryParent), []);
  } finally {
    await fs.promises.rm(temporaryParent, { recursive: true, force: true });
  }
});

test("local SEO snapshot validates its schema and complete public page data", () => {
      const snapshot = createSnapshot();
      assert.equal(
        validatePrerenderSnapshot(snapshot, {
          now: snapshotNow,
          expectedSiteBaseUrl: "https://souqak-yem.com"
        }),
        snapshot
      );
    });

    test("snapshot validation rejects missing data, unknown schema, and incomplete ads", () => {
      const invalidSnapshots = [
        [{ ...createSnapshot(), ads: undefined }, /ads must be an array/],
        [{ ...createSnapshot(), metadata: { ...createSnapshot().metadata, schemaVersion: 99 } }, /unsupported schemaVersion/],
        [{ ...createSnapshot(), ads: [{ ...createSnapshot().ads[0], _id: undefined }] }, /valid 24-character ObjectId/],
        [{ ...createSnapshot(), ads: [{ ...createSnapshot().ads[0], slug: "" }] }, /ads\[0\]\.slug/],
        [{ ...createSnapshot(), ads: [{ ...createSnapshot().ads[0], status: "unrecognized" }] }, /not eligible for public indexing/]
      ];
      for (const [snapshot, error] of invalidSnapshots) {
        assert.throws(() => validatePrerenderSnapshot(snapshot, { now: snapshotNow }), error);
      }
    });

    test("snapshot validation excludes deleted, hidden, archived, sold, and expired ads", () => {
      const base = createSnapshot();
      const invalidAdPatches = [
        { isDeleted: true },
        { isVisible: false },
        { isArchived: true },
        { sold: true },
        { isSold: true },
        { expiresAt: "2020-01-01T00:00:00.000Z" }
      ];
      for (const patch of invalidAdPatches) {
        const snapshot = createSnapshot();
        snapshot.ads[0] = { ...snapshot.ads[0], ...patch };
        assert.throws(
          () => validatePrerenderSnapshot(snapshot, { now: snapshotNow }),
          /not eligible for public indexing/
        );
      }
      assert.equal(isPublicAdIndexable(base.ads[0], snapshotNow), true);
    });

    test("snapshot validation rejects sensitive data and applies only an explicitly configured age limit", () => {
      const sensitiveSnapshot = createSnapshot();
      sensitiveSnapshot.ads[0].userId = "private-account-reference";
      assert.throws(
        () => validatePrerenderSnapshot(sensitiveSnapshot, { now: snapshotNow }),
        /sensitive field/
      );
      const privateImageSnapshot = createSnapshot();
      privateImageSnapshot.ads[0].images = ["/uploads/private/passport.jpg"];
      assert.throws(
        () => validatePrerenderSnapshot(privateImageSnapshot, { now: snapshotNow }),
        /private document path/
      );

      const oldSnapshot = createSnapshot();
      assert.doesNotThrow(() => validatePrerenderSnapshot(oldSnapshot, { now: snapshotNow }));
      assert.throws(
        () => validatePrerenderSnapshot(oldSnapshot, { now: snapshotNow, maxAgeMs: 60_000 }),
        /exportedAt=.*currentDate=.*maximumAge=60000 ms/
      );
    });

    test("local snapshot mode never falls back to API and validation failure prevents generation", async () => {
      let apiLoaderCalled = false;
      let generatorCalled = false;
      const failedSnapshotRead = async () => {
        throw new Error("local snapshot validation failed");
      };

      await assert.rejects(
        getPrerenderData({
          env: { SEO_PRERENDER_DATA_SOURCE: "local" },
          loadApiData: async () => {
            apiLoaderCalled = true;
            return {};
          },
          readSnapshot: failedSnapshotRead
        }),
        /local snapshot validation failed/
      );
      assert.equal(apiLoaderCalled, false);

      await assert.rejects(
        generateFromPrerenderData({
          dataOptions: {
            env: { SEO_PRERENDER_DATA_SOURCE: "local" },
            readSnapshot: failedSnapshotRead
          },
          generate: async () => {
            generatorCalled = true;
          }
        }),
        /local snapshot validation failed/
      );
      assert.equal(generatorCalled, false);
    });

    test("local snapshot mode returns validated page data without invoking the API loader", async () => {
      let apiLoaderCalled = false;
      const snapshot = createSnapshot();
      const prerenderData = await getPrerenderData({
        env: { SEO_PRERENDER_DATA_SOURCE: "local" },
        loadApiData: async () => {
          apiLoaderCalled = true;
          return {};
        },
        readSnapshot: async (snapshotPath, options) => {
          assert.ok(snapshotPath.endsWith("seo-prerender-snapshot.json"));
          assert.equal(options.expectedSiteBaseUrl, "https://souqak-yem.com");
          return validatePrerenderSnapshot(snapshot, { ...options, now: snapshotNow });
        }
      });

      assert.equal(apiLoaderCalled, false);
      assert.equal(prerenderData.source, "local");
      assert.equal(prerenderData.categories.length, 1);
      assert.equal(prerenderData.ads.length, 1);
      assert.equal(prerenderData.homeData.ads.length, 1);
      assert.ok(prerenderData.categorySsgDataBySlug instanceof Map);
      assert.equal(prerenderData.categorySsgDataBySlug.has("cars"), true);
    });

    test("snapshot loader fails clearly when the configured local file is absent or invalid", async () => {
      const temporaryDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "souqak-snapshot-loader-"));
      const missingPath = path.join(temporaryDirectory, "missing.json");
      const invalidPath = path.join(temporaryDirectory, "invalid.json");

      try {
        await assert.rejects(loadPrerenderSnapshot(missingPath), /snapshot does not exist/);
        await fs.promises.writeFile(invalidPath, "{not-json", "utf8");
        await assert.rejects(loadPrerenderSnapshot(invalidPath), /not valid JSON/);
      } finally {
        await fs.promises.rm(temporaryDirectory, { recursive: true, force: true });
      }
    });

    test("snapshot validation failure preserves existing dist and publishes no sitemap", async () => {
      const temporaryParent = await fs.promises.mkdtemp(path.join(os.tmpdir(), "souqak-snapshot-failure-"));
      const distDirectory = path.join(temporaryParent, "dist");
      await fs.promises.mkdir(distDirectory);
      await fs.promises.writeFile(path.join(distDirectory, "index.html"), "existing build");
      await fs.promises.writeFile(path.join(distDirectory, "sitemap.xml"), "<existing sitemap />");

      try {
        await assert.rejects(
          runAtomicPrerender({
            distDirectory,
            generate: async () => generateFromPrerenderData({
              dataOptions: {
                env: { SEO_PRERENDER_DATA_SOURCE: "local" },
                readSnapshot: async () => {
                  throw new Error("snapshot rejected");
                }
              },
              generate: async (stagingDirectory) => {
                await fs.promises.writeFile(path.join(stagingDirectory, "sitemap.xml"), "<partial />");
              }
            })
          }),
          /snapshot rejected/
        );
        assert.equal(
          await fs.promises.readFile(path.join(distDirectory, "index.html"), "utf8"),
          "existing build"
        );
        assert.equal(
          await fs.promises.readFile(path.join(distDirectory, "sitemap.xml"), "utf8"),
          "<existing sitemap />"
        );
        assert.deepEqual(await fs.promises.readdir(temporaryParent), ["dist"]);
      } finally {
        await fs.promises.rm(temporaryParent, { recursive: true, force: true });
      }
    });
