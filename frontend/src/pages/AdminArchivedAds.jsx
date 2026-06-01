import React, { useState, useEffect } from "react";
import { useApi } from "../api/axios.js";
import AdminDataTable from "../components/AdminDataTable.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

import { uploadsUrl } from "../lib/uploads.js";

export default function AdminArchivedAds() {
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
      const res = await api.get(`/admin/archived-ads?page=${page}`);
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

  const headers = ["الصورة", "العنوان", "البائع", "التاريخ", "الحالة", "إجراءات"];

  const tableData = ads.map((ad) => [
    <img
      src={uploadsUrl(ad.images && ad.images[0], "thumb")}
      alt=""
      className="h-10 w-10 md:h-12 md:w-12 rounded-lg object-cover bg-gray-100"
    />,
    <div className="flex flex-col max-w-[150px] md:max-w-[200px]">
      <span className="font-black truncate text-xs md:text-sm">{ad.title}</span>
      <span className="text-[9px] md:text-[10px] text-gray-400 font-mono">ID: {ad._id?.substring(0, 6)}...</span>
    </div>,
    <div className="flex flex-col">
      <span className="font-bold text-xs md:text-sm">{ad.userId?.name || "---"}</span>
      <span className="text-[9px] md:text-[10px] text-gray-400 hidden sm:block">{ad.userId?.phone}</span>
    </div>,
    <span className="text-xs whitespace-nowrap">{ad.updatedAt ? format(new Date(ad.updatedAt), "yyyy/MM/dd", { locale: ar }) : "---"}</span>,
    <StatusBadge status="archived" />,
    <div className="flex gap-1 md:gap-2">
      <button className="p-2 bg-gray-50 text-gray-600 hover:bg-gray-200 rounded-xl transition-all active:scale-95" title="عرض">
        <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      </button>
    </div>
  ]);

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white">الإعلانات المؤرشفة</h1>
        <p className="text-gray-500 font-bold mt-1 text-sm md:text-base">عرض الإعلانات التي تم أرشفتها تلقائياً أو بواسطة المستخدم</p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border dark:border-slate-800 shadow-sm">
          <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-1">المؤرشفة</p>
          <p className="text-xl md:text-2xl font-black text-amber-500">{pagination.total}</p>
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
        emptyMessage="لا توجد إعلانات مؤرشفة حالياً"
      />
    </div>
  );
}
