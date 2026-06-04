import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";

export default function AdminWithdrawals() {
  const api = useApi();
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState(null);
  const [actionModal, setActionModal] = useState({ open: false, type: "", item: null });
  const [adminNotes, setAdminNotes] = useState("");
  const [proof, setProof] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/withdrawals");
      setWithdrawals(res.data || []);
    } catch (err) {
      setError("فشل تحميل طلبات السحب");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleProcess = async (id) => {
    setProcessingId(id);
    try {
      await api.patch(`/admin/withdrawals/${id}/process`);
      load();
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تم تغيير حالة الطلب إلى قيد المعالجة", type: "success" } }));
    } catch {
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "فشل التحديث", type: "error" } }));
    } finally {
      setProcessingId(null);
    }
  };

  const handleComplete = async () => {
    const { item } = actionModal;
    setProcessingId(item._id);
    try {
      await api.patch(`/admin/withdrawals/${item._id}/complete`, {
        transactionProof: proof,
        adminNotes: adminNotes
      });
      setActionModal({ open: false, type: "", item: null });
      setAdminNotes("");
      setProof("");
      load();
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تم إكمال عملية السحب بنجاح", type: "success" } }));
    } catch (err) {
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: err.response?.data?.error || "فشل التحديث", type: "error" } }));
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    const { item } = actionModal;
    if (!adminNotes) return alert("يرجى كتابة سبب الرفض");
    setProcessingId(item._id);
    try {
      await api.patch(`/admin/withdrawals/${item._id}/reject`, {
        adminNotes: adminNotes
      });
      setActionModal({ open: false, type: "", item: null });
      setAdminNotes("");
      load();
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تم رفض طلب السحب وإعادة الرصيد للمستخدم", type: "success" } }));
    } catch {
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "فشل التحديث", type: "error" } }));
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusLabel = (s) => {
    switch (s) {
      case "PENDING": return "بانتظار الموافقة";
      case "PROCESSING": return "قيد المعالجة";
      case "COMPLETED": return "مكتمل";
      case "REJECTED": return "مرفوض";
      default: return s;
    }
  };

  if (loading && withdrawals.length === 0) return <div className="p-20 text-center animate-pulse font-black text-gray-400">جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-right text-sm">
            <thead className="bg-gray-50/50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">المستخدم</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">المبلغ</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">طريقة الاستلام</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">الحالة</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">التاريخ</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider text-left">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
              {withdrawals.map((w) => (
                <tr key={w._id} className="hover:bg-gray-50/30 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-black text-gray-900 dark:text-white">{w.user?.name}</p>
                    <p className="text-[10px] font-bold text-gray-400">{w.user?.phone}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-black text-blue-600">{w.amount.toLocaleString()} {w.currency}</span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{w.receiptMethod === 'bank_account' ? 'حساب بنكي' : 'مكتب صرافة'}</p>
                    <p className="text-[10px] text-gray-400">{w.bankName || w.exchangeOfficeName}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
                      w.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                      w.status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-100' :
                      w.status === 'PROCESSING' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                      'bg-amber-50 text-amber-700 border-amber-100'
                    }`}>
                      {getStatusLabel(w.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[10px] text-gray-400 font-bold">
                    {new Date(w.createdAt).toLocaleDateString('ar-YE')}
                  </td>
                  <td className="px-6 py-4 text-left">
                    {w.status === 'PENDING' && (
                      <button 
                        onClick={() => handleProcess(w._id)}
                        disabled={processingId === w._id}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black hover:bg-blue-700 transition-all disabled:opacity-50"
                      >
                        بدء المعالجة
                      </button>
                    )}
                    {w.status === 'PROCESSING' && (
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setActionModal({ open: true, type: "complete", item: w })}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-black hover:bg-emerald-700 transition-all"
                        >
                          إكمال
                        </button>
                        <button 
                          onClick={() => setActionModal({ open: true, type: "reject", item: w })}
                          className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-[10px] font-black hover:bg-red-700 transition-all"
                        >
                          رفض
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Modal */}
      {actionModal.open && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] p-8 shadow-2xl border border-blue-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-6">
              {actionModal.type === 'complete' ? 'تأكيد إكمال السحب' : 'رفض طلب السحب'}
            </h3>
            
            <div className="space-y-4">
              {actionModal.type === 'complete' && (
                <div>
                  <label className="text-xs font-black text-gray-400 block mb-2 mr-1">رقم الحوالة / إثبات الدفع</label>
                  <input 
                    value={proof}
                    onChange={(e) => setProof(e.target.value)}
                    placeholder="أدخل رقم العملية أو الحوالة..."
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              )}
              
              <div>
                <label className="text-xs font-black text-gray-400 block mb-2 mr-1">ملاحظات الإدارة {actionModal.type === 'reject' && '(سبب الرفض مطلوب)'}</label>
                <textarea 
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="اكتب ملاحظاتك هنا..."
                  rows={3}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={actionModal.type === 'complete' ? handleComplete : handleReject}
                  disabled={processingId}
                  className={`flex-1 py-3.5 rounded-2xl text-sm font-black text-white shadow-lg transition-all active:scale-95 ${
                    actionModal.type === 'complete' ? 'bg-emerald-600 shadow-emerald-100 hover:bg-emerald-700' : 'bg-red-600 shadow-red-100 hover:bg-red-700'
                  }`}
                >
                  {processingId ? 'جاري المعالجة...' : 'تأكيد الإجراء'}
                </button>
                <button 
                  onClick={() => setActionModal({ open: false, type: "", item: null })}
                  className="px-6 py-3.5 bg-gray-50 dark:bg-slate-800 text-gray-500 rounded-2xl text-sm font-black border border-gray-100 dark:border-slate-700 hover:bg-gray-100"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
