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
    <div className="min-h-screen overflow-x-hidden bg-gray-50/30 p-3 sm:p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 md:flex-row md:items-center md:justify-between md:gap-4">
        <div>
          <h2 className="mb-1 text-xl font-black text-gray-900 sm:text-2xl">طلبات استعادة كلمة المرور</h2>
          <p className="text-xs font-medium leading-5 text-gray-500 sm:text-sm">إدارة الطلبات المرسلة من المستخدمين عبر اسم المستخدم ورقم الهاتف</p>
        </div>
        {loading && (
          <div className="flex w-fit items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 sm:px-4">
            <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            <span className="text-xs font-bold text-blue-700">جاري التحديث...</span>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="hidden overflow-x-auto md:block">
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

        <div className="divide-y divide-gray-100 md:hidden">
          {items.length === 0 && !loading ? (
            <div className="px-4 py-16 text-center text-sm font-bold text-gray-400">لا توجد طلبات حالياً</div>
          ) : (
            items.map((item) => (
              <article key={item._id} className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="mb-1 text-[11px] font-bold text-gray-400">المستخدم</p>
                    <p className="truncate font-black text-gray-900">{item.username}</p>
                  </div>
                  {item.status === "approved" ? (
                    <span className="shrink-0 rounded-lg border border-green-100 bg-green-50 px-2.5 py-1.5 text-[10px] font-black text-green-700">مقبول</span>
                  ) : item.status === "rejected" ? (
                    <span className="shrink-0 rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5 text-[10px] font-black text-red-700">مرفوض</span>
                  ) : (
                    <span className="shrink-0 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-[10px] font-black text-blue-700">قيد المراجعة</span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
                  <span className="text-xs font-bold text-gray-500">الهاتف</span>
                  <span className="font-mono text-sm text-gray-700" dir="ltr">{item.phone || "-"}</span>
                </div>

                <div className="flex gap-2">
                  {updatingId === item._id ? (
                    <div className="flex min-h-10 flex-1 items-center justify-center">
                      <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                    </div>
                  ) : item.status === "pending" ? (
                    <>
                      <button onClick={() => updateStatus(item._id, "approved")} className="min-h-10 flex-1 rounded-xl bg-green-600 px-3 py-2 text-xs font-black text-white transition-all hover:bg-green-700 active:scale-95">قبول الطلب</button>
                      <button onClick={() => updateStatus(item._id, "rejected")} className="min-h-10 flex-1 rounded-xl bg-red-600 px-3 py-2 text-xs font-black text-white transition-all hover:bg-red-700 active:scale-95">رفض الطلب</button>
                    </>
                  ) : (
                    <span className="flex min-h-10 flex-1 items-center justify-center rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-black text-gray-400">مكتمل</span>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
