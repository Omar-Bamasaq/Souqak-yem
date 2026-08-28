import React, { useEffect, useState, useRef } from "react";
import { useApi } from "../api/axios.js";
import { useAuth } from "../store/AuthContext.jsx";
import axios from "axios";

function uploadsBaseUrl() {
  let envUrl = import.meta.env.VITE_UPLOADS_URL;
  if (!envUrl) {
    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
    envUrl = apiBase.replace(/\/api$/, "").replace(/\/$/, "") + "/uploads";
  }
  if (envUrl.endsWith("/uploads")) return envUrl;
  return envUrl.endsWith("/") ? `${envUrl}uploads` : `${envUrl}/uploads`;
}
const SENSITIVE_KWS = ["receipts", "ids", "kyc", "documents"];
function protectedFileUrl(filename, token) {
  if (!filename) return "";
  if (filename.startsWith("http")) return filename;
  let clean = filename;
  if (filename.startsWith("/uploads/")) clean = filename.replace("/uploads/", "");
  else if (filename.startsWith("uploads/")) clean = filename.replace("uploads/", "");
  const base = `${uploadsBaseUrl()}/${clean}`;
  const isSensitive = SENSITIVE_KWS.some(kw => {
    const c = clean.toLowerCase().replace(/\\/g, "/");
    return c.startsWith(kw + "/") || c.includes("/" + kw + "/") || c === kw;
  });
  if (!isSensitive) return base;
  if (!token) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}access_token=${encodeURIComponent(token)}`;
}

const ID_PLACEHOLDER = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><rect width="800" height="500" fill="#f9fafb"/><circle cx="400" cy="200" r="60" fill="#fee2e2" stroke="#ef4444" stroke-width="2"/><text x="400" y="230" font-family="Arial,sans-serif" font-size="72" font-weight="bold" fill="#dc2626" text-anchor="middle">!</text><text x="400" y="320" font-family="Arial,sans-serif" font-size="26" font-weight="bold" fill="#7f1d1d" text-anchor="middle">الصورة غير متوفرة</text><text x="400" y="370" font-family="Arial,sans-serif" font-size="16" fill="#991b1b" text-anchor="middle">تعذر تحميل مستند الهوية</text></svg>`);

