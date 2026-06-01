import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApi } from "../api/axios.js";
import Logo from "../components/Logo.jsx";

export default function ForgotPassword() {
  const api = useApi();
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [timer, setTimer] = useState(600); // 10 minutes for reset code
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const inputRefs = [
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null)
  ];

  useEffect(() => {
    let interval = null;
    if (step === 2 && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Auto focus next
    if (value && index < 5) {
      inputRefs[index + 1].current.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs[index - 1].current.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").slice(0, 6).split("");
    if (pasteData.every(char => /^\d$/.test(char))) {
      const newOtp = [...otp];
      pasteData.forEach((char, i) => {
        if (i < 6) newOtp[i] = char;
      });
      setOtp(newOtp);
      if (pasteData.length < 6) {
        inputRefs[pasteData.length].current.focus();
      }
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("صيغة البريد الإلكتروني غير صحيحة.");
      return;
    }

    setError("");
    setMessage("");
    setLoading(true);
    try {
      console.log(`[ForgotPassword] Sending reset OTP to: ${email.trim()}`);
      await api.post("/auth/forgot-password", { email: email.trim() });
      setMessage("تم إرسال رمز التحقق إلى بريدك الإلكتروني.");
      setStep(2);
      setTimer(600); // Reset timer to 10 minutes
    } catch (err) {
      console.error("[ForgotPassword] Send OTP error:", err);
      setError(err?.response?.data?.error || "حدث خطأ ما. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) {
      setError("يرجى إدخال الرمز المكون من 6 أرقام.");
      return;
    }
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await api.post("/auth/verify-reset-otp", { email: email.trim(), code });
      setStep(3);
    } catch (err) {
      setError(err?.response?.data?.error || "رمز التحقق غير صحيح.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");

    // Validate password language
    const arabicRegex = /[\u0600-\u06FF]/;
    if (arabicRegex.test(newPassword)) {
      setError("يجب أن تحتوي كلمة المرور على أحرف إنجليزية وأرقام فقط");
      return;
    }

    if (newPassword.length < 8) {
      setError("يجب أن تكون كلمة المرور 8 أحرف على الأقل");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("كلمات المرور غير متطابقة.");
      return;
    }
    if (newPassword.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", {
        email: email.trim(),
        code: otp.join(""),
        newPassword
      });
      setMessage("تم تغيير كلمة المرور بنجاح. سيتم تحويلك لصفحة تسجيل الدخول.");
      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      setError(err?.response?.data?.error || "حدث خطأ ما. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-700 p-8 shadow-xl shadow-gray-200/50 dark:shadow-slate-900/50">
        <div className="flex justify-center mb-8">
          <Link to="/">
            <Logo />
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-slate-100 mb-2">
          {step === 1 && "نسيت كلمة المرور؟"}
          {step === 2 && "تحقق من بريدك الإلكتروني"}
          {step === 3 && "إنشاء كلمة مرور جديدة"}
        </h1>

        {step === 2 && (
          <div className="mb-6 flex justify-center">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        )}

        <p className="text-sm text-center text-gray-600 dark:text-slate-300 mb-8">
          {step === 1 && "أدخل بريدك الإلكتروني وسنرسل لك رمزاً لإعادة تعيين كلمة المرور."}
          {step === 2 && (
            <>
              لقد أرسلنا رمز التحقق إلى بريدك الإلكتروني:
              <br />
              <span className="font-semibold text-gray-900 dark:text-slate-100">{email}</span>
            </>
          )}
          {step === 3 && "أدخل كلمة المرور الجديدة الخاصة بك."}
        </p>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-6 text-right">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 mb-6 text-right">
            {message}
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 dark:text-slate-300 mb-2 text-right">البريد الإلكتروني</label>
              <input
                type="email"
                className="w-full rounded-xl border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-4 py-3 focus:border-blue-500 focus:outline-none text-right"
                placeholder="example@mail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <button
              disabled={loading}
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50"
            >
              {loading ? "جارِ الإرسال..." : "إرسال الرمز"}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div className="flex justify-center gap-2" dir="ltr">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={inputRefs[index]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                  disabled={loading}
                />
              ))}
            </div>

            <div className="text-center">
              {timer > 0 ? (
                <div className="text-sm text-gray-500">
                  الوقت المتبقي لإدخال الرمز:
                  <span className="block text-lg font-mono font-bold text-blue-600 mt-1">
                    {formatTime(timer)}
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="text-blue-600 font-semibold hover:text-blue-700 transition-colors disabled:opacity-50"
                >
                  إعادة إرسال الرمز
                </button>
              )}
            </div>

            <button
              disabled={loading}
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50"
            >
              {loading ? "جارِ التحقق..." : "تحقق من الرمز"}
            </button>

            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              تغيير البريد الإلكتروني
            </button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 dark:text-slate-300 mb-2 text-right">كلمة المرور الجديدة</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-4 py-3 focus:border-blue-500 focus:outline-none text-right pr-10"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-blue-500 transition-colors"
                >
                  {showPassword ? (
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
              <label className="block text-sm text-gray-700 dark:text-slate-300 mb-2 text-right">تأكيد كلمة المرور</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-4 py-3 focus:border-blue-500 focus:outline-none text-right pr-10"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-blue-500 transition-colors"
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
            <button
              disabled={loading}
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50"
            >
              {loading ? "جارِ الحفظ..." : "حفظ كلمة المرور"}
            </button>
          </form>
        )}

        <div className="mt-8 text-center border-t pt-6">
          <Link to="/login" className="text-sm text-blue-600 hover:underline">
            العودة لتسجيل الدخول
          </Link>
        </div>
      </div>
    </div>
  );
}

