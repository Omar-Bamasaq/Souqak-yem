import React from "react";
import { Link } from "react-router-dom";

const partners = [
  {
    name: "أمانة",
    logo: "/Amana-Logo.svg",
    logoAlt: "شعار أمانة",
    description: "خدمة الوساطة المرتبطة بالشراء الآمن، مع متابعة الطلب والنزاع من خلال سوقك.",
    action: "تعرّف على الشراء الآمن",
    to: "/secure-deal-explanation",
    theme: "border-emerald-100 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/20"
  },
  {
    name: "تمام باي Tmam Pay",
    logo: "/tmam-full-logo.png",
    logoAlt: "شعار تمام باي Tmam Pay",
    description: "شريك مستقل لخدمات الدفع الإلكتروني. الدفع عبره غير مفعّل في مسارات طلبات الخدمات الحالية.",
    action: "خدمات الدفع في سوقك",
    to: "/wallet-services",
    theme: "border-blue-100 bg-blue-50/60 dark:border-blue-900/50 dark:bg-blue-950/20"
  }
];

export default function Partners() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-3 py-6 sm:space-y-8 sm:px-5 sm:py-12" dir="rtl">
      <header className="rounded-3xl bg-gradient-to-l from-slate-900 via-blue-950 to-slate-900 px-5 py-8 text-center text-white shadow-lg sm:px-10 sm:py-12">
        <p className="text-xs font-black text-blue-200 sm:text-sm">منصة سوقك</p>
        <h1 className="mt-2 text-2xl font-black sm:text-4xl">شركاؤنا</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-200 sm:text-base sm:leading-7">
          نتعاون مع خدمات مستقلة في مجالات محددة، مع وضوح دور كل شريك عن دور سوقك.
        </p>
      </header>

      <section aria-label="شركاء سوقك" className="grid gap-4 sm:grid-cols-2 sm:gap-6">
        {partners.map((partner) => (
          <article key={partner.name} className={`flex min-w-0 flex-col rounded-3xl border p-5 shadow-sm sm:p-7 ${partner.theme}`}>
            <div className="flex h-20 items-center justify-start rounded-2xl border border-white/80 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
              <img src={partner.logo} alt={partner.logoAlt} loading="lazy" decoding="async" className="h-14 max-w-full object-contain" />
            </div>
            <h2 className="mt-5 text-xl font-black text-slate-900 dark:text-white">{partner.name}</h2>
            <p className="mt-2 min-h-14 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">{partner.description}</p>
            <Link
              to={partner.to}
              className="mt-5 inline-flex min-h-11 items-center justify-center self-start rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:bg-blue-700 dark:hover:bg-blue-600"
            >
              {partner.action}
            </Link>
          </article>
        ))}
      </section>

      <p className="rounded-2xl border border-slate-200 bg-white p-4 text-xs font-semibold leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 sm:p-5 sm:text-sm">
        سوقك هي منصة الإعلانات والطلبات. أمانة مرتبطة بخدمة الوساطة والشراء الآمن، وتمام باي شريك مستقل لخدمات الدفع الإلكتروني.
      </p>
    </main>
  );
}
