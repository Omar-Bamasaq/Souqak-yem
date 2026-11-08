import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useApi } from "../api/axios.js";
import { useAuth } from "../store/AuthContext.jsx";
import { useDraftAction } from "../hooks/useDraftActions.js";
import BankAccountsDisplay from "../components/BankAccountsDisplay.jsx";
import { getEnabledStorePlanFeatures, hasStorePlanFeature } from "../utils/storePlanFeatures.js";
import { getStoreCurrencyLabel } from "../utils/storeArabicLabels.js";
import { getStoreActivityCategoryOptions } from "../utils/storeCategories.js";
import { isValidStoreSlug, slugifyStoreName } from "../utils/storeSlug.js";
import { parseMapCoordinates } from "../components/mapCoordinates.js";

const MapLocationPicker = lazy(() => import("../components/MapLocationPicker.jsx"));

const STORE_PLAN_DESIGNS = {
  free: {
    label: "مجانية",
    icon: "01",
    card: "border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/70 shadow-md hover:border-emerald-400 hover:shadow-xl",
    accent: "bg-gradient-to-l from-emerald-500 to-lime-400",
    iconStyle: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
    titleStyle: "text-slate-900",
    textStyle: "text-slate-600",
    priceStyle: "text-emerald-800",
    chipStyle: "bg-emerald-100 text-emerald-900",
    actionStyle: "border-emerald-200 bg-white text-emerald-800"
  },
  normal: {
    label: "عادية",
    icon: "02",
    card: "border-blue-200 bg-gradient-to-br from-white via-white to-blue-50 hover:border-blue-400 hover:shadow-lg",
    accent: "bg-gradient-to-l from-blue-500 to-cyan-400",
    iconStyle: "bg-blue-100 text-blue-700 ring-1 ring-blue-200",
    titleStyle: "text-slate-900",
    textStyle: "text-slate-600",
    priceStyle: "text-blue-700",
    chipStyle: "bg-blue-100 text-blue-800",
    actionStyle: "border-blue-200 bg-blue-50 text-blue-800"
  },
  business: {
    label: "أعمال",
    icon: "03",
    card: "border-emerald-300 bg-gradient-to-br from-white via-emerald-50/50 to-emerald-100/70 shadow-md hover:border-emerald-500 hover:shadow-xl",
    accent: "bg-gradient-to-l from-emerald-600 via-teal-500 to-lime-400",
    iconStyle: "bg-emerald-600 text-white shadow-md shadow-emerald-900/15",
    titleStyle: "text-slate-900",
    textStyle: "text-emerald-950/70",
    priceStyle: "text-emerald-800",
    chipStyle: "bg-emerald-100 text-emerald-900",
    actionStyle: "border-emerald-300 bg-emerald-600 text-white"
  },
  professional: {
    label: "احترافية",
    icon: "04",
    card: "border-indigo-700 bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 text-white shadow-xl shadow-indigo-950/20 hover:border-violet-400 hover:shadow-2xl",
    accent: "bg-gradient-to-l from-amber-300 via-violet-300 to-cyan-200",
    iconStyle: "bg-gradient-to-br from-amber-200 to-amber-400 text-indigo-950 shadow-lg shadow-amber-300/20",
    titleStyle: "text-white",
    textStyle: "text-indigo-100/90",
    priceStyle: "text-white",
    chipStyle: "bg-white/10 text-white ring-1 ring-white/20",
    actionStyle: "border-white/20 bg-white text-indigo-950"
  }
};

const STORE_PLAN_ORDER = { free: 0, normal: 1, business: 2, professional: 3 };

function sortStorePlans(plans) {
  return [...plans].sort((left, right) => {
    const leftOrder = STORE_PLAN_ORDER[left.designStyle] ?? STORE_PLAN_ORDER.normal;
    const rightOrder = STORE_PLAN_ORDER[right.designStyle] ?? STORE_PLAN_ORDER.normal;
    return leftOrder - rightOrder || left.durationInDays - right.durationInDays;
  });
}

function normalizePhoneInput(value) {
  return String(value || "").replace(/[^\d+\s\-()]/g, "").trim();
}

const emptyForm = {
  storeName: "",
  storeSlug: "",
  activityKey: "",
  description: "",
  location: "",
  phone: "",
  phones: [{ type: "mobile", value: "" }],
  whatsapp: [{ type: "whatsapp", value: "" }],
  lat: "",
  lng: "",
  email: "",
  notificationEmail: "",
  selectedCategories: []
};

function flattenCategories(categories = [], result = []) {
  for (const category of categories) {
    result.push(category);
    if (Array.isArray(category.children)) flattenCategories(category.children, result);
  }
  return result;
}

