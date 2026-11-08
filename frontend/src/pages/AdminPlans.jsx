import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";
import { getStoreCurrencyLabel, getStorePlanTypeLabel } from "../utils/storeArabicLabels.js";

const STORE_FEATURE_OPTIONS = [
  { value: "dynamicAttributes", label: "الخصائص الديناميكية" },
  { value: "cart", label: "السلة" },
  { value: "orders", label: "الطلبات" },
  { value: "whatsappOrdering", label: "الطلب عبر واتساب" },
  { value: "delivery", label: "التوصيل" },
  { value: "discounts", label: "الخصومات" },
  { value: "inventory", label: "إدارة المخزون" },
  { value: "customization", label: "التخصيص" },
  { value: "advancedCustomization", label: "التخصيص المتقدم" },
  { value: "pwa", label: "تطبيق المتجر" },
  { value: "analytics", label: "التحليلات" },
  { value: "notifications", label: "الإشعارات" },
  { value: "multipleContacts", label: "جهات اتصال متعددة" }
];

const EMPTY_STORE_FEATURES = Object.fromEntries(STORE_FEATURE_OPTIONS.map(({ value }) => [value, false]));

function normalizePlanFeatures(features) {
  const normalized = { ...EMPTY_STORE_FEATURES };
  if (Array.isArray(features)) {
    features.forEach((feature) => {
      if (["pwa", "multipleContacts", "delivery"].includes(feature)) normalized[feature] = true;
    });
    return normalized;
  }
  if (features && typeof features === "object") {
    STORE_FEATURE_OPTIONS.forEach(({ value }) => {
      normalized[value] = features[value] === true;
    });
  }
  return normalized;
}

