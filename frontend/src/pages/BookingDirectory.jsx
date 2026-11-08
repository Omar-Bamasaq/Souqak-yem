import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useApi } from "../api/axios.js";
import { useAuth } from "../store/AuthContext.jsx";
import { useGovernorates } from "../hooks/useGovernorates.js";
import BookingServiceForm from "../components/BookingServiceForm.jsx";

const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "").replace(/\/$/, "");
const imageUrl = (value) => value?.startsWith("http") ? value : `${apiBase}${value || ""}`;
const formatRatingCount = (count) => {
  if (count === 1) return "تقييم واحد";
  if (count === 2) return "تقييمان";
  if (count >= 3 && count <= 10) return `${count} تقييمات`;
  return `${count} تقييم`;
};

function StatusBadge({ status }) {
  const labels = { pending: "قيد المراجعة", approved: "معتمد", rejected: "مرفوض" };
  const styles = { pending: "bg-amber-100 text-amber-800", approved: "bg-emerald-100 text-emerald-800", rejected: "bg-red-100 text-red-800" };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-black ${styles[status] || styles.pending}`}>{labels[status] || status}</span>;
}

function BookingCard({ service, onOpen, onRate, myRating }) {
  const [selectedImage, setSelectedImage] = useState(service.mainImage);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);
  const photos = [service.mainImage, ...(service.images || [])].filter(Boolean);
  return (
    <article
      onClick={() => onOpen(service)}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onOpen(service);
        }
      }}
      tabIndex={0}
      aria-label={`عرض تفاصيل ${service.name}`}
      className="cursor-pointer overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
    >
      <div className="relative h-56 bg-slate-100">
        <img src={imageUrl(selectedImage)} alt={service.name} className="h-full w-full object-cover" loading="lazy" />
        <span className="absolute right-3 top-3 rounded-full bg-white/95 px-3 py-1.5 text-xs font-black text-emerald-800 shadow">{service.type}</span>
      </div>
      {photos.length > 1 && <div className="flex gap-2 overflow-x-auto px-3 pt-3">{photos.map((photo) => <button key={photo} onClick={(event) => { event.stopPropagation(); setSelectedImage(photo); }} className={`h-14 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${selectedImage === photo ? "border-emerald-600" : "border-transparent"}`}><img src={imageUrl(photo)} alt="" className="h-full w-full object-cover" /></button>)}</div>}
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div><h2 className="text-lg font-black text-slate-900">{service.name}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{[service.governorateId?.name, service.cityId?.name].filter(Boolean).join(" - ")}</p></div>
          <div className="shrink-0 text-left"><p className="font-black text-amber-500">★ {Number(service.ratingAverage || 0).toFixed(1)}</p><p className="text-[11px] text-slate-500">{formatRatingCount(service.ratingCount || 0)}</p></div>
        </div>
        <p className="text-sm leading-6 text-slate-700">{service.location}</p>
        {service.note && <p className="rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">{service.note}</p>}
        <div className="flex flex-wrap gap-2">
          {service.phones?.map((entry, index) => <a key={`${entry.number}-${index}`} onClick={(event) => event.stopPropagation()} href={`${entry.type === "whatsapp" ? "https://wa.me/" : "tel:"}${entry.type === "whatsapp" ? entry.number.replace(/[^\d]/g, "") : entry.number}`} target={entry.type === "whatsapp" ? "_blank" : undefined} rel={entry.type === "whatsapp" ? "noreferrer" : undefined} className={`rounded-xl px-3 py-2 text-xs font-black ${entry.type === "whatsapp" ? "bg-green-600 text-white" : "bg-slate-900 text-white"}`}>{entry.type === "whatsapp" ? "واتساب" : "اتصال"} · {entry.number}</a>)}
          {Number.isFinite(Number(service.lat)) && Number.isFinite(Number(service.lng)) && <a onClick={(event) => event.stopPropagation()} href={`https://www.google.com/maps?q=${encodeURIComponent(`${service.lat},${service.lng}`)}`} target="_blank" rel="noreferrer" className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-800">الموقع على الخريطة</a>}
        </div>
        <div className="border-t border-slate-100 pt-3" onClick={(event) => event.stopPropagation()}>
          {myRating ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5">
              <span className="text-xs font-bold text-emerald-800">تم تقييم هذه الخدمة · لا يمكن تعديل التقييم</span>
              <span className="shrink-0 font-black text-amber-500" aria-label={`تقييمك ${myRating} من 5`}>
                {"★".repeat(myRating)}<span className="text-slate-300">{"★".repeat(5 - myRating)}</span>
              </span>
            </div>
          ) : !ratingOpen ? (
            <button
              type="button"
              onClick={() => setRatingOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-black text-amber-800 transition hover:border-amber-300 hover:bg-amber-100"
            >
              <span aria-hidden="true">★</span>
              <span>قيّم هذه الخدمة</span>
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs">{formatRatingCount(service.ratingCount || 0)}</span>
            </button>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2">
              <span className="text-xs font-bold text-slate-600">اختر تقييمك من 5 نجوم · {formatRatingCount(service.ratingCount || 0)} حاليًا</span>
              <div className="flex" aria-label="اختر عدد النجوم" onMouseLeave={() => setHoverRating(0)}>
                {[1, 2, 3, 4, 5].map((stars) => (
                  <button
                    key={stars}
                    type="button"
                    onMouseEnter={() => setHoverRating(stars)}
                    onFocus={() => setHoverRating(stars)}
                    onBlur={() => setHoverRating(0)}
                    onClick={() => {
                      onRate(service._id, stars);
                      setRatingOpen(false);
                      setHoverRating(0);
                    }}
                    aria-label={`${stars} ${stars === 1 ? "نجمة" : "نجوم"}`}
                    className={`px-1 text-2xl transition-transform hover:scale-125 focus:scale-125 focus:outline-none ${stars <= (hoverRating || 0) ? "text-amber-500" : "text-slate-300"}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setRatingOpen(false)} className="text-xs font-bold text-slate-500 hover:text-slate-800">إلغاء</button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function BookingDetailsModal({ service, onClose }) {
  const photos = [service.mainImage, ...(service.images || [])].filter(Boolean);
  const [photoIndex, setPhotoIndex] = useState(0);
  const photo = photos[photoIndex] || service.mainImage;

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") setPhotoIndex((index) => (index + 1) % photos.length);
      if (event.key === "ArrowRight") setPhotoIndex((index) => (index - 1 + photos.length) % photos.length);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, photos.length]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="booking-details-title" className="relative flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <button type="button" onClick={onClose} aria-label="إغلاق التفاصيل" className="absolute left-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-2xl text-white hover:bg-black/80">×</button>

        <div className="relative flex min-h-64 flex-1 items-center justify-center bg-slate-950 sm:min-h-96">
          <img src={imageUrl(photo)} alt={`${service.name} - الصورة ${photoIndex + 1}`} className="max-h-[55vh] w-full object-contain" />
          {photos.length > 1 && <>
            <button type="button" onClick={() => setPhotoIndex((index) => (index - 1 + photos.length) % photos.length)} aria-label="الصورة السابقة" className="absolute right-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-3xl text-white hover:bg-black/80">‹</button>
            <button type="button" onClick={() => setPhotoIndex((index) => (index + 1) % photos.length)} aria-label="الصورة التالية" className="absolute left-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-3xl text-white hover:bg-black/80">›</button>
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white">{photoIndex + 1} / {photos.length}</span>
          </>}
        </div>

        {photos.length > 1 && <div className="flex gap-2 overflow-x-auto border-b border-slate-100 px-4 py-3">
          {photos.map((image, index) => <button key={image} type="button" onClick={() => setPhotoIndex(index)} aria-label={`عرض الصورة ${index + 1}`} className={`h-16 w-20 shrink-0 overflow-hidden rounded-xl border-2 ${index === photoIndex ? "border-emerald-600" : "border-transparent"}`}>
            <img src={imageUrl(image)} alt="" className="h-full w-full object-cover" />
          </button>)}
        </div>}

        <div className="overflow-y-auto p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">{service.type}</span>
              <h2 id="booking-details-title" className="mt-3 text-2xl font-black text-slate-900 sm:text-3xl">{service.name}</h2>
              <p className="mt-1 font-semibold text-slate-500">{[service.governorateId?.name, service.cityId?.name].filter(Boolean).join(" - ")}</p>
            </div>
            <div className="rounded-2xl bg-amber-50 px-4 py-2 text-center">
              <p className="text-lg font-black text-amber-600">★ {Number(service.ratingAverage || 0).toFixed(1)}</p>
              <p className="text-xs font-bold text-slate-500">{formatRatingCount(service.ratingCount || 0)}</p>
            {service.myRating && <p className="mt-1 text-xs font-bold text-emerald-700">تقييمك: {service.myRating} / 5</p>}
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <h3 className="text-sm font-black text-slate-700">العنوان التفصيلي</h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">{service.location}</p>
            </div>
            {service.note && <div className="rounded-2xl bg-slate-50 p-4">
              <h3 className="text-sm font-black text-slate-700">ملاحظات الخدمة</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{service.note}</p>
            </div>}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {service.phones?.map((entry, index) => <a key={`${entry.number}-${index}`} href={`${entry.type === "whatsapp" ? "https://wa.me/" : "tel:"}${entry.type === "whatsapp" ? entry.number.replace(/[^\d]/g, "") : entry.number}`} target={entry.type === "whatsapp" ? "_blank" : undefined} rel={entry.type === "whatsapp" ? "noreferrer" : undefined} className={`rounded-xl px-4 py-3 text-sm font-black text-white ${entry.type === "whatsapp" ? "bg-green-600 hover:bg-green-700" : "bg-slate-900 hover:bg-slate-800"}`}>{entry.type === "whatsapp" ? "تواصل عبر واتساب" : "اتصال"} · {entry.number}</a>)}
            {Number.isFinite(Number(service.lat)) && Number.isFinite(Number(service.lng)) && <a href={`https://www.google.com/maps?q=${encodeURIComponent(`${service.lat},${service.lng}`)}`} target="_blank" rel="noreferrer" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-black text-blue-800 hover:bg-blue-100">فتح الموقع على الخريطة</a>}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function BookingDirectory() {
  const api = useApi();
  const { user } = useAuth();
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const { data: governorates = [] } = useGovernorates();
  const [services, setServices] = useState([]);
  const [myRatings, setMyRatings] = useState({});
  const [types, setTypes] = useState([]);
  const [cities, setCities] = useState([]);
  const [mine, setMine] = useState([]);
  const [filters, setFilters] = useState({ type: "", governorateId: "", cityId: "", minRating: "", sort: "" });
  const [showForm, setShowForm] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadServices = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/bookings", { params: Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) });
      setServices(response.data || []);
    } catch (loadError) {
      setError(loadError.response?.data?.error || "تعذر تحميل خدمات الحجوزات.");
    } finally {
      setLoading(false);
    }
  }, [api, filters]);

  const loadMine = useCallback(async () => {
    if (!user) {
      setMine([]);
      setMyRatings({});
      return;
    }
    try {
      const [requestsResponse, ratingsResponse] = await Promise.all([
        api.get("/bookings/mine"),
        api.get("/bookings/my-ratings")
      ]);
      setMine(requestsResponse.data || []);
      setMyRatings(Object.fromEntries((ratingsResponse.data || []).map((rating) => [String(rating.bookingServiceId), rating.stars])));
    } catch (loadError) {
      setError(loadError.response?.data?.error || "تعذر تحميل طلباتك.");
    }
  }, [api, user]);

  useEffect(() => {
    loadServices();
    api.get("/bookings/types").then((response) => setTypes(response.data || [])).catch((loadError) => setError(loadError.response?.data?.error || "تعذر تحميل أنواع الخدمات."));
  }, [loadServices, api]);

  useEffect(() => {
    if (!filters.governorateId) {
      setCities([]);
      return;
    }
    api.get("/cities", { params: { governorateId: filters.governorateId, active: true } })
      .then((response) => setCities(response.data || []))
      .catch((loadError) => setError(loadError.response?.data?.error || "تعذر تحميل المدن."));
  }, [api, filters.governorateId]);

  useEffect(() => { loadMine(); }, [loadMine]);

  const rateService = async (serviceId, stars) => {
    if (!user) return navigate("/login", { state: { from: { pathname: "/bookings" } } });
    try {
      await api.post(`/bookings/${serviceId}/rating`, { stars });
      setMyRatings((current) => ({ ...current, [serviceId]: stars }));
      setNotice("تم حفظ تقييمك، شكرًا لمشاركتك.");
      await loadServices();
    } catch (rateError) {
      setError(rateError.response?.data?.error || "تعذر حفظ التقييم.");
    }
  };

  const submitService = async (payload) => {
    if (!user) return navigate("/login", { state: { from: { pathname: "/bookings" } } });
    const response = await api.post("/bookings", payload);
    setShowForm(false);
    setNotice(response.data.message || "تم إرسال الطلب للمراجعة.");
    await loadMine();
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <motion.header
        initial={shouldReduceMotion ? false : { opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.4, ease: "easeOut" }}
        className="bg-gradient-to-l from-emerald-950 via-emerald-800 to-teal-600 text-white"
      >
        <div className="mx-auto max-w-6xl px-4 py-4 sm:py-5">
          <p className="text-[11px] font-black text-emerald-200 sm:text-xs">دليل الخدمات والحجوزات</p>
          <div className="mt-1.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-black leading-tight sm:text-2xl">اعثر على خدمتك القادمة</h1>
              <p className="mt-1 max-w-xl text-xs leading-5 text-emerald-50 sm:text-sm">فنادق واستراحات وقاعات وخدمات متنوعة في محافظات ومدن اليمن، مع بيانات التواصل والموقع والتقييمات.</p>
            </div>
            <button onClick={() => user ? setShowForm((value) => !value) : navigate("/login", { state: { from: { pathname: "/bookings" } } })} className="shrink-0 rounded-lg bg-white px-3 py-2 text-xs font-black text-emerald-900 shadow transition hover:bg-emerald-50 sm:px-4 sm:py-2.5 sm:text-sm">{showForm ? "إغلاق النموذج" : "+ أضف خدمتك"}</button>
          </div>
        </div>
      </motion.header>

      <main className="mx-auto max-w-6xl space-y-7 px-4 py-7">
        {notice && <div role="status" className="flex justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="إغلاق">×</button></div>}
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

        {showForm && <section className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-6"><div className="mb-5"><h2 className="text-xl font-black text-slate-900">إضافة خدمة جديدة</h2><p className="mt-1 text-sm text-slate-500">أرسل بيانات خدمتك وستظهر بعد مراجعة الإدارة واعتمادها.</p></div><BookingServiceForm onSubmit={submitService} /></section>}

        {user && mine.length > 0 && <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h2 className="mb-3 font-black text-slate-900">طلباتي لإضافة خدمة</h2><div className="space-y-2">{mine.map((item) => <div key={item._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5"><div><p className="font-bold text-slate-800">{item.name} <span className="text-xs text-slate-500">· {item.type}</span></p>{item.status === "rejected" && <p className="mt-1 text-xs text-red-700">سبب الرفض: {item.moderationReason || "—"}</p>}</div><StatusBadge status={item.status} /></div>)}</div></section>}

        <section className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm sm:gap-3 sm:p-4">
          <select aria-label="نوع الخدمة" value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))} className={filterClass}><option value="">كل أنواع الخدمات</option>{types.map((type) => <option key={type} value={type}>{type}</option>)}</select>
          <select aria-label="المحافظة" value={filters.governorateId} onChange={(event) => setFilters((current) => ({ ...current, governorateId: event.target.value, cityId: "" }))} className={filterClass}><option value="">كل المحافظات</option>{governorates.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select>
          <select aria-label="المدينة" value={filters.cityId} disabled={!filters.governorateId} onChange={(event) => setFilters((current) => ({ ...current, cityId: event.target.value }))} className={filterClass}><option value="">كل المدن</option>{cities.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select>
          <select aria-label="أقل تقييم" value={filters.minRating} onChange={(event) => setFilters((current) => ({ ...current, minRating: event.target.value }))} className={filterClass}><option value="">كل التقييمات</option><option value="4">4 نجوم فأكثر</option><option value="3">3 نجوم فأكثر</option><option value="2">نجمتان فأكثر</option></select>
          <select aria-label="ترتيب النتائج" value={filters.sort} onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value }))} className={filterClass}><option value="">الأحدث</option><option value="rating">الأعلى تقييمًا</option></select>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-black text-slate-900">الخدمات المتاحة</h2><span className="text-sm font-bold text-slate-500">{services.length} خدمة</span></div>
          {loading ? <div className="rounded-2xl bg-white p-10 text-center font-bold text-slate-500">جارٍ تحميل الخدمات...</div> : services.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{services.map((service) => <BookingCard key={service._id} service={service} myRating={myRatings[service._id]} onOpen={(selected) => setSelectedService({ ...selected, myRating: myRatings[selected._id] })} onRate={rateService} />)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><p className="font-black text-slate-800">لا توجد خدمات مطابقة للفلاتر</p><button onClick={() => setFilters({ type: "", governorateId: "", cityId: "", minRating: "", sort: "" })} className="mt-3 text-sm font-bold text-emerald-700">إزالة الفلاتر</button></div>}
        </section>
        <div className="text-center"><Link to="/" className="text-sm font-bold text-emerald-700 hover:underline">العودة إلى الرئيسية</Link></div>
      </main>
      {selectedService && <BookingDetailsModal service={selectedService} onClose={() => setSelectedService(null)} />}
    </div>
  );
}

const filterClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500";
