import test from "node:test";
import assert from "node:assert/strict";
import { scanUrlWithCloudflare, UrlScanServiceError } from "../src/services/cloudflareUrlScanner.js";

const accountId = "1234567890abcdef1234567890abcdef";
const token = "private-cloudflare-test-token";
const scanId = "12345678-1234-1234-1234-123456789abc";

function withScannerEnvironment(fetchImpl, run, { configured = true } = {}) {
  const previousAccountId = process.env.CLOUDFLARE_URL_SCANNER_ACCOUNT_ID;
  const previousToken = process.env.CLOUDFLARE_URL_SCANNER_API_TOKEN;
  const previousFetch = globalThis.fetch;
  if (configured) {
    process.env.CLOUDFLARE_URL_SCANNER_ACCOUNT_ID = accountId;
    process.env.CLOUDFLARE_URL_SCANNER_API_TOKEN = token;
  } else {
    delete process.env.CLOUDFLARE_URL_SCANNER_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_URL_SCANNER_API_TOKEN;
  }
  globalThis.fetch = fetchImpl;

  return Promise.resolve()
    .then(run)
    .finally(() => {
      if (previousAccountId === undefined) delete process.env.CLOUDFLARE_URL_SCANNER_ACCOUNT_ID;
      else process.env.CLOUDFLARE_URL_SCANNER_ACCOUNT_ID = previousAccountId;
      if (previousToken === undefined) delete process.env.CLOUDFLARE_URL_SCANNER_API_TOKEN;
      else process.env.CLOUDFLARE_URL_SCANNER_API_TOKEN = previousToken;
      globalThis.fetch = previousFetch;
    });
}

function createFetch({ malicious = false, visibility = "unlisted" } = {}) {
  const calls = [];
  const fetchImpl = async (requestUrl, options) => {
    calls.push({ url: new URL(requestUrl), options });
    if (options.method === "POST") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          uuid: scanId,
          visibility,
          result: `https://radar.cloudflare.com/scan/${scanId}`,
          message: "Submission successful"
        })
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        task: { status: "Finished", success: true },
        verdicts: { overall: { malicious, categories: [{ name: "phishing" }] } }
      })
    };
  };
  return { fetchImpl, calls };
}

test("Cloudflare URL Scanner submits an unlisted scan and reads its malicious verdict", async () => {
  const { fetchImpl, calls } = createFetch();
  await withScannerEnvironment(fetchImpl, async () => {
    const result = await scanUrlWithCloudflare("https://example.com/path?query=value");

    assert.equal(result.safe, true);
    assert.equal(result.source, "cloudflare_unlisted");
    assert.ok(result.checkedAt instanceof Date);
    assert.deepEqual(result.threatTypes, ["phishing"]);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url.origin, "https://api.cloudflare.com");
    assert.equal(calls[0].url.pathname, `/client/v4/accounts/${accountId}/urlscanner/v2/scan`);
    assert.equal(calls[0].options.headers.Authorization, `Bearer ${token}`);
    assert.deepEqual(JSON.parse(calls[0].options.body), {
      url: "https://example.com/path?query=value",
      visibility: "Unlisted"
    });
    assert.equal(calls[1].url.pathname, `/client/v4/accounts/${accountId}/urlscanner/v2/result/${scanId}`);
    assert.equal(calls[1].options.method, "GET");
  });
});

test("Cloudflare URL Scanner marks malicious results as unsafe", async () => {
  const { fetchImpl } = createFetch({ malicious: true });
  await withScannerEnvironment(fetchImpl, async () => {
    const result = await scanUrlWithCloudflare("https://unsafe.example");
    assert.equal(result.safe, false);
  });
});

test("Cloudflare URL Scanner fails closed if configuration is missing", async () => {
  await withScannerEnvironment(async () => {
    assert.fail("Fetch must not run without scanner credentials");
  }, async () => {
    await assert.rejects(
      scanUrlWithCloudflare("https://example.com"),
      (error) => error instanceof UrlScanServiceError && error.code === "not_configured"
    );
  }, { configured: false });
});

test("Cloudflare URL Scanner rejects public scans or incomplete verdicts", async () => {
  const { fetchImpl: publicFetch } = createFetch({ visibility: "public" });
  await withScannerEnvironment(publicFetch, async () => {
    await assert.rejects(
      scanUrlWithCloudflare("https://example.com"),
      (error) => error instanceof UrlScanServiceError && error.code === "unexpected_visibility"
    );
  });

  await withScannerEnvironment(async (_url, options) => options.method === "POST"
    ? { ok: true, status: 200, json: async () => ({ uuid: scanId, visibility: "Unlisted", result: `https://radar.cloudflare.com/scan/${scanId}` }) }
    : { ok: true, status: 200, json: async () => ({ task: { status: "Finished", success: true }, verdicts: {} }) },
  async () => {
    await assert.rejects(
      scanUrlWithCloudflare("https://example.com"),
      (error) => error instanceof UrlScanServiceError && error.code === "invalid_response"
    );
  });
});

test("Cloudflare URL Scanner fails closed on rate limits and provider errors", async () => {
  await withScannerEnvironment(async () => ({ ok: false, status: 429 }), async () => {
    await assert.rejects(
      scanUrlWithCloudflare("https://example.com"),
      (error) => error instanceof UrlScanServiceError && error.code === "provider_error_429"
    );
  });
  await withScannerEnvironment(async () => { throw new Error("network failure"); }, async () => {
    await assert.rejects(
      scanUrlWithCloudflare("https://example.com"),
      (error) => error instanceof UrlScanServiceError && error.code === "request_failed"
    );
  });
});
