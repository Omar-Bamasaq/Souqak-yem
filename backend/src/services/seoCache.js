const DEFAULTS = Object.freeze({
  enabled: true,
  adTtlMs: 60_000,
  categoryTtlMs: 120_000,
  storeTtlMs: 60_000,
  auctionTtlMs: 10_000,
  maxEntries: 2_000,
  maxBytes: 64 * 1024 * 1024,
  maxItemBytes: 512 * 1024,
  maxInFlight: 256
});

export const SEO_QUERY_TIMEOUT_MS = 10_000;

export class SeoWorkLimitError extends Error {
  constructor() {
    super("SEO work concurrency limit reached.");
    this.name = "SeoWorkLimitError";
    this.code = "SEO_WORK_LIMIT";
  }
}

export class SeoCacheInvalidatedError extends Error {
  constructor() {
    super("SEO content changed while it was being generated.");
    this.name = "SeoCacheInvalidatedError";
    this.code = "SEO_CACHE_INVALIDATED";
  }
}

export class BoundedSeoWorkLimiter {
  constructor(maxConcurrent = DEFAULTS.maxInFlight) {
    if (!Number.isSafeInteger(maxConcurrent) || maxConcurrent <= 0) {
      throw new Error("SEO work concurrency must be a positive safe integer.");
    }
    this.maxConcurrent = maxConcurrent;
    this.active = 0;
  }

  tryAcquire() {
    if (this.active >= this.maxConcurrent) return null;
    this.active += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active -= 1;
    };
  }

  getMetrics() {
    return { active: this.active, maxConcurrent: this.maxConcurrent };
  }
}

export function applySeoQueryTimeout(query, timeoutMS = SEO_QUERY_TIMEOUT_MS) {
  if (typeof query?.setOptions !== "function") {
    throw new TypeError("SEO MongoDB queries must support per-operation timeouts.");
  }
  return query.setOptions({ maxTimeMS: timeoutMS, timeoutMS });
}

function positiveInteger(value, fallback, name, maximum) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || (maximum && parsed > maximum)) {
    throw new Error(`${name} must be a positive integer${maximum ? ` no greater than ${maximum}` : ""}.`);
  }
  return parsed;
}

