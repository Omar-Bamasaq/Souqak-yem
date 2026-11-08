import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../api/axios.js";

const STAT_CARDS = [
  {
    key: "wallet",
    title: "الرصيد المتاح",
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    tone: "blue",
    href: "/wallet"
  },
  {
    key: "revenue",
    title: "إجمالي المبيعات",
    icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
    tone: "emerald",
    href: "/wallet"
  },
  {
    key: "views",
    title: "مشاهدات الإعلانات",
    icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
    tone: "indigo",
    href: "/my-ads"
  },
  {
    key: "orders",
    title: "طلبات الشحن",
    icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
    tone: "amber",
    href: "/wallet"
  }
];

const TONE_CLASSES = {
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",
  indigo: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
};

function getCurrencySymbol(code) {
  const symbols = {
    USD: "$",
    SAR: "ر.س",
    YER_ADEN: "ر.ي (عدن)",
    YER_SANAA: "ر.ي (صنعاء)",
    YER: "ر.ي (عدن)"
  };
  return symbols[code] || "ر.ي (عدن)";
}

function getCardValue(key, analytics) {
  if (key === "wallet") return Number(analytics?.wallet?.availableBalance || 0).toLocaleString();
  if (key === "revenue") return Number(analytics?.orders?.revenue || 0).toLocaleString();
  if (key === "views") return Number(analytics?.ads?.totalViews || 0).toLocaleString();
  return Number(analytics?.orders?.escrow || 0).toLocaleString();
}

function getCardNote(key, analytics) {
  const currency = getCurrencySymbol(analytics?.wallet?.currency);
  if (key === "wallet") return `معلق: ${Number(analytics?.wallet?.pendingBalance || 0).toLocaleString()} ${currency}`;
  if (key === "revenue") return `طلبات مكتملة: ${analytics?.orders?.completed || 0} · ${currency}`;
  if (key === "views") return `المتابعون: ${analytics?.followers || 0}`;
  return `${Number(analytics?.orders?.pendingRevenue || 0).toLocaleString()} ${currency} قيد المعالجة`;
}

export default function SellerStatistics() {
  const api = useApi();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/seller/analytics/overview");
      setAnalytics(response.data);
    } catch (requestError) {
      console.error("Seller statistics load error:", requestError);
      setError("تعذر تحميل الإحصائيات. تحقق من اتصالك ثم أعد المحاولة.");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics, retryCount]);

  return (
    <div dir="rtl" className="mx-auto max-w-5xl space-y-5 px-3 py-4 pb-24 sm:space-y-6 sm:px-5 sm:py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-blue-600 dark:text-blue-400">أداء حسابك</p>
          <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">الإحصائيات</h1>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">ملخص مشاهدات إعلاناتك ومبيعاتك وطلباتك.</p>
        </div>
        <Link to="/account" className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
          العودة إلى حسابي
        </Link>
      </header>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          <span>{error}</span>
          <button type="button" onClick={() => setRetryCount((count) => count + 1)} className="underline">إعادة المحاولة</button>
        </div>
      )}

      <section aria-label="ملخص الإحصائيات" className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {STAT_CARDS.map((card) => (
          <Link key={card.key} to={card.href} className="flex min-h-32 flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-800 dark:bg-slate-900 sm:min-h-36 sm:rounded-3xl sm:p-5">
            {loading ? (
              <div className="animate-pulse space-y-3" aria-label={`تحميل ${card.title}`}>
                <div className="h-4 w-28 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-8 w-20 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-3 w-32 rounded bg-slate-100 dark:bg-slate-800" />
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 sm:text-sm">{card.title}</h2>
                    <p className="mt-2 break-words text-2xl font-black leading-tight text-slate-900 dark:text-white sm:text-3xl">{getCardValue(card.key, analytics)}</p>
                  </div>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${TONE_CLASSES[card.tone]}`}>
                    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={card.icon} />
                    </svg>
                  </span>
                </div>
                <p className="mt-auto truncate border-t border-slate-100 pt-3 text-[10px] font-bold text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:text-xs">{getCardNote(card.key, analytics)}</p>
              </>
            )}
          </Link>
        ))}
      </section>

      {!loading && analytics && (
        <section aria-labelledby="seller-ad-counts" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 id="seller-ad-counts" className="text-base font-black text-slate-900 dark:text-white">حالة إعلاناتي</h2>
            <Link to="/my-ads" className="text-xs font-black text-blue-700 hover:underline dark:text-blue-300">إدارة الإعلانات ←</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "إجمالي الإعلانات", value: analytics.ads?.total, color: "text-slate-800 dark:text-white" },
              { label: "مقبولة", value: analytics.ads?.approved, color: "text-emerald-600 dark:text-emerald-400" },
              { label: "قيد المراجعة", value: analytics.ads?.pending, color: "text-amber-600 dark:text-amber-400" },
              { label: "مباعة / مرفوضة", value: `${analytics.ads?.sold || 0} / ${analytics.ads?.rejected || 0}`, color: "text-slate-700 dark:text-slate-200" }
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{item.label}</p>
                <p className={`mt-1 text-xl font-black ${item.color}`}>{item.value ?? 0}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="text-center text-[11px] font-medium text-slate-400">الأرقام المعروضة ملخصة حسب بيانات الحساب الحالية.</p>
    </div>
  );
}
