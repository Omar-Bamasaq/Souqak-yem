import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useApi } from "../api/axios.js";
import MobileSelect from "../components/MobileSelect.jsx";
import BankAccountsDisplay from "../components/BankAccountsDisplay.jsx";

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
      <div className="mx-auto max-w-lg rounded-2xl border bg-white p-8 text-center shadow-lg">
        <div className="mb-4 text-6xl">✅</div>
        <h2 className="text-xl font-bold text-gray-900">تم التفعيل بنجاح</h2>
        <p className="mt-2 text-sm text-gray-600">
          {selectedPlanId ? "تم إرسال طلب التمييز وهو قيد المراجعة." : "تم تفعيل التجربة المجانية لإعلانك بنجاح!"}
        </p>
        <Link to="/seller" className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-2 text-white hover:bg-blue-700">
          العودة للوحة التحكم
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/seller" className="text-sm text-blue-600 hover:underline">← العودة للوحة التحكم</Link>
      <h2 className="text-2xl font-bold">تمييز الإعلانات</h2>

      {step === 1 && (
        <>
          {/* Free Trial Card */}
          {promoEligibility.eligible && (
            <div className="rounded-[2rem] bg-gradient-to-r from-amber-400 to-orange-500 p-6 text-white shadow-xl shadow-orange-100 relative overflow-hidden group border-4 border-white">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
              <div className="relative flex flex-col sm:flex-row items-center gap-6">
                <div className="w-16 h-16 bg-white/30 rounded-2xl flex items-center justify-center text-3xl shadow-inner backdrop-blur-sm">
                  🎁
                </div>
                <div className="flex-1 text-center sm:text-right">
                  <h3 className="text-xl font-black mb-1">تجربة مجانية</h3>
                  <p className="text-orange-50 text-sm font-bold leading-relaxed">
                    جرّب ميزة التمييز مجاناً لمدة {promoEligibility.durationHours} ساعات. ارفع إعلانك إلى أعلى النتائج وشاهد الفرق.
                  </p>
                  <div className="mt-3 inline-flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full text-[10px] font-black">
                    🔥 متبقي {promoEligibility.remaining} تجربة مجانية
                  </div>
                </div>
                <button
                  onClick={() => setShowFreeTrialModal(true)}
                  disabled={activatingFreeTrial}
                  className="w-full sm:w-auto px-8 py-3 bg-white text-orange-600 rounded-xl font-black shadow-lg hover:bg-orange-50 transition-colors disabled:opacity-50 active:scale-95"
                >
                  تجربة مجانية الآن
                </button>
              </div>
            </div>
          )}

          {/* Free Trial Ad Selection Modal */}
          {showFreeTrialModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-300">
              <div className="w-full max-w-md rounded-[2.5rem] bg-white shadow-2xl overflow-hidden animate-in zoom-in duration-300">
                <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-6 text-center text-white">
                  <div className="text-4xl mb-2">🎁</div>
                  <h3 className="text-xl font-black">اختر الإعلان</h3>
                  <p className="text-orange-50 text-xs font-bold">اختر الإعلان الذي تريد تمييزه مجاناً لمدة {promoEligibility.durationHours} ساعات</p>
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
                          name="trialAd" 
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
                      onClick={() => handleFreeTrialActivate(selectedAd)}
                      disabled={!selectedAd || activatingFreeTrial}
                      className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black shadow-lg shadow-orange-100 hover:bg-orange-600 active:scale-95 disabled:opacity-50 transition-all"
                    >
                      {activatingFreeTrial ? "جاري التفعيل..." : "تأكيد التفعيل المجاني"}
                    </button>
                    <button
                      onClick={() => setShowFreeTrialModal(false)}
                      className="w-full py-3 bg-gray-50 text-gray-500 rounded-2xl text-xs font-bold hover:bg-gray-100 transition-all"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!promoEligibility.eligible && promoEligibility.reason === "quota_full" && (
            <div className="rounded-2xl bg-gray-50 p-4 border border-gray-200 text-center">
              <p className="text-sm font-bold text-gray-500">🎁 انتهت جميع التجارب المجانية حالياً.</p>
            </div>
          )}
          <div className="rounded-xl border bg-gray-50 p-4">
            <h3 className="font-semibold mb-2">فائدة التمييز</h3>
            <ul className="space-y-1 text-sm text-gray-700">
              <li>• ظهور الإعلان في أعلى النتائج</li>
              <li>• علامة ⭐ إعلان مميز</li>
              <li>• زيادة عدد المشاهدات</li>
              <li>• سرعة البيع</li>
            </ul>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <h3 className="font-semibold mb-4 text-gray-900">اختيار الإعلان</h3>
            <div className="relative w-full max-w-full">
              <MobileSelect
                value={selectedAd}
                onChange={(e) => setSelectedAd(e.target.value)}
                required={true}
                options={ads.map(a => ({ value: a._id, label: a.title.length > 30 ? a.title.substring(0, 30) + "..." : a.title }))}
                placeholder="اختر إعلان"
              />
            </div>
            {ads.length === 0 && <p className="mt-2 text-xs text-gray-500 font-bold">لا توجد إعلانات معتمدة حالياً.</p>}
          </div>
          <div className="rounded-xl border bg-white p-4">
            <h3 className="font-semibold mb-4">اختيار المدة</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {plans.map((p) => (
                <button
                  key={p._id}
                  type="button"
                  onClick={() => setSelectedPlanId(p._id)}
                  className={`relative rounded-xl border-2 p-4 text-right transition ${
                    selectedPlanId === p._id ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {p.isSaleRunning && p.saleLabel && (
                    <div className="absolute -top-2 -left-2 bg-orange-500 text-white text-[8px] font-black px-2 py-0.5 rounded-lg shadow-sm flex items-center gap-1 z-10">
                      {getSaleIcon(p.saleType)} {p.saleLabel}
                    </div>
                  )}
                  {p.isPopularOffer && (
                    <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-[8px] font-black px-2 py-0.5 rounded-lg shadow-sm z-10">
                      الأكثر طلباً
                    </div>
                  )}
                  <div className="font-bold">{p.durationInDays} يوم</div>
                  <div className="text-sm">
                    {p.isSaleRunning ? (
                      <div className="flex flex-col">
                        <span className="text-gray-400 line-through text-[10px]">{p.originalPrice}</span>
                        <span className="text-blue-600 font-black">{p.finalPrice} {p.currency === "USD" ? "$" : p.currency === "SAR" ? "ر.س" : "ر.ي"}</span>
                      </div>
                    ) : (
                      <span className="text-gray-600">
                        {p.price ?? 0} {p.currency === "USD" ? "$" : p.currency === "SAR" ? "ر.س" : "ر.ي"}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
          {selectedPlan && (
            <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-gray-600">السعر النهائي:</span>
                <div className="text-right">
                  <div className="font-black text-blue-600">
                    {selectedPlan.isSaleRunning ? selectedPlan.finalPrice : selectedPlan.price ?? 0}{" "}
                    {selectedPlan.currency === "USD" ? "$" : selectedPlan.currency === "SAR" ? "ر.س" : "ر.ي"}
                  </div>
                  {selectedPlan.isSaleRunning && (
                    <div className="text-[10px] font-black text-orange-600 flex items-center gap-1 justify-end">
                      {getSaleIcon(selectedPlan.saleType)} {selectedPlan.saleLabel} (وفر {selectedPlan.discountPercent}%)
                    </div>
                  )}
                </div>
              </div>
              {selectedPlan.isSaleRunning && selectedPlan.remainingSlots > 0 && (
                <div className="text-[10px] font-bold text-red-600 bg-red-50 p-1.5 rounded-lg border border-red-100 text-center animate-pulse">
                  ⚠️ بقي {selectedPlan.remainingSlots} اشتراك فقط بهذا السعر
                </div>
              )}
            </div>
          )}
          <button
            disabled={!selectedAd || !selectedPlanId}
            onClick={() => setStep(2)}
            className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            ميز إعلانك الآن
          </button>
        </>
      )}

      {step === 2 && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-[2rem] border bg-gray-50/50 p-6 shadow-sm">
            <h3 className="text-sm font-black text-gray-900 mb-6 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              الحسابات البنكية المعتمدة
            </h3>
            
            <BankAccountsDisplay banks={banks} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">سند الدفع (صورة أو PDF)</label>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
              required
              className="w-full rounded-xl border px-4 py-3 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-600"
            />
          </div>
          {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(1)} className="rounded-xl border px-4 py-3 hover:bg-gray-50">
              رجوع
            </button>
            <button
              type="submit"
              disabled={loading || !receiptFile}
              className="flex-1 rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "جاري الإرسال..." : "إرسال الطلب"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

