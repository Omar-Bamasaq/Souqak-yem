import test from "node:test";
import assert from "node:assert/strict";
import {
  buildStorePwaManifest,
  createStorePwaAppRouter,
  renderStorePwaAppHtml
} from "../src/routes/storePwaApp.js";

const STORE_ID = "64d3d93a1a2b3c4d5e6f7701";
const OTHER_STORE_ID = "64d3d93a1a2b3c4d5e6f7702";
const APP_ORIGIN = "https://apps.example.test";

function query(value) {
  return {
    select() { return this; },
    sort() { return this; },
    populate() { return this; },
    lean: async () => value
  };
}

function makeStore(_id, overrides = {}) {
  return {
    _id,
    storeName: "متجر تجريبي",
    slug: "store-before-rename",
    storeType: "store",
    status: "active",
    primaryColor: "#176b5b",
    ...overrides
  };
}

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    set(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    type(value) { this.headers["content-type"] = value; return this; },
    send(value) { this.body = value; return this; },
    json(value) { this.body = value; return this; }
  };
}

function getHandler(router, routePath) {
  const layer = router.stack.find((item) => item.route?.path === routePath && item.route.methods.get);
  assert.ok(layer, `Expected GET ${routePath}`);
  return layer.route.stack.at(-1).handle;
}

function makeRouter({ stores, subscriptions, featureEnabled = true, iconGenerator } = {}) {
  const storeQueries = [];
  const router = createStorePwaAppRouter({
    StoreProfileModel: {
      findOne(filter) {
        storeQueries.push(filter);
        return query(stores.get(String(filter._id)) || null);
      }
    },
    StoreSubscriptionModel: {
      findOne(filter) {
        return query(subscriptions.get(String(filter.storeId)) || null);
      }
    },
    hasFeature: (_store, feature) => feature === "pwa" && featureEnabled,
    origin: APP_ORIGIN,
    assetOrigin: "https://assets.example.test",
    ...(iconGenerator ? { iconGenerator } : {})
  });
  return { router, storeQueries };
}

test("store manifests have distinct ID-based identities that survive name and slug changes", () => {
  const first = makeStore(STORE_ID);
  const second = makeStore(OTHER_STORE_ID, {
    storeName: "أسرة النور",
    slug: "family-before-rename",
    storeType: "family-production"
  });
  const firstManifest = buildStorePwaManifest(first, { origin: APP_ORIGIN });
  const secondManifest = buildStorePwaManifest(second, { origin: APP_ORIGIN });
  const renamedManifest = buildStorePwaManifest({
    ...first,
    storeName: "الاسم الجديد",
    slug: "store-after-rename"
  }, { origin: APP_ORIGIN });

  assert.notEqual(firstManifest.id, secondManifest.id);
  assert.equal(firstManifest.id, `https://apps.example.test/store/${STORE_ID}/`);
  assert.equal(firstManifest.start_url, firstManifest.id);
  assert.equal(firstManifest.scope, firstManifest.id);
  assert.equal(firstManifest.name, "متجر تجريبي");
  assert.equal(secondManifest.name, "أسرة النور");
  assert.equal(secondManifest.id, `https://apps.example.test/store/${OTHER_STORE_ID}/`);
  assert.equal(renamedManifest.id, firstManifest.id);
  assert.equal(renamedManifest.start_url, firstManifest.start_url);
  assert.equal(renamedManifest.scope, firstManifest.scope);
  assert.equal(renamedManifest.name, "الاسم الجديد");
  assert.ok(firstManifest.icons.every((icon) => icon.src.includes(`/store/${STORE_ID}/icon/`)));
});

test("initial app HTML contains its manifest, title, Apple icon, and safely serialized app identity", () => {
  const html = renderStorePwaAppHtml(makeStore(STORE_ID, {
    storeName: `متجر </title><script>alert("x")</script>`,
    slug: "</script><img src=x>"
  }), {
    origin: APP_ORIGIN,
    assetOrigin: "https://assets.example.test"
  });

  assert.match(html, /rel="manifest" href="https:\/\/apps\.example\.test\/store\/64d3d93a1a2b3c4d5e6f7701\/manifest\.webmanifest"/);
  assert.match(html, /rel="apple-touch-icon" href="https:\/\/apps\.example\.test\/store\/64d3d93a1a2b3c4d5e6f7701\/icon\/192\.png"/);
  assert.match(html, /<title>متجر &lt;\/title&gt;&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;<\/title>/);
  assert.match(html, /assets\.example\.test\/assets\/store-pwa-entry\.js/);
  assert.match(html, /window\.__SOUQAK_STORE_PWA_APP__/);
  assert.match(html, /\\u003c\/script\\u003e/);
});

test("manifest and app shell endpoints reject invalid, inactive, and non-PWA stores", async () => {
  const activeStore = makeStore(STORE_ID);
  const { router, storeQueries } = makeRouter({
    stores: new Map([[STORE_ID, activeStore]]),
    subscriptions: new Map([[STORE_ID, { status: "active" }]]),
    featureEnabled: false
  });
  const manifestResponse = createResponse();
  await getHandler(router, "/:storeId/manifest.webmanifest")(
    { params: { storeId: STORE_ID } },
    manifestResponse
  );
  const invalidResponse = createResponse();
  await getHandler(router, "/:storeId")(
    { params: { storeId: "not-an-object-id" } },
    invalidResponse
  );

  assert.equal(manifestResponse.statusCode, 404);
  assert.equal(invalidResponse.statusCode, 404);
  assert.equal(storeQueries.length, 1);
  assert.deepEqual(storeQueries[0], { _id: STORE_ID, status: "active" });
});

test("eligible store page and generated icon share the store-specific origin and scope", async () => {
  const store = makeStore(STORE_ID, { storeType: "family-production" });
  let generatedIcon;
  const { router } = makeRouter({
    stores: new Map([[STORE_ID, store]]),
    subscriptions: new Map([[STORE_ID, { status: "active" }]]),
    iconGenerator: async (target, size) => {
      generatedIcon = { storeId: String(target._id), size };
      return Buffer.from("png");
    }
  });
  const htmlResponse = createResponse();
  await getHandler(router, "/:storeId")({ params: { storeId: STORE_ID } }, htmlResponse);
  const iconResponse = createResponse();
  await getHandler(router, "/:storeId/icon/:size.png")({
    params: { storeId: STORE_ID, size: "512" }
  }, iconResponse);

  assert.equal(htmlResponse.statusCode, 200);
  assert.equal(htmlResponse.headers["cache-control"], "no-store");
  assert.match(htmlResponse.body, new RegExp(`basePath":"\\/store\\/${STORE_ID}"`));
  assert.equal(iconResponse.headers["content-type"], "image/png");
  assert.deepEqual(generatedIcon, { storeId: STORE_ID, size: 512 });
});
