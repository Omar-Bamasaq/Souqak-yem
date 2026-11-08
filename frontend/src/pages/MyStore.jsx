import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../api/axios.js";
import { uploadsUrl } from "../lib/uploads.js";
import { hasStorePlanFeature } from "../utils/storePlanFeatures.js";
import { getStoreAdvancedPalette, normalizeStoreAdvancedTheme, STORE_ADVANCED_PALETTES } from "../utils/storeAdvancedThemes.js";
import { getStoreCurrencyLabel, getStoreStatusLabel } from "../utils/storeArabicLabels.js";
import { getStoreActivityCategoryOptions } from "../utils/storeCategories.js";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { StoreEmptyState, StoreLoadingCards, StoreStatCard, StoreStatusBadge } from "../components/StoreUi.jsx";
import { parseMapCoordinates } from "../components/mapCoordinates.js";
import { subscribeToPush } from "../utils/pushNotifications.js";

const MapLocationPicker = lazy(() => import("../components/MapLocationPicker.jsx"));

const STATUS_MAP = {
  pending: "قيد المراجعة",
  active: "نشط",
  suspended: "معلق",
  rejected: "مرفوض",
  inactive: "غير نشط"
};

const DEFAULT_ADVANCED_CUSTOMIZATION = {
  theme: "classic",
  primaryColor: "#0b89ed",
  secondaryColor: "#0f172a",
  pageBackgroundColor: "#f1f5f9",
  storeInfoBackgroundColor: "#ffffff",
  sectionBackgroundColor: "#ffffff",
  productCardBackgroundColor: "#ffffff",
  hero: { title: "", text: "", buttonLabel: "", buttonTarget: "products" },
  story: { text: "" },
  featuredProductIds: [],
  sectionOrder: ["intro", "hero", "story", "featuredProducts", "products"],
  hiddenSections: []
};

