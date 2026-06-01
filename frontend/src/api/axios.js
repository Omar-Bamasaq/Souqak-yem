import { useMemo } from "react";
import axios from "axios";
import { useAuth } from "../store/AuthContext.jsx";

export function useApi() {
  const { token, logout } = useAuth();
  
  return useMemo(() => {
    const envBase = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
    
    // Safeguard against misconfigured environment variables
    if (envBase.startsWith("mongodb") && !window._api_url_error_logged) {
      console.error("CRITICAL ERROR: VITE_API_URL is set to a MongoDB URI instead of an HTTP URL. Check your environment variables in Vercel/Render.");
      window._api_url_error_logged = true;
    }

    // Standardize base URL: ensure it ends with /api/
    let base = envBase.replace(/\/$/, "");
    if (!base.endsWith("/api")) {
      base = `${base}/api`;
    }
    // ALWAYS ensure baseURL ends with a trailing slash for Axios to correctly join relative paths
    base = `${base}/`;
    
    // DEBUG LOG - Remove in production if desired
    console.log(`[API] Initializing with baseURL: ${base}`);
    
    const instance = axios.create({
      baseURL: base,
      timeout: 30000 // 30 seconds timeout
    });
    
    instance.interceptors.request.use((config) => {
      // Ensure the URL is relative to the baseURL path by stripping leading slash
      if (config.url && config.url.startsWith("/")) {
        config.url = config.url.substring(1);
      }
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    }, (error) => Promise.reject(error));

    // Response interceptor for better error logging and auth handling
    instance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          logout();
          window.location.href = "/login";
        }
        if (error.response?.status === 404) {
          console.error(`[API 404] Failed request to: ${error.config.baseURL}${error.config.url}`);
        }
        return Promise.reject(error);
      }
    );
    
    return instance;
  }, [token, logout]);
}
