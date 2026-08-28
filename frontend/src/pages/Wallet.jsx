import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import OrdersList from "../components/OrdersList.jsx";
import MobileSelect from "../components/MobileSelect.jsx";

const MINIMUM_WITHDRAWAL_BY_CURRENCY = {
  YER: 1000,
  YER_ADEN: 1000,
  YER_SANAA: 1000,
  SAR: 2.5,
  USD: 0.75
};

export default function Wallet() {
  const api = useApi();
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview"); // 'overview', 'buyer_orders', 'seller_orders', 'transactions'

  // Withdrawal State
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawCurrency, setWithdrawCurrency] = useState("");
  const [receiptType, setReceiptType] = useState("bank_account"); // 'bank_account' or 'exchange_transfer'
  const [accountCurrency, setAccountCurrency] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [banks, setBanks] = useState([]);
  const [userBankAccounts, setUserBankAccounts] = useState([]);
  const [selectedUserAccountId, setSelectedUserAccountId] = useState("");
  const [governorates, setGovernorates] = useState([]);
  const [cities, setCities] = useState([]);
  const [selectedGovId, setSelectedGovId] = useState("");
  const [selectedCityId, setSelectedCityId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otherBankName, setOtherBankName] = useState("");
  const [identityImage, setIdentityImage] = useState(null);
  const [systemSettings, setSystemSettings] = useState(null);
  const [showAddAccountForm, setShowAddAccountForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [wRes, tRes, bRes, ubRes, govRes, settingsRes] = await Promise.all([
        api.get("/wallets/me"),
        api.get("/wallets/transactions"),
        api.get("/bank-accounts"),
        api.get("/user-bank-accounts"),
        api.get("/governorates?active=true"),
        api.get("/admin/settings/public").catch(() => ({ data: null })) // Public settings
      ]);
      setWallet(wRes.data);
      setTransactions(tRes.data);
      setBanks(bRes.data || []);
      setUserBankAccounts(ubRes.data || []);
      setGovernorates(govRes.data || []);
      setSystemSettings(settingsRes.data);
      
      if (wRes.data?.balances?.length > 0) {
        const firstBalance = wRes.data.balances[0];
        setWithdrawCurrency(firstBalance.currency);
        setAccountCurrency(firstBalance.currency); // Default match
        setWithdrawAmount(firstBalance.availableBalance);
      }
    } catch (err) {
      console.error("Load wallet error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (wallet?.balances && withdrawCurrency) {
      const balanceObj = wallet.balances.find(b => b.currency === withdrawCurrency);
      if (balanceObj) {
        setWithdrawAmount(balanceObj.availableBalance);
      }
    }
  }, [withdrawCurrency, wallet]);

  useEffect(() => {
    if (selectedGovId) {
      api.get(`/cities?governorateId=${selectedGovId}&active=true`)
        .then(res => setCities(res.data || []))
        .catch(err => console.error(err));
    } else {
      setCities([]);
    }
  }, [selectedGovId]);

  const handleAddUserAccount = async () => {
    if (!bankName || !accountName || !accountNumber || !accountCurrency) {
      return alert("يرجى إكمال كافة بيانات الحساب");
    }
    try {
      setSubmitting(true);
      const res = await api.post("/user-bank-accounts", {
        bankName, accountName, accountNumber, accountCurrency
      });
      setUserBankAccounts([res.data, ...userBankAccounts]);
      setSelectedUserAccountId(res.data._id);
      setShowAddAccountForm(false);
      // Reset form
      setAccountNumber("");
    } catch (err) {
      alert(err.response?.data?.error || "فشل إضافة الحساب");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || !withdrawCurrency) {
      return alert("يرجى إدخال المبلغ والعملة");
    }

    // Identity check logic
    const thresholdUsd = systemSettings?.withdrawalIdentityThresholdUsd || 250;
    const rates = systemSettings?.exchangeRates || { USD: 1, SAR: 3.75, YER: 530, YER_ADEN: 1600 };
    const rate = rates[withdrawCurrency] || 1;
    const amountInUsd = Number(withdrawAmount) / rate;
    const needsIdentity = amountInUsd >= thresholdUsd;

    if (needsIdentity && !identityImage) {
      return alert("بسبب قيمة المبلغ، نحتاج التحقق من هويتك لإتمام عملية السحب. يرجى إرفاق صورة الهوية.");
    }

    const formData = new FormData();
    formData.append("amount", withdrawAmount);
    formData.append("currency", withdrawCurrency);
    formData.append("receiptType", receiptType);

    if (receiptType === "bank_account") {
      if (!selectedUserAccountId) return alert("يرجى اختيار حساب بنكي أو إضافة حساب جديد");
      const acc = userBankAccounts.find(a => a._id === selectedUserAccountId);
      formData.append("bankName", acc.bankName);
      formData.append("accountName", acc.accountName);
      formData.append("accountNumber", acc.accountNumber);
      formData.append("accountCurrency", acc.accountCurrency);
      // For bank accounts, we can use a placeholder or empty string for phoneNumber if not needed
      formData.append("phoneNumber", "N/A");
    } else {
      if (!bankName || !accountName || !selectedGovId || !selectedCityId || !phoneNumber) {
        return alert("يرجى إكمال كافة بيانات الحوالة والموقع ورقم الهاتف");
      }
      if (bankName === "other" && !otherBankName) {
        return alert("يرجى كتابة اسم الصرافة");
      }
      formData.append("bankName", bankName === "other" ? otherBankName : bankName);
      formData.append("accountName", accountName);
      formData.append("governorateId", selectedGovId);
      formData.append("cityId", selectedCityId);
      formData.append("accountNumber", "N/A");
      formData.append("accountCurrency", withdrawCurrency);
      formData.append("phoneNumber", phoneNumber);
    }
    
    if (identityImage) {
      formData.append("identityImage", identityImage);
    }
    
    const balanceObj = wallet.balances.find(b => b.currency === withdrawCurrency);
    if (!balanceObj || Number(withdrawAmount) > balanceObj.availableBalance) {
      return alert("المبلغ يتجاوز الرصيد المتاح لهذه العملة");
    }
    
    const minimumWithdrawal = MINIMUM_WITHDRAWAL_BY_CURRENCY[withdrawCurrency];
    if (minimumWithdrawal !== undefined && Number(withdrawAmount) < minimumWithdrawal) {
      return alert(`الحد الأدنى للسحب هو ${minimumWithdrawal.toLocaleString()} ${formatCurrency(withdrawCurrency)}`);
    }

    try {
      setSubmitting(true);
      await api.post("/wallets/withdraw", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      alert("تم إرسال طلب السحب بنجاح. سيتم التحقق منه خلال 24 ساعة.");
      setShowWithdrawModal(false);
      setWithdrawAmount("");
      setIdentityImage(null);
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || "حدث خطأ أثناء السحب");
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (currency) => {
    const map = {
      "YER": "ريال (صنعاء)",
      "YER_ADEN": "ريال (عدن)",
      "SAR": "ريال سعودي",
      "USD": "دولار أمريكي"
    };
    return map[currency] || currency;
  };

  if (loading) return <div className="py-20 flex justify-center"><LoadingSpinner size="lg" /></div>;

  const totalBalances = wallet?.balances || [];
  
  // Identity threshold logic for UI
  const thresholdUsd = systemSettings?.withdrawalIdentityThresholdUsd || 250;
  const rates = systemSettings?.exchangeRates || { USD: 1, SAR: 3.75, YER: 530, YER_ADEN: 1600 };
  const rate = rates[withdrawCurrency] || 1;
  const amountInUsd = Number(withdrawAmount) / rate;
  const needsIdentity = amountInUsd >= thresholdUsd;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-12 space-y-6 sm:space-y-12">
      {/* Wallet Summary Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">محفظتي المالية</h2>
          <button 
            onClick={() => {
              if (totalBalances.some(b => b.availableBalance >= (MINIMUM_WITHDRAWAL_BY_CURRENCY[b.currency] || Infinity))) {
                setShowWithdrawModal(true);
              } else {
                alert("لا يوجد رصيد كافٍ للسحب حسب الحد الأدنى لكل عملة");
              }
            }}
            className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none"
          >
            سحب الأرباح الآن
          </button>
        </div>

        {totalBalances.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 p-12 rounded-[2.5rem] border-2 border-gray-50 dark:border-slate-800 text-center space-y-4 shadow-sm">
             <div className="w-20 h-20 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-4xl">💰</div>
             <p className="text-gray-500 font-bold">لا توجد أرصدة حالية في محفظتك.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {totalBalances.map((b, idx) => (
              <div key={idx} className="space-y-4">
                {/* Available Balance Card for each currency */}
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 sm:p-8 rounded-[2rem] text-white shadow-xl relative overflow-hidden group">
                  <div className="absolute -right-10 -top-10 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
                  
                  <div className="relative z-10 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[8px] font-black uppercase tracking-[0.3em] text-blue-100/80">الرصيد المتاح</span>
                        <h3 className="text-xs font-bold text-white">{formatCurrency(b.currency)}</h3>
                      </div>
                      <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-xl flex items-center justify-center">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    
                    <div className="space-y-0.5">
                      <div className="flex items-baseline gap-2">
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tighter">{b.availableBalance?.toLocaleString()}</h2>
                        <span className="text-base font-black text-blue-200">{b.currency}</span>
                      </div>
                      <p className="text-[9px] font-bold text-blue-100/60 uppercase tracking-widest">قابل للسحب فوراً</p>
                    </div>
                  </div>
                </div>

                {/* Pending Balance Card for each currency */}
                <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-[2rem] border-2 border-gray-50 dark:border-slate-800 shadow-sm space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl -ml-12 -mt-12"></div>
                  
                  <div className="flex items-center justify-between relative z-10">
                    <div className="space-y-0.5">
                      <span className="text-[8px] font-black uppercase tracking-[0.3em] text-gray-400">الرصيد المعلق</span>
                      <h3 className="text-xs font-bold text-gray-600 dark:text-gray-300">{formatCurrency(b.currency)}</h3>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-500">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>

                  <div className="space-y-0.5 relative z-10">
                    <div className="flex items-baseline gap-2">
                      <h2 className="text-3xl sm:text-4xl font-black tracking-tighter text-gray-900 dark:text-white">
                        {b.pendingBalance?.toLocaleString()}
                      </h2>
                      <span className="text-base font-black text-gray-400">{b.currency}</span>
                    </div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">بانتظار تأكيد الاستلام</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs Navigation - Improved for Mobile */}
      <div className="sticky top-2 z-30 p-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[1.5rem] sm:rounded-[2rem] border-2 border-gray-50 dark:border-slate-800 shadow-lg flex items-center gap-1 overflow-x-auto no-scrollbar">
        {[
          { id: "overview", label: "الرئيسية", icon: "💎" },
          { id: "buyer_orders", label: "مشترياتي", icon: "📦" },
          { id: "seller_orders", label: "مبيعاتي", icon: "💰" },
          { id: "transactions", label: "السجل", icon: "📜" }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black transition-all whitespace-nowrap flex-1 ${
              activeTab === tab.id 
                ? "bg-blue-600 text-white shadow-xl shadow-blue-200 dark:shadow-none" 
                : "text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800"
            }`}
          >
            <span className="text-sm sm:text-base">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[500px] animate-in fade-in slide-in-from-bottom-6 duration-700">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xl font-black text-gray-900 dark:text-white">آخر العمليات المالية</h3>
                <button onClick={() => setActiveTab('transactions')} className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">عرض الكل</button>
              </div>
              <div className="space-y-3">
                {transactions.slice(0, 6).map((t) => (
                  <div key={t._id} className="flex items-start justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border-2 border-gray-50 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-all group shadow-sm">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center text-lg sm:text-xl shrink-0 transition-transform group-hover:scale-110 ${
                        t.type === 'PAYMENT' ? 'bg-blue-50 text-blue-500' :
                        t.type === 'RELEASE' ? 'bg-emerald-50 text-emerald-500' :
                        t.type === 'WITHDRAWAL' ? 'bg-red-50 text-red-500' :
                        t.type === 'WITHDRAW_FEE' ? 'bg-orange-50 text-orange-500' :
                        'bg-gray-50 text-gray-500'
                      }`}>
                        {t.type === 'PAYMENT' ? '📥' : t.type === 'RELEASE' ? '🔓' : t.type === 'WITHDRAWAL' ? '📤' : t.type === 'WITHDRAW_FEE' ? '🏷️' : '⚙️'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-black text-gray-900 dark:text-white leading-tight break-all" title={t.description}>{t.description}</p>
                        <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-tighter mt-1">{new Date(t.createdAt).toLocaleString("ar-EG")}</p>
                      </div>
                    </div>
                    <div className="text-left shrink-0 mr-3">
                      <p className={`text-sm sm:text-base font-black ${t.amount > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {t.amount > 0 ? '+' : ''}{t.amount.toLocaleString()}
                      </p>
                      <p className="text-[8px] sm:text-[10px] font-bold text-gray-400 uppercase">{formatCurrency(t.currency)}</p>
                    </div>
                  </div>
                ))}
                {transactions.length === 0 && (
                  <div className="py-20 text-center space-y-4">
                    <div className="w-16 h-16 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-gray-300">
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    </div>
                    <p className="text-sm font-bold text-gray-400">لا توجد عمليات مسجلة حتى الآن.</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="space-y-8">
              <h3 className="text-xl font-black text-gray-900 dark:text-white px-2">إرشادات هامة</h3>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 p-8 rounded-[2.5rem] border-2 border-blue-100/50 dark:border-blue-800/30 space-y-6">
                <div className="flex gap-4">
                  <div className="h-10 w-10 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center shrink-0">🛡️</div>
                  <p className="text-[11px] font-bold text-blue-800 dark:text-blue-300 leading-relaxed pt-1">أموالك محمية بالكامل في حسابات المنصة حتى يتم تأكيد استلام المنتج ومطابقته للمواصفات.</p>
                </div>
                <div className="flex gap-4">
                  <div className="h-10 w-10 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center shrink-0">⏱️</div>
                  <p className="text-[11px] font-bold text-blue-800 dark:text-blue-300 leading-relaxed pt-1">يتم تحرير الرصيد المعلق تلقائياً بعد مرور 7 أيام من شحن المنتج في حال عدم التأكيد اليدوي أو وجود نزاع.</p>
                </div>
                <div className="flex gap-4">
                  <div className="h-10 w-10 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center shrink-0">💸</div>
                  <p className="text-[11px] font-bold text-blue-800 dark:text-blue-300 leading-relaxed pt-1">تتم معالجة طلبات السحب يدوياً من قبل فريق الإدارة وتستغرق عادةً من 2 إلى 24 ساعة عمل.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'buyer_orders' && <OrdersList type="buyer" />}
        {activeTab === 'seller_orders' && <OrdersList type="seller" />}
        
        {activeTab === 'transactions' && (
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-gray-50 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-right text-sm">
                <thead className="bg-gray-50 dark:bg-slate-800/50 text-[10px] text-gray-400 uppercase tracking-[0.2em]">
                  <tr>
                    <th className="px-8 py-6 font-black">نوع العملية</th>
                    <th className="px-8 py-6 font-black">الوصف والتفاصيل</th>
                    <th className="px-8 py-6 font-black">المبلغ</th>
                    <th className="px-8 py-6 font-black">تاريخ التنفيذ</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-gray-50 dark:divide-slate-800">
                  {transactions.map((t, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors group">
                      <td className="px-8 py-6 whitespace-nowrap">
                        <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black tracking-widest ${
                          t.type === 'PAYMENT' ? 'bg-blue-100 text-blue-700' :
                          t.type === 'RELEASE' ? 'bg-emerald-100 text-emerald-700' :
                          t.type === 'WITHDRAWAL' ? 'bg-red-100 text-red-700' :
                          t.type === 'WITHDRAW_FEE' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>{t.type}</span>
                      </td>
                      <td className="px-8 py-6 max-w-[300px]">
                        <p className="font-black text-gray-700 dark:text-gray-200 group-hover:text-blue-600 transition-colors break-all" title={t.description}>{t.description}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase mt-1">معرف العملية: {t._id.slice(-8).toUpperCase()}</p>
                      </td>
                      <td className={`px-8 py-6 font-black text-base whitespace-nowrap ${t.amount > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {t.amount > 0 ? '+' : ''}{t.amount.toLocaleString()} <span className="text-[10px] text-gray-300">{formatCurrency(t.currency)}</span>
                      </td>
                      <td className="px-8 py-6 text-[10px] text-gray-400 font-black uppercase tracking-tighter whitespace-nowrap">{new Date(t.createdAt).toLocaleString("ar-EG")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Withdrawal Modal - Mobile Hardened */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-t-[2.5rem] sm:rounded-[3rem] w-full max-w-xl p-6 sm:p-10 space-y-6 sm:space-y-8 shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 border border-gray-100 dark:border-slate-800 relative overflow-hidden max-h-[95vh] overflow-y-auto no-scrollbar">
            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
            
            <div className="flex items-center justify-between relative z-10">
              <div className="space-y-0.5">
                <h3 className="text-xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">طلب سحب</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">تحويل الأرباح لحسابك البنكي</p>
              </div>
              <button onClick={() => setShowWithdrawModal(false)} className="h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center rounded-xl sm:rounded-2xl bg-gray-50 dark:bg-slate-800 text-gray-400 hover:text-gray-600 transition-all active:scale-90">
                <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-4 sm:space-y-6 relative z-10">
                {/* Receipt Type Toggle */}
                <div className="flex p-1.5 bg-gray-100/50 dark:bg-slate-800/50 rounded-2xl border-2 border-transparent">
                <button
                  onClick={() => setReceiptType("bank_account")}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all ${receiptType === 'bank_account' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  🏦 حساب بنكي
                </button>
                <button
                  onClick={() => setReceiptType("exchange_transfer")}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all ${receiptType === 'exchange_transfer' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  💸 حوالة صرافة
                </button>
              </div>

              {/* Currency Selector */}
              {totalBalances.length > 1 && (
                <div className="space-y-2">
                  <label className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">اختر العملة</label>
                  <div className="grid grid-cols-2 gap-2">
                    {totalBalances.map(b => (
                      <button
                        key={b.currency}
                        onClick={() => setWithdrawCurrency(b.currency)}
                        className={`p-3 rounded-xl border-2 text-[10px] font-black transition-all ${
                          withdrawCurrency === b.currency 
                            ? "border-blue-500 bg-blue-50 text-blue-600 shadow-sm" 
                            : "border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200"
                        }`}
                      >
                        {formatCurrency(b.currency)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2 sm:space-y-3">
                <label className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-2 flex justify-between">
                  <span>المبلغ المطلوب سحبه</span>
                  <span className="text-blue-600">المتاح: {wallet?.balances?.find(b => b.currency === withdrawCurrency)?.availableBalance?.toLocaleString()} {formatCurrency(withdrawCurrency)}</span>
                </label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={withdrawAmount} 
                    readOnly 
                    className="w-full rounded-[1.2rem] sm:rounded-[1.5rem] border-2 border-gray-100 dark:border-slate-800 bg-gray-100 dark:bg-slate-800 px-6 sm:px-8 py-4 sm:py-6 text-2xl sm:text-3xl font-black outline-none cursor-not-allowed opacity-80" 
                    placeholder="0.00" 
                  />
                  <span className="absolute left-6 sm:left-8 top-1/2 -translate-y-1/2 text-sm sm:text-lg font-black text-gray-400">{formatCurrency(withdrawCurrency)}</span>
                </div>
                <p className="text-[9px] font-bold text-blue-500/70 px-2 italic">* يتم سحب الرصيد المتاح كاملاً بشكل آلي لضمان دقة التسوية المالية.</p>
                {Number(withdrawAmount) > 0 && (
                  <div className="px-2 flex flex-col gap-1 sm:gap-1.5 bg-blue-50/30 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100/50 dark:border-blue-900/20">
                    <div className="flex justify-between text-xs sm:text-sm font-black text-emerald-600 uppercase tracking-widest">
                      <span>المبلغ المستلم:</span>
                      <span>{Number(withdrawAmount).toLocaleString()} {formatCurrency(withdrawCurrency)}</span>
                    </div>
                    <p className="text-[9px] font-bold text-gray-400 mt-1">* ملاحظة: هذا هو صافي الأرباح بعد خصم عمولة المنصة (1%) التي تمت عند اكتمال عملية البيع.</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
                {receiptType === "bank_account" ? (
                  <div className="space-y-3 sm:col-span-2">
                    <div className="space-y-1.5">
                      <MobileSelect
                        label="اختر حسابك البنكي"
                        value={selectedUserAccountId}
                        onChange={e => {
                          if (e.target.value === "new") {
                            setShowAddAccountForm(true);
                            setSelectedUserAccountId("");
                          } else {
                            setSelectedUserAccountId(e.target.value);
                            setShowAddAccountForm(false);
                          }
                        }}
                        options={[
                          ...userBankAccounts.map(acc => ({ 
                            value: acc._id, 
                            label: `${acc.bankName} - ${acc.accountCurrency} (${acc.accountNumber})` 
                          })),
                          { value: "new", label: "➕ إضافة حساب بنكي جديد" }
                        ]}
                        placeholder="اختر من حساباتك المضافة..."
                      />
                    </div>

                    {showAddAccountForm && (
                      <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-3xl border-2 border-blue-100 dark:border-blue-900/20 space-y-4 animate-in fade-in zoom-in duration-300">
                        <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest px-1">إضافة حساب جديد</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <MobileSelect
                            label="البنك"
                            value={bankName}
                            onChange={e => setBankName(e.target.value)}
                            options={banks.map(bank => ({ value: bank.bankName, label: bank.bankName }))}
                            placeholder="اختر البنك..."
                          />
                          <MobileSelect
                            label="عملة الحساب"
                            value={accountCurrency}
                            onChange={e => setAccountCurrency(e.target.value)}
                            options={[
                              { value: "YER", label: "ريال يمني (صنعاء)" },
                              { value: "YER_ADEN", label: "ريال يمني (عدن)" },
                              { value: "SAR", label: "ريال سعودي" },
                              { value: "USD", label: "دولار أمريكي" }
                            ]}
                          />
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-2">رقم الحساب</label>
                            <input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} className="w-full rounded-xl border-2 border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-800 px-4 py-3 text-xs font-bold outline-none focus:border-blue-500 transition-all" placeholder="رقم الحساب..." />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-2">اسم صاحب الحساب</label>
                            <input value={accountName} onChange={e => setAccountName(e.target.value)} className="w-full rounded-xl border-2 border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-800 px-4 py-3 text-xs font-bold outline-none focus:border-blue-500 transition-all" placeholder="الاسم كما في البنك..." />
                          </div>
                        </div>
                        <button
                          onClick={handleAddUserAccount}
                          disabled={submitting}
                          className="w-full py-3 bg-blue-600 text-white rounded-xl font-black text-[10px] hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none"
                        >
                          {submitting ? "جاري الحفظ..." : "حفظ وإضافة الحساب"}
                        </button>
                      </div>
                    )}

                    {selectedUserAccountId && (
                      <div className="mx-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-2xl">
                         {userBankAccounts.find(a => a._id === selectedUserAccountId)?.accountCurrency !== withdrawCurrency && (
                           <p className="text-[9px] font-black text-red-600 leading-tight">
                             ⚠️ تنبيه: عملة الحساب المختار ({formatCurrency(userBankAccounts.find(a => a._id === selectedUserAccountId)?.accountCurrency)}) تختلف عن عملة الرصيد. سيتم خصم رسوم تحويل عملة.
                           </p>
                         )}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5 sm:col-span-2">
                      <MobileSelect
                        label="اختر شركة الصرافة"
                        value={bankName}
                        onChange={e => setBankName(e.target.value)}
                        options={[
                          ...banks.map(bank => ({ value: bank.bankName, label: bank.bankName })),
                          { value: "other", label: "أخرى (كتابة اسم الصرافة)" }
                        ]}
                        placeholder="اختر الصراف..."
                      />
                    </div>

                    {bankName === "other" && (
                      <div className="space-y-1.5 sm:col-span-2 animate-in fade-in slide-in-from-top-2 duration-300">
                        <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest px-2">اسم البنك أو الصرافة</label>
                        <input 
                          value={otherBankName} 
                          onChange={e => setOtherBankName(e.target.value)} 
                          className="w-full rounded-xl border-2 border-blue-100 dark:border-slate-800 bg-blue-50/30 dark:bg-slate-800 px-5 py-3 text-xs font-bold outline-none focus:border-blue-500 transition-all" 
                          placeholder="اكتب اسم البنك أو الصرافة هنا..." 
                        />
                      </div>
                    )}

                    <div className="sm:col-span-2 mx-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl flex items-start gap-2">
                      <span className="text-sm mt-0.5">⚠️</span>
                      <p className="text-[10px] font-black text-amber-700 dark:text-amber-400 leading-tight">
                        تنبيه: عند السحب عبر حوالة صرافة، سيتم خصم عمولة التحويل الخاصة بشركة الصرافة (عمولة الإرسال) من المبلغ الصافي المستلم.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <MobileSelect
                        label="المحافظة"
                        value={selectedGovId}
                        onChange={e => setSelectedGovId(e.target.value)}
                        options={governorates.map(g => ({ value: g._id, label: g.name }))}
                        placeholder="اختر المحافظة..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <MobileSelect
                        label="المدينة"
                        value={selectedCityId}
                        onChange={e => setSelectedCityId(e.target.value)}
                        options={cities.map(c => ({ value: c._id, label: c.name }))}
                        placeholder="اختر المدينة..."
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-2">اسم المستلم الكامل (كما في الهوية)</label>
                      <input value={accountName} onChange={e => setAccountName(e.target.value)} className="w-full rounded-xl border-2 border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 px-5 py-3 text-xs font-bold outline-none focus:border-blue-500 transition-all" placeholder="الاسم الكامل بدقة..." />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-2">رقم الهاتف للتواصل <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        value={phoneNumber} 
                        onChange={e => setPhoneNumber(e.target.value)}
                        className="w-full rounded-xl border-2 border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 px-5 py-3 text-xs font-bold outline-none focus:border-blue-500 transition-all" 
                        placeholder="رقم الهاتف..." 
                      />
                    </div>
                  </>
                )}

                {/* Conditional Identity Upload - Based on amount threshold */}
                {needsIdentity && (
                  <div className="space-y-3 sm:col-span-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="mx-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-start gap-2">
                      <span className="text-sm mt-0.5">ℹ️</span>
                      <p className="text-[10px] font-black text-red-700 dark:text-red-400 leading-tight">
                        بسبب قيمة المبلغ، نحتاج التحقق من هويتك لإتمام عملية السحب. يرجى إرفاق صورة الهوية الشخصية (البطاقة الشخصية أو الجواز).
                      </p>
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-2">صورة الهوية الشخصية <span className="text-red-500">*</span></label>
                      <div className="relative group">
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={e => setIdentityImage(e.target.files[0])}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className={`w-full rounded-xl border-2 border-dashed p-4 text-center transition-all ${identityImage ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50 group-hover:border-blue-300'}`}>
                          {identityImage ? (
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-xs font-black text-blue-600 truncate max-w-[200px]">{identityImage.name}</span>
                              <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <svg className="w-6 h-6 text-gray-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                              <p className="text-[10px] font-bold text-gray-500">اضغط لرفع صورة الهوية</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 sm:p-6 bg-amber-50 dark:bg-amber-900/10 rounded-[1.5rem] sm:rounded-[2rem] border-2 border-amber-100 dark:border-amber-900/20 relative z-10">
              <p className="text-[9px] sm:text-[10px] font-bold text-amber-800 dark:text-amber-400 leading-relaxed text-center">
                تأكد من صحة البيانات البنكية بنسبة 100%. المنصة غير مسؤولة عن التحويلات للبيانات الخاطئة. الحد الأدنى للسحب: 1,000 ريال يمني أو 2.5 ريال سعودي أو 0.75 دولار.
              </p>
            </div>

            <button 
              onClick={handleWithdraw} 
              disabled={submitting} 
              className="w-full py-4 sm:py-6 bg-blue-600 text-white rounded-[1.2rem] sm:rounded-[1.5rem] font-black text-lg sm:text-xl shadow-2xl shadow-blue-200 dark:shadow-none hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-50 relative z-10"
            >
              {submitting ? (
                <div className="flex items-center justify-center gap-2 sm:gap-3">
                  <div className="h-5 w-5 sm:h-6 sm:w-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>جاري إرسال الطلب...</span>
                </div>
              ) : "تأكيد طلب سحب الأرباح"}
            </button>
            
            <div className="pb-4 sm:pb-0"></div>
          </div>
        </div>
      )}
    </div>
  );
}
