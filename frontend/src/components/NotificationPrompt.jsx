import React, { useEffect, useState } from "react";
import { useAuth } from "../store/AuthContext.jsx";
import { useApi } from "../api/axios.js";
import { motion, AnimatePresence } from "framer-motion";
import { subscribeToPush } from "../utils/pushNotifications.js";

export default function NotificationPrompt() {
  const { user, setUser } = useAuth();
  const api = useApi();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Show if user is logged in
    // Condition: DB says they haven't seen it
    if (user && user.hasSeenNotificationPrompt === false) {
      // Delay slightly for better UX
      const timer = setTimeout(() => setShow(true), 2000);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [user]);

  const markAsSeen = async () => {
    try {
      await api.patch("/notifications/prompt-seen");
      if (setUser) {
        setUser({ ...user, hasSeenNotificationPrompt: true });
      }
    } catch (err) {
      console.error("Error marking prompt as seen:", err);
    }
  };

  const updatePrefs = async (enabled) => {
    setLoading(true);
    try {
      // First mark as seen in DB so it never shows again
      await markAsSeen();

      const allEnabled = { inApp: true, push: true, email: true };
      const allDisabled = { inApp: false, push: false, email: false };
      const prefsValue = enabled ? allEnabled : allDisabled;

      const newPrefs = {
        message: prefsValue,
        comment: prefsValue,
        ad_status: prefsValue,
        order: prefsValue,
        wallet: prefsValue,
        commission_reminder: prefsValue
      };

      const res = await api.put("/notifications/prefs", newPrefs);
      
      // Update local user state with new prefs AND seen flag
      if (setUser) {
        setUser({ 
          ...user, 
          notificationPrefs: res.data,
          hasSeenNotificationPrompt: true 
        });
      }

      if (enabled) {
        try {
          await subscribeToPush(api);
        } catch (err) {
          console.error("Browser notification subscription error:", err);
        }
      }

      localStorage.setItem("notifyEnabled", enabled ? "true" : "false");
      
      window.dispatchEvent(new CustomEvent("admin:toast", { 
        detail: { 
          message: enabled ? "تم تفعيل كافة الإشعارات بنجاح" : "تم إيقاف الإشعارات. يمكنك تفعيلها لاحقاً من الإعدادات.", 
          type: enabled ? "success" : "info" 
        } 
      }));
      
      setShow(false);
    } catch (err) {
      console.error("Failed to update notification prefs:", err);
      window.dispatchEvent(new CustomEvent("admin:toast", { 
        detail: { message: "حدث خطأ أثناء حفظ الإعدادات", type: "error" } 
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async () => {
    setLoading(true);
    await markAsSeen();
    setShow(false);
    setLoading(false);
    window.dispatchEvent(new CustomEvent("admin:toast", { 
      detail: { 
        message: "يمكنك دائماً تفعيل الإشعارات من صفحة الإعدادات.", 
        type: "info" 
      } 
    }));
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl border border-gray-100 dark:border-slate-800 text-center relative overflow-hidden"
        >
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
          
          <div className="relative z-10">
            <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-4xl shadow-sm border border-blue-100 dark:border-blue-900/30 animate-bounce">
              🔔
            </div>
            
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3 tracking-tight">ابقَ على اطلاع!</h3>
            <p className="text-sm font-bold text-gray-500 dark:text-slate-400 leading-relaxed mb-8">
              هل ترغب في تلقي إشعارات فورية بخصوص رسائلك، مبيعاتك، وحالة إعلاناتك؟ سنقوم بتفعيل كافة قنوات التنبيه لك.
            </p>

            <div className="space-y-3">
              <button
                disabled={loading}
                onClick={() => updatePrefs(true)}
                className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>نعم، فعل الإشعارات</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </>
                )}
              </button>
              
              <button
                disabled={loading}
                onClick={handleDismiss}
                className="w-full py-4 bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400 font-black rounded-2xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-50"
              >
                ليس الآن
              </button>
            </div>

            <p className="mt-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              يمكنك دائماً تغيير هذه الإعدادات من صفحة الحساب
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
