import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApi } from "../api/axios.js";

export default function QuoteRequestForm() {
  const api = useApi();
  const navigate = useNavigate();
  const [governorates, setGovernorates] = useState([]);
  const [cities, setCities] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ itemName: "", description: "", quantity: "", governorateId: "", cityId: "", categoryId: "", specifications: "" });
  const [image, setImage] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/governorates", { params: { active: true } }),
      api.get("/categories", { params: { flat: "true" } })
    ]).then(([governorateResponse, categoryResponse]) => {
      setGovernorates(governorateResponse.data || []);
      setCategories(categoryResponse.data || []);
    }).catch(() => setError("تعذر تحميل المحافظات والتصنيفات."));
  }, [api]);

  useEffect(() => {
    if (!form.governorateId) {
      setCities([]);
      return;
    }
    api.get("/cities", { params: { governorateId: form.governorateId, active: true } })
      .then(({ data }) => setCities(data || []))
      .catch(() => setError("تعذر تحميل مدن المحافظة."));
  }, [api, form.governorateId]);

  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => body.append(key, value));
      if (image) body.append("images", image);
      const { data } = await api.post("/quote-requests", body);
      navigate(`/quote-requests/${data._id}`);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "تعذر إرسال طلب التسعير.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section dir="rtl" className="mx-auto max-w-3xl">
      <Link to="/quote-requests" className="mb-4 inline-flex text-sm font-bold text-blue-700">← العودة إلى الطلبات</Link>
      <form onSubmit={submit} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8 dark:border-slate-700 dark:bg-slate-800">
        <div><p className="text-sm font-bold text-blue-700">تسعيرة سوقك</p><h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">إنشاء طلب تسعيرة</h1><p className="mt-2 text-sm text-slate-500">أضف معلومات السلعة ليستطيع الموردون إرسال عروض مناسبة.</p></div>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
        <label className="block text-sm font-bold">اسم السلعة *<input required maxLength="160" name="itemName" value={form.itemName} onChange={update} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal dark:border-slate-600 dark:bg-slate-900" placeholder="مثال: أكياس إسمنت" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-bold">الكمية المطلوبة *<input required min="0.01" step="any" type="number" name="quantity" value={form.quantity} onChange={update} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal dark:border-slate-600 dark:bg-slate-900" /></label>
          <label className="block text-sm font-bold">التصنيف<select name="categoryId" value={form.categoryId} onChange={update} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal dark:border-slate-600 dark:bg-slate-900"><option value="">بدون تصنيف</option>{categories.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
          <label className="block text-sm font-bold">المحافظة *<select required name="governorateId" value={form.governorateId} onChange={(event) => setForm({ ...form, governorateId: event.target.value, cityId: "" })} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal dark:border-slate-600 dark:bg-slate-900"><option value="">اختر المحافظة</option>{governorates.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
          <label className="block text-sm font-bold">المدينة *<select required disabled={!form.governorateId} name="cityId" value={form.cityId} onChange={update} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900"><option value="">اختر المدينة</option>{cities.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
        </div>
        <label className="block text-sm font-bold">وصف إضافي<textarea maxLength="2000" name="description" value={form.description} onChange={update} rows="3" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal dark:border-slate-600 dark:bg-slate-900" placeholder="تفاصيل تساعد المورد على فهم طلبك" /></label>
        <label className="block text-sm font-bold">المواصفات<textarea maxLength="2000" name="specifications" value={form.specifications} onChange={update} rows="3" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal dark:border-slate-600 dark:bg-slate-900" placeholder="المقاس، النوع، الجودة..." /></label>
        <label className="block text-sm font-bold">صورة اختيارية<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImage(event.target.files?.[0] || null)} className="mt-2 block w-full rounded-xl border border-slate-200 p-3 text-sm font-normal dark:border-slate-600" /></label>
        {image && <p className="text-xs text-slate-500">{image.name} — الحد الأقصى 5 ميجابايت.</p>}
        <button disabled={saving} className="w-full rounded-xl bg-blue-700 px-5 py-3 font-black text-white hover:bg-blue-800 disabled:opacity-60">{saving ? "جارٍ الإرسال..." : "إرسال طلب التسعيرة"}</button>
      </form>
    </section>
  );
}
