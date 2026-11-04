import React, { useRef } from "react";
import { Link } from "react-router-dom";
import { useAdsQuery } from "../hooks/useAdsQuery.js";
import { useMainCategories } from "../hooks/useMainCategories.js";
import CategoryIcon from "./CategoryIcon.jsx";

export default function CategoryGrid({ isHome = false, layout = "carousel" }) {
  const { prefetchCategoryAds } = useAdsQuery();
  const { data: categories = [], isLoading: loading } = useMainCategories();
  const scrollRef = useRef(null);
  const isSidebar = layout === "sidebar";

  const scroll = (direction) => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === "left" 
        ? scrollLeft - clientWidth * 0.8 
        : scrollLeft + clientWidth * 0.8;
      
      scrollRef.current.scrollTo({
        left: scrollTo,
        behavior: "smooth"
      });
    }
  };

  if (loading) {
    if (isSidebar) {
      return (
        <div className="grid grid-cols-2 gap-2">
          {[...Array(8)].map((_, index) => (
            <div key={index} className="flex h-20 animate-pulse flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 p-2 dark:bg-slate-800">
              <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="h-3 w-16 rounded-full bg-slate-200 dark:bg-slate-700" />
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="relative w-full overflow-hidden px-4">
        <div className="flex overflow-x-auto pb-4 pt-2 gap-4 scrollbar-hide">
          <div className={`flex ${isHome ? "gap-3 sm:gap-4 flex-row sm:flex-col sm:flex-wrap sm:h-[380px]" : "h-[340px] flex-col flex-wrap gap-4 sm:h-[380px]"}`}>
            {[...Array(16)].map((_, i) => (
              <div 
                key={i} 
                className={`bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl flex-shrink-0 animate-pulse flex flex-col items-center ${isHome ? "h-[88px] w-[72px] p-1 sm:h-[180px] sm:w-[165px] sm:p-4" : "h-[180px] w-[165px] p-4"}`}
              >
                <div className={`${isHome ? "h-10 w-10 sm:h-20 sm:w-20 sm:mb-3" : "mb-3 h-20 w-20"} rounded-2xl bg-slate-100 dark:bg-slate-800`}></div>
                <div className={`mb-2 h-4 rounded-full bg-slate-100 dark:bg-slate-800 ${isHome ? "w-14 sm:w-24" : "w-24"}`}></div>
                <div className={`h-3 rounded-full bg-slate-50 dark:bg-slate-800/50 ${isHome ? "w-10 sm:w-16" : "w-16"}`}></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        لا توجد فئات متاحة.
      </div>
    );
  }

  if (isSidebar) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {categories.map((category) => (
          <Link
            key={category.id}
            to={`/category/${category.slug}`}
            onMouseEnter={() => prefetchCategoryAds(category.name)}
            className="group flex min-h-[88px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-slate-100 bg-white px-2 py-2 text-center shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50/60 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-900 dark:hover:bg-slate-800"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <CategoryIcon
                category={category}
                size={24}
                className="text-slate-500 transition-transform group-hover:scale-110 group-hover:text-blue-600"
              />
            </span>
            <span className="line-clamp-2 text-xs font-bold leading-4 text-slate-800 group-hover:text-blue-700 dark:text-slate-100 dark:group-hover:text-blue-300">
              {category.name}
            </span>
            <span className="text-[10px] font-medium text-slate-400">
              {(category.adCount || 0).toLocaleString("ar-EG")} إعلان
            </span>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="relative w-full group/grid px-0 sm:px-4">
      {/* Navigation Buttons - Visible on Desktop hover */}
      <button 
        onClick={() => scroll("right")}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center bg-white/90 dark:bg-slate-800/90 shadow-lg rounded-full text-slate-700 dark:text-slate-200 opacity-0 group-hover/grid:opacity-100 transition-opacity hover:bg-white dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-700 -mr-2 hidden md:flex"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <button 
        onClick={() => scroll("left")}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center bg-white/90 dark:bg-slate-800/90 shadow-lg rounded-full text-slate-700 dark:text-slate-200 opacity-0 group-hover/grid:opacity-100 transition-opacity hover:bg-white dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-700 -ml-2 hidden md:flex"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Scroll Container */}
      <div 
        ref={scrollRef}
        className="flex overflow-x-auto pb-1 sm:pb-4 pt-1 sm:pt-2 gap-2 sm:gap-4 scrollbar-hide snap-x snap-mandatory scroll-smooth"
      >
        {/* We use a flex-col flex-wrap wrapper with fixed height to create 2 rows if many categories */}
        <div className={`flex ${isHome ? (categories.length > 4 ? "flex-row sm:flex-col sm:flex-wrap sm:h-[380px]" : "flex-row") : (categories.length > 4 ? "flex-col flex-wrap h-[340px] sm:h-[380px]" : "flex-row")} gap-3 sm:gap-4`}>
          {categories.map((category, index) => (
            <Link
              key={category.id}
              to={`/category/${category.slug}`}
              onMouseEnter={() => prefetchCategoryAds(category.name)}
              className={`group relative flex flex-col items-center p-0 sm:p-4 rounded-none sm:rounded-[28px] bg-transparent sm:bg-white/90 dark:bg-transparent sm:dark:bg-slate-900/90 border-0 sm:border border-slate-200/80 dark:border-slate-700/80 shadow-none sm:shadow-[0_16px_35px_-20px_rgba(37,99,235,0.45)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-18px_rgba(59,130,246,0.45)] hover:border-blue-200 dark:hover:border-blue-900 hover:bg-blue-50/70 dark:hover:bg-slate-800/80 snap-start w-[72px] sm:w-[165px] ${isHome ? "h-[88px] sm:h-[180px]" : "h-[112px] sm:h-[180px]"} flex-shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="pointer-events-none absolute inset-x-2 top-2 hidden h-10 rounded-full bg-gradient-to-r from-blue-100/80 via-cyan-100/70 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:block dark:from-blue-950/30 dark:via-cyan-900/25 dark:to-transparent" />

              <div className={`${isHome ? "h-12 w-12 sm:h-20 sm:w-20" : "h-16 w-16 sm:h-20 sm:w-20"} relative z-10 mb-1 flex-shrink-0 rounded-full border border-slate-200/70 bg-gradient-to-br from-slate-100 via-white to-blue-50 shadow-inner shadow-slate-200/70 transition-all duration-300 group-hover:border-blue-200 group-hover:bg-gradient-to-br group-hover:from-blue-100 group-hover:via-white group-hover:to-blue-50 dark:border-slate-700 dark:from-slate-800 dark:via-slate-800 dark:to-slate-900 dark:shadow-slate-950/40 dark:group-hover:border-blue-900 dark:group-hover:from-blue-950/40 dark:group-hover:via-slate-900 dark:group-hover:to-blue-950/30 sm:rounded-[22px] sm:border-0 sm:shadow-md`}>
                <div className="absolute inset-0 rounded-full bg-white/30 opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:rounded-[22px]" />
                <div className="relative z-10 flex h-full w-full items-center justify-center">
                  <CategoryIcon
                    category={category}
                    size={isHome ? 42 : 52}
                    className="text-slate-500 transition-all duration-300 group-hover:scale-110 group-hover:text-blue-600 dark:text-slate-300 dark:group-hover:text-blue-400"
                  />
                </div>
              </div>

              <div className="relative z-10 flex w-full flex-col items-center justify-center overflow-hidden text-center">
                <h3 className={`${isHome ? "text-[10px] sm:text-[14px]" : "text-[11px] sm:text-[14px]"} line-clamp-2 min-h-[2.2em] px-1 font-black leading-tight text-slate-800 transition-colors duration-300 group-hover:text-blue-700 dark:text-slate-100 dark:group-hover:text-blue-300`}>
                  {category.name}
                </h3>
                <span className="mt-1 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[8px] font-bold text-slate-500 transition-all duration-300 group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400 dark:group-hover:border-blue-900 dark:group-hover:bg-blue-950/20 dark:group-hover:text-blue-300 sm:text-[11px]">
                  {(category.adCount || 0).toLocaleString("ar-EG")} إعلان
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Edge Fading for Scroll Indication */}
      <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-slate-50/90 dark:from-slate-950/90 to-transparent pointer-events-none z-10 hidden md:block"></div>
      <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-slate-50/90 dark:from-slate-950/90 to-transparent pointer-events-none z-10 hidden md:block"></div>
    </div>
  );
}
