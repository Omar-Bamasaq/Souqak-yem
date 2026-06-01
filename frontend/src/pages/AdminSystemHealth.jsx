import React, { useState, useEffect } from "react";
import { useApi } from "../api/axios.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";

const StatCard = ({ title, value, subtitle, icon, color = "blue" }) => {
  const colors = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
    green: "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
    red: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
    orange: "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400",
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border dark:border-slate-800 shadow-sm flex items-start justify-between">
      <div>
        <p className="text-sm font-black text-gray-500 mb-1">{title}</p>
        <h3 className="text-2xl font-black text-gray-900 dark:text-white">{value || "N/A"}</h3>
        {subtitle && <p className="text-xs font-bold text-gray-400 mt-1">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-xl ${colors[color]}`}>
        {icon}
      </div>
    </div>
  );
};

export default function AdminSystemHealth() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const api = useApi();

  useEffect(() => {
    fetchHealth();
  }, []);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/admin/system-health");
      setHealth(res.data);
    } catch (err) {
      console.error("System health error:", err);
      setError(err.response?.data?.error || "فشل تحميل بيانات النظام");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <LoadingSpinner size="lg" />
      <p className="mt-4 text-gray-500 font-black">جاري فحص حالة النظام...</p>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
      <div className="bg-red-50 dark:bg-red-900/20 p-8 rounded-2xl border border-red-200 dark:border-red-800 text-center max-w-md">
        <svg className="h-16 w-16 text-red-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h3 className="text-lg font-black text-red-600 mb-2">خطأ في تحميل البيانات</h3>
        <p className="text-sm text-red-500 font-bold mb-4">{error}</p>
        <button 
          onClick={fetchHealth}
          className="px-6 py-2.5 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 transition-all"
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  );

  if (!health) return null;

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white">مراقبة النظام</h1>
          <p className="text-gray-500 font-bold mt-1">تقرير فني شامل حول صحة قاعدة البيانات والموارد</p>
        </div>
        <button 
          onClick={fetchHealth}
          className="px-6 py-2.5 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-100 dark:shadow-none"
        >
          تحديث التقرير
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="حجم قاعدة البيانات"
          value={health.database?.size || "N/A"}
          subtitle={`${health.database?.collections || 0} مجموعة بيانات`}
          icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>}
          color="blue"
        />
        <StatCard 
          title="إجمالي الإعلانات"
          value={health.counts?.ads || 0}
          subtitle={`${health.counts?.deletedAds || 0} محذوف | ${health.counts?.archivedAds || 0} مؤرشف`}
          icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 01-2-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
          color="green"
        />
        <StatCard 
          title="المستخدمون"
          value={health.counts?.users || 0}
          subtitle="إجمالي الحسابات المسجلة"
          icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
          color="purple"
        />
        <StatCard 
          title="العمليات المالية"
          value={health.counts?.financialOperations || 0}
          subtitle={`${health.counts?.commissions || 0} عمولة بيع`}
          icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          color="orange"
        />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 p-8 shadow-sm">
        <h2 className="text-xl font-black mb-6">تقرير حالة البيانات</h2>
        {health.counts?.ads > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="font-bold text-gray-500">معدل الحذف</span>
                <span className="font-black">{((health.counts.deletedAds / health.counts.ads) * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-red-500 h-full" style={{ width: `${Math.min((health.counts.deletedAds / health.counts.ads) * 100, 100)}%` }}></div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="font-bold text-gray-500">معدل الأرشفة</span>
                <span className="font-black">{((health.counts.archivedAds / health.counts.ads) * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-yellow-500 h-full" style={{ width: `${Math.min((health.counts.archivedAds / health.counts.ads) * 100, 100)}%` }}></div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-gray-400 font-bold text-center">لا توجد بيانات كافية لعرض التقرير</p>
        )}
      </div>

      <div className="text-center text-xs text-gray-400">
        آخر تحديث: {health.timestamp ? new Date(health.timestamp).toLocaleString("ar-EG") : "N/A"}
      </div>
    </div>
  );
}
