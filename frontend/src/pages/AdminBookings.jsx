import React, { useCallback, useEffect, useState } from "react";
import { useApi } from "../api/axios.js";
import BookingServiceForm from "../components/BookingServiceForm.jsx";

const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "").replace(/\/$/, "");
const fullImage = (value) => value?.startsWith("http") ? value : `${apiBase}${value || ""}`;

export default function AdminBookings() {
  const api = useApi();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [reasons, setReasons] = useState({});
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/bookings/admin");
      setItems(response.data || []);
    } catch (loadError) {
      setError(loadError.response?.data?.error || "تعذر تحميل طلبات الحجوزات.");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const createService = async (payload) => {
    await api.post("/bookings/admin", payload);
    setShowCreate(false);
    setNotice("تم إنشاء الخدمة واعتمادها ونشرها للمستخدمين.");
    await load();
  };

  const review = async (item, status) => {
    const reason = reasons[item._id] || "";
    if (status === "rejected" && !reason.trim()) return setError("اكتب سبب الرفض قبل اتخاذ القرار.");
    setBusyId(item._id);
    setError("");
    try {
      await api.patch(`/bookings/admin/${item._id}/review`, { status, reason });
      setNotice(status === "approved" ? `تم اعتماد «${item.name}».` : `تم رفض طلب «${item.name}».`);
      await load();
    } catch (reviewError) {
      setError(reviewError.response?.data?.error || "تعذر حفظ قرار المراجعة.");
    } finally {
      setBusyId("");
    }
  };

  const pending = items.filter((item) => item.status === "pending");
  const reviewed = items.filter((item) => item.status !== "pending");

  return (
    <div className="space-y-6 p-3 sm:p-5">
      <header className="rounded-3xl bg-gradient-to-l from-slate-950 via-emerald-950 to-teal-700 p-5 text-white shadow sm:p-7">
        <p className="text-xs font-black text-emerald-200">لوحة إدارة الحجوزات</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="text-2xl font-black sm:text-3xl">خدمات الحجوزات وطلبات الاعتماد</h1><p className="mt-2 text-sm text-emerald-100">إنشاء خدمات مباشرة ومراجعة الطلبات الواردة من المستخدمين في صفحة واحدة.</p></div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3"><p className="text-xs font-bold text-emerald-100">بانتظار المراجعة</p><p className="mt-1 text-2xl font-black">{pending.length}</p></div>
        </div>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{notice}</div>}

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5">
          <div><h2 className="text-lg font-black text-slate-900">إنشاء خدمة معتمدة</h2><p className="mt-1 text-sm text-slate-500">نموذج موحد مع نموذج إضافة المستخدمين.</p></div>
          <button onClick={() => setShowCreate((current) => !current)} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-800">{showCreate ? "إغلاق النموذج" : "+ إنشاء خدمة"}</button>
        </div>
        {showCreate && <div className="p-4 sm:p-6"><BookingServiceForm onSubmit={createService} submitLabel="حفظ ونشر الخدمة" /></div>}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between"><h2 className="text-xl font-black text-slate-900">الطلبات الواردة</h2><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">{pending.length} طلب</span></div>
        {loading ? <div className="rounded-2xl bg-white p-10 text-center font-bold text-slate-500">جارٍ تحميل الطلبات...</div> : pending.length ? <div className="space-y-4">{pending.map((item) => <article key={item._id} className="grid gap-4 rounded-3xl border border-amber-100 bg-white p-4 shadow-sm lg:grid-cols-[220px_1fr]">
          <img src={fullImage(item.mainImage)} alt={item.name} className="h-48 w-full rounded-2xl object-cover lg:h-full" />
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><span className="text-xs font-black text-emerald-700">{item.type}</span><h3 className="text-xl font-black text-slate-900">{item.name}</h3><p className="mt-1 text-sm text-slate-500">{item.ownerId?.name || "مستخدم"} · {new Date(item.createdAt).toLocaleDateString("ar-YE")}</p></div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">قيد المراجعة</span></div>
            <div className="grid gap-2 text-sm sm:grid-cols-2"><p><strong>الموقع:</strong> {[item.governorateId?.name, item.cityId?.name, item.location].filter(Boolean).join(" - ")}</p><p><strong>التواصل:</strong> {item.phones?.map((phone) => `${phone.type === "whatsapp" ? "واتساب" : "اتصال"} ${phone.number}`).join("، ")}</p>{Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)) && <a className="font-bold text-blue-700 underline" href={`https://www.google.com/maps?q=${encodeURIComponent(`${item.lat},${item.lng}`)}`} target="_blank" rel="noreferrer">عرض الموقع على الخريطة</a>}{item.note && <p className="sm:col-span-2"><strong>ملاحظة:</strong> {item.note}</p>}</div>
            {item.images?.length > 0 && <div className="flex gap-2">{item.images.map((image) => <img key={image} src={fullImage(image)} alt="" className="h-16 w-20 rounded-lg object-cover" />)}</div>}
            <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row">
              <button disabled={busyId === item._id} onClick={() => review(item, "approved")} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60">اعتماد ونشر</button>
              <input value={reasons[item._id] || ""} onChange={(event) => setReasons((current) => ({ ...current, [item._id]: event.target.value }))} placeholder="سبب الرفض (مطلوب عند الرفض)" className="min-w-48 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <button disabled={busyId === item._id} onClick={() => review(item, "rejected")} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-black text-red-700 disabled:opacity-60">رفض الطلب</button>
            </div>
          </div>
        </article>)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center font-bold text-slate-500">لا توجد طلبات جديدة للمراجعة.</div>}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="mb-3 text-lg font-black text-slate-900">الخدمات المنشورة والطلبات السابقة ({reviewed.length})</h2>
        {reviewed.length ? <div className="divide-y divide-slate-100">{reviewed.map((item) => <div key={item._id} className="flex flex-wrap items-center justify-between gap-2 py-3"><div className="flex items-center gap-3"><img src={fullImage(item.mainImage)} alt="" className="h-12 w-16 rounded-lg object-cover" /><div><p className="font-bold text-slate-800">{item.name} <span className="text-xs text-slate-500">· {item.type}</span></p>{item.status === "rejected" && <p className="text-xs text-red-700">سبب الرفض: {item.moderationReason}</p>}</div></div><span className={`rounded-full px-3 py-1 text-xs font-black ${item.status === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>{item.status === "approved" ? "منشور" : "مرفوض"}</span></div>)}</div> : <p className="text-sm text-slate-500">لا توجد خدمات سابقة.</p>}
      </section>
    </div>
  );
}
