import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../api/axios.js";
import { useAuth } from "../store/AuthContext.jsx";
import { useBrokerageStatus } from "../store/BrokerageStatusContext.jsx";
import { AD_COMMISSION_ENABLED } from "../config/commission.js";
import { uploadsUrl } from "../lib/uploads.js";
import { isUserVerificationCurrent } from "../lib/userVerification.js";

const ICON_PATHS = {
  profile: "M20 21a8 8 0 0 0-16 0m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4",
  message: "M21 11.5a8.5 8.5 0 0 1-12.9 7.3L3 20l1.2-4.1A8.5 8.5 0 1 1 21 11.5Z",
  settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0-13v2m0 15v2m9-9h-2M5 12H3m15.4-6.4-1.4 1.4M7 17l-1.4 1.4m12.8 0L17 17M7 7 5.6 5.6",
  wallet: "M3 6.5A2.5 2.5 0 0 1 5.5 4H20v16H5.5A2.5 2.5 0 0 1 3 17.5v-11Zm0 0V17m17-7h-5a2 2 0 0 0 0 4h5v-4Z",
  ads: "M4 5h16v14H4zM8 9h8m-8 4h5",
  heart: "m12 20-1.4-1.3C5.5 14.1 2 10.9 2 7a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 3.9-3.5 7.1-8.6 11.7L12 20Z",
  people: "M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6-7a4 4 0 0 1 0 8m2 3a4 4 0 0 1 2 4v2",
  tag: "M20.6 13.4 13 21l-10-10V3h8l9.6 9.6a.6.6 0 0 1 0 .8ZM7.5 7.5h.01",
  store: "M3 10h18l-1.5-6h-15L3 10Zm2 0v10h14V10m-10 10v-6h6v6m-12-10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0",
  home: "m3 10 9-7 9 7v10H3V10Zm6 10v-6h6v6",
  sparkle: "m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Zm7 12 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z",
  auction: "m14 5 5 5M4 20l8-8M8 4l5 5-4 4-5-5 4-4Zm8 8 4 4-4 4-4-4 4-4ZM3 21h18",
  logout: "M10 17l5-5-5-5m5 5H3m9-9h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7",
  shield: "M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Zm-3-11 2 2 4-4"
};

const ICON_COLORS = {
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  cyan: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  fuchsia: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300",
  green: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  teal: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
};

function AccountIcon({ name }) {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICON_PATHS[name] || ICON_PATHS.sparkle} />
    </svg>
  );
}

