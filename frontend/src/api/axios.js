import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useAuth } from "../store/AuthContext.jsx";

// Initialize axios instance ONCE
let apiInstance = null;

export function useApi() {
  const { token, logout } = useAuth();
  const instanceRef = useRef(null);
  const requestInterceptorRef = useRef(null);
  const responseInterceptorRef = useRef(null);
  
  // Initialize the instance if it doesn't exist yet
  if (!apiInstance) {
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
    base = `${base}/`;
    
    console.log(`[API] Initializing with baseURL: ${base}`);
    
    apiInstance = axios.create({
      baseURL: base,
      withCredentials: true,
      timeout: 60000 
    });
  }
  
  // Update interceptors when token or logout changes
  useEffect(() => {
    const instance = apiInstance;
    
    // Eject old interceptors if they exist
    if (requestInterceptorRef.current !== null) {
      instance.interceptors.request.eject(requestInterceptorRef.current);
    }
    if (responseInterceptorRef.current !== null) {
      instance.interceptors.response.eject(responseInterceptorRef.current);
    }
    
    // Request interceptor
    requestInterceptorRef.current = instance.interceptors.request.use((config) => {
      if (config.url && config.url.startsWith("/")) {
        config.url = config.url.substring(1);
      }
      if (token) config.headers.Authorization = `Bearer ${token}`;

      const nonGetMethods = ["post", "put", "delete", "patch"];
      if (nonGetMethods.includes(config.method?.toLowerCase())) {
        const csrfToken = document.cookie
          .split("; ")
          .find((row) => row.startsWith("csrfToken="))
          ?.split("=")[1];
        
        if (csrfToken) {
          config.headers["X-CSRF-Token"] = csrfToken;
        }
      }

      return config;
    }, (error) => Promise.reject(error));
    
    // Response interceptor
    responseInterceptorRef.current = instance.interceptors.response.use(
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
    
    return () => {
      instance.interceptors.request.eject(requestInterceptorRef.current);
      instance.interceptors.response.eject(responseInterceptorRef.current);
    };
  }, [token, logout]);
  
  return apiInstance;
}
