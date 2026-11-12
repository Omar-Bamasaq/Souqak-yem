import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import logger from "../src/lib/logger.js";
import processImages, { validateProcessedImages } from "../src/middleware/processImages.js";
import { IMAGE_PROCESSING_LIMITS } from "../src/services/publicImagePipeline.js";

test("ad image processing failures log only safe diagnostics and preserve the generic response", () => {
  const originalWarn = logger.warn;
  let loggedEvent;
  let responseStatus;
  let responseBody;
  let nextCalled = false;
  logger.warn = (event) => {
    loggedEvent = event;
  };

  try {
    validateProcessedImages({
      method: "POST",
      baseUrl: "/api/ads",
      path: "/",
      id: "request-123",
      files: [],
      imageProcessingErrors: [{
        imageIndex: 2,
        stage: "variant_generation",
        reason: "unsupported_format",
        code: "ERR_SHARP",
        filename: "private-original.jpg",
        message: "Failed to decode C:\\private\\private-original.jpg"
      }]
    }, {
      status(status) {
        responseStatus = status;
        return this;
      },
      json(body) {
        responseBody = body;
        return this;
      }
    }, () => {
      nextCalled = true;
    });

    assert.equal(responseStatus, 422);
    assert.deepEqual(responseBody, {
      error: "تعذر تجهيز الصور. لم يتم حفظ الإعلان، يرجى إعادة رفع الصور.",
      code: "IMAGE_PROCESSING_FAILED"
    });
    assert.equal(nextCalled, false);
    assert.deepEqual(loggedEvent.imageFailures, [{
      imageIndex: 2,
      stage: "variant_generation",
      reason: "unsupported_format",
      code: "ERR_SHARP"
    }]);
    assert.doesNotMatch(JSON.stringify(loggedEvent), /private-original|C:\\\\private/);
  } finally {
    logger.warn = originalWarn;
  }
});

test("ad dimension failures log safe source metadata and upload-variant state", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "souqak-ad-image-diagnostics-"));
  const filename = "private-full.webp";
  const filePath = path.join(directory, filename);
  const originalWarn = logger.warn;
  let loggedEvent;
  let responseStatus;
  let responseBody;
  logger.warn = (event) => {
    loggedEvent = event;
  };

  try {
    await sharp({
      create: {
        width: IMAGE_PROCESSING_LIMITS.maxInputDimension + 1,
        height: 1,
        channels: 3,
        background: { r: 35, g: 110, b: 190 }
      }
    }).webp().toFile(filePath);

    const req = {
      method: "POST",
      baseUrl: "/api/ads",
      path: "/",
      id: "request-456",
      files: [{
        filename,
        path: filePath,
        destination: directory,
        imageVariants: {
          full: filename,
          med: "private-med.webp",
          thumb: "private-thumb.webp"
        }
      }]
    };
    await new Promise((resolve, reject) => {
      processImages()(req, {}, (error) => error ? reject(error) : resolve());
    });

    validateProcessedImages(req, {
      status(status) {
        responseStatus = status;
        return this;
      },
      json(body) {
        responseBody = body;
        return this;
      }
    }, () => {
      assert.fail("Validation should reject the failed image.");
    });

    assert.equal(responseStatus, 422);
    assert.equal(responseBody.code, "IMAGE_PROCESSING_FAILED");
    assert.equal(loggedEvent.requestId, "request-456");
    assert.deepEqual(loggedEvent.imageFailures[0], {
      imageIndex: 1,
      stage: "variant_generation",
      reason: "dimensions_exceeded",
      code: null,
      inputDimensions: { width: 12_001, height: 1, pages: null, orientation: null },
      metadataRead: true,
      imageVariantsPresent: true,
      pathMatchesUploadFullVariant: true,
      maxInputPixels: IMAGE_PROCESSING_LIMITS.maxInputPixels,
      maxInputDimension: IMAGE_PROCESSING_LIMITS.maxInputDimension
    });
    assert.doesNotMatch(JSON.stringify(loggedEvent), /private-full\.webp|souqak-ad-image-diagnostics-/);
  } finally {
    logger.warn = originalWarn;
    sharp.cache(false);
    await fs.rm(directory, { recursive: true, force: true });
  }
});
