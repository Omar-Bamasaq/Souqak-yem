import React, { useEffect, useState, Fragment } from "react";
import { useNavigate, useParams, Link, useSearchParams } from "react-router-dom";
import SEO from "../components/SEO";
import { useAdsQuery } from "../hooks/useAdsQuery.js";
import { useApi } from "../api/axios.js";
import { useAuth } from "../store/AuthContext.jsx";
import { uploadsUrl } from "../lib/uploads.js";
import { t } from "../i18n/index.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import ProductCard from "../components/ProductCard.jsx";
import { isConditionEnabled } from "../lib/categoryHelpers.js";
import MobileSelect from "../components/MobileSelect.jsx";
import SecurePurchaseModal from "../components/SecurePurchaseModal.jsx";

const REPORT_CONFIG = {
  ad: {
    categories: [
      { id: "content", label: "محتوى الإعلان", reasons: ["لغة غير لائقة", "قسم خاطئ", "إعلان مكرر"] },
      { id: "violations", label: "مخالفات", reasons: ["سلعة ممنوعة", "محتوى غير قانوني"] },
      { id: "fraud", label: "احتيال", reasons: ["إعلان وهمي", "سعر مضلل"] },
      { id: "images", label: "الصور", reasons: ["جودة رديئة", "صور غير متعلقة بالسلعة", "صور مخلة"] }
    ]
  }
};

