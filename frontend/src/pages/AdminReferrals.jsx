import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";

export default function AdminReferrals() {
  const api = useApi();
  const [overview, setOverview] = useState(null);
  const [commissions, setCommissions] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.get("/admin/referrals/overview"), api.get("/admin/referrals/commissions")])
      .then(([summary, items]) => { setOverview(summary.data); setCommissions(items.data); })
      .catch(() => setError("تعذر تحميل بيانات سفراء سوقك."));
  }, []);

  return <main dir="rtl" className="space-y-6 p-4 md:p-8">
    <header><h1 className="text-2xl font-black text-slate-900 dark:text-white">سفراء سوقك</h1><p className="mt-1 text-slate-500">متابعة الإحالات والمكافآت والسحوبات.</p></header>
    {error && <p className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    <section className="grid gap-4 sm:grid-cols-3">{[["السفراء", overview?.ambassadors || 0], ["المستخدمون المحالون", overview?.relationships || 0], ["السجلات المالية", Object.values(overview?.commissions || {}).reduce((sum, item) => sum + item.count, 0)]].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{Number(value).toLocaleString()}</p></div>)}</section>
    <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"><table className="w-full text-right text-sm"><thead className="bg-slate-50 dark:bg-slate-800"><tr><th className="px-4 py-3">المصدر</th><th className="px-4 py-3">الإيراد</th><th className="px-4 py-3">المكافأة</th><th className="px-4 py-3">الحالة</th></tr></thead><tbody>{commissions.map(item => <tr key={item._id} className="border-t border-slate-100 dark:border-slate-800"><td className="px-4 py-3">{item.platformRevenueType}</td><td className="px-4 py-3">{item.platformRevenueAmount.toLocaleString()} {item.currency}</td><td className="px-4 py-3">{item.commissionAmount.toLocaleString()} {item.currency}</td><td className="px-4 py-3">{item.status}</td></tr>)}</tbody></table>{!commissions.length && <p className="p-8 text-center text-slate-500">لا توجد مكافآت حتى الآن.</p>}</section>
  </main>;
}
