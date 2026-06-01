import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";

export default function AdminGovernorates() {
  const api = useApi();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const toast = (message, type = "info") => {
    try {
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message, type } }));
    } catch {}
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/governorates");
      setList(res.data || []);
    } catch (e) {
      console.error("Full error response for governorates fetch:", e.response || e);
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditing(null);
    setName("");
    setIsActive(true);
    setError("");
    setOk("");
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setOk("");
    try {
      const payload = { name, isActive };
      if (!editing) {
        await api.post("/governorates", payload);
        toast("تمت إضافة المحافظة", "success");
      } else {
        await api.put(`/governorates/${editing}`, payload);
        toast("تم تعديل المحافظة", "success");
      }
      await load();
      setOk("تم الحفظ");
      resetForm();
    } catch (e) {
      const msg = e?.response?.data?.error || "تعذر الحفظ";
      setError(msg);
      toast(msg, "error");
    }
  };

  const onEdit = (g) => {
    setEditing(g._id);
    setName(g.name || "");
    setIsActive(!!g.isActive);
    setOk("");
    setError("");
  };

  const onDelete = async (id) => {
    if (!confirm("حذف المحافظة؟")) return;
    setError("");
    setOk("");
    try {
      await api.delete(`/governorates/${id}`);
      load();
      toast("تم حذف المحافظة", "success");
    } catch (e) {
      const msg = e?.response?.data?.error || "تعذر الحذف";
      setError(msg);
      toast(msg, "error");
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="ds-title">إدارة المحافظات</h2>

      <form onSubmit={submit} className="ds-section space-y-3">
        {ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{ok}</div>}
        {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">الاسم</label>
            <input className="ds-input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              فعال
            </label>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          {editing && (
            <button type="button" className="ds-btn-secondary" onClick={resetForm}>
              إلغاء
            </button>
          )}
          <button type="submit" className="ds-btn-primary">
            {editing ? "تعديل المحافظة" : "إضافة محافظة"}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hidden sm:block">
        <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between bg-gray-50/30">
          <h3 className="text-sm font-black text-gray-900">المحافظات المسجلة</h3>
          <span className="text-[10px] font-black text-gray-400 bg-white px-2 py-1 rounded-lg border border-gray-100 shadow-sm">
            إجمالي: {list.length}
          </span>
        </div>
        
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
            <p className="mt-4 text-sm font-bold text-gray-400">جاري تحميل البيانات...</p>
          </div>
        ) : list.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-bold text-gray-400">لا توجد محافظات مضافة حالياً</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-right text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider">اسم المحافظة</th>
                  <th className="px-6 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider text-center">الاسم اللطيف (Slug)</th>
                  <th className="px-6 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider text-center">الحالة</th>
                  <th className="px-6 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {list.map((g) => (
                  <tr key={g._id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-bold text-gray-900">{g.name}</span>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span className="text-xs font-mono font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">{g.slug}</span>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black border ${
                        g.isActive ? "bg-green-50 text-green-700 border-green-100" : "bg-gray-50 text-gray-500 border-gray-100"
                      }`}>
                        {g.isActive ? "فعالة" : "معطلة"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-left whitespace-nowrap">
                      <div className="flex items-center justify-start gap-2">
                        <button
                          onClick={() => onEdit(g)}
                          className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 transition-all"
                          title="تعديل"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button
                          onClick={() => onDelete(g._id)}
                          className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-all"
                          title="حذف"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mobile View - Cards */}
      <div className="block sm:hidden space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-black text-gray-900">المحافظات ({list.length})</h3>
        </div>
        
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 animate-pulse h-32"></div>
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-sm font-bold text-gray-400">لا توجد محافظات مضافة</p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((g) => (
              <div key={g._id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4 transition-all active:scale-[0.99]">
                <div className="flex gap-4">
                  <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                    <span className="text-blue-600 font-black text-lg">{(g.name || "م").charAt(0)}</span>
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col justify-center">
                    <h3 className="font-black text-gray-900 text-sm truncate">{g.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black border ${
                        g.isActive ? "bg-green-50 text-green-700 border-green-100" : "bg-gray-50 text-gray-500 border-gray-100"
                      }`}>
                        {g.isActive ? "فعالة" : "معطلة"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
                  <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
                    <p className="text-gray-400 mb-0.5">الاسم اللطيف</p>
                    <p className="text-gray-700 truncate font-mono">{g.slug}</p>
                  </div>
                  <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
                    <p className="text-gray-400 mb-0.5">تاريخ الإضافة</p>
                    <p className="text-gray-700">{g.createdAt ? new Date(g.createdAt).toLocaleDateString("ar-YE") : "-"}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
                  <button
                    onClick={() => onEdit(g)}
                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black shadow-sm shadow-blue-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    تعديل
                  </button>
                  <button
                    onClick={() => onDelete(g._id)}
                    className="p-2.5 bg-red-50 text-red-600 rounded-xl border border-red-100 hover:bg-red-100 active:scale-95 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
