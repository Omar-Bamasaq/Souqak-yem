import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";
import { useAuth } from "../store/AuthContext.jsx";
import { t } from "../i18n/index.js";
import CountdownTimer from "../components/CountdownTimer.jsx";

export default function Pricing() {
  const api = useApi();
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [ads, setAds] = useState([]);
  const [selectedAd, setSelectedAd] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const res = await api.get("/plans");
      setPlans(res.data);
      if (user) {
        const my = await api.get("/ads/my?status=approved");
        setAds(my.data || []);
      }
    } catch (e) {
      setErr("فشل تحميل الباقات");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const getSaleIcon = (type) => {
    switch (type) {
      case 'flash_sale': return '⚡';
      case 'ramadan_offer': return '🌙';
      case 'eid_offer': return '🎉';
      case 'opening_offer': return '✨';
      default: return '🔥';
    }
  };

  const subscribe = async (plan) => {
    setMsg("");
    setErr("");
    setLoading(true);
    try {
      if (!user) {
        setErr("قم بتسجيل الدخول للمتابعة");
        return;
      }
      const payload = { planId: plan._id };
      if (plan.type === "featured") {
        if (!selectedAd) {
          setErr("يجب اختيار إعلان");
          return;
        }
        payload.productId = selectedAd;
      }
      
      // Note: In a real flow with receipt upload, we would use FormData
      // For now, staying compatible with current subscribe logic but adding feedback
      await api.post("/purchase-requests", payload);
      setMsg(t("pricing.requestActivated"));
    } catch (e) {
      setErr(e.response?.data?.error || t("pricing.requestError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 space-y-12">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-black text-gray-900 tracking-tight">{t("pricing.title")}</h1>
        <p className="text-gray-500 font-medium max-w-2xl mx-auto">اختر الباقة المناسبة لاحتياجاتك وابدأ في تنمية أعمالك اليوم مع مميزات حصرية.</p>
      </div>

      {msg && (
        <div className="max-w-md mx-auto bg-green-50 border border-green-100 rounded-2xl p-4 flex items-center gap-3 text-green-700 animate-in fade-in zoom-in duration-300">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          <p className="text-sm font-bold">{msg}</p>
        </div>
      )}

      {err && (
        <div className="max-w-md mx-auto bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3 text-red-700 animate-in fade-in zoom-in duration-300">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <p className="text-sm font-bold">{err}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {plans.map((p) => (
          <div 
            key={p._id} 
            className={`relative group flex flex-col bg-white rounded-[2.5rem] border transition-all duration-500 hover:shadow-2xl hover:shadow-blue-100 hover:-translate-y-2 ${
              p.isPopularOffer ? 'border-blue-500 ring-4 ring-blue-50' : 'border-gray-100'
            }`}
          >
            {/* Badges */}
            <div className="absolute -top-4 inset-x-0 flex flex-col items-center gap-2">
              {p.isPopularOffer && (
                <span className="bg-blue-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full shadow-lg shadow-blue-200 uppercase tracking-widest">
                  الأكثر شراءً
                </span>
              )}
              {p.isSaleRunning && p.saleLabel && (
                <span className="bg-orange-500 text-white text-[10px] font-black px-4 py-1.5 rounded-full shadow-lg shadow-orange-200 uppercase tracking-widest flex items-center gap-1.5">
                  {getSaleIcon(p.saleType)} {p.saleLabel}
                </span>
              )}
            </div>

            <div className="p-8 pt-10 flex-1 flex flex-col">
              <div className="text-center mb-8">
                <h3 className="text-xl font-black text-gray-900 mb-1">{p.name}</h3>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  {p.type === "verification" ? t("pricing.typeVerification") : t("pricing.typeFeatured")}
                </p>
              </div>

              {/* Price Section */}
              <div className="bg-gray-50/50 rounded-3xl p-6 mb-8 text-center border border-gray-100/50">
                <div className="flex flex-col items-center justify-center gap-1">
                  {p.isSaleRunning ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-sm font-bold line-through opacity-60">
                          {p.originalPrice.toLocaleString()}
                        </span>
                        <span className="bg-red-50 text-red-600 text-[10px] font-black px-2 py-0.5 rounded-lg border border-red-100">
                          وفر {p.discountPercent}%
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-black text-gray-900">{p.finalPrice.toLocaleString()}</span>
                        <span className="text-xs font-black text-gray-500">{p.currency === "USD" ? "$" : p.currency === "SAR" ? "ر.س" : "ر.ي"}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-gray-900">{p.price.toLocaleString()}</span>
                      <span className="text-xs font-black text-gray-500">{p.currency === "USD" ? "$" : p.currency === "SAR" ? "ر.س" : "ر.ي"}</span>
                    </div>
                  )}
                </div>
                <div className="mt-2 text-[10px] font-black text-gray-400 uppercase tracking-tighter">
                  صلاحية لمدة {p.durationInDays} يوم
                </div>
              </div>

              {/* Countdown Timer */}
              {p.isSaleRunning && p.saleEndDate && (
                <div className="mb-8">
                  <CountdownTimer endDate={p.saleEndDate} />
                </div>
              )}

              {/* Features List */}
              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3 text-sm font-bold text-gray-600">
                  <div className="w-5 h-5 rounded-full bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  ظهور مميز في الصفحة الرئيسية
                </div>
                <div className="flex items-center gap-3 text-sm font-bold text-gray-600">
                  <div className="w-5 h-5 rounded-full bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  دعم فني سريع وأولوية في المراجعة
                </div>
                {p.remainingSlots > 0 && (
                  <div className="flex items-center gap-3 text-sm font-bold text-orange-600 bg-orange-50 p-3 rounded-2xl border border-orange-100 animate-pulse">
                    <div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px]">⚠️</span>
                    </div>
                    بقي {p.remainingSlots} اشتراك فقط بهذا السعر
                  </div>
                )}
              </div>

              {/* Ad Selection for Featured */}
              {p.type === "featured" && (
                <div className="mb-4">
                  <label className="block text-[10px] font-black text-gray-400 mb-2 mr-1 uppercase tracking-wider">اختر الإعلان لتمييزه</label>
                  <select 
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
                    value={selectedAd} 
                    onChange={(e) => setSelectedAd(e.target.value)}
                  >
                    <option value="">-- اختر من إعلاناتك --</option>
                    {ads.map((ad) => (
                      <option key={ad._id} value={ad._id}>{ad.title}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Action Button */}
              <button 
                className={`w-full py-4 rounded-[1.5rem] text-sm font-black transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 shadow-xl ${
                  p.isPopularOffer 
                  ? 'bg-blue-600 text-white shadow-blue-200 hover:bg-blue-700' 
                  : 'bg-gray-900 text-white shadow-gray-200 hover:bg-black'
                } disabled:opacity-50`}
                onClick={() => subscribe(p)}
                disabled={loading}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>{t("pricing.subscribeNow")}</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center pt-8">
        <p className="text-gray-400 text-xs font-bold">جميع المعاملات تتم بشكل آمن ويتم مراجعتها من قبل الإدارة.</p>
      </div>
    </div>
  );
}
