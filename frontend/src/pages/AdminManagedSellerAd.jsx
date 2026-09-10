import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";
import CategorySelect from "../components/CategorySelect.jsx";
import { useSearchParams } from "react-router-dom";

const initialForm = {
  sellerName: "",
  phone: "",
  email: "",
  title: "",
  description: "",
  price: "",
  currency: "YER_ADEN",
  governorateId: "",
  cityId: "",
  categoryId: "",
  condition: "used",
  whatsapp: "",
  showPhone: true,
  showWhatsApp: false,
  negotiable: false,
  priceOnContact: false
};

export default function AdminManagedSellerAd() {
  const api = useApi();
  const [searchParams] = useSearchParams();
  const sellerId = searchParams.get("sellerId");
  const [form, setForm] = useState(initialForm);
  const [images, setImages] = useState([]);
  const [governorates, setGovernorates] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get("/governorates"),
      sellerId ? api.get("/admin/managed-sellers") : Promise.resolve({ data: [] })
    ]).then(([govRes, sellersRes]) => {
      setGovernorates(govRes.data || []);
      const seller = (sellersRes.data || []).find((item) => String(item._id) === String(sellerId));
      if (seller) {
        setForm((current) => ({ ...current, sellerName: seller.name || "", phone: seller.phone || "", email: seller.email || "" }));
      }
    }).catch(() => setError("تعذر تحميل بيانات المواقع والتصنيفات."));
  }, [api, sellerId]);

  useEffect(() => {
    if (!form.governorateId) {
      setCities([]);
      return;
    }
    api.get("/cities", { params: { governorateId: form.governorateId } })
      .then((res) => setCities(res.data || []))
      .catch(() => setCities([]));
  }, [api, form.governorateId]);

  const update = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
    setMessage("");
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const data = new FormData();
      Object.entries(form).forEach(([key, value]) => data.append(key, String(value)));
      if (sellerId) data.append("sellerId", sellerId);
      images.forEach((image) => data.append("images", image));
      const response = await api.post("/admin/managed-sellers/ads", data, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setMessage(sellerId
        ? `تمت إضافة الإعلان للبائع ${response.data.user.name} بنجاح.`
        : `تم إنشاء حساب ${response.data.user.name} والإعلان بنجاح. كلمة المرور المؤقتة: ${response.data.user.temporaryPassword} (تُسلّم للبائع وتُستخدم مرة أولى ثم يجب تغييرها).`);
      setForm(initialForm);
      setImages([]);
      setCities([]);
    } catch (err) {
      setError(err.response?.data?.error || "تعذر إنشاء الحساب والإعلان.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-black text-gray-900 sm:text-2xl">{sellerId ? "إضافة إعلان لبائع مُدار" : "إنشاء بائع وإضافة إعلان"}</h1>
        <p className="mt-1 text-xs leading-5 text-gray-500 sm:text-sm">{sellerId ? "سيتم ربط الإعلان بالحساب الموجود دون إنشاء حساب جديد." : "ينشئ حسابًا مُدارًا من المنصة ويربط الإعلان به مباشرة."}</p>
      </div>

      {message && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700">{message}</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

      <form onSubmit={submit} className="space-y-5 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm sm:space-y-6 sm:p-5">
        <section className="space-y-4">
          <h2 className="border-b border-gray-100 pb-3 text-lg font-black text-gray-900">بيانات البائع</h2>
          <div className="grid min-w-0 gap-4 md:grid-cols-3">
            <label className="text-sm font-bold text-gray-700">اسم البائع<input required disabled={!!sellerId} name="sellerName" value={form.sellerName} onChange={update} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-blue-500 disabled:bg-gray-50" /></label>
            <label className="text-sm font-bold text-gray-700">رقم الهاتف<input required disabled={!!sellerId} name="phone" value={form.phone} onChange={update} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-blue-500 disabled:bg-gray-50" /></label>
            <label className="text-sm font-bold text-gray-700">البريد الإلكتروني، اختياري<input type="email" disabled={!!sellerId} name="email" value={form.email} onChange={update} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-blue-500 disabled:bg-gray-50" /></label>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="border-b border-gray-100 pb-3 text-lg font-black text-gray-900">بيانات الإعلان</h2>
          <div className="grid min-w-0 gap-4 md:grid-cols-3">
            <label className="text-sm font-bold text-gray-700 md:col-span-2">العنوان<input required minLength={3} name="title" value={form.title} onChange={update} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-blue-500" /></label>
            <label className="text-sm font-bold text-gray-700">السعر<input type="number" min="0" name="price" value={form.price} onChange={update} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-blue-500" /></label>
            <label className="text-sm font-bold text-gray-700 md:col-span-3">الوصف<textarea name="description" value={form.description} onChange={update} rows={4} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-blue-500" /></label>
            <label className="text-sm font-bold text-gray-700">العملة<select name="currency" value={form.currency} onChange={update} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5"><option value="YER_ADEN">ريال يمني عدن</option><option value="YER_SANAA">ريال يمني صنعاء</option><option value="SAR">ريال سعودي</option><option value="USD">دولار</option></select></label>
            <label className="text-sm font-bold text-gray-700">المحافظة<select required name="governorateId" value={form.governorateId} onChange={(event) => { update(event); setForm((current) => ({ ...current, cityId: "" })); }} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5"><option value="">اختر المحافظة</option>{governorates.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
            <label className="text-sm font-bold text-gray-700">المدينة<select required name="cityId" value={form.cityId} onChange={update} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5"><option value="">اختر المدينة</option>{cities.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
            <div className="text-sm font-bold text-gray-700 md:col-span-2">
              <CategorySelect
                value={form.categoryId}
                onChange={(categoryId) => setForm((current) => ({ ...current, categoryId }))}
                required={false}
              />
            </div>
            <label className="text-sm font-bold text-gray-700">حالة المنتج<select name="condition" value={form.condition} onChange={update} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5"><option value="used">مستعمل</option><option value="new">جديد</option><option value="like_new">شبه جديد</option></select></label>
          </div>
          <label className="block text-sm font-bold text-gray-700">صور الإعلان<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setImages(Array.from(event.target.files || []).slice(0, 10))} className="mt-2 block w-full rounded-xl border border-dashed border-gray-300 p-3 text-sm" /></label>
        </section>

        <section className="space-y-4">
          <h2 className="border-b border-gray-100 pb-3 text-lg font-black text-gray-900">التواصل</h2>
          <div className="grid min-w-0 gap-4 md:grid-cols-3">
            <label className="text-sm font-bold text-gray-700">رقم واتساب<input name="whatsapp" value={form.whatsapp} onChange={update} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-blue-500" /></label>
            <label className="flex items-center gap-2 pt-8 text-sm font-bold text-gray-700"><input type="checkbox" name="showPhone" checked={form.showPhone} onChange={update} /> إظهار الهاتف</label>
            <label className="flex items-center gap-2 pt-8 text-sm font-bold text-gray-700"><input type="checkbox" name="showWhatsApp" checked={form.showWhatsApp} onChange={update} /> إظهار واتساب</label>
          </div>
          <div className="flex flex-wrap gap-5 text-sm font-bold text-gray-700"><label><input type="checkbox" name="negotiable" checked={form.negotiable} onChange={update} /> السعر قابل للتفاوض</label><label><input type="checkbox" name="priceOnContact" checked={form.priceOnContact} onChange={update} /> السعر عند التواصل</label></div>
        </section>

        <button disabled={loading} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{loading ? "جاري الحفظ..." : sellerId ? "إضافة الإعلان للبائع" : "إنشاء الحساب ونشر الإعلان"}</button>
      </form>
    </div>
  );
}
