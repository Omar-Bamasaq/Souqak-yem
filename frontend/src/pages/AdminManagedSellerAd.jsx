import React, { useEffect, useState } from "react";
import imageCompression from "browser-image-compression";
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
  showPhone: false,
  showWhatsApp: true,
  negotiable: false,
  priceOnContact: false
};

export default function AdminManagedSellerAd() {
  const api = useApi();
  const [searchParams] = useSearchParams();
  const sellerId = searchParams.get("sellerId");
  const [form, setForm] = useState(initialForm);
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [governorates, setGovernorates] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isPreparingImages, setIsPreparingImages] = useState(false);
  const [prepareStatus, setPrepareStatus] = useState("");
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
        const phone = seller.phone || "";
        setForm((current) => ({ ...current, sellerName: seller.name || "", phone, whatsapp: phone, email: seller.email || "" }));
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
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
      ...(name === "phone" ? { whatsapp: value } : {})
    }));
    setMessage("");
    setError("");
  };

  const handleImages = (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    const fileKey = (file) => `${file.name}-${file.size}-${file.lastModified}`;

    setImages((currentImages) => {
      const existingKeys = new Set(currentImages.map(fileKey));
      const newFiles = selectedFiles.filter((file) => !existingKeys.has(fileKey(file)));
      const nextImages = [...currentImages, ...newFiles].slice(0, 10);

      if (currentImages.length + newFiles.length > 10) {
        setError("يمكن رفع حد أقصى 10 صور فقط");
      } else {
        setError("");
      }

      return nextImages;
    });

    event.target.value = "";
  };

  const removeImage = (indexToRemove) => {
    setImages((currentImages) => currentImages.filter((_, index) => index !== indexToRemove));
  };

  useEffect(() => {
    const nextPreviews = images.map((image) => URL.createObjectURL(image));
    setPreviews(nextPreviews);

    return () => {
      nextPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [images]);

  const prepareImagesForUpload = async (selectedImages) => {
    const preparedImages = [];
    const webpSupported = document.createElement("canvas").toDataURL("image/webp").startsWith("data:image/webp");

    for (let index = 0; index < selectedImages.length; index += 1) {
      const image = selectedImages[index];
      const isHeic = /heic|heif/i.test(image.type || image.name || "");
      const shouldCompress = image.size > 500 * 1024 || isHeic;
      setPrepareStatus(`جاري تجهيز الصور ${index + 1} من ${selectedImages.length}...`);

      if (!shouldCompress) {
        preparedImages.push(image);
        continue;
      }

      try {
        preparedImages.push(await imageCompression(image, {
          maxSizeMB: 0.9,
          maxWidthOrHeight: 1600,
          maxIteration: 10,
          useWebWorker: true,
          initialQuality: 0.82,
          fileType: webpSupported ? "image/webp" : "image/jpeg",
          alwaysKeepResolution: false,
          onProgress: (progress) => setPrepareStatus(`جاري تجهيز الصور ${index + 1} من ${selectedImages.length} (${Math.round(progress)}%)...`)
        }));
      } catch (compressionError) {
        console.error("Image compression failed for file:", image.name, compressionError);
        throw new Error("تعذر تجهيز إحدى الصور. يرجى اختيار صورة أخرى أو تحويلها إلى JPG/PNG ثم المحاولة مرة أخرى.");
      }
    }

    return preparedImages;
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
      setIsPreparingImages(true);
      const preparedImages = await prepareImagesForUpload(images);
      preparedImages.forEach((image) => data.append("images", image));
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
      setError(err.response?.data?.error || err.message || "تعذر إنشاء الحساب والإعلان.");
    } finally {
      setLoading(false);
      setIsPreparingImages(false);
      setPrepareStatus("");
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
          <div className="block text-sm font-bold text-gray-700">
            صور الإعلان
            <input id="managed-ad-images-input" className="sr-only" type="file" accept="image/png,image/jpeg,image/jpg" multiple onChange={handleImages} />
            <label htmlFor="managed-ad-images-input" className="mt-2 flex min-h-14 w-full cursor-pointer items-center justify-center rounded-xl border border-dashed border-blue-300 bg-blue-50/60 px-4 py-3 text-sm font-black text-blue-700 transition hover:border-blue-500 hover:bg-blue-50">
              إضافة صور الإعلان
            </label>
          </div>
          <p className="text-xs text-gray-500">يفضل رفع صورة واحدة على الأقل، وحد أقصى 10 صور.</p>
          {isPreparingImages && <p className="text-xs font-bold text-blue-600">{prepareStatus}</p>}
          {previews.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {previews.map((src, index) => (
                <div key={src} className="relative">
                  <img src={src} alt={`صورة الإعلان ${index + 1}`} className="h-24 w-32 rounded-md object-cover" />
                  <button
                    type="button"
                    aria-label={`حذف صورة الإعلان ${index + 1}`}
                    onClick={() => removeImage(index)}
                    className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-lg font-bold leading-none text-white shadow-md transition-colors hover:bg-red-700"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
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
