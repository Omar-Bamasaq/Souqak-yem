import test from "node:test";
import assert from "node:assert/strict";
import { parseMapCoordinates } from "../src/components/mapCoordinates.js";

test("map coordinates can be omitted when no exact location is needed", () => {
  assert.deepEqual(parseMapCoordinates("", ""), { valid: true, lat: null, lng: null });
});

test("map coordinates accept valid latitude and longitude", () => {
  assert.deepEqual(parseMapCoordinates("15.3694", "44.1910"), {
    valid: true,
    lat: 15.3694,
    lng: 44.191
  });
});

test("map coordinates reject values outside geographic bounds", () => {
  assert.match(parseMapCoordinates("91", "44").error, /خط العرض/);
  assert.match(parseMapCoordinates("15", "-181").error, /خط الطول/);
  assert.match(parseMapCoordinates("invalid", "44").error, /خط العرض/);
});
