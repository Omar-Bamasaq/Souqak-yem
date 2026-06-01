import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { useApi } from "../api/axios.js";
import ProductCard from "../components/ProductCard.jsx";
import AdvancedSearchModal from "../components/AdvancedSearchModal.jsx";

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const api = useApi();
  
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Smart search states
  const [spellingSuggestion, setSpellingSuggestion] = useState(null);
  const [originalQuery, setOriginalQuery] = useState("");
  const [searchTime, setSearchTime] = useState(0);
  const [fromCache, setFromCache] = useState(false);
  const [autoFilters, setAutoFilters] = useState({});
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);
  const [searchInput, setSearchInput] = useState(searchParams.get("q") || "");
  const sentinelRef = useRef(null);

  // Update local search input when URL param changes
  useEffect(() => {
    setSearchInput(searchParams.get("q") || "");
  }, [searchParams]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const newParams = new URLSearchParams(searchParams);
    if (searchInput.trim()) {
      newParams.set("q", searchInput.trim());
    } else {
      newParams.delete("q");
    }
    newParams.set("page", "1");
    navigate(`/search?${newParams.toString()}`);
  };

  const loadResults = useCallback(async () => {
    // If loading is true, don't start a new request, unless it's the initial load
    // but we check it inside to avoid double loading.
    setLoading(true);
    try {
      const currentLimit = 20;
      const isInitialRestore = page > 1 && ads.length === 0;

      const params = {
        page: isInitialRestore ? 1 : page,
        limit: isInitialRestore ? page * currentLimit : currentLimit
      };

      // Add all search params
      for (const [key, value] of searchParams.entries()) {
        if (key !== "page" && key !== "limit") {
          params[key] = value;
        }
      }

      console.log("Smart search params:", params);

      // Use smart search endpoint
      const response = await api.get("/ads/smart-search", { params });
      const data = response.data;
      
      const newItems = data.items || [];
      if (page === 1 || isInitialRestore) setAds(newItems);
      else setAds(prev => [...prev, ...newItems]);
      
      const totalCount = data.total || 0;
      setTotalPages(Math.ceil(totalCount / currentLimit) || 1);
      setTotal(totalCount);
      
      // Smart search metadata
      setSpellingSuggestion(data.spellingSuggestion);
      setOriginalQuery(data.originalQuery || "");
      setAutoFilters(data.autoFilters || {});
      setSearchTime(data.searchTime || 0);
      setFromCache(data.fromCache || false);
    } catch (error) {
      console.error("Error loading search results:", error);
      // Fallback to regular search if smart search fails
      try {
        const currentLimit = 20;
        const isInitialRestore = page > 1 && ads.length === 0;
        const params = { 
          page: isInitialRestore ? 1 : page, 
          limit: isInitialRestore ? page * currentLimit : currentLimit 
        };
        for (const [key, value] of searchParams.entries()) {
          if (key !== "page" && key !== "limit") {
            params[key] = value;
          }
        }
        const response = await api.get("/ads", { params });
        const data = response.data;
        const newItems = data.items || [];
        if (page === 1 || isInitialRestore) setAds(newItems);
        else setAds(prev => [...prev, ...newItems]);
        
        const totalCount = data.total || 0;
        setTotalPages(Math.ceil(totalCount / currentLimit) || 1);
        setTotal(totalCount);
        // Reset smart search states on fallback
        setSpellingSuggestion(null);
        setOriginalQuery("");
        setSearchTime(0);
        setFromCache(false);
      } catch (fallbackError) {
        console.error("Fallback search also failed:", fallbackError);
        setAds([]);
      }
    } finally {
      setLoading(false);
    }
  }, [searchParams, page, api]); // removed ads.length to avoid loop

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  // Infinite Scroll Observer
  useEffect(() => {
    if (loading || page >= totalPages) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setPage(p => p + 1);
      }
    }, { threshold: 0.1 });
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loading, page, totalPages]);

  // Reset page to 1 when any search parameter (including sort) changes
  useEffect(() => {
    setPage(1);
  }, [searchParams]);

  const handleDidYouMeanClick = () => {
    if (spellingSuggestion) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set("q", spellingSuggestion);
      navigate(`/search?${newParams.toString()}`);
    }
  };

  const displayedQuery = searchParams.get("q") || originalQuery || "الكل";
  const showDidYouMean = Boolean(
    spellingSuggestion &&
    originalQuery &&
    spellingSuggestion !== originalQuery
  );
  const modalInitialFilters = {
    q: searchParams.get("q") || "",
    categoryId: searchParams.get("categoryId") || "",
    governorateId: searchParams.get("governorateId") || "",
    cityId: searchParams.get("cityId") || "",
    minPrice: searchParams.get("minPrice") || "",
    maxPrice: searchParams.get("maxPrice") || "",
    condition: searchParams.get("conditions") || "",
    verifiedOnly: searchParams.get("verifiedOnly") || false,
    featuredOnly: searchParams.get("featuredOnly") || false,
    adType: searchParams.get("adType") || "",
    resellerLevel: searchParams.get("resellerLevel") || "",
    performance: searchParams.get("performance") || "",
    isResellEnabled: searchParams.get("isResellEnabled") || false,
    sort: searchParams.get("sort") || "best"
  };

  const setAdType = (type) => {
    const newParams = new URLSearchParams(searchParams);
    if (type) newParams.set("adType", type);
    else newParams.delete("adType");
    newParams.set("page", "1");
    navigate(`/search?${newParams.toString()}`, { replace: true, preventScrollReset: true });
  };

  const currentAdType = searchParams.get("adType") || "";

  const getActiveFilters = () => {
    const filters = [];
    
    if (searchParams.get("q")) filters.push({ label: "كلمة البحث", value: searchParams.get("q") });
    if (searchParams.get("minPrice")) filters.push({ label: "السعر من", value: searchParams.get("minPrice") });
    if (searchParams.get("maxPrice")) filters.push({ label: "السعر إلى", value: searchParams.get("maxPrice") });
    if (searchParams.get("conditions")) filters.push({ label: "الحالة", value: searchParams.get("conditions") });
    
    return filters;
  };

  const activeFilters = getActiveFilters();

  if (loading && page === 1) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 animate-pulse">
          <div className="space-y-2">
            <div className="h-8 bg-gray-200 rounded-lg w-48"></div>
            <div className="h-4 bg-gray-200 rounded-lg w-32"></div>
          </div>
          <div className="h-10 bg-gray-200 rounded-xl w-32"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="aspect-[4/5] bg-gray-200 rounded-3xl animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex-1 space-y-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900">نتائج البحث</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
              <span>{total.toLocaleString("ar-EG")} إعلان وجدنا لك</span>
              {searchTime > 0 && <span className="text-[10px] text-gray-400">({searchTime}ms)</span>}
            </div>
          </div>

          {/* Search Input Field */}
          <form onSubmit={handleSearchSubmit} className="relative w-full max-w-2xl group">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="ابحث عن سيارات، عقارات، إلكترونيات..."
              className="w-full h-12 pr-12 pl-14 bg-white border border-gray-200 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all placeholder:text-gray-400"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {searchInput && (
              <button
                type="button"
                onClick={() => { setSearchInput(""); navigate("/search"); }}
                className="absolute left-14 top-1/2 -translate-y-1/2 p-1 text-gray-300 hover:text-gray-500 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <button
              type="submit"
              className="absolute left-2 top-1/2 -translate-y-1/2 h-8 px-4 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-blue-700 shadow-sm active:scale-95 transition-all"
            >
              بحث
            </button>
          </form>

          {/* Auto-detected filters indicators */}
          {Object.keys(autoFilters).length > 0 && (
            <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-right-4 duration-500">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest self-center ml-1">فلاتر ذكية:</span>
              {autoFilters.condition && (
                <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black border border-amber-100 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-current"></span>
                  حالة: {autoFilters.condition === 'new' ? 'جديد' : 'مستعمل'}
                </span>
              )}
              {autoFilters.adType && (
                <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black border border-blue-100 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-current"></span>
                  نوع: {autoFilters.adType === 'order' ? 'طلب شراء' : 'عرض بيع'}
                </span>
              )}
              {autoFilters.sort && (
                <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black border border-emerald-100 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-current"></span>
                  ترتيب: {autoFilters.sort === 'price_asc' ? 'الأرخص أولاً' : 'الأفضل'}
                </span>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdvancedModal(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 shadow-sm transition-all active:scale-95 h-12"
          >
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span>بحث متقدم</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-gray-100/50 rounded-2xl w-full md:w-fit overflow-x-auto scrollbar-hide">
        {[
          { id: "", label: "الكل", icon: "🌐" },
          { id: "sell", label: "بيع", icon: "💰" },
          { id: "order", label: "طلبات", icon: "📝" },
          { id: "profitable", label: "فرص الربح", icon: "🔥", badge: "جديد" }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setAdType(tab.id)}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex-shrink-0 ${
              currentAdType === tab.id
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.badge && (
              <span className="absolute -top-1 -right-1 flex h-4 w-8 items-center justify-center rounded-full bg-red-500 text-[8px] font-black text-white uppercase tracking-tighter shadow-sm">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Did You Mean Suggestion */}
      {showDidYouMean && (
        <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top duration-300">
          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-blue-900">هل تقصد: <button onClick={handleDidYouMeanClick} className="text-blue-600 underline hover:text-blue-700">{spellingSuggestion}</button>؟</p>
            <p className="text-xs text-blue-700/70 mt-0.5">البحث الأصلي: "{originalQuery}"</p>
          </div>
        </div>
      )}

      {/* Active Filters */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">الفلاتر:</span>
          {activeFilters.map((filter, index) => (
            <div
              key={index}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-xs font-bold border border-gray-200"
            >
              <span className="opacity-60">{filter.label}:</span>
              <span>{filter.value}</span>
            </div>
          ))}
          <button 
            onClick={() => navigate("/search")}
            className="text-xs font-bold text-red-600 hover:underline"
          >
            مسح الكل
          </button>
        </div>
      )}

      {/* Results Grid */}
      {ads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-dashed border-gray-200">
          <div className="h-20 w-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-2">عذراً، لم نجد نتائج!</h2>
          <p className="text-sm text-gray-500 max-w-xs mb-6">جرب استخدام كلمات بحث مختلفة أو قم بإزالة بعض الفلاتر للحصول على نتائج أكثر.</p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
          >
            العودة للرئيسية
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {ads.map((ad, index) => (
              <React.Fragment key={ad._id}>
                {/* External Deal Alert - Inserted after 8 ads */}
                {index === 8 && (
                  <div className="col-span-2 lg:col-span-3 xl:col-span-4 mb-6">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg shadow-blue-500/20">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-lg font-black">حوّل أي منتج خارجي إلى صفقة آمنة</p>
                          <p className="text-sm text-blue-100 font-medium">استخدم نظام الضمان لحماية حقك في أي عملية شراء خارجية</p>
                        </div>
                      </div>
                      <Link
                        to="/secure-purchase-info"
                        className="px-8 py-3 bg-white text-blue-600 rounded-xl text-sm font-black transition-all hover:scale-105 active:scale-95 whitespace-nowrap shadow-sm"
                      >
                        عرض كيف يعمل
                      </Link>
                    </div>
                  </div>
                )}
                <ProductCard
                  product={ad}
                  to={`/ad/${ad._id}`}
                  featured={!!ad.featured}
                />
              </React.Fragment>
            ))}
          </div>

          {/* Infinite Scroll Sentinel & Loading Indicator */}
          <div ref={sentinelRef} className="mt-12 flex flex-col items-center justify-center pb-12 min-h-[100px]">
            {loading && page > 1 && (
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
                <span className="text-xs font-black text-blue-600">جارٍ تحميل المزيد...</span>
              </div>
            )}
            {!loading && page < totalPages && (
              <div className="h-4 w-full" />
            )}
            {page >= totalPages && ads.length > 0 && (
              <span className="text-xs font-bold text-gray-400">لقد وصلت لنهاية النتائج</span>
            )}
          </div>
        </>
      )}

      <AdvancedSearchModal
        isOpen={showAdvancedModal}
        onClose={() => setShowAdvancedModal(false)}
        initialFilters={modalInitialFilters}
      />
    </div>
  );
}
