import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";
import { useLocation, Link, useNavigate } from "react-router-dom";
import BankAccountsDisplay from "../components/BankAccountsDisplay.jsx";

function useQuery() {
  const { search } = useLocation();
  return React.useMemo(() => new URLSearchParams(search), [search]);
}

const CURRENCY_MAP = {
  YER_ADEN: { label: "ريال (عدن)", flag: "🇾🇪" },
  YER_SANAA: { label: "ريال (صنعاء)", flag: "🇾🇪" },
  SAR: { label: "ريال سعودي", flag: "🇸🇦" },
  USD: { label: "دولار", flag: "🇺🇸" },
  YER: { label: "ريال يمني", flag: "🇾🇪" }
};

export default function CommissionPay() {
  const api = useApi();
  const q = useQuery();
  const navigate = useNavigate();
  const [name, setName] = useState(q.get("name") || "");
  const [phone, setPhone] = useState(q.get("phone") || "");
  const [salePrice, setSalePrice] = useState(String(q.get("salePrice") || ""));
  const [currency, setCurrency] = useState(q.get("currency") || "YER_ADEN");
  const [adId] = useState(q.get("adId") || "");
  const [adData, setAdData] = useState(null);
  const [banks, setBanks] = useState([]);
  const [receipt, setReceipt] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    // Fetch Ad Data if adId is provided
    if (adId) {
      api.get(`/ads/${adId}/seller-view`)
        .then(res => {
          if (res.data) {
            setAdData(res.data);
            if (!salePrice && res.data.price) {
              setSalePrice(String(res.data.price));
            }
            if (!q.get("currency") && res.data.currency) {
              setCurrency(res.data.currency);
            } else if (res.data.currency) {
              setCurrency(res.data.currency);
            }
          }
        })
        .catch(err => {
          console.error("Ad fetch failed:", err);
          setErr("تعذر جلب بيانات الإعلان. تأكد من أن الإعلان متاح.");
        });
    }

    // Fetch Banks
    api.get("/bank-accounts")
      .then(res => setBanks(res.data || []))
      .catch(e => {
        console.error("Banks load failed:", e?.response?.status, e?.message);
        setBanks([]);
        setErr(e?.response?.data?.error || "تعذر تحميل الحسابات البنكية");
      });
  }, [api, adId]);

  const commission = Math.round(Number(salePrice || 0) * 0.01);

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (!name || !phone || !salePrice) {
      setErr("يرجى تعبئة الاسم ورقم الهاتف وسعر البيع");
      return;
    }
    if (!receipt) {
      setErr("يجب رفع صورة سند الدفع");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("name", name);
      fd.append("phone", phone);
      fd.append("salePrice", String(salePrice));
      fd.append("currency", currency);
      fd.append("commissionAmount", String(commission));
      if (adId) fd.append("adId", adId);
      fd.append("paymentReceipt", receipt);
      
      const r = await api.post("/commissions", fd);
      if (r.data?._id) {
        window.dispatchEvent(new CustomEvent("app:toast", { 
          detail: { message: "تم إرسال طلب دفع العمولة بنجاح. سيتم مراجعة الطلب من قبل الإدارة.", type: "success" } 
        }));
        
        // الانتقال لصفحة سجل العمولات بعد وقت قصير
        setTimeout(() => {
          navigate("/seller/commissions");
        }, 2000);
      } else {
        setErr("تعذر الإرسال، يرجى المحاولة مرة أخرى.");
      }
    } catch (error) {
      setErr(error.response?.data?.error || "تعذر إرسال الطلب.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-4 sm:space-y-6 px-2 sm:px-0">
      <div className="bg-white rounded-3xl sm:rounded-[2.5rem] border border-gray-100 p-4 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600">
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            دفع عمولة الموقع
          </h2>
          <Link 
            to="/seller/commissions" 
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gray-50 text-gray-700 px-4 py-3 rounded-xl sm:rounded-2xl text-xs font-black hover:bg-gray-100 transition-all border border-gray-100"
          >
            <svg className="w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01m-.01 4h.01" /></svg>
            سجل العمولات
          </Link>
        </div>

        {msg && <div className="rounded-2xl bg-green-50 px-4 py-3 text-sm font-bold text-green-700 border border-green-100 mb-6">{msg}</div>}
        {err && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600 border border-red-100 mb-6">{err}</div>}

        {/* Ad Info Section */}
        {adData && (
          <div className="bg-gray-50/50 rounded-2xl sm:rounded-3xl p-3 sm:p-4 mb-6 flex gap-3 sm:gap-4 border border-gray-100">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl overflow-hidden bg-white border border-gray-100 flex-shrink-0">
              {adData.images?.[0] ? (
                <img src={`http://localhost:5000/uploads/${adData.images[0]}`} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
              )}
            </div>
            <div className="min-w-0 flex flex-col justify-center">
              <label className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase block mb-0.5 sm:mb-1">بيانات الإعلان</label>
              <h3 className="font-bold text-gray-900 text-xs sm:text-sm line-clamp-2 leading-tight">{adData.title}</h3>
              <p className="text-[10px] sm:text-xs text-brand-600 font-black mt-1">المبلغ المطلوب دفع عمولته</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-gray-500 mr-2">الاسم الكامل</label>
              <input 
                className="w-full rounded-xl sm:rounded-2xl border-gray-200 bg-gray-50/50 focus:ring-brand-500 focus:border-brand-500 font-bold p-3 sm:p-3.5 text-sm sm:text-base" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="أدخل اسمك"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-black text-gray-500 mr-2">رقم الهاتف</label>
              <input 
                className="w-full rounded-xl sm:rounded-2xl border-gray-200 bg-gray-50/50 focus:ring-brand-500 focus:border-brand-500 font-bold p-3 sm:p-3.5 text-sm sm:text-base" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                placeholder="07xxxxxxxx"
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-gray-500 mr-2">سعر البيع الفعلي</label>
              <input
                className="w-full rounded-xl sm:rounded-2xl border-gray-200 bg-gray-50/50 focus:ring-brand-500 focus:border-brand-500 font-black p-3 sm:p-3.5 text-sm sm:text-base text-blue-600"
                type="text"
                inputMode="numeric"
                value={salePrice}
                onChange={(e) => setSalePrice((e.target.value || '').replace(/\D/g, ''))}
                placeholder="أدخل سعر البيع"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-black text-gray-500 mr-2">العملة</label>
              <select
                className="w-full rounded-xl sm:rounded-2xl border-gray-200 bg-gray-50/50 focus:ring-brand-500 focus:border-brand-500 font-bold p-3 sm:p-3.5 text-sm sm:text-base appearance-none"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="YER_ADEN">ريال يمني (عدن)</option>
                <option value="YER_SANAA">ريال يمني (صنعاء)</option>
                <option value="SAR">ريال سعودي</option>
                <option value="USD">دولار</option>
              </select>
            </div>
          </div>

          <div className="bg-brand-50 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-brand-100 flex justify-between items-center">
            <div>
              <p className="text-[9px] sm:text-[10px] font-black text-brand-400 uppercase">العمولة المستحقة (1%)</p>
              <p className="text-lg sm:text-xl font-black text-brand-700">
                {commission.toLocaleString()} {currency === "USD" ? "$" : currency === "SAR" ? "ر.س" : currency === "YER_SANAA" ? "ر.ي (صنعاء)" : "ر.ي (عدن)"}
              </p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-brand-100 flex items-center justify-center text-brand-600">
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-gray-500 mr-2">سند الدفع (صورة)</label>
              <div className="relative">
                <input 
                  type="file" 
                  id="receipt"
                  className="hidden" 
                  accept=".jpg,.jpeg,.png,.pdf" 
                  onChange={(e) => setReceipt(e.target.files?.[0] || null)} 
                />
                <label 
                  htmlFor="receipt"
                  className="w-full flex flex-col sm:flex-row items-center justify-center gap-2 rounded-xl sm:rounded-2xl border-2 border-dashed border-gray-200 p-6 sm:p-4 hover:border-brand-500 hover:bg-brand-50 transition-all cursor-pointer font-bold text-gray-400 text-center"
                >
                  <svg className="w-6 h-6 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <span className="text-sm sm:text-base break-all px-2">
                    {receipt ? receipt.name : "رفع صورة السند"}
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Bank Accounts Section - MOBILE OPTIMIZED UI */}
        <div className="mt-8 pt-6 sm:pt-8 border-t border-gray-100">
          <h3 className="text-xs sm:text-sm font-black text-gray-900 mb-4 sm:mb-6 flex items-center gap-2">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            الحسابات البنكية المعتمدة
          </h3>
          
          <BankAccountsDisplay banks={banks} />
        </div>

        <button 
          disabled={loading} 
          type="submit" 
          className="mt-8 w-full bg-brand-600 text-white font-black py-4 rounded-xl sm:rounded-2xl hover:bg-brand-700 transition-all shadow-xl shadow-brand-600/20 active:scale-[0.98] disabled:opacity-50 text-sm sm:text-base"
        >
          {loading ? "جاري الإرسال..." : "إرسال طلب دفع العمولة"}
        </button>
      </div>
    </form>
  );
}
