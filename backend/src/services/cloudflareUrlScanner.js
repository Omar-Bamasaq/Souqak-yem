const CLOUDFLARE_API = "https://api.cloudflare.com/client/v4/accounts";
const REQUEST_TIMEOUT_MS = 10000;
const SCAN_INTERVAL_MS = 10000;
const MAX_SCAN_WAIT_MS = 50000;

export class UrlScanServiceError extends Error {
  constructor(code) {
    super("تعذر التحقق من أمان رابط الخدمة.");
    this.name = "UrlScanServiceError";
    this.code = code;
  }
}

function getConfiguration() {
  const accountId = process.env.CLOUDFLARE_URL_SCANNER_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_URL_SCANNER_API_TOKEN?.trim();
  if (!accountId || !apiToken) throw new UrlScanServiceError("not_configured");
  if (!/^[a-f0-9]{32}$/i.test(accountId)) throw new UrlScanServiceError("invalid_account_id");
  return { accountId, apiToken };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cloudflareRequest(url, options, apiToken) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  timeout.unref?.();

  try {
    return await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        ...(options.headers || {})
      },
      signal: controller.signal
    });
  } catch {
    throw new UrlScanServiceError(controller.signal.aborted ? "timeout" : "request_failed");
  } finally {
    clearTimeout(timeout);
  }
}

async function readJson(response) {
  try {
    const payload = await response.json();
    if (payload?.success === false) throw new UrlScanServiceError("provider_rejected");
    if (payload?.success === true && Object.hasOwn(payload, "result")) {
      return payload.result;
    }
    if (payload?.result && typeof payload.result === "object" && !Array.isArray(payload.result)) {
      return payload.result;
    }
    return payload;
  } catch (error) {
    if (error instanceof UrlScanServiceError) throw error;
    throw new UrlScanServiceError("invalid_response");
  }
}

function resultUrl(accountId, scanId) {
  if (!/^[a-f0-9-]{36}$/i.test(scanId)) throw new UrlScanServiceError("invalid_response");
  return `${CLOUDFLARE_API}/${accountId}/urlscanner/v2/result/${scanId}`;
}

export async function scanUrlWithCloudflare(uri) {
  const { accountId, apiToken } = getConfiguration();

  const submitResponse = await cloudflareRequest(
    `${CLOUDFLARE_API}/${accountId}/urlscanner/v2/scan`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: uri, visibility: "Unlisted" })
    },
    apiToken
  );
  if (!submitResponse.ok) {
    throw new UrlScanServiceError(`provider_error_${submitResponse.status}`);
  }

  const submittedScan = await readJson(submitResponse);
  const scanId = submittedScan?.uuid;
  if (submittedScan?.visibility !== "unlisted" && submittedScan?.visibility !== "Unlisted") {
    throw new UrlScanServiceError("unexpected_visibility");
  }

  const reportUrl = resultUrl(accountId, scanId);
  const deadline = Date.now() + MAX_SCAN_WAIT_MS;
  let reportResponse;
  let shouldWait = false;

  do {
    if (shouldWait) {
      await wait(Math.min(SCAN_INTERVAL_MS, Math.max(0, deadline - Date.now())));
    }
    reportResponse = await cloudflareRequest(reportUrl, { method: "GET" }, apiToken);
    shouldWait = reportResponse.status === 404;
    if (reportResponse.status !== 404) break;
  } while (Date.now() < deadline);

  if (!reportResponse || reportResponse.status === 404) {
    throw new UrlScanServiceError("scan_pending");
  }
  if (!reportResponse.ok) {
    throw new UrlScanServiceError(`provider_error_${reportResponse.status}`);
  }

  const report = await readJson(reportResponse);
  if (report?.task?.status !== "Finished" || report.task.success !== true) {
    throw new UrlScanServiceError("scan_failed");
  }
  const malicious = report?.verdicts?.overall?.malicious;
  if (typeof malicious !== "boolean") throw new UrlScanServiceError("invalid_response");

  return {
    safe: !malicious,
    source: "cloudflare_unlisted",
    checkedAt: new Date(),
    threatTypes: Array.isArray(report.verdicts.overall.categories)
      ? report.verdicts.overall.categories.map((category) => category.name).filter(Boolean)
      : []
  };
}
