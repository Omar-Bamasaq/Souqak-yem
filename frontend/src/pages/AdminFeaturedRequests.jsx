import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useApi } from "../api/axios.js";
import DocumentPreviewModal from "../components/DocumentPreviewModal.jsx";
import { getStoreCurrencyLabel } from "../utils/storeArabicLabels.js";
import { normalizeProtectedFilePath, useProtectedFiles } from "../lib/protectedFiles.js";

const RECEIPT_PLACEHOLDER = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><rect width="800" height="500" fill="#f9fafb"/><circle cx="400" cy="200" r="60" fill="#fee2e2" stroke="#ef4444" stroke-width="2"/><text x="400" y="230" font-family="Arial,sans-serif" font-size="72" font-weight="bold" fill="#dc2626" text-anchor="middle">!</text><text x="400" y="320" font-family="Arial,sans-serif" font-size="26" font-weight="bold" fill="#7f1d1d" text-anchor="middle">السند غير متوفر</text><text x="400" y="370" font-family="Arial,sans-serif" font-size="16" fill="#991b1b" text-anchor="middle">تعذر تحميل صورة السند</text></svg>`);

function requestServiceType(request) {
  return request.campaign?.serviceType || request.planSnapshot?.adServiceType || request.plan?.adServiceType || "featured";
}

function requestPlanName(request) {
  return request.planSnapshot?.name || request.plan?.name || "باقة سابقة";
}

function requestDuration(request) {
  return request.campaign?.durationInDays || request.duration || request.planSnapshot?.durationInDays || request.plan?.durationInDays || 0;
}

function isRequestCampaignActive(request) {
  return request.campaign?.isActive ?? request.featured?.featured ?? false;
}

export default function AdminFeaturedRequests() {
  const api = useApi();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingId, setRejectingId] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewTitle, setPreviewTitle] = useState("معاينة السند");
  const [scheduleId, setScheduleId] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({ startsAt: "", endsAt: "" });
  const [extensionDays, setExtensionDays] = useState(1);
  const [extensionReason, setExtensionReason] = useState("");
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [filters, setFilters] = useState({ q: "", serviceType: "", status: "", from: "", to: "" });
  const [loadError, setLoadError] = useState("");
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const remainingDays = useCallback((d) => {
    if (!d) return 0;
    const ms = new Date(d).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  }, []);

  const currentReceiptPath = useMemo(() => {
    if (!openId) return null;
    const r = requests.find(x => x._id === openId);
    return r?.paymentReceipt || null;
  }, [openId, requests]);
  const { urls: receiptUrls, contentTypes: receiptContentTypes, errors: receiptErrors, loading: receiptLoading } = useProtectedFiles(api, [currentReceiptPath, previewDoc]);
  const receiptBlobUrl = receiptUrls[normalizeProtectedFilePath(currentReceiptPath)] || null;
  const previewUrl = receiptUrls[normalizeProtectedFilePath(previewDoc)] || null;

  const openReceiptPreview = (receiptPath, title = "معاينة السند") => {
    if (!receiptPath) return;
    setPreviewTitle(title);
    setPreviewDoc(receiptPath);
  };

  const load = useCallback(async (selectedFilters) => {
    setLoading(true);
    setLoadError("");
    try {
      const params = Object.fromEntries(Object.entries(selectedFilters || filtersRef.current).filter(([, value]) => value));
      const res = await api.get("/admin/purchase-requests", { params });
      setRequests(res.data || []);
    } catch (error) {
      setLoadError(error.response?.data?.error || "تعذر تحميل طلبات الترويج");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    if (!cancelled) load();
    return () => { cancelled = true; };
  }, [load]);

  const approve = async (id) => {
    setLoading(true);
    try {
      await api.patch(`/purchase-requests/${id}/approve`);
      setOpenId(null);
      load();
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تم قبول الطلب بنجاح", type: "success" } }));
    } catch {
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "فشل في قبول الطلب", type: "error" } }));
    } finally {
      setLoading(false);
    }
  };

  const updateCampaign = async (id, patch) => {
    try {
      await api.patch(`/purchase-requests/campaigns/${id}`, patch);
      await load();
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تم تحديث الحملة", type: "success" } }));
    } catch (error) {
      window.dispatchEvent(new CustomEvent("admin:toast", {
        detail: { message: error.response?.data?.error || "تعذر تحديث الحملة", type: "error" }
      }));
    }
  };

  const openSchedule = (request) => {
    const toLocalValue = (value) => {
      if (!value) return "";
      const date = new Date(value);
      return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    };
    setScheduleForm({
      startsAt: toLocalValue(request.campaign?.startsAt || request.featured?.featuredAt),
      endsAt: toLocalValue(request.campaign?.endsAt || request.featured?.featuredExpiresAt)
    });
    setExtensionDays(1);
    setExtensionReason("");
    setScheduleId(request._id);
  };

  const saveSchedule = async () => {
    if (!scheduleForm.startsAt || !scheduleForm.endsAt) {
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "حدد بداية ونهاية الحملة", type: "error" } }));
      return;
    }
    setSavingCampaign(true);
    try {
      await api.patch(`/purchase-requests/campaigns/${scheduleId}`, {
        startsAt: new Date(scheduleForm.startsAt).toISOString(),
        endsAt: new Date(scheduleForm.endsAt).toISOString()
      });
      setScheduleId(null);
      await load();
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تم تحديث مدة الحملة", type: "success" } }));
    } catch (error) {
      window.dispatchEvent(new CustomEvent("admin:toast", {
        detail: { message: error.response?.data?.error || "تعذر تحديث مدة الحملة", type: "error" }
      }));
    } finally {
      setSavingCampaign(false);
    }
  };

  const extendCampaign = async () => {
    if (!Number.isInteger(Number(extensionDays)) || Number(extensionDays) < 1 || Number(extensionDays) > 365) {
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "اختر تمديداً من يوم إلى 365 يوماً", type: "error" } }));
      return;
    }
    if (!extensionReason.trim()) {
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "اكتب سبب التمديد", type: "error" } }));
      return;
    }
    setSavingCampaign(true);
    try {
      await api.patch(`/purchase-requests/campaigns/${scheduleId}`, {
        extensionDays: Number(extensionDays),
        extensionReason: extensionReason.trim()
      });
      setScheduleId(null);
      await load();
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تمديد الحملة وتسجيل سببه", type: "success" } }));
    } catch (error) {
      window.dispatchEvent(new CustomEvent("admin:toast", {
        detail: { message: error.response?.data?.error || "تعذر تمديد الحملة", type: "error" }
      }));
    } finally {
      setSavingCampaign(false);
    }
  };

  const advanceSocialStatus = (request) => {
    const nextStatus = {
      pending: "in_progress",
      in_progress: "completed",
      completed: "completed",
      rejected: "in_progress"
    }[request.campaign?.socialPromotionStatus || "pending"];
    return updateCampaign(request._id, { socialPromotionStatus: nextStatus });
  };

  const reject = async (id) => {
    if (!rejectReason.trim()) {
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "يرجى كتابة سبب الرفض", type: "error" } }));
      return;
    }
    setRejectingId(id);
    try {
      await api.patch(`/purchase-requests/${id}/reject`, { rejectionReason: rejectReason });
      setOpenId(null);
      setRejectReason("");
      load();
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تم رفض الطلب", type: "success" } }));
    } catch {
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "فشل في رفض الطلب", type: "error" } }));
    } finally {
      setRejectingId(null);
    }
  };

  const getStatusLabel = (s) => {
    switch (s) {
      case "Pending": return "قيد الانتظار";
      case "Approved": return "مقبول";
      case "Rejected": return "مرفوض";
      default: return s;
    }
  };

  const req = requests.find((r) => r._id === openId);

  if (loading && requests.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
      <p className="text-[11px] font-black text-gray-400 animate-pulse">جاري تحميل طلبات التمييز...</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">إدارة طلبات الترويج</h1>
          <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">التمييز والمساحات والإعلانات البينية والترويج الاجتماعي اليدوي</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-black border border-blue-100 shadow-sm">
            إجمالي الطلبات: {requests.length}
          </span>
          <button 
            onClick={load} 
            className="p-3 rounded-2xl bg-white border border-gray-100 shadow-sm hover:bg-gray-50 transition-all active:scale-95 group"
            title="تحديث"
          >
            <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      <form onSubmit={(event) => { event.preventDefault(); load(filters); }} className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-6">
        <input value={filters.q} onChange={(event) => setFilters((value) => ({ ...value, q: event.target.value }))} placeholder="بحث بالاسم أو الإعلان أو الباقة" className="rounded-xl border border-gray-200 px-3 py-2 text-sm sm:col-span-2" />
        <select value={filters.serviceType} onChange={(event) => setFilters((value) => ({ ...value, serviceType: event.target.value }))} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
          <option value="">كل الخدمات</option>
          <option value="featured">التثبيت والتمييز</option>
          <option value="placement">المساحات الإعلانية</option>
          <option value="interstitial">الإعلان البيني</option>
          <option value="social">الترويج الاجتماعي</option>
        </select>
        <select value={filters.status} onChange={(event) => setFilters((value) => ({ ...value, status: event.target.value }))} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
          <option value="">كل الحالات</option>
          <option value="Pending">قيد المراجعة</option>
          <option value="Approved">مقبول</option>
          <option value="Rejected">مرفوض</option>
        </select>
        <input type="date" aria-label="من تاريخ" value={filters.from} onChange={(event) => setFilters((value) => ({ ...value, from: event.target.value }))} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
        <input type="date" aria-label="إلى تاريخ" value={filters.to} onChange={(event) => setFilters((value) => ({ ...value, to: event.target.value }))} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
        <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
          <button type="submit" className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white">تطبيق الفلاتر</button>
          <button type="button" onClick={() => { const cleared = { q: "", serviceType: "", status: "", from: "", to: "" }; setFilters(cleared); load(cleared); }} className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-black text-gray-600">مسح</button>
        </div>
      </form>
      {loadError && <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{loadError}</div>}

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
        {/* Desktop View */}
        <div className="hidden lg:block overflow-x-auto custom-scrollbar">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">المستخدم</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">الإعلان</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider text-center">الباقة</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider text-center">السعر</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider text-center">الصلاحية</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider text-center">المتبقي</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider text-center">السند</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider text-center">الحالة</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider text-left">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {requests.map((r) => (
                <tr key={r._id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <p className="font-black text-gray-900">{r.user?.name}</p>
                    <p className="text-[10px] font-bold text-gray-400">{r.user?.phone || r.user?.email}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-black text-gray-700 truncate max-w-[150px]" title={r.product?.title}>{r.product?.title || "-"}</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="block text-[10px] font-black text-gray-700">{requestPlanName(r)}</span>
                    <span className="mt-1 inline-block rounded-lg bg-gray-100 px-2.5 py-1 text-[10px] font-black text-gray-600">{requestDuration(r)} يوم</span>
                    {requestServiceType(r) !== "featured" && (
                      <span className="mt-1 block text-[10px] font-bold text-blue-700">
                        {requestServiceType(r) === "placement" ? "مساحة إعلانية" : "إعلان بيني"}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="block text-xs font-black text-gray-800">{Number(r.price ?? r.planSnapshot?.price ?? 0).toLocaleString("ar-YE")}</span>
                    <span className="text-[9px] font-bold text-gray-400">{getStoreCurrencyLabel(r.currency || r.planSnapshot?.currency || r.plan?.currency)}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-gray-400">من: {r.campaign?.startsAt ? new Date(r.campaign.startsAt).toLocaleDateString("ar-YE") : r.featured?.featuredAt ? new Date(r.featured.featuredAt).toLocaleDateString("ar-YE") : "-"}</span>
                      <span className="text-[10px] font-bold text-gray-400">إلى: {r.campaign?.endsAt ? new Date(r.campaign.endsAt).toLocaleDateString("ar-YE") : r.featured?.featuredExpiresAt ? new Date(r.featured.featuredExpiresAt).toLocaleDateString("ar-YE") : "-"}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {(r.campaign?.endsAt || r.featured?.featuredExpiresAt) ? (
                      new Date(r.campaign?.endsAt || r.featured.featuredExpiresAt).getTime() <= Date.now()
                        ? <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-50 text-red-700 border border-red-100">منتهي</span>
                        : <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${remainingDays(r.campaign?.endsAt || r.featured?.featuredExpiresAt) <= 2 ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"}`}>{remainingDays(r.campaign?.endsAt || r.featured?.featuredExpiresAt)} يوم</span>
                    ) : "-"}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {r.paymentReceipt ? (
                      <button type="button" onClick={() => openReceiptPreview(r.paymentReceipt, `سند الدفع - ${r.user?.name || "مستخدم"}`)} className="inline-flex p-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all border border-blue-100">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </button>
                    ) : <span className="text-[10px] font-bold text-gray-400">غير مرفق</span>}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black border ${
                      r.status === "Approved" ? "bg-green-50 text-green-700 border-green-100" : 
                      r.status === "Rejected" ? "bg-red-50 text-red-700 border-red-100" : 
                      "bg-amber-50 text-amber-700 border-amber-100"
                    }`}>
                      {getStatusLabel(r.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-left">
                    {r.status === "Pending" && (
                      <button
                        onClick={() => setOpenId(r._id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95"
                      >
                        مراجعة
                      </button>
                    )}
                    {r.status === "Approved" && ["featured", "placement", "interstitial"].includes(requestServiceType(r)) && (
                      <div className="flex flex-col items-end gap-1.5">
                        <span className={`text-[10px] font-bold ${isRequestCampaignActive(r) ? "text-emerald-700" : "text-gray-400"}`}>
                          {isRequestCampaignActive(r) ? "الحملة مفعلة" : "الحملة موقوفة"}
                        </span>
                        <button
                          onClick={() => updateCampaign(r._id, { isActive: !isRequestCampaignActive(r) })}
                          className="rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-[10px] font-black text-blue-700"
                        >
                          {isRequestCampaignActive(r) ? "إيقاف" : "تفعيل"}
                        </button>
                        <button
                          onClick={() => openSchedule(r)}
                          className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[10px] font-black text-gray-600"
                        >
                          تعديل المدة
                        </button>
                        {r.campaign?.socialPromotionRequested && (
                          <div className="flex flex-col items-end gap-1">
                            <button
                              onClick={() => advanceSocialStatus(r)}
                              className="rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-1.5 text-[10px] font-black text-amber-800"
                            >
                              الترويج اليدوي: {({ pending: "بدء التنفيذ", in_progress: "تأكيد الإتمام", completed: "مكتمل", rejected: "إعادة التنفيذ" })[r.campaign.socialPromotionStatus] || "مطلوب"}
                            </button>
                            {r.campaign.socialPromotionStatus !== "completed" && (
                              <button
                                onClick={() => updateCampaign(r._id, { socialPromotionStatus: "rejected" })}
                                className="text-[10px] font-bold text-red-600 underline"
                              >
                                رفض الترويج الاجتماعي
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr><td colSpan={9} className="px-6 py-12 text-center text-gray-400 font-bold">لا توجد طلبات ترويج مطابقة للفلاتر</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="lg:hidden p-4 space-y-4 bg-gray-50/50">
          {requests.map((r) => (
            <div key={r._id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
                  r.status === "Approved" ? "bg-green-50 text-green-700 border-green-100" : 
                  r.status === "Rejected" ? "bg-red-50 text-red-700 border-red-100" : 
                  "bg-amber-50 text-amber-700 border-amber-100"
                }`}>
                  {getStatusLabel(r.status)}
                </span>
                <span className="text-[10px] font-bold text-gray-400">{new Date(r.createdAt).toLocaleDateString("ar-YE")}</span>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black border border-blue-100">
                    {(r.user?.name || "م").charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 text-sm">{r.user?.name}</h3>
                    <p className="text-[10px] font-bold text-gray-400 mt-0.5 truncate max-w-[200px]">{r.product?.title || "-"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-2xl">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">الباقة</p>
                    <p className="text-xs font-black text-gray-700">{requestPlanName(r)} · {requestDuration(r)} يوم</p>
                    <p className="mt-1 text-[10px] font-bold text-gray-500">{Number(r.price ?? r.planSnapshot?.price ?? 0).toLocaleString("ar-YE")} {getStoreCurrencyLabel(r.currency || r.planSnapshot?.currency || r.plan?.currency)}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-2xl">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">المتبقي</p>
                    <div className="flex items-center">
                      {r.featured?.featuredExpiresAt ? (
                        new Date(r.featured.featuredExpiresAt).getTime() <= Date.now()
                          ? <span className="text-xs font-black text-red-600">منتهي</span>
                          : <span className={`text-xs font-black ${remainingDays(r.featured.featuredExpiresAt) <= 2 ? "text-amber-600" : "text-emerald-600"}`}>{remainingDays(r.featured.featuredExpiresAt)} يوم</span>
                      ) : <span className="text-xs font-black text-gray-400">-</span>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                {r.paymentReceipt && (
                  <button type="button" onClick={() => openReceiptPreview(r.paymentReceipt, `سند الدفع - ${r.user?.name || "مستخدم"}`)} className="flex-1 py-3.5 bg-gray-50 text-gray-600 border border-gray-100 rounded-2xl text-xs font-black flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    السند
                  </button>
                )}
                {r.status === "Pending" && (
                  <button onClick={() => setOpenId(r._id)} className="flex-[2] py-3.5 bg-blue-600 text-white rounded-2xl text-xs font-black shadow-lg shadow-blue-100 active:scale-95">مراجعة الطلب</button>
                )}
                {r.status === "Approved" && ["featured", "placement", "interstitial"].includes(requestServiceType(r)) && (
                  <div className="flex flex-1 flex-col gap-2">
                    <button
                      onClick={() => updateCampaign(r._id, { isActive: !isRequestCampaignActive(r) })}
                      className="w-full rounded-xl border border-blue-100 bg-blue-50 py-2.5 text-xs font-black text-blue-700"
                    >
                      {isRequestCampaignActive(r) ? "إيقاف الحملة" : "تفعيل الحملة"}
                    </button>
                    <button onClick={() => openSchedule(r)} className="w-full rounded-xl border border-gray-200 bg-white py-2.5 text-xs font-black text-gray-600">
                      تعديل مدة الحملة
                    </button>
                    {r.campaign?.socialPromotionRequested && (
                      <>
                        <button onClick={() => advanceSocialStatus(r)} className="w-full rounded-xl border border-amber-100 bg-amber-50 py-2.5 text-xs font-black text-amber-800">
                          تحديث حالة الترويج اليدوي
                        </button>
                        {r.campaign.socialPromotionStatus !== "completed" && (
                          <button onClick={() => updateCampaign(r._id, { socialPromotionStatus: "rejected" })} className="w-full py-1 text-xs font-bold text-red-600">
                            رفض الترويج الاجتماعي
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {requests.length === 0 && (
            <div className="bg-white p-12 text-center rounded-3xl border border-gray-100">
              <p className="text-sm font-bold text-gray-400">لا توجد طلبات ترويج مطابقة للفلاتر</p>
            </div>
          )}
        </div>
      </div>

      <DocumentPreviewModal
        isOpen={!!previewDoc}
        src={previewUrl}
        onClose={() => setPreviewDoc(null)}
        title={previewTitle}
        contentType={receiptContentTypes[normalizeProtectedFilePath(previewDoc)]}
        loading={receiptLoading}
        error={receiptErrors[normalizeProtectedFilePath(previewDoc)]}
      />

      {scheduleId && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-gray-900/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-2xl" dir="rtl">
            <h3 className="text-lg font-black text-gray-900">جدولة الحملة الإعلانية</h3>
            <p className="text-xs font-bold text-gray-500">إعادة الجدولة تبقى ضمن المدة الحالية. التمديد اليدوي مجاني للأدمن، بحد أقصى 365 يوماً لكل طلب، ويُحفظ مع السبب واسم المنفذ.</p>
            <label className="block text-xs font-bold text-gray-600">
              بداية الحملة
              <input
                type="datetime-local"
                value={scheduleForm.startsAt}
                onChange={(event) => setScheduleForm((value) => ({ ...value, startsAt: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-200 p-3"
              />
            </label>
            <label className="block text-xs font-bold text-gray-600">
              نهاية الحملة
              <input
                type="datetime-local"
                value={scheduleForm.endsAt}
                onChange={(event) => setScheduleForm((value) => ({ ...value, endsAt: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-200 p-3"
              />
            </label>
            <div className="flex gap-2">
              <button onClick={saveSchedule} disabled={savingCampaign} className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
                {savingCampaign ? "جارٍ الحفظ..." : "حفظ الجدولة"}
              </button>
              <button onClick={() => setScheduleId(null)} disabled={savingCampaign} className="rounded-xl bg-gray-100 px-4 py-3 text-sm font-black text-gray-600">
                إلغاء
              </button>
            </div>
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <h4 className="text-sm font-black text-gray-800">تمديد إداري مجاني</h4>
              <label className="block text-xs font-bold text-gray-600">
                عدد الأيام (1–365)
                <input
                  type="number"
                  min={1}
                  max={365}
                  step={1}
                  value={extensionDays}
                  onChange={(event) => setExtensionDays(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 p-3"
                />
              </label>
              <label className="block text-xs font-bold text-gray-600">
                سبب التمديد (يُحفظ في سجل الطلب)
                <textarea
                  value={extensionReason}
                  maxLength={1000}
                  onChange={(event) => setExtensionReason(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 p-3"
                  rows={3}
                  required
                />
              </label>
              <button onClick={extendCampaign} disabled={savingCampaign} className="w-full rounded-xl bg-amber-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
                {savingCampaign ? "جارٍ الحفظ..." : "تسجيل التمديد"}
              </button>
              {(requests.find((request) => request._id === scheduleId)?.campaign?.adminExtensions || []).length > 0 && (
                <div className="space-y-2 rounded-xl bg-gray-50 p-3">
                  <p className="text-xs font-black text-gray-600">سجل التمديدات</p>
                  {requests.find((request) => request._id === scheduleId).campaign.adminExtensions.map((extension, index) => (
                    <p key={`${extension.extendedAt}-${index}`} className="text-[11px] font-bold leading-5 text-gray-500">
                      {extension.days} يوم · {extension.reason} · {extension.extendedBy?.name || "أدمن"} · {extension.extendedAt ? new Date(extension.extendedAt).toLocaleDateString("ar-YE") : ""}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {openId && req && (
        <div 
          className="fixed inset-0 z-[100] bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto overscroll-none px-4 py-6 sm:py-12 flex items-start justify-center" 
          onClick={() => setOpenId(null)}
        >
          <div 
            className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-300 relative flex flex-col" 
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 pb-4 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-10 rounded-t-[2.5rem] border-b border-gray-100">
              <div>
                <h3 className="text-lg font-black text-gray-900">مراجعة طلب التمييز</h3>
                <p className="text-[10px] font-bold text-gray-400 mt-0.5 uppercase tracking-widest">تحقق من بيانات الدفع والتفعيل</p>
              </div>
              <button onClick={() => setOpenId(null)} className="p-2 rounded-2xl bg-gray-50 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all active:scale-90">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-2xl space-y-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">المستخدم</p>
                  <p className="text-xs font-black text-gray-900">{req.user?.name}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-2xl space-y-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">الباقة</p>
                  <p className="text-xs font-black text-gray-900">{req.plan?.durationInDays} يوم</p>
                </div>
                <div className="col-span-2 p-3 bg-blue-50/50 rounded-2xl space-y-1">
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">الإعلان المستهدف</p>
                  <p className="text-xs font-black text-blue-600">{req.product?.title}</p>
                </div>
              </div>

              {req.paymentReceipt && (
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">مرفق الدفع (السند)</p>
                  <button type="button" onClick={() => openReceiptPreview(req.paymentReceipt, `سند الدفع - ${req.user?.name || "مستخدم"}`)} className="block w-full relative group overflow-hidden rounded-3xl border-2 border-dashed border-gray-100 hover:border-blue-200 transition-colors aspect-video bg-gray-50 text-left">
                    {receiptLoading ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/90 z-10">
                        <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
                        <p className="text-[11px] font-black text-blue-600 animate-pulse">جاري تحميل السند الآمن...</p>
                      </div>
                    ) : null}
                    <img 
                      src={receiptBlobUrl || RECEIPT_PLACEHOLDER}
                      alt="Receipt" 
                      className="w-full h-full object-contain p-2" 
                      onError={(e) => { 
                        console.warn("[FeaturedRequests] Receipt img onError fired, falling back to placeholder");
                        e.target.onerror = null; 
                        e.target.src = RECEIPT_PLACEHOLDER; 
                      }} 
                    />
                    <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/10 flex items-center justify-center transition-all">
                      <span className="px-4 py-2 bg-white text-blue-600 rounded-xl text-xs font-black shadow-xl opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all">عرض الحجم الكامل</span>
                    </div>
                  </button>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">ملاحظات الإدارة (في حال الرفض)</p>
                  <textarea
                    placeholder="اكتب سبب الرفض هنا..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-blue-500/20 text-sm font-bold min-h-[100px] resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => approve(req._id)}
                    disabled={loading}
                    className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl text-sm font-black shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all disabled:opacity-50 active:scale-95"
                  >
                    {loading ? "جاري التفعيل..." : "تأكيد وتفعيل التمييز"}
                  </button>
                  <button
                    onClick={() => reject(req._id)}
                    disabled={rejectingId === req._id}
                    className="flex-1 py-4 bg-red-50 text-red-600 border border-red-100 rounded-2xl text-sm font-black hover:bg-red-100 transition-all disabled:opacity-50 active:scale-95"
                  >
                    {rejectingId === req._id ? "جاري..." : "رفض الطلب"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
