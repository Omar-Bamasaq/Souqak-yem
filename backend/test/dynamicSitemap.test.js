import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import express from "express";
import Category from "../src/models/Category.js";
import StoreProfile from "../src/models/StoreProfile.js";
import StoreSubscription from "../src/models/StoreSubscription.js";
import User from "../src/models/User.js";
import { BoundedSeoWorkLimiter } from "../src/services/seoCache.js";
import {
  buildPublicAdSitemapPipeline,
  buildPublicAuctionSitemapPipeline,
  buildPublicStoreSitemapPipeline,
  createDynamicSitemapService,
  createMongoSitemapRecordSources,
  resolveSitemapCacheTtlMs
} from "../src/services/dynamicSitemap.js";

const ROOT_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const CHILD_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const AD_ONE_ID = "0123456789abcdef01234567";
const AD_TWO_ID = "fedcba9876543210fedcba98";
const AUCTION_ID = "1234567890abcdef12345678";
const now = new Date("2026-12-01T10:00:00.000Z");

test("sitemap cache TTL configuration has a short bounded default and validates overrides", () => {
  assert.equal(resolveSitemapCacheTtlMs(undefined), 60_000);
  assert.equal(resolveSitemapCacheTtlMs("15000"), 15_000);
  assert.throws(() => resolveSitemapCacheTtlMs("0"), /integer from 1 to 300000/);
  assert.throws(() => resolveSitemapCacheTtlMs("300001"), /integer from 1 to 300000/);
});

function asyncCursor(rows) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const row of rows) yield row;
    }
  };
}

function makeAggregateModel(resolveRows, calls = []) {
  return {
    aggregate(pipeline) {
      calls.push(pipeline);
      return {
        allowDiskUse() {
          return this;
        },
        option(options) {
          assert.equal(options.timeoutMS, 90_000);
          return this;
        },
        cursor() {
          return asyncCursor(resolveRows(pipeline));
        }
      };
    }
  };
}

function makeCategoryModel(categories) {
  return {
    find(filter) {
      assert.deepEqual(filter, { status: "active" });
      return {
        select() { return this; },
        sort() { return this; },
        lean() { return this; },
        setOptions(options) {
          assert.equal(options.timeoutMS, 90_000);
          return this;
        },
        cursor() { return asyncCursor(categories); }
      };
    }
  };
}

function makeAd(id, overrides = {}) {
  return {
    _id: id,
    slug: "same-slug",
    title: "Same slug item",
    status: "approved",
    expiresAt: new Date(now.getTime() + 60_000),
    scheduledPublishAt: null,
    inventoryEnabled: false,
    stockQuantity: 0,
    isDeleted: false,
    isVisible: true,
    isArchived: false,
    sold: false,
    isSold: false,
    isAvailable: true,
    categoryId: CHILD_ID,
    ...overrides
  };
}

function makeAuction(overrides = {}) {
  return {
    _id: AUCTION_ID,
    reviewStatus: "approved",
    approvedAt: new Date(now.getTime() - 60_000),
    approvedBy: "admin-id",
    status: "live",
    isDeleted: false,
    isHidden: false,
    isVisible: true,
    publiclyAccessible: true,
    startAt: new Date(now.getTime() - 60_000),
    endAt: new Date(now.getTime() + 60_000),
    durationDays: 4,
    ownerId: {
      _id: "222222222222222222222222",
      verificationStatus: "verified",
      verificationExpiryDate: new Date(now.getTime() + 86_400_000),
      isDisabled: false,
      isDeleted: false
    },
    categoryId: {
      _id: "333333333333333333333333",
      slug: "mobiles",
      status: "active"
    },
    categoryDetails: {
      manufacturer: "Synthetic",
      model: "Phone",
      storage: "128 GB",
      deviceCondition: "Good"
    },
    imageLabels: ["actual_item"],
    categoryDocuments: [],
    ...overrides
  };
}

async function collect(source, options = {}) {
  const rows = [];
  for await (const row of source(options)) rows.push(row);
  return rows;
}

function makeRecordSources(overrides = {}) {
  return {
    async *pages() {
      yield { path: "/" };
      yield { path: "/privacy" };
    },
    async *categories() {},
    async *ads() {},
    async *stores() {},
    async *auctions() {},
    ...overrides
  };
}

