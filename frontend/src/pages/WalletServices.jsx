import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useApi } from "../api/axios.js";
import { useAuth } from "../store/AuthContext.jsx";
import { useDraftAction } from "../hooks/useDraftActions.js";
import { normalizeProtectedFilePath, useProtectedFiles } from "../lib/protectedFiles.js";
import { getWalletServiceCategoryPath, getWalletServicesPath } from "../lib/walletServicesNavigation.js";
import DocumentPreviewModal from "../components/DocumentPreviewModal.jsx";
import { confirmUntrustedExternalLink, getExternalLinkHost } from "../utils/untrustedExternalLink.js";
import { clearWalletServiceIdempotencyKey, getWalletServiceIdempotencyKey } from "../lib/walletServiceIdempotency.js";
import { findWalletServiceDrafts } from "../lib/walletServiceDrafts.js";
import { uploadsUrl } from "../lib/uploads.js";
import IncompleteActions from "../components/IncompleteActions.jsx";
import DigitalServiceForm from "../components/DigitalServiceForm.jsx";
import { getVisibleDigitalServiceAnswers, hasRequiredDigitalServiceAnswers } from "../lib/digitalServiceForm.js";
import CurrencyCalculator from "../components/CurrencyCalculator.jsx";

const CURRENCIES = {
  USD: "دولار أمريكي",
  SAR: "ريال سعودي",
  YER_ADEN: "ريال يمني (عدن)",
  YER_SANAA: "ريال يمني (صنعاء)"
};

const STATUS_LABELS = {
  CUSTOM_QUOTE_PENDING: "بانتظار تسعير الإدارة",
  QUOTE_OFFERED: "عرض السعر بانتظار موافقتك",
  AWAITING_PAYMENT: "بانتظار إرفاق سند الدفع",
  PAYMENT_REVIEW: "سند الدفع قيد المراجعة",
  PAYMENT_NEEDS_CORRECTION: "بحاجة إلى سند أوضح",
  IN_PROGRESS: "جارٍ تنفيذ الطلب",
  COMPLETED: "مكتمل",
  REJECTED: "مرفوض"
};

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white";

function getMatchingFee(amount, currency, feeBands) {
  const band = feeBands.find((item) =>
    item.currency === currency && amount >= item.minimumAmount && amount <= item.maximumAmount
  );
  return band ? band.feeAmount : null;
}

function servicePrice(service, section, selectedPackage, quantity) {
  if (!service) return 0;
  if (service.pricingType === "PACKAGE") return Number(selectedPackage?.price || 0);
  if (service.pricingType === "FIXED") return Number(service.unitPrice || 0);
  return Number(section?.unitPrice ?? service.unitPrice ?? 0) * quantity;
}

function getServiceTypeLabel(type) {
  return ({
    AI_TOOL: "أدوات الذكاء الاصطناعي",
    GAME_TOPUP: "الألعاب وشحن الألعاب",
    SOFTWARE: "البرامج والتطبيقات",
    ENTERTAINMENT: "الترفيه والمنصات",
    DIGITAL_CARD: "البطاقات الرقمية",
    OTHER: "خدمات رقمية أخرى"
  })[type] || "خدمات رقمية";
}

