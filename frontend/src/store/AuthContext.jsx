import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Load saved user from localStorage first
        const savedUserStr = localStorage.getItem("user");
        const savedUser = savedUserStr ? JSON.parse(savedUserStr) : null;
        const t = localStorage.getItem("token") || getTokenFromCookie();
        
        if (savedUser && t) {
          setUser(savedUser);
          setToken(t);
        }
        
        if (!t) {
          setLoading(false);
          return;
        }
        
        // Now try to verify with backend
        const envBase = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
          
          if (envBase.startsWith("mongodb") && !window._api_url_error_logged) {
            console.error("CRITICAL ERROR: VITE_API_URL is set to a MongoDB URI. Check environment variables.");
            window._api_url_error_logged = true;
          }

        // Standardize base URL: ensure it ends with /api/
        let base = envBase.replace(/\/$/, "");
        if (!base.endsWith("/api")) {
          base = `${base}/api`;
        }
        base = `${base}/`;
        
        console.log(`[Auth] Checking session at: ${base}auth/me`);
        
        const res = await axios.get(`${base}auth/me`, {
          headers: { Authorization: `Bearer ${t}` },
          timeout: 5000 // 5 second timeout
        });
        
        if (res.data) {
          setUser(res.data);
          localStorage.setItem("user", JSON.stringify(res.data));
          setTokenCookie(t);
        }
      } catch (err) {
        console.warn("[Auth] Session check failed, keeping cached user:", err.message);
        // Don't log out immediately on error! Keep cached user if available
        const savedUserStr = localStorage.getItem("user");
        const savedUser = savedUserStr ? JSON.parse(savedUserStr) : null;
        const t = localStorage.getItem("token") || getTokenFromCookie();
        if (savedUser && t) {
          setUser(savedUser);
          setToken(t);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = (t, u) => {
    localStorage.setItem("token", t);
    localStorage.setItem("user", JSON.stringify(u));
    setTokenCookie(t);
    setToken(t);
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    clearTokenCookie();
    setToken(null);
    setUser(null);
  };

  const value = useMemo(() => ({ user, setUser, token, loading, login, logout }), [user, token, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

function setTokenCookie(value) {
  try {
    const maxAge = 7 * 24 * 60 * 60;
    document.cookie = `token=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
  } catch {}
}
function getTokenFromCookie() {
  try {
    const m = document.cookie.match(/(?:^|; )token=([^;]*)/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}
function clearTokenCookie() {
  try {
    document.cookie = "token=; Max-Age=0; Path=/; SameSite=Lax";
  } catch {}
}
