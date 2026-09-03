import React, { useEffect, useRef, useState } from "react";
import Footer from "../components/Footer.jsx";
import NavBar from "../components/NavBar.jsx";
import BottomNavBar from "../components/BottomNavBar.jsx";
import { Outlet, Link, useLocation } from "react-router-dom";
import NotificationPrompt from "../components/NotificationPrompt.jsx";
import PWAInstallPrompt from "../components/PWAInstallPrompt.jsx";
import CookieConsent from "../components/CookieConsent.jsx";
import CommissionReminderBar from "../components/CommissionReminderBar.jsx";
import PendingReviewModal from "../components/PendingReviewModal.jsx";
import SmartFollowUpModal from "../components/SmartFollowUpModal.jsx";
import FloatingAdhkar from "../components/FloatingAdhkar.jsx";
import { useAuth } from "../store/AuthContext.jsx";

const getOrCreateVisitorId = () => {
  const key = "souqak_visitor_id";

  try {
    let currentValue = localStorage.getItem(key);

    if (!currentValue) {
      const cookieMatch = document.cookie
        .split("; ")
        .find((entry) => entry.startsWith(`${key}=`));
      if (cookieMatch) {
        currentValue = decodeURIComponent(cookieMatch.split("=")[1]);
      }
    }

    if (!currentValue) {
      const nextValue = window.crypto && window.crypto.randomUUID
        ? window.crypto.randomUUID()
        : `v-${Date.now()}-${Math.random().toString(16).slice(2)}`;

      localStorage.setItem(key, nextValue);
      document.cookie = `${key}=${encodeURIComponent(nextValue)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
      return nextValue;
    }

    localStorage.setItem(key, currentValue);
    document.cookie = `${key}=${encodeURIComponent(currentValue)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    return currentValue;
  } catch (error) {
    return null;
  }
};

export default function MainLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isMessagesRoute = location.pathname.startsWith("/messages");
  const [isChatRoom, setIsChatRoom] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return Boolean(params.get("c") || params.get("am") || params.get("direct"));
  });
  const showBack = location.pathname !== "/" && !location.pathname.startsWith("/admin");
  const trackedVisitorRef = useRef(false);

  const [toast, setToast] = useState({ open: false, message: "", type: "info" });

  useEffect(() => {
    const handler = (e) => {
      const d = e.detail || {};
      setToast({ open: true, message: d.message || "", type: d.type || "info" });
      setTimeout(() => setToast((t) => ({ ...t, open: false })), 2500);
    };
    window.addEventListener("app:toast", handler);
    return () => window.removeEventListener("app:toast", handler);
  }, []);

  useEffect(() => {
    if (!isMessagesRoute) {
      setIsChatRoom(false);
      return undefined;
    }

    const params = new URLSearchParams(window.location.search);
    setIsChatRoom(Boolean(params.get("c") || params.get("am") || params.get("direct")));

    const handleConversationActive = () => setIsChatRoom(true);
    const handleConversationClear = () => setIsChatRoom(false);
    window.addEventListener("conversation:active", handleConversationActive);
    window.addEventListener("conversation:clear", handleConversationClear);
    return () => {
      window.removeEventListener("conversation:active", handleConversationActive);
      window.removeEventListener("conversation:clear", handleConversationClear);
    };
  }, [isMessagesRoute, location.search]);

  useEffect(() => {
    if (trackedVisitorRef.current) return;
    trackedVisitorRef.current = true;

    const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/$/, "");
    fetch(`${apiBase}/admin/analytics/visitors/track`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userAgent: navigator.userAgent
      })
    }).catch(() => {});
  }, []);
  
  return (
    <div className={`relative min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/40 to-slate-50 ${isChatRoom ? "overflow-hidden pt-[60px] md:pt-[70px]" : "pb-20 pt-[60px] md:pb-0 md:pt-[70px]"} dark:from-slate-950 dark:via-slate-900 dark:to-slate-950`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-blue-600/10 to-transparent" />
      {loading && (
        <div className="fixed top-20 right-4 z-50">
          <div className="flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 shadow-lg border border-gray-100 backdrop-blur-sm">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600"></div>
            <div className="text-[10px] font-bold text-gray-600">جارٍ التحقق...</div>
          </div>
        </div>
      )}
      
      <NavBar />
      <FloatingAdhkar />
      <CommissionReminderBar />
      <NotificationPrompt />
      <PWAInstallPrompt />
      <CookieConsent />
      {user && (
        <>
          <PendingReviewModal />
          <SmartFollowUpModal />
        </>
      )}

      <main className={`relative mx-auto ${isChatRoom ? "h-[calc(100vh-120px)] w-full max-w-none px-0 py-0" : "max-w-6xl px-4 py-6 min-h-[calc(100vh-160px)]"}`}>
        {showBack && !isChatRoom && (
          <div className="mb-6">
            <button 
              onClick={() => window.history.back()}
              className="inline-flex items-center gap-2 rounded-full bg-white border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 shadow-sm transition-all active:scale-95"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              <span>العودة</span>
            </button>
          </div>
        )}
        <Outlet />
      </main>

      {!isChatRoom && (
        <div className={location.pathname === "/account-settings" ? "" : "hidden md:block"}>
          <Footer />
        </div>
      )}
      {!isChatRoom && <BottomNavBar />}

      {toast.open && (
        <div className="fixed bottom-24 md:bottom-10 right-4 left-4 md:right-10 md:left-auto z-[9999] animate-in fade-in slide-in-from-bottom duration-300 pointer-events-none">
          <div
            className={
              "mx-auto md:mx-0 max-w-xs rounded-2xl px-6 py-4 text-sm font-black shadow-2xl backdrop-blur-md border flex items-center gap-3 " +
              (toast.type === "success"
                ? "bg-green-50/90 text-green-700 border-green-200"
                : toast.type === "error"
                ? "bg-red-50/90 text-red-700 border-red-200"
                : "bg-blue-50/90 text-blue-700 border-blue-200")
            }
          >
            {toast.type === "success" && (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
