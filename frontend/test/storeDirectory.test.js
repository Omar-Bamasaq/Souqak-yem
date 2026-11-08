import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve(process.cwd(), "src/pages/StoreDirectory.jsx"), "utf8");

test("store directory exposes activity, governorate, and dependent city filters for both tabs", () => {
  assert.match(source, /name|تصفية/);
  assert.match(source, /activityKey/);
  assert.match(source, /governorateId/);
  assert.match(source, /cityId/);
  assert.match(source, /view === "discounts"/);
  assert.match(source, /disabled={!governorateId}/);
});

test("store directory sends selected filters to initial and paginated requests", () => {
  assert.match(source, /params:\s*\{\s*\.\.\.directoryParams,\s*page:\s*1/);
  assert.match(source, /params:\s*\{\s*\.\.\.directoryParams,\s*page:\s*nextPage/);
  assert.match(source, /setSearchParams\(\(current\)/);
});
