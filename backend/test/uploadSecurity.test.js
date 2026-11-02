import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import express from "express";
import sharp from "sharp";
import { createSafeUpload, uploadImages, uploadMessageImages } from "../src/middleware/upload.js";
import {
  identifyImageFormat,
  processPublicImageVariants,
  shouldConvertCategoryRasterImage
} from "../src/services/publicImagePipeline.js";
import publicUploads from "../src/middleware/publicUploads.js";
import {
  cleanupRequestUploadStagingDirectory
} from "../src/services/requestUploadStaging.js";

let publicDirectory;
let privateDirectory;
let stagingDirectory;
let server;
let baseUrl;

function uploadForm(filename, content, mimeType = "image/jpeg", fieldName = "images") {
  const form = new FormData();
  form.append(fieldName, new Blob([content], { type: mimeType }), filename);
  return form;
}

async function createImage(width = 64, height = 48, format = "jpeg") {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 35, g: 110, b: 190 }
    }
  })[format]().toBuffer();
}

function createAnimatedGif() {
  return Buffer.concat([
    Buffer.from("GIF89a"),
    Buffer.from([1, 0, 1, 0, 0x80, 0, 0, 0, 0, 0, 255, 255, 255]),
    Buffer.from([0x21, 0xf9, 4, 0, 0, 0, 0, 0, 0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 0x44, 1, 0]),
    Buffer.from([0x21, 0xf9, 4, 0, 0, 0, 0, 0, 0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 0x44, 1, 0]),
    Buffer.from([0x3b])
  ]);
}

async function upload(filename, content, mimeType = "image/jpeg", endpoint = "/upload") {
  return fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    body: uploadForm(filename, content, mimeType, endpoint === "/private-upload" ? "files" : "images")
  });
}

