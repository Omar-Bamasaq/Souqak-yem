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

    if (/[\s\p{Script=Arabic}]/u.test(password)) {
      setError("لا تسمح كلمة المرور بالمسافات أو الأحرف العربية.");
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
              <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-4 py-3 pl-16 text-right focus:border-blue-500 focus:outline-none" placeholder="••••••••" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-semibold text-blue-600 hover:text-blue-700" aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} aria-pressed={showPassword}>
                {showPassword ? "إخفاء" : "إظهار"}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-700 dark:text-slate-300 mb-2 text-right">تأكيد كلمة المرور</label>
            <div className="relative">
              <input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full rounded-xl border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-4 py-3 pl-16 text-right focus:border-blue-500 focus:outline-none" placeholder="••••••••" required />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-semibold text-blue-600 hover:text-blue-700" aria-label={showConfirmPassword ? "إخفاء تأكيد كلمة المرور" : "إظهار تأكيد كلمة المرور"} aria-pressed={showConfirmPassword}>
                {showConfirmPassword ? "إخفاء" : "إظهار"}
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
