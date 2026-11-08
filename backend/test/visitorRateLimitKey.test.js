import test from "node:test";
import assert from "node:assert/strict";
import { ipKeyGenerator } from "express-rate-limit";
import { getVisitorRateLimitKey } from "../src/lib/visitorRateLimitKey.js";

test("visitor rate-limit key normalizes IPv4 and retains the visitor cookie", () => {
  const req = {
    ip: "192.0.2.15",
    cookies: { souqak_visitor_id: "visitor-1" }
  };
  assert.equal(
    getVisitorRateLimitKey(req),
    `ip:${ipKeyGenerator(req.ip)}:visitor-1`
  );
});

test("visitor rate-limit key normalizes IPv6", () => {
  const req = {
    ip: "2001:db8::1",
    cookies: { souqak_visitor_id: "visitor-2" }
  };
  assert.equal(
    getVisitorRateLimitKey(req),
    `ip:${ipKeyGenerator(req.ip)}:visitor-2`
  );
});

test("visitor rate-limit key does not pass a missing IP to ipKeyGenerator", () => {
  assert.equal(
    getVisitorRateLimitKey({ cookies: { souqak_visitor_id: "visitor-3" } }),
    "ip:unknown:visitor-3"
  );
  assert.equal(
    getVisitorRateLimitKey({}),
    "ip:unknown:guest-no-cookie"
  );
});

test("visitor rate-limit key preserves the authenticated user key", () => {
  assert.equal(
    getVisitorRateLimitKey({ user: { id: "user-1" }, ip: "2001:db8::1" }),
    "uid:user-1"
  );
});
