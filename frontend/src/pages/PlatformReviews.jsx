import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios";
import { uploadsUrl } from "../lib/uploads";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { motion } from "framer-motion";
import SEO from "../components/SEO";
import PlatformReviewModal from "../components/PlatformReviewModal";

const PlatformReviews = () => {
  const api = useApi();
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reviewsRes, statsRes] = await Promise.all([
        api.get("/platform-reviews/public"),
        api.get("/platform-reviews/stats")
      ]);
      setReviews(reviewsRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error("Error loading platform reviews:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getCategoryName = (cat) => {
    const names = {
      GENERAL: "عام",
      UI_UX: "واجهة المستخدم",
      PERFORMANCE: "السرعة والأداء",
      FEATURE_REQUEST: "اقتراح ميزة",
      BUG_REPORT: "خطأ تقني",
      SUPPORT: "الدعم الفني"
    };
    return names[cat] || cat;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-20">
      <SEO 
        title="حائط الآراء - منصة سوقك" 
        description="ماذا يقول مستخدمو سوقك عن تجربتهم؟ استكشف آراء وتقييمات مجتمعنا."
      />

      {/* Hero Section */}
      <div className="relative bg-white dark:bg-slate-900 border-b dark:border-slate-800 pt-10 pb-12 sm:pt-16 sm:pb-20 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
          <div className="absolute top-10 right-10 w-64 h-64 bg-brand-500 rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 left-10 w-64 h-64 bg-emerald-500 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-6xl mx-auto px-4 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 text-[10px] sm:text-xs font-black uppercase tracking-widest mb-4 sm:mb-6"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
            </span>
            آراء مجتمع سوقك
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-4xl md:text-6xl font-black text-gray-900 dark:text-white mb-4 sm:mb-6"
          >
            حائط <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-emerald-600">الآراء</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="max-w-2xl mx-auto text-sm sm:text-lg text-gray-500 dark:text-slate-400 font-bold leading-relaxed mb-6 sm:mb-8 px-4"
          >
            رأيكم هو البوصلة التي توجهنا نحو الأفضل. استكشف تجارب المستخدمين الآخرين وشاركنا تجربتك الخاصة.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex justify-center px-4"
          >
            <button 
              onClick={() => setIsModalOpen(true)}
              className="w-full sm:w-auto px-6 py-3.5 sm:px-8 sm:py-4 bg-brand-600 hover:bg-brand-700 text-white font-black rounded-xl sm:rounded-2xl shadow-lg shadow-brand-500/20 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2.5 group"
            >
              <svg className="w-5 h-5 transition-transform group-hover:rotate-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span className="text-sm sm:text-base">أضف تقييمك الآن</span>
            </button>
          </motion.div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-6 sm:-mt-10 relative z-20">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="ds-card p-6 sm:p-8 text-center flex flex-col items-center justify-center bg-white dark:bg-slate-900 shadow-xl border-none"
          >
            <div className="text-[9px] sm:text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 sm:mb-2">متوسط التقييم</div>
            <div className="text-4xl sm:text-5xl font-black text-gray-900 dark:text-white flex items-center gap-2 sm:gap-3">
              {stats?.avgRating?.toFixed(1) || "5.0"}
              <svg className="w-8 h-8 sm:w-10 sm:h-10 text-amber-400 fill-current" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
            <div className="text-[10px] sm:text-xs font-bold text-gray-400 mt-1 sm:mt-2">من أصل {stats?.totalCount || 0} تقييم</div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="ds-card p-6 sm:p-8 md:col-span-2 bg-white dark:bg-slate-900 shadow-xl border-none"
          >
            <div className="text-[9px] sm:text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4 sm:mb-6">توزيع التقييمات</div>
            <div className="space-y-2.5 sm:space-y-3">
              {[5, 4, 3, 2, 1].map((star) => (
                <div key={star} className="flex items-center gap-2 sm:gap-4">
                  <div className="flex items-center gap-1 w-8 sm:w-10">
                    <span className="text-xs sm:text-sm font-black text-gray-700 dark:text-gray-300">{star}</span>
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-amber-400 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                  </div>
                  <div className="flex-1 h-2 sm:h-3 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(stats?.stars?.[star] || 0) / (stats?.totalCount || 1) * 100}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-amber-300 to-amber-500 rounded-full shadow-sm"
                    />
                  </div>
                  <div className="w-10 sm:w-12 text-[9px] sm:text-xs font-black text-gray-400 text-left">
                    {Math.round((stats?.stars?.[star] || 0) / (stats?.totalCount || 1) * 100)}%
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Reviews Masonry-like Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            Array(6).fill(0).map((_, i) => (
              <div key={i} className="ds-card h-64 animate-pulse bg-white dark:bg-slate-900 border-none shadow-md" />
            ))
          ) : reviews.length === 0 ? (
            <div className="col-span-full py-20 text-center">
              <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
                💬
              </div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">لا توجد تقييمات منشورة بعد</h3>
              <p className="text-gray-500 dark:text-gray-400 font-bold">كن أول من يشاركنا رأيه في المنصة!</p>
            </div>
          ) : (
            reviews.map((review, index) => (
              <motion.div
                key={review._id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="ds-card p-6 flex flex-col h-full bg-white dark:bg-slate-900 border-none shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center overflow-hidden shadow-inner border border-brand-100/50 dark:border-brand-900/50">
                      {review.userId?.avatar ? (
                        <img 
                          src={uploadsUrl(review.userId.avatar, "thumb")} 
                          alt="" 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = uploadsUrl(review.userId.avatar, "full");
                          }}
                        />
                      ) : (
                        <span className="text-brand-600 dark:text-brand-400 font-black">
                          {(review.userId?.name || "م").slice(0, 1)}
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-gray-900 dark:text-white">
                        {review.userId?.name || "مستخدم سوقك"}
                      </h4>
                      <p className="text-[10px] font-bold text-gray-400">
                        {format(new Date(review.createdAt), "dd MMMM yyyy", { locale: ar })}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <svg 
                        key={s} 
                        className={`w-3.5 h-3.5 ${s <= review.rating ? 'text-amber-400 fill-current' : 'text-gray-200 dark:text-slate-700'}`} 
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                </div>

                <div className="flex-1">
                  <span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 text-[10px] font-black mb-3">
                    {getCategoryName(review.category)}
                  </span>
                  {review.comment ? (
                    <p className="text-sm text-gray-700 dark:text-gray-300 font-bold leading-relaxed line-clamp-4 group-hover:line-clamp-none transition-all duration-300 italic">
                      "{review.comment}"
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400 dark:text-gray-500 font-bold italic">بدون تعليق</p>
                  )}
                </div>

                {/* Admin Reply Display */}
                {review.adminReply && (
                  <div className="mt-4 pt-4 border-t border-emerald-100 dark:border-emerald-900/30">
                    <div className="flex items-center gap-2 mb-2">
                      {review.adminRepliedBy?.avatar ? (
                        <img 
                          src={uploadsUrl(review.adminRepliedBy.avatar, "thumb")} 
                          alt="" 
                          className="w-6 h-6 rounded-full object-cover"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = uploadsUrl(review.adminRepliedBy.avatar, "full");
                          }}
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-800 flex items-center justify-center">
                          <span className="text-emerald-700 dark:text-emerald-300 font-black text-xs">
                            {(review.adminRepliedBy?.name || "A").slice(0, 1)}
                          </span>
                        </div>
                      )}
                      <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">
                        {review.adminRepliedBy?.name || "مدير المنصة"}
                      </span>
                      {review.adminReplyAt && (
                        <span className="text-[10px] font-bold text-gray-400">
                          {format(new Date(review.adminReplyAt), "dd MMMM yyyy", { locale: ar })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-emerald-800 dark:text-emerald-300">{review.adminReply}</p>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t dark:border-slate-800 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                   <div className="flex items-center gap-1">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <span className="text-[10px] font-black text-emerald-600">تقييم معتمد</span>
                   </div>
                   <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">منصة {review.platform || "الويب"}</div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      <PlatformReviewModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
};

export default PlatformReviews;
