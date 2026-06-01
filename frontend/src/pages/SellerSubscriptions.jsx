import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApi } from "../api/axios.js";
import { useAuth } from "../store/AuthContext.jsx";

export default function SellerSubscriptions() {
  const api = useApi();
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await api.get("/auth/me");
      if (res.data) setUser(res.data);
    } catch (err) {
      console.error("Failed to fetch user status", err);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        await fetchStatus();
        const res = await api.get("/purchase-requests/mine");
        setRequests(res.data || []);
      } catch {
        setRequests([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-10 space-y-6 sm:space-y-10 pb-24">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-100 hidden sm:block">
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900">الاشتراكات والخدمات</h2>
            <p className="text-[10px] sm:text-xs font-bold text-gray-400 mt-0.5">طور حسابك وزد مبيعاتك مع خدمات سوقك</p>
          </div>
        </div>
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border-2 border-gray-50 dark:border-slate-800 rounded-2xl text-xs font-black text-gray-600 dark:text-gray-300 hover:bg-gray-50 transition-all active:scale-95 shadow-sm"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
          </svg>
          العودة
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* تمييز الإعلانات */}
        <section className="group relative overflow-hidden rounded-[2rem] border-2 border-gray-50 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 transition-all hover:shadow-2xl hover:shadow-blue-100/50 dark:hover:shadow-none">
          <div className="absolute -top-10 -left-10 w-32 h-32 bg-blue-50 dark:bg-blue-900/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
          
          <div className="relative space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 rounded-xl">
                <span className="text-xl sm:text-2xl">⭐</span>
              </div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white">تمييز الإعلانات</h3>
            </div>
            
            <p className="text-xs sm:text-sm font-bold text-gray-500 dark:text-gray-400 leading-relaxed">
              اجعل إعلانك يتصدر القائمة مع شارة "مميز" لزيادة المشاهدات وسرعة البيع بأقل جهد.
            </p>

            <ul className="space-y-2 pb-4">
              {[
                "ظهور في أعلى نتائج البحث",
                "علامة إعلان مميز جذابة",
                "زيادة تصل إلى 5 أضعاف المشاهدات",
                "سرعة في إتمام عملية البيع"
              ].map((item, idx) => (
                <li key={idx} className="flex items-center gap-2 text-[10px] sm:text-xs font-bold text-gray-600 dark:text-gray-400">
                  <svg className="h-3.5 w-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>

            <Link
              to="/seller/feature-ad"
              className="flex items-center justify-center gap-2 w-full rounded-2xl bg-blue-600 px-6 py-4 text-sm font-black text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 dark:shadow-none active:scale-95"
            >
              ميز إعلانك الآن
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </section>

        {/* توثيق الحساب */}
        <section className="group relative overflow-hidden rounded-[2rem] border-2 border-gray-50 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 transition-all hover:shadow-2xl hover:shadow-emerald-100/50 dark:hover:shadow-none">
          <div className="absolute -top-10 -left-10 w-32 h-32 bg-emerald-50 dark:bg-emerald-900/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
          
          <div className="relative space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 rounded-xl text-xl sm:text-2xl">
                  🛡️
                </div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white">توثيق الحساب</h3>
              </div>
              
              {user?.role === 'admin' ? (
                <span className="bg-blue-50 text-blue-600 text-[9px] font-black px-2 py-1 rounded-lg border border-blue-100">مسؤول</span>
              ) : user?.verificationStatus === 'verified' ? (
                <span className="bg-emerald-50 text-emerald-600 text-[9px] font-black px-2 py-1 rounded-lg border border-emerald-100 flex items-center gap-1">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                  موثق
                </span>
              ) : (
                <span className="bg-gray-50 text-gray-400 text-[9px] font-black px-2 py-1 rounded-lg border border-gray-100">غير موثق</span>
              )}
            </div>
            
            <p className="text-xs sm:text-sm font-bold text-gray-500 dark:text-gray-400 leading-relaxed">
              وثق هويتك لزيادة مصداقيتك لدى المشترين والحصول على شارة التوثيق الرسمية بجانب اسمك.
            </p>

            <ul className="space-y-2 pb-4">
              {[
                "شارة التوثيق الزرقاء ✔",
                "زيادة ثقة المشترين في متجرك",
                "أولوية في دعم العملاء",
                "ظهور أعلى في نتائج البحث"
              ].map((item, idx) => (
                <li key={idx} className="flex items-center gap-2 text-[10px] sm:text-xs font-bold text-gray-600 dark:text-gray-400">
                  <svg className="h-3.5 w-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>

            <Link
              to="/seller/verification"
              className={`flex items-center justify-center gap-2 w-full rounded-2xl px-6 py-4 text-sm font-black text-white transition-all shadow-lg active:scale-95 ${
                (user?.verificationStatus === 'verified' || user?.role === 'admin')
                  ? "bg-gray-100 text-gray-400 shadow-none cursor-not-allowed border-2 border-gray-50" 
                  : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100 dark:shadow-none"
              }`}
              onClick={(e) => (user?.verificationStatus === 'verified' || user?.role === 'admin') && e.preventDefault()}
            >
              {user?.role === 'admin' 
                ? "موثق تلقائياً" 
                : user?.verificationStatus === 'verified' 
                  ? "أنت موثق بالفعل" 
                  : "وثق حسابك مجاناً"}
            </Link>
          </div>
        </section>

        {/* تمييز الحساب */}
        <section className="relative overflow-hidden rounded-[2rem] border-2 border-dashed border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 p-6 sm:p-8 opacity-60">
          <div className="absolute top-4 left-4 -rotate-12">
            <span className="bg-amber-100 text-amber-700 text-[8px] font-black px-2 py-1 rounded-lg border border-amber-200">قريباً</span>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-50 rounded-xl text-xl sm:text-2xl">💎</div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white">تمييز الحساب</h3>
            </div>
            <p className="text-xs font-bold text-gray-400 leading-relaxed">
              احصل على ملف شخصي مميز بتصميم فريد يجذب العملاء من النظرة الأولى.
            </p>
          </div>
        </section>

        {/* حساب متجر */}
        <section className="relative overflow-hidden rounded-[2rem] border-2 border-dashed border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 p-6 sm:p-8 opacity-60">
          <div className="absolute top-4 left-4 -rotate-12">
            <span className="bg-amber-100 text-amber-700 text-[8px] font-black px-2 py-1 rounded-lg border border-amber-200">قريباً</span>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 rounded-xl text-xl sm:text-2xl">🏪</div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white">حساب المتجر</h3>
            </div>
            <p className="text-xs font-bold text-gray-400 leading-relaxed">
              افتح متجرك الخاص وأدر مبيعاتك باحترافية مع أدوات تحليل وإدارة متقدمة.
            </p>
          </div>
        </section>
      </div>

      {/* طلباتي */}
      <section className="rounded-[2.5rem] border-2 border-gray-50 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="p-6 sm:p-8 border-b border-gray-50 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-50 dark:bg-slate-800 rounded-xl">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-black text-gray-900 dark:text-white">تاريخ طلبات الخدمات</h3>
          </div>
          <span className="text-[10px] font-black text-gray-400 px-3 py-1 bg-gray-50 dark:bg-slate-800 rounded-full">
            {requests.length} طلب
          </span>
        </div>

        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-4">
            <div className="w-10 h-10 border-4 border-blue-50 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-gray-400">جاري تحميل بياناتك...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center gap-4 text-center">
            <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-full">
              <svg className="h-8 w-8 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <p className="text-sm font-bold text-gray-400">لا توجد طلبات سابقة حتى الآن</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-gray-50 dark:bg-slate-800/50 text-[10px] text-gray-400 uppercase tracking-widest">
                <tr>
                  <th className="px-8 py-4 font-black">الإعلان / الخدمة</th>
                  <th className="px-8 py-4 font-black">الباقة</th>
                  <th className="px-8 py-4 font-black">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                {requests.map((r) => (
                  <tr key={r._id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-8 py-5">
                      <div className="font-black text-gray-900 dark:text-white">{r.product?.title || "طلب خدمة"}</div>
                      <div className="text-[10px] text-gray-400 font-bold mt-0.5">#{r._id.slice(-6)}</div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-xs font-bold text-gray-600 dark:text-gray-400">{r.plan?.durationInDays} يوم</span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex w-fit px-3 py-1 rounded-lg text-[10px] font-black ${
                          r.status === "Approved" ? "bg-green-50 text-green-600" :
                          r.status === "Rejected" ? "bg-red-50 text-red-600" :
                          "bg-amber-50 text-amber-600"
                        }`}>
                          {r.status === "Pending" ? "قيد المراجعة" : r.status === "Approved" ? "مقبول" : "مرفوض"}
                        </span>
                        {r.rejectionReason && (
                          <span className="text-[9px] font-bold text-red-400 max-w-[150px]">{r.rejectionReason}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
