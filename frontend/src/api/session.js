import axios from "axios";
import { getApiBaseUrl, ensureCsrfToken } from "./csrf.js";
import { recordRateLimit } from "./retryAfter.js";

let refreshRequest = null;

export function refreshSession() {
  if (!refreshRequest) {
    refreshRequest = (async () => {
      try {
        const csrfToken = await ensureCsrfToken();
        const response = await axios.post(`${getApiBaseUrl()}/auth/refresh-token`, {}, {
          withCredentials: true,
          timeout: 8000,
          headers: { "X-CSRF-Token": csrfToken }
        });
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
