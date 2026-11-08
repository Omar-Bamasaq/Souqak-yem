import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../api/axios.js";
import DocumentPreviewModal from "../components/DocumentPreviewModal.jsx";
import { normalizeProtectedFilePath, useProtectedFiles } from "../lib/protectedFiles.js";
import { getStoreCurrencyLabel, getStoreStatusLabel } from "../utils/storeArabicLabels.js";
import { StoreEmptyState, StoreLoadingCards, StoreStatusBadge } from "../components/StoreUi.jsx";

const STATUS_LABELS = {
  new: "جديد",
  processing: "قيد التجهيز",
  completed: "مكتمل",
  cancelled: "ملغي"
};

const FILTERS = [
  { id: "all", label: "الكل" },
  { id: "new", label: "جديدة" },
  { id: "processing", label: "قيد التجهيز" },
  { id: "completed", label: "مكتملة" },
  { id: "cancelled", label: "ملغاة" }
];

function formatMoney(value, currency) {
  const amount = Number(value);
  return `${Number.isFinite(amount) ? amount.toLocaleString("ar-EG") : "—"} ${getStoreCurrencyLabel(currency)}`;
}

function formatDate(value) {
  if (!value) return "التاريخ غير متاح";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "التاريخ غير متاح"
    : date.toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
}

