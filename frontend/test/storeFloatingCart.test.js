import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const frontendRoot = fs.existsSync(path.join(process.cwd(), "src"))
  ? process.cwd()
  : path.join(process.cwd(), "frontend");
const source = fs.readFileSync(path.join(frontendRoot, "src", "pages", "Storefront.jsx"), "utf8");

test("store cart is opened from a floating button and displays the server item count", () => {
  assert.match(source, /className="fixed bottom-20 left-5 z-\[60\].*md:bottom-5"/);
  assert.match(source, /onClick=\{\(\) => navigate\("\/cart"\)\}/);
  assert.match(source, /aria-label=\{`فتح سلة المتجر/);
  assert.match(source, /response\.data\?\.itemCount/);
  assert.match(source, /cartItemCount > 0/);
  assert.doesNotMatch(source, /className="min-h-11 rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white">سلة المتجر/);
});

test("store checkout shows bank details and converts a proof image to WebP before submission", () => {
  const cart = fs.readFileSync(
    path.join(frontendRoot, "src", "pages", "StoreCart.jsx"),
    "utf8"
  );
  const compression = fs.readFileSync(
    path.join(frontendRoot, "src", "lib", "imageCompression.js"),
    "utf8"
  );

  assert.match(cart, /بيانات التحويل البنكي/);
  assert.match(cart, /bankAccountId/);
  assert.match(cart, /paymentReceipt/);
  assert.match(cart, /convertImageToWebp\(file\)/);
  assert.match(cart, /ارفع صورة سند التحويل قبل إرسال الطلب/);
  assert.match(compression, /fileType: "image\/webp"/);
  assert.match(compression, /converted\.type !== "image\/webp"/);
});

test("store owners can inspect payment proof through the protected-file route", () => {
  const orders = fs.readFileSync(path.join(frontendRoot, "src", "pages", "StoreOrders.jsx"), "utf8");

  assert.match(orders, /selectedOrder\.storePaymentDetails/);
  assert.match(orders, /معاينة سند التحويل/);
  assert.match(orders, /useProtectedFiles\(api,\s*\[previewDoc\]\)/);
  assert.match(orders, /normalizeProtectedFilePath\(previewDoc\)/);
  assert.match(orders, /setPreviewDoc\(selectedOrder\.storePaymentDetails\.receiptImage\)/);
  assert.doesNotMatch(orders, /uploadsUrl\(selectedOrder\.storePaymentDetails\.receiptImage\)/);
  assert.match(orders, /<DocumentPreviewModal/);
  assert.doesNotMatch(orders, /target="_blank"[\s\S]{0,150}selectedOrder\.storePaymentDetails\.receiptImage/);
});