async function startServer(t, service) {
  const app = express();
  app.use(service.middleware);
  app.use((_req, res) => res.status(404).send("fallback"));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await service.close();
  });
  const address = server.address();
  return (requestPath, { method = "GET", headers = {} } = {}) => new Promise((resolve, reject) => {
    const request = http.request({
      hostname: "127.0.0.1",
      port: address.port,
      path: requestPath,
      method,
      headers
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
}

test("sitemap uses an index, fixed canonical origin, ETag and HEAD without false lastmod", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "souqak-sitemap-http-"));
  t.after(() => fs.rm(tempRoot, { recursive: true, force: true }));
  const service = createDynamicSitemapService({
    recordSources: makeRecordSources({
      async *categories() {
        yield { path: "/category/%D8%B3%D9%8A%D8%A7%D8%B1%D8%A7%D8%AA" };
      },
      async *ads() {
        yield { path: `/ad/${AD_ONE_ID}/same-slug`, expiresAt: new Date(now.getTime() + 60_000) };
      }
    }),
    tempRoot,
    nowProvider: () => now,
    logger: { info() {}, warn() {}, error() {} }
  });
  const request = await startServer(t, service);
  const index = await request("/sitemap.xml", {
    headers: { host: "attacker.example" }
  });

  assert.equal(index.status, 200);
  assert.match(index.headers["cache-control"], /max-age=0/);
  assert.match(index.headers["content-type"], /application\/xml/);
  assert.match(index.headers.etag, /^"[a-f0-9]{64}"$/);
  assert.match(index.body, /<sitemapindex/);
  assert.match(index.body, /https:\/\/souqak-yem\.com\/sitemap-pages-1\.xml/);
  assert.doesNotMatch(index.body, /attacker\.example|<lastmod>/);
  const categoryMap = await request("/sitemap-categories-1.xml");
  assert.equal(categoryMap.status, 200);
  assert.match(categoryMap.body, /https:\/\/souqak-yem\.com\/category\/%D8%B3%D9%8A%D8%A7%D8%B1%D8%A7%D8%AA/);
  assert.doesNotMatch(categoryMap.body, /<lastmod>|<changefreq>|<priority>/);

  const adMap = await request("/sitemap-ads-1.xml");
  assert.equal(adMap.status, 200);
  const head = await request("/sitemap-ads-1.xml", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(head.body, "");
  assert.equal(head.headers.etag, adMap.headers.etag);
  const unchanged = await request("/sitemap-ads-1.xml", {
    headers: { "if-none-match": adMap.headers.etag }
  });

  test("concurrent sitemap work is bounded and overloaded requests receive retryable 503", async (t) => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "souqak-sitemap-bounded-"));
    t.after(() => fs.rm(tempRoot, { recursive: true, force: true }));
    let finish;
    const service = createDynamicSitemapService({
      recordSources: makeRecordSources({
        async *pages() {
          await new Promise((resolve) => { finish = resolve; });
          yield { path: "/" };
        }
      }),
      tempRoot,
      workLimiter: new BoundedSeoWorkLimiter(1),
      logger: { info() {}, warn() {}, error() {} }
    });
    const request = await startServer(t, service);
    const first = request("/sitemap.xml");
    while (!finish) await new Promise((resolve) => setImmediate(resolve));
    const overloaded = await request("/sitemap.xml");
    assert.equal(overloaded.status, 503);
    assert.equal(overloaded.headers["retry-after"], "30");
    assert.equal(overloaded.headers["cache-control"], "no-store");
    finish();
    assert.equal((await first).status, 200);
  });
  assert.equal(unchanged.status, 304);
  assert.equal(unchanged.body, "");
  assert.equal(unchanged.headers["last-modified"], undefined);
});

