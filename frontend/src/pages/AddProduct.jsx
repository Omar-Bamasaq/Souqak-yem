import React, { useEffect, useState, useRef } from "react";
import { useApi } from "../api/axios.js";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../store/AuthContext.jsx";
import { t } from "../i18n/index.js";
import CategorySelect from "../components/CategorySelect.jsx";
import { isConditionEnabled } from "../lib/categoryHelpers.js";
import { useCategoryAttributeApi } from "../api/categoryAttributes.js";
import MobileSelect from "../components/MobileSelect.jsx";

export default function AddProduct() {
  const api = useApi();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const adType = searchParams.get("type") || "sell"; // 'sell' or 'order'
  
  const categoryAttributeApi = useCategoryAttributeApi();
  const { user } = useAuth();
  
  // Form Refs for scrolling
  const formRefs = {
    title: useRef(null),
    categoryId: useRef(null),
    governorateId: useRef(null),
    cityId: useRef(null),
    price: useRef(null),
    files: useRef(null),
  };

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("YER_ADEN");
  const [governorateId, setGovernorateId] = useState("");
  const [cityId, setCityId] = useState("");
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [validationErrors, setValidationErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [governorates, setGovernorates] = useState([]);
  const [cities, setCities] = useState([]);
  const [attrs, setAttrs] = useState({});
  const [showAfterPublishModal, setShowAfterPublishModal] = useState(false);
  const [condition, setCondition] = useState("used");
  const [selectedTags, setSelectedTags] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [availableTags, setAvailableTags] = useState([]);
  const [showPhone, setShowPhone] = useState(false);
  const [phone, setPhone] = useState("");
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [whatsapp, setWhatsApp] = useState("");
  const [negotiable, setNegotiable] = useState(false);
  const [priceOnContact, setPriceOnContact] = useState(false);
  const [showConsent, setShowConsent] = useState(adType === "sell");
  const [consentEnabledAt, setConsentEnabledAt] = useState(0);
  const [commissionAgreed, setCommissionAgreed] = useState(adType === "order");
  const [nowTs, setNowTs] = useState(Date.now());
  const [blockErr, setBlockErr] = useState("");
  const [selectedMainCategoryName, setSelectedMainCategoryName] = useState("");

  const CONDITION_ENABLED_CATEGORIES = [
    "السيارات",
    "المركبات",
    "مركبات",
    "شاحنات",
    "دراجات نارية",
    "الالكترونيات",
    "أثاث",
    "طلبات الشراء",
    "ملابس وأزياء",
    "ألعاب وترفية",
    "أدوات ومعدات",
    "مركبات خاصة",
    "أدوات مكتبية",
    "مستلزمات رياضية",
    "الصحة والجمال",
    "الكتب والمجلات",
    "آلات موسيقية",
    "أجهزة منزلية",
    "اجهزة منزلية",
    "الأجهزة المنزلية",
    "اجهزه منزليه"
  ];

  // Resell System
  const [isResellEnabled, setIsResellEnabled] = useState(false);
  const [commissionType, setCommissionType] = useState("percentage");
  const [commissionValue, setCommissionValue] = useState("");
  const [maxResellPrice, setMaxResellPrice] = useState("");
  const [allowAutoApproval, setAllowAutoApproval] = useState(true);
  const [maxResellers, setMaxResellers] = useState(5);

  // Category state for 'order' type (Level 2 & 3 selection)
  const [mainCatsForOrder, setMainCatsForOrder] = useState([]);
  const [subCatsForOrder, setSubCatsForOrder] = useState([]);
  const [orderMainCategoryId, setOrderMainCategoryId] = useState("");
  const [orderSubCategoryId, setOrderSubCategoryId] = useState("");
  const [purchaseOrderCatId, setPurchaseOrderCatId] = useState("");

  useEffect(() => {
    setSelectedMainCategoryName("");
    setCategoryId("");
  }, [adType]);

  // Handle 'Purchase Orders' category for 'order' type
  useEffect(() => {
    if (adType === "order") {
      api.get("/categories").then(res => {
        const cats = res.data || [];
        const purchaseOrderCat = cats.find(c => c.slug === "purchase-orders" || c.name === "طلبات الشراء");
        if (purchaseOrderCat) {
          setPurchaseOrderCatId(purchaseOrderCat._id || purchaseOrderCat.id);
          // Initial category is 'Purchase Orders' but user must choose sub-categories
          setCategoryId(purchaseOrderCat._id || purchaseOrderCat.id);
          setSelectedMainCategoryName("طلبات الشراء");
        }
        // Filter out 'Purchase Orders' to show as level 2 options
        const filteredMain = cats.filter(c => c.slug !== "purchase-orders" && c.name !== "طلبات الشراء");
        setMainCatsForOrder(filteredMain);
      });
    }
  }, [adType, api]);

  // Load sub-categories for 'order' type Level 3
  useEffect(() => {
    if (adType === "order" && orderMainCategoryId) {
      api.get(`/categories/${orderMainCategoryId}/children`).then(res => {
        setSubCatsForOrder(res.data || []);
      });
    } else {
      setSubCatsForOrder([]);
    }
  }, [adType, orderMainCategoryId, api]);

  const handleOrderMainCategoryChange = (e) => {
    const val = e.target.value;
    setOrderMainCategoryId(val);
    setOrderSubCategoryId(""); // Reset level 3
    if (val) {
      // If user selected a main category, use it for now
      setCategoryId(val);
      const cat = mainCatsForOrder.find(c => (c._id || c.id) === val);
      setSelectedMainCategoryName(cat?.name || "");
    } else {
      // Fallback to purchase order cat if nothing selected
      setCategoryId(purchaseOrderCatId);
      setSelectedMainCategoryName("طلبات الشراء");
    }
    setValidationErrors(prev => ({ ...prev, categoryId: null }));
  };

  const handleOrderSubCategoryChange = (e) => {
    const val = e.target.value;
    setOrderSubCategoryId(val);
    if (val) {
      setCategoryId(val);
    } else if (orderMainCategoryId) {
      setCategoryId(orderMainCategoryId);
    }
    setValidationErrors(prev => ({ ...prev, categoryId: null }));
  };

  // Dynamic category attributes
  const [categoryAttributes, setCategoryAttributes] = useState([]);
  const [attributeValues, setAttributeValues] = useState({});

  const handleFiles = (e) => {
    const fAll = Array.from(e.target.files || []);
    const f = fAll.slice(0, 10);
    if (fAll.length > 10) {
      setErr("يمكن رفع حد أقصى 10 صور فقط");
    } else {
      setErr("");
      setValidationErrors(prev => ({ ...prev, files: null }));
    }
    setFiles(f);
    const urls = f.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
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
    if (adType === "sell" && showConsent) {
      const start = Date.now();
      setConsentEnabledAt(start + 5000);
      const int = setInterval(() => setNowTs(Date.now()), 200);
      return () => clearInterval(int);
    }
  }, [showConsent, adType]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/governorates?active=true");
        setGovernorates(res.data || []);
      } catch {
        setGovernorates([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (user) {
      api.get("/commissions/status-summary")
        .then(res => {
          if (res.data?.overdueCount > 0) {
            setBlockErr("قبل نشر إعلان جديد يجب سداد العمولة السابقة المتأخرة.");
          }
        })
        .catch(() => {});
    }
  }, [user, api]);

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

  // Load category attributes when category changes
  useEffect(() => {
    if (!categoryId) {
      setCategoryAttributes([]);
      setAttributeValues({});
      return;
    }
    (async () => {
      try {
        const res = await categoryAttributeApi.getCategoryAttributes(categoryId, { includeAncestors: true });
        setCategoryAttributes(res.data || []);
        // Reset attribute values
        setAttributeValues({});
      } catch (error) {
        console.error("Error loading category attributes:", error);
        setCategoryAttributes([]);
      }
    })();
  }, [categoryId]);

  const handleCategoryChange = (newCategoryId) => {
    setCategoryId(newCategoryId);
    setValidationErrors(prev => ({ ...prev, categoryId: null }));
  };

  const handleAttributeChange = (attributeId, value) => {
    setAttributeValues(prev => ({
      ...prev,
      [attributeId]: value
    }));
  };

  const scrollToFirstError = (errors) => {
    const firstErrorKey = Object.keys(errors).find(key => errors[key]);
    if (firstErrorKey && formRefs[firstErrorKey]?.current) {
      formRefs[firstErrorKey].current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!title.trim()) errors.title = "عنوان المنتج مطلوب";
    if (adType === "order") {
      if (!orderMainCategoryId) errors.categoryId = "يرجى اختيار الفئة";
    } else {
      if (!categoryId) errors.categoryId = "الفئة مطلوبة";
    }
    if (!governorateId) errors.governorateId = "المحافظة مطلوبة";
    if (!cityId) errors.cityId = "المدينة مطلوبة";
    
    // For 'order' type, price and images are optional
    if (adType !== "order") {
      if (!priceOnContact && (!price || Number(price) <= 0)) errors.price = "يرجى إدخال السعر";
      if (files.length === 0) errors.files = "يجب رفع صورة واحدة على الأقل";
    }

    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
      scrollToFirstError(errors);
      setErr("يرجى تعبئة الحقول المطلوبة قبل نشر الإعلان");
      return false;
    }
    return true;
  };

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");
    setValidationErrors({});

    if (!user) {
      setErr("يرجى تسجيل الدخول أولاً");
      return;
    }
    if (!commissionAgreed) {
      setErr("يجب الموافقة على التعهد بدفع عمولة المنصة 1% بعد البيع");
      return;
    }
    
    if (!validateForm()) return;

    setLoading(true);
    try {
      const form = new FormData();
      form.append("title", title);
      form.append("description", description);
      form.append("price", Number(price || 0));
      form.append("currency", currency);
      form.append("governorateId", governorateId);
      form.append("cityId", cityId);
      if (categoryId) form.append("categoryId", categoryId);
      form.append("adType", adType);

      // Resell fields
      if (isResellEnabled) {
        form.append("isResellEnabled", "true");
        form.append("commissionType", commissionType);
        form.append("commissionValue", String(commissionValue || 0));
        if (maxResellPrice) form.append("maxResellPrice", maxResellPrice);
        form.append("allowAutoApproval", String(allowAutoApproval));
        form.append("maxResellers", String(maxResellers));
      }

      form.append("condition", condition);
      form.append("negotiable", negotiable ? "true" : "false");
      form.append("priceOnContact", priceOnContact ? "true" : "false");

      // Optional contact info: only send if seller really wants to show it
      const normalizedPhone = (phone || "").trim();
      const normalizedWhatsApp = (whatsapp || "").trim();
      if (showPhone && normalizedPhone) {
        form.append("showPhone", true);
        form.append("phone", normalizedPhone);
      }
      if (showWhatsApp && normalizedWhatsApp) {
        form.append("showWhatsApp", true);
        form.append("whatsapp", normalizedWhatsApp);
      }
      selectedTags.forEach((tagId) => form.append("tags", tagId));
      (files || []).forEach((file) => form.append("images", file));
      
      // Add category attributes
      const attributes = Object.entries(attributeValues).map(([attributeId, value]) => ({
        attributeId,
        value: Array.isArray(value) ? value.join(",") : String(value)
      }));
      
      if (attributes.length > 0) {
        form.append("attributes", JSON.stringify(attributes));
      }
      
      const res = await api.post("/ads", form);
      const created = res.data;
      if (created?._id) {
        setMsg("✅ تم نشر الإعلان بنجاح");
        setShowAfterPublishModal(true);
      }
    } catch (e) {
      const status = e?.response?.status;
      const data = e?.response?.data;
      if (status === 401) {
        setErr("يرجى تسجيل الدخول أولاً");
      } else if (status === 403) {
        setErr("هذا الإجراء متاح للبائعين فقط");
      } else if (status === 400 && data) {
        let errorMsg = "";
        if (Array.isArray(data.details) && data.details.length > 0 && data.details[0]?.message) {
          errorMsg = data.details[0].message;
        } else if (typeof data.error === "string") {
          errorMsg = data.error;
        }

        // إذا كان الخطأ يحتوي على أحرف إنجليزية (غالباً من Joi أو Backend)، نستبدله برسالة عربية
        if (/[a-zA-Z]/.test(errorMsg)) {
          const lowerError = errorMsg.toLowerCase();
          if (lowerError.includes("is required")) {
            setErr("يرجى تعبئة جميع الحقول المطلوبة.");
          } else if (lowerError.includes("must be a number")) {
            setErr("يجب أن تكون القيمة عدداً.");
          } else if (lowerError.includes("limit")) {
            setErr("لقد تجاوزت الحد المسموح به.");
          } else if (lowerError.includes("image") || lowerError.includes("file")) {
            setErr("هناك مشكلة في الصور المرفوعة، يرجى التأكد من صيغة الصور وحجمها.");
          } else if (lowerError.includes("attributes")) {
            setErr("يرجى التأكد من تعبئة خصائص الفئة بشكل صحيح.");
          } else {
            // إظهار الخطأ الأصلي مع رسالة توضيحية بدلاً من رسالة عامة غامضة
            setErr(`خطأ في البيانات: ${errorMsg}`);
          }
        } else {
          setErr(errorMsg || t("addProduct.error"));
        }
      } else {
        setErr(t("addProduct.error"));
      }
    } finally {
      setLoading(false);
    }
  };

  const renderAttributeField = (attr) => {
    const value = attributeValues[attr.id || attr._id] || "";
    
    switch (attr.type) {
      case "text":
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleAttributeChange(attr.id || attr._id, e.target.value)}
            placeholder={attr.placeholder || ""}
            required={attr.required}
            className="ds-input"
          />
        );
      
      case "number":
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleAttributeChange(attr.id || attr._id, e.target.value)}
            placeholder={attr.placeholder || ""}
            required={attr.required}
            className="ds-input"
          />
        );
      
      case "boolean":
        return (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`attr-${attr.id || attr._id}`}
              checked={value === true || value === "true"}
              onChange={(e) => handleAttributeChange(attr.id || attr._id, e.target.checked)}
              className="w-4 h-4 text-emerald-500 rounded"
            />
            <label htmlFor={`attr-${attr.id || attr._id}`} className="text-sm text-gray-700">
              نعم
            </label>
          </div>
        );
      
      case "select":
        return (
          <MobileSelect
            value={value}
            onChange={(e) => handleAttributeChange(attr.id || attr._id, e.target.value)}
            required={attr.required}
            options={attr.options?.map(opt => ({ value: opt, label: opt }))}
            placeholder="اختر..."
          />
        );
      
      case "multiselect":
        return (
          <div className="flex flex-wrap gap-2">
            {attr.options?.map((opt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  const currentValues = Array.isArray(value) ? value : value ? [value] : [];
                  const newValues = currentValues.includes(opt)
                    ? currentValues.filter(v => v !== opt)
                    : [...currentValues, opt];
                  handleAttributeChange(attr.id || attr._id, newValues);
                }}
                className={`rounded-full px-3 py-1 text-sm transition-colors ${
                  (Array.isArray(value) ? value : [value]).includes(opt)
                    ? "bg-emerald-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        );
      
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleAttributeChange(attr.id || attr._id, e.target.value)}
            className="ds-input"
          />
        );
    }
  };

  if (blockErr) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="rounded-[2.5rem] bg-white border border-red-100 p-10 text-center shadow-2xl shadow-red-50">
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-red-50 p-4 ring-8 ring-red-50/50">
              <svg className="h-12 w-12 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <h2 className="mb-4 text-2xl font-black text-gray-900">نشر الإعلان محجوب</h2>
          <p className="mb-10 text-gray-600 font-bold leading-relaxed">{blockErr}</p>
          <div className="flex flex-col gap-3">
            <Link
              to="/seller"
              className="w-full rounded-2xl bg-brand-600 py-4 text-base font-black text-white transition-all hover:bg-brand-700 shadow-xl shadow-brand-100"
            >
              دفع العمولة المتأخرة
            </Link>
            <Link
              to="/"
              className="w-full rounded-2xl border border-gray-200 bg-white py-3 text-center text-sm font-bold text-gray-500 hover:bg-gray-50"
            >
              العودة للرئيسية
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Consent - Only show for sell type
  if (adType === "sell" && showConsent) {
    return (
      <div className="min-h-[calc(100vh-70px)] bg-white flex flex-col px-4 py-4 sm:p-8">
        <div className="w-full max-w-3xl mx-auto flex-1 flex flex-col justify-center">
          <div className="mb-6 text-center sm:text-right">
            <h2 className="text-2xl font-black text-gray-900 sm:text-3xl leading-tight">ميثاق الأمانة والعمولة</h2>
            <div className="mt-3 h-1 w-16 bg-blue-600 mx-auto sm:ml-auto sm:mr-0 rounded-full" />
          </div>

          <div className="space-y-6 text-right">
            <div className="space-y-2 bg-gray-50/50 p-4 sm:p-6 rounded-2xl border border-gray-100">
              <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] text-center sm:text-right">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</p>
              <p className="text-base leading-relaxed text-gray-700 sm:text-xl text-center sm:text-right">
                قال الله تعالى: <span className="font-black text-gray-900 text-lg sm:text-2xl block mt-2 mb-1">« يَا أَيُّهَا الَّذِينَ آمَنُوا أَوْفُوا بِالْعُقُودِ »</span> 
                <span className="text-xs text-gray-400 font-medium">صدق الله العظيم</span>
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <label className="group flex cursor-pointer items-start gap-3 sm:gap-4 p-2">
                <div className="relative mt-1 flex-shrink-0">
                  <input
                    type="checkbox"
                    className="peer h-6 w-6 sm:h-7 sm:w-7 cursor-pointer appearance-none rounded-lg border-2 border-gray-300 transition-all checked:border-blue-600 checked:bg-blue-600"
                    checked={commissionAgreed}
                    onChange={(e) => setCommissionAgreed(e.target.checked)}
                  />
                  <svg className="absolute left-1 top-1 sm:left-1.5 sm:top-1.5 h-4 w-4 scale-0 text-white transition-transform peer-checked:scale-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="flex-1 space-y-2">
                  <span className="block text-sm font-black leading-relaxed text-gray-800 group-hover:text-gray-900 sm:text-lg">
                    أقر وأتعهد بالأمانة التامة في البيع، وألتزم بدفع عمولة المنصة المقدرة بـ 1% من قيمة البيع، سواء تم البيع مباشرة عبر الموقع أو كان الموقع سبباً في ذلك.
                  </span>
                  <p className="text-sm font-bold leading-relaxed text-gray-600 sm:text-base">
                    كما ألتزم بتحويل العمولة فور استلام ثمن السلعة، أو خلال مدة لا تتجاوز 10 أيام عمل.
                  </p>
                </div>
              </label>
            </div>

            <div className="space-y-2 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 sm:p-6 text-right">
              <h4 className="text-base sm:text-lg font-black text-amber-800 flex items-center gap-2 justify-start mb-2">
                <div className="rounded-full bg-amber-200 p-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                ملاحظة هامة بشأن الرسوم
              </h4>
              <p className="text-sm leading-relaxed text-amber-900 sm:text-base font-bold">
                رسوم المنصة هي أمانة في ذمة المعلن (البائع)، ولا تبرأ ذمته منها إلا بعد سدادها للمنصة. 
                نحن نثق في أمانتكم لضمان استمرار تقديم الخدمة وتطويرها.
              </p>
              <div className="mt-3 inline-block rounded-xl bg-amber-200/50 px-4 py-2 text-xs sm:text-sm font-black text-amber-900 border border-amber-300/50">
                ملاحظة: إذا كانت العمولة أقل من 1000 ريال يمني (عدن) فيُستحب التصدق بها.
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4 pb-10 sm:pb-0">
              <button
                type="button"
                className="w-full sm:flex-1 rounded-xl bg-blue-600 py-4 sm:py-4 text-base font-black text-white transition-all active:scale-[0.98] hover:bg-blue-700 disabled:opacity-50 disabled:active:scale-100 shadow-lg shadow-blue-200"
                disabled={!commissionAgreed || nowTs < consentEnabledAt}
                onClick={() => setShowConsent(false)}
              >
                {nowTs < consentEnabledAt ? `يرجى القراءة (${Math.ceil((consentEnabledAt - nowTs) / 1000)} ثانية)` : "أتعهد بذلك وأوافق »"}
              </button>
              <Link
                to="/"
                className="w-full sm:w-auto sm:px-10 rounded-xl border-2 border-gray-200 bg-white py-4 sm:py-4 text-center text-base font-black text-gray-500 transition-all hover:bg-gray-50 hover:text-gray-700"
              >
                إلغاء
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-6 ds-section p-6 sm:p-10 mb-20 sm:mb-0">
      <h2 className="ds-title">{adType === "order" ? "إضافة طلب شراء منتج" : t("addProduct.formTitle")}</h2>
      
      {adType === "order" && (
        <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-4 mb-6">
          <p className="text-sm font-bold text-indigo-800">
            أنت الآن تقوم بإضافة "طلب شراء". سيظهر طلبك في قسم طلبات الشراء ليتمكن البائعون من التواصل معك وتوفير ما تحتاجه.
          </p>
        </div>
      )}
      
      {msg && (
        <div className="sticky top-20 z-10 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          {msg}
        </div>
      )}
      {err && (
        <div className="sticky top-20 z-10 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          ⚠ {err}
        </div>
      )}

      <div ref={formRefs.title} className="space-y-1">
        <label className="block text-sm font-bold text-gray-700">
          {t("addProduct.labels.title")} <span className="text-red-500 mr-1">*</span>
        </label>
        <input 
          className={`ds-input ${validationErrors.title ? "border-red-500 ring-2 ring-red-100" : ""}`}
          placeholder={t("addProduct.labels.titlePh")} 
          value={title} 
          onChange={(e) => {
            setTitle(e.target.value);
            if (e.target.value.trim()) setValidationErrors(prev => ({ ...prev, title: null }));
          }} 
        />
        {validationErrors.title && <p className="text-xs text-red-600 font-bold">{validationErrors.title}</p>}
      </div>
      
      <div ref={formRefs.categoryId} className="space-y-4">
        <label className="block text-sm font-bold text-gray-700">
          الفئة <span className="text-red-500 mr-1">*</span>
        </label>
        <div className={validationErrors.categoryId ? "rounded-xl border-2 border-red-500 p-1 bg-red-50/30" : ""}>
          {adType === "order" ? (
            <div className="space-y-4">
              {/* Level 1: Fixed */}
              <div className="ds-input bg-gray-50 text-gray-500 font-bold cursor-not-allowed flex items-center justify-between">
                <span>طلبات الشراء</span>
                <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">فئة افتراضية</span>
              </div>

              {/* Level 2: Selection (Main Categories from Sell) */}
              <div className="animate-in slide-in-from-top-2 duration-200">
                <MobileSelect
                  label="اختر الفئة التي تطلب فيها"
                  value={orderMainCategoryId}
                  onChange={handleOrderMainCategoryChange}
                  required={true}
                  options={mainCatsForOrder.map(c => ({ value: c._id || c.id, label: c.name }))}
                  placeholder="اختر الفئة..."
                />
              </div>

              {/* Level 3: Selection (Sub Categories) */}
              {orderMainCategoryId && subCatsForOrder.length > 0 && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                  <MobileSelect
                    label="اختر القسم"
                    value={orderSubCategoryId}
                    onChange={handleOrderSubCategoryChange}
                    required={false}
                    options={subCatsForOrder.map(c => ({ value: c._id || c.id, label: c.name }))}
                    placeholder="اختر القسم (اختياري)..."
                  />
                </div>
              )}
            </div>
          ) : (
            <CategorySelect
              value={categoryId}
              onChange={handleCategoryChange}
              onMainChange={(main) => setSelectedMainCategoryName(main?.name || "")}
              required={true}
            />
          )}
        </div>
        {validationErrors.categoryId && <p className="text-xs text-red-600 font-bold">{validationErrors.categoryId}</p>}
      </div>
      
      {/* Dynamic Category Attributes - Only for sell type */}
      {adType === "sell" && categoryAttributes.length > 0 && (
        <div className="space-y-4 rounded-lg border border-gray-200 p-4 bg-gray-50">
          <h4 className="text-sm font-medium text-gray-700">خصائص الفئة</h4>
          {categoryAttributes.map((attr) => (
            <div key={attr.id || attr._id} className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                {attr.label}
                {attr.required && <span className="text-red-500 mr-1">*</span>}
              </label>
              {renderAttributeField(attr)}
              {attr.helpText && (
                <p className="text-xs text-gray-500">{attr.helpText}</p>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Condition - Only show for enabled categories */}
      {isConditionEnabled(selectedMainCategoryName) && (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">حالة المنتج</label>
          <div className="flex gap-2">
            {[
              { value: "new", label: "جديد" },
              { value: "like_new", label: "كالجديد" },
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
        </div>
      )}
      
      {/* Tags - Only for sell type */}
      {adType === "sell" && availableTags.length > 0 && (
        <div className="space-y-1">
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
      
      {/* Contact Info - Same for both types */}
      <div className="space-y-3 rounded-lg border border-gray-200 p-4 bg-white">
        <h4 className="text-sm font-bold text-gray-700 mb-2">معلومات التواصل السريع</h4>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="showPhone"
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            checked={showPhone}
            onChange={(e) => setShowPhone(e.target.checked)}
          />
          <label htmlFor="showPhone" className="text-sm font-medium text-gray-700 cursor-pointer">عرض رقم الهاتف</label>
        </div>
        {showPhone && (
          <input
            className="ds-input"
            placeholder="رقم الهاتف (مثال: 777123456)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        )}
        
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="showWhatsApp"
            className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
            checked={showWhatsApp}
            onChange={(e) => setShowWhatsApp(e.target.checked)}
          />
          <label htmlFor="showWhatsApp" className="text-sm font-medium text-gray-700 cursor-pointer">عرض واتساب</label>
        </div>
        {showWhatsApp && (
          <input
            className="ds-input"
            placeholder="رقم واتساب (مثال: 967777123456)"
            value={whatsapp}
            onChange={(e) => setWhatsApp(e.target.value)}
          />
        )}
      </div>
      
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {t("addProduct.labels.description")}
        </label>
        <textarea className="ds-input" rows="4" placeholder={t("addProduct.labels.descriptionPh")} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              placeholder="اختر المحافظة..."
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
              placeholder={governorateId ? "اختر المدينة..." : "اختر المحافظة أولاً"}
            />
          </div>
          {validationErrors.cityId && <p className="text-xs text-red-600 font-bold">{validationErrors.cityId}</p>}
        </div>
      </div>

      <div ref={formRefs.price} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1 col-span-1 sm:col-span-2">
          <label className="block text-sm font-bold text-gray-700">
            {adType === "order" ? "السعر التقريبي" : t("addProduct.labels.price")} {adType !== "order" && <span className="text-red-500 mr-1">*</span>}
          </label>
          <input
            className={`ds-input disabled:bg-gray-100 disabled:cursor-not-allowed ${validationErrors.price ? "border-red-500 ring-2 ring-red-100" : ""}`}
            placeholder="0"
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
          
          {adType === "sell" && (
            <div className="mt-2 flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={negotiable}
                  onChange={(e) => setNegotiable(e.target.checked)}
                />
                قابل للتفاوض
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
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
              </label>
            </div>
          )}

          {adType === "sell" && !priceOnContact && Number(price) > 0 && (
            <>
              <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-center text-sm text-blue-900">
                <div className="font-semibold">عمولة المنصة على هذا الإعلان</div>
                <div className="text-xs">نسبة العمولة: 1%</div>
                <div className="mt-1 text-xs">العمولة المتوقعة:</div>
                <div className="mt-0.5 text-xl font-bold">
                  {Math.round(Number(price) * 0.01)}{" "}
                  {currency === "USD" ? "$" : currency === "SAR" ? "ر.س" : currency === "YER_SANAA" ? "ر.ي (صنعاء)" : "ر.ي (عدن)"}
                </div>
              </div>
              {(currency === "YER_ADEN" || currency === "YER_SANAA" || currency === "YER") && Math.round(Number(price) * 0.01) < 1000 && (
                <div className="mt-1 text-center text-[12px] text-amber-700 font-bold">
                  إذا كانت العمولة أقل من 1000 ريال يمني (عدن) فيُستحب التصدق بها.
                </div>
              )}
            </>
          )}
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
      
      <div ref={formRefs.files} className="space-y-1">
        <label className="block text-sm font-bold text-gray-700">
          {t("addProduct.labels.images")} {adType !== "order" && <span className="text-red-500 mr-1">*</span>}
        </label>
        <div className={`relative ${validationErrors.files ? "rounded-xl border-2 border-red-500 bg-red-50/30 p-1" : ""}`}>
          <input className="ds-input" type="file" multiple accept="image/png,image/jpeg,image/jpg" onChange={handleFiles} />
        </div>
        {validationErrors.files && <p className="text-xs text-red-600 font-bold">{validationErrors.files}</p>}
        <p className="text-xs text-gray-500">
          {adType === "order" ? "يمكنك رفع صور توضيحية للمنتج الذي تطلبه (اختياري)." : "يفضل رفع صورة واحدة على الأقل، وحد أقصى 10 صور."}
        </p>
      </div>
      {previews.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-3">
          {previews.map((src, i) => (
            <img key={i} src={src} alt="" className="h-24 w-32 rounded-md object-cover" />
          ))}
        </div>
      )}

      {/* Resell / Affiliate Marketing Section - Only for sell type */}
      {adType === "sell" && (
        <div className={`space-y-4 rounded-2xl border-2 p-5 transition-all ${isResellEnabled ? 'border-purple-300 bg-purple-50/50 shadow-sm' : 'border-gray-100 bg-gray-50/30 opacity-70'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${isResellEnabled ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-200 text-gray-500'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.363.242.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.184a4.535 4.535 0 00-1.676.662C6.602 13.234 6 14.009 6 15c0 .99.602 1.765 1.324 2.246A4.535 4.535 0 009 17.908V18a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 16.766 14 15.991 14 15c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 12.092v-1.184a4.535 4.535 0 001.676-.662C13.398 9.766 14 8.991 14 8c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 5.092V5z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h4 className={`text-base font-black ${isResellEnabled ? 'text-purple-900' : 'text-gray-700'}`}>نظام إعادة البيع (التسويق بالعمولة)</h4>
                <p className={`text-xs font-bold ${isResellEnabled ? 'text-purple-600' : 'text-gray-500'}`}>اسمح للآخرين بتسويق إعلانك مقابل عمولة</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsResellEnabled(!isResellEnabled)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${isResellEnabled ? 'bg-purple-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${isResellEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {isResellEnabled && (
            <div className="space-y-5 pt-4 border-t border-purple-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-purple-900">أقصى سعر للبيع (اختياري)</label>
                  <input 
                    type="number" 
                    value={maxResellPrice} 
                    onChange={(e) => setMaxResellPrice(e.target.value)} 
                    className="w-full rounded-xl border-2 border-purple-100 bg-white px-4 py-2.5 text-sm font-bold text-gray-900 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all placeholder:text-gray-400/60" 
                    placeholder="اتركه فارغاً للسعر الحالي" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-purple-900">أقصى عدد للمسوقين</label>
                  <input 
                    type="number" 
                    value={maxResellers} 
                    onChange={(e) => setMaxResellers(e.target.value)} 
                    className="w-full rounded-xl border-2 border-purple-100 bg-white px-4 py-2.5 text-sm font-bold text-gray-900 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-purple-900">نوع العمولة للمسوق</label>
                  <select 
                    value={commissionType} 
                    onChange={(e) => setCommissionType(e.target.value)} 
                    className="w-full rounded-xl border-2 border-purple-100 bg-white px-4 py-2.5 text-sm font-bold text-gray-900 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all"
                  >
                    <option value="percentage">نسبة مئوية (%)</option>
                    <option value="fixed">مبلغ ثابت (ر.ي)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-purple-900">قيمة العمولة</label>
                  <input 
                    type="number" 
                    value={commissionValue} 
                    onChange={(e) => setCommissionValue(e.target.value)} 
                    className="w-full rounded-xl border-2 border-purple-100 bg-white px-4 py-2.5 text-sm font-bold text-gray-900 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all" 
                    placeholder={commissionType === 'percentage' ? 'مثال: 5' : 'مثال: 500'}
                  />
                </div>
              </div>

              <label className="flex items-center justify-between gap-3 rounded-xl border-2 border-purple-100 bg-white p-3 cursor-pointer hover:bg-purple-50 transition-colors">
                <span className="text-xs font-black text-purple-900">قبول طلبات التسويق تلقائياً</span>
                <input 
                  type="checkbox" 
                  checked={allowAutoApproval} 
                  onChange={(e) => setAllowAutoApproval(e.target.checked)} 
                  className="h-6 w-6 rounded-lg border-2 border-purple-200 text-purple-600 focus:ring-purple-500 transition-all" 
                />
              </label>
            </div>
          )}
        </div>
      )}

      {/* Submit Button */}
      <button 
        className="w-full h-16 rounded-[2rem] bg-gray-900 text-white font-black text-lg hover:bg-black disabled:opacity-50 transition-all shadow-2xl active:scale-[0.98]" 
        disabled={loading || !!blockErr} 
        onClick={submit}
      >
        {loading ? "جارٍ النشر..." : "نشر الإعلان الآن"}
      </button>
      {showAfterPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-2xl animate-in zoom-in duration-300">
            <div className="mb-4 flex justify-center">
              <div className="rounded-full bg-green-100 p-3">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <p className="text-center font-bold text-gray-900 text-lg mb-2">
              {adType === "order" ? "تم نشر طلب الشراء بنجاح!" : "تم نشر الإعلان بنجاح!"}
            </p>
            <p className="text-center text-sm text-gray-500 mb-8">
              {adType === "order" 
                ? "سيتم مراجعة طلبك من قبل الإدارة وسيظهر للجميع فور الموافقة عليه." 
                : "سيتم مراجعة إعلانك من قبل الإدارة في أقرب وقت."}
            </p>
            <div className="flex flex-col gap-3">
              <Link
                to="/seller/subscriptions"
                className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-3.5 text-center text-sm font-black text-white hover:shadow-xl hover:shadow-orange-200 transition-all active:scale-95"
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg">🌟</span>
                  <span>بيع أسرع! ميز إعلانك الآن</span>
                </div>
                <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 skew-x-12"></div>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setShowAfterPublishModal(false);
                  navigate("/my-ads");
                }}
                className="rounded-xl border-2 border-gray-100 bg-gray-50/50 px-5 py-3 text-sm font-bold text-gray-700 hover:bg-white hover:border-gray-200 transition-all"
              >
                عرض إعلاناتي
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
