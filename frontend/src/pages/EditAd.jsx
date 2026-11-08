import React, { useEffect, useRef, useState } from "react";
import { useApi } from "../api/axios.js";
import { useGovernorates } from "../hooks/useGovernorates.js";
import { uploadsUrl } from "../lib/uploads.js";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { t } from "../i18n/index.js";
import CategorySelect from "../components/CategorySelect.jsx";
import CategoryAttributeFields from "../components/CategoryAttributeFields.jsx";
import { useCategoryAttributeApi } from "../api/categoryAttributes.js";
import MobileSelect from "../components/MobileSelect.jsx";
import { useBrokerageApi } from "../api/brokerage.js";
import { useBrokerageStatus } from "../store/BrokerageStatusContext.jsx";
import { getStoreCategoriesForActivity } from "../utils/storeCategories.js";
import CurrencyCalculator from "../components/CurrencyCalculator.jsx";
import SmartProgress from "../components/SmartProgress.jsx";
import { calculateAdProgress, getAdProgressMessage } from "../utils/adProgress.js";

export default function EditAd() {
  const { data: governoratesData = [] } = useGovernorates();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const storeProductMode = searchParams.get("storeProduct") === "1";
  const storeType = searchParams.get("storeType") === "family-production" ? "family-production" : "store";
  const storeDashboardPath = storeType === "family-production" ? "/my-family-production" : "/my-store";
  const api = useApi();
  const brokerageApi = useBrokerageApi();
  const { enabled: brokerageEnabled } = useBrokerageStatus();
  const navigate = useNavigate();
  
  // Form Refs for scrolling
  const formRefs = {
    title: useRef(null),
    categoryId: useRef(null),
    governorateId: useRef(null),
    cityId: useRef(null),
    price: useRef(null),
  };
  const formRef = useRef(null);
  const errorRef = useRef(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("YER_ADEN");
  const [governorateId, setGovernorateId] = useState("");
  const [cityId, setCityId] = useState("");
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [currentImages, setCurrentImages] = useState([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [validationErrors, setValidationErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [governorates, setGovernorates] = useState([]);
  const [cities, setCities] = useState([]);
  const [condition, setCondition] = useState("used");
  const [selectedTags, setSelectedTags] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [showPhone, setShowPhone] = useState(false);
  const [phone, setPhone] = useState("");
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");
  const [isStoreProduct, setIsStoreProduct] = useState(storeProductMode);
  const [storeCategories, setStoreCategories] = useState([]);
  const [negotiable, setNegotiable] = useState(false);
  const [priceOnContact, setPriceOnContact] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [isAvailableForDelivery, setIsAvailableForDelivery] = useState(false);
  const [supportsDelivery, setSupportsDelivery] = useState(false);
  const [supportsDiscounts, setSupportsDiscounts] = useState(false);
  const [supportsInventory, setSupportsInventory] = useState(false);
  const [inventoryEnabled, setInventoryEnabled] = useState(false);
  const [stockQuantity, setStockQuantity] = useState("0");
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountType, setDiscountType] = useState("percentage");
  const [discountValue, setDiscountValue] = useState("10");

  useEffect(() => {
    if (!err) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      const target = errorRef.current || formRef.current;
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      if (errorRef.current) errorRef.current.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [err]);

  // Brokerage Campaign State
  const [enableBrokerage, setEnableBrokerage] = useState(false);
  const [existingCampaign, setExistingCampaign] = useState(null);
  const [brokerageType, setBrokerageType] = useState("AUTO_JOIN"); // AUTO_JOIN, MANUAL_APPROVAL, SINGLE_BROKER, LIMITED
  const [brokerageRewardType, setBrokerageRewardType] = useState("FIXED"); // FIXED, PERCENTAGE
  const [brokerageRewardValue, setBrokerageRewardValue] = useState("");
  const [brokerageMaxBrokers, setBrokerageMaxBrokers] = useState("");
  const [brokerageExpiresAt, setBrokerageExpiresAt] = useState("");

  // Dynamic category attributes
  const categoryAttributeApi = useCategoryAttributeApi();
  const [categoryAttributes, setCategoryAttributes] = useState([]);
  const [categoryAttributesReady, setCategoryAttributesReady] = useState(!storeProductMode);
  const [attributeValues, setAttributeValues] = useState({});
  const adAttrRef = useRef(null);

  const handleFiles = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    const fileKey = (file) => `${file.name}-${file.size}-${file.lastModified}`;

    setFiles((currentFiles) => {
      const existingKeys = new Set(currentFiles.map(fileKey));
      const newFiles = selectedFiles.filter((file) => !existingKeys.has(fileKey(file)));
      const nextFiles = [...currentFiles, ...newFiles].slice(0, 10);

      if (currentFiles.length + newFiles.length > 10) {
        setErr("يمكن رفع حد أقصى 10 صور فقط");
      } else {
        setErr("");
      }

      return nextFiles;
    });

    e.target.value = "";
  };

  const removeFile = (indexToRemove) => {
    setFiles((currentFiles) => currentFiles.filter((_, index) => index !== indexToRemove));
  };

  useEffect(() => {
    const nextPreviews = files.map((file) => URL.createObjectURL(file));
    setPreviews(nextPreviews);

    return () => {
      nextPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  const scrollToFirstError = (errors) => {
    const firstErrorKey = Object.keys(errors).find(key => errors[key]);
    if (firstErrorKey && formRefs[firstErrorKey]?.current) {
      formRefs[firstErrorKey].current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!title.trim()) errors.title = isStoreProduct ? "اسم المنتج مطلوب" : "عنوان المنتج مطلوب";
    if (!categoryId) errors.categoryId = "الفئة مطلوبة";
    if (!isStoreProduct) {
      if (!governorateId) errors.governorateId = "المحافظة مطلوبة";
      if (!cityId) errors.cityId = "المدينة مطلوبة";
    }
    if ((isStoreProduct || !priceOnContact) && (!price || Number(price) <= 0)) errors.price = "يرجى إدخال السعر";
    if (isStoreProduct && supportsDiscounts && discountEnabled
      && (discountType === "percentage"
        ? (!Number.isInteger(Number(discountValue)) || Number(discountValue) < 1 || Number(discountValue) > 99)
        : (!Number.isFinite(Number(discountValue)) || Number(discountValue) <= 0 || Number(discountValue) > Number(price)))) {
      errors.discountValue = discountType === "percentage"
        ? "أدخل نسبة خصم صحيحة من 1 إلى 99%."
        : "أدخل مبلغ خصم أكبر من صفر ولا يتجاوز سعر المنتج.";
    }
    if (isStoreProduct && supportsInventory && inventoryEnabled
      && (!stockQuantity.trim() || !Number.isSafeInteger(Number(stockQuantity)) || Number(stockQuantity) < 0)) {
      errors.stockQuantity = "أدخل كمية مخزون صحيحة (عدد صحيح لا يقل عن صفر).";
    }

    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
      scrollToFirstError(errors);
      setErr(errors.discountValue || errors.stockQuantity || (isStoreProduct ? "يرجى تعبئة بيانات المنتج المطلوبة." : "يرجى تعبئة الحقول المطلوبة قبل حفظ التعديلات"));
      return false;
    }
    return true;
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/tags");
        setAvailableTags(res.data || []);
      } catch {
        setAvailableTags([]);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setGovernorates(governoratesData);
      } catch {
        setGovernorates([]);
      }
    })();
  }, [governoratesData]);
  useEffect(() => {
    if (!governorateId) {
      setCities([]);
      setCityId("");
      return;
    }
    (async () => {
      try {
        const res = await api.get(`/cities?governorateId=${governorateId}&active=true`);
        setCities(res.data || []);
      } catch {
        setCities([]);
      }
    })();
  }, [governorateId]);

  useEffect(() => {
    if (!storeProductMode) return;
    Promise.all([
      api.get("/stores/me", { params: { storeType } }),
      api.get("/stores/activities", { params: { type: storeType } })
    ]).then(([{ data: store }, { data: activities }]) => {
      if (store?.status === "active" && store?.subscriptionStatus === "active") {
        setStoreCategories(getStoreCategoriesForActivity(store, activities));
      }
      setSupportsDelivery(store?.status === "active"
        && store?.subscriptionStatus === "active"
        && store?.subscription?.plan?.features?.delivery === true);
      setSupportsDiscounts(store?.status === "active"
        && store?.subscriptionStatus === "active"
        && store?.subscription?.plan?.features?.discounts === true);
      setSupportsInventory(store?.status === "active"
        && store?.subscriptionStatus === "active"
        && store?.subscription?.plan?.features?.inventory === true);
    }).catch(() => {});
  }, [api, storeProductMode, storeType]);
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/ads/${id}/owner`);
        const ad = res.data;
        setTitle(ad.title || "");
        setDescription(ad.description || "");
        setPrice(ad.price || "");
        setCurrency(ad.currency || "YER_ADEN");
        if (storeProductMode) setCategoryAttributesReady(false);
        setGovernorateId(ad.governorateId?._id || ad.governorateId || "");
        setCityId(ad.cityId?._id || ad.cityId || "");
        setCategoryId(ad.categoryId?._id || ad.categoryId || "");
        setCurrentImages(ad.images || []);
        setCondition(ad.condition || "used");
        setSelectedTags(ad.tags || []);
        setShowPhone(ad.contactInfo?.showPhone || false);
        setPhone(ad.contactInfo?.phone || "");
        setShowWhatsApp(ad.contactInfo?.showWhatsApp || false);
        setWhatsapp(ad.contactInfo?.whatsapp || "");
        setNegotiable(ad.negotiable || false);
        setPriceOnContact(storeProductMode ? false : ad.priceOnContact || false);
        setIsAvailable(ad.isAvailable !== false);
        setIsAvailableForDelivery(ad.isAvailableForDelivery === true);
        setDiscountEnabled(ad.discountEnabled === true);
        setDiscountType(ad.discountType === "fixed" ? "fixed" : "percentage");
        setDiscountValue(String(ad.discountValue || 10));
        setInventoryEnabled(ad.inventoryEnabled === true);
        setStockQuantity(String(ad.stockQuantity ?? 0));

        // Store attributes to prefill after we load category attributes metadata
        adAttrRef.current = Array.isArray(ad.attributes) ? ad.attributes : [];

        // Load brokerage campaign for this ad
        if (!storeProductMode) {
          try {
            const campaigns = await brokerageApi.getMyCampaigns();
            const campaignForAd = campaigns.find(c => c.adId?._id === id || c.adId === id);
            if (campaignForAd) {
              setExistingCampaign(campaignForAd);
              setEnableBrokerage(true);
              setBrokerageType(campaignForAd.type);
              setBrokerageRewardType(campaignForAd.rewardType);
              setBrokerageRewardValue(campaignForAd.rewardValue.toString());
              setBrokerageMaxBrokers(campaignForAd.maxBrokerCount?.toString() || "");
              if (campaignForAd.expiresAt) {
                const date = new Date(campaignForAd.expiresAt);
                setBrokerageExpiresAt(date.toISOString().split('T')[0]);
              }
            }
          } catch (campaignErr) {
            console.error("Failed to load brokerage campaign:", campaignErr);
          }
        }
      } catch {
        setErr("تعذر تحميل الإعلان");
      }
    })();
  }, [id, storeProductMode]);

  // Store attributes are category-specific; Marketplace ads retain ancestor attributes.
  useEffect(() => {
    if (!categoryId) {
      setCategoryAttributes([]);
      setAttributeValues({});
      setCategoryAttributesReady(true);
      return;
    }
    let cancelled = false;
    setCategoryAttributes([]);
    setAttributeValues({});
    setCategoryAttributesReady(false);
    (async () => {
      try {
        const res = await categoryAttributeApi.getCategoryAttributes(categoryId, { includeAncestors: !isStoreProduct });
        const attrs = res.data || [];
        if (cancelled) return;
        setCategoryAttributes(attrs);
        setCategoryAttributesReady(true);
        // Prefill values if we have ad attributes loaded
        if (adAttrRef.current && adAttrRef.current.length > 0) {
          const map = {};
          for (const v of adAttrRef.current) {
            const aid = String(v.attributeId?._id || v.attributeId || "");
            if (!aid) continue;
            const meta = attrs.find((a) => String(a._id || a.id) === aid);
            if (!meta) continue;
            const raw = v.value;
            if (meta.type === "multiselect") {
              map[aid] = typeof raw === "string" ? raw.split(",").map((s) => s.trim()).filter(Boolean) : Array.isArray(raw) ? raw : [];
            } else if (meta.type === "boolean") {
              map[aid] = raw === true || String(raw).toLowerCase() === "true";
            } else {
              map[aid] = String(raw ?? "");
            }
          }
          setAttributeValues(map);
          adAttrRef.current = null;
        } else if (!cancelled) {
          setAttributeValues({});
        }
      } catch {
        if (!cancelled) {
          setCategoryAttributes([]);
          setCategoryAttributesReady(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [categoryId, isStoreProduct]);

  const handleCategoryChange = (nextCategoryId) => {
    setCategoryId(nextCategoryId);
    setCategoryAttributes([]);
    setAttributeValues({});
    setCategoryAttributesReady(!nextCategoryId);
    adAttrRef.current = null;
    setValidationErrors((previous) => ({ ...previous, categoryId: null }));
  };

  const handleAttributeChange = (attributeId, value) => {
    setAttributeValues((prev) => ({ ...prev, [attributeId]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");
    setValidationErrors({});

    if (!validateForm()) return;

    setLoading(true);
    try {
      const form = new FormData();
      form.append("title", title);
      form.append("description", description);
      form.append("price", Number(price || 0));
      form.append("currency", currency);
      if (!isStoreProduct) {
        form.append("governorateId", governorateId);
        form.append("cityId", cityId);
      } else {
        form.append("storeProduct", "true");
        form.append("storeType", storeType);
        form.append("isAvailable", String(isAvailable));
        if (supportsDelivery) form.append("isAvailableForDelivery", String(isAvailableForDelivery));
        if (supportsDiscounts) {
          form.append("discountEnabled", String(discountEnabled));
          form.append("discountType", discountType);
          form.append("discountValue", discountValue);
        }
        if (supportsInventory) {
          form.append("inventoryEnabled", String(inventoryEnabled));
          form.append("stockQuantity", stockQuantity);
        }
      }
      form.append("categoryId", categoryId);
      if (!isStoreProduct) form.append("condition", condition);
      form.append("negotiable", negotiable ? "true" : "false");
      if (!isStoreProduct) form.append("priceOnContact", priceOnContact ? "true" : "false");


      // Optional contact info: only send when filled to avoid forcing seller
      const normalizedPhone = (phone || "").trim();
      const normalizedWhatsApp = (whatsapp || "").trim();
      if (!isStoreProduct && showPhone && normalizedPhone) {
        form.append("showPhone", true);
        form.append("phone", normalizedPhone);
      }
      if (!isStoreProduct && showWhatsApp && normalizedWhatsApp) {
        form.append("showWhatsApp", true);
        form.append("whatsapp", normalizedWhatsApp);
      }
      if (!isStoreProduct) selectedTags.forEach((tagId) => form.append("tags", tagId));
      files.forEach((f) => form.append("images", f));
      // Add dynamic attributes
      const attrs = isStoreProduct
        ? categoryAttributes.map((attribute) => {
            const attributeId = String(attribute.id || attribute._id);
            const value = attributeValues[attributeId];
            return { attributeId, value: Array.isArray(value) ? value.join(",") : value ?? "" };
          })
        : Object.entries(attributeValues).map(([attributeId, value]) => ({
            attributeId,
            value: Array.isArray(value) ? value.join(",") : String(value)
          }));
      const attributesToSave = isStoreProduct
        ? attrs.filter(({ value }) => value !== undefined && value !== null && value !== "")
        : attrs;
      if (isStoreProduct || attrs.length > 0) {
        form.append("attributes", JSON.stringify(attributesToSave));
      }
      const res = await api.patch(`/ads/${id}`, form);
      
      // Handle brokerage campaign
      if (!isStoreProduct && enableBrokerage) {
        const campaignData = {
          adId: id,
          type: brokerageType,
          rewardType: brokerageRewardType,
          rewardValue: Number(brokerageRewardValue),
          rewardCurrency: currency
        };
        if (brokerageMaxBrokers) campaignData.maxBrokerCount = Number(brokerageMaxBrokers);
        if (brokerageExpiresAt) campaignData.expiresAt = new Date(brokerageExpiresAt);

        if (existingCampaign) {
          await brokerageApi.updateCampaign(existingCampaign._id, campaignData);
        } else {
          await brokerageApi.createCampaign(campaignData);
        }
      } else if (!isStoreProduct && existingCampaign) {
        // End the campaign if brokerage is disabled
        await brokerageApi.updateCampaign(existingCampaign._id, { state: "ENDED" });
      }

      if (res.data?._id) {
        setMsg(isStoreProduct ? "✅ تم تحديث المنتج بنجاح" : "✅ تم تحديث الإعلان بنجاح" + (String(res.data.status) === "pending" ? " وإعادة نشره للمراجعة" : ""));
        // Redirect after success delay
        setTimeout(() => navigate(isStoreProduct ? storeDashboardPath : `/ad/${id}`), 2500);
      } else {
        setMsg(isStoreProduct ? "✅ تم تحديث المنتج بنجاح" : "✅ تم تحديث الإعلان بنجاح");
        setTimeout(() => navigate(isStoreProduct ? storeDashboardPath : `/ad/${id}`), 2500);
      }
    } catch (e) {
      console.error("Error updating ad:", e);
      const status = e?.response?.status;
      const data = e?.response?.data;
      if (status === 400 && data) {
        let errorMsg = "";
        if (Array.isArray(data.details) && data.details.length > 0 && data.details[0]?.message) {
          errorMsg = data.details[0].message;
        } else if (typeof data.error === "string") {
          errorMsg = data.error;
        }

        // إذا كان الخطأ يحتوي على أحرف إنجليزية (غالباً من Joi أو Backend)، نستبدله برسالة عربية
        if (/[a-zA-Z]/.test(errorMsg)) {
          if (errorMsg.toLowerCase().includes("is required")) {
            setErr("يرجى تعبئة جميع الحقول المطلوبة.");
          } else if (errorMsg.toLowerCase().includes("must be a number")) {
            setErr("يجب أن تكون القيمة عدداً.");
          } else {
            setErr("حدث خطأ في البيانات المدخلة، يرجى التحقق والمحاولة مرة أخرى.");
          }
        } else {
          setErr(errorMsg || "تعذر تحديث الإعلان");
        }
      } else {
        setErr("تعذر تحديث الإعلان");
      }
    } finally {
      setLoading(false);
    }
  };

  const progress = calculateAdProgress({
    mode: "edit",
    isStoreProduct,
    title,
    categoryId,
    governorateId,
    cityId,
    price,
    priceOnContact,
    files,
    currentImages,
    description,
    showPhone,
    phone,
    showWhatsApp,
    whatsapp,
    categoryAttributes,
    categoryAttributesReady: !isStoreProduct || categoryAttributesReady,
    attributeValues,
    supportsDiscounts,
    discountEnabled,
    discountType,
    discountValue,
    supportsInventory,
    inventoryEnabled,
    stockQuantity
  });

  return (
    <form ref={formRef} onSubmit={submit} className="relative mx-auto mb-20 flex max-w-xl flex-col gap-4 ds-section p-4 sm:mb-0 sm:p-8">
      <h2 className="ds-title">{isStoreProduct ? "تعديل منتج" : "تعديل الإعلان"}</h2>
      <SmartProgress percent={progress.percent} message={getAdProgressMessage(progress)} />
      
      {msg && (
        <div className="sticky top-20 z-10 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          {msg}
        </div>
      )}
      {err && (
        <div ref={errorRef} role="alert" tabIndex={-1} className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          ⚠ {err}
        </div>
      )}

      <div ref={formRefs.title} className="order-1 space-y-1">
        <label className="block text-sm font-bold text-gray-700">
          {isStoreProduct ? "اسم المنتج" : t("addProduct.labels.title")} <span className="text-red-500 mr-1">*</span>
        </label>
        <input 
          className={`ds-input ${validationErrors.title ? "border-red-500 ring-2 ring-red-100" : ""}`}
          value={title} 
          onChange={(e) => {
            setTitle(e.target.value);
            if (e.target.value.trim()) setValidationErrors(prev => ({ ...prev, title: null }));
          }} 
        />
        {validationErrors.title && <p className="text-xs text-red-600 font-bold">{validationErrors.title}</p>}
      </div>
      
      <div ref={formRefs.categoryId} className="order-2 space-y-1">
        {!isStoreProduct && <label className="block text-sm font-bold text-gray-700">
          الفئة <span className="text-red-500 mr-1">*</span>
        </label>}
        <div className={validationErrors.categoryId ? "rounded-xl border-2 border-red-500 p-1 bg-red-50/30" : ""}>
          {isStoreProduct ? (
            <MobileSelect
              label="تصنيف المنتج"
              value={categoryId}
              onChange={(event) => handleCategoryChange(event.target.value)}
              required={true}
              options={storeCategories.map((category) => ({ value: category._id || category.id || category, label: category.name || "تصنيف المنتج" }))}
              placeholder={storeCategories.length ? "اختر تصنيفًا من تصنيفات المتجر" : "لا توجد تصنيفات محددة للمتجر"}
              disabled={storeCategories.length === 0}
            />
          ) : (
            <CategorySelect
              value={categoryId}
              onChange={handleCategoryChange}
              required={true}
            />
          )}
        </div>
        {validationErrors.categoryId && <p className="text-xs text-red-600 font-bold">{validationErrors.categoryId}</p>}
      </div>

      {categoryAttributes.length > 0 && <div className="order-11">
        <CategoryAttributeFields
          attributes={categoryAttributes}
          values={attributeValues}
          onChange={handleAttributeChange}
          title={isStoreProduct ? "مواصفات المنتج" : "معلومات إضافية (اختياري)"}
        />
      </div>}
      <div className="order-5 space-y-1">
        <label className="block text-sm font-medium text-gray-700">{t("addProduct.labels.description")}</label>
        <textarea className="ds-input" rows="4" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      
      {/* Condition */}
      {!isStoreProduct && <div className="order-6 space-y-1">
        <label className="block text-sm font-medium text-gray-700">حالة المنتج</label>
        <div className="flex gap-2">
          {[
            { value: "new", label: "جديد" },
            { value: "used", label: "مستعمل" }
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setCondition(opt.value)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                condition === opt.value
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>}
      
      {/* Tags */}
      {availableTags.length > 0 && (
        <div className="hidden">
          <label className="block text-sm font-medium text-gray-700">وسوم (اختياري)</label>
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => (
              <button
                key={tag._id}
                type="button"
                onClick={() => {
                  setSelectedTags((prev) =>
                    prev.includes(tag._id)
                      ? prev.filter((id) => id !== tag._id)
                      : [...prev, tag._id]
                  );
                }}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  selectedTags.includes(tag._id)
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Contact Info */}
      {!isStoreProduct && <div className="order-10 space-y-3 rounded-lg border border-gray-200 p-4">
        <h4 className="text-sm font-medium text-gray-700">معلومات التواصل السريع</h4>
        
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="showPhone"
            checked={showPhone}
            onChange={(e) => setShowPhone(e.target.checked)}
          />
          <label htmlFor="showPhone" className="text-sm text-gray-700">عرض رقم الهاتف</label>
        </div>
        {showPhone && (
          <input
            className="ds-input"
            placeholder="رقم الهاتف"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        )}
        
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="showWhatsApp"
            checked={showWhatsApp}
            onChange={(e) => setShowWhatsApp(e.target.checked)}
          />
          <label htmlFor="showWhatsApp" className="text-sm text-gray-700">عرض واتساب</label>
        </div>
        {showWhatsApp && (
          <input
            className="ds-input"
            placeholder="رقم واتساب"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
          />
        )}
      </div>}

      {!isStoreProduct && <div className="order-9 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div ref={formRefs.governorateId} className="space-y-1">
          <label className="block text-sm font-bold text-gray-700">
            المحافظة <span className="text-red-500 mr-1">*</span>
          </label>
          <div className={validationErrors.governorateId ? "rounded-xl border-2 border-red-500 bg-red-50/30" : ""}>
            <MobileSelect
              value={governorateId}
              onChange={(e) => {
                setGovernorateId(e.target.value);
                if (e.target.value) setValidationErrors(prev => ({ ...prev, governorateId: null }));
              }}
              required={true}
              options={governorates.map(g => ({ value: g._id, label: g.name }))}
              placeholder="اختر المحافظة"
            />
          </div>
          {validationErrors.governorateId && <p className="text-xs text-red-600 font-bold">{validationErrors.governorateId}</p>}
        </div>
        <div ref={formRefs.cityId} className="space-y-1">
          <label className="block text-sm font-bold text-gray-700">
            المدينة <span className="text-red-500 mr-1">*</span>
          </label>
          <div className={validationErrors.cityId ? "rounded-xl border-2 border-red-500 bg-red-50/30" : ""}>
            <MobileSelect
              value={cityId}
              onChange={(e) => {
                setCityId(e.target.value);
                if (e.target.value) setValidationErrors(prev => ({ ...prev, cityId: null }));
              }}
              disabled={!governorateId}
              required={true}
              options={cities.map(c => ({ value: c._id, label: c.name }))}
              placeholder={governorateId ? "اختر المدينة" : "اختر المحافظة أولاً"}
            />
          </div>
          {validationErrors.cityId && <p className="text-xs text-red-600 font-bold">{validationErrors.cityId}</p>}
        </div>
      </div>}

      <div ref={formRefs.price} className="order-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1 col-span-1 sm:col-span-2">
          <label className="block text-sm font-bold text-gray-700">
            {t("addProduct.labels.price")} <span className="text-red-500 mr-1">*</span>
          </label>
          <input 
            className={`ds-input disabled:bg-gray-100 disabled:cursor-not-allowed ${validationErrors.price ? "border-red-500 ring-2 ring-red-100" : ""}`}
            type="text" 
            inputMode="numeric" 
            value={price} 
            onChange={(e) => {
              setPrice(e.target.value.replace(/\D/g, ""));
              if (e.target.value) setValidationErrors(prev => ({ ...prev, price: null }));
            }}
            disabled={priceOnContact}
          />
          {validationErrors.price && <p className="text-xs text-red-600 font-bold">{validationErrors.price}</p>}
          <div className="mt-2 flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={negotiable}
                onChange={(e) => setNegotiable(e.target.checked)}
              />
              قابل للتفاوض
            </label>
            {!isStoreProduct && <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={priceOnContact}
                onChange={(e) => {
                  const v = e.target.checked;
                  setPriceOnContact(v);
                  if (v) {
                    setPrice("");
                    setValidationErrors(prev => ({ ...prev, price: null }));
                  }
                }}
              />
              السعر عند التواصل
              </label>}
          </div>
        </div>
        <div className="space-y-1">
          <MobileSelect
            label={t("addProduct.labels.currency")}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            disabled={priceOnContact}
            required={true}
            options={[
              { value: "YER_ADEN", label: "ريال يمني (عدن)" },
              { value: "YER_SANAA", label: "ريال يمني (صنعاء)" },
              { value: "SAR", label: "ريال سعودي" },
              { value: "USD", label: "دولار" }
            ]}
          />
        </div>
      </div>
      {!priceOnContact && Number(price) > 0 && (
        <CurrencyCalculator amount={price} currency={currency} />
      )}

      {isStoreProduct && (
        <div className="space-y-2">
          <label className="block text-sm font-bold text-gray-700">حالة المنتج <span className="text-red-500 mr-1">*</span></label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: true, label: "متوفر" },
              { value: false, label: "غير متوفر" }
            ].map((option) => (
              <button
                key={String(option.value)}
                type="button"
                aria-pressed={isAvailable === option.value}
                onClick={() => setIsAvailable(option.value)}
                className={`min-h-12 rounded-xl border px-4 py-3 text-sm font-bold transition-colors ${isAvailable === option.value ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {isStoreProduct && supportsDelivery && (
        <label className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-950">
          <input
            type="checkbox"
            checked={isAvailableForDelivery}
            onChange={(event) => setIsAvailableForDelivery(event.target.checked)}
            className="h-5 w-5 accent-amber-500"
          />
          متاح للتوصيل
        </label>
      )}
      {isStoreProduct && supportsDiscounts && (
        <section className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <label className="flex items-center gap-3 text-sm font-bold text-rose-950">
            <input
              type="checkbox"
              checked={discountEnabled}
              onChange={(event) => setDiscountEnabled(event.target.checked)}
              className="h-5 w-5 accent-rose-600"
            />
            خصم على المنتج
          </label>
          {discountEnabled && (
            <>
              <label className="block text-sm font-bold text-slate-700">
                نوع الخصم
                <select
                  value={discountType}
                  onChange={(event) => setDiscountType(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-rose-200 bg-white px-4 py-3"
                >
                  <option value="percentage">نسبة مئوية</option>
                  <option value="fixed">مبلغ ثابت</option>
                </select>
              </label>
              <label className="block text-sm font-bold text-slate-700">
                {discountType === "percentage" ? "نسبة الخصم %" : `مبلغ الخصم (${currency})`}
                <input
                  type="number"
                  min="1"
                  max={discountType === "percentage" ? 99 : Number(price)}
                  step={discountType === "percentage" ? "1" : "any"}
                  value={discountValue}
                  onChange={(event) => setDiscountValue(event.target.value)}
                  required
                  className="mt-2 w-full rounded-xl border border-rose-200 bg-white px-4 py-3"
                />
              </label>
            </>
          )}
        </section>
      )}
      {isStoreProduct && supportsInventory && (
        <section className="space-y-3 rounded-xl border border-violet-200 bg-violet-50 p-4">
          <label className="flex items-center gap-3 text-sm font-bold text-violet-950">
            <input
              type="checkbox"
              checked={inventoryEnabled}
              onChange={(event) => setInventoryEnabled(event.target.checked)}
              className="h-5 w-5 accent-violet-600"
            />
            تفعيل المخزون
          </label>
          {inventoryEnabled && (
            <label className="block text-sm font-bold text-slate-700">
              الكمية المتوفرة
              <input
                type="number"
                min="0"
                step="1"
                value={stockQuantity}
                onChange={(event) => setStockQuantity(event.target.value)}
                required
                className="mt-2 w-full rounded-xl border border-violet-200 bg-white px-4 py-3"
              />
            </label>
          )}
        </section>
      )}
      
      <div className="order-4 space-y-1">
        <label className="block text-sm font-medium text-gray-700">{isStoreProduct ? "صور المنتج" : t("addProduct.labels.images")}</label>
        <input id="edit-ad-images-input" className="sr-only" type="file" multiple accept="image/png,image/jpeg,image/jpg" onChange={handleFiles} />
        <label htmlFor="edit-ad-images-input" className="flex min-h-14 w-full cursor-pointer items-center justify-center rounded-xl border border-dashed border-blue-300 bg-blue-50/60 px-4 py-3 text-sm font-black text-blue-700 transition hover:border-blue-500 hover:bg-blue-50">
          {isStoreProduct ? "إضافة صور المنتج" : "إضافة صور الإعلان"}
        </label>
      </div>
      {previews.length > 0 && (
        <div className="order-4 mt-2 flex flex-wrap gap-3">
          {previews.map((src, i) => (
            <div key={src} className="relative">
              <img src={src} alt={`${isStoreProduct ? "صورة المنتج" : "صورة الإعلان"} ${i + 1}`} className="h-24 w-32 rounded-md object-cover" />
              <button
                type="button"
                aria-label={`حذف ${isStoreProduct ? "صورة المنتج" : "صورة الإعلان"} ${i + 1}`}
                onClick={() => removeFile(i)}
                className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-lg font-bold leading-none text-white shadow-md transition-colors hover:bg-red-700"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="order-4 space-y-1">
        <label className="block text-sm font-medium text-gray-700">{isStoreProduct ? "صور المنتج الحالية" : "الصور الحالية"}</label>
        {currentImages.length === 0 && <div className="text-xs text-gray-600">لا توجد صور حالية</div>}
        {currentImages.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-3">
            {currentImages.map((fn) => (
              <div key={fn} className="relative">
                <img src={uploadsUrl(fn, "thumb")} alt="" className="h-24 w-32 rounded-md object-cover" />
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded-md bg-white/80 px-2 py-1 text-[11px] hover:bg-white"
                  onClick={async () => {
                    try {
                      await api.delete(`/ads/${id}/images/${encodeURIComponent(fn)}`);
                      setCurrentImages((imgs) => imgs.filter((x) => x !== fn));
                    } catch {}
                  }}
                >
                  حذف
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Brokerage System */}
      {!isStoreProduct && brokerageEnabled && (
      <div className="order-12 space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="enableBrokerage"
            className="h-5 w-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            checked={enableBrokerage}
            onChange={(e) => setEnableBrokerage(e.target.checked)}
          />
          <label htmlFor="enableBrokerage" className="text-sm font-black text-amber-900 cursor-pointer">
            تفعيل نظام التسويق بالعمولة
          </label>
        </div>

        {enableBrokerage && (
          <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700">
                نوع الحملة
              </label>
              <MobileSelect
                value={brokerageType}
                onChange={(e) => setBrokerageType(e.target.value)}
                options={[
                  { value: "AUTO_JOIN", label: "انضمام تلقائي" },
                  { value: "MANUAL_APPROVAL", label: "موافقة يدوية" },
                  { value: "LIMITED", label: "عدد محدود" }
                ]}
              />
            </div>

            {brokerageType === "LIMITED" && (
              <div className="space-y-1">
                <label className="block text-sm font-bold text-gray-700">
                  الحد الأقصى للوسطاء
                </label>
                <input
                  className="ds-input"
                  type="number"
                  min="1"
                  value={brokerageMaxBrokers}
                  onChange={(e) => setBrokerageMaxBrokers(e.target.value)}
                  placeholder="أدخل عدد الوسطاء"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-sm font-bold text-gray-700">
                  نوع المكافأة
                </label>
                <MobileSelect
                  value={brokerageRewardType}
                  onChange={(e) => setBrokerageRewardType(e.target.value)}
                  options={[
                    { value: "FIXED", label: "مبلغ ثابت" },
                    { value: "PERCENTAGE", label: "نسبة مئوية" }
                  ]}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-bold text-gray-700">
                  {brokerageRewardType === "PERCENTAGE" ? "النسبة %" : "المبلغ"}
                </label>
                <input
                  className="ds-input"
                  type="number"
                  min={brokerageRewardType === "PERCENTAGE" ? "1" : "100"}
                  max={brokerageRewardType === "PERCENTAGE" ? "30" : undefined}
                  value={brokerageRewardValue}
                  onChange={(e) => setBrokerageRewardValue(e.target.value)}
                  placeholder={brokerageRewardType === "PERCENTAGE" ? "1-30%" : "أقل مبلغ 100"}
                />
              </div>
            </div>

            {brokerageRewardType === "PERCENTAGE" && (
              <div className="mt-2 rounded-md border border-amber-200 bg-amber-100 px-3 py-2 text-center text-sm text-amber-800">
                المكافأة المتوقعة: {Math.round(Number(price) * (Number(brokerageRewardValue) / 100))} {currency === "USD" ? "$" : currency === "SAR" ? "ر.س" : currency === "YER_SANAA" ? "ر.ي (صنعاء)" : "ر.ي (عدن)"}
              </div>
            )}
          </div>
        )}
      </div>
      )}

      <button disabled={loading} type="submit" className="order-[13] ds-btn-primary w-full py-4 text-lg font-bold disabled:opacity-60">
        {loading ? "جاري الحفظ..." : isStoreProduct ? "حفظ المنتج" : "حفظ التعديلات"}
      </button>
      <div className="mt-3 text-center border-t pt-4">
        <Link to={isStoreProduct ? storeDashboardPath : "/my-ads"} className="text-sm text-gray-500 hover:text-brand-600 underline">{isStoreProduct ? "إلغاء والعودة إلى منتجات المتجر" : "إلغاء والعودة إلى إعلاناتي"}</Link>
      </div>
    </form>
  );
}
