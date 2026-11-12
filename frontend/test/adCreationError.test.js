import test from "node:test";
import assert from "node:assert/strict";
import { getAdCreationError } from "../src/utils/adCreationError.js";

test("ad upload errors identify limits, timeouts, server failures, and completed retries", () => {
  assert.match(getAdCreationError({ response: { status: 413 } }), /حجم الرفع تجاوز الحد المسموح/);
  assert.match(getAdCreationError({ response: { status: 408 } }), /تحقق من إعلاناتك/);
  assert.equal(
    getAdCreationError({
      response: {
        status: 422,
        data: {
          error: "تعذر تجهيز الصور. لم يتم حفظ الإعلان، يرجى إعادة رفع الصور.",
          code: "IMAGE_PROCESSING_FAILED"
        }
      }
    }),
    "تعذر تجهيز الصور. لم يتم حفظ الإعلان، يرجى إعادة رفع الصور."
  );
  assert.match(getAdCreationError({ response: { status: 429, data: { error: "انتظر قليلاً." } } }), /انتظر قليلاً/);
  assert.match(getAdCreationError({ response: { status: 503 } }), /خطأ مؤقت/);
  assert.match(getAdCreationError({ code: "ECONNABORTED" }), /تحقق من إعلاناتك/);
  assert.match(getAdCreationError({ code: "ERR_NETWORK" }), /قد يكون الإعلان حُفظ/);
  assert.match(getAdCreationError({ response: { status: 400, data: { error: "لقد قمت بنشر إعلان مشابه مؤخراً." } } }), /أُضيف بالفعل/);
});
