import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the default browser prompt
      e.preventDefault();
      // Store the event so it can be triggered later
      setDeferredPrompt(e);
      
      // Check if user has already dismissed it in this session
      const isDismissed = sessionStorage.getItem("pwa_prompt_dismissed");
      if (!isDismissed) {
        // Show the custom prompt after a delay
        setTimeout(() => setShowPrompt(true), 5000);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Check if already installed
    window.addEventListener("appinstalled", () => {
      setDeferredPrompt(null);
      setShowPrompt(false);
      console.log("PWA was installed");
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the browser install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);

    // We've used the prompt, and can't use it again
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem("pwa_prompt_dismissed", "true");
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-24 left-4 right-4 z-[100] md:bottom-10 md:right-10 md:left-auto md:max-w-sm"
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-blue-100 dark:border-slate-800 flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-none flex-shrink-0">
                <svg className="w-9 h-9 text-white" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M156 220C156 200 172 184 192 184H320C340 184 356 200 356 220V380C356 400 340 416 320 416H192C172 416 156 400 156 380V220Z" stroke="currentColor" strokeWidth="32" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M200 184V152C200 121.072 225.072 96 256 96C286.928 96 312 121.072 312 152V184" stroke="currentColor" strokeWidth="32" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M256 340C235 340 220 310 220 310" stroke="currentColor" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M256 275C248 275 240 260 240 260" stroke="currentColor" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M256 340C277 340 292 310 292 310" stroke="currentColor" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M256 275C264 275 272 260 272 260" stroke="currentColor" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black text-gray-900 dark:text-white">تثبيت تطبيق سوقك</h3>
                <p className="text-sm font-bold text-blue-600 mt-1">اجعل سوقك أقرب إليك</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                  ثبت التطبيق على هاتفك للوصول السريع وتجربة تصفح أفضل حتى مع الإنترنت الضعيف.
                </p>
              </div>
              <button 
                onClick={handleDismiss}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleInstallClick}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95"
              >
                تثبيت الآن
              </button>
              <button
                onClick={handleDismiss}
                className="px-6 bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-300 font-bold py-3 rounded-2xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-all"
              >
                لاحقاً
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
