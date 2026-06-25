import React, { useState } from "react";
import { useApi } from "../api/axios.js";
import { useAuth } from "../store/AuthContext.jsx";
import { useTheme } from "../store/ThemeContext.jsx";
import { useNavigate, Link } from "react-router-dom";
import { uploadsUrl } from "../lib/uploads.js";
import { subscribeToPush } from "../utils/pushNotifications.js";

export default function AccountSettings() {
  const api = useApi();
  const { logout, user, setUser } = useAuth();
  const isPhoneUser = user?.email?.endsWith("@phone.local");
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showAdhkar, setShowAdhkar] = useState(() => {
    const saved = localStorage.getItem("showAdhkar");
    return saved === null ? true : saved === "true";
  });
  
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Edit Profile States
  const [editName, setEditName] = useState(user?.name || "");
  const [editPhone, setEditPhone] = useState(user?.phone || "");
  const [editAvatar, setEditAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar ? uploadsUrl(user.avatar, "thumb") : null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setEditError("حجم الصورة كبير جداً (الحد الأقصى 2 ميجابايت)");
        return;
      }
      setEditAvatar(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  // Change Password States
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");

  // Notification States
  const [notifPrefs, setNotifPrefs] = useState(user?.notificationPrefs || {
    message: { inApp: true, push: true, email: true },
    comment: { inApp: true, push: true, email: true },
    ad_status: { inApp: true, push: true, email: true },
    order: { inApp: true, push: true, email: true },
    wallet: { inApp: true, push: true, email: true },
    broker_request: { inApp: true, push: true, email: true },
    broker_approved: { inApp: true, push: true, email: true },
    broker_rejected: { inApp: true, push: true, email: true },
    deal_pending: { inApp: true, push: true, email: true },
    deal_confirmed: { inApp: true, push: true, email: true },
    complaint_received: { inApp: true, push: true, email: true },
    complaint_resolved: { inApp: true, push: true, email: true }
  });
  const [notifLoading, setNotifLoading] = useState(false);

  const NotificationToggle = ({ label, checked, onChange, loading }) => (
     <div 
       onClick={!loading ? onChange : undefined}
       className="flex flex-row items-center justify-between w-full p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-800 shadow-sm cursor-pointer active:scale-[0.98] transition-all"
     >
       <span className="text-sm font-black text-gray-700 dark:text-slate-300 text-right">{label}</span>
       <div 
         className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-all duration-300 ${checked ? 'bg-blue-600' : 'bg-blue-100 dark:bg-slate-800'}`}
         style={{ direction: 'ltr' }}
       >
         <span
           className={`inline-block h-5 w-5 transform rounded-full shadow-lg transition duration-300 ease-in-out ${checked ? 'translate-x-6 bg-white' : 'translate-x-1 bg-blue-600'}`}
         />
       </div>
     </div>
   );

  const quickLinks = [
    { title: "إعلاناتي", icon: "📦", path: "/my-ads", color: "bg-blue-50 text-blue-600 border-blue-100" },
    { title: "المحفظة", icon: "💳", path: "/wallet", color: "bg-green-50 text-green-600 border-green-100" },
    { title: "الرسائل", icon: "💬", path: "/messages", color: "bg-purple-50 text-purple-600 border-purple-100" },
    { title: "المفضلة", icon: "❤️", path: "/favorites", color: "bg-red-50 text-red-600 border-red-100" },
  ];

  const handleUpdateNotifications = async (newPrefs) => {
    setNotifLoading(true);
    try {
      await api.put("/notifications/prefs", newPrefs);
      const updatedUser = { ...user, notificationPrefs: newPrefs };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setNotifPrefs(newPrefs);
    } catch (err) {
      alert("حدث خطأ أثناء تحديث الإشعارات.");
    } finally {
      setNotifLoading(false);
    }
  };

  const toggleNotif = async (category, type) => {
    const isEnablingPush = type === 'push' && !notifPrefs[category][type];
    
    const newPrefs = {
      ...notifPrefs,
      [category]: {
        ...notifPrefs[category],
        [type]: !notifPrefs[category][type]
      }
    };
    
    setNotifPrefs(newPrefs);
    handleUpdateNotifications(newPrefs);

    if (isEnablingPush) {
      try {
        await subscribeToPush(api);
      } catch (err) {
        console.error("Push subscription error:", err);
      }
    }
  };

  const toggleAdhkar = () => {
    const newVal = !showAdhkar;
    setShowAdhkar(newVal);
    localStorage.setItem("showAdhkar", String(newVal));
    window.dispatchEvent(new CustomEvent("adhkar:toggle"));
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError("");
    try {
      // 1. Update text fields
      const res = await api.patch("/auth/update-profile", { name: editName, phone: editPhone });
      let updatedUser = res.data.user;

      // 2. Update avatar if changed
      if (editAvatar) {
        const formData = new FormData();
        formData.append("avatar", editAvatar);
        const avatarRes = await api.post("/auth/avatar", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        updatedUser = { ...updatedUser, avatar: avatarRes.data.avatar };
      }

      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setShowEditProfileModal(false);
      alert("تم تحديث الملف الشخصي بنجاح");
    } catch (err) {
      setEditError(err.response?.data?.error || "حدث خطأ أثناء تحديث الملف الشخصي.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwError("");

    // Validate password language
    const arabicRegex = /[\u0600-\u06FF]/;
    if (arabicRegex.test(newPassword)) {
      setPwError("يجب أن تحتوي كلمة المرور على أحرف إنجليزية وأرقام فقط");
      return;
    }

    if (newPassword.length < 8) {
      setPwError("يجب أن تكون كلمة المرور 8 أحرف على الأقل");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwError("كلمات المرور الجديدة غير متطابقة.");
      return;
    }
    setPwLoading(true);
    try {
      const res = await api.post("/auth/change-password", { currentPassword, newPassword });
      setShowChangePasswordModal(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      alert(res.data.message);
    } catch (err) {
      setPwError(err.response?.data?.error || "حدث خطأ أثناء تغيير كلمة المرور.");
    } finally {
      setPwLoading(false);
    }
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.delete("/auth/account", { data: { password } });
      alert(res.data.message);
      logout();
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "حدث خطأ أثناء محاولة حذف الحساب.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20 sm:pb-10 px-4 sm:px-0">
      {/* Mobile Top Header */}
      <div className="sm:hidden flex items-center justify-between pt-4 mb-2">
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-900 rounded-full shadow-sm border border-gray-100 dark:border-slate-800">
          <svg className="w-5 h-5 text-gray-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg>
        </button>
        <h1 className="text-lg font-black text-slate-900 dark:text-white">إعدادات الحساب</h1>
        <div className="w-10"></div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 sm:p-10 border-2 border-gray-50 dark:border-slate-800 shadow-sm overflow-hidden relative">
        {/* Background Accent for Mobile */}
        <div className="sm:hidden absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-blue-50/50 dark:from-blue-900/10 to-transparent pointer-events-none"></div>

        <div className="relative z-10">
          {/* User Profile Header */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 mb-10 text-center sm:text-right">
            <div className="w-24 h-24 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-3xl text-white font-black shadow-xl shadow-blue-500/20 border-4 border-white dark:border-slate-800 overflow-hidden">
              {user?.avatar ? (
                <img 
                  src={uploadsUrl(user.avatar, "thumb")} 
                  alt="" 
                  className="w-full h-full object-cover" 
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = uploadsUrl(user.avatar, "full");
                  }}
                />
              ) : (
                user?.name?.charAt(0).toUpperCase() || "U"
              )}
            </div>
            <div className="flex-1 py-1">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                  {user?.name || "مستخدم سوقك"}
                </h2>
                {user?.role === 'admin' ? (
                  <span className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-[10px]" title="مسؤول النظام">🛡️</span>
                ) : user?.verificationStatus === 'verified' ? (
                  <span className="w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[10px]" title="حساب موثق">✔️</span>
                ) : user?.verificationStatus === 'expired' ? (
                  <span className="w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center text-[10px]" title="التوثيق منتهي">⚠️</span>
                ) : null}
              </div>
              <p className="text-sm text-gray-500 dark:text-slate-400 font-bold mb-3">{user?.email}</p>
              
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="px-3 py-1 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 text-[10px] font-black rounded-full border border-gray-200 dark:border-slate-700 uppercase">
                  {user?.role === 'admin' ? 'مسؤول النظام' : user?.verificationStatus === 'verified' ? 'حساب موثق' : 'عضو نشط'}
                </span>
                {user?.verificationStatus === 'expired' && (
                  <Link to="/seller/subscriptions" className="px-3 py-1 bg-amber-50 text-amber-600 text-[10px] font-black rounded-full border border-amber-100 uppercase">
                    تجديد التوثيق
                  </Link>
                )}
                <button 
                  onClick={() => setShowEditProfileModal(true)}
                  className="text-xs text-blue-600 dark:text-blue-400 font-black hover:underline px-2"
                >
                  تعديل الملف الشخصي
                </button>
              </div>
            </div>
          </div>

          {/* Quick Links Grid (Mobile Only) */}
          <div className="grid grid-cols-2 gap-3 mb-10 sm:hidden">
            {quickLinks.map((link) => (
              <Link 
                key={link.title} 
                to={link.path}
                className={`flex flex-col items-center justify-center p-4 rounded-3xl border-2 transition-all active:scale-95 ${link.color}`}
              >
                <span className="text-2xl mb-2">{link.icon}</span>
                <span className="text-sm font-black">{link.title}</span>
              </Link>
            ))}
          </div>

          <h1 className="hidden sm:block text-2xl font-black text-slate-900 dark:text-white mb-6">الإعدادات والأمان</h1>
          
          <div className="space-y-6">
            {/* Quick Settings List */}
            <div className="grid gap-2">
              <button 
                onClick={() => setShowChangePasswordModal(true)}
                className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-xl shadow-sm border border-gray-100 dark:border-slate-700">🔒</div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900 dark:text-white">تغيير كلمة المرور</p>
                    <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold">قم بتحديث كلمة المرور لحماية حسابك</p>
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg>
              </button>

              <button 
                onClick={() => setShowNotificationModal(true)}
                className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-xl shadow-sm border border-gray-100 dark:border-slate-700">🔔</div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900 dark:text-white">تفضيلات الإشعارات</p>
                    <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold">تحكم في التنبيهات التي تصلك</p>
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg>
              </button>

              <button 
                onClick={toggleAdhkar}
                className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-xl shadow-sm border border-gray-100 dark:border-slate-700">📿</div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900 dark:text-white">إظهار الأذكار</p>
                    <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold">عرض أذكار قصيرة بشكل دوري أثناء التصفح</p>
                  </div>
                </div>
                <div className={`w-10 h-5 rounded-full transition-all duration-300 relative flex items-center px-1 ${showAdhkar ? 'bg-blue-600' : 'bg-gray-300'}`} style={{ direction: 'ltr' }}>
                  <div className={`w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-all duration-300 transform ${showAdhkar ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </button>

              <button 
                onClick={toggleTheme}
                className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-xl shadow-sm border border-gray-100 dark:border-slate-700">{isDark ? '☀️' : '🌙'}</div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900 dark:text-white">{isDark ? 'الوضع الفاتح' : 'الوضع الداكن'}</p>
                    <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold">تبديل مظهر التطبيق</p>
                  </div>
                </div>
                <div className={`w-10 h-5 rounded-full transition-all duration-300 relative flex items-center px-1 ${isDark ? 'bg-blue-600' : 'bg-gray-300'}`} style={{ direction: 'ltr' }}>
                  <div className={`w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-all duration-300 transform ${isDark ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </button>
            </div>

            {/* Section: Support & Guarantee */}
            <div className="pt-6 border-t border-gray-100 dark:border-slate-800">
              <h2 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-4 px-1">الدعم والضمان</h2>
              <div className="grid gap-2">
                <Link to="/refund-escrow" className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-xl shadow-sm border border-gray-100 dark:border-slate-700">🛡️</div>
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-900 dark:text-white">نظام الضمان</p>
                      <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold">تعرف على كيفية حماية حقوقك</p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg>
                </Link>

                <button 
                  onClick={() => window.dispatchEvent(new CustomEvent('app:open-support'))}
                  className="flex items-center justify-between w-full p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/50 hover:bg-green-50 dark:hover:bg-green-900/10 transition-all group text-right"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-xl shadow-sm border border-gray-100 dark:border-slate-700">💬</div>
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-900 dark:text-white">مراسلة الدعم</p>
                      <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold">نحن هنا لمساعدتك دائماً</p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-300 group-hover:text-green-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg>
                </button>
              </div>
            </div>

            {/* Section: About Suqaq */}
            <div className="pt-6 border-t border-gray-100 dark:border-slate-800">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 px-1">عن سوقك</h2>
              <div className="grid gap-2">
                <Link to="/how-it-works" className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-xl shadow-sm border border-gray-100 dark:border-slate-700">❓</div>
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-900 dark:text-white">طريقة العمل</p>
                      <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold">كيف تبدأ البيع والشراء</p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg>
                </Link>

                <Link to="/privacy" className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-xl shadow-sm border border-gray-100 dark:border-slate-700">📜</div>
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-900 dark:text-white">السياسة والخصوصية</p>
                      <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold">خصوصية بياناتك تهمنا</p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg>
                </Link>

                <Link to="/terms" className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-xl shadow-sm border border-gray-100 dark:border-slate-700">⚖️</div>
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-900 dark:text-white">الشروط والأحكام</p>
                      <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold">اتفاقية الاستخدام القانونية</p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg>
                </Link>
              </div>
            </div>

            {/* Section: Social Media */}
            <div className="pt-6 border-t border-gray-100 dark:border-slate-800">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 px-1">تابعنا على منصات التواصل</h2>
              <div className="grid grid-cols-2 gap-3">
                <a 
                  href="https://www.facebook.com/share/1GGvSFnu8Q/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center p-4 rounded-3xl bg-blue-50 dark:bg-blue-900/10 border-2 border-blue-100 dark:border-blue-900/30 transition-all active:scale-95 group"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center mb-2 shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </div>
                  <span className="text-xs font-black text-blue-700 dark:text-blue-400">فيسبوك</span>
                </a>

                <a 
                  href="https://www.instagram.com/souqak.ye?igsh=dWlpa215M2x1MWxz" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center p-4 rounded-3xl bg-rose-50 dark:bg-rose-900/10 border-2 border-rose-100 dark:border-rose-900/30 transition-all active:scale-95 group"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 text-white flex items-center justify-center mb-2 shadow-lg shadow-rose-500/20 group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  </div>
                  <span className="text-xs font-black text-rose-700 dark:text-rose-400">انستقرام</span>
                </a>
              </div>
            </div>

            {/* Logout Section */}
            <div className="pt-6 border-t border-gray-100 dark:border-slate-800">
              <button 
                onClick={logout}
                className="flex items-center justify-between w-full p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/50 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-xl shadow-sm border border-gray-100 dark:border-slate-700">🚪</div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900 dark:text-white">تسجيل الخروج</p>
                    <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold">الخروج من حسابك الحالي</p>
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-300 group-hover:text-red-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg>
              </button>
            </div>

            {/* Danger Zone - Simplified as a list item */}
            <div className="pt-6 border-t border-gray-100 dark:border-slate-800">
              <button 
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center justify-between w-full p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/50 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-xl shadow-sm border border-gray-100 dark:border-slate-700">⚠️</div>
                  <div className="text-right">
                    <p className="text-sm font-black text-red-600">حذف الحساب نهائياً</p>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold">سيتم مسح كافة بياناتك وإعلاناتك</p>
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-300 group-hover:text-red-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl border-2 border-blue-100 dark:border-blue-900/30 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6 text-center">تعديل الملف الشخصي</h3>
            
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              {/* Avatar Upload Section */}
              <div className="flex flex-col items-center gap-4 mb-6">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-slate-800 border-4 border-white dark:border-slate-800 shadow-xl overflow-hidden flex items-center justify-center">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar Preview" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl font-black text-gray-400">{editName?.charAt(0).toUpperCase() || "U"}</span>
                    )}
                    <label className="absolute inset-0 bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-[10px] font-black uppercase">تغيير</span>
                      <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
                    </label>
                  </div>
                </div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">الصورة الشخصية (اختياري)</p>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">الاسم الكامل</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-800 border-2 border-gray-100 dark:border-slate-700 rounded-2xl px-5 py-4 outline-none focus:border-blue-500 transition-all text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">رقم الهاتف</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-800 border-2 border-gray-100 dark:border-slate-700 rounded-2xl px-5 py-4 outline-none focus:border-blue-500 transition-all text-sm font-bold"
                  placeholder="7XXXXXXXX"
                />
              </div>

              {editError && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl border border-red-100 dark:border-red-900/30">
                  {editError}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 bg-blue-600 text-white font-black py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none disabled:opacity-50 active:scale-95"
                >
                  {editLoading ? "جارٍ الحفظ..." : "حفظ التغييرات"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  className="flex-1 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 font-black py-4 rounded-2xl hover:bg-gray-200 dark:hover:bg-slate-700 transition-all active:scale-95"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl border-2 border-blue-100 dark:border-blue-900/30 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6 text-center">تغيير كلمة المرور</h3>
            
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">كلمة المرور الحالية</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-slate-800 border-2 border-gray-100 dark:border-slate-700 rounded-2xl px-5 py-4 outline-none focus:border-blue-500 transition-all text-sm font-bold pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-blue-500 transition-colors"
                  >
                    {showCurrentPassword ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">كلمة المرور الجديدة</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-slate-800 border-2 border-gray-100 dark:border-slate-700 rounded-2xl px-5 py-4 outline-none focus:border-blue-500 transition-all text-sm font-bold pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-blue-500 transition-colors"
                  >
                    {showNewPassword ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">تأكيد كلمة المرور الجديدة</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-slate-800 border-2 border-gray-100 dark:border-slate-700 rounded-2xl px-5 py-4 outline-none focus:border-blue-500 transition-all text-sm font-bold pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-blue-500 transition-colors"
                  >
                    {showConfirmPassword ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {pwError && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl border border-red-100 dark:border-red-900/30">
                  {pwError}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="submit"
                  disabled={pwLoading}
                  className="flex-1 bg-blue-600 text-white font-black py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none disabled:opacity-50 active:scale-95"
                >
                  {pwLoading ? "جارٍ الحفظ..." : "تحديث كلمة المرور"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowChangePasswordModal(false);
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                  className="flex-1 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 font-black py-4 rounded-2xl hover:bg-gray-200 dark:hover:bg-slate-700 transition-all active:scale-95"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notification Preferences Modal */}
      {showNotificationModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-4" onClick={() => setShowNotificationModal(false)}>
          <div 
            className="bg-white dark:bg-slate-900 w-full max-w-lg max-h-[85vh] sm:max-h-[90vh] rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden border border-gray-100 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="relative flex items-center justify-center py-4 border-b border-gray-100 dark:border-slate-800 flex-shrink-0 bg-white dark:bg-slate-900 z-10">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">تفضيلات الإشعارات</h3>
              <button 
                onClick={() => setShowNotificationModal(false)} 
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Modal Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-8 custom-scrollbar">
              {/* Category: Messages */}
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center gap-3 px-1">
                  <span className="text-xl">💬</span>
                  <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest">الرسائل والمحادثات</h4>
                </div>
                <div className="grid gap-2">
                  <NotificationToggle 
                    label="تنبيهات داخل التطبيق" 
                    checked={notifPrefs.message?.inApp} 
                    onChange={() => toggleNotif('message', 'inApp')} 
                    loading={notifLoading}
                  />
                  <NotificationToggle 
                    label="إشعارات الهاتف (Push)" 
                    checked={notifPrefs.message?.push} 
                    onChange={() => toggleNotif('message', 'push')} 
                    loading={notifLoading}
                  />
                  <NotificationToggle 
                    label="تنبيهات البريد الإلكتروني" 
                    checked={notifPrefs.message?.email} 
                    onChange={() => toggleNotif('message', 'email')} 
                    loading={notifLoading}
                  />
                </div>
              </div>

              {/* Category: Comments */}
              <div className="space-y-3 sm:space-y-4 pt-6 border-t border-gray-50 dark:border-slate-800/50">
                <div className="flex items-center gap-3 px-1">
                  <span className="text-xl">📝</span>
                  <h4 className="text-xs font-black text-green-600 uppercase tracking-widest">التعليقات والردود</h4>
                </div>
                <div className="grid gap-2">
                  <NotificationToggle 
                    label="تنبيهات داخل التطبيق" 
                    checked={notifPrefs.comment?.inApp} 
                    onChange={() => toggleNotif('comment', 'inApp')} 
                    loading={notifLoading}
                  />
                  <NotificationToggle 
                    label="إشعارات الهاتف (Push)" 
                    checked={notifPrefs.comment?.push} 
                    onChange={() => toggleNotif('comment', 'push')} 
                    loading={notifLoading}
                  />
                </div>
              </div>

              {/* Category: Ads */}
              <div className="space-y-3 sm:space-y-4 pt-6 border-t border-gray-100 dark:border-slate-800/50">
                <div className="flex items-center gap-3 px-1">
                  <span className="text-xl">📢</span>
                  <h4 className="text-xs font-black text-purple-600 uppercase tracking-widest">حالة الإعلانات</h4>
                </div>
                <div className="grid gap-2">
                  <NotificationToggle 
                    label="تنبيهات القبول والرفض" 
                    checked={notifPrefs.ad_status?.inApp} 
                    onChange={() => toggleNotif('ad_status', 'inApp')} 
                    loading={notifLoading}
                  />
                  <NotificationToggle 
                    label="إشعارات الهاتف (Push)" 
                    checked={notifPrefs.ad_status?.push} 
                    onChange={() => toggleNotif('ad_status', 'push')} 
                    loading={notifLoading}
                  />
                </div>
              </div>

              {/* Category: Brokerage Requests */}
              <div className="space-y-3 sm:space-y-4 pt-6 border-t border-gray-50 dark:border-slate-800/50">
                <div className="flex items-center gap-3 px-1">
                  <span className="text-xl">🤝</span>
                  <h4 className="text-xs font-black text-orange-600 uppercase tracking-widest">طلبات الوساطة</h4>
                </div>
                <div className="grid gap-2">
                  <NotificationToggle 
                    label="طلبات الانضمام الجديدة" 
                    checked={notifPrefs.broker_request?.inApp} 
                    onChange={() => toggleNotif('broker_request', 'inApp')} 
                    loading={notifLoading}
                  />
                  <NotificationToggle 
                    label="إشعارات الهاتف (Push)" 
                    checked={notifPrefs.broker_request?.push} 
                    onChange={() => toggleNotif('broker_request', 'push')} 
                    loading={notifLoading}
                  />
                </div>
              </div>

              {/* Category: Brokerage Membership Status */}
              <div className="space-y-3 sm:space-y-4 pt-6 border-t border-gray-50 dark:border-slate-800/50">
                <div className="flex items-center gap-3 px-1">
                  <span className="text-xl">✅</span>
                  <h4 className="text-xs font-black text-teal-600 uppercase tracking-widest">حالة عضوية الوساطة</h4>
                </div>
                <div className="grid gap-2">
                  <NotificationToggle 
                    label="قبول/رفض الطلب" 
                    checked={notifPrefs.broker_approved?.inApp} 
                    onChange={() => toggleNotif('broker_approved', 'inApp')} 
                    loading={notifLoading}
                  />
                  <NotificationToggle 
                    label="إشعارات الهاتف (Push)" 
                    checked={notifPrefs.broker_approved?.push} 
                    onChange={() => toggleNotif('broker_approved', 'push')} 
                    loading={notifLoading}
                  />
                </div>
              </div>

              {/* Category: Deals */}
              <div className="space-y-3 sm:space-y-4 pt-6 border-t border-gray-50 dark:border-slate-800/50">
                <div className="flex items-center gap-3 px-1">
                  <span className="text-xl">💼</span>
                  <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest">الصفقات</h4>
                </div>
                <div className="grid gap-2">
                  <NotificationToggle 
                    label="صفقة جديدة بحاجة للتأكيد" 
                    checked={notifPrefs.deal_pending?.inApp} 
                    onChange={() => toggleNotif('deal_pending', 'inApp')} 
                    loading={notifLoading}
                  />
                  <NotificationToggle 
                    label="تم تأكيد الصفقة" 
                    checked={notifPrefs.deal_confirmed?.inApp} 
                    onChange={() => toggleNotif('deal_confirmed', 'inApp')} 
                    loading={notifLoading}
                  />
                  <NotificationToggle 
                    label="إشعارات الهاتف (Push)" 
                    checked={notifPrefs.deal_pending?.push} 
                    onChange={() => toggleNotif('deal_pending', 'push')} 
                    loading={notifLoading}
                  />
                </div>
              </div>

              {/* Category: Complaints */}
              <div className="space-y-3 sm:space-y-4 pt-6 border-t border-gray-50 dark:border-slate-800/50">
                <div className="flex items-center gap-3 px-1">
                  <span className="text-xl">⚠️</span>
                  <h4 className="text-xs font-black text-red-600 uppercase tracking-widest">الشكاوى</h4>
                </div>
                <div className="grid gap-2">
                  <NotificationToggle 
                    label="تم حل الشكوى" 
                    checked={notifPrefs.complaint_resolved?.inApp} 
                    onChange={() => toggleNotif('complaint_resolved', 'inApp')} 
                    loading={notifLoading}
                  />
                  <NotificationToggle 
                    label="إشعارات الهاتف (Push)" 
                    checked={notifPrefs.complaint_resolved?.push} 
                    onChange={() => toggleNotif('complaint_resolved', 'push')} 
                    loading={notifLoading}
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50 flex-shrink-0">
              <button
                onClick={() => setShowNotificationModal(false)}
                className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black py-4 rounded-2xl hover:opacity-90 transition-all active:scale-[0.98] shadow-lg shadow-gray-200 dark:shadow-none"
              >
                حفظ وإغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl border-2 border-red-100 dark:border-red-900/30 animate-in zoom-in-95 duration-200">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                ⚠️
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">هل أنت متأكد تماماً؟</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-2 leading-relaxed">
                سيؤدي هذا الإجراء إلى حذف كافة إعلاناتك، وفقدان الوصول إلى محفظتك المالية، ولا يمكن التراجع عن هذا الإجراء.
              </p>
            </div>

            <form onSubmit={handleDeleteAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">
                  {isPhoneUser ? 'أكتب كلمة "حذف" للتأكيد' : 'أدخل كلمة المرور للتأكيد'}
                </label>
                <div className="relative">
                  <input
                    type={isPhoneUser ? "text" : (showDeletePassword ? "text" : "password")}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isPhoneUser ? 'كلمة "حذف"' : "كلمة المرور الخاصة بك"}
                    className="w-full bg-gray-50 dark:bg-slate-800 border-2 border-gray-100 dark:border-slate-700 rounded-2xl px-5 py-4 outline-none focus:border-red-500 transition-all text-sm font-bold pr-12 text-center"
                  />
                  {!isPhoneUser && (
                    <button
                      type="button"
                      onClick={() => setShowDeletePassword(!showDeletePassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      {showDeletePassword ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl border border-red-100 dark:border-red-900/30">
                  {error}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-red-600 text-white font-black py-4 rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-200 dark:shadow-none disabled:opacity-50 active:scale-95"
                >
                  {loading ? "جارٍ الحذف..." : "نعم، احذف حسابي"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setError("");
                    setPassword("");
                  }}
                  className="flex-1 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 font-black py-4 rounded-2xl hover:bg-gray-200 dark:hover:bg-slate-700 transition-all active:scale-95"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
