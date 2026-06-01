import React from "react";

export default function AdminStatsCards({ stats, loading }) {
  if (loading && !stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 md:h-32 animate-pulse rounded-2xl bg-gray-100 dark:bg-slate-800"></div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "الإعلانات النشطة",
      value: stats?.active?.count ?? 0,
      icon: (
        <svg className="h-5 w-5 md:h-6 md:w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      bgColor: "bg-green-50 dark:bg-green-900/20",
      indicator: `+${stats?.active?.change ?? 0}`,
      indicatorLabel: "هذا الأسبوع",
      indicatorColor: "text-green-600"
    },
    {
      title: "المنتهية",
      value: stats?.expired?.count ?? 0,
      icon: (
        <svg className="h-5 w-5 md:h-6 md:w-6 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bgColor: "bg-gray-50 dark:bg-gray-800/50",
      indicator: new Date(stats?.expired?.lastUpdate || Date.now()).toLocaleDateString("ar-EG"),
      indicatorLabel: "آخر تحديث",
      indicatorColor: "text-gray-500"
    },
    {
      title: "الإعلانات المميزة",
      value: stats?.featured?.count ?? 0,
      icon: (
        <svg className="h-5 w-5 md:h-6 md:w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.382-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ),
      bgColor: "bg-amber-50 dark:bg-amber-900/20",
      indicator: `${stats?.featured?.ratio ?? 0}%`,
      indicatorLabel: "من الإجمالي",
      indicatorColor: "text-amber-600"
    },
    {
      title: "الحسابات الموثقة",
      value: stats?.verified?.count ?? 0,
      icon: (
        <svg className="h-5 w-5 md:h-6 md:w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
      indicator: `${stats?.verified?.growth ?? 0}%`,
      indicatorLabel: "نمو أسبوعي",
      indicatorColor: "text-blue-600"
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {cards.map((card, idx) => (
        <div
          key={idx}
          className={`group relative overflow-hidden rounded-2xl border border-gray-100 dark:border-slate-800 p-4 md:p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${card.bgColor}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs md:text-sm font-medium text-gray-500 truncate">{card.title}</p>
              <h3 className="mt-1 text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{Number(card.value).toLocaleString("ar-EG")}</h3>
            </div>
            <div className="rounded-xl p-2 bg-white dark:bg-slate-800 shadow-sm">
              {card.icon}
            </div>
          </div>
          <div className="mt-3 md:mt-4 flex items-center gap-1.5">
            <span className={`text-[10px] md:text-xs font-bold ${card.indicatorColor}`}>
              {card.indicator}
            </span>
            <span className="text-[10px] md:text-[10px] text-gray-400 font-medium">{card.indicatorLabel}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
