import test, { after } from "node:test";
import assert from "node:assert/strict";
import { isAllowedCorsOrigin } from "../src/config/cors.js";

const originalNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = "test";

after(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

test("CORS policy accepts only configured production and localhost origins", () => {
  for (const origin of [
    "https://souqak-yem.com",
    "https://www.souqak-yem.com",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:9000"
  ]) {
    assert.equal(isAllowedCorsOrigin(origin), true, origin);
  }
});

test("CORS rejects localhost origins in production", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    assert.equal(isAllowedCorsOrigin("http://localhost:5173"), false);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
  }
});

test("CORS policy rejects untrusted or deceptive origins", () => {
  for (const origin of [
    "https://attacker.example",
    "https://souqak-beta.vercel.app",
    "https://preview-123.vercel.app",
    "https://vercel.app.attacker.example",
    "https://localhost.attacker.example",
    "http://localhost.evil.example",
    "https://souqak-yem.com.attacker.example"
  ]) {
    assert.equal(isAllowedCorsOrigin(origin), false, origin);
  }
});
