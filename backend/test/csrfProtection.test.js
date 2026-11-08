import test from "node:test";
import assert from "node:assert/strict";
import { csrfProtection } from "../src/middleware/security.js";

function createResponse() {
  return {
    cookieValue: null,
    cookieOptions: null,
    statusCode: null,
    body: null,
    cookie(_name, value, options) {
      this.cookieValue = value;
      this.cookieOptions = options;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

test("CSRF middleware issues a cookie and request token for safe methods", () => {
  const req = { method: "GET", cookies: {}, headers: {} };
  const res = createResponse();
  let continued = false;

  csrfProtection(req, res, () => {
    continued = true;
  });

  assert.equal(continued, true);
  assert.match(res.cookieValue, /^[a-f\d]{64}$/i);
  assert.equal(req.csrfToken, res.cookieValue);
  assert.equal(res.cookieOptions.httpOnly, true);
  assert.equal(res.cookieOptions.path, "/");
});

test("CSRF middleware accepts a matching double-submit token", () => {
  const token = "a".repeat(64);
  const req = {
    method: "POST",
    cookies: { csrfToken: token },
    headers: { "x-csrf-token": token }
  };
  const res = createResponse();
  let continued = false;

  csrfProtection(req, res, () => {
    continued = true;
  });

  assert.equal(continued, true);
  assert.equal(res.statusCode, null);
});

test("CSRF middleware rejects a missing or mismatched token", () => {
  const req = {
    method: "POST",
    cookies: { csrfToken: "a".repeat(64) },
    headers: { "x-csrf-token": "b".repeat(64) },
    ip: "127.0.0.1",
    originalUrl: "/api/test",
    path: "/api/test"
  };
  const res = createResponse();

  csrfProtection(req, res, () => {
    assert.fail("Invalid CSRF token must not continue.");
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, "CSRF_TOKEN_INVALID");
});