export default function WalletServices() {
  const api = useApi();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { serviceId: routeServiceId, categorySlug } = useParams();
  const { user } = useAuth();
  const userId = user?._id || user?.id;
  const [searchParams, setSearchParams] = useSearchParams();
  const draftAction = useDraftAction(api, userId, "wallet_service_catalog");
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [feeBands, setFeeBands] = useState([]);
  const [orders, setOrders] = useState([]);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [serviceSnapshot, setServiceSnapshot] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [serviceSearch, setServiceSearch] = useState(() => searchParams.get("serviceSearch") || "");
  const [sectionId, setSectionId] = useState("");
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [serviceVersion, setServiceVersion] = useState(null);
  const [formSchemaVersion, setFormSchemaVersion] = useState(null);
  const [answers, setAnswers] = useState({});
  const [customerInfo, setCustomerInfo] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [customForm, setCustomForm] = useState({ serviceName: "", serviceUrl: "", whatsappNumber: "", customerNotes: "" });
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [referencesLoaded, setReferencesLoaded] = useState(false);
  const [draftStarted, setDraftStarted] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState(null);
  const [resumeNeedsCustomerInfo, setResumeNeedsCustomerInfo] = useState(false);
  const submissionCompletedRef = useRef(false);
  const isCustomOrderPage = pathname === "/wallet-services/custom-order";
  const isMyOrdersPage = pathname === "/wallet-services/my-orders";
  const isOrderPage = Boolean(routeServiceId) || isCustomOrderPage;
  const { urls: protectedFileUrls, contentTypes: protectedFileContentTypes, errors: protectedFileErrors, loading: protectedFilesLoading } = useProtectedFiles(api, [previewDoc]);
  const previewUrl = protectedFileUrls[normalizeProtectedFilePath(previewDoc)] || null;

  useEffect(() => {
    setServiceSearch(searchParams.get("serviceSearch") || "");
  }, [searchParams]);

  const updateServiceSearch = (value) => {
    setServiceSearch(value);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set("serviceSearch", value);
      else next.delete("serviceSearch");
      return next;
    }, { replace: true });
  };

  const loadData = async () => {
    setError("");
    try {
      const [catalogRes, orderRes, categoriesRes] = await Promise.all([
        api.get("/wallet-services"),
        api.get("/wallet-services/mine/orders"),
        api.get("/wallet-services/categories")
      ]);
      setServices(catalogRes.data?.services || []);
      setFeeBands(catalogRes.data?.feeBands || []);
      setOrders(orderRes.data || []);
      setCategories(categoriesRes.data || []);
    } catch (loadError) {
      setError(loadError.response?.data?.error || "تعذر تحميل خدمات الدفع.");
    } finally {
      setLoading(false);
      setReferencesLoaded(true);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!referencesLoaded || !routeServiceId || searchParams.has("draftActionId")) return;
    const service = services.find((item) => item._id === routeServiceId);
    if (!service) {
      setError("الخدمة المطلوبة غير متاحة حاليًا.");
      return;
    }
    if (selectedId === service._id) return;

    let cancelled = false;
    draftAction.clear();
    setDraftStarted(false);
    setDraftPrompt(null);
    setError("");
    const startServiceOrder = () => {
      draftAction.clear();
      setDraftPrompt(null);
      setSelectedId(service._id);
      setServiceSnapshot(null);
      setSectionId("");
      setSelectedPackageId("");
      setQuantity(service.pricingType === "UNIT" && service.minimumQuantityEnabled !== false ? service.minimumQuantity : 1);
      setServiceVersion(Number(service.serviceVersion || 1));
      setFormSchemaVersion(Number(service.formSchemaVersion || 1));
      setAnswers({});
      setWhatsappNumber("");
      setCustomerInfo("");
      setCustomerNotes("");
      setResumeNeedsCustomerInfo(false);
      setDraftStarted(true);
    };

    if (!userId) {
      startServiceOrder();
      return () => { cancelled = true; };
    }

    api.get("/draft-actions").then((response) => {
      if (cancelled) return;
      const { matchingDraft } = findWalletServiceDrafts(response.data, service._id);
      if (matchingDraft) {
        setDraftPrompt({ draft: matchingDraft, service });
        return;
      }
      startServiceOrder();
    }).catch((draftError) => {
      if (!cancelled) {
        startServiceOrder();
        setError(draftError.response?.data?.error || "تعذر التحقق من طلباتك غير المكتملة.");
      }
    });

    return () => { cancelled = true; };
  }, [api, draftAction.clear, referencesLoaded, routeServiceId, searchParams, selectedId, services, setSearchParams, userId]);

  const resumeSuggestedDraft = () => {
    if (!draftPrompt) return;
    setDraftPrompt(null);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("draftActionId", draftPrompt.draft._id);
      return next;
    }, { replace: true });
  };

  const startNewOrder = () => {
    if (!draftPrompt) return;
    const service = draftPrompt.service;
    setDraftPrompt(null);
    draftAction.clear();
    setSelectedId(service._id);
    setServiceSnapshot(null);
    setSectionId("");
    setSelectedPackageId("");
    setQuantity(service.pricingType === "UNIT" && service.minimumQuantityEnabled !== false ? service.minimumQuantity : 1);
    setServiceVersion(Number(service.serviceVersion || 1));
    setFormSchemaVersion(Number(service.formSchemaVersion || 1));
    setAnswers({});
    setWhatsappNumber("");
    setCustomerInfo("");
    setCustomerNotes("");
    setResumeNeedsCustomerInfo(false);
    setDraftStarted(true);
  };

  useEffect(() => {
    if (!referencesLoaded) return;
    if (!categorySlug) {
      setCategoryFilter("");
      return;
    }
    const category = categories.find((item) => item.slug === categorySlug);
    if (!category) {
      setCategoryFilter("missing-category");
      setError("التصنيف المطلوب غير متاح حاليًا.");
      return;
    }
    setCategoryFilter(category._id);
    setError("");
  }, [categories, categorySlug, referencesLoaded]);

  useEffect(() => {
    if (isCustomOrderPage) {
      draftAction.clear();
      setSelectedId("");
      setServiceSnapshot(null);
      setDraftStarted(false);
      setShowCustomForm(true);
    }
  }, [draftAction.clear, isCustomOrderPage]);

  useEffect(() => {
    const draftId = searchParams.get("draftActionId");
    if (!draftId || !referencesLoaded || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const draft = await draftAction.resume(draftId);
        if (cancelled) return;
        const listedService = services.find((item) => item._id === draft.serviceId);
        if (draft.type !== "wallet_service_catalog" || !listedService) {
          throw new Error("هذه العملية لم تعد متاحة بهذه البيانات. يمكنك بدء العملية من جديد.");
        }
        const savedVersion = Number(draft.data?.serviceVersion || listedService.serviceVersion || 1);
        const versionResponse = savedVersion === Number(listedService.serviceVersion || 1)
          ? null
          : await api.get(`/wallet-services/services/${listedService._id}/versions/${savedVersion}`);
        if (cancelled) return;
        const service = versionResponse?.data || listedService;
        const section = service.sections?.find((item) => item._id === draft.sectionId);
        const packageItem = service.packages?.find((item) => item.id === draft.data?.packageId && item.isActive);
        if ((draft.sectionId && !section)
          || (service.pricingType === "UNIT" && service.sections?.length && !section)
          || (service.pricingType === "PACKAGE" && draft.data?.packageId && !packageItem)) {
          throw new Error("تغيرت إعدادات الخدمة المحفوظة في هذه المسودة. ابدأ طلبًا جديدًا.");
        }
        setSelectedId(service._id);
        setServiceSnapshot(versionResponse ? service : null);
        setSectionId(section?._id || "");
        setSelectedPackageId(packageItem?.id || "");
        setQuantity(draft.data?.quantity ?? (service.pricingType === "UNIT" && service.minimumQuantityEnabled !== false ? service.minimumQuantity : 1));
        setServiceVersion(savedVersion);
        setFormSchemaVersion(Number(draft.data?.formSchemaVersion || service.formSchemaVersion || 1));
        setAnswers(draft.data?.answers || {});
        setWhatsappNumber(draft.data?.whatsappNumber || "");
        setCustomerInfo("");
        setCustomerNotes("");
        setResumeNeedsCustomerInfo(Boolean(service.customerInfoLabel));
        setDraftStarted(true);
        navigate(`/wallet-services/order/${service._id}`, { replace: true });
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
  }, [api, draftAction.resume, navigate, referencesLoaded, searchParams, services, setSearchParams, userId]);

  const selectedService = serviceSnapshot || services.find((service) => service._id === selectedId) || null;
  const selectedCatalogCategory = categories.find((category) => String(category._id) === String(selectedService?.categoryId)) || null;
  const listingCategory = categories.find((category) => String(category._id) === String(categoryFilter)) || null;
  const customOrderCategory = categories.find((category) => category.slug === searchParams.get("category")) || null;
  const selectedSection = selectedService?.sections?.find((section) => section._id === sectionId) || null;
  const selectedPackage = selectedService?.packages?.find((item) => item.id === selectedPackageId && item.isActive) || null;
  const quantityNumber = selectedService?.pricingType === "UNIT" ? Number(quantity) : 1;
  const serviceAmount = Math.round((servicePrice(selectedService, selectedSection, selectedPackage, quantityNumber) + Number.EPSILON) * 100) / 100;
  const platformFee = selectedService ? getMatchingFee(serviceAmount, selectedService.currency, feeBands) : null;
  const totalAmount = platformFee == null ? null : Math.round((serviceAmount + platformFee + Number.EPSILON) * 100) / 100;
  const visibleAnswers = useMemo(
    () => getVisibleDigitalServiceAnswers(selectedService?.formSchema || [], answers),
    [answers, selectedService]
  );
  const formAnswersComplete = hasRequiredDigitalServiceAnswers(selectedService?.formSchema || [], visibleAnswers);
  const ownershipConsentRequired = ["SOFTWARE", "ENTERTAINMENT"].includes(selectedService?.serviceType)
    && selectedService.formSchema?.some((field) => field.id === "accountOwnershipConsent" && field.required);
  const ownershipConsentAccepted = !ownershipConsentRequired || visibleAnswers.accountOwnershipConsent === true;
  const draftData = {
    quantity: quantityNumber,
    whatsappNumber,
    packageId: selectedPackageId || "",
    serviceVersion: Number(serviceVersion || selectedService?.serviceVersion || 1),
    formSchemaVersion: Number(formSchemaVersion || selectedService?.formSchemaVersion || 1),
    answers: visibleAnswers
  };

  useEffect(() => {
    if (submissionCompletedRef.current || !draftStarted || !selectedService) return;
    if (selectedService.pricingType === "UNIT"
      && (!Number.isSafeInteger(quantityNumber) || quantityNumber < 1)) return;
    draftAction.scheduleSave(2, draftData, {
      serviceId: selectedService._id,
      sectionId: sectionId || null
    });
  }, [draftAction.scheduleSave, draftData, draftStarted, quantityNumber, sectionId, selectedService]);

  const filteredServices = useMemo(() => services.filter((service) => {
    const matchesCategory = !categoryFilter
      || (categoryFilter === "legacy-uncategorized" ? !service.categoryId : String(service.categoryId || "") === categoryFilter);
    const term = serviceSearch.trim().toLocaleLowerCase();
    const matchesSearch = !term || `${service.name} ${service.description || ""} ${getServiceTypeLabel(service.serviceType)}`.toLocaleLowerCase().includes(term);
    return matchesCategory && matchesSearch;
  }), [categoryFilter, serviceSearch, services]);
  const filteredCategories = useMemo(() => {
    const term = serviceSearch.trim().toLocaleLowerCase();
    return categories.filter((category) => !term
      || `${category.name} ${category.description || ""}`.toLocaleLowerCase().includes(term));
  }, [categories, serviceSearch]);
  const showCategoryGrid = !categorySlug && !categoryFilter;
  const showUncategorizedServices = categoryFilter === "legacy-uncategorized";
  const catalogServices = showUncategorizedServices
    ? filteredServices.filter((service) => !service.categoryId)
    : filteredServices.filter((service) => String(service.categoryId || "") === String(categoryFilter));

  const orderable = Boolean(selectedService)
    && (selectedService.pricingType !== "UNIT"
      || (Number.isSafeInteger(quantityNumber)
        && (selectedService.minimumQuantityEnabled === false || quantityNumber >= selectedService.minimumQuantity)
        && (selectedService.maximumQuantityEnabled === false || quantityNumber <= selectedService.maximumQuantity)))
    && (selectedService.pricingType !== "UNIT" || !selectedService.sections?.length || selectedSection)
    && (selectedService.pricingType !== "PACKAGE" || selectedPackage)
    && formAnswersComplete
    && ownershipConsentAccepted
    && (!selectedService.customerInfoLabel || customerInfo.trim())
    && /^\d{9}$/.test(whatsappNumber)
    && totalAmount !== null;

  const notify = (message, type = "info") => {
    window.dispatchEvent(new CustomEvent("app:toast", { detail: { message, type } }));
  };

  const selectService = (service) => {
    draftAction.clear();
    submissionCompletedRef.current = false;
    setSelectedId("");
    setServiceSnapshot(null);
    setSectionId("");
    setSelectedPackageId("");
    setQuantity(1);
    setServiceVersion(null);
    setFormSchemaVersion(null);
    setAnswers({});
    setCustomerInfo("");
    setWhatsappNumber("");
    setCustomerNotes("");
    setResumeNeedsCustomerInfo(false);
    setDraftPrompt(null);
    setShowCustomForm(false);
    setDraftStarted(false);
    setError("");
    navigate(getWalletServicesPath(`/wallet-services/order/${service._id}`, searchParams), { replace: true });
  };

  const submitCatalogOrder = async (event) => {
    event.preventDefault();
    if (!orderable || submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const currentAnswers = getVisibleDigitalServiceAnswers(selectedService.formSchema || [], answers);
      const currentDraftData = { ...draftData, answers: currentAnswers };
      const savedDraft = await draftAction.persist(2, currentDraftData, {
        serviceId: selectedService._id,
        sectionId: sectionId || null
      });
      const draftActionId = savedDraft?._id || draftAction.draftId;
      const payload = {
        orderType: "catalog",
        serviceId: selectedService._id,
        ...(sectionId ? { sectionId } : {}),
        quantity: quantityNumber,
        customerInfo,
        whatsappNumber,
        customerNotes,
        serviceVersion: currentDraftData.serviceVersion,
        formSchemaVersion: currentDraftData.formSchemaVersion,
        answers: currentAnswers,
        ...(selectedPackageId ? { packageId: selectedPackageId } : {}),
        ...(draftActionId ? { draftActionId } : {})
      };
      const idempotencyKey = getWalletServiceIdempotencyKey("catalog", payload);
      const response = await api.post("/wallet-services/orders", payload, {
        headers: { "Idempotency-Key": idempotencyKey }
      });
      submissionCompletedRef.current = true;
      clearWalletServiceIdempotencyKey("catalog");
      if (draftActionId) draftAction.removeDraft(draftActionId);
      draftAction.clear();
      setWhatsappNumber("");
      setCustomerInfo("");
      setCustomerNotes("");
      setAnswers({});
      setQuantity(1);
      setSelectedPackageId("");
      setSectionId("");
      notify("تم إرسال طلبك، جارٍ فتح صفحة الدفع.", "success");
      navigate(`/wallet-services/${response.data._id}/payment`);
    } catch (submitError) {
      setError(submitError.response?.data?.error || submitError.message || "تعذر إرسال الطلب. يمكنك إعادة المحاولة بأمان.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitCustomOrder = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const payload = { orderType: "custom", ...customForm };
      const idempotencyKey = getWalletServiceIdempotencyKey("custom", payload);
      const response = await api.post("/wallet-services/orders", payload, {
        headers: { "Idempotency-Key": idempotencyKey }
      });
      clearWalletServiceIdempotencyKey("custom");
      setCustomForm({ serviceName: "", serviceUrl: "", whatsappNumber: "", customerNotes: "" });
      setShowCustomForm(false);
      notify("وصل طلبك للإدارة، وسيظهر عرض السعر هنا عند تجهيزه.", "success");
      navigate(`/wallet-services/${response.data._id}/payment`);
    } catch (submitError) {
      setError(submitError.response?.data?.error || submitError.message || "تعذر إرسال طلب الخدمة المخصصة.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="mx-auto max-w-6xl px-4 py-12 text-center font-bold text-slate-500 sm:py-20">جارٍ تحميل الخدمات...</div>;
  }

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-3 py-4 pb-24 sm:space-y-8 sm:px-4 sm:py-10" dir="rtl">
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
      {draftAction.error && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{draftAction.error}</div>}
      {resumeNeedsCustomerInfo && <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm font-semibold text-blue-800">أعد إدخال البيانات الإضافية المطلوبة والملاحظات عند الحاجة؛ لم تُحفظ هذه البيانات في المسودة.</p>}
      {draftPrompt && (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
          <p className="font-black text-slate-900 dark:text-white">لديك مسودة سابقة لهذه الخدمة. هل تريد استئنافها أم بدء طلب جديد؟</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={resumeSuggestedDraft} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-black text-white">استئناف المسودة</button>
            <button type="button" onClick={startNewOrder} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">بدء طلب جديد</button>
          </div>
        </section>
      )}

      {routeServiceId && <Link replace to={getWalletServiceCategoryPath(selectedCatalogCategory?.slug, searchParams)} className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">← العودة إلى {selectedCatalogCategory?.name || "التصنيفات"}</Link>}
      {isMyOrdersPage && <Link to="/wallet-services" className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">← العودة إلى الخدمات</Link>}
      {!isOrderPage && !isMyOrdersPage && <div className="flex justify-end"><Link to="/wallet-services/my-orders" className="inline-flex min-h-10 items-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-blue-800">طلباتي</Link></div>}

      {!isMyOrdersPage && <div className="space-y-6">
        {!isOrderPage && (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
            <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black text-blue-700 dark:text-blue-300">خدمات سوقك الرقمية</p>
                <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
                  {showCategoryGrid ? "اختر تصنيفًا" : showUncategorizedServices ? "خدمات أخرى" : categories.find((category) => category._id === categoryFilter)?.name || "خدمات التصنيف"}
                </h1>
              </div>
            </header>
            <label className="mt-5 block text-xs font-black text-slate-600 dark:text-slate-300">
              {showCategoryGrid ? "ابحث عن تصنيف" : "ابحث عن خدمة"}
              <input className={`${inputClass} mt-1.5`} value={serviceSearch} onChange={(event) => updateServiceSearch(event.target.value)} placeholder={showCategoryGrid ? "مثل: شحن الألعاب أو الاشتراكات" : "اسم الخدمة أو وصفها أو نوعها"} />
            </label>
            {showCategoryGrid ? (
              <>
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredCategories.map((category) => {
                    const serviceCount = services.filter((service) => String(service.categoryId || "") === String(category._id)).length;
                    return (
                      <button key={category._id} type="button" onClick={() => {
                        setServiceSearch("");
                        const nextSearchParams = new URLSearchParams(searchParams);
                        nextSearchParams.delete("serviceSearch");
                        navigate(getWalletServiceCategoryPath(category.slug, nextSearchParams));
                      }} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-right shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex aspect-square flex-col overflow-hidden bg-gradient-to-br from-blue-700 via-cyan-600 to-teal-500">
                          <div className="relative min-h-0 flex-1">
                            {category.image ? (
                              <img src={uploadsUrl(category.image)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain" />
                            ) : (
                              <div aria-hidden="true" className="flex h-full items-center justify-center text-6xl font-black text-white/90">▦</div>
                            )}
                          </div>
                          <div className="min-h-20 shrink-0 bg-slate-950/85 px-4 py-3 text-right text-white">
                            {category.description && <p className="line-clamp-2 text-sm font-bold leading-6">{category.description}</p>}
                            <span className={`${category.description ? "mt-1" : ""} block text-xs font-black`}>{serviceCount} خدمة <span aria-hidden="true">←</span></span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {services.some((service) => !service.categoryId) && (
                    <button type="button" onClick={() => { setServiceSearch(""); setCategoryFilter("legacy-uncategorized"); }} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-right shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
                      <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-slate-700 to-slate-500 text-6xl text-white" aria-hidden="true">💳</div>
                      <div className="p-4"><span className="font-black text-slate-900 dark:text-white">خدمات أخرى</span><span className="mt-3 block text-xs font-black text-blue-700 dark:text-blue-300">استعراض الخدمات <span aria-hidden="true">←</span></span></div>
                    </button>
                  )}
                </div>
                {filteredCategories.length === 0 && !services.some((service) => !service.categoryId) && <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-center text-sm font-semibold text-slate-500 dark:bg-slate-800">لا توجد تصنيفات مطابقة حاليًا.</p>}
              </>
            ) : (
              <>
                {!showUncategorizedServices && selectedCatalogCategory && (
                  <header className="mt-5 flex items-center gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                    {selectedCatalogCategory.image
                      ? <img src={uploadsUrl(selectedCatalogCategory.image)} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover sm:h-20 sm:w-20" />
                      : <span aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-700 to-cyan-500 text-3xl font-black text-white sm:h-20 sm:w-20">📦</span>}
                    <div><h2 className="font-black text-slate-900 dark:text-white">{selectedCatalogCategory.name}</h2>{selectedCatalogCategory.description && <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">{selectedCatalogCategory.description}</p>}</div>
                  </header>
                )}
                {catalogServices.length > 0 ? (
                  <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
                    {catalogServices.map((service) => (
                      <button key={service._id} type="button" onClick={() => selectService(service)} className="group flex flex-col items-stretch gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 text-right transition hover:border-blue-300 hover:bg-blue-50/40 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
                        <span className="flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-xl bg-slate-50 dark:bg-slate-800">
                          {service.image
                            ? <img src={uploadsUrl(service.image)} alt="" loading="lazy" className="h-full w-full object-contain p-2 transition-transform duration-200 group-hover:scale-105" />
                            : <span aria-hidden="true" className="text-5xl text-blue-700 dark:text-blue-300">💳</span>}
                        </span>
                        <span className="block w-full px-1 pb-1 text-center">
                          <span className="block text-base font-black text-slate-900 dark:text-white">{service.name}</span>
                          <span className="mt-1.5 block text-xs font-semibold text-blue-700 dark:text-blue-300">{getServiceTypeLabel(service.serviceType)}</span>
                          {service.pricingType === "PACKAGE" && (
                            <span className="mt-2 block text-xs font-black text-slate-700 dark:text-slate-200">{service.packages?.filter((item) => item.isActive).length || 0} باقات</span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-center text-sm font-semibold text-slate-500 dark:bg-slate-800">{serviceSearch ? "لا توجد خدمات مطابقة حاليًا." : "لا توجد خدمات متاحة في هذا التصنيف حاليًا."}</p>
                )}
                {listingCategory && (
                  <Link
                    to={`/wallet-services/custom-order?category=${encodeURIComponent(listingCategory.slug)}`}
                    className="mt-5 flex items-center justify-between gap-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-right shadow-sm transition hover:border-amber-400 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-amber-800 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 sm:p-5"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-200 text-2xl dark:bg-amber-900">✨</span>
                      <span>
                        <span className="block font-black text-amber-950 dark:text-amber-100">لم تجد الخدمة التي تريدها؟</span>
                        <span className="mt-1 block text-sm font-semibold text-amber-800 dark:text-amber-200">اطلب خدمة غير متوفرة في تصنيف {listingCategory.name}</span>
                      </span>
                    </span>
                    <span aria-hidden="true" className="shrink-0 text-xl font-black text-amber-800 dark:text-amber-200">←</span>
                  </Link>
                )}
              </>
            )}
          </section>
        )}

        {routeServiceId && !selectedService && <p role="alert" className="text-sm font-bold text-red-700">{error || "الخدمة المطلوبة غير متاحة حاليًا."}</p>}
        {routeServiceId && selectedService && (
          <form onSubmit={submitCatalogOrder} className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.8fr)] lg:items-start lg:gap-8">
            <div className="space-y-5">
              <header className="rounded-2xl bg-gradient-to-l from-blue-50 to-cyan-50 p-4 dark:from-blue-950/30 dark:to-cyan-950/20 sm:p-5">
                <p className="text-xs font-black text-blue-700 dark:text-blue-300">{getServiceTypeLabel(selectedService.serviceType)}{serviceVersion ? ` · إصدار الخدمة ${serviceVersion}` : ""}</p>
                <h1 className="mt-1 text-xl font-black text-slate-900 dark:text-white">طلب {selectedService.name}</h1>
                {selectedService.description && <p className="mt-2 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">{selectedService.description}</p>}
              </header>

              {["SOFTWARE", "ENTERTAINMENT"].includes(selectedService.serviceType) && ownershipConsentRequired && (
                <aside role="note" aria-labelledby="subscription-activation-notice" className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100 sm:p-5">
                  <h2 id="subscription-activation-notice" className="font-black">تنبيه مهم بشأن تفعيل الاشتراك</h2>
                  <p className="font-semibold leading-6">قد يتطلب إتمام تفعيل الاشتراك دخول فريق سوقك إلى حسابك الشخصي بشكل مؤقت. بعد تأكيد الدفع، سيتواصل معك الفريق عبر واتساب للاتفاق معك على آلية الدخول والخطوات اللازمة، ولن يتم الدخول دون تنسيق وموافقتك.</p>
                  <ul className="list-inside list-disc space-y-1 text-xs font-semibold leading-5">
                    <li>يجب أن يكون الحساب ملكًا لك.</li>
                    <li>تأكد من إدخال البريد الإلكتروني الصحيح.</li>
                    <li>يجب أن تكون متاحًا عبر واتساب لمتابعة إجراءات التفعيل.</li>
                    <li>لا ترسل كلمة المرور أو رموز التحقق في نموذج الطلب أو عبر واتساب.</li>
                    <li>بعد إتمام المهمة، ينهي الفريق الوصول المؤقت ويسجل الخروج من الحساب.</li>
                  </ul>
                </aside>
              )}

              {selectedService.pricingType === "PACKAGE" && (
                <fieldset className="space-y-3">
                  <legend className="text-sm font-black text-slate-800 dark:text-white">اختر الباقة</legend>
                  <div className="grid grid-cols-2 gap-3" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                    {(selectedService.packages || []).filter((item) => item.isActive).map((item) => (
                      <button key={item.id} type="button" aria-pressed={selectedPackageId === item.id} onClick={() => setSelectedPackageId(item.id)} className={`relative min-w-0 rounded-2xl border p-3 text-right transition sm:p-4 ${selectedPackageId === item.id ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100 dark:bg-blue-950/30" : "border-slate-200 hover:border-blue-300 dark:border-slate-700"}`}>
                        <span className="block font-black text-slate-900 dark:text-white">{item.name}</span>
                        {item.description && <span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span>}
                        <span className="mt-3 block text-lg font-black text-blue-700 dark:text-blue-300">{Number(item.price).toLocaleString()} {CURRENCIES[item.currency]}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              {selectedService.pricingType === "UNIT" && selectedService.sections?.length > 0 && (
                <fieldset className="space-y-3">
                  <legend className="text-sm font-black text-slate-800 dark:text-white">اختر القسم</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {selectedService.sections.map((section) => (
                      <button key={section._id} type="button" aria-pressed={sectionId === section._id} onClick={() => setSectionId(section._id)} className={`rounded-2xl border p-4 text-right transition ${sectionId === section._id ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100 dark:bg-blue-950/30" : "border-slate-200 hover:border-blue-300 dark:border-slate-700"}`}>
                        <span className="block font-black text-slate-900 dark:text-white">{section.name}</span>
                        <span className="mt-1 block text-sm font-black text-blue-700 dark:text-blue-300">{Number(section.unitPrice).toLocaleString()} {CURRENCIES[selectedService.currency]} / {selectedService.unitLabel}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              {selectedService.pricingType === "UNIT" && (
                <label className="block space-y-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                  الكمية ({selectedService.unitLabel})
                  <input className={inputClass} type="number" min={selectedService.minimumQuantityEnabled === false ? 1 : selectedService.minimumQuantity} max={selectedService.maximumQuantityEnabled === false ? undefined : selectedService.maximumQuantity} step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
                </label>
              )}

              <section className="space-y-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-700 sm:p-5">
                <div>
                  <h2 className="text-sm font-black text-slate-800 dark:text-white">بيانات تنفيذ الخدمة</h2>
                  <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">تختلف الحقول حسب الخدمة؛ لا ترسل كلمات مرور أو بيانات دخول حساسة.</p>
                </div>
                <DigitalServiceForm schema={selectedService.formSchema || []} answers={answers} onChange={setAnswers} idPrefix={`service-${selectedService._id}`} />
                {selectedService.customerInfoLabel && (
                  <label className="block space-y-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                    {selectedService.customerInfoLabel}
                    <input className={inputClass} value={customerInfo} onChange={(event) => setCustomerInfo(event.target.value)} required maxLength={300} />
                  </label>
                )}
                <label className="block space-y-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                  رقم واتساب لاستلام نتيجة الطلب (9 أرقام)
                  <input className={inputClass} inputMode="numeric" maxLength={9} pattern="[0-9]{9}" value={whatsappNumber} onChange={(event) => setWhatsappNumber(event.target.value.replace(/\D/g, "").slice(0, 9))} required />
                </label>
                <label className="block space-y-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                  ملاحظات (اختياري)
                  <textarea className={inputClass} rows={3} maxLength={1000} value={customerNotes} onChange={(event) => setCustomerNotes(event.target.value)} />
                </label>
              </section>
            </div>

            {!isOrderPage && <section aria-labelledby="tmam-pay-partner-title" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-5">
              <div className="flex min-w-0 items-center gap-4">
                <img src="/tmam-full-logo.png" alt="تمام باي Tmam Pay" loading="lazy" decoding="async" className="h-12 w-32 shrink-0 object-contain sm:w-40" />
                <div className="min-w-0">
                  <h2 id="tmam-pay-partner-title" className="text-base font-black text-slate-900 dark:text-white sm:text-lg">تمام باي — شريك سوقك لخدمات الدفع الإلكتروني</h2>
                  <p className="mt-1 text-xs font-bold text-slate-600 dark:text-slate-300">تمام باي مزود مستقل لخدمات الدفع الإلكتروني. الدفع عبره غير مفعّل في مسارات طلبات هذا الكتالوج حاليًا.</p>
                </div>
              </div>
              <a href="https://tmam-pay.wuaze.com/" target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-800 sm:mt-0">زيارة تمام باي</a>
            </section>}

            <aside className="space-y-4 lg:sticky lg:top-24">
              <section aria-label="معاينة التكلفة" className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-b from-blue-50/80 to-white dark:border-blue-900/60 dark:from-blue-950/30 dark:to-slate-900">
                <div className="border-b border-blue-100 px-4 py-4 dark:border-blue-900/60">
                  <p className="text-xs font-bold text-blue-700 dark:text-blue-300">معاينة التكلفة</p>
                  <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">{selectedPackage?.name || selectedSection?.name || selectedService.name}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">الكمية: {quantityNumber.toLocaleString()} {selectedService.pricingType === "UNIT" ? selectedService.unitLabel : "طلب واحد"}</p>
                </div>
                <div className="space-y-3 p-4 text-sm">
                  <div className="flex items-center justify-between gap-3 font-semibold text-slate-600 dark:text-slate-300"><span>قيمة الخدمة</span><span>{serviceAmount.toLocaleString()} {CURRENCIES[selectedService.currency]}</span></div>
                  <div className="flex items-center justify-between gap-3 font-semibold text-slate-600 dark:text-slate-300"><span>رسوم سوقك</span><span>{platformFee == null ? "غير محددة" : `${platformFee.toLocaleString()} ${CURRENCIES[selectedService.currency]}`}</span></div>
                  <div className="rounded-xl bg-blue-700 px-4 py-3 text-white">
                    <p className="text-xs font-bold text-blue-100">الإجمالي التقديري</p>
                    <p className="mt-1 text-xl font-black">{totalAmount == null ? "—" : `${totalAmount.toLocaleString()} ${CURRENCIES[selectedService.currency]}`}</p>
                  </div>
                  <p className="text-[11px] font-medium leading-5 text-slate-500">هذه معاينة من أسعار الخدمة وشرائح الرسوم الحالية؛ يعتمد المبلغ النهائي على ملخص الطلب الذي يحسبه الخادم عند الإرسال.</p>
                </div>
              </section>
              {totalAmount != null && <CurrencyCalculator amount={totalAmount} currency={selectedService.currency} />}
              <button disabled={!orderable || submitting} className="w-full rounded-xl bg-blue-700 px-4 py-3.5 text-sm font-black text-white shadow-md transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
                {submitting ? "جارٍ الإرسال..." : "تأكيد وإرسال الطلب"}
              </button>
              {!orderable && <p className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400">{selectedService.pricingType === "PACKAGE" && !selectedPackage ? "اختر باقة لإظهار التكلفة." : selectedService.pricingType === "UNIT" && selectedService.sections?.length && !selectedSection ? "اختر القسم أولًا لإظهار التكلفة." : !formAnswersComplete ? "أكمل الحقول المطلوبة في نموذج الخدمة." : !ownershipConsentAccepted ? "يجب الموافقة على تعهد ملكية الحساب لإرسال الطلب." : platformFee == null ? "أكمل البيانات وتحقق من توفر شريحة الرسوم لهذه العملة والقيمة." : "أكمل البيانات المطلوبة لتتمكن من إرسال الطلب."}</p>}
            </aside>
          </form>
        )}

        {isCustomOrderPage && showCustomForm && <section className="rounded-3xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/10 sm:p-7">
          <h1 className="text-xl font-black text-slate-900 dark:text-white">طلب خدمة غير متوفرة</h1>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">أرسل التفاصيل، وستراجع الإدارة الطلب وترسل لك عرض السعر قبل الدفع.</p>
          {customOrderCategory && <p className="mt-3 rounded-xl border border-amber-200 bg-white/70 p-3 text-sm font-bold text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">التصنيف: {customOrderCategory.name}</p>}
          <form onSubmit={submitCustomOrder} className="mt-5 space-y-4">
            <label className="block space-y-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">اسم الخدمة<input className={inputClass} value={customForm.serviceName} onChange={(event) => setCustomForm({ ...customForm, serviceName: event.target.value })} maxLength={160} required /></label>
            <label className="block space-y-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">رابط الخدمة<input className={inputClass} type="url" placeholder="https://" value={customForm.serviceUrl} onChange={(event) => setCustomForm({ ...customForm, serviceUrl: event.target.value })} required /></label>
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">لفحص الرابط، سيتم إرساله إلى Cloudflare URL Scanner كفحص غير مدرج، وقد يحتفظ Cloudflare بنتيجة الفحص وفق سياسته. لا ترسل رابطًا يتضمن بيانات سرية أو رموز دخول.</p>
            <label className="block space-y-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">رقم واتساب (9 أرقام)<input className={inputClass} inputMode="numeric" maxLength={9} pattern="[0-9]{9}" value={customForm.whatsappNumber} onChange={(event) => setCustomForm({ ...customForm, whatsappNumber: event.target.value.replace(/\D/g, "").slice(0, 9) })} required /></label>
            <label className="block space-y-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">ملاحظات<textarea className={inputClass} rows={3} maxLength={1000} value={customForm.customerNotes} onChange={(event) => setCustomForm({ ...customForm, customerNotes: event.target.value })} /></label>
            <button disabled={submitting} className="w-full rounded-xl bg-amber-600 px-4 py-3 font-black text-white disabled:opacity-50">{submitting ? "جارٍ الإرسال..." : "إرسال طلب التسعير"}</button>
          </form>
        </section>}
      </div>}

      {isMyOrdersPage && <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-xl font-black text-slate-900 dark:text-white">طلباتي</h2><p className="mt-1 text-xs font-semibold text-slate-500">{user?.name || "طلبات خدمات الدفع"}</p></div>
          <button type="button" onClick={loadData} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">تحديث</button>
        </div>
        <div className="mt-5"><IncompleteActions userId={userId} /></div>
        {orders.length === 0 ? <p className="mt-5 rounded-xl bg-slate-50 p-5 text-center text-sm font-bold text-slate-500 dark:bg-slate-800">لم ترسل أي طلب بعد.</p> : (
          <div className="mt-5 space-y-4">
            {orders.map((order) => (
              <article key={order._id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h3 className="font-black text-slate-900 dark:text-white">{order.serviceName}{order.sectionName ? ` — ${order.sectionName}` : order.packageName ? ` — ${order.packageName}` : ""}</h3><p className="mt-1 text-xs font-semibold text-slate-500">{new Date(order.createdAt).toLocaleString("ar")} · الكمية: {order.quantity}</p></div>
                  <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{STATUS_LABELS[order.status] || order.status}</span>
                </div>
                {order.answers && Object.keys(order.answers).length > 0 && (
                  <dl className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800 sm:grid-cols-2">
                    {(order.formSchemaSnapshot || []).filter((field) => Object.hasOwn(order.answers, field.id)).map((field) => {
                      const value = order.answers[field.id];
                      return <div key={field.id}><dt className="font-bold text-slate-500">{field.label}</dt><dd className="mt-1 break-words font-semibold text-slate-800 dark:text-slate-100">{Array.isArray(value) ? value.join("، ") : typeof value === "boolean" ? value ? "نعم" : "لا" : String(value)}</dd></div>;
                    })}
                  </dl>
                )}
                {order.serviceUrl && <p className="mt-2 break-all text-xs">{getExternalLinkHost(order.serviceUrl) ? <a className="font-semibold text-blue-700 underline" href={order.serviceUrl} target="_blank" rel="noopener noreferrer" onClick={confirmUntrustedExternalLink}>{getExternalLinkHost(order.serviceUrl)}</a> : order.serviceUrl}<span className="mt-1 block text-amber-800 dark:text-amber-300">رابط خارجي يقدمه المستخدم؛ تحقق من النطاق قبل فتحه.</span></p>}
                {order.totalAmount != null && <p className="mt-2 text-sm font-black">الإجمالي: {order.totalAmount.toLocaleString()} {CURRENCIES[order.currency] || order.currency} (الخدمة {order.serviceAmount} + رسوم سوقك {order.platformFee})</p>}
                {order.quoteNote && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">ملاحظة التسعير: {order.quoteNote}</p>}
                <Link to={`/wallet-services/${order._id}/payment`} className="mt-3 inline-flex rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white">
                  {order.status === "QUOTE_OFFERED" ? "مراجعة عرض السعر" : order.status === "AWAITING_PAYMENT" ? "الانتقال إلى الدفع" : order.status === "PAYMENT_NEEDS_CORRECTION" ? "إعادة رفع السند ومتابعة الطلب" : "عرض تفاصيل الطلب والسجل الزمني"}
                </Link>
                {order.paymentReceipt && <button type="button" className="mt-3 inline-block text-xs font-bold text-blue-700 underline" onClick={() => setPreviewDoc(order.paymentReceipt)}>عرض سند الدفع المرسل</button>}
                {order.completionNote && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">نتيجة التنفيذ: {order.completionNote}</p>}
                {order.rejectionReason && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800 dark:bg-red-950/30 dark:text-red-200">سبب الرفض: {order.rejectionReason}</p>}
              </article>
            ))}
          </div>
        )}
      </section>}
      <DocumentPreviewModal
        isOpen={Boolean(previewDoc)}
        src={previewUrl}
        onClose={() => setPreviewDoc(null)}
        title="معاينة سند الدفع"
        contentType={protectedFileContentTypes[normalizeProtectedFilePath(previewDoc)]}
        loading={protectedFilesLoading}
        error={protectedFileErrors[normalizeProtectedFilePath(previewDoc)]}
      />
    </main>
  );
}
