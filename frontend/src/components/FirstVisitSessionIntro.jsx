import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const INTRO_KEY = "suqaq_intro_seen";

export default function FirstVisitSessionIntro() {
  const [isVisible, setIsVisible] = useState(false);
  const [startExit, setStartExit] = useState(false);

  const finishIntro = useCallback(() => {
    setStartExit(true);
    setTimeout(() => {
      setIsVisible(false);
      sessionStorage.setItem(INTRO_KEY, "true");
      document.body.style.overflow = "";
    }, 600);
  }, []);

  useEffect(() => {
    const hasSeenIntro = sessionStorage.getItem(INTRO_KEY);
    if (!hasSeenIntro) {
      setIsVisible(true);
      document.body.style.overflow = "hidden";

      const timer = setTimeout(() => {
        finishIntro();
      }, 4000);

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = "";
      };
    }
  }, [finishIntro]);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      {!startExit && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-white overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-sky-50 via-white to-blue-50" />

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="relative z-10 flex flex-col items-center justify-center px-6"
          >
            <div className="mb-5 flex items-center justify-center">
              <img
                src="/opening-logo.svg"
                alt="شعار سوقك"
                className="h-28 w-auto drop-shadow-[0_12px_30px_rgba(37,99,235,0.18)]"
              />
            </div>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2, duration: 0.6 }}
              className="text-center text-2xl sm:text-3xl font-black text-blue-700"
            >
              سوق اليمن بين يديك
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2, duration: 0.5 }}
              className="mt-8 w-56 sm:w-64"
            >
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-blue-100">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ delay: 2, duration: 2, ease: "easeInOut" }}
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-700"
                />
              </div>

              <p className="mt-3 text-center text-sm font-medium text-slate-600">
                جار تجهيز السوق
              </p>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
