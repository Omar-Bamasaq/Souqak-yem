import React, { useEffect, useRef, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useApi } from "../api/axios.js";
import { useAuth } from "../store/AuthContext.jsx";
import { useDraftAction } from "../hooks/useDraftActions.js";
import MobileSelect from "../components/MobileSelect.jsx";
import BankAccountsDisplay from "../components/BankAccountsDisplay.jsx";
import { uploadsUrl } from "../lib/uploads.js";
import { prepareFilesForUpload } from "../lib/imageCompression.js";
import {
  getPromotionPlanCardData,
  groupPromotionPlans,
  promotionCurrencyLabel
} from "../lib/promotionPlans.js";

export default function SellerFeaturedAd() {
  const api = useApi();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?._id || user?.id;
  const [searchParams, setSearchParams] = useSearchParams();
  const draftAction = useDraftAction(api, userId, "featured_ad_upgrade");
  const [step, setStep] = useState(1);
  const [plans, setPlans] = useState([]);
  const [ads, setAds] = useState([]);
  const [banks, setBanks] = useState([]);
  const [selectedAd, setSelectedAd] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [socialPromotionRequested, setSocialPromotionRequested] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processingReceipt, setProcessingReceipt] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [promoEligibility, setPromoEligibility] = useState({ eligible: false });
  const [activatingFreeTrial, setActivatingFreeTrial] = useState(false);
  const [showFreeTrialModal, setShowFreeTrialModal] = useState(false);
  const [draftStarted, setDraftStarted] = useState(false);
  const [referencesLoaded, setReferencesLoaded] = useState(false);
  const [resumedDraft, setResumedDraft] = useState(false);
  const [loadingReferences, setLoadingReferences] = useState(true);
  const submissionCompletedRef = useRef(false);

  const loadReferences = async () => {
    setLoadingReferences(true);
    setError("");
    try {
      const [pRes, aRes, bRes, eRes] = await Promise.all([
        api.get("/plans", { params: { type: "featured" } }),
        api.get("/ads/my", { params: { status: "approved" } }),
        api.get("/bank-accounts"),
        api.get("/ads/welcome-promotion/eligibility")
      ]);
      setPlans((pRes.data || []).filter((plan) => plan?.type === "featured" && plan.isActive === true));
      setAds(aRes.data || []);
      setBanks(bRes.data || []);
      setPromoEligibility(eRes.data || { eligible: false });
    } catch (e) {
      console.error("Featured load error:", e?.response?.status, e?.message);
      setError(e?.response?.data?.error || e?.message || "فشل تحميل البيانات");
    } finally {
      setReferencesLoaded(true);
      setLoadingReferences(false);
    }
  };

  useEffect(() => {
    loadReferences();
  }, []);

  useEffect(() => {
    const draftId = searchParams.get("draftActionId");
    if (!draftId || !referencesLoaded || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const draft = await draftAction.resume(draftId);
        if (cancelled) return;
        const plan = plans.find((item) => item._id === draft.planId);
        const ad = ads.find((item) => item._id === draft.adId);
        if (draft.type !== "featured_ad_upgrade"
          || (draft.planId && !plan)
          || (draft.adId && !ad)
          || (draft.currentStep === 2 && (!plan || !ad))) {
          throw new Error("هذه العملية لم تعد متاحة بهذه البيانات. يمكنك بدء العملية من جديد.");
        }
        setSelectedPlanId(draft.planId || "");
        setSelectedAd(draft.adId || "");
        setStep(draft.currentStep);
        setDraftStarted(true);
        setResumedDraft(true);
        setSearchParams((current) => {
          const next = new URLSearchParams(current);
          next.delete("draftActionId");
          return next;
        }, { replace: true });
      } catch (resumeError) {
        if (!cancelled) setError(resumeError.response?.data?.error || resumeError.message || "تعذر استئناف العملية.");
      }
    })();
    return () => { cancelled = true; };
  }, [ads, draftAction.resume, plans, referencesLoaded, searchParams, setSearchParams, userId]);

  useEffect(() => {
    if (submissionCompletedRef.current || !draftStarted) return;
    draftAction.scheduleSave(step, {}, {
      adId: selectedAd || null,
      planId: selectedPlanId || null
    });
  }, [draftAction.scheduleSave, draftStarted, selectedAd, selectedPlanId, step]);

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
  const basePlanPrice = selectedPlan?.isSaleRunning
    ? Number(selectedPlan.finalPrice ?? selectedPlan.price ?? 0)
    : Number(selectedPlan?.price ?? 0);
  const socialPromotionPrice = selectedPlan?.socialPromotionIncluded
    ? 0
    : Number(selectedPlan?.socialPromotionPrice ?? 0);
  const totalPrice = basePlanPrice + (socialPromotionRequested ? socialPromotionPrice : 0);
  const promotionGroups = groupPromotionPlans(plans);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const savedDraft = await draftAction.persist(2, {}, {
        adId: selectedAd || null,
        planId: selectedPlanId || null
      });
      const draftActionId = savedDraft?._id || draftAction.draftId;
      const fd = new FormData();
      fd.append("planId", selectedPlanId);
      fd.append("productId", selectedAd);
      if (draftActionId) fd.append("draftActionId", draftActionId);
      if (receiptFile) fd.append("paymentReceipt", receiptFile);
      if (socialPromotionRequested) fd.append("socialPromotionRequested", "true");
      
      const res = await api.post("/purchase-requests", fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      submissionCompletedRef.current = true;
      if (draftActionId) draftAction.removeDraft(draftActionId);
      draftAction.clear();
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
        <div className="rounded-2xl bg-white border border-gray-100 p-6 text-center shadow-2xl shadow-blue-50 animate-in zoom-in duration-500 sm:rounded-[2.5rem] sm:p-10">
          <div className="mb-4 flex justify-center sm:mb-6">
            <div className="rounded-full bg-green-50 p-4 ring-8 ring-green-50/50">
              <svg className="h-12 w-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h2 className="mb-3 text-2xl font-black text-gray-900 sm:mb-4 sm:text-3xl">
            {selectedPlanId ? "تم إرسال الطلب بنجاح!" : "تم تفعيل التجربة بنجاح!"}
          </h2>
          <p className="mb-6 text-gray-600 font-bold leading-relaxed sm:mb-10">
            {selectedPlanId 
              ? "سيتم مراجعة طلب التمييز الخاص بك من قبل الإدارة وتفعيله في أقرب وقت ممكن." 
              : "استمتع بمميزات التمييز المجانية لإعلانك الآن وضاعف فرص وصولك."}
          </p>
          <div className="flex flex-col gap-3">
            <Link
              to="/account"
              className="w-full rounded-2xl bg-blue-600 py-4 text-base font-black text-white transition-all hover:bg-blue-700 shadow-xl shadow-blue-100 active:scale-95"
            >
              العودة إلى حسابي
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5 sm:space-y-8 sm:py-4">
      <div className="flex items-center justify-between">
        <Link to="/account" className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-blue-600 transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          حسابي
        </Link>
        <h2 className="text-2xl font-black text-gray-900">تمييز الإعلانات</h2>
      </div>
      {draftAction.error && <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{draftAction.error}</div>}
      {resumedDraft && step === 2 && <p className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-800">أعد رفع سند الدفع للمتابعة؛ لا تُحفظ الملفات ضمن العمليات غير المكتملة.</p>}
      {step === 1 && error && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button type="button" onClick={loadReferences} disabled={loadingReferences} className="rounded-xl bg-red-700 px-4 py-2 text-white disabled:opacity-60">
            {loadingReferences ? "جارٍ إعادة المحاولة..." : "إعادة المحاولة"}
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5 sm:space-y-12">
          {/* Free Trial Card */}
          {promoEligibility.eligible && (
            <div className="group relative overflow-hidden rounded-3xl border-2 border-white bg-gradient-to-r from-amber-400 to-orange-500 p-4 text-white shadow-xl shadow-orange-100 sm:rounded-[2.5rem] sm:border-4 sm:p-8 sm:shadow-2xl">
              <div className="absolute top-0 left-0 w-48 h-48 bg-white/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
              <div className="relative flex flex-col gap-3 sm:gap-6 md:flex-row md:items-center md:gap-8">
                <div className="flex min-w-0 items-center gap-3 sm:gap-5 md:flex-1">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/30 bg-white/30 text-2xl shadow-inner backdrop-blur-sm sm:h-16 sm:w-16 sm:rounded-3xl sm:text-3xl">
                  🎁
                </div>
                <div className="min-w-0 flex-1 text-right">
                  <h3 className="mb-1 text-base font-black sm:mb-2 sm:text-2xl">هدية ترحيبية: تجربة مجانية</h3>
                  <p className="max-w-xl text-xs font-bold leading-5 text-orange-50 sm:text-base sm:leading-relaxed">
                    جرّب تمييز إعلانك مجانًا لمدة {promoEligibility.durationHours} ساعات.
                  </p>
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[10px] font-black sm:mt-4 sm:gap-2 sm:px-4 sm:py-1.5 sm:text-xs">
                    🔥 متبقي {promoEligibility.remaining} تجربة
                  </div>
                </div>
                </div>
                <button
                  onClick={() => setShowFreeTrialModal(true)}
                  disabled={activatingFreeTrial}
                  className="min-h-11 w-full rounded-xl bg-white px-4 py-2.5 text-sm font-black text-orange-600 shadow-md transition-all hover:bg-orange-50 active:scale-[0.99] disabled:opacity-50 sm:min-h-14 sm:w-auto sm:rounded-2xl sm:px-10 sm:py-4 sm:text-base sm:shadow-xl"
                >
                  {activatingFreeTrial ? "جارٍ التفعيل..." : "تفعيل التجربة"}
                </button>
              </div>
            </div>
          )}

          {!promoEligibility.eligible && promoEligibility.reason === "quota_full" && (
            <div className="rounded-[2rem] bg-gray-50 p-6 border-2 border-dashed border-gray-200 text-center">
              <p className="text-base font-bold text-gray-400">🎁 انتهت جميع التجارب المجانية حالياً. يمكنك الاشتراك في إحدى الباقات أدناه.</p>
            </div>
          )}

          <div className="space-y-10">
            {loadingReferences ? (
              <div role="status" className="rounded-3xl border border-gray-100 bg-white p-8 text-center text-sm font-bold text-gray-600 shadow-sm">
                <span className="mx-auto mb-3 block h-8 w-8 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
                جارٍ تحميل الباقات والإعلانات...
              </div>
            ) : (
              <>
                {plans.length === 0 && !error && (
                  <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                    <p className="text-base font-black text-gray-800">لا توجد باقات نشطة حاليًا</p>
                    <p className="mt-2 text-sm font-medium text-gray-600">تحقق لاحقًا أو تواصل مع الدعم لمعرفة الخيارات المتاحة.</p>
                  </div>
                )}

                {plans.length > 0 && <div className="rounded-3xl border border-blue-100 bg-blue-50/70 p-5 sm:p-6">
                  <label htmlFor="promotion-ad" className="mb-2 block text-sm font-black text-gray-900">ابدأ باختيار الإعلان</label>
                  <select
                    id="promotion-ad"
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    value={selectedAd}
                    onChange={(event) => setSelectedAd(event.target.value)}
                  >
                    <option value="">اختر إعلاناً معتمداً من إعلاناتك</option>
                    {ads.map((ad) => <option key={ad._id} value={ad._id}>{ad.title}</option>)}
                  </select>
                  {ads.length === 0 && <p className="mt-2 text-xs font-semibold text-gray-600">لا توجد إعلانات معتمدة متاحة حاليًا لتقديم طلب ترويج.</p>}
                </div>}

                {promotionGroups.map((group) => (
                  <section key={group.key} aria-labelledby={`promotion-section-${group.key}`} className={`space-y-4 rounded-3xl border p-3 shadow-sm sm:space-y-5 sm:p-5 ${group.theme.section}`}>
                    <div className={`flex items-start gap-3 border-b pb-4 ${group.theme.divider}`}>
                      <span aria-hidden="true" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl text-white shadow-md ${group.theme.icon}`}>{group.icon}</span>
                      <div>
                        <h3 id={`promotion-section-${group.key}`} className="text-lg font-black text-gray-900 sm:text-xl">{group.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-gray-600">{group.description}</p>
                      </div>
                    </div>
                    {group.plans.length ? (
                      <div className="grid grid-cols-2 items-stretch gap-2 sm:gap-4 xl:grid-cols-3">
                        {group.plans.map((plan) => {
                          const planCard = getPromotionPlanCardData(plan);
                return (
                  <div 
                    key={plan._id}
                    className={`flex min-w-0 flex-col rounded-2xl border p-3 text-gray-900 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg sm:rounded-3xl sm:p-6 ${group.theme.card}`}
                  >
                    <div className="flex flex-1 flex-col">
                      <div className="mb-3 flex items-start justify-between gap-2 sm:mb-4 sm:gap-3">
                        <div className="min-w-0">
                          <h4 className="break-words text-sm font-black leading-5 sm:text-lg sm:leading-6">{planCard.name}</h4>
                        </div>
                        {plan.isSaleRunning && plan.saleLabel && (
                          <span className="max-w-20 break-words rounded-full bg-orange-100 px-2 py-1 text-center text-[10px] font-black leading-4 text-orange-800 sm:max-w-none sm:px-3 sm:text-xs">{plan.saleLabel}</span>
                        )}
                      </div>
                      {planCard.description && <p className="mb-3 text-xs leading-5 text-gray-600 sm:mb-4 sm:text-sm sm:leading-6">{planCard.description}</p>}

                      <div className={`mb-3 rounded-xl border bg-white/80 p-3 sm:mb-5 sm:rounded-2xl sm:p-4 ${group.theme.price}`}>
                        {plan.isSaleRunning ? (
                          <>
                            <p className="mb-1 text-[11px] font-semibold leading-4 text-gray-500 line-through sm:text-sm">
                              {planCard.originalPrice.toLocaleString("ar-YE")} {planCard.currency}
                            </p>
                            <p className="break-words text-lg font-black leading-6 text-gray-950 sm:text-2xl sm:leading-8">
                              {planCard.price.toLocaleString("ar-YE")}
                              <span className="mr-1 text-[10px] font-bold text-gray-600 sm:mr-2 sm:text-xs">{planCard.currency}</span>
                            </p>
                          </>
                        ) : (
                          <p className="break-words text-lg font-black leading-6 text-gray-950 sm:text-2xl sm:leading-8">
                            {planCard.price.toLocaleString("ar-YE")}
                            <span className="mr-1 text-[10px] font-bold text-gray-600 sm:mr-2 sm:text-xs">{planCard.currency}</span>
                          </p>
                        )}
                        <p className="mt-1 text-xs font-semibold leading-5 text-gray-600 sm:text-sm">المدة: {planCard.durationInDays} {Number(planCard.durationInDays) === 1 ? "يوم" : "أيام"}</p>
                      </div>

                      <ul className="mb-4 flex-1 space-y-2 sm:mb-6 sm:space-y-3">
                        {planCard.features.map((feature, index) => (
                          <li key={`${plan._id}-feature-${index}`} className="flex min-w-0 items-start gap-1.5 text-xs leading-5 text-gray-700 sm:gap-2 sm:text-sm sm:leading-6">
                            <span aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-600">✓</span>
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-auto space-y-4">
                        <button
                          type="button"
                          disabled={!selectedAd}
                          onClick={() => {
                            if (!plans.some((activePlan) => activePlan._id === plan._id && activePlan.isActive === true)) {
                              setError("هذه الباقة لم تعد متاحة. حدّث الصفحة واختر باقة نشطة.");
                              return;
                            }
                            setError("");
                            setSelectedPlanId(plan._id);
                            setSocialPromotionRequested(false);
                            setStep(2);
                            setDraftStarted(true);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className={`min-h-11 w-full rounded-xl px-2 py-2.5 text-xs font-black leading-5 text-white transition-colors active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-gray-300 sm:min-h-12 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm ${group.theme.button}`}
                        >
                          {selectedAd ? "اختيار الباقة" : "اختر إعلاناً أولاً"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
                        })}
                      </div>
                    ) : (
                      <p className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center text-sm font-semibold text-gray-500">
                        لا توجد باقات نشطة لهذا النوع حاليًا.
                      </p>
                    )}
                  </section>
                ))}
              </>
            )}
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
                  المبلغ المطلوب: {totalPrice.toLocaleString("ar-YE")} {promotionCurrencyLabel(selectedPlan?.currency)}
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-8">
              <div className="space-y-6">
                {(selectedPlan?.socialPromotionIncluded || socialPromotionPrice > 0) && (
                  <label className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={socialPromotionRequested}
                      onChange={(event) => setSocialPromotionRequested(event.target.checked)}
                    />
                    <span className="font-bold text-gray-800">
                      طلب ترويج يدوي عبر حسابات سوقك الرسمية
                      {selectedPlan?.socialPromotionIncluded
                        ? " (مضمن مجاناً)"
                        : ` (+${socialPromotionPrice.toLocaleString("ar-YE")} ${selectedPlan?.currency === "SAR" ? "ر.س" : selectedPlan?.currency === "USD" ? "$" : "ر.ي"})`}
                      <span className="mt-1 block text-xs font-medium text-gray-500">
                        يُراجع الطلب وينفذ يدوياً من الإدارة؛ لا يوجد نشر آلي على منصات التواصل.
                        <span className="mt-1 flex flex-wrap gap-x-3">
                          <a href="https://www.facebook.com/share/1GGvSFnu8Q/" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">فيسبوك سوقك</a>
                          <a href="https://www.instagram.com/souqak.ye?igsh=dWlpa215M2x1MWxz" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">إنستغرام سوقك</a>
                          <a href="https://whatsapp.com/channel/0029VbDWxY0BlHplgBSNoc12" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">قناة واتساب سوقك</a>
                        </span>
                      </span>
                    </span>
                  </label>
                )}
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