async function fetchProtectedImageBlob(filePath, token) {
  if (!filePath || !token) return null;
  try {
    const envBase = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
    let base = envBase.replace(/\/$/, "");
    if (!base.endsWith("/api")) base = `${base}/api`;
    const upBase = base.replace(/\/api$/, "") + "/uploads";
    let clean = filePath;
    if (filePath.startsWith("/uploads/")) clean = filePath.replace("/uploads/", "");
    else if (filePath.startsWith("uploads/")) clean = filePath.replace("uploads/", "");
    const fileUrl = `${upBase}/${clean}`;
    const res = await axios.get(fileUrl, {
      responseType: "blob",
      timeout: 60000,
      withCredentials: true,
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.data && res.data.type && res.data.type.includes("svg")) {
      const text = await res.data.text();
      if (text.includes("تسجيل الدخول مطلوب") || text.includes("وصول مرفوض")) return null;
    }
    return URL.createObjectURL(res.data);
  } catch (err) {
    console.error("[AdminVerificationRequests] blob fetch failed:", err.message);
    return null;
  }
}

export default function AdminVerificationRequests() {
  const api = useApi();
  const { token: authToken } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingId, setRejectingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/verification-requests/admin", {
        params: { status: statusFilter, q: searchQuery }
      });
      setRequests(res.data || []);
    } catch (err) {
      console.error("Load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    load();
  };

  const approve = async (id) => {
    if (!window.confirm("هل أنت متأكد من الموافقة على طلب التوثيق؟")) return;
    setLoading(true);
    try {
      console.log(`[Admin] Approving verification request: ${id}`);
      await api.patch(`/verification-requests/admin/${id}/approve`);
      setOpenId(null);
      load();
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تم قبول التوثيق بنجاح", type: "success" } }));
    } catch (err) {
      console.error("[Admin] Error approving verification request:", err);
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "فشل في قبول التوثيق", type: "error" } }));
    } finally {
      setLoading(false);
    }
  };

  const reject = async (id) => {
    if (!rejectReason) {
      alert("يجب إدخال سبب الرفض");
      return;
    }
    setRejectingId(id);
    try {
      console.log(`[Admin] Rejecting verification request: ${id} with reason: ${rejectReason}`);
      await api.patch(`verification-requests/admin/${id}/reject`, { rejectionReason: rejectReason });
      setOpenId(null);
      setRejectReason("");
      load();
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تم رفض الطلب بنجاح", type: "success" } }));
    } catch (err) {
      console.error("[Admin] Error rejecting verification request:", err);
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "فشل في رفض الطلب", type: "error" } }));
    } finally {
      setRejectingId(null);
    }
  };

  const getStatusLabel = (s) => {
    switch (s) {
      case "pending": return "قيد الانتظار";
      case "approved": return "مقبول";
      case "rejected": return "مرفوض";
      default: return s;
    }
  };

  const req = requests.find((r) => r._id === openId);

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-gray-900">طلبات التوثيق (النظام المجاني)</h2>
          <p className="text-gray-400 font-bold text-xs mt-1">إجمالي الطلبات: {requests.length}</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {["", "pending", "approved", "rejected"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-xl text-xs font-black border transition-all ${
                statusFilter === s 
                  ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100" 
                  : "bg-gray-50 text-gray-500 border-gray-100 hover:bg-white"
              }`}
            >
              {s === "" ? "الكل" : getStatusLabel(s)}
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="بحث بالاسم، رقم الهاتف، أو اسم المستخدم..."
          className="flex-1 bg-white border border-gray-100 rounded-2xl px-6 py-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
        />
        <button type="submit" className="bg-white border border-gray-100 p-4 rounded-2xl text-blue-600 hover:bg-blue-50 transition-all shadow-sm">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </button>
      </form>
      
      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading && requests.length === 0 ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-3xl animate-pulse" />
          ))
        ) : requests.map((r) => (
          <div key={r._id} className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-lg font-black border border-blue-100">
                  {r.fullName?.charAt(0) || "U"}
                </div>
                <div>
                  <h3 className="font-black text-gray-900 leading-tight">{r.fullName}</h3>
                  <p className="text-[10px] font-bold text-gray-400 mt-0.5">@{r.user?.name}</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-black border ${
                r.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : 
                r.status === "rejected" ? "bg-red-50 text-red-700 border-red-100" : 
                "bg-amber-50 text-amber-700 border-amber-100"
              }`}>
                {getStatusLabel(r.status)}
              </span>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400 font-bold">رقم الهاتف:</span>
                <span className="text-gray-700 font-black font-mono">{r.phone}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400 font-bold">الدولة:</span>
                <span className="text-gray-700 font-black">{r.country}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400 font-bold">التاريخ:</span>
                <span className="text-gray-700 font-black">{new Date(r.createdAt).toLocaleDateString('ar-YE')}</span>
              </div>
            </div>

            <button 
              onClick={() => setOpenId(r._id)}
              className="w-full bg-gray-50 text-gray-600 font-black py-3 rounded-xl border border-gray-100 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all group-hover:shadow-lg group-hover:shadow-blue-100"
            >
              عرض التفاصيل والمراجعة
            </button>
          </div>
        ))}
      </div>

      {!loading && requests.length === 0 && (
        <div className="bg-white rounded-[2rem] p-20 text-center border border-gray-100">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-200 mx-auto mb-6">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
          <h3 className="text-xl font-black text-gray-900">لا توجد طلبات توثيق</h3>
          <p className="text-gray-400 font-bold mt-2">جرب تغيير الفلتر أو كلمة البحث</p>
        </div>
      )}

      {/* Details Modal */}
      {openId && req && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[95vh] rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-8 lg:p-12 shadow-2xl border border-blue-100 animate-in zoom-in-95 duration-200 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-6 sm:mb-10 sticky top-0 bg-white dark:bg-slate-900 z-10 pb-2">
              <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">تفاصيل طلب التوثيق</h3>
              <button onClick={() => setOpenId(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
              {/* Left: Info */}
              <div className="space-y-6 sm:space-y-8 order-2 lg:order-1">
                <div>
                  <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                    البيانات الشخصية
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 bg-gray-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-gray-100 dark:border-slate-800">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">الاسم بالكامل</p>
                      <p className="text-sm font-black text-gray-800 dark:text-slate-100">{req.fullName}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">اسم المستخدم</p>
                      <p className="text-sm font-black text-blue-600">@{req.user?.name}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">رقم الهاتف</p>
                      <p className="text-sm font-black text-gray-800 dark:text-slate-100 font-mono">{req.phone}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">رقم الهوية</p>
                      <p className="text-sm font-black text-gray-800 dark:text-slate-100">{req.idNumber}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">تاريخ الميلاد</p>
                      <p className="text-sm font-black text-gray-800 dark:text-slate-100">{new Date(req.dateOfBirth).toLocaleDateString('ar-YE')}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">الدولة</p>
                      <p className="text-sm font-black text-gray-800 dark:text-slate-100">{req.country}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">المهنة</p>
                      <p className="text-sm font-black text-gray-800 dark:text-slate-100">{req.occupation || "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">العنوان</p>
                      <p className="text-sm font-black text-gray-800 dark:text-slate-100">{req.address || "—"}</p>
                    </div>
                  </div>
                </div>

                {req.status === "pending" && (
                  <div className="pt-6 sm:pt-8 border-t border-gray-100 dark:border-slate-800">
                    <h4 className="text-xs font-black text-red-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                      اتخاذ إجراء
                    </h4>
                    <div className="space-y-4">
                      <textarea 
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="أدخل سبب الرفض في حال الرغبة برفض الطلب..."
                        className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-2xl p-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all min-h-[100px] dark:text-slate-100"
                      />
                      <div className="flex flex-col sm:flex-row gap-4">
                        <button 
                          onClick={() => approve(req._id)}
                          disabled={loading}
                          className="flex-1 bg-emerald-600 text-white font-black py-4 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 dark:shadow-none active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {loading ? "جاري الحفظ..." : "✅ موافقة وتفعيل"}
                        </button>
                        <button 
                          onClick={() => reject(req._id)}
                          disabled={rejectingId === req._id}
                          className="flex-1 bg-red-600 text-white font-black py-4 rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 dark:shadow-none active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {rejectingId === req._id ? "جاري الحفظ..." : "❌ رفض الطلب"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                {req.status === "rejected" && req.rejectionReason && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-100 dark:border-red-900/30">
                    <p className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase mb-1">سبب الرفض السابق</p>
                    <p className="text-sm font-bold text-red-700 dark:text-red-300">{req.rejectionReason}</p>
                  </div>
                )}
              </div>

              {/* Right: Images */}
              <div className="space-y-6 order-1 lg:order-2">
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                  الوثائق المرفوعة
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-gray-400 px-1 uppercase tracking-tighter">الهوية (الوجه الأمامي)</p>
                    <a href={protectedFileUrl(req.idFrontImage, authToken)} target="_blank" rel="noreferrer" className="block rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-all group relative aspect-video sm:aspect-auto">
                      <img src={protectedFileUrl(req.idFrontImage, authToken)} alt="ID Front" className="w-full h-auto object-cover max-h-[250px] min-h-[150px]" onError={(e) => { e.target.onerror = null; e.target.src = ID_PLACEHOLDER; }} />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs">تكبير الصورة 🔍</div>
                    </a>
                  </div>

                  {req.idBackImage && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-gray-400 px-1 uppercase tracking-tighter">الهوية (الوجه الخلفي)</p>
                      <a href={protectedFileUrl(req.idBackImage, authToken)} target="_blank" rel="noreferrer" className="block rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-all group relative aspect-video sm:aspect-auto">
                        <img src={protectedFileUrl(req.idBackImage, authToken)} alt="ID Back" className="w-full h-auto object-cover max-h-[250px] min-h-[150px]" onError={(e) => { e.target.onerror = null; e.target.src = ID_PLACEHOLDER; }} />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs">تكبير الصورة 🔍</div>
                      </a>
                    </div>
                  )}

                  {req.selfieImage && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-gray-400 px-1 uppercase tracking-tighter">صورة سيلفي مع الهوية</p>
                      <a href={protectedFileUrl(req.selfieImage, authToken)} target="_blank" rel="noreferrer" className="block rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-all group relative aspect-video sm:aspect-auto">
                        <img src={protectedFileUrl(req.selfieImage, authToken)} alt="Selfie" className="w-full h-auto object-cover max-h-[250px] min-h-[150px]" onError={(e) => { e.target.onerror = null; e.target.src = ID_PLACEHOLDER; }} />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs">تكبير الصورة 🔍</div>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