before(async () => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "souqak-upload-test-"));
  publicDirectory = path.join(root, "public");
  privateDirectory = path.join(root, "private");
  stagingDirectory = path.join(root, "staging");
  await Promise.all([
    fs.promises.mkdir(publicDirectory),
    fs.promises.mkdir(privateDirectory),
    fs.promises.mkdir(stagingDirectory)
  ]);

  const safeImageUpload = createSafeUpload({
    destinationForFile: () => publicDirectory,
    limits: { fileSize: 64 * 1024, files: 5 },
    publicImageVariants: true,
    temporaryDirectory: stagingDirectory,
    maxInputPixels: 1_000_000,
    maxInputDimension: 2_000
  });
  const safePrivateUpload = createSafeUpload({
    destinationForFile: () => privateDirectory,
    limits: { fileSize: 64 * 1024, files: 2 },
    temporaryDirectory: stagingDirectory,
    modeForFile: () => "image-or-pdf",
    maxInputPixels: 1_000_000,
    maxInputDimension: 2_000
  });
  const cleanupFailureUpload = createSafeUpload({
    destinationForFile: () => publicDirectory,
    limits: { fileSize: 64 * 1024, files: 1 },
    publicImageVariants: true,
    temporaryDirectory: stagingDirectory,
    cleanupStagingDirectory: async () => {
      throw new Error("simulated cleanup failure");
    },
    maxInputPixels: 1_000_000,
    maxInputDimension: 2_000
  });

  const app = express();
  app.post("/upload", safeImageUpload.array("images", 5), (req, res) => {
    res.json({
      files: req.files.map((file) => ({
        filename: file.filename,
        path: file.path,
        mimetype: file.mimetype,
        size: file.size,
        imageVariants: file.imageVariants || null
      }))
    });
  });
  app.post("/private-upload", safePrivateUpload.array("files", 2), (req, res) => {
    res.json({
      files: req.files.map((file) => ({
        filename: file.filename,
        path: file.path,
        mimetype: file.mimetype,
        size: file.size
      }))
    });
  });
  app.post("/cleanup-failure", cleanupFailureUpload.single("image"), (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/uploads", publicUploads, express.static(publicDirectory));
  app.use((error, _req, res, _next) => {
    res.status(error.status || 500).json({
      error: error.message,
      cleanupErrors: error.cleanupErrors || []
    });
  });

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) {
    await new Promise((resolve) => server.close(resolve));
  }
  sharp.cache(false);
  if (publicDirectory) {
    const testRoot = path.dirname(publicDirectory);
    for (let attempt = 0; ; attempt += 1) {
      try {
        await fs.promises.rm(testRoot, { recursive: true, force: true });
        break;
      } catch (error) {
        if (!["EBUSY", "EPERM"].includes(error.code) || attempt >= 20) throw error;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
  }
});

test("accepts and re-encodes a valid supported image", async () => {
  const response = await upload("valid.jpg", await createImage());
  assert.equal(response.status, 200);
  const [{ filename, path: filePath, mimetype, imageVariants }] = (await response.json()).files;
  assert.match(filename, /^public-[0-9a-f-]+\.webp$/i);
  assert.equal(mimetype, "image/webp");
  assert.equal(path.dirname(filePath), publicDirectory);
  assert.equal((await sharp(filePath).metadata()).format, "webp");
  assert.deepEqual(Object.keys(imageVariants), ["full", "med", "thumb"]);
  for (const variant of Object.values(imageVariants)) {
    assert.equal((await sharp(path.join(publicDirectory, variant)).metadata()).format, "webp");
  }
  assert.deepEqual(await fs.promises.readdir(stagingDirectory), []);

  const publicResponse = await fetch(`${baseUrl}/uploads/${filename}`);
  assert.equal(publicResponse.status, 200);
  assert.equal(publicResponse.headers.get("content-type"), "image/webp");
  assert.equal(publicResponse.headers.get("x-content-type-options"), "nosniff");
});

test("rejects HTML content disguised as an allowed image", async () => {
  const beforeCount = (await fs.promises.readdir(publicDirectory)).length;
  const response = await upload("photo.jpg", Buffer.from("<!doctype html><script>alert(1)</script>"));
  assert.equal(response.status, 400);
  assert.equal((await fs.promises.readdir(publicDirectory)).length, beforeCount);
});

test("rejects unsupported file extensions", async () => {
  const beforeCount = (await fs.promises.readdir(publicDirectory)).length;
  const response = await upload("payload.exe", await createImage());
  assert.equal(response.status, 400);
  assert.equal((await fs.promises.readdir(publicDirectory)).length, beforeCount);
});

test("rejects corrupt image data", async () => {
  const beforeCount = (await fs.promises.readdir(publicDirectory)).length;
  const response = await upload("broken.jpg", Buffer.from("not a decodable image"));
  assert.equal(response.status, 400);
  assert.equal((await fs.promises.readdir(publicDirectory)).length, beforeCount);
  assert.deepEqual(await fs.promises.readdir(stagingDirectory), []);
});

test("cleans only the failed request staging directory", async () => {
  const sentinelPath = path.join(stagingDirectory, "keep-existing.txt");
  await fs.promises.writeFile(sentinelPath, "not owned by this request");
  try {
    const response = await upload("broken.jpg", Buffer.from("invalid"));
    assert.equal(response.status, 400);
    assert.deepEqual(await fs.promises.readdir(stagingDirectory), ["keep-existing.txt"]);
    assert.equal(await fs.promises.readFile(sentinelPath, "utf8"), "not owned by this request");
  } finally {
    await fs.promises.unlink(sentinelPath);
  }
});

test("refuses to clean outside a request-scoped staging directory", async () => {
  const sentinelPath = path.join(stagingDirectory, "keep-outside.txt");
  await fs.promises.writeFile(sentinelPath, "protected");
  await assert.rejects(
    cleanupRequestUploadStagingDirectory(stagingDirectory, stagingDirectory, "souqak-upload-"),
    /outside this request's upload staging scope/
  );
  assert.equal(await fs.promises.readFile(sentinelPath, "utf8"), "protected");
  await fs.promises.unlink(sentinelPath);
});

test("cleanup failure does not replace the original upload error", async () => {
  const before = new Set(await fs.promises.readdir(stagingDirectory));
  const response = await fetch(`${baseUrl}/cleanup-failure`, {
    method: "POST",
    body: uploadForm("broken.jpg", Buffer.from("not an image"), "image/jpeg", "image")
  });
  const result = await response.json();
  assert.equal(response.status, 400);
  assert.match(result.error, /الصورة تالفة أو غير مدعومة/);
  assert.deepEqual(result.cleanupErrors, ["simulated cleanup failure"]);

  const createdDirectories = (await fs.promises.readdir(stagingDirectory))
    .filter((entry) => !before.has(entry));
  assert.equal(createdDirectories.length, 1);
  await cleanupRequestUploadStagingDirectory(
    path.join(stagingDirectory, createdDirectories[0]),
    stagingDirectory,
    "souqak-upload-"
  );
});

test("rejects uploads exceeding the configured file-size limit", async () => {
  const beforeCount = (await fs.promises.readdir(publicDirectory)).length;
  const response = await upload("large.jpg", Buffer.alloc(64 * 1024 + 1, 1));
  assert.equal(response.status, 413);
  assert.equal((await fs.promises.readdir(publicDirectory)).length, beforeCount);
});

test("rejects requests exceeding the configured file-count limit", async () => {
  const beforeCount = (await fs.promises.readdir(publicDirectory)).length;
  const form = new FormData();
  const image = await createImage();
  for (let index = 0; index < 6; index += 1) {
    form.append("images", new Blob([image], { type: "image/jpeg" }), `image-${index}.jpg`);
  }
  const response = await fetch(`${baseUrl}/upload`, { method: "POST", body: form });
  assert.equal(response.status, 400);
  assert.equal((await fs.promises.readdir(publicDirectory)).length, beforeCount);
});

test("rejects images exceeding the configured pixel limit", async () => {
  const beforeCount = (await fs.promises.readdir(publicDirectory)).length;
  const oversizedImage = await createImage(1_001, 1_000, "png");
  const response = await upload("oversized.png", oversizedImage, "image/png");
  assert.equal(response.status, 400);
  assert.equal((await fs.promises.readdir(publicDirectory)).length, beforeCount);
});

test("ignores unsafe original filenames when choosing the storage path", async () => {
  const response = await upload("..\\..\\unsafe.jpg", await createImage());
  assert.equal(response.status, 200);
  const [{ filename, path: filePath }] = (await response.json()).files;
  assert.match(filename, /^public-[0-9a-f-]+\.webp$/i);
  assert.equal(path.dirname(filePath), publicDirectory);
  assert.equal(path.basename(filePath), filename);
});

test("keeps PDF receipts as private PDFs and validates their signature", async () => {
  const pdf = Buffer.from("%PDF-1.4\nSynthetic private receipt\n");
  const response = await upload("receipt.pdf", pdf, "application/pdf", "/private-upload");
  assert.equal(response.status, 200);
  const [{ filename, path: filePath, mimetype }] = (await response.json()).files;
  assert.match(filename, /^[0-9a-f-]+\.pdf$/i);
  assert.equal(mimetype, "application/pdf");
  assert.equal(path.dirname(filePath), privateDirectory);
  assert.deepEqual(await fs.promises.readFile(filePath), pdf);
  assert.equal((await fs.promises.readdir(privateDirectory)).filter((name) => name.startsWith(filename.replace(/\.pdf$/i, ""))).length, 1);

  const invalidPdf = await upload("not-a-pdf.pdf", Buffer.from("<html>bad</html>"), "application/pdf", "/private-upload");
  assert.equal(invalidPdf.status, 400);
});

test("preserves PNG transparency in WebP variants", async () => {
  const transparentPng = await sharp({
    create: {
      width: 48,
      height: 32,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 0 }
    }
  }).png().toBuffer();
  const response = await upload("transparent.png", transparentPng, "image/png");
  assert.equal(response.status, 200);
  const [{ imageVariants }] = (await response.json()).files;
  for (const filename of Object.values(imageVariants)) {
    assert.equal((await sharp(path.join(publicDirectory, filename)).metadata()).hasAlpha, true);
  }
});

