let retryUntil = 0;

export function getRetryAfterMs(errorOrResponse) {
  const response = errorOrResponse?.response || errorOrResponse;
  const headers = response?.headers;
  const retryAfter = typeof headers?.get === "function"
    ? headers.get("retry-after")
    : headers?.["retry-after"] || headers?.["Retry-After"];

  if (retryAfter !== undefined && retryAfter !== null) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

    const retryAt = Date.parse(retryAfter);
    if (Number.isFinite(retryAt)) return Math.max(0, retryAt - Date.now());
  }

  const bodyDelay = Number(response?.data?.retryAfter);
  return Number.isFinite(bodyDelay) ? Math.max(0, bodyDelay * 1000) : 0;
}

export function recordRateLimit(error) {
  if (error?.response?.status !== 429) return;
  retryUntil = Math.max(retryUntil, Date.now() + getRetryAfterMs(error));
}

export async function waitForRateLimit() {
  while (retryUntil > Date.now()) {
    await new Promise((resolve) => setTimeout(resolve, retryUntil - Date.now()));
  }
}
