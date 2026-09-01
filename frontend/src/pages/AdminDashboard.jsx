import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";

export default function AdminDashboard() {
  const api = useApi();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/analytics/summary");
      setSummary(res.data || {});
    } catch (error) {
      console.error("Summary load error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const cards = [
    {
      title: "المتصلون الآن",
      value: summary?.onlineUsers ?? 0,
      icon: "🟢",
      bg: "bg-emerald-50",
      text: "text-emerald-700"
    },
    {
      title: "إجمالي المستخدمين",
      value: summary?.totalUsers ?? 0,
      icon: "👥",
      bg: "bg-blue-50",
      text: "text-blue-700"
    },
    {
      title: "زوار اليوم",
      value: summary?.todayVisitors ?? 0,
      icon: "👀",
      bg: "bg-violet-50",
      text: "text-violet-700"
    },
    {
      title: "إعلانات اليوم",
      value: summary?.todayAds ?? 0,
      icon: "🏷️",
      bg: "bg-amber-50",
      text: "text-amber-700"
    },
    {
      title: "إجمالي الإعلانات",
      value: summary?.totalAds ?? 0,
      icon: "🏷️",
      bg: "bg-orange-50",
      text: "text-orange-700"
    },
    {
      title: "طلبات اليوم",
      value: summary?.todayOrders ?? 0,
      icon: "🛒",
      bg: "bg-cyan-50",
      text: "text-cyan-700"
    },
    {
      title: "إجمالي الطلبات",
      value: summary?.totalOrders ?? 0,
      icon: "🛒",
      bg: "bg-sky-50",
      text: "text-sky-700"
    },
    {
      title: "إجمالي مشاهدات الإعلانات",
      value: summary?.totalAdViews ?? 0,
      icon: "👁️",
      bg: "bg-pink-50",
      text: "text-pink-700"
    }
  ];

  return (
    <div className="space-y-6 pb-12 dark:text-slate-100">
      <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-gray-900">لوحة إدارة الإحصائيات</h2>
          <p className="mt-1 text-xs text-gray-500">ملخص سريع للمنصة</p>
        </div>
        <button
          onClick={loadSummary}
          disabled={loading}
          className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-black text-gray-700 disabled:opacity-50"
        >
          {loading ? "جارٍ التحديث..." : "تحديث"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {cards.map((card) => (
          <div key={card.title} className={`${card.bg} rounded-2xl border border-gray-100 p-4 shadow-sm`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xl">{card.icon}</span>
            </div>
            <p className="mt-4 text-[10px] font-black text-gray-500">{card.title}</p>
            <h3 className={`mt-2 text-2xl font-black ${card.text}`}>
              {Number(card.value).toLocaleString("ar-EG")}
            </h3>
          </div>
        ))}
      </div>
    </div>
  );
}


