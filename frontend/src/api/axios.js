import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useAuth } from "../store/AuthContext.jsx";
import { IS_MAINTENANCE } from "../config/maintenance.js";
import { clearCsrfToken, ensureCsrfToken, isApiRequest } from "./csrf.js";
import { refreshSession } from "./session.js";
import { getRetryAfterMs, recordRateLimit, waitForRateLimit } from "./retryAfter.js";

let apiInstance = null;
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export function useApi() {
  const { token, logout, setToken } = useAuth();
  const instanceRef = useRef(null);
  const requestInterceptorRef = useRef(null);
  const responseInterceptorRef = useRef(null);
  
  if (!apiInstance) {
    const envBase = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
    
    if (envBase.startsWith("mongodb") && !window._api_url_error_logged) {
      console.error("CRITICAL ERROR: VITE_API_URL is set to a MongoDB URI instead of an HTTP URL. Check your environment variables in Vercel/Render.");
      window._api_url_error_logged = true;
    }

    let base = envBase.replace(/\/$/, "");
    if (!base.endsWith("/api")) {
      base = `${base}/api`;
    }
    base = `${base}/`;
    
    console.log(`[API] Initializing with baseURL: ${base}`);
    
    apiInstance = axios.create({
      baseURL: base,
      withCredentials: true,
      timeout: 60000 
    });
  }
  
  useEffect(() => {
    const instance = apiInstance;
    
    if (requestInterceptorRef.current !== null) {
      instance.interceptors.request.eject(requestInterceptorRef.current);
    }
    if (responseInterceptorRef.current !== null) {
      instance.interceptors.response.eject(responseInterceptorRef.current);
    }
    
    requestInterceptorRef.current = instance.interceptors.request.use(async (config) => {
      await waitForRateLimit();
      if (IS_MAINTENANCE) {
        console.warn("[Maintenance] Request blocked:", config.url || config.baseURL || "unknown request");
        return Promise.reject(new Error("MAINTENANCE_MODE_ACTIVE"));
      }

      if (config.url && config.url.startsWith("/")) {
        config.url = config.url.substring(1);
      }
      if (token) config.headers.Authorization = `Bearer ${token}`;

      const nonGetMethods = ["post", "put", "delete", "patch"];
      if (nonGetMethods.includes(config.method?.toLowerCase()) && isApiRequest(config)) {
        config.headers["X-CSRF-Token"] = await ensureCsrfToken();
      }

      return config;
    }, (error) => Promise.reject(error));
    
    responseInterceptorRef.current = instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        recordRateLimit(error);
        if (error.response?.data?.code === "CSRF_TOKEN_INVALID") clearCsrfToken();
        const originalRequest = error.config;
        const requestUrl = originalRequest?.url || "";
        const isLoginRequest = requestUrl.includes("auth/login") || requestUrl.includes("auth/phone-login");

        if (
          error.response?.status === 429
          && originalRequest?.method?.toLowerCase() === "get"
          && !originalRequest._rateLimitRetry
          && getRetryAfterMs(error) > 0
        ) {
          originalRequest._rateLimitRetry = true;
          return instance(originalRequest);
        }
        
        const isPrivateMessageRequest = requestUrl.startsWith("message-attachments/")
          || /^conversations\/[^/]+\/messages(?:\/|$)/.test(requestUrl)
          || /^support\/(?:my\/messages|conversations\/[^/]+\/messages|admin\/[^/]+\/messages)(?:\/|$)/.test(requestUrl);
        if (error.response?.status === 404 && !isPrivateMessageRequest) {
          console.error(`[API 404] Failed request to: ${error.config.baseURL}${error.config.url}`);
        }

        if (error.response?.status === 401 && !isLoginRequest && !originalRequest._retry) {
          if (isRefreshing) {
            return new Promise((resolve, reject) => {
              failedQueue.push({ resolve, reject });
            })
            .then(token => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return instance(originalRequest);
            })
            .catch(err => Promise.reject(err));
          }

          originalRequest._retry = true;
          isRefreshing = true;

          try {
            console.log("[API] Access token expired, attempting silent refresh...");
            const newToken = await refreshSession();
            if (newToken) {
              localStorage.setItem("token", newToken);
              setToken(newToken);
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              processQueue(null, newToken);
              console.log("[API] Silent token refresh succeeded.");
              return instance(originalRequest);
            } else {
              throw new Error("No token in refresh response");
            }
          } catch (refreshErr) {
            console.error("[API] Silent token refresh failed, logging out:", refreshErr.message);
            processQueue(refreshErr, null);
            if (refreshErr.response?.status !== 429) {
              logout();
              window.location.href = "/login";
            }
            return Promise.reject(refreshErr);
          } finally {
            isRefreshing = false;
          }
        }

        if (error.response?.status === 401 && !isLoginRequest && originalRequest._retry) {
          logout();
          window.location.href = "/login";
        }

        return Promise.reject(error);
      }
    );
    
    return () => {
      instance.interceptors.request.eject(requestInterceptorRef.current);
      instance.interceptors.response.eject(responseInterceptorRef.current);
    };
  }, [token, logout, setToken]);
  
  return apiInstance;
}
