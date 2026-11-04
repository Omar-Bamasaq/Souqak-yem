import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApi } from "../api/axios.js";
import { buildCartWhatsAppMessage, buildWhatsAppLink, getStoreWhatsAppContacts } from "../utils/whatsappOrdering.js";
import { getStoreCurrencyLabel } from "../utils/storeArabicLabels.js";
import CurrencyCalculator from "../components/CurrencyCalculator.jsx";
import { uploadsUrl } from "../lib/uploads.js";
import { StoreEmptyState } from "../components/StoreUi.jsx";
import { convertImageToWebp } from "../lib/imageCompression.js";

const EMPTY_CART = { items: [], subtotal: 0, total: 0, currency: null, bankAccounts: [] };

export default function StoreCart() {
  const api = useApi();
  const navigate = useNavigate();
  const [cart, setCart] = useState(EMPTY_CART);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdOrder, setCreatedOrder] = useState(null);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState("");
  const [paymentReceipt, setPaymentReceipt] = useState(null);
  const [processingReceipt, setProcessingReceipt] = useState(false);

  const bankCurrency = cart.currency?.startsWith("YER") ? "YER" : cart.currency;
  const matchingBankAccounts = (cart.bankAccounts || []).filter((account) => account.currency === bankCurrency);
  const selectedBankAccount = matchingBankAccounts.find((account) => String(account._id) === selectedBankAccountId);
  const hasBankAccounts = cart.ordersEnabled === true && (cart.bankAccounts || []).length > 0;
  const storeWhatsAppContacts = getStoreWhatsAppContacts(cart?.store || null);
  const whatsappOrderingEnabled = Boolean(cart?.whatsappOrderingEnabled === true && storeWhatsAppContacts.length);

  useEffect(() => {
    setSelectedBankAccountId(matchingBankAccounts.length === 1 ? String(matchingBankAccounts[0]._id) : "");
  }, [cart.storeProfileId, cart.currency]);

  const openWhatsAppOrder = (contact) => {
    if (!contact?.normalized || !cart?.store) return;
    const storeUrl = `${window.location.origin}/store/${cart.store.slug}`;
    const message = buildCartWhatsAppMessage({
      storeName: cart.store.storeName,
      items: cart.items,
      total: cart.total,
      currency: cart.currency,
      storeUrl
    });
    const link = buildWhatsAppLink(contact.normalized, message);
    if (link) window.open(link, "_blank", "noopener,noreferrer");
  };

  const loadCart = useCallback(async () => {
    setError("");
    try {
      const response = await api.get("/store-commerce/cart");
      setCart(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "تعذر تحميل السلة.");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  const updateQuantity = async (item, quantity) => {
    setError("");
    setPaymentReceipt(null);
    setSaving(true);
    try {
      if (quantity < 1) {
        await api.delete(`/store-commerce/cart/items/${item.productId}`);
      } else {
        await api.patch(`/store-commerce/cart/items/${item.productId}`, { quantity });
      }
      await loadCart();
    } catch (requestError) {
      setError(requestError.response?.data?.error || "تعذر تحديث السلة.");
    } finally {
      setSaving(false);
    }
  };

  const handleReceiptSelection = async (file) => {
    setPaymentReceipt(null);
    if (!file) return;
    setError("");
    setProcessingReceipt(true);
    try {
      setPaymentReceipt(await convertImageToWebp(file));
    } catch (conversionError) {
      console.error("Store payment receipt conversion failed:", conversionError);
      setError(conversionError.message || "تعذر تجهيز صورة سند الدفع.");
    } finally {
      setProcessingReceipt(false);
    }
  };

  const submitOrder = async () => {
    if (hasBankAccounts && !matchingBankAccounts.length) {
      setError("لا يوجد حساب بنكي للمتجر بعملة هذا الطلب. يرجى التواصل مع المتجر.");
      return;
    }
    if (hasBankAccounts && !matchingBankAccounts.some((account) => String(account._id) === selectedBankAccountId)) {
      setError("اختر الحساب البنكي الذي حولت إليه.");
      return;
    }
    if (hasBankAccounts && !paymentReceipt) {
      setError("ارفع صورة سند التحويل قبل إرسال الطلب.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const formData = new FormData();
      if (selectedBankAccountId) formData.append("bankAccountId", selectedBankAccountId);
      if (paymentReceipt) formData.append("paymentReceipt", paymentReceipt);
      const response = await api.post("/store-commerce/checkout", formData);
      setCreatedOrder(response.data);
      setCart(EMPTY_CART);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "تعذر إرسال الطلب.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-6" dir="rtl" aria-busy="true">
      <div className="ds-skeleton h-24 rounded-3xl" />
      <div className="ds-skeleton h-40 rounded-2xl" />
      <div className="ds-skeleton h-40 rounded-2xl" />
    </main>
  );

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-5 pb-24 sm:space-y-6 sm:px-6 sm:py-8" dir="rtl">
      <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div>
          <p className="text-xs font-extrabold text-blue-700">قائمة مشترياتك</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">سلة المتجر</h1>
          <p className="mt-2 text-sm text-slate-500">{cart.items.length ? `${cart.items.length.toLocaleString("ar-EG")} منتجات` : "راجع المنتجات قبل إرسال الطلب"}</p>
        </div>
        <Link to="/" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">متابعة التسوق</Link>
      </header>

      {error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">{error}</div>}
      {createdOrder && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6" role="status">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800" aria-hidden="true">✓</span>
            <div>
              <h2 className="text-lg font-black text-emerald-950">تم إرسال طلبك بنجاح</h2>
              <p className="mt-2 text-sm text-emerald-800">رقم الطلب: <b dir="ltr">{createdOrder._id}</b></p>
              <p className="mt-1 text-sm text-emerald-800">الحالة: جديد · الإجمالي: {createdOrder.total?.toLocaleString("ar-EG")} {getStoreCurrencyLabel(createdOrder.currency)}</p>
            </div>
          </div>
        </section>
      )}

      {cart.items.length === 0 ? (
        !createdOrder && <StoreEmptyState
          title="سلتك فارغة حاليًا"
          description="تصفّح المتاجر وأضف المنتجات التي ترغب بها، وستظهر هنا لمراجعتها قبل الطلب."
          action={<Link to="/" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-extrabold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">اكتشف المنتجات</Link>}
        />
      ) : (
        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <ul className="min-w-0 space-y-3">
            {cart.items.map((item) => (
              <li key={item.productId} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                <div className="flex min-w-0 gap-3 sm:gap-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-24 sm:w-24">
                    {item.images?.[0]
                      ? <img src={uploadsUrl(item.images[0])} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
                      : <div className="flex h-full items-center justify-center text-slate-400" aria-hidden="true">◇</div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words text-sm font-black text-slate-950 sm:text-base">{item.title}</h2>
                    {item.discountEnabled === true && (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-rose-50 px-2 py-1 text-[11px] font-extrabold text-rose-800">
                          خصم {item.discountType === "fixed"
                            ? `${Number(item.discountValue).toLocaleString("ar-EG")} ${getStoreCurrencyLabel(item.currency)}`
                            : `${item.discountValue}%`}
                        </span>
                        <span className="text-xs text-slate-400 line-through">{item.originalPrice.toLocaleString("ar-EG")} {getStoreCurrencyLabel(item.currency)}</span>
                      </div>
                    )}
                    <p className={`mt-2 text-sm font-extrabold ${item.discountEnabled === true ? "text-rose-700" : "text-slate-600"}`}>{item.price.toLocaleString("ar-EG")} {getStoreCurrencyLabel(item.currency)} <span className="text-xs font-semibold text-slate-500">للوحدة</span></p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.isAvailableForDelivery === true && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">متاح للتوصيل</span>}
                      {item.inventoryEnabled === true && <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${item.stockQuantity === 0 ? "bg-rose-50 text-rose-800" : "bg-slate-100 text-slate-600"}`}>
                        {item.stockQuantity === 0 ? "نفد المخزون" : `المتوفر: ${item.stockQuantity}`}
                      </span>}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  <div className="inline-flex items-center gap-2" aria-label={`الكمية ${item.quantity}`}>
                    <button type="button" aria-label={`تقليل كمية ${item.title}`} disabled={saving} onClick={() => updateQuantity(item, item.quantity - 1)} className="h-11 w-11 rounded-xl border border-slate-200 bg-white text-lg font-black text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50">−</button>
                    <span className="min-w-8 text-center text-sm font-black text-slate-900">{Number(item.quantity).toLocaleString("ar-EG")}</span>
                    <button type="button" aria-label={`زيادة كمية ${item.title}`} disabled={saving || (item.inventoryEnabled === true && item.quantity >= item.stockQuantity)} onClick={() => updateQuantity(item, item.quantity + 1)} className="h-11 w-11 rounded-xl border border-slate-200 bg-white text-lg font-black text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50">+</button>
                    <button type="button" disabled={saving} onClick={() => updateQuantity(item, 0)} className="mr-2 inline-flex min-h-11 items-center rounded-xl px-3 text-xs font-extrabold text-rose-700 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50">حذف</button>
                  </div>
                  <div className="text-left">
                    <p className="text-[11px] font-semibold text-slate-500">المجموع</p>
                    <strong className="text-sm font-black text-slate-950">{Number(item.subtotal).toLocaleString("ar-EG")} {getStoreCurrencyLabel(item.currency)}</strong>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <aside className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-24 sm:p-5">
            <div>
              <h2 className="text-base font-black text-slate-950">ملخص الطلب</h2>
              <p className="mt-1 text-xs text-slate-500">تُراجع الأسعار والمخزون مرة أخرى عند إرسال الطلب.</p>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
              <span className="font-bold text-slate-600">عدد المنتجات</span>
              <strong className="text-slate-900">{cart.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0).toLocaleString("ar-EG")}</strong>
            </div>
            <div className="flex items-end justify-between gap-2 border-t border-slate-100 pt-4">
              <span className="text-sm font-bold text-slate-600">الإجمالي</span>
              <strong className="text-lg font-black text-slate-950">{Number(cart.total).toLocaleString("ar-EG")} <span className="text-xs">{getStoreCurrencyLabel(cart.currency)}</span></strong>
            </div>
            <CurrencyCalculator amount={cart.total} currency={cart.currency} />
            {hasBankAccounts && (
              <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3" aria-label="بيانات التحويل البنكي">
                <div>
                  <h3 className="text-sm font-black text-slate-900">الدفع إلى حساب المتجر</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600">حوّل إجمالي الطلب إلى أحد الحسابات المطابقة للعملة، ثم ارفع صورة السند لإرسال الطلب.</p>
                </div>
                {!matchingBankAccounts.length ? (
                  <p role="alert" className="rounded-lg bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-900">لا يوجد حساب بنكي بعملة الطلب ({getStoreCurrencyLabel(cart.currency)}). يرجى التواصل مع المتجر.</p>
                ) : (
                  <>
                    <label className="block text-xs font-bold text-slate-700">
                      الحساب البنكي
                      <select
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"
                        value={selectedBankAccountId}
                        onChange={(event) => {
                          setSelectedBankAccountId(event.target.value);
                          setPaymentReceipt(null);
                        }}
                      >
                        <option value="">اختر الحساب الذي حولت إليه</option>
                        {matchingBankAccounts.map((account) => (
                          <option key={account._id} value={account._id}>
                            {account.bankName} · {account.accountNumber} · {getStoreCurrencyLabel(account.currency)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {selectedBankAccount && (
                      <div className="rounded-lg bg-white p-3 text-xs leading-5 text-slate-700">
                        <p><span className="font-bold">البنك:</span> {selectedBankAccount.bankName}</p>
                        <p><span className="font-bold">صاحب الحساب:</span> {selectedBankAccount.accountHolderName}</p>
                        <p><span className="font-bold">رقم الحساب:</span> <b dir="ltr">{selectedBankAccount.accountNumber}</b></p>
                        <p><span className="font-bold">العملة:</span> {getStoreCurrencyLabel(selectedBankAccount.currency)}</p>
                      </div>
                    )}
                    <label className="block text-xs font-bold text-slate-700">
                      سند التحويل (صورة)
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={!selectedBankAccountId || processingReceipt || saving}
                        onChange={(event) => {
                          void handleReceiptSelection(event.target.files?.[0] || null);
                          event.target.value = "";
                        }}
                        className="mt-1.5 block w-full rounded-xl border border-dashed border-slate-300 bg-white p-2 text-xs file:ml-2 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-xs file:font-bold file:text-blue-800"
                      />
                    </label>
                    {processingReceipt && <p className="text-xs font-bold text-blue-700">جارٍ تحويل الصورة إلى WebP...</p>}
                    {paymentReceipt && <p className="text-xs font-bold text-emerald-700">تم تجهيز السند بصيغة WebP: {paymentReceipt.name}</p>}
                  </>
                )}
              </section>
            )}
            {cart.ordersEnabled
              ? <button type="button" disabled={saving || processingReceipt || (hasBankAccounts && !matchingBankAccounts.length)} onClick={submitOrder} className="min-h-12 w-full rounded-xl bg-blue-700 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50">{saving ? "جارٍ إرسال الطلب…" : "إرسال الطلب"}</button>
              : <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold leading-6 text-amber-900">استقبال الطلبات غير مفعّل في خطة هذا المتجر حاليًا.</p>}
            {whatsappOrderingEnabled && (
              <div className="space-y-2 border-t border-slate-100 pt-4">
                {storeWhatsAppContacts.map((contact, index) => (
                  <button key={`${contact.normalized}-${index}`} type="button" onClick={() => openWhatsAppOrder(contact)} className="flex min-h-11 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-extrabold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
                    اطلب عبر واتساب{storeWhatsAppContacts.length > 1 ? ` ${index + 1}` : ""}
                  </button>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
