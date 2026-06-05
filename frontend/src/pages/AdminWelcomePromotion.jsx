import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";

export default function AdminWelcomePromotion() {
  const api = useApi();
  const [settings, setSettings] = useState({
    welcomePromotion: {
      enabled: true,
      durationHours: 6,
      maxBeneficiaries: 100,
      usedCount: 0,
      endDate: ""
    }
  });
  const [stats, setStats] = useState({
    totalBeneficiaries: 0,
    activePromotions: 0,
    remainingQuota: 0,
    convertedAds: 0,
    conversionRate: 0,
    summaryShownCount: 0,
    promoteClickCount: 0,
    clickThroughRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [settingsRes, statsRes] = await Promise.all([
        api.get("/admin/settings"),
        api.get("/admin/settings/welcome-promotion/stats")
      ]);
      
      const s = settingsRes.data;
      if (s.welcomePromotion && s.welcomePromotion.endDate) {
        s.welcomePromotion.endDate = new Date(s.welcomePromotion.endDate).toISOString().split('T')[0];
      }
      setSettings(s);
      setStats(statsRes.data);
    } catch (error) {
      toast("تعذر تحميل البيانات", "error");
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
      await api.patch("/admin/settings", { welcomePromotion: settings.welcomePromotion });
      toast("تم حفظ الإعدادات بنجاح", "success");
      load();
    } catch (error) {
      toast("تعذر حفظ الإعدادات", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm("هل أنت متأكد من إعادة تعيين عداد المستفيدين؟")) return;
    setResetting(true);
    try {
      await api.post("/admin/settings/welcome-promotion/reset");
      toast("تم إعادة تعيين العداد", "success");
      load();
    } catch (error) {
      toast("تعذر إعادة التعيين", "error");
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-gray-500 font-black text-sm animate-pulse">جاري تحميل البيانات...</p>
      </div>
    );
  }

  const wp = settings.welcomePromotion;
  const usagePercent = wp.maxBeneficiaries > 0 ? (wp.usedCount / wp.maxBeneficiaries * 100).toFixed(1) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-gray-900 mb-1">التمييز الترحيبي المجاني 🎁</h2>
          <p className="text-sm text-gray-500 font-medium">إدارة نظام جذب المستخدمين الجدد وتتبع معدلات التحويل</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : "حفظ التغييرات"}
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-[2rem] border shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">المستفيدون</p>
          <div className="text-2xl font-black text-gray-900">{stats.totalBeneficiaries}</div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">المتبقي</p>
          <div className="text-2xl font-black text-orange-600">{stats.remainingQuota}</div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">النشطة حالياً</p>
          <div className="text-2xl font-black text-blue-600">{stats.activePromotions}</div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">معدل التحويل</p>
          <div className="text-2xl font-black text-emerald-600">%{stats.conversionRate}</div>
          <p className="text-[10px] font-bold text-gray-400 mt-1">{stats.convertedAds} مستخدم اشترى باقة</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Settings Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden">
            <div className="p-6 border-b bg-gray-50/50">
              <h3 className="font-black text-gray-900 flex items-center gap-2">
                <span className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">⚙️</span>
                إعدادات العرض
              </h3>
            </div>
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div>
                  <h4 className="font-black text-gray-900 text-sm">تفعيل النظام</h4>
                  <p className="text-xs text-gray-500 font-medium">تشغيل أو إيقاف عرض التمييز المجاني للمستخدمين الجدد</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={wp.enabled}
                    onChange={(e) => setSettings({ ...settings, welcomePromotion: { ...wp, enabled: e.target.checked } })}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 mr-2 uppercase tracking-wider">مدة التمييز (ساعات)</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-black focus:ring-2 focus:ring-blue-500/20 outline-none"
                    value={wp.durationHours}
                    onChange={(e) => setSettings({ ...settings, welcomePromotion: { ...wp, durationHours: parseInt(e.target.value) || 1 } })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 mr-2 uppercase tracking-wider">الحد الأقصى للمستفيدين</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-black focus:ring-2 focus:ring-blue-500/20 outline-none"
                    value={wp.maxBeneficiaries}
                    onChange={(e) => setSettings({ ...settings, welcomePromotion: { ...wp, maxBeneficiaries: parseInt(e.target.value) || 0 } })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 mr-2 uppercase tracking-wider">تاريخ انتهاء العرض (اختياري)</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-black focus:ring-2 focus:ring-blue-500/20 outline-none"
                    value={wp.endDate || ""}
                    onChange={(e) => setSettings({ ...settings, welcomePromotion: { ...wp, endDate: e.target.value } })}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Counter Column */}
        <div className="space-y-6">
          <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden">
            <div className="p-6 border-b bg-gray-50/50">
              <h3 className="font-black text-gray-900 flex items-center gap-2">
                <span className="w-8 h-8 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center">📊</span>
                حالة الاستخدام
              </h3>
            </div>
            <div className="p-8 space-y-8 text-center">
              <div className="relative inline-flex items-center justify-center">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle className="text-gray-100" strokeWidth="12" stroke="currentColor" fill="transparent" r="54" cx="64" cy="64" />
                  <circle 
                    className="text-blue-600" 
                    strokeWidth="12" 
                    strokeDasharray={339.292} 
                    strokeDashoffset={339.292 - (usagePercent / 100) * 339.292} 
                    strokeLinecap="round" 
                    stroke="currentColor" 
                    fill="transparent" 
                    r="54" cx="64" cy="64" 
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-2xl font-black text-gray-900">{usagePercent}%</span>
                  <span className="text-[10px] font-black text-gray-400 uppercase">استهلاك</span>
                </div>
              </div>

              <div>
                <h4 className="text-xl font-black text-gray-900 mb-1">{wp.usedCount} من {wp.maxBeneficiaries}</h4>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">عدد المستفيدين الحالي</p>
              </div>

              <div className="pt-4 space-y-3">
                <button 
                  onClick={handleReset}
                  disabled={resetting}
                  className="w-full py-3 bg-gray-50 text-gray-600 rounded-xl text-xs font-black border border-gray-100 hover:bg-gray-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {resetting ? <div className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-600 rounded-full animate-spin"></div> : "إعادة تعيين العداد"}
                </button>
                <button 
                  onClick={() => setSettings({ ...settings, welcomePromotion: { ...wp, enabled: false } })}
                  className="w-full py-3 bg-red-50 text-red-600 rounded-xl text-xs font-black border border-red-100 hover:bg-red-100 active:scale-95 transition-all"
                >
                  إيقاف العرض فوراً
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
