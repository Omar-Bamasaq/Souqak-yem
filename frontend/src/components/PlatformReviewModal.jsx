import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApi } from "../api/axios";
import { Link } from "react-router-dom";

const PlatformReviewModal = ({ isOpen, onClose }) => {
  const api = useApi();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/platform-reviews", {
        rating,
        comment,
        category,
        isAnonymous,
        platform: "web"
      });
      setSubmitted(true);
      setTimeout(() => {
        onClose();
        setSubmitted(false);
        // إعادة تعيين النموذج
        setRating(5);
        setComment("");
        setCategory("GENERAL");
        setIsAnonymous(false);
      }, 2000);
      window.dispatchEvent(new CustomEvent("app:toast", { 
        detail: { message: "شكراً لك! تم إرسال تقييمك بنجاح", type: "success" } 
      }));
    } catch (err) {
      window.dispatchEvent(new CustomEvent("app:toast", { 
        detail: { message: err.response?.data?.error || "حدث خطأ أثناء إرسال التقييم", type: "error" } 
      }));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-white dark:bg-slate-900 w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-800"
        >
          {submitted ? (
            <div className="p-8 md:p-12 text-center">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 md:w-10 md:h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white mb-2">تم الإرسال!</h3>
              <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 font-bold">رأيك يساعدنا لنكون أفضل دائماً</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Header */}
              <div className="relative p-5 md:p-6 pb-0">
                <button 
                  type="button"
                  onClick={onClose}
                  className="absolute top-5 left-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors z-10"
                >
                  <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="flex flex-col items-center text-center mt-2">
                  <div className="p-2 md:p-3 bg-brand-50 dark:bg-brand-900/20 rounded-2xl mb-3">
                    <svg className="w-6 h-6 md:w-8 md:h-8 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.921-.755 1.688-1.54 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.784.57-1.838-.197-1.539-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </div>
                  <h3 className="text-lg md:text-xl font-black text-gray-900 dark:text-white">رأيك يهمنا</h3>
                  <p className="text-xs md:text-sm font-bold text-gray-500 mt-1">كيف تقيّم تجربتك مع منصة سوقك؟</p>
                  
                  <Link 
                    to="/platform-reviews"
                    onClick={onClose}
                    className="mt-2 text-[9px] md:text-[10px] font-black text-brand-600 hover:underline uppercase tracking-widest"
                  >
                    رؤية تقييمات الآخرين
                  </Link>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 md:p-6 space-y-4 md:space-y-6">
                {/* Stars */}
                <div className="flex justify-center gap-1 md:gap-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setRating(s)}
                      className="transition-transform active:scale-90"
                    >
                      <svg 
                        className={`w-8 h-8 md:w-10 md:h-10 ${s <= rating ? 'text-amber-400 fill-current' : 'text-gray-200 dark:text-gray-700'}`} 
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </button>
                  ))}
                </div>

                {/* Category Selection */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">نوع التقييم</label>
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="ds-select w-full text-sm font-bold"
                  >
                    <option value="GENERAL">عام</option>
                    <option value="UI_UX">واجهة المستخدم</option>
                    <option value="PERFORMANCE">سرعة النظام</option>
                    <option value="FEATURE_REQUEST">اقتراح ميزة</option>
                    <option value="BUG_REPORT">إبلاغ عن خطأ</option>
                    <option value="SUPPORT">الدعم الفني</option>
                  </select>
                </div>

                {/* Comment */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">ملاحظاتك (اختياري)</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="اكتب هنا أي تفاصيل تود مشاركتها معنا..."
                    className="ds-input w-full text-sm font-bold min-h-[80px] md:min-h-[100px] resize-none"
                  />
                </div>

                {/* Anonymity Toggle */}
                <label className="flex items-center justify-between p-3 md:p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl cursor-pointer group transition-colors hover:bg-gray-100 dark:hover:bg-slate-700/50">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="p-2 bg-white dark:bg-slate-700 rounded-lg text-gray-500 shadow-sm">
                      <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs md:text-sm font-black text-gray-700 dark:text-gray-200">تقييم مجهول</p>
                      <p className="text-[9px] md:text-[10px] font-bold text-gray-400">لن يظهر اسمك أو صورتك للآخرين</p>
                    </div>
                  </div>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                    />
                    <div className="w-9 h-5 md:w-11 md:h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 md:after:h-5 md:after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
                  </div>
                </label>
              </div>

              {/* Footer */}
              <div className="p-5 md:p-6 pt-0 flex gap-2 md:gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-3 md:px-6 md:py-4 rounded-2xl font-black text-xs md:text-sm text-gray-500 bg-gray-100 dark:bg-slate-800 dark:text-gray-400 hover:bg-gray-200 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-[2] px-4 py-3 md:px-6 md:py-4 rounded-2xl font-black text-xs md:text-sm text-white bg-brand-600 hover:bg-brand-700 shadow-lg shadow-brand-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>إرسال التقييم</span>
                      <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default PlatformReviewModal;
