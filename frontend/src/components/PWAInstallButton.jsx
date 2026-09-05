import React, { useState, useEffect } from "react";
import { canInstallPWA, installPWA } from "../utils/pwaInstall.js";

export default function PWAInstallButton({ mobile = false }) {
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const updateInstallState = () => setCanInstall(canInstallPWA());
    const handleCanInstall = () => updateInstallState();
    const handleInstalled = () => setCanInstall(false);

    window.addEventListener("pwa:can-install", handleCanInstall);
    window.addEventListener("pwa:installed", handleInstalled);

    updateInstallState();

    return () => {
      window.removeEventListener("pwa:can-install", handleCanInstall);
      window.removeEventListener("pwa:installed", handleInstalled);
    };
  }, []);

  const handleClick = () => {
    installPWA();
  };

  if (!canInstall) return null;

  if (mobile) {
    return (
      <button
        onClick={handleClick}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-100 bg-white text-blue-600 shadow-sm transition-all active:scale-90 dark:border-slate-800 dark:bg-slate-900"
        title="تثبيت التطبيق"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="hidden lg:flex items-center gap-2 rounded-full border border-brand-200 bg-white/50 px-4 py-2 text-xs font-black text-brand-600 hover:bg-brand-50 hover:border-brand-300 transition-all active:scale-95 backdrop-blur-sm dark:bg-slate-800/50 dark:border-slate-700 dark:text-brand-400 dark:hover:bg-slate-700"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      <span>تثبيت التطبيق</span>
    </button>
  );
}
