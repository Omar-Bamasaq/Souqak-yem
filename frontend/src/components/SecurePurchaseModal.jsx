import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../api/axios.js";
import { uploadsUrl } from "../lib/uploads.js";
import MobileSelect from "./MobileSelect.jsx";

export default function SecurePurchaseModal({ isOpen, onClose, ad }) {
  const [finalPrice, setFinalPrice] = useState(ad.price || 0);
  const [currency, setCurrency] = useState(ad.currency || "YER");
  const [shippingFee, setShippingFee] = useState(0);
  const [shippingCurrency, setShippingCurrency] = useState(ad.currency || "YER");
  const [shippingPayer, setShippingPayer] = useState("buyer");
  const [notes, setNotes] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const api = useApi();
  const navigate = useNavigate();

  const formatCurrency = (code) => {
    switch (code) {
      case "YER": return "ريال (صنعاء)";
      case "YER_ADEN": return "ريال (عدن)";
      case "SAR": return "ريال سعودي";
      case "USD": return "دولار";
      default: return code;
    }
  };

  if (!isOpen) return null;

  const buyerProtectionFee = Math.round(Number(finalPrice) * 0.03);
  const totalAmount = Number(finalPrice) + (shippingPayer === "buyer" ? Number(shippingFee) : 0) + buyerProtectionFee;

  const handleSubmit = async () => {
    if (!agreedTerms) {
      window.dispatchEvent(new CustomEvent("admin:toast", { 
        detail: { message: "يجب الموافقة على الشروط للمتابعة", type: "error" } 
      }));
      return;
    }

    try {
      setLoading(true);
      const res = await api.post("/orders", {
        adId: ad._id,
        finalPrice: Number(finalPrice),
        shippingFee: shippingPayer === "buyer" ? Number(shippingFee) : 0,
        shippingCurrency: shippingPayer === "buyer" ? shippingCurrency : currency,
        shippingPayer,
        notes,
        agreedTerms,
        currency
      });
      
      setSuccess(true);
      window.dispatchEvent(new CustomEvent("admin:toast", { 
        detail: { message: "تم إرسال طلب الشراء بنجاح", type: "success" } 
      }));
      
      setTimeout(() => {
        navigate(`/orders/${res.data._id}`);
        onClose();
      }, 1500);
    } catch (err) {
      window.dispatchEvent(new CustomEvent("admin:toast", { 
        detail: { message: err.response?.data?.error || "حدث خطأ أثناء إرسال الطلب", type: "error" } 
      }));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-sm p-10 text-center space-y-6 animate-in zoom-in-95 duration-300 shadow-2xl">
          <div className="h-24 w-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto text-green-500 animate-bounce">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-gray-900 dark:text-white">تم إرسال الطلب!</h3>
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400">سيتم توجيهك الآن إلى صفحة الطلب لمتابعة الخطوات مع البائع.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 rounded-t-[2rem] sm:rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">
        <div className="px-5 py-4 border-b dark:border-slate-800 flex items-start justify-between relative">
          <button onClick={onClose} className="absolute left-4 top-4 h-8 w-8 flex items-center justify-center rounded-full bg-gray-50 dark:bg-slate-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors z-10">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex-1 pl-10"> {/* Add padding left to avoid the button */}
            <h3 className="text-lg font-black text-gray-900 dark:text-white leading-none">طلب شراء آمن</h3>
            <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mt-1">وساطة منصة سوقك</p>
          </div>
          
          {/* Product Summary Mini Card */}
          <div className="flex items-center gap-2 bg-blue-50/80 dark:bg-blue-900/20 p-1.5 pr-2 rounded-xl border border-blue-100/50 dark:border-blue-800/30 shadow-sm animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="text-right flex flex-col justify-center">
              <span className="text-[9px] font-black text-blue-700 dark:text-blue-400 leading-none">{ad.price?.toLocaleString()}</span>
              <span className="text-[7px] font-bold text-blue-500/70 leading-none mt-0.5">{formatCurrency(ad.currency)}</span>
            </div>
            <div className="h-8 w-8 rounded-lg bg-white dark:bg-slate-800 overflow-hidden flex-shrink-0 border border-white dark:border-slate-700 shadow-sm">
              {ad.images?.[0] ? (
                <img 
                  src={uploadsUrl(ad.images[0])} 
                  alt="" 
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-gray-300">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4 max-h-[70vh] overflow-y-auto no-scrollbar">
          {/* Hidden Ad Title for screen readers or internal structure */}
          <div className="sr-only">
            <h4>{ad.title}</h4>
          </div>

          <div className="space-y-4">
            {/* Final Price & Currency Selection */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">السعر المتفق عليه</label>
                <input 
                  type="number" 
                  className="w-full rounded-xl border-2 border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
                  value={finalPrice}
                  onChange={(e) => setFinalPrice(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <MobileSelect
                  label="العملة"
                  value={currency}
                  onChange={(e) => {
                    const newCurr = e.target.value;
                    setCurrency(newCurr);
                    setShippingCurrency(newCurr);
                  }}
                  options={[
                    { value: "YER", label: "YER (صنعاء)" },
                    { value: "YER_ADEN", label: "YER (عدن)" },
                    { value: "SAR", label: "SAR (سعودي)" },
                    { value: "USD", label: "USD (دولار)" }
                  ]}
                  placeholder="اختر العملة"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 px-1">من يتحمل التوصيل؟</label>
              <div className="grid grid-cols-3 gap-2">
                {["buyer", "seller", "none"].map((type) => (
                  <button 
                    key={type}
                    onClick={() => {
                      setShippingPayer(type);
                      if (type === "none") setShippingFee(0);
                    }}
                    className={`py-2.5 rounded-xl text-[11px] font-black border-2 transition-all ${shippingPayer === type ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100" : "bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-800 text-gray-500"}`}
                  >
                    {type === "buyer" ? "المشتري" : type === "seller" ? "البائع" : "لا يوجد"}
                  </button>
                ))}
              </div>
            </div>

            {shippingPayer === "buyer" && (
              <div className="animate-in slide-in-from-top-2 duration-300 space-y-1.5">
                <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest px-1">رسوم التوصيل المتفق عليها</label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <input 
                      type="number" 
                      className="w-full rounded-xl border-2 border-blue-100 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-900/10 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white transition-all placeholder:text-blue-300"
                      value={shippingFee}
                      onChange={(e) => setShippingFee(e.target.value)}
                      placeholder="أدخل المبلغ..."
                    />
                  </div>
                  <div className="col-span-1">
                    <MobileSelect
                      value={shippingCurrency}
                      onChange={(e) => setShippingCurrency(e.target.value)}
                      options={[
                        { value: "YER", label: "ريال (صنعاء)" },
                        { value: "YER_ADEN", label: "ريال (عدن)" },
                        { value: "SAR", label: "سعودي" },
                        { value: "USD", label: "دولار" }
                      ]}
                      placeholder="العملة"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">ملاحظات إضافية</label>
              <textarea 
                className="w-full rounded-xl border-2 border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 px-4 py-3 text-xs font-medium outline-none focus:border-blue-500 focus:bg-white transition-all h-20 resize-none"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="اتفاقات خاصة..."
              />
            </div>

            {/* Price Summary */}
            <div className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-2xl border-2 border-gray-100 dark:border-slate-800 space-y-2.5">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-gray-500">السعر المتفق عليه</span>
                <span className="text-gray-900 dark:text-white">{Number(finalPrice)?.toLocaleString()} {formatCurrency(currency)}</span>
              </div>
              
              {shippingPayer !== "none" && Number(shippingFee) > 0 && (
                <div className="flex justify-between text-xs font-bold p-2 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 animate-in fade-in zoom-in duration-300">
                  <span className="text-gray-500">رسوم التوصيل ({shippingPayer === "buyer" ? "على المشتري" : "على البائع"})</span>
                  <span className="text-blue-600">{Number(shippingFee)?.toLocaleString()} {formatCurrency(shippingPayer === "buyer" ? shippingCurrency : currency)}</span>
                </div>
              )}

              <div className="flex justify-between text-xs font-bold">
                <span className="text-emerald-600">رسوم حماية المشتري (3%)</span>
                <span className="text-emerald-600">+{buyerProtectionFee?.toLocaleString()} {formatCurrency(currency)}</span>
              </div>

              <div className="border-t border-dashed border-gray-200 dark:border-slate-700 pt-3 flex justify-between items-center">
                <span className="text-sm font-black text-gray-900 dark:text-white">المبلغ الإجمالي</span>
                <div className="text-left">
                  <div className="text-lg font-black text-blue-600 leading-tight">
                    {currency === (shippingPayer === "buyer" ? shippingCurrency : currency) ? (
                      `${totalAmount.toLocaleString()} ${formatCurrency(currency)}`
                    ) : (
                      <div className="flex flex-col items-end">
                        <span className="text-lg">{(Number(finalPrice) + buyerProtectionFee).toLocaleString()} {formatCurrency(currency)}</span>
                        <span className="text-xs text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-md mt-1 font-black">
                          + {Number(shippingFee).toLocaleString()} {formatCurrency(shippingCurrency)} (توصيل)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Terms Checkbox */}
            <label className="flex items-start gap-3 p-3 rounded-xl bg-blue-50/30 dark:bg-blue-900/5 cursor-pointer group transition-colors">
              <input 
                type="checkbox" 
                className="mt-0.5 h-4 w-4 rounded border-2 border-blue-200 text-blue-600 focus:ring-0 cursor-pointer"
                checked={agreedTerms}
                onChange={(e) => setAgreedTerms(e.target.checked)}
              />
              <span className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight font-bold">
                أوافق على شروط الوساطة، وأتحمل مسؤولية صحة البيانات.
              </span>
            </label>
          </div>
        </div>

        <div className="p-4 border-t dark:border-slate-800 bg-gray-50 dark:bg-slate-800/30 pb-6 sm:pb-4">
          <button 
            onClick={handleSubmit}
            disabled={loading || !agreedTerms}
            className="w-full py-4 rounded-2xl bg-blue-600 text-white font-black text-base hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-100 active:scale-[0.98]"
          >
            {loading ? "جاري الإرسال..." : "تأكيد وإرسال الطلب"}
          </button>
        </div>
      </div>
    </div>
  );
}
