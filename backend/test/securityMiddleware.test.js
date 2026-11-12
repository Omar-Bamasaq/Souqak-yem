import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import cookieParser from "cookie-parser";
import { once } from "node:events";
import { randomUUID } from "node:crypto";

process.env.NODE_ENV = "production";
const [{ csrfProtection, botDetection }, { default: rateLimit }] = await Promise.all([
  import("../src/middleware/security.js"),
  import("../src/middleware/rateLimit.js")
]);

let server;
let baseUrl;

before(async () => {
  const app = express();
  app.use(cookieParser());
  app.use(csrfProtection);
  app.get("/csrf-token", (req, res) => res.json({ csrfToken: req.csrfToken }));
  app.post("/mutate", (_req, res) => res.sendStatus(204));
  app.get("/limited", rateLimit({ windowMs: 60_000, max: 2 }));
  app.get("/limited", (_req, res) => res.sendStatus(204));

  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test("CSRF middleware creates a secure cookie and validates double-submit tokens", async () => {
  const bootstrap = await fetch(`${baseUrl}/csrf-token`);
  assert.equal(bootstrap.status, 200);
  const csrfToken = (await bootstrap.json()).csrfToken;
  const cookie = bootstrap.headers.get("set-cookie")?.split(";")[0];

  assert.equal(typeof csrfToken, "string");
  assert.ok(cookie?.startsWith("csrfToken="));
  assert.match(bootstrap.headers.get("set-cookie"), /HttpOnly/i);
  assert.match(bootstrap.headers.get("set-cookie"), /Secure/i);

  const missingHeader = await fetch(`${baseUrl}/mutate`, {
    method: "POST",
    headers: { Cookie: cookie }
  });
  assert.equal(missingHeader.status, 403);

  const valid = await fetch(`${baseUrl}/mutate`, {
    method: "POST",
    headers: { Cookie: cookie, "X-CSRF-Token": csrfToken }
  });
  assert.equal(valid.status, 204);
});

test("rate limit middleware enforces configured request limits", async () => {
  assert.equal((await fetch(`${baseUrl}/limited`)).status, 204);
  assert.equal((await fetch(`${baseUrl}/limited`)).status, 204);
  const limited = await fetch(`${baseUrl}/limited`);
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("ratelimit-limit")) > 0);
  assert.equal(limited.headers.get("retry-after"), "60");
});

test("bot detection blocks repeated request bursts", () => {
  const parallelIp = `security-parallel-${randomUUID()}`;
  let parallelBlockedStatus = null;
  const parallelRes = {
    setHeader() {
      return this;
    },
    status(status) {
      parallelBlockedStatus = status;
      return this;
    },
    json() {
      return this;
    }
  };
  for (let index = 0; index < 31; index += 1) {
    botDetection({
      ip: parallelIp,
      method: "GET",
      path: `/api/home-request-${index}`,
      originalUrl: `/api/home-request-${index}`,
      headers: {}
    }, parallelRes, () => {});
  }
  assert.equal(parallelBlockedStatus, null);

  const ip = `security-test-${randomUUID()}`;
  let blockedStatus = null;
  let retryAfter = null;
  const res = {
    setHeader(name, value) {
      if (name === "Retry-After") retryAfter = value;
      return this;
    },
    status(status) {
      blockedStatus = status;
      return this;
    },
    json() {
      return this;
    }
  };
  const req = {
    ip,
    method: "GET",
    path: "/api/test",
    originalUrl: "/api/test",
    headers: {},
    user: undefined
  };
  let nextCalled = false;

  for (let index = 0; index < 31; index += 1) {
    botDetection(req, res, () => {
      nextCalled = true;
    });
  }

  assert.equal(blockedStatus, 429);
  assert.equal(retryAfter, "60");
  assert.equal(nextCalled, true);
});
