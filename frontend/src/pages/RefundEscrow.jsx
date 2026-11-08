import React from "react";

export default function RefundEscrow() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 rounded-lg border bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <img src="/Amana-Logo.svg" alt="أمانة" className="h-10 w-10 rounded-xl bg-white object-contain p-1" />
        <h1 className="text-2xl font-bold text-gray-900">الشراء الآمن عبر أمانة</h1>
      </div>
      
      <section>
        <h2 className="text-lg font-semibold text-gray-900">مقدمة:</h2>
        <p className="text-sm text-gray-700">
          سوقك منصة للإعلانات والطلبات ومتابعة الشحن، وأمانة هي هوية خدمة الوساطة المرتبطة بخيار الشراء الآمن. تمام باي شريك مستقل لخدمات الدفع الإلكتروني، ولا يعني ذكره توفر تكامل دفع في كل مسار.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">المسؤولية:</h2>
        <ul className="list-disc space-y-2 px-5 text-sm text-gray-700">
          <li>منصة سوقك لا تتحمل أي مسؤولية عن جودة أو سلامة المنتجات أو الخدمات.</li>
          <li>تتم متابعة الطلبات المقدمة عبر الشراء الآمن من صفحة العملية في سوقك، وفق الإجراءات الحالية.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">الحالات الاستثنائية:</h2>
        <ul className="list-disc space-y-2 px-5 text-sm text-gray-700">
          <li>في حال وجود مستخدم موثق ارتكب احتيالاً، ستقوم منصة سوقك بمساعدة المتضرر بما تتيحه الأدلة المتوفرة لديها.</li>
          <li>يمكن لكل مستخدم رفع نزاع أو شكوى عبر مسارات الطلب المتاحة، وتراجعها الإدارة وفق الإجراء الحالي.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">تنويه:</h2>
        <ul className="list-disc space-y-2 px-5 text-sm text-gray-700">
          <li>يُنصح المستخدمون بالتأكد من المنتج وفحصه قبل إتمام الصفقة.</li>
          <li>استخدام هوية أمانة لا يعني بذاته أن الأموال محفوظة في حساب مستقل لديها أو أن تكاملاً مالياً خارجياً قد اكتمل.</li>
          <li>لا تغيّر هذه الصفحة آلية معالجة الاسترداد أو قرارات النزاع المعمول بها حالياً.</li>
        </ul>
      </section>
    </div>
  );
}
