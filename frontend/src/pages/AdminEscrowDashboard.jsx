import React, { useEffect, useRef, useState } from "react";
import { useApi } from "../api/axios.js";
import { Link } from "react-router-dom";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import { useAuth } from "../store/AuthContext.jsx";

function uploadsBaseUrl() {
  let envUrl = import.meta.env.VITE_UPLOADS_URL;
  if (!envUrl) {
    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
    envUrl = apiBase.replace(/\/api$/, "").replace(/\/$/, "") + "/uploads";
  }
  if (envUrl.endsWith("/uploads")) return envUrl;
  return envUrl.endsWith("/") ? `${envUrl}uploads` : `${envUrl}/uploads`;
}
const SENSITIVE_KWS = ["receipts", "ids", "kyc", "documents"];
function protectedFileUrl(filename, token) {
  if (!filename) return "";
  if (filename.startsWith("http")) return filename;
  let clean = filename;
  if (filename.startsWith("/uploads/")) clean = filename.replace("/uploads/", "");
  else if (filename.startsWith("uploads/")) clean = filename.replace("uploads/", "");
  const base = `${uploadsBaseUrl()}/${clean}`;
  const isSensitive = SENSITIVE_KWS.some(kw => {
    const c = clean.toLowerCase().replace(/\\/g, "/");
    return c.startsWith(kw + "/") || c.includes("/" + kw + "/") || c === kw;
  });
  if (!isSensitive) return base;
  if (!token) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}access_token=${encodeURIComponent(token)}`;
}

export default function AdminEscrowDashboard() {
  const api = useApi();
  const { token: authToken } = useAuth();
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("orders");
  const [previewReceipt, setPreviewReceipt] = useState(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewOffset, setPreviewOffset] = useState({ x: 0, y: 0 });
  const [isDraggingPreview, setIsDraggingPreview] = useState(false);
  const previewDragStartRef = useRef(null);

  const formatCurrency = (currency) => {
    const map = {
      "YER": "ريال (صنعاء)",
      "YER_ADEN": "ريال (عدن)",
      "SAR": "ريال سعودي",
      "USD": "دولار أمريكي"
    };
    return map[currency] || currency;
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [sRes, oRes, wRes, dRes] = await Promise.all([
        api.get("/admin/escrow/system-balance"),
        api.get("/admin/escrow/orders?status=AWAITING_PAYMENT_CONFIRMATION&limit=50"),
        api.get("/admin/escrow/withdrawals"),
        api.get("/admin/escrow/disputes")
      ]);
      setStats(sRes.data);
      setOrders(oRes.data.orders);
      setWithdrawals(wRes.data);
      setDisputes(dRes.data);
    } catch (err) {
      console.error("Load admin escrow data error:", err.response || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openReceiptPreview = (image) => {
    if (!image) return;
    setPreviewReceipt(protectedFileUrl(image, authToken));
    setPreviewScale(1);
    setPreviewOffset({ x: 0, y: 0 });
    setIsDraggingPreview(false);
    previewDragStartRef.current = null;
  };

  const closeReceiptPreview = () => {
    setPreviewReceipt(null);
    setPreviewScale(1);
    setPreviewOffset({ x: 0, y: 0 });
    setIsDraggingPreview(false);
    previewDragStartRef.current = null;
  };

  const handlePreviewMouseDown = (event) => {
    if (previewScale <= 1) return;
    setIsDraggingPreview(true);
    previewDragStartRef.current = {
      x: event.clientX - previewOffset.x,
      y: event.clientY - previewOffset.y,
    };
  };

  const handlePreviewMouseMove = (event) => {
    if (!isDraggingPreview || previewScale <= 1 || !previewDragStartRef.current) return;
    setPreviewOffset({
      x: event.clientX - previewDragStartRef.current.x,
      y: event.clientY - previewDragStartRef.current.y,
    });
  };

  const handlePreviewMouseUp = () => {
    setIsDraggingPreview(false);
    previewDragStartRef.current = null;
  };

  const handleConfirmPayment = async (orderId) => {
    if (!confirm("تأكيد استلام الحوالة البنكية؟ سيتم تحويل حالة الطلب إلى 'تم الدفع'.")) return;
    try {
      await api.patch(`/admin/escrow/orders/${orderId}/confirm-payment`);
      alert("تم تأكيد الدفع بنجاح");
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || "حدث خطأ");
    }
  };

  const handleRejectPayment = async (orderId) => {
    const reason = prompt("سبب رفض الدفع (سيظهر للمشتري):");
    if (!reason) return;
    try {
      await api.patch(`/admin/escrow/orders/${orderId}/reject-payment`, { reason });
      alert("تم رفض الدفع وإبلاغ المشتري");
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || "حدث خطأ");
    }
  };

  const handleProcessWithdrawal = async (id) => {
    try {
      await api.patch(`/admin/escrow/withdrawals/${id}/process`);
      loadData();
    } catch (err) { alert(err.response?.data?.error || "حدث خطأ"); }
  };

  const handleCompleteWithdrawal = async (id) => {
    const proof = prompt("أدخل رقم العملية أو رابط صورة الإثبات (اختياري):");
    try {
      await api.patch(`/admin/escrow/withdrawals/${id}/complete`, { transactionProof: proof });
      alert("تم إكمال السحب");
      loadData();
    } catch (err) { alert(err.response?.data?.error || "حدث خطأ"); }
  };

  const handleRejectWithdrawal = async (id) => {
    const reason = prompt("سبب الرفض (سيظهر للمستخدم):");
    if (!reason) return;
    try {
      await api.patch(`/admin/escrow/withdrawals/${id}/reject`, { adminNotes: reason });
      loadData();
    } catch (err) { alert(err.response?.data?.error || "حدث خطأ"); }
  };

  const handleResolveDispute = async (id, resolution) => {
    const notes = prompt("أدخل ملاحظات القرار (ستظهر للأطراف):");
    if (!notes) return;
    try {
      await api.patch(`/admin/escrow/disputes/${id}/resolve`, { resolution, notes });
      alert("تم حل النزاع بنجاح");
      loadData();
    } catch (err) { alert(err.response?.data?.error || "حدث خطأ"); }
  };

  const handleOpenDisputeChat = async (id) => {
    try {
      await api.post(`/admin/escrow/disputes/${id}/chat`);
      alert("تم إنشاء غرفة المحادثة. يمكنك الآن التواصل مع الأطراف في صفحة المحادثات.");
      loadData();
    } catch (err) { alert(err.response?.data?.error || "حدث خطأ"); }
  };

  const handleCloseDisputeChat = async (id) => {
    if (!window.confirm("هل أنت متأكد من إغلاق محادثة النزاع؟")) return;
    try {
      await api.patch(`/admin/escrow/disputes/${id}/close-chat`);
      alert("تم إغلاق المحادثة بنجاح.");
      loadData();
    } catch (err) { alert(err.response?.data?.error || "حدث خطأ"); }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
      <p className="text-[11px] font-black text-gray-400 animate-pulse">جاري تحميل بيانات الشراء الآمن...</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">إدارة الشراء الآمن (Escrow)</h1>
          <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">مراقبة العمليات المالية والنزاعات</p>
        </div>
        <button 
          onClick={loadData} 
          className="p-3 rounded-2xl bg-white border border-gray-100 shadow-sm hover:bg-gray-50 transition-all active:scale-95 group"
          title="تحديث البيانات"
        >
          <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="space-y-6">
        <h2 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] px-2">ملخص الأرصدة حسب العملة</h2>
        {stats?.allCurrencies?.map(curr => (
          <div key={curr._id} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm">
            <div className="p-5 bg-gray-50 rounded-3xl border border-gray-50">
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">إجمالي التدفقات</span>
              <p className="text-lg font-black text-emerald-600 mt-1">{curr.totalIn?.toLocaleString()} {formatCurrency(curr._id)}</p>
            </div>
            <div className="p-5 bg-gray-50 rounded-3xl border border-gray-50">
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">إجمالي المسحوبات</span>
              <p className="text-lg font-black text-red-600 mt-1">{curr.totalOut?.toLocaleString()} {formatCurrency(curr._id)}</p>
            </div>
            <div className="p-5 bg-gray-50 rounded-3xl border border-gray-50">
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">المسترجعات</span>
              <p className="text-lg font-black text-amber-600 mt-1">{curr.totalRefunds?.toLocaleString()} {formatCurrency(curr._id)}</p>
            </div>
            <div className="bg-blue-600 p-5 rounded-3xl shadow-xl shadow-blue-100 text-white flex flex-col justify-center">
              <span className="text-[9px] font-black text-blue-100 uppercase tracking-widest">الرصيد المتوقع</span>
              <p className="text-lg font-black mt-1">{(curr.totalIn - curr.totalOut - curr.totalRefunds)?.toLocaleString()} {formatCurrency(curr._id)}</p>
            </div>
          </div>
        ))}
        {(!stats?.allCurrencies || stats.allCurrencies.length === 0) && (
          <div className="p-16 text-center bg-white rounded-[2.5rem] border border-dashed border-gray-200">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-200">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <p className="text-sm font-bold text-gray-400">لا توجد بيانات مالية مسجلة حالياً</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1.5 bg-gray-100/50 rounded-2xl w-full overflow-x-auto scrollbar-hide pb-2">
        <div className="flex gap-2 min-w-max">
          {[
            { id: 'orders', label: 'الطلبات المعلقة بالدفع', icon: '📦' },
            { id: 'withdrawals', label: 'طلبات السحب', icon: '💳' },
            { id: 'disputes', label: 'النزاعات المفتوحة', icon: '⚠️' }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)} 
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                activeTab === tab.id 
                  ? "bg-white text-blue-600 shadow-sm border border-gray-100" 
                  : "text-gray-500 hover:bg-white/50"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
        {activeTab === 'orders' && (
          <>
            {/* Desktop View */}
            <div className="hidden lg:block overflow-x-auto custom-scrollbar">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">الطلب</th>
                    <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">المشتري</th>
                    <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">المبلغ</th>
                    <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">بيانات التحويل</th>
                    <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider text-left">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orders.filter(o => o.status === 'AWAITING_PAYMENT_CONFIRMATION').map(o => (
                    <tr key={o._id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <Link to={`/orders/${o._id}`} className="font-black text-blue-600 hover:underline">#{o._id.slice(-6)}</Link>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-black text-gray-900">{o.buyer?.name}</p>
                        <p className="text-[10px] font-bold text-gray-400">{o.buyer?.email}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col font-black text-gray-900">
                          {/* عرض مبالغ الطلب والمنصة (العملة الأساسية) */}
                          <div className="flex items-center gap-1.5 text-blue-600">
                            <span className="text-sm">{(o.amount + o.buyerServiceFee)?.toLocaleString()}</span>
                            <span className="text-[10px] opacity-70">{formatCurrency(o.currency)}</span>
                          </div>
                          
                          {/* عرض مبلغ الشحن إذا كان بعملة مختلفة أو له قيمة */}
                          {o.shippingFee > 0 && (
                            <div className="flex items-center gap-1.5 text-amber-600 mt-1 pt-1 border-t border-gray-100 border-dashed">
                              <span className="text-xs">+{o.shippingFee?.toLocaleString()}</span>
                              <span className="text-[9px] opacity-70">{formatCurrency(o.shippingCurrency || o.currency)}</span>
                              <span className="text-[8px] font-black uppercase tracking-tighter opacity-50">(شحن)</span>
                            </div>
                          )}

                          {/* المجموع الإجمالي التوضيحي */}
                          <div className="mt-2 py-1 px-2 bg-gray-50 rounded-lg border border-gray-100 inline-flex flex-col gap-0.5">
                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">إجمالي الحوالة المتوقعة</span>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span className="text-[10px] font-black text-gray-700">{(o.amount + o.buyerServiceFee)?.toLocaleString()} {o.currency}</span>
                              {o.shippingFee > 0 && <span className="text-[10px] font-black text-gray-700">+ {o.shippingFee?.toLocaleString()} {o.shippingCurrency || o.currency}</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <p className="text-xs font-black text-gray-700 bg-gray-100 px-2 py-1 rounded-md inline-block">🏦 {o.paymentDetails?.bankName}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {o.paymentDetails?.payments?.map((p, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => openReceiptPreview(p.receiptImage)}
                                className="px-2 py-1 bg-white border border-blue-100 text-blue-600 text-[9px] font-black rounded-md shadow-sm hover:bg-blue-50 transition-all"
                              >
                                سند {idx + 1}
                              </button>
                            ))}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-left">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleConfirmPayment(o._id)} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 active:scale-95">تأكيد الدفع</button>
                          <button onClick={() => handleRejectPayment(o._id)} className="px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl text-[10px] font-black hover:bg-red-100 transition-all active:scale-95">رفض</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {orders.filter(o => o.status === 'AWAITING_PAYMENT_CONFIRMATION').length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-bold">لا توجد طلبات بانتظار التأكيد حالياً</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="lg:hidden p-4 space-y-4 bg-gray-50/50">
              {loading && (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={`ms-${i}`} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm animate-pulse space-y-4">
                      <div className="flex gap-4">
                        <div className="h-12 w-12 bg-gray-200 rounded-xl" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-2/3 bg-gray-200 rounded" />
                          <div className="h-3 w-1/2 bg-gray-200 rounded" />
                        </div>
                      </div>
                      <div className="h-16 bg-gray-200 rounded-xl" />
                      <div className="h-10 bg-gray-200 rounded-xl" />
                    </div>
                  ))}
                </div>
              )}
              {!loading && orders.filter(o => o.status === 'AWAITING_PAYMENT_CONFIRMATION').length === 0 && (
                <div className="bg-white p-8 text-center rounded-2xl border border-gray-100 shadow-sm">
                  <p className="text-sm text-gray-500 font-bold">لا توجد طلبات بانتظار التأكيد.</p>
                </div>
              )}
              {!loading && orders.filter(o => o.status === 'AWAITING_PAYMENT_CONFIRMATION').map(o => (
                <div key={o._id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4 transition-all active:scale-[0.99]">
                  <div className="flex gap-4">
                    <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    </div>
                    <div className="min-w-0 flex-1 flex flex-col justify-center">
                      <div className="flex items-center justify-between">
                        <Link to={`/orders/${o._id}`} className="font-black text-gray-900 text-sm truncate">الطلب #{o._id.slice(-6)}</Link>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50 text-amber-700 text-[10px] font-black border border-amber-100">
                          <span className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-pulse"></span>
                          بانتظار التأكيد
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{o.buyer?.name || "مستخدم"}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
                    <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 sm:col-span-1">
                      <p className="text-gray-400 mb-0.5">المبلغ الإجمالي</p>
                      <p className="text-blue-600 truncate">{o.totalAmount?.toLocaleString()} {formatCurrency(o.currency)}</p>
                      <div className="flex flex-col gap-0.5 mt-1 pt-1 border-t border-gray-200/50">
                        <p className="text-[9px] text-emerald-600">رسوم المنصة: {o.buyerServiceFee?.toLocaleString()} {formatCurrency(o.currency)}</p>
                        {o.shippingFee > 0 && <p className="text-[9px] text-blue-500">التوصيل: {o.shippingFee?.toLocaleString()} {formatCurrency(o.shippingCurrency || o.currency)}</p>}
                      </div>
                    </div>
                    <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <p className="text-gray-400 mb-0.5">البنك</p>
                      <p className="text-gray-700 truncate">{o.paymentDetails?.bankName || "-"}</p>
                    </div>
                  </div>

                  {/* Payment Details / Receipts */}
                  {o.paymentDetails?.payments && o.paymentDetails.payments.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">سندات الدفع المرفقة</p>
                      <div className="grid grid-cols-1 gap-2">
                        {o.paymentDetails.payments.map((p, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-2 bg-blue-50/50 rounded-xl border border-blue-100">
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-black text-gray-500 uppercase tracking-tighter mb-0.5">رقم العملية</p>
                              <p className="text-xs font-black text-blue-900 truncate">#{p.transactionNumber}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => openReceiptPreview(p.receiptImage)}
                              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-[10px] font-black shadow-md shadow-blue-100 active:scale-95"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              عرض السند
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
                    <button onClick={() => handleConfirmPayment(o._id)} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black shadow-sm shadow-emerald-100 active:scale-95 transition-all flex items-center justify-center gap-2">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      تأكيد الدفع
                    </button>
                    <button onClick={() => handleRejectPayment(o._id)} className="py-3 px-4 bg-red-50 text-red-600 rounded-xl border border-red-100 hover:bg-red-100 active:scale-95 transition-all">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'withdrawals' && (
          <>
            {/* Desktop View */}
            <div className="hidden lg:block overflow-x-auto custom-scrollbar">
              <table className="w-full text-right text-sm min-w-[1200px]">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-5 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">المستخدم</th>
                    <th className="px-5 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">نوع السحب</th>
                    <th className="px-5 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">المبلغ</th>
                    <th className="px-5 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">بيانات التحويل</th>
                    <th className="px-5 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">التواصل</th>
                    <th className="px-5 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">الهوية</th>
                    <th className="px-5 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider text-center">الحالة</th>
                    <th className="px-5 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider text-left">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {withdrawals.map(w => {
                    const isBank = w.bankDetails?.receiptType === 'bank_account';
                    return (
                    <tr key={w._id} className="hover:bg-gray-50/50 transition-colors align-top">
                      <td className="px-5 py-5">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-black text-base shrink-0 shadow-lg shadow-blue-100">
                            {w.user?.name?.slice(0, 1) || 'U'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-gray-900 leading-tight truncate">{w.user?.name}</p>
                            <p className="text-[10px] font-bold text-gray-400 truncate">{w.user?.phone}</p>
                            <p className="text-[9px] font-bold text-gray-300 mt-0.5">#{w._id?.slice(-8).toUpperCase()}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-5">
                        <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-2xl font-black text-[10px] border-2 ${
                          isBank
                            ? 'bg-blue-50 text-blue-700 border-blue-100'
                            : 'bg-purple-50 text-purple-700 border-purple-100'
                        }`}>
                          <span className="text-base">{isBank ? '🏦' : '💸'}</span>
                          <div className="flex flex-col leading-tight">
                            <span className="uppercase tracking-wider">{isBank ? 'حساب بنكي' : 'حوالة صرافة'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-5">
                        <div className="flex flex-col gap-0.5">
                          <p className="font-black text-blue-700 text-base leading-tight">
                            {w.amount?.toLocaleString()} <span className="text-xs">{formatCurrency(w.currency)}</span>
                          </p>
                          <div className="flex items-center gap-1.5 pt-1">
                            <p className="text-[9px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md">
                              عمولة: {(w.feeAmount || 0)?.toLocaleString()} {w.currency}
                            </p>
                          </div>
                          {w.finalAmount > 0 && (
                            <p className="text-[10px] font-black text-emerald-600 mt-1">
                              الصافي: {w.finalAmount?.toLocaleString()} {w.currency}
                            </p>
                          )}
                          <p className="text-[9px] font-bold text-gray-300 mt-1">
                            {new Date(w.createdAt).toLocaleString('ar-EG')}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-5 max-w-[320px]">
                        {isBank ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center justify-center h-6 w-6 rounded-lg bg-blue-50 text-blue-600 shrink-0">🏦</span>
                              <div className="min-w-0">
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">اسم البنك</p>
                                <p className="text-[11px] font-black text-gray-900 leading-tight truncate">{w.bankDetails?.bankName || '-'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center justify-center h-6 w-6 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">👤</span>
                              <div className="min-w-0">
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">اسم صاحب الحساب</p>
                                <p className="text-[11px] font-black text-gray-900 leading-tight truncate">{w.bankDetails?.accountName || '-'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center justify-center h-6 w-6 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">🔢</span>
                              <div className="min-w-0">
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">رقم الحساب</p>
                                <p className="text-[11px] font-black text-emerald-700 leading-tight font-mono truncate">{w.bankDetails?.accountNumber || '-'}</p>
                              </div>
                            </div>
                            {w.bankDetails?.accountCurrency && (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center justify-center h-6 w-6 rounded-lg bg-amber-50 text-amber-600 shrink-0">💱</span>
                                <div className="min-w-0">
                                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">عملة الحساب المستلم</p>
                                  <p className="text-[11px] font-black text-amber-700 leading-tight">{formatCurrency(w.bankDetails.accountCurrency)}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center justify-center h-6 w-6 rounded-lg bg-purple-50 text-purple-600 shrink-0">💸</span>
                              <div className="min-w-0">
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">اسم الصرافة</p>
                                <p className="text-[11px] font-black text-purple-800 leading-tight truncate">{w.bankDetails?.bankName || '-'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center justify-center h-6 w-6 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">👤</span>
                              <div className="min-w-0">
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">اسم المستلم</p>
                                <p className="text-[11px] font-black text-gray-900 leading-tight truncate">{w.bankDetails?.accountName || '-'}</p>
                              </div>
                            </div>
                            {(w.bankDetails?.governorateId?.name || w._governorateName) && (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center justify-center h-6 w-6 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">📍</span>
                                <div className="min-w-0">
                                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">المحافظة / المدينة</p>
                                  <p className="text-[11px] font-black text-gray-800 leading-tight truncate">
                                    {w.bankDetails?.governorateId?.name || w._governorateName || w.bankDetails?.governorateId || '-'}
                                    <span className="mx-1 text-gray-300">·</span>
                                    {w.bankDetails?.cityId?.name || w._cityName || w.bankDetails?.cityId || '-'}
                                  </p>
                                </div>
                              </div>
                            )}
                            {w.bankDetails?.accountCurrency && (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center justify-center h-6 w-6 rounded-lg bg-amber-50 text-amber-600 shrink-0">💱</span>
                                <div className="min-w-0">
                                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">عملة الاستلام</p>
                                  <p className="text-[11px] font-black text-amber-700 leading-tight">{formatCurrency(w.bankDetails.accountCurrency)}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                            <a href={`tel:${w.phoneNumber}`} className="text-[11px] font-black text-blue-600 leading-tight hover:underline">{w.phoneNumber || "N/A"}</a>
                          </div>
                          <p className="text-[9px] font-bold text-gray-300 pl-5">اضغط للاتصال</p>
                        </div>
                      </td>
                      <td className="px-5 py-5">
                        {w.bankDetails?.identityImage ? (
                          <div className="space-y-1.5">
                            <a 
                              href={protectedFileUrl(w.bankDetails.identityImage, authToken)} 
                              rel="noreferrer" 
                              className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 hover:bg-blue-100 transition-colors"
                            >
                              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                              <span className="text-[10px] font-black uppercase tracking-tighter">عرض</span>
                            </a>
                            <p className="text-[8px] font-bold text-emerald-600 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                              مرفقة ✅
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 text-gray-400 rounded-xl border border-gray-100">
                              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                              <span className="text-[9px] font-black">غير مرفقة</span>
                            </div>
                            <p className="text-[8px] font-bold text-gray-300 px-1">مبلغ صغير</p>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-5 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black border-2 ${
                          w.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                          w.status === 'PROCESSING' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                          w.status === 'COMPLETED' ? 'bg-green-50 text-green-700 border-green-100' :
                          'bg-red-50 text-red-700 border-red-100'
                        }`}>
                          {w.status === 'PENDING' && <><span className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-pulse"></span>قيد الانتظار</>}
                          {w.status === 'PROCESSING' && <><span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></span>قيد المعالجة</>}
                          {w.status === 'COMPLETED' && <><span>✅</span>مكتمل</>}
                          {w.status === 'REJECTED' && <><span>❌</span>مرفوض</>}
                        </span>
                        {w.adminNotes && (
                          <p className="text-[9px] font-bold text-gray-400 mt-2 max-w-[140px] truncate mx-auto" title={w.adminNotes}>
                            ملاحظة: {w.adminNotes}
                          </p>
                        )}
                        {w.processedAt && (
                          <p className="text-[8px] font-bold text-gray-300 mt-1">
                            {new Date(w.processedAt).toLocaleDateString('ar-EG')}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-5 text-left">
                        <div className="flex justify-end gap-2">
                          {w.status === 'PENDING' && (
                            <button onClick={() => handleProcessWithdrawal(w._id)} className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95 flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                              بدء المعالجة
                            </button>
                          )}
                          {w.status === 'PROCESSING' && (
                            <button onClick={() => handleCompleteWithdrawal(w._id)} className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 active:scale-95 flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                              إكمال السحب
                            </button>
                          )}
                          {(w.status === 'PENDING' || w.status === 'PROCESSING') && (
                            <button onClick={() => handleRejectWithdrawal(w._id)} className="px-3 py-2.5 bg-red-50 text-red-600 border-2 border-red-100 rounded-xl text-[10px] font-black hover:bg-red-100 transition-all active:scale-95 flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                              رفض
                            </button>
                          )}
                          {w.status === 'COMPLETED' && w.transactionProof && (
                            <a 
                              href={protectedFileUrl(w.transactionProof, authToken)} 
                              rel="noreferrer"
                              onClick={(e) => { e.preventDefault(); openReceiptPreview(w.transactionProof); }}
                              className="px-4 py-2.5 bg-green-50 text-green-700 border-2 border-green-100 rounded-xl text-[10px] font-black hover:bg-green-100 transition-all active:scale-95 flex items-center gap-1.5"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                              إثبات التحويل
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                  {withdrawals.length === 0 && (
                    <tr><td colSpan={8} className="px-6 py-16 text-center text-gray-400 font-bold">
                      <div className="inline-flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-3xl border-2 border-gray-100">💳</div>
                        <p>لا توجد طلبات سحب حالياً</p>
                      </div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="lg:hidden p-4 space-y-4 bg-gray-50/50">
              {loading && (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={`ws-${i}`} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm animate-pulse space-y-4">
                      <div className="flex gap-4">
                        <div className="h-12 w-12 bg-gray-200 rounded-xl" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-2/3 bg-gray-200 rounded" />
                          <div className="h-3 w-1/2 bg-gray-200 rounded" />
                        </div>
                      </div>
                      <div className="h-16 bg-gray-200 rounded-xl" />
                      <div className="h-10 bg-gray-200 rounded-xl" />
                    </div>
                  ))}
                </div>
              )}
              {!loading && withdrawals.length === 0 && (
                <div className="bg-white p-8 text-center rounded-2xl border border-gray-100 shadow-sm">
                  <p className="text-sm text-gray-500 font-bold">لا توجد طلبات سحب حالياً.</p>
                </div>
              )}
              {!loading && withdrawals.map(w => {
                const isBank = w.bankDetails?.receiptType === 'bank_account';
                return (
                <div key={w._id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4 transition-all active:scale-[0.99] overflow-hidden">
                  {/* Header: User + Status + Type Badge */}
                  <div className="flex items-start gap-3">
                    <div className="h-14 w-14 flex-shrink-0 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-blue-100">
                      {w.user?.name?.slice(0, 1) || 'U'}
                    </div>
                    <div className="min-w-0 flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-black text-gray-900 text-[15px] truncate leading-tight">{w.user?.name || "مستخدم"}</p>
                          <p className="text-[11px] font-bold text-gray-500 mt-0.5 truncate">{w.user?.phone} · #{w._id?.slice(-6).toUpperCase()}</p>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-2xl text-[10px] font-black border-2 shrink-0 ${
                          w.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                          w.status === 'PROCESSING' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                          w.status === 'COMPLETED' ? 'bg-green-50 text-green-700 border-green-100' :
                          'bg-red-50 text-red-700 border-red-100'
                        }`}>
                          {w.status === 'PENDING' && <><span className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-pulse"></span>قيد الانتظار</>}
                          {w.status === 'PROCESSING' && <><span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></span>قيد المعالجة</>}
                          {w.status === 'COMPLETED' && <>✅ مكتمل</>}
                          {w.status === 'REJECTED' && <>❌ مرفوض</>}
                        </span>
                      </div>
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black mt-2 w-fit ${
                        isBank
                          ? 'bg-blue-50 text-blue-700 border-2 border-blue-100'
                          : 'bg-purple-50 text-purple-700 border-2 border-purple-100'
                      }`}>
                        <span className="text-sm">{isBank ? '🏦' : '💸'}</span>
                        <span className="uppercase tracking-wider">{isBank ? 'سحب لحساب بنكي' : 'سحب عبر حوالة صرافة'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Amount Card */}
                  <div className="grid grid-cols-3 gap-2 text-[11px] font-black">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-100 rounded-2xl p-3 flex flex-col">
                      <p className="text-[9px] uppercase tracking-wider text-blue-400 font-black mb-1">المبلغ</p>
                      <p className="text-blue-700 leading-tight">{w.amount?.toLocaleString()}</p>
                      <p className="text-[9px] font-bold text-blue-500 mt-0.5">{formatCurrency(w.currency)}</p>
                    </div>
                    <div className="bg-gray-50 border-2 border-gray-100 rounded-2xl p-3 flex flex-col">
                      <p className="text-[9px] uppercase tracking-wider text-gray-400 font-black mb-1">العمولة</p>
                      <p className="text-gray-700 leading-tight">{(w.feeAmount || 0)?.toLocaleString()}</p>
                      <p className="text-[9px] font-bold text-gray-400 mt-0.5">{w.currency}</p>
                    </div>
                    <div className={`${w.finalAmount > 0 ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100' : 'bg-gray-50 border-gray-100'} border-2 rounded-2xl p-3 flex flex-col`}>
                      <p className={`text-[9px] uppercase tracking-wider ${w.finalAmount > 0 ? 'text-emerald-400' : 'text-gray-400'} font-black mb-1`}>الصافي</p>
                      <p className={`${w.finalAmount > 0 ? 'text-emerald-700' : 'text-gray-600'} leading-tight`}>
                        {(w.finalAmount > 0 ? w.finalAmount : w.amount - (w.feeAmount || 0))?.toLocaleString()}
                      </p>
                      <p className={`text-[9px] font-bold ${w.finalAmount > 0 ? 'text-emerald-500' : 'text-gray-400'} mt-0.5`}>{w.currency}</p>
                    </div>
                  </div>

                  {/* Transfer Details */}
                  <div className={`rounded-2xl p-3 space-y-2 ${isBank ? 'bg-blue-50/50 border-2 border-blue-100' : 'bg-purple-50/50 border-2 border-purple-100'}`}>
                    <div className={`flex items-center justify-between px-1 pb-1 mb-1 border-b ${isBank ? 'border-blue-100' : 'border-purple-100'}`}>
                      <p className={`text-[10px] font-black uppercase tracking-wider ${isBank ? 'text-blue-500' : 'text-purple-500'}`}>
                        {isBank ? '🏦 بيانات الحساب البنكي' : '💸 بيانات الحوالة الصرافية'}
                      </p>
                      <p className="text-[9px] font-bold text-gray-400">{new Date(w.createdAt).toLocaleDateString('ar-EG')}</p>
                    </div>
                    {isBank ? (
                      <>
                        <div className="flex items-center gap-2.5 bg-white rounded-xl p-2.5 border border-blue-50">
                          <div className="h-8 w-8 rounded-lg bg-blue-500 text-white flex items-center justify-center shrink-0 text-sm">🏦</div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[9px] font-black text-blue-400 uppercase tracking-wider">اسم البنك</p>
                            <p className="text-[12px] font-black text-gray-900 leading-tight truncate">{w.bankDetails?.bankName || '-'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 bg-white rounded-xl p-2.5 border border-blue-50">
                          <div className="h-8 w-8 rounded-lg bg-indigo-500 text-white flex items-center justify-center shrink-0 text-sm">👤</div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-wider">اسم صاحب الحساب</p>
                            <p className="text-[12px] font-black text-gray-900 leading-tight truncate">{w.bankDetails?.accountName || '-'}</p>
                          </div>
                        </div>
                        {w.bankDetails?.accountNumber && (
                          <div className="flex items-center gap-2.5 bg-white rounded-xl p-2.5 border border-emerald-50">
                            <div className="h-8 w-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0 text-sm">🔢</div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[9px] font-black text-emerald-400 uppercase tracking-wider">رقم الحساب</p>
                              <p className="text-[12px] font-black text-emerald-700 leading-tight font-mono truncate" dir="ltr">{w.bankDetails.accountNumber}</p>
                            </div>
                          </div>
                        )}
                        {w.bankDetails?.accountCurrency && (
                          <div className="flex items-center gap-2.5 bg-white rounded-xl p-2.5 border border-amber-50">
                            <div className="h-8 w-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 text-sm">💱</div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[9px] font-black text-amber-500 uppercase tracking-wider">عملة الحساب المستلم</p>
                              <p className="text-[12px] font-black text-amber-800 leading-tight">{formatCurrency(w.bankDetails.accountCurrency)}</p>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2.5 bg-white rounded-xl p-2.5 border border-purple-50">
                          <div className="h-8 w-8 rounded-lg bg-purple-500 text-white flex items-center justify-center shrink-0 text-sm">💸</div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[9px] font-black text-purple-400 uppercase tracking-wider">اسم الصرافة</p>
                            <p className="text-[12px] font-black text-purple-800 leading-tight truncate">{w.bankDetails?.bankName || '-'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 bg-white rounded-xl p-2.5 border border-indigo-50">
                          <div className="h-8 w-8 rounded-lg bg-indigo-500 text-white flex items-center justify-center shrink-0 text-sm">👤</div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-wider">اسم المستلم</p>
                            <p className="text-[12px] font-black text-gray-900 leading-tight truncate">{w.bankDetails?.accountName || '-'}</p>
                          </div>
                        </div>
                        {(w.bankDetails?.governorateId?.name || w._governorateName || w.bankDetails?.governorateId) && (
                          <div className="flex items-center gap-2.5 bg-white rounded-xl p-2.5 border border-emerald-50">
                            <div className="h-8 w-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0 text-sm">📍</div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[9px] font-black text-emerald-400 uppercase tracking-wider">المحافظة · المدينة</p>
                              <p className="text-[12px] font-black text-gray-800 leading-tight truncate">
                                {w.bankDetails?.governorateId?.name || w._governorateName || w.bankDetails?.governorateId || '-'}
                                <span className="mx-1 text-gray-300">·</span>
                                {w.bankDetails?.cityId?.name || w._cityName || w.bankDetails?.cityId || '-'}
                              </p>
                            </div>
                          </div>
                        )}
                        {w.bankDetails?.accountCurrency && (
                          <div className="flex items-center gap-2.5 bg-white rounded-xl p-2.5 border border-amber-50">
                            <div className="h-8 w-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 text-sm">💱</div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[9px] font-black text-amber-500 uppercase tracking-wider">عملة الاستلام</p>
                              <p className="text-[12px] font-black text-amber-800 leading-tight">{formatCurrency(w.bankDetails.accountCurrency)}</p>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Contact & Identity Row */}
                  <div className="grid grid-cols-2 gap-2">
                    <a href={`tel:${w.phoneNumber}`} className="flex items-center gap-2 bg-gradient-to-br from-blue-50 to-sky-50 border-2 border-blue-100 rounded-2xl p-3 hover:from-blue-100 transition-all">
                      <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-100">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] uppercase tracking-wider font-black text-blue-400">اتصال</p>
                        <p className="text-[11px] font-black text-blue-700 truncate leading-tight">{w.phoneNumber || '-'}</p>
                      </div>
                    </a>

                    {w.bankDetails?.identityImage ? (
                      <a href={protectedFileUrl(w.bankDetails.identityImage, authToken)} rel="noreferrer" onClick={(e) => { e.preventDefault(); openReceiptPreview(w.bankDetails.identityImage); }} className="flex items-center gap-2 bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-100 rounded-2xl p-3 hover:from-emerald-100 transition-all">
                        <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-100">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] uppercase tracking-wider font-black text-emerald-500">الهوية</p>
                          <p className="text-[11px] font-black text-emerald-700 truncate leading-tight">مرفقة ✅</p>
                        </div>
                      </a>
                    ) : (
                      <div className="flex items-center gap-2 bg-gray-50 border-2 border-gray-100 rounded-2xl p-3">
                        <div className="h-9 w-9 rounded-xl bg-gray-200 text-gray-400 flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] uppercase tracking-wider font-black text-gray-400">الهوية</p>
                          <p className="text-[11px] font-black text-gray-500 truncate leading-tight">غير مرفقة</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Admin Notes */}
                  {w.adminNotes && (
                    <div className="bg-amber-50 border-2 border-amber-100 rounded-2xl p-3">
                      <p className="text-[9px] font-black uppercase tracking-wider text-amber-500 mb-1">📝 ملاحظات الإدارة</p>
                      <p className="text-[12px] font-bold text-amber-900 leading-snug">{w.adminNotes}</p>
                    </div>
                  )}

                  {/* Transaction Proof (when COMPLETED) */}
                  {w.status === 'COMPLETED' && w.transactionProof && (
                    <a href={protectedFileUrl(w.transactionProof, authToken)} rel="noreferrer" onClick={(e) => { e.preventDefault(); openReceiptPreview(w.transactionProof); }} className="flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 rounded-2xl border-2 border-green-100 text-[11px] font-black hover:from-green-100 transition-all">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      عرض إثبات التحويل البنكي
                    </a>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    {w.status === 'PENDING' && (
                      <button onClick={() => handleProcessWithdrawal(w._id)} className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl text-[12px] font-black shadow-lg shadow-blue-100 active:scale-95 transition-all flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        بدء المعالجة
                      </button>
                    )}
                    {w.status === 'PROCESSING' && (
                      <button onClick={() => handleCompleteWithdrawal(w._id)} className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl text-[12px] font-black shadow-lg shadow-emerald-100 active:scale-95 transition-all flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        إكمال السحب
                      </button>
                    )}
                    {(w.status === 'PENDING' || w.status === 'PROCESSING') && (
                      <button onClick={() => handleRejectWithdrawal(w._id)} className="py-3 px-5 bg-red-50 text-red-600 rounded-2xl border-2 border-red-100 hover:bg-red-100 active:scale-95 transition-all">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                    {w.status === 'COMPLETED' && (
                      <div className="flex-1 text-center py-3 text-green-600 text-[12px] font-black bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border-2 border-green-100 flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        تم إكمال السحب بنجاح
                      </div>
                    )}
                    {w.status === 'REJECTED' && (
                      <div className="flex-1 text-center py-3 text-red-600 text-[12px] font-black bg-gradient-to-r from-red-50 to-rose-50 rounded-2xl border-2 border-red-100 flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                        تم رفض السحب
                      </div>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </>
        )}

        {previewReceipt && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-3 sm:p-6"
            onClick={closeReceiptPreview}
            onMouseMove={handlePreviewMouseMove}
            onMouseUp={handlePreviewMouseUp}
            onMouseLeave={handlePreviewMouseUp}
          >
            <div
              className="relative w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-2xl backdrop-blur-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-black/30 px-4 py-3 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeReceiptPreview}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                    title="إغلاق"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewScale(prev => Math.min(prev + 0.5, 4))}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-30"
                    disabled={previewScale >= 4}
                    title="تكبير"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewScale(prev => {
                        const next = Math.max(prev - 0.5, 1);
                        if (next === 1) setPreviewOffset({ x: 0, y: 0 });
                        return next;
                      });
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-30"
                    disabled={previewScale <= 1}
                    title="تصغير"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" /></svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPreviewScale(1); setPreviewOffset({ x: 0, y: 0 }); }}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                    title="إعادة ضبط"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  </button>
                </div>
              </div>

              <div className="flex h-[92vh] max-h-[92vh] items-center justify-center overflow-hidden bg-black/40 p-6 pt-16">
                <div
                  className={`relative flex max-h-full max-w-full items-center justify-center select-none transition-transform duration-200 ease-out ${isDraggingPreview ? 'cursor-grabbing' : 'cursor-grab'}`}
                  onMouseDown={handlePreviewMouseDown}
                  onMouseUp={handlePreviewMouseUp}
                  style={{
                    transform: `translate(${previewOffset.x}px, ${previewOffset.y}px) scale(${previewScale})`,
                  }}
                >
                  <img
                    src={previewReceipt}
                    alt="معاينة السند"
                    className="max-h-[78vh] max-w-full rounded-2xl object-contain shadow-2xl"
                    draggable={false}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'disputes' && (
          <>
            {/* Desktop View */}
            <div className="hidden lg:block overflow-x-auto custom-scrollbar">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">الطلب</th>
                    <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">المشتكي</th>
                    <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">السبب</th>
                    <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider text-center">الحالة</th>
                    <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider text-left">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {disputes.map(d => (
                    <tr key={d._id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <Link to={`/orders/${d.order?._id}`} className="font-black text-blue-600 hover:underline">#{d.order?._id?.slice(-6)}</Link>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-black text-gray-900">{d.initiator?.name}</p>
                        <p className="text-[10px] font-bold text-gray-400">{d.initiator?.phone}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-gray-700 max-w-[200px] truncate" title={d.reason}>{d.reason}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
                          d.status === 'OPEN' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-gray-50 text-gray-700 border-gray-100'
                        }`}>{d.status === 'OPEN' ? 'نزاع مفتوح' : 'تم الحل'}</span>
                      </td>
                      <td className="px-6 py-4 text-left">
                        <div className="flex justify-end gap-2">
                          {d.status === 'OPEN' && (
                            <>
                              {!d.chatId ? (
                                <button onClick={() => handleOpenDisputeChat(d._id)} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95">فتح محادثة</button>
                              ) : !d.isChatClosed ? (
                                <button onClick={() => handleCloseDisputeChat(d._id)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-[10px] font-black hover:bg-gray-200 transition-all active:scale-95">إغلاق المحادثة</button>
                              ) : null}
                              <button onClick={() => handleResolveDispute(d._id, 'REFUND_TO_BUYER')} className="px-4 py-2 bg-amber-500 text-white rounded-xl text-[10px] font-black hover:bg-amber-600 transition-all shadow-lg shadow-amber-100 active:scale-95">استرجاع للمشتري</button>
                              <button onClick={() => handleResolveDispute(d._id, 'RELEASE_TO_SELLER')} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 active:scale-95">تحويل للبائع</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {disputes.length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-bold">لا توجد نزاعات حالياً</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="lg:hidden p-4 space-y-4 bg-gray-50/50">
              {loading && (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={`ds-${i}`} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm animate-pulse space-y-4">
                      <div className="flex gap-4">
                        <div className="h-12 w-12 bg-gray-200 rounded-xl" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-2/3 bg-gray-200 rounded" />
                          <div className="h-3 w-1/2 bg-gray-200 rounded" />
                        </div>
                      </div>
                      <div className="h-16 bg-gray-200 rounded-xl" />
                      <div className="h-10 bg-gray-200 rounded-xl" />
                    </div>
                  ))}
                </div>
              )}
              {!loading && disputes.length === 0 && (
                <div className="bg-white p-8 text-center rounded-2xl border border-gray-100 shadow-sm">
                  <p className="text-sm text-gray-500 font-bold">لا توجد نزاعات حالياً.</p>
                </div>
              )}
              {!loading && disputes.map(d => (
                <div key={d._id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4 transition-all active:scale-[0.99]">
                  <div className="flex gap-4">
                    <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-red-50 border border-red-100 flex items-center justify-center">
                      <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <div className="min-w-0 flex-1 flex flex-col justify-center">
                      <div className="flex items-center justify-between">
                        <Link to={`/orders/${d.order?._id}`} className="font-black text-gray-900 text-sm truncate">الطلب #{d.order?._id?.slice(-6)}</Link>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black border ${
                          d.status === 'OPEN' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-gray-50 text-gray-700 border-gray-100'
                        }`}>
                          {d.status === 'OPEN' && <><span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse"></span> نزاع مفتوح</>}
                          {d.status !== 'OPEN' && <>تم الحل</>}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{d.initiator?.name}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
                    <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <p className="text-gray-400 mb-0.5">نوع النزاع</p>
                      <p className="text-gray-700 truncate">{d.reason || "-"}</p>
                    </div>
                    <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <p className="text-gray-400 mb-0.5">المشتكي</p>
                      <p className="text-gray-700 truncate">{d.initiator?.name || "-"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
                    {d.status === 'OPEN' && (
                      <>
                        {!d.chatId ? (
                          <button onClick={() => handleOpenDisputeChat(d._id)} className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-xs font-black shadow-sm shadow-blue-100 active:scale-95 transition-all flex items-center justify-center gap-2">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            فتح محادثة
                          </button>
                        ) : !d.isChatClosed ? (
                          <button onClick={() => handleCloseDisputeChat(d._id)} className="flex-1 py-3 bg-gray-50 text-gray-600 rounded-xl text-xs font-black border border-gray-100 active:scale-95 transition-all flex items-center justify-center gap-2">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                            إغلاق المحادثة
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>
                  {d.status === 'OPEN' && (
                    <div className="flex gap-2">
                      <button onClick={() => handleResolveDispute(d._id, 'REFUND_TO_BUYER')} className="flex-1 py-3 bg-amber-50 text-amber-600 rounded-xl text-xs font-black border border-amber-100 hover:bg-amber-100 active:scale-95 transition-all flex items-center justify-center gap-2">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                        إرجاع للمشتري
                      </button>
                      <button onClick={() => handleResolveDispute(d._id, 'RELEASE_TO_SELLER')} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black shadow-sm shadow-emerald-100 active:scale-95 transition-all flex items-center justify-center gap-2">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        تحويل للبائع
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
