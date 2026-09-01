import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../api/axios.js";
import Logo from "../components/Logo.jsx";

export default function PhoneForgotPassword() {
  const api = useApi();
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [waLink, setWaLink] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setWaLink("");

    if (!username.trim()) {
      setError("يرجى إدخال اسم المستخدم.");
      return;
    }

    if (!phone.trim()) {
      setError("يرجى إدخال رقم الهاتف.");
      return;
    }

    setLoading(true);

    try {
      const response = await api.post("/auth/password-reset-request", {
        username: username.trim(),
        phone: phone.trim()
      });

      const nextLink = response?.data?.waLink || "";
      if (nextLink) {
        setWaLink(nextLink);
        setTimeout(() => {
          window.open(nextLink, "_blank", "noopener,noreferrer");
        }, 150);
      }

      setMessage(response?.data?.message || "تم إرسال طلب استعادة كلمة المرور إلى الإدارة.");
      setUsername("");
      setPhone("");
    } catch (err) {
      setError(err?.response?.data?.error || "تعذر إرسال الطلب، يرجى المحاولة مرة أخرى.");
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
          استعادة كلمة المرور
        </h1>

        <p className="text-sm text-center text-gray-600 dark:text-slate-300 mb-8">
          أدخل اسم المستخدم ورقم الهاتف المرتبط بحسابك، ثم سنرسل طلبك إلى الإدارة للمراجعة.
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

        {waLink && (
          <div className="mb-6">
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              className="block w-full text-center bg-[#25D366] hover:bg-[#1DA851] text-white font-bold py-3 rounded-xl transition-all"
            >
              إرسال طلب الاستعادة عبر واتساب
            </a>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 dark:text-slate-300 mb-2 text-right">اسم المستخدم</label>
            <input
              type="text"
              className="w-full rounded-xl border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-4 py-3 focus:border-blue-500 focus:outline-none text-right"
              placeholder="اسم المستخدم"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 dark:text-slate-300 mb-2 text-right">رقم الهاتف</label>
            <input
              type="tel"
              className="w-full rounded-xl border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-4 py-3 focus:border-blue-500 focus:outline-none text-left dir-ltr"
              placeholder="7xxxxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>

          <button
            disabled={loading}
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50"
          >
            {loading ? "جارِ الإرسال..." : "إرسال الطلب"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/login" className="text-sm text-blue-600 hover:underline font-medium">
            العودة لتسجيل الدخول
          </Link>
        </div>
      </div>
    </div>
  );
}
