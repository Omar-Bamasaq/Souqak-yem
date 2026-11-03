import test from "node:test";
import assert from "node:assert/strict";

const previousAccessSecret = process.env.JWT_ACCESS_SECRET;
const previousRefreshSecret = process.env.JWT_REFRESH_SECRET;
process.env.JWT_ACCESS_SECRET = "isolated-test-access-secret";
process.env.JWT_REFRESH_SECRET = "isolated-test-refresh-secret";
const { getVisitorRateLimitKey } = await import("../src/routes/adminAnalytics.js");
if (previousAccessSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
else process.env.JWT_ACCESS_SECRET = previousAccessSecret;
if (previousRefreshSecret === undefined) delete process.env.JWT_REFRESH_SECRET;
else process.env.JWT_REFRESH_SECRET = previousRefreshSecret;

test("visitor rate limit key retains the authenticated user key", () => {
  assert.equal(
    getVisitorRateLimitKey({
      user: { id: "user-123" },
      ip: "192.0.2.1",
      cookies: { souqak_visitor_id: "visitor-abc" }
    }),
    "uid:user-123"
  );
});

test("visitor rate limit key retains the visitor cookie and normalizes IPv4", () => {
  assert.equal(
    getVisitorRateLimitKey({
      ip: "192.0.2.1",
      cookies: { souqak_visitor_id: "visitor-abc" }
    }),
    "ip:192.0.2.1:visitor-abc"
  );
});

test("visitor rate limit key handles a missing IP without normalizing a placeholder", () => {
  assert.equal(
    getVisitorRateLimitKey({
      cookies: { souqak_visitor_id: "visitor-abc" }
    }),
    "ip:unknown:visitor-abc"
  );
});

test("visitor rate limit key groups IPv6 addresses within the same subnet", () => {
  const firstKey = getVisitorRateLimitKey({
    ip: "2001:db8:abcd:1200::1",
    cookies: { souqak_visitor_id: "visitor-abc" }
  });
  const secondKey = getVisitorRateLimitKey({
    ip: "2001:db8:abcd:12ff::2",
    cookies: { souqak_visitor_id: "visitor-abc" }
  });

  assert.equal(firstKey, "ip:2001:db8:abcd:1200::/56:visitor-abc");
  assert.equal(secondKey, firstKey);
});
