import React, { useEffect, useMemo, useState } from "react";
import { useApi } from "../api/axios.js";
import { uploadsUrl } from "../lib/uploads.js";

export default function AdminAds() {
  const api = useApi();
  const [filter, setFilter] = useState("");
  const [ads, setAds] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState(null);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState("");
  const [cityId, setCityId] = useState("");
  const [cities, setCities] = useState([]);
  const [sortKey, setSortKey] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");
  const [historyFor, setHistoryFor] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);

  const load = async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get("/admin/ads", {
        params: {
          status: filter || undefined,
          q: search || undefined,
          cityId: cityId || undefined,
          page,
          limit: 20
        }
      });
      setAds(res.data.ads || []);
      setPagination(res.data.pagination || { page: 1, pages: 1, total: 0 });
    } finally {
      setLoading(false);
    }
  };

  const getCurrencySymbol = (code) => {
    const symbols = {
      USD: "$",
      SAR: "ر.س",
      YER_ADEN: "ر.ي (عدن)",
      YER_SANAA: "ر.ي (صنعاء)",
      YER: "ر.ي (عدن)"
    };
    return symbols[code] || "ر.ي (عدن)";
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, search, cityId]);

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const cityRes = await api.get("/cities");
        setCities(cityRes.data || []);
      } catch (e) {
        console.error(e);
      }
    };
    loadFilters();
  }, [api]);

  const getStatusLabel = (s) => {
    switch (s) {
      case "pending": return "قيد الانتظار";
      case "approved": return "مقبول";
      case "rejected": return "مرفوض";
      case "sold": return "مباع";
      default: return s;
    }
  };

  const badge = (s) =>
    s === "pending"
      ? "bg-yellow-50 text-yellow-700"
      : s === "approved"
      ? "bg-green-50 text-green-700"
      : s === "sold"
      ? "bg-blue-50 text-blue-700"
      : "bg-red-50 text-red-700";

  const toast = (m, type = "info") => {
    window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: m, type } }));
  };
  const setStatus = async (id, status) => {
    const prev = ads;
    setAds((arr) => arr.map((a) => (String(a._id) === String(id) ? { ...a, status } : a)));
    try {
      await api.patch(`/admin/ads/${id}/status`, { status });
      toast(status === "approved" ? "تمت الموافقة" : "تم الرفض", status === "approved" ? "success" : "info");
      load();
    } catch {
      setAds(prev);
      toast("تعذر تحديث الحالة", "error");
    }
  };

  const toggleSelected = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selected.length === ads.length) {
      setSelected([]);
    } else {
      setSelected(ads.map((a) => a._id));
    }
  };

  const bulkStatus = async (status) => {
    if (!selected.length) return;
    const ids = selected;
    try {
      await api.post("/admin/ads/bulk-status", { ids, status });
      toast("تم تحديث حالة الإعلانات المحددة", "success");
      setSelected([]);
      load();
    } catch {
      toast("تعذر تنفيذ العملية الجماعية", "error");
    }
  };

  const openHistory = async (id) => {
    setHistoryFor(id);
    try {
      const res = await api.get(`/admin/ads/${id}/history`);
      setHistoryItems(res.data || []);
    } catch (e) {
      console.error(e);
      setHistoryItems([]);
    }
  };

  const sortedAds = useMemo(() => {
    const list = [...ads];
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      const get = (item) => {
        if (sortKey === "seller") return item.userId?.name || item.seller?.name || "";
        if (sortKey === "city") return item.cityId?.name || "";
        if (sortKey === "price") return Number(item.price) || 0;
        if (sortKey === "status") return item.status || "";
        return item.createdAt || "";
      };
      const av = get(a);
      const bv = get(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return list;
  }, [ads, sortKey, sortDir]);
  const remove = async (id) => {
    const prev = ads;
    setAds((arr) => arr.filter((a) => String(a._id) !== String(id)));
    try {
      await api.delete(`/admin/ads/${id}`);
      toast("تم الحذف", "success");
    } catch {
      setAds(prev);
      toast("تعذر الحذف", "error");
    }
  };

  if (loading && ads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-[11px] font-black text-gray-400 animate-pulse">جاري تحميل الإعلانات...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="relative w-full sm:w-64">
              <input
                type="search"
                placeholder="بحث بعنوان الإعلان..."
                className="w-full pr-10 pl-4 py-2.5 bg-gray-50 border-gray-100 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            
            <div className="grid grid-cols-2 sm:flex items-center gap-3">
              <select 
                className="bg-gray-50 border-gray-100 rounded-xl text-xs font-bold px-3 py-2.5 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all w-full sm:w-auto" 
                value={filter} 
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">كل الحالات</option>
                <option value="pending">قيد الانتظار</option>
                <option value="approved">مقبول</option>
                <option value="rejected">مرفوض</option>
                <option value="sold">مباع</option>
              </select>

              <select
                className="bg-gray-50 border-gray-100 rounded-xl text-xs font-bold px-3 py-2.5 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all w-full sm:w-auto"
                value={cityId}
                onChange={(e) => setCityId(e.target.value)}
              >
                <option value="">كل المدن</option>
                {cities.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-start gap-3 bg-gray-50 p-1.5 rounded-xl border border-gray-100 w-full lg:w-auto">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider px-2">فرز بحسب:</span>
            <div className="flex items-center gap-2 flex-1 sm:flex-none justify-end sm:justify-start">
              <select
                className="bg-white border-gray-100 rounded-lg text-[11px] font-bold px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all w-full sm:w-auto h-8"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
              >
                <option value="createdAt">الأحدث</option>
                <option value="seller">البائع</option>
                <option value="city">المدينة</option>
                <option value="price">السعر</option>
                <option value="status">الحالة</option>
              </select>
              <button
                type="button"
                className="p-1.5 bg-white shadow-sm border border-gray-100 rounded-lg transition-all text-gray-600 hover:bg-gray-50 active:scale-95"
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                title={sortDir === "asc" ? "تصاعدي" : "تنازلي"}
              >
                {sortDir === "asc" ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-1v12m0 0l-4-4m4 4l4-4" /></svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-gray-50">
          <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              disabled={!selected.length}
              className="flex items-center justify-center gap-2 bg-green-50 text-green-700 border border-green-100 px-4 py-2.5 rounded-xl text-xs font-black hover:bg-green-100 disabled:opacity-40 transition-all active:scale-95"
              onClick={() => bulkStatus("approved")}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              <span>موافقة جماعية</span>
            </button>
            <button
              type="button"
              disabled={!selected.length}
              className="flex items-center justify-center gap-2 bg-red-50 text-red-700 border border-red-100 px-4 py-2.5 rounded-xl text-xs font-black hover:bg-red-100 disabled:opacity-40 transition-all active:scale-95"
              onClick={() => bulkStatus("rejected")}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              <span>رفض جماعي</span>
            </button>
          </div>
          {selected.length > 0 && (
            <span className="text-center sm:text-right text-[11px] font-black text-blue-600 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 animate-in zoom-in-95 w-full sm:w-auto">
              {selected.length} إعلان محدد
            </span>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hidden sm:block">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-right text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-4 py-4 w-10">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={ads.length > 0 && selected.length === ads.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">الصورة</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">العنوان</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">المستخدم</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">السعر</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">الموقع</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider text-center">الحالة</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider text-center">مميز</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`s-${i}`} className="animate-pulse">
                    <td className="px-4 py-4"><div className="h-4 w-4 bg-gray-100 rounded" /></td>
                    <td className="px-4 py-4"><div className="h-12 w-16 bg-gray-100 rounded-xl" /></td>
                    <td className="px-4 py-4"><div className="h-4 w-48 bg-gray-100 rounded" /></td>
                    <td className="px-4 py-4"><div className="h-4 w-24 bg-gray-100 rounded" /></td>
                    <td className="px-4 py-4"><div className="h-4 w-12 bg-gray-100 rounded" /></td>
                    <td className="px-4 py-4"><div className="h-4 w-32 bg-gray-100 rounded" /></td>
                    <td className="px-4 py-4"><div className="h-6 w-20 bg-gray-100 rounded-full mx-auto" /></td>
                    <td className="px-4 py-4"><div className="h-4 w-4 bg-gray-100 rounded mx-auto" /></td>
                    <td className="px-4 py-4"><div className="h-8 w-32 bg-gray-100 rounded-lg" /></td>
                  </tr>
                ))}
              {!loading && sortedAds.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 01-2-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                      </div>
                      <p className="text-sm font-bold text-gray-400">لا توجد إعلانات مطابقة للبحث</p>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && sortedAds.map((a) => (
                <tr key={a._id} className="hover:bg-gray-50/80 transition-all group">
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={selected.includes(a._id)}
                      onChange={() => toggleSelected(a._id)}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-12 w-16 overflow-hidden rounded-xl bg-gray-50 border border-gray-100 shadow-sm group-hover:scale-105 transition-transform">
                      {a.images?.[0] ? (
                        <img
                          src={uploadsUrl(a.images[0], "thumb")}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-gray-300">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm font-bold text-gray-900 line-clamp-1 max-w-[200px]" title={a.title}>
                      {a.title}
                    </div>
                    <div className="text-[10px] text-gray-400 font-bold mt-0.5 uppercase tracking-tighter">ID: {a._id.slice(-6)}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-black border border-blue-100">
                        {(a.userId?.name || "ب").charAt(0)}
                      </div>
                      <span className="text-xs font-bold text-gray-700">{a.userId?.name || "-"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm font-black text-blue-600">
                      {a.price?.toLocaleString()} {getCurrencySymbol(a.currency)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-xs font-bold text-gray-600">
                    <div className="flex flex-col gap-0.5">
                      <span>{a.governorateId?.name || "-"}</span>
                      {a.cityId?.name && <span className="text-[10px] text-gray-400">{a.cityId.name}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black border ${badge(a.status)}`}>
                      {getStatusLabel(a.status)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    {a.featured || a.isFeatured ? (
                      <span className="text-lg drop-shadow-sm" title="إعلان مميز">👑</span>
                    ) : (
                      <span className="text-gray-200 font-bold">-</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5">
                      {a.status !== "approved" && (
                        <button 
                          className="p-2 rounded-xl bg-green-50 text-green-600 border border-green-100 hover:bg-green-100 transition-all active:scale-90" 
                          onClick={() => setStatus(a._id, "approved")}
                          title="موافقة"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        </button>
                      )}
                      {a.status !== "rejected" && (
                        <button 
                          className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-all active:scale-90" 
                          onClick={() => setStatus(a._id, "rejected")}
                          title="رفض"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                      <button 
                        className="p-2 rounded-xl bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100 transition-all active:scale-90" 
                        onClick={() => openHistory(a._id)}
                        title="سجل التعديلات"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </button>
                      <button 
                        className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-all active:scale-90" 
                        onClick={() => setToDelete(a._id)}
                        title="حذف"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile View - Cards */}
      <div className="block sm:hidden space-y-4">
        {!loading && sortedAds.length === 0 && (
          <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 01-2-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              </div>
              <p className="text-sm font-bold text-gray-400">لا توجد إعلانات مطابقة للبحث</p>
            </div>
          </div>
        )}

        {!loading && sortedAds.map((a) => (
          <div key={a._id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4 transition-all active:scale-[0.99]">
            <div className="flex gap-4">
              <div className="h-20 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-gray-50 border border-gray-100 relative shadow-sm">
                {a.images?.[0] ? (
                  <img src={uploadsUrl(a.images[0], "thumb")} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-gray-300">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                )}
                {(a.featured || a.isFeatured) && (
                  <span className="absolute right-1 top-1 z-10 text-xs drop-shadow-sm">👑</span>
                )}
              </div>
              <div className="min-w-0 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-black text-gray-900 text-sm line-clamp-2 leading-snug">
                      {a.title}
                    </h3>
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5"
                      checked={selected.includes(a._id)}
                      onChange={() => toggleSelected(a._id)}
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-blue-600 font-black text-sm">
                      {a.price?.toLocaleString()} {getCurrencySymbol(a.currency)}
                    </p>
                    <span className="text-[10px] text-gray-400 font-black uppercase tracking-tighter">ID: {a._id.slice(-6)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400">
                  <div className="flex items-center gap-1.5 truncate">
                    <div className="h-4 w-4 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[8px] font-black border border-blue-100 flex-shrink-0">
                      {(a.userId?.name || "ب").charAt(0)}
                    </div>
                    <span className="truncate">{a.userId?.name || "-"}</span>
                  </div>
                  <span>•</span>
                  <span className="truncate">{a.governorateId?.name}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-black">
              <div className="bg-gray-50/50 p-2 rounded-xl border border-gray-100 flex justify-between items-center">
                <p className="text-gray-400">الحالة</p>
                <span className={`px-2 py-0.5 rounded-lg border ${badge(a.status)}`}>
                  {getStatusLabel(a.status)}
                </span>
              </div>
              <div className="bg-gray-50/50 p-2 rounded-xl border border-gray-100 flex justify-between items-center">
                <p className="text-gray-400">تاريخ النشر</p>
                <p className="text-gray-700">{a.createdAt ? new Date(a.createdAt).toLocaleDateString("ar-YE") : "-"}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
              {a.status !== "approved" && (
                <button 
                  onClick={() => setStatus(a._id, "approved")}
                  className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-xs font-black hover:bg-green-700 active:scale-95 transition-all shadow-md shadow-green-100 flex items-center justify-center gap-2"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  موافقة
                </button>
              )}
              {a.status !== "rejected" && (
                <button 
                  onClick={() => setStatus(a._id, "rejected")}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-xs font-black hover:bg-red-700 active:scale-95 transition-all shadow-md shadow-red-100 flex items-center justify-center gap-2"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                  رفض
                </button>
              )}
              <div className="flex gap-2">
                <button 
                  onClick={() => openHistory(a._id)}
                  className="p-2.5 bg-gray-50 text-gray-600 border border-gray-100 rounded-xl hover:bg-gray-100 transition-all active:scale-90"
                  title="سجل التعديلات"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </button>
                <button 
                  onClick={() => setToDelete(a._id)}
                  className="p-2.5 bg-red-50 text-red-600 border border-red-100 rounded-xl hover:bg-red-100 transition-all active:scale-90"
                  title="حذف"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-6">
          <button
            disabled={pagination.page === 1}
            onClick={() => load(pagination.page - 1)}
            className="p-2 rounded-xl bg-white border border-gray-100 text-gray-600 disabled:opacity-30 hover:bg-gray-50 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
          
          <div className="flex items-center gap-1">
            {[...Array(Math.min(5, pagination.pages))].map((_, i) => {
              let pageNum;
              if (pagination.pages <= 5) pageNum = i + 1;
              else if (pagination.page <= 3) pageNum = i + 1;
              else if (pagination.page >= pagination.pages - 2) pageNum = pagination.pages - 4 + i;
              else pageNum = pagination.page - 2 + i;

              return (
                <button
                  key={pageNum}
                  onClick={() => load(pageNum)}
                  className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${
                    pagination.page === pageNum 
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-100" 
                    : "bg-white border border-gray-100 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            disabled={pagination.page === pagination.pages}
            onClick={() => load(pagination.page + 1)}
            className="p-2 rounded-xl bg-white border border-gray-100 text-gray-600 disabled:opacity-30 hover:bg-gray-50 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
        </div>
      )}

      {toDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200 max-h-[70vh] flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="w-10 h-10 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-3 mx-auto border border-red-100">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </div>
              <div className="text-center space-y-2 mb-4">
                <h3 className="text-base font-black text-gray-900">تأكيد الحذف</h3>
                <p className="text-xs text-gray-500 font-bold">هل تريد بالتأكيد حذف هذا الإعلان؟ لا يمكن التراجع عن هذه العملية.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4 shrink-0">
              <button 
                className="flex-1 rounded-xl border border-gray-100 px-3 py-2 text-xs font-black text-gray-500 hover:bg-gray-50 transition-all active:scale-95" 
                onClick={() => setToDelete(null)}
              >
                إلغاء
              </button>
              <button
                className="flex-1 rounded-xl bg-red-600 px-3 py-2 text-xs font-black text-white hover:bg-red-700 transition-all active:scale-95 shadow-lg shadow-red-100"
                onClick={() => {
                  remove(toDelete);
                  setToDelete(null);
                }}
              >
                حذف الإعلان
              </button>
            </div>
          </div>
        </div>
      )}

      {historyFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-2xl bg-white p-4 shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200 max-h-[70vh] flex flex-col overflow-hidden">
            <div className="mb-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h3 className="text-base font-black text-gray-900">سجل التعديلات</h3>
              </div>
              <button
                type="button"
                className="p-1.5 bg-gray-50 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-all"
                onClick={() => {
                  setHistoryFor(null);
                  setHistoryItems([]);
                }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
              {historyItems.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <p className="text-gray-400 font-bold">لا يوجد سجل تعديلات لهذا الإعلان</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {historyItems.map((item, idx) => (
                    <div key={idx} className="relative pr-8 before:absolute before:right-3 before:top-2 before:bottom-0 before:w-px before:bg-gray-100 last:before:hidden">
                      <div className="absolute right-0 top-1 w-6 h-6 rounded-full bg-blue-50 border-2 border-white shadow-sm flex items-center justify-center z-10">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                      </div>
                      <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black text-gray-400 bg-white px-2 py-0.5 rounded-lg border border-gray-100">
                            {new Date(item.createdAt).toLocaleString("ar-YE")}
                          </span>
                          <span className="text-[10px] font-black text-blue-600">
                            {item.adminId?.name || "مشرف"}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-gray-700 leading-relaxed">
                          {item.action || item.method}
                        </p>
                        {item.route && (
                          <div className="mt-2 text-[10px] text-gray-500 bg-white/50 p-2 rounded-lg border border-gray-50 italic">
                            {item.route}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
