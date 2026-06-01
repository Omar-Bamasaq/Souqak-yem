import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios";
import { uploadsUrl } from "../lib/uploads";
import StatusBadge from "../components/StatusBadge";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const AdminPlatformReviews = () => {
  const api = useApi();
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  const loadData = async () => {
    setLoading(true);
    try {
      const [reviewsRes, statsRes] = await Promise.all([
        api.get("/platform-reviews/admin/all"),
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

  const handleUpdate = async (id, data) => {
    try {
      await api.patch(`/platform-reviews/admin/${id}`, data);
      loadData();
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تم التحديث بنجاح", type: "success" } }));
    } catch (err) {
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "فشل التحديث", type: "error" } }));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا التقييم؟")) return;
    try {
      await api.delete(`/platform-reviews/admin/${id}`);
      setReviews(reviews.filter(r => r._id !== id));
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تم الحذف بنجاح", type: "success" } }));
    } catch (err) {
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "فشل الحذف", type: "error" } }));
    }
  };

  const filteredReviews = reviews.filter(r => {
    if (filter === "ALL") return true;
    if (filter === "PUBLIC") return r.isPublic;
    if (filter === "PENDING") return r.status === "PENDING";
    return true;
  });

  const getCategoryName = (cat) => {
    const names = {
      GENERAL: "عام",
      UI_UX: "واجهة المستخدم",
      PERFORMANCE: "السرعة",
      FEATURE_REQUEST: "اقتراح ميزة",
      BUG_REPORT: "خطأ تقني",
      SUPPORT: "الدعم"
    };
    return names[cat] || cat;
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="ds-title">تقييمات المنصة</h2>
          <p className="text-sm font-bold text-gray-500">مراقبة آراء المستخدمين وتطوير الأداء</p>
        </div>
        
        <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl border dark:border-slate-700 shadow-sm self-start">
          {["ALL", "PENDING", "PUBLIC"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${
                filter === f 
                  ? "bg-brand-600 text-white shadow-md" 
                  : "text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700"
              }`}
            >
              {f === "ALL" ? "الكل" : f === "PENDING" ? "قيد المراجعة" : "العامة"}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="ds-card p-4 text-center">
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">متوسط التقييم</div>
          <div className="text-2xl font-black text-brand-600 flex items-center justify-center gap-1">
            <span>{stats?.avgRating?.toFixed(1) || 0}</span>
            <svg className="w-5 h-5 fill-current text-amber-400" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
          </div>
        </div>
        <div className="ds-card p-4 text-center">
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">إجمالي المشاركات</div>
          <div className="text-2xl font-black text-gray-900 dark:text-white">{stats?.totalCount || 0}</div>
        </div>
        {/* Distribution mini-bars for mobile, full for desktop */}
        <div className="col-span-2 ds-card p-4 flex flex-col justify-center">
           <div className="space-y-1">
              {[5,4,3,2,1].map(star => (
                <div key={star} className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-gray-400 w-3">{star}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-400 rounded-full" 
                      style={{ width: `${(stats?.stars?.[star] || 0) / (stats?.totalCount || 1) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 w-4">{stats?.stars?.[star] || 0}</span>
                </div>
              ))}
           </div>
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="ds-card h-32 animate-pulse bg-gray-50 dark:bg-slate-800/50" />
          ))
        ) : filteredReviews.length === 0 ? (
          <div className="ds-card p-12 text-center text-gray-500 font-bold">لا توجد تقييمات مطابقة</div>
        ) : (
          filteredReviews.map((review) => (
            <div key={review._id} className="ds-card overflow-hidden group border-none shadow-sm hover:shadow-md transition-shadow">
              <div className="p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center overflow-hidden">
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
                        <span className="text-brand-600 font-black">{(review.userId?.name || "?").slice(0, 1)}</span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-gray-900 dark:text-white">{review.userId?.name || "مستخدم غير معروف"}</span>
                        {review.isAnonymous && <span className="text-[9px] font-black bg-gray-100 dark:bg-slate-700 text-gray-500 px-1.5 py-0.5 rounded">مجهول</span>}
                      </div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase">{format(new Date(review.createdAt), "dd MMMM yyyy", { locale: ar })}</div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <svg key={s} className={`w-3.5 h-3.5 ${s <= review.rating ? 'text-amber-400 fill-current' : 'text-gray-200 dark:text-slate-700'}`} viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                      ))}
                    </div>
                    <span className="text-[10px] font-black bg-brand-50 dark:bg-brand-900/30 text-brand-600 px-2 py-0.5 rounded-full">{getCategoryName(review.category)}</span>
                  </div>
                </div>

                {review.comment && (
                  <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-2xl mb-4 italic text-sm text-gray-700 dark:text-gray-300 border-r-4 border-brand-500">
                    "{review.comment}"
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t dark:border-slate-800">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div className="relative inline-flex items-center">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={review.isPublic}
                          onChange={(e) => handleUpdate(review._id, { isPublic: e.target.checked })}
                        />
                        <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                      </div>
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest group-hover:text-emerald-600 transition-colors">عرض للجمهور</span>
                    </label>

                    <select 
                      value={review.status}
                      onChange={(e) => handleUpdate(review._id, { status: e.target.value })}
                      className="text-[10px] font-black bg-transparent border-none focus:ring-0 p-0 text-gray-500 uppercase tracking-widest cursor-pointer hover:text-brand-600 transition-colors"
                    >
                      <option value="PENDING">قيد المراجعة</option>
                      <option value="APPROVED">مقبول</option>
                      <option value="ARCHIVED">مؤرشف</option>
                    </select>
                  </div>

                  <button 
                    onClick={() => handleDelete(review._id)}
                    className="text-[10px] font-black text-red-400 hover:text-red-600 uppercase tracking-widest transition-colors flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    حذف
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminPlatformReviews;
