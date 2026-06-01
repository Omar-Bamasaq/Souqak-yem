import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";

export default function AdminDeletedUsers() {
  const api = useApi();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("deletionRequestedAt");
  const [order, setOrder] = useState("desc");

  const load = async () => {
    setLoading(true);
    try {
      // We use the existing /admin/users route with deleted=true filter
      const res = await api.get("/admin/users", { 
        params: { q, sort, order, deleted: "true" } 
      });
      setList(res.data || []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, sort, order]);

  if (loading && list.length === 0) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-red-600/20 border-t-red-600 rounded-full animate-spin"></div>
        <p className="text-gray-500 font-black text-sm animate-pulse">جاري تحميل الحسابات المحذوفة...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">الحسابات المحذوفة</h2>
          <p className="text-sm text-gray-500 font-bold mt-1">قائمة المستخدمين الذين قاموا بحذف حساباتهم من المنصة</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative flex-1 min-w-[200px] sm:flex-none">
            <input
              type="search"
              placeholder="بحث بالاسم أو الرقم..."
              className="w-full sm:w-64 pr-10 pl-4 py-2.5 bg-gray-50 dark:bg-slate-800 border-gray-100 dark:border-slate-700 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-red-500/20 transition-all font-bold outline-none"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-800 p-1.5 rounded-xl border border-gray-100 dark:border-slate-700 self-start lg:self-auto w-full lg:w-auto justify-between lg:justify-start">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider px-2">ترتيب بحسب:</span>
            <div className="flex items-center gap-2">
              <select
                className="bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-700 rounded-lg px-3 py-1.5 text-[11px] font-bold shadow-sm outline-none focus:ring-2 focus:ring-red-500/20 transition-all h-8"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="deletionRequestedAt">تاريخ الحذف</option>
                <option value="name">الاسم</option>
                <option value="createdAt">تاريخ الانضمام</option>
              </select>
              <button
                type="button"
                className="p-1.5 bg-white dark:bg-slate-900 shadow-sm border border-gray-100 dark:border-slate-700 rounded-lg transition-all text-gray-600 hover:bg-gray-50 active:scale-95"
                onClick={() => setOrder((v) => (v === "asc" ? "desc" : "asc"))}
                title={order === "asc" ? "تصاعدي" : "تنازلي"}
              >
                {order === "asc" ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-1v12m0 0l-4-4m4 4l4-4" /></svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-right text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800">
                <th className="px-6 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider">المستخدم</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider">البيانات المحفوظة</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider text-center">تاريخ الانضمام</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider text-center">تاريخ الحذف</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider text-center">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
              {!loading && list.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <p className="text-sm font-bold text-gray-400">لا يوجد مستخدمون محذوفون حالياً</p>
                  </td>
                </tr>
              )}
              {list.map((u) => (
                <tr key={u._id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-xs font-black border border-red-100">
                        {(u.name || "م").charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-black text-gray-900 dark:text-white">{u.name}</p>
                        <p className="text-[10px] font-bold text-gray-400">ID: {u._id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-gray-600 dark:text-gray-400">{u.phoneDisplay || "—"}</p>
                      <p className="text-[10px] font-medium text-gray-400">{u.emailDisplay || "—"}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center text-[10px] font-bold text-gray-500">
                    {new Date(u.createdAt).toLocaleDateString("ar-YE")}
                  </td>
                  <td className="px-6 py-4 text-center text-[10px] font-bold text-red-500">
                    {u.deletionRequestedAt ? new Date(u.deletionRequestedAt).toLocaleDateString("ar-YE") : "—"}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black border bg-red-50 text-red-700 border-red-100">
                      محذوف نهائياً
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
