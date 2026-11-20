import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { canInstallPWA, installPWA, isStandalonePWA } from "../utils/pwaInstall.js";
import StorePwaInstallGuideModal from "./StorePwaInstallGuideModal.jsx";
import { getStorePwaInstallContent } from "../utils/storePwaInstallPrompt.js";
import { buildStorePwaIconUrl } from "../utils/storePwa.js";
import {
  canShowStorePwaInstallGuide,
  createStorePwaInstallGuideController,
  dismissStorePwaInstallGuide,
  hasStorePwaInstallAttempt,
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
    if (!hasStorePwaInstallAttempt(location.search)) return;
    const params = new URLSearchParams(location.search);
    params.delete("pwaInstallAttempt");
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
        <StorePwaInstallGuideModal
          initialPlatform="android"
          onClose={handleInstallGuideDismiss}
        />
      )}
    </AnimatePresence>
  );
}
