import test from "node:test";
import assert from "node:assert/strict";
import { normalizeImageUploadFile } from "../src/lib/imageCompression.js";

test("normalizes compressed WebP bytes with a WebP filename and MIME type", () => {
  const compressed = new File([new Uint8Array([1, 2, 3])], "photo.jpg", {
    type: "image/webp",
    lastModified: 123
  });

  const normalized = normalizeImageUploadFile(compressed, 1);

  assert.equal(normalized.name, "upload-image-2.webp");
  assert.equal(normalized.type, "image/webp");
  assert.equal(normalized.lastModified, 123);
  assert.equal(normalized.size, compressed.size);
});

test("normalizes JPEG MIME variants and falls back to a supported filename extension", () => {
  const jpegByMime = normalizeImageUploadFile(
    new File(["jpeg"], "photo.jpeg", { type: "image/jpg" })
  );
  const pngByExtension = normalizeImageUploadFile(
    new File(["png"], "photo.png", { type: "" })
  );

  assert.equal(jpegByMime.name, "upload-image-1.jpg");
  assert.equal(jpegByMime.type, "image/jpeg");
  assert.equal(pngByExtension.name, "upload-image-1.png");
  assert.equal(pngByExtension.type, "image/png");
});

test("rejects unsupported image formats before upload", () => {
  assert.throws(
    () => normalizeImageUploadFile(new File(["heic"], "photo.heic", { type: "image/heic" })),
    /نوع الصورة غير مدعوم/
  );
});
