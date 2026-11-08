import React, { useEffect, useMemo, useState } from "react";
import { useApi } from "../api/axios.js";
import { getStoreCurrencyLabel, getStorePlanTypeLabel, getStoreStatusLabel } from "../utils/storeArabicLabels.js";

const STORE_STATUS_OPTIONS = [
  { value: "", label: "كل الحالات" },
  { value: "pending", label: "معلقة" },
  { value: "active", label: "نشطة" },
  { value: "suspended", label: "موقوفة" },
  { value: "rejected", label: "مرفوضة" },
  { value: "inactive", label: "غير نشطة" }
];

const SUBSCRIPTION_STATUS_OPTIONS = [
  { value: "", label: "كل حالات الاشتراك" },
  { value: "active", label: "نشط" },
  { value: "expired", label: "منتهي" },
  { value: "pending", label: "قيد الانتظار" },
  { value: "rejected", label: "مرفوض" },
  { value: "cancelled", label: "ملغى" },
  { value: "inactive", label: "بدون اشتراك" }
];

const STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  active: "bg-emerald-100 text-emerald-800 border-emerald-200",
  suspended: "bg-yellow-100 text-yellow-800 border-yellow-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
  inactive: "bg-slate-200 text-slate-700 border-slate-300",
  expired: "bg-orange-100 text-orange-800 border-orange-200",
  cancelled: "bg-gray-200 text-gray-700 border-gray-300"
};

const LABELS = {
  pending: "معلقة",
  active: "نشط",
  suspended: "موقوفة",
  rejected: "مرفوض",
  inactive: "غير نشط",
  expired: "منتهي",
  cancelled: "ملغى"
};

