import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAdsQuery } from "../hooks/useAdsQuery.js";
import { isConditionEnabled } from "../lib/categoryHelpers.js";
import { uploadsUrl } from "../lib/uploads.js";
import { daysUntil, hoursUntil, formatArabicNumber, formatDaysWord, formatHoursWord } from "../lib/expiry.js";
import { getStoreProductAvailabilityLabel } from "../utils/storeProductDisplay.js";
import { getStoreProductAttributeSummary } from "../utils/storeTemplates.js";

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
function timeAgo(publishedAt, createdAt) {
  const publishedDate = publishedAt ? new Date(publishedAt) : null;
  const createdDate = createdAt ? new Date(createdAt) : null;
  const date = publishedDate && !Number.isNaN(publishedDate.getTime()) && publishedDate.getTime() <= Date.now()
    ? publishedDate
    : createdDate;
  if (!date || Number.isNaN(date.getTime())) return "تاريخ غير متوفر";
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (!isFinite(diff) || diff < 0) return "تاريخ غير متوفر";
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

export default function ProductCard({ product, to, featured = false, governorateName = "", cityName = "", presentationVariant = null, presentationBadge = null, storefrontCardColors = null, onAddToCart, displayMode = "grid" }) {
  const { prefetchAdDetails } = useAdsQuery();
  const isHorizontal = displayMode === "list" && !presentationVariant;
  const storeProfile = product.storeProfileId?.storeName ? product.storeProfileId : null;
  const hasStoreDiscount = Boolean(storeProfile && product.discountEnabled === true && Number.isFinite(Number(product.unitPrice)));
  const usesStoreInventory = Boolean(storeProfile && product.inventoryEnabled === true);
  const isOutOfStock = usesStoreInventory && Number(product.stockQuantity) === 0;
  const storeAvailabilityLabel = getStoreProductAvailabilityLabel(product);
  const storeAttributeSummary = storeProfile ? getStoreProductAttributeSummary(product) : [];
  const presentationCardClass = {
    automotive: "bg-white dark:bg-slate-900 border-emerald-100 dark:border-emerald-950 shadow-sm hover:border-emerald-300",
    "home-furnishings": "bg-white dark:bg-slate-900 border-amber-100 dark:border-amber-950 shadow-sm hover:border-amber-300",
    "consumer-electronics": "bg-white dark:bg-slate-900 border-sky-100 dark:border-sky-950 shadow-sm hover:border-sky-300",
    "family-food": "bg-white dark:bg-slate-900 border-orange-100 dark:border-orange-950 shadow-sm hover:border-orange-300",
    "family-handicrafts": "bg-white dark:bg-slate-900 border-fuchsia-100 dark:border-fuchsia-950 shadow-sm hover:border-fuchsia-300",
    "family-tailoring": "bg-white dark:bg-slate-900 border-teal-100 dark:border-teal-950 shadow-sm hover:border-teal-300"
  }[presentationVariant];
  const imageAspectClass = presentationVariant === "automotive" ? "aspect-[16/10]" : presentationVariant === "consumer-electronics" ? "aspect-square" : "aspect-[4/3]";
  const legacyFamilyBadge = presentationVariant === "family-food"
    ? { icon: "🍲", label: "مأكولات منزلية", className: "border-orange-200 bg-orange-50/95 text-orange-900" }
    : presentationVariant === "family-handicrafts"
      ? { icon: "🧵", label: "حرف يدوية", className: "border-fuchsia-200 bg-fuchsia-50/95 text-fuchsia-900" }
      : presentationVariant === "family-tailoring"
        ? { icon: "🧥", label: "خياطة", className: "border-teal-200 bg-teal-50/95 text-teal-900" }
        : null;
  const familyBadge = presentationBadge || legacyFamilyBadge;
  const priceTextClass = presentationVariant === "automotive"
    ? "text-emerald-800 dark:text-emerald-300"
    : presentationVariant === "home-furnishings"
    ? "text-amber-900 dark:text-amber-300"
    : presentationVariant === "consumer-electronics"
    ? "text-sky-800 dark:text-sky-300"
    : presentationVariant === "family-food"
    ? "text-orange-800 dark:text-orange-300"
    : presentationVariant === "family-handicrafts"
    ? "text-fuchsia-800 dark:text-fuchsia-300"
    : presentationVariant === "family-tailoring"
    ? "text-teal-800 dark:text-teal-300"
    : "text-blue-700 dark:text-blue-400";
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
      if (!product.condition || product.adType === "order" || storeProfile || product.isLegacyStoreListing) return false;
      
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
    }, [product, storeProfile]);

  return (
    <article
      className={`group relative flex ${isHorizontal ? "h-auto flex-row-reverse rounded-2xl" : "h-full flex-col rounded-2xl sm:rounded-[32px]"} overflow-hidden transition-all duration-300 ${isHorizontal ? "hover:shadow-md" : presentationVariant ? "hover:-translate-y-1 hover:shadow-lg" : "hover:-translate-y-2 hover:shadow-[0_20px_50px_rgba(245,158,20,0.2)]"} border ${presentationCardClass || (isHorizontal && featured
          ? "border-amber-300 bg-white shadow-sm dark:border-amber-900 dark:bg-slate-900"
          : featured
          ? `border-amber-400 bg-gradient-to-br from-amber-50 via-amber-100/50 to-amber-50 dark:from-amber-900/40 dark:via-slate-900 dark:to-slate-900 ring-2 ring-amber-400/40 shadow-xl shadow-amber-200/50 ${isHorizontal ? "" : "scale-[1.02]"}`
          : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm hover:border-blue-200 dark:hover:border-blue-900"
      )}${presentationVariant && featured ? " ring-2 ring-amber-400/50" : ""}`}
      style={storefrontCardColors ? {
        backgroundColor: storefrontCardColors.backgroundColor,
        borderColor: `${storefrontCardColors.accentColor}55`
      } : undefined}
    >
      <Link to={to} onMouseEnter={() => prefetchAdDetails(product._id)} aria-label={`عرض ${product.title}`} className="absolute inset-0 z-0 rounded-[inherit]" />
      <div className={`pointer-events-none relative z-10 flex ${isHorizontal ? "w-full flex-row-reverse items-center" : "h-full flex-col"}`}>
      {/* Glow Effect Background */}
      {featured && (
        <div className="absolute inset-0 bg-gradient-to-tr from-amber-200/10 via-transparent to-amber-200/10 pointer-events-none" />
      )}
      {/* Image Container */}
      <div className={`relative ${isHorizontal ? "aspect-square w-[32%] min-w-[88px] max-w-28 shrink-0 self-center sm:h-28 sm:w-28 lg:h-32 lg:w-32" : `${imageAspectClass} w-full`} overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200`}>
        {product.images?.[0] ? (
          <picture className="block h-full w-full">
            <source media="(max-width: 640px)" srcSet={uploadsUrl(product.images[0], "thumb")} />
            <source media="(max-width: 1024px)" srcSet={uploadsUrl(product.images[0], "med")} />
            <img
              src={uploadsUrl(product.images[0])}
              alt={product.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
          </picture>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300">
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {familyBadge && (
          <div className="absolute left-2 top-2 z-10">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-black shadow-sm backdrop-blur-sm ${familyBadge.className}`}>
              <span>{familyBadge.icon}</span>
              {familyBadge.label}
            </span>
          </div>
        )}

        {isHorizontal && product.isAvailableForDelivery === true && (
          <span
            className="absolute bottom-1 right-1 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-amber-200 bg-amber-300/95 text-amber-950 shadow-md"
            title="توصيل متاح"
            aria-label="توصيل متاح"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z" />
              <circle cx="7.5" cy="18" r="1.5" />
              <circle cx="18" cy="18" r="1.5" />
            </svg>
          </span>
        )}

        {/* Badges */}
        {!isHorizontal && <div className="absolute right-2 top-2 flex flex-col gap-1.5 z-10">
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
          {storeProfile && storeAvailabilityLabel && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow-sm ring-1 ring-white/10 ${product.isAvailable === false ? "bg-slate-600" : "bg-emerald-600"}`}>
              {storeAvailabilityLabel}
            </span>
          )}
          {isConditionVisible && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow-sm ring-1 ring-white/10 ${
              product.condition === 'new' ? 'bg-green-500' : 'bg-blue-500'
            }`}>
              {product.condition === 'new' ? 'جديد' : 'مستعمل'}
            </span>
          )}
        </div>}

        {!isHorizontal && product.isAvailableForDelivery === true && (
          <span className="absolute bottom-2 right-2 z-10 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-300/95 px-2.5 py-1 text-[10px] font-black text-amber-950 shadow-md backdrop-blur-sm sm:bottom-3 sm:right-3 sm:px-3 sm:text-xs">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z" />
              <circle cx="7.5" cy="18" r="1.5" />
              <circle cx="18" cy="18" r="1.5" />
            </svg>
            توصيل متاح
          </span>
        )}
        {!isHorizontal && usesStoreInventory && (
          <span className={`absolute right-2 top-12 z-10 rounded-full px-2.5 py-1 text-[10px] font-black shadow-sm ${isOutOfStock ? "bg-slate-700 text-white" : "bg-emerald-100 text-emerald-900"}`}>
            {isOutOfStock ? "نفد المخزون" : `المتبقي: ${Number(product.stockQuantity).toLocaleString("ar-YE")}`}
          </span>
        )}

        {/* Price Tag Overlay */}
        {!isHorizontal && <div className={`absolute bottom-2 left-2 sm:bottom-3 sm:left-3 rounded-xl sm:rounded-2xl bg-white/95 dark:bg-slate-900/95 px-2 py-0.5 sm:px-3 sm:py-1.5 text-[11px] sm:text-base font-black ${priceTextClass} backdrop-blur-md shadow-lg sm:shadow-2xl border border-white/30 dark:border-slate-800 z-10`} style={storefrontCardColors ? { backgroundColor: storefrontCardColors.backgroundColor, borderColor: `${storefrontCardColors.accentColor}55`, color: storefrontCardColors.accentColor } : undefined}>
          {product.priceOnContact ? (
            "تواصل"
          ) : (
            <div className="flex items-baseline gap-1 whitespace-nowrap leading-tight">
              {hasStoreDiscount && (
                <s className="text-[9px] font-bold text-blue-700 decoration-red-500 decoration-1 dark:text-blue-300 sm:text-xs">
                  {Number(product.originalPrice ?? product.price).toLocaleString()}
                </s>
              )}
              <span className={hasStoreDiscount ? "text-rose-700" : ""}>{Number(hasStoreDiscount ? product.unitPrice : product.price)?.toLocaleString()}</span>
              <span className="text-[8px] font-bold opacity-90 sm:text-[10px]">{getCurrencySymbol(product.currency)}</span>
            </div>
          )}
        </div>}
        {!isHorizontal && <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60" />}
      </div>

      {/* Content */}
      <div className={`flex min-w-0 flex-1 flex-col ${isHorizontal ? "gap-1.5 p-2 sm:gap-2 sm:p-3" : "space-y-2 p-3 sm:space-y-3 sm:p-5"}`}>
        {isHorizontal ? (
          <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-4">
            <h3 className="line-clamp-2 min-w-0 flex-1 text-sm font-black leading-5 text-emerald-700 transition-colors group-hover:text-emerald-800 dark:text-emerald-300 dark:group-hover:text-emerald-200 sm:text-lg sm:leading-7" style={storefrontCardColors ? { color: storefrontCardColors.secondaryColor } : undefined}>
              {product.title}
            </h3>
            <div className={`max-w-[64%] shrink-0 text-left font-black leading-tight sm:max-w-[46%] ${priceTextClass}`}>
              {product.priceOnContact ? (
                <span className="text-xs sm:text-sm">تواصل</span>
              ) : (
                <div className="flex items-baseline gap-1 whitespace-nowrap">
                  {hasStoreDiscount && (
                    <s className="text-[10px] font-bold text-blue-700 decoration-red-500 decoration-1 dark:text-blue-300 sm:text-sm">
                      {Number(product.originalPrice ?? product.price).toLocaleString()}
                    </s>
                  )}
                  <span className={`text-base sm:text-xl ${hasStoreDiscount ? "text-rose-700" : ""}`}>
                    {Number(hasStoreDiscount ? product.unitPrice : product.price)?.toLocaleString()}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 sm:text-xs">
                    {getCurrencySymbol(product.currency)}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <h3 className="line-clamp-2 text-[12px] font-black leading-tight text-slate-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400 sm:h-12 sm:text-base sm:leading-relaxed" style={storefrontCardColors ? { color: storefrontCardColors.secondaryColor } : undefined}>
            {product.title}
          </h3>
        )}

        {isHorizontal && (
          <div className="flex flex-wrap items-center gap-1">
            {product.isWelcomePromoted && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">🎁 هدية ترحيبية</span>}
            {featured && !product.isWelcomePromoted && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">⭐ مميز</span>}
            {product.adType === "order" && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">طلب شراء</span>}
            {storeProfile && storeAvailabilityLabel && usesStoreInventory && (
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold sm:px-2 sm:text-[10px] ${product.isAvailable === false || isOutOfStock ? "bg-slate-100 text-slate-700" : "bg-emerald-50 text-emerald-700"}`}>
                {isOutOfStock ? "نفد المخزون" : `${storeAvailabilityLabel} · المتبقي: ${Number(product.stockQuantity).toLocaleString("ar-YE")}`}
              </span>
            )}
            {storeProfile && storeAvailabilityLabel && !usesStoreInventory && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${product.isAvailable === false ? "bg-slate-100 text-slate-700" : "bg-emerald-50 text-emerald-700"}`}>
                {storeAvailabilityLabel}
              </span>
            )}
            {isConditionVisible && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${product.condition === "new" ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"}`}>
                {product.condition === "new" ? "جديد" : "مستعمل"}
              </span>
            )}
            {usesStoreInventory && !(storeProfile && storeAvailabilityLabel) && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isOutOfStock ? "bg-slate-100 text-slate-700" : "bg-emerald-50 text-emerald-700"}`}>
                {isOutOfStock ? "نفد المخزون" : `المتبقي: ${Number(product.stockQuantity).toLocaleString("ar-YE")}`}
              </span>
            )}
            {!storeProfile && (
              <span className={`inline-flex max-w-full items-center gap-1 rounded-full px-1 py-0.5 text-[9px] font-bold ${product.userId?.verificationStatus === "verified" || product.userId?.role === "admin" || product.userId?.isVerifiedSeller
                ? "bg-blue-50 text-blue-700"
                : product.userId?.isTrustedReseller
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 dark:text-slate-300"}`}>
                <span className="flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 font-black dark:bg-slate-700">
                  {product.userId?.avatar ? <img src={uploadsUrl(product.userId.avatar, "thumb")} alt="" className="h-full w-full object-cover" /> : (product.sellerName || product.userId?.name || "?").charAt(0)}
                </span>
                <span className="max-w-[72px] truncate">{product.sellerName || product.userId?.name || "بائع"}</span>
                {(product.userId?.verificationStatus === "verified" || product.userId?.role === "admin" || product.userId?.isVerifiedSeller || product.userId?.isTrustedReseller) && <span aria-label="بائع موثوق">✓</span>}
                {(product.userId?.sellerRating > 0 || product.userId?.resellerRating > 0) && <span className="shrink-0 text-amber-600">★ {(product.userId?.sellerRating || product.userId?.resellerRating).toFixed(1)}</span>}
              </span>
            )}
          </div>
        )}

        {presentationVariant && product.categoryId?.name && <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 sm:text-sm">{product.categoryId.name}</p>}

        {storeAttributeSummary.length > 0 && (
          <dl className={isHorizontal ? "flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] sm:text-[10px]" : `grid gap-1.5 ${presentationVariant === "automotive" ? "grid-cols-2" : "grid-cols-1"}`}>
            {storeAttributeSummary.map((attribute) => (
              <div key={attribute.label} className={`flex min-w-0 items-center gap-1 ${isHorizontal ? "max-w-full" : "justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5 text-[11px]"}`}>
                <dt className="truncate text-slate-500">{attribute.label}</dt>
                <dd className="shrink-0 font-black text-slate-800">{attribute.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className={`flex flex-col ${isHorizontal ? "gap-1" : "mt-auto gap-2 border-t border-slate-100 pt-2 dark:border-slate-800 sm:gap-3 sm:pt-3"}`}>
          {storeProfile && onAddToCart && product.adType !== "order" && product.isAvailable !== false && (
            <button
              type="button"
              disabled={isOutOfStock}
              onClick={() => onAddToCart(product)}
              className="pointer-events-auto min-h-10 rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isOutOfStock ? "نفد المخزون" : "أضف للسلة"}
            </button>
          )}
          {storeProfile && (
            <Link to={`/store/${storeProfile.slug}`} className={`pointer-events-auto flex min-w-0 items-center text-emerald-900 transition-colors hover:text-emerald-700 dark:text-emerald-100 dark:hover:text-emerald-300 ${isHorizontal ? "gap-1" : "gap-2 rounded-xl bg-emerald-50 px-2 py-1.5 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/70"}`}>
              <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-50 font-black dark:bg-slate-800 ${isHorizontal ? "h-5 w-5 text-[9px]" : "h-7 w-7 rounded-lg text-xs"}`}>
                {storeProfile.logo ? <img src={uploadsUrl(storeProfile.logo, "thumb")} alt="" className="h-full w-full object-cover" /> : storeProfile.storeName.charAt(0)}
              </span>
              <span className={`truncate font-black ${isHorizontal ? "text-[10px] sm:text-xs" : "text-xs"}`}>{storeProfile.storeName}</span>
              <span className={`shrink-0 font-bold ${isHorizontal ? "text-[9px] sm:text-[10px]" : "text-[10px]"}`}>{storeProfile.storeType === "family-production" ? "أسرة منتجة" : "متجر"}</span>
            </Link>
          )}
          {/* User Info Row */}
          {!isHorizontal && !storeProfile && <div className={`flex items-center gap-1.5 sm:gap-2 w-fit max-w-full rounded-xl p-1 transition-all sm:rounded-2xl sm:p-1.5 ${
            (product.userId?.verificationStatus === 'verified' || product.userId?.role === 'admin' || product.userId?.isVerifiedSeller) 
              ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
              : product.userId?.isTrustedReseller
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
              : featured
              ? "bg-amber-100/50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 border border-amber-200 dark:border-amber-800"
              : isHorizontal ? "text-slate-700 dark:text-slate-300" : "bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300"
          }`}>
            <div className={`flex ${isHorizontal             ? "h-5 w-5 sm:h-8 sm:w-8" : "h-5 w-5 sm:h-8 sm:w-8"} items-center justify-center rounded-lg sm:rounded-xl text-[10px] sm:text-sm font-black border shrink-0 overflow-hidden ${
              (product.userId?.verificationStatus === 'verified' || product.userId?.role === 'admin' || product.userId?.isVerifiedSeller || product.userId?.isTrustedReseller)
                ? "bg-white/20 border-white/30 text-white"
                : featured
                ? "bg-amber-200 dark:bg-amber-800 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-200"
                : "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-blue-600 dark:text-blue-400"
            }`}>
              {product.userId?.avatar ? (
                <img src={uploadsUrl(product.userId.avatar, "thumb")} alt="" className="h-full w-full object-cover" />
              ) : (
                (product.sellerName || product.userId?.name || "?").charAt(0)
              )}
            </div>
            <span className={`truncate font-black flex items-center gap-0.5 sm:gap-1 px-0.5 sm:px-1 ${isHorizontal ? "text-[11px] sm:text-sm" : "text-[10px] sm:text-sm"}`}>
              {product.sellerName || product.userId?.name || "بائع"}
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
          </div>}

          {/* Metadata Row (Location, Contacts, Time) */}
          {isHorizontal ? (
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 text-[10px] font-medium text-slate-600 dark:text-slate-300 sm:gap-x-3 sm:text-xs">
              <span className="inline-flex min-w-0 items-center gap-1">
                <svg className="h-3.5 w-3.5 shrink-0 text-slate-400 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                <span className="truncate">
                  {governorateName || product.governorateId?.name || "اليمن"}
                  {(cityName || product.cityId?.name) && ` * ${cityName || product.cityId?.name}`}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap text-slate-500 dark:text-slate-400">
                <svg className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {timeAgo(product.publishedAt, product.createdAt)}
              </span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap text-slate-500 dark:text-slate-400">
                <svg className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                تواصل {product.contactsCount || 0}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-1 sm:gap-1.5">
              <div className="flex items-center justify-between gap-1">
                <div className="flex min-w-0 flex-1 items-center gap-1 text-gray-500 dark:text-slate-400">
                  <svg className="h-2.5 w-2.5 shrink-0 sm:h-3.5 sm:w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  <span className="truncate text-[9px] font-medium sm:text-xs">
                    {governorateName || product.governorateId?.name || "اليمن"}
                    {(cityName || product.cityId?.name) && (
                      <>
                        <span className="mx-1 text-gray-300 dark:text-slate-600">*</span>
                        {cityName || product.cityId?.name}
                      </>
                    )}
                  </span>
                </div>
                <div className="ml-2 flex shrink-0 items-center gap-0.5 text-slate-500 dark:text-slate-400 sm:gap-1">
                  <svg className="h-2.5 w-2.5 shrink-0 sm:h-3.5 sm:w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="text-[9px] font-bold sm:text-xs" title="عدد المتواصلين">{product.contactsCount || 0}</span>
                </div>
              </div>
              <div className="text-[9px] font-medium text-gray-500 dark:text-slate-400 sm:text-[10px]">
                {timeAgo(product.publishedAt, product.createdAt)}
              </div>
            </div>
          )}
        </div>
        {presentationVariant && <span className="mt-1 inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 px-3 text-xs font-black text-slate-700">عرض التفاصيل</span>}
      </div>
      </div>
    </article>
  );
}
