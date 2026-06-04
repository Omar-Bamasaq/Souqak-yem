import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useApi } from "../api/axios.js";
import AdminEscrowDashboard from "./AdminEscrowDashboard.jsx";
import AdminEscrowMonitoring from "./AdminEscrowMonitoring.jsx";
import AdminSoldAds from "./AdminSoldAds.jsx";
import AdminFeaturedRequests from "./AdminFeaturedRequests.jsx";
import AdminVerificationRequests from "./AdminVerificationRequests.jsx";
import AdminPlans from "./AdminPlans.jsx";
import AdminBankAccounts from "./AdminBankAccounts.jsx";
import AdminWithdrawals from "./AdminWithdrawals.jsx"; // I'll create this one if it doesn't exist or merge logic

export default function AdminFinanceHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const api = useApi();
  const activeTab = searchParams.get("tab") || "escrow";
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get("/admin/escrow/system-balance");
        setStats(res.data);
      } catch (err) {
        console.error("Fetch finance stats error:", err);
      }
    };
    fetchStats();
  }, []);

  const tabs = [
    { id: "escrow", label: "الوساطة والمالية", icon: "🛡️" },
    { id: "monitoring", label: "مراقبة العمليات", icon: "👁️" },
    { id: "commissions", label: "المبيعات والعمولات", icon: "💰" },
    { id: "withdrawals", label: "المحفظة والسحوبات", icon: "💸" },
    { id: "requests", label: "طلبات التمييز", icon: "🌟" },
    { id: "verification", label: "طلبات التوثيق", icon: "✅" },
    { id: "plans", label: "الباقات", icon: "📦" },
    { id: "banks", label: "الحسابات البنكية", icon: "🏦" },
  ];

  const handleTabChange = (id) => {
    setSearchParams({ tab: id });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/50 dark:bg-blue-900/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-blue-100/50 transition-all duration-700"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-4">
            <span className="p-4 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-100 dark:shadow-none">🏦</span>
            مركز الحسابات المالية
          </h1>
          <p className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-widest mr-20">إدارة كافة العمليات المالية والعمولات من لوحة واحدة</p>
        </div>

        {stats && (
          <div className="flex gap-4 relative z-10 overflow-x-auto no-scrollbar pb-2 sm:pb-0">
            <div className="flex flex-col items-center px-6 py-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800/30">
              <span className="text-[10px] font-black text-emerald-600 uppercase mb-1">إجمالي الوساطة</span>
              <span className="text-lg font-black text-emerald-700 dark:text-emerald-400">{(stats.totalEscrow || 0).toLocaleString()} <small className="text-[10px]">ر.ي</small></span>
            </div>
            <div className="flex flex-col items-center px-6 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800/30">
              <span className="text-[10px] font-black text-blue-600 uppercase mb-1">أرباح المنصة</span>
              <span className="text-lg font-black text-blue-700 dark:text-blue-400">{(stats.totalSystemCommissions || 0).toLocaleString()} <small className="text-[10px]">ر.ي</small></span>
            </div>
          </div>
        )}
      </div>

      {/* Horizontal Tabs */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-2 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm sticky top-4 z-40 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-100 dark:shadow-none"
                  : "text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === "escrow" && <AdminEscrowDashboard />}
        {activeTab === "monitoring" && <AdminEscrowMonitoring />}
        {activeTab === "commissions" && <AdminSoldAds />}
        {activeTab === "withdrawals" && <AdminWithdrawals />}
        {activeTab === "requests" && <AdminFeaturedRequests />}
        {activeTab === "verification" && <AdminVerificationRequests />}
        {activeTab === "plans" && <AdminPlans />}
        {activeTab === "banks" && <AdminBankAccounts />}
      </div>
    </div>
  );
}