function AccountGroup({ title, items }) {
  if (!items.length) return null;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <h2 className="mb-3 text-sm font-black text-slate-500 dark:text-slate-400">{title}</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map(({ to, label, icon, color = "blue" }) => (
          <Link
            key={`${to}-${label}`}
            to={to}
            className="flex min-h-14 min-w-0 items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-sm font-bold text-slate-800 transition hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-slate-700 dark:hover:bg-slate-800"
          >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ICON_COLORS[color] || ICON_COLORS.blue}`}>
              <AccountIcon name={icon} />
            </span>
            <span className="min-w-0 flex-1">{label}</span>
            <span aria-hidden="true" className="text-slate-400">←</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function AccountHub() {
  const { user, logout } = useAuth();
  const { enabled: brokerageEnabled } = useBrokerageStatus();
  const api = useApi();
  const [stores, setStores] = useState({ store: null, family: null });
  const [storeLoadStatus, setStoreLoadStatus] = useState({ store: "loading", family: "loading" });
  const [storesLoading, setStoresLoading] = useState(true);
  const [storesError, setStoresError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const isAdminAccount = ["admin", "supervisor"].includes(user?.role);
  const userId = user?.id || user?._id;

  useEffect(() => {
    let active = true;
    setStoresLoading(true);
    setStoresError("");
    setStoreLoadStatus({ store: "loading", family: "loading" });
    Promise.allSettled([
      api.get("/stores/me", { params: { storeType: "store" } }),
      api.get("/stores/me", { params: { storeType: "family-production" } })
    ])
      .then(([storeResult, familyResult]) => {
        if (!active) return;
        const storeLoaded = storeResult.status === "fulfilled";
        const familyLoaded = familyResult.status === "fulfilled";
        setStores({
          store: storeLoaded ? storeResult.value.data || null : null,
          family: familyLoaded ? familyResult.value.data || null : null
        });
        setStoreLoadStatus({
          store: storeLoaded ? "loaded" : "error",
          family: familyLoaded ? "loaded" : "error"
        });
        if (!storeLoaded) console.error("Account hub store link request failed:", storeResult.reason);
        if (!familyLoaded) console.error("Account hub family-production link request failed:", familyResult.reason);
        if (!storeLoaded || !familyLoaded) setStoresError("تعذر تحميل بيانات بعض المتاجر الآن.");
      })
      .finally(() => {
        if (active) setStoresLoading(false);
      });
    return () => { active = false; };
  }, [api, userId, retryCount]);

  const activityItems = [
    { to: "/notifications", label: "الإشعارات", icon: "bell", color: "amber" },
    { to: "/messages", label: "الرسائل", icon: "message", color: "sky" },
    { to: "/favorites", label: "المفضلة", icon: "heart", color: "rose" },
    { to: "/following", label: "الحسابات التي أتابعها", icon: "people", color: "violet" },
    { to: "/my-ads", label: "إعلاناتي", icon: "ads", color: "blue" },
    { to: "/account/statistics", label: "الإحصائيات", icon: "sparkle", color: "indigo" },
    { to: "/my-auctions", label: "مزاداتي", icon: "auction", color: "amber" },
    { to: "/my-quote-requests", label: "طلباتي للتسعير", icon: "tag", color: "violet" },
    { to: "/my-quote-offers", label: "عروضي في التسعير", icon: "tag", color: "indigo" }
  ];

  const sellerItems = [
    { to: "/wallet", label: "المحفظة والشراء الآمن", icon: "wallet", color: "cyan" },
    { to: "/seller/subscriptions", label: "خدمات سوقك", icon: "sparkle", color: "emerald" },
    { to: "/wallet-services", label: "خدمات الدفع الإلكتروني | تمام باي", icon: "wallet", color: "cyan" },
    { to: "/quote-requests", label: "تسعيرة سوقك", icon: "tag", color: "violet" },
    { to: "/referrals", label: "سفراء سوقك", icon: "people", color: "emerald" },
    { to: "/seller/featured-ad", label: "ترويج إعلان", icon: "sparkle", color: "orange" },
    { to: "/seller/verification", label: "توثيق حساب البائع", icon: "shield", color: "teal" },
    ...(AD_COMMISSION_ENABLED ? [
      { to: "/seller/commissions", label: "عمولات إعلاناتي", icon: "wallet", color: "orange" },
      { to: "/commission/pay", label: "دفع عمولة الموقع", icon: "wallet", color: "green" }
    ] : [])
  ];

  const brokerageItems = brokerageEnabled ? [
    { to: "/brokerage", label: "لوحة الوساطة", icon: "people", color: "purple" },
    { to: "/brokerage/campaigns", label: "الحملات المتاحة", icon: "tag", color: "indigo" },
    { to: "/brokerage/my-campaigns", label: "حملاتي للوساطة", icon: "ads", color: "purple" },
    { to: "/brokerage/memberships", label: "عضوياتي", icon: "people", color: "violet" },
    { to: "/brokerage/deals", label: "صفقاتي", icon: "wallet", color: "emerald" },
    { to: "/brokerage/achievements", label: "إنجازاتي", icon: "sparkle", color: "amber" },
    { to: "/how-it-works#reseller", label: "كيف أربح من الوساطة؟", icon: "profile", color: "blue" }
  ] : [];

  const storeItems = storesLoading ? [] : [
    ...(stores.store ? [
      ...(stores.store.status === "rejected"
        ? [{ to: "/seller/store/create", label: "إعادة تقديم طلب المتجر", icon: "store", color: "rose" }]
        : [
          { to: "/my-store", label: stores.store.status === "pending" ? "متابعة طلب المتجر" : "إدارة متجري", icon: "store", color: "blue" },
          ...(stores.store.status === "active" && stores.store.subscriptionStatus === "active" && stores.store.slug ? [{ to: `/store/${stores.store.slug}`, label: "عرض متجري", icon: "store", color: "emerald" }] : []),
          ...(stores.store.status === "active" && stores.store.subscriptionStatus === "active" ? [{ to: "/my-store/orders", label: "طلبات متجري", icon: "wallet", color: "cyan" }] : [])
        ])
    ] : storeLoadStatus.store === "loaded"
      ? [{ to: "/seller/store/create", label: "إنشاء متجر", icon: "store", color: "blue" }]
      : []),
    ...(stores.family ? [
      ...(stores.family.status === "rejected"
        ? [{ to: "/family-production/register", label: "إعادة تقديم طلب صناعات سوقك", icon: "home", color: "rose" }]
        : [
          { to: "/my-family-production", label: stores.family.status === "pending" ? "متابعة طلب صناعات سوقك" : "إدارة مشروع الأسرة", icon: "home", color: "fuchsia" },
          ...(stores.family.status === "active" && stores.family.subscriptionStatus === "active" && stores.family.slug ? [{ to: `/store/${stores.family.slug}`, label: "عرض مشروع الأسرة", icon: "home", color: "emerald" }] : []),
          ...(stores.family.status === "active" && stores.family.subscriptionStatus === "active" ? [{ to: "/my-family-production/orders", label: "طلبات مشروع الأسرة", icon: "wallet", color: "cyan" }] : [])
        ])
    ] : storeLoadStatus.family === "loaded"
      ? [{ to: "/family-production/register", label: "إنشاء مشروع أسرة منتجة", icon: "home", color: "fuchsia" }]
      : [])
  ];
  const phoneVerified = Boolean(user?.phoneVerifiedAt);
  const identityApproved = user?.identityStatus === "Approved" || isUserVerificationCurrent(user);
  const identityPending = !identityApproved && user?.identityStatus === "Pending";
  const identityRejected = user?.identityStatus === "Rejected";
  const phoneAction = user?.phone ? "/verify-phone" : "/account-settings";
  const phoneActionLabel = user?.phone
    ? phoneVerified ? "عرض الحالة" : "وثّق الآن"
    : "أضف رقمك";
  const identityActionLabel = identityApproved
    ? "عرض التفاصيل"
    : identityPending ? "عرض الطلب" : identityRejected ? "أعد التقديم" : "ابدأ التوثيق";

  return (
    <div dir="rtl" className="mx-auto max-w-4xl space-y-4 px-3 py-4 pb-24 sm:space-y-5 sm:px-5 sm:py-8">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-l from-blue-800 to-indigo-700 p-4 text-white shadow-lg sm:rounded-3xl sm:p-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/25 bg-white/15 text-xl font-black sm:h-16 sm:w-16">
            {user?.avatar
              ? <img src={uploadsUrl(user.avatar, "thumb")} alt="" className="h-full w-full object-cover" />
              : user?.name?.charAt(0) || "؟"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-blue-100">مركز الحساب</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="min-w-0 truncate text-xl font-black sm:text-2xl">{user?.name || "حسابي"}</h1>
              {isUserVerificationCurrent(user) && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/30 bg-white/15 px-2 py-1 text-[10px] font-bold text-white">
                  <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                    <path fillRule="evenodd" d="M10 1.7 3.5 4v5.2c0 4.2 2.7 7.2 6.5 9.1 3.8-1.9 6.5-4.9 6.5-9.1V4L10 1.7Zm3.1 6.1a.8.8 0 0 1 0 1.1l-3.7 3.7a.8.8 0 0 1-1.1 0l-1.8-1.8a.8.8 0 1 1 1.1-1.1l1.2 1.2L12 7.8a.8.8 0 0 1 1.1 0Z" clipRule="evenodd" />
                  </svg>
                  موثق
                </span>
              )}
            </div>
            <p className="mt-1 text-xs font-semibold text-blue-100">{isAdminAccount ? "إدارة سوقك" : "إدارة حسابك وخدماتك من مكان واحد"}</p>
          </div>
        </div>
        {!isAdminAccount && (
          <div className="mt-4 grid gap-2 border-t border-white/15 pt-4 sm:grid-cols-2">
            <div className="flex min-w-0 items-center gap-3 rounded-xl border border-white/15 bg-white/10 p-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
                <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 3h3l2 5-2 1.5a14 14 0 0 0 4.5 4.5L16 12l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 5 5a2 2 0 0 1 2-2Z" />
                  {phoneVerified && <path d="m15 5 2 2 4-4" />}
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-blue-100">توثيق رقم الهاتف</p>
                <p className="mt-0.5 truncate text-xs font-black text-white">
                  {phoneVerified ? "رقم الهاتف موثّق" : "رقم الهاتف غير موثّق"}
                </p>
              </div>
              <Link
                to={phoneAction}
                className="shrink-0 rounded-lg bg-white px-2.5 py-2 text-[10px] font-black text-blue-800 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {phoneActionLabel}
              </Link>
            </div>

            <div className="flex min-w-0 items-center gap-3 rounded-xl border border-white/15 bg-white/10 p-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
                <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <circle cx="9" cy="10" r="2" />
                  <path d="M6 16c.8-1.3 1.8-2 3-2s2.2.7 3 2m2-5h4m-4 3h4" />
                  {identityApproved && <path d="m16 7 1.2 1.2L20 5.5" />}
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-blue-100">توثيق الهوية</p>
                <p className="mt-0.5 truncate text-xs font-black text-white">
                  {identityApproved
                    ? "الهوية موثّقة"
                    : identityPending
                      ? "الطلب قيد المراجعة"
                      : identityRejected ? "طلب التوثيق مرفوض" : "الهوية غير موثّقة"}
                </p>
              </div>
              <Link
                to="/seller/verification"
                className="shrink-0 rounded-lg bg-white px-2.5 py-2 text-[10px] font-black text-blue-800 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {identityActionLabel}
              </Link>
            </div>
          </div>
        )}
      </section>

      {!user?.isEmailVerified && !user?.managedAccount?.createdByAdmin && (
        <Link to="/verify-email" className="flex min-h-12 items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <AccountIcon name="bell" />
          <span>فعّل بريدك الإلكتروني لإكمال توثيق الحساب</span>
          <span className="mr-auto">←</span>
        </Link>
      )}

      {isAdminAccount ? (
        <>
          <AccountGroup title="الإدارة" items={[
            { to: "/admin", label: "لوحة تحكم الإدارة", icon: "shield", color: "blue" }
          ]} />
          <AccountGroup title="التواصل والحساب" items={[
            { to: "/notifications", label: "الإشعارات", icon: "bell", color: "amber" },
            { to: "/messages", label: "الرسائل", icon: "message", color: "sky" },
            { to: "/account-settings", label: "إعدادات الحساب", icon: "settings", color: "slate" }
          ]} />
        </>
      ) : (
        <>
          <AccountGroup title="حسابي ونشاطي" items={[
            ...(userId ? [{ to: `/s/${userId}`, label: "ملفي الشخصي العام", icon: "profile", color: "violet" }] : []),
            { to: "/account-settings", label: "إعدادات الحساب", icon: "settings", color: "slate" },
            ...activityItems
          ]} />
          <AccountGroup title="البيع والخدمات" items={sellerItems} />
          <AccountGroup title="المتاجر والأسر المنتجة" items={storeItems} />
          {storesLoading && <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-900">جارٍ تحميل روابط متاجرك ومشاريعك…</p>}
          {storesError && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <span>{storesError} عُرضت روابط الأقسام التي تم تحميلها، وأُخفيت خيارات النوع الذي تعذر التحقق منه.</span>
              <button type="button" onClick={() => setRetryCount((count) => count + 1)} className="underline">إعادة المحاولة</button>
            </div>
          )}
          <AccountGroup title="الوساطة" items={brokerageItems} />
        </>
      )}

      <button
        type="button"
        onClick={logout}
        className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-black text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950/30"
      >
        <AccountIcon name="logout" />
        تسجيل الخروج
      </button>
    </div>
  );
}
