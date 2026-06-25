import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";

export default function AdminSettings() {
  const api = useApi();
  const [settings, setSettings] = useState({
    adReviewMode: "manual",
    adReviewDelayMinutes: 0,
    prohibitedKeywords: []
  });
  const [newKeyword, setNewKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [resetting, setResetting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/settings");
      setSettings(res.data);
    } catch (error) {
      console.error("Failed to load admin settings:", error);
      toast(error.response?.data?.details || error.response?.data?.error || "تعذر تحميل الإعدادات", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toast = (m, type = "info") => {
    window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: m, type } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Only send the necessary fields, not the entire document (including _id, __v, etc.)
      const { _id, __v, createdAt, updatedAt, updatedBy, ...dataToSave } = settings;
      await api.patch("/admin/settings", dataToSave);
      toast("تم حفظ الإعدادات بنجاح", "success");
    } catch (error) {
      toast(error.response?.data?.details || error.response?.data?.error || "تعذر حفظ الإعدادات", "error");
    } finally {
      setSaving(false);
    }
  };

  const addKeyword = () => {
    if (!newKeyword.trim()) return;
    if (settings.prohibitedKeywords.includes(newKeyword.trim())) {
      setNewKeyword("");
      return;
    }
    setSettings({
      ...settings,
      prohibitedKeywords: [...settings.prohibitedKeywords, newKeyword.trim()]
    });
    setNewKeyword("");
  };

  const removeKeyword = (word) => {
    setSettings({
      ...settings,
      prohibitedKeywords: settings.prohibitedKeywords.filter((k) => k !== word)
    });
  };

  const handleReset = async () => {
    if (resetCode !== "RESET") return;
    setResetting(true);
    try {
      await api.post("/admin/reset-system", { confirmCode: resetCode });
      toast("تمت إعادة تهيئة الموقع بنجاح", "success");
      setShowResetModal(false);
      setResetCode("");
    } catch (error) {
      toast(error.response?.data?.error || "فشلت عملية إعادة التهيئة", "error");
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-gray-500 font-black text-sm animate-pulse">جاري تحميل الإعدادات...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-0 py-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-black text-gray-900 mb-1">إعدادات النظام</h2>
          <p className="text-sm text-gray-500 font-medium">إدارة قواعد مراجعة الإعلانات والكلمات المحظورة</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white px-8 py-3.5 rounded-2xl font-black text-sm hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          )}
          <span>{saving ? "جاري الحفظ..." : "حفظ التغييرات"}</span>
        </button>
      </div>

      <div className="grid gap-6">
        {/* Ad Review Mode */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-black text-gray-900">وضع مراجعة الإعلانات</h2>
          </div>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <label
              className={`relative flex cursor-pointer flex-col rounded-2xl border-2 p-5 transition-all ${
                settings.adReviewMode === "manual" ? "border-blue-600 bg-blue-50/50 shadow-md shadow-blue-100/50" : "border-gray-100 hover:border-gray-200"
              }`}
            >
              <input
                type="radio"
                name="adReviewMode"
                value="manual"
                checked={settings.adReviewMode === "manual"}
                onChange={(e) => setSettings({ ...settings, adReviewMode: e.target.value })}
                className="sr-only"
              />
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-black text-gray-900">مراجعة يدوية</span>
                {settings.adReviewMode === "manual" && (
                  <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
              <span className="text-xs text-gray-500 font-medium leading-relaxed">يجب على المشرف الموافقة على كل إعلان قبل ظهوره للعامة.</span>
            </label>
            <label
              className={`relative flex cursor-pointer flex-col rounded-2xl border-2 p-5 transition-all ${
                settings.adReviewMode === "auto" ? "border-blue-600 bg-blue-50/50 shadow-md shadow-blue-100/50" : "border-gray-100 hover:border-gray-200"
              }`}
            >
              <input
                type="radio"
                name="adReviewMode"
                value="auto"
                checked={settings.adReviewMode === "auto"}
                onChange={(e) => setSettings({ ...settings, adReviewMode: e.target.value })}
                className="sr-only"
              />
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-black text-gray-900">موافقة تلقائية</span>
                {settings.adReviewMode === "auto" && (
                  <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
              <span className="text-xs text-gray-500 font-medium leading-relaxed">يتم نشر الإعلانات تلقائياً إذا لم تحتوي على كلمات محظورة.</span>
            </label>
          </div>
        </div>

        {/* Delay Settings */}
        {settings.adReviewMode === "auto" && (
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-black text-gray-900">تأخير النشر التلقائي</h2>
            </div>
            <p className="mb-6 text-sm text-gray-500 font-medium">اختر مدة التأخير قبل نشر الإعلان تلقائياً لإعطاء انطباع بالمراجعة البشرية.</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[0, 5, 10, 15, -1].map((val) => (
                <button
                  key={val}
                  onClick={() => setSettings({ ...settings, adReviewDelayMinutes: val })}
                  className={`rounded-xl border-2 px-3 py-3 text-xs sm:text-sm transition-all font-black ${
                    settings.adReviewDelayMinutes === val
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-50 text-gray-600 hover:border-gray-200 bg-gray-50/50"
                  }`}
                >
                  {val === 0 ? "بدون تأخير" : val === -1 ? "عشوائي" : `${val} دقيقة`}
                </button>
              ))}
            </div>
            {settings.adReviewDelayMinutes === -1 && (
              <div className="mt-4 flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-[11px] text-blue-700 font-black">سيتم اختيار وقت عشوائي بين 5 و 15 دقيقة لكل إعلان.</p>
              </div>
            )}
          </div>
        )}

        {/* Prohibited Keywords */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-lg font-black text-gray-900">الكلمات المحظورة</h2>
          </div>
          <p className="mb-6 text-sm text-gray-500 font-medium">الإعلانات التي تحتوي على أي من هذه الكلمات سيتم تحويلها للمراجعة اليدوية دائماً.</p>
          
          <div className="mb-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && addKeyword()}
                placeholder="أضف كلمة جديدة..."
                className="w-full rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3.5 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all text-right text-sm font-medium"
              />
            </div>
            <button
              onClick={addKeyword}
              className="bg-gray-900 text-white px-8 py-3.5 rounded-xl font-black text-sm hover:bg-black active:scale-95 transition-all shadow-lg shadow-gray-100 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span>إضافة</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {settings.prohibitedKeywords.map((word) => (
              <span
                key={word}
                className="inline-flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-2 text-xs sm:text-sm text-gray-700 border border-gray-100 font-black group hover:border-red-200 hover:bg-red-50 hover:text-red-700 transition-all"
              >
                {word}
                <button
                  onClick={() => removeKeyword(word)}
                  className="text-gray-400 group-hover:text-red-600 transition-colors p-0.5"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
            {settings.prohibitedKeywords.length === 0 && (
              <div className="w-full py-10 flex flex-col items-center border-2 border-dashed border-gray-100 rounded-2xl">
                <p className="text-gray-400 font-bold text-sm">لا توجد كلمات محظورة حالياً</p>
              </div>
            )}
          </div>
        </div>

        {/* Reset System Section */}
        <div className="rounded-2xl border-2 border-red-100 bg-red-50/30 p-6 shadow-sm mt-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 flex-shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-black text-red-700 mb-1">منطقة الخطر: إعادة تهيئة الموقع</h2>
                <p className="text-xs text-red-600/70 font-medium leading-relaxed">حذف جميع الإعلانات، المستخدمين، الرسائل، الطلبات، المحافظ المالية، وكافة البيانات التجريبية. <br />لن يتم حذف الإعدادات الأساسية (المدن، الفئات، إلخ).</p>
              </div>
            </div>
            <button
              onClick={() => setShowResetModal(true)}
              className="bg-red-600 text-white px-8 py-4 rounded-2xl font-black text-sm hover:bg-red-700 active:scale-95 transition-all shadow-xl shadow-red-200 whitespace-nowrap"
            >
              إعادة تهيئة الموقع
            </button>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !resetting && setShowResetModal(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl animate-in zoom-in duration-300 border border-red-100 max-h-[70vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="overflow-y-auto custom-scrollbar flex-1">
              <div className="text-center">
                <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner animate-pulse">
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-base font-black text-gray-900 mb-2">هل أنت متأكد تماماً؟</h3>
                <p className="text-xs text-gray-500 font-medium mb-4 leading-relaxed">سيتم حذف جميع البيانات التجريبية نهائياً.</p>
                
                <div className="space-y-3">
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-right">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">أدخل "RESET" للتأكيد</label>
                    <input
                      type="text"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value.toUpperCase())}
                      placeholder="RESET"
                      className="w-full text-center text-base font-black tracking-[0.3em] rounded-xl border border-red-100 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-red-500 transition-all uppercase placeholder:opacity-30"
                      disabled={resetting}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4 shrink-0">
              <button 
                onClick={handleReset}
                disabled={resetCode !== "RESET" || resetting}
                className="flex-[2] py-2.5 rounded-xl bg-red-600 text-white text-xs font-black hover:bg-red-700 disabled:opacity-30 transition-all shadow-lg shadow-red-600/20 active:scale-95"
              >
                {resetting ? "جاري الحذف..." : "تأكيد الحذف"}
              </button>
              <button 
                onClick={() => setShowResetModal(false)} 
                disabled={resetting}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-black hover:bg-gray-200 transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