export default function StoreOrders({ storeType = "store" }) {
  const api = useApi();
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [previewDoc, setPreviewDoc] = useState("");

  const loadOrders = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await api.get("/store-commerce/owner/orders", { params: { storeType } });
      const nextOrders = response.data.orders || [];
      setOrders(nextOrders);
      setSelectedOrderId((current) =>
        nextOrders.some((order) => order._id === current) ? current : nextOrders[0]?._id || null
      );
      if (response.data.notificationsEnabled) {
        await api.patch("/store-commerce/owner/notifications/read", {}, { params: { storeType } });
        window.dispatchEvent(new Event("notifications:refresh"));
      }
    } catch (requestError) {
      setError(requestError.response?.data?.error || "تعذر تحميل طلبات المتجر.");
    } finally {
      setLoading(false);
    }
  }, [api, storeType]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return orders.filter((order) => {
      if (filter !== "all" && order.status !== filter) return false;
      if (!normalizedSearch) return true;
      const searchableText = [
        String(order._id || "").slice(-8),
        order.buyer?.name || "",
        order.buyer?.phone || "",
        ...(order.items || []).map((item) => item.title || "")
      ].join(" ").toLocaleLowerCase();
      return searchableText.includes(normalizedSearch);
    });
  }, [filter, orders, search]);

  const selectedOrder = filteredOrders.find((order) => order._id === selectedOrderId) || null;
  const { urls: protectedFileUrls, contentTypes: protectedFileContentTypes, errors: protectedFileErrors, loading: protectedFilesLoading } = useProtectedFiles(api, [previewDoc]);
  const previewUrl = protectedFileUrls[normalizeProtectedFilePath(previewDoc)] || null;
  const counts = useMemo(() => orders.reduce((result, order) => {
    result.all += 1;
    if (result[order.status] !== undefined) result[order.status] += 1;
    return result;
  }, { all: 0, new: 0, processing: 0, completed: 0, cancelled: 0 }), [orders]);

  const updateStatus = async (status) => {
    if (!selectedOrder || updating) return;
    if (status === "cancelled" && !window.confirm("هل تريد إلغاء هذا الطلب؟ ستتم إعادة المخزون المرتبط به.")) return;
    setUpdating(true);
    setError("");
    setNotice("");
    try {
      const response = await api.patch(
        `/store-commerce/owner/orders/${selectedOrder._id}/status`,
        { status },
        { params: { storeType } }
      );
      setOrders((current) => current.map((order) => order._id === response.data._id ? response.data : order));
      setNotice(status === "cancelled" ? "تم إلغاء الطلب وإعادة المخزون." : "تم تحديث حالة الطلب.");
    } catch (requestError) {
      setError(requestError.response?.data?.error || "تعذر تحديث حالة الطلب.");
    } finally {
      setUpdating(false);
    }
  };

  const returnPath = storeType === "family-production" ? "/my-family-production" : "/my-store";

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 pb-24 sm:space-y-6 sm:px-6 sm:py-8" dir="rtl">
      <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div className="min-w-0">
          <Link to={returnPath} className="inline-flex min-h-9 items-center gap-2 text-xs font-bold text-slate-500 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <span aria-hidden="true">→</span> العودة إلى لوحة المتجر
          </Link>
          <p className="mt-4 text-xs font-extrabold text-blue-700">مركز متابعة المبيعات</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">طلبات المتجر</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">تابع الطلبات وحدّث حالتها من مكان واحد.</p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm" aria-hidden="true">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M6 4h12v16H6zM9 11h6M9 15h4" /></svg>
          </span>
          <div>
            <p className="text-xs font-bold text-slate-500">إجمالي الطلبات</p>
            <p className="text-lg font-black text-slate-900">{orders.length.toLocaleString("ar-EG")}</p>
          </div>
        </div>
      </header>

      {error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">{error}</div>}
      {notice && <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{notice}</div>}

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-label="قائمة الطلبات">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="تصفية الطلبات">
            {FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={filter === option.id}
                onClick={() => setFilter(option.id)}
                className={`min-h-10 shrink-0 rounded-xl px-3 text-xs font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  filter === option.id ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {option.label}
                <span className={`mr-2 rounded-full px-1.5 py-0.5 text-[10px] ${filter === option.id ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"}`}>
                  {counts[option.id].toLocaleString("ar-EG")}
                </span>
              </button>
            ))}
          </div>
          <label className="relative block w-full lg:max-w-xs">
            <span className="sr-only">ابحث في الطلبات</span>
            <svg aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="m16 16 4 4" /></svg>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث برقم الطلب أو اسم العميل"
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pr-10 pl-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>

        {loading ? <StoreLoadingCards count={3} /> : orders.length === 0 ? (
          <StoreEmptyState title="لا توجد طلبات حتى الآن" description="ستظهر هنا الطلبات الجديدة عند شراء منتجات متجرك." />
        ) : filteredOrders.length === 0 ? (
          <StoreEmptyState title="لا توجد نتائج مطابقة" description="جرّب تغيير الحالة أو عبارة البحث." />
        ) : (
          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.4fr)]">
            <div className="min-w-0 space-y-2" role="list" aria-label="نتائج الطلبات">
              {filteredOrders.map((order) => {
                const label = STATUS_LABELS[order.status] || getStoreStatusLabel(order.status);
                const isSelected = selectedOrderId === order._id;
                return (
                  <button
                    key={order._id}
                    type="button"
                    role="listitem"
                    aria-pressed={isSelected}
                    onClick={() => { setSelectedOrderId(order._id); setNotice(""); }}
                    className={`w-full rounded-2xl border p-4 text-right transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      isSelected ? "border-blue-300 bg-blue-50/70 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-black text-slate-900">طلب <span dir="ltr">#{String(order._id).slice(-8).toUpperCase()}</span></p>
                        <p className="mt-1 truncate text-xs font-semibold text-slate-500">{order.buyer?.name || "عميل"} · {(order.items || []).length} منتجات</p>
                      </div>
                      <StoreStatusBadge status={order.status} label={label} />
                    </div>
                    <div className="mt-4 flex items-end justify-between gap-3 border-t border-slate-200/70 pt-3">
                      <span className="text-xs text-slate-500">{formatDate(order.createdAt)}</span>
                      <strong className="text-sm font-black text-slate-950">{formatMoney(order.total ?? order.totalAmount, order.currency)}</strong>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedOrder ? (
              <section className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-6" aria-label="تفاصيل الطلب المحدد">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
                  <div>
                    <p className="text-xs font-bold text-slate-500">تفاصيل الطلب</p>
                    <h2 className="mt-1 text-lg font-black text-slate-950"><span dir="ltr">#{String(selectedOrder._id).slice(-8).toUpperCase()}</span></h2>
                    <p className="mt-1 text-xs text-slate-500">{formatDate(selectedOrder.createdAt)}</p>
                  </div>
                  <StoreStatusBadge status={selectedOrder.status} label={STATUS_LABELS[selectedOrder.status] || getStoreStatusLabel(selectedOrder.status)} />
                </div>

                {selectedOrder.buyer && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-[11px] font-extrabold text-slate-500">بيانات العميل</p>
                    <p className="mt-1 font-extrabold text-slate-900">{selectedOrder.buyer.name || "عميل"}</p>
                    {selectedOrder.buyer.phone && <a className="mt-1 inline-flex min-h-9 items-center text-sm font-semibold text-blue-700 hover:underline" href={`tel:${selectedOrder.buyer.phone}`} dir="ltr">{selectedOrder.buyer.phone}</a>}
                  </div>
                )}

                <div className="mt-5">
                  <h3 className="text-sm font-extrabold text-slate-800">المنتجات المطلوبة</h3>
                  <ul className="mt-2 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {(selectedOrder.items || []).map((item, index) => (
                      <li key={`${item.productId || item.title}-${index}`} className="flex min-w-0 items-start justify-between gap-3 p-3 sm:p-4">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-extrabold text-slate-900">{item.title}</p>
                          <p className="mt-1 text-xs text-slate-500">الكمية: {Number(item.quantity || 0).toLocaleString("ar-EG")} × {formatMoney(item.unitPrice ?? item.price, item.currency)}</p>
                          {Number(item.discountValue) > 0 && (
                            <p className="mt-1 text-xs font-bold text-rose-700">
                              خصم {item.discountType === "fixed"
                                ? formatMoney(item.discountValue, item.currency)
                                : `${Number(item.discountValue).toLocaleString("ar-EG")}%`}
                            </p>
                          )}
                        </div>
                        <strong className="shrink-0 text-sm font-black text-slate-900">{formatMoney(item.subtotal, item.currency)}</strong>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-950 px-4 py-3 text-white">
                    <span className="text-sm font-bold text-white/75">الإجمالي</span>
                    <strong className="text-lg font-black">{formatMoney(selectedOrder.total ?? selectedOrder.totalAmount, selectedOrder.currency)}</strong>
                  </div>
                </div>

                {selectedOrder.storePaymentDetails && (
                  <section className="mt-5 space-y-2 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                    <h3 className="text-sm font-extrabold text-slate-800">بيانات التحويل البنكي</h3>
                    <p className="text-xs text-slate-700"><b>البنك:</b> {selectedOrder.storePaymentDetails.bankName}</p>
                    <p className="text-xs text-slate-700"><b>صاحب الحساب:</b> {selectedOrder.storePaymentDetails.accountHolderName}</p>
                    <p className="text-xs text-slate-700"><b>رقم الحساب:</b> <span dir="ltr">{selectedOrder.storePaymentDetails.accountNumber}</span></p>
                    {selectedOrder.storePaymentDetails.receiptImage && (
                      <button
                        type="button"
                        onClick={() => setPreviewDoc(selectedOrder.storePaymentDetails.receiptImage)}
                        className="inline-flex min-h-10 items-center rounded-lg bg-white px-3 text-xs font-extrabold text-blue-800"
                      >
                        معاينة سند التحويل
                      </button>
                    )}
                  </section>
                )}

                {["new", "processing"].includes(selectedOrder.status) && (
                  <div className="mt-5 flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row">
                    {selectedOrder.status === "new" && (
                      <button type="button" disabled={updating} onClick={() => updateStatus("processing")} className="min-h-11 flex-1 rounded-xl bg-blue-700 px-4 text-sm font-extrabold text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50">
                        {updating ? "جارٍ التحديث…" : "بدء التجهيز"}
                      </button>
                    )}
                    {selectedOrder.status === "processing" && (
                      <button type="button" disabled={updating} onClick={() => updateStatus("completed")} className="min-h-11 flex-1 rounded-xl bg-emerald-700 px-4 text-sm font-extrabold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-50">
                        {updating ? "جارٍ التحديث…" : "إكمال الطلب"}
                      </button>
                    )}
                    <button type="button" disabled={updating} onClick={() => updateStatus("cancelled")} className="min-h-11 rounded-xl border border-rose-200 bg-white px-4 text-sm font-extrabold text-rose-700 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50">
                      إلغاء الطلب
                    </button>
                  </div>
                )}
              </section>
            ) : (
              <div className="hidden min-h-64 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500 lg:flex">
                اختر طلبًا لعرض تفاصيله.
              </div>
            )}
          </div>
        )}
      </section>
      <DocumentPreviewModal
        isOpen={Boolean(previewDoc)}
        src={previewUrl}
        onClose={() => setPreviewDoc("")}
        title="معاينة سند التحويل"
        contentType={protectedFileContentTypes[normalizeProtectedFilePath(previewDoc)]}
        loading={protectedFilesLoading}
        error={protectedFileErrors[normalizeProtectedFilePath(previewDoc)]}
      />
    </main>
  );
}
