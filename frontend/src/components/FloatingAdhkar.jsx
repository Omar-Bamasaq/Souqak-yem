import React, { useState, useEffect, useRef } from "react";

/**
 * FloatingAdhkar Component
 * Displays short periodic reminders (Adhkar) to the user.
 * Lightweight, no API calls, fully client-side.
 */

const ADHKAR_LIST = [
  "سبحان الله",
  "الحمد لله",
  "الله أكبر",
  "أستغفر الله",
  "لا إله إلا الله",
  "سبحان الله وبحمده",
  "لا حول ولا قوة إلا بالله",
  "اللهم صل وسلم على نبينا محمد"
];

export default function FloatingAdhkar() {
  const [isVisible, setIsVisible] = useState(false);
  const [currentDhikr, setCurrentDhikr] = useState("");
  const [isEnabled, setIsEnabled] = useState(() => {
    const saved = localStorage.getItem("showAdhkar");
    // Default to true for new users
    return saved === null ? true : saved === "true";
  });

  const lastDhikrRef = useRef("");
  const timerRef = useRef(null);
  const hideTimerRef = useRef(null);

  // Clear all active timers to prevent memory leaks
  const clearTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  };

  // Schedule the next dhikr display
  const scheduleNext = (delay) => {
    clearTimers();
    timerRef.current = setTimeout(showDhikr, delay);
  };

  const showDhikr = () => {
    if (!localStorage.getItem("showAdhkar") && localStorage.getItem("showAdhkar") !== null) {
        if (localStorage.getItem("showAdhkar") === "false") return;
    }

    let nextDhikr;
    // Avoid immediate repetition if possible
    do {
      nextDhikr = ADHKAR_LIST[Math.floor(Math.random() * ADHKAR_LIST.length)];
    } while (nextDhikr === lastDhikrRef.current && ADHKAR_LIST.length > 1);

    setCurrentDhikr(nextDhikr);
    lastDhikrRef.current = nextDhikr;
    setIsVisible(true);

    // Auto-hide after 10 seconds
    hideTimerRef.current = setTimeout(() => {
      handleClose();
    }, 10 * 1000);
  };

  const handleClose = () => {
    setIsVisible(false);
    clearTimers();
    // After closing (auto or manual), wait 5 minutes before the next one
    scheduleNext(5 * 60 * 1000);
  };

  useEffect(() => {
    // Check initial state
    const saved = localStorage.getItem("showAdhkar");
    const initialEnabled = saved === null ? true : saved === "true";
    setIsEnabled(initialEnabled);

    if (initialEnabled) {
      // First appearance after 3 minutes of entry
      scheduleNext(3 * 60 * 1000);
    }

    // Listen for toggle events from settings
    const handleToggle = () => {
      const updated = localStorage.getItem("showAdhkar") === "true";
      setIsEnabled(updated);
      if (!updated) {
        setIsVisible(false);
        clearTimers();
      } else {
        // If re-enabled, start the 3-minute cycle
        scheduleNext(3 * 60 * 1000);
      }
    };

    window.addEventListener("adhkar:toggle", handleToggle);
    // Also listen for storage changes from other tabs
    window.addEventListener("storage", (e) => {
      if (e.key === "showAdhkar") handleToggle();
    });

    return () => {
      window.removeEventListener("adhkar:toggle", handleToggle);
      window.removeEventListener("storage", handleToggle);
      clearTimers();
    };
  }, []);

  if (!isEnabled || !isVisible) return null;

  return (
    <div className="fixed top-[75px] right-4 z-[45] animate-in fade-in slide-in-from-top-2 duration-500">
      <div className="flex items-center gap-3 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 py-2.5 shadow-xl shadow-blue-100/50 dark:shadow-slate-950/50 border border-blue-100 dark:border-slate-800 ring-4 ring-blue-50/50 dark:ring-slate-900/50">
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
        <span className="text-sm font-black text-blue-700 dark:text-blue-400">
          {currentDhikr}
        </span>
        <button 
          onClick={handleClose}
          className="flex h-6 w-6 items-center justify-center rounded-xl bg-gray-50 dark:bg-slate-800 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-90"
          aria-label="إغلاق"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
