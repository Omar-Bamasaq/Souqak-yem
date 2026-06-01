import { useMemo } from "react";
import axios from "axios";
import { useAuth } from "../store/AuthContext.jsx";

export function useApi() {
  const { token, logout } = useAuth();
  
  return useMemo(() => {
    const envBase = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
    // Ensure baseURL always ends with /api and remove trailing slash
    let base = envBase.replace(/\/$/, "");
    if (!base.endsWith("/api")) {
      base = `${base}/api`;
    }
    
    const instance = axios.create({
      baseURL: base
    });
    
    instance.interceptors.request.use((config) => {
      // Ensure the URL is relative to the baseURL path by stripping leading slash
      if (config.url && config.url.startsWith("/")) {
        config.url = config.url.substring(1);
      }
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });

    instance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          logout();
          window.location.href = "/login";
        }
        return Promise.reject(error);
      }
    );
    
    return instance;
  }, [token, logout]);
}