export default function AdminPlans() {
  const api = useApi();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ 
    name: "", 
    description: "",
    type: "featured", 
    adServiceType: "featured",
    adPositions: [],
    rotationIntervalSeconds: 5,
    interstitialDelaySeconds: 8,
    frequencyCapHours: 24,
    socialPromotionIncluded: false,
    socialPromotionPrice: 0,
    durationInDays: 7, 
    price: 0, 
    currency: "YER_ADEN",
    maxProducts: 0,
    maxCategories: 0,
    features: { ...EMPTY_STORE_FEATURES },
    legacyFeatures: [],
    discountType: "percentage",
    discountValue: 0,
    isSaleActive: false,
    saleStartDate: "",
    saleEndDate: "",
    saleLabel: "",
    saleType: "special_offer",
    applyToAllPlans: false,
    remainingSlots: 0,
    isPopularOffer: false,
    isMostPopular: false,
    designStyle: "normal",
    cardTagline: "",
    cardHighlights: []
  });
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState("");
  const [showSaleOptions, setShowSaleOptions] = useState(false);
  const [planFilter, setPlanFilter] = useState("all");

  const resetForm = () => {
    setEditId(null);
    setForm({ 
      name: "", 
      description: "",
      type: "featured", 
      adServiceType: "featured",
      adPositions: [],
      rotationIntervalSeconds: 5,
      interstitialDelaySeconds: 8,
      frequencyCapHours: 24,
      socialPromotionIncluded: false,
      socialPromotionPrice: 0,
      durationInDays: 7, 
      price: 0, 
      currency: "YER_ADEN",
      maxProducts: 0,
      maxCategories: 0,
      features: { ...EMPTY_STORE_FEATURES },
      legacyFeatures: [],
      discountType: "percentage",
      discountValue: 0,
      isSaleActive: false,
      saleStartDate: "",
      saleEndDate: "",
      saleLabel: "",
      saleType: "special_offer",
      applyToAllPlans: false,
      remainingSlots: 0,
      isPopularOffer: false,
      isMostPopular: false,
      designStyle: "normal",
      cardTagline: "",
      cardHighlights: []
    });
    setShowSaleOptions(false);
  };

  const load = async () => {
    try {
      const res = await api.get("/admin/plans");
      setPlans(res.data || []);
    } catch (e) {
      setError("فشل تحميل الباقات");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = { ...form };
      delete payload.legacyFeatures;
      if (["store", "family-production"].includes(payload.type)) {
        payload.limits = { maxProducts: form.maxProducts, maxCategories: form.maxCategories };
      } else {
        delete payload.maxProducts;
        delete payload.maxCategories;
        payload.features = [];
        delete payload.limits;
        delete payload.designStyle;
        delete payload.cardTagline;
        delete payload.cardHighlights;
      }
      if (payload.type === "featured" && payload.adServiceType !== "featured") {
        payload.currency = "YER_ADEN";
      }
      // Convert dates to ISO or null
      if (!payload.saleStartDate) payload.saleStartDate = null;
      if (!payload.saleEndDate) payload.saleEndDate = null;

      if (editId) {
        await api.patch(`/admin/plans/${editId}`, payload);
      } else {
        await api.post("/admin/plans", payload);
      }
      resetForm();
      load();
    } catch (e) {
      setError(e.response?.data?.error || "فشل الحفظ");
    } finally {
      setLoading(false);
    }
  };

  const edit = (p) => {
    setEditId(p._id);
    setForm({
      name: p.name,
      description: p.description || "",
      type: p.type,
      adServiceType: p.adServiceType || "featured",
      adPositions: p.adPositions || [],
      rotationIntervalSeconds: p.rotationIntervalSeconds ?? 5,
      interstitialDelaySeconds: p.interstitialDelaySeconds ?? 8,
      frequencyCapHours: p.frequencyCapHours ?? 24,
      socialPromotionIncluded: p.socialPromotionIncluded === true,
      socialPromotionPrice: p.socialPromotionPrice ?? 0,
      durationInDays: p.durationInDays,
      price: p.price ?? 0,
      currency: p.type === "featured" && p.adServiceType !== "featured" ? "YER_ADEN" : p.currency || "YER_ADEN",
      maxProducts: p.limits?.maxProducts ?? 0,
      maxCategories: p.limits?.maxCategories ?? 0,
      features: normalizePlanFeatures(p.features),
      legacyFeatures: p.legacyFeatures || [],
      discountType: p.discountType || "percentage",
      discountValue: p.discountValue || 0,
      isSaleActive: p.isSaleActive || false,
      saleStartDate: p.saleStartDate ? new Date(p.saleStartDate).toISOString().split('T')[0] : "",
      saleEndDate: p.saleEndDate ? new Date(p.saleEndDate).toISOString().split('T')[0] : "",
      saleLabel: p.saleLabel || "",
      saleType: p.saleType || "special_offer",
      applyToAllPlans: p.applyToAllPlans || false,
      remainingSlots: p.remainingSlots || 0,
      isPopularOffer: p.isPopularOffer || false,
      isMostPopular: p.isMostPopular || false,
      designStyle: p.designStyle || "normal",
      cardTagline: p.cardTagline || "",
      cardHighlights: Array.isArray(p.cardHighlights) ? p.cardHighlights : []
    });
    if (p.isSaleActive) setShowSaleOptions(true);
  };

  const remove = async (id) => {
    if (!confirm("إيقاف هذه الباقة؟ إذا كانت مرتبطة بطلبات سابقة فسيتم الاحتفاظ بها كسجل غير نشط.")) return;
    try {
      await api.delete(`/admin/plans/${id}`);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || "تعذر إيقاف الباقة");
    }
  };

  const togglePlanActive = async (plan) => {
    try {
      await api.patch(`/admin/plans/${plan._id}`, { isActive: !plan.isActive });
      await load();
    } catch (e) {
      setError(e.response?.data?.error || "تعذر تحديث حالة الباقة");
    }
  };

  const visiblePlans = plans.filter((plan) => {
    if (planFilter === "other") return plan.type !== "featured";
    if (planFilter === "featured") return plan.type === "featured" && (plan.adServiceType || "featured") === "featured";
    if (planFilter === "placement" || planFilter === "interstitial") {
      return plan.type === "featured" && plan.adServiceType === planFilter;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <h1 className="text-xl font-black text-gray-900">إدارة الباقات</h1>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="تصنيف الباقات حسب الخدمة">
        {[
          ["all", "الكل"],
          ["featured", "التثبيت والتمييز"],
          ["placement", "المساحات الإعلانية"],
          ["interstitial", "الإعلانات البينية"],
          ["other", "التوثيق والمتاجر"]
        ].map(([value, label]) => (
          <button key={value} type="button" onClick={() => setPlanFilter(value)}
            className={`rounded-xl border px-3 py-2 text-xs font-black ${planFilter === value ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200 bg-white text-gray-600"}`}>
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3 text-red-700">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Section */}
        <div className="lg:col-span-1">
          <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-50 bg-gray-50/50">
              <h3 className="font-black text-gray-900 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                {editId ? "تعديل باقة" : "إضافة باقة جديدة"}
              </h3>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-[11px] font-black text-gray-400 mb-1.5 mr-1">الاسم</label>
                <input
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-300"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="مثال: 7 أيام"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-gray-400 mb-1.5 mr-1">الوصف</label>
                <textarea
                  maxLength={1000}
                  rows={3}
                  className="w-full resize-y px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="تفاصيل الخدمة والميزات المشمولة"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-gray-400 mb-1.5 mr-1">النوع</label>
                  <select
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  >
                    <option value="featured">إعلان مميز</option>
                    <option value="verification">توثيق</option>
                    <option value="store">متجر</option>
                    <option value="family-production">صناعات سوقك</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-gray-400 mb-1.5 mr-1">المدة (أيام)</label>
                  <input
                    type="number"
                    min={1}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    value={form.durationInDays}
                    onChange={(e) => setForm((f) => ({ ...f, durationInDays: parseInt(e.target.value, 10) || 0 }))}
                    required
                  />
                </div>
              </div>

              {["store", "family-production"].includes(form.type) && (
                <div className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-3">
                  <div>
                    <label className="block text-[11px] font-black text-gray-600 mb-1.5 mr-1">تصميم بطاقة الباقة</label>
                    <select
                      className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      value={form.designStyle}
                      onChange={(event) => setForm((current) => ({ ...current, designStyle: event.target.value }))}
                    >
                      <option value="free">مجانية</option>
                      <option value="normal">عادية</option>
                      <option value="business">أعمال</option>
                      <option value="professional">احترافية</option>
                    </select>
                    <p className="mt-1 text-[10px] font-medium text-gray-400">يحدد هذا الاختيار مظهر البطاقة وترتيبها، ولا يغيّر السعر أو الميزات.</p>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-gray-600 mb-1.5 mr-1">عبارة تسويقية مختصرة</label>
                    <input
                      maxLength={240}
                      className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-400"
                      value={form.cardTagline}
                      onChange={(event) => setForm((current) => ({ ...current, cardTagline: event.target.value }))}
                      placeholder="مثال: بداية سهلة لعرض مشروعك"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-gray-600 mb-1.5 mr-1">نقاط إبراز الباقة (كل نقطة في سطر، حتى 6 نقاط)</label>
                    <textarea
                      rows={4}
                      className="w-full resize-y px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-400"
                      value={form.cardHighlights.join("\n")}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        cardHighlights: event.target.value.split(/\r?\n/).slice(0, 6)
                      }))}
                      placeholder={"واجهة مخصصة لمشروعك\nعرض المنتجات بسهولة\nتواصل مباشر مع العملاء"}
                    />
                  </div>
                </div>
              )}

              <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-amber-100 bg-amber-50/70 p-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  checked={form.isMostPopular}
                  onChange={(event) => setForm((current) => ({ ...current, isMostPopular: event.target.checked }))}
                />
                <span>
                  <span className="block text-xs font-black text-amber-900">الأكثر طلبًا لهذا النوع من الخدمة</span>
                  <span className="mt-1 block text-[10px] font-medium text-amber-800">عند التفعيل، يُلغى التحديد عن الباقة السابقة من النوع نفسه.</span>
                </span>
              </label>

              {form.type === "featured" && (
                <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                  <label className="block text-[11px] font-black text-gray-600">نوع خدمة الإعلان</label>
                  <select
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold"
                    value={form.adServiceType}
                    onChange={(event) => setForm((current) => ({ ...current, adServiceType: event.target.value }))}
                  >
                    <option value="featured">تثبيت وتمييز الإعلان (الخدمة الحالية)</option>
                    <option value="placement">مساحات إعلانية داخل التطبيق</option>
                    <option value="interstitial">إعلان مؤقت بيني</option>
                  </select>
                  {form.adServiceType === "placement" && (
                    <>
                      <div className="grid grid-cols-1 gap-2 text-xs text-gray-700">
                        {[
                          ["home", "مساحة الصفحة الرئيسية"],
                          ["between_ads", "بين بطاقات الإعلانات"],
                          ["category", "صفحات التصنيفات"]
                        ].map(([value, label]) => (
                          <label key={value} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={form.adPositions.includes(value)}
                              onChange={(event) => setForm((current) => ({
                                ...current,
                                adPositions: event.target.checked
                                  ? [...current.adPositions, value]
                                  : current.adPositions.filter((item) => item !== value)
                              }))}
                            />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                      <label className="block text-[10px] font-bold text-gray-500">
                        مدة عرض كل إعلان (ثانية)
                        <input
                          type="number"
                          min={1}
                          max={60}
                          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm"
                          value={form.rotationIntervalSeconds}
                          onChange={(event) => setForm((current) => ({ ...current, rotationIntervalSeconds: Number(event.target.value) }))}
                        />
                      </label>
                    </>
                  )}
                  {form.adServiceType === "interstitial" && (
                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-[10px] font-bold text-gray-500">
                        انتظار العرض (ثانية)
                        <input
                          type="number"
                          min={0}
                          max={120}
                          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm"
                          value={form.interstitialDelaySeconds}
                          onChange={(event) => setForm((current) => ({ ...current, interstitialDelaySeconds: Number(event.target.value) }))}
                        />
                      </label>
                      <label className="text-[10px] font-bold text-gray-500">
                        حد التكرار (ساعة)
                        <input
                          type="number"
                          min={1}
                          max={720}
                          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm"
                          value={form.frequencyCapHours}
                          onChange={(event) => setForm((current) => ({ ...current, frequencyCapHours: Number(event.target.value) }))}
                        />
                      </label>
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.socialPromotionIncluded}
                      onChange={(event) => setForm((current) => ({ ...current, socialPromotionIncluded: event.target.checked }))}
                    />
                    تضمين الترويج اليدوي عبر حسابات سوقك الرسمية مجاناً
                  </label>
                  {!form.socialPromotionIncluded && (
                    <label className="block text-[10px] font-bold text-gray-500">
                      سعر إضافة الترويج الاجتماعي (0 = غير متاح)
                      <input
                        type="number"
                        min={0}
                        className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm"
                        value={form.socialPromotionPrice}
                        onChange={(event) => setForm((current) => ({ ...current, socialPromotionPrice: Number(event.target.value) }))}
                      />
                    </label>
                  )}
                </div>
              )}

              {["store", "family-production"].includes(form.type) && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-black text-gray-400 mb-1.5 mr-1">الحد الأقصى للمنتجات (0 = غير محدود)</label>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        value={form.maxProducts}
                        onChange={(e) => setForm((f) => ({ ...f, maxProducts: Number.parseInt(e.target.value, 10) || 0 }))}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black text-gray-400 mb-1.5 mr-1">الحد الأقصى للتصنيفات (0 = غير محدود)</label>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        value={form.maxCategories}
                        onChange={(e) => setForm((f) => ({ ...f, maxCategories: Number.parseInt(e.target.value, 10) || 0 }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2" dir="rtl">
                    <label className="block text-[11px] font-black text-gray-400 mb-1.5 mr-1">ميزات الخطة</label>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
                      {STORE_FEATURE_OPTIONS.map(({ value, label }) => {
                        const selected = form.features?.[value] === true;
                        return (
                          <label key={value} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-2 py-2">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(event) => setForm((f) => ({
                                ...f,
                                features: { ...f.features, [value]: event.target.checked }
                              }))}
                            />
                            <span className="font-bold">{label}</span>
                          </label>
                        );
                      })}
                    </div>
                    {form.legacyFeatures.length > 0 && (
                      <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                        توجد ميزات قديمة محفوظة دون تفعيل للتوافق.
                      </p>
                    )}
                  </div>
                </>
              )}

              <div>
                <label className="block text-[11px] font-black text-gray-400 mb-1.5 mr-1">العملة</label>
                <select
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  value={form.currency}
                  disabled={form.type === "featured" && (form.adServiceType !== "featured" || !editId)}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                >
                  <option value="YER_ADEN">ريال يمني (عدن)</option>
                  <option value="YER_SANAA">ريال يمني (صنعاء)</option>
                  <option value="SAR">ريال سعودي</option>
                  <option value="USD">دولار</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-gray-400 mb-1.5 mr-1">السعر</label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-black text-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    value={String(form.price ?? "")}
                    onChange={(e) => {
                      const v = (e.target.value || "").replace(/\D/g, "");
                      setForm((f) => ({ ...f, price: v ? parseInt(v, 10) : 0 }));
                    }}
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400 uppercase">
                    {getStoreCurrencyLabel(form.currency)}
                  </div>
                </div>
              </div>

              {/* Offers & Discounts Section */}
              <div className="pt-4 border-t border-gray-100 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-black text-gray-900 uppercase tracking-wider">إدارة العروض والتخفيضات</h4>
                  <button 
                    type="button"
                    onClick={() => {
                      setShowSaleOptions(!showSaleOptions);
                      if (!showSaleOptions) setForm(f => ({ ...f, isSaleActive: true }));
                      else setForm(f => ({ ...f, isSaleActive: false }));
                    }}
                    className={`text-[10px] font-black px-2 py-1 rounded-md transition-all ${
                      showSaleOptions ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
                    }`}
                  >
                    {showSaleOptions ? "إيقاف العرض" : "تفعيل العرض"}
                  </button>
                </div>

                {showSaleOptions && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-black text-gray-400 mb-1.5 mr-1">نوع الخصم</label>
                        <select
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                          value={form.discountType}
                          onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value }))}
                        >
                          <option value="percentage">نسبة مئوية (%)</option>
                          <option value="fixed">مبلغ ثابت</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-black text-gray-400 mb-1.5 mr-1">قيمة الخصم</label>
                        <input
                          type="number"
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                          value={form.discountValue}
                          onChange={(e) => setForm((f) => ({ ...f, discountValue: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-black text-gray-400 mb-1.5 mr-1">تاريخ البداية</label>
                        <input
                          type="date"
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                          value={form.saleStartDate}
                          onChange={(e) => setForm((f) => ({ ...f, saleStartDate: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-black text-gray-400 mb-1.5 mr-1">تاريخ النهاية</label>
                        <input
                          type="date"
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                          value={form.saleEndDate}
                          onChange={(e) => setForm((f) => ({ ...f, saleEndDate: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-gray-400 mb-1.5 mr-1">نص العرض (مثال: عرض رمضان)</label>
                      <input
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        value={form.saleLabel}
                        onChange={(e) => setForm((f) => ({ ...f, saleLabel: e.target.value }))}
                        placeholder="لفترة محدودة..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-black text-gray-400 mb-1.5 mr-1">نوع العرض</label>
                        <select
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                          value={form.saleType}
                          onChange={(e) => setForm((f) => ({ ...f, saleType: e.target.value }))}
                        >
                          <option value="flash_sale">عرض خاطف</option>
                          <option value="ramadan_offer">عرض رمضان</option>
                          <option value="eid_offer">عرض العيد</option>
                          <option value="opening_offer">عرض الافتتاح</option>
                          <option value="special_offer">عرض خاص</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-black text-gray-400 mb-1.5 mr-1">الاشتراكات المتاحة</label>
                        <input
                          type="number"
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                          value={form.remainingSlots}
                          onChange={(e) => setForm((f) => ({ ...f, remainingSlots: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          checked={form.isPopularOffer}
                          onChange={(e) => setForm((f) => ({ ...f, isPopularOffer: e.target.checked }))}
                        />
                        <span className="text-xs font-bold text-gray-600 group-hover:text-gray-900 transition-colors">الأكثر شراءً / الأفضل قيمة</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          checked={form.applyToAllPlans}
                          onChange={(e) => setForm((f) => ({ ...f, applyToAllPlans: e.target.checked }))}
                        />
                        <span className="text-xs font-bold text-gray-600 group-hover:text-gray-900 transition-colors">تطبيق على جميع الباقات</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-black shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {editId ? "تحديث الباقة" : "حفظ الباقة"}
                </button>
                {editId && (
                  <button 
                    type="button" 
                    onClick={resetForm} 
                    className="px-4 bg-gray-50 text-gray-500 rounded-xl text-sm font-bold border border-gray-100 hover:bg-gray-100 active:scale-95 transition-all"
                  >
                    إلغاء
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* List Section */}
        <div className="lg:col-span-2 space-y-4">
          {/* Desktop Table */}
          <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {loading && !plans.length ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                <p className="text-gray-400 font-bold animate-pulse">جاري تحميل الباقات...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100">
                      <th className="px-4 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider">الاسم والنوع</th>
                      <th className="px-4 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider text-center">المدة</th>
                      <th className="px-4 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider text-center">السعر</th>
                      <th className="px-4 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider text-left">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {visiblePlans.map((p) => (
                      <tr key={p._id} className="hover:bg-gray-50/30 transition-colors group">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] border ${
                              p.type === "featured" ? "bg-blue-50 text-blue-600 border-blue-100" : ["store", "family-production"].includes(p.type) ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-purple-50 text-purple-600 border-purple-100"
                            }`}>
                              {p.type === "featured" ? "إ" : p.type === "family-production" ? "ص" : p.type === "store" ? "م" : "ت"}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 text-xs">{p.name}</p>
                              <p className="text-[10px] text-gray-400 font-medium">{p.type === "family-production" ? "صناعات سوقك" : p.type === "featured" && p.adServiceType === "placement" ? "مساحات داخل التطبيق" : p.type === "featured" && p.adServiceType === "interstitial" ? "إعلان بيني" : getStorePlanTypeLabel(p.type)}</p>
                              {p.isMostPopular && <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black text-amber-800">الأكثر طلبًا</span>}
                              {["store", "family-production"].includes(p.type) && <span className="mt-1 mr-1 inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[9px] font-black text-indigo-700">{({ free: "مجانية", normal: "عادية", business: "أعمال", professional: "احترافية" })[p.designStyle] || "عادية"}</span>}
                              {p.description && <p className="mt-1 max-w-[260px] text-[10px] text-gray-500">{p.description}</p>}
                              <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[9px] font-black ${p.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{p.isActive ? "نشطة" : "متوقفة"}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center px-2 py-1 rounded-lg bg-gray-50 text-gray-600 text-[10px] font-black border border-gray-100">
                            {p.durationInDays} يوم
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className={`text-xs font-black ${p.isSaleRunning ? "text-gray-400 line-through scale-75" : "text-blue-600"}`}>
                              {Number(p.price ?? 0).toLocaleString("ar-EG")} {getStoreCurrencyLabel(p.currency)}
                            </span>
                            {p.isSaleRunning && (
                              <span className="text-xs font-black text-green-600">
                                {Number(p.finalPrice).toLocaleString("ar-EG")} {getStoreCurrencyLabel(p.currency)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-left whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5 opacity-100 transition-all">
                            <button type="button" onClick={() => togglePlanActive(p)}
                              className={`rounded-lg border px-2 py-1 text-[10px] font-black ${p.isActive ? "border-amber-100 bg-amber-50 text-amber-700" : "border-emerald-100 bg-emerald-50 text-emerald-700"}`}>
                              {p.isActive ? "إيقاف" : "إعادة تفعيل"}
                            </button>
                            <button
                              onClick={() => edit(p)}
                              className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-all border border-blue-100 active:scale-95"
                              title="تعديل"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button
                              onClick={() => remove(p._id)}
                              className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-all border border-red-100 active:scale-95"
                              title="حذف"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {visiblePlans.length === 0 && !loading && (
                      <tr>
                        <td colSpan="4" className="px-4 py-20 text-center">
                          <div className="bg-gray-50 h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                          </div>
                          <p className="text-sm font-bold text-gray-400">لا توجد باقات حالياً.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Mobile View - Cards */}
          <div className="block sm:hidden space-y-4">
            {visiblePlans.map((p) => (
              <div key={p._id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4 transition-all active:scale-[0.99]">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black border ${
                      p.type === "featured" ? "bg-blue-50 text-blue-600 border-blue-100" : ["store", "family-production"].includes(p.type) ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-purple-50 text-purple-600 border-purple-100"
                    }`}>
                      {p.type === "featured" ? "إ" : p.type === "family-production" ? "ص" : p.type === "store" ? "م" : "ت"}
                    </div>
                    <div>
                      <h3 className="font-black text-gray-900 text-sm">{p.name}</h3>
                      <p className="text-[10px] font-bold text-gray-400 mt-0.5">
                        النوع: {p.type === "featured" && p.adServiceType === "placement" ? "مساحات داخل التطبيق" : p.type === "featured" && p.adServiceType === "interstitial" ? "إعلان بيني" : p.type === "family-production" ? "صناعات سوقك" : getStorePlanTypeLabel(p.type)}
                      </p>
                      <p className={`text-[10px] font-black ${p.isActive ? "text-emerald-700" : "text-gray-400"}`}>{p.isActive ? "نشطة" : "متوقفة"}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {p.isMostPopular && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black text-amber-800">الأكثر طلبًا</span>}
                        {["store", "family-production"].includes(p.type) && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[9px] font-black text-indigo-700">{({ free: "مجانية", normal: "عادية", business: "أعمال", professional: "احترافية" })[p.designStyle] || "عادية"}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex flex-col items-end">
                      <span className={`text-sm font-black ${p.isSaleRunning ? "text-gray-400 line-through text-[10px]" : "text-blue-600"}`}>
                        {Number(p.price ?? 0).toLocaleString("ar-EG")} {getStoreCurrencyLabel(p.currency)}
                      </span>
                      {p.isSaleRunning && (
                        <span className="text-sm font-black text-green-600">
                          {Number(p.finalPrice).toLocaleString("ar-EG")} {getStoreCurrencyLabel(p.currency)}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-gray-400">{p.durationInDays} يوم</span>
                  </div>
                </div>
                {p.description && <p className="text-xs leading-5 text-gray-500">{p.description}</p>}

                <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
                  <button
                    type="button"
                    onClick={() => togglePlanActive(p)}
                    className={`flex-1 rounded-xl border py-2.5 text-xs font-black ${p.isActive ? "border-amber-100 bg-amber-50 text-amber-700" : "border-emerald-100 bg-emerald-50 text-emerald-700"}`}
                  >
                    {p.isActive ? "إيقاف" : "إعادة تفعيل"}
                  </button>
                  <button
                    onClick={() => edit(p)}
                    className="flex-1 py-2.5 bg-blue-50 text-blue-600 rounded-xl text-xs font-black border border-blue-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    تعديل
                  </button>
                  <button
                    onClick={() => remove(p._id)}
                    className="p-2.5 bg-red-50 text-red-600 rounded-xl border border-red-100 active:scale-95 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            ))}
            {visiblePlans.length === 0 && !loading && (
              <div className="bg-white p-20 text-center rounded-2xl border border-gray-100 shadow-sm">
                <div className="bg-gray-50 h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                </div>
                <p className="text-sm font-bold text-gray-400">لا توجد باقات حالياً.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
