import axios from "axios";
import { getApiBaseUrl, ensureCsrfToken } from "./csrf.js";
import { getRetryAfterMs, recordRateLimit } from "./retryAfter.js";
import { getAuthStorageKeys, setStoredAuthToken } from "./authStorage.js";

let refreshRequest = null;
let storePwaHandoffRequest = null;
const MAX_ROTATION_RETRIES = 5;

export function getSessionRotationRetryDelay(error, attempt) {
  const bodyDelay = Number(error?.response?.data?.retryAfterMs);
  const serverDelay = Math.max(
    getRetryAfterMs(error),
    Number.isFinite(bodyDelay) ? Math.max(0, bodyDelay) : 0
  );
  const backoffDelay = Math.min(250 * (2 ** attempt), 2_000);
  return Math.max(serverDelay, backoffDelay);
}

function getSessionContextHeaders() {
  const { isStorePwa, storeId } = getAuthStorageKeys();
  return isStorePwa ? { "X-Souqak-Store-PWA-Id": storeId } : {};
}

function getRefreshEndpoint() {
  const { isStorePwa, storeId } = getAuthStorageKeys();
  return isStorePwa
    ? `${getApiBaseUrl()}/auth/store-pwa/${storeId}/refresh-token`
    : `${getApiBaseUrl()}/auth/refresh-token`;
}

export function refreshSession() {
  if (!refreshRequest) {
    refreshRequest = (async () => {
      try {
        const csrfToken = await ensureCsrfToken();
        const requestOptions = {
          withCredentials: true,
          timeout: 8000,
          headers: { "X-CSRF-Token": csrfToken, ...getSessionContextHeaders() }
        };
        let response;
        for (let attempt = 0; ; attempt += 1) {
          try {
            response = await axios.post(getRefreshEndpoint(), {}, requestOptions);
            break;
          } catch (error) {
            if (
              error.response?.data?.code !== "SESSION_TOKEN_ROTATED"
              || attempt >= MAX_ROTATION_RETRIES
            ) {
              throw error;
            }
            await new Promise((resolve) => setTimeout(
              resolve,
              getSessionRotationRetryDelay(error, attempt)
            ));
          }
        }
        if (!response.data?.token) throw new Error("No token in refresh response");
        return response.data.token;
      } catch (error) {
        recordRateLimit(error);
        throw error;
      }
    })().finally(() => {
      refreshRequest = null;
    });
  }
  return refreshRequest;
}

async function exchangeStorePwaHandoff(storeId) {
  if (!storePwaHandoffRequest) {
    storePwaHandoffRequest = (async () => {
      const csrfToken = await ensureCsrfToken();
      const response = await axios.post(
        `${getApiBaseUrl()}/auth/store-pwa/${storeId}/handoff/exchange`,
        {},
        {
          withCredentials: true,
          timeout: 8000,
          headers: {
            "X-CSRF-Token": csrfToken,
            "X-Souqak-Store-PWA-Id": storeId
          }
        }
      );
      const token = response.data?.token || null;
      if (token) setStoredAuthToken(token);
      return token;
    })().finally(() => {
      storePwaHandoffRequest = null;
    });
  }
  return storePwaHandoffRequest;
}

export async function consumeStorePwaHandoff() {
  const { isStorePwa, storeId } = getAuthStorageKeys();
  if (!isStorePwa) return null;

  const exchangeIfNeeded = () => {
    if (localStorage.getItem(getAuthStorageKeys().token)) return Promise.resolve(null);
    return exchangeStorePwaHandoff(storeId);
  };
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return navigator.locks.request(`souqak-store-pwa-handoff:${storeId}`, exchangeIfNeeded);
  }
  return exchangeIfNeeded();
}

export async function revokeCurrentSession(token) {
  if (!token) return;
  const csrfToken = await ensureCsrfToken();
  await axios.post(
    `${getApiBaseUrl()}/auth/logout`,
    {},
    {
      withCredentials: true,
      timeout: 5000,
      headers: {
        Authorization: `Bearer ${token}`,
        "X-CSRF-Token": csrfToken,
        ...getSessionContextHeaders()
      }
    }
  );
}
