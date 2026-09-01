import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";

export default function AdminPasswordResetRequests() {
  const api = useApi();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/password-reset-requests");
      setItems(res.data || []);
    } catch (error) {
      console.error("Error loading reset requests:", error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const updateStatus = async (id, status) => {
    setUpdatingId(id);
    try {
      const response = await api.patch(`/admin/password-reset-requests/${id}/status`, { status });
      const waLink = response?.data?.waLink;

      if (waLink) {
        window.open(waLink, "_blank", "noopener,noreferrer");
      }

      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { type: "success", message: status === "approved" ? "تمت الموافقة على الطلب" : "تم رفض الطلب" } }));
      await fetchData();
    } catch (error) {
      const message = error?.response?.data?.error || "فشل تحديث الحالة";
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { type: "error", message } }));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="p-4 md:p-6 min-h-screen bg-gray-50/30">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-black text-gray-900 mb-1">طلبات استعادة كلمة المرور</h2>
          <p className="text-sm text-gray-500 font-medium">إدارة الطلبات المرسلة من المستخدمين عبر اسم المستخدم ورقم الهاتف</p>
        </div>
        {loading && (
          <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100">
            <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            <span className="text-xs font-bold text-blue-700">جاري التحديث...</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-100">
              <th className="px-6 py-4 text-right font-black text-gray-700">المستخدم</th>
              <th className="px-6 py-4 text-right font-black text-gray-700">الهاتف</th>
              <th className="px-6 py-4 text-right font-black text-gray-700">الحالة</th>
              <th className="px-6 py-4 text-center font-black text-gray-700">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.length === 0 && !loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-20 text-center text-gray-400 font-bold">لا توجد طلبات حالياً</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item._id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-5 font-bold text-gray-900">{item.username}</td>
                  <td className="px-6 py-5 text-gray-600 font-mono" dir="ltr">{item.phone || "-"}</td>
                  <td className="px-6 py-5">
                    {item.status === "approved" ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-[10px] font-black border border-green-100">مقبول</span>
                    ) : item.status === "rejected" ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-[10px] font-black border border-red-100">مرفوض</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-black border border-blue-100">قيد المراجعة</span>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center justify-center gap-2">
                      {updatingId === item._id ? (
                        <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                      ) : item.status === "pending" ? (
                        <>
                          <button onClick={() => updateStatus(item._id, "approved")} className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-green-700 transition-all active:scale-95">قبول</button>
                          <button onClick={() => updateStatus(item._id, "rejected")} className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-red-700 transition-all active:scale-95">رفض</button>
                        </>
                      ) : (
                        <span className="text-gray-400 text-[10px] font-black bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">مكتمل</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
