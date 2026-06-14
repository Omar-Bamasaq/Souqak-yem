import React, { useEffect, useRef, useState } from "react";
import { useApi } from "../api/axios.js";
import { uploadsUrl } from "../lib/uploads.js";
import { useParams, Link, useNavigate } from "react-router-dom";
import { t } from "../i18n/index.js";
import CategorySelect from "../components/CategorySelect.jsx";
import { useCategoryAttributeApi } from "../api/categoryAttributes.js";
import MobileSelect from "../components/MobileSelect.jsx";

export default function EditAd() {
  const { id } = useParams();
  const api = useApi();
  const navigate = useNavigate();
  
  // Form Refs for scrolling
  const formRefs = {
    title: useRef(null),
    categoryId: useRef(null),
    governorateId: useRef(null),
    cityId: useRef(null),
    price: useRef(null),
  };

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
  const [negotiable, setNegotiable] = useState(false);
  const [priceOnContact, setPriceOnContact] = useState(false);

  // Dynamic category attributes
  const categoryAttributeApi = useCategoryAttributeApi();
  const [categoryAttributes, setCategoryAttributes] = useState([]);
  const [attributeValues, setAttributeValues] = useState({});
  const adAttrRef = useRef(null);

  const handleFiles = (e) => {
    const f = Array.from(e.target.files || []);
    setFiles(f);
    const urls = f.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
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
    if (!categoryId) errors.categoryId = "الفئة مطلوبة";
    if (!governorateId) errors.governorateId = "المحافظة مطلوبة";
    if (!cityId) errors.cityId = "المدينة مطلوبة";
    if (!priceOnContact && (!price || Number(price) <= 0)) errors.price = "يرجى إدخال السعر";

    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
      scrollToFirstError(errors);
      setErr("يرجى تعبئة الحقول المطلوبة قبل حفظ التعديلات");
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
        const res = await api.get("/governorates?active=true");
        setGovernorates(res.data || []);
      } catch {
        setGovernorates([]);
      }
    })();
  }, []);
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
    (async () => {
      try {
        const res = await api.get(`/ads/${id}/owner`);
        const ad = res.data;
        setTitle(ad.title || "");
        setDescription(ad.description || "");
        setPrice(ad.price || "");
        setCurrency(ad.currency || "YER_ADEN");
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
        setPriceOnContact(ad.priceOnContact || false);

        // Store attributes to prefill after we load category attributes metadata
        adAttrRef.current = Array.isArray(ad.attributes) ? ad.attributes : [];
      } catch {
        setErr("تعذر تحميل الإعلان");
      }
    })();
  }, [id]);

  // Load category attributes when category changes, include ancestors
  useEffect(() => {
    if (!categoryId) {
      setCategoryAttributes([]);
      setAttributeValues({});
      return;
    }
    (async () => {
      try {
        const res = await categoryAttributeApi.getCategoryAttributes(categoryId, { includeAncestors: true });
        const attrs = res.data || [];
        setCategoryAttributes(attrs);
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
        } else {
          setAttributeValues({});
        }
      } catch {
        setCategoryAttributes([]);
      }
    })();
  }, [categoryId]);

  const handleAttributeChange = (attributeId, value) => {
    setAttributeValues((prev) => ({ ...prev, [attributeId]: value }));
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
              checked={value === true || String(value).toLowerCase() === "true"}
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
                    ? currentValues.filter((v) => v !== opt)
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
      form.append("governorateId", governorateId);
      form.append("cityId", cityId);
      form.append("categoryId", categoryId);
      form.append("condition", condition);
      form.append("negotiable", negotiable ? "true" : "false");
      form.append("priceOnContact", priceOnContact ? "true" : "false");


      // Optional contact info: only send when filled to avoid forcing seller
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
      files.forEach((f) => form.append("images", f));
      // Add dynamic attributes
      const attrs = Object.entries(attributeValues).map(([attributeId, value]) => ({
        attributeId,
        value: Array.isArray(value) ? value.join(",") : String(value)
      }));
      if (attrs.length > 0) {
        form.append("attributes", JSON.stringify(attrs));
      }
      const res = await api.patch(`/ads/${id}`, form);
      if (res.data?._id) {
        setMsg("✅ تم تحديث الإعلان بنجاح" + (String(res.data.status) === "pending" ? " وإعادة نشره للمراجعة" : ""));
        // Redirect after success delay
        setTimeout(() => navigate(`/ad/${id}`), 2500);
      } else {
        setMsg("✅ تم تحديث الإعلان بنجاح");
        setTimeout(() => navigate(`/ad/${id}`), 2500);
      }
    } catch (e) {
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

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-4 ds-section relative">
      <h2 className="ds-title">تعديل الإعلان</h2>
      
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
          value={title} 
          onChange={(e) => {
            setTitle(e.target.value);
            if (e.target.value.trim()) setValidationErrors(prev => ({ ...prev, title: null }));
          }} 
        />
        {validationErrors.title && <p className="text-xs text-red-600 font-bold">{validationErrors.title}</p>}
      </div>
      
      <div ref={formRefs.categoryId} className="space-y-1">
        <label className="block text-sm font-bold text-gray-700">
          الفئة <span className="text-red-500 mr-1">*</span>
        </label>
        <div className={validationErrors.categoryId ? "rounded-xl border-2 border-red-500 p-1 bg-red-50/30" : ""}>
          <CategorySelect
            value={categoryId}
            onChange={(val) => {
              setCategoryId(val);
              setValidationErrors(prev => ({ ...prev, categoryId: null }));
            }}
            required={true}
          />
        </div>
        {validationErrors.categoryId && <p className="text-xs text-red-600 font-bold">{validationErrors.categoryId}</p>}
      </div>
      {/* Dynamic Category Attributes */}
      {categoryAttributes.length > 0 && (
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
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">{t("addProduct.labels.description")}</label>
        <textarea className="ds-input" rows="4" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      
      {/* Condition */}
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
      
      {/* Tags */}
      {availableTags.length > 0 && (
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
      
      {/* Contact Info */}
      <div className="space-y-3 rounded-lg border border-gray-200 p-4">
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
      </div>

      <div ref={formRefs.price} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
      
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">{t("addProduct.labels.images")}</label>
        <input className="ds-input" type="file" multiple accept="image/png,image/jpeg,image/jpg" onChange={handleFiles} />
      </div>
      {previews.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-3">
          {previews.map((src, i) => (
            <img key={i} src={src} alt="" className="h-24 w-32 rounded-md object-cover" />
          ))}
        </div>
      )}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">الصور الحالية</label>
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




      <button disabled={loading} type="submit" className="ds-btn-primary w-full disabled:opacity-60 py-4 text-lg font-bold">
        {loading ? "جاري الحفظ..." : "حفظ التعديلات"}
      </button>
      <div className="mt-3 text-center border-t pt-4">
        <Link to="/my-ads" className="text-sm text-gray-500 hover:text-brand-600 underline">إلغاء والعودة إلى إعلاناتي</Link>
      </div>
    </form>
  );
}