function boolValue(value, fallback) {
  if (value == null || value === "") return fallback;
  if (["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase())) return true;
  if (["0", "false", "no", "off"].includes(String(value).trim().toLowerCase())) return false;
  throw new Error("SEO_RENDER_CACHE_ENABLED must be a boolean.");
}

export function resolveSeoCacheOptions(env = process.env) {
  const enabled = typeof env.SEO_RENDER_CACHE_ENABLED === "boolean"
    ? env.SEO_RENDER_CACHE_ENABLED
    : boolValue(env.SEO_RENDER_CACHE_ENABLED, DEFAULTS.enabled);
  return {
    enabled,
    adTtlMs: positiveInteger(env.SEO_RENDER_CACHE_AD_TTL_MS ?? env.adTtlMs, DEFAULTS.adTtlMs, "SEO_RENDER_CACHE_AD_TTL_MS", 24 * 60 * 60 * 1000),
    categoryTtlMs: positiveInteger(env.SEO_RENDER_CACHE_CATEGORY_TTL_MS ?? env.categoryTtlMs, DEFAULTS.categoryTtlMs, "SEO_RENDER_CACHE_CATEGORY_TTL_MS", 24 * 60 * 60 * 1000),
    storeTtlMs: positiveInteger(env.SEO_RENDER_CACHE_STORE_TTL_MS ?? env.storeTtlMs, DEFAULTS.storeTtlMs, "SEO_RENDER_CACHE_STORE_TTL_MS", 24 * 60 * 60 * 1000),
    auctionTtlMs: positiveInteger(env.SEO_RENDER_CACHE_AUCTION_TTL_MS ?? env.auctionTtlMs, DEFAULTS.auctionTtlMs, "SEO_RENDER_CACHE_AUCTION_TTL_MS", 24 * 60 * 60 * 1000),
    maxEntries: positiveInteger(env.SEO_RENDER_CACHE_MAX_ENTRIES ?? env.maxEntries, DEFAULTS.maxEntries, "SEO_RENDER_CACHE_MAX_ENTRIES", 100_000),
    maxBytes: positiveInteger(env.SEO_RENDER_CACHE_MAX_BYTES ?? env.maxBytes, DEFAULTS.maxBytes, "SEO_RENDER_CACHE_MAX_BYTES", 512 * 1024 * 1024),
    maxItemBytes: positiveInteger(env.SEO_RENDER_CACHE_MAX_ITEM_BYTES ?? env.maxItemBytes, DEFAULTS.maxItemBytes, "SEO_RENDER_CACHE_MAX_ITEM_BYTES", 8 * 1024 * 1024),
    maxInFlight: positiveInteger(env.SEO_RENDER_CACHE_MAX_IN_FLIGHT ?? env.maxInFlight, DEFAULTS.maxInFlight, "SEO_RENDER_CACHE_MAX_IN_FLIGHT", 5_000)
  };
}

export class BoundedLruCache {
  constructor(options = {}) {
    this.options = resolveSeoCacheOptions(options);
    this.entries = new Map();
    this.inFlight = new Map();
    this.totalBytes = 0;
    this.generation = 0;
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      invalidations: 0,
      expirations: 0,
      coalesced: 0,
      generations: 0
    };
  }

  get enabled() {
    return this.options.enabled;
  }

  getMetrics() {
    return {
      ...this.metrics,
      entries: this.entries.size,
      totalBytes: this.totalBytes,
      inFlight: this.inFlight.size
    };
  }

  _removeExpired(now = Date.now()) {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
        this.totalBytes -= entry.bytes;
        this.metrics.expirations += 1;
      }
    }
  }

  _touch(key, entry) {
    this.entries.delete(key);
    this.entries.set(key, entry);
  }

  get(key, now = Date.now()) {
    if (!this.enabled) return null;
    this._removeExpired(now);
    const entry = this.entries.get(key);
    if (!entry) {
      this.metrics.misses += 1;
      return null;
    }
    this._touch(key, entry);
    this.metrics.hits += 1;
    return entry.value;
  }

  set(key, value, ttlMs, now = Date.now()) {
    if (!this.enabled) return false;
    if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) return false;
    const bytes = typeof value === "string"
      ? Buffer.byteLength(value, "utf8")
      : Buffer.byteLength(JSON.stringify(value), "utf8");
    if (bytes > this.options.maxItemBytes || bytes > this.options.maxBytes) {
      return false;
    }
    this._removeExpired(now);
    if (this.entries.has(key)) {
      this.totalBytes -= this.entries.get(key).bytes;
      this.entries.delete(key);
    }
    while (
      this.entries.size >= this.options.maxEntries ||
      this.totalBytes + bytes > this.options.maxBytes
    ) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      const entry = this.entries.get(oldest);
      this.entries.delete(oldest);
      this.totalBytes -= entry.bytes;
      this.metrics.evictions += 1;
    }
    this.entries.set(key, {
      value,
      bytes,
      expiresAt: now + ttlMs
    });
    this.totalBytes += bytes;
    return true;
  }

  delete(key) {
    const entry = this.entries.get(key);
    if (!entry) return false;
    this.entries.delete(key);
    this.totalBytes -= entry.bytes;
    this.metrics.invalidations += 1;
    return true;
  }

  invalidatePrefix(prefix) {
    this.generation += 1;
    this.metrics.generations += 1;
    let removed = 0;
    for (const key of [...this.entries.keys()]) {
      if (key.startsWith(prefix)) {
        this.delete(key);
        removed += 1;
      }
    }
    for (const key of [...this.inFlight.keys()]) {
      if (key.startsWith(prefix)) this.inFlight.delete(key);
    }
    return removed;
  }

  invalidate() {
    this.generation += 1;
    this.metrics.generations += 1;
    const removed = this.entries.size;
    this.entries.clear();
    this.totalBytes = 0;
    this.inFlight.clear();
    this.metrics.invalidations += removed;
    return removed;
  }

  async getOrGenerate(key, ttlMs, generate, revalidate = null, workLimiter = null) {
    if (this.inFlight.has(key)) {
      this.metrics.coalesced += 1;
      return this.inFlight.get(key);
    }
    if (this.inFlight.size >= this.options.maxInFlight) {
      throw new SeoWorkLimitError();
    }
    const release = workLimiter?.tryAcquire();
    if (workLimiter && !release) throw new SeoWorkLimitError();

    const generation = this.generation;
    const promise = Promise.resolve()
      .then(async () => {
        if (this.enabled) {
          const cached = this.get(key);
          if (cached) {
            const valid = typeof revalidate !== "function" ||
              await revalidate(cached) === true;
            if (valid) {
              const entry = this.entries.get(key);
              if (generation !== this.generation) {
                throw new SeoCacheInvalidatedError();
              }
              if (entry?.value === cached && entry.expiresAt > Date.now()) return cached;
            }
            this.delete(key);
          }
        }

        const result = await generate();
        if (generation !== this.generation) throw new SeoCacheInvalidatedError();
        if (this.enabled &&
            result?.cacheable !== false &&
            result?.status === 200 &&
            result?.body) {
          this.set(key, result, ttlMs);
        }
        return result;
      })
      .finally(() => {
        if (this.inFlight.get(key) === promise) this.inFlight.delete(key);
        release?.();
      });
    this.inFlight.set(key, promise);
    return promise;
  }

  close() {
    this.entries.clear();
    this.inFlight.clear();
    this.totalBytes = 0;
  }
}

export const seoRenderCache = new BoundedLruCache(resolveSeoCacheOptions());
export const seoWorkLimiter = new BoundedSeoWorkLimiter(
  resolveSeoCacheOptions().maxInFlight
);
