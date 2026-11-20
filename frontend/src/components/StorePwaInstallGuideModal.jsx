import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getStorePwaInstallGuidePlatform } from "../utils/storePwaInstallGuide.js";

export default function StorePwaInstallGuideModal({
  initialPlatform,
  onClose,
  onContinue
}) {
  const [platform, setPlatform] = useState(() => initialPlatform || getStorePwaInstallGuidePlatform({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints
  }));
  const isAndroid = platform === "android";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 p-3 sm:p-5"
        dir="rtl"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v3h14v-3" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="store-pwa-install-guide-title" className="text-lg font-black text-slate-950 dark:text-white">
                تنزيل تطبيق المتجر
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                اختر جهازك لعرض خطوات تنزيل التطبيق.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق إرشادات تنزيل التطبيق"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2" role="group" aria-label="اختر نوع الجهاز">
            <button
              type="button"
              aria-pressed={isAndroid}
              onClick={() => setPlatform("android")}
              className={`min-h-11 rounded-xl px-3 py-2 text-sm font-bold transition ${isAndroid ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}
            >
              Android
            </button>
            <button
              type="button"
              aria-pressed={!isAndroid}
              onClick={() => setPlatform("iphone")}
              className={`min-h-11 rounded-xl px-3 py-2 text-sm font-bold transition ${!isAndroid ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}
            >
              iPhone
            </button>
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-800 dark:bg-slate-800/70 dark:text-slate-100">
            {isAndroid ? (
              <p>
                إذا لم يظهر خيار تنزيل التطبيق، فقد تكون داخل المتصفح المدمج. اضغط على النقاط الثلاث أعلى الشاشة، ثم اختر فتح في Chrome. بعد فتح الصفحة في Chrome، اختر تثبيت التطبيق أو إضافة إلى الشاشة الرئيسية.
              </p>
            ) : (
              <p>
                افتح صفحة المتجر في Safari، ثم اضغط زر المشاركة واختر إضافة إلى الشاشة الرئيسية.
              </p>
            )}
          </div>

          <div className={`mt-5 flex gap-2 ${onContinue ? "" : "justify-end"}`}>
            {onContinue && (
              <button
                type="button"
                onClick={onContinue}
                className="min-h-12 flex-1 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 active:scale-[0.99] dark:shadow-none"
              >
                إكمال التنزيل
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-h-12 rounded-2xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              إغلاق
            </button>
          </div>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );
}
