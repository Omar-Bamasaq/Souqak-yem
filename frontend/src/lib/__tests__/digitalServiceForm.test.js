import assert from "node:assert/strict";
import test from "node:test";
import {
  getVisibleDigitalServiceAnswers,
  hasRequiredDigitalServiceAnswers
} from "../digitalServiceForm.js";

test("visibility follows earlier answers and removes answers for hidden fields", () => {
  const schema = [
    { id: "plan", type: "SELECT", sortOrder: 0, defaultValue: "basic" },
    { id: "account", type: "TEXT", sortOrder: 1, when: { fieldId: "plan", operator: "EQUALS", value: "premium" } },
    { id: "playerId", type: "TEXT", sortOrder: 2, when: { fieldId: "plan", operator: "EQUALS", value: "basic" } }
  ];

  assert.deepEqual(
    getVisibleDigitalServiceAnswers(schema, { account: "user@example.com", playerId: "123", extra: "ignored" }),
    { playerId: "123" }
  );
  assert.deepEqual(
    getVisibleDigitalServiceAnswers(schema, { plan: "premium", account: "user@example.com", playerId: "stale" }),
    { plan: "premium", account: "user@example.com" }
  );
});

test("required checks respect defaults, conditional fields, and multi-select values", () => {
  const schema = [
    { id: "plan", type: "SELECT", sortOrder: 0, required: true, defaultValue: "basic" },
    { id: "details", type: "TEXT", sortOrder: 1, required: true, when: { fieldId: "plan", operator: "EQUALS", value: "premium" } },
    { id: "features", type: "MULTI_SELECT", sortOrder: 2, required: true }
  ];

  assert.equal(hasRequiredDigitalServiceAnswers(schema, { features: ["a"] }), true);
  assert.equal(hasRequiredDigitalServiceAnswers(schema, { plan: "premium", features: ["a"] }), false);
  assert.equal(hasRequiredDigitalServiceAnswers(schema, { plan: "premium", details: "account", features: ["a"] }), true);
  assert.equal(hasRequiredDigitalServiceAnswers(schema, { features: [] }), false);
});
