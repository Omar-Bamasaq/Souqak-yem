import React, { useEffect, useMemo, useState } from "react";
import { useApi } from "../api/axios.js";
import { uploadsUrl } from "../lib/uploads.js";
import { nextDigitalServiceId } from "../lib/digitalServiceIds.js";
import DigitalServiceForm from "../components/DigitalServiceForm.jsx";

const CURRENCIES = [
  { value: "USD", label: "دولار أمريكي" },
  { value: "SAR", label: "ريال سعودي" },
  { value: "YER_ADEN", label: "ريال يمني (عدن)" },
  { value: "YER_SANAA", label: "ريال يمني (صنعاء)" }
];
const SERVICE_TYPES = [
  ["AI_TOOL", "أداة ذكاء اصطناعي"],
  ["GAME_TOPUP", "لعبة أو شحن ألعاب"],
  ["SOFTWARE", "برنامج أو تطبيق"],
  ["ENTERTAINMENT", "ترفيه أو منصة مشاهدة"],
  ["DIGITAL_CARD", "بطاقة رقمية"],
  ["OTHER", "خدمة رقمية أخرى"]
];
const FIELD_TYPES = [
  ["TEXT", "نص قصير"],
  ["NUMBER", "رقم"],
  ["EMAIL", "بريد إلكتروني"],
  ["URL", "رابط"],
  ["SELECT", "اختيار واحد"],
  ["MULTI_SELECT", "اختيار متعدد"],
  ["TEXTAREA", "نص طويل"],
  ["BOOLEAN", "نعم / لا"]
];
const blankCategory = { name: "", slug: "", description: "", image: "", sortOrder: "0", isActive: true };
const blankForm = {
  name: "", description: "", image: "", categoryId: "", serviceType: "OTHER", pricingType: "UNIT",
  formSchema: [], packages: [], currency: "USD", unitLabel: "وحدة", unitPrice: "1",
  minimumQuantityEnabled: true, maximumQuantityEnabled: true, minimumQuantity: "1",
  maximumQuantity: "50000", customerInfoLabel: "", sections: [], isActive: true, sortOrder: "0"
};
const fieldClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

function defaultField(id, index) {
  return {
    id: `field${index + 1}`,
    name: `field${index + 1}`,
    label: "",
    type: "TEXT",
    required: false,
    sortOrder: index,
    placeholder: "",
    helpText: "",
    options: []
  };
}

