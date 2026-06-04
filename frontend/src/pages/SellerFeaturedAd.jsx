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

  useEffect(() => {
    (async () => {
      try {
        const [pRes, aRes, bRes] = await Promise.all([
          api.get("/plans", { params: { type: "featured" } }),
          api.get("/ads/my", { params: { status: "approved" } }),
          api.get("/bank-accounts")
        ]);
        setPlans(pRes.data || []);
        setAds(aRes.data || []);
        setBanks(bRes.data || []);
      } catch (e) {
        console.error("Featured load error:", e?.response?.status, e?.message);
        setError(e?.response?.data?.error || e?.message || "فشل تحميل البيانات");
      }
    })();
  }, []);

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
        <h2 className="text-xl font-bold text-gray-900">تم إرسال طلب التمييز بنجاح</h2>
        <p className="mt-2 text-sm text-gray-600">سيتم مراجعته من الإدارة خلال فترة قصيرة.</p>
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

