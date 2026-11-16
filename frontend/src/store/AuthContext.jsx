import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { consumeStorePwaHandoff, refreshSession, revokeCurrentSession } from "../api/session.js";
import {
  clearStoredAuth,
  getAuthStorageKeys,
  setStoredAuthToken,
  setStoredAuthUser
} from "../api/authStorage.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshIntervalRef = useRef(null);
  const lastFocusRefreshAtRef = useRef(0);

  const doSilentRefresh = async () => {
    try {
      const newToken = await refreshSession();
      if (newToken) {
        setStoredAuthToken(newToken);
        setToken(newToken);
        return true;
      }
      return false;
    } catch (err) {
      if (err.response?.status !== 401) {
        console.warn("[Auth] Proactive silent refresh failed:", err.message);
      }
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
        headers: {
          ...(existingToken ? { Authorization: `Bearer ${existingToken}` } : {}),
          ...(getAuthStorageKeys().isStorePwa
            ? { "X-Souqak-Store-PWA-Id": getAuthStorageKeys().storeId }
            : {})
        },
        withCredentials: true,
        timeout: 5000
      });
      
      if (res.data) {
        setUser(res.data);
        setStoredAuthUser(res.data);
        return true;
      }
      return false;
    } catch (err) {
      if (err.response?.status !== 401) {
        console.warn("[Auth] Session check failed:", err.message);
      }
      if (err.response?.status === 401) {
        const refreshed = await doSilentRefresh();
        if (refreshed) {
          const currentToken = localStorage.getItem(getAuthStorageKeys().token);
          if (currentToken) return await fetchUserWithCurrentToken(currentToken);
        }
      }
      return false;
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const storageKeys = getAuthStorageKeys();
        const savedUserStr = localStorage.getItem(storageKeys.user);
        const savedUser = savedUserStr ? JSON.parse(savedUserStr) : null;
        const t = localStorage.getItem(storageKeys.token)
          || (!storageKeys.isStorePwa ? getTokenFromCookie() : null);
        
        if (savedUser && t) {
          setUser(savedUser);
          setToken(t);
        }

        if (storageKeys.isStorePwa) {
          try {
            const transferredToken = await consumeStorePwaHandoff();
            if (transferredToken) {
              setStoredAuthToken(transferredToken);
              setToken(transferredToken);
              if (await fetchUserWithCurrentToken(transferredToken)) {
                setLoading(false);
                return;
              }
            }
          } catch (error) {
            if (error.response?.status !== 401) {
              console.warn("[Auth] Store PWA session handoff was unavailable:", error.message);
            }
          }
        }
        
        if (!t && !savedUser) {
          if (storageKeys.isStorePwa) {
            const refreshed = await doSilentRefresh();
            const refreshedToken = localStorage.getItem(storageKeys.token);
            if (refreshed && refreshedToken) {
              await fetchUserWithCurrentToken(refreshedToken);
            }
          }
          setLoading(false);
          return;
        }

        await fetchUserWithCurrentToken(t);

        const cachedUser = localStorage.getItem(storageKeys.user);
        const cachedToken = localStorage.getItem(storageKeys.token);
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
      if (Date.now() - lastFocusRefreshAtRef.current < 60_000) return;
      lastFocusRefreshAtRef.current = Date.now();
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
    setStoredAuthToken(t);
    setStoredAuthUser(u);
    setToken(t);
    setUser(u);
  };

  const logout = () => {
    const storedToken = localStorage.getItem(getAuthStorageKeys().token);
    const tokenToRevoke = token || storedToken;
    if (tokenToRevoke) {
      revokeCurrentSession(tokenToRevoke).catch((error) => {
        console.error("[Auth] Server-side logout failed:", error.message);
      });
    }
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    clearStoredAuth();
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

function getTokenFromCookie() {
  try {
    if (getAuthStorageKeys().isStorePwa) return null;
    const m = document.cookie.match(/(?:^|; )token=([^;]*)/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}
function clearTokenCookie() {
  try {
    if (getAuthStorageKeys().isStorePwa) return;
    document.cookie = "token=; Max-Age=0; Path=/; SameSite=Lax";
  } catch {}
}
