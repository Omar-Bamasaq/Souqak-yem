import test from "node:test";
import assert from "node:assert/strict";
import {
  BoundedSeoWorkLimiter,
  BoundedLruCache,
  SeoCacheInvalidatedError,
  SeoWorkLimitError,
  applySeoQueryTimeout,
  resolveSeoCacheOptions
} from "../src/services/seoCache.js";

test("SEO cache validates bounded environment options", () => {
  assert.equal(resolveSeoCacheOptions({
    SEO_RENDER_CACHE_ENABLED: "true",
    SEO_RENDER_CACHE_AD_TTL_MS: "60000",
    SEO_RENDER_CACHE_MAX_ENTRIES: "10",
    SEO_RENDER_CACHE_MAX_BYTES: "100000",
    SEO_RENDER_CACHE_MAX_ITEM_BYTES: "10000",
    SEO_RENDER_CACHE_MAX_IN_FLIGHT: "5"
  }).enabled, true);
  assert.throws(() => resolveSeoCacheOptions({
    SEO_RENDER_CACHE_ENABLED: "maybe"
  }), /boolean/);
  assert.throws(() => resolveSeoCacheOptions({
    SEO_RENDER_CACHE_MAX_ENTRIES: "0"
  }), /positive integer/);
});

test("LRU cache expires entries and uses item and total byte limits", () => {
  const cache = new BoundedLruCache({
    enabled: true,
    adTtlMs: 100,
    categoryTtlMs: 100,
    storeTtlMs: 100,
    auctionTtlMs: 100,
    maxEntries: 2,
    maxBytes: 50,
    maxItemBytes: 30,
    maxInFlight: 2
  });
  assert.equal(cache.set("a", "12345", 10, 100), true);
  assert.equal(cache.set("b", "67890", 10, 100), true);
  assert.equal(cache.set("large", "x".repeat(31), 10, 100), false);
  assert.equal(cache.set("c", "abc", 10, 100), true);
  assert.equal(cache.get("a", 100), null);
  assert.equal(cache.get("c", 100), "abc");
  assert.equal(cache.get("b", 111), null);
  assert.equal(cache.getMetrics().expirations >= 1, true);
});

test("single-flight shares generation and invalidation prevents stale reinsertion", async () => {
  const cache = new BoundedLruCache({
    enabled: true,
    adTtlMs: 1000,
    categoryTtlMs: 1000,
    storeTtlMs: 1000,
    auctionTtlMs: 1000,
    maxEntries: 20,
    maxBytes: 10_000,
    maxItemBytes: 5_000,
    maxInFlight: 20
  });
  let releases;
  let calls = 0;
  const pending = cache.getOrGenerate("seo-render:ad:one", 1000, async () => {
    calls += 1;
    await new Promise((resolve) => { releases = resolve; });
    return { status: 200, body: "old content", cacheable: true };
  });
  const joined = cache.getOrGenerate("seo-render:ad:one", 1000, async () => {
    calls += 1;
    return { status: 200, body: "duplicate", cacheable: true };
  });
  await Promise.resolve();
  releases();
  const [first, second] = await Promise.all([pending, joined]);
  assert.equal(calls, 1);
  assert.equal(first.body, "old content");
  assert.equal(second.body, "old content");

  let lateResolve;
  const stale = cache.getOrGenerate("seo-render:ad:two", 1000, async () => {
    await new Promise((resolve) => { lateResolve = resolve; });
    return { status: 200, body: "stale", cacheable: true };
  });
  await Promise.resolve();
  cache.invalidatePrefix("seo-render:ad:");
  lateResolve();
  await assert.rejects(stale, SeoCacheInvalidatedError);
  assert.equal(cache.get("seo-render:ad:two"), null);
});

test("cache hit revalidation can evict content that became private", async () => {
  const cache = new BoundedLruCache({
    enabled: true,
    adTtlMs: 1000,
    categoryTtlMs: 1000,
    storeTtlMs: 1000,
    auctionTtlMs: 1000,
    maxEntries: 20,
    maxBytes: 10_000,
    maxItemBytes: 5_000,
    maxInFlight: 20
  });
  let allowed = true;
  await cache.getOrGenerate("seo-render:ad:private", 1000, async () => ({
    status: 200,
    body: "public html",
    cacheable: true
  }));
  const second = await cache.getOrGenerate(
    "seo-render:ad:private",
    1000,
    async () => ({ status: 404, body: "not found", cacheable: false }),
    async () => allowed
  );
  assert.equal(second.body, "public html");
  allowed = false;
  const third = await cache.getOrGenerate(
    "seo-render:ad:private",
    1000,
    async () => ({ status: 404, body: "not found", cacheable: false }),
    async () => allowed
  );
  assert.equal(third.status, 404);
  assert.equal(cache.get("seo-render:ad:private"), null);
});

test("503 and noindex results are never cached", async () => {
  const cache = new BoundedLruCache({
    enabled: true,
    adTtlMs: 1000,
    categoryTtlMs: 1000,
    storeTtlMs: 1000,
    auctionTtlMs: 1000,
    maxEntries: 20,
    maxBytes: 10_000,
    maxItemBytes: 5_000,
    maxInFlight: 20
  });
  await cache.getOrGenerate("ad-error", 1000, async () => ({
    status: 503,
    body: "temporary",
    cacheable: false
  }));
  await cache.getOrGenerate("ad-private", 1000, async () => ({
    status: 200,
    body: "private",
    cacheable: false
  }));
  assert.equal(cache.get("ad-error"), null);
  assert.equal(cache.get("ad-private"), null);
});

test("disabled caching still bounds work and releases permits after completion", async () => {
  const cache = new BoundedLruCache({
    enabled: false,
    maxInFlight: 4
  });
  const limiter = new BoundedSeoWorkLimiter(1);
  let finish;
  const pending = cache.getOrGenerate(
    "uncached-one",
    1000,
    () => new Promise((resolve) => { finish = resolve; }),
    null,
    limiter
  );
  await Promise.resolve();

  await assert.rejects(
    cache.getOrGenerate("uncached-two", 1000, async () => "unbounded", null, limiter),
    SeoWorkLimitError
  );
  assert.deepEqual(limiter.getMetrics(), { active: 1, maxConcurrent: 1 });
  finish("completed");
  assert.equal(await pending, "completed");
  assert.deepEqual(limiter.getMetrics(), { active: 0, maxConcurrent: 1 });
});

test("query timeout helper sets operation and server-side deadlines without racing", () => {
  let options;
  const query = {
    setOptions(value) {
      options = value;
      return this;
    }
  };
  assert.equal(applySeoQueryTimeout(query), query);
  assert.deepEqual(options, { maxTimeMS: 10_000, timeoutMS: 10_000 });
});
