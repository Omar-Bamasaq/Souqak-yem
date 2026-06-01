import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApi } from '../api/axios';
import { uploadsUrl } from '../lib/uploads';

const PendingReviewModal = () => {
  const [pendingAds, setPendingAds] = useState([]);
  const [currentAd, setCurrentAd] = useState(null);
  const [criteria, setCriteria] = useState({
    reliability: 5,
    communication: 5,
    deliverySpeed: 5
  });
  const [comment, setComment] = useState("");
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const api = useApi();

  useEffect(() => {
    const fetchPending = async () => {
      try {
        const res = await api.get('/reviews/pending');
        if (res.data?.length > 0) {
          setPendingAds(res.data);
          setCurrentAd(res.data[0]);
        }
      } catch (err) {
        console.error("Error fetching pending reviews:", err);
      }
    };
    fetchPending();
  }, []);

  const handleSubmit = async () => {
    if (comment.trim().length < 10) {
      window.dispatchEvent(new CustomEvent("app:toast", { 
        detail: { message: "التعليق يجب أن يكون 10 أحرف على الأقل", type: "error" } 
      }));
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("reliability", criteria.reliability);
      formData.append("communication", criteria.communication);
      formData.append("deliverySpeed", criteria.deliverySpeed);
      formData.append("comment", comment);
      images.forEach(img => formData.append("images", img));

      // currentAd can be an Order or an Ad based on currentAd.type
      const targetId = currentAd.type === 'ORDER' ? currentAd._id : currentAd._id; // Both use their own _id
      
      await api.post(`/reviews/${targetId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      // Remove current and move to next or close
      const remaining = pendingAds.filter(a => a._id !== currentAd._id);
      setPendingAds(remaining);
      if (remaining.length > 0) {
        setCurrentAd(remaining[0]);
        setCriteria({ reliability: 5, communication: 5, deliverySpeed: 5 });
        setComment("");
        setImages([]);
      } else {
        setCurrentAd(null);
      }
      
      window.dispatchEvent(new CustomEvent("app:toast", { 
        detail: { message: "شكراً لك! تم نشر تقييمك بنجاح", type: "success" } 
      }));
    } catch (err) {
      console.error("Review submission error:", err);
      window.dispatchEvent(new CustomEvent("app:toast", { 
        detail: { message: err.response?.data?.error || "حدث خطأ أثناء إرسال التقييم", type: "error" } 
      }));
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentAd) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 100 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl border dark:border-slate-800 max-h-[95vh] overflow-y-auto custom-scrollbar"
        >
          <div className="p-6 sm:p-8 text-right space-y-6">
            <div className="flex items-center justify-between border-b dark:border-slate-800 pb-4">
              <h3 className="text-xl font-black text-gray-900 dark:text-white">تقييم تجربة الشراء</h3>
              <button onClick={() => setCurrentAd(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-3xl border border-gray-100 dark:border-slate-800 overflow-hidden shadow-inner">
              <div className="p-4 flex flex-col items-center text-center space-y-4">
                <div className="h-32 w-full rounded-2xl bg-white dark:bg-slate-900 overflow-hidden border border-gray-100 dark:border-slate-700 shadow-sm shrink-0">
                  <img 
                    src={uploadsUrl(currentAd.ad?.images?.[0] || currentAd.images?.[0])} 
                    alt="" 
                    className="h-full w-full object-cover" 
                  />
                </div>
                <div className="space-y-3 w-full">
                  <h4 className="text-base font-black text-gray-900 dark:text-white leading-tight px-2">
                    {currentAd.ad?.title || currentAd.title}
                  </h4>
                  <div className="flex flex-wrap justify-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-xl border ${currentAd.type === 'ORDER' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-500/20'}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                      {currentAd.type === 'ORDER' ? 'شراء عبر المنصة' : 'شراء مباشر (شات)'}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-gray-400 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-slate-700">
                      📅 {new Date(currentAd.createdAt || currentAd.soldAt).toLocaleDateString("ar-YE")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Criteria Ratings */}
              <div className="space-y-5">
                {[
                  { id: 'reliability', label: 'المصداقية (مطابقة الوصف)', color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
                  { id: 'communication', label: 'التواصل وسرعة الرد', color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
                  { id: 'deliverySpeed', label: 'سرعة التسليم والتجاوب', color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' }
                ].map((item) => (
                  <div key={item.id} className="space-y-2">
                    <label className="block text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest px-1">{item.label}</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          onClick={() => setCriteria(prev => ({ ...prev, [item.id]: s }))}
                          className={`flex-1 h-11 rounded-xl flex items-center justify-center transition-all ${
                            criteria[item.id] >= s ? `${item.bg} ${item.color} shadow-sm scale-105 border-2 border-current/20` : 'bg-gray-50 dark:bg-slate-800 text-gray-300 dark:text-slate-600'
                          }`}
                        >
                          <svg className={`w-5 h-5 ${criteria[item.id] >= s ? 'fill-current' : 'fill-none'}`} viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest px-1">رأيك بالتفصيل (إجباري)</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full h-28 rounded-2xl border-2 border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 px-5 py-4 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all resize-none"
                  placeholder="حدثنا عن تجربتك مع البائع والمنتج..."
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest px-1">أضف صوراً (اختياري)</label>
                <div className="flex gap-2">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative h-16 w-16 rounded-xl overflow-hidden border-2 border-gray-100 dark:border-slate-800 group">
                      <img src={URL.createObjectURL(img)} alt="" className="h-full w-full object-cover" />
                      <button onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))} className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                  {images.length < 3 && (
                    <label className="h-16 w-16 rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-700 flex items-center justify-center text-gray-400 hover:border-blue-500 cursor-pointer transition-all bg-gray-50 dark:bg-slate-800">
                      <input type="file" className="hidden" accept="image/*" multiple onChange={e => setImages(prev => [...prev, ...Array.from(e.target.files)].slice(0,3))} />
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 pb-4">
              <button
                onClick={handleSubmit}
                disabled={submitting || comment.trim().length < 10}
                className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-600/20 disabled:opacity-50 hover:bg-blue-700 transition-all active:scale-95"
              >
                {submitting ? "جاري الحفظ..." : "نشر التقييم"}
              </button>
              <button
                onClick={() => setCurrentAd(null)}
                className="flex-1 py-4 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 rounded-2xl font-black text-sm hover:bg-gray-200 dark:hover:bg-slate-700 transition-all"
              >
                لاحقاً
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default PendingReviewModal;
