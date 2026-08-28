import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBrokerageStatus } from '../store/BrokerageStatusContext';

const OnboardingTour = () => {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const { enabled: brokerageEnabled } = useBrokerageStatus();

  const steps = useMemo(() => {
    const baseSteps = [
      {
        title: "مرحباً بك في سوقك! 🛒",
        desc: "منصتك الأولى للتجارة الإلكترونية الآمنة في اليمن. دعنا نأخذك في جولة سريعة.",
        icon: "👋"
      },
      {
        title: "الشراء الآمن (الوساطة) 🛡️",
        desc: "نحن نضمن حقك! عند الشراء، يبقى المبلغ لدينا كطرف ثالث حتى تستلم المنتج وتفحصه.",
        icon: "🔒"
      },
      {
        title: "كن بائعاً موثوقاً ✅",
        desc: "وثق حسابك بالهوية الشخصية لزيادة ثقة المشترين والحصول على ميزات حصرية.",
        icon: "🎖️"
      }
    ];
    
    if (brokerageEnabled) {
      baseSteps.push({
        title: "اربح كمسوق 🚀",
        desc: "لا تملك منتجاً؟ يمكنك تسويق منتجات الآخرين والحصول على عمولة فورية عند البيع.",
        icon: "💰"
      });
    }
    
    return baseSteps;
  }, [brokerageEnabled]);

  useEffect(() => {
    const hasSeen = localStorage.getItem('onboarding_seen');
    if (!hasSeen) {
      const timer = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (step >= steps.length && steps.length > 0) {
      setStep(steps.length - 1);
    }
  }, [steps.length, step]);

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    setShow(false);
    localStorage.setItem('onboarding_seen', 'true');
  };

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl border dark:border-slate-800"
          >
            <div className="p-8 text-center space-y-6">
              <div className="text-6xl mb-4 animate-bounce">
                {steps[step].icon}
              </div>
              
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">
                  {steps[step].title}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                  {steps[step].desc}
                </p>
              </div>

              {/* Progress dots */}
              <div className="flex justify-center gap-1.5 py-2">
                {steps.map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === step ? 'w-8 bg-blue-600' : 'w-1.5 bg-gray-200 dark:bg-slate-700'
                    }`}
                  />
                ))}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleClose}
                  className="flex-1 px-6 py-4 rounded-2xl font-black text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  تخطي
                </button>
                <button
                  onClick={handleNext}
                  className="flex-[2] px-6 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all"
                >
                  {step === steps.length - 1 ? 'ابدأ الآن' : 'التالي'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default OnboardingTour;
