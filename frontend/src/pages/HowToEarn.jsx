import React from "react";
import { Link } from "react-router-dom";

export default function HowToEarn() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Header Section */}
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-6">كيف تربح من "سوقك"؟ 💰</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
          حول هاتفك إلى مصدر دخل حقيقي. ابدأ في تسويق منتجات الآخرين واحصل على عمولات مجزية مع كل عملية بيع ناجحة.
        </p>
      </div>

      {/* Steps Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
        <StepCard 
          number="1" 
          title="ابحث عن المنتجات" 
          desc="تصفح آلاف الإعلانات التي تحمل شعار 'التسويق بالعمولة'. اختر المنتجات التي تناسب جمهورك."
          icon="🔍"
        />
        <StepCard 
          number="2" 
          title="أنشئ رابطك الخاص" 
          desc="اضغط على 'ابدأ التسويق'، حدد سعرك الخاص، وانسخ رابط الإحالة الفريد لتبدأ في نشره."
          icon="🔗"
        />
        <StepCard 
          number="3" 
          title="احصل على أرباحك" 
          desc="عند إتمام أي صفقة عبر رابطك أو من خلال الشات، سيتم تسجيل عمولتك فوراً في محفظتك."
          icon="💸"
        />
      </div>

      {/* Why Suqaq Section */}
      <div className="bg-blue-600 rounded-[3rem] p-8 md:p-12 text-white mb-20 relative overflow-hidden shadow-2xl">
        <div className="relative z-10">
          <h2 className="text-3xl font-black mb-8">لماذا تختار "سوقك" للتسويق؟</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <FeatureItem title="أمان كامل" desc="نظام تأكيد ثنائي يضمن حقك في العمولة مع كل مبيعة." />
            <FeatureItem title="بدون رأس مال" desc="ابدأ عملك الخاص دون الحاجة لشراء بضاعة أو امتلاك مخازن." />
            <FeatureItem title="نظام مستويات" desc="ارفع مستواك لتصل إلى فئة VIP واحصل على أولوية ظهور لمنتجاتك." />
            <FeatureItem title="دعم فني" desc="فريقنا معك دائماً لضمان نجاح صفقاتك." />
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
      </div>

      {/* Call to Action */}
      <div className="text-center">
        <h3 className="text-2xl font-black text-gray-900 mb-6">هل أنت جاهز لتكون مسوقاً محترفاً؟</h3>
        <Link 
          to="/categories" 
          className="inline-flex items-center justify-center px-10 py-4 bg-gray-900 text-white font-black rounded-2xl hover:bg-black transition-all shadow-xl active:scale-95"
        >
          تصفح الإعلانات المتاحة للتسويق الآن
        </Link>
      </div>
    </div>
  );
}

function StepCard({ number, title, desc, icon }) {
  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all group">
      <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-inner group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div className="flex items-center gap-3 mb-4">
        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-black">
          {number}
        </span>
        <h3 className="text-xl font-black text-gray-900">{title}</h3>
      </div>
      <p className="text-sm text-gray-500 font-medium leading-relaxed">{desc}</p>
    </div>
  );
}

function FeatureItem({ title, desc }) {
  return (
    <div className="flex gap-4">
      <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div>
        <h4 className="font-bold mb-1">{title}</h4>
        <p className="text-xs text-blue-100">{desc}</p>
      </div>
    </div>
  );
}
