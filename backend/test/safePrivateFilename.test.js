import test from "node:test";
import assert from "node:assert/strict";
import { isSafePrivateFilename } from "../src/lib/safePrivateFilename.js";

test("private-file route accepts a single filename", () => {
  assert.equal(isSafePrivateFilename("receipt-123.webp"), true);
});

test("private-file route rejects traversal and nested paths", () => {
  for (const filename of ["..", ".", "../.env", "folder/receipt.webp", "..\\..\\secret"]) {
    assert.equal(isSafePrivateFilename(filename), false, filename);
  }
});
