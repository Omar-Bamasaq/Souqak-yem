import test from "node:test";
import assert from "node:assert/strict";
import { getRetryAfterMs } from "../src/api/retryAfter.js";
import { getNotificationRequest } from "../src/api/notificationRequests.js";

test("Retry-After seconds and response-body fallback are converted to milliseconds", () => {
  assert.equal(getRetryAfterMs({ response: { headers: { "retry-after": "12" } } }), 12_000);
  assert.equal(getRetryAfterMs({ response: { data: { retryAfter: 30 } } }), 30_000);
});

test("simultaneous notification GETs share one request", async () => {
  let resolveRequest;
  let calls = 0;
  const api = {
    get() {
      calls += 1;
      return new Promise((resolve) => {
        resolveRequest = resolve;
      });
    }
  };

  const first = getNotificationRequest(api, "/notifications/unread-count", "user-1");
  const second = getNotificationRequest(api, "/notifications/unread-count", "user-1");
  assert.equal(calls, 1);
  resolveRequest({ data: { count: 4 } });
  assert.deepEqual(await first, await second);

  const nextRequest = getNotificationRequest(api, "/notifications/unread-count", "user-1");
  assert.equal(calls, 2);
  resolveRequest({ data: { count: 5 } });
  await nextRequest;
});
