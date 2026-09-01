import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../api/axios.js";
import { useAuth } from "../store/AuthContext.jsx";
import Logo from "../components/Logo.jsx";

export default function SetNewPassword() {
  const api = useApi();
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!password || !confirmPassword) {
      setError("يجب إدخال كلمة المرور الجديدة وتأكيدها.");
      return;
    }

    if (password.length < 8 || password.length > 24) {
      setError("كلمة المرور يجب أن تكون من 8 إلى 24 رمزاً.");
      return;
    }

    if (password !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/set-new-password", {
        newPassword: password,
        confirmPassword
      });

      if (user?.token) {
        login(user.token, user);
      }

      window.dispatchEvent(new CustomEvent("app:toast", { detail: { type: "success", message: res.data.message || "تم تعيين كلمة المرور بنجاح" } }));
      navigate("/", { replace: true });
    } catch (err) {
      setError(err?.response?.data?.error || "حدث خطأ أثناء تعيين كلمة المرور.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-700 p-8 shadow-xl shadow-gray-200/50 dark:shadow-slate-900/50">
        <div className="flex justify-center mb-8">
          <Logo />
        </div>

        <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-slate-100 mb-2">تعيين كلمة المرور الجديدة</h1>
        <p className="text-sm text-center text-gray-600 dark:text-slate-300 mb-8">يرجى إدخال كلمة مرور جديدة لك لتستكمل الدخول.</p>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-6 text-right">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm text-gray-700 dark:text-slate-300 mb-2 text-right">كلمة المرور الجديدة</label>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-4 py-3 text-right pr-10 focus:border-blue-500 focus:outline-none" placeholder="••••••••" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-blue-500" aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}>
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.5 12c1.572 4.09 5.022 7 10.5 7s8.928-2.91 10.5-7a10.477 10.477 0 00-2.48-3.777M9.88 9.88A3 3 0 0114.12 14.12M6.61 6.61L17.39 17.39" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    <circle cx="12" cy="12" r="3.5" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-700 dark:text-slate-300 mb-2 text-right">تأكيد كلمة المرور</label>
            <div className="relative">
              <input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full rounded-xl border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-4 py-3 text-right pr-10 focus:border-blue-500 focus:outline-none" placeholder="••••••••" required />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-blue-500" aria-label={showConfirmPassword ? "إخفاء تأكيد كلمة المرور" : "إظهار تأكيد كلمة المرور"}>
                {showConfirmPassword ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.5 12c1.572 4.09 5.022 7 10.5 7s8.928-2.91 10.5-7a10.477 10.477 0 00-2.48-3.777M9.88 9.88A3 3 0 0114.12 14.12M6.61 6.61L17.39 17.39" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    <circle cx="12" cy="12" r="3.5" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button disabled={loading} type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50">
            {loading ? "جارٍ الحفظ..." : "تعيين كلمة المرور"}
          </button>
        </form>
      </div>
    </div>
  );
}
