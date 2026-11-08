import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../api/axios.js";
import Logo from "../components/Logo.jsx";
import { useAuth } from "../store/AuthContext.jsx";

export default function AdminLogin() {
  const api = useApi();
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.role === "admin") {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [navigate, user?.role]);

  if (user?.role === "admin") {
    return null;
  }

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await api.post("/auth/login", {
        email: email.trim(),
        password,
        adminLogin: true
      });
      if (response.data.user?.role !== "admin") {
        setError("لا تملك صلاحية الدخول إلى لوحة الإدارة.");
        return;
      }
      login(response.data.token, response.data.user);
      navigate("/admin/dashboard", { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.error || "تعذر تسجيل الدخول. تحقق من البيانات وحاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 py-8 text-right dark:bg-slate-950">
      <section className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <div className="mb-6 flex justify-center">
          <Logo iconSize="h-10" />
        </div>
        <h1 className="text-center text-xl font-bold text-slate-900 dark:text-white">دخول الإدارة</h1>
        <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-300">سجّل الدخول باستخدام حساب الأدمن.</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="admin-email" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">البريد الإلكتروني</label>
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              dir="ltr"
            />
          </div>
          <div>
            <label htmlFor="admin-password" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">كلمة المرور</label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              dir="ltr"
            />
          </div>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? "جارٍ التحقق..." : "دخول"}
          </button>
        </form>
      </section>
    </div>
  );
}