test("large synthetic datasets are split into complete sitemap shards without a URL cap", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "souqak-sitemap-shards-"));
  t.after(() => fs.rm(tempRoot, { recursive: true, force: true }));
  const service = createDynamicSitemapService({
    recordSources: makeRecordSources({
      async *ads() {
        for (let index = 0; index < 1_001; index += 1) {
          const id = index.toString(16).padStart(24, "0");
          yield { path: `/ad/${id}/same-slug` };
        }
      }
    }),
    tempRoot,
    maxUrlsPerFile: 400,
    nowProvider: () => now,
    logger: { info() {}, warn() {}, error() {} }
  });
  const request = await startServer(t, service);
  const index = await request("/sitemap.xml");
  assert.equal(index.status, 200);
  const shardPaths = [...index.body.matchAll(/<loc>https:\/\/souqak-yem\.com(\/sitemap-ads-\d+\.xml)<\/loc>/g)]
    .map((match) => match[1]);
  assert.equal(shardPaths.length, 3);
  const shards = await Promise.all(shardPaths.map((shardPath) => request(shardPath)));
  assert.ok(shards.every((shard) => shard.status === 200));
  const adPaths = shards.flatMap(({ body }) => [...body.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]));
  assert.equal(adPaths.length, 1_001);
  assert.equal(new Set(adPaths).size, 1_001);
});

test("failed sitemap refresh returns 503 instead of the previous stale snapshot", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "souqak-sitemap-stale-"));
  t.after(() => fs.rm(tempRoot, { recursive: true, force: true }));
  let time = 10_000;
  let fail = false;
  const service = createDynamicSitemapService({
    recordSources: makeRecordSources({
      async *pages() {
        if (fail) throw new Error("synthetic source failure");
        yield { path: "/" };
      }
    }),
    tempRoot,
    cacheTtlMs: 100,
    clock: () => time,
    nowProvider: () => new Date(time),
    logger: { info() {}, warn() {}, error() {} }
  });
  const request = await startServer(t, service);
  const first = await request("/sitemap.xml");
  assert.equal(first.status, 200);
  time += 101;
  fail = true;
  const second = await request("/sitemap.xml");
  assert.equal(second.status, 503);
  assert.match(second.headers["cache-control"], /no-store/);
  assert.match(second.headers["retry-after"], /30/);
  assert.doesNotMatch(second.body, /<sitemapindex/);
});

test("external sitemap paths fail closed", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "souqak-sitemap-invalid-"));
  t.after(() => fs.rm(tempRoot, { recursive: true, force: true }));
  const service = createDynamicSitemapService({
    recordSources: makeRecordSources({
      async *pages() {
        yield { path: "//attacker.example/private" };
      }
    }),
    tempRoot,
    nowProvider: () => now,
    logger: { info() {}, warn() {}, error() {} }
  });
  const request = await startServer(t, service);
  const response = await request("/sitemap.xml");
  assert.equal(response.status, 503);
  assert.doesNotMatch(response.body, /attacker\.example/);
});

test("sitemap shard size overflow fails the whole snapshot", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "souqak-sitemap-size-"));
  t.after(() => fs.rm(tempRoot, { recursive: true, force: true }));
  const service = createDynamicSitemapService({
    recordSources: makeRecordSources(),
    tempRoot,
    maxFileBytes: 128,
    nowProvider: () => now,
    logger: { info() {}, warn() {}, error() {} }
  });
  const request = await startServer(t, service);
  const response = await request("/sitemap.xml");
  assert.equal(response.status, 503);
  assert.match(response.headers["cache-control"], /no-store/);
});

test("sitemap cache lifetime is capped at the nearest content expiry", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "souqak-sitemap-expiry-"));
  t.after(() => fs.rm(tempRoot, { recursive: true, force: true }));
  let time = now.getTime();
  let adSourceCalls = 0;
  const service = createDynamicSitemapService({
    recordSources: makeRecordSources({
      async *ads() {
        adSourceCalls += 1;
        yield {
          path: `/ad/${AD_ONE_ID}/same-slug`,
          expiresAt: new Date(time + 500)
        };
      }
    }),
    tempRoot,
    cacheTtlMs: 60_000,
    clock: () => time,
    nowProvider: () => new Date(time),
    logger: { info() {}, warn() {}, error() {} }
  });
  const request = await startServer(t, service);
  const first = await request("/sitemap.xml");
  assert.equal(first.status, 200);
  assert.match(first.headers["cache-control"], /max-age=0/);
  assert.equal(adSourceCalls, 1);
  time += 500;
  const second = await request("/sitemap.xml");
  assert.equal(second.status, 200);
  assert.equal(adSourceCalls, 2);
});

