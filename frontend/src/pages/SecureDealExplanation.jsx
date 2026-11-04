import React from "react";
import { Link } from "react-router-dom";

export default function SecureDealExplanation() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-4 px-3 sm:py-12 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-6 sm:mb-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-emerald-600 text-white mb-4 sm:mb-6 shadow-2xl shadow-emerald-500/30">
            <img src="/Amana-Logo.svg" alt="أمانة" className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-white object-contain p-1" />
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-4 sm:mb-6 leading-tight px-2">
            شراء منتج من خارج سوقك؟
          </h1>

          <p className="text-sm sm:text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto font-bold leading-relaxed px-4">
            يمكنك متابعة طلب الشراء وشحنه عبر سوقك، بينما تحمل خدمة الوساطة المرتبطة بالشراء الآمن هوية أمانة.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:rounded-[2rem] sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 mb-5 sm:mb-12">
          <div className="grid md:grid-cols-2 gap-5 sm:gap-12 items-center">
            <div className="text-center md:text-right">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-4 sm:mb-6">كيف يعمل هذا؟</h2>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 font-bold leading-relaxed mb-4">
                تواصل أولاً مع البائع خارج المنصة، ثم بعد الاتفاق، يضيف البائع المنتج إلى سوقك، وتقوم بشرائه من داخل السوق عبر الشراء الآمن.
              </p>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 font-bold leading-relaxed">
                سوقك مخصص لعرض الإعلانات وإنشاء الطلبات ومتابعة الشحن. وتظهر أمانة بوصفها هوية خدمة الوساطة المرتبطة بخيار الشراء الآمن؛ لا تعني هذه الصفحة أن الربط المالي الخارجي قد اكتمل أو تحدد جهة حيازة الأموال.
              </p>
            </div>

            <div className="relative">
              <div className="aspect-[4/3] md:aspect-square rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 flex items-center justify-center p-4 sm:p-8">
                <svg className="w-24 h-24 sm:w-full sm:h-full text-emerald-600 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 sm:mb-16">
          <h2 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white text-center mb-5 sm:mb-12">5 خطوات سهلة وآمنة</h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-6">
            {[
              {
                step: "01",
                title: "تواصل مع البائع",
                desc: "تراسله خارج المنصة وتأكد من تفاصيل المنتج والسعر والمواصفات."
              },
              {
                step: "02",
                title: "يعرض الإعلان على سوقك",
                desc: "البائع يضع المنتج في سوقك أو يرفعه كإعلان جديد عبر حسابه في المنصة."
              },
              {
                step: "03",
                title: "تراجع المنتج",
                desc: "تقرأ الوصف والصور والمواصفات جيداً قبل الموافقة على الشراء."
              },
              {
                step: "04",
                title: "تشتري عبر الشراء الآمن",
                desc: "تختار الشراء الآمن عبر أمانة، وتنشئ طلبك وتتابع تفاصيله من سوقك."
              },
              {
                step: "05",
                title: "تأكيد الاستلام",
                desc: "بعد استلامك للمنتج والتأكد من مطابقته، تؤكد الاستلام ويتم تحرير المبلغ للبائع."
              }
            ].map((item, index) => (
              <div key={index} className="group p-5 sm:p-6 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-emerald-500 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-emerald-500/5">
                <div className="text-3xl sm:text-4xl font-black text-emerald-600/10 group-hover:text-emerald-600/20 mb-3 sm:mb-4">{item.step}</div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mb-2 sm:mb-3">{item.title}</h3>
                <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm font-bold leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900 rounded-3xl p-5 sm:rounded-[2.5rem] sm:p-12 text-white mb-6 sm:mb-16 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-64 h-64 bg-blue-600/20 blur-[100px] -translate-x-1/2 -translate-y-1/2"></div>
          <div className="relative z-10">
            <h2 className="text-2xl sm:text-3xl font-black mb-6">لماذا هذا آمن؟</h2>
            <div className="space-y-4 sm:space-y-6">
              <p className="text-sm sm:text-lg text-blue-100 font-bold leading-relaxed">
                لأن خيار الشراء الآمن يرتبط بخدمة الوساطة ذات هوية أمانة، بينما يبقى عرض الإعلان ومتابعة الطلب والشحن عبر سوقك. تفاصيل الإجراءات المالية تتبع المسار المعتمد للعملية.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                  <h4 className="font-black text-emerald-400 mb-2">حماية المال</h4>
                  <p className="text-xs sm:text-sm text-gray-300 font-bold">تابع حالة الطلب وخطواته من صفحة العملية في سوقك.</p>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                  <h4 className="font-black text-emerald-400 mb-2">إمكانية النزاع</h4>
                  <p className="text-xs sm:text-sm text-gray-300 font-bold">إذا كان هناك خلل أو منتج غير مطابق، يمكن فتح نزاع للنظر في المشكلة.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center bg-white dark:bg-slate-900 rounded-3xl p-5 sm:rounded-[2rem] sm:p-12 border border-slate-100 dark:border-slate-800 shadow-sm">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-4">تعرّف على خدمة أمانة</h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mb-8 font-bold">تعرّف على خدمة الوساطة المرتبطة بخيار الشراء الآمن.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/wallet" className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 dark:shadow-none">بدء الشراء الآمن</Link>
          <a href="https://amana-escrow.infinityfreeapp.com/" target="_blank" rel="noopener noreferrer" className="px-8 py-4 bg-emerald-50 text-emerald-800 rounded-2xl font-black hover:bg-emerald-100 transition-all">زيارة موقع أمانة</a>
          <Link to="/" className="px-8 py-4 bg-slate-100 text-slate-900 rounded-2xl font-black hover:bg-slate-200 transition-all">العودة للرئيسية</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
