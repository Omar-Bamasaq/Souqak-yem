import test from "node:test";
import assert from "node:assert/strict";
import { retryAfterCsrfFailure } from "../src/api/csrf.js";

test("CSRF failures refresh the token and retry a request only once", async () => {
  const config = {
    method: "post",
    url: "/stores/store-id/analytics/views",
    headers: { "X-CSRF-Token": "stale-token" }
  };
  let tokenReads = 0;
  let requestAttempts = 0;
  const response = await retryAfterCsrfFailure({
    config,
    response: { status: 403, data: { code: "CSRF_TOKEN_INVALID" } }
  }, async (retryConfig) => {
    requestAttempts += 1;
    assert.equal(retryConfig.headers["X-CSRF-Token"], "fresh-token");
    return { status: 200 };
  }, async () => {
    tokenReads += 1;
    return "fresh-token";
  });

  assert.deepEqual(response, { status: 200 });
  assert.equal(config._csrfRetry, true);
  assert.equal(tokenReads, 1);
  assert.equal(requestAttempts, 1);
  assert.equal(await retryAfterCsrfFailure({
    config,
    response: { status: 403, data: { code: "CSRF_TOKEN_INVALID" } }
  }, async () => {
    requestAttempts += 1;
  }, async () => {
    tokenReads += 1;
    return "another-token";
  }), null);
  assert.equal(tokenReads, 1);
  assert.equal(requestAttempts, 1);
});
