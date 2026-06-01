import React, { useEffect, useMemo, useState } from "react";
import { useApi } from "../api/axios.js";

export default function AdminAuditLogs() {
  const api = useApi();
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState("");
  const [route, setRoute] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const methodLabel = (m) => {
    switch (m) {
      case "POST": return "POST (إضافة)";
      case "PUT": return "PUT (تحديث)";
      case "PATCH": return "PATCH (تعديل جزئي)";
      case "DELETE": return "DELETE (حذف)";
      default: return m || "";
    }
  };
  const formatDate = (iso) => {
    const d = new Date(iso);
    // Force Gregorian calendar + Latin numerals with day/month/year order
    const locale = "en-GB-u-ca-gregory-nu-latn";
    const fmt = new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    const parts = fmt.formatToParts(d);
    const get = (t) => parts.find((p) => p.type === t)?.value || "";
    const day = get("day");
    const month = get("month");
    const year = get("year");
    const hour = get("hour");
    const minute = get("minute");
    return `${day}/${month}/${year} ${hour}:${minute}`;
  };

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const toIso = (val) => {
        if (!val) return undefined;
        const t = new Date(val);
        if (isNaN(t.getTime())) return undefined;
        return t.toISOString();
      };
      const params = { page: p, limit: 20 };
      if (method) params.method = method;
      if (route) params.route = route;
      if (from) params.from = toIso(from);
      if (to) params.to = toIso(to);
      const r = await api.get("/admin/audit-logs", { params });
      setRows(r.data?.items || []);
      setPage(r.data?.page || 1);
      setPages(r.data?.pages || 1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
    if (!from || !to) {
      const pad = (n) => String(n).padStart(2, "0");
      const now = new Date();
      const y = now.getFullYear();
      const m = pad(now.getMonth() + 1);
      const d = pad(now.getDate());
      const start = `${y}-${m}-${d}T00:00`;
      const end = `${y}-${m}-${d}T23:59`;
      if (!from) setFrom(start);
      if (!to) setTo(end);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFilter = (e) => {
    e.preventDefault();
    load(1);
  };

  const reset = () => {
    setMethod("");
    setRoute("");
    setFrom("");
    setTo("");
    load(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <h1 className="text-xl font-black text-gray-900">سجل التدقيق</h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={reset}
            className="p-2.5 bg-gray-50 text-gray-500 hover:bg-gray-100 rounded-xl transition-all border border-gray-100 active:scale-95"
            title="إعادة ضبط"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <form onSubmit={onFilter} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-[11px] font-black text-gray-400 mb-1.5 mr-1">طريقة الطلب</label>
            <select 
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" 
              value={method} 
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="">كل الطرق</option>
              <option value="POST">{methodLabel("POST")}</option>
              <option value="PUT">{methodLabel("PUT")}</option>
              <option value="PATCH">{methodLabel("PATCH")}</option>
              <option value="DELETE">{methodLabel("DELETE")}</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-black text-gray-400 mb-1.5 mr-1">المسار</label>
            <input 
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-300" 
              placeholder="مثال: /admin/users" 
              value={route} 
              onChange={(e) => setRoute(e.target.value)} 
            />
          </div>

          <div>
            <label className="block text-[11px] font-black text-gray-400 mb-1.5 mr-1">من تاريخ</label>
            <input 
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-left" 
              dir="ltr" 
              type="datetime-local" 
              value={from} 
              onChange={(e) => setFrom(e.target.value)} 
            />
          </div>

          <div>
            <label className="block text-[11px] font-black text-gray-400 mb-1.5 mr-1">إلى تاريخ</label>
            <input 
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-left" 
              dir="ltr" 
              type="datetime-local" 
              value={to} 
              onChange={(e) => setTo(e.target.value)} 
            />
          </div>

          <div className="flex items-end">
            <button className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-black shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              تصفية السجلات
            </button>
          </div>
        </form>
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-gray-400 font-bold animate-pulse">جاري تحميل السجلات...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-4 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider">الوقت والمشرف</th>
                  <th className="px-4 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider">العملية</th>
                  <th className="px-4 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider">المسار</th>
                  <th className="px-4 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider text-left">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((r) => (
                  <tr key={r._id} className="hover:bg-gray-50/30 transition-colors group">
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-black text-gray-900">{formatDate(r.createdAt)}</span>
                        <span className="text-[10px] text-gray-400 font-bold">{r.adminId?.name || r.adminId?.email || "نظام"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-black border ${
                        r.method === 'POST' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                        r.method === 'DELETE' ? 'bg-red-50 text-red-700 border-red-100' :
                        r.method === 'PUT' || r.method === 'PATCH' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                        'bg-gray-50 text-gray-600 border-gray-100'
                      }`}>
                        {methodLabel(r.method)}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-mono text-[10px] text-gray-500 dir-ltr text-right">{r.route}</td>
                    <td className="px-4 py-4 text-left">
                      <details className="group/details">
                        <summary className="list-none cursor-pointer">
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 transition-all">
                            عرض البيانات
                            <svg className="w-3 h-3 transition-transform group-open/details:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                          </span>
                        </summary>
                        <div className="mt-2 p-3 bg-gray-900 rounded-xl overflow-x-auto shadow-inner border border-gray-800">
                          <pre className="text-[10px] text-blue-300 font-mono leading-relaxed whitespace-pre-wrap break-all">
                            {JSON.stringify(r.body || {}, null, 2)}
                          </pre>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-4 py-20 text-center">
                      <div className="bg-gray-50 h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                      </div>
                      <p className="text-sm font-bold text-gray-400">لا توجد سجلات مطابقة.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mobile View - Cards */}
      <div className="block sm:hidden space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-gray-400 font-bold animate-pulse">جاري تحميل السجلات...</p>
          </div>
        ) : (
          <>
            {rows.map((r) => (
              <div key={r._id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4 transition-all active:scale-[0.99]">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black border ${
                      r.method === 'POST' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                      r.method === 'DELETE' ? 'bg-red-50 text-red-600 border-red-100' :
                      r.method === 'PUT' || r.method === 'PATCH' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                      'bg-gray-50 text-gray-500 border-gray-100'
                    }`}>
                      {r.method?.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-black text-gray-900 text-[11px]">{methodLabel(r.method)}</h3>
                      <p className="text-[10px] font-bold text-gray-400 mt-0.5">{formatDate(r.createdAt)}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-gray-700">{r.adminId?.name || "نظام"}</p>
                    <p className="text-[9px] text-gray-400 truncate max-w-[100px]">{r.adminId?.email}</p>
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <p className="text-[9px] font-black text-gray-400 mb-1 uppercase tracking-wider">المسار المستهدف</p>
                  <p className="text-[10px] font-mono font-bold text-gray-600 break-all dir-ltr">{r.route}</p>
                </div>

                <details className="group/mob-details">
                  <summary className="list-none cursor-pointer">
                    <div className="flex items-center justify-center gap-2 py-2.5 bg-gray-50 text-gray-500 rounded-xl text-[10px] font-black border border-gray-100 transition-all active:scale-95">
                      عرض بيانات الطلب
                      <svg className="w-3 h-3 transition-transform group-open/mob-details:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </summary>
                  <div className="mt-2 p-3 bg-gray-900 rounded-xl overflow-x-auto border border-gray-800">
                    <pre className="text-[9px] text-blue-300 font-mono leading-relaxed whitespace-pre-wrap break-all">
                      {JSON.stringify(r.body || {}, null, 2)}
                    </pre>
                  </div>
                </details>
              </div>
            ))}
            {rows.length === 0 && (
              <div className="bg-white p-20 text-center rounded-2xl border border-gray-100 shadow-sm">
                <div className="bg-gray-50 h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                </div>
                <p className="text-sm font-bold text-gray-400">لا توجد سجلات حالياً.</p>
              </div>
            )}
          </>
        )}
      </div>

      {!loading && pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button 
            className="px-4 py-2 text-xs font-bold bg-white border border-gray-100 rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-all active:scale-95 shadow-sm" 
            disabled={page<=1} 
            onClick={() => load(Math.max(page-1,1))}
          >
            السابق
          </button>
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-100">صفحة {page}</span>
            <span className="text-[10px] font-bold text-gray-400">من {pages}</span>
          </div>
          <button 
            className="px-4 py-2 text-xs font-bold bg-white border border-gray-100 rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-all active:scale-95 shadow-sm" 
            disabled={page>=pages} 
            onClick={() => load(Math.min(page+1,pages))}
          >
            التالي
          </button>
        </div>
      )}
    </div>
  );
}