test("creates predictable full, medium, and thumbnail WebP dimensions", async () => {
  const sourcePath = path.join(stagingDirectory, "variants-source.jpg");
  await fs.promises.writeFile(sourcePath, await createImage(1_600, 1_000));
  const variants = await processPublicImageVariants({
    sourcePath,
    destination: publicDirectory,
    baseName: "public-dimensions-test"
  });
  assert.deepEqual(variants.names, {
    full: "public-dimensions-test.webp",
    med: "public-dimensions-test.med.webp",
    thumb: "public-dimensions-test.thumb.webp"
  });
  assert.deepEqual(
    await Promise.all(Object.values(variants.paths).map(async (filePath) => {
      const metadata = await sharp(filePath).metadata();
      return { format: metadata.format, width: metadata.width, height: metadata.height };
    })),
    [
      { format: "webp", width: 1_200, height: 750 },
      { format: "webp", width: 600, height: 375 },
      { format: "webp", width: 300, height: 300 }
    ]
  );
  await fs.promises.unlink(sourcePath);
});

test("does not delete the source when public image processing fails", async () => {
  const sourcePath = path.join(publicDirectory, "source.svg");
  const source = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  await fs.promises.writeFile(sourcePath, source);
  await assert.rejects(processPublicImageVariants({
    sourcePath,
    destination: publicDirectory,
    baseName: "public-failed-source"
  }));
  assert.deepEqual(await fs.promises.readFile(sourcePath), source);
  assert.equal((await fs.promises.readdir(publicDirectory)).some((name) => name.startsWith("public-failed-source")), false);
});

