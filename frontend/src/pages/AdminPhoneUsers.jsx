import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";

export default function AdminPhoneUsers() {
  const api = useApi();
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/phone-users", { params: q ? { q } : {} });
      setItems(res.data || []);
    } catch (err) {
      console.error("Error fetching phone users:", err.response || err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const approve = async (u) => {
    setUpdatingId(u._id);
    try {
      console.log(`[Admin] Approving phone user: ${u._id}`);
      await api.patch(`admin/phone-users/${u._id}/status`, { status: "approved" });
      // Update local state immediately
      setItems(prev => prev.map(item => item._id === u._id ? { ...item, phoneTrialStatus: "Approved" } : item));
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { type: "success", message: "تم تفعيل المستخدم بنجاح" } }));
    } catch (err) {
      console.error("[Admin] Error approving user:", err);
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { type: "error", message: "فشل تفعيل المستخدم" } }));
    } finally {
      setUpdatingId(null);
    }
  };

  const reject = async (u) => {
    setUpdatingId(u._id);
    try {
      console.log(`[Admin] Rejecting phone user: ${u._id}`);
      await api.patch(`admin/phone-users/${u._id}/status`, { status: "rejected" });
      // Update local state immediately
      setItems(prev => prev.map(item => item._id === u._id ? { ...item, phoneTrialStatus: "Rejected" } : item));
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { type: "success", message: "تم رفض الطلب بنجاح" } }));
    } catch (err) {
      console.error("[Admin] Error rejecting user:", err);
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { type: "error", message: "فشل رفض المستخدم" } }));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="p-4 md:p-6 min-h-screen bg-gray-50/30">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-black text-gray-900 mb-1">التحقق من المستخدمين</h2>
          <p className="text-sm text-gray-500 font-medium">إدارة طلبات تفعيل الحسابات عبر رقم الهاتف</p>
        </div>
        {loading && (
          <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100">
            <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            <span className="text-xs font-bold text-blue-700">جاري التحديث...</span>
          </div>
        )}
      </div>
      
      {/* Search Section */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-8">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              className="w-full rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3.5 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all text-right pr-11 text-sm font-medium"
              placeholder="ابحث بالاسم أو الرقم"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && fetchData()}
            />
            <svg className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button 
            className="bg-blue-600 text-white px-8 py-3.5 rounded-xl font-black text-sm hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2" 
            onClick={fetchData} 
            disabled={loading}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>بحث</span>
          </button>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-100">
              <th className="px-6 py-4 text-right font-black text-gray-700 uppercase tracking-wider">المستخدم</th>
              <th className="px-6 py-4 text-right font-black text-gray-700 uppercase tracking-wider text-center">الحالة</th>
              <th className="px-6 py-4 text-center font-black text-gray-700 uppercase tracking-wider">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((u) => (
              <tr key={u._id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-black text-lg">
                      {u.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <div className="font-black text-gray-900">{u.name}</div>
                      <div className="text-xs text-gray-500 font-mono mt-0.5" dir="ltr">{u.phone || "-"}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5 text-center">
                  {(!u.phoneTrialStatus || u.phoneTrialStatus === "Pending") ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-black border border-blue-100">
                      <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></span>
                      قيد الانتظار
                    </span>
                  ) : u.phoneTrialStatus === "Approved" ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-[10px] font-black border border-green-100">
                      <span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span>
                      تم التفعيل
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-[10px] font-black border border-red-100">
                      <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
                      مرفوض
                    </span>
                  )}
                </td>
                <td className="px-6 py-5">
                  <div className="flex items-center justify-center gap-2">
                    {updatingId === u._id ? (
                      <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                    ) : (!u.phoneTrialStatus || u.phoneTrialStatus === "Pending") ? (
                      <>
                        <button
                          onClick={() => approve(u)}
                          className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-green-700 transition-all active:scale-95 shadow-md shadow-green-100"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                          تفعيل
                        </button>
                        <button
                          onClick={() => reject(u)}
                          className="flex items-center gap-1.5 bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-red-700 transition-all active:scale-95 shadow-md shadow-red-100"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          رفض
                        </button>
                      </>
                    ) : (
                      <span className="text-gray-400 text-[10px] font-black bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                        مكتمل
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr>
                <td className="px-6 py-20 text-center" colSpan={3}>
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-400 font-bold">لا توجد طلبات تفعيل حالياً</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-4">
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={`ms-${i}`} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm animate-pulse space-y-4">
                <div className="flex gap-4">
                  <div className="h-14 w-14 bg-gray-200 rounded-2xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-2/3 bg-gray-200 rounded" />
                    <div className="h-3 w-1/2 bg-gray-200 rounded" />
                  </div>
                </div>
                <div className="h-10 bg-gray-200 rounded-xl" />
              </div>
            ))}
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="bg-white p-8 text-center rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-sm text-gray-500 font-bold">لا توجد طلبات تفعيل حالياً.</p>
          </div>
        )}
        {!loading && items.map((u) => (
          <div key={u._id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4 transition-all active:scale-[0.99]">
            <div className="flex gap-4">
              <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                {u.name?.charAt(0) || 'U'}
              </div>
              <div className="min-w-0 flex-1 flex flex-col justify-center">
                <h3 className="font-black text-gray-900 text-sm truncate">{u.name || "مستخدم"}</h3>
                <p className="text-xs text-gray-500 font-mono mt-0.5" dir="ltr">{u.phone || "-"}</p>
              </div>
              <div className="flex-shrink-0">
                {(!u.phoneTrialStatus || u.phoneTrialStatus === "Pending") ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-50 text-blue-700 text-[10px] font-black border border-blue-100">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></span>
                    قيد الانتظار
                  </span>
                ) : u.phoneTrialStatus === "Approved" ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-green-50 text-green-700 text-[10px] font-black border border-green-100">
                    <span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span>
                    تم التفعيل
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-red-50 text-red-700 text-[10px] font-black border border-red-100">
                    <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
                    مرفوض
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
              <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                <p className="text-gray-400 mb-0.5">تاريخ التسجيل</p>
                <p className="text-gray-700">{u.createdAt ? new Date(u.createdAt).toLocaleDateString("ar-YE") : "-"}</p>
              </div>
              <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                <p className="text-gray-400 mb-0.5">نوع الحساب</p>
                <p className="text-gray-700">{u.role === "seller" ? "بائع" : u.role === "buyer" ? "مشتري" : "مستخدم"}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
              {updatingId === u._id ? (
                <div className="flex-1 flex justify-center py-3">
                  <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                </div>
              ) : (!u.phoneTrialStatus || u.phoneTrialStatus === "Pending") ? (
                <>
                  <button
                    onClick={() => approve(u)}
                    className="flex-1 py-3 bg-green-600 text-white rounded-xl text-xs font-black shadow-sm shadow-green-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                    تفعيل
                  </button>
                  <button
                    onClick={() => reject(u)}
                    className="py-3 px-4 bg-red-50 text-red-600 rounded-xl border border-red-100 hover:bg-red-100 active:scale-95 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </>
              ) : (
                <div className="flex-1 text-center py-3 text-gray-400 text-[10px] font-black bg-gray-50 rounded-xl border border-gray-100">
                  تم اتخاذ إجراء مسبقاً
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
