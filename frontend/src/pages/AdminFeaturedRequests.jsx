import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";

const API = (import.meta.env?.VITE_API_URL) || "http://localhost:5000/api";

export default function AdminFeaturedRequests() {
  const api = useApi();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingId, setRejectingId] = useState(null);

  const uploadsUrl = (path) => {
    if (!path) return "";
    const base = (import.meta.env?.VITE_API_URL || "http://localhost:5000/api").replace("/api", "");
    return `${base}/uploads/${path}`;
  };

  const remainingDays = (d) => {
    if (!d) return 0;
    const ms = new Date(d).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/purchase-requests");
      const items = (res.data || []).filter((r) => r.plan?.type === "featured");
      setRequests(items);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

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
          <h1 className="text-2xl font-black text-gray-900">إدارة طلبات التمييز</h1>
          <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">مراجعة وتفعيل الإعلانات المميزة</p>
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

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
        {/* Desktop View */}
        <div className="hidden lg:block overflow-x-auto custom-scrollbar">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">المستخدم</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">الإعلان</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider text-center">الباقة</th>
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
                    <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-black">{r.plan?.durationInDays} يوم</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-gray-400">من: {r.featured?.featuredAt ? new Date(r.featured.featuredAt).toLocaleDateString("ar-YE") : "-"}</span>
                      <span className="text-[10px] font-bold text-gray-400">إلى: {r.featured?.featuredExpiresAt ? new Date(r.featured.featuredExpiresAt).toLocaleDateString("ar-YE") : "-"}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {r.featured?.featuredExpiresAt ? (
                      new Date(r.featured.featuredExpiresAt).getTime() <= Date.now()
                        ? <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-50 text-red-700 border border-red-100">منتهي</span>
                        : <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${remainingDays(r.featured.featuredExpiresAt) <= 2 ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"}`}>{remainingDays(r.featured.featuredExpiresAt)} يوم</span>
                    ) : "-"}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {r.paymentReceipt && (
                      <a href={uploadsUrl(r.paymentReceipt)} target="_blank" rel="noreferrer" className="inline-flex p-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all border border-blue-100">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </a>
                    )}
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
                  </td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-400 font-bold">لا توجد طلبات تمييز حالياً</td></tr>
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
                    <p className="text-xs font-black text-gray-700">{r.plan?.durationInDays} يوم</p>
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
                  <a href={uploadsUrl(r.paymentReceipt)} target="_blank" rel="noreferrer" className="flex-1 py-3.5 bg-gray-50 text-gray-600 border border-gray-100 rounded-2xl text-xs font-black flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    السند
                  </a>
                )}
                {r.status === "Pending" && (
                  <button onClick={() => setOpenId(r._id)} className="flex-[2] py-3.5 bg-blue-600 text-white rounded-2xl text-xs font-black shadow-lg shadow-blue-100 active:scale-95">مراجعة الطلب</button>
                )}
              </div>
            </div>
          ))}
          {requests.length === 0 && (
            <div className="bg-white p-12 text-center rounded-3xl border border-gray-100">
              <p className="text-sm font-bold text-gray-400">لا توجد طلبات تمييز</p>
            </div>
          )}
        </div>
      </div>

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
                  <a href={uploadsUrl(req.paymentReceipt)} target="_blank" rel="noreferrer" className="block relative group overflow-hidden rounded-3xl border-2 border-dashed border-gray-100 hover:border-blue-200 transition-colors aspect-video bg-gray-50">
                    <img src={uploadsUrl(req.paymentReceipt)} alt="Receipt" className="w-full h-full object-contain p-2" />
                    <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/10 flex items-center justify-center transition-all">
                      <span className="px-4 py-2 bg-white text-blue-600 rounded-xl text-xs font-black shadow-xl opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all">عرض الحجم الكامل</span>
                    </div>
                  </a>
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