test("removes partial variants after a processing failure and preserves its source", async () => {
  const sourcePath = path.join(stagingDirectory, "partial-variants-source.jpg");
  const source = await createImage();
  await fs.promises.writeFile(sourcePath, source);
  await assert.rejects(
    processPublicImageVariants({
      sourcePath,
      destination: publicDirectory,
      baseName: "public-partial-failure",
      watermarkForVariant: async ({ variant }) => {
        if (variant === "med") throw new Error("simulated variant failure");
        return null;
      }
    }),
    /simulated variant failure/
  );
  assert.deepEqual(await fs.promises.readFile(sourcePath), source);
  assert.equal(
    (await fs.promises.readdir(publicDirectory)).some((name) => name.startsWith("public-partial-failure")),
    false
  );
  await fs.promises.unlink(sourcePath);
});

test("does not convert animated GIFs or lose their frames", async () => {
  const sourcePath = path.join(publicDirectory, "animated.gif");
  const source = createAnimatedGif();
  await fs.promises.writeFile(sourcePath, source);
  assert.equal((await sharp(sourcePath, { animated: true }).metadata()).pages, 2);
  await assert.rejects(processPublicImageVariants({
    sourcePath,
    destination: publicDirectory,
    baseName: "public-animated-test"
  }));
  assert.deepEqual(await fs.promises.readFile(sourcePath), source);
  assert.equal((await fs.promises.readdir(publicDirectory)).some((name) => name.startsWith("public-animated-test")), false);
});

test("category SVG and GIF formats remain outside the raster conversion path", () => {
  assert.equal(identifyImageFormat(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), "svg");
  assert.equal(identifyImageFormat(createAnimatedGif()), "gif");
  assert.equal(shouldConvertCategoryRasterImage("category.jpg", { format: "jpeg", pages: 1 }), true);
  assert.equal(shouldConvertCategoryRasterImage("category.svg", { format: "svg", pages: 1 }), false);
  assert.equal(shouldConvertCategoryRasterImage("category.gif", { format: "gif", pages: 2 }), false);
});

test("private message uploads remain outside the public image variant pipeline", () => {
  assert.equal(uploadImages.producesPublicVariants, true);
  assert.equal(uploadMessageImages.producesPublicVariants, false);
});

test("private-file authorization remains ahead of public static file serving", async () => {
  const indexSource = await fs.promises.readFile(
    new URL("../src/index.js", import.meta.url),
    "utf8"
  );
  const filesSource = await fs.promises.readFile(
    new URL("../src/routes/files.js", import.meta.url),
    "utf8"
  );
  assert.ok(indexSource.indexOf('app.use("/uploads", filesRoutes)') < indexSource.indexOf('app.use("/uploads", publicUploads, express.static'));
  assert.match(filesSource, /optionalAuthFileAccess/);
  assert.match(filesSource, /if \(!isAuthorized\)/);
  assert.match(filesSource, /private, no-store/);
});

test("does not serve rejected HTML or script extensions from the public uploads path", async () => {
  const htmlResponse = await upload("blocked.html", Buffer.from("<script>unsafe</script>"));
  assert.equal(htmlResponse.status, 400);

  const simulatedStoredHtml = path.join(publicDirectory, "blocked.html");
  await fs.promises.writeFile(simulatedStoredHtml, "<script>unsafe</script>");
  const publicResponse = await fetch(`${baseUrl}/uploads/blocked.html`);
  assert.equal(publicResponse.status, 404);
  await fs.promises.unlink(simulatedStoredHtml);

  const scriptResponse = await fetch(`${baseUrl}/uploads/blocked.js`);
  assert.equal(scriptResponse.status, 404);
});

test("sandbox headers protect the legacy public SVG image path", async () => {
  const svgPath = path.join(publicDirectory, "category.svg");
  await fs.promises.writeFile(svgPath, '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  try {
    const response = await fetch(`${baseUrl}/uploads/category.svg`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(
      response.headers.get("content-security-policy"),
      "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox"
    );
  } finally {
    await fs.promises.unlink(svgPath);
  }
});
