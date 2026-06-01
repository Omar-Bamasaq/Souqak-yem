import React from "react";

export default function Privacy() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 py-10 px-4 sm:px-6">
      <div className="text-center space-y-4 mb-12">
        <h1 className="text-3xl md:text-4xl font-black text-gray-900">سياسة الخصوصية لمنصة سوقك</h1>
        <p className="text-gray-500 font-bold">آخر تحديث: {new Date().toLocaleDateString('ar-YE')}</p>
        <div className="h-1.5 w-20 bg-blue-600 mx-auto rounded-full"></div>
      </div>

      <div className="grid gap-6 sm:gap-8">
        <section className="bg-white p-6 sm:p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <h2 className="text-xl font-black text-gray-900">1. البيانات التي نجمعها</h2>
          </div>
          <ul className="list-disc space-y-3 px-5 text-sm sm:text-base text-gray-600 font-bold">
            <li>المعلومات الشخصية: الاسم، رقم الهاتف، والبريد الإلكتروني عند التسجيل.</li>
            <li>بيانات التحقق: صور الهوية الوطنية (عند طلب توثيق الحساب أو سحب الرصيد) لضمان أمان العمليات المالية.</li>
            <li>بيانات المعاملات: تفاصيل السلع، الصور، والموقع الجغرافي (إذا تم تفعيله) لتسهيل عمليات البيع والشراء.</li>
            <li>سجلات التواصل: الرسائل والمحادثات داخل المنصة لحل النزاعات وضمان جودة الخدمة.</li>
          </ul>
        </section>

        <section className="bg-white p-6 sm:p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
            <h2 className="text-xl font-black text-gray-900">2. كيف نستخدم معلوماتك</h2>
          </div>
          <p className="text-sm sm:text-base text-gray-600 font-bold leading-relaxed mb-4">
            نستخدم البيانات لتقديم تجربة آمنة وموثوقة، بما في ذلك:
          </p>
          <ul className="list-disc space-y-3 px-5 text-sm sm:text-base text-gray-600 font-bold">
            <li>تفعيل ميزات الشراء الآمن والوساطة المالية.</li>
            <li>التحقق من هوية البائعين والمشترين لمنع الاحتيال.</li>
            <li>تحسين أداء المنصة وتقديم اقتراحات مخصصة بناءً على اهتماماتك.</li>
            <li>التواصل معك بخصوص التحديثات الأمنية أو حالة طلباتك المالية.</li>
          </ul>
        </section>

        <section className="bg-white p-6 sm:p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <h2 className="text-xl font-black text-gray-900">3. أمن وحماية البيانات</h2>
          </div>
          <p className="text-sm sm:text-base text-gray-600 font-bold leading-relaxed">
            نحن نطبق معايير أمنية عالية لحماية بياناتك من الوصول غير المصرح به. يتم تشفير جميع المعلومات الحساسة (مثل صور الهوية) ولا يتم الاطلاع عليها إلا من قبل موظفي الإدارة المختصين عند الحاجة الضرورية فقط (مثل مراجعة طلب سحب رصيد).
          </p>
        </section>

        <section className="bg-white p-6 sm:p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <h2 className="text-xl font-black text-gray-900">4. حذف البيانات</h2>
          </div>
          <p className="text-sm sm:text-base text-gray-600 font-bold leading-relaxed">
            يحق لك في أي وقت طلب حذف حسابك نهائياً من المنصة. عند القيام بذلك، سنقوم بحذف جميع بياناتك الشخصية من خوادمنا النشطة، مع الاحتفاظ ببعض سجلات المعاملات المالية فقط إذا كانت مطلوبة قانوناً أو لأغراض المحاسبة الإدارية.
          </p>
        </section>
      </div>
    </div>
  );
}
