import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import { canInstallPWA, getPWAInstallGuidance, installPWA, isPWAStandalone } from "../utils/pwaInstall.js";
import { getStorePwaInstallContent } from "../utils/storePwaInstallPrompt.js";
import { uploadsUrl } from "../lib/uploads.js";
import { buildStorePwaIconUrl } from "../utils/storePwa.js";

const GLOBAL_INSTALL_TARGET = "souqak";
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000;

export default function PWAInstallPrompt({ store, apiBase }) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptMode, setPromptMode] = useState(null);
  const [copyStatus, setCopyStatus] = useState("");
  const nativePromptRequested = useRef(false);
  const location = useLocation();
  const isStoreRoute = location.pathname.startsWith("/store/");
  const isStorePrompt = Boolean(store);
  const installTarget = isStorePrompt && store.pwaEnabled && store.slug
    ? `store:${store.slug}`
    : isStorePrompt ? null : GLOBAL_INSTALL_TARGET;
  const dismissedKey = isStorePrompt
    ? `pwa_prompt_dismissed:store:${store.slug}`
    : "pwa_prompt_dismissed";
  const storeContent = isStorePrompt ? getStorePwaInstallContent(store) : null;
  const storeName = isStorePrompt ? String(store.storeName || "المتجر").trim() || "المتجر" : null;
  const installAppName = isStorePrompt ? `تطبيق ${storeName}` : "سوقك";
  const iconSrc = isStorePrompt
    ? store.logo ? uploadsUrl(store.logo) : buildStorePwaIconUrl(store.slug, 192, apiBase)
    : "/assets/logo/app-icon.svg";

  useEffect(() => {
    setShowPrompt(false);
    setPromptMode(null);
    if (!installTarget || (isStorePrompt && !isStoreRoute) || (!isStorePrompt && isStoreRoute)) return undefined;

    let promptTimer = null;
    const handleCanInstall = (event) => {
      if (event?.detail?.target && event.detail.target !== installTarget) return;
      const dismissedUntil = Number(localStorage.getItem(dismissedKey));
      const isDismissed = sessionStorage.getItem(dismissedKey) === "true"
        || (Number.isFinite(dismissedUntil) && dismissedUntil > Date.now());
      if (isDismissed || isPWAStandalone()) return;

      const canInstall = canInstallPWA(installTarget);
      if (nativePromptRequested.current && !canInstall) return;
      const guidance = getPWAInstallGuidance({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        maxTouchPoints: navigator.maxTouchPoints,
        standalone: isPWAStandalone(),
        canInstall
      });
      const nextMode = guidance || (canInstall ? "native" : null);
      if (!nextMode) return;

      if (promptTimer) clearTimeout(promptTimer);
      promptTimer = setTimeout(() => {
        setPromptMode(nextMode);
        setShowPrompt(true);
      }, 5000);
    };

    const handleInstalled = (event) => {
      if (event.detail?.target === installTarget) {
        setShowPrompt(false);
        setPromptMode(null);
      }
    };
    window.addEventListener("pwa:can-install", handleCanInstall);
    window.addEventListener("pwa:installed", handleInstalled);
    handleCanInstall({ detail: { target: installTarget } });

    return () => {
      clearTimeout(promptTimer);
      window.removeEventListener("pwa:can-install", handleCanInstall);
      window.removeEventListener("pwa:installed", handleInstalled);
    };
  }, [dismissedKey, installTarget, isStorePrompt, isStoreRoute]);

  const handleInstallClick = async () => {
    nativePromptRequested.current = true;
    try {
      const outcome = await installPWA(installTarget);
      console.log(`User response to the install prompt: ${outcome}`);
      setShowPrompt(false);
      setPromptMode(null);
    } finally {
      nativePromptRequested.current = false;
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setPromptMode(null);
    localStorage.setItem(dismissedKey, String(Date.now() + DISMISS_DURATION));
  };

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(window.location.href);
          setCopyStatus("تم نسخ الرابط");
          return;
        } catch {
          // Fall back for embedded browsers that deny clipboard access.
        }
      }

      const input = document.createElement("textarea");
      input.value = window.location.href;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      let copied;
      try {
        input.select();
        copied = document.execCommand("copy");
      } finally {
        input.remove();
      }
      if (!copied) throw new Error("The browser could not copy the page URL.");
      setCopyStatus("تم نسخ الرابط");
    } catch (error) {
      console.error("PWA install link copy failed:", error);
      setCopyStatus("تعذر نسخ الرابط. انسخه من شريط العنوان.");
    }
  };

  if ((!isStorePrompt && isStoreRoute) || (isStorePrompt && (!isStoreRoute || !installTarget))) return null;
  const isManualPrompt = ["in-app", "ios-in-app", "ios", "android-chrome"].includes(promptMode);
  const promptTitle = promptMode === "in-app"
    ? `لتثبيت ${installAppName}، افتح الصفحة في Google Chrome`
    : promptMode === "ios-in-app"
      ? `لتثبيت ${installAppName}، افتح الصفحة في Safari`
      : promptMode === "ios"
        ? `أضف ${installAppName} إلى الشاشة الرئيسية`
        : promptMode === "android-chrome"
          ? `ثبّت ${installAppName} من Google Chrome`
          : isStorePrompt ? storeContent.title : "تثبيت تطبيق سوقك";
  const promptDescription = promptMode === "in-app"
    ? "اضغط «نسخ الرابط»، ثم افتح Chrome والصق الرابط لعرض خيار التثبيت."
    : promptMode === "ios-in-app"
      ? "انسخ الرابط وافتحه في Safari، ثم اضغط «مشاركة» واختر «إضافة إلى الشاشة الرئيسية»."
      : promptMode === "ios"
        ? "اضغط «مشاركة» في Safari، ثم اختر «إضافة إلى الشاشة الرئيسية»."
        : promptMode === "android-chrome"
          ? "افتح قائمة Chrome (⋮)، ثم اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»."
          : isStorePrompt
            ? storeContent.description
            : "ثبت التطبيق على هاتفك للوصول السريع وتجربة تصفح أفضل حتى مع الإنترنت الضعيف.";

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-24 left-4 right-4 z-[100] md:bottom-10 md:right-10 md:left-auto md:max-w-sm"
        >
          <div dir="rtl" className={`flex flex-col rounded-3xl border border-blue-100 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 ${isManualPrompt ? "gap-3 p-4" : "gap-4 p-5"}`}>
            <div className="flex items-start gap-4">
              {!isManualPrompt && <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg shadow-blue-200 dark:bg-slate-800 dark:shadow-none">
                {isStorePrompt ? (
                  <img
                    src={iconSrc}
                    alt={store.storeName}
                    className="h-full w-full object-cover"
                    onError={(event) => { event.currentTarget.src = "/assets/logo/app-icon.svg"; }}
                  />
                ) : (
                  <img src={iconSrc} alt="سوقك" className="h-10 w-10 object-contain" />
                )}
              </div>}
              <div className="flex-1">
                <h3 className="text-lg font-black text-gray-900 dark:text-white">
                  {promptTitle}
                </h3>
                {!isManualPrompt && <p className="mt-1 text-sm font-bold text-blue-600">
                  {isStorePrompt ? storeContent.subtitle : "اجعل سوقك أقرب إليك"}
                </p>}
                <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                  {promptDescription}
                </p>
                {copyStatus && <p role="status" className="mt-1 text-xs font-bold text-blue-600">{copyStatus}</p>}
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="إغلاق نافذة التثبيت"
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex gap-3">
              {promptMode === "native" && <button
                type="button"
                onClick={handleInstallClick}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95"
              >
                تثبيت الآن
              </button>}
              {isManualPrompt && <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 rounded-2xl bg-blue-600 py-3 font-black text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 active:scale-95 dark:shadow-none"
              >
                نسخ الرابط
              </button>}
              <button
                type="button"
                onClick={handleDismiss}
                className="rounded-2xl bg-gray-50 px-6 py-3 font-bold text-gray-600 transition-all hover:bg-gray-100 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700"
              >
                لاحقًا
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
