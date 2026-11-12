import test from "node:test";
import assert from "node:assert/strict";
import logger from "../src/lib/logger.js";
import { validateProcessedImages } from "../src/middleware/processImages.js";

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
