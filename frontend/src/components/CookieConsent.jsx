import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try {
      const v = localStorage.getItem("cookieConsent");
      setVisible(v !== "accepted");
    } catch {
      setVisible(true);
    }
  }, []);
  if (!visible) return null;
  return (
    <div className="fixed inset-x-0 bottom-[80px] md:bottom-0 z-50">
      <div className="mx-auto max-w-6xl px-4 pb-4">
        <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border bg-white/95 p-4 shadow-xl backdrop-blur-md sm:flex-row sm:items-center">
          <div className="text-sm font-bold text-gray-800 leading-relaxed">
            نستخدم ملفات تعريف الارتباط لتحسين تجربتك وتحليل الاستخدام. بالمتابعة، فإنك توافق على{" "}
            <Link to="/privacy" className="text-blue-600 underline hover:text-blue-700">سياسة الخصوصية</Link> و{" "}
            <Link to="/terms" className="text-blue-600 underline hover:text-blue-700">الشروط والأحكام</Link>.
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              className="flex-1 sm:flex-none rounded-xl bg-blue-600 px-6 py-2 text-sm font-black text-white hover:bg-blue-700 transition-all active:scale-95"
              onClick={() => {
                try { localStorage.setItem("cookieConsent", "accepted"); } catch {}
                setVisible(false);
              }}
            >
              موافق
            </button>
            <Link to="/privacy" className="flex-1 sm:flex-none text-center rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all">اعرف المزيد</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

