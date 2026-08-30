import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useApi } from "../api/axios.js";
import MobileSelect from "../components/MobileSelect.jsx";
import BankAccountsDisplay from "../components/BankAccountsDisplay.jsx";
import { uploadsUrl } from "../lib/uploads.js";
import { prepareFilesForUpload } from "../lib/imageCompression.js";

export default function SellerFeaturedAd() {
  const api = useApi();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [plans, setPlans] = useState([]);
  const [ads, setAds] = useState([]);
  const [banks, setBanks] = useState([]);
  const [selectedAd, setSelectedAd] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [receiptFile, setReceiptFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processingReceipt, setProcessingReceipt] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [promoEligibility, setPromoEligibility] = useState({ eligible: false });
  const [activatingFreeTrial, setActivatingFreeTrial] = useState(false);
  const [showFreeTrialModal, setShowFreeTrialModal] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [pRes, aRes, bRes, eRes] = await Promise.all([
          api.get("/plans", { params: { type: "featured" } }),
          api.get("/ads/my", { params: { status: "approved" } }),
          api.get("/bank-accounts"),
          api.get("/ads/welcome-promotion/eligibility")
        ]);
        setPlans(pRes.data || []);
        setAds(aRes.data || []);
        setBanks(bRes.data || []);
        setPromoEligibility(eRes.data || { eligible: false });
      } catch (e) {
        console.error("Featured load error:", e?.response?.status, e?.message);
        setError(e?.response?.data?.error || e?.message || "فشل تحميل البيانات");
      }
    })();
  }, []);

  const handleReceiptFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setReceiptFile(null);
      return;
    }

    try {
      setProcessingReceipt(true);
      const [prepared] = await prepareFilesForUpload([file], {
        maxSizeMB: 0.9,
        maxWidthOrHeight: 1800,
        initialQuality: 0.85,
      });
      setReceiptFile(prepared);
      setError("");
    } catch (error) {
      console.error("Receipt compression failed:", error);
      setError("تعذر تجهيز صورة السند. يرجى اختيار صورة أخرى أو صورة بحجم أصغر.");
      setReceiptFile(null);
    } finally {
      setProcessingReceipt(false);
    }
  };

  const handleFreeTrialActivate = async (adId) => {
    const targetAdId = adId || selectedAd;
    if (!targetAdId) {
      setError("يرجى اختيار الإعلان الذي تريد تمييزه أولاً");
      return;
    }
    setError("");
    setActivatingFreeTrial(true);
    try {
      await api.post("/ads/welcome-promotion/activate", { adId: targetAdId });
      setSuccess(true);
      setShowFreeTrialModal(false);
    } catch (e) {
      setError(e.response?.data?.error || "فشل تفعيل التجربة المجانية");
    } finally {
      setActivatingFreeTrial(false);
    }
  };

  const selectedPlan = plans.find((p) => p._id === selectedPlanId);

  const getSaleIcon = (type) => {
    switch (type) {
      case 'flash_sale': return '⚡';
      case 'ramadan_offer': return '🌙';
      case 'eid_offer': return '🎉';
      case 'opening_offer': return '✨';
      default: return '🔥';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("planId", selectedPlanId);
      fd.append("productId", selectedAd);
      if (receiptFile) fd.append("paymentReceipt", receiptFile);
      
      const res = await api.post("/purchase-requests", fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      setSuccess(true);
    } catch (e) {
      setError(e.response?.data?.error || e.message || "فشل إرسال الطلب");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-[2.5rem] bg-white border border-gray-100 p-10 text-center shadow-2xl shadow-blue-50 animate-in zoom-in duration-500">
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-green-50 p-4 ring-8 ring-green-50/50">
              <svg className="h-12 w-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h2 className="mb-4 text-3xl font-black text-gray-900">
            {selectedPlanId ? "تم إرسال الطلب بنجاح!" : "تم تفعيل التجربة بنجاح!"}
          </h2>
          <p className="mb-10 text-gray-600 font-bold leading-relaxed">
            {selectedPlanId 
              ? "سيتم مراجعة طلب التمييز الخاص بك من قبل الإدارة وتفعيله في أقرب وقت ممكن." 
              : "استمتع بمميزات التمييز المجانية لإعلانك الآن وضاعف فرص وصولك."}
          </p>
          <div className="flex flex-col gap-3">
            <Link
              to="/seller"
              className="w-full rounded-2xl bg-blue-600 py-4 text-base font-black text-white transition-all hover:bg-blue-700 shadow-xl shadow-blue-100 active:scale-95"
            >
              العودة للوحة التحكم
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-12">
      <div className="flex items-center justify-between">
        <Link to="/seller" className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-blue-600 transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          لوحة التحكم
        </Link>
        <h2 className="text-2xl font-black text-gray-900">تمييز الإعلانات</h2>
      </div>

      {step === 1 && (
        <div className="space-y-12">
          {/* Free Trial Card */}
          {promoEligibility.eligible && (
            <div className="rounded-[2.5rem] bg-gradient-to-r from-amber-400 to-orange-500 p-8 text-white shadow-2xl shadow-orange-100 relative overflow-hidden group border-4 border-white">
              <div className="absolute top-0 left-0 w-48 h-48 bg-white/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
              <div className="relative flex flex-col md:flex-row items-center gap-8">
                <div className="w-20 h-20 bg-white/30 rounded-3xl flex items-center justify-center text-4xl shadow-inner backdrop-blur-sm border border-white/30 animate-bounce">
                  🎁
                </div>
                <div className="flex-1 text-center md:text-right">
                  <h3 className="text-2xl font-black mb-2">هدية ترحيبية: تجربة مجانية</h3>
                  <p className="text-orange-50 text-base font-bold leading-relaxed max-w-xl">
                    جرّب ميزة التمييز مجاناً لمدة {promoEligibility.durationHours} ساعات. ارفع إعلانك إلى أعلى النتائج وشاهد الفرق في عدد المشاهدات والتواصل.
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 bg-white/20 px-4 py-1.5 rounded-full text-xs font-black">
                    🔥 متبقي {promoEligibility.remaining} تجربة مجانية فقط
                  </div>
                </div>
                <button
                  onClick={() => setShowFreeTrialModal(true)}
                  disabled={activatingFreeTrial}
                  className="w-full md:w-auto px-10 py-4 bg-white text-orange-600 rounded-2xl font-black shadow-xl hover:bg-orange-50 transition-all active:scale-95 disabled:opacity-50"
                >
                  تفعيل التجربة الآن
                </button>
              </div>
            </div>
          )}

          {!promoEligibility.eligible && promoEligibility.reason === "quota_full" && (
            <div className="rounded-[2rem] bg-gray-50 p-6 border-2 border-dashed border-gray-200 text-center">
              <p className="text-base font-bold text-gray-400">🎁 انتهت جميع التجارب المجانية حالياً. يمكنك الاشتراك في إحدى الباقات أدناه.</p>
            </div>
          )}

          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-gray-100"></div>
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">باقات التمييز المدفوعة</h3>
              <div className="h-px flex-1 bg-gray-100"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {plans.map((plan) => {
                const isPopular = plan.isPopularOffer;
                return (
                  <div 
                    key={plan._id}
                    className={`relative group flex flex-col bg-gradient-to-br from-blue-600 to-indigo-800 rounded-[2.5rem] border-4 border-white transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 overflow-hidden shadow-xl text-white`}
                  >
                    <div className="absolute top-0 left-0 w-full h-full opacity-10">
                      <svg width="100%" height="100%"><pattern id={`grid-plan-${plan._id}`} width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="white" strokeWidth="1"/></pattern><rect width="100%" height="100%" fill={`url(#grid-plan-${plan._id})`} /></svg>
                    </div>

                    {isPopular && (
                      <div className="absolute top-4 right-4 z-20">
                        <span className="bg-white text-blue-600 text-[10px] font-black px-4 py-1.5 rounded-full shadow-lg uppercase tracking-widest">الأكثر طلباً</span>
                      </div>
                    )}

                    <div className="p-8 pt-12 flex-1 flex flex-col relative z-10">
                      <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl shadow-inner backdrop-blur-sm mx-auto mb-4 border border-white/30">
                          ⭐
                        </div>
                        <h3 className="text-2xl font-black mb-1">{plan.name}</h3>
                        <p className="text-[10px] font-black text-white/70 uppercase tracking-widest">تمييز احترافي</p>
                      </div>

                      <div className="bg-white/10 rounded-3xl p-6 mb-8 text-center border border-white/20 backdrop-blur-sm">
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-4xl font-black">{plan.price.toLocaleString()}</span>
                          <span className="text-xs font-black text-white/70">{plan.currency === "SAR" ? "ر.س" : plan.currency === "USD" ? "$" : "ر.ي"}</span>
                        </div>
                        <div className="mt-2 text-[10px] font-black text-white/50 uppercase tracking-tighter">صلاحية لمدة {plan.durationInDays} يوم</div>
                      </div>

                      <div className="space-y-4 mb-8">
                        <div className="flex items-center gap-3 text-sm font-bold text-white/90">
                          <div className="w-6 h-6 rounded-full bg-white/20 text-white flex items-center justify-center flex-shrink-0">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          </div>
                          ظهور في مقدمة نتائج البحث
                        </div>
                        <div className="flex items-center gap-3 text-sm font-bold text-white/90">
                          <div className="w-6 h-6 rounded-full bg-white/20 text-white flex items-center justify-center flex-shrink-0">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          </div>
                          زيادة المشاهدات بنسبة تصل لـ 10 أضعاف
                        </div>
                      </div>

                      <div className="mt-auto space-y-4">
                        <div className="bg-white/10 p-4 rounded-2xl border border-white/20">
                          <label className="block text-[10px] font-black text-white/50 mb-2 uppercase tracking-wider mr-1">اختر الإعلان لتمييزه</label>
                          <select 
                            className="w-full bg-transparent border-none text-sm font-black text-white focus:ring-0 cursor-pointer"
                            value={selectedAd}
                            onChange={(e) => setSelectedAd(e.target.value)}
                          >
                            <option value="" className="text-gray-900">-- اختر من إعلاناتك --</option>
                            {ads.map(ad => (
                              <option key={ad._id} value={ad._id} className="text-gray-900">{ad.title}</option>
                            ))}
                          </select>
                        </div>

                        <button
                          disabled={!selectedAd}
                          onClick={() => {
                            setSelectedPlanId(plan._id);
                            setStep(2);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="w-full py-4 bg-white text-blue-600 rounded-[1.5rem] text-sm font-black shadow-xl hover:bg-blue-50 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          <span>{selectedAd ? "استمرار للدفع" : "اختر إعلان أولاً"}</span>
                          {selectedAd && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="max-w-3xl mx-auto space-y-8 animate-in slide-in-from-bottom-8 duration-500">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => setStep(1)}
              className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-blue-600 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              تغيير الباقة
            </button>
            <div className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest">
              خطوة 2 من 2: الدفع
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-800 p-8 text-white text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full opacity-10">
                <svg width="100%" height="100%"><pattern id="grid-step2-seller" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="white" strokeWidth="1"/></pattern><rect width="100%" height="100%" fill="url(#grid-step2-seller)" /></svg>
              </div>
              <div className="relative z-10">
                <h2 className="text-2xl font-black mb-2">تفعيل باقة {selectedPlan?.name}</h2>
                <div className="inline-block bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full text-sm font-black">
                  المبلغ المطلوب: {selectedPlan?.isSaleRunning ? selectedPlan?.finalPrice : selectedPlan?.price} {selectedPlan?.currency === "SAR" ? "ر.س" : selectedPlan?.currency === "USD" ? "$" : "ر.ي"}
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-8">
              <div className="space-y-6">
                <div className="rounded-3xl border border-gray-100 bg-gray-50/50 p-6">
                  <h3 className="text-sm font-black text-gray-900 mb-6 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    الحسابات البنكية المعتمدة
                  </h3>
                  <BankAccountsDisplay banks={banks} />
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-black text-gray-700">سند الدفع (صورة أو PDF)</label>
                  <div className="relative group">
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                      required
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`w-full py-10 border-4 border-dashed rounded-[2rem] flex flex-col items-center justify-center transition-all ${receiptFile ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-gray-50/50 group-hover:border-blue-200 group-hover:bg-blue-50'}`}>
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-4 ${receiptFile ? 'bg-green-200 text-green-600' : 'bg-white shadow-sm text-gray-400'}`}>
                        {receiptFile ? "✅" : "📄"}
                      </div>
                      <p className="text-sm font-black text-gray-900">
                        {processingReceipt ? "جاري تجهيز السند..." : receiptFile ? receiptFile.name : "اضغط هنا لرفع سند الدفع"}
                      </p>
                      <p className="text-xs font-bold text-gray-400 mt-1">PNG, JPG, PDF (Max 5MB)</p>
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-2xl bg-red-50 border border-red-100 p-4 flex items-center gap-3 text-red-700">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-sm font-bold">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || processingReceipt || !receiptFile}
                className="w-full py-5 bg-gray-900 text-white rounded-[1.5rem] text-base font-black shadow-2xl shadow-gray-200 hover:bg-black transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {loading ? (
                  <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>إرسال طلب التفعيل</span>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Trial Modal for consistency */}
      {showFreeTrialModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-md rounded-[2.5rem] bg-white shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-8 text-center text-white relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full opacity-10">
                <svg width="100%" height="100%"><pattern id="grid-trial-seller" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="white" strokeWidth="1"/></pattern><rect width="100%" height="100%" fill="url(#grid-trial-seller)" /></svg>
              </div>
              <div className="relative z-10">
                <div className="text-5xl mb-4 animate-bounce">🎁</div>
                <h3 className="text-2xl font-black">تفعيل التجربة المجانية</h3>
                <p className="text-orange-50 text-xs font-bold mt-2">اختر الإعلان الذي تريد تمييزه مجاناً لمدة {promoEligibility.durationHours} ساعات</p>
              </div>
            </div>
            <div className="p-8">
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {ads.length > 0 ? ads.map(ad => (
                  <label 
                    key={ad._id}
                    className={`flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      selectedAd === ad._id ? "border-orange-500 bg-orange-50 shadow-lg shadow-orange-100" : "border-gray-50 bg-gray-50/50 hover:border-orange-200"
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="trialAdSeller" 
                      className="sr-only" 
                      checked={selectedAd === ad._id}
                      onChange={() => setSelectedAd(ad._id)}
                    />
                    {ad.images?.[0] && (
                      <img 
                        src={uploadsUrl(ad.images[0], "thumb")}
                        alt="" 
                        className="w-12 h-12 rounded-xl object-cover shadow-sm"
                        onError={(e) => {
                          if (e.currentTarget.src !== uploadsUrl(ad.images[0], "full")) {
                            e.currentTarget.src = uploadsUrl(ad.images[0], "full");
                          } else {
                            e.currentTarget.style.display = "none";
                          }
                        }}
                      />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-black text-gray-900 line-clamp-1">{ad.title}</p>
                      <p className="text-[10px] font-bold text-gray-400">{ad.price} {ad.currency}</p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      selectedAd === ad._id ? "border-orange-500 bg-orange-500" : "border-gray-200 bg-white"
                    }`}>
                      {selectedAd === ad._id && <div className="w-2.5 h-2.5 bg-white rounded-full"></div>}
                    </div>
                  </label>
                )) : (
                  <div className="text-center py-10">
                    <div className="text-4xl mb-4 opacity-20">📭</div>
                    <p className="text-gray-500 font-bold">لا توجد إعلانات معتمدة حالياً.</p>
                    <Link to="/add-product" className="text-blue-600 text-sm font-black mt-3 inline-block hover:underline">أنشئ إعلانك الأول الآن</Link>
                  </div>
                )}
              </div>

              <div className="mt-8 flex flex-col gap-3">
                <button
                  onClick={() => handleFreeTrialActivate(selectedAd)}
                  disabled={!selectedAd || activatingFreeTrial}
                  className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black shadow-xl shadow-orange-100 hover:bg-orange-600 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {activatingFreeTrial ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>تأكيد التفعيل المجاني</span>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowFreeTrialModal(false)}
                  className="w-full py-3 bg-white text-gray-400 rounded-2xl text-xs font-bold hover:bg-gray-50 transition-all"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

