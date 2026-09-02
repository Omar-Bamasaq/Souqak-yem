import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";
import { useChat } from "../store/ChatContext.jsx";

import { useNavigate } from "react-router-dom";

export default function Notifications() {
  const navigate = useNavigate();
  const api = useApi();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const { socket } = useChat() || {};

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/notifications");
      setItems(res.data.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const handleNotificationClick = async (n) => {
    if (!n.isRead) await markRead(n._id);
    
    if (n.type === "message" && n.data?.conversationId) {
      navigate(`/messages?id=${n.data.conversationId}`);
    } else if (n.type === "admin_message") {
      navigate("/messages");
    } else if (n.type === "order" && n.data?.orderId) {
      navigate(`/orders/${n.data.orderId}`);
    } else if (n.type === "wallet") {
      navigate("/wallet");
    }
  };

  useEffect(() => {
    const handler = (e) => {
      const n = e.detail || {};
      setItems((arr) => [n, ...arr]);
    };
    window.addEventListener("notification:new", handler);
    return () => window.removeEventListener("notification:new", handler);
  }, [socket]);

  const markAll = async () => {
    try {
      await api.patch("/notifications/read-all");
      load();
    } catch {}
  };

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setItems(items.map(n => n._id === id ? { ...n, isRead: true } : n));
    } catch {}
  };

  const deleteOne = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("هل أنت متأكد من حذف هذا التنبيه؟")) return;
    try {
      await api.delete(`/notifications/${id}`);
      setItems(items.filter(n => n._id !== id));
    } catch {
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "فشل حذف التنبيه", type: "error" } }));
    }
  };

  const deleteAll = async () => {
    if (!window.confirm("هل أنت متأكد من حذف جميع التنبيهات؟")) return;
    try {
      await api.delete("/notifications");
      setItems([]);
    } catch {
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "فشل حذف التنبيهات", type: "error" } }));
    }
  };

  const handleResellAction = async (notifId, requestId, status) => {
    if (status === "rejected" && !window.confirm("هل أنت متأكد من رفض هذا العرض؟")) return;
    
    try {
      setItems(items.map(n => n._id === notifId ? { ...n, loading: true } : n));
      
      const reason = status === "rejected" ? (window.prompt("يرجى كتابة سبب الرفض (اختياري):") || "") : "";
      if (status === "rejected" && reason === null) return; // User cancelled prompt

      await api.post("/resell/approve", { requestId, status, rejectionReason: reason });
      
      window.dispatchEvent(new CustomEvent("admin:toast", { 
        detail: { 
          message: status === "approved" ? "تم قبول العرض بنجاح" : "تم رفض العرض", 
          type: "success" 
        } 
      }));

      // Mark notification as read and update its local state
      await markRead(notifId);
      setItems(items.map(n => n._id === notifId ? { ...n, isRead: true, loading: false, actionDone: status } : n));
    } catch (err) {
      setItems(items.map(n => n._id === notifId ? { ...n, loading: false } : n));
      window.dispatchEvent(new CustomEvent("admin:toast", { 
        detail: { 
          message: err.response?.data?.error || "حدث خطأ ما", 
          type: "error" 
        } 
      }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="ds-title">الإشعارات</h2>
        <div className="flex gap-2">
          <button className="ds-btn-secondary ds-btn-sm" onClick={markAll}>تحديد الكل كمقروء</button>
          <button className="ds-btn-secondary ds-btn-sm text-red-500 border-red-100 hover:bg-red-50" onClick={deleteAll}>حذف الكل</button>
        </div>
      </div>
      <div className="ds-section p-4 sm:p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800/50 dark:to-slate-900/50 border-none shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-center sm:text-right">
          <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white mb-1">تفضيلات الإشعارات</h3>
          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-slate-400 font-bold">تحكم في التنبيهات التي تصلك عبر التطبيق، البريد، والهاتف.</p>
        </div>
        <button 
          onClick={() => navigate("/account-settings")}
          className="w-full sm:w-auto px-6 py-3 bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 text-xs font-black rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 border border-blue-100 dark:border-slate-700"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          تعديل الإعدادات
        </button>
      </div>
      <div className="ds-section p-0">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">قائمة الإشعارات</h3>
        </div>
        {loading && <div className="p-4 text-sm text-gray-600">جاري التحميل...</div>}
        {!loading && items.length === 0 && <div className="p-4 text-sm text-gray-600">لا توجد إشعارات</div>}
        {!loading && items.length > 0 && (
          <div className="divide-y divide-gray-50">
            {items.map((n) => {
              const isResellReq = n.type === "resell_request";
              const data = n.data || {};
              
              return (
                <div 
                  key={n._id} 
                  className={`p-4 transition-all cursor-pointer hover:bg-gray-50 ${n.isRead ? "bg-white" : "bg-blue-50/30"}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isResellReq ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
                        }`}>
                          {isResellReq ? "📦" : "🔔"}
                        </div>
                        <div>
                          <div className="text-sm font-black text-gray-900 leading-none">{n.title}</div>
                          <div className="text-[10px] text-gray-400 mt-1 font-bold">{new Date(n.createdAt).toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                    
                    <button 
                      onClick={(e) => deleteOne(e, n._id)}
                      className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                      title="حذف"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex-1 space-y-3 mt-3">
                    <div className="text-xs font-bold text-gray-600 leading-relaxed bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                      {n.body}
                    </div>

                    {isResellReq && data.requestId && !n.actionDone && (
                      <div className="bg-white border-2 border-purple-100 rounded-2xl p-4 space-y-4 shadow-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-purple-50 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">المسوق:</span>
                            <span className="text-xs font-black text-gray-900 flex items-center gap-1">
                              {data.resellerName}
                              {data.resellerLevel && (
                                <span className={`text-[8px] px-1.5 py-0.5 rounded-full text-white font-black uppercase ${
                                  data.resellerLevel === 'VIP' ? 'bg-amber-500' : 
                                  data.resellerLevel === 'Pro' ? 'bg-purple-500' : 'bg-blue-500'
                                }`}>
                                  {data.resellerLevel}
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">السعر:</span>
                            <span className="text-xs font-black text-purple-600">
                              {data.newPrice?.toLocaleString()} {data.currency}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <button 
                            disabled={n.loading}
                            onClick={() => handleResellAction(n._id, data.requestId, "approved")}
                            className="flex-1 h-10 bg-purple-600 text-white text-[11px] font-black rounded-xl hover:bg-purple-700 transition-all shadow-lg shadow-purple-100 flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {n.loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : "✅ قبول العرض"}
                          </button>
                          <button 
                            disabled={n.loading}
                            onClick={() => handleResellAction(n._id, data.requestId, "rejected")}
                            className="flex-1 h-10 bg-red-50 text-red-600 text-[11px] font-black rounded-xl hover:bg-red-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            ❌ رفض
                          </button>
                        </div>
                      </div>
                    )}

                    {n.actionDone && (
                      <div className={`text-[10px] font-black px-3 py-2 rounded-lg border flex items-center gap-2 ${
                        n.actionDone === 'approved' ? "bg-green-50 text-green-600 border-green-100" : "bg-red-50 text-red-600 border-red-100"
                      }`}>
                        {n.actionDone === 'approved' ? "تم قبول هذا العرض بنجاح" : "تم رفض هذا العرض"}
                      </div>
                    )}
                  </div>

                  {!n.isRead && !isResellReq && (
                    <div className="mt-2 flex justify-end">
                      <button 
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors group" 
                        onClick={(e) => { e.stopPropagation(); markRead(n._id); }}
                        title="تحديد كمقروء"
                      >
                        <div className="w-2 h-2 bg-blue-600 rounded-full group-hover:scale-125 transition-transform"></div>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
