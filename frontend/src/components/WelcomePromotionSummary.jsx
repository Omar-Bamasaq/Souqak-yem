import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApi } from "../api/axios.js";
import { useAuth } from "../store/AuthContext.jsx";

export default function WelcomePromotionSummary() {
  const api = useApi();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ad, setAd] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      checkSummary();
    }
  }, [user]);

  const checkSummary = async () => {
    try {
      const res = await api.get("/ads/welcome-promotion/summary");
      if (res.data) {
        setAd(res.data);
      }
    } catch {}
  };

  const handleClose = async () => {
    if (!ad) return;
    try {
      await api.post(`/ads/welcome-promotion/summary/${ad._id}/shown`);
      setAd(null);
    } catch {}
  };

  const handlePromote = async () => {
    if (!ad) return;
    try {
      await api.post(`/ads/welcome-promotion/summary/${ad._id}/promote-click`);
    } catch {}
    await handleClose();
    // In a real flow, we would redirect to a specific checkout page for this ad
    // For now, redirecting to pricing or ad detail with promotion intent
    navigate(`/pricing?adId=${ad._id}`);
  };

  if (!ad) return null;

  const stats = ad.promotionStats || {};
  const isHighPerformance = (stats.views > 100) || (stats.messages > 3);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in fade-in duration-500">
      <div className="w-full max-w-lg rounded-[2.5rem] bg-white shadow-2xl overflow-hidden animate-in zoom-in slide-in-from-bottom-8 duration-500">
        {/* Top Decorative Banner */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-800 p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10">
            <svg width="100%" height="100%"><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="white" strokeWidth="1"/></pattern><rect width="100%" height="100%" fill="url(#grid)" /></svg>
          </div>
          <div className="relative z-10">
            <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center text-4xl shadow-inner backdrop-blur-md mx-auto mb-4 border border-white/30 animate-bounce">
              🎁
            </div>
            <h2 className="text-2xl font-black text-white mb-2">انتهى التمييز المجاني</h2>
            <p className="text-blue-100 text-sm font-bold">شاهد النتائج الرائعة التي حققها إعلانك!</p>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* Ad Preview Card */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
            {ad.images?.[0] && (
              <img 
                src={`${import.meta.env.VITE_API_URL}/uploads/${ad.images[0]}`} 
                alt={ad.title}
                className="w-16 h-16 rounded-xl object-cover shadow-sm"
              />
            )}
            <div>
              <h4 className="font-black text-gray-900 text-sm line-clamp-1">{ad.title}</h4>
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-0.5">تمييز ترحيبي مكتمل</p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center group hover:border-blue-200 transition-colors">
              <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">👁️</span>
              <span className="text-xl font-black text-gray-900">{stats.views || 0}</span>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">مشاهدة</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center group hover:border-blue-200 transition-colors">
              <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">💬</span>
              <span className="text-xl font-black text-gray-900">{stats.messages || 0}</span>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">رسالة</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center group hover:border-blue-200 transition-colors">
              <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">❤️</span>
              <span className="text-xl font-black text-gray-900">{stats.favorites || 0}</span>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">مفضلة</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center group hover:border-blue-200 transition-colors">
              <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">📞</span>
              <span className="text-xl font-black text-gray-900">{(stats.phoneClicks || 0) + (stats.whatsappClicks || 0)}</span>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">نقرات تواصل</span>
            </div>
          </div>

          {/* Motivational Message */}
          {isHighPerformance && (
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 flex items-start gap-4">
              <div className="w-10 h-10 bg-orange-200 text-orange-600 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                🔥
              </div>
              <div>
                <h5 className="font-black text-orange-900 text-sm mb-1">إعلانك كان من الأكثر تفاعلاً!</h5>
                <p className="text-orange-800/80 text-xs font-bold leading-relaxed">
                  التمييز ساعد إعلانك في الوصول لعدد كبير من المشترين المهتمين. إعادة التمييز الآن قد تسرع عملية البيع بشكل كبير.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-2">
            <button 
              onClick={handlePromote}
              className="w-full py-4 bg-gray-900 text-white rounded-2xl text-sm font-black shadow-xl shadow-gray-200 hover:bg-black active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              تمييز الإعلان الآن 🚀
            </button>
            <button 
              onClick={handleClose}
              className="w-full py-3 bg-white text-gray-500 rounded-2xl text-xs font-bold border border-gray-100 hover:bg-gray-50 active:scale-95 transition-all"
            >
              لاحقاً
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
