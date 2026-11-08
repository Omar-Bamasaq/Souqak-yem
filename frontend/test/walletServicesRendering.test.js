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
