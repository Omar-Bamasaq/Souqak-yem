import React from "react";

export default function Terms() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 py-10 px-4 sm:px-6">
      <div className="text-center space-y-4 mb-12">
        <h1 className="text-3xl md:text-4xl font-black text-gray-900">الشروط والأحكام لمنصة سوقك</h1>
        <p className="text-gray-500 font-bold">آخر تحديث: {new Date().toLocaleDateString('ar-YE')}</p>
        <div className="h-1.5 w-20 bg-blue-600 mx-auto rounded-full"></div>
      </div>
      
      <div className="grid gap-6 sm:gap-8">
        <section className="bg-white p-6 sm:p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h2 className="text-xl font-black text-gray-900">1. مقدمة</h2>
          </div>
          <p className="text-sm sm:text-base text-gray-600 font-bold leading-relaxed">
            باستخدامك منصة سوقك، فإنك توافق على هذه الشروط والأحكام. سوقك هي منصة وسيطة تربط بين البائعين والمشترين في اليمن، وتوفر أدوات تقنية لضمان أمان التعاملات.
          </p>
        </section>

        <section className="bg-white p-6 sm:p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
            <h2 className="text-xl font-black text-gray-900">2. نظام الضمان والوساطة (Escrow)</h2>
          </div>
          <div className="space-y-4">
            <p className="text-sm sm:text-base text-gray-600 font-bold leading-relaxed">
              يوفر سوقك نظام "الشراء الآمن" لحماية أموالك:
            </p>
            <ul className="list-disc space-y-3 px-5 text-sm sm:text-base text-gray-600 font-bold">
              <li>عند اختيار "شراء آمن"، يتم حجز المبلغ لدى سوقك ولا يسلم للبائع إلا بعد تأكيد المشتري للاستلام.</li>
              <li>في حال وجود خلاف، يتدخل فريق الدعم كحكم لفض النزاع بناءً على الأدلة المقدمة.</li>
              <li>تطبق عمولة إدارية بسيطة على عمليات الوساطة لتغطية تكاليف التشغيل والتحويلات.</li>
            </ul>
          </div>
        </section>

        <section className="bg-white p-6 sm:p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h2 className="text-xl font-black text-gray-900">3. المحتوى والإعلانات المحظورة</h2>
          </div>
          <ul className="list-disc space-y-3 px-5 text-sm sm:text-base text-gray-600 font-bold">
            <li>يمنع منعاً باتاً نشر إعلانات الأسلحة، المواد المخدرة، الأدوية غير المرخصة، أو أي محتوى يخالف القوانين اليمنية أو الآداب العامة.</li>
            <li>يجب أن تكون الصور حقيقية للمنتج وتعبر عن حالته الفعلية.</li>
            <li>يحق للإدارة حذف أي إعلان أو حظر أي مستخدم يخالف هذه السياسات دون إنذار مسبق.</li>
          </ul>
        </section>

        <section className="bg-white p-6 sm:p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </div>
            <h2 className="text-xl font-black text-gray-900">4. المحفظة والعمليات المالية</h2>
          </div>
          <ul className="list-disc space-y-3 px-5 text-sm sm:text-base text-gray-600 font-bold">
            <li>تستخدم المحفظة لاستلام أرباح البيع أو استرداد الأموال في حالات النزاع.</li>
            <li>يمكن طلب سحب الرصيد إلى الحسابات البنكية أو مكاتب الصرافة المعتمدة، وتستغرق المعالجة من 24-48 ساعة عمل.</li>
            <li>يجب تقديم هوية صحيحة (بطاقة شخصية/جواز سفر) عند طلب سحب مبالغ كبيرة لضمان أمان الحساب.</li>
          </ul>
        </section>

        <section className="bg-gray-900 p-8 rounded-[2.5rem] text-white shadow-xl shadow-blue-500/10">
          <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-sm">!</span>
            تنبيه هام
          </h2>
          <p className="text-sm sm:text-base text-blue-100 font-bold leading-relaxed">
            سوقك هو وسيط تقني. في حال اخترت التعامل "خارج" نظام الشراء الآمن (الدفع المباشر للبائع)، فإن المنصة لا تتحمل أي مسؤولية قانونية أو مالية عن ضياع حقك، وننصح دائماً باستخدام "الشراء الآمن" لضمان حقك.
          </p>
        </section>
      </div>
    </div>
  );
}
