import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";

const statusLabels = {
  PENDING: "معلقة",
  AVAILABLE: "متاحة للسحب",
  WITHDRAWAL_RESERVED: "محجوزة للسحب",
  PAID: "تم سحبها",
  REVERSED: "معكوسة",
  CANCELLED: "ملغاة",
  FROZEN: "مجمّدة"
};

const rewardCurrencies = ["YER_ADEN", "YER_SANAA", "SAR", "USD"];
const currencyLabels = {
  YER_ADEN: "ريال (عدن)",
  YER_SANAA: "ريال (صنعاء)",
  SAR: "ريال سعودي",
  USD: "دولار أمريكي"
};

export default function ReferralDashboard() {
  const api = useApi();
  const [data, setData] = useState(null);
  const [commissions, setCommissions] = useState([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(() => localStorage.getItem("souqak-referrals-guide-seen") !== "1");
  const [guideStep, setGuideStep] = useState(0);

  const guideSteps = [
    {
      eyebrow: "ابدأ بسهولة",
      title: "ما هو نظام سفراء سوقك؟",
      body: "هو برنامج يتيح لك دعوة أصدقائك إلى سوقك عبر رابطك الخاص. عندما يسجل مستخدم جديد من خلال رابطك ويستخدم خدمة مؤهلة، تحصل على مكافأة.",
      icon: <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2m6-10a4 4 0 100-8 4 4 0 000 8zm13-3h-6m3-3v6" /></svg>
    },
    {
      eyebrow: "شارك واربح",
      title: "كيف تحصل على المكافأة؟",
      body: "انسخ رابطك الخاص وشاركه مع شخص جديد. بعد تسجيله واستخدامه إحدى خدمات سوقك المؤهلة، تُحتسب لك مكافأة بنسبة 10% من العمولة أو الرسم الذي تحصل عليه سوقك.",
      icon: <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M13.5 6.5l4-4a3 3 0 114.243 4.243l-4 4m-7.243 6.5l-4 4A3 3 0 112.257 17l4-4m-2.5 2.5l8-8" /></svg>
    },
    {
      eyebrow: "اطمئن",
      title: "مكافأتك من سوقك، وليست من البائع",
      body: "سوقك هي من تمنحك المكافأة تقديرًا لدعواتك. لا تُخصم المكافأة من مستحقات البائع، ولا تزيد عليه أي تكلفة أو خسارة.",
      icon: <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
    },
    {
      eyebrow: "معلومة مهمة",
      title: "المكافأة ليست من سعر السلعة",
      body: "تُحسب المكافأة من إيراد سوقك فقط. فمثلاً إذا حصلت سوقك على 3,000 ريال من رسوم حماية المشتري، تكون مكافأتك 300 ريال، وليس 10% من قيمة السلعة.",
      icon: <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-12v2m0 12v2m9-9h-2M5 12H3m15.364-6.364l-1.414 1.414M7.05 16.95l-1.414 1.414m0-12.728L7.05 7.05m9.9 9.9l1.414 1.414" /></svg>
    }
  ];

  const closeGuide = () => {
    localStorage.setItem("souqak-referrals-guide-seen", "1");
    setShowGuide(false);
    setGuideStep(0);
  };

  const nextGuideStep = () => {
    if (guideStep === guideSteps.length - 1) {
      closeGuide();
      return;
    }
    setGuideStep(step => step + 1);
  };

  useEffect(() => {
    Promise.all([api.get("/referrals/me"), api.get("/referrals/me/commissions")])
      .then(([summary, history]) => {
        setData(summary.data);
        setCommissions(history.data.items || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const copyLink = async () => {
    if (!data?.referralLink) return;
    await navigator.clipboard.writeText(data.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const shareWhatsApp = () => {
    if (!data?.referralLink) return;
    const text = `انضم إلى سوقك عبر رابط دعوتي: ${data.referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  if (loading) return <div className="mx-auto max-w-5xl p-6 text-center">جارٍ تحميل بيانات سفراء سوقك...</div>;

  const totalsByCurrency = data?.totalsByCurrency || {};
  const amountFor = (currency, status) => {
    if (status === "AVAILABLE") return totalsByCurrency[currency]?.AVAILABLE || 0;
    if (status === "PENDING") return totalsByCurrency[currency]?.PENDING || 0;
    if (status === "TOTAL") return totalsByCurrency[currency]?.TOTAL || 0;
    return totalsByCurrency[currency]?.[status] || 0;
  };

  return (
    <main dir="rtl" className="relative mx-auto max-w-6xl space-y-6 overflow-hidden p-4 md:p-8">
      <div className="pointer-events-none absolute -right-24 top-0 h-64 w-64 rounded-full bg-emerald-200/35 blur-3xl dark:bg-emerald-900/20" />
      <div className="pointer-events-none absolute -left-24 top-56 h-72 w-72 rounded-full bg-blue-200/35 blur-3xl dark:bg-blue-900/20" />
      <div className="relative flex items-start justify-between gap-4 rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-xl shadow-blue-100/40 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/80 dark:shadow-none sm:p-7">
      <header>
        <p className="text-sm font-black text-emerald-600">برنامج المكافآت</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">سفراء سوقك</h1>
        <p className="mt-2 max-w-2xl text-base font-bold text-slate-600 dark:text-slate-300">ادعُ أصدقاءك إلى سوقك واربح من استخدامهم للمنصة.</p>
        <p className="mt-1 text-sm font-medium text-slate-500">تحصل على 10% من العمولة أو الرسم الذي تحصل عليه سوقك، وليس من قيمة السلعة.</p>
      </header>
        <button type="button" onClick={() => { setGuideStep(0); setShowGuide(true); }} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 shadow-sm transition hover:border-blue-300 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300" aria-label="كيف يعمل نظام الإحالة؟">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-sm font-black text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">؟</span>
          <span className="hidden sm:inline">كيف يعمل؟</span>
        </button>
      </div>

      <section className="relative overflow-hidden rounded-[28px] border border-blue-200/80 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-5 text-white shadow-xl shadow-blue-500/20 sm:p-7">
        <div className="pointer-events-none absolute -left-8 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold text-blue-100">مساحتك الخاصة للنمو</p><h2 className="mt-1 text-xl font-black">رابطك الخاص</h2></div><span className="rounded-2xl bg-white/15 px-3 py-2 text-2xl">↗</span></div>
          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <input readOnly value={data?.referralLink || ""} className="min-w-0 flex-1 rounded-xl border border-white/20 bg-white px-4 py-3 text-left text-sm text-slate-800 shadow-inner outline-none" />
            <button onClick={copyLink} className="rounded-xl bg-white px-5 py-3 font-black text-blue-700 shadow-lg transition hover:-translate-y-0.5">{copied ? "تم النسخ ✓" : "نسخ الرابط"}</button>
            <button onClick={shareWhatsApp} className="rounded-xl bg-emerald-400 px-5 py-3 font-black text-emerald-950 shadow-lg transition hover:-translate-y-0.5">مشاركة عبر واتساب</button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 shadow-sm dark:border-violet-900/50 dark:from-violet-950/30 dark:to-slate-900">
          <p className="text-sm text-slate-500">الأشخاص المدعوون</p>
          <p className="mt-2 text-2xl font-black text-blue-600 dark:text-blue-400">{Number(data?.totalReferredUsers || 0).toLocaleString()}</p>
          <p className="mt-1 text-xs font-bold text-slate-400">مستخدمون جدد مرتبطون بك</p>
        </div>
        {[
          ["إجمالي المكافآت", "AVAILABLE"],
          ["مكافآت معلقة", "PENDING"],
          ["متاح للسحب", "AVAILABLE"]
        ].map(([label, status], index) => <div key={label} className={`rounded-2xl border p-4 shadow-sm sm:p-5 dark:bg-slate-900 ${index === 0 ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white dark:border-emerald-900/50 dark:from-emerald-950/30" : index === 1 ? "border-amber-200 bg-gradient-to-br from-amber-50 to-white dark:border-amber-900/50 dark:from-amber-950/30" : "border-blue-200 bg-gradient-to-br from-blue-50 to-white dark:border-blue-900/50 dark:from-blue-950/30"}`}><p className="text-sm font-bold text-slate-600 dark:text-slate-300">{label}</p><div className="mt-3 grid grid-cols-2 gap-2">{rewardCurrencies.map(currency => <div key={currency} className="rounded-xl bg-white/75 px-2 py-2 text-center shadow-sm dark:bg-slate-800/80"><span className="block truncate text-[10px] font-bold text-slate-400 sm:text-xs">{currencyLabels[currency]}</span><span className="mt-0.5 block text-sm font-black text-blue-600 dark:text-blue-400 sm:text-base">{Number(amountFor(currency, index === 0 ? "TOTAL" : index === 1 ? "PENDING" : "AVAILABLE")).toLocaleString()}</span></div>)}</div></div>)}
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white/85 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/85 sm:p-7">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black text-blue-600">ثلاث خطوات فقط</p><h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white">كيف يعمل؟</h2></div><span className="text-3xl">✦</span></div>
        <ol className="mt-5 grid gap-3 text-slate-600 dark:text-slate-300 md:grid-cols-3"><li className="rounded-2xl bg-blue-50 p-4 font-bold dark:bg-blue-950/30">01<br /><span className="text-sm">انسخ رابطك الخاص.</span></li><li className="rounded-2xl bg-emerald-50 p-4 font-bold dark:bg-emerald-950/30">02<br /><span className="text-sm">شاركه مع أصدقائك.</span></li><li className="rounded-2xl bg-amber-50 p-4 font-bold dark:bg-amber-950/30">03<br /><span className="text-sm">اربح عند استخدامهم لخدمات مؤهلة.</span></li></ol>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-5 dark:border-slate-700"><h2 className="text-xl font-black text-slate-900 dark:text-white">سجل المكافآت</h2></div>
        <div className="overflow-x-auto"><table className="w-full text-right text-sm"><thead className="bg-slate-50 dark:bg-slate-800"><tr><th className="px-5 py-3">الخدمة</th><th className="px-5 py-3">إيراد سوقك</th><th className="px-5 py-3">مكافأتك</th><th className="px-5 py-3">الحالة</th></tr></thead><tbody>{commissions.map(item => <tr key={item._id} className="border-t border-slate-100 dark:border-slate-800"><td className="px-5 py-3">{item.platformRevenueType}</td><td className="px-5 py-3">{item.platformRevenueAmount.toLocaleString()} {item.currency}</td><td className="px-5 py-3 font-bold">{item.commissionAmount.toLocaleString()} {item.currency}</td><td className="px-5 py-3">{statusLabels[item.status] || item.status}</td></tr>)}</tbody></table></div>
        {!commissions.length && <p className="p-8 text-center text-slate-500">ستظهر مكافآتك هنا عند تحقق نشاط مؤهل.</p>}
      </section>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="referral-guide-title">
          <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <button type="button" onClick={closeGuide} className="absolute left-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-500 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300" aria-label="إغلاق">×</button>
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 px-6 pb-7 pt-8 text-white">
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/15 text-emerald-50 shadow-inner">{guideSteps[guideStep].icon}</div>
              <p className="text-sm font-bold text-emerald-100">{guideSteps[guideStep].eyebrow}</p>
              <h2 id="referral-guide-title" className="mt-1 text-2xl font-black">{guideSteps[guideStep].title}</h2>
            </div>
            <div className="space-y-6 p-6">
              <p className="min-h-[96px] text-base font-medium leading-8 text-slate-600 dark:text-slate-300">{guideSteps[guideStep].body}</p>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5" aria-label={`الخطوة ${guideStep + 1} من ${guideSteps.length}`}>
                  {guideSteps.map((step, index) => <span key={step.title} className={`h-2 rounded-full transition-all ${index === guideStep ? "w-7 bg-emerald-600" : "w-2 bg-slate-200 dark:bg-slate-700"}`} />)}
                </div>
                <div className="flex gap-2">
                  {guideStep > 0 && <button type="button" onClick={() => setGuideStep(step => step - 1)} className="rounded-xl border border-slate-200 px-4 py-2.5 font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">السابق</button>}
                  <button type="button" onClick={nextGuideStep} className="rounded-xl bg-emerald-600 px-5 py-2.5 font-black text-white shadow-lg shadow-emerald-600/20">{guideStep === guideSteps.length - 1 ? "فهمت" : "التالي"}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
