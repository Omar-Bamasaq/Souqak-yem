import test from "node:test";
import assert from "node:assert/strict";
import { readSellerSeedConfig, run } from "../seedSeller.js";

test("seller seed requires an environment password before connecting", async () => {
  let connectionAttempts = 0;

  await assert.rejects(
    run({
      env: {},
      connect: async () => { connectionAttempts += 1; }
    }),
    /SEED_SELLER_PASSWORD is required/
  );
  assert.equal(connectionAttempts, 0);
});

test("seller seed reads the password and optional fields from its environment", () => {
  const config = readSellerSeedConfig({
    SEED_SELLER_PASSWORD: "test-only-password",
    SEED_SELLER_EMAIL: "seller@example.test",
    SEED_SELLER_PHONE: "5550100",
    SEED_SELLER_NAME: "Test Seller"
  });

  assert.deepEqual(config, {
    email: "seller@example.test",
    password: "test-only-password",
    phone: "5550100",
    name: "Test Seller"
  });
});
