import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const startupSource = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

test("backend startup does not synchronize, drop, or create indexes", () => {
  assert.doesNotMatch(startupSource, /\.(?:syncIndexes|dropIndexes?|createIndexes?)\s*\(/);
});
