import React, { useEffect, useMemo, useState } from "react";
import { useApi } from "../api/axios.js";
import { t } from "../i18n/index.js";
import AdminStatsCards from "../components/AdminStatsCards.jsx";

export default function AdminDashboard() {
  const api = useApi();
  const [stats, setStats] = useState(null);
  const [overview, setOverview] = useState(null);
  const [deviceStats, setDeviceStats] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    // Fetch critical stats first
    try {
      const resS = await api.get("/admin/stats");
      setStats(resS.data);
    } catch (e) { console.error(e); }
    setLoading(false);

    // Fetch secondary stats in background
    api.get("/admin/stats/overview").then(res => setOverview(res.data)).catch(console.error);
    api.get("/admin/stats/devices").then(res => setDeviceStats(res.data)).catch(console.error);
  };

  useEffect(() => {
    load();
  }, []);

  const weeklySeries = useMemo(() => {
    if (!overview?.weeklySeries) return null;
    const { dates, newAds, newReports, activeUsers } = overview.weeklySeries;
    return (dates || []).map((d, idx) => ({
      date: new Date(d),
      newAds: newAds?.[idx] ?? 0,
      newReports: newReports?.[idx] ?? 0,
      activeUsers: activeUsers?.[idx] ?? 0
    }));
  }, [overview]);

  const weeklySummary = useMemo(() => {
    if (!weeklySeries || weeklySeries.length === 0) return null;
    const totalAds = weeklySeries.reduce((s, r) => s + (r.newAds || 0), 0);
    const totalReports = weeklySeries.reduce((s, r) => s + (r.newReports || 0), 0);
    const maxActiveUsers = Math.max(...weeklySeries.map((r) => r.activeUsers || 0), 0);
    return { totalAds, totalReports, maxActiveUsers };
  }, [weeklySeries]);

  const resetDeviceStats = async () => {
    if (!window.confirm("هل أنت متأكد من رغبتك في تصفية إحصائيات الأجهزة؟")) return;
    try {
      await api.post("/admin/stats/devices/reset");
      setDeviceStats({ android: 0, ios: 0, windows: 0, macos: 0 });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 pb-12 dark:text-slate-100">
      {/* Beta Mode Indicator */}
      <div className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center justify-between shadow-lg shadow-blue-200">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
          <span className="text-xs font-bold uppercase tracking-wider">وضع النسخة التجريبية نشط</span>
        </div>
        <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">Beta v0.1.0</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <h2 className="text-lg sm:text-xl font-black text-gray-900">{t("admin.title")}</h2>
        <button 
          onClick={load} 
          disabled={loading}
          className="self-end sm:self-auto p-2.5 rounded-xl bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100 transition-all disabled:opacity-50 active:scale-95"
          title="تحديث البيانات"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Stats Cards */}
      <AdminStatsCards stats={stats} loading={loading} />

      {weeklySeries && weeklySeries.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Weekly Table */}
          <div className="lg:col-span-2 rounded-2xl border border-gray-100 bg-white p-4 md:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 md:mb-6">
              <h3 className="text-sm font-black text-gray-900">مؤشرات أسبوعية</h3>
              <span className="self-start sm:self-auto text-[10px] font-black text-gray-400 bg-gray-50 border border-gray-100 px-2 md:px-3 py-1 rounded-lg uppercase tracking-wider">
                آخر ٧ أيام
              </span>
            </div>
            
            {/* Desktop Table - Hidden on mobile */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full text-right">
                <thead>
                  <tr className="border-b border-gray-100 text-[11px] font-black uppercase tracking-wider text-gray-400">
                    <th className="pb-3 px-2">اليوم</th>
                    <th className="pb-3 px-2 text-center">إعلانات جديدة</th>
                    <th className="pb-3 px-2 text-center">بلاغات</th>
                    <th className="pb-3 px-2 text-left">مستخدمون نشطون</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {weeklySeries.map((row) => (
                    <tr key={row.date.toISOString()} className="group hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-2 text-xs font-bold text-gray-600">
                        {row.date.toLocaleDateString("ar-YE", { weekday: "long", day: "numeric", month: "short" })}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className="inline-flex items-center rounded-lg bg-green-50 px-2.5 py-1 text-[11px] font-black text-green-700 border border-green-100">
                          {row.newAds}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-black border ${row.newReports > 0 ? "bg-red-50 text-red-700 border-red-100" : "bg-gray-50 text-gray-400 border-gray-100"}`}>
                          {row.newReports}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-left">
                        <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">{row.activeUsers}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {weeklySeries.map((row) => (
                <div key={row.date.toISOString()} className="bg-gray-50/50 rounded-xl p-4 border border-gray-100 space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <span className="text-xs font-black text-gray-900">
                      {row.date.toLocaleDateString("ar-YE", { weekday: "long", day: "numeric", month: "short" })}
                    </span>
                    <span className="text-[10px] font-black text-blue-600 bg-white px-2 py-0.5 rounded-md border border-gray-100">
                      {row.activeUsers} نشط
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-gray-400 uppercase mb-1">إعلانات جديدة</p>
                      <span className="inline-flex items-center rounded-lg bg-green-50 px-2.5 py-1 text-[11px] font-black text-green-700 border border-green-100">
                        {row.newAds}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-gray-400 uppercase mb-1">بلاغات</p>
                      <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-black border ${row.newReports > 0 ? "bg-red-50 text-red-700 border-red-100" : "bg-gray-50 text-gray-400 border-gray-100"}`}>
                        {row.newReports}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Side Cards - Stack on mobile */}
          <div className="space-y-4 md:space-y-6">
            {/* Weekly Summary */}
            <div className="rounded-2xl border border-gray-100 bg-white p-4 md:p-6 shadow-sm">
              <h3 className="mb-3 md:mb-4 text-sm font-black text-gray-900">ملخص الأسبوع</h3>
              {weeklySummary ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-green-50/50 border border-green-100">
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-green-100 p-1.5 text-green-600">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">إجمالي الإعلانات</span>
                    </div>
                    <span className="text-sm font-black text-gray-900">{weeklySummary.totalAds}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-red-50/50 border border-red-100">
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-red-100 p-1.5 text-red-600">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">إجمالي البلاغات</span>
                    </div>
                    <span className="text-sm font-black text-gray-900">{weeklySummary.totalReports}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/50 border border-blue-100">
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-blue-100 p-1.5 text-blue-600">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">أعلى نشاط</span>
                    </div>
                    <span className="text-sm font-black text-gray-900">{weeklySummary.maxActiveUsers}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-xs font-black text-gray-400 italic">بيانات غير متوفرة</div>
              )}
            </div>

            {/* Device Stats */}
            <div className="rounded-2xl border border-gray-100 bg-white p-4 md:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <h3 className="text-sm font-black text-gray-900">الأجهزة</h3>
                <button 
                  onClick={resetDeviceStats}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all border border-transparent hover:border-red-100"
                  title="تصفية الإحصائيات"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              {deviceStats ? (
                <div className="space-y-2">
                  {[
                    { key: "android", label: "أندرويد", color: "green", icon: "M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" },
                    { key: "ios", label: "آيفون", color: "blue", icon: "M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" },
                    { key: "windows", label: "ويندوز", color: "indigo", icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
                    { key: "macos", label: "ماك", color: "gray", icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" }
                  ].map(({ key, label, color, icon }) => (
                    <div key={key} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50/50 border border-gray-100">
                      <div className="flex items-center gap-2">
                        <div className={`rounded-lg bg-${color}-100 p-1.5 text-${color}-600`}>
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={icon} />
                          </svg>
                        </div>
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">{label}</span>
                      </div>
                      <span className="text-sm font-black text-gray-900">{deviceStats[key]}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-xs font-black text-gray-400 italic">بيانات غير متوفرة</div>
              )}
            </div>

            {/* Info Card */}
            <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-4 md:p-6 text-white shadow-lg shadow-blue-100">
              <h4 className="text-sm font-black opacity-90">لوحة الإحصائيات الذكية</h4>
              <p className="mt-2 text-[10px] font-bold leading-relaxed opacity-75 uppercase tracking-wider">
                تساعدك هذه البيانات على تتبع أداء المنصة واتخاذ قرارات إدارية مبنية على الأرقام.
              </p>
              <div className="mt-3 md:mt-4 flex gap-2">
                <div className="h-1 flex-1 rounded-full bg-white/20">
                  <div className="h-full w-2/3 rounded-full bg-white"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
