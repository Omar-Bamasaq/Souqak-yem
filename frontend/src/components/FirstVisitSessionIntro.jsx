import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../store/AuthContext.jsx";
import { motion, AnimatePresence } from "framer-motion";

export default function FirstVisitSessionIntro() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(false);
  const authPages = ["/login", "/register", "/forgot-password", "/phone-forgot-password", "/set-new-password", "/verify-email"];
  const isAuthPage = authPages.includes(location.pathname);

  useEffect(() => {
    if (loading || !user || localStorage.getItem("souqak_new_user_welcome") !== "true") {
      setIsVisible(false);
      return undefined;
    }

    localStorage.removeItem("souqak_new_user_welcome");
    const timer = setTimeout(() => setIsVisible(true), 250);
    return () => clearTimeout(timer);
  }, [loading, user]);

  useEffect(() => {
    if (!isVisible) return undefined;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isVisible]);

  const closeModal = () => setIsVisible(false);

  if (!isVisible || isAuthPage) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guest-welcome-title"
          onClick={closeModal}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white p-6 text-center shadow-2xl dark:bg-slate-900 sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeModal}
              aria-label="إغلاق"
              className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-2xl leading-none text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            >
              ×
            </button>

            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2m7-10a4 4 0 100-8 4 4 0 000 8zm7-3v6m3-3h-6" />
              </svg>
            </div>

            <h2 id="guest-welcome-title" className="text-2xl font-black text-slate-900 dark:text-white">أهلاً بك في سوقك</h2>
            <p className="mt-2 text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">حسابك جاهز. ماذا تريد أن تفعل الآن؟</p>

            <div className="mt-6 grid gap-3">
              <Link to="/choose-add-type" onClick={closeModal} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-blue-700">أضف إعلانك الآن</Link>
              <Link to="/" onClick={closeModal} className="rounded-xl border-2 border-blue-600 px-4 py-3 text-sm font-black text-blue-700 transition-colors hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/40">تصفح السوق</Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
