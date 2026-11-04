import React, { useCallback, useEffect, useState } from "react";
import { useApi } from "../api/axios.js";

const LABELS = {
  pending_admin_review: "بانتظار المراجعة",
  code_issued: "صدر رمز — بانتظار إدخاله",
  rejected: "مرفوض",
  verified: "موثّق",
  expired: "منتهي"
};

export default function AdminPhoneVerificationRequests() {
  const api = useApi();
  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState("pending_admin_review");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [delivery, setDelivery] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/phone-verification/admin", { params: { status } });
      setRequests(response.data || []);
    } catch (loadError) {
      setError(loadError?.response?.data?.error || "تعذر تحميل طلبات توثيق الهاتف.");
    } finally {
      setLoading(false);
    }
  }, [api, status]);

  useEffect(() => {
    load();
  }, [load]);

  const issue = async (request, reissue = false) => {
    setLoading(true);
    setError("");
    setDelivery(null);
    try {
      const response = await api.patch(
        `/phone-verification/admin/${request.id}/${reissue ? "reissue" : "approve"}`
      );
      setDelivery({ ...response.data, phone: request.phone, user: request.user });
      await load();
    } catch (issueError) {
      setError(issueError?.response?.data?.error || "تعذر إصدار رمز التحقق.");
    } finally {
      setLoading(false);
    }
  };

  const reject = async (request) => {
    const rejectionReason = window.prompt("سبب الرفض (اختياري):") || "";
    setLoading(true);
    setError("");
    try {
      await api.patch(`/phone-verification/admin/${request.id}/reject`, { rejectionReason });
      await load();
    } catch (rejectError) {
      setError(rejectError?.response?.data?.error || "تعذر رفض الطلب.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="space-y-5 p-4 md:p-6" dir="rtl">
      <header>
        <h1 className="text-2xl font-black text-gray-900">طلبات توثيق أرقام الهاتف</h1>
        <p className="mt-1 text-sm text-gray-600">إصدار الرمز لا يرسله تلقائيًا؛ يجب على المشرف فتح واتساب وإرسال الرسالة يدويًا.</p>
      </header>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {delivery && (
        <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-black text-amber-900">لم يتم إرسال الرمز تلقائيًا.</p>
          <p className="text-sm text-amber-900">
            أرسل الرمز يدويًا إلى {delivery.user?.name || "المستخدم"} ({delivery.phone}). الرمز يظهر لهذه الجلسة مرة واحدة فقط.
          </p>
          <div className="text-center text-2xl font-black tracking-[0.4em]" dir="ltr">{delivery.code}</div>
          <a
            href={delivery.waLink}
            target="_blank"
            rel="noreferrer"
            className="block rounded-xl bg-[#25D366] px-4 py-3 text-center font-bold text-white"
          >
            فتح محادثة واتساب وإرسال الرسالة يدويًا
          </a>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        {Object.entries(LABELS).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatus(value)}
            className={`rounded-xl border px-3 py-2 text-sm font-bold ${status === value ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200 bg-white text-gray-700"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-gray-500">جارٍ تحميل البيانات...</p>}
      <div className="space-y-3">
        {requests.map((request) => (
          <article key={request.id} className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-black text-gray-900">{request.user?.name || "حساب غير متاح"}</h2>
                <p className="mt-1 text-sm text-gray-700" dir="ltr">{request.phone}</p>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold">{LABELS[request.status] || request.status}</span>
            </div>
            <div className="grid gap-1 text-xs text-gray-600 sm:grid-cols-2">
              <p>الطلب: {new Date(request.requestedAt).toLocaleString("ar")}</p>
              {request.codeIssuedAt && <p>إصدار الرمز: {new Date(request.codeIssuedAt).toLocaleString("ar")}</p>}
              {request.codeExpiresAt && <p>انتهاء الرمز: {new Date(request.codeExpiresAt).toLocaleString("ar")}</p>}
              {request.rejectionReason && <p>سبب الرفض: {request.rejectionReason}</p>}
            </div>

            {request.status === "pending_admin_review" && (
              <div className="flex gap-2">
                <button disabled={loading} onClick={() => issue(request)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">الموافقة وإصدار رمز</button>
                <button disabled={loading} onClick={() => reject(request)} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">رفض</button>
              </div>
            )}
            {request.status === "code_issued" && (
              <button disabled={loading} onClick={() => issue(request, true)} className="rounded-lg border border-blue-600 px-4 py-2 text-sm font-bold text-blue-700 disabled:opacity-50">إصدار رمز بديل وإبطال السابق</button>
            )}

            {request.actions?.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer font-bold text-gray-700">سجل الإجراءات</summary>
                <ul className="mt-2 space-y-1">
                  {request.actions.map((action, index) => (
                    <li key={`${action.action}-${action.at}-${index}`}>
                      {action.action} — {action.actor?.name || "النظام"} — {new Date(action.at).toLocaleString("ar")}
                      {action.note ? ` — ${action.note}` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </article>
        ))}
        {!loading && requests.length === 0 && <p className="rounded-xl bg-gray-50 p-6 text-center text-sm text-gray-500">لا توجد طلبات بهذه الحالة.</p>}
      </div>
    </main>
  );
}
