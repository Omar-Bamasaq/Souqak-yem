import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../api/axios.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";

export default function AdminReports() {
  const [allRows, setAllRows] = useState([]);
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("all"); // all | ad | seller
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;
  const filtered = useMemo(() => {
    if (kind === "all") return allRows;
    return allRows.filter((r) => r.kind === kind);
  }, [allRows, kind]);
  const pages = useMemo(() => Math.max(1, Math.ceil((filtered.length || 0) / PAGE_SIZE)), [filtered.length]);
  const load = async () => {
    setLoading(true);
    try {
      const [adsRes, sellersRes] = await Promise.all([
        api.get("/admin/reports", { params: { status: status || undefined, page: 1, limit: 200 } }),
        api.get("/admin/seller-reports", { params: { status: status || undefined, page: 1, limit: 200 } })
      ]);
      const ads = (adsRes.data?.items || adsRes.data || []).map((r) => ({ ...r, kind: "ad" }));
      const sellers = (sellersRes.data?.items || sellersRes.data || []).map((r) => ({ ...r, kind: "seller" }));
      const merged = [...ads, ...sellers].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAllRows(merged);
      setPage(1);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);
  useEffect(() => {
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    setRows(filtered.slice(start, end));
  }, [filtered, page]);
  const updateStatus = async (id, s) => {
    const item = allRows.find((r) => r._id === id);
    if (!item) return;
    setActionId(id);
    if (item.kind === "seller") {
      await api.patch(`/admin/seller-reports/${id}/status`, { status: s });
    } else {
      await api.patch(`/admin/reports/${id}/status`, { status: s });
    }
    setActionId("");
    load();
  };
  const remove = async (id) => {
    const item = allRows.find((r) => r._id === id);
    if (!item) return;
    setActionId(id);
    if (item.kind === "seller") {
      await api.delete(`/admin/seller-reports/${id}`);
    } else {
      await api.delete(`/admin/reports/${id}`);
    }
    setActionId("");
    load();
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <h1 className="text-xl font-black text-gray-900">إدارة البلاغات</h1>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100 w-full sm:w-auto">
            <button
              className={`flex-1 sm:flex-none px-4 py-1.5 text-[11px] font-black rounded-lg transition-all ${kind === 'all' ? 'bg-white text-gray-900 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => { setKind('all'); setPage(1); }}
            >
              الكل
            </button>
            <button
              className={`flex-1 sm:flex-none px-4 py-1.5 text-[11px] font-black rounded-lg transition-all ${kind === 'ad' ? 'bg-white text-gray-900 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => { setKind('ad'); setPage(1); }}
            >
              الإعلانات
            </button>
            <button
              className={`flex-1 sm:flex-none px-4 py-1.5 text-[11px] font-black rounded-lg transition-all ${kind === 'seller' ? 'bg-white text-gray-900 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => { setKind('seller'); setPage(1); }}
            >
              البائعين
            </button>
          </div>
          <select 
            className="flex-1 sm:flex-none px-4 py-2 bg-white border border-gray-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" 
            value={status} 
            onChange={(e) => { setStatus(e.target.value); }}
          >
            <option value="">كل الحالات</option>
            <option value="open">مفتوح</option>
            <option value="reviewed">تمت المراجعة</option>
            <option value="dismissed">مرفوض</option>
          </select>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-gray-400 font-bold animate-pulse">جاري تحميل البلاغات...</p>
          </div>
        ) : (
          <table className="w-full text-right text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-4 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider">النوع</th>
                <th className="px-4 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider">المحتوى / البائع</th>
                <th className="px-4 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider">المبلّغ</th>
                <th className="px-4 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider">ضد</th>
                <th className="px-4 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider">الفئة</th>
                <th className="px-4 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider">السبب والتفاصيل</th>
                <th className="px-4 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider text-center">الحالة</th>
                <th className="px-4 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r) => (
                <tr key={r._id} className="hover:bg-gray-50/30 transition-colors group">
                  <td className="px-4 py-4 whitespace-nowrap">
                    {r.kind === "seller" ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-black bg-purple-50 text-purple-700 border border-purple-100">بائع</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-100">إعلان</span>
                    )}
                  </td>
                  <td className="px-4 py-4 max-w-[180px]">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      {r.kind === "ad" ? (
                        <>
                          <span className="font-bold text-gray-900 truncate text-xs" title={r.adId?.title}>{r.adId?.title || "إعلان محذوف"}</span>
                          {r.adId?._id && (
                            <Link to={`/ad/${r.adId._id}`} className="text-blue-600 hover:text-blue-700 text-[10px] font-black flex items-center gap-1">
                              عرض الإعلان
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </Link>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="font-bold text-gray-900 truncate text-xs">{r.sellerId?.name || r.sellerId?.email || "بائع غير معروف"}</span>
                          {r.sellerId?._id && (
                            <Link to={`/s/${r.sellerId._id}`} className="text-blue-600 hover:text-blue-700 text-[10px] font-black flex items-center gap-1">
                              عرض الملف الشخصي
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </Link>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-gray-800">{r.reporterId?.name || "مستخدم"}</span>
                      <span className="text-[9px] text-gray-400 font-mono truncate max-w-[120px]">{r.reporterId?.email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-gray-800">
                        {r.kind === "ad"
                          ? (r.adId?.userId?.name || r.adId?.userId?.email || "غير معروف")
                          : (r.sellerId?.name || r.sellerId?.email || "غير معروف")}
                      </span>
                      <span className="text-[9px] text-gray-400 font-mono truncate max-w-[120px]">
                        {r.kind === "ad" ? r.adId?.userId?.email : r.sellerId?.email}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-[10px] font-black text-gray-500 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100 uppercase">{r.category || "عام"}</span>
                  </td>
                  <td className="px-4 py-4 max-w-[200px]">
                    <div className="flex flex-col gap-1">
                      <span className="font-black text-gray-900 text-[11px]">{r.reason}</span>
                      {r.details && (
                        <p className="text-[10px] text-gray-400 line-clamp-1 hover:line-clamp-none transition-all cursor-help bg-gray-50/50 p-1 rounded" title={r.details}>
                          {r.details}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black border ${
                      r.status === 'open' ? 'bg-red-50 text-red-700 border-red-100' :
                      r.status === 'reviewed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                      'bg-gray-50 text-gray-600 border-gray-100'
                    }`}>
                      {r.status === 'open' ? 'مفتوح' : r.status === 'reviewed' ? 'تمت المراجعة' : 'مرفوض'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-left whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                      <button 
                        className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-all border border-emerald-100 disabled:opacity-50 active:scale-95" 
                        disabled={actionId===r._id} 
                        onClick={() => updateStatus(r._id, "reviewed")}
                        title="تمت المراجعة"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                      </button>
                      <button 
                        className="p-2 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-xl transition-all border border-amber-100 disabled:opacity-50 active:scale-95" 
                        disabled={actionId===r._id} 
                        onClick={() => updateStatus(r._id, "dismissed")}
                        title="رفض البلاغ"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                      <button 
                        className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-all border border-red-100 disabled:opacity-50 active:scale-95" 
                        disabled={actionId===r._id} 
                        onClick={() => remove(r._id)}
                        title="حذف نهائي"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="px-4 py-20 text-center" colSpan="8">
                    <div className="bg-gray-50 h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                    </div>
                    <p className="text-sm font-bold text-gray-400">لا توجد بلاغات حالياً.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile View - Cards */}
      <div className="block sm:hidden space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-gray-400 font-bold animate-pulse">جاري تحميل البلاغات...</p>
          </div>
        ) : (
          <>
            {rows.length === 0 && (
              <div className="bg-white p-20 text-center rounded-2xl border border-gray-100 shadow-sm">
                <div className="bg-gray-50 h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                </div>
                <p className="text-sm font-bold text-gray-400">لا توجد بلاغات حالياً.</p>
              </div>
            )}
            {rows.map((r) => (
              <div key={r._id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4 transition-all active:scale-[0.99]">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black border ${
                      r.kind === "seller" ? "bg-purple-50 text-purple-600 border-purple-100" : "bg-blue-50 text-blue-600 border-blue-100"
                    }`}>
                      {r.kind === "seller" ? "ب" : "إ"}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-black text-gray-900 text-sm truncate">
                        {r.kind === "ad" ? (r.adId?.title || "إعلان محذوف") : (r.sellerId?.name || "بائع غير معروف")}
                      </h3>
                      <p className="text-[10px] font-bold text-gray-400 mt-0.5">
                        نوع البلاغ: {r.kind === "seller" ? "بائع" : "إعلان"}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border uppercase ${
                    r.status === 'open' ? 'bg-red-50 text-red-600 border-red-100' :
                    r.status === 'reviewed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                    'bg-gray-100 text-gray-600 border-gray-200'
                  }`}>
                    {r.status === 'open' ? 'مفتوح' : r.status === 'reviewed' ? 'تمت المراجعة' : 'مرفوض'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
                  <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
                    <p className="text-gray-400 mb-0.5">المبلّغ</p>
                    <p className="text-gray-700 truncate">{r.reporterId?.name || "مستخدم"}</p>
                  </div>
                  <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
                    <p className="text-gray-400 mb-0.5">الفئة</p>
                    <p className="text-blue-600">{r.category || "عام"}</p>
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-1">
                  <p className="text-[10px] font-bold text-gray-400">السبب والتفاصيل:</p>
                  <p className="text-xs font-black text-gray-900">{r.reason}</p>
                  {r.details && (
                    <p className="text-[11px] text-gray-500 leading-relaxed mt-1">
                      {r.details}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <div className="flex-1 flex gap-2">
                    {r.kind === "ad" ? r.adId?._id && (
                      <Link to={`/ad/${r.adId._id}`} className="flex-1 bg-blue-50 text-blue-600 py-2.5 rounded-xl text-[10px] font-black border border-blue-100 flex items-center justify-center gap-1 active:scale-95 transition-all">
                        عرض الإعلان
                      </Link>
                    ) : r.sellerId?._id && (
                      <Link to={`/s/${r.sellerId._id}`} className="flex-1 bg-purple-50 text-purple-600 py-2.5 rounded-xl text-[10px] font-black border border-purple-100 flex items-center justify-center gap-1 active:scale-95 transition-all">
                        عرض البائع
                      </Link>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <button 
                      className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 active:scale-95 transition-all" 
                      onClick={() => updateStatus(r._id, "reviewed")}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                    </button>
                    <button 
                      className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 active:scale-95 transition-all" 
                      onClick={() => updateStatus(r._id, "dismissed")}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                    <button 
                      className="p-2.5 bg-red-50 text-red-600 rounded-xl border border-red-100 active:scale-95 transition-all" 
                      onClick={() => remove(r._id)}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
      {!loading && pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button 
            className="px-4 py-2 text-xs font-bold bg-white border border-gray-100 rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-all active:scale-95" 
            disabled={page<=1} 
            onClick={() => setPage((p) => Math.max(p-1,1))}
          >
            السابق
          </button>
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">صفحة {page}</span>
            <span className="text-[10px] font-bold text-gray-400">من {pages}</span>
          </div>
          <button 
            className="px-4 py-2 text-xs font-bold bg-white border border-gray-100 rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-all active:scale-95" 
            disabled={page>=pages} 
            onClick={() => setPage((p) => Math.min(p+1,pages))}
          >
            التالي
          </button>
        </div>
      )}
    </div>
  );
}
