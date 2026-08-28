import React, { useState, useEffect, useRef } from "react";
import { useCategoryApi } from "../api/categories.js";
import { Link } from "react-router-dom";
import { useAdsQuery } from "../hooks/useAdsQuery.js";
import { uploadsUrl } from "../lib/uploads.js";

export default function CategoryGrid({ isHome = false }) {
  const { prefetchCategoryAds } = useAdsQuery();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const categoryApi = useCategoryApi();
  const scrollRef = useRef(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const response = await categoryApi.getMainCategories();
      setCategories(response.data);
    } catch (error) {
      console.error("Error loading categories:", error);
    } finally {
      setLoading(false);
    }
  };

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
    return (
      <div className="relative w-full px-4 overflow-hidden">
        <div className="flex overflow-x-auto pb-4 pt-2 gap-4 scrollbar-hide">
          <div className="flex flex-col flex-wrap h-[340px] sm:h-[380px] gap-4">
            {[...Array(16)].map((_, i) => (
              <div 
                key={i} 
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl w-[165px] h-[180px] flex-shrink-0 animate-pulse flex flex-col items-center p-4"
              >
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-3"></div>
                <div className="h-4 w-24 bg-slate-100 dark:bg-slate-800 rounded-full mb-2"></div>
                <div className="h-3 w-16 bg-slate-50 dark:bg-slate-800/50 rounded-full"></div>
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
        className="flex overflow-x-auto pb-1 sm:pb-4 pt-2 gap-2 sm:gap-4 scrollbar-hide snap-x snap-mandatory scroll-smooth"
      >
        {/* We use a flex-col flex-wrap wrapper with fixed height to create 2 rows if many categories */}
        <div className={`flex ${isHome ? (categories.length > 4 ? "flex-row sm:flex-col sm:flex-wrap sm:h-[380px]" : "flex-row") : (categories.length > 4 ? "flex-col flex-wrap h-[340px] sm:h-[380px]" : "flex-row")} gap-3 sm:gap-4`}>
          {categories.map((category, index) => (
            <Link
              key={category.id}
              to={`/category/${category.slug}`}
              onMouseEnter={() => prefetchCategoryAds(category.name)}
              className="group relative flex flex-col items-center p-0 sm:p-4 rounded-none sm:rounded-3xl bg-transparent sm:bg-white dark:bg-transparent sm:dark:bg-slate-900 border-0 sm:border border-slate-100 dark:border-slate-800 shadow-none sm:shadow-sm transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 hover:border-blue-300 dark:hover:border-blue-900 hover:-translate-y-1.5 snap-start w-[72px] sm:w-[165px] h-[112px] sm:h-[180px] flex-shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Icon Container */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 bg-slate-100 dark:bg-slate-800/50 rounded-full sm:rounded-2xl border border-slate-200 dark:border-slate-700 sm:border-0 flex items-center justify-center mb-1.5 sm:mb-3 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-all duration-300">
                {category.image ? (
                  <img
                    src={uploadsUrl(category.image, "thumb")}
                    alt={category.name}
                    loading="lazy"
                    className="w-14 h-14 sm:w-16 sm:h-16 object-contain transition-transform duration-500 group-hover:scale-110"
                  />
                ) : (
                  <svg className="w-11 h-11 sm:w-14 sm:h-14 text-slate-400 group-hover:text-blue-500 transition-colors duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </div>

              {/* Text Container */}
              <div className="flex flex-col items-center text-center w-full min-h-0 sm:min-h-[50px] justify-center overflow-hidden">
                <h3 className="text-[11px] sm:text-[14px] font-black text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 leading-tight px-1 mb-0.5 sm:mb-1">
                  {category.name}
                </h3>
                <span className="text-[8px] sm:text-[11px] font-bold text-slate-400 dark:text-slate-500 group-hover:text-blue-500/70 transition-colors">
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
