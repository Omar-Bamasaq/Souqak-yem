import React, { useState, useEffect } from "react";
import { useApi } from "../api/axios.js";
import AdminDataTable from "../components/AdminDataTable.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export default function AdminActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const [filters, setFilters] = useState({ action: "", entityType: "" });
  const api = useApi();

  useEffect(() => {
    fetchLogs(1);
  }, [filters]);

  const fetchLogs = async (page) => {
    setLoading(true);
    try {
      let query = `page=${page}`;
      if (filters.action) query += `&action=${filters.action}`;
      if (filters.entityType) query += `&entityType=${filters.entityType}`;

      const res = await api.get(`/admin/activity-logs?${query}`);
      setLogs(res.data.items || []);
      setPagination({ page: res.data.page, pages: res.data.pages });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setFilters({ action: "", entityType: "" });
  };

  const headers = ["العملية", "بواسطة", "الهدف", "التاريخ", "IP", "تفاصيل"];

  const tableData = logs.map((log) => [
    <span className="font-black text-blue-600 dark:text-blue-400 whitespace-nowrap">{log.action}</span>,
    <div className="flex flex-col">
      <span className="font-bold text-sm">{log.performedBy?.name || "---"}</span>
      <span className="text-[10px] text-gray-400 uppercase">{log.performedBy?.role}</span>
    </div>,
    <span className="font-bold text-gray-500 text-sm">{log.entityType}</span>,
    <span className="text-xs whitespace-nowrap">
      {log.createdAt ? format(new Date(log.createdAt), "MM/dd HH:mm", { locale: ar }) : "---"}
    </span>,
    <span className="font-mono text-[10px] text-gray-400 hidden sm:block">{log.ipAddress || "---"}</span>,
    <pre className="text-[9px] bg-gray-50 dark:bg-slate-800 p-1.5 rounded-lg max-w-[120px] md:max-w-[150px] overflow-hidden truncate block">
      {JSON.stringify(log.metadata || {})}
    </pre>
  ]);

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white">سجل النشاطات</h1>
        <p className="text-gray-500 font-bold mt-1 text-sm md:text-base">تتبع العمليات الحساسة في المنصة</p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 bg-white dark:bg-slate-900 p-4 md:p-6 rounded-2xl border dark:border-slate-800 shadow-sm">
        <div className="space-y-2">
          <label className="text-xs font-black text-gray-500 dark:text-slate-400 uppercase tracking-wider">نوع العملية</label>
          <input
            type="text"
            placeholder="مثال: DELETE_AD"
            className="w-full px-4 py-2.5 rounded-xl border dark:border-slate-700 bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
            value={filters.action}
            onChange={(e) => setFilters({...filters, action: e.target.value})}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black text-gray-500 dark:text-slate-400 uppercase tracking-wider">نوع الكيان</label>
          <select
            className="w-full px-4 py-2.5 rounded-xl border dark:border-slate-700 bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
            value={filters.entityType}
            onChange={(e) => setFilters({...filters, entityType: e.target.value})}
          >
            <option value="">الكل</option>
            <option value="Ad">الإعلانات</option>
            <option value="User">المستخدمين</option>
            <option value="Review">التقييمات</option>
            <option value="Order">الطلبات</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={clearFilters}
            className="w-full px-4 py-2.5 text-sm font-bold text-gray-500 bg-gray-100 dark:bg-slate-800 border dark:border-slate-700 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 transition-all"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              مسح الفلاتر
            </span>
          </button>
        </div>
      </div>

      {/* Active Filters Summary */}
      {(filters.action || filters.entityType) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black text-gray-400">الفلاتر النشطة:</span>
          {filters.action && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-lg border border-blue-100">
              عملية: {filters.action}
              <button onClick={() => setFilters({...filters, action: ""})} className="hover:text-blue-800">×</button>
            </span>
          )}
          {filters.entityType && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-50 text-purple-600 text-xs font-bold rounded-lg border border-purple-100">
              نوع: {filters.entityType}
              <button onClick={() => setFilters({...filters, entityType: ""})} className="hover:text-purple-800">×</button>
            </span>
          )}
        </div>
      )}

      <AdminDataTable
        headers={headers}
        data={tableData}
        loading={loading}
        pagination={pagination}
        onPageChange={fetchLogs}
        emptyMessage="لا توجد سجلات نشاط مطابقة"
      />
    </div>
  );
}
