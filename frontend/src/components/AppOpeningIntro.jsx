import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../store/AuthContext.jsx";

const SESSION_INTRO_KEY = "souqak_app_opening_seen";
const GUEST_PROMPT_KEY = "souqak_guest_prompt_dismissed";

function hasSeenIntro() {
  try {
    return sessionStorage.getItem(SESSION_INTRO_KEY) === "1";
  } catch {
    return false;
  }
}

function markIntroAsSeen() {
  try {
    sessionStorage.setItem(SESSION_INTRO_KEY, "1");
  } catch {
  }
}

function hasDismissedGuestPrompt() {
  try {
    return sessionStorage.getItem(GUEST_PROMPT_KEY) === "1";
  } catch {
    return false;
  }
}

export default function AppOpeningIntro() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [showTagline, setShowTagline] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);

  const authPages = ["/login", "/register", "/forgot-password", "/phone-forgot-password", "/set-new-password", "/verify-email"];
  const isAuthPage = authPages.includes(location.pathname);

  useEffect(() => {
    if (hasSeenIntro()) return undefined;

    markIntroAsSeen();
    setIsVisible(true);

    const taglineTimer = window.setTimeout(() => setShowTagline(true), 1000);
    const loaderTimer = window.setTimeout(() => setShowLoader(true), 3000);
    const closeTimer = window.setTimeout(() => setIsVisible(false), 4000);

    return () => {
      window.clearTimeout(taglineTimer);
      window.clearTimeout(loaderTimer);
      window.clearTimeout(closeTimer);
    };
  }, []);

  useEffect(() => {
    if (loading || user || isAuthPage || hasDismissedGuestPrompt()) {
      setShowGuestPrompt(false);
      return undefined;
    }

    const splashDelay = hasSeenIntro() ? 0 : 4000;
    const promptTimer = window.setTimeout(() => {
      setShowGuestPrompt(true);
    }, splashDelay + 10000);

    return () => window.clearTimeout(promptTimer);
  }, [loading, user, isAuthPage]);

  useEffect(() => {
    const resetGuestPromptFlag = () => {
      try {
        sessionStorage.removeItem(GUEST_PROMPT_KEY);
      } catch {
      }
    };

    window.addEventListener("beforeunload", resetGuestPromptFlag);
    return () => {
      window.removeEventListener("beforeunload", resetGuestPromptFlag);
    };
  }, []);

  useEffect(() => {
    if (!isVisible && !showGuestPrompt) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isVisible, showGuestPrompt]);

  const dismissGuestPrompt = () => {
    setShowGuestPrompt(false);
    try {
      sessionStorage.setItem(GUEST_PROMPT_KEY, "1");
    } catch {
    }
  };

  const goToLogin = () => {
    dismissGuestPrompt();
    navigate("/login");
  };

  const goToRegister = () => {
    dismissGuestPrompt();
    navigate("/register");
  };

  if (!isVisible && !showGuestPrompt) return null;

  return (
    <>
      {isVisible && (
        <div
          className="opening-screen fixed inset-0 z-[10000] flex flex-col items-center justify-center px-6 text-center"
          role="status"
          aria-live="polite"
          aria-label="جاري فتح سوقك"
        >
          <div className="opening-grid" />
          <div className="opening-orb opening-orb-one" />
          <div className="opening-orb opening-orb-two" />

          <div className="opening-content">
            <div className="opening-logo-stage">
              <span className="opening-ring opening-ring-one" />
              <span className="opening-ring opening-ring-two" />
              <span className="opening-logo-halo" />
              <img
                src="/assets/logo/opening-logo.svg"
                alt="سوقك"
                className="opening-logo h-28 w-28 object-contain sm:h-36 sm:w-36"
              />
            </div>

            <div className={`opening-tagline-wrap ${showTagline ? "is-visible" : ""}`}>
              <p className="opening-tagline text-base font-black sm:text-lg">سوق اليمن بين يديك</p>
              <span className="opening-tagline-line" />
            </div>

            <div className={`opening-status ${showLoader ? "is-visible" : ""}`}>
              <div className="opening-status-label">
                <span>جاري تجهيز السوق</span>
                <span className="opening-dots" aria-hidden="true"><i /> <i /> <i /></span>
              </div>
              <div className="opening-progress-track">
                {showLoader && <div className="opening-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" />}
              </div>
            </div>
          </div>

          <div className="opening-footer-mark"><span /> سوقك <span /> سوق اليمن الرقمي</div>
        </div>
      )}

      {showGuestPrompt && !user && !isAuthPage && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="guest-auth-prompt-title">
          <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center rounded-3xl bg-white p-6 text-center shadow-2xl dark:bg-slate-900 sm:p-7">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2m7-10a4 4 0 100-8 4 4 0 000 8zm7-3v6m3-3h-6" />
              </svg>
            </div>

            <h2 id="guest-auth-prompt-title" className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">قم بالتسجيل للوصول الى كامل خدمات سوقك</h2>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={goToLogin}
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-blue-700"
              >
                لديك حساب؟ سجل دخولك
              </button>

              <button
                type="button"
                onClick={goToRegister}
                className="rounded-xl border-2 border-blue-600 px-4 py-3 text-sm font-black text-blue-700 transition-colors hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/40"
              >
                ليس لديك حساب؟ انشئ حسابك الآن
              </button>

              <button
                type="button"
                onClick={dismissGuestPrompt}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                المتابعة كزائر
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
