import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { canInstallPWA, installPWA, isStandalonePWA } from "../utils/pwaInstall.js";
import { getStorePwaInstallContent } from "../utils/storePwaInstallPrompt.js";
import { buildStorePwaIconUrl } from "../utils/storePwa.js";
import {
  canShowStorePwaInstallGuide,
  createStorePwaInstallGuideController,
  dismissStorePwaInstallGuide,
  shouldShowStorePwaInstallGuide
} from "../utils/storePwaInstallGuide.js";

const GLOBAL_INSTALL_TARGET = "souqak";

export default function PWAInstallPrompt({ store, apiBase }) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const installGuideController = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const storePwaAppContext = window.__SOUQAK_STORE_PWA_APP__;
  const isStoreRoute = location.pathname.startsWith("/store/") || Boolean(storePwaAppContext?.storeId);
  const isStorePrompt = Boolean(store);
  const installTarget = isStorePrompt && store.pwaEnabled && store._id
    ? `store:${store._id}`
    : isStorePrompt ? null : GLOBAL_INSTALL_TARGET;
  const dismissedKey = isStorePrompt
    ? `pwa_prompt_dismissed:store:${store._id}`
    : "pwa_prompt_dismissed";
  const storeContent = isStorePrompt ? getStorePwaInstallContent(store) : null;
  const iconSrc = isStorePrompt
    ? buildStorePwaIconUrl(store._id, 192, apiBase)
    : "/assets/logo/app-icon.svg";
  const isCurrentStorePwa = isStorePrompt
    && storePwaAppContext?.storeId === String(store._id);
  const isAndroidStorePwaGuide = canShowStorePwaInstallGuide({
    isAndroid: typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent),
    storeId: store?._id,
    appStoreId: storePwaAppContext?.storeId,
    storeType: store?.storeType || (isCurrentStorePwa ? "store" : null),
    pwaEnabled: store?.pwaEnabled,
    isStandalone: isCurrentStorePwa && isStandalonePWA()
  });

  useEffect(() => {
    setShowPrompt(false);
    setShowInstallGuide(false);
    if (!installTarget || (isStorePrompt && !isStoreRoute) || (!isStorePrompt && isStoreRoute) || (isCurrentStorePwa && isStandalonePWA())) return undefined;

    let promptTimer = null;
    const guideController = isAndroidStorePwaGuide
      ? createStorePwaInstallGuideController({
        onGuide: () => {
          setShowPrompt(false);
          setShowInstallGuide(true);
        },
        onNativeInstall: () => {
          if (promptTimer) clearTimeout(promptTimer);
          setShowInstallGuide(false);
          setShowPrompt(true);
        }
      })
      : null;
    installGuideController.current = guideController;

    const handleCanInstall = (event) => {
      if (event?.detail?.target && event.detail.target !== installTarget) return;
      if (!canInstallPWA(installTarget)) return;
      if (guideController?.nativeInstallAvailable()) return;

      const isDismissed = sessionStorage.getItem(dismissedKey);
      if (!isDismissed) {
        if (promptTimer) clearTimeout(promptTimer);
        promptTimer = setTimeout(() => setShowPrompt(true), 5000);
      }
    };

    const handleInstallRequest = (event) => {
      if (event.detail?.target !== installTarget || !guideController) return;
      const methodButtonRequest = event.detail.source === "method-button";
      if (!shouldShowStorePwaInstallGuide(store._id, event.detail.source)) return;
      if (promptTimer) clearTimeout(promptTimer);
      setShowPrompt(false);
      guideController.request(canInstallPWA(installTarget), methodButtonRequest ? 0 : undefined);
    };

    const handleInstallStarted = (event) => {
      if (event.detail?.target !== installTarget) return;
      if (promptTimer) clearTimeout(promptTimer);
      guideController?.cancel();
      setShowInstallGuide(false);
      setShowPrompt(false);
    };

    const handleInstalled = (event) => {
      if (event.detail?.target !== installTarget) return;
      if (promptTimer) clearTimeout(promptTimer);
      guideController?.cancel();
      setShowInstallGuide(false);
      setShowPrompt(false);
    };

    window.addEventListener("pwa:can-install", handleCanInstall);
    window.addEventListener("pwa:installed", handleInstalled);
    window.addEventListener("pwa:store-install-request", handleInstallRequest);
    window.addEventListener("pwa:store-install-started", handleInstallStarted);
    handleCanInstall({ detail: { target: installTarget } });

    return () => {
      clearTimeout(promptTimer);
      guideController?.dispose();
      if (installGuideController.current === guideController) {
        installGuideController.current = null;
      }
      window.removeEventListener("pwa:can-install", handleCanInstall);
      window.removeEventListener("pwa:installed", handleInstalled);
      window.removeEventListener("pwa:store-install-request", handleInstallRequest);
      window.removeEventListener("pwa:store-install-started", handleInstallStarted);
    };
  }, [dismissedKey, installTarget, isAndroidStorePwaGuide, isCurrentStorePwa, isStorePrompt, isStoreRoute, location.pathname, store?._id]);

  useEffect(() => {
    if (!isAndroidStorePwaGuide || !installTarget) return;
    const params = new URLSearchParams(location.search);
    if (params.get("pwaInstallAttempt") !== "1") {
      return;
    }

    params.delete("pwaInstallAttempt");
    window.dispatchEvent(new CustomEvent("pwa:store-install-request", {
      detail: { target: installTarget, source: "market-install" }
    }));
    navigate({
      pathname: location.pathname,
      search: params.toString() ? `?${params.toString()}` : "",
      hash: location.hash
    }, { replace: true });
  }, [installTarget, isAndroidStorePwaGuide, location.hash, location.pathname, location.search, navigate]);

  const handleInstallClick = async () => {
    window.dispatchEvent(new CustomEvent("pwa:store-install-started", {
      detail: { target: installTarget }
    }));
    const outcome = await installPWA(installTarget);
    console.log(`User response to the install prompt: ${outcome}`);

    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem(dismissedKey, "true");
  };

  const handleInstallGuideDismiss = () => {
    installGuideController.current?.dismiss();
    dismissStorePwaInstallGuide(store._id);
    setShowInstallGuide(false);
  };

  if ((!isStorePrompt && isStoreRoute) || (isStorePrompt && (!isStoreRoute || !installTarget || (isCurrentStorePwa && isStandalonePWA())))) return null;

  return (
    <AnimatePresence>
      {showPrompt && !showInstallGuide && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-24 left-4 right-4 z-[100] md:bottom-10 md:right-10 md:left-auto md:max-w-sm"
        >
          <div className="flex flex-col gap-4 rounded-3xl border border-blue-100 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg shadow-blue-200 dark:bg-slate-800 dark:shadow-none">
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
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black text-gray-900 dark:text-white">
                  {isStorePrompt ? storeContent.title : "تثبيت تطبيق سوقك"}
                </h3>
                <p className="mt-1 text-sm font-bold text-blue-600">
                  {isStorePrompt ? storeContent.subtitle : "اجعل سوقك أقرب إليك"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                  {isStorePrompt
                    ? storeContent.description
                    : "ثبت التطبيق على هاتفك للوصول السريع وتجربة تصفح أفضل حتى مع الإنترنت الضعيف."}
                </p>
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
              <button
                type="button"
                onClick={handleInstallClick}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95"
              >
                تثبيت الآن
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="px-6 bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-300 font-bold py-3 rounded-2xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-all"
              >
                لاحقاً
              </button>
            </div>
          </div>
        </motion.div>
      )}
      {showInstallGuide && isAndroidStorePwaGuide && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 p-3 sm:p-5"
          dir="rtl"
          onClick={(event) => {
            if (event.target === event.currentTarget) handleInstallGuideDismiss();
          }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="store-pwa-install-guide-title"
            initial={{ y: 20, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:p-6"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16V4m0 0L7 9m5-5 5 5M5 14v5a1 1 0 001 1h12a1 1 0 001-1v-5" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="store-pwa-install-guide-title" className="text-lg font-black text-slate-950 dark:text-white">
                  ثبّت تطبيق المتجر
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  استمتع بتجربة تسوق أسهل وأسرع.
                </p>
              </div>
              <button
                type="button"
                onClick={handleInstallGuideDismiss}
                aria-label="إغلاق إرشادات التثبيت"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <ol className="mt-5 space-y-3">
              <li className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/70">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm dark:bg-slate-700 dark:text-slate-100">
                  <svg aria-hidden="true" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" />
                  </svg>
                </span>
                <span className="text-sm font-bold leading-6 text-slate-800 dark:text-slate-100"><b className="ml-1 text-blue-700 dark:text-blue-300">1.</b>اضغط على النقاط الثلاث أعلى الشاشة.</span>
              </li>
              <li className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/70">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-300">
                  <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7v7m-1-6-9 9M5 5h5M5 9V5m0 0h5m9 6v8H5v-8" />
                  </svg>
                </span>
                <span className="text-sm font-bold leading-6 text-slate-800 dark:text-slate-100"><b className="ml-1 text-blue-700 dark:text-blue-300">2.</b>اختر «فتح في Chrome».</span>
              </li>
              <li className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/70">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-300">
                  <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v3h14v-3" />
                  </svg>
                </span>
                <span className="text-sm font-bold leading-6 text-slate-800 dark:text-slate-100"><b className="ml-1 text-blue-700 dark:text-blue-300">3.</b>اضغط على «تثبيت التطبيق».</span>
              </li>
            </ol>

            <button
              type="button"
              onClick={handleInstallGuideDismiss}
              className="mt-5 min-h-12 w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 active:scale-[0.99] dark:shadow-none"
            >
              فهمت
            </button>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
