import React, { useEffect, useState } from "react";

const SESSION_INTRO_KEY = "souqak_app_opening_seen";

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

export default function AppOpeningIntro() {
  const [isVisible, setIsVisible] = useState(false);
  const [showTagline, setShowTagline] = useState(false);
  const [showLoader, setShowLoader] = useState(false);

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
    if (!isVisible) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
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
  );
}
