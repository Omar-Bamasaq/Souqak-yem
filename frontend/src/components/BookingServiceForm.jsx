import React, { lazy, Suspense, useEffect, useState } from "react";
import { useApi } from "../api/axios.js";
import { useGovernorates } from "../hooks/useGovernorates.js";
import { parseMapCoordinates } from "./mapCoordinates.js";

const fieldClass = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
const MapLocationPicker = lazy(() => import("./MapLocationPicker.jsx"));

export default function BookingServiceForm({ onSubmit, submitLabel = "إرسال الطلب" }) {
  const api = useApi();
  const { data: governorates = [] } = useGovernorates();
  const [types, setTypes] = useState([]);
  const [cities, setCities] = useState([]);
  const [phones, setPhones] = useState([{ type: "mobile", value: "" }]);
  const [whatsapp, setWhatsapp] = useState([{ type: "whatsapp", value: "" }]);
  const [mainImage, setMainImage] = useState(null);
  const [extraImages, setExtraImages] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "",
    governorateId: "",
    cityId: "",
    location: "",
    lat: "",
    lng: "",
    note: ""
  });

  useEffect(() => {
    api.get("/bookings/types")
      .then((response) => setTypes(response.data || []))
      .catch((loadError) => setError(loadError.response?.data?.error || "تعذر تحميل أنواع الخدمات."));
  }, [api]);

  useEffect(() => {
    if (!form.governorateId) {
      setCities([]);
      return;
    }
    api.get("/cities", { params: { governorateId: form.governorateId, active: true } })
      .then((response) => setCities(response.data || []))
      .catch((loadError) => {
        setCities([]);
        setError(loadError.response?.data?.error || "تعذر تحميل المدن.");
      });
  }, [api, form.governorateId]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updateContact = (field, index, value) => {
    const setContacts = field === "phones" ? setPhones : setWhatsapp;
    setContacts((current) => current.map((contact, contactIndex) => contactIndex === index
      ? { ...contact, value: String(value || "").replace(/[^\d+\s\-()]/g, "").trim() }
      : contact));
  };
  const addContact = (field, type) => {
    const setContacts = field === "phones" ? setPhones : setWhatsapp;
    setContacts((current) => current.length < 5 ? [...current, { type, value: "" }] : current);
  };
  const removeContact = (field, index) => {
    const setContacts = field === "phones" ? setPhones : setWhatsapp;
    setContacts((current) => current.filter((_, contactIndex) => contactIndex !== index));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!mainImage) return setError("اختر الصورة الرئيسية للخدمة.");
    if (extraImages.length > 4) return setError("يمكن إضافة أربع صور فرعية كحد أقصى.");
    if (![...phones, ...whatsapp].some((contact) => contact.value.trim())) return setError("أضف رقم هاتف أو واتساب واحدًا على الأقل.");
    const coordinates = parseMapCoordinates(form.lat, form.lng);
    if (!coordinates.valid) return setError(coordinates.error);

    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => payload.append(key, value));
    payload.append("phones", JSON.stringify(phones.filter((contact) => contact.value.trim())));
    payload.append("whatsapp", JSON.stringify(whatsapp.filter((contact) => contact.value.trim())));
    payload.append("images", mainImage);
    extraImages.forEach((image) => payload.append("images", image));

    setBusy(true);
    try {
      await onSubmit(payload);
    } catch (submitError) {
      setError(submitError.response?.data?.error || "تعذر حفظ بيانات الخدمة. حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-bold text-red-700">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold text-slate-700">اسم الخدمة
          <input required maxLength={120} value={form.name} onChange={(event) => update("name", event.target.value)} className={fieldClass} placeholder="مثال: استراحة الوادي" />
        </label>
        <label className="text-sm font-bold text-slate-700">نوع الخدمة
          <select required value={form.type} onChange={(event) => update("type", event.target.value)} className={fieldClass}>
            <option value="">اختر نوع الخدمة</option>
            {types.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold text-slate-700">المحافظة
          <select required value={form.governorateId} onChange={(event) => setForm((current) => ({ ...current, governorateId: event.target.value, cityId: "" }))} className={fieldClass}>
            <option value="">اختر المحافظة</option>
            {governorates.map((governorate) => <option key={governorate._id} value={governorate._id}>{governorate.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold text-slate-700">المدينة
          <select required value={form.cityId} onChange={(event) => update("cityId", event.target.value)} className={fieldClass} disabled={!form.governorateId}>
            <option value="">اختر المدينة</option>
            {cities.map((city) => <option key={city._id} value={city._id}>{city.name}</option>)}
          </select>
        </label>
      </div>
      <label className="block text-sm font-bold text-slate-700">الموقع بالتفصيل
        <input required maxLength={300} value={form.location} onChange={(event) => update("location", event.target.value)} className={fieldClass} placeholder="الحي، الشارع، أقرب معلم..." />
      </label>
      <section className="space-y-3 rounded-2xl border border-sky-100 bg-sky-50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-black text-slate-900">الموقع الدقيق على الخريطة (اختياري)</p>
            <p className="mt-1 text-sm text-slate-600">يمكنك تحديد نقطة دقيقة يدويًا، أو متابعة إرسال الطلب دون استخدام الخريطة.</p>
          </div>
          <button type="button" onClick={() => setMapOpen(true)} className="shrink-0 rounded-xl bg-sky-700 px-4 py-3 text-sm font-black text-white">
            {form.lat && form.lng ? "تعديل الموقع على الخريطة" : "تحديد الموقع على الخريطة"}
          </button>
        </div>
        {form.lat && form.lng && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/80 px-3 py-2">
            <p className="text-xs font-bold text-slate-600" dir="ltr">{Number(form.lat).toFixed(6)}, {Number(form.lng).toFixed(6)}</p>
            <button type="button" onClick={() => setForm((current) => ({ ...current, lat: "", lng: "" }))} className="text-sm font-bold text-red-700 underline underline-offset-2">إزالة الموقع</button>
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
          title="حدد موقع الخدمة على الخريطة"
        />
      </Suspense>}

      <section className="space-y-3 rounded-2xl bg-slate-50 p-4">
        <div className="space-y-3">
          <h3 className="text-sm font-black text-slate-700">أرقام التواصل</h3>
          {phones.map((contact, index) => (
            <div key={`phone-${index}`} className="flex gap-2">
              <input type="tel" autoComplete="tel" maxLength={40} value={contact.value} onChange={(event) => updateContact("phones", index, event.target.value)} placeholder="رقم الهاتف" aria-label={`رقم التواصل ${index + 1}`} className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-base" dir="ltr" />
              <button type="button" onClick={() => removeContact("phones", index)} aria-label={`حذف رقم التواصل ${index + 1}`} className="rounded-xl border border-slate-300 px-3 text-sm font-bold text-slate-600">حذف</button>
            </div>
          ))}
          {phones.length < 5 && <button type="button" onClick={() => addContact("phones", "mobile")} className="rounded-lg px-1 py-2 text-sm font-black text-sky-800">+ إضافة رقم آخر</button>}
        </div>

        <div className="space-y-3 border-t border-slate-200 pt-4">
          <h3 className="text-sm font-black text-slate-700">أرقام واتساب</h3>
          {whatsapp.map((contact, index) => (
            <div key={`whatsapp-${index}`} className="flex gap-2">
              <input type="tel" maxLength={40} value={contact.value} onChange={(event) => updateContact("whatsapp", index, event.target.value)} placeholder="رقم واتساب" aria-label={`رقم واتساب ${index + 1}`} className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-base" dir="ltr" />
              <button type="button" onClick={() => removeContact("whatsapp", index)} aria-label={`حذف رقم واتساب ${index + 1}`} className="rounded-xl border border-slate-300 px-3 text-sm font-bold text-slate-600">حذف</button>
            </div>
          ))}
          {whatsapp.length < 5 && <button type="button" onClick={() => addContact("whatsapp", "whatsapp")} className="rounded-lg px-1 py-2 text-sm font-black text-emerald-800">+ إضافة رقم واتساب آخر</button>}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold text-slate-700">الصورة الرئيسية
          <input required type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setMainImage(event.target.files?.[0] || null)} className={`${fieldClass} file:ml-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-emerald-800`} />
        </label>
        <label className="text-sm font-bold text-slate-700">صور إضافية (حتى 4)
          <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => setExtraImages(Array.from(event.target.files || []).slice(0, 4))} className={`${fieldClass} file:ml-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-emerald-800`} />
        </label>
      </div>
      <p className="-mt-3 text-xs text-slate-500">الصورة الرئيسية مطلوبة. يمكنك رفع أربع صور فرعية إضافية.</p>
      <label className="block text-sm font-bold text-slate-700">ملاحظة
        <textarea rows={3} maxLength={2000} value={form.note} onChange={(event) => update("note", event.target.value)} className={fieldClass} placeholder="أي تفاصيل إضافية عن الخدمة..." />
      </label>
      <button disabled={busy} className="w-full rounded-xl bg-emerald-700 px-4 py-3 font-black text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60">
        {busy ? "جارٍ الحفظ..." : submitLabel}
      </button>
    </form>
  );
}
