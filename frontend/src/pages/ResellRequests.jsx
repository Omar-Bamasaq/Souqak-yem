import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import { uploadsUrl } from "../lib/uploads.js";

export default function ResellRequests() {
  const [requests, setRequests] = useState([]);
  const [pendingConfirmations, setPendingConfirmations] = useState([]);
  const [loading, setLoading] = useState(true);
  const api = useApi();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reqsRes, transRes] = await Promise.all([
          api.get("/resell/requests"),
          api.get("/resell/pending-transactions")
        ]);
        setRequests(reqsRes.data);
        setPendingConfirmations(transRes.data || []);
      } catch (err) {
        console.error("Fetch requests error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleStatus = async (requestId, status) => {
    let reason = "";
    if (status === "rejected") {
      reason = window.prompt("يرجى كتابة سبب الرفض (اختياري):");
      if (reason === null) return; // Cancelled
    }
    try {
      await api.post("/resell/approve", { requestId, status, rejectionReason: reason });
      setRequests(requests.map(r => r._id === requestId ? { ...r, status } : r));
      window.dispatchEvent(new CustomEvent("admin:toast", { 
        detail: { 
          message: status === "approved" ? "تم قبول العرض بنجاح" : "تم رفض العرض", 
          type: "success" 
        } 
      }));
    } catch (err) {
      window.dispatchEvent(new CustomEvent("admin:toast", { 
        detail: { 
          message: err.response?.data?.error || "حدث خطأ ما", 
          type: "error" 
        } 
      }));
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><LoadingSpinner size="lg" /></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 sm:px-6 lg:px-8 space-y-12 pb-20">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 leading-tight">طلبات وعروض التسويق</h1>
          <p className="text-sm font-bold text-gray-500 mt-1 italic">راجع عروض المسوقين ووافق على الأفضل لزيادة مبيعاتك</p>
        </div>
        <div className="h-14 w-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center shadow-inner">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
      </div>

      {/* Pending Sale Confirmations for Seller */}
      {pendingConfirmations.length > 0 && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-500">
          <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-3">
            <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
            تأكيد مبيعات المسوقين
            <span className="bg-blue-600 text-white text-[10px] px-2.5 py-1 rounded-full shadow-lg shadow-blue-100">{pendingConfirmations.length}</span>
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {pendingConfirmations.map(t => (
              <div key={t._id} className="bg-blue-50/50 border-2 border-blue-100 p-6 rounded-[2.5rem] flex flex-col sm:flex-row items-center justify-between gap-6 hover:bg-white hover:shadow-xl hover:shadow-blue-100/50 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-white border-2 border-blue-100 text-blue-600 flex items-center justify-center text-xl font-black shadow-sm group-hover:scale-110 transition-transform">
                    {(t.resellerId?.name || "?").slice(0, 1)}
                  </div>
                  <div>
                    <p className="text-sm font-black text-blue-900 mb-1 leading-tight italic">المسوق {t.resellerId?.name} يطلب تأكيد بيع: {t.originalAdId?.title}</p>
                    <p className="text-[10px] text-blue-600 font-bold italic">عند التأكيد، سيتم تسجيل أرباح المسوق وإتمام الصفقة.</p>
                  </div>
                </div>
                {!t.confirmedBySeller ? (
                  <button 
                    onClick={async () => {
                      if(window.confirm("هل تؤكد إتمام عملية البيع لهذا الإعلان؟")) {
                        try {
                          await api.post("/resell/confirm-sale", { transactionId: t._id });
                          window.location.reload();
                        } catch (err) {
                          alert(err.response?.data?.error || "حدث خطأ ما");
                        }
                      }
                    }}
                    className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white text-xs font-black rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 active:scale-95"
                  >
                    تأكيد البيع الآن
                  </button>
                ) : (
                  <span className="text-xs font-black text-blue-600 italic animate-pulse">بانتظار تأكيد المسوق النهائي...</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6">
        <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-3">
          <div className="w-1.5 h-6 bg-purple-600 rounded-full"></div>
          طلبات وعروض المسوقين
        </h2>
        
        {requests.map((req) => (
          <div key={req._id} className="bg-white p-6 sm:p-8 rounded-[3rem] shadow-sm border-2 border-gray-50 flex flex-col gap-6 transition-all hover:shadow-xl hover:shadow-gray-100 hover:border-purple-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-[1.5rem] bg-purple-50 text-purple-600 flex items-center justify-center text-2xl font-black shadow-inner border border-purple-100">
                  {(req.resellerId?.name || "?").slice(0, 1)}
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xl font-black text-gray-900">{req.resellerId?.name}</span>
                    <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm ${
                      req.status === 'pending' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 
                      req.status === 'approved' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'
                    }`}>
                      {req.status === 'pending' ? 'قيد المراجعة' : req.status === 'approved' ? 'مقبول ونشط' : 'مرفوض'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 font-bold leading-relaxed italic">
                    يريد تسويق: <span className="text-gray-900 font-black">"{req.originalAdId?.title}"</span>
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-1">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">السعر المقترح</div>
                <div className="text-xl font-black text-purple-600">{req.newPrice?.toLocaleString()} {req.originalAdId?.currency}</div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-gray-50/80 border border-gray-100 relative group overflow-hidden">
              <div className="absolute top-0 right-0 w-1 h-full bg-purple-200 group-hover:bg-purple-500 transition-colors"></div>
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">الوصف المخصص للمسوق</div>
              <p className="text-sm font-bold text-gray-700 leading-relaxed whitespace-pre-wrap italic">
                "{req.customDescription}"
              </p>
            </div>

            {req.status === 'pending' && (
              <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                <button 
                  onClick={() => handleStatus(req._id, "approved")}
                  className="w-full sm:flex-[2] h-12 bg-green-600 text-white text-sm font-black rounded-2xl hover:bg-green-700 transition-all shadow-xl shadow-green-100 active:scale-95 flex items-center justify-center gap-2"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  قبول العرض وإنشاء الإعلان
                </button>
                <button 
                  onClick={() => handleStatus(req._id, "rejected")}
                  className="w-full sm:flex-1 h-12 bg-red-50 text-red-600 text-sm font-black rounded-2xl hover:bg-red-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  رفض العرض
                </button>
              </div>
            )}

            {req.status === 'rejected' && req.rejectionReason && (
              <div className="mt-2 p-4 rounded-xl bg-red-50 text-red-600 text-xs font-bold border border-red-100 italic">
                سبب الرفض: {req.rejectionReason}
              </div>
            )}
          </div>
        ))}

        {requests.length === 0 && (
          <div className="text-center py-24 bg-gray-50/50 rounded-[4rem] border-4 border-dashed border-gray-100 animate-in fade-in zoom-in duration-700">
            <div className="text-6xl mb-6 opacity-40">📬</div>
            <h3 className="text-2xl font-black text-gray-400">لا توجد عروض حالياً</h3>
            <p className="text-gray-300 font-bold mt-2 italic max-w-xs mx-auto">عندما يقوم المسوقون بتقديم عروض لتسويق منتجاتك، ستظهر هنا.</p>
          </div>
        )}
      </div>
    </div>
  );
}
