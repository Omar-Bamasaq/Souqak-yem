import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import {
  createDynamicAdRenderer,
  dynamicAdRendererInternals,
  loadPublicSeoAd
} from "../src/services/dynamicAdRenderer.js";
import { isPublicAdVisible } from "../src/services/publicAdAccess.js";
import { BoundedLruCache } from "../src/services/seoCache.js";

const ID = "0123456789abcdef01234567";
const OTHER_ID = "fedcba9876543210fedcba98";
const SITE = "https://souqak-yem.com";
const API_ORIGIN = "https://api.souqak-yem.com";
const TEMPLATE = `<!doctype html><html lang="ar" dir="rtl"><head>
<title>Homepage</title><meta name="description" content="Homepage description"/>
<meta name="robots" content="noindex,nofollow"/>
<link rel="stylesheet" href="/assets/index-a1b2.css"/>
</head><body><div id="root"></div>
<script type="module" crossorigin src="/assets/index-c3d4.js"></script>
</body></html>`;

function makeAd(overrides = {}) {
  return {
    _id: ID,
    title: "سيارة مستعملة",
    slug: "used-car",
    description: "سيارة بحالة جيدة للاستخدام اليومي",
    images: ["ads/public-car.webp"],
    price: 2500,
    currency: "YER_ADEN",
    priceOnContact: false,
    status: "approved",
    isDeleted: false,
    isVisible: true,
    isArchived: false,
    sold: false,
    isSold: false,
    isAvailable: true,
    scheduledPublishAt: new Date("2026-01-01T00:00:00.000Z"),
    expiresAt: new Date("2027-01-01T00:00:00.000Z"),
    inventoryEnabled: false,
    stockQuantity: 0,
    adType: "sell",
    categoryId: { name: "سيارات", slug: "cars" },
    governorateId: { name: "صنعاء" },
    cityId: { name: "حدة" },
    storeProfileId: null,
    ...overrides
  };
}

