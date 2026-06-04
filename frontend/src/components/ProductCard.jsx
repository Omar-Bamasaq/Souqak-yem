import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAdsQuery } from "../hooks/useAdsQuery.js";
import { isConditionEnabled } from "../lib/categoryHelpers.js";
import { uploadsUrl } from "../lib/uploads.js";
import { daysUntil, hoursUntil, formatArabicNumber, formatDaysWord, formatHoursWord } from "../lib/expiry.js";

function getCurrencySymbol(code) {
  const symbols = {
    USD: "$",
    SAR: "ر.س",
    YER_ADEN: "ر.ي (عدن)",
    YER_SANAA: "ر.ي (صنعاء)",
    YER: "ر.ي (عدن)" // Default old data to Aden as requested/standard
  };
  return symbols[code] || "ر.ي (عدن)";
}
function timeAgo(d) {
  const date = new Date(d);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (!isFinite(diff) || diff < 0) return "";
  if (diff < 60) return "قبل لحظات";
  const minutes = Math.floor(diff / 60);
  if (minutes < 60) {
    if (minutes === 1) return "منذ دقيقة";
    if (minutes === 2) return "منذ دقيقتين";
    if (minutes <= 10) return `منذ ${minutes} دقائق`;
    return `منذ ${minutes} دقيقة`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    if (hours === 1) return "منذ ساعة";
    if (hours === 2) return "منذ ساعتين";
    if (hours <= 10) return `منذ ${hours} ساعات`;
    return `منذ ${hours} ساعة`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    if (days === 1) return "منذ يوم";
    if (days === 2) return "منذ يومين";
    if (days <= 10) return `منذ ${days} أيام`;
    return `منذ ${days} يوم`;
  }
  const weeks = Math.floor(days / 7);
  if (weeks < 4) {
    if (weeks === 1) return "منذ أسبوع";
    if (weeks === 2) return "منذ أسبوعين";
    return `منذ ${weeks} أسابيع`;
  }
  const months = Math.floor(days / 30);
  if (months < 12) {
    if (months === 1) return "منذ شهر";
    if (months === 2) return "منذ شهرين";
    if (months <= 10) return `منذ ${months} أشهر`;
    return `منذ ${months} شهر`;
  }
  const years = Math.floor(days / 365);
  if (years === 1) return "منذ سنة";
  if (years === 2) return "منذ سنتين";
  if (years <= 10) return `منذ ${years} سنوات`;
  return `منذ ${years} سنة`;
}

