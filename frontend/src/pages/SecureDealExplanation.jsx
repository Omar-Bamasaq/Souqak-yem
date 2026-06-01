import React from "react";
import { Link } from "react-router-dom";

export default function SecureDealExplanation() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-6 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-10 sm:mb-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-emerald-600 text-white mb-4 sm:mb-6 shadow-2xl shadow-emerald-500/30">
            <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-4 sm:mb-6 leading-tight px-2">
            نظام الضمان والشراء الآمن في سوقك
          </h1>
          <p className="text-sm sm:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto font-bold leading-relaxed px-4">
            نحمي أموالك ونضمن وصول حقك. مع سوقك، البيع والشراء عبر الإنترنت في اليمن أصبح أكثر أماناً من أي وقت مضى.
          </p>
        </div>

        {/* Core Concept */}
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 sm:p-12 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 mb-8 sm:mb-12">
          <div className="grid md:grid-cols-2 gap-8 sm:gap-12 items-center">
            <div className="order-2 md:order-1 text-center md:text-right">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-4 sm:mb-6">ما هو الشراء الآمن؟</h2>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 font-bold leading-relaxed mb-4">
                هو نظام وساطة مالية (Escrow) حيث يقوم سوقك بدور الطرف الثالث الموثوق.
              </p>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 font-bold leading-relaxed">
                بدلاً من تحويل المال مباشرة للبائع والمخاطرة بالتعرض للاحتيال، يتم حجز المبلغ في "خزنة سوقك" حتى تستلم السلعة وتفحصها بنفسك.
              </p>
            </div>
            <div className="relative order-1 md:order-2">
              <div className="aspect-square rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 flex items-center justify-center p-6 sm:p-8">
                <svg className="w-24 h-24 sm:w-full sm:h-full text-emerald-600 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* The Process */}
        <div className="mb-10 sm:mb-16">
          <h2 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white text-center mb-8 sm:mb-12">كيف تضمن حقك في 5 خطوات؟</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[
              {
                step: "01",
                title: "طلب الشراء",
                desc: "يختار المشتري 'شراء آمن' من صفحة الإعلان ويقوم بتحويل المبلغ إلى حسابات سوقك المعتمدة."
              },
              {
                step: "02",
                title: "حجز المبلغ",
                desc: "تقوم إدارة سوقك بالتأكد من وصول المبلغ وحجزه في النظام، ثم إشعار البائع ببدء التجهيز."
              },
              {
                step: "03",
                title: "شحن السلعة",
                desc: "يقوم البائع بتسليم السلعة للمشتري عبر شركة الشحن المتفق عليها أو التسليم اليدوي."
              },
              {
                step: "04",
                title: "الفحص والتأكيد",
                desc: "يفحص المشتري السلعة، وإذا كانت مطابقة للمواصفات، يضغط على 'تأكيد الاستلام' من لوحة التحكم."
              },
              {
                step: "05",
                title: "تحرير المال",
                desc: "بمجرد التأكيد، يتم تحويل المبلغ فوراً إلى محفظة البائع ليتمكن من سحبه في أي وقت."
              }
            ].map((item, index) => (
              <div key={index} className="group p-6 sm:p-8 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-emerald-500 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-emerald-500/5">
                <div className="text-3xl sm:text-4xl font-black text-emerald-600/10 group-hover:text-emerald-600/20 mb-3 sm:mb-4">{item.step}</div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-2 sm:mb-3">{item.title}</h3>
                <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm font-bold leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Dispute Resolution */}
        <div className="bg-gray-900 rounded-[2.5rem] p-8 sm:p-12 text-white mb-10 sm:mb-16 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-64 h-64 bg-blue-600/20 blur-[100px] -translate-x-1/2 -translate-y-1/2"></div>
          <div className="relative z-10">
            <h2 className="text-2xl sm:text-3xl font-black mb-6">ماذا لو حدث خلاف؟</h2>
            <div className="space-y-6">
              <p className="text-sm sm:text-lg text-blue-100 font-bold leading-relaxed">
                في حال لم تكن السلعة مطابقة للمواصفات أو حدثت مشكلة في التسليم، يمكن للمشتري فتح "نزاع" (Dispute).
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                  <h4 className="font-black text-emerald-400 mb-2">دورنا كحكم</h4>
                  <p className="text-xs sm:text-sm text-gray-300 font-bold">يقوم فريق الدعم بمراجعة المحادثات والأدلة وصور المنتج لاتخاذ قرار عادل للطرفين.</p>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                  <h4 className="font-black text-emerald-400 mb-2">ضمان الاسترداد</h4>
                  <p className="text-xs sm:text-sm text-gray-300 font-bold">إذا ثبت حق المشتري، يتم إعادة المبلغ كاملاً إلى محفظته في سوقك فوراً.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center bg-white dark:bg-slate-900 rounded-[2rem] p-8 sm:p-12 border border-slate-100 dark:border-slate-800 shadow-sm">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-4">هل أنت جاهز لتجربة الشراء الآمن؟</h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mb-8 font-bold">ابدأ الآن بحماية صفقاتك واستمتع براحة البال.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/wallet" className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 dark:shadow-none">ابدأ الآن من محفظتك</Link>
            <Link to="/" className="px-8 py-4 bg-slate-100 text-slate-900 rounded-2xl font-black hover:bg-slate-200 transition-all">العودة للرئيسية</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
