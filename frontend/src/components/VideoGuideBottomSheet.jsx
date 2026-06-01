import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const VideoGuideBottomSheet = ({ forceShow = false, onClose = null }) => {
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (forceShow) {
      setIsVisible(true);
      return;
    }

    // التحقق مما إذا كان المستخدم قد أنشأ حساباً جديداً للتو
    const isNewUser = localStorage.getItem('isNewUserRegistration');
    
    if (isNewUser === 'true') {
      // تأخير بسيط لظهور المكون بعد تحميل الصفحة
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [forceShow]);

  const handleClose = () => {
    // إزالة علامة المستخدم الجديد عند الإغلاق لضمان عدم ظهوره مرة أخرى
    localStorage.removeItem('isNewUserRegistration');
    
    setIsVisible(false);
    if (onClose) onClose();
  };

  const goToHowItWorks = () => {
    handleClose();
    navigate('/how-it-works');
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 z-[9999] rounded-t-[2rem] shadow-2xl max-w-md mx-auto overflow-hidden border-t border-gray-100 dark:border-slate-800"
          >
            {/* Handle Bar for mobile feel */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 dark:bg-slate-700 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-5 flex justify-between items-center mb-3">
              <h3 className="text-lg font-black text-gray-900 dark:text-white">
                اجعل سوقك أقرب إليك
              </h3>
              <button
                onClick={handleClose}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="px-5 pb-6 space-y-3">
              <p className="text-gray-500 dark:text-gray-400 font-medium text-xs sm:text-sm leading-relaxed">
                شاهد هذا الفيديو السريع لتتعرف على كيفية استخدام المنصة بأمان وتحقيق أقصى استفادة من ميزات "سوقك" الجديدة.
              </p>

              {/* Video Container - Aspect Ratio for Shorts */}
              <div className="relative aspect-[9/16] max-h-[30vh] w-full bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden shadow-inner mx-auto border border-gray-100 dark:border-slate-700">
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src="https://www.youtube.com/embed/8SMApE2eQ20?autoplay=0&rel=0&modestbranding=1&playsinline=1&enablejsapi=1"
                  title="سوقك - دليل المستخدم"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  playsInline
                ></iframe>
                {/* Fallback info if iframe fails to load */}
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center -z-10">
                  <span className="text-4xl mb-2">📺</span>
                  <p className="text-xs text-gray-400">إذا لم يظهر الفيديو، يرجى التحقق من اتصال الإنترنت</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2.5 pt-3">
                <button
                  onClick={goToHowItWorks}
                  className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl font-black text-base shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  📖 طريقة عمل المنصة
                </button>
                <button
                  onClick={handleClose}
                  className="w-full py-3.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-white rounded-xl font-black text-base hover:bg-gray-200 dark:hover:bg-slate-700 transition-all active:scale-[0.98]"
                >
                  فهمت، شكراً!
                </button>
                <button
                  onClick={handleClose}
                  className="w-full py-2 text-gray-500 dark:text-gray-400 font-bold text-xs hover:text-gray-700 dark:hover:text-white transition-colors"
                >
                  شاهد لاحقاً
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default VideoGuideBottomSheet;
