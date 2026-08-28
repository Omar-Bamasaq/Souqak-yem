import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshIntervalRef = useRef(null);

  const doSilentRefresh = async () => {
    try {
      const envBase = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
      let base = envBase.replace(/\/$/, "");
      if (!base.endsWith("/api")) base = `${base}/api`;

      const refreshRes = await axios.post(`${base}/auth/refresh-token`, {}, {
        withCredentials: true,
        timeout: 8000
      });

      const newToken = refreshRes.data.token;
      if (newToken) {
        localStorage.setItem("token", newToken);
        setToken(newToken);
        return true;
      }
      return false;
    } catch (err) {
      console.warn("[Auth] Proactive silent refresh failed:", err.message);
      return false;
    }
  };

  const fetchUserWithCurrentToken = async (existingToken) => {
    try {
      const envBase = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
      let base = envBase.replace(/\/$/, "");
      if (!base.endsWith("/api")) {
        base = `${base}/api`;
      }
      base = `${base}/`;
      
      console.log(`[Auth] Checking session at: ${base}auth/me`);
      
      const res = await axios.get(`${base}auth/me`, {
        headers: existingToken ? { Authorization: `Bearer ${existingToken}` } : {},
        withCredentials: true,
        timeout: 5000
      });
      
      if (res.data) {
        setUser(res.data);
        localStorage.setItem("user", JSON.stringify(res.data));
        if (existingToken) setTokenCookie(existingToken);
        return true;
      }
      return false;
    } catch (err) {
      console.warn("[Auth] Session check failed:", err.message);
      if (err.response?.status === 401) {
        const refreshed = await doSilentRefresh();
        if (refreshed) {
          const t = localStorage.getItem("token");
          if (t) return await fetchUserWithCurrentToken(t);
        }
      }
      return false;
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const savedUserStr = localStorage.getItem("user");
        const savedUser = savedUserStr ? JSON.parse(savedUserStr) : null;
        const t = localStorage.getItem("token") || getTokenFromCookie();
        
        if (savedUser && t) {
          setUser(savedUser);
          setToken(t);
        }
        
        if (!t && !savedUser) {
          setLoading(false);
          return;
        }

        await fetchUserWithCurrentToken(t);

        const cachedUser = localStorage.getItem("user");
        const cachedToken = localStorage.getItem("token");
        if (cachedUser && !user) setUser(JSON.parse(cachedUser));
        if (cachedToken && !token) setToken(cachedToken);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!user || !token) {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      return;
    }

    if (refreshIntervalRef.current) return;

    const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

    refreshIntervalRef.current = setInterval(() => {
      console.log("[Auth] Running proactive token refresh (every 6h)...");
      doSilentRefresh();
    }, REFRESH_INTERVAL_MS);

    const onFocus = () => {
      console.log("[Auth] Window regained focus, verifying session freshness.");
      doSilentRefresh();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      window.removeEventListener("focus", onFocus);
    };
  }, [user, token]);

  const login = (t, u) => {
    localStorage.setItem("token", t);
    localStorage.setItem("user", JSON.stringify(u));
    setTokenCookie(t);
    setToken(t);
    setUser(u);
  };

  const logout = () => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    clearTokenCookie();
    setToken(null);
    setUser(null);
  };

  const value = useMemo(() => ({ user, setUser, token, setToken, loading, login, logout }), [user, token, loading]);
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
