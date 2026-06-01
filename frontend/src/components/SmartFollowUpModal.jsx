import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";
import { Link, useNavigate } from "react-router-dom";
import { uploadsUrl } from "../lib/uploads.js";

export default function SmartFollowUpModal() {
  const api = useApi();
  const navigate = useNavigate();
  const [ads, setAds] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const fetchFollowUps = async () => {
      try {
        const res = await api.get("/ads/pending-followups");
        if (res.data && res.data.length > 0) {
          setAds(res.data);
          setShow(true);
        }
      } catch (err) {
        console.error("Fetch followups error:", err);
      }
    };

    fetchFollowUps();
  }, []);

  const handleResponse = async (status) => {
    const currentAd = ads[currentIndex];
    setLoading(true);
    try {
      await api.patch(`/ads/${currentAd._id}/followup-response`, { status });
      
      if (status === "sold") {
        window.dispatchEvent(new CustomEvent("app:toast", { 
          detail: { message: "مبروك البيع! تم تحديث حالة الإعلان.", type: "success" } 
        }));
      } else {
        window.dispatchEvent(new CustomEvent("app:toast", { 
          detail: { message: "رائع! تم تحديث إعلانك ليبقى في المقدمة.", type: "success" } 
        }));
      }

      // الانتقال للإعلان التالي أو الإغلاق
      if (currentIndex < ads.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setShow(false);
      }
    } catch (err) {
      console.error("Follow-up response error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!show || ads.length === 0) return null;

  const currentAd = ads[currentIndex];

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl border border-blue-100 dark:border-slate-800 animate-in zoom-in-95 duration-300">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-4xl mx-auto animate-bounce-subtle">
            🤔
          </div>
          <h3 className="text-xl font-black text-gray-900 dark:text-white">هل تم بيع إعلانك؟</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 font-bold leading-relaxed">
            مرت 7 أيام على نشر إعلانك <span className="text-blue-600">"{currentAd.title}"</span>. نود الاطمئنان على حالة البيع لمساعدتك بشكل أفضل.
          </p>
        </div>

        {currentAd.images && currentAd.images[0] && (
          <div className="mt-6 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-800 aspect-video relative group">
            <img 
              src={uploadsUrl(currentAd.images[0], "thumb")} 
              alt={currentAd.title} 
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-3">
              <span className="text-xs font-black text-white">{currentAd.price} {currentAd.currency}</span>
            </div>
          </div>
        )}

        <div className="mt-8 space-y-3">
          <button
            disabled={loading}
            onClick={() => handleResponse("sold")}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg shadow-emerald-100 dark:shadow-none transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? "جاري التحديث..." : "✅ نعم، تم البيع بحمد الله"}
          </button>
          
          <button
            disabled={loading}
            onClick={() => handleResponse("still_available")}
            className="w-full py-4 bg-white dark:bg-slate-800 border-2 border-gray-100 dark:border-slate-700 text-gray-700 dark:text-slate-200 font-black rounded-2xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-50"
          >
            ❌ لا، لا يزال متاحاً للبيع
          </button>

          <div className="pt-2 text-center">
            <button 
              onClick={() => setShow(false)}
              className="text-[10px] font-black text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest"
            >
              تذكيري لاحقاً
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
