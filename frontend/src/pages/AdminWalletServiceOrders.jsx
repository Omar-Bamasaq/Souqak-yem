import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";
import DocumentPreviewModal from "../components/DocumentPreviewModal.jsx";
import { normalizeProtectedFilePath, useProtectedFiles } from "../lib/protectedFiles.js";
import { confirmUntrustedExternalLink, getExternalLinkHost } from "../utils/untrustedExternalLink.js";

const CURRENCIES = [
  { value: "USD", label: "دولار أمريكي" },
  { value: "SAR", label: "ريال سعودي" },
  { value: "YER_ADEN", label: "ريال يمني (عدن)" },
  { value: "YER_SANAA", label: "ريال يمني (صنعاء)" }
];
const STATUSES = [
  ["", "كل الطلبات"],
  ["CUSTOM_QUOTE_PENDING", "بانتظار التسعير"],
  ["QUOTE_OFFERED", "عرض سعر مرسل"],
  ["AWAITING_PAYMENT", "بانتظار الدفع"],
  ["PAYMENT_REVIEW", "مراجعة السند"],
  ["PAYMENT_NEEDS_CORRECTION", "بحاجة إلى سند أوضح"],
  ["IN_PROGRESS", "قيد التنفيذ"],
  ["COMPLETED", "مكتمل"],
  ["REJECTED", "مرفوض"]
];
const STATUS_NAMES = Object.fromEntries(STATUSES);
const STATUS_STYLES = {
  CUSTOM_QUOTE_PENDING: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
  QUOTE_OFFERED: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-200",
  AWAITING_PAYMENT: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200",
  PAYMENT_REVIEW: "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-200",
  PAYMENT_NEEDS_CORRECTION: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
  IN_PROGRESS: "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200",
  REJECTED: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
};
const fieldClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

