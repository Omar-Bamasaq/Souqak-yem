import test from "node:test";
import assert from "node:assert/strict";
import { getSessionRotationRetryDelay } from "../src/api/session.js";

test("refresh rotation retry delay honors server Retry-After and body hints", () => {
  assert.equal(
    getSessionRotationRetryDelay({
      response: {
        headers: { "retry-after": "1" },
        data: { retryAfterMs: 150 }
      }
    }, 0),
    1_000
  );

  assert.equal(
    getSessionRotationRetryDelay({
      response: { headers: {}, data: { retryAfterMs: 750 } }
    }, 0),
    750
  );
});

test("refresh rotation retry delay uses bounded backoff without server hints", () => {
  assert.equal(getSessionRotationRetryDelay({ response: { headers: {}, data: {} } }, 0), 250);
  assert.equal(getSessionRotationRetryDelay({ response: { headers: {}, data: {} } }, 4), 2_000);
});
