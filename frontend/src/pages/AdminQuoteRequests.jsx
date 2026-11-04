import { useEffect, useMemo, useState } from "react";
import { useApi } from "../api/axios.js";

const moderationLabels = {
  approved: "موافق",
  pending_review: "قيد المراجعة",
  hidden: "مخفي",
  rejected: "مرفوض",
  deleted: "محذوف"
};

const statusLabels = {
  open: "مفتوح",
  closed: "مغلق",
  cancelled: "ملغي",
  awarded: "مُختار"
};

export default function AdminQuoteRequests() {
  const api = useApi();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [status, setStatus] = useState("");
  const [moderationStatus, setModerationStatus] = useState("");
  const [q, setQ] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  const load = async (nextPage = 1) => {
    setLoading(true);
    try {
      const params = { page: nextPage, limit: 20 };
      if (status) params.status = status;
      if (moderationStatus) params.moderationStatus = moderationStatus;
      if (q) params.q = q;
      if (flaggedOnly) params.flagged = "true";
      const { data } = await api.get("/admin/quote-requests", { params });
      setRows(data.items || []);
      setPage(data.page || 1);
      setPages(data.pages || 1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
  }, [status, moderationStatus, flaggedOnly]);

  const triggerAction = async (id, action) => {
    const reason = window.prompt("أدخل سبب القرار الإدارى:");
    if (!reason && ["pending_review", "hidden", "rejected", "deleted"].includes(action)) {
      return;
    }
    try {
      await api.patch(`/admin/quote-requests/${id}/moderate`, { action, reason: reason || "", notes: reason || "" });
      load(page);
    } catch (error) {
      window.alert(error.response?.data?.error || "تعذر تحديث الطلب.");
    }
  };

  const totalLabel = useMemo(() => rows.length ? `${rows.length} عنصر` : "لا يوجد طلبات", [rows]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold text-blue-700">إدارة الطلبات</p>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">طلبات التسعير</h1>
          </div>
          <div className="text-xs font-bold text-slate-500">{totalLabel}</div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم السلعة أو الوصف" className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm dark:border-slate-700 dark:bg-slate-800" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm dark:border-slate-700 dark:bg-slate-800">
            <option value="">كل الحالات</option>
            <option value="open">مفتوح</option>
            <option value="closed">مغلق</option>
            <option value="cancelled">ملغي</option>
            <option value="awarded">مُختار</option>
          </select>
          <select value={moderationStatus} onChange={(e) => setModerationStatus(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm dark:border-slate-700 dark:bg-slate-800">
            <option value="">كل مراجعات الإدارة</option>
            <option value="approved">موافق</option>
            <option value="pending_review">قيد المراجعة</option>
            <option value="hidden">مخفي</option>
            <option value="rejected">مرفوض</option>
          </select>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm dark:border-slate-700 dark:bg-slate-800">
            <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />
            فقط المبلغ عنها
          </label>
          <button onClick={() => load(1)} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white">تحديث</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {loading ? (
          <div className="p-6 text-center text-sm text-slate-500">جارٍ التحميل...</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">لا توجد طلبات مطابقة.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-3 font-black">الطلب</th>
                  <th className="px-3 py-3 font-black">المالك</th>
                  <th className="px-3 py-3 font-black">الموقع</th>
                  <th className="px-3 py-3 font-black">الحالة</th>
                  <th className="px-3 py-3 font-black">إدارة</th>
                  <th className="px-3 py-3 font-black">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item._id} className="border-t border-slate-200 dark:border-slate-700">
                    <td className="px-3 py-3 align-top">
                      <div className="font-black text-slate-900 dark:text-white">{item.itemName}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.description || item.specifications || "بدون تفاصيل"}</div>
                      {item.flagged && <div className="mt-2 text-[10px] font-bold text-red-600">مبلغ عنه</div>}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="font-bold">{item.ownerId?.name || "غير معروف"}</div>
                      <div className="text-xs text-slate-500">{item.ownerId?.phone || "بدون هاتف"}</div>
                    </td>
                    <td className="px-3 py-3 align-top text-xs text-slate-600 dark:text-slate-300">
                      {item.governorateId?.name || "-"} / {item.cityId?.name || "-"}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="text-xs font-bold text-slate-700">{statusLabels[item.status] || item.status}</div>
                      <div className="mt-1 text-xs font-bold text-blue-700">{moderationLabels[item.moderationStatus] || item.moderationStatus || "موافق"}</div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => triggerAction(item._id, "pending_review")} className="rounded-lg bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-800">تعليق</button>
                        <button onClick={() => triggerAction(item._id, "hidden")} className="rounded-lg bg-slate-200 px-2 py-1 text-[10px] font-black text-slate-700">إخفاء</button>
                        <button onClick={() => triggerAction(item._id, "rejected")} className="rounded-lg bg-red-100 px-2 py-1 text-[10px] font-black text-red-700">رفض</button>
                        <button onClick={() => triggerAction(item._id, "approved")} className="rounded-lg bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700">إعادة نشر</button>
                        <button onClick={() => triggerAction(item._id, "deleted")} className="rounded-lg bg-rose-200 px-2 py-1 text-[10px] font-black text-rose-800">حذف</button>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top text-xs text-slate-500">
                      {new Date(item.createdAt).toLocaleDateString("ar")}<br />
                      {item.moderationReason && <span className="text-[10px] text-red-600">{item.moderationReason}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className="flex justify-center gap-2">
          <button disabled={page <= 1} onClick={() => load(page - 1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">السابق</button>
          <span className="px-3 py-2 text-sm font-bold text-slate-600">{page}/{pages}</span>
          <button disabled={page >= pages} onClick={() => load(page + 1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">التالي</button>
        </div>
      )}
    </div>
  );
}
