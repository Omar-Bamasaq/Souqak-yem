import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import express from "express";
import sharp from "sharp";
import {
  createAdImageUpload,
  createSafeUpload,
  MAX_AD_IMAGE_HEIGHT_TO_WIDTH_RATIO
} from "../src/middleware/upload.js";

let root;
let publicDirectory;
let stagingDirectory;
let server;
let baseUrl;

async function createImage({ width, height, format = "jpeg", orientation }) {
  let pipeline = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 35, g: 110, b: 190 }
    }
  });

  if (format === "jpeg") {
    pipeline = pipeline.jpeg();
    if (orientation) pipeline = pipeline.withMetadata({ orientation });
  } else {
    pipeline = pipeline[format]();
  }
  return pipeline.toBuffer();
}

function createImageForm(images, fields = {}) {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  for (const [index, image] of images.entries()) {
    form.append(
      "images",
      new Blob([image.buffer], { type: image.mimeType || "image/jpeg" }),
      image.filename || `image-${index + 1}.${image.extension || "jpg"}`
    );
  }
  return form;
}

async function postImages(endpoint, images, fields = {}, method = "POST") {
  return fetch(`${baseUrl}${endpoint}`, {
    method,
    body: createImageForm(images, fields)
  });
}

before(async () => {
  sharp.cache(false);
  root = await fs.mkdtemp(path.join(os.tmpdir(), "souqak-ad-aspect-ratio-"));
  publicDirectory = path.join(root, "public");
  stagingDirectory = path.join(root, "staging");
  await Promise.all([
    fs.mkdir(publicDirectory),
    fs.mkdir(stagingDirectory)
  ]);

  const adUpload = createAdImageUpload({
    destinationForFile: () => publicDirectory,
    temporaryDirectory: stagingDirectory,
    maxInputPixels: 40_000_000,
    maxInputDimension: 12_000
  });
  const genericUpload = createSafeUpload({
    destinationForFile: () => publicDirectory,
    temporaryDirectory: stagingDirectory,
    maxInputPixels: 40_000_000,
    maxInputDimension: 12_000,
    publicImageVariants: true
  });

  const app = express();
  app.post("/ads", adUpload.array("images", 10), (req, res) => {
    res.status(201).json({ fileCount: req.files.length });
  });
  app.patch("/ads/:id", adUpload.array("images", 10), (req, res) => {
    res.status(201).json({ fileCount: req.files.length });
  });
  app.post("/store-products", adUpload.array("images", 10), (req, res) => {
    res.status(201).json({ fileCount: req.files.length });
  });
  app.post("/generic-upload", genericUpload.array("images", 10), (req, res) => {
    res.status(201).json({ fileCount: req.files.length });
  });
  app.use((error, _req, res, _next) => {
    res.status(error.status || 500).json({ error: error.message });
  });

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  sharp.cache(false);
  if (root) await fs.rm(root, { recursive: true, force: true });
});

test("the selected portrait ratio bound accepts normal portrait and horizontal images", async () => {
  assert.equal(MAX_AD_IMAGE_HEIGHT_TO_WIDTH_RATIO, 10);
  const response = await postImages("/ads", [
    { buffer: await createImage({ width: 900, height: 1_600 }), filename: "portrait.jpg" },
    { buffer: await createImage({ width: 1_600, height: 900 }), filename: "landscape.jpg" },
    { buffer: await createImage({ width: 100, height: 1_000 }), filename: "boundary.jpg" }
  ]);

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { fileCount: 3 });
});

test("a portrait screenshot beyond 10:1 is rejected with a safe indexed error", async () => {
  const response = await postImages("/ads", [
    { buffer: await createImage({ width: 100, height: 1_001 }), filename: "long.png", extension: "png", mimeType: "image/png" }
  ]);

  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), {
    error: "الصورة رقم 1 طويلة جدًا. يرجى قصها أو حذفها ثم إعادة المحاولة.",
    code: "AD_IMAGE_TOO_TALL",
    reason: "portrait_aspect_ratio_exceeded",
    imageIndex: 1
  });
});

test("ad image updates use the same safe, indexed rejection response", async () => {
  const response = await postImages(
    "/ads/ad-123",
    [{ buffer: await createImage({ width: 100, height: 1_200 }), filename: "long-update.jpg" }],
    {},
    "PATCH"
  );

  assert.equal(response.status, 422);
  assert.equal((await response.json()).code, "AD_IMAGE_TOO_TALL");
});

test("EXIF-rotated portrait dimensions are used for the aspect-ratio decision", async () => {
  const response = await postImages("/ads", [
    {
      buffer: await createImage({ width: 10_000, height: 800, orientation: 6 }),
      filename: "rotated-long.jpg"
    }
  ]);

  assert.equal(response.status, 422);
  assert.equal((await response.json()).code, "AD_IMAGE_TOO_TALL");
});

test("unknown Sharp decoding errors are not mislabeled as long images", async () => {
  const response = await postImages("/ads", [{
    buffer: Buffer.from("not a supported image"),
    filename: "invalid.jpg"
  }]);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "الصورة تالفة أو غير مدعومة." });
});

test("multiple uploads report the first violating image index", async () => {
  const images = [];
  for (let index = 0; index < 7; index += 1) {
    const isLong = index === 4 || index === 5;
    const isLandscape = index === 6;
    images.push({
      buffer: await createImage({
        width: isLong ? 100 : isLandscape ? 1_600 : 900,
        height: isLong ? 1_200 : isLandscape ? 900 : 1_600,
        format: index % 2 === 0 ? "jpeg" : "webp"
      }),
      filename: `image-${index + 1}.${index % 2 === 0 ? "jpg" : "webp"}`,
      mimeType: index % 2 === 0 ? "image/jpeg" : "image/webp"
    });
  }

  const response = await postImages("/ads", images);
  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), {
    error: "الصورة رقم 5 طويلة جدًا. يرجى قصها أو حذفها ثم إعادة المحاولة.",
    code: "AD_IMAGE_TOO_TALL",
    reason: "portrait_aspect_ratio_exceeded",
    imageIndex: 5
  });
});

test("store-product and generic image uploads keep their existing aspect-ratio behavior", async () => {
  const longImage = {
    buffer: await createImage({ width: 100, height: 1_200 }),
    filename: "long-store-product.jpg"
  };
  const storeResponse = await postImages("/store-products", [longImage], { storeProduct: "true" });
  assert.equal(storeResponse.status, 201);

  const genericResponse = await postImages("/generic-upload", [longImage]);
  assert.equal(genericResponse.status, 201);
});
