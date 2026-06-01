import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../store/AuthContext.jsx";
import { useApi } from "../api/axios.js";
import { useAdsQuery } from "../hooks/useAdsQuery.js";
import ProductCard from "../components/ProductCard.jsx";
import CategoryGrid from "../components/CategoryGrid.jsx";
import AdvancedSearchModal from "../components/AdvancedSearchModal.jsx";
import MobileSelect from "../components/MobileSelect.jsx";

export default function Home() {
  const { user } = useAuth();
  const api = useApi();
  const { prefetchCategoryAds, prefetchNextPage } = useAdsQuery();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Filters from URL
  const q = searchParams.get("q") || "";
  const governorateId = searchParams.get("governorateId") || "";
  const minPrice = searchParams.get("minPrice") || "";
  const maxPrice = searchParams.get("maxPrice") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const sort = searchParams.get("sort") || "new";

  const [products, setProducts] = useState([]);
  const [governorates, setGovernorates] = useState([]);
  const [cities, setCities] = useState([]);
  const [popularTags, setPopularTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pages, setPages] = useState(1);
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [platformStats, setPlatformStats] = useState({ avgRating: 0, totalCount: 0 });

  // 1. Prefetch Top Categories on Mount
  useEffect(() => {
    const topCategories = ["سيارات", "عقارات", "إلكترونيات"];
    topCategories.forEach(cat => prefetchCategoryAds(cat));
    
    // Load recently viewed from localStorage
    const recent = JSON.parse(localStorage.getItem("recentlyViewed") || "[]");
    
    // Filter out ads that don't belong to the current user (if logged in)
    // We store userId in the recentlyViewed items for this purpose
    if (user) {
      const userKey = user._id || user.id;
      const userSpecificRecent = recent.filter(item => item.viewerId === userKey);
      setRecentlyViewed(userSpecificRecent);
    } else {
      // For guest, show only items viewed as guest
      const guestRecent = recent.filter(item => !item.viewerId || item.viewerId === "guest");
      setRecentlyViewed(guestRecent);
    }

    // Fetch platform stats
    (async () => {
      try {
        const res = await api.get("/platform-reviews/stats");
        setPlatformStats(res.data);
      } catch (err) {
        console.error("Error fetching platform stats:", err);
      }
    })();
  }, [user]);

  const updateFilters = useCallback((updates) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([key, value]) => {
        if (value) next.set(key, value);
        else next.delete(key);
      });
      // Reset page when filters change unless page itself is being updated
      if (!updates.page) next.set("page", "1");
      return next;
    }, { replace: true, preventScrollReset: true });
  }, [setSearchParams]);

  const handleSearchSubmit = (overrideQuery = null) => {
    const finalQuery = (typeof overrideQuery === "string" ? overrideQuery : q) || "";
    const params = new URLSearchParams(searchParams);
    if (finalQuery.trim()) params.set("q", finalQuery.trim());
    else params.delete("q");
    navigate(`/search?${params.toString()}`);
  };

  const load = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const currentLimit = 20;
      const isInitialRestore = page > 1 && products.length === 0;
      
      const params = {
        q: q || undefined,
        governorateId: governorateId || undefined,
        minPrice: minPrice || undefined,
        maxPrice: maxPrice || undefined,
        page: isInitialRestore ? 1 : page,
        limit: isInitialRestore ? page * currentLimit : currentLimit,
        sort
      };

      const res = await api.get("/ads", { params });
      const data = res.data && res.data.items ? res.data : { items: res.data, page: 1, pages: 1 };
      
      if (page === 1 || isInitialRestore) {
        setProducts(data.items || []);
      } else {
        setProducts((prev) => [...prev, ...(data.items || [])]);
      }
      
      const total = data.total || (data.items?.length || 0);
      const totalPages = Math.ceil(total / currentLimit) || 1;
      setPages(totalPages);

      if (page < totalPages) {
        prefetchNextPage(params, page, totalPages);
      }
    } catch (err) {
      console.error("Error loading ads:", err);
      setProducts([]);
      setPages(1);
    } finally {
      setLoading(false);
    }
  }, [q, governorateId, minPrice, maxPrice, page, sort]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/governorates", { params: { active: true } });
        setGovernorates(res.data || []);
      } catch {
        setGovernorates([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!governorateId) {
      setCities([]);
      return;
    }
    (async () => {
      try {
        const res = await api.get("/cities", { params: { governorateId, active: true } });
        setCities(res.data || []);
      } catch {
        setCities([]);
      }
    })();
  }, [governorateId]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/tags", { params: { popular: true } });
        setPopularTags(res.data || []);
      } catch {
        setPopularTags([]);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 dark:text-slate-100 font-sans leading-relaxed">
      {/* Beta Notice Banner */}
      <div className="bg-amber-500 text-white text-center py-1.5 px-4 text-xs font-bold shadow-sm relative z-0">
        <span className="inline-flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          هذه نسخة تجريبية (Beta) مخصصة للاختبار. نرحب بآرائكم وملاحظاتكم.
        </span>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-b-[40px] sm:rounded-b-[60px] border-b border-blue-100/60 shadow-2xl shadow-blue-200/50 dark:border-slate-800 dark:shadow-slate-900/40">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.03%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-30"></div>
          <div className="absolute -top-28 -right-20 h-96 w-96 rounded-full bg-blue-400/20 blur-[100px] animate-float"></div>
          <div className="absolute -bottom-24 -left-10 h-80 w-80 rounded-full bg-indigo-400/20 blur-[80px] animate-float-slow"></div>
          
          {/* Hero Floating Stats - Desktop Only */}
          <div className="hidden lg:block absolute top-12 right-12 animate-float">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 shadow-2xl">
              <div className="text-2xl font-black text-white">+100 ألف</div>
              <div className="text-xs font-bold text-blue-100/80 uppercase tracking-wider">مستخدم نشط</div>
            </div>
          </div>
          <div className="hidden lg:block absolute top-12 left-12 animate-float-slow">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 shadow-2xl">
              <div className="text-2xl font-black text-white">+10 آلاف</div>
              <div className="text-xs font-bold text-blue-100/80 uppercase tracking-wider">إعلان جديد يومياً</div>
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="relative container mx-auto px-4 py-8 sm:py-20 md:py-28 lg:py-32">
          <div className="text-center max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-white/90 text-[10px] sm:text-sm mb-4 sm:mb-8 border border-white/20 shadow-xl">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(96,165,250,0.8)]"></span>
              أكبر تجمع تجاري في اليمن
            </div>
            
            <h2 className="text-3xl sm:text-5xl md:text-7xl font-black text-white mb-8 sm:mb-10 leading-[1.4] tracking-tight">
              بيع، اشترِ، وأعلن <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-indigo-100">بكل سهولة وأمان</span>
            </h2>
            <p className="text-[12px] sm:text-xl text-white/70 mb-8 sm:mb-16 px-4 max-w-3xl mx-auto font-medium leading-relaxed">
              سوقك الموثوق لكل ما تحتاجه - سيارات، عقارات، جوالات وفئات متنوعة تناسب احتياجاتك
            </p>
            
            {/* Hero Stats - Mobile Version */}
            <div className="lg:hidden flex items-center justify-center gap-3 mb-10 animate-in fade-in zoom-in duration-700 delay-300">
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-3 shadow-xl flex-1 max-w-[150px]">
                <div className="text-xl font-black text-white leading-none mb-1">+100 ألف</div>
                <div className="text-[9px] font-bold text-blue-100/80 uppercase tracking-wider">مستخدم نشط</div>
              </div>
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-3 shadow-xl flex-1 max-w-[150px]">
                <div className="text-xl font-black text-white leading-none mb-1">+10 آلاف</div>
                <div className="text-[9px] font-bold text-blue-100/80 uppercase tracking-wider">إعلان جديد يومياً</div>
              </div>
            </div>
            
            {/* Search Bar - Optimized for Mobile */}
            <div className="max-w-2xl mx-auto px-1 sm:px-0">
              <div className="flex items-center gap-1 p-1 rounded-2xl sm:rounded-[24px] bg-white shadow-2xl shadow-black/20 focus-within:ring-4 focus-within:ring-blue-500/20 transition-all duration-300">
                <div className="flex-1 flex items-center gap-2 px-2 sm:px-4">
                  <svg className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="ما الذي تبحث عنه؟"
                    value={q}
                    onChange={(e) => updateFilters({ q: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
                    className="flex-1 py-2 sm:py-4 text-slate-900 placeholder-slate-400 bg-transparent text-[13px] sm:text-lg font-bold outline-none"
                  />
                </div>
                <button
                  onClick={() => handleSearchSubmit()}
                  className="px-4 sm:px-10 py-2 sm:py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl sm:rounded-[20px] font-black transition-all hover:shadow-lg hover:scale-[1.02] active:scale-95 text-[12px] sm:text-lg whitespace-nowrap shadow-blue-500/25"
                >
                  ابحث
                </button>
              </div>
            </div>

            {/* Hero Actions */}
            <div className="mt-6 sm:mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/choose-add-type"
                className="group relative flex items-center gap-2 rounded-xl sm:rounded-2xl bg-white px-6 sm:px-8 py-2.5 sm:py-3.5 text-[13px] sm:text-base font-black text-blue-700 shadow-xl shadow-black/10 transition-all hover:scale-105 active:scale-95 hover:bg-blue-50 overflow-hidden"
              >
                <span className="relative z-10">أضف إعلانك مجاناً</span>
                <svg className="w-4 h-4 sm:w-5 sm:h-5 relative z-10 transition-transform group-hover:translate-x-[-4px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="container mx-auto px-4 -mt-6 sm:-mt-12 relative z-10">
        {/* Trust Highlights - Optimized for Mobile */}
        <section className="mb-10 sm:mb-16 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300 fill-mode-both">
          {[
            { title: "واجهة ذكية", desc: "تصفح سريع وسهل", icon: "⚡", color: "from-amber-400 to-orange-500" },
            { title: "حماية كاملة", desc: "بيع وشراء آمن", icon: "🛡️", color: "from-blue-500 to-indigo-600" },
            { title: "متوافق تماماً", desc: "لكافة الأجهزة", icon: "📱", color: "from-emerald-400 to-teal-500" },
            { title: "دقة عالية", desc: "نتائج ذكية", icon: "🎯", color: "from-purple-500 to-pink-600" }
          ].map((item) => (
            <div key={item.title} className="group p-3 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none transition-all duration-300 hover:scale-105">
              <div className={`mb-2 sm:mb-4 inline-flex h-8 w-8 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br ${item.color} text-sm sm:text-xl text-white shadow-lg transition-transform group-hover:rotate-6`}>
                {item.icon}
              </div>
              <h4 className="text-[11px] sm:text-lg font-black text-slate-900 dark:text-white mb-0.5 sm:mb-1 leading-tight">{item.title}</h4>
              <p className="text-[9px] sm:text-sm text-slate-500 dark:text-slate-400 font-medium leading-tight">{item.desc}</p>
            </div>
          ))}
        </section>

        {/* Platform Rating Section */}
        <section className="mb-10 sm:mb-16 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-400 fill-mode-both">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] p-6 sm:p-8 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 text-center sm:text-right">
              <div className="flex flex-col items-center">
                <div className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white mb-1">
                  {platformStats.avgRating ? platformStats.avgRating.toFixed(1) : "0.0"}
                </div>
                <div className="flex items-center gap-1 text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <svg 
                      key={i} 
                      className={`w-5 h-5 sm:w-6 sm:h-6 ${i < Math.floor(platformStats.avgRating || 0) ? "fill-current" : "text-gray-300 dark:text-gray-700 fill-current"}`} 
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-1">تقييم مستخدمي سوقك</h3>
                <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 font-bold">
                  بناءً على {platformStats.totalCount || 0} تقييم حقيقي من مستخدمينا
                </p>
              </div>
            </div>
            <Link 
              to="/platform-reviews" 
              className="w-full sm:w-auto px-8 py-4 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl font-black text-center transition-all hover:bg-blue-100 dark:hover:bg-blue-900/40 active:scale-95 flex items-center justify-center gap-2 group"
            >
              <span>رؤية التقييمات</span>
              <svg className="w-5 h-5 transition-transform group-hover:translate-x-[-4px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
          </div>
        </section>

        {/* Categories Section */}
        <section className="mb-8 sm:mb-16 py-6 sm:py-12 rounded-[32px] sm:rounded-[40px] bg-slate-100/50 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/50">
          <div className="px-4 sm:px-6 mb-4 sm:mb-8 flex items-center justify-between">
            <div>
              <h3 className="text-lg sm:text-3xl font-black text-slate-900 dark:text-white mb-1">تصفح حسب الفئة</h3>
              <p className="text-[10px] sm:text-base text-slate-500 dark:text-slate-400 font-bold">اكتشف جميع الأقسام المتاحة</p>
            </div>
            <Link to="/categories" className="text-[11px] sm:text-sm font-black text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 group">
              عرض الكل
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:translate-x-[-4px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
          </div>
          <CategoryGrid isHome={true} />
        </section>

        {/* Recently Viewed Section */}
        {recentlyViewed.length > 0 && (
          <section className="mb-12 sm:mb-16">
            <div className="flex items-center justify-between mb-6 px-2">
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">شوهد مؤخراً</h3>
                <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">تابع تصفح ما أعجبك سابقاً</p>
              </div>
              <button 
                onClick={() => { localStorage.removeItem("recentlyViewed"); setRecentlyViewed([]); }}
                className="text-[10px] font-black text-red-500 hover:text-red-600 transition-colors"
              >
                مسح القائمة
              </button>
            </div>
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
              {recentlyViewed.map((product) => (
                <div key={product._id} className="w-[160px] sm:w-[220px] shrink-0">
                  <ProductCard
                    product={product}
                    to={`/ad/${product._id}`}
                    governorateName={product.governorateId?.name}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mb-16">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-10 px-2">
            <div>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-2">أحدث الإعلانات</h3>
              <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 font-bold">إعلانات جديدة تضاف كل دقيقة</p>
            </div>
            
            <div className="flex items-center gap-2 p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm self-stretch sm:self-auto overflow-x-auto no-scrollbar">
              {[
                { label: "الأحدث", value: "new" },
                { label: "الأرخص", value: "price_asc" },
                { label: "الأغلى", value: "price_desc" }
              ].map((s) => (
                <button
                  key={s.value}
                  onClick={() => updateFilters({ sort: s.value })}
                  className={`px-6 py-2 rounded-lg text-sm font-black transition-all whitespace-nowrap ${
                    sort === s.value 
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25" 
                      : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product, index) => (
              <React.Fragment key={product._id}>
                {/* External Deal Banner - Inserted after 8 products (or first row on mobile) */}
                {index === 8 && (
                  <div className="col-span-2 lg:col-span-3 xl:col-span-4 mb-6">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-6 sm:p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-blue-500/20 border border-white/10">
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-lg sm:text-xl font-black mb-1">
                            وجدت منتجاً خارج سوقك؟ اشتره بأمان
                          </h3>
                          <p className="text-sm text-blue-100 font-medium">
                            حوّل أي صفقة خارجية إلى شراء آمن داخل سوقك واستفد من نظام الضمان
                          </p>
                        </div>
                      </div>
                      <Link
                        to="/secure-deal-explanation"
                        className="w-full md:w-auto px-10 py-3 bg-white text-blue-600 rounded-xl font-black transition-all hover:scale-105 active:scale-95 text-center shadow-lg"
                      >
                        اعرف المزيد
                      </Link>
                    </div>
                  </div>
                )}
                <ProductCard
                  product={product}
                  to={`/ad/${product._id}/${product.slug || ""}`}
                  featured={product.featured}
                  governorateName={product.governorateId?.name}
                  cityName={product.cityId?.name}
                  prefetchAds={prefetchCategoryAds}
                />
              </React.Fragment>
            ))}
            
            {loading && [...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse flex flex-col gap-3">
                <div className="aspect-[4/3] bg-slate-200 dark:bg-slate-800 rounded-[32px]"></div>
                <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded-full w-3/4"></div>
                <div className="h-4 bg-slate-100 dark:bg-slate-900 rounded-full w-1/2"></div>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-center justify-center">
            {page < pages && !loading && (
              <button
                onClick={() => updateFilters({ page: page + 1 })}
                className="group relative flex items-center gap-3 px-12 py-4 bg-white dark:bg-slate-900 border-2 border-blue-600/20 dark:border-blue-900/50 rounded-2xl font-black text-blue-600 dark:text-blue-400 transition-all hover:bg-blue-600 hover:text-white hover:border-blue-600 hover:shadow-2xl hover:shadow-blue-500/30 active:scale-95 group"
              >
                <span>عرض المزيد من الإعلانات</span>
                <svg className="w-5 h-5 transition-transform group-hover:translate-y-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}

            {loading && page > 1 && (
              <div className="flex items-center gap-3 px-8 py-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-600 dark:text-blue-400 font-black animate-pulse">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
                </div>
                <span>جاري تحميل المزيد...</span>
              </div>
            )}
            
            {page >= pages && products.length > 0 && !loading && (
              <div className="text-slate-400 dark:text-slate-600 font-bold flex items-center gap-2">
                <div className="h-px w-8 bg-current opacity-20"></div>
                <span>لقد وصلت إلى نهاية القائمة</span>
                <div className="h-px w-8 bg-current opacity-20"></div>
              </div>
            )}
          </div>
        </section>

        {popularTags.length > 0 && (
          <section className="mb-20 p-6 sm:p-12 rounded-[40px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">الوسوم الرائجة الآن</h3>
                  <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-1">اكتشف ما يبحث عنه الجميع في اليمن</p>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">تحديث مباشر</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 sm:gap-3">
                {popularTags.map((tag, i) => (
                  <button
                    key={tag._id}
                    onClick={() => navigate(`/search?tag=${tag.slug}`)}
                    className="group relative flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-transparent hover:border-blue-500/30 hover:bg-white dark:hover:bg-slate-800 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10"
                  >
                    <span className="text-blue-600 dark:text-blue-400 font-black text-sm sm:text-base">#</span>
                    <span className="text-slate-700 dark:text-slate-200 font-black text-sm sm:text-base">{tag.name}</span>
                    <span className="bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded-md text-[9px] font-black text-slate-400 group-hover:text-blue-500 transition-colors">
                      {tag.count > 1000 ? `${(tag.count/1000).toFixed(1)}k` : tag.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <AdvancedSearchModal 
        isOpen={showAdvancedModal} 
        onClose={() => setShowAdvancedModal(false)} 
      />
    </div>
  );
}