function slugify(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function updateOption(field, optionIndex, key, value) {
  const options = [...(field.options || [])];
  options[optionIndex] = { ...options[optionIndex], [key]: value };
  return { ...field, options };
}

export default function AdminWalletServices() {
  const api = useApi();
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [feeBands, setFeeBands] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [categoryForm, setCategoryForm] = useState(blankCategory);
  const [categoryEditId, setCategoryEditId] = useState("");
  const [categoryImageFile, setCategoryImageFile] = useState(null);
  const [categoryImagePreview, setCategoryImagePreview] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [feeForm, setFeeForm] = useState([]);
  const [editId, setEditId] = useState(null);
  const [versionData, setVersionData] = useState(null);
  const [previewAnswers, setPreviewAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const [serviceResponse, categoryResponse] = await Promise.all([
        api.get("/wallet-services/admin/services"),
        api.get("/wallet-services/admin/categories")
      ]);
      setServices(serviceResponse.data?.services || []);
      setCategories(categoryResponse.data || []);
      setFeeBands(serviceResponse.data?.feeBands || []);
      setFeeForm((serviceResponse.data?.feeBands || []).map((band) => ({ ...band })));
    } catch (loadError) {
      setError(loadError.response?.data?.error || "تعذر تحميل إدارة الخدمات.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => () => {
    if (categoryImagePreview.startsWith("blob:")) URL.revokeObjectURL(categoryImagePreview);
  }, [categoryImagePreview]);

  const resetForm = () => {
    setEditId(null);
    setForm(blankForm);
    setImageFile(null);
    setImagePreview("");
    setVersionData(null);
    setPreviewAnswers({});
  };

  const resetCategory = () => {
    setCategoryEditId("");
    setCategoryForm(blankCategory);
    setCategoryImageFile(null);
    setCategoryImagePreview("");
    const imageInput = document.getElementById("category-image-input");
    if (imageInput) imageInput.value = "";
  };

  const saveCategory = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = new FormData();
      Object.entries(categoryForm).forEach(([key, value]) => {
        if (key !== "image") payload.append(key, String(value));
      });
      if (categoryImageFile) payload.append("image", categoryImageFile);
      if (categoryEditId) await api.patch(`/wallet-services/admin/categories/${categoryEditId}`, payload);
      else await api.post("/wallet-services/admin/categories", payload);
      resetCategory();
      await load();
    } catch (saveError) {
      setError(saveError.response?.data?.error || "تعذر حفظ التصنيف.");
    } finally {
      setLoading(false);
    }
  };

  const editCategory = (category) => {
    setCategoryEditId(category._id);
    setCategoryImageFile(null);
    setCategoryImagePreview(category.image ? uploadsUrl(category.image) : "");
    setCategoryForm({
      name: category.name || "",
      slug: category.slug || "",
      description: category.description || "",
      image: category.image || "",
      sortOrder: String(category.sortOrder || 0),
      isActive: category.isActive !== false
    });
    const imageInput = document.getElementById("category-image-input");
    if (imageInput) imageInput.value = "";
    document.getElementById("category-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const chooseCategoryImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("حجم صورة التصنيف يجب ألا يتجاوز 2 ميجابايت.");
      setCategoryImageFile(null);
      setCategoryImagePreview(categoryForm.image ? uploadsUrl(categoryForm.image) : "");
      event.target.value = "";
      return;
    }
    setError("");
    setCategoryImageFile(file);
    setCategoryImagePreview(URL.createObjectURL(file));
  };

  const categoryAction = async (category, action) => {
    if (action === "archive" && !window.confirm(`أرشفة التصنيف «${category.name}»؟`)) return;
    if (action === "delete" && !window.confirm(`حذف التصنيف «${category.name}» نهائيًا؟ سيُؤرشف أولًا إذا لم يكن مؤرشفًا، ولا يمكن التراجع عن الحذف. إذا كان مرتبطًا بخدمات أو طلبات سيتعذر حذفه.`)) return;
    setLoading(true);
    setError("");
    try {
      if (action === "archive") await api.post(`/wallet-services/admin/categories/${category._id}/archive`);
      else if (action === "delete") {
        if (!category.isArchived) {
          await api.post(`/wallet-services/admin/categories/${category._id}/archive`);
        }
        await api.delete(`/wallet-services/admin/categories/${category._id}`);
        if (categoryEditId === category._id) resetCategory();
      }
      else await api.post(`/wallet-services/admin/categories/${category._id}/status`, { isActive: !category.isActive });
      await load();
    } catch (actionError) {
      setError(actionError.response?.data?.error || "تعذر تحديث التصنيف.");
      if (action === "delete" && !category.isArchived) await load();
    } finally {
      setLoading(false);
    }
  };

  const saveService = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = new FormData();
      for (const [key, value] of Object.entries(form)) {
        if (["sections", "formSchema", "packages"].includes(key)) data.append(key, JSON.stringify(value));
        else data.append(key, String(value));
      }
      if (imageFile) data.append("logo", imageFile);
      if (editId) await api.patch(`/wallet-services/admin/services/${editId}`, data);
      else await api.post("/wallet-services/admin/services", data);
      resetForm();
      await load();
    } catch (saveError) {
      setError(saveError.response?.data?.error || "تعذر حفظ الخدمة.");
    } finally {
      setLoading(false);
    }
  };

  const editService = async (service) => {
    setEditId(service._id);
    setForm({
      name: service.name || "",
      description: service.description || "",
      image: service.image || "",
      categoryId: service.categoryId || "",
      serviceType: service.serviceType || "OTHER",
      pricingType: service.pricingType || "UNIT",
      formSchema: (service.formSchema || []).map((field, index) => ({ ...field, sortOrder: index })),
      packages: (service.packages || []).map((item) => ({ ...item })),
      currency: service.currency || "USD",
      unitLabel: service.unitLabel || "وحدة",
      unitPrice: service.unitPrice ?? "",
      minimumQuantityEnabled: service.minimumQuantityEnabled !== false,
      maximumQuantityEnabled: service.maximumQuantityEnabled !== false,
      minimumQuantity: String(service.minimumQuantity ?? 1),
      maximumQuantity: String(service.maximumQuantity ?? 50000),
      customerInfoLabel: service.customerInfoLabel || "",
      sections: (service.sections || []).map((section) => ({ _id: section._id, name: section.name, unitPrice: String(section.unitPrice) })),
      isActive: service.isActive !== false,
      sortOrder: String(service.sortOrder || 0)
    });
    setImageFile(null);
    setImagePreview(service.image ? uploadsUrl(service.image) : "");
    setPreviewAnswers({});
    setVersionData(null);
    setError("");
    try {
      const response = await api.get(`/wallet-services/admin/services/${service._id}/versions`);
      setVersionData(response.data);
    } catch (versionError) {
      setError(versionError.response?.data?.error || "تعذر تحميل سجل إصدارات الخدمة.");
    }
    document.getElementById("service-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const serviceAction = async (service, action) => {
    if (action === "archive" && !window.confirm(`أرشفة الخدمة «${service.name}»؟ لن تُحذف الطلبات السابقة.`)) return;
    if (action === "delete" && !window.confirm(`حذف الخدمة «${service.name}» نهائيًا؟ ستُؤرشف أولًا إذا لم تكن مؤرشفة، ولا يمكن التراجع عن الحذف. إذا كانت مرتبطة بطلبات أو مسودات نشطة سيتعذر حذفها.`)) return;
    setLoading(true);
    setError("");
    try {
      if (action === "archive") await api.post(`/wallet-services/admin/services/${service._id}/archive`);
      else if (action === "delete") {
        if (!service.isArchived) {
          await api.post(`/wallet-services/admin/services/${service._id}/archive`);
        }
        await api.delete(`/wallet-services/admin/services/${service._id}`);
        if (editId === service._id) resetForm();
      }
      else await api.post(`/wallet-services/admin/services/${service._id}/status`, { isActive: !service.isActive });
      await load();
    } catch (actionError) {
      setError(actionError.response?.data?.error || "تعذر تحديث الخدمة.");
      if (action === "delete" && !service.isArchived) await load();
    } finally {
      setLoading(false);
    }
  };

  const changeSection = (index, key, value) => {
    setForm((current) => ({ ...current, sections: current.sections.map((section, sectionIndex) => sectionIndex === index ? { ...section, [key]: value } : section) }));
  };

  const changeField = (index, updates) => {
    setForm((current) => {
      const formSchema = [...current.formSchema];
      const previousId = formSchema[index]?.id;
      formSchema[index] = { ...formSchema[index], ...updates };
      const renamedSchema = updates.id && updates.id !== previousId
        ? formSchema.map((field) => field.when?.fieldId === previousId
          ? { ...field, when: { ...field.when, fieldId: updates.id } }
          : field)
        : formSchema;
      return { ...current, formSchema: renamedSchema };
    });
  };

  const updateValidation = (index, key, value) => {
    const validation = { ...(form.formSchema[index].validation || {}) };
    if (value === "") delete validation[key];
    else validation[key] = Number(value);
    changeField(index, { validation: Object.keys(validation).length ? validation : undefined });
  };

  const moveField = (index, offset) => {
    const targetIndex = index + offset;
    if (targetIndex < 0 || targetIndex >= form.formSchema.length) return;
    const formSchema = [...form.formSchema];
    [formSchema[index], formSchema[targetIndex]] = [formSchema[targetIndex], formSchema[index]];
    const priorIds = new Set();
    setForm({
      ...form,
      formSchema: formSchema.map((field, sortOrder) => {
        const reordered = { ...field, sortOrder };
        if (reordered.when && !priorIds.has(reordered.when.fieldId)) delete reordered.when;
        priorIds.add(reordered.id);
        return reordered;
      })
    });
  };

  const addField = () => setForm((current) => {
    const id = nextDigitalServiceId("field", current.formSchema.map((field) => field.id));
    return { ...current, formSchema: [...current.formSchema, { ...defaultField(id, current.formSchema.length), id, name: id }] };
  });

  const addPackage = () => setForm((current) => ({
    ...current,
    packages: [...current.packages, {
      id: nextDigitalServiceId("package", current.packages.map((item) => item.id)),
      name: "",
      description: "",
      price: "",
      currency: current.currency,
      isActive: true,
      sortOrder: current.packages.length
    }]
  }));

  const addOption = (fieldIndex) => setForm((current) => {
    const field = current.formSchema[fieldIndex];
    if (!field) return current;
    const options = field.options || [];
    const formSchema = [...current.formSchema];
    formSchema[fieldIndex] = {
      ...field,
      options: [...options, {
        id: nextDigitalServiceId("option", options.map((option) => option.id)),
        label: "",
        value: "",
        isActive: true,
        sortOrder: options.length
      }]
    };
    return { ...current, formSchema };
  });

  const saveFeeBands = async () => {
    setLoading(true);
    setError("");
    try {
      const feeBandsPayload = feeForm.map((band) => ({
        currency: band.currency,
        minimumAmount: Number(band.minimumAmount),
        maximumAmount: Number(band.maximumAmount),
        feeAmount: Number(band.feeAmount)
      }));
      await api.put("/wallet-services/admin/fee-bands", { feeBands: feeBandsPayload });
      await load();
      window.dispatchEvent(new CustomEvent("app:toast", { detail: { message: "تم حفظ شرائح الرسوم.", type: "success" } }));
    } catch (saveError) {
      setError(saveError.response?.data?.error || "تعذر حفظ شرائح الرسوم.");
    } finally {
      setLoading(false);
    }
  };

  const activeServicesCount = services.filter((service) => service.isActive && !service.isArchived).length;
  const activeCategories = useMemo(() => categories.filter((category) => category.isActive && !category.isArchived), [categories]);

  return (
    <div className="space-y-7" dir="rtl">
      <header className="overflow-hidden rounded-3xl bg-gradient-to-l from-slate-950 via-cyan-950 to-blue-800 p-5 text-white shadow-lg sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-xs font-black text-cyan-200">إعدادات خدمات الدفع</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">كتالوج الخدمات الرقمية</h1><p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-blue-100">أدر التصنيفات والخدمات والباقات والنماذج الآمنة، مع إبقاء الأسعار النهائية والتحقق بيد الخادم.</p></div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-3"><p className="text-[11px] font-bold text-blue-100">الخدمات</p><p className="mt-1 text-xl font-black">{services.length}</p></div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-3"><p className="text-[11px] font-bold text-blue-100">مفعلة</p><p className="mt-1 text-xl font-black">{activeServicesCount}</p></div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-3"><p className="text-[11px] font-bold text-blue-100">التصنيفات</p><p className="mt-1 text-xl font-black">{activeCategories.length}</p></div>
          </div>
        </div>
        <nav aria-label="أقسام إدارة الخدمات" className="mt-5 flex flex-wrap gap-2 border-t border-white/15 pt-4">
          <a href="#category-editor" className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black hover:bg-white/20">التصنيفات</a>
          <a href="#service-editor" className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black hover:bg-white/20">الخدمات والنماذج</a>
          <a href="#fee-bands" className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black hover:bg-white/20">رسوم سوقك</a>
          <a href="#service-list" className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black hover:bg-white/20">قائمة الخدمات</a>
        </nav>
      </header>
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}

      <section id="category-editor" className="scroll-mt-6 grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <form onSubmit={saveCategory} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-black text-cyan-700 dark:text-cyan-300">التصنيفات</p><h2 className="mt-1 text-lg font-black">{categoryEditId ? "تعديل التصنيف" : "إضافة تصنيف"}</h2></div>{categoryEditId && <button type="button" onClick={resetCategory} className="text-xs font-bold text-blue-700">إلغاء</button>}</div>
          <label className="block space-y-1.5 text-xs font-bold">اسم التصنيف<input className={fieldClass} value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} maxLength={120} required /></label>
          <label className="block space-y-1.5 text-xs font-bold">المعرف (إنجليزي وأرقام وشرطة)<input className={fieldClass} value={categoryForm.slug} onChange={(event) => setCategoryForm({ ...categoryForm, slug: event.target.value.toLowerCase() })} maxLength={80} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label>
          {!categoryEditId && categoryForm.name && !categoryForm.slug && <button type="button" onClick={() => setCategoryForm({ ...categoryForm, slug: slugify(categoryForm.name) })} className="text-xs font-bold text-blue-700">اقتراح معرف من الاسم</button>}
          <label className="block space-y-1.5 text-xs font-bold">الوصف<textarea className={fieldClass} rows={2} maxLength={1000} value={categoryForm.description} onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value })} /></label>
          <div className="space-y-2 text-xs font-bold">
            <label htmlFor="category-image-input" className="block">صورة التصنيف</label>
            <input id="category-image-input" className={fieldClass} type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseCategoryImage} />
            <p className="font-medium text-slate-500">اختر صورة JPG أو PNG أو WebP، بحد أقصى 2 ميجابايت. سيتم تحويلها تلقائيًا إلى WebP.</p>
            {categoryImagePreview && <img src={categoryImagePreview} alt={`معاينة صورة ${categoryForm.name || "التصنيف"}`} className="h-20 w-20 rounded-xl border border-slate-200 object-cover" />}
          </div>
          <div className="grid grid-cols-2 gap-3"><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={categoryForm.isActive} onChange={(event) => setCategoryForm({ ...categoryForm, isActive: event.target.checked })} />التصنيف مفعّل</label><label className="space-y-1.5 text-xs font-bold">ترتيب الظهور<input className={fieldClass} type="number" step="1" value={categoryForm.sortOrder} onChange={(event) => setCategoryForm({ ...categoryForm, sortOrder: event.target.value })} /></label></div>
          <button disabled={loading} className="w-full rounded-xl bg-cyan-700 px-4 py-3 font-black text-white disabled:opacity-50">{loading ? "جارٍ الحفظ..." : categoryEditId ? "حفظ التصنيف" : "إضافة التصنيف"}</button>
        </form>

        <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <h2 className="text-lg font-black">التصنيفات الحالية ({categories.length})</h2>
          {categories.map((category) => (
            <article key={category._id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 p-3 dark:border-slate-800">
              {category.image ? <img src={uploadsUrl(category.image)} alt="" className="h-11 w-11 rounded-xl object-cover" /> : <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-50 text-xl">▦</span>}
              <div className="min-w-0 flex-1"><p className="font-black">{category.name}</p><p className="text-xs text-slate-500" dir="ltr">{category.slug} · {category.isArchived ? "مؤرشف" : category.isActive ? "مفعّل" : "متوقف"}</p></div>
              {!category.isArchived && <><button type="button" onClick={() => editCategory(category)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black">تعديل</button><button type="button" onClick={() => categoryAction(category, "status")} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black">{category.isActive ? "إيقاف" : "تفعيل"}</button><button type="button" onClick={() => categoryAction(category, "archive")} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-black text-red-700">أرشفة</button></>}
              <button type="button" disabled={loading} onClick={() => categoryAction(category, "delete")} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-black text-red-700 disabled:opacity-50">حذف نهائي</button>
            </article>
          ))}
          {categories.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">لا توجد تصنيفات بعد.</p>}
        </section>
      </section>

      <form id="service-editor" onSubmit={saveService} className="scroll-mt-6 space-y-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-black text-blue-700 dark:text-blue-300">إدارة الخدمة</p><h2 className="mt-1 text-lg font-black">{editId ? "تعديل الخدمة" : "إضافة خدمة جديدة"}</h2></div>{editId && <button type="button" onClick={resetForm} className="text-xs font-bold text-blue-700">إلغاء التعديل</button>}</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5 text-xs font-bold">اسم الخدمة<input className={fieldClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={120} required /></label>
          <label className="block space-y-1.5 text-xs font-bold">التصنيف<select className={fieldClass} value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}><option value="">بدون تصنيف (خدمة قديمة)</option>{activeCategories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select></label>
          <label className="block space-y-1.5 text-xs font-bold">نوع الخدمة<select className={fieldClass} value={form.serviceType} onChange={(event) => setForm({ ...form, serviceType: event.target.value })}>{SERVICE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="block space-y-1.5 text-xs font-bold">الوصف<textarea className={fieldClass} rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength={1000} /></label>
          <label className="block space-y-1.5 text-xs font-bold">صورة الخدمة<input className={fieldClass} type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0] || null; setImageFile(file); setImagePreview(file ? URL.createObjectURL(file) : form.image ? uploadsUrl(form.image) : ""); }} /></label>
          {imagePreview && <img src={imagePreview} alt="معاينة صورة الخدمة" className="h-24 w-24 rounded-2xl object-cover" />}
          <label className="block space-y-1.5 text-xs font-bold">طريقة التسعير<select className={fieldClass} value={form.pricingType} onChange={(event) => setForm({ ...form, pricingType: event.target.value, sections: event.target.value === "UNIT" ? form.sections : [], packages: event.target.value === "PACKAGE" ? form.packages : [] })}><option value="FIXED">سعر ثابت للطلب</option><option value="UNIT">سعر حسب الكمية</option><option value="PACKAGE">باقات محددة</option></select></label>
          <label className="block space-y-1.5 text-xs font-bold">العملة<select className={fieldClass} value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value, packages: form.packages.map((item) => ({ ...item, currency: event.target.value })) })}>{CURRENCIES.map((currency) => <option key={currency.value} value={currency.value}>{currency.label}</option>)}</select></label>
          {form.pricingType !== "PACKAGE" && <label className="block space-y-1.5 text-xs font-bold">{form.pricingType === "FIXED" ? "سعر الطلب الثابت" : "سعر الوحدة"}<input className={fieldClass} type="number" min="0" step="0.01" value={form.unitPrice} onChange={(event) => setForm({ ...form, unitPrice: event.target.value })} required={form.pricingType === "FIXED" || form.sections.length === 0} /></label>}
          <label className="block space-y-1.5 text-xs font-bold">{form.pricingType === "FIXED" ? "وصف الوحدة (اختياري)" : "وحدة القياس"}<input className={fieldClass} value={form.unitLabel} onChange={(event) => setForm({ ...form, unitLabel: event.target.value })} maxLength={40} required /></label>
          <label className="block space-y-1.5 text-xs font-bold">عنوان بيانات إضافية ثابتة (اختياري)<input className={fieldClass} placeholder="مثال: معرّف اللاعب" maxLength={100} value={form.customerInfoLabel} onChange={(event) => setForm({ ...form, customerInfoLabel: event.target.value })} /></label>
        </div>

        {form.pricingType === "UNIT" && <>
          <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800 sm:grid-cols-2">
            <div className="space-y-3"><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={form.minimumQuantityEnabled} onChange={(event) => setForm({ ...form, minimumQuantityEnabled: event.target.checked })} />تفعيل الحد الأدنى</label>{form.minimumQuantityEnabled && <label className="block space-y-1.5 text-xs font-bold">أقل كمية<input className={fieldClass} type="number" min="1" step="1" value={form.minimumQuantity} onChange={(event) => setForm({ ...form, minimumQuantity: event.target.value })} required /></label>}</div>
            <div className="space-y-3"><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={form.maximumQuantityEnabled} onChange={(event) => setForm({ ...form, maximumQuantityEnabled: event.target.checked })} />تفعيل الحد الأعلى</label>{form.maximumQuantityEnabled && <label className="block space-y-1.5 text-xs font-bold">أعلى كمية<input className={fieldClass} type="number" min={form.minimumQuantityEnabled ? form.minimumQuantity : 1} step="1" value={form.maximumQuantity} onChange={(event) => setForm({ ...form, maximumQuantity: event.target.value })} required /></label>}</div>
          </div>
          <section className="space-y-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-black">أقسام وأسعار اختيارية</h3><button type="button" onClick={() => setForm({ ...form, sections: [...form.sections, { name: "", unitPrice: "" }] })} className="rounded-lg bg-blue-100 px-3 py-2 text-xs font-black text-blue-800">إضافة قسم</button></div>
            {form.sections.map((section, index) => <div key={section._id || index} className="grid gap-2 sm:grid-cols-[1fr_150px_auto]"><input className={fieldClass} placeholder="اسم القسم" value={section.name} onChange={(event) => changeSection(index, "name", event.target.value)} required /><input className={fieldClass} type="number" min="0" step="0.01" placeholder="سعر الوحدة" value={section.unitPrice} onChange={(event) => changeSection(index, "unitPrice", event.target.value)} required /><button type="button" onClick={() => setForm({ ...form, sections: form.sections.filter((_, sectionIndex) => sectionIndex !== index) })} className="text-sm font-black text-red-600">حذف</button></div>)}
            {form.sections.length > 0 && <p className="text-[11px] font-semibold text-slate-500">عند وجود أقسام، يُستخدم سعر القسم بدل سعر الوحدة الأساسي.</p>}
          </section>
        </>}

        {form.pricingType === "PACKAGE" && <section className="space-y-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-black">الباقات</h3><p className="text-[11px] font-medium text-slate-500">المعرف لاتيني فريد ويستخدم لربط الطلب بالباقة عند الإرسال.</p></div><button type="button" onClick={addPackage} className="rounded-lg bg-blue-100 px-3 py-2 text-xs font-black text-blue-800">إضافة باقة</button></div>
          {form.packages.map((item, index) => <div key={`${item.id}-${index}`} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-2">
            <label className="space-y-1 text-xs font-bold">المعرف<input className={fieldClass} value={item.id} onChange={(event) => setForm({ ...form, packages: form.packages.map((current, itemIndex) => itemIndex === index ? { ...current, id: event.target.value } : current) })} pattern="[A-Za-z][A-Za-z0-9_-]{0,49}" required /></label>
            <label className="space-y-1 text-xs font-bold">اسم الباقة<input className={fieldClass} value={item.name} onChange={(event) => setForm({ ...form, packages: form.packages.map((current, itemIndex) => itemIndex === index ? { ...current, name: event.target.value } : current) })} maxLength={120} required /></label>
            <label className="space-y-1 text-xs font-bold">السعر<input className={fieldClass} type="number" min="0" step="0.01" value={item.price} onChange={(event) => setForm({ ...form, packages: form.packages.map((current, itemIndex) => itemIndex === index ? { ...current, price: event.target.value } : current) })} required /></label>
            <label className="space-y-1 text-xs font-bold">الوصف<input className={fieldClass} value={item.description || ""} onChange={(event) => setForm({ ...form, packages: form.packages.map((current, itemIndex) => itemIndex === index ? { ...current, description: event.target.value } : current) })} maxLength={500} /></label>
            <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={item.isActive !== false} onChange={(event) => setForm({ ...form, packages: form.packages.map((current, itemIndex) => itemIndex === index ? { ...current, isActive: event.target.checked } : current) })} />الباقة متاحة</label>
            <button type="button" onClick={() => setForm({ ...form, packages: form.packages.filter((_, itemIndex) => itemIndex !== index) })} className="text-xs font-black text-red-600">حذف الباقة</button>
          </div>)}
          {form.packages.length === 0 && <p className="text-sm font-bold text-amber-700">أضف باقة واحدة على الأقل قبل حفظ خدمة الباقات.</p>}
        </section>}

        <section className="space-y-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-black">نموذج الطلب الديناميكي</h3><p className="mt-1 text-xs leading-5 text-slate-500">تعريفات بيانات فقط بلا HTML أو JavaScript قابل للتنفيذ. يدعم الترتيب والتحقق والخيارات وشروط ظهور الحقول.</p></div><button type="button" onClick={addField} className="rounded-lg bg-blue-100 px-3 py-2 text-xs font-black text-blue-800">إضافة حقل</button></div>
          {form.formSchema.map((field, index) => {
            const priorFields = form.formSchema.slice(0, index);
            const conditionField = priorFields.find((item) => item.id === field.when?.fieldId);
            const conditionUsesOptions = ["SELECT", "MULTI_SELECT"].includes(conditionField?.type);
            return <article key={`${field.id}-${index}`} className="space-y-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
              <div className="flex items-center justify-between"><h4 className="text-xs font-black">الحقل {index + 1}</h4><div className="flex gap-2"><button type="button" disabled={index === 0} onClick={() => moveField(index, -1)} className="text-xs font-bold text-blue-700 disabled:opacity-40">↑</button><button type="button" disabled={index === form.formSchema.length - 1} onClick={() => moveField(index, 1)} className="text-xs font-bold text-blue-700 disabled:opacity-40">↓</button><button type="button" onClick={() => setForm({ ...form, formSchema: form.formSchema.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({ ...item, sortOrder: itemIndex })) })} className="text-xs font-black text-red-600">حذف</button></div></div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="space-y-1 text-xs font-bold">معرف الحقل<input className={fieldClass} value={field.id} onChange={(event) => changeField(index, { id: event.target.value, name: event.target.value })} pattern="[A-Za-z][A-Za-z0-9_-]{0,49}" required /></label>
                <label className="space-y-1 text-xs font-bold">التسمية الظاهرة<input className={fieldClass} value={field.label} onChange={(event) => changeField(index, { label: event.target.value })} maxLength={120} required /></label>
                <label className="space-y-1 text-xs font-bold">نوع الحقل<select className={fieldClass} value={field.type} onChange={(event) => changeField(index, { type: event.target.value, options: ["SELECT", "MULTI_SELECT"].includes(event.target.value) ? (field.options?.length ? field.options : [{ id: nextDigitalServiceId("option", (field.options || []).map((option) => option.id)), label: "", value: "", isActive: true, sortOrder: 0 }]) : [], defaultValue: undefined, validation: undefined, when: undefined })}>{FIELD_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="space-y-1 text-xs font-bold">نص إرشادي<input className={fieldClass} value={field.placeholder || ""} onChange={(event) => changeField(index, { placeholder: event.target.value })} maxLength={160} /></label>
                <label className="space-y-1 text-xs font-bold sm:col-span-2">تعليمات للمستخدم<input className={fieldClass} value={field.helpText || ""} onChange={(event) => changeField(index, { helpText: event.target.value })} maxLength={500} /></label>
                <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={Boolean(field.required)} onChange={(event) => changeField(index, { required: event.target.checked })} />حقل مطلوب</label>
                {field.type === "NUMBER" && <div className="grid grid-cols-2 gap-2"><label className="space-y-1 text-xs font-bold">أدنى قيمة<input className={fieldClass} type="number" value={field.validation?.min ?? ""} onChange={(event) => updateValidation(index, "min", event.target.value)} /></label><label className="space-y-1 text-xs font-bold">أعلى قيمة<input className={fieldClass} type="number" value={field.validation?.max ?? ""} onChange={(event) => updateValidation(index, "max", event.target.value)} /></label></div>}
                {["TEXT", "EMAIL", "URL", "TEXTAREA"].includes(field.type) && <div className="grid grid-cols-2 gap-2"><label className="space-y-1 text-xs font-bold">أقل طول<input className={fieldClass} type="number" min="0" max="2000" value={field.validation?.minLength ?? ""} onChange={(event) => updateValidation(index, "minLength", event.target.value)} /></label><label className="space-y-1 text-xs font-bold">أقصى طول<input className={fieldClass} type="number" min="0" max="2000" value={field.validation?.maxLength ?? ""} onChange={(event) => updateValidation(index, "maxLength", event.target.value)} /></label></div>}
                {field.type === "BOOLEAN" && <label className="space-y-1 text-xs font-bold">القيمة الافتراضية<select className={fieldClass} value={field.defaultValue === undefined ? "" : field.defaultValue ? "true" : "false"} onChange={(event) => changeField(index, { defaultValue: event.target.value === "" ? undefined : event.target.value === "true" })}><option value="">بدون قيمة افتراضية</option><option value="true">نعم</option><option value="false">لا</option></select></label>}
                {!["BOOLEAN", "SELECT", "MULTI_SELECT"].includes(field.type) && <label className="space-y-1 text-xs font-bold">القيمة الافتراضية<input className={fieldClass} type={field.type === "NUMBER" ? "number" : "text"} value={field.defaultValue ?? ""} onChange={(event) => changeField(index, { defaultValue: event.target.value === "" ? undefined : field.type === "NUMBER" ? Number(event.target.value) : event.target.value })} /></label>}
              </div>
              {["SELECT", "MULTI_SELECT"].includes(field.type) && <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-center justify-between"><p className="text-xs font-black">خيارات الحقل</p><button type="button" onClick={() => addOption(index)} className="text-xs font-black text-blue-700">إضافة خيار</button></div>
                {(field.options || []).map((option, optionIndex) => <div key={`${option.id}-${optionIndex}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]"><input className={fieldClass} placeholder="اسم الخيار" value={option.label} onChange={(event) => changeField(index, updateOption(field, optionIndex, "label", event.target.value))} required /><input className={fieldClass} placeholder="القيمة" value={option.value} onChange={(event) => changeField(index, updateOption(field, optionIndex, "value", event.target.value))} required /><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={option.isActive !== false} onChange={(event) => changeField(index, updateOption(field, optionIndex, "isActive", event.target.checked))} />متاح</label><button type="button" onClick={() => changeField(index, { options: field.options.filter((_, itemIndex) => itemIndex !== optionIndex).map((item, itemIndex) => ({ ...item, sortOrder: itemIndex })) })} className="text-xs font-black text-red-600">حذف</button></div>)}
                {field.type === "SELECT" && <label className="space-y-1 text-xs font-bold">القيمة الافتراضية<select className={fieldClass} value={field.defaultValue || ""} onChange={(event) => changeField(index, { defaultValue: event.target.value || undefined })}><option value="">بدون قيمة افتراضية</option>{(field.options || []).filter((option) => option.isActive).map((option) => <option key={option.id} value={option.value}>{option.label}</option>)}</select></label>}
                {field.type === "MULTI_SELECT" && <fieldset className="space-y-1 text-xs font-bold"><legend>القيم الافتراضية</legend>{(field.options || []).filter((option) => option.isActive).map((option) => <label key={option.id} className="flex items-center gap-2"><input type="checkbox" checked={(field.defaultValue || []).includes(option.value)} onChange={(event) => {
                  const currentValues = field.defaultValue || [];
                  const defaultValue = event.target.checked
                    ? [...currentValues, option.value]
                    : currentValues.filter((value) => value !== option.value);
                  changeField(index, { defaultValue: defaultValue.length ? defaultValue : undefined });
                }} />{option.label}</label>)}</fieldset>}
              </div>}
              {priorFields.length > 0 && <div className="grid gap-2 rounded-xl border border-blue-100 p-3 dark:border-blue-900 sm:grid-cols-3">
                <label className="space-y-1 text-xs font-bold">إظهار عند إجابة سابقة<select className={fieldClass} value={field.when?.fieldId || ""} onChange={(event) => {
                  if (!event.target.value) {
                    const { when, ...rest } = field;
                    changeField(index, rest);
                  } else {
                    const source = priorFields.find((item) => item.id === event.target.value);
                    const value = source.type === "BOOLEAN" ? true : source.type === "NUMBER" ? 0 : source.options?.find((option) => option.isActive)?.value || "";
                    changeField(index, { when: { fieldId: source.id, operator: source.type === "MULTI_SELECT" ? "CONTAINS" : "EQUALS", value } });
                  }
                }}><option value="">دائمًا ظاهر</option>{priorFields.map((item) => <option key={item.id} value={item.id}>{item.label || item.id}</option>)}</select></label>
                {field.when && conditionField && <>
                  <label className="space-y-1 text-xs font-bold">الشرط<select className={fieldClass} value={field.when.operator} onChange={(event) => changeField(index, { when: { ...field.when, operator: event.target.value } })}>{conditionField.type !== "MULTI_SELECT" && <><option value="EQUALS">يساوي</option><option value="NOT_EQUALS">لا يساوي</option></>}{["TEXT", "TEXTAREA", "MULTI_SELECT"].includes(conditionField.type) && <><option value="CONTAINS">يحتوي</option><option value="NOT_CONTAINS">لا يحتوي</option></>}</select></label>
                  <label className="space-y-1 text-xs font-bold">القيمة{conditionField.type === "BOOLEAN" || conditionUsesOptions ? <select className={fieldClass} value={String(field.when.value)} onChange={(event) => changeField(index, { when: { ...field.when, value: conditionField.type === "BOOLEAN" ? event.target.value === "true" : event.target.value } })}>{conditionField.type === "BOOLEAN" ? <><option value="true">نعم</option><option value="false">لا</option></> : conditionField.options?.filter((option) => option.isActive).map((option) => <option key={option.id} value={option.value}>{option.label}</option>)}</select> : <input className={fieldClass} type={conditionField.type === "NUMBER" ? "number" : "text"} value={field.when.value} onChange={(event) => changeField(index, { when: { ...field.when, value: event.target.value === "" ? "" : conditionField.type === "NUMBER" ? Number(event.target.value) : event.target.value } })} required />}</label>
                </>}
              </div>}
            </article>;
          })}
          {form.formSchema.length > 0 && <div className="rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-700"><p className="mb-3 text-xs font-black text-slate-600 dark:text-slate-300">معاينة النموذج</p><DigitalServiceForm schema={form.formSchema} answers={previewAnswers} onChange={setPreviewAnswers} idPrefix="admin-preview" /></div>}
        </section>

        <div className="flex flex-wrap gap-4 border-t border-slate-100 pt-4 dark:border-slate-800">
          <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />الخدمة مفعّلة</label>
          <label className="flex items-center gap-2 text-xs font-bold">ترتيب العرض<input className={`${fieldClass} w-24`} type="number" step="1" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} /></label>
        </div>
        {versionData && <section className="rounded-xl bg-slate-50 p-4 text-xs dark:bg-slate-800"><h3 className="font-black">الإصدار الحالي: {versionData.currentVersion} · سجل التعديلات: {versionData.history?.length || 0}</h3><p className="mt-1 text-slate-500">طلبات الخدمة تحفظ بيانات الخدمة والنموذج والأسعار في لقطة ثابتة؛ تعديل هذا الإعداد لا يغيّر الطلبات السابقة.</p></section>}
        <button disabled={loading} className="w-full rounded-xl bg-blue-700 px-4 py-3 font-black text-white disabled:opacity-50">{loading ? "جارٍ الحفظ..." : editId ? "حفظ التعديلات وإنشاء إصدار جديد" : "إضافة الخدمة"}</button>
      </form>

      <section id="fee-bands" className="scroll-mt-6 space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <div><p className="text-[11px] font-black text-blue-700 dark:text-blue-300">التسعير</p><h2 className="mt-1 text-lg font-black">شرائح رسوم سوقك</h2><p className="mt-1 text-xs font-medium leading-5 text-slate-500">تُطابق الشرائح مع قيمة الخدمة قبل الرسوم وبالعملة نفسها. يجب أن تغطي الشرائح النطاق المطلوب دون فجوات.</p></div>
        <div className="space-y-3">{feeForm.map((band, index) => <div key={index} className="grid gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800 sm:grid-cols-2">
          <select className={fieldClass} value={band.currency} onChange={(event) => setFeeForm(feeForm.map((item, itemIndex) => itemIndex === index ? { ...item, currency: event.target.value } : item))}>{CURRENCIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          <div className="grid grid-cols-2 gap-2"><input className={fieldClass} type="number" min="0" step="0.01" aria-label="من قيمة الخدمة" placeholder="من" value={band.minimumAmount} onChange={(event) => setFeeForm(feeForm.map((item, itemIndex) => itemIndex === index ? { ...item, minimumAmount: event.target.value } : item))} /><input className={fieldClass} type="number" min="0" step="0.01" aria-label="إلى قيمة الخدمة" placeholder="إلى" value={band.maximumAmount} onChange={(event) => setFeeForm(feeForm.map((item, itemIndex) => itemIndex === index ? { ...item, maximumAmount: event.target.value } : item))} /></div>
          <input className={fieldClass} type="number" min="0" step="0.01" aria-label="رسوم سوقك" placeholder="رسوم سوقك" value={band.feeAmount} onChange={(event) => setFeeForm(feeForm.map((item, itemIndex) => itemIndex === index ? { ...item, feeAmount: event.target.value } : item))} />
          <button type="button" onClick={() => setFeeForm(feeForm.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg text-xs font-black text-red-600">حذف الشريحة</button>
        </div>)}</div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setFeeForm([...feeForm, { currency: "USD", minimumAmount: "", maximumAmount: "", feeAmount: "" }])} className="flex-1 rounded-xl border border-blue-200 px-4 py-3 text-sm font-black text-blue-700">إضافة شريحة</button><button type="button" disabled={loading} onClick={saveFeeBands} className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white disabled:opacity-50">حفظ شرائح الرسوم</button></div>
      </section>

      <section id="service-list" className="scroll-mt-6 space-y-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <div><p className="text-[11px] font-black text-blue-700 dark:text-blue-300">الكتالوج</p><h2 className="mt-1 text-lg font-black">الخدمات ({services.length})</h2></div>
        {services.map((service) => <article key={service._id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 p-3 dark:border-slate-800">
          {service.image ? <img src={uploadsUrl(service.image)} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-50 text-xl">💳</span>}
          <div className="min-w-0 flex-1"><p className="font-black">{service.name}</p><p className="text-xs text-slate-500">{categories.find((category) => category._id === service.categoryId)?.name || "بدون تصنيف"} · {service.serviceType} · {service.pricingType} · إصدار {service.serviceVersion || 1}</p><p className="text-xs text-slate-500">{service.isArchived ? "مؤرشفة" : service.isActive ? "مفعلة" : "متوقفة"}</p></div>
          <button type="button" onClick={() => editService(service)} disabled={service.isArchived} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black disabled:opacity-40">تعديل</button>
          {!service.isArchived && <><button type="button" onClick={() => serviceAction(service, "status")} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black">{service.isActive ? "إيقاف" : "تفعيل"}</button><button type="button" onClick={() => serviceAction(service, "archive")} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-black text-red-700">أرشفة</button></>}
          <button type="button" disabled={loading} onClick={() => serviceAction(service, "delete")} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-black text-red-700 disabled:opacity-50">حذف نهائي</button>
        </article>)}
        {services.length === 0 && <p className="text-sm font-semibold text-slate-500">لا توجد خدمات مسجلة.</p>}
      </section>
    </div>
  );
}