test("Mongo sitemap sources apply renderer visibility and avoid per-record owner/category lookups", async () => {
  const root = {
    _id: ROOT_ID,
    name: "Cars",
    slug: "cars",
    description: "Cars for everyday travel throughout Yemen",
    parentId: null,
    status: "active"
  };
  const child = {
    _id: CHILD_ID,
    name: "Sedans",
    slug: "sedans",
    description: "Sedans available for sale throughout Yemen",
    parentId: ROOT_ID,
    status: "active"
  };
  const adPipelines = [];
  const storePipelines = [];
  const auctionPipelines = [];
  const adModel = makeAggregateModel((pipeline) => (
    pipeline.some((stage) => stage.$group)
      ? [{ _id: CHILD_ID, count: 1 }]
      : [
        makeAd(AD_ONE_ID),
        makeAd(AD_TWO_ID),
        makeAd("aaaaaaaaaaaaaaaaaaaaaaab", { status: "pending" }),
        makeAd("aaaaaaaaaaaaaaaaaaaaaaac", { sold: true }),
        makeAd("aaaaaaaaaaaaaaaaaaaaaaad", { isVisible: false }),
        makeAd("aaaaaaaaaaaaaaaaaaaaaaae", { expiresAt: new Date(now.getTime() - 1) }),
        makeAd("aaaaaaaaaaaaaaaaaaaaaaaf", { scheduledPublishAt: new Date(now.getTime() + 1) }),
        makeAd("aaaaaaaaaaaaaaaaaaaaaaba", { inventoryEnabled: true, stockQuantity: 0 }),
        makeAd("invalid-object-id")
      ]
  ), adPipelines);
  const storeModel = makeAggregateModel(() => [
    { _id: "444444444444444444444444", slug: "public-store", storeType: "store", status: "active", subscriptionEndDate: new Date(now.getTime() + 60_000) },
    { _id: "555555555555555555555555", slug: "family-store", storeType: "family-production", status: "active", subscriptionEndDate: null },
    { _id: "666666666666666666666666", slug: "777777777777777777777777", storeType: "store", status: "active" },
    { _id: "888888888888888888888888", slug: "suspended-store", storeType: "store", status: "suspended" },
    { _id: "999999999999999999999999", slug: "expired-store", storeType: "store", status: "active", subscriptionEndDate: new Date(now.getTime() - 1) }
  ], storePipelines);
  const auctionModel = makeAggregateModel(() => [
    makeAuction(),
    makeAuction({
      _id: "aaaaaaaaaaaaaaaaaaaaaaac",
      endAt: new Date(now.getTime() - 1)
    })
  ], auctionPipelines);
  const sources = createMongoSitemapRecordSources({
    AdModel: adModel,
    AuctionModel: auctionModel,
    CategoryModel: makeCategoryModel([root, child]),
    StoreProfileModel: storeModel,
    minimumPublicAdsForSubcategory: 1
  });

  const categories = await collect(sources.categories, { now });
  const ads = await collect(sources.ads, { now });
  const stores = await collect(sources.stores, { now });
  const auctions = await collect(sources.auctions, { now });

  assert.deepEqual(categories.map(({ path }) => path), [
    "/category/cars",
    "/category/cars/sedans"
  ]);
  assert.deepEqual(ads.map(({ path }) => path), [
    `/ad/${AD_ONE_ID}/same-slug`,
    `/ad/${AD_TWO_ID}/same-slug`
  ]);
  assert.deepEqual(stores.map(({ path }) => path), [
    "/store/public-store",
    "/store/family-store"
  ]);
  assert.deepEqual(auctions.map(({ path }) => path), [
    `/auctions/${AUCTION_ID}`
  ]);
  assert.equal(adPipelines.length, 2);
  assert.equal(storePipelines.length, 1);
  assert.equal(auctionPipelines.length, 1);
  assert.ok(auctionPipelines[0].some((stage) => (
    stage.$lookup?.from === User.collection.name
  )));
  assert.ok(auctionPipelines[0].some((stage) => (
    stage.$lookup?.from === Category.collection.name
  )));
  assert.ok(buildPublicAdSitemapPipeline(now).some((stage) => (
    stage.$lookup?.from === StoreProfile.collection.name
  )));
  const adProjection = buildPublicAdSitemapPipeline(now)
    .find((stage) => stage.$project)?.$project;
  assert.equal(adProjection?.storeSubscriptionEndDate, "$_seoSubscription.endDate");
  assert.ok(buildPublicStoreSitemapPipeline(now).some((stage) => (
    stage.$lookup?.from === StoreSubscription.collection.name
  )));
  assert.ok(buildPublicAuctionSitemapPipeline(now)[0].$match.endAt.$gt instanceof Date);
  const strictSources = createMongoSitemapRecordSources({
    AdModel: adModel,
    CategoryModel: makeCategoryModel([root, child]),
    minimumPublicAdsForSubcategory: 2
  });
  const strictCategories = await collect(strictSources.categories, { now });
  assert.deepEqual(strictCategories.map(({ path }) => path), ["/category/cars"]);
});