export default function AdminWalletServiceOrders() {
  const api = useApi();
  const [orders, setOrders] = useState([]);
  const [expandedOrderIds, setExpandedOrderIds] = useState(() => new Set());
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [formValues, setFormValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [previewDoc, setPreviewDoc] = useState(null);
  const { urls: protectedFileUrls, contentTypes: protectedFileContentTypes, errors: protectedFileErrors, loading: protectedFilesLoading } = useProtectedFiles(api, [previewDoc]);
  const previewUrl = protectedFileUrls[normalizeProtectedFilePath(previewDoc)] || null;

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.get("/wallet-services/admin/orders", { params: status ? { status } : {} });
      setOrders(response.data || []);
    } catch (loadError) {
      setError(loadError.response?.data?.error || "تعذر تحميل الطلبات.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [status]);

  const updateForm = (id, key, value) => setFormValues((current) => ({
    ...current, [id]: { ...(current[id] || {}), [key]: value }
  }));

  const toggleOrder = (id) => setExpandedOrderIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const runAction = async (id, action, data = {}) => {
    setBusyId(id);
    setError("");
    try {
      await api.post(`/wallet-services/admin/orders/${id}/${action}`, data);
      await load();
    } catch (actionError) {
      setError(actionError.response?.data?.error || "تعذر تنفيذ الإجراء.");
    } finally {
      setBusyId("");
    }
  };

  const quote = (order) => {
    const values = formValues[order._id] || {};
    const serviceAmount = Number(values.serviceAmount);
    const currency = values.currency || "USD";
    if (values.serviceAmount === undefined || values.serviceAmount === "" || !Number.isFinite(serviceAmount)) {
      setError("أدخل سعر الخدمة والعملة لإرسال عرض السعر.");
      return;
    }
    runAction(order._id, "quote", {
      serviceAmount,
      currency,
      quoteNote: values.quoteNote || ""
    });
  };

  const reject = (order) => {
    const rejectionReason = (formValues[order._id] || {}).rejectionReason;
    if (!rejectionReason?.trim()) {
      setError("اكتب سبب الرفض في خانة الملاحظات قبل تأكيد الرفض.");
      return;
    }
    runAction(order._id, "reject", { rejectionReason });
  };

  const complete = (order) => {
    const completionNote = (formValues[order._id] || {}).completionNote;
    if (!completionNote?.trim()) {
      setError("اكتب نتيجة تنفيذ الخدمة قبل إكمال الطلب.");
      return;
    }
    runAction(order._id, "complete", { completionNote });
  };

  const requestProofCorrection = (order) => {
    const reason = (formValues[order._id] || {}).proofCorrectionReason;
    if (!reason?.trim()) {
      setError("اكتب سبب طلب سند أوضح.");
      return;
    }
    runAction(order._id, "request-proof-correction", { reason });
  };

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleOrders = orders.filter((order) => !normalizedSearch || [
    order.serviceName, order.sectionName, order._id, order.user?.name, order.user?.email, order.whatsappNumber
  ].some((value) => String(value || "").toLocaleLowerCase().includes(normalizedSearch)));
  const catalogOrdersCount = visibleOrders.filter((order) => order.orderType === "catalog").length;
  const customOrdersCount = visibleOrders.length - catalogOrdersCount;

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="overflow-hidden rounded-3xl bg-gradient-to-l from-slate-950 via-blue-950 to-blue-800 p-5 text-white shadow-lg sm:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-black tracking-wide text-blue-200">مركز متابعة الطلبات</p>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl">طلبات خدمات الدفع</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-blue-100">تابع الطلب من التسعير وحتى التسليم، وابدأ من الطلبات التي تحتاج إجراءً.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
              <p className="text-[11px] font-bold text-blue-100">ضمن النتائج</p><p className="mt-1 text-2xl font-black">{visibleOrders.length}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
              <p className="text-[11px] font-bold text-blue-100">من الكتالوج</p><p className="mt-1 text-2xl font-black">{catalogOrdersCount}</p>
            </div>
            <div className="col-span-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 sm:col-span-1">
              <p className="text-[11px] font-bold text-blue-100">طلبات مخصصة</p><p className="mt-1 text-2xl font-black">{customOrdersCount}</p>
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.45fr)] sm:p-5">
        <label className="block text-xs font-black text-slate-600 dark:text-slate-300">
          بحث في الطلبات الظاهرة
          <input className={`${fieldClass} mt-1.5 px-4 py-3`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="الخدمة، العميل، البريد، الواتساب أو رقم الطلب" />
        </label>
        <label className="block text-xs font-black text-slate-600 dark:text-slate-300">
          تصفية حسب الحالة
          <select className={`${fieldClass} mt-1.5 px-4 py-3`} value={status} onChange={(event) => setStatus(event.target.value)}>{STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </label>
      </section>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
      {loading ? <div className="rounded-3xl border border-slate-200 bg-white px-5 py-16 text-center font-bold text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900">جارٍ تحميل الطلبات...</div> : visibleOrders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="text-lg font-black text-slate-800 dark:text-white">{orders.length ? "لا توجد نتائج مطابقة" : "لا توجد طلبات في هذه القائمة"}</p>
          <p className="mt-2 text-sm text-slate-500">{orders.length ? "جرّب تغيير كلمات البحث أو الحالة." : "ستظهر الطلبات الجديدة هنا فور إرسالها."}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleOrders.map((order) => {
            const values = formValues[order._id] || {};
            const isExpanded = expandedOrderIds.has(order._id);
            return (
              <article key={order._id} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${order.orderType === "custom" ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200" : "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200"}`}>
                        {order.orderType === "custom" ? "طلب مخصص" : "من الكتالوج"}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${STATUS_STYLES[order.status] || "border-slate-200 bg-slate-50 text-slate-700"}`}>
                        {STATUS_NAMES[order.status] || order.status}
                      </span>
                    </div>
                    <h2 className="mt-3 break-words text-lg font-black text-slate-900 dark:text-white">{order.serviceName}{order.sectionName ? ` — ${order.sectionName}` : order.packageName ? ` — ${order.packageName}` : ""}</h2>
                    {order.orderType === "catalog" && <p className="mt-1 text-[11px] font-semibold text-slate-500">{order.categoryName || "بدون تصنيف"}{order.serviceType ? ` · ${order.serviceType}` : ""}{order.serviceVersion ? ` · إصدار الخدمة ${order.serviceVersion}` : ""}{order.formSchemaVersion ? ` · إصدار النموذج ${order.formSchemaVersion}` : ""}</p>}
                    <p className="mt-1 break-all text-xs font-semibold text-slate-500">{order.user?.name || "مستخدم"}{order.user?.email ? ` · ${order.user.email}` : ""}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800 sm:flex-col sm:items-end">
                      <span className="font-black text-slate-700 dark:text-slate-200">#{order._id.slice(-8).toUpperCase()}</span>
                      <time className="font-semibold text-slate-500">{new Date(order.createdAt).toLocaleString("ar")}</time>
                    </div>
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-controls={`order-details-${order._id}`}
                      onClick={() => toggleOrder(order._id)}
                      className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-50 dark:border-slate-700 dark:text-blue-300 dark:hover:bg-slate-700"
                    >
                      {isExpanded ? "طي التفاصيل" : "عرض التفاصيل"}
                    </button>
                  </div>
                </div>

                <div id={`order-details-${order._id}`} className="space-y-4" hidden={!isExpanded}>
                <div className="grid gap-2 rounded-2xl bg-slate-50 p-3 text-xs dark:bg-slate-800 sm:grid-cols-3">
                  <p><span className="block font-bold text-slate-500">رقم واتساب</span><span className="mt-1 block font-black text-slate-800 dark:text-slate-100" dir="ltr">{order.whatsappNumber || "—"}</span></p>
                  <p><span className="block font-bold text-slate-500">الكمية</span><span className="mt-1 block font-black text-slate-800 dark:text-slate-100">{order.quantity}</span></p>
                  <p><span className="block font-bold text-slate-500">رقم الطلب</span><span className="mt-1 block break-all font-black text-slate-800 dark:text-slate-100" dir="ltr">{order._id}</span></p>
                </div>

                {order.orderType === "custom" && (
                  <div className="rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-950/20">
                    <p className="font-black">طلب مخصص — {order.serviceName}</p>
                    {getExternalLinkHost(order.serviceUrl) ? (
                      <a className="mt-1 inline-block break-all font-bold text-blue-700 underline" href={order.serviceUrl} target="_blank" rel="noopener noreferrer" onClick={confirmUntrustedExternalLink}>{getExternalLinkHost(order.serviceUrl)}</a>
                    ) : <p className="mt-1 break-all text-slate-700">{order.serviceUrl}</p>}
                    <p className="mt-1 text-xs font-semibold leading-5 text-amber-900 dark:text-amber-200">
                      رابط خارجي قدّمه المستخدم. {["web_risk_clean", "cloudflare_unlisted_clean"].includes(order.serviceUrlSafety) ? "لم يكتشف فحص الرابط تهديدًا معروفًا وقت الإرسال، وهذا لا يضمن أمان الموقع." : "لم يتم فحص هذا الرابط."} لا تفتح الرابط إلا بعد التحقق من النطاق.
                    </p>
                  </div>
                )}
                {order.customerInfoLabel && <p className="text-sm"><strong>{order.customerInfoLabel}:</strong> {order.customerInfo || "—"}</p>}
                {order.orderType === "catalog" && order.answers && Object.keys(order.answers).length > 0 && (
                  <section className="space-y-2 rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                    <h3 className="text-xs font-black text-slate-600 dark:text-slate-300">إجابات نموذج الطلب المحفوظة</h3>
                    <dl className="grid gap-3 text-xs sm:grid-cols-2">
                      {(order.formSchemaSnapshot || []).filter((field) => Object.hasOwn(order.answers, field.id)).map((field) => {
                        const value = order.answers[field.id];
                        return <div key={field.id}><dt className="font-bold text-slate-500">{field.label}</dt><dd className="mt-1 break-words font-semibold text-slate-800 dark:text-slate-100">{Array.isArray(value) ? value.join("، ") : typeof value === "boolean" ? value ? "نعم" : "لا" : String(value)}</dd></div>;
                      })}
                    </dl>
                  </section>
                )}
                {order.customerNotes && <p className="text-sm"><strong>ملاحظات العميل:</strong> {order.customerNotes}</p>}
                {order.totalAmount != null && <div className="grid gap-2 rounded-2xl border border-slate-200 p-3 text-xs dark:border-slate-700 sm:grid-cols-3">
                  <p><span className="block font-bold text-slate-500">قيمة الخدمة</span><strong className="mt-1 block text-sm">{order.serviceAmount} {order.currency}</strong></p>
                  <p><span className="block font-bold text-slate-500">رسوم سوقك</span><strong className="mt-1 block text-sm">{order.platformFee} {order.currency}</strong></p>
                  <p><span className="block font-bold text-slate-500">الإجمالي</span><strong className="mt-1 block text-sm text-blue-700 dark:text-blue-300">{order.totalAmount} {order.currency}</strong></p>
                </div>}
                {order.paymentReceipt && <button type="button" onClick={() => setPreviewDoc(order.paymentReceipt)} className="inline-flex rounded-lg bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">عرض سند الدفع</button>}
                {order.paymentCorrectionReason && <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">سبب طلب السند البديل: {order.paymentCorrectionReason}</p>}

                {order.status === "CUSTOM_QUOTE_PENDING" && (
                  <div className="grid gap-2 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800 sm:grid-cols-2">
                    <h3 className="sm:col-span-2 text-sm font-black">تقديم عرض سعر</h3>
                    <input className={fieldClass} type="number" min="0" step="0.01" placeholder="قيمة الخدمة قبل الرسوم" value={values.serviceAmount || ""} onChange={(event) => updateForm(order._id, "serviceAmount", event.target.value)} />
                    <select className={fieldClass} value={values.currency || "USD"} onChange={(event) => updateForm(order._id, "currency", event.target.value)}>{CURRENCIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
                    <input className={`${fieldClass} sm:col-span-2`} placeholder="ملاحظة أو تعليمات للعميل (اختياري)" maxLength={1000} value={values.quoteNote || ""} onChange={(event) => updateForm(order._id, "quoteNote", event.target.value)} />
                    <button disabled={busyId === order._id} onClick={() => quote(order)} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white sm:col-span-2">إرسال عرض السعر</button>
                  </div>
                )}

                {order.status === "PAYMENT_REVIEW" && (
                  <div className="space-y-2 rounded-2xl bg-blue-50 p-4 dark:bg-blue-950/20">
                    <button disabled={busyId === order._id} onClick={() => runAction(order._id, "confirm-payment")} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">تأكيد استلام الدفع وبدء التنفيذ</button>
                    <label className="block text-xs font-black">سبب طلب سند أوضح
                      <textarea className={`${fieldClass} mt-1`} rows={2} maxLength={1000} value={values.proofCorrectionReason || ""} onChange={(event) => updateForm(order._id, "proofCorrectionReason", event.target.value)} />
                    </label>
                    <button disabled={busyId === order._id} onClick={() => requestProofCorrection(order)} className="rounded-xl border border-amber-300 px-4 py-2.5 text-sm font-black text-amber-800 disabled:opacity-50">طلب إعادة رفع السند</button>
                  </div>
                )}

                {order.status === "IN_PROGRESS" && (
                  <div className="space-y-2 rounded-2xl bg-emerald-50/70 p-4 dark:bg-emerald-950/10">
                    <label className="block text-xs font-black">نتيجة التنفيذ / ملاحظة للعميل<textarea className={`${fieldClass} mt-1`} rows={2} maxLength={1000} value={values.completionNote || ""} onChange={(event) => updateForm(order._id, "completionNote", event.target.value)} /></label>
                    <button disabled={busyId === order._id} onClick={() => complete(order)} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white">تسجيل اكتمال الطلب</button>
                  </div>
                )}

                {order.status === "COMPLETED" && order.completionNote && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">نتيجة التنفيذ: {order.completionNote}</p>}
                {order.status === "REJECTED" && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800 dark:bg-red-950/20 dark:text-red-200">سبب الرفض: {order.rejectionReason}</p>}

                {Array.isArray(order.statusHistory) && order.statusHistory.length > 0 && (
                  <section className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <h3 className="text-sm font-black">السجل الزمني</h3>
                    <ol className="space-y-2">
                      {order.statusHistory.map((event, index) => (
                        <li key={`${event.createdAt}-${index}`} className="rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800">
                          <p className="font-bold">{STATUS_NAMES[event.status] || event.status} · {event.note}</p>
                          <p className="mt-1 text-slate-500">{event.actor?.name || (event.actorRole === "admin" ? "الإدارة" : "العميل")} · {new Date(event.createdAt).toLocaleString("ar")}</p>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}

                {["CUSTOM_QUOTE_PENDING", "QUOTE_OFFERED", "AWAITING_PAYMENT", "PAYMENT_REVIEW", "PAYMENT_NEEDS_CORRECTION"].includes(order.status) && (
                  <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <input className={`${fieldClass} min-w-60 flex-1`} placeholder="سبب الرفض (مطلوب عند الرفض)" maxLength={1000} value={values.rejectionReason || ""} onChange={(event) => updateForm(order._id, "rejectionReason", event.target.value)} />
                    <button disabled={busyId === order._id} onClick={() => reject(order)} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-black text-red-700">رفض الطلب</button>
                  </div>
                )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      <DocumentPreviewModal
        isOpen={Boolean(previewDoc)}
        src={previewUrl}
        onClose={() => setPreviewDoc(null)}
        title="معاينة سند الدفع"
        contentType={protectedFileContentTypes[normalizeProtectedFilePath(previewDoc)]}
        loading={protectedFilesLoading}
        error={protectedFileErrors[normalizeProtectedFilePath(previewDoc)]}
      />
    </div>
  );
}
