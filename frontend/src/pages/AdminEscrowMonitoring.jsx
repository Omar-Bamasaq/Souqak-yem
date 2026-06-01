import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";
import { Link } from "react-router-dom";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import { uploadsUrl } from "../lib/uploads.js";

export default function AdminEscrowMonitoring() {
  const api = useApi();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const statusMap = {
    PENDING_SELLER_APPROVAL: { label: "بانتظار موافقة البائع", color: "bg-amber-100 text-amber-700" },
    AWAITING_PAYMENT: { label: "بانتظار الدفع", color: "bg-blue-100 text-blue-700" },
    AWAITING_PAYMENT_CONFIRMATION: { label: "بانتظار تأكيد الإدارة", color: "bg-purple-100 text-purple-700" },
    PAID_CONFIRMED: { label: "تم تأكيد الدفع", color: "bg-emerald-100 text-emerald-700" },
    SHIPPED: { label: "تم الشحن", color: "bg-indigo-100 text-indigo-700" },
    DELIVERED: { label: "تم الاستلام", color: "bg-green-100 text-green-700" },
    COMPLETED: { label: "مكتمل نهائياً", color: "bg-gray-100 text-gray-700" },
    DISPUTED: { label: "نزاع مفتوح", color: "bg-red-100 text-red-700" },
    CANCELLED: { label: "ملغي", color: "bg-red-50 text-red-400" }
  };

  const loadOrders = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 20,
        status: statusFilter === "all" ? undefined : statusFilter,
        q: searchTerm || undefined
      };
      const res = await api.get("/admin/escrow/orders", { params });
      setOrders(res.data.orders || []);
      setPages(res.data.pages || 1);
    } catch (err) {
      console.error("Error loading escrow orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [page, statusFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadOrders();
  };

  const formatCurrency = (currency) => {
    const map = {
      "YER": "ريال (صنعاء)",
      "YER_ADEN": "ريال (عدن)",
      "SAR": "ريال سعودي",
      "USD": "دولار أمريكي"
    };
    return map[currency] || currency;
  };

  return (
    <div className="space-y-8 pb-20 px-4 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">مراقبة عمليات الشراء الآمن</h1>
          <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">تتبع كافة تفاصيل العمليات الحالية والسابقة</p>
        </div>
        <div className="flex items-center gap-2">
           <button onClick={loadOrders} className="p-3 rounded-2xl bg-white border border-gray-100 shadow-sm hover:bg-gray-50 transition-all active:scale-95 group">
            <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <input 
            type="text" 
            placeholder="البحث برقم الطلب، اسم البائع أو المشتري..." 
            className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="submit" className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs hover:bg-blue-700 transition-all">بحث</button>
        </form>
        <select 
          className="bg-gray-50 border-none rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none min-w-[200px]"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="all">جميع الحالات</option>
          {Object.entries(statusMap).map(([val, info]) => (
            <option key={val} value={val}>{info.label}</option>
          ))}
        </select>
      </div>

      {/* Orders List */}
      <div className="space-y-3 sm:space-y-4">
        {loading ? (
          <div className="py-20 flex justify-center"><LoadingSpinner size="lg" /></div>
        ) : orders.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-[2rem] border border-dashed border-gray-200">
            <p className="text-gray-400 font-bold">لا توجد عمليات شراء آمن مطابقة للبحث</p>
          </div>
        ) : (
          orders.map(order => (
            <div key={order._id} className="bg-white rounded-2xl sm:rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden hover:border-blue-100 transition-all group">
              <div className="p-4 sm:p-6 lg:p-8">
                {/* Desktop Grid Layout / Mobile Flex Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-4 items-center">
                  
                  {/* 1. Order Header (2 Cols on Desktop) */}
                  <div className="lg:col-span-2 flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center font-black text-lg shadow-inner shrink-0">
                      📦
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-gray-900 dark:text-white truncate">طلب #{order._id.slice(-6).toUpperCase()}</h3>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${statusMap[order.status]?.color || 'bg-gray-100 text-gray-400'}`}>
                        {statusMap[order.status]?.label || order.status}
                      </span>
                    </div>
                  </div>

                  {/* 2. Parties (5 Cols on Desktop) */}
                  <div className="lg:col-span-5 flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 p-3 bg-blue-50/30 dark:bg-blue-900/5 rounded-xl border border-blue-100/30 dark:border-blue-900/20 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                          {order.buyer?.name?.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <span className="text-[8px] font-black text-blue-400 uppercase block leading-none mb-1">المشتري</span>
                          <p className="text-xs font-black text-gray-900 dark:text-white truncate">{order.buyer?.name}</p>
                          <p className="text-[9px] text-gray-400 dark:text-slate-500 font-bold truncate" title={order.buyer?.email}>{order.buyer?.email}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 p-3 bg-emerald-50/30 dark:bg-emerald-900/5 rounded-xl border border-emerald-100/30 dark:border-emerald-900/20 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                          {order.seller?.name?.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <span className="text-[8px] font-black text-emerald-400 uppercase block leading-none mb-1">البائع</span>
                          <p className="text-xs font-black text-gray-900 dark:text-white truncate">{order.seller?.name}</p>
                          <p className="text-[9px] text-gray-400 dark:text-slate-500 font-bold truncate" title={order.seller?.email}>{order.seller?.email}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. Financials (3 Cols on Desktop) */}
                  <div className="lg:col-span-3 flex lg:flex-col items-center lg:items-start justify-between lg:justify-center px-2 py-2 lg:py-0 border-y lg:border-y-0 lg:border-r border-gray-100 dark:border-slate-800">
                    <div className="text-right">
                      <span className="text-[8px] font-black text-gray-400 uppercase block leading-none mb-1">الإجمالي المدفوع</span>
                      <p className="text-lg font-black text-blue-600 dark:text-blue-400 leading-none">
                        {order.totalAmount?.toLocaleString()} <span className="text-[10px]">{formatCurrency(order.currency)}</span>
                      </p>
                    </div>
                    <div className="text-right hidden sm:block lg:mt-2">
                      <p className="text-[9px] font-bold text-gray-400">بتاريخ: {new Date(order.createdAt).toLocaleDateString("ar-EG")}</p>
                    </div>
                  </div>

                  {/* 4. Actions (2 Cols on Desktop) */}
                  <div className="lg:col-span-2 flex flex-row lg:flex-col gap-2">
                    <Link to={`/admin/escrow?orderId=${order._id}`} className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl font-black text-[10px] text-center hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center">
                      إدارة الطلب
                    </Link>
                    <button 
                      onClick={() => document.getElementById(`details-${order._id}`).classList.toggle('hidden')}
                      className="flex-1 py-3 px-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 rounded-xl font-black text-[10px] hover:bg-gray-50 dark:hover:bg-slate-800 transition-all"
                    >
                      عرض التفاصيل
                    </button>
                  </div>
                </div>

                {/* Collapsible Details View */}
                <div id={`details-${order._id}`} className="hidden mt-8 pt-8 border-t border-gray-100 space-y-8 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Payment Evidence */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                          <span className="w-1.5 h-4 bg-purple-500 rounded-full"></span>
                          بيانات الدفع (من المشتري)
                        </h4>
                        {order.paymentDetails?.bankName && (
                          <span className="px-3 py-1 bg-purple-50 text-purple-600 rounded-lg text-[10px] font-black border border-purple-100">
                            🏦 {order.paymentDetails.bankName}
                          </span>
                        )}
                      </div>
                      {order.paymentDetails?.payments?.length > 0 ? (
                        <div className="grid gap-3">
                          {order.paymentDetails.payments.map((p, idx) => (
                            <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                              <div>
                                <p className="text-[10px] text-gray-400 font-bold mb-1">رقم العملية {idx + 1}</p>
                                <p className="text-xs font-black text-gray-900">{p.transactionNumber}</p>
                              </div>
                              <a href={uploadsUrl(p.receiptImage)} target="_blank" rel="noreferrer" className="px-4 py-2 bg-white text-blue-600 text-[10px] font-black rounded-lg border border-blue-100 shadow-sm hover:bg-blue-50 transition-all">معاينة السند</a>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs font-bold text-gray-300 italic">لم يتم رفع بيانات دفع بعد</p>
                      )}
                    </div>

                    {/* Shipping Evidence */}
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
                        بيانات الشحن (من البائع)
                      </h4>
                      {order.shippingDetails?.company ? (
                        <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100 space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] text-gray-400 font-bold mb-1">الشركة/السائق</p>
                              <p className="text-xs font-black text-gray-900">{order.shippingDetails.company}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-400 font-bold mb-1">رقم التتبع</p>
                              <p className="text-xs font-black text-gray-900">{order.shippingDetails.trackingNumber}</p>
                            </div>
                          </div>
                          {order.shippingDetails.shippingReceipt && (
                            <div className="pt-4 border-t border-gray-200">
                               <a href={uploadsUrl(order.shippingDetails.shippingReceipt)} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-indigo-100 hover:shadow-md transition-all group">
                                <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">📄</div>
                                <div>
                                  <p className="text-xs font-black text-gray-900">سند الشحن المرفق</p>
                                  <p className="text-[9px] text-gray-400 font-bold">اضغط للمعاينة</p>
                                </div>
                              </a>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs font-bold text-gray-300 italic">لم يتم الشحن بعد</p>
                      )}
                    </div>
                  </div>

                  {/* Notes & Internal Logs */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-1.5 h-4 bg-amber-500 rounded-full"></span>
                      ملاحظات وتاريخ العملية
                    </h4>
                    <div className="p-6 bg-amber-50/30 rounded-3xl border border-amber-100/50">
                       <p className="text-xs font-bold text-gray-600 leading-relaxed whitespace-pre-line">
                         {order.notes || "لا توجد ملاحظات إضافية على هذا الطلب."}
                       </p>
                       {order.verifiedAt && (
                         <div className="mt-4 pt-4 border-t border-amber-100 flex items-center gap-2 text-[10px] font-bold text-amber-600">
                           <span>🛡️ تم تأكيد الدفع بواسطة الإدارة في: {new Date(order.verifiedAt).toLocaleString("ar-EG")}</span>
                         </div>
                       )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-10">
          <button 
            disabled={page === 1} 
            onClick={() => setPage(p => p - 1)}
            className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center disabled:opacity-50 hover:bg-gray-50 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="text-sm font-black text-gray-900">{page} / {pages}</span>
          <button 
            disabled={page === pages} 
            onClick={() => setPage(p => p + 1)}
            className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center disabled:opacity-50 hover:bg-gray-50 transition-all rotate-180"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}