import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApi } from "../api/axios.js";
import { useAuth } from "../store/AuthContext.jsx";
import IncompleteActions from "../components/IncompleteActions.jsx";
import { getPurchaseRequestDisplay } from "../lib/purchaseRequestDisplay.js";

export default function SellerSubscriptions() {
  const api = useApi();
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const isVerified = user?.role === "admin" || user?.verificationStatus === "verified";
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [storeProfile, setStoreProfile] = useState(null);
  const [storeProfileError, setStoreProfileError] = useState(false);
  const [storeProfileLoading, setStoreProfileLoading] = useState(true);
  const [familyProductionProfile, setFamilyProductionProfile] = useState(null);
  const [familyProductionProfileError, setFamilyProductionProfileError] = useState(false);
  const [familyProductionProfileLoading, setFamilyProductionProfileLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await api.get("/auth/me");
      if (res.data) setUser(res.data);
    } catch (err) {
      console.error("Failed to fetch user status", err);
    }
  };

  useEffect(() => {
    let cancelled = false;
    api.get("/stores/me", { params: { storeType: "store" } })
      .then((res) => {
        if (!cancelled) setStoreProfile(res.data || null);
      })
      .catch((error) => {
        console.error("Failed to fetch store profile", error);
        if (!cancelled) setStoreProfileError(true);
      })
      .finally(() => {
        if (!cancelled) setStoreProfileLoading(false);
      });
    return () => { cancelled = true; };
  }, [api, user?._id, user?.id]);

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

  useEffect(() => {
    let cancelled = false;
    api.get("/stores/me", { params: { storeType: "family-production" } })
      .then((res) => {
        if (!cancelled) setFamilyProductionProfile(res.data || null);
      })
      .catch((error) => {
        console.error("Failed to fetch family production profile", error);
        if (!cancelled) setFamilyProductionProfileError(true);
      })
      .finally(() => {
        if (!cancelled) setFamilyProductionProfileLoading(false);
      });
    return () => { cancelled = true; };
  }, [api, user?._id, user?.id]);

  return (
    <div className="mx-auto max-w-6xl space-y-7 px-4 py-6 pb-24 sm:py-9">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-[#0b89ed] via-[#0878c9] to-[#075985] px-5 py-6 text-white shadow-lg shadow-blue-900/10 sm:px-8 sm:py-7">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold text-blue-100">مساحة البائع</p>
            <h2 className="text-2xl font-black sm:text-3xl">خدمات سوقك</h2>
            <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-blue-50">أدوات وخدمات تساعدك على إدارة متجرك وتنمية أعمالك.</p>
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <span className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-xs font-bold text-white">١١ خدمة</span>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 rounded-xl border border-white/30 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/70"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
              العودة
            </button>
          </div>
        </div>
      </header>

      <IncompleteActions userId={user?._id || user?.id} />

      <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
        {/* تمييز الإعلانات */}
        <section className="order-1 flex h-full flex-col rounded-2xl border border-blue-100 bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900 sm:p-5">
          <div className="flex flex-1 flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-lg sm:h-11 sm:w-11 sm:text-xl">
                <span>⭐</span>
              </div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white sm:text-base">تمييز إعلانات سوقك</h3>
            </div>
            
            <p className="text-xs font-medium leading-5 text-slate-600 dark:text-slate-300 sm:text-sm sm:leading-6">
              اجعل إعلانك يتصدر القائمة مع شارة "مميز" لزيادة المشاهدات وسرعة البيع بأقل جهد.
            </p>

            <Link
              to="/seller/feature-ad"
              className="mt-auto flex w-full items-center justify-center gap-1 rounded-xl bg-blue-700 px-2 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:gap-2 sm:px-4 sm:py-3 sm:text-sm"
            >
              ميز إعلانك الآن
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </section>

        {/* توثيق الحساب */}
        <section className={`${isVerified ? "order-9" : "order-2"} flex h-full flex-col rounded-2xl border border-emerald-100 bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900 sm:p-5`}>
          <div className="flex flex-1 flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-lg sm:h-11 sm:w-11 sm:text-xl">
                  🛡️
                </div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white sm:text-base">توثيق حساب سوقك</h3>
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
            
            <p className="text-xs font-medium leading-5 text-slate-600 dark:text-slate-300 sm:text-sm sm:leading-6">
              وثق هويتك لزيادة مصداقيتك لدى المشترين والحصول على شارة التوثيق الرسمية بجانب اسمك.
            </p>

            <Link
              to="/seller/verification"
              className={`mt-auto flex w-full items-center justify-center gap-1 rounded-xl px-2 py-2.5 text-xs font-bold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 sm:gap-2 sm:px-4 sm:py-3 sm:text-sm ${
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

        {/* مزاد سوقك */}
        <section className={`${isVerified ? "order-3" : "order-4"} flex h-full flex-col rounded-2xl border border-amber-100 bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900 sm:p-5`}>
          <div className="flex flex-1 flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-lg sm:h-11 sm:w-11 sm:text-xl">🔨</div><h3 className="text-sm font-black text-slate-900 dark:text-white sm:text-base">مزاد سوقك</h3></div>
              <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">متاحة الآن</span>
            </div>
            <p className="text-xs font-medium leading-5 text-slate-600 dark:text-slate-300 sm:text-sm sm:leading-6">اعرض منتجاتك في مزاد، ودع المشترين يتنافسون على أفضل سعر.</p>
            <Link
              to="/auctions"
              className="mt-auto flex w-full items-center justify-center gap-1 rounded-xl bg-amber-600 px-2 py-2.5 text-xs font-bold text-white transition-colors hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 sm:gap-2 sm:px-4 sm:py-3 sm:text-sm"
            >
              استعرض المزادات
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </Link>
          </div>
        </section>

        {/* تسعيرة سوقك */}
        <Link to="/quote-requests" className={`group ${isVerified ? "order-4" : "order-5"} flex h-full flex-col rounded-2xl border border-violet-100 bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900 sm:p-5`}>
          <div className="flex flex-1 flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-lg sm:h-11 sm:w-11 sm:text-xl">🏷️</div><h3 className="text-sm font-black text-slate-900 dark:text-white sm:text-base">تسعيرة سوقك</h3></div>
              <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">متاحة</span>
            </div>
            <p className="text-xs font-medium leading-5 text-slate-600 dark:text-slate-300 sm:text-sm sm:leading-6">خدمة للتجار والموردين لعرض أسعار منتجاتهم وتحديثها بسهولة، ومقارنة العروض من مختلف الموردين.</p>
            <span className="mt-auto flex w-full items-center justify-center gap-1 rounded-xl bg-violet-700 px-2 py-2.5 text-xs font-bold text-white transition-colors group-hover:bg-violet-800 sm:gap-2 sm:px-4 sm:py-3 sm:text-sm">
              افتح الخدمة
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </span>
          </div>
        </Link>

        {/* سفراء سوقك */}
        <Link to="/referrals" className={`group relative ${isVerified ? "order-8" : "order-9"} flex h-full flex-col rounded-2xl border border-emerald-100 bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900 sm:p-5`}>
          <div className="flex flex-1 flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-lg sm:h-11 sm:w-11 sm:text-xl">🤝</div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white sm:text-base">سفراء سوقك</h3>
              </div>
              <span className="shrink-0 bg-blue-50 text-blue-600 text-[9px] font-black px-2 py-1 rounded-lg border border-blue-100">جديد</span>
            </div>
            <p className="text-xs font-medium leading-5 text-slate-600 dark:text-slate-300 sm:text-sm sm:leading-6">شارك روابط منتجاتك مع الآخرين واحصل على مكافآت عند إتمام عمليات البيع من خلالك.</p>
            <span className="mt-auto flex w-full items-center justify-center gap-1 rounded-xl bg-emerald-700 px-2 py-2.5 text-xs font-bold text-white transition-colors group-hover:bg-emerald-800 sm:gap-2 sm:px-4 sm:py-3 sm:text-sm">
              اكتشف سفراء سوقك
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </span>
          </div>
        </Link>

        {/* تمييز الحساب */}
        <section className="order-10 flex h-full flex-col rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-lg sm:h-11 sm:w-11 sm:text-xl">💎</div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white sm:text-base">ترقية حساب سوقك</h3>
            </div>
            <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800">قريبًا</span>
          </div>
          <p className="text-xs font-medium leading-5 text-slate-600 dark:text-slate-300 sm:text-sm sm:leading-6">ترقية حسابك للحصول على صلاحيات ومزايا استثنائية</p>
        </section>

        {/* حساب المتجر */}
        <section className={`${isVerified ? "order-6" : "order-7"} flex h-full flex-col rounded-2xl border border-blue-100 bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900 sm:p-5`}>
          <div className="flex flex-1 flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-lg sm:h-11 sm:w-11 sm:text-xl">🏪</div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white sm:text-base">متاجر سوقك</h3>
            </div>
            <p className="text-xs font-medium leading-5 text-slate-600 dark:text-slate-300 sm:text-sm sm:leading-6">
              {storeProfile?.status === "rejected"
                ? `تم رفض طلب متجرك.${storeProfile.rejectedReason ? ` السبب: ${storeProfile.rejectedReason}` : ""} يمكنك بدء طلب جديد وإعادة تقديمه.`
                : storeProfile?.status === "pending"
                  ? "طلب متجرك قيد المراجعة؛ ستتمكن من استخدام خصائص المتجر بعد اعتماده."
                  : "افتح متجرك الخاص، وحدد الفئات، وابدأ طلب متجر جديد مع مراجعة إدارية عبر نظام الإيصال الحالي."}
            </p>
            {storeProfileLoading ? (
              <span className="mt-auto rounded-xl bg-slate-100 px-3 py-2.5 text-center text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">جارٍ التحقق من حالة المتجر…</span>
            ) : storeProfileError ? (
              <p role="alert" className="text-xs font-semibold text-red-600">تعذر التحقق من طلب المتجر حاليًا. أعد تحميل الصفحة للمحاولة مرة أخرى.</p>
            ) : (
              <Link
                to={storeProfile?.status === "rejected" ? "/seller/store/create" : storeProfile ? "/my-store" : "/seller/store/create"}
                className="mt-auto flex w-full items-center justify-center gap-1 rounded-xl bg-blue-700 px-2 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:gap-2 sm:px-4 sm:py-3 sm:text-sm"
              >
                {storeProfile?.status === "rejected" ? "إعادة تقديم طلب المتجر" : storeProfile?.status === "pending" ? "متابعة حالة الطلب" : storeProfile?.status === "active" ? "إدارة متجري" : "إنشاء متجر"}
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </Link>
            )}
          </div>
        </section>

        {/* الدفع الإلكتروني */}
        <section className={`${isVerified ? "order-2" : "order-3"} flex h-full flex-col rounded-2xl border border-cyan-100 bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900 sm:p-5`}>
          <div className="flex flex-1 flex-col gap-4">
            <div className="flex items-center gap-2"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-lg sm:h-11 sm:w-11 sm:text-xl">💳</div><h3 className="text-sm font-black text-slate-900 dark:text-white sm:text-base">محفظة سوقك</h3></div>
            <p className="text-xs font-medium leading-5 text-slate-600 dark:text-slate-300 sm:text-sm sm:leading-6">اطلب خدمات الدفع المتاحة، وارفع سند الدفع، أو اطلب تسعير خدمة غير متوفرة.</p>
            <Link to="/wallet-services" className="mt-auto flex w-full items-center justify-center rounded-xl bg-cyan-700 px-3 py-2.5 text-xs font-bold text-white transition-colors hover:bg-cyan-800 sm:py-3 sm:text-sm">
              استعراض خدمات الدفع
            </Link>
          </div>
        </section>

        {/* الأسر المنتجة */}
        <section className={`${isVerified ? "order-7" : "order-8"} flex h-full flex-col rounded-2xl border border-orange-100 bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900 sm:p-5`}>
          <div className="flex flex-1 flex-col gap-4">
            <div className="mb-1 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-lg sm:h-11 sm:w-11 sm:text-xl">🏠</div><h3 className="text-sm font-black text-slate-900 dark:text-white sm:text-base">صناعات سوقك</h3></div>
              {familyProductionProfile ? (
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  familyProductionProfile.status === "rejected" ? "bg-rose-100 text-rose-800"
                    : familyProductionProfile.status === "pending" ? "bg-amber-100 text-amber-800"
                      : "bg-emerald-100 text-emerald-800"
                }`}>
                  {familyProductionProfile.status === "active" ? "مشروعي" : familyProductionProfile.status === "pending" ? "قيد المراجعة" : familyProductionProfile.status === "rejected" ? "مرفوض" : "لديك طلب"}
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-bold text-orange-800">متاحة الآن</span>
              )}
            </div>
            <p className="text-xs font-medium leading-5 text-slate-600 dark:text-slate-300 sm:text-sm sm:leading-6">
              {familyProductionProfile?.status === "rejected"
                ? `تم رفض الطلب.${familyProductionProfile.rejectedReason ? ` السبب: ${familyProductionProfile.rejectedReason}` : ""} يمكنك بدء طلب جديد وإعادة تقديمه.`
                : familyProductionProfile?.status === "pending"
                  ? "طلب صناعات سوقك قيد المراجعة؛ ستتمكن من استخدام خصائص المشروع بعد اعتماده."
                  : "أنشئ صفحة لمشروع أسرتك، واعرض المأكولات المنزلية والحرف والمنتجات مع قوالب مخصصة وخيارات التوصيل."}
            </p>
            {familyProductionProfileLoading ? (
              <span className="mt-auto rounded-xl bg-slate-100 px-3 py-2.5 text-center text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">جارٍ التحقق من حالة المشروع…</span>
            ) : familyProductionProfileError ? (
              <p role="alert" className="text-xs font-semibold text-red-600">تعذر التحقق من طلبك حاليًا. أعد تحميل الصفحة للمحاولة مرة أخرى.</p>
            ) : (
              <Link
                to={familyProductionProfile?.status === "rejected" ? "/family-production/register" : familyProductionProfile ? "/my-family-production" : "/family-production/register"}
                className="mt-auto flex w-full items-center justify-center gap-1 rounded-xl bg-orange-600 px-2 py-2.5 text-xs font-bold text-white transition-colors hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 sm:gap-2 sm:px-4 sm:py-3 sm:text-sm"
              >
                {familyProductionProfile?.status === "rejected" ? "إعادة تقديم الطلب" : familyProductionProfile?.status === "pending" ? "متابعة حالة الطلب" : familyProductionProfile ? "إدارة مشروعي" : "التسجيل في صناعات سوقك"}
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </Link>
            )}
          </div>
        </section>

        {/* توصيل */}
        <section className="order-11 flex h-full flex-col rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-lg sm:h-11 sm:w-11 sm:text-xl">🚚</div><h3 className="text-sm font-black text-slate-900 dark:text-white sm:text-base">توصيل سوقك</h3></div>
            <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800">قريبًا</span>
          </div>
          <p className="text-xs font-medium leading-5 text-slate-600 dark:text-slate-300 sm:text-sm sm:leading-6">خيارات توصيل أسهل وأسرع تساعدك على إيصال منتجاتك إلى المشترين في مختلف المناطق.</p>
        </section>

        {/* حجوزات سوقك */}
        <section className={`${isVerified ? "order-5" : "order-6"} flex h-full flex-col rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70 sm:p-5`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-lg sm:h-11 sm:w-11 sm:text-xl">📅</div><h3 className="text-sm font-black text-slate-900 dark:text-white sm:text-base">حجوزات سوقك</h3></div>
            <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-800">متاحة الآن</span>
          </div>
          <p className="text-xs font-medium leading-5 text-slate-600 dark:text-slate-300 sm:text-sm sm:leading-6">أضف فندقك أو استراحتك أو خدمتك، واستقبل تقييمات المستخدمين بعد اعتماد الإدارة.</p>
          <Link to="/bookings" className="mt-4 flex w-full items-center justify-center rounded-xl bg-emerald-700 px-3 py-2.5 text-xs font-bold text-white transition-colors hover:bg-emerald-800 sm:py-3 sm:text-sm">
            استعراض الحجوزات وإضافة خدمة
          </Link>
        </section>
      </div>

      {/* طلباتي */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800 sm:p-6">
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
                {requests.map((r) => {
                  const display = getPurchaseRequestDisplay(r);
                  return (
                    <tr key={r._id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-8 py-5">
                        <div className="font-black text-gray-900 dark:text-white">{display.serviceLabel}</div>
                        {display.targetName && <div className="mt-1 text-xs font-semibold text-gray-600 dark:text-gray-300">{display.targetName}</div>}
                        {display.includesSocialPromotion && <span className="mt-1 inline-flex rounded-md bg-purple-50 px-2 py-1 text-[10px] font-bold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">يشمل ترويجًا اجتماعيًا</span>}
                        <div className="text-[10px] text-gray-400 font-bold mt-0.5">#{r._id.slice(-6)}</div>
                      </td>
                      <td className="px-8 py-5">
                        {display.planName && <div className="text-xs font-bold text-gray-700 dark:text-gray-300">{display.planName}</div>}
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{display.durationInDays} يوم</span>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
