import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import storesRouter from "../src/routes/stores.js";
import StoreProfile from "../src/models/StoreProfile.js";
import StoreSubscription from "../src/models/StoreSubscription.js";

function query(value) {
  return {
    select() { return this; },
    sort() { return this; },
    populate() { return this; },
    lean() { return Promise.resolve(value); }
  };
}

async function requestStoreIcon({ size, logo = null, features = ["pwa"], storeName = "بامسق للأثاث" }) {
  const originals = {
    storeFindOne: StoreProfile.findOne,
    subscriptionFindOne: StoreSubscription.findOne
  };
  StoreProfile.findOne = () => query({ _id: "store-id", storeName, slug: "test-store", logo, status: "active" });
  StoreSubscription.findOne = () => query({
    status: "active",
    endDate: new Date(Date.now() + 86400000),
    planId: { features }
  });

  try {
    const route = storesRouter.stack.find((entry) => entry.route?.path === "/:slug/pwa-icon/:size.png" && entry.route.methods.get);
    assert.ok(route, "store PWA icon route must exist");
    const handler = route.route.stack.at(-1).handle;
    const result = { statusCode: 200, headers: {}, body: null };
    const res = {
      status(code) { result.statusCode = code; return this; },
      json(body) { result.body = body; return this; },
      set(name, value) { result.headers[name] = value; return this; },
      send(body) { result.body = body; return this; }
    };
    await handler({ params: { slug: "test-store", size: String(size) } }, res);
    return result;
  } finally {
    StoreProfile.findOne = originals.storeFindOne;
    StoreSubscription.findOne = originals.subscriptionFindOne;
  }
}

test("store logo is served as a correctly sized PNG icon", async () => {
  const tempDirectory = await fs.mkdtemp(path.join(process.cwd(), "uploads", ".store-pwa-test-"));
  const logoPath = path.join(tempDirectory, "logo.webp");
  try {
    await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 238, g: 18, b: 100 } } })
      .webp()
      .toFile(logoPath);
    const result = await requestStoreIcon({ size: 192, logo: path.relative(process.cwd(), logoPath) });

    assert.equal(result.statusCode, 200);
    assert.equal(result.headers["Content-Type"], "image/png");
    const metadata = await sharp(result.body).metadata();
    assert.equal(metadata.format, "png");
    assert.equal(metadata.width, 192);
    assert.equal(metadata.height, 192);
    const { data, info } = await sharp(result.body).raw().toBuffer({ resolveWithObject: true });
    const pixel = (info.width * 96 + 96) * info.channels;
    assert.ok(data[pixel] > 200 && data[pixel + 1] < 80 && data[pixel + 2] > 60);
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
});

test("missing store logo produces a PNG fallback at the requested 512 size", async () => {
  const result = await requestStoreIcon({ size: 512, logo: null, storeName: "بامسق للأثاث" });

  assert.equal(result.statusCode, 200);
  assert.equal(result.headers["Content-Type"], "image/png");
  const metadata = await sharp(result.body).metadata();
  assert.equal(metadata.format, "png");
  assert.equal(metadata.width, 512);
  assert.equal(metadata.height, 512);
});

test("store icon endpoint is unavailable when the active plan does not include PWA", async () => {
  const result = await requestStoreIcon({ size: 192, features: [] });
  assert.equal(result.statusCode, 404);
});