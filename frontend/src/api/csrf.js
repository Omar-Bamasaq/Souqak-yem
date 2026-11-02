import axios from "axios";

let csrfToken = null;
let csrfRequest = null;

export function getApiBaseUrl() {
  let base = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");
  if (!base.endsWith("/api")) base = `${base}/api`;
  return base;
}

export function isApiRequest(config) {
  const apiOrigin = new URL(getApiBaseUrl(), window.location.origin).origin;
  const requestUrl = new URL(config.url || "", config.baseURL || window.location.href);
  return requestUrl.origin === apiOrigin;
}

export async function ensureCsrfToken() {
  if (csrfToken) return csrfToken;
  if (!csrfRequest) {
    csrfRequest = axios
      .get(`${getApiBaseUrl()}/csrf-token`, { withCredentials: true })
      .then(({ data }) => {
        if (typeof data?.csrfToken !== "string" || !data.csrfToken) {
          throw new Error("The API did not return a CSRF token.");
        }
        csrfToken = data.csrfToken;
        return csrfToken;
      })
      .finally(() => {
        csrfRequest = null;
      });
  }
  return csrfRequest;
}

export function clearCsrfToken() {
  csrfToken = null;
}
