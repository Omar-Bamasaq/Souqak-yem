import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApi } from "../api/axios.js";
import BankAccountsDisplay from "../components/BankAccountsDisplay.jsx";
import DocumentPreviewModal from "../components/DocumentPreviewModal.jsx";
import { normalizeProtectedFilePath, useProtectedFiles } from "../lib/protectedFiles.js";
import { confirmUntrustedExternalLink, getExternalLinkHost } from "../utils/untrustedExternalLink.js";
import CurrencyCalculator from "../components/CurrencyCalculator.jsx";

const CURRENCY_LABELS = {
  USD: "دولار أمريكي",
  SAR: "ريال سعودي",
  YER_ADEN: "ريال يمني (عدن)",
  YER_SANAA: "ريال يمني (صنعاء)"
};

const PAYMENT_STATUSES = ["AWAITING_PAYMENT", "QUOTE_OFFERED"];
const MAX_RECEIPT_SIZE = 4 * 1024 * 1024;
const RECEIPT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export default function WalletServicePayment() {
  const api = useApi();
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [banks, setBanks] = useState([]);
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [previewDoc, setPreviewDoc] = useState(null);
  const { urls: protectedFileUrls, contentTypes: protectedFileContentTypes, errors: protectedFileErrors, loading: protectedFilesLoading } = useProtectedFiles(api, [previewDoc]);
  const previewUrl = protectedFileUrls[normalizeProtectedFilePath(previewDoc)] || null;

  const loadData = async () => {
    setError("");
    try {
      const [orderResponse, banksResponse] = await Promise.all([
        api.get(`/wallet-services/mine/orders/${orderId}`),
        api.get("/bank-accounts")
      ]);
      setOrder(orderResponse.data);
      setBanks(banksResponse.data || []);
    } catch (loadError) {
      setError(loadError.response?.data?.error || "تعذر تحميل بيانات الدفع.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [orderId]);

  const acceptQuote = async () => {
    setSubmitting(true);
    setError("");
    try {
      const response = await api.post(`/wallet-services/orders/${orderId}/accept-quote`);
      setOrder(response.data);
    } catch (actionError) {
      setError(actionError.response?.data?.error || "تعذر قبول عرض السعر.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitReceipt = async (event) => {
    event.preventDefault();
    if (!receipt) {
      setError("يرجى اختيار صورة سند الدفع.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("paymentReceipt", receipt);
      const response = await api.post(`/wallet-services/orders/${orderId}/payment`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setOrder(response.data);
      setReceipt(null);
    } catch (actionError) {
      setError(actionError.response?.data?.error || "تعذر إرسال سند الدفع.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectReceipt = (event) => {
    const file = event.target.files?.[0] || null;
    setError("");
    if (!file) {
      setReceipt(null);
      return;
    }
    if (!RECEIPT_TYPES.has(file.type)) {
      setReceipt(null);
      event.target.value = "";
      setError("نوع الملف غير مدعوم. أرفق صورة JPG أو PNG أو WebP أو ملف PDF.");
      return;
    }
    if (file.size > MAX_RECEIPT_SIZE) {
      setReceipt(null);
      event.target.value = "";
      setError("حجم سند الدفع يتجاوز الحد المسموح (4 ميغابايت).");
      return;
    }
    setReceipt(file);
  };

  if (loading) {
    return <div className="mx-auto max-w-4xl px-4 py-12 text-center font-bold text-slate-500 sm:py-20">جارٍ تحميل بيانات الدفع...</div>;
  }

  if (!order) {
    return (
      <main className="mx-auto max-w-3xl px-3 py-6 sm:px-4 sm:py-12">
        <div role="alert" className="rounded-2xl border border-red-200 bg-white p-5 text-center font-bold text-red-700 shadow-sm sm:rounded-3xl sm:p-8">
          {error || "الطلب غير موجود."}
          <Link to="/wallet-services" className="mt-5 block text-blue-700 underline">العودة إلى خدمات الدفع</Link>
        </div>
      </main>
    );
  }

  const canPay = order.status === "AWAITING_PAYMENT" || order.status === "PAYMENT_NEEDS_CORRECTION";
  const needsQuoteAcceptance = order.status === "QUOTE_OFFERED";
  const canShowPayment = canPay || needsQuoteAcceptance;

  return (
    <main className="mx-auto max-w-4xl space-y-4 px-3 py-4 pb-24 sm:space-y-6 sm:px-4 sm:py-12">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => navigate("/wallet-services")} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          العودة إلى خدمات الدفع
        </button>
        <p className="text-xs font-bold text-slate-500">إتمام طلب الخدمة</p>
      </div>

      <header className="rounded-2xl bg-gradient-to-l from-blue-700 to-cyan-700 p-4 text-white shadow-lg sm:rounded-3xl sm:p-8">
        <p className="text-sm font-bold text-blue-100">خدمات سوقك</p>
        <h1 className="mt-2 text-2xl font-black sm:text-3xl">الدفع وإرفاق السند</h1>
        <p className="mt-2 text-sm font-semibold text-blue-50">اتبع طريقة الدفع المعروضة لهذا الطلب، ثم أرفق صورة الإيصال لمراجعتها.</p>
      </header>

      <section aria-labelledby="tmam-pay-payment-title" className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/tmam-full-logo.png" alt="تمام باي Tmam Pay" loading="lazy" decoding="async" className="h-10 w-24 shrink-0 object-contain sm:h-12 sm:w-32" />
          <div className="min-w-0">
            <h2 id="tmam-pay-payment-title" className="text-sm font-black text-slate-900 dark:text-white">تمام باي — شريك مستقل للدفع الإلكتروني</h2>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-600 dark:text-slate-300">
              الدفع عبر تمام باي غير مفعّل لهذا الطلب حاليًا؛ استخدم طريقة الدفع اليدوية الموضحة أدناه.
            </p>
          </div>
        </div>
        <a
          href="https://tmam-pay.wuaze.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 shrink-0 items-center justify-center self-start rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black text-blue-800 transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200 dark:hover:bg-blue-950/50 sm:self-auto"
        >
          زيارة موقع تمام باي
        </a>
      </section>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:space-y-5 sm:rounded-3xl sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-5 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">{order.serviceName}{order.sectionName ? ` — ${order.sectionName}` : order.packageName ? ` — ${order.packageName}` : ""}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">الكمية: {order.quantity} · رقم الطلب: {order._id.slice(-8).toUpperCase()}</p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            {needsQuoteAcceptance ? "عرض السعر بانتظار موافقتك" : order.status === "PAYMENT_NEEDS_CORRECTION" ? "يرجى إعادة رفع السند" : canPay ? "بانتظار الدفع" : order.status === "PAYMENT_REVIEW" ? "السند قيد المراجعة" : order.status === "IN_PROGRESS" ? "الطلب قيد التنفيذ" : order.status === "COMPLETED" ? "الطلب مكتمل" : order.status === "REJECTED" ? "الطلب مرفوض" : order.status}
          </span>
        </div>

        {order.serviceUrl && (
          <div className="rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-950/20">
            {getExternalLinkHost(order.serviceUrl) ? (
              <a href={order.serviceUrl} target="_blank" rel="noopener noreferrer" onClick={confirmUntrustedExternalLink} className="break-all font-semibold text-blue-700 underline">{getExternalLinkHost(order.serviceUrl)}</a>
            ) : <p className="break-all">{order.serviceUrl}</p>}
            <p className="mt-1 text-xs font-semibold leading-5 text-amber-900 dark:text-amber-200">رابط خارجي قدّمه المستخدم. نتيجة الفحص لا تضمن أمان الموقع؛ تحقق من النطاق قبل فتحه.</p>
          </div>
        )}
        {order.customerInfoLabel && <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{order.customerInfoLabel}: {order.customerInfo || "—"}</p>}
        {order.orderType === "catalog" && order.answers && Object.keys(order.answers).length > 0 && (
          <section className="space-y-2 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <h3 className="text-sm font-black text-slate-800 dark:text-white">بيانات الخدمة المرسلة</h3>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {(order.formSchemaSnapshot || []).filter((field) => Object.hasOwn(order.answers, field.id)).map((field) => {
                const value = order.answers[field.id];
                return <div key={field.id}><dt className="text-xs font-bold text-slate-500">{field.label}</dt><dd className="mt-1 break-words font-semibold text-slate-800 dark:text-slate-100">{Array.isArray(value) ? value.join("، ") : typeof value === "boolean" ? value ? "نعم" : "لا" : String(value)}</dd></div>;
              })}
            </dl>
          </section>
        )}
        {order.customerNotes && <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">ملاحظاتك: {order.customerNotes}</p>}

        <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
          <p className="flex justify-between gap-4 text-sm font-semibold"><span>قيمة الخدمة</span><span>{order.serviceAmount?.toLocaleString()} {CURRENCY_LABELS[order.currency] || order.currency}</span></p>
          <p className="mt-2 flex justify-between gap-4 text-sm font-semibold"><span>رسوم سوقك</span><span>{order.platformFee?.toLocaleString()} {CURRENCY_LABELS[order.currency] || order.currency}</span></p>
          <p className="mt-3 flex justify-between gap-4 border-t border-slate-200 pt-3 text-lg font-black text-blue-800 dark:border-slate-700 dark:text-blue-300"><span>الإجمالي المطلوب</span><span>{order.totalAmount?.toLocaleString()} {CURRENCY_LABELS[order.currency] || order.currency}</span></p>
        </div>
        <CurrencyCalculator amount={order.totalAmount} currency={order.currency} />
        {order.quoteNote && <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">ملاحظة الإدارة: {order.quoteNote}</p>}
        {order.status === "PAYMENT_NEEDS_CORRECTION" && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
            طلبت الإدارة سندًا أوضح. {order.paymentCorrectionReason && `الملاحظة: ${order.paymentCorrectionReason}`}
          </p>
        )}

        {needsQuoteAcceptance && (
          <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
            <p className="text-sm font-bold text-amber-900 dark:text-amber-200">راجع تفاصيل المبلغ أعلاه. بعد قبول عرض السعر ستظهر حسابات الدفع وإمكانية إرفاق السند.</p>
            <button type="button" disabled={submitting} onClick={acceptQuote} className="w-full rounded-xl bg-blue-700 px-4 py-3 font-black text-white disabled:opacity-50">
              {submitting ? "جارٍ قبول العرض..." : "قبول السعر والانتقال للدفع"}
            </button>
          </div>
        )}

        {order.status === "CUSTOM_QUOTE_PENDING" && (
          <p className="rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
            وصل طلب الخدمة غير المتوفرة إلى الإدارة. ستظهر تفاصيل عرض السعر في هذه الصفحة عند تجهيزه، ويمكنك بعدها قبوله ومتابعة الدفع.
          </p>
        )}

        {canPay && (
          <>
            <div className="space-y-3">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">{order.status === "PAYMENT_NEEDS_CORRECTION" ? "حسابات الدفع وإعادة رفع السند" : "اختر حساب الدفع"}</h3>
              <BankAccountsDisplay banks={banks} />
            </div>
            {banks.length === 0 && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
                لا توجد حسابات دفع متاحة حاليًا. يرجى التواصل مع الدعم قبل التحويل.
              </p>
            )}
            <form onSubmit={submitReceipt} className="space-y-4 border-t border-slate-100 pt-5 dark:border-slate-800">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">{order.status === "PAYMENT_NEEDS_CORRECTION" ? "إعادة رفع سند الدفع" : "إرفاق سند الدفع"}</h3>
              <label className="block space-y-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                صورة الإيصال
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={selectReceipt}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                  required
                />
              </label>
              <p className="text-xs font-medium leading-5 text-slate-500">صيغة الملف JPG أو PNG أو WebP أو PDF، وبحد أقصى 4 ميغابايت. تأكد من وضوح رقم العملية والمبلغ والعملة قبل الإرسال.</p>
              <button type="submit" disabled={submitting || !banks.length} className="w-full rounded-xl bg-emerald-700 px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
                {submitting ? "جارٍ إرسال السند..." : order.status === "PAYMENT_NEEDS_CORRECTION" ? "إعادة إرسال السند للمراجعة" : "إرسال السند للمراجعة"}
              </button>
            </form>
          </>
        )}

        {order.paymentReceipt && (
          <button type="button" onClick={() => setPreviewDoc(order.paymentReceipt)} className="inline-flex rounded-xl bg-blue-50 px-4 py-3 text-sm font-black text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            عرض سند الدفع المرسل
          </button>
        )}
        {order.status === "PAYMENT_REVIEW" && <p className="rounded-xl bg-blue-50 p-4 text-sm font-bold text-blue-800 dark:bg-blue-950/20 dark:text-blue-200">تم استلام السند وسيتم مراجعته. ستتحدث حالة الطلب هنا بعد المراجعة.</p>}
        {order.completionNote && <p className="rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">نتيجة التنفيذ: {order.completionNote}</p>}
        {order.rejectionReason && <p className="rounded-xl bg-red-50 p-4 text-sm font-bold text-red-800 dark:bg-red-950/20 dark:text-red-200">سبب الرفض: {order.rejectionReason}</p>}
        {Array.isArray(order.statusHistory) && order.statusHistory.length > 0 && (
          <section className="space-y-3 border-t border-slate-100 pt-5 dark:border-slate-800">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">السجل الزمني للطلب</h3>
            <ol className="space-y-2">
              {order.statusHistory.map((event, index) => (
                <li key={`${event.createdAt}-${index}`} className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">
                  <p className="font-bold text-slate-800 dark:text-slate-200">{event.note || event.status}</p>
                  <p className="mt-1 text-xs text-slate-500">{event.actorRole === "admin" ? "الإدارة" : "أنت"} · {new Date(event.createdAt).toLocaleString("ar")}</p>
                </li>
              ))}
            </ol>
          </section>
        )}
      </section>
      <DocumentPreviewModal
        isOpen={Boolean(previewDoc)}
        src={previewUrl}
        onClose={() => setPreviewDoc(null)}
        title="معاينة سند الدفع"
        contentType={protectedFileContentTypes[normalizeProtectedFilePath(previewDoc)]}
        loading={protectedFilesLoading}
        error={protectedFileErrors[normalizeProtectedFilePath(previewDoc)]}
      />
    </main>
  );
}
