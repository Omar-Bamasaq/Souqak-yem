import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getAdCreationError, getAdImageAspectRatioFailure } from "../src/utils/adCreationError.js";

const frontendRoot = path.resolve(process.cwd());

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
  const tallImageError = {
    response: {
      status: 422,
      data: {
        error: "generic server text",
        code: "AD_IMAGE_TOO_TALL",
        imageIndex: 2
      }
    }
  };
  assert.deepEqual(getAdImageAspectRatioFailure(tallImageError), {
    imageIndex: 2,
    message: "الصورة رقم 2 طويلة جدًا. يرجى قصها أو حذفها ثم إعادة المحاولة."
  });
  assert.equal(getAdCreationError(tallImageError), "الصورة رقم 2 طويلة جدًا. يرجى قصها أو حذفها ثم إعادة المحاولة.");
  assert.equal(getAdImageAspectRatioFailure({
    response: { status: 422, data: { code: "IMAGE_PROCESSING_FAILED", imageIndex: 2 } }
  }), null);
  assert.equal(getAdImageAspectRatioFailure({
    response: { status: 422, data: { code: "AD_IMAGE_TOO_TALL", imageIndex: 0 } }
  }), null);
  assert.match(getAdCreationError({ response: { status: 429, data: { error: "انتظر قليلاً." } } }), /انتظر قليلاً/);
  assert.match(getAdCreationError({ response: { status: 503 } }), /خطأ مؤقت/);
  assert.match(getAdCreationError({ code: "ECONNABORTED" }), /تحقق من إعلاناتك/);
  assert.match(getAdCreationError({ code: "ERR_NETWORK" }), /قد يكون الإعلان حُفظ/);
  assert.match(getAdCreationError({ response: { status: 400, data: { error: "لقد قمت بنشر إعلان مشابه مؤخراً." } } }), /أُضيف بالفعل/);
});

test("ad creation and edit previews can highlight the server-reported new image index", () => {
  const addProduct = fs.readFileSync(path.join(frontendRoot, "src", "pages", "AddProduct.jsx"), "utf8");
  const editAd = fs.readFileSync(path.join(frontendRoot, "src", "pages", "EditAd.jsx"), "utf8");
  const managedAd = fs.readFileSync(path.join(frontendRoot, "src", "pages", "AdminManagedSellerAd.jsx"), "utf8");

  assert.match(addProduct, /imageErrorIndex === i \+ 1/);
  assert.match(editAd, /imageErrorIndex === i \+ 1/);
  assert.match(managedAd, /imageErrorIndex === index \+ 1/);
});

test("phone-verification failures remain distinct from long-image errors", () => {
  const phoneVerificationError = {
    response: {
      status: 403,
      data: { code: "PHONE_VERIFICATION_REQUIRED" }
    }
  };
  const addProduct = fs.readFileSync(path.join(frontendRoot, "src", "pages", "AddProduct.jsx"), "utf8");

  assert.equal(getAdImageAspectRatioFailure(phoneVerificationError), null);
  assert.equal(getAdCreationError(phoneVerificationError), null);
  assert.match(addProduct, /status === 403 && data\?\.code === "PHONE_VERIFICATION_REQUIRED"/);
  assert.match(addProduct, /setPhoneVerificationRequired\(true\)/);
});
