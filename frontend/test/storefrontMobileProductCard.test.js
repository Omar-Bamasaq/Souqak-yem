import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const renderer = fs.readFileSync(path.join(root, "src", "components", "StoreTemplateRenderer.jsx"), "utf8");
const card = fs.readFileSync(path.join(root, "src", "components", "ProductCard.jsx"), "utf8");

test("StoreTemplateRenderer opts catalog and featured store products into the mobile-only card", () => {
  const productCardCalls = [...renderer.matchAll(/<ProductCard\b[^>]*\/>/g)].map(([call]) => call);

  assert.equal(productCardCalls.length, 2);
  assert.ok(productCardCalls.every((call) => call.includes("storefrontMobileCompact")));
  assert.match(renderer, /config\.gridClassName\.replace\(\s*\/\^grid-cols-\\S\+\//);
  assert.match(renderer, /grid-cols-\[repeat\(auto-fit,minmax\(min\(100%,9rem\),1fr\)\)\]/);
  assert.match(renderer, /sm:gap-4 \$\{storefrontMobileGridClassName\}/);
});

test("compact store cards keep their image unobstructed and omit attributes", () => {
  const compactCardMarkup = card.match(/\{storefrontMobileCompact && \([\s\S]*?\n      \)\}/)?.[0];

  assert.ok(compactCardMarkup);
  assert.match(card, /storefrontMobileCompact = false/);
  assert.match(card, /storefrontMobileCompact \? "object-contain sm:object-cover" : "object-cover"/);
  assert.match(card, /const compactCurrencySymbol = getCurrencySymbol\(product\.currency\)\.replace\(/);
  assert.match(card, /compactCurrentPrice\.toLocaleString\("ar-YE"\)[\s\S]*?\{compactCurrencySymbol\}/);
  assert.match(card, /hidden sm:flex/);
  assert.doesNotMatch(compactCardMarkup, /storeAttributeSummary/);
  assert.match(card, /line-clamp-2 min-h-9 break-words/);
  assert.match(card, /compactDiscountPercent !== null/);
  assert.match(card, /خصم \{compactDiscountPercent\}٪/);
});

test("compact store badges use known inventory and the product delivery flag", () => {
  assert.match(card, /product\.stockQuantity !== null[\s\S]*?product\.stockQuantity !== undefined[\s\S]*?Number\.isFinite\(Number\(product\.stockQuantity\)\)/);
  assert.match(card, /usesStoreInventory && knownStockQuantity !== null/);
  assert.match(card, /const compactIsOutOfStock = usesStoreInventory && knownStockQuantity === 0/);
  assert.match(card, /disabled=\{product\.isAvailable === false \|\| compactIsOutOfStock\}/);
  assert.match(card, /typeof product\.isAvailableForDelivery === "boolean"/);
});

test("general and horizontal ProductCard modes remain opt-out by default", () => {
  assert.match(card, /const isHorizontal = displayMode === "list" && !presentationVariant/);
  assert.match(card, /storefrontMobileCompact = false/);
  assert.match(card, /storefrontMobileCompact \? "hidden sm:flex" : ""/);
});
