import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../store/AuthContext.jsx";
import { t } from "../i18n/index.js";
import { useApi } from "../api/axios.js";
import Logo from "../components/Logo.jsx";

const features = [
  { key: "secureTrade", icon: "shield" },
  { key: "safePurchase", icon: "cart" },
  { key: "contactSellers", icon: "chat" },
  { key: "unlimitedAds", icon: "ads" },
  { key: "manualReview", icon: "review" },
  { key: "featuredAds", icon: "star" },
  { key: "verifiedSellers", icon: "badge" },
  { key: "instantNotifications", icon: "bell" },
  { key: "searchByLocation", icon: "location" },
  { key: "favoritesAndFollow", icon: "heart" },
  { key: "simpleInterface", icon: "device" },
  { key: "affiliateMarketing", icon: "cash" }
];

const iconSvg = (name) => {
  const icons = {
    shield: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />,
    cart: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />,
    chat: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />,
    ads: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />,
    review: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />,
    star: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />,
    badge: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />,
    bell: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />,
    location: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />,
    heart: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />,
    device: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />,
    cash: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  };
  return icons[name] || icons.shield;
};

export default function Login() {
  const api = useApi();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [activeBox, setActiveBox] = useState("email"); // Default to email for admin
  const [isEmailDisabled] = useState(false); // Enable email login
  const [showFeatures, setShowFeatures] = useState(false);
  const [loginName, setLoginName] = useState("");
  const [loginPhone, setLoginPhone] = useState("");
  const [loginNameErr, setLoginNameErr] = useState("");
  const [loginPhoneErr, setLoginPhoneErr] = useState("");

  const validateLoginPhone = () => {
    let ok = true;
    setLoginNameErr("");
    setLoginPhoneErr("");
    if (!loginName.trim()) { setLoginNameErr("الاسم مطلوب"); ok = false; }
    if (!loginPhone.trim()) { setLoginPhoneErr("رقم الهاتف مطلوب"); ok = false; }
    return ok;
  };

  const getDeviceType = () => {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return "android";
    if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
    if (/Windows/i.test(ua)) return "windows";
    if (/Macintosh/i.test(ua)) return "macos";
    return null;
  };

  const phoneLogin = async (e) => {
    e.preventDefault();
    if (!validateLoginPhone()) return;
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/phone-login", { name: loginName.trim(), phone: loginPhone.trim(), deviceType: getDeviceType() });
      login(res.data.token, res.data.user);
      const from = location.state?.from?.pathname || (res.data.user?.role === "admin" ? "/admin" : "/");
      navigate(from, { replace: true });
    } catch (e2) {
      setError(e2?.response?.data?.error || "حدث خطأ أثناء تسجيل الدخول.");
    } finally {
      setLoading(false);
    }
  };

  const emailLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) { 
      setError("يرجى إدخال البريد الإلكتروني وكلمة المرور."); 
      return; 
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("صيغة البريد الإلكتروني غير صحيحة.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      console.log(`[Login] Attempting email login for: ${email.trim()}`);
      const res = await api.post("/auth/login", { 
        email: email.trim(), 
        password, 
        deviceType: getDeviceType() 
      });
      
      console.log("[Login] Login successful:", res.data.user?.email);
      login(res.data.token, res.data.user);
      
      const from = location.state?.from?.pathname || (res.data.user?.role === "admin" ? "/admin" : "/");
      navigate(from, { replace: true });
    } catch (err) {
      console.error("[Login] Email login error:", err);
      
      let finalError = "";
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        finalError = "استغرق الاتصال وقتاً طويلاً، يرجى التحقق من جودة الإنترنت والمحاولة مرة أخرى.";
      } else {
        finalError = err.response?.data?.error || "البيانات غير صحيحة أو حدث خطأ في الخادم.";
      }
      setError(finalError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center p-2 sm:p-4 lg:p-6 relative overflow-hidden text-right" dir="rtl">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(59,130,246,0.08)_0%,_transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(99,102,241,0.06)_0%,_transparent_50%)] pointer-events-none" />

      <div className="w-full max-w-5xl flex flex-col lg:flex-row gap-4 lg:gap-8 items-stretch relative z-10">
        <div className="hidden lg:flex lg:w-[52%] flex-col bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 rounded-3xl p-8 xl:p-10 text-white shadow-xl shadow-blue-500/25 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.04%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-60" />
          <div className="relative z-10 flex flex-col h-full">
            <h3 className="text-2xl font-bold mb-2">{t("login.featuresTitle")}</h3>
            <p className="text-white/80 text-sm mb-6 shrink-0">كل ما تحتاجه لبيع وشراء آمن في اليمن</p>
            <div className="overflow-y-auto pr-2 custom-scrollbar space-y-4 max-h-[450px]">
              {features.map((f) => (
                <div key={f.key} className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/10 transition-all duration-200 group text-right">
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 group-hover:bg-white/30 transition-colors">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">{iconSvg(f.icon)}</svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-sm mb-0.5">{t(`login.features.${f.key}.title`)}</h4>
                    <p className="text-white/80 text-xs leading-relaxed">{t(`login.features.${f.key}.desc`)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="w-full lg:w-[48%] flex flex-col items-center justify-center">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-gray-200/80 dark:border-slate-700 p-4 sm:p-8 lg:p-10 shadow-xl shadow-gray-200/50 dark:shadow-slate-900/50 backdrop-blur-sm flex flex-col">
            <div className="flex justify-center w-full mb-4 sm:mb-8">
              <Link to="/" className="hover:opacity-80 transition-opacity shrink-0">
                <div className="scale-75 sm:scale-100"><Logo /></div>
              </Link>
            </div>

            <div className="space-y-1 sm:space-y-2 text-center mb-4 sm:mb-8 shrink-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-slate-100">تسجيل الدخول</h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-300 px-2">ادخل إلى حسابك الآن لإدارة إعلاناتك ومحادثاتك.</p>
              <div className="lg:hidden pt-2 sm:pt-4">
                <button onClick={() => setShowFeatures(true)} className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-[10px] sm:text-xs font-bold border border-blue-100 dark:border-blue-800 transition-all active:scale-95">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {t("login.featuresTitle")}
                </button>
              </div>
            </div>

            <div className="custom-scrollbar pr-1 lg:overflow-y-auto lg:max-h-[500px]">
              {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 sm:py-3 text-xs sm:text-sm text-red-700 mb-4 font-medium text-center">{error}</div>}

              <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-6">
                <button onClick={() => setActiveBox("phone")} className={`rounded-xl border px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm font-semibold text-center transition-all ${activeBox === "phone" ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-300"}`}>رقم الهاتف</button>
                <div className="relative group">
                  <button 
                    onClick={() => setActiveBox("email")} 
                    disabled={isEmailDisabled}
                    className={`w-full rounded-xl border px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm font-semibold text-center transition-all ${ 
                      isEmailDisabled ? "opacity-50 cursor-not-allowed border-gray-200 dark:border-slate-700 text-gray-400" : 
                      activeBox === "email" ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : 
                      "border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-300"
                    }`}
                  >
                    البريد الإلكتروني
                  </button>
                  {isEmailDisabled && (
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
                      متاح قريباً (مغلق حالياً للفترة التجريبية)
                    </div>
                  )}
                </div>
              </div>

              {activeBox === "phone" && (
                <form onSubmit={phoneLogin} className="space-y-3 sm:space-y-5">
                  <div>
                    <label className="block text-xs sm:text-sm text-gray-700 dark:text-slate-300 mb-1 sm:mb-2 font-semibold text-right">اسم المستخدم</label>
                    <input className="w-full rounded-xl border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all text-right" placeholder="اسم المستخدم" value={loginName} onChange={(e) => setLoginName(e.target.value)} required />
                    {loginNameErr && <div className="mt-1 text-[10px] text-red-600 font-medium text-right">{loginNameErr}</div>}
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm text-gray-700 dark:text-slate-300 mb-1 sm:mb-2 font-semibold text-right">رقم الهاتف</label>
                    <input type="tel" className="w-full rounded-xl border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all text-left dir-ltr" placeholder="7xxxxxxx" value={loginPhone} onChange={(e) => setLoginPhone(e.target.value)} required />
                    {loginPhoneErr && <div className="mt-1 text-[10px] text-red-600 font-medium text-right">{loginPhoneErr}</div>}
                  </div>
                  <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 sm:py-4 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-70 text-sm sm:text-base mt-2">
                    {loading ? "جاري التحقق..." : "دخول"}
                  </button>
                </form>
              )}

              {activeBox === "email" && (
                <form onSubmit={emailLogin} className="space-y-3 sm:space-y-5">
                  <div>
                    <label className="block text-xs sm:text-sm text-gray-700 dark:text-slate-300 mb-1 sm:mb-2 font-semibold text-right">البريد الإلكتروني</label>
                    <input className="w-full rounded-xl border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all text-right" type="email" placeholder="example@mail.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1 sm:mb-2">
                      <label className="block text-xs sm:text-sm text-gray-700 dark:text-slate-300 font-semibold text-right">كلمة المرور</label>
                      <Link to="/forgot-password" title="استعادة كلمة المرور" className="text-[10px] sm:text-xs text-blue-600 hover:underline font-medium">هل نسيت كلمة المرور؟</Link>
                    </div>
                    <div className="relative">
                      <input className="w-full rounded-xl border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all text-right pr-10" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-blue-500 transition-colors">
                        {showPassword ? <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg> : <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>}
                      </button>
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 sm:py-4 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-70 text-sm sm:text-base mt-2">
                    {loading ? "جاري الدخول..." : "دخول"}
                  </button>
                </form>
              )}

              <div className="text-center pt-4 sm:pt-6 border-t border-gray-100 dark:border-slate-700 shrink-0">
                <p className="text-gray-600 dark:text-slate-300 text-xs sm:text-sm">ليس لديك حساب؟ <Link to="/register" className="text-blue-600 font-bold hover:underline transition-all">سجل الآن</Link></p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showFeatures && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-gradient-to-br from-blue-600 to-indigo-700 sm:rounded-3xl p-6 text-white shadow-2xl relative animate-in slide-in-from-bottom duration-500 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 sm:hidden" onClick={() => setShowFeatures(false)} />
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h3 className="text-xl font-bold">{t("login.featuresTitle")}</h3>
              <button onClick={() => setShowFeatures(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="overflow-y-auto pr-2 custom-scrollbar space-y-4 pb-6">
              {features.map((f) => (
                <div key={f.key} className="flex items-start gap-4 p-4 rounded-2xl bg-white/10 hover:bg-white/15 transition-all duration-200 text-right">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0"><svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">{iconSvg(f.icon)}</svg></div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-base mb-1">{t(`login.features.${f.key}.title`)}</h4>
                    <p className="text-white/80 text-sm leading-relaxed">{t(`login.features.${f.key}.desc`)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-auto pt-4 sm:hidden">
              <button onClick={() => setShowFeatures(false)} className="w-full py-4 bg-white text-blue-700 font-black rounded-2xl shadow-xl active:scale-95 transition-all">فهمت ذلك</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