export default function MyStore({ storeType = "store" }) {
  const api = useApi();
  const [store, setStore] = useState(null);
  const [ads, setAds] = useState([]);
  const [productSearch, setProductSearch] = useState("");
  const [productStatusFilter, setProductStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsRange, setAnalyticsRange] = useState("7d");
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [advancedDraft, setAdvancedDraft] = useState(DEFAULT_ADVANCED_CUSTOMIZATION);
  const [heroImageFile, setHeroImageFile] = useState(null);
  const [storyImageFiles, setStoryImageFiles] = useState([]);
  const [heroImagePreview, setHeroImagePreview] = useState("");
  const [storyImagePreviews, setStoryImagePreviews] = useState([]);
  const [clearHeroImage, setClearHeroImage] = useState(false);
  const [clearStoryImages, setClearStoryImages] = useState(false);
  const [advancedError, setAdvancedError] = useState("");
  const [advancedSaving, setAdvancedSaving] = useState(false);
  const [storeLinkCopied, setStoreLinkCopied] = useState(false);
  const [storeLinkError, setStoreLinkError] = useState("");
  const [renewalPlans, setRenewalPlans] = useState([]);
  const [renewalPlanId, setRenewalPlanId] = useState("");
  const [renewalReceipt, setRenewalReceipt] = useState(null);
  const [renewalFormOpen, setRenewalFormOpen] = useState(false);
  const [renewalPlansLoading, setRenewalPlansLoading] = useState(false);
  const [renewalSubmitting, setRenewalSubmitting] = useState(false);
  const [renewalError, setRenewalError] = useState("");
  const [ownerPushStatus, setOwnerPushStatus] = useState("checking");
  const [ownerPushSaving, setOwnerPushSaving] = useState(false);
  const [ownerPushError, setOwnerPushError] = useState("");
  const [bankDraft, setBankDraft] = useState(null);
  const [editingBankIndex, setEditingBankIndex] = useState(null);
  const [form, setForm] = useState({
    storeName: "",
    activityKey: "",
    description: "",
    location: "",
    phone: "",
    selectedCategories: [],
    email: "",
    notificationEmail: "",
    governorateId: "",
    cityId: "",
    customCityName: "",
    lat: "",
    lng: "",
    phones: [],
    whatsapp: [],
    social: { facebook: "", instagram: "", tiktok: "", youtube: "", whatsappChannel: "" },
    primaryColor: "#0b89ed",
    logo: null,
    cover: null
  });
  const [governorates, setGovernorates] = useState([]);
  const [cities, setCities] = useState([]);
  const [cityIsOther, setCityIsOther] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [activities, setActivities] = useState([]);

  useEffect(() => () => {
    if (heroImagePreview) URL.revokeObjectURL(heroImagePreview);
    storyImagePreviews.forEach((url) => URL.revokeObjectURL(url));
  }, [heroImagePreview, storyImagePreviews]);

  useEffect(() => {
    let cancelled = false;
    api.get("/categories")
      .then((res) => { if (!cancelled) setCategoryOptions(res.data || []); })
      .catch(() => { if (!cancelled) setCategoryOptions([]); });
    return () => { cancelled = true; };
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    api.get("/stores/activities", { params: { type: store?.storeType || "store" } })
      .then((res) => { if (!cancelled) setActivities(res.data || []); })
      .catch(() => { if (!cancelled) setActivities([]); });
    return () => { cancelled = true; };
  }, [api, store?.storeType]);

  useEffect(() => {
    let cancelled = false;

    const fetchStore = async () => {
      try {
        const storeRes = await api.get("/stores/me", { params: { storeType } });
        if (cancelled) return;
        const nextStore = storeRes.data || null;
        setStore(nextStore);
        setBankAccounts(Array.isArray(nextStore?.bankAccounts) ? nextStore.bankAccounts : []);
        setAdvancedDraft({
          ...DEFAULT_ADVANCED_CUSTOMIZATION,
          ...(nextStore?.advancedCustomization || {}),
          theme: normalizeStoreAdvancedTheme(nextStore?.advancedCustomization?.theme),
          hero: { ...DEFAULT_ADVANCED_CUSTOMIZATION.hero, ...(nextStore?.advancedCustomization?.hero || {}) },
          story: { ...DEFAULT_ADVANCED_CUSTOMIZATION.story, ...(nextStore?.advancedCustomization?.story || {}) },
          featuredProductIds: (nextStore?.advancedCustomization?.featuredProductIds || []).map(String),
          sectionOrder: nextStore?.advancedCustomization?.sectionOrder || DEFAULT_ADVANCED_CUSTOMIZATION.sectionOrder,
          hiddenSections: nextStore?.advancedCustomization?.hiddenSections || []
        });
        setHeroImageFile(null);
        setStoryImageFiles([]);
        setHeroImagePreview("");
        setStoryImagePreviews([]);
        setClearHeroImage(false);
        setClearStoryImages(false);

        if (nextStore) {
          setForm({
            storeName: nextStore.storeName || "",
            activityKey: nextStore.activityKey || "",
            description: nextStore.description || "",
            location: nextStore.location || "",
            phone: nextStore.phone || "",
            email: nextStore.email || "",
            notificationEmail: nextStore.notificationEmail || "",
            governorateId: nextStore.governorateId?._id || nextStore.governorateId || "",
            cityId: nextStore.cityId?._id || nextStore.cityId || "",
            customCityName: nextStore.customCityName || "",
            lat: nextStore.lat ?? "",
            lng: nextStore.lng ?? "",
            phones: Array.isArray(nextStore.phones) && nextStore.phones.length
              ? nextStore.phones
              : [{ type: "mobile", value: nextStore.phone || "" }],
            whatsapp: Array.isArray(nextStore.whatsapp) && nextStore.whatsapp.length
              ? nextStore.whatsapp
              : [{ type: "whatsapp", value: "" }],
            social: {
              facebook: nextStore.social?.facebook || "",
              instagram: nextStore.social?.instagram || "",
              tiktok: nextStore.social?.tiktok || "",
              youtube: nextStore.social?.youtube || "",
              whatsappChannel: nextStore.social?.whatsappChannel || ""
            },
            selectedCategories: (nextStore.selectedCategories || []).map((category) => String(category?._id || category)),
            primaryColor: nextStore.primaryColor || "#0b89ed",
            logo: null,
            cover: null
          });
          setCityIsOther(!!nextStore.customCityName);
          const adsRes = await api.get("/ads/my", { params: { storeProducts: "true", storeType } });
          if (!cancelled) setAds(adsRes.data || []);
        } else {
          setBankAccounts([]);
          setBankDraft(null);
          setEditingBankIndex(null);
          setAdvancedDraft(DEFAULT_ADVANCED_CUSTOMIZATION);
          setHeroImageFile(null);
          setStoryImageFiles([]);
          setHeroImagePreview("");
          setStoryImagePreviews([]);
          setCityIsOther(false);
          setForm({
            storeName: "",
            activityKey: "",
            description: "",
            location: "",
            phone: "",
            email: "",
            notificationEmail: "",
            governorateId: "",
            cityId: "",
            customCityName: "",
            lat: "",
            lng: "",
            phones: [],
            whatsapp: [],
            social: { facebook: "", instagram: "", tiktok: "", youtube: "", whatsappChannel: "" },
            selectedCategories: [],
            primaryColor: "#0b89ed",
            logo: null,
            cover: null
          });
          if (!cancelled) setAds([]);
        }
      } catch (err) {
        if (!cancelled) {
          setStore(null);
          setAds([]);
          setError(err?.response?.status === 404 ? "لا يوجد متجر مرتبط بحسابك." : "تعذّر تحميل متجر المتجر.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchStore();
    return () => { cancelled = true; };
  }, [api, storeType]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/governorates");
        if (!cancelled) setGovernorates(res.data || []);
      } catch {
        if (!cancelled) setGovernorates([]);
      }
    })();
    return () => { cancelled = true; };
  }, [api]);

  useEffect(() => {
    if (!form.governorateId) {
      setCities([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/cities?governorateId=${form.governorateId}&active=true`);
        if (!cancelled) {
          const list = res.data || [];
          setCities(list);
          if (form.cityId && !list.some((city) => String(city._id) === String(form.cityId))) {
            setForm((current) => ({ ...current, cityId: "" }));
          }
        }
      } catch {
        if (!cancelled) setCities([]);
      }
    })();
    return () => { cancelled = true; };
  }, [api, form.governorateId, form.cityId]);

  const categories = useMemo(
    () => (store?.selectedCategories || []).map((category) => category?.name || category).filter(Boolean),
    [store]
  );

  const subscription = store?.subscription || null;
  const selectedRenewalPlan = renewalPlans.find((plan) => String(plan._id) === String(renewalPlanId)) || null;
  const renewalPaymentRequired = selectedRenewalPlan
    ? Number(selectedRenewalPlan.finalPrice ?? selectedRenewalPlan.price) > 0
    : true;
  const selectedActivity = activities.find((activity) => activity.activityKey === form.activityKey) || null;
  const activityCategoryOptions = useMemo(
    () => getStoreActivityCategoryOptions(categoryOptions, selectedActivity, form.selectedCategories),
    [categoryOptions, selectedActivity, form.selectedCategories]
  );
  const subscriptionStatus = store?.subscriptionStatus || "inactive";
  const renewalRequest = store?.pendingRenewal || null;
  const planName = subscription?.plan?.name || subscription?.planId?.name || "—";
  const supportsMultipleContacts = store?.storeType === "family-production"
    || (subscriptionStatus === "active" && hasStorePlanFeature(subscription?.plan || subscription?.planId, "multipleContacts"));
  const supportsOrders = subscriptionStatus === "active" && hasStorePlanFeature(subscription?.plan || subscription?.planId, "orders");
  const supportsNotifications = store?.status === "active"
    && subscriptionStatus === "active"
    && hasStorePlanFeature(subscription?.plan || subscription?.planId, "notifications");
  const supportsAnalytics = store?.status === "active" && subscriptionStatus === "active"
    && hasStorePlanFeature(subscription?.plan || subscription?.planId, "analytics");
  const supportsStorePWA = store?.status === "active" && subscriptionStatus === "active"
    && hasStorePlanFeature(subscription?.plan || subscription?.planId, "pwa");
  const supportsCustomization = store?.status === "active" && subscriptionStatus === "active"
    && hasStorePlanFeature(subscription?.plan || subscription?.planId, "customization");
  const supportsAdvancedCustomization = supportsCustomization
    && store?.advancedCustomizationEnabled === true
    && hasStorePlanFeature(subscription?.plan || subscription?.planId, "advancedCustomization");
  const supportsDiscounts = subscriptionStatus === "active" && hasStorePlanFeature(subscription?.plan || subscription?.planId, "discounts");
  const supportsInventory = subscriptionStatus === "active" && hasStorePlanFeature(subscription?.plan || subscription?.planId, "inventory");
  const maxCategories = Number(subscription?.plan?.limits?.maxCategories || 0);
  const maxProducts = Number(subscription?.plan?.limits?.maxProducts || 0);
  const startDate = subscription?.startDate ? new Date(subscription.startDate) : null;
  const endDate = subscription?.endDate ? new Date(subscription.endDate) : null;
  const visibleAds = useMemo(() => {
    const query = productSearch.trim().toLocaleLowerCase();
    return ads.filter((ad) => {
      const status = ad.isArchived ? "archived" : ad.status || "pending";
      if (productStatusFilter !== "all" && status !== productStatusFilter) return false;
      if (!query) return true;
      return `${ad.title || ""} ${ad.categoryId?.name || ""}`.toLocaleLowerCase().includes(query);
    });
  }, [ads, productSearch, productStatusFilter]);
  const featuredCandidates = useMemo(() => ads.filter((ad) => (
    String(ad.storeProfileId?._id || ad.storeProfileId || "") === String(store?._id || "")
    && ad.status === "approved"
    && !ad.isArchived
    && !ad.sold
    && !ad.isDeleted
    && (!ad.expiresAt || new Date(ad.expiresAt) > new Date())
  )), [ads, store?._id]);
  const storyImagesToPreview = storyImagePreviews.length
    ? storyImagePreviews
    : (clearStoryImages ? [] : advancedDraft.story?.images || []);
  const selectedFeaturedProducts = featuredCandidates.filter((product) => (
    advancedDraft.featuredProductIds?.includes(String(product._id))
  ));

  const updateAdvancedDraft = (field, value) => {
    setAdvancedDraft((current) => ({ ...current, [field]: value }));
  };

  const updateAdvancedTheme = (theme) => {
    setAdvancedDraft((current) => ({
      ...current,
      theme,
      ...getStoreAdvancedPalette(theme, current)
    }));
  };

  const updateAdvancedNestedDraft = (group, field, value) => {
    setAdvancedDraft((current) => ({
      ...current,
      [group]: { ...(current[group] || {}), [field]: value }
    }));
  };

  const moveAdvancedSection = (section, direction) => {
    setAdvancedDraft((current) => {
      const order = [...(current.sectionOrder || DEFAULT_ADVANCED_CUSTOMIZATION.sectionOrder)];
      const index = order.indexOf(section);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return current;
      [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
      return { ...current, sectionOrder: order };
    });
  };

  useEffect(() => {
    let cancelled = false;
    if (!store || !supportsOrders) {
      setNewOrderCount(0);
      return () => { cancelled = true; };
    }
    api.get("/store-commerce/owner/orders", { params: { storeType } })
      .then((response) => {
        if (!cancelled) setNewOrderCount(response.data.newCount || 0);
      })
      .catch(() => {
        if (!cancelled) setNewOrderCount(0);
      });
    return () => { cancelled = true; };
  }, [api, store, storeType, supportsOrders]);

  useEffect(() => {
    let cancelled = false;
    setOwnerPushError("");
    if (!supportsNotifications) {
      setOwnerPushStatus("unavailable");
      return () => { cancelled = true; };
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || typeof Notification === "undefined") {
      setOwnerPushStatus("unsupported");
      return () => { cancelled = true; };
    }
    if (Notification.permission === "denied") {
      setOwnerPushStatus("denied");
      return () => { cancelled = true; };
    }
    if (Notification.permission !== "granted") {
      setOwnerPushStatus("not-enabled");
      return () => { cancelled = true; };
    }
    navigator.serviceWorker.getRegistration()
      .then((registration) => registration?.active
        ? registration.pushManager.getSubscription()
        : null)
      .then((subscriptionValue) => {
        if (!cancelled) setOwnerPushStatus(subscriptionValue ? "enabled" : "not-enabled");
      })
      .catch((error) => {
        console.error("Store owner Push status lookup failed:", error);
        if (!cancelled) setOwnerPushStatus("error");
      });
    return () => { cancelled = true; };
  }, [store?._id, supportsNotifications]);

  const enableOwnerPush = async () => {
    if (ownerPushSaving || !supportsNotifications) return;
    setOwnerPushSaving(true);
    setOwnerPushError("");
    try {
      const subscriptionValue = await subscribeToPush(api);
      if (!subscriptionValue) {
        setOwnerPushStatus(typeof Notification !== "undefined" && Notification.permission === "denied"
          ? "denied"
          : "not-enabled");
        setOwnerPushError("لم يتم تفعيل إشعارات المتصفح. يمكنك إبقاء إشعارات المتجر داخل التطبيق.");
        return;
      }
      setOwnerPushStatus("enabled");
    } catch (pushError) {
      console.error("Store owner Push activation failed:", pushError);
      setOwnerPushStatus("error");
      setOwnerPushError(pushError?.response?.data?.error || "تعذر تفعيل إشعارات المتصفح.");
    } finally {
      setOwnerPushSaving(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!store || !supportsAnalytics) {
      setAnalytics(null);
      setAnalyticsError("");
      return () => { cancelled = true; };
    }
    setAnalyticsLoading(true);
    setAnalyticsError("");
    api.get("/stores/owner/analytics", { params: { storeType, range: analyticsRange } })
      .then((response) => {
        if (!cancelled) setAnalytics(response.data);
      })
      .catch((error) => {
        if (cancelled) return;
        setAnalytics(null);
        setAnalyticsError(error?.response?.data?.error || "تعذر تحميل إحصائيات المتجر.");
      })
      .finally(() => {
        if (!cancelled) setAnalyticsLoading(false);
      });
    return () => { cancelled = true; };
  }, [api, store?._id, storeType, supportsAnalytics, analyticsRange]);

  const openRenewalForm = async () => {
    if (renewalPlansLoading || renewalSubmitting) return;
    setRenewalError("");
    setRenewalPlansLoading(true);
    try {
      const response = await api.get("/plans", { params: { type: storeType } });
      const availablePlans = (response.data || []).filter((plan) => Number(plan.price || 0) > 0);
      setRenewalPlans(availablePlans);
      setRenewalPlanId((current) => availablePlans.some((plan) => String(plan._id) === current)
        ? current
        : availablePlans[0]?._id || "");
      setRenewalFormOpen(true);
    } catch (error) {
      console.error("Store renewal plans load error:", error);
      setRenewalError(error?.response?.data?.error || "تعذر تحميل باقات التجديد.");
    } finally {
      setRenewalPlansLoading(false);
    }
  };

  const submitRenewalRequest = async (event) => {
    event.preventDefault();
    const selectedPlan = renewalPlans.find((plan) => String(plan._id) === String(renewalPlanId));
    if (!selectedPlan) {
      setRenewalError("اختر باقة للتجديد.");
      return;
    }
    if (Number(selectedPlan.finalPrice ?? selectedPlan.price) > 0 && !renewalReceipt) {
      setRenewalError("أرفق سند الدفع للباقة المختارة.");
      return;
    }

    setRenewalSubmitting(true);
    setRenewalError("");
    try {
      const formData = new FormData();
      formData.append("storeType", storeType);
      formData.append("planId", selectedPlan._id);
      if (renewalReceipt) formData.append("paymentReceipt", renewalReceipt);
      await api.post("/stores/renew", formData, {
        params: { storeType },
        headers: { "Content-Type": "multipart/form-data" }
      });
      window.location.reload();
    } catch (error) {
      setRenewalError(error?.response?.data?.error || "تعذر إرسال طلب التجديد.");
    } finally {
      setRenewalSubmitting(false);
    }
  };

  const handleCustomizationChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleCustomizationSubmit = async (event) => {
    event.preventDefault();
    if (!store) return;
    const coordinates = parseMapCoordinates(form.lat, form.lng);
    if (!coordinates.valid) {
      alert(coordinates.error);
      return;
    }
    if (store.storeType === "family-production") {
      const phoneNumbers = [...(form.phones || []), ...(form.whatsapp || [])];
      if (!(form.phones || []).length || !(form.whatsapp || []).length
        || phoneNumbers.some(({ value }) => !/^\d{9}$/.test(String(value || "")))) {
        alert("أدخل رقم هاتف ورقم واتساب، ويتكون كل رقم من 9 أرقام.");
        return;
      }
    }

    setIsSaving(true);
    const payload = new FormData();

    Object.entries(form).forEach(([key, value]) => {
      if (key === "storeName" || key === "activityKey") return;
      if (key === "notificationEmail" && !String(value || "").trim() && !store.notificationEmail) {
        return;
      }
      if (key === "logo" || key === "cover") {
        if (value instanceof File) payload.append(key, value);
        return;
      }
      if (key === "phones" || key === "whatsapp") {
        if (Array.isArray(value)) payload.append(key, JSON.stringify(value));
        return;
      }
      if (key === "social") {
        payload.append(key, JSON.stringify(value || {}));
        return;
      }
      if (key === "selectedCategories") {
        payload.append(key, JSON.stringify(value || []));
        return;
      }
      if (value !== null && value !== undefined) {
        payload.append(key, String(value));
      }
    });
    payload.append("bankAccounts", JSON.stringify(bankAccounts));

    if (!form.governorateId && !form.customCityName.trim()) {
      alert("يرجى اختيار المحافظة أو كتابة اسم المدينة الأخرى.");
      setIsSaving(false);
      return;
    }
    if (form.governorateId && !form.cityId && !form.customCityName.trim()) {
      alert("يرجى اختيار المدينة أو كتابة اسم المدينة الأخرى.");
      setIsSaving(false);
      return;
    }

    try {
      const res = await api.patch("/stores/me", payload, {
        params: { storeType },
        headers: { "Content-Type": "multipart/form-data" }
      });
      setStore((current) => ({ ...current, ...res.data }));
      setBankAccounts(Array.isArray(res.data?.bankAccounts) ? res.data.bankAccounts : bankAccounts);
      setError("");
      alert("تم حفظ تخصيص المتجر بنجاح.");
    } catch (err) {
      alert(err?.response?.data?.error || "تعذر حفظ تخصيص المتجر.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdvancedCustomizationSubmit = async (event) => {
    event.preventDefault();
    if (!store || !supportsAdvancedCustomization) return;
    setAdvancedSaving(true);
    setAdvancedError("");
    const payload = new FormData();
    payload.append("advancedCustomization", JSON.stringify({
      theme: advancedDraft.theme,
      primaryColor: advancedDraft.primaryColor,
      secondaryColor: advancedDraft.secondaryColor,
      pageBackgroundColor: advancedDraft.pageBackgroundColor,
      storeInfoBackgroundColor: advancedDraft.storeInfoBackgroundColor,
      sectionBackgroundColor: advancedDraft.sectionBackgroundColor,
      productCardBackgroundColor: advancedDraft.productCardBackgroundColor,
      hero: {
        title: advancedDraft.hero?.title || "",
        text: advancedDraft.hero?.text || "",
        buttonLabel: advancedDraft.hero?.buttonLabel || "",
        buttonTarget: advancedDraft.hero?.buttonTarget || "products"
      },
      story: { text: advancedDraft.story?.text || "" },
      featuredProductIds: advancedDraft.featuredProductIds || [],
      sectionOrder: advancedDraft.sectionOrder || DEFAULT_ADVANCED_CUSTOMIZATION.sectionOrder,
      hiddenSections: advancedDraft.hiddenSections || []
    }));
    payload.append("clearHeroImage", String(clearHeroImage));
    payload.append("clearStoryImages", String(clearStoryImages));
    if (heroImageFile) payload.append("heroImage", heroImageFile);
    storyImageFiles.slice(0, 3).forEach((file) => payload.append("storyImages", file));

    try {
      const response = await api.patch("/stores/me", payload, {
        params: { storeType },
        headers: { "Content-Type": "multipart/form-data" }
      });
      setStore((current) => ({ ...current, ...response.data }));
      setAdvancedDraft((current) => ({
        ...current,
        ...(response.data?.advancedCustomization || {}),
        hero: { ...current.hero, ...(response.data?.advancedCustomization?.hero || {}) },
        story: { ...current.story, ...(response.data?.advancedCustomization?.story || {}) }
      }));
      setHeroImageFile(null);
      setStoryImageFiles([]);
      setClearHeroImage(false);
      setClearStoryImages(false);
    } catch (requestError) {
      setAdvancedError(requestError.response?.data?.error || "تعذر حفظ التخصيص المتقدم.");
    } finally {
      setAdvancedSaving(false);
    }
  };

  const resetAdvancedDraft = () => {
    setAdvancedDraft({ ...DEFAULT_ADVANCED_CUSTOMIZATION, hero: { ...DEFAULT_ADVANCED_CUSTOMIZATION.hero }, story: { ...DEFAULT_ADVANCED_CUSTOMIZATION.story } });
    setHeroImageFile(null);
    setStoryImageFiles([]);
    setClearHeroImage(true);
    setClearStoryImages(true);
    setAdvancedError("");
  };

  const canManageStoreProducts = store?.status === "active" && subscriptionStatus === "active";

  const updateContacts = (field, updater) => {
    setForm((current) => ({
      ...current,
      [field]: updater(Array.isArray(current[field]) ? current[field] : [])
    }));
  };

  const startBankAccountDraft = (index = null) => {
    setEditingBankIndex(index);
    setBankDraft(index === null
      ? { bankName: "", accountHolderName: "", accountNumber: "", currency: "YER" }
      : { ...bankAccounts[index] });
  };

  const saveBankAccountDraft = () => {
    if (!bankDraft?.bankName?.trim() || !bankDraft?.accountHolderName?.trim() || !bankDraft?.accountNumber?.trim()) {
      alert("أكمل اسم البنك واسم صاحب الحساب ورقم الحساب.");
      return;
    }
    if (!["YER", "SAR", "USD"].includes(bankDraft.currency)) {
      alert("اختر عملة حساب صحيحة.");
      return;
    }
    setBankAccounts((current) => editingBankIndex === null
      ? [...current, bankDraft]
      : current.map((account, index) => index === editingBankIndex ? bankDraft : account));
    setBankDraft(null);
    setEditingBankIndex(null);
  };

  const removeBankAccount = (index) => {
    setBankAccounts((current) => current.filter((_, itemIndex) => itemIndex !== index));
    if (editingBankIndex === index) {
      setBankDraft(null);
      setEditingBankIndex(null);
    }
  };

  const updateSelectedCategories = (categoryId) => {
    setForm((current) => {
      const selected = current.selectedCategories || [];
      if (selected.includes(categoryId)) {
        return { ...current, selectedCategories: selected.filter((id) => id !== categoryId) };
      }
      if (maxCategories > 0 && selected.length >= maxCategories) {
        alert(`الحد الأقصى لهذه الخطة هو ${maxCategories} تصنيفات.`);
        return current;
      }
      return { ...current, selectedCategories: [...selected, categoryId] };
    });
  };

  const handleArchiveAd = async (adId) => {
    if (!window.confirm("هل تريد أرشفة هذا المنتج؟")) return;

    try {
      await api.patch(`/ads/${adId}/close`, { reason: "archive" });
      setAds((current) => current.filter((ad) => ad._id !== adId));
    } catch (err) {
      alert(err?.response?.data?.error || "تعذر أرشفة المنتج.");
    }
  };

  const handleDeleteAd = async (adId) => {
    if (!window.confirm("هل تريد حذف هذا المنتج نهائيًا؟")) return;

    try {
      await api.delete(`/ads/${adId}`);
      setAds((current) => current.filter((ad) => ad._id !== adId));
    } catch (err) {
      alert(err?.response?.data?.error || "تعذر حذف المنتج.");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-8" dir="rtl" aria-busy="true">
        <div className="ds-skeleton h-28 rounded-3xl" />
        <StoreLoadingCards count={3} />
        <div className="ds-skeleton h-72 rounded-3xl" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-2xl">🏪</div>
          <h1 className="text-2xl font-black text-slate-900">لا يوجد مشروع مسجل</h1>
          <p className="mt-3 text-sm text-slate-600 leading-7">ابدأ بإنشاء متجر أو سجّل مشروع أسرتك في صناعات سوقك.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link to={storeType === "family-production" ? "/family-production/register" : "/seller/store/create"} className="rounded-2xl bg-blue-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-100">{storeType === "family-production" ? "التسجيل في صناعات سوقك" : "إنشاء متجر"}</Link>
            <Link to="/account" className="rounded-2xl border border-slate-200 px-6 py-3 text-sm font-black text-slate-600">حسابي</Link>
          </div>
        </div>
      </div>
    );
  }

  const effectiveStoreStatus = store.effectiveStatus || (
    store.status === "active" && subscriptionStatus !== "active" ? "inactive" : store.status
  );
  const statusLabel = STATUS_MAP[effectiveStoreStatus] || getStoreStatusLabel(effectiveStoreStatus);
  const coverImage = store.cover || store.logo;
  const publicUrl = store.slug ? `/store/${encodeURIComponent(store.slug)}` : "/";
  const publicStoreUrl = store.slug ? `${window.location.origin}/store/${encodeURIComponent(store.slug)}` : "";

  const copyStoreLink = async () => {
    if (!publicStoreUrl) {
      setStoreLinkError("رابط المتجر غير متاح حاليًا.");
      return;
    }

    setStoreLinkError("");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(publicStoreUrl);
      } else {
        const input = document.createElement("textarea");
        input.value = publicStoreUrl;
        input.setAttribute("readonly", "");
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        let copied = false;
        try {
          input.select();
          copied = document.execCommand("copy");
        } finally {
          document.body.removeChild(input);
        }
        if (!copied) throw new Error("Clipboard copy was not available");
      }
      setStoreLinkCopied(true);
      window.setTimeout(() => setStoreLinkCopied(false), 2500);
    } catch (copyError) {
      console.error("Store link copy error:", copyError);
      setStoreLinkCopied(false);
      setStoreLinkError("تعذر نسخ الرابط. يمكنك تحديده ونسخه يدويًا.");
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 pb-24 sm:space-y-6 sm:px-6 sm:py-8" dir="rtl">
      {error && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>
      )}

      <header className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="relative isolate overflow-hidden bg-slate-950 px-5 py-6 text-white sm:px-8 sm:py-8">
          {coverImage && <img src={uploadsUrl(coverImage)} alt="" aria-hidden="true" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-25" />}
          <div className="absolute inset-0 -z-10 bg-gradient-to-l from-slate-950 via-slate-950/90 to-blue-950/60" />
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white/10 sm:h-20 sm:w-20">
                {store.logo
                  ? <img src={uploadsUrl(store.logo)} alt={`شعار ${store.storeName}`} className="h-full w-full object-cover" />
                  : <span className="text-2xl font-black">{store.storeName?.charAt(0) || "م"}</span>}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-blue-200">{store.storeType === "family-production" ? "لوحة المشروع" : "لوحة المتجر"}</p>
                <h1 className="mt-1 truncate text-2xl font-black tracking-tight sm:text-3xl">{store.storeName}</h1>
                <p className="mt-2 truncate text-sm text-white/70">{store.businessActivity || store.location || "إدارة نشاطك التجاري"}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StoreStatusBadge status={store.status} label={statusLabel} />
              {subscription && <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-white/90">{planName}</span>}
            </div>
          </div>
          <nav className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-5" aria-label="إجراءات سريعة">
            {canManageStoreProducts && <Link to={`/add-product?storeProduct=1&storeType=${storeType}`} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-extrabold text-slate-950 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">إضافة منتج</Link>}
            {supportsOrders && <Link to={storeType === "family-production" ? "/my-family-production/orders" : "/my-store/orders"} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-extrabold text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">إدارة الطلبات{supportsNotifications && newOrderCount > 0 && <span className="rounded-full bg-blue-500 px-2 py-0.5 text-xs">{newOrderCount.toLocaleString("ar-EG")}</span>}</Link>}
            <a href="#products" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-extrabold text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">المنتجات</a>
            {supportsAnalytics && <a href="#store-analytics" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-extrabold text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">التحليلات</a>}
            <a href="#customization" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-extrabold text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">تخصيص المتجر</a>
          </nav>
          {effectiveStoreStatus === "active" && subscriptionStatus === "active" && store.slug && (
            <div className="mt-4 grid gap-3 rounded-2xl border border-white/15 bg-white/10 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-4">
              <div className="min-w-0">
                <p className="text-sm font-black text-white">رابط متجرك للتسويق</p>
                <p className="mt-1 text-xs leading-5 text-white/75">
                  شاركه مع عملائك لزيارة منتجاتك.
                  {supportsStorePWA
                    ? " يمكنهم تثبيت المتجر كتطبيق إذا أتاح المتصفح ذلك."
                    : " تثبيت المتجر كتطبيق يتطلب متجرًا نشطًا واشتراكًا ساريًا بخطة تتيح ميزة تطبيق المتجر."}
                </p>
                <input
                  type="url"
                  readOnly
                  value={publicStoreUrl}
                  aria-label="رابط المتجر العام"
                  onFocus={(event) => event.target.select()}
                  className="mt-3 min-h-10 w-full rounded-lg border border-white/20 bg-slate-950/40 px-3 text-left text-xs font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                  dir="ltr"
                />
                {storeLinkError && <p role="alert" className="mt-2 text-xs font-bold text-rose-200">{storeLinkError}</p>}
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={copyStoreLink}
                  className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg bg-white px-4 text-xs font-black text-slate-950 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 sm:flex-none"
                >
                  {storeLinkCopied ? "تم نسخ الرابط ✓" : "نسخ الرابط"}
                </button>
                <Link
                  to={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border border-white/20 px-4 text-xs font-black text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 sm:flex-none"
                >
                  فتح المتجر
                </Link>
              </div>
            </div>
          )}
        </div>
      </header>

      {store.status === "rejected" && (
        <section className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5" role="status">
          <div>
            <p className="text-sm font-black text-rose-950">تم رفض طلب {storeType === "family-production" ? "صناعات سوقك" : "المتجر"}</p>
            <p className="mt-1 text-xs leading-5 text-rose-800">
              {store.rejectedReason
                ? `سبب الرفض: ${store.rejectedReason}`
                : "يمكنك بدء طلب جديد وإعادة تقديمه للمراجعة."}
            </p>
          </div>
          <Link
            to={storeType === "family-production" ? "/family-production/register" : "/seller/store/create"}
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-rose-700 px-4 text-xs font-extrabold text-white transition hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
          >
            إعادة تقديم الطلب
          </Link>
        </section>
      )}
      {store.status === "pending" && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900" role="status">
          طلب {storeType === "family-production" ? "صناعات سوقك" : "المتجر"} قيد المراجعة. ستصبح خصائص المتجر متاحة بعد اعتماد الطلب.
        </section>
      )}

      {subscription && subscriptionStatus !== "active" && (
        <section className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 ${
          renewalRequest ? "border-amber-200 bg-amber-50" : "border-rose-200 bg-rose-50"
        }`} role="status">
          <div>
            <p className={`text-sm font-black ${renewalRequest ? "text-amber-950" : "text-rose-950"}`}>
              {renewalRequest ? "طلب تجديد اشتراكك قيد المراجعة" : "الاشتراك غير نشط"}
            </p>
            <p className={`mt-1 text-xs leading-5 ${renewalRequest ? "text-amber-800" : "text-rose-800"}`}>
              {renewalRequest
                ? "ستعود خصائص الخطة بعد اعتماد التجديد."
                : "قد تتوقف بعض خصائص المتجر حتى تجديد الاشتراك أو تفعيله."}
            </p>
          </div>
          <a href="#subscription" className={`inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl px-4 text-xs font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
            renewalRequest ? "bg-amber-900 text-white focus-visible:ring-amber-500" : "bg-rose-900 text-white focus-visible:ring-rose-500"
          }`}>{renewalRequest ? "عرض حالة التجديد" : "إدارة الاشتراك"}</a>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-6 sm:px-6">
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-slate-500">نبذة النشاط</p>
          <p className="mt-1 text-sm font-black text-slate-900">{store.businessActivity || "نشاط المتجر"}</p>
          {store.description && <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-slate-600">{store.description}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {store.location && <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">{store.location}</span>}
            {categories.slice(0, 4).map((category) => <span key={category} className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800">{category}</span>)}
            {categories.length > 4 && <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">+{(categories.length - 4).toLocaleString("ar-EG")}</span>}
          </div>
        </div>
        {(store.phone || store.email) && (
          <div className="mt-4 flex shrink-0 flex-wrap gap-2 border-t border-slate-100 pt-3 sm:mt-0 sm:border-0 sm:pt-0">
            {store.phone && <a href={`tel:${store.phone}`} className="inline-flex min-h-10 items-center rounded-xl bg-blue-50 px-4 text-xs font-extrabold text-blue-800 transition hover:bg-blue-100">اتصال</a>}
            {store.email && <a href={`mailto:${store.email}`} className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-4 text-xs font-extrabold text-slate-700 transition hover:bg-slate-50">بريد إلكتروني</a>}
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="ملخص المتجر">
        <StoreStatCard
          label="المنتجات"
          value={ads.length.toLocaleString("ar-EG")}
          detail={maxProducts > 0 ? `من حد الخطة ${maxProducts.toLocaleString("ar-EG")}` : "حد المنتجات غير محدود"}
          tone="blue"
          icon={<svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="m4 7 8-4 8 4-8 4-8-4Zm0 0v10l8 4 8-4V7M12 11v10" /></svg>}
        />
        <StoreStatCard
          label="الطلبات الجديدة"
          value={supportsAnalytics && analytics ? Number(analytics.orders?.new || 0).toLocaleString("ar-EG") : "—"}
          detail={supportsAnalytics ? "ضمن الفترة المحددة في التحليلات" : "تتطلب ميزة التحليلات في الخطة"}
          tone="violet"
          icon={<svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16v15H4zM8 3v4m8-4v4M8 11h8m-8 4h5" /></svg>}
        />
        <StoreStatCard
          label="قيمة الطلبات"
          value={supportsAnalytics && analytics?.orders?.totalValueByCurrency?.length
            ? <span className="flex flex-col gap-1">{analytics.orders.totalValueByCurrency.map(({ currency, total }) => <span key={currency}>{Number(total || 0).toLocaleString("ar-EG")} <small className="text-xs font-bold">{getStoreCurrencyLabel(currency)}</small></span>)}</span>
            : supportsAnalytics && analytics ? "0" : "—"}
          detail={supportsAnalytics ? "كل عملة معروضة منفصلة دون تحويل" : "تتطلب ميزة التحليلات في الخطة"}
          tone="emerald"
          icon={<svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M4 18V6m0 12h16M8 14l3-3 3 2 5-6" /></svg>}
        />
        <StoreStatCard
          label="الفئات المختارة"
          value={categories.length.toLocaleString("ar-EG")}
          detail={subscriptionStatus === "active" ? `ضمن الخطة ${planName}` : "تحقق من حالة الاشتراك"}
          tone="amber"
          icon={<svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /></svg>}
        />
      </section>

      <section className={`rounded-2xl border p-4 ${supportsNotifications ? "border-emerald-100 bg-emerald-50" : "border-amber-100 bg-amber-50"}`}>
        <h3 className="text-sm font-black text-slate-900">إشعارات المتجر</h3>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          {supportsNotifications
            ? "الميزة متاحة في باقتك واشتراك المتجر نشط. ستظهر إشعارات نشاط المتجر داخل التطبيق."
            : "هذه الميزة غير متاحة في خطتك الحالية أو أن الاشتراك غير نشط."}
        </p>
        <p className="mt-2 text-xs font-bold text-slate-700">
          حالة اشتراك المتجر: {subscriptionStatus === "active" ? "نشط" : subscriptionStatus === "expired" ? "منتهي" : "غير نشط"}
        </p>
        {supportsNotifications && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-slate-700">
              إشعارات المتصفح: {{
                enabled: "مفعّلة على هذا الجهاز",
                "not-enabled": "غير مفعّلة",
                denied: "مرفوضة من المتصفح",
                unsupported: "غير مدعومة على هذا المتصفح",
                error: "تعذر التحقق",
                checking: "جارٍ التحقق...",
                unavailable: "غير متاحة"
              }[ownerPushStatus] || "غير معروفة"}
            </span>
            <button
              type="button"
              onClick={enableOwnerPush}
              disabled={ownerPushSaving || ownerPushStatus === "enabled" || ownerPushStatus === "denied" || ownerPushStatus === "unsupported"}
              className="min-h-10 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {ownerPushSaving ? "جارٍ التفعيل..." : ownerPushStatus === "enabled" ? "مفعّلة على هذا الجهاز" : "تفعيل إشعارات المتصفح"}
            </button>
          </div>
        )}
        {ownerPushError && <p role="alert" className="mt-2 text-xs font-bold text-rose-700">{ownerPushError}</p>}
      </section>

      {supportsAnalytics && (
        <section id="store-analytics" className="scroll-mt-24 rounded-[2rem] border border-violet-100 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black text-violet-700">تحليلات المتجر</p>
              <h3 className="text-xl font-black text-slate-900">إحصائيات المتجر</h3>
            </div>
            <label className="text-xs font-bold text-slate-600">
              الفترة
              <select
                value={analyticsRange}
                onChange={(event) => setAnalyticsRange(event.target.value)}
                className="mr-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold"
              >
                <option value="1d">اليوم</option>
                <option value="7d">آخر 7 أيام</option>
                <option value="30d">آخر 30 يومًا</option>
              </select>
            </label>
          </div>
          {analyticsError && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{analyticsError}</p>}
          {analyticsLoading && <p className="py-8 text-center text-sm font-bold text-slate-500">جارٍ تحميل الإحصائيات...</p>}
          {!analyticsLoading && analytics && (
            <>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
                {[
                  ["مشاهدات المتجر", analytics.storeViews],
                  ["مشاهدات المنتجات", analytics.productViews],
                  ["المتابعون", analytics.followers],
                  ["تثبيتات تطبيق المتجر", supportsStorePWA ? analytics.pwaInstallations : "—"],
                  ["عدد المنتجات", analytics.productsCount],
                  ["عدد الطلبات", analytics.orders.total],
                  ["الطلبات الجديدة", analytics.orders.new],
                  ["الطلبات المكتملة", analytics.orders.completed]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[11px] font-bold text-slate-500">{label}</p>
                    <p className="mt-1 text-xl font-black text-slate-900">{typeof value === "number" ? value.toLocaleString("ar-EG") : value}</p>
                    {label === "تثبيتات تطبيق المتجر" && <p className="mt-1 text-[10px] leading-4 text-slate-500">{supportsStorePWA ? "الإجمالي منذ بدء التسجيل؛ لا يمثل عدد الأجهزة المثبتة حاليًا." : "تتطلب ميزة تطبيق المتجر في الخطة."}</p>}
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)]">
                <div className="rounded-2xl border border-slate-100 p-3">
                  <p className="mb-2 text-sm font-black text-slate-700">المشاهدات خلال الفترة</p>
                  {analytics.dailyViews.every((day) => day.views === 0)
                    ? <p className="py-10 text-center text-sm text-slate-500">لا توجد بيانات كافية حتى الآن.</p>
                    : (
                      <div className="h-56 w-full" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={analytics.dailyViews}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" tickFormatter={(date) => date.slice(5)} />
                            <YAxis allowDecimals={false} />
                            <Tooltip labelFormatter={(date) => `التاريخ: ${date}`} />
                            <Line type="monotone" dataKey="views" name="المشاهدات" stroke="#7c3aed" strokeWidth={3} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                </div>
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-100 p-4">
                    <p className="text-sm font-black text-slate-700">إجمالي قيمة الطلبات</p>
                    {analytics.orders.totalValueByCurrency.length
                      ? analytics.orders.totalValueByCurrency.map(({ currency, total }) => (
                        <p key={currency} className="mt-2 text-lg font-black text-emerald-700">
                          {Number(total || 0).toLocaleString("ar-EG")} <span className="text-xs">{getStoreCurrencyLabel(currency)}</span>
                        </p>
                      ))
                      : <p className="mt-2 text-sm text-slate-500">لا توجد طلبات خلال هذه الفترة.</p>}
                  </div>
                  <div className="rounded-2xl border border-slate-100 p-4">
                    <p className="text-sm font-black text-slate-700">الأكثر مشاهدة</p>
                    {analytics.topProducts.length
                      ? <ol className="mt-2 space-y-2">{analytics.topProducts.map((product) => (
                        <li key={product.productId} className="flex justify-between gap-3 text-sm">
                          <span className="line-clamp-1 font-bold text-slate-700">{product.title}</span>
                          <span className="shrink-0 text-slate-500">{Number(product.views).toLocaleString("ar-EG")}</span>
                        </li>
                      ))}</ol>
                      : <p className="mt-2 text-sm text-slate-500">لا توجد بيانات كافية حتى الآن.</p>}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      <details className="group rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6" dir="rtl">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <div>
              <p className="text-xs font-black text-blue-600">{store.storeType === "family-production" ? "تخصيص المشروع" : "تخصيص المتجر"}</p>
              <h3 id="customization" className="scroll-mt-24 text-xl font-black text-slate-900">إدارة بيانات {store.storeType === "family-production" ? "المشروع" : "المتجر"}</h3>
          </div>
          <svg aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-500 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
          </svg>
        </summary>

        <div className="mt-5">
        {supportsCustomization ? (
        <form onSubmit={handleCustomizationSubmit} className="grid gap-4">
          <div className="grid gap-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-sm md:grid-cols-2">
            <div>
              <p className="font-bold text-slate-500">{store.storeType === "family-production" ? "اسم المشروع" : "اسم المتجر"} · ثابت</p>
              <p className="mt-1 font-black text-slate-900">{store.storeName || "—"}</p>
            </div>
            <div>
              <p className="font-bold text-slate-500">{store.storeType === "family-production" ? "نوع الحرفة أو الصناعة" : "نوع النشاط"} · ثابت</p>
              <p className="mt-1 font-black text-slate-900">{store.businessActivity || "—"}</p>
            </div>
            <div>
              <p className="font-bold text-slate-500">نوع الحساب · ثابت</p>
              <p className="mt-1 font-black text-slate-900">{store.storeType === "family-production" ? "أسرة منتجة" : "متجر"}</p>
            </div>
            <div>
              <p className="font-bold text-slate-500">رابط سوقك · ثابت</p>
              {publicStoreUrl
                ? <a href={publicUrl} target="_blank" rel="noreferrer" dir="ltr" className="mt-1 block break-all font-black text-blue-700 hover:underline">{publicStoreUrl}</a>
                : <p className="mt-1 font-black text-slate-900">غير متاح حاليًا</p>}
            </div>
          </div>

          <label className="block text-sm font-black text-slate-700">
            الوصف
            <textarea name="description" value={form.description} onChange={handleCustomizationChange} rows={4} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none focus:border-blue-500" placeholder="اكتب وصفًا مختصرًا عن المتجر" />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-black text-slate-700">
              العنوان / الموقع
              <input name="location" value={form.location} onChange={handleCustomizationChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none focus:border-blue-500" placeholder="المدينة أو العنوان" />
            </label>
            <div className="space-y-3">
              <p className="text-sm font-black text-slate-700">أرقام الهاتف</p>
              {(supportsMultipleContacts ? form.phones || [] : (form.phones || []).slice(0, 1)).map((contact, index) => (
                <div key={`phone-${index}`} className="flex gap-2">
                  <input inputMode={store.storeType === "family-production" ? "numeric" : undefined} maxLength={store.storeType === "family-production" ? 9 : undefined} value={contact.value || ""} onChange={(event) => updateContacts("phones", (items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, type: "mobile", value: store.storeType === "family-production" ? event.target.value.replace(/\D/g, "").slice(0, 9) : event.target.value } : item))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800" placeholder={store.storeType === "family-production" ? "9 أرقام" : "رقم الهاتف"} />
                  <button type="button" onClick={() => updateContacts("phones", (items) => items.filter((_, itemIndex) => itemIndex !== index))} className="rounded-xl border border-red-200 px-3 text-sm font-black text-red-700" aria-label="حذف رقم الهاتف">حذف</button>
                </div>
              ))}
              {(supportsMultipleContacts || !(form.phones || []).length) && (form.phones || []).length < 5 && <button type="button" onClick={() => updateContacts("phones", (items) => [...items, { type: "mobile", value: "" }])} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700">إضافة رقم هاتف</button>}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-black text-slate-700">
              المحافظة
              <select value={form.governorateId} onChange={(e) => {
                setCityIsOther(false);
                setForm((current) => ({ ...current, governorateId: e.target.value, cityId: "", customCityName: "" }));
              }} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none focus:border-blue-500">
                <option value="">اختر المحافظة</option>
                {(governorates || []).map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
              </select>
            </label>
            <label className="block text-sm font-black text-slate-700">
              المدينة
              <select value={cityIsOther ? "other" : form.cityId} onChange={(e) => {
                const isOther = e.target.value === "other";
                setCityIsOther(isOther);
                setForm((current) => ({ ...current, cityId: isOther ? "" : e.target.value, customCityName: isOther ? current.customCityName : "" }));
              }} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none focus:border-blue-500" disabled={!form.governorateId && !form.customCityName.trim()}>
                <option value="">{form.governorateId ? "اختر المدينة" : "اختر المحافظة أولاً"}</option>
                {(cities || []).map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
                {form.governorateId && <option value="other">أخرى</option>}
              </select>
            </label>
          </div>

          {(cityIsOther || !form.governorateId) && <label className="block text-sm font-black text-slate-700">
            مدينة أخرى
            <input name="customCityName" value={form.customCityName} onChange={handleCustomizationChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none focus:border-blue-500" placeholder="اكتب المدينة إذا كانت غير موجودة" />
          </label>}

          <fieldset className="space-y-3 rounded-2xl border border-slate-200 p-4">
            <legend className="px-2 text-sm font-black text-slate-700">تصنيفات المتجر</legend>
            <p className="text-xs text-slate-500">حد التصنيفات: {maxCategories > 0 ? maxCategories : "غير محدود"}</p>
            <p className="text-xs text-slate-500">تعرض هذه القائمة تصنيفات النشاط المختار؛ وتبقى التصنيفات المحفوظة سابقًا ظاهرة للحفاظ على بيانات المتجر.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {activityCategoryOptions.map((category) => {
                const categoryId = String(category._id || category.id);
                const isLegacyCategory = Boolean(selectedActivity
                  && !selectedActivity.allowedCategorySlugs.includes(category.slug)
                  && (form.selectedCategories || []).includes(categoryId));
                return (
                  <label key={categoryId} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">
                    <input type="checkbox" checked={(form.selectedCategories || []).includes(categoryId)} onChange={() => updateSelectedCategories(categoryId)} />
                    <span>{category.name}{isLegacyCategory ? " (محفوظ سابقًا)" : ""}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <section className="space-y-3 rounded-2xl border border-sky-100 bg-sky-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black text-slate-800">الموقع الدقيق على الخريطة (اختياري)</p>
                <p className="mt-1 text-xs text-slate-600">حدد الموقع يدويًا عند الحاجة، دون الاعتماد على موقع جهازك.</p>
              </div>
              <button type="button" onClick={() => setMapOpen(true)} className="rounded-xl bg-sky-700 px-4 py-3 text-sm font-black text-white">
                {form.lat && form.lng ? "تعديل الموقع على الخريطة" : "تحديد الموقع على الخريطة"}
              </button>
            </div>
            {form.lat && form.lng && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/80 px-3 py-2">
              <p className="text-xs font-bold text-slate-600" dir="ltr">{Number(form.lat).toFixed(6)}, {Number(form.lng).toFixed(6)}</p>
              <button type="button" onClick={() => setForm((current) => ({ ...current, lat: "", lng: "" }))} className="text-sm font-bold text-red-700 underline underline-offset-2">إزالة الموقع</button>
            </div>}
          </section>

          <div className="space-y-3">
            <p className="text-sm font-black text-slate-700">أرقام واتساب</p>
            {(supportsMultipleContacts ? form.whatsapp || [] : (form.whatsapp || []).slice(0, 1)).map((contact, index) => (
              <div key={`whatsapp-${index}`} className="flex gap-2">
                <input inputMode={store.storeType === "family-production" ? "numeric" : undefined} maxLength={store.storeType === "family-production" ? 9 : undefined} value={contact.value || ""} onChange={(event) => updateContacts("whatsapp", (items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, type: "whatsapp", value: store.storeType === "family-production" ? event.target.value.replace(/\D/g, "").slice(0, 9) : event.target.value } : item))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800" placeholder={store.storeType === "family-production" ? "9 أرقام" : "رقم واتساب"} />
                <button type="button" onClick={() => updateContacts("whatsapp", (items) => items.filter((_, itemIndex) => itemIndex !== index))} className="rounded-xl border border-red-200 px-3 text-sm font-black text-red-700" aria-label="حذف رقم واتساب">حذف</button>
              </div>
            ))}
            {(supportsMultipleContacts || !(form.whatsapp || []).length) && (form.whatsapp || []).length < 5 && <button type="button" onClick={() => updateContacts("whatsapp", (items) => [...items, { type: "whatsapp", value: "" }])} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700">إضافة رقم واتساب</button>}
          </div>

          <fieldset className="grid gap-4 rounded-2xl border border-slate-200 p-4 sm:grid-cols-2">
            <legend className="px-2 text-sm font-black text-slate-700">روابط التواصل الاجتماعي</legend>
            {[
              ["facebook", "فيسبوك"],
              ["instagram", "إنستغرام"],
              ["tiktok", "تيك توك"],
              ["youtube", "يوتيوب"],
              ["whatsappChannel", "قناة أو مجموعة واتساب"]
            ].map(([platform, label]) => (
              <label key={platform} className="block text-sm font-black text-slate-700">
                {label}
                <input
                  type="url"
                  value={form.social?.[platform] || ""}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    social: { ...current.social, [platform]: event.target.value }
                  }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none focus:border-blue-500"
                  placeholder={platform === "whatsappChannel" ? "أدخل رابط القناة أو المجموعة" : "أدخل رابط التواصل"}
                />
              </label>
            ))}
          </fieldset>

          <fieldset className="space-y-4 rounded-2xl border border-slate-200 p-4">
            <legend className="px-2 text-sm font-black text-slate-700">الحسابات البنكية</legend>
            <p className="text-xs text-slate-500">تُحفظ الحسابات ضمن بيانات المتجر الخاصة، ولا تظهر في صفحة المتجر العامة.</p>
            {bankAccounts.length === 0 && !bankDraft && (
              <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">لا توجد حسابات بنكية مضافة.</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {bankAccounts.map((account, index) => (
                <div key={account._id || `bank-account-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-800">{account.bankName}</p>
                    <p className="mt-1 truncate text-xs text-slate-600">{account.accountHolderName} · {account.accountNumber}</p>
                    <p className="mt-1 text-xs font-bold text-blue-700">{getStoreCurrencyLabel(account.currency)}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => startBankAccountDraft(index)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700">تعديل</button>
                    <button type="button" onClick={() => removeBankAccount(index)} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700">حذف</button>
                  </div>
                </div>
              ))}
            </div>
            {bankDraft ? (
              <div className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
                <label className="text-sm font-bold text-slate-700">
                  اسم البنك
                  <input required maxLength={120} value={bankDraft.bankName} onChange={(event) => setBankDraft((current) => ({ ...current, bankName: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm" />
                </label>
                <label className="text-sm font-bold text-slate-700">
                  اسم صاحب الحساب
                  <input required maxLength={120} value={bankDraft.accountHolderName} onChange={(event) => setBankDraft((current) => ({ ...current, accountHolderName: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm" />
                </label>
                <label className="text-sm font-bold text-slate-700">
                  رقم الحساب
                  <input required maxLength={80} value={bankDraft.accountNumber} onChange={(event) => setBankDraft((current) => ({ ...current, accountNumber: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm" />
                </label>
                <label className="text-sm font-bold text-slate-700">
                  عملة الحساب
                  <select value={bankDraft.currency} onChange={(event) => setBankDraft((current) => ({ ...current, currency: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
                    <option value="YER">ريال يمني</option>
                    <option value="SAR">ريال سعودي</option>
                    <option value="USD">دولار أمريكي</option>
                  </select>
                </label>
                <div className="flex gap-2 sm:col-span-2">
                  <button type="button" onClick={saveBankAccountDraft} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white">{editingBankIndex === null ? "إضافة للقائمة" : "حفظ تعديل الحساب"}</button>
                  <button type="button" onClick={() => { setBankDraft(null); setEditingBankIndex(null); }} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">إلغاء</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => startBankAccountDraft()} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-black text-blue-700">إضافة حساب بنكي</button>
            )}
            <p className="text-xs font-medium text-slate-500">استخدم زر «حفظ التعديلات» أسفل النموذج لحفظ تغييرات الحسابات.</p>
          </fieldset>

          <label className="block text-sm font-black text-slate-700">
            اللون الأساسي
            <input type="color" value={form.primaryColor || "#0b89ed"} onChange={(e) => setForm((current) => ({ ...current, primaryColor: e.target.value }))} className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-2 py-2 text-sm" />
          </label>

          <label className="block text-sm font-black text-slate-700">
            بريد التواصل العام (اختياري، يظهر للزوار)
            <input name="email" type="email" value={form.email} onChange={handleCustomizationChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none focus:border-blue-500" placeholder="أدخل البريد الإلكتروني" />
          </label>
          <label className="block text-sm font-black text-slate-700">
            بريد إشعارات الطلبات (خاص)
            <input name="notificationEmail" type="email" value={form.notificationEmail} onChange={handleCustomizationChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none focus:border-blue-500" placeholder="أدخل البريد الخاص بإشعارات الطلبات" />
            {!store.notificationEmail && <span className="mt-2 block text-xs font-medium text-amber-700">ملفك قديم ولا يحتوي على بريد إشعارات. أضفه لتلقي إشعارات الطلبات الجديدة.</span>}
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-black text-slate-700">
              شعار المتجر
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setForm((current) => ({ ...current, logo: event.target.files?.[0] || null }))} className="mt-2 block w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-600" />
            </label>
            <label className="block text-sm font-black text-slate-700">
              صورة الغلاف
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setForm((current) => ({ ...current, cover: event.target.files?.[0] || null }))} className="mt-2 block w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-600" />
            </label>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button type="submit" disabled={isSaving} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-100 disabled:opacity-60">
              {isSaving ? "جاري الحفظ..." : "حفظ التعديلات"}
            </button>
            {effectiveStoreStatus === "active" && subscriptionStatus === "active" && <Link to={publicUrl} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700">عرض متجري</Link>}
          </div>
        </form>
        ) : (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            هذه الميزة غير متاحة في باقتك الحالية.
          </p>
        )}
        </div>
      </details>

      <section id="advanced-customization" className="scroll-mt-24 rounded-[2rem] border border-indigo-100 bg-white p-4 shadow-sm sm:p-6" dir="rtl">
        <div className="mb-5">
          <p className="text-xs font-black text-indigo-600">هوية وتجربة المتجر</p>
          <h3 className="mt-1 text-xl font-black text-slate-900">التخصيص المتقدم</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">اختر نمطًا خفيفًا، ورتّب أقسام صفحتك، ثم راجع المعاينة قبل الحفظ.</p>
        </div>

        {supportsAdvancedCustomization ? (
          <form onSubmit={handleAdvancedCustomizationSubmit} className="grid gap-5">
            {advancedError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{advancedError}</p>}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["classic", "كلاسيكي", "ألوان سوقك المعتادة: أزرق واضح وخلفيات محايدة."],
                ["calm", "هادئ", "أخضر مريمي هادئ مع عاجي وخلفيات طبيعية فاتحة."],
                ["professional", "احترافي", "بنفسجي ملكي وكحلي مع لمسات لافندر وسماوي وعاجي."],
                ["custom", "مخصص", "اختر ألوان الهوية والخلفيات الست بنفسك."]
              ].map(([value, label, description]) => (
                <label key={value} className={`cursor-pointer rounded-2xl border p-4 transition ${advancedDraft.theme === value ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100" : "border-slate-200 bg-white"}`}>
                  <span className="flex items-center gap-2 text-sm font-black text-slate-900">
                    <input type="radio" name="advancedTheme" value={value} checked={advancedDraft.theme === value} onChange={() => updateAdvancedTheme(value)} />
                    {label}
                  </span>
                  <span className="mt-2 block text-xs leading-5 text-slate-600">{description}</span>
                  <span className="mt-3 flex gap-1.5" aria-label={`معاينة ألوان ${label}`}>
                    {(value === "custom"
                      ? ["primaryColor", "secondaryColor", "pageBackgroundColor", "storeInfoBackgroundColor", "sectionBackgroundColor", "productCardBackgroundColor"].map((field) => advancedDraft[field])
                      : Object.values(STORE_ADVANCED_PALETTES[value] || advancedDraft)
                    ).map((color, index) => (
                      <span key={`${value}-${index}`} title={color} className="h-5 min-w-0 flex-1 rounded-md border border-black/10" style={{ backgroundColor: color }} />
                    ))}
                  </span>
                </label>
              ))}
            </div>

            {advancedDraft.theme === "custom" ? (
              <fieldset className="grid gap-4 rounded-2xl border border-slate-200 p-4">
                <legend className="px-2 text-sm font-black text-slate-800">ألوان المتجر المخصصة</legend>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ["primaryColor", "اللون الأساسي"],
                    ["secondaryColor", "اللون الثانوي"],
                    ["pageBackgroundColor", "خلفية صفحة المتجر"],
                    ["storeInfoBackgroundColor", "مربع معلومات المتجر"],
                    ["sectionBackgroundColor", "مربعات الأقسام والعروض"],
                    ["productCardBackgroundColor", "بطاقات المنتجات"]
                  ].map(([field, label]) => (
                    <label key={field} className="text-sm font-bold text-slate-700">
                      {label}
                      <input
                        type="color"
                        value={advancedDraft[field]}
                        onChange={(event) => updateAdvancedDraft(field, event.target.value)}
                        className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white p-1"
                      />
                    </label>
                  ))}
                </div>
                <p className="text-xs leading-5 text-slate-500">تُطبّق الألوان على صفحة هذا المتجر فقط، مع الحفاظ على وضوح النصوص.</p>
              </fieldset>
            ) : (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
                تُطبّق لوحة ألوان {advancedDraft.theme === "calm" ? "هادئ" : advancedDraft.theme === "professional" ? "احترافي" : "كلاسيكي"} تلقائيًا على الصفحة والمعلومات والأقسام والمنتجات.
              </p>
            )}

            <fieldset className="grid gap-4 rounded-2xl border border-slate-200 p-4">
              <legend className="px-2 text-sm font-black text-slate-800">القسم الرئيسي</legend>
              <label className="text-sm font-bold text-slate-700">العنوان
                <input maxLength={100} value={advancedDraft.hero?.title || ""} onChange={(event) => updateAdvancedNestedDraft("hero", "title", event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3" />
              </label>
              <label className="text-sm font-bold text-slate-700">النص
                <textarea maxLength={300} rows={3} value={advancedDraft.hero?.text || ""} onChange={(event) => updateAdvancedNestedDraft("hero", "text", event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3" />
              </label>
              <label className="text-sm font-bold text-slate-700">صورة القسم الرئيسي
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  setHeroImageFile(file);
                  setHeroImagePreview(file ? URL.createObjectURL(file) : "");
                  setClearHeroImage(false);
                }} className="mt-2 block min-h-11 w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm" />
              </label>
              {(heroImagePreview || (advancedDraft.hero?.image && !clearHeroImage)) && (
                <div className="flex items-center gap-3">
                  <img src={heroImagePreview || uploadsUrl(advancedDraft.hero.image)} alt="معاينة صورة القسم الرئيسي" className="h-20 w-32 rounded-xl object-cover" />
                  <button type="button" onClick={() => { setHeroImageFile(null); setHeroImagePreview(""); setClearHeroImage(true); }} className="min-h-10 rounded-lg border border-red-200 px-3 text-xs font-bold text-red-700">إزالة الصورة عند الحفظ</button>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-bold text-slate-700">نص الزر (اختياري)
                  <input maxLength={30} value={advancedDraft.hero?.buttonLabel || ""} onChange={(event) => updateAdvancedNestedDraft("hero", "buttonLabel", event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3" />
                </label>
                <label className="text-sm font-bold text-slate-700">وجهة داخل المتجر
                  <select value={advancedDraft.hero?.buttonTarget || "products"} onChange={(event) => updateAdvancedNestedDraft("hero", "buttonTarget", event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3">
                    <option value="products">المنتجات</option>
                    <option value="story">قصتنا</option>
                    <option value="contact">التواصل</option>
                  </select>
                </label>
              </div>
            </fieldset>

            <fieldset className="grid gap-4 rounded-2xl border border-slate-200 p-4">
              <legend className="px-2 text-sm font-black text-slate-800">قصتنا</legend>
              <label className="text-sm font-bold text-slate-700">نبذة عن المتجر أو الأسرة المنتجة
                <textarea maxLength={1200} rows={4} value={advancedDraft.story?.text || ""} onChange={(event) => updateAdvancedNestedDraft("story", "text", event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3" />
              </label>
              <label className="text-sm font-bold text-slate-700">صور اختيارية (حتى 3 صور)
                <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => {
                  const files = Array.from(event.target.files || []).slice(0, 3);
                  setStoryImageFiles(files);
                  setStoryImagePreviews(files.map((file) => URL.createObjectURL(file)));
                  setClearStoryImages(false);
                }} className="mt-2 block min-h-11 w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm" />
              </label>
              {storyImagesToPreview.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {storyImagesToPreview.map((image, index) => (
                    <img key={`${image}-${index}`} src={storyImagePreviews.length ? image : uploadsUrl(image)} alt={`صورة من قصتنا ${index + 1}`} className="h-20 w-24 rounded-xl object-cover" />
                  ))}
                  <button type="button" onClick={() => { setStoryImageFiles([]); setStoryImagePreviews([]); setClearStoryImages(true); }} className="min-h-10 rounded-lg border border-red-200 px-3 text-xs font-bold text-red-700">إزالة الصور عند الحفظ</button>
                </div>
              )}
            </fieldset>

            <fieldset className="grid gap-3 rounded-2xl border border-slate-200 p-4">
              <legend className="px-2 text-sm font-black text-slate-800">منتجات مميزة</legend>
              <p className="text-xs leading-5 text-slate-500">يمكن إبراز حتى 8 منتجات منشورة تابعة لهذا المتجر.</p>
              {featuredCandidates.length ? featuredCandidates.map((product) => {
                const productId = String(product._id);
                const selected = advancedDraft.featuredProductIds?.includes(productId);
                return (
                  <label key={productId} className="flex min-h-11 items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
                    <input type="checkbox" checked={selected} disabled={!selected && advancedDraft.featuredProductIds?.length >= 8} onChange={(event) => {
                      const current = advancedDraft.featuredProductIds || [];
                      updateAdvancedDraft("featuredProductIds", event.target.checked
                        ? [...current, productId]
                        : current.filter((id) => id !== productId));
                    }} />
                    <span className="min-w-0 flex-1 truncate">{product.title}</span>
                    <span className="shrink-0 text-xs text-slate-500">{Number(product.price || 0).toLocaleString("ar-EG")}</span>
                  </label>
                );
              }) : <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">لا توجد منتجات منشورة قابلة للاختيار حاليًا.</p>}
            </fieldset>

            <fieldset className="grid gap-2 rounded-2xl border border-slate-200 p-4">
              <legend className="px-2 text-sm font-black text-slate-800">ترتيب وإظهار الأقسام</legend>
              {[
                ["intro", "نبذة النشاط"],
                ["hero", "القسم الرئيسي"],
                ["story", "قصتنا"],
                ["featuredProducts", "المنتجات المميزة"],
                ["products", "كل المنتجات"]
              ].map(([section, label]) => {
                const order = advancedDraft.sectionOrder || DEFAULT_ADVANCED_CUSTOMIZATION.sectionOrder;
                const orderIndex = order.indexOf(section);
                return (
                  <div key={section} className="flex min-h-12 items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
                    <input type="checkbox" checked={!advancedDraft.hiddenSections?.includes(section)} aria-label={`إظهار ${label}`} onChange={(event) => {
                      const hidden = advancedDraft.hiddenSections || [];
                      updateAdvancedDraft("hiddenSections", event.target.checked
                        ? hidden.filter((item) => item !== section)
                        : [...hidden, section]);
                    }} />
                    <span className="min-w-0 flex-1 text-sm font-bold text-slate-700">{label}</span>
                    <button type="button" disabled={orderIndex === 0} onClick={() => moveAdvancedSection(section, -1)} aria-label={`تحريك ${label} للأعلى`} className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm disabled:opacity-40">↑</button>
                    <button type="button" disabled={orderIndex === order.length - 1} onClick={() => moveAdvancedSection(section, 1)} aria-label={`تحريك ${label} للأسفل`} className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm disabled:opacity-40">↓</button>
                  </div>
                );
              })}
            </fieldset>

            <div className="overflow-hidden rounded-2xl border p-4 sm:p-6" style={{ backgroundColor: advancedDraft.pageBackgroundColor, borderColor: `${advancedDraft.primaryColor}55`, color: advancedDraft.secondaryColor }}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-sm font-black">معاينة تقريبية قبل الحفظ</h4>
                <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ backgroundColor: advancedDraft.storeInfoBackgroundColor, color: advancedDraft.secondaryColor }}>{store.storeName}</span>
              </div>
              <div className="grid gap-2">
                {(advancedDraft.sectionOrder || DEFAULT_ADVANCED_CUSTOMIZATION.sectionOrder)
                  .filter((section) => !advancedDraft.hiddenSections?.includes(section))
                  .map((section) => {
                    if (section === "intro") return <p key={section} className="rounded-xl p-3 text-sm font-bold" style={{ backgroundColor: advancedDraft.sectionBackgroundColor }}>{store.businessActivity || "نبذة النشاط"}</p>;
                    if (section === "hero") return (
                      <div key={section} className="rounded-xl p-3" style={{ backgroundColor: advancedDraft.sectionBackgroundColor }}>
                        {(heroImagePreview || (advancedDraft.hero?.image && !clearHeroImage)) && <img src={heroImagePreview || uploadsUrl(advancedDraft.hero.image)} alt="" className="mb-3 h-32 w-full rounded-lg object-cover" />}
                        <p className="font-black">{advancedDraft.hero?.title || "القسم الرئيسي"}</p>
                        {advancedDraft.hero?.text && <p className="mt-1 text-sm leading-6">{advancedDraft.hero.text}</p>}
                        {advancedDraft.hero?.buttonLabel && <span className="mt-2 inline-flex rounded-lg px-3 py-2 text-xs font-bold text-white" style={{ backgroundColor: advancedDraft.primaryColor }}>{advancedDraft.hero.buttonLabel}</span>}
                      </div>
                    );
                    if (section === "story") return (
                      <div key={section} className="rounded-xl border p-3" style={{ backgroundColor: advancedDraft.sectionBackgroundColor, borderColor: `${advancedDraft.primaryColor}55` }}>
                        <p className="font-black">قصتنا</p>
                        <p className="mt-1 line-clamp-2 text-sm">{advancedDraft.story?.text || "ستظهر هنا قصة المتجر أو الأسرة."}</p>
                        {!!storyImagesToPreview.length && <div className="mt-2 flex gap-2">{storyImagesToPreview.map((image, index) => <img key={`${image}-${index}`} src={storyImagePreviews.length ? image : uploadsUrl(image)} alt="" className="h-12 w-16 rounded-lg object-cover" />)}</div>}
                      </div>
                    );
                    if (section === "featuredProducts") return selectedFeaturedProducts.length ? (
                      <div key={section} className="rounded-xl border p-3" style={{ backgroundColor: advancedDraft.sectionBackgroundColor, borderColor: `${advancedDraft.primaryColor}55` }}>
                        <p className="mb-2 font-black">منتجات مميزة</p>
                        <div className="flex flex-wrap gap-2">{selectedFeaturedProducts.map((product) => <span key={product._id} className="rounded-lg px-2 py-1 text-xs" style={{ backgroundColor: advancedDraft.productCardBackgroundColor }}>{product.title}</span>)}</div>
                      </div>
                    ) : null;
                    return <p key={section} className="rounded-xl p-3 text-sm font-bold" style={{ backgroundColor: advancedDraft.sectionBackgroundColor }}>قائمة منتجات المتجر</p>;
                  })}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={advancedSaving} className="min-h-11 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white disabled:opacity-60">{advancedSaving ? "جارٍ حفظ التصميم..." : "حفظ التخصيص المتقدم"}</button>
              <button type="button" onClick={resetAdvancedDraft} disabled={advancedSaving} className="min-h-11 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700">استعادة التصميم الافتراضي</button>
              <Link to={publicUrl} className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700">عرض المتجر</Link>
            </div>
          </form>
        ) : (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-800">
            يتطلب التخصيص المتقدم اشتراكًا نشطًا وخطّة تفعّل «التخصيص» و«التخصيص المتقدم» معًا. إعداداتك المحفوظة تبقى كما هي ويمكن استعادتها عند تفعيل الميزة.
          </p>
        )}
      </section>

      {subscription && (
        <section id="subscription" className="scroll-mt-24 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-xl font-black text-slate-900">حالة الاشتراك</h3>
            <span className={`rounded-full border px-3 py-1 text-xs font-black ${subscriptionStatus === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
              {subscriptionStatus === "active" ? "نشط" : "منتهي"}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs font-black text-slate-500">تاريخ البداية</p>
              <p className="mt-2 text-sm font-bold text-slate-800">{startDate ? startDate.toLocaleDateString("ar-EG") : "—"}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs font-black text-slate-500">تاريخ الانتهاء</p>
              <p className="mt-2 text-sm font-bold text-slate-800">{endDate ? endDate.toLocaleDateString("ar-EG") : "—"}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs font-black text-slate-500">الخطة</p>
              <p className="mt-2 text-sm font-bold text-slate-800">{planName}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {renewalRequest ? (
              <span className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-black text-amber-700">
                طلب تجديد قيد المراجعة
              </span>
            ) : (
              <button
                type="button"
                onClick={openRenewalForm}
                disabled={renewalPlansLoading}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-lg shadow-blue-100 disabled:opacity-60"
              >
                {renewalPlansLoading ? "جارٍ تحميل الباقات..." : "تجديد أو تغيير الباقة"}
              </button>
            )}
          </div>
          {renewalError && <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{renewalError}</p>}
          {renewalFormOpen && !renewalRequest && (
            <form onSubmit={submitRenewalRequest} className="mt-5 grid gap-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-4 sm:p-5">
              <div>
                <label htmlFor="renewal-plan" className="block text-sm font-black text-slate-800">اختر باقة التجديد</label>
                <p className="mt-1 text-xs leading-5 text-slate-600">يمكنك تغيير باقتك الحالية. الباقة المجانية متاحة عند إنشاء المتجر لمرة واحدة فقط.</p>
                <select
                  id="renewal-plan"
                  value={renewalPlanId}
                  onChange={(event) => {
                    setRenewalPlanId(event.target.value);
                    setRenewalReceipt(null);
                    setRenewalError("");
                  }}
                  required={renewalPaymentRequired}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800"
                >
                  {renewalPlans.length === 0 && <option value="">لا توجد باقات مدفوعة متاحة حاليًا</option>}
                  {renewalPlans.map((plan) => (
                    <option key={plan._id} value={plan._id}>
                      {plan.name} — {Number(plan.finalPrice ?? plan.price).toLocaleString("ar-EG")} {getStoreCurrencyLabel(plan.currency)} — {plan.durationInDays} يومًا
                    </option>
                  ))}
                </select>
              </div>
              {renewalPlans.length > 0 && (
                <>
                  <label className="block text-sm font-black text-slate-800">
                    سند الدفع
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp,.pdf"
                      required
                      onChange={(event) => setRenewalReceipt(event.target.files?.[0] || null)}
                      className="mt-2 block min-h-11 w-full rounded-xl border border-slate-300 bg-white p-2 text-sm font-medium text-slate-700 file:ml-3 file:rounded-lg file:border-0 file:bg-blue-100 file:px-3 file:py-2 file:font-bold file:text-blue-800"
                    />
                    <span className="mt-1 block text-xs font-medium text-slate-500">ارفع صورة أو PDF لإثبات الدفع للباقة المحددة.</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" disabled={renewalSubmitting || !renewalPlanId || (renewalPaymentRequired && !renewalReceipt)} className="min-h-11 rounded-xl bg-blue-700 px-5 py-2 text-sm font-black text-white disabled:opacity-50">
                      {renewalSubmitting ? "جارٍ إرسال الطلب..." : "إرسال طلب التجديد"}
                    </button>
                    <button type="button" onClick={() => { setRenewalFormOpen(false); setRenewalError(""); }} disabled={renewalSubmitting} className="min-h-11 rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">
                      إلغاء
                    </button>
                  </div>
                </>
              )}
            </form>
          )}
        </section>
      )}

      <section id="products" className="scroll-mt-24 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black text-blue-600">{store.storeType === "family-production" ? "منتجات المشروع" : "منتجات متجري"}</p>
            <h3 className="text-xl font-black text-slate-900">{store.storeType === "family-production" ? "إدارة منتجات المشروع" : "إدارة منتجات المتجر"}</h3>
          </div>
          {canManageStoreProducts ? (
            <Link to={`/add-product?storeProduct=1&storeType=${storeType}`} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white">+ إضافة منتج</Link>
          ) : (
            <span className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-black text-amber-700">
              {subscriptionStatus === "expired" ? "الاشتراك منتهي" : "المتجر غير نشط"}
            </span>
          )}
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-extrabold text-slate-700">
            المنتجات <span className="mr-1 text-blue-700">{ads.length.toLocaleString("ar-EG")}</span>
            <span className="font-semibold text-slate-400">/ {maxProducts > 0 ? maxProducts.toLocaleString("ar-EG") : "غير محدود"}</span>
          </p>
          {ads.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_auto]">
              <label className="relative block">
                <span className="sr-only">ابحث عن منتج</span>
                <svg aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="m16 16 4 4" /></svg>
                <input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="ابحث باسم المنتج أو الفئة" className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pr-10 pl-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" />
              </label>
              <label className="sr-only" htmlFor="store-product-status">حالة المنتج</label>
              <select id="store-product-status" value={productStatusFilter} onChange={(event) => setProductStatusFilter(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                <option value="all">كل الحالات</option>
                <option value="approved">منشور</option>
                <option value="pending">قيد المراجعة</option>
                <option value="rejected">مرفوض</option>
                <option value="archived">مؤرشف</option>
              </select>
            </div>
          )}
        </div>

        {ads.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white text-2xl shadow-sm">📦</div>
            <p className="text-lg font-black text-slate-700">لا توجد منتجات في {store.storeType === "family-production" ? "مشروعك" : "متجرك"} حاليًا</p>
            <p className="mt-2 text-sm text-slate-500">ابدأ بإضافة أول منتج لعرضه في صفحتك.</p>
            {canManageStoreProducts ? (
              <Link to={`/add-product?storeProduct=1&storeType=${storeType}`} className="mt-5 inline-flex rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white">+ إضافة أول منتج</Link>
            ) : (
              <div className="mt-5 inline-flex rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-black text-amber-700">
                {subscriptionStatus === "expired" ? "لا يمكن إضافة منتج لأن اشتراك المتجر منتهي" : "لا يمكن إدارة المنتجات لأن المتجر غير نشط"}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {visibleAds.length === 0 ? (
              <StoreEmptyState title="لا توجد منتجات مطابقة" description="غيّر عبارة البحث أو اختر حالة مختلفة." />
            ) : visibleAds.map((ad) => {
              const statusKey = ad.isArchived ? "archived" : ad.sold ? "sold" : ad.isVisible === false ? "hidden" : ad.status || "pending";
              const statusText = statusKey === "archived" ? "مؤرشف"
                : statusKey === "sold" ? "مباع"
                  : statusKey === "hidden" ? "مخفي"
                    : STATUS_MAP[statusKey] || getStoreStatusLabel(statusKey);
              const categoryName = ad.categoryId?.name || "غير محدد";
              const adDate = ad.createdAt ? new Date(ad.createdAt).toLocaleDateString("ar-EG") : "—";
              const adPrice = Number(ad.discountEnabled === true ? ad.unitPrice ?? ad.price ?? 0 : ad.price || 0);

              return (
                <article key={ad._id} className="rounded-2xl border border-slate-200 bg-white p-3 transition-colors hover:border-slate-300 sm:p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 sm:h-24 sm:w-24">
                      {ad.images?.[0] ? (
                        <img src={uploadsUrl(ad.images[0])} alt={ad.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-2xl text-slate-400">📦</div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-black text-slate-900">{ad.title}</p>
                          <p className="mt-1 text-sm font-black text-blue-600">
                            {adPrice > 0 ? `${adPrice.toLocaleString("ar-EG")} ${getStoreCurrencyLabel(ad.currency)}` : "السعر غير محدد"}
                          </p>
                          {supportsDiscounts && ad.discountEnabled === true && <span className="mt-1 inline-flex rounded-full bg-rose-100 px-2.5 py-1 text-xs font-black text-rose-800">
                            {ad.discountType === "fixed" ? `خصم ${Number(ad.discountValue).toLocaleString("ar")} ${getStoreCurrencyLabel(ad.currency)}` : `خصم ${ad.discountValue}%`}
                          </span>}
                          {supportsInventory && ad.inventoryEnabled === true && (Number(ad.stockQuantity) === 0
                            ? <span className="mt-1 inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-black text-rose-800">نفد المخزون</span>
                            : <span className="mt-1 inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-xs font-black text-violet-800">المخزون: {ad.stockQuantity}</span>)}
                        </div>
                        <StoreStatusBadge status={statusKey} label={statusText} />
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold text-slate-600">
                        <span className="rounded-full bg-white px-2.5 py-1">{categoryName}</span>
                        <span className="rounded-full bg-white px-2.5 py-1">تاريخ الإضافة: {adDate}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    <Link to={`/edit-ad/${ad._id}?storeProduct=1&storeType=${storeType}`} className="inline-flex min-h-10 items-center rounded-xl bg-blue-50 px-4 text-xs font-extrabold text-blue-800 transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">تعديل المنتج</Link>
                    {!ad.isArchived && <button type="button" onClick={() => handleArchiveAd(ad._id)} className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-extrabold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">أرشفة</button>}
                    <button type="button" onClick={() => handleDeleteAd(ad._id)} className="inline-flex min-h-10 items-center rounded-xl px-4 text-xs font-extrabold text-rose-700 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">حذف</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      {mapOpen && <Suspense fallback={<div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/70 p-4 text-sm font-bold text-white">جارٍ تحميل الخريطة...</div>}>
        <MapLocationPicker
          initialLocation={{ lat: form.lat, lng: form.lng }}
          onClose={() => setMapOpen(false)}
          onConfirm={({ lat, lng }) => {
            setForm((current) => ({ ...current, lat: String(lat), lng: String(lng) }));
            setMapOpen(false);
          }}
          title={`حدد موقع ${store?.storeType === "family-production" ? "المشروع" : "المتجر"} على الخريطة`}
        />
      </Suspense>}
    </div>
  );
}