function baseSlugify(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getCurrencySymbol(code) {
  const symbols = {
    USD: "$",
    SAR: "ر.س",
    YER_ADEN: "ر.ي (عدن)",
    YER_SANAA: "ر.ي (صنعاء)",
    YER: "ر.ي (عدن)"
  };
  return symbols[code] || "ر.ي (عدن)";
}

export default function ProductDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const refId = searchParams.get("ref");
  const navigate = useNavigate();
  const { useSimilarAds } = useAdsQuery();
  const [p, setP] = useState(null);
  const [governorates, setGovernorates] = useState([]);
  const [cities, setCities] = useState([]);
  const [ok, setOk] = useState("");
  const api = useApi();
  const { user } = useAuth();
  const [chatLink, setChatLink] = useState("");
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [commentErr, setCommentErr] = useState("");
  const [reviews, setReviews] = useState([]);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [sellerStats, setSellerStats] = useState({
    avgReliability: 0,
    avgCommunication: 0,
    avgDeliverySpeed: 0
  });
  const [rating, setRating] = useState(5);
  const [reviewImages, setReviewImages] = useState([]);
  const [lbOpen, setLbOpen] = useState(false);
  const [lbIndex, setLbIndex] = useState(0);
  const [lbScale, setLbScale] = useState(1);
  const [lbOffset, setLbOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const resetZoom = () => {
    setLbScale(1);
    setLbOffset({ x: 0, y: 0 });
  };

  const handleWheel = (e) => {
    if (!lbOpen) return;
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    setLbScale(prev => {
      const next = Math.max(0.5, Math.min(prev + delta, 5));
      if (next === 1) setLbOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const handleMouseDown = (e) => {
    if (lbScale <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - lbOffset.x, y: e.clientY - lbOffset.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || lbScale <= 1) return;
    setLbOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleTouchStart = (e) => {
    if (lbScale <= 1 || e.touches.length !== 1) return;
    setIsDragging(true);
    const touch = e.touches[0];
    setDragStart({ x: touch.clientX - lbOffset.x, y: touch.clientY - lbOffset.y });
  };

  const handleTouchMove = (e) => {
    if (!isDragging || lbScale <= 1 || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setLbOffset({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };
  const [reportReason, setReportReason] = useState("");
  const [reportCategory, setReportCategory] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportMsg, setReportMsg] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [convOpening, setConvOpening] = useState(false);
  const [fav, setFav] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [followingSeller, setFollowingSeller] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [activeTab, setActiveTab] = useState("specs"); // Default to specs if available, otherwise reviews or comments

  useEffect(() => {
    if (p) {
      if (p.attributes?.length > 0) setActiveTab("specs");
      else setActiveTab("reviews");
    }
  }, [p?.attributes?.length]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: p.title,
          text: `شاهد هذا الإعلان على سوقك: ${p.title}`,
          url: window.location.href,
        });
      } catch (err) {
        console.error("Share error:", err);
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(window.location.href);
        window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تم نسخ رابط الإعلان بنجاح", type: "success" } }));
      } catch {
        alert("فشل نسخ الرابط");
      }
    }
  };

  const [pledgeOpen, setPledgeOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [securePurchaseModalOpen, setSecurePurchaseModalOpen] = useState(false);

  const formatCurrency = (currency) => {
    const map = {
      "YER_ADEN": "ريال يمني (عدن)",
      "YER_SANAA": "ريال يمني (صنعاء)",
      "SAR": "ريال سعودي",
      "USD": "دولار أمريكي"
    };
    return map[currency] || currency;
  };

  const checkPledge = (action) => {
    // If it's an "order" ad, check if the user has already accepted the pledge
    if (p.adType === "order" && !isMyAd) {
      const hasAcceptedPledge = localStorage.getItem("orderPledgeAccepted");
      if (hasAcceptedPledge) {
        action();
      } else {
        setPendingAction(() => action);
        setPledgeOpen(true);
      }
    } else {
      action();
    }
  };

  const [followersCount, setFollowersCount] = useState(0);
  const [sellerAdsCount, setSellerAdsCount] = useState(0);
  const [notFound, setNotFound] = useState(false);

  const handleContact = async () => {
    // Only count unique contacts per session to avoid abuse
    const contactKey = `contacted:${id}`;
    if (localStorage.getItem(contactKey)) return;

    try {
      const res = await api.post(`/ads/${id}/contact`);
      if (res.data?.success) {
        setP(prev => ({ ...prev, contactsCount: res.data.contactsCount }));
        localStorage.setItem(contactKey, "1");
      }
    } catch (err) {
      console.error("Contact count error:", err);
    }
  };

  const { data: similarAds = [] } = useSimilarAds(id);

  const [cPage, setCPage] = useState(1);
  const [cPages, setCPages] = useState(1);

  useEffect(() => {
    if (p?._id) {
      const recent = JSON.parse(localStorage.getItem("recentlyViewed") || "[]");
      const userKey = user ? (user._id || user.id) : "guest";
      
      const newItem = {
        _id: p._id,
        title: p.title,
        price: p.price,
        currency: p.currency,
        images: p.images,
        governorateId: p.governorateId,
        viewCount: p.viewCount,
        userId: p.userId,
        condition: p.condition,
        adType: p.adType,
        createdAt: p.createdAt,
        publishedAt: p.publishedAt,
        viewerId: userKey // Track who viewed this ad
      };
      
      // Filter out this specific ad viewed by this specific user/guest to avoid duplicates
      const filtered = recent.filter(item => !(item._id === p._id && item.viewerId === userKey));
      const updated = [newItem, ...filtered].slice(0, 20); // Store more but UI shows 10
      localStorage.setItem("recentlyViewed", JSON.stringify(updated));
    }
  }, [p, user]);

  const load = async () => {
    if (!id || id === "undefined") {
      setNotFound(true);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setNotFound(false);
      // Use useApi instance for all requests to ensure baseURL and prefix
      const res = await api.get(`/ads/${id}`);
      setP(res.data);
      setLoading(false);

      if (user) {
        try {
          const r = await api.get(`/favorites/status/${id}`);
          setFav(!!r.data?.favorited);
        } catch {}
        try {
          const sellerId = res.data?.userId?._id || res.data?.userId;
          if (sellerId) {
            const s = await api.get(`/follows/status/${sellerId}`);
            setFollowingSeller(!!s.data?.following);
          }
        } catch {}
      }
      try {
        const sellerId = res.data?.userId?._id || res.data?.userId;
        if (sellerId) {
          const [fc, sc] = await Promise.all([
            api.get(`/follows/count/${sellerId}`),
            api.get(`/sellers/${sellerId}`)
          ]);
          setFollowersCount(Number(fc.data?.count || 0));
          setSellerAdsCount(Number(sc.data?.total || 0));
        }
      } catch {}
    } catch (err) {
      if (err?.response?.status === 404) {
        setNotFound(true);
      } else {
        console.error("Load ad error:", err);
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);
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
    if (!p?.governorateId) {
      setCities([]);
      return;
    }
    (async () => {
      try {
        const res = await api.get("/cities", { params: { governorateId: p.governorateId, active: true } });
        setCities(res.data || []);
      } catch {
        setCities([]);
      }
    })();
  }, [p?.governorateId]);
  useEffect(() => {
    if (user) setChatLink(`/chat/${id}`);
  }, [user, id]);
  useEffect(() => {
    (async () => {
      if (!p || notFound) return;
      const sellerId = p.userId?._id || p.userId;
      
      // Rule 1: Skip incrementing if current user is owner or admin
      if (user) {
        if (user.role === "admin" || String(user._id || user.id) === String(sellerId || "")) {
          console.log("Skipping view: user is owner or admin");
          return;
        }
      }

      // Rule 2: Skip if already viewed in this browser (localStorage check)
      const userKey = user ? (user._id || user.id) : "guest";
      const key = `viewed:${id}:${userKey}`;
      if (localStorage.getItem(key)) {
        console.log("Skipping view: already recorded in localStorage");
        return;
      }

      try {
        console.log("Sending view increment request...");
        const res = await api.post(`/ads/${id}/view`);
        if (res.data?.counted) {
          console.log("View counted successfully");
          // Update local state to reflect new count immediately
          setP(prev => ({ ...prev, viewCount: res.data.viewCount }));
          localStorage.setItem(key, "1");
        } else {
          console.log("View not counted:", res.data?.reason);
          if (res.data?.reason === "duplicate") {
            localStorage.setItem(key, "1");
          }
        }
      } catch (err) {
        console.error("View increment error:", err);
      }
    })();
  }, [id, p?._id, user?._id]);
  useEffect(() => {
    (async () => {
      // Don't fetch comments if still loading main ad data or if ad was not found
      if (loading || notFound || !id || id === "undefined") return;
      
      setCommentsLoading(true);
      try {
        const res = await api.get(`/ads/${id}/comments`, { params: { page: cPage, limit: 10 } });
        const data = res.data && res.data.items ? res.data : { items: res.data, page: 1, pages: 1 };
        if (cPage === 1) setComments(data.items || []);
        else setComments((prev) => [...prev, ...(data.items || [])]);
        setCPages(data.pages || 1);
      } catch {
        setComments([]);
      } finally {
        setCommentsLoading(false);
      }
    })();
  }, [id, cPage, loading, notFound]);

  useEffect(() => {
    if (loading || notFound || !p) return;
    (async () => {
      try {
        const sellerId = p.userId?._id || p.userId;
        if (!sellerId) return;
        
        const res = await api.get(`/reviews/seller/${sellerId}`);
        setReviews(res.data.items || []);
        setAverageRating(res.data.stats?.avgRating || 0);
        setTotalReviews(res.data.stats?.count || 0);
        setSellerStats({
          avgReliability: res.data.stats?.avgReliability || 0,
          avgCommunication: res.data.stats?.avgCommunication || 0,
          avgDeliverySpeed: res.data.stats?.avgDeliverySpeed || 0
        });
      } catch (err) {
        console.error("Reviews error:", err);
      }
    })();
  }, [p, loading, notFound]);

  const openConversation = async () => {
    if (!user) {
      navigate("/login", { state: { from: window.location.pathname } });
      return;
    }
    try {
      setConvOpening(true);
      const r = await api.post("/conversations/open", { adId: id });
      if (r.data?._id) {
        navigate(`/messages?c=${r.data._id}&direct=1`);
      }
    } catch (err) {
      window.dispatchEvent(new CustomEvent("admin:toast", { 
        detail: { message: err.response?.data?.error || "تعذر فتح المحادثة", type: "error" } 
      }));
    } finally {
      setConvOpening(false);
    }
  };

  const trackClick = async (type) => {
    try {
      await api.post(`/ads/${id}/click`, { type });
    } catch (err) {
      console.error("Click tracking failed:", err);
    }
  };

  const postComment = async () => {
    setCommentErr("");
    if (!user) {
      setCommentErr("يجب تسجيل الدخول لكتابة تعليق");
      return;
    }
    if (!commentText.trim()) {
      setCommentErr("النص مطلوب");
      return;
    }
    try {
      setCommentSubmitting(true);
      const res = await api.post(`/ads/${id}/comments`, { text: commentText });
      setComments((cs) => [res.data, ...cs]);
      setCommentText("");
    } catch {
      setCommentErr("تعذر إضافة التعليق");
    } finally { setCommentSubmitting(false); }
  };

  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  // postReview was moved to OrderDetail.jsx or separate review flow as it is now order-based.

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
      const categoryLabel = REPORT_CONFIG.ad.categories.find(c => c.id === reportCategory)?.label || "عام";
      await api.post(`/ads/${id}/report`, { 
        category: categoryLabel,
        reason: reportReason,
        details: reportDetails
      });
      setReportDone(true);
    } catch {
      setReportMsg("تعذر إرسال البلاغ");
    } finally { setReportSubmitting(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><LoadingSpinner size="lg" /></div>;
  
  if (notFound || !p) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-6">
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-2">{notFound ? "الإعلان غير موجود" : "خطأ في تحميل الإعلان"}</h2>
        <p className="text-gray-500 mb-8 max-w-md">
          {notFound 
            ? "عذراً، يبدو أن الإعلان الذي تبحث عنه قد تم حذفه أو أن الرابط غير صحيح."
            : "حدث خطأ غير متوقع أثناء محاولة تحميل بيانات الإعلان. يرجى المحاولة مرة أخرى لاحقاً."}
        </p>
        <div className="flex gap-4">
          <button onClick={() => window.location.reload()} className="ds-btn-primary px-8">إعادة المحاولة</button>
          <Link to="/" className="ds-btn border border-gray-300 px-8">العودة للرئيسية</Link>
        </div>
      </div>
    );
  }

  const sellerId = p.userId?._id || p.userId;
  const isMyAd = user && String(sellerId) === String(user?.id);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6 pb-12 dark:text-slate-100">
      {/* Navigation & Back Button */}
      <div className="flex items-center justify-between gap-4">
        {/* Breadcrumbs - Better accessibility */}
        <nav className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 overflow-x-auto whitespace-nowrap pb-2 flex-1">
          <Link to="/" className="hover:text-blue-600">الرئيسية</Link>
          <svg className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {p.parentCategory && (
            <>
              <Link to={`/category/${p.parentCategory.slug}`} className="hover:text-blue-600">{p.parentCategory.name}</Link>
              <svg className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </>
          )}
          <span className="text-gray-900 dark:text-slate-100 font-medium truncate">{p.title}</span>
        </nav>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* SEO Implementation */}
        {p && (
          <SEO 
            title={p.title} 
            description={p.description} 
            image={p.images?.[0] ? uploadsUrl(p.images[0]) : null}
            type="product"
            price={p.price}
            currency={p.currency}
          />
        )}
        {/* Left Column: Images and Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Card */}
          <div className="overflow-hidden rounded-2xl border dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
            {/* Image Gallery */}
            <div className="relative">
              <div 
                className="w-full flex items-center justify-center bg-white dark:bg-slate-900 cursor-zoom-in overflow-hidden h-[350px] sm:h-[550px] border-b dark:border-slate-800"
                onClick={() => { setLbIndex(0); setLbOpen(true); }}
              >
                {p.images?.[0] ? (
                  <img
                    src={uploadsUrl(p.images[0], "full")}
                    alt={p.title}
                    className="w-full h-full object-contain hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-gray-400 gap-2">
                    <svg className="h-20 w-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs font-bold">لا توجد صور</span>
                  </div>
                )}
              </div>

              {/* Badges */}
              <div className="absolute top-4 right-4 flex flex-col gap-2">
                {p.status === "sold" && (
                  <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white shadow-lg">
                    ✓ مباع
                  </span>
                )}
                {p.isFeatured && (
                  <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white shadow-lg">
                    ⭐ إعلان مميز
                  </span>
                )}
                {p.adType === "order" && (
                  <span className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-black text-white shadow-lg ring-2 ring-white/20">
                    طلب شراء
                  </span>
                )}
                {p.condition && p.adType !== "order" && isConditionEnabled(p.parentCategory?.name || p.categoryId?.parentId?.name || p.categoryId?.name || "") && (
                  <span className={`rounded-full px-3 py-1 text-xs font-bold shadow-lg ${
                    p.condition === "new" ? "bg-emerald-600 text-white" : "bg-indigo-600 text-white"
                  }`}>
                    {p.condition === "new" ? "جديد" : "مستعمل"}
                  </span>
                )}
              </div>

              {/* Image Count Overlay */}
              {p.images?.length > 1 && (
                <div className="absolute bottom-4 left-4 rounded-lg bg-black/60 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm">
                  {p.images.length} صور
                </div>
              )}
            </div>

            {/* Thumbnail Strip */}
            {p.images?.length > 1 && (
              <div className="flex gap-2 overflow-x-auto p-4 border-t scrollbar-hide">
                {p.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => { setLbIndex(i); setLbOpen(true); }}
                    className="h-20 w-28 flex-shrink-0 overflow-hidden rounded-lg border-2 border-transparent hover:border-blue-500 transition-all"
                  >
                    <img src={uploadsUrl(img, "thumb")} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Content Details */}
            <div className="p-4 sm:p-6 space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 min-w-0 space-y-3">
                  <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-slate-100 leading-tight break-words">
                    {p.title}
                  </h1>
                  
                  <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs sm:text-sm text-gray-500">
                    <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-md">
                      <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="font-bold">{p.governorateId?.name}</span>
                      {p.cityId?.name && <span className="text-gray-300 mx-0.5">•</span>}
                      <span className="font-medium">{p.cityId?.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-medium">{new Date(p.createdAt).toLocaleDateString("ar-EG")}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span>{(p.viewCount || p.views || 0).toLocaleString("ar-EG")} مشاهدة</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                      </svg>
                      <span>
                        {p.contactsCount > 20 
                          ? "أكثر من 20 شخص تواصلوا مع البائع" 
                          : `أشخاص تواصلوا مع البائع: ${(p.contactsCount || 0).toLocaleString("ar-EG")}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-xl sm:text-2xl font-black text-blue-600">
                        {p.priceOnContact ? "السعر عند التواصل" : `${p.price?.toLocaleString()} ${formatCurrency(p.currency)}`}
                      </div>
                      {p.negotiable && (
                        <span className="text-[10px] sm:text-xs font-black text-green-700 bg-green-100 px-2 py-1 rounded-full border border-green-200 uppercase tracking-wide">
                          قابل للتفاوض
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Description directly under the price */}
              <div className="border-t pt-4 mt-2">
                <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 mb-2">الوصف</h3>
                <div className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{p.description}</div>
                {p.tagNames?.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-3">
                    {p.tagNames.map((tag, i) => (
                      <Link 
                        key={i} 
                        to={`/tag/${tag}`}
                        className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-medium hover:bg-gray-200 transition-colors"
                      >
                        #{tag}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Mobile Tabs Navigation */}
              <div className="sm:hidden sticky top-0 z-10 bg-white dark:bg-slate-900 border-y dark:border-slate-800 -mx-4 px-4 overflow-x-auto scrollbar-hide mb-4">
                <div className="flex whitespace-nowrap">
                  {[
                    { id: "specs", label: "المواصفات", show: p.attributes?.length > 0 },
                    { id: "reviews", label: "التقييمات" },
                    { id: "comments", label: "التعليقات" }
                  ].filter(t => t.show !== false).map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${
                        activeTab === tab.id 
                          ? "border-blue-600 text-blue-600" 
                          : "border-transparent text-gray-500 dark:text-slate-400"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>


            </div>
          </div>

          {/* Specifications Card */}
          {p.attributes?.length > 0 && (
            <div className={`rounded-2xl border dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm ${activeTab !== 'specs' ? 'hidden sm:block' : ''}`}>
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-4">المواصفات</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {p.attributes.map((a, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800">
                    <span className="text-sm text-gray-500 dark:text-slate-400 font-medium">{a.attributeId?.label || a.attributeId?.name}</span>
                    <span className="text-sm text-gray-900 dark:text-slate-100 font-bold">{String(a.value) === "true" ? "نعم" : String(a.value) === "false" ? "لا" : a.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reviews & Ratings Section (Seller Based) */}
          <div className={`rounded-2xl border dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-sm mb-6 ${activeTab !== 'reviews' ? 'hidden sm:block' : ''}`}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
              <div className="text-center sm:text-right">
                <h3 className="text-lg sm:text-xl font-black text-gray-900 dark:text-slate-100 flex items-center justify-center sm:justify-start gap-2">
                  <span>تقييمات ومراجعات البائع</span>
                  {totalReviews > 0 && (
                    <span className="text-xs font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">{totalReviews}</span>
                  )}
                </h3>
                <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest">
                  تقييم أداء البائع بناءً على تجارب المشترين السابقين
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 bg-gray-50/50 dark:bg-slate-800/30 p-4 rounded-2xl border border-gray-100 dark:border-slate-800">
                {/* Overall Stats */}
                <div className="grid grid-cols-3 gap-6 sm:gap-8 w-full sm:w-auto">
                  <div className="text-center">
                    <p className="text-[8px] sm:text-[9px] font-black text-gray-400 uppercase mb-1">المصداقية</p>
                    <p className="text-xs sm:text-sm font-black text-emerald-600">{sellerStats.avgReliability?.toFixed(1) || "0.0"}</p>
                  </div>
                  <div className="text-center border-x border-gray-200 dark:border-slate-700 px-4 sm:px-6">
                    <p className="text-[8px] sm:text-[9px] font-black text-gray-400 uppercase mb-1">التواصل</p>
                    <p className="text-xs sm:text-sm font-black text-blue-600">{sellerStats.avgCommunication?.toFixed(1) || "0.0"}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[8px] sm:text-[9px] font-black text-gray-400 uppercase mb-1">التسليم</p>
                    <p className="text-xs sm:text-sm font-black text-amber-600">{sellerStats.avgDeliverySpeed?.toFixed(1) || "0.0"}</p>
                  </div>
                </div>

                {averageRating > 0 && (
                  <div className="flex flex-col items-center sm:items-end sm:border-r border-gray-200 dark:border-slate-700 sm:pr-8 sm:mr-2 w-full sm:w-auto pt-4 sm:pt-0 border-t sm:border-t-0">
                    <div className="flex items-center gap-2">
                      <span className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white">{averageRating.toFixed(1)}</span>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex text-amber-400">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <svg key={s} className={`w-4 h-4 sm:w-5 h-5 ${s <= Math.round(averageRating) ? 'fill-current' : 'fill-gray-200'}`} viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                          ))}
                        </div>
                        <p className="text-[8px] sm:text-[10px] font-bold text-gray-400 uppercase text-center sm:text-right">متوسط التقييم العام</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Reviews List */}
            <div className="space-y-4">
              {reviews.map((r, i) => (
                <div key={i} className="flex flex-col sm:flex-row gap-4 p-4 sm:p-5 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 group hover:bg-white dark:hover:bg-slate-800 transition-all hover:shadow-xl hover:shadow-gray-200/50 dark:hover:shadow-none">
                  <div className="flex items-center gap-3 sm:block">
                    <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black shadow-lg shrink-0 group-hover:scale-105 transition-transform overflow-hidden">
                      {r.buyerId?.avatar ? (
                        <img src={uploadsUrl(r.buyerId.avatar)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        (r.buyerId?.name || "?").slice(0,1)
                      )}
                    </div>
                    <div className="sm:hidden flex flex-col">
                      <span className="text-sm font-black text-gray-900 dark:text-slate-100">{r.buyerId?.name}</span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase">{new Date(r.createdAt).toLocaleDateString("ar-EG")}</span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="hidden sm:inline text-sm font-black text-gray-900 dark:text-slate-100">{r.buyerId?.name}</span>
                        <div className="flex text-amber-400">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <svg key={s} className={`w-3.5 h-3.5 ${s <= r.rating ? 'fill-current' : 'fill-gray-200'}`} viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                          ))}
                        </div>
                        {r.adId && (
                          <span className="text-[9px] font-black text-blue-600 bg-blue-100 px-2 py-0.5 rounded-md uppercase tracking-tighter border border-blue-200">
                            عن: {r.adId.title?.slice(0, 25)}...
                          </span>
                        )}
                      </div>
                      <span className="hidden sm:inline text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase">{new Date(r.createdAt).toLocaleDateString("ar-EG")}</span>
                    </div>
                    {r.comment && (
                      <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed font-bold bg-white/50 dark:bg-slate-900/50 p-3 rounded-xl border border-gray-100 dark:border-slate-800 italic">
                        "{r.comment}"
                      </p>
                    )}
                    {r.images?.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {r.images.map((img, idx) => (
                          <div key={idx} className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl overflow-hidden border border-gray-100 dark:border-slate-700 shadow-sm cursor-pointer hover:scale-105 transition-transform">
                            <img src={uploadsUrl(img)} alt="" className="h-full w-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {reviews.length === 0 && (
                <div className="text-center py-12 flex flex-col items-center gap-4 animate-in fade-in duration-700">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-black text-gray-900 dark:text-slate-100">لا توجد تقييمات لهذا البائع بعد</p>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">تظهر التقييمات هنا بعد إتمام عمليات شراء ناجحة</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Comments Section */}
          <div className={`rounded-2xl border dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm ${activeTab !== 'comments' ? 'hidden sm:block' : ''}`}>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">التعليقات والاستفسارات العامة</h3>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">(أسئلة حول الإعلان)</span>
            </div>
            <div className="space-y-6">
              <div className="flex gap-3">
                <input 
                  className="flex-1 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 dark:text-slate-100 transition-all" 
                  placeholder="لديك استفسار؟ اكتبه هنا..." 
                  value={commentText} 
                  onChange={(e) => setCommentText(e.target.value)} 
                />
                <button 
                  className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-100" 
                  disabled={commentSubmitting} 
                  onClick={() => checkPledge(postComment)}
                >
                  {commentSubmitting ? "..." : "إرسال"}
                </button>
              </div>
              
              <div className="space-y-4">
                {comments.map((c, i) => (
                  <div key={i} className="flex gap-3 p-4 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800">
                    <Link 
                      to={`/user/${c.userId?._id || c.userId}`}
                      className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold flex-shrink-0 hover:ring-2 hover:ring-blue-500 transition-all overflow-hidden"
                    >
                      {c.userId?.avatar ? (
                        <img 
                          src={uploadsUrl(c.userId.avatar, "thumb")} 
                          alt="" 
                          className="w-full h-full object-cover" 
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = uploadsUrl(c.userId.avatar, "full");
                          }}
                        />
                      ) : (
                        (c.userId?.name || "?").slice(0,1)
                      )}
                    </Link>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Link 
                          to={`/user/${c.userId?._id || c.userId}`}
                          className="text-sm font-bold text-gray-900 dark:text-slate-100 hover:text-blue-600 transition-colors"
                        >
                          {c.userId?.name}
                        </Link>
                        <span className="text-[10px] text-gray-400 dark:text-slate-500">{new Date(c.createdAt).toLocaleDateString("ar-EG")}</span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">{c.text}</p>
                    </div>
                  </div>
                ))}
                {comments.length === 0 && !commentsLoading && (
                  <div className="text-center py-8 text-gray-400 text-sm">لا توجد تعليقات بعد. كن أول من يعلق!</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Seller and Actions */}
        <div className="space-y-6">
          {/* Seller Card */}
          <div className="rounded-2xl border dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm sticky top-24">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="relative">
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-2xl font-bold text-white shadow-xl ring-4 ring-white overflow-hidden">
                  {p.userId?.avatar ? (
                    <img src={uploadsUrl(p.userId.avatar, "thumb")} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (p.userId?.name || "?").slice(0,1)
                  )}
                </div>
                {(p.userId?.verificationStatus === 'verified' || p.userId?.role === 'admin' || p.userId?.isVerifiedSeller) && (
                  <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-white p-1 shadow-lg">
                    <div className="h-full w-full rounded-full bg-blue-600 flex items-center justify-center text-white">
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
              
              <div className={`text-center p-4 rounded-2xl transition-all w-full ${
                (p.userId?.verificationStatus === 'verified' || p.userId?.role === 'admin' || p.userId?.isVerifiedSeller)
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-100 dark:shadow-none" 
                  : "bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700"
              }`}>
                <Link 
                  to={`/s/${sellerId}`} 
                  className={`text-lg font-bold transition-colors block truncate px-2 ${
                    (p.userId?.verificationStatus === 'verified' || p.userId?.role === 'admin' || p.userId?.isVerifiedSeller) ? "text-white hover:text-blue-50" : "text-gray-900 dark:text-slate-100 hover:text-blue-600"
                  }`}
                >
                  {p.userId?.name || "البائع"}
                </Link>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-1 px-2">
                  {(p.userId?.verificationStatus === 'verified' || p.userId?.role === 'admin' || p.userId?.isVerifiedSeller) && (
                    <span className="text-[10px] font-black bg-white/20 text-white px-2 py-0.5 rounded-full uppercase tracking-wider border border-white/30 flex items-center gap-1 shrink-0">
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {p.userId?.role === 'admin' ? "مسؤول" : "موثّق"}
                    </span>
                  )}
                  <span className={`text-xs font-medium shrink-0 ${p.userId?.isVerifiedSeller ? "text-blue-100" : "text-gray-500"}`}>
                    {followersCount} متابع
                  </span>
                </div>
              </div>

              <div className="flex flex-col w-full gap-3 pt-4 border-t dark:border-slate-800">
                <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 dark:text-slate-500">
                  <span>إحصائيات البائع</span>
                  <span className="text-blue-600 dark:text-blue-400">سجل سوقك</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-3 border border-gray-100 dark:border-slate-800 flex flex-col items-center justify-center">
                    <span className="text-xs font-black text-gray-900 dark:text-slate-100">{sellerAdsCount}</span>
                    <span className="text-[9px] text-gray-500 dark:text-slate-400 font-bold">إعلانات نشطة</span>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-3 border border-gray-100 dark:border-slate-800 flex flex-col items-center justify-center">
                    <span className="text-xs font-black text-gray-900 dark:text-slate-100">{followersCount}</span>
                    <span className="text-[9px] text-gray-500 dark:text-slate-400 font-bold">متابع</span>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-3 border border-gray-100 dark:border-slate-800 flex flex-col items-center justify-center col-span-2">
                    <span className="text-[10px] font-black text-gray-700 dark:text-slate-200">
                      عضو منذ {p.userId?.createdAt ? new Date(p.userId.createdAt).toLocaleDateString('ar-YE', { month: 'long', year: 'numeric' }) : "تاريخ غير متوفر"}
                    </span>
                  </div>
                </div>
              </div>



              {!isMyAd && (
                <div className="flex gap-2 w-full">
                  <button 
                    onClick={async () => {
                      if (!user) return navigate("/login");
                      try {
                        const r = await api.post(`/follows/${sellerId}`);
                        setFollowingSeller(!!r.data?.following);
                        const c = await api.get(`/follows/count/${sellerId}`);
                        setFollowersCount(Number(c.data?.count || 0));
                      } catch {}
                    }}
                    className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                      followingSeller 
                        ? "bg-gray-100 text-gray-600 hover:bg-gray-200" 
                        : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-100 dark:shadow-none"
                    }`}
                  >
                    {followingSeller ? "إلغاء المتابعة" : "متابعة البائع"}
                  </button>
                </div>
              )}

              <div className="w-full h-px bg-gray-100 my-2"></div>

              {isMyAd ? (
                <div className="space-y-3 w-full">
                    <Link 
                      to={`/edit-ad/${id}`}
                      className="w-full flex items-center justify-center gap-3 rounded-xl bg-amber-500 px-6 py-3.5 text-sm font-bold text-white hover:bg-amber-600 transition-all shadow-lg shadow-amber-100 active:scale-95"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      تعديل الإعلان
                    </Link>
                </div>
              ) : (
                <div className="space-y-3 w-full">
                  <button 
                    onClick={() => checkPledge(openConversation)}
                    disabled={convOpening}
                    className="w-full flex items-center justify-center gap-3 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    {convOpening ? "جارٍ التحميل..." : "إرسال رسالة"}
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    {p.contactInfo?.showWhatsApp && (
                      <button 
                        onClick={() => checkPledge(() => {
                          trackClick("whatsapp");
                          window.open(`https://wa.me/${p.contactInfo.whatsapp?.replace(/\D/g, '')}`, "_blank");
                        })}
                        className="flex items-center justify-center gap-2 rounded-xl bg-green-500 px-4 py-3 text-sm font-bold text-white hover:bg-green-600 transition-all shadow-lg shadow-green-100 active:scale-95"
                      >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 5.763h-.004c-1.177 0-2.339-.311-3.358-.898l-.24-.144-2.503.658.669-2.439-.159-.251C6.17 15.753 5 13.586 5 11.247c0-4.024 3.272-7.292 7.292-7.292 1.951 0 3.784.76 5.16 2.14 1.375 1.378 2.13 3.212 2.128 5.164 0 4.023-3.273 7.291-7.292 7.291m9.66-13.268c-2.577-2.576-6.006-3.994-9.656-3.994C7.372 2.883 2.883 7.372 2.883 13c0 1.846.508 3.645 1.47 5.217L2 22l3.873-1.353C7.422 21.556 9.195 22 11.004 22h.004c6.628 0 12.117-5.489 12.117-12.117 0-3.238-1.26-6.287-3.551-8.578"/>
                        </svg>
                        واتساب
                      </button>
                    )}
                    {p.contactInfo?.showPhone && (
                      <button 
                        onClick={() => checkPledge(() => {
                          trackClick("phone");
                          window.location.href = `tel:${p.contactInfo.phone}`;
                        })}
                        className="flex items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 py-3 text-sm font-bold text-white hover:bg-blue-600 transition-all shadow-lg shadow-blue-100 active:scale-95"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        اتصال
                      </button>
                    )}
                  </div>

                  {/* Secure Purchase Button */}
                  <button 
                    onClick={() => setSecurePurchaseModalOpen(true)}
                    className="w-full flex items-center justify-center gap-3 rounded-xl bg-emerald-600 px-6 py-4 text-sm font-black text-white hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 active:scale-95 ring-4 ring-emerald-50"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    شراء آمن (وساطة المنصة)
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2 w-full pt-2">
                <button 
                  onClick={async () => {
                    try {
                      const r = await api.post(`/favorites/${id}`);
                      const favorited = !!r.data?.favorited;
                      setFav(favorited);
                      
                      // Dispatch event for Navbar count update
                      window.dispatchEvent(new CustomEvent("favorite:updated"));
                      
                      // Show toast with action to go to favorites
                      window.dispatchEvent(new CustomEvent("admin:toast", { 
                        detail: { 
                          message: favorited ? "تمت إضافة الإعلان للمفضلة" : "تمت إزالة الإعلان من المفضلة", 
                          type: "success",
                          actionLabel: favorited ? "عرض المفضلات" : null,
                          actionPath: favorited ? "/favorites" : null
                        } 
                      }));
                    } catch (err) {
                      console.error("Favorite error:", err);
                    }
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
                    fav ? "bg-red-50 text-red-600 border border-red-100" : "bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100"
                  }`}
                >
                  <svg className={`h-4 w-4 ${fav ? "fill-current" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  {fav ? "مضاف للمفضلة" : "حفظ الإعلان"}
                </button>
                <button 
                  onClick={handleShare}
                  className="flex items-center justify-center gap-2 rounded-xl bg-gray-50 border border-gray-100 px-4 py-2.5 text-xs font-bold text-blue-600 hover:bg-blue-50 transition-all"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 100-2.684 3 3 0 000 2.684zm0 12.684a3 3 0 100-2.684 3 3 0 000 2.684z" />
                  </svg>
                  مشاركة
                </button>
                <button 
                  onClick={() => setReportOpen(true)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-gray-50 border border-gray-100 px-4 py-2.5 text-xs font-bold text-gray-500 hover:bg-gray-100 transition-all"
                >
                  إبلاغ
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Similar Ads Section */}
      {similarAds.length > 0 && (
        <div className="pt-10 border-t">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black text-gray-900 dark:text-slate-100">إعلانات مشابهة قد تهمك</h3>
            {(p.categoryId?.slug || p.parentCategory?.slug) && (
              <Link 
                to={`/category/${p.categoryId?.slug || p.parentCategory?.slug}`} 
                className="text-sm font-bold text-blue-600 hover:underline"
              >
                عرض المزيد
              </Link>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
            {similarAds.map((ad) => (
              <ProductCard key={ad._id} product={ad} featured={!!ad.featured} to={`/ad/${ad._id}`} />
            ))}
          </div>
        </div>
      )}

      {/* Commission Pledge Modal */}
      {pledgeOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar rounded-[2rem] sm:rounded-[2.5rem] bg-white p-6 sm:p-10 shadow-2xl border border-blue-100 animate-in zoom-in-95 duration-300 text-right" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 text-center sm:text-right">
              <h2 className="text-xl sm:text-3xl font-black text-gray-900 leading-tight">ميثاق الأمانة والعمولة</h2>
              <div className="mt-2 sm:mt-3 h-1 w-12 sm:w-16 bg-blue-600 mx-auto sm:ml-auto sm:mr-0 rounded-full" />
            </div>

            <div className="space-y-4 sm:space-y-6 text-right">
              <div className="space-y-2 bg-gray-50/50 p-4 sm:p-6 rounded-2xl border border-gray-100">
                <p className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-[0.1em] sm:tracking-[0.2em] text-center sm:text-right">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</p>
                <p className="text-sm leading-relaxed text-gray-700 sm:text-xl text-center sm:text-right">
                  قال الله تعالى: <span className="font-black text-gray-900 text-base sm:text-2xl block mt-1 sm:mt-2 mb-0.5 sm:mb-1">« يَا أَيُّهَا الَّذِينَ آمَنُوا أَوْفُوا بِالْعُقُودِ »</span> 
                  <span className="text-[10px] sm:text-xs text-gray-400 font-medium">صدق الله العظيم</span>
                </p>
              </div>

              <div className="space-y-3 sm:space-y-4 pt-1 sm:pt-2">
                <div className="flex-1 space-y-2">
                  <span className="block text-[13px] sm:text-lg font-black leading-relaxed text-gray-800">
                    أقر وأتعهد بالأمانة التامة، وألتزم بدفع عمولة المنصة المقدرة بـ 1% من قيمة البيع، في حال تم الاتفاق مع صاحب طلب الشراء هذا وإتمام العملية بنجاح.
                  </span>
                  <p className="text-[12px] sm:text-base font-bold leading-relaxed text-gray-600">
                    كما ألتزم بتحويل العمولة فور استلام ثمن السلعة، أو خلال مدة لا تتجاوز 10 أيام عمل.
                  </p>
                </div>
              </div>

              <div className="space-y-2 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 sm:p-6 text-right">
                <h4 className="text-[13px] sm:text-lg font-black text-amber-800 flex items-center gap-2 justify-start mb-1 sm:mb-2">
                  <div className="rounded-full bg-amber-200 p-1 sm:p-1.5">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  ملاحظة هامة بشأن الرسوم
                </h4>
                <p className="text-[12px] sm:text-base leading-relaxed text-amber-900 font-bold">
                  رسوم المنصة هي أمانة في ذمة المستخدم (البائع)، ولا تبرأ ذمته منها إلا بعد سدادها للمنصة. 
                  نحن نثق في أمانتكم لضمان استمرار تقديم الخدمة وتطويرها.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-6 sm:mt-8">
              <button 
                onClick={() => {
                  // Save acceptance for future order ads
                  localStorage.setItem("orderPledgeAccepted", "true");
                  setPledgeOpen(false);
                  if (pendingAction) {
                    pendingAction();
                    setPendingAction(null);
                  }
                }}
                className="flex-1 h-12 sm:h-14 rounded-2xl bg-blue-600 text-white font-black hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 active:scale-95 text-base sm:text-lg order-1 sm:order-2"
              >
                أوافق وأتعهد
              </button>
              <button 
                onClick={() => {
                  setPledgeOpen(false);
                  setPendingAction(null);
                }}
                className="flex-1 h-12 sm:h-14 rounded-2xl bg-gray-100 text-gray-500 font-bold hover:bg-gray-200 transition-all active:scale-95 text-sm sm:text-base order-2 sm:order-1"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm" onClick={() => { if(!reportSubmitting) setReportOpen(false); setReportDone(false); }}>
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar rounded-[2rem] sm:rounded-[2.5rem] bg-white p-5 sm:p-8 shadow-2xl animate-in fade-in zoom-in duration-300 border border-gray-100" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6 sticky top-0 bg-white/95 backdrop-blur-sm z-10 -mx-2 px-2 pb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center shadow-inner shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-xl font-black text-gray-900">إبلاغ عن إعلان</h3>
              </div>
              <button onClick={() => setReportOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 sm:p-2 hover:bg-gray-50 rounded-full">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {reportDone ? (
              <div className="text-center py-6 animate-in zoom-in-95">
                <div className="h-16 w-16 sm:h-20 sm:w-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-inner">
                  <svg className="h-8 w-8 sm:h-10 sm:w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="text-xl sm:text-2xl font-black text-gray-900 mb-2">تم الإرسال بنجاح</h4>
                <p className="text-sm text-gray-500 font-medium mb-6 sm:mb-8">شكراً لمساعدتنا في الحفاظ على جودة وأمان المنصة.</p>
                <button onClick={() => setReportOpen(false)} className="w-full h-12 rounded-2xl bg-gray-900 text-white font-black hover:bg-black transition-all shadow-lg active:scale-95 text-sm sm:text-base">إغلاق</button>
              </div>
            ) : (
              <div className="space-y-4 sm:space-y-5">
                {reportMsg && <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-[11px] sm:text-xs font-bold text-red-600 animate-in fade-in slide-in-from-top-2">{reportMsg}</div>}
                
                <MobileSelect 
                  label="الفئة"
                  value={reportCategory}
                  onChange={(e) => { setReportCategory(e.target.value); setReportReason(""); }}
                  options={REPORT_CONFIG.ad.categories.map(c => ({ value: c.id, label: c.label }))}
                  placeholder="اختر فئة البلاغ..."
                />

                {reportCategory && (
                  <MobileSelect 
                    label="السبب المحدد"
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    options={[
                      ...REPORT_CONFIG.ad.categories.find(c => c.id === reportCategory).reasons.map(r => ({ value: r, label: r })),
                      { value: "أخرى", label: "سبب آخر" }
                    ]}
                    placeholder="اختر السبب..."
                  />
                )}

                {reportReason && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <label className="mb-2 block text-[10px] font-black text-gray-400 uppercase tracking-wider px-1">تفاصيل إضافية (اختياري)</label>
                    <textarea
                      className="ds-input w-full h-24 sm:h-28 bg-gray-50 border-gray-100 font-medium focus:bg-white transition-all resize-none py-3"
                      placeholder="يرجى توضيح المزيد لمساعدتنا في المراجعة..."
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                    />
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button 
                    onClick={sendReport}
                    disabled={reportSubmitting || !reportReason}
                    className="flex-[2] h-12 rounded-2xl bg-red-600 text-white font-black hover:bg-red-700 disabled:opacity-50 transition-all shadow-lg shadow-red-100 active:scale-95 text-sm sm:text-base"
                  >
                    {reportSubmitting ? "جارٍ الإرسال..." : "إرسال البلاغ"}
                  </button>
                  <button onClick={() => setReportOpen(false)} className="flex-1 h-12 rounded-2xl bg-gray-100 text-gray-600 font-black hover:bg-gray-200 transition-all active:scale-95 text-sm sm:text-base">إلغاء</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox - Already improved in previous steps */}
      {lbOpen && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-4 select-none"
          onWheel={handleWheel}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Header Controls */}
          <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between bg-black/40 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                onClick={() => { setLbOpen(false); resetZoom(); }}
                title="إإغلاق"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <span className="text-sm font-medium text-white/80" dir="rtl">
                {lbIndex + 1} / {p.images?.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-30"
                onClick={() => setLbScale(prev => Math.min(prev + 0.5, 5))}
                disabled={lbScale >= 5}
                title="تكبير"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </button>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-30"
                onClick={() => {
                  setLbScale(prev => {
                    const next = Math.max(prev - 0.5, 0.5);
                    if (next <= 1) setLbOffset({ x: 0, y: 0 });
                    return next;
                  });
                }}
                disabled={lbScale <= 0.5}
                title="تصغير"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                </svg>
              </button>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                onClick={resetZoom}
                title="إإعادة ضبط"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Navigation Buttons */}
          {p.images?.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50 transition-all"
                onClick={() => { setLbIndex((i) => (i - 1 + p.images.length) % p.images.length); resetZoom(); }}
              >
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                className="absolute right-4 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50 transition-all"
                onClick={() => { setLbIndex((i) => (i + 1) % p.images.length); resetZoom(); }}
              >
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {/* Image Container */}
          <div 
            className="relative h-full w-full overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
          >
            <div 
              className={`transition-transform duration-200 ease-out ${isDragging ? 'duration-0' : ''}`}
              style={{ transform: `translate(${lbOffset.x}px, ${lbOffset.y}px) scale(${lbScale})` }}
            >
              <img
                src={uploadsUrl(p.images?.[lbIndex])}
                alt=""
                className="max-h-[85vh] max-w-[90vw] select-none rounded-sm object-contain shadow-2xl pointer-events-none"
                onDoubleClick={() => {
                  if (lbScale !== 1) resetZoom();
                  else setLbScale(2);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Secure Purchase Modal */}
      <SecurePurchaseModal 
        isOpen={securePurchaseModalOpen}
        onClose={() => setSecurePurchaseModalOpen(false)}
        ad={p}
      />
    </div>
  );
}
