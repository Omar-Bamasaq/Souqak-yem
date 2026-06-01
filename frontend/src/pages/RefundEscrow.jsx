import React from "react";

export default function RefundEscrow() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 rounded-lg border bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-gray-900">نظام الضمان لمنصة سوقك</h1>
      
      <section>
        <h2 className="text-lg font-semibold text-gray-900">مقدمة:</h2>
        <p className="text-sm text-gray-700">
          توضح هذه السياسة مسؤولية منصة سوقك بشأن أي ضمان يتعلق بالمنتجات المعروضة.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">المسؤولية:</h2>
        <ul className="list-disc space-y-2 px-5 text-sm text-gray-700">
          <li>منصة سوقك لا تتحمل أي مسؤولية عن جودة أو سلامة المنتجات أو الخدمات.</li>
          <li>جميع الأمور المتعلقة بالضمان تتم مباشرة بين البائع والمشتري.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">الحالات الاستثنائية:</h2>
        <ul className="list-disc space-y-2 px-5 text-sm text-gray-700">
          <li>في حال وجود مستخدم موثق ارتكب احتيالاً، ستقوم منصة سوقك بمساعدة المتضرر بما تتيحه الأدلة المتوفرة لديها.</li>
          <li>يمكن لكل مستخدم رفع شكوى للإدارة حول أي بائع أو منتج، وسيتم مراجعتها بدقة.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">تنويه:</h2>
        <ul className="list-disc space-y-2 px-5 text-sm text-gray-700">
          <li>يُنصح المستخدمون بالتأكد من المنتج وفحصه قبل إتمام الصفقة.</li>
          <li>منصة سوقك تعمل كوسيط عرض فقط، ولا تقدم ضمانات على المنتجات.</li>
        </ul>
      </section>
    </div>
  );
}
