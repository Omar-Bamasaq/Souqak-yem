import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../api/axios.js";
import { useAuth } from "../store/AuthContext.jsx";

const STATUS_LABELS = {
  pending_admin_review: "بانتظار مراجعة المشرف",
  code_issued: "تمت الموافقة، أدخل الرمز إذا وصلك عبر واتساب",
  rejected: "تم رفض الطلب",
  expired: "انتهت صلاحية الطلب أو الرمز",
  verified: "رقم الهاتف موثّق"
};

export default function PhoneVerification() {
  const api = useApi();
  const { user, setUser } = useAuth();
  const [data, setData] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const response = await api.get("/phone-verification/mine");
      setData(response.data);
      if (response.data.phoneVerifiedAt) {
        setUser((current) => current ? { ...current, phoneVerifiedAt: response.data.phoneVerifiedAt } : current);
      }
    } catch (loadError) {
      setError(loadError?.response?.data?.error || "تعذر تحميل حالة توثيق الهاتف.");
    }
  }, [api, setUser]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!["pending_admin_review", "code_issued"].includes(data?.request?.status)) return undefined;
    const timer = setInterval(loadStatus, 30_000);
    return () => clearInterval(timer);
  }, [data?.request?.status, loadStatus]);

  const requestVerification = async () => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await api.post("/phone-verification/request");
      setData((current) => current ? { ...current, request: response.data.request } : current);
      setMessage(response.data.existing
        ? "لديك طلب توثيق قائم؛ لا حاجة لإرسال طلب آخر."
        : "تم إرسال طلب التوثيق إلى المشرفين. سيظهر تحديثه هنا.");
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "تعذر إرسال طلب التوثيق.");
    } finally {
      setLoading(false);
    }
  };

  const verifyPhone = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await api.post("/phone-verification/verify", { code });
      setData((current) => ({
        ...current,
        phoneVerifiedAt: response.data.phoneVerifiedAt,
        request: { ...current?.request, status: "verified", verifiedAt: response.data.phoneVerifiedAt }
      }));
      setUser((current) => current ? { ...current, phoneVerifiedAt: response.data.phoneVerifiedAt } : current);
      setCode("");
      setMessage("تم توثيق رقم الهاتف بنجاح.");
    } catch (verifyError) {
      setError(verifyError?.response?.data?.error || "تعذر التحقق من الرمز.");
      await loadStatus();
    } finally {
      setLoading(false);
    }
  };

  const request = data?.request;
  const codeExpired = request?.status === "code_issued"
    && request.codeExpiresAt
    && new Date(request.codeExpiresAt).getTime() <= Date.now();

  return (
    <main className="mx-auto max-w-lg px-4 py-8" dir="rtl">
      <section className="space-y-5 rounded-3xl border border-gray-100 bg-white p-6 shadow-lg dark:border-slate-700 dark:bg-slate-900">
        <header>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">توثيق رقم الهاتف</h1>
          <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-300">
            يمكنك استخدام سوقك والتصفح دون توثيق. يلزم التوثيق فقط للإجراءات التي تتطلبه.
          </p>
        </header>

        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}

        <div className="rounded-2xl bg-gray-50 p-4 dark:bg-slate-800">
          <div className="text-xs font-bold text-gray-500 dark:text-slate-400">رقم الهاتف</div>
          <div className="mt-1 text-lg font-black text-gray-900 dark:text-white" dir="ltr">
            {data?.phone || user?.phone || "غير مضاف"}
          </div>
          <div className={`mt-3 text-sm font-bold ${data?.phoneVerifiedAt ? "text-emerald-700" : "text-amber-700"}`}>
            {data?.phoneVerifiedAt ? "موثّق" : "غير موثّق"}
          </div>
        </div>

        {request && (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm dark:border-blue-900 dark:bg-blue-950/40">
            <div className="font-black text-blue-900 dark:text-blue-100">
              {STATUS_LABELS[request.status] || request.status}
            </div>
            <div className="mt-2 text-blue-800 dark:text-blue-200">
              تاريخ الطلب: {new Date(request.requestedAt).toLocaleString("ar")}
            </div>
            {request.rejectionReason && (
              <div className="mt-2 text-red-700">سبب الرفض: {request.rejectionReason}</div>
            )}
            {request.status === "code_issued" && (
              <div className="mt-2">
                {codeExpired
                  ? "انتهت صلاحية الرمز. يمكنك طلب مراجعة جديدة."
                  : `ينتهي الرمز: ${new Date(request.codeExpiresAt).toLocaleString("ar")}`}
                <div className="mt-1">المحاولات الخاطئة: {request.codeAttempts || 0} من 5</div>
              </div>
            )}
          </div>
        )}

        {!data?.phone && (
          <p className="text-sm text-gray-600 dark:text-slate-300">
            أضف رقم هاتف صالحًا من <Link className="font-bold text-blue-600 underline" to="/account-settings">إعدادات الحساب</Link>.
          </p>
        )}

        {request?.status === "code_issued" && !codeExpired && (
          <form onSubmit={verifyPhone} className="space-y-3">
            <label htmlFor="phone-verification-code" className="block text-sm font-bold text-gray-700 dark:text-slate-200">
              رمز التحقق المكوّن من 6 أرقام
            </label>
            <input
              id="phone-verification-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-center text-xl tracking-[0.5em] dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              dir="ltr"
              required
            />
            <button disabled={loading || code.length !== 6} className="w-full rounded-xl bg-blue-600 px-4 py-3 font-bold text-white disabled:opacity-50">
              {loading ? "جارٍ التحقق..." : "تحقق من الرمز"}
            </button>
          </form>
        )}

        {!data?.phoneVerifiedAt && data?.phone && request?.status !== "pending_admin_review" && (
          <button
            type="button"
            onClick={requestVerification}
            disabled={loading || (request?.status === "code_issued" && !codeExpired)}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 font-bold text-white disabled:opacity-50"
          >
            {loading ? "جارٍ إرسال الطلب..." : request?.status === "rejected" || codeExpired
              ? "إرسال طلب توثيق جديد"
              : request?.status === "verified" ? "تم توثيق الرقم" : "طلب توثيق رقم الهاتف"}
          </button>
        )}

        {request?.status === "pending_admin_review" && (
          <p className="text-center text-sm font-semibold text-blue-700">
            طلبك قيد المراجعة. ستظهر الحالة الجديدة هنا عند تحديثها.
          </p>
        )}
      </section>
    </main>
  );
}
