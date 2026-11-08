import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApi } from "../api/axios.js";
import { useAuth } from "../store/AuthContext.jsx";
import { uploadsUrl } from "../lib/uploads.js";

const currencyLabels = { YER_ADEN: "ريال يمني - عدن", YER_SANAA: "ريال يمني - صنعاء", SAR: "ريال سعودي", USD: "دولار" };
const statusLabels = { open: "مفتوح لاستقبال العروض", closed: "مغلق", cancelled: "ملغي", awarded: "تم اختيار عرض" };
const statusStyles = {
  open: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-800",
  closed: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-600",
  cancelled: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/30 dark:text-red-200 dark:ring-red-800",
  awarded: "bg-blue-50 text-blue-800 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:ring-blue-800"
};

function OfferCard({ offer, isOwner, isSelected, onSelect, busy }) {
  const phone = offer.contactPhone || offer.userId?.phone || "";
  const whatsapp = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
  return (
    <article className={`rounded-2xl border p-4 ${isSelected ? "border-emerald-300 bg-emerald-50/70" : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="font-black">{offer.userId?.name || "مورد"}</h3><p className="mt-1 text-2xl font-black text-blue-800 dark:text-blue-300">{Number(offer.price).toLocaleString("ar")} <span className="text-sm">{currencyLabels[offer.currency] || offer.currency}</span></p></div>
        {isSelected && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">العرض المختار</span>}
      </div>
      <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2 dark:text-slate-300">
        <p>المتوفر: {Number(offer.availableQuantity).toLocaleString("ar")}</p><p>التوصيل: {Number(offer.deliveryCost || 0).toLocaleString("ar")}</p>
        {offer.validUntil && <p>صالح حتى: {new Date(offer.validUntil).toLocaleDateString("ar")}</p>}
        {offer.notes && <p className="sm:col-span-2">{offer.notes}</p>}
      </div>
      {isOwner && (
        <div className="mt-4 flex flex-wrap gap-2">
          {isSelected && phone && <a href={`tel:${phone}`} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white">اتصال</a>}
          {isSelected && whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white">واتساب</a>}
          {isSelected && !phone && <span className="text-xs text-slate-500">لا يوجد رقم اتصال مسجل للمورد.</span>}
          {!isSelected && onSelect && <button disabled={busy} onClick={() => onSelect(offer._id)} className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-bold text-blue-700 disabled:opacity-50">اختيار العرض</button>}
        </div>
      )}
    </article>
  );
}

export default function QuoteRequestDetail() {
  const { id } = useParams();
  const api = useApi();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [item, setItem] = useState(null);
  const [myOffer, setMyOffer] = useState(null);
  const [offerForm, setOfferForm] = useState({ price: "", currency: "YER_ADEN", availableQuantity: "", deliveryCost: "0", validUntil: "", notes: "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/quote-requests/${id}`);
      setItem(data);
      if (user && !data.isOwner) {
        const { data: offers } = await api.get("/quote-requests/offers/mine");
        setMyOffer(offers.find((request) => request._id === id)?.offers?.[0] || null);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.error || "تعذر تحميل الطلب.");
    } finally {
      setLoading(false);
    }
  }, [api, id, user]);

  useEffect(() => { load(); }, [load]);

  const submitOffer = async (event) => {
    event.preventDefault();
    if (!user) return navigate("/login", { state: { from: `/quote-requests/${id}` } });
    setBusy(true);
    setError("");
    try {
      await api.post(`/quote-requests/${id}/offers`, offerForm);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.error || "تعذر إرسال العرض.");
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (status) => {
    if (!window.confirm(status === "cancelled" ? "هل تريد إلغاء طلب التسعيرة؟" : "هل تريد إغلاق طلب التسعيرة؟")) return;
    setBusy(true);
    setError("");
    try {
      await api.patch(`/quote-requests/${id}/status`, { status });
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.error || "تعذر تحديث حالة الطلب.");
    } finally {
      setBusy(false);
    }
  };

  const selectOffer = async (offerId) => {
    setBusy(true);
    setError("");
    try {
      await api.patch(`/quote-requests/${id}/select-offer/${offerId}`);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.error || "تعذر اختيار العرض.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p dir="rtl" className="py-12 text-center text-slate-500">جارٍ تحميل الطلب...</p>;
  if (!item) return <p dir="rtl" role="alert" className="rounded-xl bg-red-50 p-4 text-center text-red-700">{error || "الطلب غير موجود."}</p>;
  const isOwner = item.isOwner;
  const canOffer = user && !isOwner && item.status === "open" && !myOffer;
  const selected = item.offers?.find((offer) => String(offer._id) === String(item.selectedOfferId));
  const location = [item.governorateId?.name, item.cityId?.name].filter(Boolean).join(" - ") || "غير محدد";

  return (
    <section dir="rtl" className="mx-auto max-w-4xl space-y-5">
      <Link to="/quote-requests" className="inline-flex text-sm font-bold text-blue-700">← العودة إلى طلبات التسعير</Link>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
      <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        {item.image && <img src={uploadsUrl(item.image, "med")} alt={item.itemName} className="max-h-56 w-full bg-slate-50 object-contain sm:max-h-80 dark:bg-slate-900" />}
        <div className="space-y-4 p-4 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-xs font-bold text-blue-700 dark:text-blue-300">طلب تسعيرة</span>
              <h1 className="mt-1 break-words text-2xl font-black text-slate-900 sm:text-3xl dark:text-white">{item.itemName}</h1>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1.5 text-center text-[11px] font-black ring-1 sm:px-3 sm:text-sm ${statusStyles[item.status] || statusStyles.closed}`}>{statusLabels[item.status] || "حالة الطلب"}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
            <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">الكمية المطلوبة</p>
              <p className="mt-1 text-sm font-black text-slate-900 dark:text-white">{Number(item.quantity).toLocaleString("ar")}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">الموقع</p>
              <p className="mt-1 text-sm font-black text-slate-900 dark:text-white">{location}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">التصنيف</p>
              <p className="mt-1 text-sm font-black text-slate-900 dark:text-white">{item.categoryId?.name || "غير محدد"}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">تاريخ النشر</p>
              <p className="mt-1 text-sm font-black text-slate-900 dark:text-white">{new Date(item.createdAt).toLocaleDateString("ar")}</p>
            </div>
            <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-1 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">صاحب الطلب</p>
              <p className="mt-1 text-sm font-black text-slate-900 dark:text-white">{item.ownerId?.name || "مستخدم سوقك"}</p>
            </div>
          </div>
          {item.description && <div><h2 className="font-black">الوصف</h2><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{item.description}</p></div>}
          {item.specifications && <div><h2 className="font-black">المواصفات</h2><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{item.specifications}</p></div>}
          {isOwner && item.status === "open" && <div className="flex flex-wrap gap-2 border-t pt-4"><button disabled={busy} onClick={() => updateStatus("closed")} className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-bold text-white">إغلاق الطلب</button><button disabled={busy} onClick={() => updateStatus("cancelled")} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700">إلغاء الطلب</button></div>}
        </div>
      </article>

      {isOwner && (
        <section className="space-y-3">
          <h2 className="text-xl font-black">العروض الواردة ({item.offers?.length || 0})</h2>
          {!item.offers?.length ? <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 dark:bg-slate-800">لم تصل عروض بعد. سنشعرك عند وصول عرض جديد.</p> :
            [...item.offers].sort((a, b) => (String(b._id) === String(item.selectedOfferId)) - (String(a._id) === String(item.selectedOfferId))).map((offer) => <OfferCard key={offer._id} offer={offer} isOwner isSelected={String(offer._id) === String(item.selectedOfferId)} onSelect={item.status === "open" ? selectOffer : null} busy={busy} />)}
        </section>
      )}

      {!isOwner && myOffer && <section className="space-y-3"><h2 className="text-xl font-black">عرضك على الطلب</h2><OfferCard offer={myOffer} isOwner={false} isSelected={String(myOffer._id) === String(item.selectedOfferId)} /></section>}

      {canOffer && (
        <form onSubmit={submitOffer} className="space-y-4 rounded-3xl border border-blue-100 bg-blue-50/70 p-5 sm:p-7 dark:border-slate-700 dark:bg-slate-800">
          <div><h2 className="text-xl font-black">قدّم عرض سعر</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">أدخل السعر والكمية المتوفرة، ويمكنك إضافة التوصيل ومدة الصلاحية.</p></div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-bold">السعر *<input required type="number" min="0.01" step="any" value={offerForm.price} onChange={(event) => setOfferForm({ ...offerForm, price: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-900" /></label>
            <label className="text-sm font-bold">العملة<select value={offerForm.currency} onChange={(event) => setOfferForm({ ...offerForm, currency: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-900">{Object.entries(currencyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="text-sm font-bold">الكمية المتوفرة *<input required type="number" min="0.01" step="any" value={offerForm.availableQuantity} onChange={(event) => setOfferForm({ ...offerForm, availableQuantity: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-900" /></label>
            <label className="text-sm font-bold">تكلفة التوصيل<input type="number" min="0" step="any" value={offerForm.deliveryCost} onChange={(event) => setOfferForm({ ...offerForm, deliveryCost: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-900" /></label>
            <label className="text-sm font-bold">صالح حتى<input type="date" min={new Date().toISOString().slice(0, 10)} value={offerForm.validUntil} onChange={(event) => setOfferForm({ ...offerForm, validUntil: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-900" /></label>
            <label className="col-span-2 text-sm font-bold">ملاحظات<textarea maxLength="1000" rows="2" value={offerForm.notes} onChange={(event) => setOfferForm({ ...offerForm, notes: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-900" /></label>
          </div>
          <button disabled={busy} className="rounded-xl bg-blue-700 px-5 py-3 font-black text-white disabled:opacity-50">{busy ? "جارٍ الإرسال..." : "إرسال العرض"}</button>
        </form>
      )}
      {!user && item.status === "open" && <Link to="/login" state={{ from: `/quote-requests/${id}` }} className="block rounded-xl bg-blue-700 p-4 text-center font-bold text-white">سجّل الدخول لتقديم عرض</Link>}
      {!isOwner && !myOffer && item.status !== "open" && <p className="rounded-xl bg-slate-100 p-4 text-center text-sm font-bold text-slate-600">هذا الطلب لا يستقبل عروضًا جديدة.</p>}
      {isOwner && item.status === "awarded" && selected && <p className="rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">تم اختيار العرض. يمكنك التواصل مع المورد من بطاقة العرض المختار.</p>}
    </section>
  );
}
