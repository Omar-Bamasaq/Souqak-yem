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
  const [trialEligibility, setTrialEligibility] = useState(null);
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [activatingTrial, setActivatingTrial] = useState(false);

  const load = async () => {
    try {
      const [plansRes, eligibilityRes] = await Promise.all([
        api.get("/plans"),
        api.get("/ads/welcome-promotion/eligibility")
      ]);
      setPlans(plansRes.data);
      setTrialEligibility(eligibilityRes.data);
      if (user) {
        const my = await api.get("/ads/my?status=approved");
        setAds(my.data || []);
      }
    } catch (e) {
      setErr("فشل تحميل البيانات");
    }
  };

  useEffect(() => {
    load();
  }, [user]);

  const activateTrial = async (adId) => {
    const targetAdId = adId || selectedAd;
    if (!targetAdId) {
      setErr("يجب اختيار إعلان لتجربة التمييز");
      return;
    }
    setActivatingTrial(true);
    setErr("");
    setMsg("");
    try {
      const res = await api.post("/ads/welcome-promotion/activate", { adId: targetAdId });
      setMsg(res.data.message);
      setShowTrialModal(false);
      load(); // Refresh eligibility
    } catch (e) {
      setErr(e.response?.data?.error || "تعذر تفعيل التجربة المجانية");
    } finally {
      setActivatingTrial(false);
    }
  };

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
        {/* Welcome Promotion Trial Card */}
        {trialEligibility && (trialEligibility.eligible || trialEligibility.reason === "quota_full") && (
          <div className="relative group flex flex-col bg-gradient-to-br from-amber-400 to-orange-500 rounded-[2.5rem] border-4 border-white transition-all duration-500 hover:shadow-2xl hover:shadow-orange-100 hover:-translate-y-2 overflow-hidden shadow-xl">
            <div className="absolute top-0 left-0 w-full h-full opacity-10">
              <svg width="100%" height="100%"><pattern id="grid-p" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="white" strokeWidth="1"/></pattern><rect width="100%" height="100%" fill="url(#grid-p)" /></svg>
            </div>
            
            <div className="p-8 pt-12 flex-1 flex flex-col relative z-10 text-white">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl shadow-inner backdrop-blur-sm mx-auto mb-4">
                  🎁
                </div>
                <h3 className="text-xl font-black mb-2">تجربة مجانية</h3>
                <p className="text-orange-50 text-xs font-bold leading-relaxed">
                  ارفع إعلانك إلى أعلى النتائج لمدة {trialEligibility.durationHours || 6} ساعات مجاناً وشاهد الفرق في النتائج.
                </p>
              </div>

              <div className="bg-white/20 rounded-3xl p-6 mb-6 text-center border border-white/30 backdrop-blur-sm">
                <div className="text-3xl font-black">مجاناً</div>
                <div className="text-[10px] font-black text-orange-100 uppercase tracking-widest mt-1">
                  تجربة لمرة واحدة فقط
                </div>
              </div>

              {trialEligibility.eligible ? (
                <>
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-3 text-xs font-black bg-white/20 px-4 py-2 rounded-full">
                      <span className="animate-pulse">🔥</span>
                      متبقي {trialEligibility.remaining} تجربة مجانية فقط
                    </div>
                  </div>

                  <button 
                    onClick={() => setShowTrialModal(true)}
                    className="w-full mt-auto py-4 bg-white text-orange-600 rounded-[1.5rem] text-sm font-black hover:bg-orange-50 transition-all active:scale-95 shadow-xl flex items-center justify-center gap-2"
                  >
                    <span>ابدأ التجربة الآن</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  </button>
                </>
              ) : (
                <div className="mt-auto p-4 bg-white/10 rounded-2xl border border-white/20 text-center backdrop-blur-sm">
                  <p className="text-sm font-black">انتهت جميع التجارب المجانية المتاحة حالياً.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Free Trial Ad Selection Modal */}
        {showTrialModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-md rounded-[2.5rem] bg-white shadow-2xl overflow-hidden animate-in zoom-in duration-300">
              <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-6 text-center text-white">
                <div className="text-4xl mb-2">🎁</div>
                <h3 className="text-xl font-black">اختر الإعلان</h3>
                <p className="text-orange-50 text-xs font-bold">اختر الإعلان الذي تريد تمييزه مجاناً لمدة {trialEligibility.durationHours} ساعات</p>
              </div>
              <div className="p-6">
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {ads.length > 0 ? ads.map(ad => (
                    <label 
                      key={ad._id}
                      className={`flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                        selectedAd === ad._id ? "border-orange-500 bg-orange-50" : "border-gray-100 hover:border-orange-200"
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="trialAdPricing" 
                        className="sr-only" 
                        checked={selectedAd === ad._id}
                        onChange={() => setSelectedAd(ad._id)}
                      />
                      {ad.images?.[0] && (
                        <img 
                          src={`${import.meta.env.VITE_API_URL}/uploads/${ad.images[0]}`} 
                          alt="" 
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-black text-gray-900 line-clamp-1">{ad.title}</p>
                        <p className="text-[10px] font-bold text-gray-400">{ad.price} {ad.currency}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedAd === ad._id ? "border-orange-500 bg-orange-500" : "border-gray-300"
                      }`}>
                        {selectedAd === ad._id && <div className="w-2 h-2 bg-white rounded-full"></div>}
                      </div>
                    </label>
                  )) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500 font-bold">لا توجد إعلانات معتمدة حالياً.</p>
                      <Link to="/add-product" className="text-blue-600 text-sm font-black mt-2 inline-block">أنشئ إعلانك الأول الآن</Link>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex flex-col gap-2">
                  <button
                    onClick={() => activateTrial(selectedAd)}
                    disabled={!selectedAd || activatingTrial}
                    className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black shadow-lg shadow-orange-100 hover:bg-orange-600 active:scale-95 disabled:opacity-50 transition-all"
                  >
                    {activatingTrial ? "جاري التفعيل..." : "تأكيد التفعيل المجاني"}
                  </button>
                  <button
                    onClick={() => setShowTrialModal(false)}
                    className="w-full py-3 bg-gray-50 text-gray-500 rounded-2xl text-xs font-bold hover:bg-gray-100 transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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
