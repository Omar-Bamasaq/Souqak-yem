import React, { useEffect, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { useApi } from "../api/axios.js";
import { useAuth } from "../store/AuthContext.jsx";
import MobileSelect from "../components/MobileSelect.jsx";

const REPORT_CONFIG = {
  user: {
    categories: [
      { id: "treatment", label: "سوء تعامل", reasons: ["إهانات", "قلة أدب"] },
      { id: "fraud", label: "احتيال", reasons: ["نصب", "حساب وهمي"] },
      { id: "violations", label: "مخالفات", reasons: ["مخالفة سياسة المنصة"] },
      { id: "behavior", label: "سلوك غير مرغوب", reasons: ["سبام (إزعاج)", "تحرش"] }
    ]
  }
};

export default function SellerPublic() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "reviews" ? "reviews" : "ads";
  
  const API = (import.meta.env && import.meta.env.VITE_API_URL) || "http://localhost:5000/api";
  const [seller, setSeller] = useState(null);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportDone, setReportDone] = useState(false);
  const [reportMsg, setReportMsg] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewsStats, setReviewsStats] = useState(null);
  const [activeTab, setActiveTab] = useState(initialTab); // "ads" or "reviews"
  const api = useApi();
  const { user } = useAuth();

  useEffect(() => {
    if (initialTab === "reviews") setActiveTab("reviews");
  }, [initialTab]);

  const loadReviews = async () => {
    try {
      const res = await axios.get(`${API}/reviews/seller/${id}`);
      setReviews(res.data?.items || []);
      setReviewsStats(res.data?.stats || null);
    } catch (err) {
      console.error("Load reviews error:", err);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/sellers/${id}`, { params: { page, limit: 12 } });
      setSeller(res.data?.seller || null);
      setItems(res.data?.items || []);
      setPages(res.data?.pages || 1);
    } catch {
      setSeller(null);
      setItems([]);
      setPages(1);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { 
    load(); 
    loadReviews();
  }, [id, page]);
  useEffect(() => {
    (async () => {
      // احسب عدد المتابعين دائمًا
      try {
        const c = await axios.get(`${API}/follows/count/${id}`);
        setFollowers(Number(c.data?.count || 0));
      } catch {
        setFollowers(0);
      }
      // حالة المتابعة تستدعي فقط عند وجود مستخدم (وتوكن)
      if (!user) {
        setFollowing(false);
        return;
      }
      try {
        const s = await api.get(`/follows/status/${id}`);
        setFollowing(!!s.data?.following);
      } catch {
        // في حال فشل الطلب، لا نغيّر الحالة الحالية
      }
    })();
  }, [id, user]);

  const openReport = () => {
    setReportReason("");
    setReportMsg("");
    setReportDone(false);
    setReportOpen(true);
  };

  const sendReport = async () => {
    setReportMsg("");
    if (!user) {
      setReportMsg("يجب تسجيل الدخول لإرسال بلاغ");
      return;
    }
    if (!reportReason) {
      setReportMsg("يرجى اختيار سبب البلاغ");
      return;
    }
    try {
      setReportSubmitting(true);
      const categoryLabel = REPORT_CONFIG.user.categories.find(c => c.id === reportCategory)?.label || "عام";
      await api.post(`/sellers/${id}/report`, { 
        category: categoryLabel,
        reason: reportReason,
        details: reportDetails
      });
      setReportDone(true);
    } catch {
      setReportMsg("تعذر إرسال البلاغ");
    } finally {
      setReportSubmitting(false);
    }
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

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
    </div>
  );
  if (!seller) return <div className="ds-card text-sm text-gray-600">البائع غير موجود</div>;

  return (
    <div className="space-y-4">
      <div className="ds-section !p-4 sm:!p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <div className="inline-flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 border border-blue-100 text-xl sm:text-2xl font-black">
                {(seller.name || "?").charAt(0)}
              </div>
              {seller.isVerifiedSeller && (
                <div className="absolute -bottom-1 -right-1 rounded-full bg-blue-600 p-1 text-white shadow-sm ring-2 ring-white" title="بائع موثّق">
                  <svg className="h-3 w-3 sm:h-4 sm:w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812z" />
                  </svg>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-base sm:text-xl font-black text-gray-900 truncate">{seller.name}</div>
              <div className="flex items-center gap-3 mt-0.5">
                <div className="flex items-center gap-1 text-xs font-bold text-gray-500">
                  <span className="text-blue-600 font-black">{followers}</span>
                  <span>متابع</span>
                </div>
                <span className="h-1 w-1 rounded-full bg-gray-300"></span>
                <span className="text-[10px] sm:text-xs text-gray-400 font-bold">@{seller._id.slice(-6).toUpperCase()}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:self-center">
            <button
              className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-sm font-black transition-all active:scale-95 ${
                following 
                  ? "bg-gray-100 text-gray-600 hover:bg-gray-200" 
                  : "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-200"
              }`}
              onClick={async () => {
                try {
                  const r = await api.post(`/follows/${id}`);
                  const f = !!r.data?.following;
                  setFollowing(f);
                  const c = await axios.get(`${API}/follows/count/${id}`);
                  setFollowers(Number(c.data?.count || 0));
                } catch (e) {
                  if (e?.response?.data?.error) {
                    alert(e.response.data.error);
                  }
                }
              }}
              disabled={!user || String(user._id || user.id) === String(id)}
            >
              {following ? "إلغاء المتابعة" : "متابعة"}
            </button>
            <button 
              className="p-2.5 rounded-xl border border-gray-100 bg-gray-50 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all active:scale-95" 
              onClick={openReport}
              title="إبلاغ عن البائع"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </button>
          </div>
        </div>
        {!user && <div className="mt-3 text-[11px] font-bold text-gray-500 bg-gray-50 p-2 rounded-lg border border-dashed border-gray-200 text-center italic">سجّل الدخول لمتابعة هذا البائع</div>}
        {user && String(user._id || user.id) === String(id) && (
          <div className="mt-3 text-[11px] font-bold text-blue-600 bg-blue-50 p-2 rounded-lg border border-dashed border-blue-100 text-center italic">هذا هو ملفك الشخصي العام</div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 mb-6 sticky top-[64px] bg-white/80 backdrop-blur-md z-10 px-4 sm:px-0">
        <button 
          onClick={() => setActiveTab("ads")}
          className={`px-8 py-4 text-sm font-black transition-all relative ${activeTab === "ads" ? "text-blue-600" : "text-gray-400 hover:text-gray-600"}`}
        >
          الإعلانات ({seller?.adsCount || items.length})
          {activeTab === "ads" && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full shadow-lg shadow-blue-100"></div>}
        </button>
        <button 
          onClick={() => setActiveTab("reviews")}
          className={`px-8 py-4 text-sm font-black transition-all relative ${activeTab === "reviews" ? "text-blue-600" : "text-gray-400 hover:text-gray-600"}`}
        >
          التقييمات ({reviewsStats?.count || 0})
          {activeTab === "reviews" && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full shadow-lg shadow-blue-100"></div>}
        </button>
      </div>

      {activeTab === "ads" ? (
        <div className="ds-section p-0 overflow-hidden">
          <div className="border-b border-gray-50 px-4 py-4 flex items-center justify-between bg-gray-50/30">
            <h3 className="text-sm sm:text-base font-black text-gray-800 flex items-center gap-2">
              <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 01-2-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              إعلانات البائع
            </h3>
            <span className="text-xs font-bold text-gray-400 bg-white px-2 py-1 rounded-md border border-gray-100">{items.length} إعلان</span>
          </div>
          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-3">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414a1 1 0 00-.707-.293H4" />
                </svg>
              </div>
              <p className="text-sm font-bold text-gray-400">لا توجد إعلانات نشطة لهذا البائع حالياً</p>
            </div>
          )}
          {items.length > 0 && (
            <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 md:grid-cols-3">
              {items.map((a) => (
                <Link key={a._id} to={`/ad/${a._id}`} className="group relative rounded-2xl border border-gray-100 bg-white p-3 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md active:scale-[0.98]">
                  <div className="relative h-44 w-full overflow-hidden rounded-xl bg-gray-50">
                    {a.images?.[0] ? (
                      <img src={`http://localhost:5000/uploads/${a.images[0]}`} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-300">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 rounded-lg bg-white/95 px-2 py-0.5 text-[10px] sm:text-xs font-black text-blue-600 backdrop-blur-md shadow-md border border-white/20">
                      {a.price?.toLocaleString()} {getCurrencySymbol(a.currency)}
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-sm font-black text-gray-900 line-clamp-1 group-hover:text-blue-600 transition-colors">{a.title}</div>
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] sm:text-xs font-bold text-gray-400">
                      <svg className="h-3.5 w-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {a.governorateId?.name} {a.cityId?.name ? `• ${a.cityId.name}` : ""}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {pages > 1 && (
            <div className="p-4 flex items-center justify-center gap-2">
              <button className="ds-btn-secondary" disabled={page<=1} onClick={() => setPage((p) => Math.max(p-1,1))}>السابق</button>
              <span className="text-sm text-gray-700">صفحة {page} من {pages}</span>
              <button className="ds-btn-secondary" disabled={page>=pages} onClick={() => setPage((p) => Math.min(p+1,pages))}>التالي</button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Seller Stats Header */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 px-4 sm:px-0">
            <div className="md:col-span-1 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-center space-y-4">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">التقييم العام</p>
              <div className="text-4xl font-black text-gray-900">{reviewsStats?.avgRating?.toFixed(1) || "0.0"}</div>
              <div className="flex justify-center text-amber-400">
                {[1, 2, 3, 4, 5].map((s) => (
                  <svg key={s} className={`w-5 h-5 ${s <= Math.round(reviewsStats?.avgRating || 0) ? 'fill-current' : 'fill-gray-100'}`} viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                ))}
              </div>
              <p className="text-[10px] font-bold text-gray-400 uppercase">بناءً على {reviewsStats?.count || 0} تقييم</p>
            </div>

            <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'المصداقية', value: reviewsStats?.avgReliability, color: 'emerald', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
                { label: 'التواصل', value: reviewsStats?.avgCommunication, color: 'blue', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
                { label: 'سرعة التسليم', value: reviewsStats?.avgDeliverySpeed, color: 'amber', icon: 'M13 10V3L4 14h7v7l9-11h-7z' }
              ].map((stat, i) => (
                <div key={i} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                  <div className={`w-10 h-10 bg-${stat.color}-50 text-${stat.color}-600 rounded-2xl flex items-center justify-center`}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} /></svg>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full bg-${stat.color}-500 transition-all duration-1000`} style={{ width: `${(stat.value || 0) * 20}%` }}></div>
                      </div>
                      <span className="text-sm font-black text-gray-900">{(stat.value || 0).toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reviews List */}
          <div className="space-y-4 px-4 sm:px-0">
            {reviews.map((r, i) => (
              <div key={i} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                <div className="flex gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 font-black group-hover:scale-110 transition-transform overflow-hidden shrink-0">
                    {r.buyerId?.avatar ? <img src={`http://localhost:5000/uploads/${r.buyerId.avatar}`} alt="" className="w-full h-full object-cover" /> : (r.buyerId?.name || "?").slice(0,1)}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="text-sm font-black text-gray-900">{r.buyerId?.name}</h5>
                        <div className="flex text-amber-400 mt-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <svg key={s} className={`w-3 h-3 ${s <= r.rating ? 'fill-current' : 'fill-gray-100'}`} viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                          ))}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase">{new Date(r.createdAt).toLocaleDateString("ar-EG")}</span>
                    </div>
                    
                    <p className="text-sm text-gray-700 font-medium leading-relaxed">{r.comment}</p>
                    
                    {r.adId && (
                      <Link to={`/ad/${r.adId._id}`} className="inline-flex items-center gap-2 p-2 pr-4 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100 transition-all">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">عن إعلان:</span>
                        <span className="text-[10px] font-black text-blue-600 truncate max-w-[150px]">{r.adId.title}</span>
                        <svg className="w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {reviews.length === 0 && (
              <div className="text-center py-20 space-y-4">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto text-gray-400">
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </div>
                <p className="text-sm font-black text-gray-400 uppercase tracking-widest">لا توجد تقييمات لهذا البائع بعد</p>
              </div>
            )}
          </div>
        </div>
      )}
      {reportOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => { if(!reportSubmitting) setReportOpen(false); setReportDone(false); }}>
          <div className="w-full max-w-md rounded-[2.5rem] bg-white p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in duration-300 border border-gray-100" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center shadow-inner">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-xl font-black text-gray-900">إبلاغ عن البائع</h3>
              </div>
              <button onClick={() => setReportOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-50 rounded-full">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {reportDone ? (
              <div className="text-center py-6 animate-in zoom-in-95">
                <div className="h-20 w-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="text-2xl font-black text-gray-900 mb-2">تم الإرسال بنجاح</h4>
                <p className="text-gray-500 font-medium mb-8">شكراً لمساعدتنا في الحفاظ على أمان مجتمعنا ومراقبة جودة التعامل.</p>
                <button onClick={() => setReportOpen(false)} className="w-full h-12 rounded-2xl bg-gray-900 text-white font-black hover:bg-black transition-all shadow-lg active:scale-95">إغلاق</button>
              </div>
            ) : (
              <div className="space-y-5">
                {reportMsg && <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-xs font-bold text-red-600 animate-in fade-in slide-in-from-top-2">{reportMsg}</div>}
                
                <MobileSelect 
                  label="الفئة"
                  value={reportCategory}
                  onChange={(e) => { setReportCategory(e.target.value); setReportReason(""); }}
                  options={REPORT_CONFIG.user.categories.map(c => ({ value: c.id, label: c.label }))}
                  placeholder="اختر فئة البلاغ..."
                />

                {reportCategory && (
                  <MobileSelect 
                    label="السبب المحدد"
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    options={[
                      ...REPORT_CONFIG.user.categories.find(c => c.id === reportCategory).reasons.map(r => ({ value: r, label: r })),
                      { value: "أخرى", label: "سبب آخر" }
                    ]}
                    placeholder="اختر السبب..."
                  />
                )}

                {reportReason && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <label className="mb-2 block text-[10px] font-black text-gray-400 uppercase tracking-wider px-1">تفاصيل إضافية (اختياري)</label>
                    <textarea
                      className="ds-input w-full h-24 bg-gray-50 border-gray-100 font-medium focus:bg-white transition-all resize-none py-3"
                      placeholder="يرجى توضيح المزيد لمساعدتنا في المراجعة..."
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                    />
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={sendReport}
                    disabled={reportSubmitting || !reportReason}
                    className="flex-[2] h-12 rounded-2xl bg-red-600 text-white font-black hover:bg-red-700 disabled:opacity-50 transition-all shadow-lg shadow-red-100 active:scale-95"
                  >
                    {reportSubmitting ? "جارٍ الإرسال..." : "إرسال البلاغ"}
                  </button>
                  <button onClick={() => setReportOpen(false)} className="flex-1 h-12 rounded-2xl bg-gray-100 text-gray-600 font-black hover:bg-gray-200 transition-all active:scale-95">إلغاء</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
