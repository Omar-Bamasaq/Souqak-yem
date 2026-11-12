import test from "node:test";
import assert from "node:assert/strict";
import { ipKeyGenerator } from "express-rate-limit";
import { getVisitorRateLimitKey } from "../src/lib/visitorRateLimitKey.js";

test("visitor rate-limit key normalizes IPv4", () => {
  const req = { ip: "192.0.2.15" };
  assert.equal(getVisitorRateLimitKey(req), `ip:${ipKeyGenerator(req.ip)}`);
});

test("visitor rate-limit key normalizes IPv6", () => {
  const req = { ip: "2001:db8::1" };
  assert.equal(getVisitorRateLimitKey(req), `ip:${ipKeyGenerator(req.ip)}`);
});

test("visitor rate-limit key groups IPv6 addresses in the same /56 subnet", () => {
  const first = getVisitorRateLimitKey({ ip: "2001:db8:abcd:1200::1" });
  const second = getVisitorRateLimitKey({ ip: "2001:db8:abcd:12ff::2" });
  assert.equal(first, second);
});

test("changing visitor cookies cannot bypass the rate-limit key", () => {
  const first = getVisitorRateLimitKey({
    ip: "192.0.2.15",
    cookies: { souqak_visitor_id: "visitor-1" }
  });
  const second = getVisitorRateLimitKey({
    ip: "192.0.2.15",
    cookies: { souqak_visitor_id: "visitor-2" }
  });
  assert.equal(first, second);
  assert.equal(first, "ip:192.0.2.15");
});

test("visitor rate-limit key handles a missing IP", () => {
  assert.equal(getVisitorRateLimitKey({}), "ip:unknown");
});

test("visitor rate-limit key preserves authenticated user identity", () => {
  assert.equal(
    getVisitorRateLimitKey({ user: { id: "user-1" }, ip: "2001:db8::1" }),
    "uid:user-1"
  );
});
