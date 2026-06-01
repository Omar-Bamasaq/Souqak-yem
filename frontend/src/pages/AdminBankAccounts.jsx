import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";

const CURRENCIES = [
  { value: "YER_ADEN", label: "ريال يمني (عدن)" },
  { value: "YER_SANAA", label: "ريال يمني (صنعاء)" },
  { value: "SAR", label: "ريال سعودي" },
  { value: "USD", label: "دولار" }
];

export default function AdminBankAccounts() {
  const api = useApi();
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [form, setForm] = useState({ 
    bankName: "", 
    accountOwner: "", 
    accounts: [{ number: "", currency: "YER_ADEN" }],
    logo: null
  });
  const [logoPreview, setLogoPreview] = useState(null);
  const [editId, setEditId] = useState(null);
  const apiBase = (import.meta.env && import.meta.env.VITE_API_URL)?.replace("/api", "") || "http://localhost:5000";

  const load = async () => {
    try {
      const res = await api.get("/bank-accounts/all");
      setBanks(res.data || []);
    } catch (e) {
      setError("فشل تحميل الحسابات");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setForm(prev => ({ ...prev, logo: file }));
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const addAccountRow = () => {
    setForm(prev => ({
      ...prev,
      accounts: [...prev.accounts, { number: "", currency: "YER_ADEN" }]
    }));
  };

  const removeAccountRow = (index) => {
    setForm(prev => ({
      ...prev,
      accounts: prev.accounts.filter((_, i) => i !== index)
    }));
  };

  const handleAccountChange = (index, field, value) => {
    const newAccounts = [...form.accounts];
    newAccounts[index][field] = value;
    setForm(prev => ({ ...prev, accounts: newAccounts }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return; // Prevent multiple submissions
    setError("");
    setLoading(true);

    const formData = new FormData();
    formData.append("bankName", form.bankName.trim());
    formData.append("accountOwner", form.accountOwner.trim());
    
    // Validate and clean accounts data
    const accountsData = (Array.isArray(form.accounts) ? form.accounts : [])
      .filter(acc => acc.number && acc.number.trim() !== "")
      .map(acc => ({
        number: acc.number.trim(),
        currency: acc.currency || "YER_ADEN"
      }));

    if (accountsData.length === 0) {
      setError("يجب إضافة رقم حساب واحد على الأقل");
      setLoading(false);
      return;
    }

    formData.append("accounts", JSON.stringify(accountsData));
    
    if (form.logo instanceof File) {
      formData.append("logo", form.logo);
    }

    console.log("Submitting Bank Data:", {
      bankName: form.bankName,
      accountOwner: form.accountOwner,
      accounts: accountsData,
      hasLogo: !!form.logo
    });

    try {
      if (editId) {
        await api.patch(`/bank-accounts/${editId}`, formData);
      } else {
        await api.post("/bank-accounts", formData);
      }
      resetForm();
      load();
      window.dispatchEvent(new CustomEvent("app:toast", { 
        detail: { message: "تم حفظ بيانات البنك بنجاح", type: "success" } 
      }));
    } catch (e) {
      console.error("Submission error:", e.response?.data);
      const serverError = e.response?.data?.message || e.response?.data?.error;
      const details = e.response?.data?.details;
      
      let errorMsg = serverError || "فشل الحفظ";
      if (details) {
        // If there are specific Mongoose validation errors
        const detailMsgs = Object.values(details).map(d => d.message).join(", ");
        errorMsg += `: ${detailMsgs}`;
      }
      
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ bankName: "", accountOwner: "", accounts: [{ number: "", currency: "YER_ADEN" }], logo: null });
    setLogoPreview(null);
    setEditId(null);
  };

  const startEdit = (bank) => {
    setEditId(bank._id);
    setForm({
      bankName: bank.bankName,
      accountOwner: bank.accountOwner,
      accounts: bank.accounts.length > 0 ? bank.accounts : [{ number: "", currency: "YER_ADEN" }],
      logo: bank.logo
    });
    setLogoPreview(bank.logo ? (bank.logo.startsWith("http") ? bank.logo : `${apiBase}${bank.logo}`) : null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeBank = async (id) => {
    if (!confirm("حذف هذا البنك وجميع حساباته؟")) return;
    try {
      await api.delete(`/bank-accounts/${id}`);
      load();
    } catch {}
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">إدارة الحسابات البنكية</h2>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-100">{error}</div>}

      <form onSubmit={submit} className="rounded-2xl border bg-white p-6 shadow-sm space-y-6">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          {editId ? "تعديل بيانات البنك" : "إضافة بنك جديد"}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 mr-2">اسم البنك</label>
            <input
              className="w-full rounded-xl border-gray-200 bg-gray-50 focus:ring-blue-500 focus:border-blue-500 font-bold p-3 text-sm"
              value={form.bankName}
              onChange={(e) => setForm(f => ({ ...f, bankName: e.target.value }))}
              placeholder="مثال: بنك الكريمي"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 mr-2">اسم صاحب الحساب</label>
            <input
              className="w-full rounded-xl border-gray-200 bg-gray-50 focus:ring-blue-500 focus:border-blue-500 font-bold p-3 text-sm"
              value={form.accountOwner}
              onChange={(e) => setForm(f => ({ ...f, accountOwner: e.target.value }))}
              placeholder="مثال: مؤسسة سوقك للتجارة"
              required
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 mr-2">شعار البنك (Logo)</label>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="hidden"
                id="logo-upload"
              />
              <label 
                htmlFor="logo-upload"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <svg className="w-8 h-8 mb-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-gray-500 font-bold">اضغط لرفع الشعار</p>
                </div>
              </label>
            </div>
            {logoPreview && (
              <div className="w-32 h-32 rounded-2xl border border-gray-100 overflow-hidden bg-gray-50 flex items-center justify-center p-2 relative group">
                <img src={logoPreview} alt="Logo Preview" className="max-w-full max-h-full object-contain" />
                <button 
                  type="button" 
                  onClick={() => { setForm(f => ({ ...f, logo: null })); setLogoPreview(null); }}
                  className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-gray-500 mr-2">أرقام الحسابات</label>
            <button 
              type="button" 
              onClick={addAccountRow}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              + إضافة رقم آخر
            </button>
          </div>
          
          <div className="space-y-4">
            {form.accounts.map((acc, index) => (
              <div key={index} className="flex flex-col md:flex-row gap-3 p-4 md:p-0 rounded-2xl border border-gray-100 md:border-0 bg-gray-50/30 md:bg-transparent animate-in fade-in slide-in-from-right-2 duration-200">
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 md:hidden mr-1">رقم الحساب</label>
                  <input
                    className="w-full rounded-xl border-gray-200 bg-white md:bg-gray-50 focus:ring-blue-500 focus:border-blue-500 font-black p-3 md:p-3 text-lg md:text-sm text-right md:text-right"
                    value={acc.number}
                    onChange={(e) => handleAccountChange(index, "number", e.target.value)}
                    placeholder="أدخل رقم الحساب هنا"
                    required
                  />
                </div>
                <div className="flex items-center justify-between md:justify-start gap-2">
                  <div className="flex-1 md:w-48 space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 md:hidden mr-1">العملة</label>
                    <div className="relative">
                      <select
                        className="w-full rounded-xl border-gray-200 bg-white md:bg-gray-50 focus:ring-blue-500 focus:border-blue-500 font-bold p-3 text-sm appearance-none pr-10"
                        value={acc.currency}
                        onChange={(e) => handleAccountChange(index, "currency", e.target.value)}
                      >
                        {CURRENCIES.map(c => (
                          <option key={c.value} value={c.value}>
                            {c.value === "YER_ADEN" || c.value === "YER_SANAA" ? "🇾🇪 " : c.value === "SAR" ? "🇸🇦 " : "🇺🇸 "}
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  {form.accounts.length > 1 && (
                    <div className="pt-5 md:pt-0">
                      <button 
                        type="button" 
                        onClick={() => removeAccountRow(index)}
                        className="p-3 text-red-500 hover:bg-red-50 bg-white md:bg-transparent border md:border-0 border-red-100 rounded-xl transition-colors shadow-sm md:shadow-none"
                        title="حذف الرقم"
                      >
                        <svg className="w-6 h-6 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button 
            type="submit" 
            disabled={loading} 
            className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50 active:scale-[0.98]"
          >
            {loading ? "جاري الحفظ..." : (editId ? "تحديث البيانات" : "حفظ البنك")}
          </button>
          {editId && (
            <button 
              type="button" 
              onClick={resetForm} 
              className="px-6 py-3 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50"
            >
              إلغاء
            </button>
          )}
        </div>
      </form>

      <div className="space-y-4">
        <h3 className="font-bold text-gray-800">البنوك الحالية</h3>
        
        {/* Desktop Table */}
        <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-3 md:px-6 py-4 text-[10px] md:text-xs font-black text-gray-500 uppercase tracking-wider">البنك</th>
                  <th className="px-3 md:px-6 py-4 text-[10px] md:text-xs font-black text-gray-500 uppercase tracking-wider hidden md:table-cell">صاحب الحساب</th>
                  <th className="px-3 md:px-6 py-4 text-[10px] md:text-xs font-black text-gray-500 uppercase tracking-wider">الحسابات</th>
                  <th className="px-3 md:px-6 py-4 text-[10px] md:text-xs font-black text-gray-500 uppercase tracking-wider text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {banks.map((bank) => (
                  <tr key={bank._id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-3 md:px-6 py-4">
                      <div className="flex items-center gap-2 md:gap-3">
                        <div className="w-8 h-8 md:w-10 md:h-10 shrink-0 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center p-1 overflow-hidden">
                          {bank.logo ? (
                            <img src={bank.logo.startsWith("http") ? bank.logo : `${apiBase}${bank.logo}`} alt={bank.bankName} className="w-full h-full object-contain" />
                          ) : (
                            <svg className="w-5 h-5 md:w-6 md:h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-black text-gray-900 text-xs md:text-sm leading-tight">{bank.bankName}</span>
                          <span className="text-[9px] font-bold text-gray-400 md:hidden">{bank.accountOwner}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                      <span className="text-sm font-bold text-gray-600">{bank.accountOwner}</span>
                    </td>
                    <td className="px-3 md:px-4 py-4 min-w-[120px]">
                      <div className="flex flex-col gap-2">
                        {bank.accounts.map((acc, i) => (
                          <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-blue-50/80 border border-blue-100/50 w-fit shadow-sm">
                            <span className="text-sm shrink-0">
                              {acc.currency === "USD" ? "🇺🇸" : acc.currency === "SAR" ? "🇸🇦" : "🇾🇪"}
                            </span>
                            <span className="font-mono font-black text-xs md:text-sm text-blue-700 tracking-wider">
                              {acc.number}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-4 whitespace-nowrap text-left">
                      <div className="flex items-center justify-start gap-0.5 md:gap-1">
                        <button 
                          onClick={() => startEdit(bank)} 
                          className="p-1.5 md:p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="تعديل"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button 
                          onClick={() => removeBank(bank._id)} 
                          className="p-1.5 md:p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="حذف"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {banks.length === 0 && (
            <div className="text-center py-10 bg-gray-50/50">
              <p className="text-sm font-bold text-gray-400">لا توجد بنوك مضافة حالياً</p>
            </div>
          )}
        </div>

        {/* Mobile View - Cards */}
        <div className="block sm:hidden space-y-4">
          {banks.length === 0 && (
            <div className="bg-white p-8 text-center rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-sm text-gray-500 font-bold">لا توجد بنوك مضافة حالياً.</p>
            </div>
          )}
          {banks.map((bank) => (
            <div key={bank._id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4 transition-all active:scale-[0.99]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 shrink-0 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center p-1 overflow-hidden">
                  {bank.logo ? (
                    <img src={bank.logo.startsWith("http") ? bank.logo : `${apiBase}${bank.logo}`} alt={bank.bankName} className="w-full h-full object-contain" />
                  ) : (
                    <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-black text-gray-900 text-sm truncate">{bank.bankName}</h3>
                  <p className="text-[10px] font-bold text-gray-400 truncate mt-0.5">{bank.accountOwner}</p>
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => startEdit(bank)} 
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-50 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button 
                    onClick={() => removeBank(bank._id)} 
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg border border-red-50 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold text-gray-400 mr-1">أرقام الحسابات:</p>
                <div className="grid grid-cols-1 gap-2">
                  {bank.accounts.map((acc, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100 shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-base shrink-0">
                          {acc.currency === "USD" ? "🇺🇸" : acc.currency === "SAR" ? "🇸🇦" : "🇾🇪"}
                        </span>
                        <span className="font-mono font-black text-sm text-gray-900 tracking-wider">
                          {acc.number}
                        </span>
                      </div>
                      <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                        {CURRENCIES.find(c => c.value === acc.currency)?.label.split("(")[0]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
