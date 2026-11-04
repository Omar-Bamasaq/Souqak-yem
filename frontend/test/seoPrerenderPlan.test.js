import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  createPublicPrerenderPlan,
  INDEXABLE_STATIC_ROUTES,
  NON_INDEXABLE_STATIC_PATHS,
  PRERENDER_AD_PAGE_LIMIT,
  resolveSiteBaseUrl
} from "../scripts/prerenderRoutes.mjs";
import { resolveCanonicalUrl, resolveSiteUrl } from "../src/lib/siteUrl.js";
import { isPublicAdIndexable } from "../src/lib/publicAdIndexing.js";
import { createAdStructuredData, createBreadcrumbList } from "../src/lib/structuredData.js";
import { runAtomicPrerender } from "../scripts/prerenderBuild.mjs";
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

function createSnapshot() {
  const category = {
    _id: snapshotCategoryId,
    slug: "cars",
    name: "Cars",
    description: "Public vehicle listings",
    image: null,
    children: []
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
        subcategories: [],
        ads: []
      }
    }
  };
}

test("platform reviews has a route-specific canonical URL", () => {
  const pageSources = new Map([
    ["PlatformReviews.jsx", /canonicalUrl=["']\/platform-reviews["']/],
    ["Home.jsx", /canonicalUrl=["']\/["']/],
    ["CategoryPage.jsx", /canonicalUrl=\{canonicalPath\}/],
    ["ProductDetail.jsx", /canonicalUrl=\{canonicalAdUrl\}/],
    ["Storefront.jsx", /canonicalUrl=\{`\/store\/\$\{store\.slug\}`\}/]
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
  assert.equal(resolveCanonicalUrl("/platform-reviews"), "https://souqak-yem.com/platform-reviews");
  assert.equal(
    resolveCanonicalUrl("/platform-reviews", "https://preview.example.test/site/"),
    "https://preview.example.test/site/platform-reviews"
  );
});

test("only explicitly selected public routes are eligible for the sitemap", () => {
  const routes = new Set(INDEXABLE_STATIC_ROUTES.map(({ path: routePath }) => routePath));
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
  assert.match(prerenderRoutesSource, /import \{ isPublicAdIndexable \}/);
  assert.match(productPageSource, /indexable=\{isPublicAdIndexable\(p\)\}/);

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
    "https://preview.example.test/site/category/cars"
  );
  assert.equal(
    resolveSiteUrl("https://preview.example.test/site/category/cars", "https://preview.example.test/site/"),
    "https://preview.example.test/site/category/cars"
  );
});

test("sitemap URLs match category and ad pages with prerender data", () => {
  const categorySsgDataBySlug = new Map([
    ["cars", { category: { name: "Cars" }, ads: [] }]
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
      { slug: "cars", name: "Cars" },
      { slug: "missing-data", name: "Missing data" }
    ],
    categorySsgDataBySlug,
    ads
  });
  const expectedUrls = [
    ...plan.staticPages.map((page) => page.url),
    ...plan.categoryPages.map((page) => page.url),
    ...plan.adPages.map((page) => page.url)
  ];

  assert.equal(plan.categoryPages.length, 1);
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

  const prerenderSource = fs.readFileSync(
    path.join(projectRoot, "scripts", "prerender.mjs"),
    "utf8"
  );
  assert.match(prerenderSource, /publicPlan\.adPages\.forEach/);
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
    expiresAt: "2099-01-01T00:00:00.000Z"
  };
  const url = "/ad/0123456789abcdef01234567/local-listing";
  const noPriceOffer = createAdStructuredData({ ad, url, siteBaseUrl: "https://preview.example.test" });
  assert.equal(noPriceOffer["@type"], "Product");
  assert.equal("offers" in noPriceOffer, false);

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
  assert.equal(orderAd, null);

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
      /missing a complete index\.html or sitemap\.xml/
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

test("successful output generation replaces dist only after sitemap is complete", async () => {
  const temporaryParent = await fs.promises.mkdtemp(path.join(os.tmpdir(), "souqak-prerender-success-"));
  const distDirectory = path.join(temporaryParent, "dist");
  await fs.promises.mkdir(distDirectory);
  await fs.promises.writeFile(path.join(distDirectory, "index.html"), "old build");

  try {
    await runAtomicPrerender({
      distDirectory,
      generate: async (stagingDirectory) => {
        await fs.promises.writeFile(path.join(stagingDirectory, "index.html"), "complete build");
        await fs.promises.writeFile(path.join(stagingDirectory, "sitemap.xml"), "<complete />");
      }
    });
    assert.equal(
      await fs.promises.readFile(path.join(distDirectory, "index.html"), "utf8"),
      "complete build"
    );
    assert.equal(
      await fs.promises.readFile(path.join(distDirectory, "sitemap.xml"), "utf8"),
      "<complete />"
    );
    assert.deepEqual(await fs.promises.readdir(temporaryParent), ["dist"]);
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
