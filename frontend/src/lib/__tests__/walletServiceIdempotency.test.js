import assert from "node:assert/strict";
import test from "node:test";
import { clearWalletServiceIdempotencyKey, getWalletServiceIdempotencyKey } from "../walletServiceIdempotency.js";

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

test("reuses an idempotency key for the same payload and replaces it for changed input", () => {
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: createStorage() });
  const first = getWalletServiceIdempotencyKey("catalog", { serviceId: "abc", answers: { b: "2", a: "1" } });
  const retry = getWalletServiceIdempotencyKey("catalog", { answers: { a: "1", b: "2" }, serviceId: "abc" });
  const changed = getWalletServiceIdempotencyKey("catalog", { serviceId: "abc", answers: { a: "changed" } });

  assert.equal(retry, first);
  assert.notEqual(changed, first);
});

test("clears the key after a successful operation", () => {
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: createStorage() });
  const first = getWalletServiceIdempotencyKey("custom", { orderType: "custom" });
  clearWalletServiceIdempotencyKey("custom");

  assert.notEqual(getWalletServiceIdempotencyKey("custom", { orderType: "custom" }), first);
});
