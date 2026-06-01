import React, { useMemo } from "react";

export default function AdminDashboardNew() {
  const stats = useMemo(
    () => ({
      totalAds: 1240,
      pending: 37,
      users: 890,
      featured: 62
    }),
    []
  );
  const pendingAds = useMemo(
    () => [
      { id: "1", title: "هاتف سامسونج S22 نظيف", seller: "أحمد", price: 550, createdAt: "2026-02-18" },
      { id: "2", title: "سيارة تويوتا كورولا 2016", seller: "محمد", price: 3100, createdAt: "2026-02-18" },
      { id: "3", title: "شقة غرفتين في صنعاء", seller: "ياسر", price: 22000, createdAt: "2026-02-17" },
      { id: "4", title: "طقم صالون مودرن", seller: "ربى", price: 420, createdAt: "2026-02-17" },
      { id: "5", title: "حاسوب محمول i7 رام 16GB", seller: "سالم", price: 480, createdAt: "2026-02-16" }
    ],
    []
  );
  const card = "rounded-lg border bg-white p-4 shadow-sm";
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={card}>
          <div className="text-xs text-gray-500">عدد الإعلانات</div>
          <div className="text-2xl font-bold">{stats.totalAds}</div>
        </div>
        <div className={card}>
          <div className="text-xs text-gray-500">قيد المراجعة</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
        </div>
        <div className={card}>
          <div className="text-xs text-gray-500">عدد المستخدمين</div>
          <div className="text-2xl font-bold">{stats.users}</div>
        </div>
        <div className={card}>
          <div className="text-xs text-gray-500">الإعلانات المميزة</div>
          <div className="text-2xl font-bold text-amber-700">{stats.featured}</div>
        </div>
      </div>

      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">آخر 5 إعلانات بانتظار المراجعة</h3>
        </div>
        <div className="divide-y">
          {pendingAds.map((ad) => (
            <div key={ad.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{ad.title}</div>
                <div className="text-xs text-gray-500">{ad.seller} • ${ad.price} • {ad.createdAt}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-xs text-yellow-700">Pending</span>
                <button className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50">موافقة</button>
                <button className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50">رفض</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
