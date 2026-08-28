import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../store/AuthContext.jsx";

export default function CommissionReminderBar() {
  const api = useApi();
  const { user } = useAuth();
  const location = useLocation();
  const [summary, setSummary] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  const onCommissionPages =
    location.pathname.startsWith("/commission") ||
    location.pathname.startsWith("/seller/commissions") ||
    location.pathname.startsWith("/admin");

  useEffect(() => {
    if (!user) {
      setSummary(null);
      return;
    }
    let cancelled = false;
    api
      .get("/commissions/status-summary")
      .then((res) => {
        if (cancelled) return;
        setSummary(res.data || null);
      })
      .catch(() => {
        if (cancelled) return;
        setSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [api, user, location.pathname]);

  if (!user || onCommissionPages || dismissed) {
    return null;
  }

  if (!summary) {
    return null;
  }

  const unpaidCount = Number(summary.unpaidCount || 0);
  const overdueCount = Number(summary.overdueCount || 0);
  const total = unpaidCount + overdueCount;
  if (total <= 0) {
    return null;
  }

  const totalAmount = Number(summary.totalUnpaidAmount || 0);
  const currency = summary.currency || "YER_ADEN";
  const firstUnpaidAdId = summary.firstUnpaidAdId?._id || summary.firstUnpaidAdId || null;

  const getCurrencySymbol = (code) => {
    const symbols = {
      USD: "$",
      SAR: "ر.س",
      YER_ADEN: "ر.ي (عدن)",
      YER_SANAA: "ر.ي (صنعاء)",
      YER: "ر.ي",
    };
    return symbols[code] || "ر.ي";
  };

  const isOverdueOnly = overdueCount > 0 && unpaidCount === 0;
  const isSevere = overdueCount > 0;

  const payLink =
    total === 1 && firstUnpaidAdId
      ? `/commission/pay?adId=${firstUnpaidAdId}`
      : "/seller/commissions";

  return (
    <div className="w-full z-40">
      <div
        className={`w-full ${
          isSevere
            ? "bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 text-white"
            : "bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500 text-white"
        } shadow-xl`}
      >
        <div className="relative max-w-6xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-center gap-3 sm:gap-5">
          <div
            className={`flex-shrink-0 w-11 h-11 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center ${
              isSevere ? "bg-white/20" : "bg-white/20"
            } backdrop-blur-sm border border-white/30`}
          >
            <svg
              className="w-6 h-6 sm:w-7 sm:h-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 sm:mb-1 flex-wrap">
              <h3 className="text-[13px] sm:text-base font-black tracking-tight leading-tight">
                {isOverdueOnly
                  ? `تحذير: لديك ${overdueCount} عمولة متأخرة يجب سدادها فوراً`
                  : overdueCount > 0
                  ? `تنبيه هام: لديك ${total} عمولة ${overdueCount} منها متأخرة`
                  : `تذكير: لديك ${unpaidCount} عمولة مستحقة الدفع`}
              </h3>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-xl text-[10px] font-black border ${
                  isSevere
                    ? "bg-white/25 border-white/40"
                    : "bg-white/20 border-white/30"
                }`}
              >
                إجمالي المستحق: {totalAmount.toLocaleString()}{" "}
                {getCurrencySymbol(currency)}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs font-bold opacity-95 leading-relaxed">
              {isSevere
                ? "تأخير سداد العمولة قد يؤدي إلى تعليق خدمات نشر الإعلانات والمزايا الخاصة بك. يرجى سداد المبلغ المستحق لضمان استمرارية حسابك."
                : "سداد العمولة يدعم استمرارية المنصة ويضمن لك الحفاظ على صلاحيات البائع الكاملة ورفع نسبة ثقتك مع المشترين."}
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <Link
              to={payLink}
              className={`hidden sm:inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-sm transition-all active:scale-95 shadow-lg ${
                isSevere
                  ? "bg-white text-red-700 hover:bg-red-50 shadow-red-900/20"
                  : "bg-white text-amber-700 hover:bg-amber-50 shadow-amber-900/20"
              }`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {total === 1 ? "دفع العمولة الآن" : "سداد المستحقات"}
            </Link>
            <Link
              to={payLink}
              className={`sm:hidden inline-flex items-center justify-center w-11 h-11 rounded-2xl font-black transition-all active:scale-95 shadow-lg ${
                isSevere
                  ? "bg-white text-red-700 shadow-red-900/20"
                  : "bg-white text-amber-700 shadow-amber-900/20"
              }`}
              title="دفع العمولة"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </Link>
            <button
              onClick={() => setDismissed(true)}
              className={`flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all hover:bg-white/20 active:scale-95 ${
                isSevere ? "text-white" : "text-white"
              }`}
              title="إخفاء التذكير"
            >
              <svg
                className="w-5 h-5 sm:w-5 sm:h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
