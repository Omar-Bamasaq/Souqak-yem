import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../api/axios.js";

export default function SellerCommissions() {
  const api = useApi();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await api.get("/commissions/mine");
      setItems(res.data || []);
    } catch {
      setErr("تعذر تحميل بيانات العمولات");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const getCurrencySymbol = (code) => {
    const symbols = {
      USD: "$",
      SAR: "ر.س",
      YER_ADEN: "ر.ي (عدن)",
      YER_SANAA: "ر.ي (صنعاء)",
      YER: "ر.ي"
    };
    return symbols[code] || "ر.ي";
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "unpaid": return "غير مدفوعة";
      case "paid": return "مدفوعة";
      case "overdue": return "متأخرة";
      case "Pending": return "قيد المراجعة";
      case "Rejected": return "مرفوضة";
      default: return status;
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case "paid": return "bg-green-100 text-green-700 border border-green-200";
      case "Rejected": return "bg-red-100 text-red-700 border border-red-200";
      case "Pending": return "bg-yellow-100 text-yellow-700 border border-yellow-200";
      case "unpaid": return "bg-gray-100 text-gray-700 border border-gray-200";
      case "overdue": return "bg-orange-100 text-orange-700 border border-orange-200";
      default: return "bg-gray-100 text-gray-600 border border-gray-200";
    }
  };

  return (
    <div className="space-y-6 pb-20 sm:pb-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-black text-gray-900">عمولاتي</h2>
          <p className="text-sm text-gray-500 font-bold">تتبع حالة عمولات إعلاناتك المباعة وسداد المستحقات</p>
        </div>
        <Link 
          to="/commission/pay" 
          className="flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-2xl text-sm font-black hover:bg-brand-700 transition-all shadow-lg shadow-brand-100"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          دفع عمولة جديدة
        </Link>
      </div>

      {err && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600 border border-red-100">{err}</div>}

      {/* Mobile Cards View */}
      <div className="grid grid-cols-1 gap-4 sm:hidden">
        {loading ? (
          <div className="py-12 text-center text-gray-400 font-bold italic bg-white rounded-2xl border border-gray-100">جاري التحميل...</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-gray-400 font-bold italic bg-white rounded-2xl border border-gray-100">لا توجد عمولات مسجلة حالياً.</div>
        ) : items.map((c) => (
          <div key={c._id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex justify-between items-start">
              <h3 className="font-bold text-gray-900 text-sm line-clamp-2 max-w-[70%]">{c.adId?.title || "—"}</h3>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black ${getStatusClass(c.status)}`}>
                {getStatusLabel(c.status)}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-50">
              <div>
                <p className="text-[10px] text-gray-400 font-black uppercase">سعر البيع</p>
                <p className="font-black text-blue-600 text-sm">{c.price?.toLocaleString()} {getCurrencySymbol(c.currency)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-black uppercase">العمولة</p>
                <p className="font-black text-emerald-600 text-sm">{c.commissionAmount?.toLocaleString()} {getCurrencySymbol(c.currency)}</p>
              </div>
            </div>

            {(c.status === "unpaid" || c.status === "Rejected") && (
              <Link 
                to={`/commission/pay?adId=${c.adId?._id || ""}&salePrice=${c.price || ""}&currency=${c.currency || ""}`}
                className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white py-3 rounded-xl text-xs font-black hover:bg-brand-700 transition-all shadow-lg shadow-brand-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                إعادة دفع العمولة
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden sm:block overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-right text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 font-black">
              <tr>
                <th className="px-4 py-3">اسم الإعلان</th>
                <th className="px-4 py-3">سعر البيع</th>
                <th className="px-4 py-3">قيمة العمولة</th>
                <th className="px-4 py-3">تاريخ البيع</th>
                <th className="px-4 py-3">حالة العمولة</th>
                <th className="px-4 py-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400 font-bold">جاري التحميل...</td></tr>
              )}
              {!loading && items.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400 font-bold">لا توجد عمولات مسجلة حالياً.</td></tr>
              )}
              {!loading && items.map((c) => (
                <tr key={c._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-bold text-gray-900">{c.adId?.title || "—"}</td>
                  <td className="px-4 py-3 font-black text-blue-600">
                    {c.price?.toLocaleString()} {getCurrencySymbol(c.currency)}
                  </td>
                  <td className="px-4 py-3 font-black text-emerald-600">
                    {c.commissionAmount?.toLocaleString()} {getCurrencySymbol(c.currency)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-bold">
                    {c.soldAt ? new Date(c.soldAt).toLocaleDateString() : (c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—")}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black ${getStatusClass(c.status)}`}>
                      {getStatusLabel(c.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {(c.status === "unpaid" || c.status === "Rejected") && (
                      <Link 
                        to={`/commission/pay?adId=${c.adId?._id || ""}&salePrice=${c.price || ""}&currency=${c.currency || ""}`}
                        className="inline-flex items-center gap-1 bg-brand-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black hover:bg-brand-700 transition-colors shadow-sm"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {c.status === "Rejected" ? "إعادة دفع العمولة" : "دفع العمولة"}
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
