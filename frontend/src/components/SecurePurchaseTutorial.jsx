import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const tutorialKey = (userId) => `secure_purchase_tutorial_seen:${userId}`;

const steps = [
  { number: "01", eyebrow: "قبل أن تتواصل", title: "تصفح الإعلان بثقة", description: "اقرأ الوصف، راجع الصور والمواصفات، وتأكد من تفاصيل البائع قبل الاتفاق. عند جاهزيتك، استخدم الشراء الآمن بدلاً من تحويل المال مباشرة.", icon: "⌕", accent: "bg-blue-600" },
  { number: "02", eyebrow: "خطوتك التالية", title: "ابحث عن الدرع الأخضر", description: "زر شراء آمن (وساطة المنصة) أسفل أزرار التواصل. باختياره، يبقى المبلغ محجوزاً لدى سوقك حتى تستلم المنتج وتفحصه.", icon: "✓", accent: "bg-emerald-600" },
  { number: "03", eyebrow: "تفاصيل الطلب", title: "املأ الحقول باتفاق واضح", description: "السعر المتفق عليه هو المبلغ النهائي بعد التفاوض، والعملة تحدد طريقة عرض الحساب. اختر من يتحمل التوصيل، ثم أدخل رسومه إن كانت على المشتري.", icon: "▤", accent: "bg-amber-500", fields: [["السعر المتفق عليه", "اكتب السعر الذي اتفقتما عليه فعلياً."], ["العملة", "اختر عملة السعر والتوصيل بدقة."], ["التوصيل", "حدد المشتري أو البائع أو لا يوجد."], ["ملاحظات إضافية", "أضف اللون أو الموعد أو أي اتفاق خاص."]] },
  { number: "04", eyebrow: "حماية الطرفين", title: "راجع الإجمالي ثم أرسل الطلب", description: "ستظهر لك قيمة السلعة والتوصيل ورسوم حماية المشتري (3%) والإجمالي. راجعها، وافق على الشروط، ثم أرسل الطلب لتبدأ الوساطة.", icon: "▣", accent: "bg-slate-900", fields: [["حماية المشتري", "رسوم الخدمة الظاهرة في ملخص السعر."], ["المبلغ الإجمالي", "المبلغ الذي ستراجعه قبل الإرسال."], ["الموافقة", "لا ترسل الطلب قبل قراءة الشروط والموافقة عليها."]] }
];

export default function SecurePurchaseTutorial({ user, buttonRef, onTrySecurePurchase }) {
  const userId = user?._id || user?.id;
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (!userId || localStorage.getItem(tutorialKey(userId))) return undefined;
    setVisible(true);
    const media = window.matchMedia("(max-width: 768px)");
    const updateViewport = () => setIsMobile(media.matches);
    updateViewport();
    media.addEventListener?.("change", updateViewport);
    document.body.style.overflow = "hidden";
    return () => {
      media.removeEventListener?.("change", updateViewport);
      document.body.style.overflow = "";
    };
  }, [userId]);

  useEffect(() => {
    if (visible && isMobile && buttonRef?.current) buttonRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [buttonRef, isMobile, visible]);

  if (!visible || !userId) return null;
  const currentStep = steps[step];
  const finish = () => { localStorage.setItem(tutorialKey(userId), "true"); document.body.style.overflow = ""; setVisible(false); };
  const tryPurchase = () => { finish(); onTrySecurePurchase(); };

  return (
    <AnimatePresence>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/75 p-2 backdrop-blur-md sm:p-6" dir="rtl">
        <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="relative flex max-h-[calc(100dvh-16px)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl sm:flex-row sm:rounded-[2rem]">
          <div className="relative flex h-[112px] shrink-0 flex-col justify-between overflow-hidden bg-slate-950 p-3 text-white sm:h-auto sm:w-[38%] sm:p-8">
            <div className="absolute -left-16 -top-16 h-44 w-44 rounded-full border-[24px] border-emerald-400/20" />
            <div className="relative"><div className="mb-2 flex items-center gap-2 text-[10px] font-black tracking-widest text-emerald-300 sm:mb-8 sm:text-xs"><span className="h-2 w-2 rounded-full bg-emerald-400" /> جولة الشراء الآمن</div><div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-lg ${currentStep.accent} text-lg font-black shadow-lg sm:mb-6 sm:h-16 sm:w-16 sm:rounded-2xl sm:text-3xl`}>{currentStep.icon}</div><p className="text-[9px] font-black text-slate-400 sm:mb-2 sm:text-xs">المرحلة {currentStep.number} من 04</p><h2 className="hidden text-2xl font-black leading-tight sm:block">تجربة أولى<br />أكثر أماناً.</h2></div>
            <div className="relative mt-8 flex gap-1.5">{steps.map((item, index) => <div key={item.number} className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-emerald-400" : "bg-white/15"}`} />)}</div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-8">
            <div className="min-h-0 flex-1 overflow-y-auto pl-1"><p className="mb-1 text-[10px] font-black tracking-widest text-emerald-600 sm:mb-2 sm:text-xs">{currentStep.eyebrow}</p><h3 className="mb-2 text-xl font-black text-slate-900 sm:mb-3 sm:text-3xl">{currentStep.title}</h3><p className="text-[12px] font-medium leading-6 text-slate-600 sm:text-sm sm:leading-8">{currentStep.description}</p>{currentStep.fields && <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-6 sm:grid-cols-2">{currentStep.fields.map(([label, detail]) => <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-2 sm:rounded-2xl sm:p-3.5"><p className="mb-0.5 text-[10px] font-black text-slate-900 sm:mb-1 sm:text-xs">{label}</p><p className="text-[9px] font-medium leading-4 text-slate-500 sm:text-[11px] sm:leading-5">{detail}</p></div>)}</div>}</div>
            <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:mt-6 sm:gap-3 sm:pt-5 sm:flex-row sm:items-center">{!isMobile && <button onClick={finish} className="order-2 px-3 py-3 text-sm font-bold text-slate-400 hover:text-slate-700 sm:order-1">تخطي الجولة</button>}<button onClick={step < steps.length - 1 ? () => setStep(step + 1) : tryPurchase} className="order-1 flex-1 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700 active:scale-[.98] sm:order-2 sm:py-3.5">{step < steps.length - 1 ? "التالي" : "جرّب الشراء الآمن الآن"}</button></div>
            {isMobile && <p className="mt-2 hidden text-center text-[10px] font-bold text-slate-400 sm:block">أكمل الجولة واضغط الزر لتجربة النموذج بنفسك</p>}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}