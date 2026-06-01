import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";
import { Link } from "react-router-dom";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import { uploadsUrl } from "../lib/uploads.js";

export default function AdminEscrowDashboard() {
  const api = useApi();
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("orders");

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
                              <a 
                                key={idx}
                                href={uploadsUrl(p.receiptImage)} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="px-2 py-1 bg-white border border-blue-100 text-blue-600 text-[9px] font-black rounded-md shadow-sm hover:bg-blue-50 transition-all"
                              >
                                سند {idx + 1}
                              </a>
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
                            <a 
                              href={uploadsUrl(p.receiptImage)} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-[10px] font-black shadow-md shadow-blue-100 active:scale-95"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              عرض السند
                            </a>
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
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">المستخدم</th>
                    <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">المبلغ</th>
                    <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">التواصل</th>
                    <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">بيانات البنك</th>
                    <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">الهوية</th>
                    <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider text-center">الحالة</th>
                    <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider text-left">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {withdrawals.map(w => (
                    <tr key={w._id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-black text-gray-900">{w.user?.name}</p>
                        <p className="text-[10px] font-bold text-gray-400">{w.user?.phone}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <p className="font-black text-blue-600">{w.amount?.toLocaleString()} {formatCurrency(w.currency)}</p>
                          <div className="flex flex-col text-[9px] font-bold text-gray-400 opacity-60">
                            {w.status === 'COMPLETED' ? (
                              <>
                                <span className="text-emerald-600">الصافي المكتمل: {w.finalAmount?.toLocaleString()} {formatCurrency(w.currency)}</span>
                              </>
                            ) : (
                              <span className="text-blue-500">المبلغ كامل (الصافي مسبقاً)</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-black text-[11px] text-blue-600 leading-tight">{w.phoneNumber || "N/A"}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-black text-[11px] text-gray-900 leading-tight">{w.bankDetails?.bankName}</p>
                        <p className="text-[10px] font-bold text-gray-400">{w.bankDetails?.accountName}</p>
                      </td>
                      <td className="px-6 py-4">
                        {w.bankDetails?.identityImage ? (
                          <a 
                            href={uploadsUrl(w.bankDetails.identityImage)} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            <span className="text-[10px] font-black underline uppercase tracking-tighter">عرض الهوية</span>
                          </a>
                        ) : (
                          <span className="text-[10px] font-bold text-gray-300">غير متوفر</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
                          w.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                          w.status === 'PROCESSING' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                          w.status === 'COMPLETED' ? 'bg-green-50 text-green-700 border-green-100' :
                          'bg-red-50 text-red-700 border-red-100'
                        }`}>{w.status}</span>
                      </td>
                      <td className="px-6 py-4 text-left">
                        <div className="flex justify-end gap-2">
                          {w.status === 'PENDING' && (
                            <button onClick={() => handleProcessWithdrawal(w._id)} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95">بدء المعالجة</button>
                          )}
                          {w.status === 'PROCESSING' && (
                            <button onClick={() => handleCompleteWithdrawal(w._id)} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 active:scale-95">إكمال السحب</button>
                          )}
                          {(w.status === 'PENDING' || w.status === 'PROCESSING') && (
                            <button onClick={() => handleRejectWithdrawal(w._id)} className="px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl text-[10px] font-black hover:bg-red-100 transition-all active:scale-95">رفض</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {withdrawals.length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-bold">لا توجد طلبات سحب حالياً</td></tr>
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
              {!loading && withdrawals.map(w => (
                <div key={w._id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4 transition-all active:scale-[0.99]">
                  <div className="flex gap-4">
                    <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div className="min-w-0 flex-1 flex flex-col justify-center">
                      <div className="flex items-center justify-between">
                        <p className="font-black text-gray-900 text-sm truncate">{w.user?.name || "مستخدم"}</p>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black border ${
                          w.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                          w.status === 'PROCESSING' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                          w.status === 'COMPLETED' ? 'bg-green-50 text-green-700 border-green-100' :
                          'bg-red-50 text-red-700 border-red-100'
                        }`}>
                          {w.status === 'PENDING' && <><span className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-pulse"></span> قيد الانتظار</>}
                          {w.status === 'PROCESSING' && <><span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></span> قيد المعالجة</>}
                          {w.status === 'COMPLETED' && <>مكتمل</>}
                          {w.status === 'REJECTED' && <>مرفوض</>}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{w.user?.phone}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
                    <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <p className="text-gray-400 mb-0.5">هاتف التواصل</p>
                      <p className="text-blue-600 truncate">{w.phoneNumber || "N/A"}</p>
                    </div>
                    <div className="bg-blue-50 p-2.5 rounded-xl border border-blue-100">
                      <p className="text-gray-400 mb-0.5">المبلغ المطلوب</p>
                      <p className="text-blue-600 truncate">{w.amount?.toLocaleString()} {formatCurrency(w.currency)}</p>
                    </div>
                    <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 sm:col-span-2">
                      <p className="text-gray-400 mb-0.5">البنك</p>
                      <p className="text-gray-700 truncate">{w.bankDetails?.bankName || "-"}</p>
                    </div>
                  </div>

                  {/* Identity Image for Mobile */}
                  {w.bankDetails?.identityImage && (
                    <div className="pt-1">
                      <a 
                        href={uploadsUrl(w.bankDetails.identityImage)} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="flex items-center justify-center gap-2 w-full py-2.5 bg-gray-50 text-blue-600 rounded-xl border border-blue-100 text-[10px] font-black hover:bg-blue-50 transition-all active:scale-95"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        عرض صورة الهوية المرفقة
                      </a>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
                    {w.status === 'PENDING' && (
                      <button onClick={() => handleProcessWithdrawal(w._id)} className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-xs font-black shadow-sm shadow-blue-100 active:scale-95 transition-all flex items-center justify-center gap-2">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        بدء المعالجة
                      </button>
                    )}
                    {w.status === 'PROCESSING' && (
                      <button onClick={() => handleCompleteWithdrawal(w._id)} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black shadow-sm shadow-emerald-100 active:scale-95 transition-all flex items-center justify-center gap-2">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        إكمال السحب
                      </button>
                    )}
                    {(w.status === 'PENDING' || w.status === 'PROCESSING') && (
                      <button onClick={() => handleRejectWithdrawal(w._id)} className="py-3 px-4 bg-red-50 text-red-600 rounded-xl border border-red-100 hover:bg-red-100 active:scale-95 transition-all">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                    {w.status === 'COMPLETED' && (
                      <div className="flex-1 text-center py-3 text-green-600 text-[10px] font-black bg-green-50 rounded-xl border border-green-100">
                        تم إكمال السحب بنجاح
                      </div>
                    )}
                    {w.status === 'REJECTED' && (
                      <div className="flex-1 text-center py-3 text-red-600 text-[10px] font-black bg-red-50 rounded-xl border border-red-100">
                        تم رفض السحب
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
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
