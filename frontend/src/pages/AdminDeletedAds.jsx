import React, { useState, useEffect } from "react";
import { useApi } from "../api/axios.js";
import AdminDataTable from "../components/AdminDataTable.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export default function AdminDeletedAds() {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const api = useApi();

  useEffect(() => {
    fetchAds(1);
  }, []);

  const fetchAds = async (page) => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/deleted-ads?page=${page}`);
      setAds(res.data.items || []);
      setPagination({ 
        page: res.data.page, 
        pages: res.data.pages, 
        total: res.data.total 
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id) => {
    if (!window.confirm("هل أنت متأكد من استعادة هذا الإعلان؟")) return;
    try {
      await api.post(`/admin/restore/Ad/${id}`);
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تمت استعادة الإعلان بنجاح", type: "success" } }));
      fetchAds(pagination.page);
    } catch (err) {
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "فشل استعادة الإعلان", type: "error" } }));
    }
  };

  const headers = ["الصورة", "العنوان", "البائع", "تاريخ الحذف", "العمولة", "بلاغات", "إجراءات"];

  const tableData = ads.map((ad) => [
    <img
      src={ad.images && ad.images[0] ? `${import.meta.env.VITE_API_URL}/uploads/${ad.images[0]}` : "/placeholder.png"}
      alt=""
      className="h-10 w-10 md:h-12 md:w-12 rounded-lg object-cover bg-gray-100"
    />,
    <div className="flex flex-col max-w-[120px] md:max-w-[150px]">
      <span className="font-black truncate text-xs md:text-sm">{ad.title}</span>
      <span className="text-[9px] md:text-[10px] text-gray-400 font-mono">ID: {ad._id?.substring(0, 6)}...</span>
    </div>,
    <div className="flex flex-col">
      <span className="font-bold text-xs md:text-sm">{ad.userId?.name || "---"}</span>
      <span className="text-[9px] md:text-[10px] text-gray-400 hidden sm:block">{ad.userId?.phone}</span>
    </div>,
    <span className="text-xs whitespace-nowrap">{ad.deletedAt ? format(new Date(ad.deletedAt), "yyyy/MM/dd", { locale: ar }) : "---"}</span>,
    <StatusBadge status={ad.commissionStatus} />,
    <span className={`font-black text-xs ${(ad.reportCount || 0) > 0 ? "text-red-500" : "text-gray-400"}`}>
      {ad.reportCount || 0}
    </span>,
    <div className="flex gap-1 md:gap-2">
      <button
        onClick={() => handleRestore(ad._id)}
        className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl transition-all active:scale-95"
        title="استعادة"
      >
        <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>
  ]);

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white">الإعلانات المحذوفة</h1>
        <p className="text-gray-500 font-bold mt-1 text-sm md:text-base">عرض ومتابعة الإعلانات المحذوفة من المنصة</p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border dark:border-slate-800 shadow-sm">
          <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-1">المحذوفة</p>
          <p className="text-xl md:text-2xl font-black text-red-500">{pagination.total}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border dark:border-slate-800 shadow-sm">
          <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-1">إجمالي الصفحات</p>
          <p className="text-xl md:text-2xl font-black text-gray-700 dark:text-gray-300">{pagination.pages}</p>
        </div>
      </div>

      <AdminDataTable
        headers={headers}
        data={tableData}
        loading={loading}
        pagination={pagination}
        onPageChange={fetchAds}
        emptyMessage="لا توجد إعلانات محذوفة حالياً"
      />
    </div>
  );
}