test("ad sitemap validity ends at the earlier of ad and store subscription expiry", async () => {
  const subscriptionEndDate = new Date(now.getTime() + 30_000);
  const adModel = makeAggregateModel(() => [
    makeAd(AD_ONE_ID, {
      expiresAt: new Date(now.getTime() + 60_000),
      storeSubscriptionEndDate: subscriptionEndDate
    })
  ]);
  const sources = createMongoSitemapRecordSources({ AdModel: adModel });
  const [record] = await collect(sources.ads, { now });
  assert.equal(record.expiresAt.getTime(), subscriptionEndDate.getTime());
});

test("sitemap XML escapes metacharacters and cannot inject extra URL records", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "souqak-sitemap-xml-"));
  t.after(() => fs.rm(tempRoot, { recursive: true, force: true }));
  const service = createDynamicSitemapService({
    recordSources: makeRecordSources({
      async *pages() {
        yield { path: "/category/a&b</loc><url><loc>https://attacker.example" };
      }
    }),
    tempRoot,
    nowProvider: () => now,
    logger: { info() {}, warn() {}, error() {} }
  });
  const request = await startServer(t, service);
  const response = await request("/sitemap-pages-1.xml");

  assert.equal(response.status, 200);
  assert.match(response.body, /a&amp;b/);
  assert.match(response.body, /%3C\/loc%3E%3Curl%3E%3Cloc%3Ehttps:\/\/attacker\.example/);
  assert.doesNotMatch(response.body, /<\/loc>\s*<url>/);
  assert.doesNotMatch(response.body, /<loc>https:\/\/attacker\.example/);
  assert.equal([...response.body.matchAll(/<url>/g)].length, 1);
});

test("simultaneous sitemap requests share one in-flight generation", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "souqak-sitemap-concurrent-"));
  t.after(() => fs.rm(tempRoot, { recursive: true, force: true }));
  let pageSourceCalls = 0;
  const service = createDynamicSitemapService({
    recordSources: makeRecordSources({
      async *pages() {
        pageSourceCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        yield { path: "/" };
      }
    }),
    tempRoot,
    nowProvider: () => now,
    logger: { info() {}, warn() {}, error() {} }
  });
  const request = await startServer(t, service);
  const [first, second] = await Promise.all([
    request("/sitemap.xml"),
    request("/sitemap.xml")
  ]);

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(pageSourceCalls, 1);
});

test("total sitemap cache byte limit fails closed", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "souqak-sitemap-cache-size-"));
  t.after(() => fs.rm(tempRoot, { recursive: true, force: true }));
  const service = createDynamicSitemapService({
    recordSources: makeRecordSources({
      async *pages() {
        yield { path: "/" };
      }
    }),
    tempRoot,
    maxCacheBytes: 128,
    nowProvider: () => now,
    logger: { info() {}, warn() {}, error() {} }
  });
  const request = await startServer(t, service);
  const response = await request("/sitemap.xml");

  assert.equal(response.status, 503);
  assert.match(response.headers["cache-control"], /no-store/);
  assert.doesNotMatch(response.body, /<sitemapindex/);
});

test("sitemap generation time limit fails closed", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "souqak-sitemap-time-limit-"));
  t.after(() => fs.rm(tempRoot, { recursive: true, force: true }));
  let time = 10_000;
  const service = createDynamicSitemapService({
    recordSources: makeRecordSources({
      async *pages() {
        time += 11;
        yield { path: "/" };
      }
    }),
    tempRoot,
    maxBuildDurationMs: 10,
    clock: () => time,
    nowProvider: () => new Date(now),
    logger: { info() {}, warn() {}, error() {} }
  });
  const request = await startServer(t, service);
  const response = await request("/sitemap.xml");

  assert.equal(response.status, 503);
  assert.match(response.headers["cache-control"], /no-store/);
  assert.doesNotMatch(response.body, /<sitemapindex/);
});