export default function AdminStoreDirectory() {
  const api = useApi();
  const [stores, setStores] = useState([]);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState({ store: null, subscriptions: [], requests: [], hasSubscriptions: false, hasRequests: false });
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState("");
  const [storeType, setStoreType] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1, hasNextPage: false, hasPrevPage: false });

  const load = async (nextPage = page) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(nextPage), limit: "20" });
      if (query) params.set("q", query);
      if (status) params.set("status", status);
      if (subscriptionStatus) params.set("subscriptionStatus", subscriptionStatus);
      if (storeType) params.set("storeType", storeType);

      const res = await api.get(`/admin/stores?${params.toString()}`);
      const nextStores = res.data?.stores || [];
      setStores(nextStores);
      setPagination(res.data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1, hasNextPage: false, hasPrevPage: false });
      if (nextStores.length) {
        const nextSelected = selected?._id ? nextStores.find((store) => store._id === selected._id) || nextStores[0] : nextStores[0];
        setSelected(nextSelected);
      } else {
        setSelected(null);
      }
      setError("");
    } catch (err) {
      setError(err?.response?.data?.error || "تعذر تحميل قائمة المتاجر.");
      setStores([]);
      setSelected(null);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (storeId) => {
    if (!storeId) {
      setHistory({ store: null, subscriptions: [], requests: [], hasSubscriptions: false, hasRequests: false });
      return;
    }

    try {
      setHistoryLoading(true);
      const res = await api.get(`/admin/stores/${storeId}/history`);
      setHistory(res.data || { store: null, subscriptions: [], requests: [], hasSubscriptions: false, hasRequests: false });
    } catch (err) {
      setHistory({ store: null, subscriptions: [], requests: [], hasSubscriptions: false, hasRequests: false });
      setError(err?.response?.data?.error || "تعذر تحميل سجل المتجر.");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    load(1);
  }, [query, status, subscriptionStatus, storeType]);

  useEffect(() => {
    if (page !== 1) load(page);
  }, [page]);

  useEffect(() => {
    if (selected?._id) {
      loadHistory(selected._id);
    } else {
      setHistory({ store: null, subscriptions: [], requests: [], hasSubscriptions: false, hasRequests: false });
    }
  }, [selected?._id]);

  const currentStore = useMemo(() => selected || stores[0] || null, [selected, stores]);

  const formatDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("ar-YE", { dateStyle: "medium" }).format(date);
  };

  return (
    <div className="space-y-5 p-3 sm:space-y-6 sm:p-4" dir="rtl">
      <div className="flex flex-col gap-4 rounded-3xl bg-gradient-to-l from-slate-950 via-indigo-950 to-blue-800 p-5 text-white shadow-lg sm:flex-row sm:items-end sm:justify-between sm:p-7">
        <div>
          <p className="text-xs font-black text-blue-200">نظرة شاملة على المتاجر</p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">قائمة المتاجر</h1>
          <p className="mt-2 text-sm leading-6 text-blue-100">ابحث عن المتجر، راجع الاشتراك، ثم افتح سجله وتفاصيله.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
            <p className="text-[11px] font-bold text-blue-100">نتائج البحث</p><p className="mt-1 text-xl font-black">{pagination.total}</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
            <p className="text-[11px] font-bold text-blue-100">الصفحة</p><p className="mt-1 text-xl font-black">{pagination.page} / {pagination.totalPages}</p>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>
      )}

      <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-3 text-sm font-black text-gray-800">تصفية القائمة</div>
        <div className="grid gap-3 md:grid-cols-5">
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-blue-500"
            placeholder="بحث باسم المتجر أو المالك"
          />

          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-blue-500"
          >
            {STORE_STATUS_OPTIONS.map((option) => (
              <option key={option.value || "all-status"} value={option.value}>{option.label}</option>
            ))}
          </select>

          <select
            value={subscriptionStatus}
            onChange={(e) => { setSubscriptionStatus(e.target.value); setPage(1); }}
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-blue-500"
          >
            {SUBSCRIPTION_STATUS_OPTIONS.map((option) => (
              <option key={option.value || "all-sub"} value={option.value}>{option.label}</option>
            ))}
          </select>

          <select value={storeType} onChange={(e) => { setStoreType(e.target.value); setPage(1); }} className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-blue-500">
            <option value="">كل أنواع المشاريع</option>
            <option value="store">المتاجر</option>
            <option value="family-production">صناعات سوقك</option>
          </select>

          <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
            <span>الإجمالي</span>
            <span className="font-black text-gray-900">{pagination.total}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.6fr)]">
        <div className="order-2 space-y-3 xl:order-1">
          {loading ? (
            <div className="rounded-3xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-600">جارٍ التحميل...</div>
          ) : stores.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">لا توجد متاجر مطابقة للفلاتر.</div>
          ) : (
            stores.map((store) => (
              <button
                key={store._id}
                type="button"
                onClick={() => {
                  setSelected(store);
                  if (!window.matchMedia("(min-width: 1280px)").matches) window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                aria-pressed={currentStore?._id === store._id}
                className={`w-full rounded-2xl border p-4 text-right shadow-sm transition ${currentStore?._id === store._id ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100" : "border-gray-200 bg-white hover:border-blue-300"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-black text-gray-900">{store.storeName || "مشروع بدون اسم"}</div>
                    <div className="mt-1 text-xs text-gray-500">{store.owner?.name || "—"}</div>
                    <div className="mt-1 text-[10px] font-black text-emerald-700">{store.storeType === "family-production" ? "صناعات سوقك" : "متجر"}</div>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${STATUS_COLORS[store.status] || "bg-slate-100 text-slate-700 border-slate-200"}`}>
                    {LABELS[store.status] || getStoreStatusLabel(store.status)}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-gray-600">
                  <div>اشتراك: <span className={`inline-block rounded-full border px-2 py-0.5 ${STATUS_COLORS[store.subscriptionStatus] || "bg-slate-100 text-slate-700 border-slate-200"}`}>{LABELS[store.subscriptionStatus] || getStoreStatusLabel(store.subscriptionStatus)}</span></div>
                  <div>الخطة: {store.plan?.name || "—"}</div>
                  <div>بدء: {formatDate(store.startDate)}</div>
                  <div>انتهاء: {formatDate(store.endDate)}</div>
                </div>
              </button>
            ))
          )}

          <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-3">
            <button
              type="button"
              disabled={!pagination.hasPrevPage || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-600 disabled:opacity-40"
            >
              السابق
            </button>
            <span className="text-sm text-gray-600">الصفحة {pagination.page} / {pagination.totalPages}</span>
            <button
              type="button"
              disabled={!pagination.hasNextPage || loading}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-600 disabled:opacity-40"
            >
              التالي
            </button>
          </div>
        </div>

        <div className="order-1 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 xl:order-2">
          {!currentStore ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm font-semibold text-gray-500">اختر متجرًا من القائمة لعرض التفاصيل.</div>
          ) : (
            <div className="space-y-5">
            <div className="flex flex-col justify-between gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-xl font-black text-gray-900">{currentStore.storeName}</h2>
                  <p className="mt-1 text-sm text-gray-500">{currentStore.owner?.email || "—"}</p>
                </div>
                <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${STATUS_COLORS[currentStore.status] || "bg-slate-100 text-slate-700 border-slate-200"}`}>
                  {LABELS[currentStore.status] || getStoreStatusLabel(currentStore.status)}
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-gray-50 p-3">
                  <div className="text-[10px] font-black text-gray-500">نوع المشروع</div>
                  <div className="mt-1 text-sm font-bold text-gray-900">{currentStore.storeType === "family-production" ? "صناعات سوقك" : "متجر"}</div>
                </div>
                <div className="rounded-2xl bg-gray-50 p-3">
                  <div className="text-[10px] font-black text-gray-500">المالك</div>
                  <div className="mt-1 text-sm font-bold text-gray-900">{currentStore.owner?.name || "—"}</div>
                </div>
                <div className="rounded-2xl bg-gray-50 p-3">
                  <div className="text-[10px] font-black text-gray-500">حالة الاشتراك</div>
                  <div className="mt-1 text-sm font-bold text-gray-900">{LABELS[currentStore.subscriptionStatus] || getStoreStatusLabel(currentStore.subscriptionStatus)}</div>
                </div>
                <div className="rounded-2xl bg-gray-50 p-3">
                  <div className="text-[10px] font-black text-gray-500">الخطة</div>
                  <div className="mt-1 text-sm font-bold text-gray-900">{currentStore.plan?.name || "—"}</div>
                </div>
                <div className="rounded-2xl bg-gray-50 p-3">
                  <div className="text-[10px] font-black text-gray-500">نوع الخطة</div>
                  <div className="mt-1 text-sm font-bold text-gray-900">{getStorePlanTypeLabel(currentStore.plan?.type)}</div>
                </div>
                <div className="rounded-2xl bg-gray-50 p-3">
                  <div className="text-[10px] font-black text-gray-500">تاريخ البداية</div>
                  <div className="mt-1 text-sm font-bold text-gray-900">{formatDate(currentStore.startDate)}</div>
                </div>
                <div className="rounded-2xl bg-gray-50 p-3">
                  <div className="text-[10px] font-black text-gray-500">تاريخ الانتهاء</div>
                  <div className="mt-1 text-sm font-bold text-gray-900">{formatDate(currentStore.endDate)}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                <div className="mb-2 font-black text-gray-900">النشاط</div>
                <div>{currentStore.businessActivity || "—"}</div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                <div className="mb-2 font-black text-gray-900">التصنيفات</div>
                <div>{(currentStore.selectedCategories || []).map((c) => c?.name || c).join("، ") || "—"}</div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-gray-900">سجل الاشتراكات</h3>
                  <span className="text-xs text-gray-500">{historyLoading ? "جارٍ التحميل..." : `${history.subscriptions.length} عنصر`}</span>
                </div>

                {!historyLoading && history.subscriptions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">لا توجد اشتراكات مسجلة لهذا المتجر.</div>
                ) : (
                  <div className="space-y-3">
                    {history.subscriptions.map((item) => (
                      <div key={item._id} className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-black text-gray-900">{item.plan?.name || "—"}</div>
                          <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${STATUS_COLORS[item.status] || "bg-slate-100 text-slate-700 border-slate-200"}`}>
                            {LABELS[item.status] || getStoreStatusLabel(item.status)}
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-gray-600">
                          <div>السعر: {item.price ?? "—"} {item.currency ? getStoreCurrencyLabel(item.currency) : ""}</div>
                          <div>العملة: {item.currency ? getStoreCurrencyLabel(item.currency) : "—"}</div>
                          <div>البداية: {formatDate(item.startDate)}</div>
                          <div>الانتهاء: {formatDate(item.endDate)}</div>
                        </div>
                        {item.purchaseRequestId && item.request ? (
                          <div className="mt-2 rounded-xl bg-white px-2 py-2 text-[11px] text-gray-600">
                            مرتبط بطلب شراء: <span className="font-bold text-gray-900">{getStoreStatusLabel(item.request.status)}</span>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2">
                  <h3 className="text-lg font-black text-gray-900">طلبات المتجر والتجديد</h3>
                  {!historyLoading && history.requests.length === 0 ? (
                    <div className="mt-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">لا توجد طلبات شراء أو تجديد مرتبطة بهذا المتجر.</div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {history.requests.map((request) => (
                        <div key={request._id} className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-black text-gray-900">{request.plan?.name || "—"}</div>
                            <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${STATUS_COLORS[request.status?.toLowerCase()] || "bg-slate-100 text-slate-700 border-slate-200"}`}>
                              {getStoreStatusLabel(request.status)}
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-gray-600">
                            <div>التاريخ: {formatDate(request.createdAt)}</div>
                            <div>المبلغ: {request.price ?? "—"} {request.currency ? getStoreCurrencyLabel(request.currency) : ""}</div>
                            <div>المدة: {request.duration ?? "—"} يوم</div>
                            <div>النوع: {getStorePlanTypeLabel(request.plan?.type)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
