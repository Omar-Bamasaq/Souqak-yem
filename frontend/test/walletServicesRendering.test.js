import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const frontendRoot = fs.existsSync(path.join(process.cwd(), "src"))
  ? process.cwd()
  : path.join(process.cwd(), "frontend");
const source = fs.readFileSync(
  path.join(frontendRoot, "src", "pages", "WalletServices.jsx"),
  "utf8"
);

test("wallet services imports the shared uploads URL helper for every image URL", () => {
  assert.match(source, /import\s*\{\s*uploadsUrl\s*\}\s*from\s*["']\.\.\/lib\/uploads\.js["']/);
  const calls = source.match(/uploadsUrl\(/g) || [];
  assert.equal(calls.length, 3);
  assert.doesNotMatch(source, /\b(?:const|let|function)\s+uploadsUrl\b/);
});

test("catalog categories and services render fallbacks when imported images are empty", () => {
  assert.match(source, /category\.image\s*\?/);
  assert.match(source, /category\.image\s*\?[\s\S]{0,500}▦<\/div>/);
  assert.match(source, /selectedCatalogCategory\.image\s*\?/);
  assert.match(source, /selectedCatalogCategory\.image\s*\?[\s\S]{0,500}📦<\/span>/);
  assert.match(source, /service\.image\s*\?/);
  assert.match(source, /service\.image\s*\?[\s\S]{0,500}💳<\/span>/);
});

test("missing catalog images do not remove package or service section rendering", () => {
  assert.match(source, /selectedService\.pricingType === "PACKAGE"/);
  assert.match(source, /\(selectedService\.packages \|\| \[\]\)/);
  assert.match(source, /selectedService\.pricingType === "UNIT" && selectedService\.sections\?\.length > 0/);
});

test("existing drafts offer resume or a new order without blocking other services", () => {
  assert.match(source, /لديك مسودة سابقة لهذه الخدمة/);
  assert.match(source, /استئناف المسودة/);
  assert.match(source, /بدء طلب جديد/);
  assert.doesNotMatch(source, /لديك مسودة غير مكتملة لخدمة أخرى/);
  assert.match(source, /findWalletServiceDrafts\(response\.data,\s*service\._id\)/);
  assert.match(source, /setDraftPrompt\(\{\s*draft:\s*matchingDraft,\s*service\s*\}\)/);
  assert.match(source, /if \(matchingDraft\)\s*\{\s*setDraftPrompt/);
  assert.match(source, /getWalletServiceIdempotencyKey\("catalog"/);
  assert.match(source, /<IncompleteActions userId=\{userId\} \/>/);
});

test("catalog step handlers are in component scope and navigation preserves entered values", () => {
  const advanceHandlerStart = source.indexOf("const advanceOrderStep = () => {");
  const previousHandlerStart = source.indexOf("const goToPreviousOrderStep = () => {");
  const submitHandlerStart = source.indexOf("const submitCatalogOrder = async (event) => {");

  assert.ok(advanceHandlerStart >= 0 && advanceHandlerStart < submitHandlerStart);
  assert.ok(previousHandlerStart > advanceHandlerStart && previousHandlerStart < submitHandlerStart);
  assert.match(source, /onClick=\{advanceOrderStep\}/);
  assert.match(source, /onClick=\{goToPreviousOrderStep\}/);

  const advanceHandler = source.slice(advanceHandlerStart, previousHandlerStart);
  const previousHandler = source.slice(previousHandlerStart, submitHandlerStart);
  assert.match(advanceHandler, /canAdvanceWalletServiceOrderStep\(activeOrderStep/);
  assert.match(advanceHandler, /orderFormRef\.current\?\.reportValidity\(\)/);
  assert.match(advanceHandler, /setOrderStepIndex\(\(current\) => Math\.min\(current \+ 1/);
  assert.match(previousHandler, /setOrderStepIndex\(\(current\) => Math\.max\(current - 1/);

  const stateSetters = [...`${advanceHandler}${previousHandler}`.matchAll(/\b(set[A-Z]\w*)\s*\(/g)]
    .map(([, setter]) => setter);
  assert.deepEqual(stateSetters, ["setError", "setOrderStepIndex", "setError", "setOrderStepIndex"]);
});

test("completed order total appears only beside the root category heading", () => {
  const headerStart = source.indexOf('<header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">');
  const headerEnd = source.indexOf("</header>", headerStart);
  const header = source.slice(headerStart, headerEnd);
  const counterStart = source.indexOf('role="group" aria-label="إجمالي الطلبات المكتملة"');

  assert.ok(headerStart >= 0);
  assert.ok(headerEnd > headerStart);
  assert.ok(counterStart >= headerStart && counterStart < headerEnd);
  assert.match(header, /\{showCategoryGrid &&/);
  assert.match(header, /completedOrderCount !== null/);
  assert.match(header, /إجمالي الطلبات المكتملة/);
  assert.match(header, /عبر منصة سوقك/);
  assert.match(source, /const showCategoryGrid = !categorySlug && !categoryFilter;/);
  assert.match(source, /\{!isMyOrdersPage && <div className="space-y-6">\s*\{!isOrderPage && \(/);
  assert.equal((source.match(/role="group" aria-label="إجمالي الطلبات المكتملة"/g) || []).length, 1);
  assert.equal((source.match(/api\.get\("\/wallet-services\/completed-count"\)/g) || []).length, 1);
});
