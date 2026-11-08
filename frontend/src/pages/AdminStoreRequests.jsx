import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";
import DocumentPreviewModal from "../components/DocumentPreviewModal.jsx";
import { getStoreCurrencyLabel } from "../utils/storeArabicLabels.js";
import { normalizeProtectedFilePath, useProtectedFiles } from "../lib/protectedFiles.js";

export default function AdminStoreRequests() {
  const api = useApi();
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState("");
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewTitle, setPreviewTitle] = useState("معاينة السند");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { urls: protectedFileUrls, contentTypes: protectedFileContentTypes, errors: protectedFileErrors, loading: protectedFilesLoading } = useProtectedFiles(api, [previewDoc]);
  const previewUrl = protectedFileUrls[normalizeProtectedFilePath(previewDoc)] || null;

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/admin/stores/requests");
      setRequests(res.data || []);
      setSelected((current) => current ? (res.data || []).find((request) => request._id === current._id) || null : null);
    } catch (loadError) {
      setError(loadError.response?.data?.error || "تعذر تحميل طلبات المتاجر.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const approve = async (id) => {
    setBusy(true);
    setError("");
    try {
      await api.post(`/admin/stores/requests/${id}/approve`);
      setSelected(null);
      await load();
    } catch (actionError) {
      setError(actionError.response?.data?.error || "تعذرت الموافقة على الطلب.");
    } finally {
      setBusy(false);
    }
  };

  const reject = async (id) => {
    setBusy(true);
    setError("");
    try {
      await api.post(`/admin/stores/requests/${id}/reject`, { rejectionReason: reason || "رفض الطلب" });
      setReason("");
      setSelected(null);
      await load();
    } catch (actionError) {
      setError(actionError.response?.data?.error || "تعذر رفض الطلب.");
    } finally {
      setBusy(false);
    }
  };

  const openReceiptPreview = (receiptPath, title = "معاينة السند") => {
    if (!receiptPath) return;
    setPreviewTitle(title);
    setPreviewDoc(receiptPath);
  };

  const formatDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("ar-YE", { dateStyle: "medium", timeStyle: "short" }).format(date);
  };

  return (
    <div className="space-y-5 p-3 sm:space-y-6 sm:p-4">
      <div className="flex flex-col gap-4 rounded-3xl bg-gradient-to-l from-slate-950 via-emerald-950 to-teal-800 p-5 text-white shadow-lg sm:flex-row sm:items-end sm:justify-between sm:p-7">
        <div>
          <p className="text-xs font-black text-emerald-200">مراجعة طلبات الاشتراك</p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">طلبات المتاجر وصناعات سوقك</h1>
          <p className="mt-2 text-sm leading-6 text-emerald-100">راجع بيانات المشروع وسند الدفع قبل اعتماد الاشتراك أو رفضه.</p>
        </div>
        <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
          <p className="text-[11px] font-bold text-emerald-100">بانتظار المراجعة</p>
          <p className="mt-1 text-2xl font-black">{requests.length}</p>
        </div>
      </div>

      {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        {selected && (
          <section className="order-1 space-y-5 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 lg:order-2">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <p className="text-xs font-black text-blue-700">تفاصيل الطلب المحدد</p>
                <h2 className="mt-1 text-xl font-black text-gray-900">{selected.storeProfile?.storeName || "مشروع بدون اسم"}</h2>
                <p className="mt-1 text-xs font-black text-emerald-700">{selected.storeProfile?.storeType === "family-production" ? "طلب صناعات سوقك" : "طلب متجر"}</p>
                <p className="mt-1 text-xs text-gray-500">أُرسل {formatDate(selected.createdAt)}</p>
              </div>
              <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800">بانتظار المراجعة</span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-2xl bg-gray-50 p-3"><p className="text-[11px] font-bold text-gray-500">صاحب الطلب</p><p className="mt-1 break-words text-sm font-black text-gray-900">{selected.user?.name || "—"}</p><p className="mt-1 break-all text-xs text-gray-500">{selected.user?.email || ""}</p></div>
              <div className="rounded-2xl bg-gray-50 p-3"><p className="text-[11px] font-bold text-gray-500">الخطة</p><p className="mt-1 text-sm font-black text-gray-900">{selected.plan?.name || "—"}</p></div>
              <div className="rounded-2xl bg-gray-50 p-3"><p className="text-[11px] font-bold text-gray-500">قيمة الاشتراك</p><p className="mt-1 text-sm font-black text-gray-900">{Number(selected.price ?? selected.plan?.price ?? 0).toLocaleString("ar-EG")} {getStoreCurrencyLabel(selected.currency || selected.plan?.currency)}</p></div>
              <div className="rounded-2xl bg-gray-50 p-3"><p className="text-[11px] font-bold text-gray-500">النشاط التجاري</p><p className="mt-1 text-sm font-black text-gray-900">{selected.storeProfile?.businessActivity || "—"}</p></div>
              <div className="rounded-2xl bg-gray-50 p-3"><p className="text-[11px] font-bold text-gray-500">الموقع</p><p className="mt-1 text-sm font-black text-gray-900">{[selected.storeProfile?.governorateId?.name, selected.storeProfile?.cityId?.name || selected.storeProfile?.customCityName, selected.storeProfile?.location].filter(Boolean).join(" - ") || "—"}</p></div>
              <div className="rounded-2xl bg-gray-50 p-3"><p className="text-[11px] font-bold text-gray-500">أرقام الهاتف</p><p className="mt-1 text-sm font-black text-gray-900" dir="ltr">{(selected.storeProfile?.phones || []).map((entry) => entry.value).filter(Boolean).join("، ") || selected.storeProfile?.phone || "—"}</p></div>
              <div className="rounded-2xl bg-gray-50 p-3"><p className="text-[11px] font-bold text-gray-500">واتساب</p><p className="mt-1 text-sm font-black text-gray-900" dir="ltr">{(selected.storeProfile?.whatsapp || []).map((entry) => entry.value).filter(Boolean).join("، ") || "—"}</p></div>
            </div>

            {selected.paymentReceipt ? (
              <button type="button" onClick={() => openReceiptPreview(selected.paymentReceipt, `سند الدفع - ${selected.storeProfile?.storeName || "متجر"}`)} className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-black text-blue-800 hover:bg-blue-100">
                معاينة سند الدفع
              </button>
            ) : <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">لا يوجد سند دفع مرفق بهذا الطلب.</p>}

            <div>
              <label className="mb-2 block text-sm font-black text-gray-700">ملاحظة الرفض <span className="font-medium text-gray-400">(اختيارية)</span></label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-500" rows={3} maxLength={1000} placeholder="اكتب سبب الرفض ليظهر لصاحب الطلب..." />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button disabled={busy} onClick={() => approve(selected._id)} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{busy ? "جارٍ تنفيذ الإجراء..." : `الموافقة وتفعيل ${selected.storeProfile?.storeType === "family-production" ? "المشروع" : "المتجر"}`}</button>
              <button disabled={busy} onClick={() => reject(selected._id)} className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-black text-red-700 disabled:opacity-50">رفض الطلب</button>
            </div>
          </section>
        )}

        <section className={`order-2 space-y-3 lg:order-1 ${!selected ? "lg:col-span-2" : ""}`}>
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-black text-gray-800">قائمة الطلبات</h2>
            <span className="text-xs font-semibold text-gray-500">{requests.length} طلب</span>
          </div>
          {loading ? (
            <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center text-sm font-bold text-gray-500">جارٍ تحميل طلبات المتاجر...</div>
          ) : requests.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center">
              <p className="font-black text-gray-800">لا توجد طلبات بانتظار المراجعة</p>
              <p className="mt-2 text-sm text-gray-500">ستظهر الطلبات الجديدة في هذه القائمة.</p>
            </div>
          ) : requests.map((req) => (
            <button key={req._id} type="button" aria-pressed={selected?._id === req._id} onClick={() => {
              setSelected(req);
              setReason("");
              if (!window.matchMedia("(min-width: 1024px)").matches) window.scrollTo({ top: 0, behavior: "smooth" });
            }} className={`w-full rounded-2xl border p-4 text-right shadow-sm transition ${selected?._id === req._id ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100" : "border-gray-200 bg-white hover:border-blue-300"}`}>
              <div className="flex items-start justify-between gap-3">
                <span className="text-base font-black text-gray-900">{req.storeProfile?.storeName || "مشروع بدون اسم"}</span>
                <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-800">بانتظار المراجعة</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-gray-500">
                <span className="font-black text-emerald-700">{req.storeProfile?.storeType === "family-production" ? "صناعات سوقك" : "متجر"}</span><span>{req.user?.name || "صاحب الطلب غير معروف"}</span><span>{req.plan?.name || "خطة غير محددة"}</span><span>{formatDate(req.createdAt)}</span>
              </div>
            </button>
          ))}
        </section>
      </div>

      <DocumentPreviewModal
        isOpen={!!previewDoc}
        src={previewUrl}
        onClose={() => setPreviewDoc(null)}
        title={previewTitle}
        contentType={protectedFileContentTypes[normalizeProtectedFilePath(previewDoc)]}
        loading={protectedFilesLoading}
        error={protectedFileErrors[normalizeProtectedFilePath(previewDoc)]}
      />
    </div>
  );
}