export default function CreateStore({ storeType = "store" }) {
  const isFamilyProduction = storeType === "family-production";
  const api = useApi();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?._id || user?.id;
  const [searchParams, setSearchParams] = useSearchParams();
  const draftType = isFamilyProduction ? "family_production_registration" : "store_creation";
  const draftAction = useDraftAction(api, userId, draftType);
  const [plans, setPlans] = useState([]);
  const [banks, setBanks] = useState([]);
  const [bankLoadError, setBankLoadError] = useState("");
  const [categories, setCategories] = useState([]);
  const [activities, setActivities] = useState([]);
  const [governorates, setGovernorates] = useState([]);
  const [cities, setCities] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [lockedIdentity, setLockedIdentity] = useState(null);
  const [slugAvailability, setSlugAvailability] = useState(null);
  const [slugAvailabilityError, setSlugAvailabilityError] = useState("");
  const [customCity, setCustomCity] = useState("");
  const [cityIsOther, setCityIsOther] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loadError, setLoadError] = useState("");
  const [draftStarted, setDraftStarted] = useState(false);
  const [referencesLoaded, setReferencesLoaded] = useState(false);
  const [resumedDraft, setResumedDraft] = useState(false);
  const submissionCompletedRef = useRef(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoadError("");
        const [planRes, catRes, govRes, activityRes, storeRes] = await Promise.all([
          api.get("/plans", { params: { type: storeType } }),
          api.get("/categories"),
          api.get("/governorates"),
          api.get("/stores/activities", { params: { type: storeType } }),
          api.get("/stores/me", { params: { storeType } })
        ]);
        const nextPlans = planRes.data || [];
        const nextCategories = catRes.data || [];
        const nextGovernorates = govRes.data || [];
        const orderedPlans = sortStorePlans(nextPlans);
        setPlans(orderedPlans);
        setCategories(nextCategories);
        setGovernorates(nextGovernorates);
        setActivities(activityRes.data || []);
        if (storeRes.data?.status === "rejected") {
          const identity = {
            storeName: storeRes.data.storeName || "",
            storeSlug: storeRes.data.slug || "",
            activityKey: storeRes.data.activityKey || ""
          };
          setLockedIdentity(identity);
          setForm((current) => ({ ...current, ...identity }));
        }
        if (orderedPlans[0]) setSelectedPlanId(orderedPlans[0]._id);
      } catch (err) {
        console.error(err);
        setLoadError(err?.response?.data?.error || "تعذر تحميل خطط المتاجر أو التصنيفات في الوقت الحالي.");
        setPlans([]);
        setCategories([]);
      } finally {
        setReferencesLoaded(true);
      }
    };
    load();
  }, [api, storeType]);

  useEffect(() => {
    const draftId = searchParams.get("draftActionId");
    if (!draftId || !referencesLoaded || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const draft = await draftAction.resume(draftId);
        if (cancelled) return;
        const availableCategoryIds = new Set(flattenCategories(categories).map((category) => category._id));
        const activityAvailable = !draft.data?.activityKey
          || activities.some((activity) => activity.activityKey === draft.data.activityKey);
        const categoriesAvailable = (draft.data?.selectedCategories || [])
          .every((categoryId) => availableCategoryIds.has(categoryId));
        const governorateAvailable = !draft.data?.governorateId
          || governorates.some((item) => item._id === draft.data.governorateId);
        if (draft.type !== draftType
          || (draft.planId && !plans.some((plan) => plan._id === draft.planId))
          || !activityAvailable
          || !categoriesAvailable
          || !governorateAvailable) {
          throw new Error("هذه العملية لم تعد متاحة بهذه البيانات. يمكنك بدء العملية من جديد.");
        }
        const restored = draft.data || {};
        setSelectedPlanId(draft.planId || "");
        setForm({
          ...emptyForm,
          ...restored,
          storeName: lockedIdentity?.storeName || restored.storeName || "",
          storeSlug: lockedIdentity?.storeSlug || restored.storeSlug || slugifyStoreName(restored.storeName),
          activityKey: lockedIdentity?.activityKey || restored.activityKey || "",
          phones: restored.phones?.length ? restored.phones : emptyForm.phones,
          whatsapp: restored.whatsapp?.length ? restored.whatsapp : emptyForm.whatsapp
        });
        setCustomCity(restored.customCityName || "");
        setCityIsOther(Boolean(restored.customCityName && !restored.cityId));
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
  }, [activities, categories, draftType, draftAction.resume, governorates, lockedIdentity, plans, referencesLoaded, searchParams, setSearchParams, userId]);

  useEffect(() => {
    let cancelled = false;
    api.get("/bank-accounts")
      .then((response) => {
        if (!cancelled) {
          setBanks(response.data || []);
          setBankLoadError("");
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setBanks([]);
          setBankLoadError(loadError?.response?.data?.error || "تعذر تحميل الحسابات البنكية المعتمدة.");
        }
      });
    return () => { cancelled = true; };
  }, [api]);

  useEffect(() => {
    const governorateId = form.governorateId;
    if (!governorateId) {
      setCities([]);
      return;
    }

    (async () => {
      try {
        const res = await api.get(`/cities?governorateId=${governorateId}&active=true`);
        const nextCities = res.data || [];
        setCities(nextCities);
        if (form.cityId && !nextCities.some((city) => city._id === form.cityId)) {
          setForm((prev) => ({ ...prev, cityId: "" }));
        }
      } catch {
        setCities([]);
      }
    })();
  }, [form.governorateId, api]);

  useEffect(() => {
    let cancelled = false;
    setSlugAvailability(null);
    setSlugAvailabilityError("");
    if (lockedIdentity?.storeSlug) {
      setSlugAvailability({ slug: lockedIdentity.storeSlug, available: true });
      return () => { cancelled = true; };
    }
    if (step !== 2 || !isValidStoreSlug(form.storeSlug)) return undefined;
    const timer = setTimeout(async () => {
      try {
        const response = await api.get(`/stores/slug-availability/${encodeURIComponent(form.storeSlug)}`, {
          params: { storeType }
        });
        if (!cancelled) setSlugAvailability({ slug: form.storeSlug, available: response.data?.available === true });
      } catch (availabilityError) {
        if (!cancelled) {
          setSlugAvailabilityError(availabilityError?.response?.data?.error || "تعذر التحقق من توفر النطاق.");
        }
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [api, form.storeSlug, lockedIdentity, step, storeType]);

  const selectedPlan = plans.find((plan) => plan._id === selectedPlanId) || null;
  const isPaidPlan = Number(selectedPlan?.price || 0) > 0;
  const selectedActivity = activities.find((activity) => activity.activityKey === form.activityKey) || null;
  const activityCategoryOptions = getStoreActivityCategoryOptions(categories, selectedActivity);
  const supportsMultipleContacts = isFamilyProduction || hasStorePlanFeature(selectedPlan, "multipleContacts");
  const maxCategories = Number(selectedPlan?.limits?.maxCategories || 0);
  const draftData = {
    storeName: form.storeName,
    storeSlug: form.storeSlug,
    activityKey: form.activityKey,
    description: form.description,
    governorateId: form.governorateId,
    cityId: form.cityId,
    customCityName: cityIsOther ? customCity : "",
    location: form.location,
    lat: form.lat,
    lng: form.lng,
    phone: form.phone,
    phones: form.phones,
    whatsapp: form.whatsapp,
    email: form.email,
    notificationEmail: form.notificationEmail,
    selectedCategories: form.selectedCategories
  };

  useEffect(() => {
    if (submissionCompletedRef.current) return;
    const hasFormProgress = Boolean(
      form.storeName.trim()
      || form.storeSlug.trim()
      || form.activityKey
      || form.description.trim()
      || form.governorateId
      || form.cityId
      || customCity.trim()
      || form.location.trim()
      || form.phones.some((item) => item.value)
      || form.whatsapp.some((item) => item.value)
      || form.email.trim()
      || form.notificationEmail.trim()
      || form.selectedCategories.length
    );
    if (!draftStarted && !hasFormProgress) return;
    draftAction.scheduleSave(step, draftData, { planId: selectedPlanId || null });
  }, [customCity, draftAction.scheduleSave, draftData, draftStarted, form, selectedPlanId, step]);

  const updateContact = (field, index, value) => {
    setForm((current) => ({
      ...current,
      [field]: current[field].map((entry, entryIndex) => entryIndex === index
        ? { ...entry, value: isFamilyProduction ? String(value || "").replace(/\D/g, "").slice(0, 9) : normalizePhoneInput(value) }
        : entry)
    }));
  };

  const addContact = (field, type) => {
    setForm((current) => ({
      ...current,
      [field]: [...current[field], { type, value: "" }]
    }));
  };

  const removeContact = (field, index) => {
    setForm((current) => ({
      ...current,
      [field]: current[field].filter((_, entryIndex) => entryIndex !== index)
    }));
  };

  const toggleCategory = (id) => {
    const exists = form.selectedCategories.includes(id);
    if (!exists && maxCategories > 0 && form.selectedCategories.length >= maxCategories) {
      setError(`الحد الأقصى لهذه الخطة هو ${maxCategories} تصنيفات.`);
      return;
    }
    setError("");
    setForm((prev) => ({
      ...prev,
      selectedCategories: exists ? prev.selectedCategories.filter((catId) => catId !== id) : [...prev.selectedCategories, id]
    }));
  };

  const next = () => {
    setError("");
    const coordinates = parseMapCoordinates(form.lat, form.lng);
    if (!coordinates.valid) {
      setError(coordinates.error);
      return;
    }
    if (plans.length === 0) {
      setError("لا توجد خطط متجر متاحة الآن. تواصل مع الإدارة أو حاول لاحقًا.");
      return;
    }
    if (step === 1 && !selectedPlanId) {
      setError("اختر خطة المتجر أولاً");
      return;
    }
    if (step === 2) {
      if (!form.storeName.trim() || !selectedActivity) {
        setError("اسم المتجر ونوعه مطلوبان");
        return;
      }
      if (!lockedIdentity && !isValidStoreSlug(form.storeSlug)) {
        setError("أدخل نطاقًا إنجليزيًا صالحًا يتكون من أحرف صغيرة أو أرقام وشرطة بين الكلمات.");
        return;
      }
      if (!lockedIdentity && slugAvailability?.slug !== form.storeSlug) {
        setError("انتظر حتى يكتمل التحقق من توفر النطاق.");
        return;
      }
      if (!lockedIdentity && !slugAvailability.available) {
        setError("هذا النطاق مستخدم بالفعل. اختر نطاقًا آخر.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.notificationEmail.trim())) {
        setError("أدخل بريدًا إلكترونيًا صالحًا لاستقبال إشعارات الطلبات.");
        return;
      }
      if (!supportsMultipleContacts && (form.phones.length > 1 || form.whatsapp.length > 1)) {
        setError("الخطة المختارة تسمح برقم هاتف واحد ورقم واتساب واحد فقط.");
        return;
      }
      if (isFamilyProduction) {
        const contactNumbers = [...form.phones, ...form.whatsapp];
        if (!form.phones.length || !form.whatsapp.length || contactNumbers.some(({ value }) => !/^\d{9}$/.test(value))) {
          setError("أدخل رقم هاتف ورقم واتساب، ويتكون كل رقم من 9 أرقام.");
          return;
        }
      }
      if (!form.governorateId) {
        setError("اختر المحافظة أولاً");
        return;
      }
      if (!form.cityId && (!cityIsOther || !customCity.trim())) {
        setError("اختر المدينة أو اختر أخرى واكتب اسمها");
        return;
      }
    }
    if (step === 3) {
      if (form.selectedCategories.length === 0) {
        setError("اختر تصنيفات المتجر على الأقل");
        return;
      }
      if (maxCategories > 0 && form.selectedCategories.length > maxCategories) {
        setError(`الحد الأقصى لهذه الخطة هو ${maxCategories} تصنيفات.`);
        return;
      }
    }
    setDraftStarted(true);
    setStep((prev) => prev + 1);
  };

  const submit = async () => {
    const coordinates = parseMapCoordinates(form.lat, form.lng);
    if (!coordinates.valid) {
      setError(coordinates.error);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.notificationEmail.trim())) {
      setError("أدخل بريدًا إلكترونيًا صالحًا لاستقبال إشعارات الطلبات.");
      return;
    }
    if (Number(selectedPlan?.price || 0) > 0 && (bankLoadError || banks.length === 0)) {
      setError(bankLoadError || "لا توجد حسابات بنكية معتمدة متاحة للدفع حاليًا.");
      return;
    }
    if (Number(selectedPlan?.price || 0) > 0 && !receipt) {
      setError("أرفق سند الدفع قبل إرسال الطلب.");
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const savedDraft = draftStarted
        ? await draftAction.persist(step, draftData, { planId: selectedPlanId || null })
        : null;
      const draftActionId = savedDraft?._id || draftAction.draftId;
      const payload = new FormData();
      payload.append("storeType", storeType);
      payload.append("planId", selectedPlanId);
      payload.append("storeName", form.storeName);
      payload.append("slug", form.storeSlug);
      payload.append("activityKey", form.activityKey);
      payload.append("description", form.description);
      payload.append("location", form.location);
      payload.append("phone", form.phones?.[0]?.value || form.phone || "");
      payload.append("email", form.email);
      payload.append("notificationEmail", form.notificationEmail.trim());
      if (form.governorateId) payload.append("governorateId", form.governorateId);
      if (form.cityId) payload.append("cityId", form.cityId);
      if (cityIsOther && customCity.trim()) payload.append("customCityName", customCity.trim());
      if (coordinates.lat !== null) {
        payload.append("lat", String(coordinates.lat));
        payload.append("lng", String(coordinates.lng));
      }
      if (form.phones?.length) payload.append("phones", JSON.stringify(form.phones));
      if (form.whatsapp?.length) payload.append("whatsapp", JSON.stringify(form.whatsapp));
      payload.append("selectedCategories", JSON.stringify(form.selectedCategories || []));
      if (receipt) payload.append("paymentReceipt", receipt);
      if (draftActionId) payload.append("draftActionId", draftActionId);

      const res = await api.post("/stores", payload, { headers: { "Content-Type": "multipart/form-data" } });
      submissionCompletedRef.current = true;
      if (draftActionId) draftAction.removeDraft(draftActionId);
      draftAction.clear();
      setSuccess(isFamilyProduction
        ? "تم إرسال طلب صناعات سوقك بنجاح وهو قيد المراجعة"
        : "تم إرسال طلب المتجر بنجاح وهو قيد المراجعة");
      setTimeout(() => navigate("/seller/subscriptions"), 1200);
      if (res.data?.purchaseRequest) {
        console.log("store request created", res.data.purchaseRequest._id);
      }
    } catch (err) {
      setError(err.response?.data?.error || (isFamilyProduction ? "فشل إرسال طلب صناعات سوقك" : "فشل إنشاء متجر جديد"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`max-w-5xl mx-auto px-4 py-6 space-y-6 ${((step === 1 && selectedPlanId) || step > 1) ? "pb-32 md:pb-24" : ""}`}>
      <div className="rounded-3xl bg-white border border-gray-100 p-5 shadow-sm">
        <h1 className="text-2xl font-black text-gray-900">{isFamilyProduction ? "التسجيل في صناعات سوقك" : "إنشاء متجر"}</h1>
        <p className="text-sm text-gray-500 mt-1">الخطوة {step} من 4</p>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {draftAction.error && <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{draftAction.error}</div>}
      {resumedDraft && step === 4 && Number(selectedPlan?.price || 0) > 0 && (
        <p className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-800">
          أعد رفع سند الدفع للمتابعة؛ لا تُحفظ الملفات ضمن العمليات غير المكتملة.
        </p>
      )}
      {success && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{success}</div>}
      {loadError && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">{loadError}</div>}

      {step === 1 && (
        plans.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-3xl">{isFamilyProduction ? "🧺" : "🏪"}</div>
            <h2 className="text-xl font-black text-gray-900">{isFamilyProduction ? "لا توجد باقات لصناعات سوقك متاحة حاليًا" : "لا توجد خطط متجر متاحة حاليًا"}</h2>
            <p className="mt-3 text-sm text-gray-600">يرجى إعادة المحاولة لاحقًا أو التواصل مع الإدارة.</p>
            <button type="button" onClick={() => navigate("/account")} className="mt-5 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white">العودة إلى حسابي</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-4" dir="rtl">
            {plans.map((plan) => {
              const design = STORE_PLAN_DESIGNS[plan.designStyle] || STORE_PLAN_DESIGNS.normal;
              const isSelected = selectedPlanId === plan._id;
              return (
                <button
                  key={plan._id}
                  onClick={() => {
                    setSelectedPlanId(plan._id);
                    setDraftStarted(true);
                  }}
                  className={`group relative isolate flex h-full flex-col overflow-hidden rounded-2xl border px-3 pt-4 pb-3 text-right transition duration-300 hover:-translate-y-1 sm:rounded-[1.75rem] sm:px-5 sm:pt-5 ${design.card} ${isSelected ? "ring-2 ring-blue-500 ring-offset-2" : ""}`}
                >
                  <div className={`absolute inset-x-0 top-0 h-1 ${design.accent}`} />
                  {plan.designStyle === "professional" && <div className="pointer-events-none absolute -left-10 -top-12 -z-10 h-36 w-36 rounded-full bg-violet-400/20 blur-2xl" />}
                  <div className="mb-4 flex flex-wrap items-center gap-2 pt-1">
                    {plan.designStyle === "free" && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-900 shadow-sm sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs">
                        <span aria-hidden="true" className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-700 text-[9px] text-white sm:h-4 sm:w-4 sm:text-[10px]">✓</span>
                        الباقة المجانية
                      </span>
                    )}
                    {plan.isMostPopular && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400 bg-gradient-to-l from-amber-300 to-yellow-200 px-2 py-1 text-[10px] font-black text-amber-950 shadow-sm sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs">
                        <span aria-hidden="true">★</span>
                        الأكثر طلبًا
                      </span>
                    )}
                  </div>
                  <div className="mb-4 flex items-start justify-between gap-1.5 sm:mb-5 sm:gap-2">
                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-black tracking-wide sm:h-11 sm:w-11 sm:rounded-2xl sm:text-xs ${design.iconStyle}`}>{design.icon}</span>
                      <div>
                        <h3 className={`mt-0.5 break-words text-sm font-black sm:text-lg ${design.titleStyle}`}>{plan.name}</h3>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className={`rounded-full px-2 py-1 text-[9px] font-bold sm:px-2.5 sm:text-[10px] ${design.chipStyle}`}>{plan.durationInDays} يوم</span>
                    </div>
                  </div>
                  {(plan.cardTagline || plan.description) && <p className={`mb-3 text-[11px] leading-5 sm:mb-4 sm:min-h-10 sm:text-xs sm:leading-6 ${design.textStyle}`}>{plan.cardTagline || plan.description}</p>}
                  <div className={`flex flex-wrap items-baseline gap-x-1 border-b border-current/10 pb-3 text-xl font-black sm:pb-4 sm:text-2xl ${design.priceStyle}`}>
                    {Number(plan.price || 0) === 0
                      ? <span>مجانًا</span>
                      : <>
                        <span>{Number(plan.price).toLocaleString("ar-EG")}</span>
                        <span className={`text-[9px] font-bold sm:text-xs ${design.textStyle}`}>{getStoreCurrencyLabel(plan.currency)}</span>
                      </>}
                  </div>
                  <ul className={`mt-3 grid grid-cols-2 content-start gap-x-2 gap-y-2 text-[10px] leading-4 sm:mt-4 sm:gap-x-3 sm:text-xs sm:leading-5 ${design.textStyle}`}>
                    {(plan.cardHighlights?.length ? plan.cardHighlights : [
                      isFamilyProduction ? "واجهة مشروع أساسية" : "واجهة متجر أساسية",
                      ...getEnabledStorePlanFeatures(plan).map((feature) => {
                      const labels = {
                        dynamicAttributes: "الخصائص الديناميكية",
                        cart: "السلة",
                        orders: "الطلبات",
                        whatsappOrdering: "الطلب عبر واتساب",
                        delivery: "التوصيل",
                        discounts: "الخصومات",
                        inventory: "إدارة المخزون",
                        customization: "التخصيص",
                        advancedCustomization: "التخصيص المتقدم",
                        pwa: "تطبيق ويب",
                        analytics: "الإحصائيات",
                        multipleContacts: "اتصالات متعددة",
                        notifications: "الإشعارات"
                      };
                      return labels[feature] || feature;
                      }),
                      `حد التصنيفات: ${plan.limits?.maxCategories > 0 ? plan.limits.maxCategories : "غير محدود"}`,
                      `حد المنتجات: ${plan.limits?.maxProducts > 0 ? plan.limits.maxProducts : "غير محدود"}`
                    ]).map((highlight, index) => (
                      <li key={`${plan._id}-highlight-${index}`} className="flex min-w-0 items-start gap-1.5 sm:gap-2">
                        <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-black ${plan.designStyle === "professional" ? "bg-emerald-300/20 text-emerald-200" : "bg-emerald-100 text-emerald-700"}`}>✓</span>
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>
                  <div className={`mt-auto flex items-center justify-center rounded-xl border px-2 py-2.5 text-[10px] font-black sm:px-3 ${design.actionStyle}`}>
                    <span>{isSelected ? "تم الاختيار ✓" : "اختر الباقة ←"}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )
      )}

      {step === 2 && (
        <div className="space-y-4" dir="rtl">
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <h2 className="text-base font-black text-slate-900">معلومات المتجر</h2>
            <label className="block text-sm font-bold text-slate-700">
              {isFamilyProduction ? "اسم المشروع" : "اسم المتجر"}
              <input
                value={form.storeName}
                disabled={Boolean(lockedIdentity)}
                onChange={(e) => setForm((current) => ({
                  ...current,
                  storeName: e.target.value,
                  storeSlug: current.storeSlug === slugifyStoreName(current.storeName)
                    ? slugifyStoreName(e.target.value)
                    : current.storeSlug
                }))}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base disabled:bg-slate-100 disabled:text-slate-600"
                autoComplete="organization"
              />
            </label>
            <label className="block text-sm font-bold text-slate-700">
              {isFamilyProduction ? "نوع الحرفة أو الصناعة" : "نوع المتجر"}
              <select value={form.activityKey} disabled={Boolean(lockedIdentity)} onChange={(e) => setForm((current) => ({ ...current, activityKey: e.target.value, selectedCategories: [] }))} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base disabled:bg-slate-100 disabled:text-slate-600">
                <option value="">{isFamilyProduction ? "اختر نوع النشاط" : "اختر نوع المتجر"}</option>
                {activities.map((activity) => <option key={activity.activityKey} value={activity.activityKey}>{activity.nameAr}</option>)}
              </select>
              {selectedActivity && <p className="mt-2 text-xs font-medium text-slate-500">{selectedActivity.description}</p>}
            </label>
            <label className="block text-sm font-bold text-slate-700 md:col-span-2">
              نطاقك
              <div className="mt-2 flex items-center overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-blue-500" dir="ltr">
                <span className="shrink-0 border-r border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">/store/</span>
                <input
                  aria-label="نطاق المتجر"
                  autoCapitalize="none"
                  autoComplete="off"
                  disabled={Boolean(lockedIdentity)}
                  maxLength={60}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  value={form.storeSlug}
                  onChange={(event) => {
                    const value = event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-/, "");
                    setForm((current) => ({ ...current, storeSlug: value }));
                  }}
                  className="min-w-0 flex-1 px-3 py-3 text-base outline-none disabled:bg-slate-100 disabled:text-slate-600"
                  placeholder="matjar-albamasaq"
                  required
                />
              </div>
              <p className="mt-2 text-xs font-medium text-slate-500">أحرف إنجليزية صغيرة وأرقام، واستخدم الشرطة بين الكلمات. بعد إرسال الطلب لن تتمكن من تغييره.</p>
              {form.storeSlug && <p className="mt-1 break-all text-sm font-bold text-slate-700" dir="ltr">{window.location.origin}/store/{form.storeSlug}</p>}
              {!lockedIdentity && slugAvailability?.slug === form.storeSlug && (
                <p role="status" className={`mt-1 text-xs font-bold ${slugAvailability.available ? "text-emerald-700" : "text-rose-700"}`}>
                  {slugAvailability.available ? "النطاق متاح" : "النطاق مستخدم، اختر نطاقًا آخر"}
                </p>
              )}
              {slugAvailabilityError && !lockedIdentity && <p role="alert" className="mt-1 text-xs font-bold text-amber-700">{slugAvailabilityError}</p>}
            </label>
            <label className="block text-sm font-bold text-slate-700">
              وصف المتجر
              <textarea value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} rows={4} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base" />
            </label>
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div>
              <h2 className="text-base font-black text-slate-900">موقع المتجر</h2>
              <p className="mt-1 text-sm text-slate-500">اختر المحافظة والمدينة لعرض {isFamilyProduction ? "مشروعك" : "متجرك"} في موقعه الصحيح.</p>
            </div>
            <label className="block text-sm font-bold text-slate-700">
              المحافظة
              <select value={form.governorateId || ""} onChange={(e) => {
                setCityIsOther(false);
                setCustomCity("");
                setForm((current) => ({ ...current, governorateId: e.target.value, cityId: "" }));
              }} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base">
                <option value="">اختر المحافظة</option>
                {(governorates || []).map((governorate) => <option key={governorate._id} value={governorate._id}>{governorate.name}</option>)}
              </select>
            </label>
            <label className="block text-sm font-bold text-slate-700">
              المدينة
              <select value={cityIsOther ? "other" : form.cityId || ""} onChange={(e) => {
                const isOther = e.target.value === "other";
                setCityIsOther(isOther);
                if (!isOther) setCustomCity("");
                setForm((current) => ({ ...current, cityId: isOther ? "" : e.target.value }));
              }} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base" disabled={!form.governorateId}>
                <option value="">{form.governorateId ? "اختر المدينة" : "اختر المحافظة أولاً"}</option>
                {(cities || []).map((city) => <option key={city._id} value={city._id}>{city.name}</option>)}
                {form.governorateId && <option value="other">أخرى</option>}
              </select>
            </label>
            {cityIsOther && (
              <label className="block text-sm font-bold text-slate-700">
                اسم المدينة
                <input value={customCity} onChange={(e) => setCustomCity(e.target.value)} placeholder="اكتب اسم المدينة" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base" autoFocus />
              </label>
            )}
            <label className="block text-sm font-bold text-slate-700">
              العنوان أو وصف الموقع (اختياري)
              <input value={form.location} onChange={(e) => setForm((current) => ({ ...current, location: e.target.value }))} placeholder="مثال: شارع الجامعة، بجانب السوق" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base" />
            </label>
            <div className="rounded-xl border border-sky-100 bg-sky-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-black text-slate-900">الموقع الدقيق على الخريطة (اختياري)</p>
                  <p className="mt-1 text-sm text-slate-600">حدد النقطة يدويًا عند الحاجة، أو أكمل الطلب دون تحميل الخريطة.</p>
                </div>
                <button type="button" onClick={() => setMapOpen(true)} className="shrink-0 rounded-xl bg-sky-700 px-4 py-3 text-sm font-black text-white">
                  {form.lat && form.lng ? "تعديل الموقع على الخريطة" : "تحديد الموقع على الخريطة"}
                </button>
              </div>
              {form.lat && form.lng && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/80 px-3 py-2">
                  <p className="text-xs font-bold text-slate-600" dir="ltr">{Number(form.lat).toFixed(6)}, {Number(form.lng).toFixed(6)}</p>
                  <button type="button" onClick={() => setForm((current) => ({ ...current, lat: "", lng: "" }))} className="text-sm font-bold text-red-700 underline underline-offset-2">إزالة الموقع</button>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div>
              <h2 className="text-base font-black text-slate-900">التواصل</h2>
              <p className="mt-1 text-sm text-slate-500">ستظهر هذه الأرقام في صفحة {isFamilyProduction ? "المشروع" : "المتجر"}{isFamilyProduction ? "، ويجب أن يتكون كل رقم من 9 أرقام." : "."}</p>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-black text-slate-700">أرقام التواصل</h3>
              {form.phones.map((contact, index) => (
                <div key={`phone-${index}`} className="flex gap-2">
                  <input type="tel" inputMode={isFamilyProduction ? "numeric" : "tel"} autoComplete="tel" maxLength={isFamilyProduction ? 9 : undefined} value={contact.value} onChange={(e) => updateContact("phones", index, e.target.value)} placeholder={isFamilyProduction ? "9 أرقام" : "رقم الهاتف"} aria-label={`رقم التواصل ${index + 1}`} className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-base" />
                  <button type="button" onClick={() => removeContact("phones", index)} aria-label={`حذف رقم التواصل ${index + 1}`} className="rounded-xl border border-slate-300 px-3 text-sm font-bold text-slate-600">حذف</button>
                </div>
              ))}
              {supportsMultipleContacts && form.phones.length < 5 && <button type="button" onClick={() => addContact("phones", "mobile")} className="rounded-lg px-1 py-2 text-sm font-black text-sky-800">+ إضافة رقم آخر</button>}
            </div>

            <div className="space-y-3 border-t border-slate-100 pt-4">
              <h3 className="text-sm font-black text-slate-700">أرقام واتساب</h3>
              {form.whatsapp.map((contact, index) => (
                <div key={`whatsapp-${index}`} className="flex gap-2">
                  <input type="tel" inputMode={isFamilyProduction ? "numeric" : "tel"} maxLength={isFamilyProduction ? 9 : undefined} value={contact.value} onChange={(e) => updateContact("whatsapp", index, e.target.value)} placeholder={isFamilyProduction ? "9 أرقام" : "رقم واتساب"} aria-label={`رقم واتساب ${index + 1}`} className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-base" />
                  <button type="button" onClick={() => removeContact("whatsapp", index)} aria-label={`حذف رقم واتساب ${index + 1}`} className="rounded-xl border border-slate-300 px-3 text-sm font-bold text-slate-600">حذف</button>
                </div>
              ))}
              {supportsMultipleContacts && form.whatsapp.length < 5 && <button type="button" onClick={() => addContact("whatsapp", "whatsapp")} className="rounded-lg px-1 py-2 text-sm font-black text-emerald-800">+ إضافة رقم واتساب آخر</button>}
            </div>

            <label className="block text-sm font-bold text-slate-700">
              بريد إشعارات الطلبات (مطلوب وخاص)
              <input type="email" autoComplete="email" required value={form.notificationEmail} onChange={(e) => setForm((current) => ({ ...current, notificationEmail: e.target.value }))} placeholder="أدخل البريد الخاص بإشعارات الطلبات" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base" />
            </label>
            <label className="block text-sm font-bold text-slate-700">
              بريد التواصل العام (اختياري، يظهر للزوار)
              <input type="email" autoComplete="email" value={form.email} onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))} placeholder="أدخل البريد الإلكتروني" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base" />
            </label>
          </section>
        </div>
      )}

      {step === 3 && (
        categories.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-black text-gray-900">لا توجد تصنيفات متاحة حاليًا</h2>
            <p className="mt-3 text-sm text-gray-600">ستظهر التصنيفات هنا بمجرد توفرها في النظام.</p>
          </div>
        ) : (
          <div className="rounded-3xl bg-white border border-gray-200 p-5">
            <h2 className="text-xl font-black mb-2">اختيار التصنيفات</h2>
            <p className="mb-4 text-sm text-slate-500">الحد: {maxCategories > 0 ? maxCategories : "غير محدود"} · المحدد: {form.selectedCategories.length}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activityCategoryOptions.map((cat) => (
                <button
                  key={cat._id}
                  type="button"
                  onClick={() => toggleCategory(cat._id)}
                  className={`rounded-2xl border p-3 text-right ${form.selectedCategories.includes(cat._id) ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-gray-50"}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )
      )}

      {mapOpen && <Suspense fallback={<div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/70 p-4 text-sm font-bold text-white">جارٍ تحميل الخريطة...</div>}>
        <MapLocationPicker
          initialLocation={{ lat: form.lat, lng: form.lng }}
          onClose={() => setMapOpen(false)}
          onConfirm={({ lat, lng }) => {
            setForm((current) => ({ ...current, lat: String(lat), lng: String(lng) }));
            setMapOpen(false);
          }}
          title={`حدد موقع ${isFamilyProduction ? "المشروع" : "المتجر"} على الخريطة`}
        />
      </Suspense>}

      {step === 4 && (
        <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-l from-blue-50 via-white to-white px-5 py-5 sm:px-8 sm:py-7">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 5h8m-8 4h8m-8 4h5m-8 7h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-xs font-black text-blue-700">الخطوة الأخيرة</p>
                <h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">{isFamilyProduction ? "مراجعة طلب صناعات سوقك" : "مراجعة الطلب"}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {isPaidPlan ? "تأكد من بياناتك وأرفق إيصال الدفع لإرسال الطلب للمراجعة." : "تأكد من بياناتك قبل إرسال الطلب للمراجعة."}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6 p-4 sm:p-8">
            <section aria-label="ملخص بيانات الطلب">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-black text-slate-900">ملخص الطلب</h3>
                <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${isPaidPlan ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}>
                  {isPaidPlan ? "باقة مدفوعة" : "باقة مجانية"}
                </span>
              </div>
              <dl className="grid gap-3 sm:grid-cols-2">
                {[
                  ["الخطة", selectedPlan?.name || "—"],
                  ...(isPaidPlan ? [["السعر", `${Number(selectedPlan?.price || 0).toLocaleString("ar-EG")} ${getStoreCurrencyLabel(selectedPlan?.currency)}`]] : []),
                  ["المدة", `${selectedPlan?.durationInDays || "—"} يوم`],
                  [isFamilyProduction ? "اسم المشروع" : "اسم المتجر", form.storeName || "—"],
                  [isFamilyProduction ? "نوع الحرفة/الصناعة" : "نوع المتجر", selectedActivity?.nameAr || "—"],
                  ["المحافظة", governorates.find((g) => g._id === form.governorateId)?.name || customCity || "—"],
                  ["المدينة", cities.find((c) => c._id === form.cityId)?.name || customCity || "—"],
                  ...(isFamilyProduction ? [
                    ["الهاتف", form.phones.map(({ value }) => value).filter(Boolean).join("، ") || "—"],
                    ["واتساب", form.whatsapp.map(({ value }) => value).filter(Boolean).join("، ") || "—"],
                    ["التصنيفات", flattenCategories(categories).filter((category) => form.selectedCategories.includes(category._id)).map((category) => category.name).join("، ") || "—"],
                    ...(form.location ? [["العنوان", form.location]] : []),
                    ...(form.lat && form.lng ? [["الإحداثيات", `${form.lat}, ${form.lng}`]] : [])
                  ] : [])
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                    <dt className="text-xs font-bold text-slate-500">{label}</dt>
                    <dd className="mt-1 break-words text-sm font-black leading-6 text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
              {isFamilyProduction && form.description && (
                <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                  <p className="text-xs font-bold text-slate-500">وصف المشروع</p>
                  <p className="mt-1 whitespace-pre-line break-words text-sm font-bold leading-6 text-slate-900">{form.description}</p>
                </div>
              )}
            </section>

            {isPaidPlan && (
              <section className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/40 p-4 sm:p-5">
                <div>
                  <h3 className="font-black text-slate-900">الحسابات البنكية المعتمدة</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">حوّل قيمة الباقة إلى أحد الحسابات التالية ثم أرفق الإيصال.</p>
                </div>
                {bankLoadError ? (
                  <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{bankLoadError}</p>
                ) : banks.length ? <BankAccountsDisplay banks={banks} /> : (
                  <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">لا يمكن إرسال طلب مدفوع قبل توفر حساب بنكي معتمد.</p>
                )}
              </section>
            )}
            {isPaidPlan && (
              <section>
                <label htmlFor="store-payment-receipt" className="mb-2 block text-sm font-black text-slate-900">إيصال الدفع <span className="text-slate-400">(مطلوب)</span></label>
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 transition hover:border-blue-400 hover:bg-blue-50/40 sm:p-4">
                  <input id="store-payment-receipt" type="file" accept="image/*,.pdf" onChange={(e) => setReceipt(e.target.files?.[0] || null)} className="block w-full cursor-pointer text-sm font-semibold text-slate-600 file:ml-3 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-2.5 file:font-black file:text-white hover:file:bg-blue-700" />
                  {receipt ? (
                    <p className="mt-3 flex items-center gap-2 break-all text-xs font-bold text-emerald-700">
                      <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100">✓</span>
                      {receipt.name}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs leading-5 text-slate-500">الملفات المقبولة: الصور أو PDF. إرفاق الإيصال مطلوب لمراجعة الطلب.</p>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      )}

      {step > 1 && (
        <div className="hidden justify-between gap-4 md:flex">
          <button type="button" onClick={() => setStep((prev) => Math.max(1, prev - 1))} className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">السابق</button>
          {step < 4 ? (
            <button type="button" onClick={next} className="rounded-xl bg-blue-600 px-7 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700">التالي</button>
          ) : (
            <button type="button" onClick={submit} disabled={loading} className="rounded-xl bg-emerald-600 px-7 py-3 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? "جارٍ الإرسال..." : "إرسال الطلب"}
            </button>
          )}
        </div>
      )}
      {step === 1 && selectedPlanId && (
        <div className="fixed inset-x-0 bottom-5 z-[60] hidden px-4 md:block">
          <div className="mx-auto flex max-w-7xl justify-end rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur-lg">
            <button type="button" onClick={next} className="rounded-xl bg-blue-600 px-7 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700">
              التالي
            </button>
          </div>
        </div>
      )}
      {((step === 1 && selectedPlanId) || step > 1) && (
        <div className="fixed inset-x-0 bottom-20 z-[60] px-4 md:hidden">
          <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur-lg">
            {step === 1 ? (
              <>
                <p className="min-w-0 flex-1 truncate text-xs font-bold text-slate-600">
                  الباقة المختارة: <span className="font-black text-slate-900">{selectedPlan?.name}</span>
                </p>
                <button type="button" onClick={next} className="shrink-0 rounded-xl bg-blue-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700">
                  التالي
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setStep((prev) => Math.max(1, prev - 1))} className="shrink-0 rounded-xl border border-slate-200 bg-slate-100 px-5 py-3 text-sm font-black text-slate-700">
                  السابق
                </button>
                {step < 4 ? (
                  <button type="button" onClick={next} className="flex-1 rounded-xl bg-blue-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700">
                    التالي
                  </button>
                ) : (
                  <button type="button" onClick={submit} disabled={loading} className="flex-1 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-emerald-600/20 disabled:opacity-60">
                    {loading ? "جارٍ الإرسال..." : "إرسال الطلب"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
