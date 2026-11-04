import test, { after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import cors from "cors";
import { corsOptions, isAllowedCorsOrigin, socketAllowRequest } from "../src/config/cors.js";

const jwtSecretNames = [
  "JWT_ACCESS_SECRET",
  "ACCESS_TOKEN_SECRET",
  "JWT_SECRET",
  "ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "REFRESH_TOKEN_SECRET",
  "REFRESH_SECRET"
];
const originalJwtSecrets = new Map(
  jwtSecretNames.map((name) => [name, process.env[name]])
);

for (const name of jwtSecretNames) process.env[name] = "";
process.env.JWT_ACCESS_SECRET = "test-access-secret-not-for-production";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-not-for-production";

const jwtConfig = await import("../src/config/jwt.js");

after(() => {
  for (const [name, value] of originalJwtSecrets) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

function invokeCors(origin, { method = "GET", requestedHeaders } = {}) {
  const headers = new Map();
  let responseEnded = false;
  let nextError;
  const middleware = cors(corsOptions);

  middleware(
    {
      headers: {
        ...(origin ? { origin } : {}),
        ...(requestedHeaders ? { "access-control-request-headers": requestedHeaders } : {})
      },
      method
    },
    {
      getHeader(name) {
        return headers.get(name.toLowerCase());
      },
      setHeader(name, value) {
        headers.set(name.toLowerCase(), value);
      },
      end() {
        responseEnded = true;
      }
    },
    (error) => {
      nextError = error;
    }
  );

  return { headers, nextError, responseEnded };
}

function withNodeEnv(value, callback) {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = value;
  try {
    return callback();
  } finally {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  }
}

test("JWT secrets use configured variables and reject missing values", () => {
  assert.equal(
    jwtConfig.getAccessTokenSecret(),
    "test-access-secret-not-for-production"
  );
  assert.equal(
    jwtConfig.getRefreshTokenSecret(),
    "test-refresh-secret-not-for-production"
  );

  for (const name of jwtSecretNames) process.env[name] = "";
  assert.throws(jwtConfig.getAccessTokenSecret, /access token secret is required/i);
  assert.throws(jwtConfig.getRefreshTokenSecret, /refresh token secret is required/i);
});

test("JWT config import fails when access or refresh secrets are absent", () => {
  const env = { ...process.env };
  for (const name of jwtSecretNames) env[name] = "";
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", "await import('./src/config/jwt.js')"],
    { cwd: process.cwd(), env, encoding: "utf8" }
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /JWT access token secret is required/i);
  assert.doesNotMatch(result.stdout + result.stderr, /access_dev_secret|refresh_dev_secret/);
});

test("CORS permits production origins and localhost only outside production", () => {
  withNodeEnv("development", () => {
    for (const origin of [
      "https://souqak-yem.com",
      "https://www.souqak-yem.com",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:9000"
    ]) {
      const result = invokeCors(origin);
      assert.equal(result.nextError, undefined, origin);
      assert.equal(result.headers.get("access-control-allow-origin"), origin);
      assert.equal(result.headers.get("access-control-allow-credentials"), "true");
    }
  });
});

test("CORS rejects preview and localhost origins in production", () => {
  withNodeEnv("production", () => {
    for (const origin of [
      "https://souqak-beta.vercel.app",
      "https://preview-123.vercel.app",
      "http://localhost:5173"
    ]) {
      const result = invokeCors(origin);
      assert.match(result.nextError?.message || "", /Origin not allowed by CORS/);
      assert.equal(result.headers.has("access-control-allow-origin"), false);
    }
  });
});

test("CORS rejects untrusted origins without credential or allow-origin headers", () => {
  for (const origin of [
    "https://attacker.example",
    "https://vercel.app.attacker.example",
    "https://preview-123.vercel.app",
    "https://localhost.attacker.example"
  ]) {
    const result = invokeCors(origin);
    assert.match(result.nextError?.message || "", /Origin not allowed by CORS/);
    assert.equal(result.headers.has("access-control-allow-origin"), false);
    assert.equal(result.headers.has("access-control-allow-credentials"), false);
  }
});

test("CORS permits requests without an Origin header without an allow-origin header", () => {
  const result = invokeCors(undefined);

  assert.equal(result.nextError, undefined);
  assert.equal(result.headers.has("access-control-allow-origin"), false);
  assert.equal(result.headers.has("access-control-allow-credentials"), true);
});

test("CORS preflight permits the wallet-service idempotency header", () => {
  const result = invokeCors("http://localhost:5173", {
    method: "OPTIONS",
    requestedHeaders: "content-type,idempotency-key"
  });

  test("Socket origin policy rejects absent and untrusted origins", () => {
    withNodeEnv("production", () => {
      for (const origin of [undefined, "http://localhost:5173", "https://attacker.example"]) {
        let decision;
        socketAllowRequest({ headers: origin ? { origin } : {} }, (_error, allowed) => {
          decision = allowed;
        });
        assert.equal(decision, false);
      }
    });
  });

  test("Socket origin policy permits trusted production origin and development localhost", () => {
    withNodeEnv("production", () => {
      assert.equal(isAllowedCorsOrigin("https://souqak-yem.com"), true);
      let decision;
      socketAllowRequest({ headers: { origin: "https://souqak-yem.com" } }, (_error, allowed) => {
        decision = allowed;
      });
      assert.equal(decision, true);
    });
    withNodeEnv("development", () => {
      assert.equal(isAllowedCorsOrigin("http://localhost:5173"), true);
    });
  });

  assert.equal(result.nextError, undefined);
  assert.equal(result.responseEnded, true);
  assert.equal(result.headers.get("access-control-allow-origin"), "http://localhost:5173");
  assert.match(result.headers.get("access-control-allow-methods") || "", /\bPOST\b/);
  assert.match(result.headers.get("access-control-allow-headers") || "", /\bIdempotency-Key\b/i);
});
