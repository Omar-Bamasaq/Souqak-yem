import React, { useEffect, useMemo, useState } from "react";
import { useApi } from "../api/axios.js";
import { Link } from "react-router-dom";
import { useAuth } from "../store/AuthContext.jsx";
import { t } from "../i18n/index.js";
import { uploadsUrl } from "../lib/uploads.js";
import PlatformReviewModal from "../components/PlatformReviewModal.jsx";
import { useBrokerageStatus } from "../store/BrokerageStatusContext";

export default function SellerDashboard() {
  const api = useApi();
  const { user } = useAuth();
  const { enabled: brokerageEnabled } = useBrokerageStatus();
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [me, setMe] = useState(user);
  const [statusFilter, setStatusFilter] = useState("");
  const [followers, setFollowers] = useState(0);
  const [followersList, setFollowersList] = useState([]);
  const [unpaidCommissions, setUnpaidCommissions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [showRatingModal, setShowRatingModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [adsRes, analyticsRes] = await Promise.all([
        api.get(`/ads/my${statusFilter ? `?status=${statusFilter}` : ""}`),
        api.get("/seller/analytics/overview")
      ]);
      setAds(adsRes.data);
      setAnalytics(analyticsRes.data);
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    (async () => {
      try {
        const r = await api.get("/auth/me");
        setMe(r.data);
        const f = await api.get("/follows/mine/count");
        setFollowers(Number(f.data?.count || 0));
        const fl = await api.get("/follows/followers/mine");
        setFollowersList(fl.data || []);
        
        // Fetch commissions to check for overdue alerts
        const commRes = await api.get("/commissions/mine");
        const overdue = (commRes.data || []).filter(c => {
          if (c.status !== "unpaid") return false;
          const soldDate = new Date(c.soldAt || c.createdAt);
          const diffDays = (Date.now() - soldDate.getTime()) / (1000 * 60 * 60 * 24);
          return diffDays >= 10;
        });
        setUnpaidCommissions(overdue);
      } catch {}
    })();
  }, []);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const featured = useMemo(() => ads.filter((p) => p.featured), [ads]);

  const remainingDays = (d) => {
    if (!d) return 0;
    const ms = new Date(d).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  };

  const getCurrencySymbol = (code) => {
    const symbols = {
      USD: "$",
      SAR: "ر.س",
      YER_ADEN: "ر.ي (عدن)",
      YER_SANAA: "ر.ي (صنعاء)",
      YER: "ر.ي (عدن)"
    };
    return symbols[code] || "ر.ي (عدن)";
  };

  return (
    <div className="space-y-6">
      <h2 className="ds-title">لوحة البائع</h2>

      {/* Analytics Overview Section - Grid 2x2 on Mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 md:gap-4">
        {loading && !analytics ? (
          // Skeletons - square on mobile
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="ds-card animate-pulse bg-gray-100 dark:bg-gray-800 border-none aspect-square md:aspect-auto md:h-32 rounded-2xl md:rounded-3xl"></div>
          ))
        ) : (
          <>
            {/* 1. Wallet Balance Card - Square compact */}
            <div className="ds-card bg-gradient-to-br from-brand-600 to-brand-800 text-white border-none shadow-lg md:shadow-xl rounded-2xl md:rounded-3xl p-3 sm:p-4 md:p-5 flex flex-col aspect-square md:aspect-auto md:h-auto md:min-h-[140px]">
              <div className="flex justify-between items-start flex-1">
                <div className="flex-1 min-w-0">
                  <div className="text-white/80 text-[10px] sm:text-xs md:text-xs font-bold mb-0.5 sm:mb-1">الرصيد المتاح</div>
                  <div className="text-base sm:text-lg md:text-2xl font-black leading-tight break-words">
                    {analytics?.wallet?.availableBalance?.toLocaleString() || 0} 
                  </div>
                  <div className="text-[9px] sm:text-[10px] font-bold text-white/70 mt-0.5 sm:mt-1">{getCurrencySymbol(analytics?.wallet?.currency)}</div>
                </div>
                <div className="p-1.5 sm:p-2 md:p-2 bg-white/20 rounded-lg sm:rounded-xl flex-shrink-0 ml-1.5 sm:ml-2">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-5 md:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="mt-2 sm:mt-4 pt-2 sm:pt-3 border-t border-white/15 flex justify-between items-center gap-1.5">
                <div className="text-[9px] sm:text-[10px] text-white/70 font-bold truncate">
                  معلق: {analytics?.wallet?.pendingBalance?.toLocaleString() || 0}
                </div>
                <Link to="/wallet" className="text-[9px] sm:text-[10px] font-black bg-white/20 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg hover:bg-white/30 transition-colors whitespace-nowrap flex-shrink-0">
                  المحفظة ←
                </Link>
              </div>
            </div>

            {/* 2. Revenue Card - Square compact */}
            <div className="ds-card bg-white dark:bg-slate-800 border-none shadow-sm hover:shadow-md md:hover:shadow-lg transition-shadow rounded-2xl md:rounded-3xl p-3 sm:p-4 md:p-5 flex flex-col aspect-square md:aspect-auto md:h-auto md:min-h-[140px]">
              <div className="flex justify-between items-start flex-1">
                <div className="flex-1 min-w-0">
                  <div className="text-gray-500 dark:text-gray-400 text-[10px] sm:text-xs font-bold mb-0.5 sm:mb-1">إجمالي المبيعات</div>
                  <div className="text-base sm:text-lg md:text-2xl font-black leading-tight break-words text-emerald-600">
                    {analytics?.orders?.revenue?.toLocaleString() || 0}
                  </div>
                  <div className="text-[9px] sm:text-[10px] font-bold text-emerald-500 mt-0.5 sm:mt-1">{getCurrencySymbol(analytics?.wallet?.currency)}</div>
                </div>
                <div className="p-1.5 sm:p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg sm:rounded-xl flex-shrink-0 ml-1.5 sm:ml-2">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
              <div className="mt-2 sm:mt-4 pt-2 sm:pt-3 border-t border-gray-100 dark:border-gray-700/50">
                <span className="inline-block w-full text-center text-[9px] sm:text-[10px] font-bold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/40 px-2 py-0.5 sm:py-1 rounded-full truncate">
                  مكتملة: {analytics?.orders?.completed || 0}
                </span>
              </div>
            </div>

            {/* 3. Ad Views Card - Square compact */}
            <div className="ds-card bg-white dark:bg-slate-800 border-none shadow-sm hover:shadow-md md:hover:shadow-lg transition-shadow rounded-2xl md:rounded-3xl p-3 sm:p-4 md:p-5 flex flex-col aspect-square md:aspect-auto md:h-auto md:min-h-[140px]">
              <div className="flex justify-between items-start flex-1">
                <div className="flex-1 min-w-0">
                  <div className="text-gray-500 dark:text-gray-400 text-[10px] sm:text-xs font-bold mb-0.5 sm:mb-1">مشاهدات الإعلانات</div>
                  <div className="text-xl sm:text-2xl md:text-3xl font-black leading-tight break-words text-blue-600">
                    {analytics?.ads?.totalViews?.toLocaleString() || 0}
                  </div>
                </div>
                <div className="p-1.5 sm:p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg sm:rounded-xl flex-shrink-0 ml-1.5 sm:ml-2">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
              </div>
              <div className="mt-2 sm:mt-4 pt-2 sm:pt-3 border-t border-gray-100 dark:border-gray-700/50">
                <span className="inline-block w-full text-center text-[9px] sm:text-[10px] font-bold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/40 px-2 py-0.5 sm:py-1 rounded-full truncate">
                  المتابعون: {analytics?.followers || 0}
                </span>
              </div>
            </div>

            {/* 4. Escrow/Active Orders Card - Square compact */}
            <div className="ds-card bg-white dark:bg-slate-800 border-none shadow-sm hover:shadow-md md:hover:shadow-lg transition-shadow rounded-2xl md:rounded-3xl p-3 sm:p-4 md:p-5 flex flex-col aspect-square md:aspect-auto md:h-auto md:min-h-[140px]">
              <div className="flex justify-between items-start flex-1">
                <div className="flex-1 min-w-0">
                  <div className="text-gray-500 dark:text-gray-400 text-[10px] sm:text-xs font-bold mb-0.5 sm:mb-1">طلبات الشحن</div>
                  <div className="text-xl sm:text-2xl md:text-3xl font-black leading-tight break-words text-amber-600">
                    {analytics?.orders?.escrow || 0}
                  </div>
                </div>
                <div className="p-1.5 sm:p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg sm:rounded-xl flex-shrink-0 ml-1.5 sm:ml-2">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
              </div>
              <div className="mt-2 sm:mt-4 pt-2 sm:pt-3 border-t border-gray-100 dark:border-gray-700/50">
                <span className="inline-block w-full text-center text-[9px] sm:text-[10px] font-bold text-amber-700 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full truncate">
                  {analytics?.orders?.pendingRevenue?.toLocaleString() || 0} {getCurrencySymbol(analytics?.wallet?.currency)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {unpaidCommissions.length > 0 && (
        <div className="bg-red-50 border-2 border-red-100 rounded-2xl p-4 flex gap-3 items-center animate-pulse">
          <div className="bg-red-600 text-white p-2 rounded-xl shadow-lg">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="text-sm">
            <p className="font-black text-red-900 mb-0.5 text-lg">تنبيه عمولة متأخرة!</p>
            <p className="text-red-700 font-bold leading-relaxed">
              لديك عمولة غير مدفوعة، يرجى السداد خلال 3 أيام لتجنب تعليق الحساب.
            </p>
            <Link to="/seller/commissions" className="inline-block mt-2 text-red-800 font-black hover:underline underline-offset-4 decoration-2">انقر هنا للتفاصيل والسداد ←</Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Profile Card - Replace redundant "Seller Dashboard" link */}
        <Link to={`/s/${user?.id || user?._id || ''}`} className="ds-btn-secondary flex flex-col items-center justify-center gap-2 py-6 text-center h-full border-violet-100 bg-violet-50/30 dark:bg-violet-900/10 dark:border-violet-900/30">
          <div className="p-3 bg-violet-100 dark:bg-violet-900/40 rounded-2xl">
            <svg className="h-6 w-6 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <span className="font-bold text-sm text-violet-700 dark:text-violet-400">الملف الشخصي</span>
        </Link>

        {brokerageEnabled && (
          <>
            <Link to="/brokerage/my-campaigns" className="ds-btn-secondary flex flex-col items-center justify-center gap-2 py-6 text-center h-full border-purple-100 bg-purple-50/30 dark:bg-purple-900/10 dark:border-purple-900/30">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/40 rounded-2xl">
                <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01m-.01 4h.01" />
                </svg>
              </div>
              <span className="font-bold text-sm text-purple-700 dark:text-purple-400">حملاتي للوساطة</span>
            </Link>

            <Link to="/brokerage/campaigns" className="ds-btn-secondary flex flex-col items-center justify-center gap-2 py-6 text-center h-full">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl">
                <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01m-.01 4h.01" />
                </svg>
              </div>
              <span className="font-bold text-sm">الحملات المتاحة</span>
            </Link>
          </>
        )}

        <Link to="/my-ads" className="ds-btn-secondary flex flex-col items-center justify-center gap-2 py-6 text-center h-full">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
            <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 01-2-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <span className="font-bold text-sm">إعلاناتي</span>
        </Link>

        <Link to="/favorites" className="ds-btn-secondary flex flex-col items-center justify-center gap-2 py-6 text-center h-full">
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-2xl">
            <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <span className="font-bold text-sm">المفضلة</span>
        </Link>

        <Link to="/seller/subscriptions" className="ds-btn-secondary flex flex-col items-center justify-center gap-2 py-6 text-center h-full">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl">
            <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
          </div>
          <span className="font-bold text-sm">الاشتراكات والتمييز</span>
        </Link>

        <Link to="/commission/pay" className="ds-btn-secondary flex flex-col items-center justify-center gap-2 py-6 text-center h-full">
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-2xl">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <span className="font-bold text-sm">دفع عمولة الموقع</span>
        </Link>

        {brokerageEnabled && (
          <Link to="/how-it-works#reseller" className="ds-btn-secondary flex flex-col items-center justify-center gap-2 py-6 text-center h-full border-blue-100 bg-blue-50/30 dark:bg-blue-900/10 dark:border-blue-900/30">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-2xl">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-bold text-sm text-blue-700 dark:text-blue-400">كيف أربح؟</span>
          </Link>
        )}

        <Link to="/messages" className="ds-btn-secondary flex flex-col items-center justify-center gap-2 py-6 text-center h-full">
          <div className="p-3 bg-sky-50 dark:bg-sky-900/20 rounded-2xl">
            <svg className="h-6 w-6 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <span className="font-bold text-sm">الرسائل</span>
        </Link>

        <Link to="/following" className="ds-btn-secondary flex flex-col items-center justify-center gap-2 py-6 text-center h-full">
          <div className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-2xl">
            <svg className="h-6 w-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <span className="font-bold text-sm">المتابعة</span>
        </Link>

        <Link to="/account-settings" className="ds-btn-secondary flex flex-col items-center justify-center gap-2 py-6 text-center h-full">
          <div className="p-3 bg-slate-50 dark:bg-slate-900/20 rounded-2xl">
            <svg className="h-6 w-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <span className="font-bold text-sm">إعدادات الحساب</span>
        </Link>

        {/* Rate Us Button */}
        <button 
          onClick={() => setShowRatingModal(true)}
          className="ds-btn-secondary flex flex-col items-center justify-center gap-2 py-6 text-center h-full border-amber-100 bg-amber-50/30 dark:bg-amber-900/10 dark:border-amber-900/30 group"
        >
          <div className="p-3 bg-amber-100 dark:bg-amber-900/40 rounded-2xl group-hover:scale-110 transition-transform">
            <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.921-.755 1.688-1.54 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.784.57-1.838-.197-1.539-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
          <span className="font-bold text-sm text-amber-700 dark:text-amber-400">قيّمنا</span>
        </button>
      </div>

      <PlatformReviewModal 
        isOpen={showRatingModal} 
        onClose={() => setShowRatingModal(false)} 
      />

      {/* بطاقة ترويجية للخدمات الاحترافية */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ترويج تمييز الإعلانات */}
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-white shadow-xl border border-slate-700">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-amber-500/20">🌟</div>
              <h3 className="text-xl font-black">ضاعف مبيعاتك الآن!</h3>
            </div>
            <p className="text-slate-300 text-sm font-bold leading-relaxed mb-6">
              اجعل إعلاناتك في مقدمة نتائج البحث وفي الصفحة الرئيسية بضغطة زر واحدة. الإعلانات المميزة تحصل على مشاهدات أكثر بـ 10 أضعاف.
            </p>
            <Link 
              to="/seller/subscriptions" 
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-xl font-black text-sm transition-all active:scale-95 shadow-lg shadow-amber-500/20"
            >
              تميز الآن
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </Link>
          </div>
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        </div>

        {/* ترويج التوثيق */}
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-600 to-teal-700 p-8 text-white shadow-xl border border-emerald-500/30">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-xl">🛡️</div>
              <h3 className="text-xl font-black">كن بائعاً موثوقاً</h3>
            </div>
            <p className="text-emerald-50 text-sm font-bold leading-relaxed mb-6">
              التوثيق الآن مجاني 100%! احصل على شارة "موثّق" الرسمية لتعزيز ثقة المشترين في متجرك وزيادة فرص البيع.
            </p>
            <Link 
              to="/seller/verification" 
              className="inline-flex items-center gap-2 bg-white text-emerald-700 hover:bg-emerald-50 px-6 py-3 rounded-xl font-black text-sm transition-all active:scale-95 shadow-lg shadow-emerald-900/10"
            >
              وثق حسابك مجاناً
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </Link>
          </div>
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
        </div>
      </div>

      {featured.length > 0 && (
        <div className="ds-section">
          <div className="mb-3 text-sm font-semibold">إعلاناتي المميزة</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {featured.map((p) => (
              <div key={p._id} className="rounded-md border bg-white p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold line-clamp-1">{p.title}</div>
                  <span className="y-chip">👑 مميز</span>
                </div>
                <div className="mt-1 text-xs text-gray-600">ينتهي خلال: {remainingDays(p.featuredUntil)} يوم</div>
                <button
                  className="ds-btn-secondary ds-btn-sm mt-2"
                  onClick={async () => {
                    try {
                      await api.patch(`/ads/${p._id}/unfeature`);
                      load();
                    } catch {}
                  }}
                >
                  إلغاء التمييز
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="ds-card py-3">
          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{t("seller.total")}</div>
          <div className="text-lg font-black">{analytics?.ads?.total || 0}</div>
        </div>
        <div className="ds-card py-3">
          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{t("seller.pending")}</div>
          <div className="text-lg font-black text-amber-500">{analytics?.ads?.pending || 0}</div>
        </div>
        <div className="ds-card py-3">
          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{t("seller.approved")}</div>
          <div className="text-lg font-black text-emerald-500">{analytics?.ads?.approved || 0}</div>
        </div>
        <div className="ds-card py-3">
          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">مباع / مرفوض</div>
          <div className="text-lg font-black text-gray-600">
            {analytics?.ads?.sold || 0} <span className="text-xs font-normal text-gray-400">/</span> {analytics?.ads?.rejected || 0}
          </div>
        </div>
      </div>

      <div className="ds-section p-0">
        <div className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">إعلاناتي</h3>
            <select className="ds-select ds-select-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">الكل</option>
              <option value="pending">قيد الانتظار</option>
              <option value="approved">مقبول</option>
              <option value="rejected">مرفوض</option>
              <option value="sold">المباعة</option>
            </select>
          </div>
        </div>
        {loading && (
          <div className="p-4 text-sm text-gray-600">{t("generic.loading")}</div>
        )}
        {!loading && ads.length === 0 && (
          <div className="p-4 text-sm text-gray-600">لا توجد إعلانات بعد.</div>
        )}
        {!loading && ads.length > 0 && (
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 md:grid-cols-3">
            {ads.map((p) => (
              <div key={p._id} className="group rounded-2xl border bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                <div className="relative h-48 w-full overflow-hidden rounded-xl bg-gray-100">
                  {p.images?.[0] && (
                    <img
                      src={uploadsUrl(p.images[0])}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  )}
                  {p.featured && (
                    <span className="absolute right-2 top-2 z-10 y-chip">👑</span>
                  )}
                </div>
                <div className="mt-2 text-sm font-semibold">{p.title}</div>
                <div className="text-xl font-extrabold text-brand-700">
                  {p.price} {getCurrencySymbol(p.currency)}
                </div>
                <div className="text-xs text-gray-500">
                  {p.governorateId?.name || "-"}
                  {p.governorateId?.name && p.cityId?.name ? " • " : ""}
                  {p.cityId?.name || ""}
                </div>
                <div className="mt-1 text-xs">{t("generic.status")} <span className="uppercase">{p.status}</span></div>
                
                {/* Insights Section */}
                <div className="mt-3 pt-3 border-t border-gray-50 grid grid-cols-3 gap-1 text-center">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">المشاهدات</span>
                    <span className="text-sm font-black text-gray-700">{p.viewCount || 0}</span>
                  </div>
                  <div className="flex flex-col border-x border-gray-50">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">واتساب</span>
                    <span className="text-sm font-black text-green-600">{p.whatsappClicks || 0}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">اتصال</span>
                    <span className="text-sm font-black text-blue-600">{p.phoneClicks || 0}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
