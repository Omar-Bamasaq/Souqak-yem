import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";
import { useNavigate, Link } from "react-router-dom";
import { uploadsUrl } from "../lib/uploads.js";

export default function MyAds() {
  const api = useApi();
  const navigate = useNavigate();
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [soldDialogAd, setSoldDialogAd] = useState(null);
  const [soldSubmitting, setSoldSubmitting] = useState(false);
  const [soldError, setSoldError] = useState("");
  const [showSoldSuccessModal, setShowSoldSuccessModal] = useState(false);
  const [lastSoldAdId, setLastSoldAdId] = useState("");

  const [potentialBuyers, setPotentialBuyers] = useState([]);
  const [selectedBuyerId, setSelectedBuyerId] = useState("");
  const [loadingBuyers, setLoadingBuyers] = useState(false);

  const fetchPotentialBuyers = async (adId) => {
    setLoadingBuyers(true);
    try {
      const res = await api.get(`/ads/${adId}/potential-buyers`);
      setPotentialBuyers(res.data || []);
      if (res.data?.length > 0) {
        setSelectedBuyerId(res.data[0]._id);
      }
    } catch (err) {
      console.error("Error fetching buyers:", err);
    } finally {
      setLoadingBuyers(false);
    }
  };

  useEffect(() => {
    if (soldDialogAd) {
      fetchPotentialBuyers(soldDialogAd._id);
    } else {
      setPotentialBuyers([]);
      setSelectedBuyerId("");
    }
  }, [soldDialogAd]);

  const remainingDays = (d) => {
    if (!d) return 0;
    const ms = new Date(d).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
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

  const getStatusLabel = (s) => {
    switch (s) {
      case "pending": return "قيد الانتظار";
      case "approved": return "مقبول";
      case "rejected": return "مرفوض";
      case "sold": return "مباع";
      default: return s;
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/ads/my${filter ? `?status=${filter}` : ""}`);
      setAds(res.data || []);
    } catch {
      setAds([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="ds-title">إعلاناتي</h2>
        <div>
          <select className="ds-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">الكل</option>
            <option value="pending">قيد الانتظار</option>
            <option value="approved">مقبول</option>
            <option value="rejected">مرفوض</option>
            <option value="sold">المباعة</option>
          </select>
        </div>
      </div>
      <div className="hidden sm:block overflow-hidden rounded-lg border bg-white shadow-sm">
        <table className="w-full text-right text-sm">
          <thead className="bg-gray-50 text-xs text-gray-600">
            <tr>
              <th className="px-3 py-2 text-right">الصورة</th>
              <th className="px-3 py-2 text-right">العنوان</th>
              <th className="px-3 py-2 text-right">السعر</th>
              <th className="px-3 py-2 text-right">الموقع</th>
              <th className="px-3 py-2 text-right">المشاهدات</th>
              <th className="px-3 py-2 text-right">تاريخ النشر</th>
              <th className="px-3 py-2 text-right">تاريخ الانتهاء</th>
              <th className="px-3 py-2 text-right">متبقٍ</th>
              <th className="px-3 py-2 text-right">الحالة</th>
              <th className="px-3 py-2 text-right">وضع البيع</th>
              <th className="px-3 py-2 text-right">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`s-${i}`}>
                  <td className="px-3 py-2"><div className="h-12 w-16 animate-pulse rounded-md bg-gray-200" /></td>
                  <td className="px-3 py-2"><div className="h-4 w-40 animate-pulse rounded bg-gray-200" /></td>
                  <td className="px-3 py-2"><div className="h-4 w-12 animate-pulse rounded bg-gray-200" /></td>
                  <td className="px-3 py-2"><div className="h-4 w-32 animate-pulse rounded bg-gray-200" /></td>
                  <td className="px-3 py-2"><div className="h-4 w-12 animate-pulse rounded bg-gray-200" /></td>
                  <td className="px-3 py-2"><div className="h-5 w-16 animate-pulse rounded bg-gray-200" /></td>
                </tr>
              ))}
            {!loading && ads.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center text-xs text-gray-500">لا توجد إعلانات.</td>
              </tr>
            )}
            {!loading && ads.map((a) => (
              <tr key={a._id} className={`hover:bg-gray-50 ${a.sold ? "bg-green-50/40" : ""}`}>
                <td className="px-3 py-2">
                  <div className="h-12 w-16 overflow-hidden rounded-md bg-gray-200">
                    {a.images?.[0] && <img src={uploadsUrl(a.images[0])} alt="" className="h-full w-full object-cover" />}
                  </div>
                </td>
                <td className="px-3 py-2 font-medium">
                  {a.title}
                  {a.sold && <span className="mr-2 inline-flex items-center rounded bg-green-100 px-2 py-0.5 text-xs text-green-800 align-middle">مباع</span>}
                </td>
                <td className="px-3 py-2">
                  {a.price} {getCurrencySymbol(a.currency)}
                </td>
                <td className="px-3 py-2 text-gray-600">
                  {a.governorateId?.name || "-"}
                  {a.governorateId?.name && a.cityId?.name ? " • " : ""}
                  {a.cityId?.name || ""}
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1 font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-xs">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {a.viewCount || a.views || 0}
                  </span>
                </td>
                <td className="px-3 py-2">{a.publishedAt ? new Date(a.publishedAt).toLocaleDateString() : "-"}</td>
                <td className="px-3 py-2">{a.expiresAt ? new Date(a.expiresAt).toLocaleDateString() : "-"}</td>
                <td className="px-3 py-2">
                  {a.expiresAt ? (
                    new Date(a.expiresAt).getTime() <= Date.now() ? (
                      <span className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-700">منتهي</span>
                    ) : (
                      <span className={`rounded px-2 py-0.5 text-xs ${remainingDays(a.expiresAt) <= 2 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
                        {remainingDays(a.expiresAt)} يوم
                      </span>
                    )
                  ) : "-"}
                </td>
                <td className="px-3 py-2">
                  {getStatusLabel(a.status)}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-2">
                    {a.sold ? <span className="rounded bg-green-50 px-2 py-0.5 text-xs text-green-800">مباع</span> :
                     a.isArchived ? <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">مؤرشف</span> :
                     (
                       <>
                         <span className="rounded bg-yellow-50 px-2 py-0.5 text-xs text-yellow-800">نشط</span>
                         {a.status === "approved" && (new Date() - new Date(a.publishedAt || a.createdAt)) > (3 * 24 * 60 * 60 * 1000) && (
                           <button
                             onClick={async () => {
                               if (window.confirm("هل أنت متأكد أن السلعة بيعت؟ سيتم إغلاق المحادثات المتعلقة بهذا الإعلان.")) {
                                 try {
                                   await api.patch(`/ads/${a._id}/close`, { reason: "sold" });
                                   load();
                                   window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تم تحديث حالة الإعلان بنجاح", type: "success" } }));
                                 } catch {
                                   window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تعذر تحديث الحالة", type: "error" } }));
                                 }
                               }
                             }}
                             className="text-[10px] bg-brand-600 text-white px-2 py-1 rounded hover:bg-brand-700 transition-colors font-bold whitespace-nowrap"
                           >
                             هل تم البيع؟
                           </button>
                         )}
                       </>
                     )
                    }
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {!a.sold && !a.isArchived && (
                      <Link
                        to={`/edit-ad/${a._id}`}
                        className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50 inline-block"
                      >
                        تعديل
                      </Link>
                    )}
                    {!a.featured && !a.sold && !a.isArchived && a.status === "approved" && (
                      <div className="relative group">
                        <Link
                          to="/seller/subscriptions"
                          className="rounded-md border px-2 py-1 text-xs bg-amber-500 text-white hover:bg-amber-600 inline-block font-black shadow-sm animate-pulse-subtle"
                        >
                          تمييز ✨
                        </Link>
                        {/* Tooltip for desktop */}
                        <div className="absolute bottom-full right-0 mb-2 w-48 hidden group-hover:block bg-slate-900 text-white text-[10px] p-2 rounded-lg shadow-xl z-20 animate-in fade-in slide-in-from-bottom-1">
                          هل تريد بيع سلعتك أسرع؟ ميز إعلانك ليظهر في المقدمة لآلاف المشترين!
                        </div>
                      </div>
                    )}
                    {(a.status === "rejected" || a.status === "expired") && (
                      <button
                        className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                        onClick={async () => {
                          try {
                            await api.patch(`/ads/${a._id}/republish`);
                            load();
                          } catch {}
                        }}
                      >
                        إعادة نشر
                      </button>
                    )}
                    {a.featured && (
                      <span className="hidden sm:inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                        👑 {a.featuredAt ? new Date(a.featuredAt).toLocaleDateString() : "-"} → {a.featuredExpiresAt || a.featuredUntil ? new Date(a.featuredExpiresAt || a.featuredUntil).toLocaleDateString() : "-"} • {remainingDays(a.featuredExpiresAt || a.featuredUntil)} يوم
                      </span>
                    )}
                    {!a.sold && !a.isArchived && a.status === "approved" && (
                      <>
                        <button
                          className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                          onClick={() => {
                            if (a.sold) return;
                            setSoldError("");
                            setSoldDialogAd(a);
                          }}
                        >
                          تم البيع
                        </button>
                        <button
                          className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                          onClick={async () => {
                            try {
                              await api.patch(`/ads/${a._id}/close`, { reason: "archive" });
                              setAds((prev) => prev.map((x) => (x._id === a._id ? { ...x, isArchived: true } : x)));
                            } catch {}
                          }}
                        >
                          أرشفة
                        </button>
                      </>
                    )}
                    {a.sold && !a.isArchived && (
                      <button
                        className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                        onClick={async () => {
                          if (!confirm("الإعلان مباع. تأكيد الأرشفة؟ هذا الإجراء نهائي.")) return;
                          try {
                            await api.patch(`/ads/${a._id}/close`, { reason: "archive" });
                            setAds((prev) => prev.map((x) => (x._id === a._id ? { ...x, isArchived: true } : x)));
                          } catch {}
                        }}
                      >
                        أرشفة
                      </button>
                    )}
                    <button
                      className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50 text-red-600 border-red-100 hover:bg-red-50"
                      onClick={async () => {
                        if (a.sold) {
                          if (!confirm("الإعلان مباع. تأكيد الحذف؟ هذا الإجراء نهائي ولا يمكن التراجع.")) return;
                        } else {
                          if (!confirm("حذف الإعلان؟")) return;
                        }
                        try {
                          await api.delete(`/ads/${a._id}`);
                          setAds((prev) => prev.filter((x) => x._id !== a._id));
                        } catch {}
                      }}
                    >
                      حذف
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile View - Cards */}
      <div className="block sm:hidden space-y-3">
        {loading &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={`ms-${i}`} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm animate-pulse space-y-3">
              <div className="flex gap-3">
                <div className="h-20 w-24 bg-gray-200 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-full bg-gray-200 rounded" />
                  <div className="h-4 w-2/3 bg-gray-200 rounded" />
                </div>
              </div>
              <div className="h-8 w-full bg-gray-200 rounded-lg" />
            </div>
          ))}
        {!loading && ads.length === 0 && (
          <div className="bg-white p-8 text-center rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-sm text-gray-500 font-bold">لا توجد إعلانات حالياً.</p>
          </div>
        )}
        {!loading && ads.map((a) => (
          <div key={a._id} className={`bg-white p-4 rounded-2xl border shadow-sm space-y-4 transition-all ${a.sold ? "border-green-100 bg-green-50/20" : "border-gray-100"}`}>
            <div className="flex gap-4">
              <div className="h-20 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-gray-50 border border-gray-100 relative">
                {a.images?.[0] ? (
                  <img src={uploadsUrl(a.images[0])} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-gray-300">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                )}
                {a.featured && (
                  <span className="absolute right-1 top-1 z-10 text-xs">👑</span>
                )}
              </div>
              <div className="min-w-0 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-black text-gray-900 text-sm line-clamp-2 leading-snug">
                    {a.title}
                    {a.sold && <span className="mr-2 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-black text-green-700 align-middle">مباع</span>}
                  </h3>
                  <p className="text-blue-600 font-black text-sm mt-1">
                    {a.price} {getCurrencySymbol(a.currency)}
                  </p>
                  {a.status === "approved" && !a.sold && !a.isArchived && (new Date() - new Date(a.publishedAt || a.createdAt)) > (3 * 24 * 60 * 60 * 1000) && (
                    <button
                      onClick={async () => {
                        if (window.confirm("هل أنت متأكد أن السلعة بيعت؟ سيتم إغلاق المحادثات المتعلقة بهذا الإعلان.")) {
                          try {
                            await api.patch(`/ads/${a._id}/close`, { reason: "sold" });
                            load();
                            window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تم تحديث حالة الإعلان بنجاح", type: "success" } }));
                          } catch {
                            window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تعذر تحديث الحالة", type: "error" } }));
                          }
                        }
                      }}
                      className="mt-2 w-full text-xs bg-brand-600 text-white px-3 py-2 rounded-xl hover:bg-brand-700 transition-all font-black shadow-sm flex items-center justify-center gap-2"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      هل تم بيع هذا الإعلان؟
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400">
                  <span className="truncate">{a.governorateId?.name}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
                    <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    {a.viewCount || a.views || 0}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
              <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
                <p className="text-gray-400 mb-0.5">تاريخ النشر</p>
                <p className="text-gray-700">{a.publishedAt ? new Date(a.publishedAt).toLocaleDateString() : "-"}</p>
              </div>
              <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
                <p className="text-gray-400 mb-0.5">تاريخ الانتهاء</p>
                <p className="text-gray-700">{a.expiresAt ? new Date(a.expiresAt).toLocaleDateString() : "-"}</p>
              </div>
              <div className="bg-gray-50 p-2 rounded-xl border border-gray-100 flex justify-between items-center">
                <p className="text-gray-400">الحالة</p>
                <span className="text-blue-600">{a.status === "approved" ? "مقبول" : a.status === "pending" ? "قيد الانتظار" : a.status === "rejected" ? "مرفوض" : a.status}</span>
              </div>
              <div className="bg-gray-50 p-2 rounded-xl border border-gray-100 flex justify-between items-center">
                <p className="text-gray-400">متبقٍ</p>
                {a.expiresAt ? (
                  new Date(a.expiresAt).getTime() <= Date.now() ? (
                    <span className="text-red-600 font-black">منتهي</span>
                  ) : (
                    <span className={`font-black ${remainingDays(a.expiresAt) <= 2 ? "text-amber-600" : "text-emerald-600"}`}>
                      {remainingDays(a.expiresAt)} يوم
                    </span>
                  )
                ) : "-"}
              </div>
              {a.featured && (
                <div className="col-span-2 bg-indigo-50 p-2 rounded-xl border border-indigo-100 flex justify-between items-center">
                  <p className="text-indigo-400">تمييز الإعلان</p>
                  <span className="text-indigo-700 flex items-center gap-1">
                    👑 {remainingDays(a.featuredExpiresAt || a.featuredUntil)} يوم متبقٍ
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-50">
              {!a.sold && !a.isArchived && (
                <Link to={`/edit-ad/${a._id}`} className="flex-1 text-center py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-black hover:bg-blue-100 transition-all">تعديل</Link>
              )}
              {(a.status === "rejected" || a.status === "expired") && (
                <button onClick={async () => { try { await api.patch(`/ads/${a._id}/republish`); load(); } catch {} }} className="flex-1 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-black hover:bg-emerald-100 transition-all">إعادة نشر</button>
              )}
              {!a.sold && !a.isArchived && a.status === "approved" && (
                <>
                  {!a.featured && (
                    <Link 
                      to="/seller/subscriptions" 
                      className="flex-[2] text-center py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl text-xs font-black hover:shadow-lg hover:shadow-orange-200 transition-all active:scale-95 flex items-center justify-center gap-1"
                    >
                      <span>تمييز</span>
                      <span className="text-[10px]">✨</span>
                    </Link>
                  )}
                  <button onClick={() => { if (a.sold) return; setSoldError(""); setSoldDialogAd(a); }} className="flex-1 py-2 bg-amber-50 text-amber-600 rounded-xl text-xs font-black hover:bg-amber-100 transition-all">كمباع</button>
                  <button onClick={async () => { try { await api.patch(`/ads/${a._id}/close`, { reason: "archive" }); setAds((prev) => prev.map((x) => (x._id === a._id ? { ...x, isArchived: true } : x))); } catch {} }} className="flex-1 py-2 bg-gray-50 text-gray-600 rounded-xl text-xs font-black hover:bg-gray-100 transition-all">أرشفة</button>
                </>
              )}
              {a.sold && !a.isArchived && (
                <button onClick={async () => { if (!confirm("الإعلان مباع. تأكيد الأرشفة؟")) return; try { await api.patch(`/ads/${a._id}/close`, { reason: "archive" }); setAds((prev) => prev.map((x) => (x._id === a._id ? { ...x, isArchived: true } : x))); } catch {} }} className="flex-1 py-2 bg-gray-50 text-gray-600 rounded-xl text-xs font-black hover:bg-gray-100 transition-all">أرشفة</button>
              )}
              <button onClick={async () => { if (confirm(a.sold ? "تأكيد حذف الإعلان المباع نهائياً؟" : "حذف الإعلان؟")) { try { await api.delete(`/ads/${a._id}`); setAds((prev) => prev.filter((x) => x._id !== a._id)); } catch {} } }} className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-black hover:bg-red-100 transition-all">حذف</button>
            </div>
          </div>
        ))}
      </div>
      {soldDialogAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2.5rem] bg-white p-8 shadow-2xl text-right">
            <h3 className="text-xl font-black text-gray-900 mb-2">تأكيد بيع السلعة</h3>
            <p className="text-sm text-gray-500 font-bold mb-6">يرجى اختيار المشتري من قائمة المحادثات لتمكينه من تقييمك.</p>
            
            {loadingBuyers ? (
              <div className="py-8 flex justify-center">
                <div className="w-8 h-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
              </div>
            ) : potentialBuyers.length > 0 ? (
              <div className="space-y-4 mb-6">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest px-1">المشتري المتفق معه:</label>
                <div className="grid gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                  {potentialBuyers.map(buyer => (
                    <button
                      key={buyer._id}
                      onClick={() => setSelectedBuyerId(buyer._id)}
                      className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all ${
                        selectedBuyerId === buyer._id 
                        ? "border-blue-600 bg-blue-50/50" 
                        : "border-gray-100 hover:border-gray-200"
                      }`}
                    >
                      <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center font-black text-gray-600 border border-gray-200">
                        {buyer.name?.charAt(0)}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-gray-900">{buyer.name}</p>
                        <p className="text-[10px] font-bold text-gray-400">{buyer.phone || buyer.email}</p>
                      </div>
                      {selectedBuyerId === buyer._id && (
                        <div className="mr-auto text-blue-600">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 border-2 border-amber-100 p-4 rounded-2xl mb-6">
                <p className="text-xs font-bold text-amber-700 leading-relaxed text-center">
                  ⚠️ لا توجد محادثات لهذا الإعلان. لا يمكن تحديد المشتري وبالتالي لن يكون هناك تقييم لهذه العملية.
                </p>
              </div>
            )}

            {soldError && <div className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600 border border-red-100">{soldError}</div>}
            
            <div className="flex gap-3">
              <button
                disabled={soldSubmitting || (potentialBuyers.length > 0 && !selectedBuyerId)}
                className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl text-sm font-black hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-100"
                onClick={async () => {
                  if (!soldDialogAd) return;
                  setSoldSubmitting(true);
                  setSoldError("");
                  try {
                    const id = soldDialogAd._id;
                    if (selectedBuyerId) {
                      // Use new endpoint for linked sale
                      await api.patch(`/ads/${id}/mark-sold`, { 
                        buyerId: selectedBuyerId,
                        buyerType: "DIRECT" 
                      });
                    } else {
                      // Fallback to old close logic if no buyer selected
                      await api.patch(`/ads/${id}/close`, { reason: "sold" });
                    }
                    
                    setAds((prev) => prev.map((x) => (x._id === id ? { ...x, sold: true } : x)));
                    setLastSoldAdId(id);
                    setSoldDialogAd(null);
                    setShowSoldSuccessModal(true);
                  } catch (e) {
                    setSoldError(e.response?.data?.error || "حدث خطأ أثناء التحديث.");
                  } finally {
                    setSoldSubmitting(false);
                  }
                }}
              >
                {soldSubmitting ? "جاري الحفظ..." : "تأكيد البيع"}
              </button>
              <button
                disabled={soldSubmitting}
                className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl text-sm font-black hover:bg-gray-200 transition-all disabled:opacity-50"
                onClick={() => setSoldDialogAd(null)}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {showSoldSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl text-center animate-in zoom-in duration-300">
            <div className="mb-4 flex justify-center">
              <div className="rounded-full bg-green-100 p-3">
                <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h3 className="mb-2 text-xl font-black text-gray-900">مبروك بيع السلعة 🎉</h3>
            <p className="mb-6 text-sm text-gray-600 font-bold leading-relaxed">
              تم تحديث حالة الإعلان بنجاح.
            </p>
            <div className="flex flex-col gap-3">
              <button
                className="w-full py-4 bg-brand-600 text-white rounded-2xl text-sm font-black hover:bg-brand-700 transition-all shadow-lg shadow-brand-100"
                onClick={() => setShowSoldSuccessModal(false)}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