async function startTestServer({ loadAd = async () => ({ kind: "found", ad: makeAd() }), template = TEMPLATE, cache } = {}) {
  const app = express();
  app.use(createDynamicAdRenderer({
    loadAd,
    template,
    siteBaseUrl: SITE,
    apiOrigin: API_ORIGIN,
    cache
  }));
  app.get("/api/ads/:id", (_req, res) => res.status(200).json({ api: true }));
  app.get("/store/:slug", (_req, res) => res.status(200).send("store-pwa"));
  app.get("/login", (_req, res) => res.status(200).send("login-page"));
  app.get("/", (_req, res) => res.status(200).send("home-page"));
  app.use((_req, res) => res.status(404).send("fallback"));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    server,
    async request(path, headers = {}) {
      return new Promise((resolve, reject) => {
        const request = http.request({
          hostname: "127.0.0.1",
          port: address.port,
          path,
          method: "GET",
          headers: { accept: "text/html", ...headers }
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
    async close() {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  };
}

test("dynamic ad HTML uses cache for repeated canonical requests", async (t) => {
  let loadCalls = 0;
  const cache = new BoundedLruCache({
    enabled: true,
    adTtlMs: 60_000,
    categoryTtlMs: 120_000,
    storeTtlMs: 60_000,
    auctionTtlMs: 10_000,
    maxEntries: 20,
    maxBytes: 100_000,
    maxItemBytes: 20_000,
    maxInFlight: 20
  });
  const server = await startTestServer({
    cache,
    loadAd: async () => {
      loadCalls += 1;
      return { kind: "found", ad: makeAd() };
    }
  });
  t.after(() => server.close());

  const first = await server.request(`/ad/${ID}/used-car`);
  const second = await server.request(`/ad/${ID}/used-car?utm_source=campaign&ref=Referral`);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.match(second.body, /سيارة مستعملة/);
  assert.equal(loadCalls, 2, JSON.stringify(cache.getMetrics()));
  assert.equal(cache.getMetrics().hits, 1);
  assert.equal(cache.getMetrics().misses, 1);
});

test("cached ad HTML is revalidated before serving after public eligibility changes", async (t) => {
  let publicAd = true;
  const server = await startTestServer({
    loadAd: async () => publicAd
      ? { kind: "found", ad: makeAd() }
      : { kind: "not_public" }
  });
  t.after(() => server.close());

  assert.equal((await server.request(`/ad/${ID}/used-car`)).status, 200);
  publicAd = false;
  const hidden = await server.request(`/ad/${ID}/used-car`);
  assert.equal(hidden.status, 404);
  assert.match(hidden.headers["x-robots-tag"], /noindex/);
  assert.doesNotMatch(hidden.body, /سيارة مستعملة/);
});

test("dynamic ad renderer serves useful indexable HTML and exact release assets", async (t) => {
  const server = await startTestServer({
    loadAd: async () => ({ kind: "found", ad: makeAd() })
  });
  t.after(() => server.close());
  const response = await server.request(`/ad/${ID}/used-car`);

  assert.equal(response.status, 200);
  assert.match(response.headers["content-type"], /text\/html/);
  assert.match(response.headers["cache-control"], /no-store/);
  assert.match(response.body, /<title data-rh="true">سيارة مستعملة \| سوقك<\/title>/);
  assert.match(response.body, new RegExp(`<link data-rh="true" rel="canonical" href="${SITE}/ad/${ID}/used-car"`));
  assert.match(response.body, /name="robots" content="index,follow/);
  assert.match(response.body, /<h1>سيارة مستعملة<\/h1>/);
  assert.match(response.body, /سيارة بحالة جيدة للاستخدام اليومي/);
  assert.match(response.body, /src="\/assets\/index-c3d4\.js"/);
  assert.match(response.body, /href="\/assets\/index-a1b2\.css"/);
  assert.match(response.body, /window\.__SOUQAK_DYNAMIC_AD__=true/);
  assert.match(response.body, /name="souqak-prerendered-path" content="\/ad\//);
  assert.doesNotMatch(response.body, /Homepage description/);
  assert.doesNotMatch(response.body, />Homepage</);

  const schema = response.body.match(/<script data-rh="true" type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(schema);
  const parsedSchema = JSON.parse(schema);
  const productSchema = parsedSchema["@graph"]?.[0] || parsedSchema;
  assert.equal(productSchema["@type"], "Product");
  assert.equal(productSchema.offers.availability, "https://schema.org/InStock");
});

test("new Arabic ad URLs, duplicate slugs, and hostile ad text render safely", async (t) => {
  const ad = makeAd({
    title: `إعلان <script>alert("x")</script> & "خاص"`,
    slug: "same-slug",
    description: `وصف <img src=x onerror=alert(1)> مع رقم 967771234567`,
    images: ["ads/public-car.webp"]
  });
  const server = await startTestServer({ loadAd: async () => ({ kind: "found", ad }) });
  t.after(() => server.close());
  const encodedSlug = encodeURIComponent("سيارة-مستعملة");
  const response = await server.request(`/ad/${ID}/${encodedSlug}`);

  assert.equal(response.status, 301);
  assert.equal(response.headers.location, `${SITE}/ad/${ID}/same-slug`);
  const canonical = await server.request(`/ad/${ID}/same-slug`);
  assert.equal(canonical.status, 200);
  assert.match(canonical.body, /إعلان &lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; &quot;خاص&quot;/);
  assert.doesNotMatch(canonical.body, /<script>alert/);
  assert.doesNotMatch(canonical.body, /967771234567/);
  assert.match(canonical.body, /\\u003cscript/);
  const state = canonical.body.match(/window\.__SOUQAK_SSG_DATA__=([\s\S]*?);window\.__SOUQAK_DYNAMIC_AD__/);
  assert.ok(state);
  assert.equal(JSON.parse(state[1]).data.ad._id, ID);

  const otherAd = makeAd({ _id: OTHER_ID, slug: "same-slug" });
  const otherServer = await startTestServer({ loadAd: async () => ({ kind: "found", ad: otherAd }) });
  t.after(() => otherServer.close());
  const otherResponse = await otherServer.request(`/ad/${OTHER_ID}/same-slug`);
  assert.equal(otherResponse.status, 200);
  assert.match(otherResponse.body, new RegExp(`${SITE}/ad/${OTHER_ID}/same-slug`));
});

test("missing and incorrect slugs and legacy aliases redirect only public ads", async (t) => {
  const server = await startTestServer({
    loadAd: async () => ({ kind: "found", ad: makeAd() })
  });
  t.after(() => server.close());

  const missingSlug = await server.request(`/ad/${ID}?ref=Referral%201&utm_source=campaign&next=https%3A%2F%2Fattacker.example`);
  assert.equal(missingSlug.status, 301);
  assert.equal(missingSlug.headers.location, `${SITE}/ad/${ID}/used-car?ref=Referral+1&utm_source=campaign`);
  const legacyBrokerageLink = await server.request(`/ads/${ID}?ref=Referral%201&utm_source=campaign`);
  assert.equal(legacyBrokerageLink.status, 301);
  assert.equal(legacyBrokerageLink.headers.location, `${SITE}/ad/${ID}/used-car?ref=Referral+1&utm_source=campaign`);
  const wrongSlug = await server.request(`/ad/${ID}/wrong-slug`);
  assert.equal(wrongSlug.status, 301);
  assert.equal(wrongSlug.headers.location, `${SITE}/ad/${ID}/used-car`);
  const legacy = await server.request(`/product/${ID}?ref=campaign`);
  assert.equal(legacy.status, 301);
  assert.equal(legacy.headers.location, `${SITE}/ad/${ID}/used-car?ref=campaign`);

  const privateServer = await startTestServer({
    loadAd: async () => ({ kind: "not_public" })
  });
  t.after(() => privateServer.close());
  const privateWrongSlug = await privateServer.request(`/ad/${ID}/wrong-slug`);
  assert.equal(privateWrongSlug.status, 404);
  assert.equal(privateWrongSlug.headers.location, undefined);
});

test("not-found, private, invalid-ID, and inaccessible ads return noindex 404 HTML", async (t) => {
  const notFoundServer = await startTestServer({
    loadAd: async () => ({ kind: "not_found" })
  });
  const privateServer = await startTestServer({
    loadAd: async () => ({ kind: "not_public" })
  });
  t.after(() => notFoundServer.close());
  t.after(() => privateServer.close());

  const missing = await notFoundServer.request(`/ad/${ID}/missing`);
  const privateAd = await privateServer.request(`/ad/${ID}/missing`);
  const invalid = await notFoundServer.request("/ad/not-an-object-id/anything");
  assert.equal(missing.status, 404);
  assert.equal(privateAd.status, 404);
  assert.equal(invalid.status, 404);
  assert.match(missing.body, /name="robots" content="noindex,nofollow"/);
  assert.match(missing.body, /الإعلان غير موجود/);
  assert.doesNotMatch(missing.body, /rel="canonical"/);
  assert.doesNotMatch(missing.body, /Homepage description|<title>Homepage/);
  assert.equal(missing.body, privateAd.body);
  assert.equal(invalid.headers["x-robots-tag"], "noindex, nofollow");
});

test("public but non-indexable ads retain content without an in-stock Offer", async (t) => {
  const ad = makeAd({ isAvailable: false });
  assert.equal(isPublicAdVisible(ad), true);
  const server = await startTestServer({ loadAd: async () => ({ kind: "found", ad }) });
  t.after(() => server.close());
  const response = await server.request(`/ad/${ID}/used-car`);

  assert.equal(response.status, 200);
  assert.match(response.body, /name="robots" content="noindex,nofollow"/);
  assert.match(response.headers["x-robots-tag"], /noindex/);
  assert.match(response.body, /<h1>سيارة مستعملة<\/h1>/);
  const schema = JSON.parse(response.body.match(/<script data-rh="true" type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const productSchema = schema["@graph"]?.[0] || schema;
  assert.equal(productSchema.offers, undefined);
});

test("database and release-template failures are retryable 503 responses", async (t) => {
  const databaseServer = await startTestServer({
    loadAd: async () => { throw Object.assign(new Error("private db details"), { code: "ECONNRESET" }); }
  });
  const templateServer = await startTestServer({
    template: "<html><body>broken</body></html>"
  });
  t.after(() => databaseServer.close());
  t.after(() => templateServer.close());

  const databaseError = await databaseServer.request(`/ad/${ID}/used-car`);
  const templateError = await templateServer.request(`/ad/${ID}/used-car`);
  for (const response of [databaseError, templateError]) {
    assert.equal(response.status, 503);
    assert.equal(response.headers["retry-after"], "30");
    assert.match(response.headers["x-robots-tag"], /noindex/);
    assert.doesNotMatch(response.body, /private db details|ECONNRESET|stack/i);
    assert.match(response.body, /تعذر تحميل الإعلان حالياً/);
  }
});

test("Host headers and User-Agent do not alter canonical content or redirect origin", async (t) => {
  const server = await startTestServer({ loadAd: async () => ({ kind: "found", ad: makeAd() }) });
  t.after(() => server.close());
  const ordinary = await server.request(`/ad/${ID}/wrong`, {
    host: "attacker.example",
    "x-forwarded-host": "attacker.example",
    "user-agent": "ordinary-browser"
  });
  assert.equal(ordinary.status, 301);
  assert.equal(ordinary.headers.location, `${SITE}/ad/${ID}/used-car`);

  const googlebotServer = await startTestServer({ loadAd: async () => ({ kind: "found", ad: makeAd() }) });
  t.after(() => googlebotServer.close());
  const browserPage = await server.request(`/ad/${ID}/used-car`, { "user-agent": "ordinary-browser" });
  const botPage = await googlebotServer.request(`/ad/${ID}/used-car`, { "user-agent": "Googlebot" });
  assert.equal(browserPage.status, botPage.status);
  assert.equal(browserPage.body, botPage.body);
});

test("renderer leaves API, private, PWA, and non-HTML requests untouched", async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());
  assert.equal((await server.request("/api/ads/0123456789abcdef01234567")).body, JSON.stringify({ api: true }));
  assert.equal((await server.request("/store/my-shop")).body, "store-pwa");
  assert.equal((await server.request("/login")).body, "login-page");
  assert.equal((await server.request("/", { accept: "text/html" })).body, "home-page");
  assert.equal((await server.request(`/ad/${ID}/used-car`, { accept: "application/json" })).body, "fallback");
});

test("public visibility is shared with the existing ad detail access check", () => {
  const now = new Date("2026-11-25T10:00:00.000Z");
  const base = makeAd({ expiresAt: new Date(now.getTime() + 60_000) });
  assert.equal(isPublicAdVisible(base, now), true);
  for (const patch of [
    { status: "pending" },
    { expiresAt: new Date(now.getTime() - 1) },
    { isVisible: false },
    { isArchived: true },
    { sold: true },
    { isDeleted: true }
  ]) {
    assert.equal(isPublicAdVisible({ ...base, ...patch }, now), false);
  }
  assert.equal(isPublicAdVisible({ ...base, expiresAt: undefined }, now), true);
});

test("public data query has a bounded projection and hides inactive store products", async () => {
  const calls = [];
  const ad = makeAd({ storeProfileId: { _id: "aaaaaaaaaaaaaaaaaaaaaaaa", status: "active" } });
  const query = {
    setOptions(value) { calls.push(["timeout", value]); return this; },
    select(value) { calls.push(["select", value]); return this; },
    populate(...args) { calls.push(["populate", ...args]); return this; },
    lean: async () => ad
  };
  const AdModel = { findById: (id) => { calls.push(["findById", id]); return query; } };
  const subscriptionQuery = {
    setOptions(value) { calls.push(["subscription-timeout", value]); return this; },
    sort(value) { calls.push(["sort", value]); return this; },
    select(value) { calls.push(["subscription-select", value]); return this; },
    lean: async () => ({ status: "expired" })
  };
  const StoreSubscriptionModel = {
    findOne: (filter) => { calls.push(["findOne", filter]); return subscriptionQuery; }
  };
  const result = await loadPublicSeoAd(ID, {
    AdModel,
    StoreSubscriptionModel,
    now: new Date("2026-11-25T10:00:00.000Z")
  });

  assert.equal(result.kind, "not_public");
  assert.equal(calls[0][0], "findById");
  assert.equal(calls[0][1], ID);
  assert.ok(calls.some(([name, options]) => (
    name === "timeout" && options.timeoutMS === 10_000
  )));
  assert.ok(calls.some(([name, options]) => (
    name === "subscription-timeout" && options.timeoutMS === 10_000
  )));
  const projection = calls.find(([name]) => name === "select")[1];
  assert.match(projection, /title/);
  assert.doesNotMatch(projection, /contactInfo|buyerId|userId|wallet|email|phone/i);
  assert.ok(calls.some(([name]) => name === "findOne"));
});

test("frontend template rejects missing shells and unversioned assets", () => {
  const fontTemplate = TEMPLATE.replace(
    "</head>",
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Example:wght@400"></head>'
  );
  assert.doesNotThrow(() => dynamicAdRendererInternals.validateFrontendTemplate(fontTemplate));
  assert.throws(
    () => dynamicAdRendererInternals.validateFrontendTemplate(
      fontTemplate.replace("fonts.googleapis.com", "attacker.example")
    ),
    /invalid or unversioned app assets/
  );
  assert.throws(
    () => dynamicAdRendererInternals.validateFrontendTemplate("<html><body><div id='root'></div></body></html>"),
    /release frontend template/
  );
  assert.throws(
    () => dynamicAdRendererInternals.validateFrontendTemplate(TEMPLATE.replace("/assets/index-c3d4.js", "/app.js")),
    /invalid or unversioned app assets/
  );
});
