import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";
import {
  CURRENCIES,
  convertCurrency,
  formatConvertedAmount,
  normalizeCurrencyCode
} from "../utils/currencyConversion.js";

export default function CurrencyCalculator({ amount = "", currency = "YER_ADEN" }) {
  const api = useApi();
  const [open, setOpen] = useState(false);
  const [inputAmount, setInputAmount] = useState(amount);
  const [fromCurrency, setFromCurrency] = useState(normalizeCurrencyCode(currency));
  const [toCurrency, setToCurrency] = useState(normalizeCurrencyCode(currency) === "USD" ? "SAR" : "USD");
  const [rates, setRates] = useState(null);
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    setInputAmount(amount ?? "");
  }, [amount]);

  useEffect(() => {
    const nextCurrency = normalizeCurrencyCode(currency);
    setFromCurrency(nextCurrency);
    setToCurrency(nextCurrency === "USD" ? "SAR" : "USD");
  }, [currency]);

  useEffect(() => {
    if (!open || rates) return;

    let active = true;
    setLoading(true);
    setError("");
    api.get("/admin/settings/public")
      .then((response) => {
        if (!active) return;
        const fetchedRates = response.data?.exchangeRatePairs;
        const validRates = fetchedRates && CURRENCIES.every(({ code }) => (
          code === "USD" || (
            Number.isFinite(Number(fetchedRates[code]?.buy)) &&
            Number(fetchedRates[code].buy) > 0 &&
            Number.isFinite(Number(fetchedRates[code]?.sell)) &&
            Number(fetchedRates[code].sell) > 0
          )
        ));
        if (!validRates) {
          setError("لم تُسجّل الإدارة سعري الشراء والبيع لجميع العملات بعد؛ لا يمكن عرض تحويل دقيق حالياً.");
          return;
        }
        setRates(fetchedRates);
        setRatesUpdatedAt(response.data?.exchangeRatesUpdatedAt || null);
      })
      .catch(() => {
        if (active) setError("تعذر تحميل أسعار الصرف. يرجى المحاولة مرة أخرى.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [api, open, rates, retryCount]);

  const convertedAmount = rates
    ? convertCurrency(inputAmount, fromCurrency, toCurrency, rates)
    : null;
  const formattedDate = ratesUpdatedAt
    ? new Date(ratesUpdatedAt).toLocaleString("ar-YE")
    : null;

  return (
    <section className="mt-3" dir="rtl">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-black text-blue-800 transition hover:bg-blue-100"
      >
        <span aria-hidden="true">⇄</span>
        {open ? "إخفاء حاسبة العملات" : "تحويل العملة"}
      </button>
      {open && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
          <h3 className="font-black text-slate-900">حاسبة تحويل العملات</h3>
          <p className="mt-1 text-xs font-medium text-slate-500">نتيجة تقديرية فقط؛ لا تغيّر سعر الإعلان أو مبلغ الدفع.</p>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2 sm:mt-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-3">
            <label className="col-span-3 min-w-0 space-y-1 text-xs font-bold text-slate-600 sm:col-span-1">
              <span>المبلغ</span>
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={inputAmount}
                onChange={(event) => setInputAmount(event.target.value)}
                className="min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-900"
                aria-label="المبلغ المراد تحويله"
              />
            </label>
            <label className="min-w-0 space-y-1 text-xs font-bold text-slate-600">
              <span>من عملة</span>
              <select
                value={fromCurrency}
                onChange={(event) => setFromCurrency(event.target.value)}
                className="min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-2 py-2.5 text-xs font-bold text-slate-800 sm:px-3"
                aria-label="العملة الأصلية"
              >
                {CURRENCIES.map(({ code, label }) => <option key={code} value={code}>{label}</option>)}
              </select>
            </label>
            <span className="pb-3 text-center text-lg font-black text-blue-600 sm:pb-2" aria-hidden="true">⇄</span>
            <label className="min-w-0 space-y-1 text-xs font-bold text-slate-600">
              <span>التحويل إلى</span>
              <select
                value={toCurrency}
                onChange={(event) => setToCurrency(event.target.value)}
                className="min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-2 py-2.5 text-xs font-bold text-slate-800 sm:px-3"
                aria-label="عملة النتيجة"
              >
                {CURRENCIES.map(({ code, label }) => <option key={code} value={code}>{label}</option>)}
              </select>
            </label>
          </div>
          {loading && <p className="mt-4 text-sm font-bold text-slate-500">جارٍ تحميل أسعار الصرف…</p>}
          {error && (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-bold text-red-700" role="alert">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => {
                  setRates(null);
                  setRetryCount((count) => count + 1);
                }}
                className="underline"
              >
                إعادة المحاولة
              </button>
            </div>
          )}
          {rates && (
            <div className="mt-3 rounded-xl border border-blue-100 bg-white p-3 sm:mt-4 sm:p-4">
              <p className="text-xs font-bold text-slate-500">المبلغ المحوّل تقديرياً</p>
              {convertedAmount === null ? (
                <p className="mt-2 text-base font-bold text-slate-600">أدخل مبلغاً صحيحاً</p>
              ) : (
                <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 break-words leading-relaxed" aria-live="polite">
                  <span className="text-2xl font-black tracking-tight text-blue-800 sm:text-3xl" dir="auto">
                    {formatConvertedAmount(convertedAmount, toCurrency)}
                  </span>
                  <span className="text-sm font-extrabold text-slate-700 sm:text-base">
                    {CURRENCIES.find((item) => item.code === toCurrency)?.label}
                  </span>
                </p>
              )}
              {formattedDate
                ? <p className="mt-2 text-[11px] font-medium text-slate-400">آخر تحديث لأسعار الصرف: {formattedDate}</p>
                : <p className="mt-2 text-[11px] font-medium text-amber-700">لم يُسجّل تاريخ تحديث للأسعار بعد.</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
