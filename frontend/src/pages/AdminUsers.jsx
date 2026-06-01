import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";

export default function AdminUsers() {
  const api = useApi();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [disabled, setDisabled] = useState("");
  const [deleted, setDeleted] = useState("");
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState("desc");

  const buildParams = () => ({
    q: q || undefined,
    role: role || undefined,
    disabled: disabled || undefined,
    deleted: deleted || undefined,
    sort: sort || undefined,
    order: order || undefined
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/users", { params: { q, sort, order, role, disabled, deleted } });
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
  }, [q, role, disabled, deleted, sort, order]);

  const updateRole = async (id, newRole) => {
    try {
      await api.patch(`/admin/users/${id}/role`, { role: newRole });
      load();
    } catch (e) {
      console.error(e);
    }
  };

  const toggleDisable = async (id, currentDisabled) => {
    try {
      await api.patch(`/admin/users/${id}/disable`, { disabled: !currentDisabled });
      load();
    } catch (e) {
      console.error(e);
    }
  };
  const remove = async (id) => {
    try {
      await api.delete(`/admin/users/${id}`);
      load();
    } catch (e) {
      console.error(e);
    }
  };
  if (loading && list.length === 0) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-gray-500 font-black text-sm animate-pulse">جاري تحميل المستخدمين...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-1 min-w-[200px] sm:flex-none">
              <input
                type="search"
                placeholder="بحث بالاسم، الرقم، البريد..."
                className="w-full sm:w-64 pr-10 pl-4 py-2.5 bg-gray-50 border-gray-100 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all font-bold outline-none"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            
            <select 
              className="flex-1 sm:flex-none bg-gray-50 border-gray-100 rounded-xl px-4 py-2.5 text-xs font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all outline-none" 
              value={disabled} 
              onChange={(e) => setDisabled(e.target.value)}
            >
              <option value="">كل الحالات</option>
              <option value="false">نشطون فقط</option>
              <option value="true">محظورون فقط</option>
            </select>

            <select 
              className="flex-1 sm:flex-none bg-gray-50 border-gray-100 rounded-xl px-4 py-2.5 text-xs font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all outline-none" 
              value={deleted} 
              onChange={(e) => setDeleted(e.target.value)}
            >
              <option value="">حالة الحذف</option>
              <option value="false">غير محذوف</option>
              <option value="true">محذوف</option>
            </select>
          </div>

          <div className="flex items-center gap-3 bg-gray-50 p-1.5 rounded-xl border border-gray-100 self-start lg:self-auto w-full lg:w-auto justify-between lg:justify-start">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider px-2">فرز بحسب:</span>
            <div className="flex items-center gap-2">
              <select
                className="bg-white border-gray-100 rounded-lg px-3 py-1.5 text-[11px] font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all h-8"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="createdAt">تاريخ التسجيل</option>
                <option value="name">الاسم</option>
                <option value="email">البريد</option>
              </select>
              <button
                type="button"
                className="p-1.5 bg-white shadow-sm border border-gray-100 rounded-lg transition-all text-gray-600 hover:bg-gray-50 active:scale-95"
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

      {/* Table Container */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hidden sm:block">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-right text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-4 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider">الاسم</th>
                <th className="px-4 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider">الرقم</th>
                <th className="px-4 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider">البريد</th>
                <th className="px-4 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider text-center">الحالة</th>
                <th className="px-4 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider text-center">الدور</th>
                <th className="px-4 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider text-center">تاريخ التسجيل</th>
                <th className="px-4 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`s-${i}`} className="animate-pulse">
                    <td className="px-4 py-4"><div className="h-4 w-32 bg-gray-100 rounded" /></td>
                    <td className="px-4 py-4"><div className="h-4 w-28 bg-gray-100 rounded" /></td>
                    <td className="px-4 py-4"><div className="h-4 w-40 bg-gray-100 rounded" /></td>
                    <td className="px-4 py-4"><div className="h-6 w-16 bg-gray-100 rounded-full mx-auto" /></td>
                    <td className="px-4 py-4"><div className="h-8 w-24 bg-gray-100 rounded-lg mx-auto" /></td>
                    <td className="px-4 py-4"><div className="h-4 w-24 bg-gray-100 rounded mx-auto" /></td>
                    <td className="px-4 py-4"><div className="h-8 w-32 bg-gray-100 rounded-lg" /></td>
                  </tr>
                ))}
              {!loading && list.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                      </div>
                      <p className="text-sm font-bold text-gray-400">لا توجد نتائج مطابقة</p>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && list.map((u) => {
                const phoneDisplay = u.phoneDisplay ?? (u.phoneTrial || (u.email && /@trial\.local$/i.test(u.email)) ? (u.phone || "—") : "—");
                const emailDisplay = u.emailDisplay ?? ((u.phoneTrial || (u.email && /@trial\.local$/i.test(u.email))) ? "—" : (u.email || "—"));
                return (
                <tr key={u._id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-black border border-blue-100">
                        {(u.name || "ب").charAt(0)}
                      </div>
                      <span className="text-sm font-bold text-gray-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-xs font-bold text-gray-600 tracking-wide">{phoneDisplay}</td>
                  <td className="px-4 py-4 text-xs font-medium text-gray-500">{emailDisplay}</td>
                  <td className="px-4 py-4 text-center">
                    {u.isDeleted ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black border bg-gray-100 text-gray-700 border-gray-200">
                        محذوف
                      </span>
                    ) : u.isDisabled ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black border bg-red-50 text-red-700 border-red-100">
                        محظور
                      </span>
                    ) : u.role === 'admin' ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black border bg-indigo-50 text-indigo-700 border-indigo-100">
                        مسؤول
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black border bg-green-50 text-green-700 border-green-100">
                        نشط
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <select
                      className="bg-gray-50 border-gray-100 rounded-xl px-3 py-2 text-[10px] font-black focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all outline-none cursor-pointer"
                      value={u.role}
                      onChange={(e) => updateRole(u._id, e.target.value)}
                    >
                      <option value="admin">مشرف</option>
                      <option value="user">مستخدم</option>
                    </select>
                  </td>
                  <td className="px-4 py-4 text-center text-[10px] font-bold text-gray-400">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString("ar-YE") : "—"}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        className={`px-4 py-2 rounded-xl text-[10px] font-black border transition-all active:scale-95 ${
                          u.isDisabled 
                            ? "bg-green-50 text-green-700 border-green-100 hover:bg-green-100" 
                            : "bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100"
                        }`}
                        onClick={() => toggleDisable(u._id, u.isDisabled)}
                      >
                        {u.isDisabled ? "إلغاء الحظر" : "حظر المستخدم"}
                      </button>
                      <button
                        className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-all active:scale-95"
                        onClick={() => remove(u._id)}
                        title="حذف نهائي"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile View - Cards */}
      <div className="block sm:hidden space-y-4">
        {loading &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={`ms-${i}`} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm animate-pulse space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-gray-100 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-full bg-gray-100 rounded" />
                  <div className="h-4 w-2/3 bg-gray-100 rounded" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="h-8 bg-gray-50 rounded-xl" />
                <div className="h-8 bg-gray-50 rounded-xl" />
              </div>
            </div>
          ))}

        {!loading && list.length === 0 && (
          <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-sm font-bold text-gray-400">لا توجد نتائج مطابقة</p>
          </div>
        )}

        {!loading && list.map((u) => {
          const phoneDisplay = u.phoneDisplay ?? (u.phoneTrial || (u.email && /@trial\.local$/i.test(u.email)) ? (u.phone || "—") : "—");
          const emailDisplay = u.emailDisplay ?? ((u.phoneTrial || (u.email && /@trial\.local$/i.test(u.email))) ? "—" : (u.email || "—"));
          return (
            <div key={u._id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4 transition-all active:scale-[0.99]">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-lg font-black border border-blue-100 flex-shrink-0">
                  {(u.name || "ب").charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-black text-gray-900 text-sm truncate">{u.name}</h3>
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    <p className="text-xs font-bold text-gray-500 truncate">{phoneDisplay}</p>
                    <p className="text-[10px] font-medium text-gray-400 truncate">{emailDisplay}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {u.isDisabled ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black border bg-red-50 text-red-700 border-red-100">محظور</span>
                  ) : u.role === 'admin' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black border bg-indigo-50 text-indigo-700 border-indigo-100">مسؤول</span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black border bg-green-50 text-green-700 border-green-100">نشط</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
                <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 flex justify-between items-center">
                  <p className="text-gray-400">الدور</p>
                  <select
                    className="bg-transparent text-indigo-600 text-xs font-black outline-none cursor-pointer"
                    value={u.role}
                    onChange={(e) => updateRole(u._id, e.target.value)}
                  >
                    <option value="admin">مشرف</option>
                    <option value="user">مستخدم</option>
                  </select>
                </div>
                <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 flex justify-between items-center">
                  <p className="text-gray-400">التسجيل</p>
                  <p className="text-gray-700">{u.createdAt ? new Date(u.createdAt).toLocaleDateString("ar-YE") : "—"}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => toggleDisable(u._id, u.isDisabled)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black border transition-all active:scale-95 ${
                    u.isDisabled 
                      ? "bg-green-50 text-green-700 border-green-100 hover:bg-green-100" 
                      : "bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100"
                  }`}
                >
                  {u.isDisabled ? "إلغاء الحظر" : "حظر المستخدم"}
                </button>
                <button
                  onClick={() => remove(u._id)}
                  className="p-2.5 rounded-xl bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-all active:scale-95"
                  title="حذف نهائي"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
