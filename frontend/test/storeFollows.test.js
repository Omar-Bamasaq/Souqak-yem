import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const storefrontSource = fs.readFileSync(path.join(root, "src", "pages", "Storefront.jsx"), "utf8");
const myStoreSource = fs.readFileSync(path.join(root, "src", "pages", "MyStore.jsx"), "utf8");

test("store and family-production pages show follower counts and allow following", () => {
  assert.match(storefrontSource, /\/follows\/store\/\$\{storeId\}\/count/);
  assert.match(storefrontSource, /\/follows\/store\/\$\{storeId\}\/status/);
  assert.match(storefrontSource, /\/follows\/store\/\$\{store\._id\}/);
  assert.match(storefrontSource, /متابعة الأسرة المنتجة/);
  assert.match(storefrontSource, /متابعة المتجر/);
  assert.match(storefrontSource, /متابع/);
});

test("store analytics includes the current follower count", () => {
  assert.match(myStoreSource, /\["المتابعون", analytics\.followers\]/);
});
