import test from "node:test";
import assert from "node:assert/strict";
import { buildAdShareUrl } from "../src/utils/adShareUrl.js";

test("shared ad URLs use the short ID route without an encoded title slug", () => {
  assert.equal(
    buildAdShareUrl("https://souqak-yem.com/", "64d3d93a1a2b3c4d5e6f7788"),
    "https://souqak-yem.com/ad/64d3d93a1a2b3c4d5e6f7788"
  );
});
