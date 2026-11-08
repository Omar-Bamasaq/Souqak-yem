import test from "node:test";
import assert from "node:assert/strict";
import { isValidStoreSlug, slugifyStoreName } from "../src/utils/storeSlug.js";

test("Arabic store names get an editable English slug suggestion", () => {
  assert.equal(slugifyStoreName("متجر البامسق"), "matjar-albamasaq");
  assert.equal(slugifyStoreName("Souqak Market"), "souqak-market");
});

test("store slug validation accepts only bounded lowercase English words", () => {
  assert.equal(isValidStoreSlug("matjar-albamasaq"), true);
  for (const slug of ["ab", "-matjar", "matjar-", "matjar--store", "store.name", "https://shop.test"]) {
    assert.equal(isValidStoreSlug(slug), false, slug);
  }
});
