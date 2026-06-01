import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";

export default function AdminPlans() {
  const api = useApi();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", type: "featured", durationInDays: 7, price: 0, currency: "YER_ADEN" });
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const res = await api.get("/admin/plans");
      setPlans(res.data || []);
    } catch (e) {
      setError("فشل تحميل الباقات");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (editId) {
        await api.patch(`/admin/plans/${editId}`, form);
      } else {
        await api.post("/admin/plans", form);
      }
      setForm({ name: "", type: "featured", durationInDays: 7, price: 0, currency: "YER_ADEN" });
      setEditId(null);
      load();
    } catch (e) {
      setError(e.response?.data?.error || "فشل الحفظ");
    } finally {
      setLoading(false);
    }
  };

  const edit = (p) => {
    setEditId(p._id);
    setForm({
      name: p.name,
      type: p.type,
      durationInDays: p.durationInDays,
      price: p.price ?? 0,
      currency: p.currency || "YER_ADEN"
    });
  };

  const remove = async (id) => {
    if (!confirm("حذف هذه الباقة؟")) return;
    try {
      await api.delete(`/admin/plans/${id}`);
      load();
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <h1 className="text-xl font-black text-gray-900">إدارة الباقات</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3 text-red-700">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Section */}
        <div className="lg:col-span-1">
          <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-50 bg-gray-50/50">
              <h3 className="font-black text-gray-900 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                {editId ? "تعديل باقة" : "إضافة باقة جديدة"}
              </h3>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-[11px] font-black text-gray-400 mb-1.5 mr-1">الاسم</label>
                <input
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-300"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="مثال: 7 أيام"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-gray-400 mb-1.5 mr-1">النوع</label>
                  <select
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  >
                    <option value="featured">إعلان مميز</option>
                    <option value="verification">توثيق</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-gray-400 mb-1.5 mr-1">المدة (أيام)</label>
                  <input
                    type="number"
                    min={1}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    value={form.durationInDays}
                    onChange={(e) => setForm((f) => ({ ...f, durationInDays: parseInt(e.target.value, 10) || 0 }))}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-gray-400 mb-1.5 mr-1">العملة</label>
                <select
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  value={form.currency}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                >
                  <option value="YER_ADEN">ريال يمني (عدن)</option>
                  <option value="YER_SANAA">ريال يمني (صنعاء)</option>
                  <option value="SAR">ريال سعودي</option>
                  <option value="USD">دولار</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-gray-400 mb-1.5 mr-1">السعر</label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-black text-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    value={String(form.price ?? "")}
                    onChange={(e) => {
                      const v = (e.target.value || "").replace(/\D/g, "");
                      setForm((f) => ({ ...f, price: v ? parseInt(v, 10) : 0 }));
                    }}
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400 uppercase">
                    {form.currency.split('_')[0]}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-black shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {editId ? "تحديث الباقة" : "حفظ الباقة"}
                </button>
                {editId && (
                  <button 
                    type="button" 
                    onClick={() => { setEditId(null); setForm({ name: "", type: "featured", durationInDays: 7, price: 0, currency: "YER_ADEN" }); }} 
                    className="px-4 bg-gray-50 text-gray-500 rounded-xl text-sm font-bold border border-gray-100 hover:bg-gray-100 active:scale-95 transition-all"
                  >
                    إلغاء
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* List Section */}
        <div className="lg:col-span-2 space-y-4">
          {/* Desktop Table */}
          <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {loading && !plans.length ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                <p className="text-gray-400 font-bold animate-pulse">جاري تحميل الباقات...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100">
                      <th className="px-4 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider">الاسم والنوع</th>
                      <th className="px-4 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider text-center">المدة</th>
                      <th className="px-4 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider text-center">السعر</th>
                      <th className="px-4 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider text-left">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {plans.map((p) => (
                      <tr key={p._id} className="hover:bg-gray-50/30 transition-colors group">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] border ${
                              p.type === "featured" ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-purple-50 text-purple-600 border-purple-100"
                            }`}>
                              {p.type === "featured" ? "إ" : "ت"}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 text-xs">{p.name}</p>
                              <p className="text-[10px] text-gray-400 font-medium">{p.type === "featured" ? "إعلان مميز" : "توثيق"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center px-2 py-1 rounded-lg bg-gray-50 text-gray-600 text-[10px] font-black border border-gray-100">
                            {p.durationInDays} يوم
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-xs font-black text-blue-600">
                            {p.price ?? 0} {p.currency === "USD" ? "$" : p.currency === "SAR" ? "ر.س" : p.currency === "YER_SANAA" ? "ر.ي (صنعاء)" : "ر.ي (عدن)"}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-left whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                            <button
                              onClick={() => edit(p)}
                              className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-all border border-blue-100 active:scale-95"
                              title="تعديل"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button
                              onClick={() => remove(p._id)}
                              className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-all border border-red-100 active:scale-95"
                              title="حذف"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {plans.length === 0 && !loading && (
                      <tr>
                        <td colSpan="4" className="px-4 py-20 text-center">
                          <div className="bg-gray-50 h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                          </div>
                          <p className="text-sm font-bold text-gray-400">لا توجد باقات حالياً.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Mobile View - Cards */}
          <div className="block sm:hidden space-y-4">
            {plans.map((p) => (
              <div key={p._id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4 transition-all active:scale-[0.99]">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black border ${
                      p.type === "featured" ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-purple-50 text-purple-600 border-purple-100"
                    }`}>
                      {p.type === "featured" ? "إ" : "ت"}
                    </div>
                    <div>
                      <h3 className="font-black text-gray-900 text-sm">{p.name}</h3>
                      <p className="text-[10px] font-bold text-gray-400 mt-0.5">
                        النوع: {p.type === "featured" ? "إعلان مميز" : "توثيق"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-black text-blue-600">
                      {p.price ?? 0} {p.currency === "USD" ? "$" : p.currency === "SAR" ? "ر.س" : p.currency === "YER_SANAA" ? "ر.ي" : "ر.ي"}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400">{p.durationInDays} يوم</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
                  <button
                    onClick={() => edit(p)}
                    className="flex-1 py-2.5 bg-blue-50 text-blue-600 rounded-xl text-xs font-black border border-blue-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    تعديل
                  </button>
                  <button
                    onClick={() => remove(p._id)}
                    className="p-2.5 bg-red-50 text-red-600 rounded-xl border border-red-100 active:scale-95 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            ))}
            {plans.length === 0 && !loading && (
              <div className="bg-white p-20 text-center rounded-2xl border border-gray-100 shadow-sm">
                <div className="bg-gray-50 h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                </div>
                <p className="text-sm font-bold text-gray-400">لا توجد باقات حالياً.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
