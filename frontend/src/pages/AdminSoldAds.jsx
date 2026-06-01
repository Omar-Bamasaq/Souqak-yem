import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";
import { uploadsUrl } from "../lib/uploads.js";

export default function AdminSoldAds() {
  const api = useApi();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await api.get("/admin/commissions");
      // Filter only items WITH adId
      const filtered = (res.data || []).filter(item => item.adId);
      setItems(filtered);
    } catch {
      setErr("تعذر تحميل البيانات");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const filteredItems = items.filter((item) => {
    const status = item.commissionStatus || item.status;
    const matchesStatus = filterStatus === "all" || status === filterStatus;
    
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      (item.adId?.title || "").toLowerCase().includes(searchLower) ||
      (item.sellerId?.name || "").toLowerCase().includes(searchLower) ||
      (item.sellerId?.phone || "").toLowerCase().includes(searchLower) ||
      (item.payerName || "").toLowerCase().includes(searchLower) ||
      (item.payerPhone || "").toLowerCase().includes(searchLower);

    return matchesStatus && matchesSearch;
  });

  const updateStatus = async (id, status, reason = "") => {
    try {
      await api.patch(`/admin/commissions/${id}/status`, { status, reason });
      setItems((arr) => arr.map((x) => (String(x._id) === String(id) ? { ...x, status, rejectReason: reason } : x)));
      setSelectedItem(null);
      setRejectReason("");
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تم تحديث الحالة وإرسال إشعار للمستخدم", type: "success" } }));
    } catch {
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تعذر التحديث", type: "error" } }));
    }
  };

  const getCurrencySymbol = (code) => {
    const symbols = {
      USD: "$",
      SAR: "ر.س",
      YER_ADEN: "ر.ي (عدن)",
      YER_SANAA: "ر.ي (صنعاء)",
      YER: "ر.ي"
    };
    return symbols[code] || "ر.ي";
  };

  const getStatusLabel = (item) => {
    if (item.commissionStatus === "pending_payment") return "بانتظار الدفع";
    if (item.commissionStatus === "pending_review") return "بانتظار المراجعة";
    if (item.commissionStatus === "approved") return "مقبولة";
    if (item.commissionStatus === "rejected") return "مرفوضة";
    
    // Legacy support
    switch (item.status) {
      case "unpaid": return "بانتظار الدفع";
      case "paid": return "مقبولة";
      case "overdue": return "متأخرة";
      case "Rejected": return "مرفوضة";
      case "Pending": return "بانتظار المراجعة";
      default: return item.status;
    }
  };

  const getStatusClass = (item) => {
    const status = item.commissionStatus || item.status;
    switch (status) {
      case "approved":
      case "paid": return "bg-green-50 text-green-700";
      case "overdue":
      case "rejected":
      case "Rejected": return "bg-red-50 text-red-700";
      case "pending_payment": return "bg-blue-50 text-blue-700";
      default: return "bg-yellow-50 text-yellow-700";
    }
  };

  const sendReminder = async (id) => {
    try {
      await api.post(`/admin/commissions/${id}/remind`);
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تم إرسال تذكير للمستخدم", type: "success" } }));
    } catch {
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تعذر إرسال التذكير", type: "error" } }));
    }
  };

  if (loading && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-[11px] font-black text-gray-400 animate-pulse">جاري تحميل البيانات...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20 sm:pb-0 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <h2 className="text-xl font-black text-gray-900">الإعلانات المباعة</h2>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:min-w-[250px]">
            <input
              type="text"
              placeholder="بحث في الإعلانات، البائعين..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-2.5 pr-10 text-xs font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
            />
            <svg className="absolute right-3 top-3 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2.5 text-xs font-black outline-none cursor-pointer focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all"
          >
            <option value="all">الكل</option>
            <option value="approved">مقبولة</option>
            <option value="pending_review">بانتظار المراجعة</option>
            <option value="pending_payment">بانتظار الدفع</option>
            <option value="rejected">مرفوضة</option>
          </select>

          <button 
            className="p-2.5 rounded-xl bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100 transition-all"
            onClick={load}
            title="تحديث"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {err && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600 border border-red-100">{err}</div>}

      {/* عرض الجدول للشاشات الكبيرة */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hidden sm:block">
        <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between bg-gray-50/30">
          <h3 className="text-sm font-black text-gray-900">سجل المبيعات والعمولات</h3>
          <span className="text-[10px] font-black text-gray-400 bg-white px-2 py-1 rounded-lg border border-gray-100 shadow-sm">
            إجمالي: {filteredItems.length}
          </span>
        </div>
        
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-right text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider">عنوان الإعلان</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider">اسم البائع</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider text-center">مبلغ البيع</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider text-center">العمولة (1%)</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider text-center">الحالة</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider text-left">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredItems.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400 font-bold italic">لا توجد نتائج تطابق البحث.</td></tr>
              ) : filteredItems.map((c) => (
                <tr key={c._id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-bold text-gray-900 truncate max-w-[200px] inline-block" title={c.adId?.title}>{c.adId?.title || "—"}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-bold text-gray-600">{c.payerName || c.sellerId?.name || "—"}</div>
                    <div className="text-[10px] text-gray-400 font-medium" dir="ltr">{c.payerPhone || c.sellerId?.phone || "—"}</div>
                  </td>
                  <td className="px-6 py-4 text-center whitespace-nowrap">
                    <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                      {(c.price || c.salePrice || 0).toLocaleString()} {getCurrencySymbol(c.currency)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center whitespace-nowrap">
                    <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                      {(c.commissionAmount || 0).toLocaleString()} {getCurrencySymbol(c.currency)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black border ${
                      (c.commissionStatus || c.status) === "approved" || (c.commissionStatus || c.status) === "paid" ? "bg-green-50 text-green-700 border-green-100" : 
                      (c.commissionStatus || c.status) === "rejected" || (c.commissionStatus || c.status) === "overdue" ? "bg-red-50 text-red-700 border-red-100" : 
                      "bg-amber-50 text-amber-700 border-amber-100"
                    }`}>
                      {getStatusLabel(c)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-left whitespace-nowrap">
                    <button
                      onClick={() => {
                        setSelectedItem(c);
                        setRejectReason(c.rejectReason || "");
                      }}
                      className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 transition-all"
                      title="إجراء"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* عرض البطاقات للهاتف */}
      <div className="block sm:hidden space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-black text-gray-900">المبيعات ({filteredItems.length})</h3>
        </div>
        
        {filteredItems.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-sm font-bold text-gray-400">لا توجد نتائج تطابق البحث</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((c) => (
              <div key={c._id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4 transition-all active:scale-[0.99]">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black border border-blue-100">
                      {(c.payerName || c.sellerId?.name || "ب").charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-black text-gray-900 text-sm">{c.payerName || c.sellerId?.name || "—"}</h3>
                      <p className="text-[10px] font-bold text-gray-400 mt-0.5 truncate max-w-[150px]">{c.payerPhone || c.sellerId?.phone || "—"}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black border ${
                    (c.commissionStatus || c.status) === "approved" || (c.commissionStatus || c.status) === "paid" ? "bg-green-50 text-green-700 border-green-100" : 
                    (c.commissionStatus || c.status) === "rejected" || (c.commissionStatus || c.status) === "overdue" ? "bg-red-50 text-red-700 border-red-100" : 
                    "bg-amber-50 text-amber-700 border-amber-100"
                  }`}>
                    {getStatusLabel(c)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 py-3 border-y border-gray-50">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">مبلغ البيع</p>
                    <p className="text-xs font-black text-blue-600 mt-0.5">{(c.price || c.salePrice || 0).toLocaleString()} {getCurrencySymbol(c.currency)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">العمولة</p>
                    <p className="text-xs font-black text-emerald-600 mt-0.5">{(c.commissionAmount || 0).toLocaleString()} {getCurrencySymbol(c.currency)}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedItem(c);
                      setRejectReason(c.rejectReason || "");
                    }}
                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    إجراء
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* تفاصيل الطلب - Modal (Matching featured-requests design) */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setSelectedItem(null)}>
          <div 
            className="w-full max-w-sm rounded-2xl border bg-white shadow-2xl animate-in zoom-in duration-200 max-h-[70vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b shrink-0">
              <h3 className="font-black text-gray-900 text-base">تفاصيل الطلب</h3>
              <button onClick={() => setSelectedItem(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-3 space-y-2 text-xs overflow-y-auto custom-scrollbar flex-1">
              <div className="flex justify-between border-b pb-2 items-center">
                <span className="text-gray-500 font-bold">الإعلان:</span>
                {selectedItem.adId ? (
                  <a 
                    href={`/product/${selectedItem.adId._id}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="font-black text-blue-600 hover:underline truncate max-w-[200px]"
                    title="فتح الإعلان في صفحة جديدة"
                  >
                    {selectedItem.adId.title}
                  </a>
                ) : (
                  <span className="font-black text-gray-900">—</span>
                )}
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-500 font-bold">اسم البائع:</span>
                <span className="font-black text-gray-900">{selectedItem.payerName || selectedItem.sellerId?.name || "—"}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-500 font-bold">رقم الهاتف:</span>
                <span className="font-black text-gray-900" dir="ltr">{selectedItem.payerPhone || selectedItem.sellerId?.phone || "—"}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-500 font-bold">مبلغ البيع:</span>
                <span className="font-black text-blue-600">
                  {selectedItem.price?.toLocaleString()} {getCurrencySymbol(selectedItem.currency)}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-500 font-bold">العمولة (1%):</span>
                <span className="font-black text-emerald-600">
                  {selectedItem.commissionAmount?.toLocaleString()} {getCurrencySymbol(selectedItem.currency)}
                </span>
              </div>

              {selectedItem.paymentReceipt && (
                <div className="flex justify-between border-b pb-2 items-center">
                  <span className="text-gray-500 font-bold">صورة السند:</span>
                  <a 
                    href={uploadsUrl(selectedItem.paymentReceipt)} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-blue-600 hover:underline font-black"
                  >
                    عرض السند
                  </a>
                </div>
              )}

              {selectedItem.adImage && (
                <div className="flex justify-between border-b pb-2 items-center">
                  <span className="text-gray-500 font-bold">صورة الإعلان:</span>
                  <a 
                    href={uploadsUrl(selectedItem.adImage)} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-blue-600 hover:underline font-black"
                  >
                    عرض الصورة
                  </a>
                </div>
              )}
            </div>

            {/* Fixed Footer Actions */}
            <div className="p-5 border-t border-gray-100 bg-gray-50 shrink-0">
              {selectedItem.commissionStatus === "pending_payment" ? (
                <button 
                  onClick={() => sendReminder(selectedItem._id)}
                  className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                  إرسال تذكير بالدفع
                </button>
              ) : selectedItem.commissionStatus === "pending_review" || selectedItem.status === "Pending" ? (
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => updateStatus(selectedItem._id, "paid")}
                    className="w-full bg-green-600 text-white font-black py-4 rounded-2xl hover:bg-green-700 transition-all shadow-xl shadow-green-600/20 active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    قبول
                  </button>
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      placeholder="سبب الرفض"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="w-full rounded-xl border border-gray-100 bg-white px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
                    />
                    <button 
                      onClick={() => {
                        if (!rejectReason.trim()) return alert("يرجى كتابة سبب الرفض");
                        updateStatus(selectedItem._id, "Rejected", rejectReason);
                      }}
                      className="w-full rounded-xl bg-red-600 text-white py-3.5 text-xs font-black hover:bg-red-700 transition-all shadow-lg shadow-red-100 active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      رفض الطلب
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => setSelectedItem(null)}
                  className="w-full bg-gray-200 text-gray-700 font-black py-3 rounded-2xl hover:bg-gray-300 transition-all active:scale-[0.98]"
                >
                  إغلاق
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