export default function ProductCard({ product, to, featured = false, governorateName = "", cityName = "" }) {
  const { prefetchAdDetails } = useAdsQuery();
  const expiresAt = useMemo(() => {
    if (product.expiresAt) return product.expiresAt;
    if (product.publishedAt) return new Date(new Date(product.publishedAt).getTime() + 40 * 24 * 60 * 60 * 1000).toISOString();
    if (product.createdAt) return new Date(new Date(product.createdAt).getTime() + 40 * 24 * 60 * 60 * 1000).toISOString();
    return null;
  }, [product]);
  const [remainingDays, setRemainingDays] = useState(daysUntil(expiresAt));
  const [remainingHours, setRemainingHours] = useState(hoursUntil(expiresAt));
  useEffect(() => {
    setRemainingDays(daysUntil(expiresAt));
    setRemainingHours(hoursUntil(expiresAt));
    const id = setInterval(() => {
      setRemainingDays(daysUntil(expiresAt));
      setRemainingHours(hoursUntil(expiresAt));
    }, 60 * 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  const badgeClass =
    remainingDays === 0
      ? "bg-red-50 text-red-700 border-red-200"
      : remainingDays <= 2
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : "bg-emerald-50 text-emerald-800 border-emerald-200";

  const isConditionVisible = useMemo(() => {
      if (!product.condition || product.adType === "order") return false;
      
      // Get the main category name
      // Case 1: parentCategory field is directly on product
      // Case 2: categoryId is populated and has parentId (subcategory)
      // Case 3: categoryId is populated and has no parentId (main category)
      const mainCategoryName = 
        product.parentCategory?.name || 
        product.categoryId?.parentId?.name || 
        product.categoryId?.name || 
        "";

      return isConditionEnabled(mainCategoryName);
    }, [product]);

  return (
    <Link
      to={to}
      onMouseEnter={() => prefetchAdDetails(product._id)}
      className={`group relative flex flex-col overflow-hidden rounded-2xl sm:rounded-[32px] transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_50px_rgba(245,158,11,0.2)] border ${
        featured 
          ? "border-amber-400 bg-gradient-to-br from-amber-50 via-amber-100/50 to-amber-50 dark:from-amber-900/40 dark:via-slate-900 dark:to-slate-900 ring-2 ring-amber-400/40 shadow-xl shadow-amber-200/50 scale-[1.02]" 
          : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm hover:border-blue-200 dark:hover:border-blue-900"
      }`}
    >
      {/* Glow Effect Background */}
      {featured && (
        <div className="absolute inset-0 bg-gradient-to-tr from-amber-200/10 via-transparent to-amber-200/10 pointer-events-none" />
      )}
      {/* Image Container */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
        {product.images?.[0] ? (
          <img
            src={uploadsUrl(product.images[0], "thumb")}
            alt={product.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300">
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Badges */}
        <div className="absolute right-2 top-2 flex flex-col gap-1.5 z-10">
          {product.isWelcomePromoted && (
            <span className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 px-3 py-1 text-[10px] font-black text-white shadow-lg ring-2 ring-white/20">
              <span className="animate-bounce">🎁</span> هدية ترحيبية
            </span>
          )}
          {featured && !product.isWelcomePromoted && (
            <span className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-1 text-[10px] font-black text-white shadow-lg ring-2 ring-white/20">
              <span className="animate-pulse">⭐</span> مميز
            </span>
          )}
          {product.adType === "order" && (
            <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-black text-white shadow-sm ring-1 ring-white/10">
              طلب شراء
            </span>
          )}
          {isConditionVisible && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow-sm ring-1 ring-white/10 ${
              product.condition === 'new' ? 'bg-green-500' : 'bg-blue-500'
            }`}>
              {product.condition === 'new' ? 'جديد' : 'مستعمل'}
            </span>
          )}
        </div>

        {/* Price Tag Overlay */}
        <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 rounded-xl sm:rounded-2xl bg-white/95 dark:bg-slate-900/95 px-2 py-0.5 sm:px-3 sm:py-1.5 text-[11px] sm:text-base font-black text-blue-700 dark:text-blue-400 backdrop-blur-md shadow-lg sm:shadow-2xl border border-white/30 dark:border-slate-800 z-10">
          {product.priceOnContact ? (
            "تواصل"
          ) : (
            <div className="flex flex-col sm:flex-row items-center sm:gap-1 leading-none sm:leading-normal">
              <span>{product.price?.toLocaleString()}</span>
              <span className="text-[8px] sm:text-[10px] opacity-90 font-bold">
                {getCurrencySymbol(product.currency)}
              </span>
            </div>
          )}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60" />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-3 sm:p-5 space-y-2 sm:space-y-3">
        <h3 className="line-clamp-2 text-[12px] sm:text-base font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-tight sm:leading-relaxed h-8 sm:h-12">
          {product.title}
        </h3>

        <div className="flex flex-col mt-auto pt-2 sm:pt-3 border-t border-slate-50 dark:border-slate-800 gap-2 sm:gap-3">
          {/* User Info Row */}
          <div className={`flex items-center gap-1.5 sm:gap-2 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl transition-all w-fit max-w-full ${
            (product.userId?.verificationStatus === 'verified' || product.userId?.role === 'admin' || product.userId?.isVerifiedSeller) 
              ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
              : product.userId?.isTrustedReseller
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
              : featured
              ? "bg-amber-100/50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 border border-amber-200 dark:border-amber-800"
              : "bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300"
          }`}>
            <div className={`flex h-5 w-5 sm:h-8 sm:w-8 items-center justify-center rounded-lg sm:rounded-xl text-[10px] sm:text-sm font-black border shrink-0 overflow-hidden ${
              (product.userId?.verificationStatus === 'verified' || product.userId?.role === 'admin' || product.userId?.isVerifiedSeller || product.userId?.isTrustedReseller)
                ? "bg-white/20 border-white/30 text-white"
                : featured
                ? "bg-amber-200 dark:bg-amber-800 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-200"
                : "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-blue-600 dark:text-blue-400"
            }`}>
              {product.userId?.avatar ? (
                <img src={uploadsUrl(product.userId.avatar, "thumb")} alt="" className="h-full w-full object-cover" />
              ) : (
                (product.userId?.name || "?").charAt(0)
              )}
            </div>
            <span className="text-[10px] sm:text-sm font-black truncate flex items-center gap-0.5 sm:gap-1 px-0.5 sm:px-1">
              {product.userId?.name || "بائع"}
              {(product.userId?.verificationStatus === 'verified' || product.userId?.role === 'admin' || product.userId?.isVerifiedSeller || product.userId?.isTrustedReseller) && (
                <span className="text-white">
                  <svg className="h-3 w-3 sm:h-4 sm:w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </span>
              )}
              
              {/* Seller Rating Stars */}
              {(product.userId?.sellerRating > 0 || product.userId?.resellerRating > 0) && (
                <div className={`flex items-center gap-0.5 mr-1 px-1 rounded-md border ${
                  (product.userId?.verificationStatus === 'verified' || product.userId?.role === 'admin' || product.userId?.isVerifiedSeller || product.userId?.isTrustedReseller)
                    ? "bg-white/20 border-white/10 text-white"
                    : "bg-amber-500/10 border-amber-500/20 text-amber-600"
                }`}>
                  <span className="text-[8px] sm:text-[10px] font-black">
                    {(product.userId?.sellerRating || product.userId?.resellerRating || 0).toFixed(1)}
                  </span>
                  <svg className="h-2 w-2 sm:h-2.5 sm:w-2.5 fill-current text-amber-400" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>
              )}
            </span>
          </div>

          {/* Metadata Row (Location, Views, Time) */}
          <div className="flex flex-col gap-1 sm:gap-1.5">
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1 text-gray-500 dark:text-slate-400 min-w-0 flex-1">
                <svg className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                <span className="text-[9px] sm:text-xs font-medium truncate">
                  {governorateName || product.governorateId?.name || "اليمن"}
                </span>
              </div>
              
              <div className="flex items-center gap-0.5 sm:gap-1 text-blue-500/70 dark:text-blue-400/70 shrink-0">
                <svg className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span className="text-[9px] sm:text-xs font-bold" title="عدد المشاهدات">
                  {product.viewCount || product.views || 0}
                </span>
              </div>

              {/* عدد المتواصلين */}
              <div className="flex items-center gap-0.5 sm:gap-1 text-emerald-500/70 dark:text-emerald-400/70 shrink-0 ml-2">
                <svg className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="text-[9px] sm:text-xs font-bold" title="عدد المتواصلين">
                  {product.contactsCount || 0}
                </span>
              </div>
            </div>

            <div className="text-[9px] sm:text-[10px] font-medium text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-800/50 px-1.5 py-0.5 rounded-md w-fit border border-gray-100 dark:border-slate-700/50">
              {timeAgo(product.createdAt)}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
