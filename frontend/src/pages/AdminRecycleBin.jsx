import React, { useState, useEffect } from "react";
import { useApi } from "../api/axios.js";
import AdminDataTable from "../components/AdminDataTable.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export default function AdminRecycleBin() {
  const [activeTab, setActiveTab] = useState("Ad");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const api = useApi();

  const tabs = [
    { id: "Ad", label: "الإعلانات" },
    { id: "Conversation", label: "المحادثات" },
    { id: "Support", label: "الدعم الفني" },
    { id: "Review", label: "التقييمات" },
    { id: "AdReport", label: "البلاغات" },
    { id: "VerificationRequest", label: "طلبات التوثيق" },
  ];

  useEffect(() => {
    fetchItems(1);
  }, [activeTab]);

  const fetchItems = async (page) => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/recycle-bin?type=${activeTab}&page=${page}`);
      setItems(res.data.items || []);
      setPagination({ page: res.data.page, pages: res.data.pages });
    } catch (err) {
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "فشل جلب البيانات", type: "error" } }));
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id) => {
    if (!window.confirm("هل أنت متأكد من استعادة هذا العنصر؟")) return;
    try {
      await api.post(`/admin/restore/${activeTab}/${id}`);
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تمت الاستعادة بنجاح", type: "success" } }));
      fetchItems(pagination.page);
    } catch (err) {
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "فشل استعادة العنصر", type: "error" } }));
    }
  };

  const handlePermanentDelete = async (id) => {
    if (!window.confirm("تحذير: هل أنت متأكد من الحذف النهائي لهذا العنصر؟ لا يمكن التراجع عن هذه الخطوة.")) return;
    try {
      await api.post(`/admin/permanent-delete/${activeTab}/${id}`);
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تم الحذف النهائي بنجاح", type: "success" } }));
      fetchItems(pagination.page);
    } catch (err) {
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "فشل الحذف النهائي", type: "error" } }));
    }
  };

  const headers = [
    "المعرف",
    activeTab === "Ad" ? "العنوان" : "التفاصيل",
    "تاريخ الحذف",
    "سبب الحذف",
    "الإجراءات"
  ];

  const tableData = items.map(item => [
    <span className="font-mono text-xs">{item._id?.substring(0, 8)}...</span>,
    <div className="max-w-xs truncate font-bold">
      {activeTab === "Ad" ? item.title : (item.details || item.message || item.comment || item.reason || "---")}
    </div>,
    <span className="text-xs">
      {item.deletedAt ? format(new Date(item.deletedAt), "PPP", { locale: ar }) : "---"}
    </span>,
    <span className="text-xs text-red-500 font-bold">{item.deleteReason || "غير محدد"}</span>,
    <div className="flex gap-2">
      <button
        onClick={() => handleRestore(item._id)}
        className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl transition-all active:scale-95"
        title="استعادة"
      >
        <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
      <button
        onClick={() => handlePermanentDelete(item._id)}
        className="p-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-xl transition-all active:scale-95"
        title="حذف نهائي"
      >
        <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  ]);

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white">سلة المهملات</h1>
          <p className="text-gray-500 font-bold mt-1 text-sm md:text-base">إدارة واستعادة العناصر المحذوفة من المنصة</p>
        </div>
      </div>

      {/* Tabs - Horizontal scroll on mobile */}
      <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 p-1 bg-gray-100 dark:bg-slate-800 rounded-2xl w-fit min-w-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 md:px-6 py-2.5 rounded-xl text-xs md:text-sm font-black transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border dark:border-slate-800 shadow-sm">
          <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-1">الإعلانات المحذوفة</p>
          <p className="text-xl md:text-2xl font-black text-red-500">{items.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border dark:border-slate-800 shadow-sm">
          <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-1">نوع العنصر</p>
          <p className="text-sm md:text-base font-black text-gray-700 dark:text-gray-300">{tabs.find(t => t.id === activeTab)?.label}</p>
        </div>
      </div>

      <AdminDataTable
        headers={headers}
        data={tableData}
        loading={loading}
        pagination={pagination}
        onPageChange={fetchItems}
        emptyMessage={`لا توجد ${tabs.find(t => t.id === activeTab)?.label} محذوفة حالياً`}
      />
    </div>
  );
}
