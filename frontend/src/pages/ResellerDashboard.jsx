import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";
import { Link } from "react-router-dom";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import { uploadsUrl } from "../lib/uploads.js";

export default function ResellerDashboard() {
  const [stats, setStats] = useState(null);
  const [ads, setAds] = useState([]);
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [opportunities, setOpportunities] = useState({ opportunities: [], unservedRequests: [] });
  const [loading, setLoading] = useState(true);
  const api = useApi();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, adsRes, transRes, oppsRes] = await Promise.all([
          api.get("/resell/stats"),
          api.get("/resell/my-ads"),
          api.get("/resell/pending-transactions"),
          api.get("/resell/opportunities")
        ]);
        setStats(statsRes.data);
        setAds(adsRes.data);
        setPendingTransactions(transRes.data || []);
        setOpportunities(oppsRes.data || { opportunities: [], unservedRequests: [] });
      } catch (err) {
        console.error("Fetch reseller data error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black text-gray-900">لوحة تحكم المسوق</h1>
        <div className={`px-4 py-2 rounded-2xl font-black text-sm shadow-sm flex items-center gap-2 ${
          stats?.resellerLevel === 'VIP' ? 'bg-amber-100 text-amber-700' :
          stats?.resellerLevel === 'Pro' ? 'bg-purple-100 text-purple-700' :
          stats?.resellerLevel === 'Active' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
        }`}>
          <span>{stats?.resellerLevel === 'VIP' ? '💎 VIP' : stats?.resellerLevel === 'Pro' ? '🔥 Pro' : stats?.resellerLevel === 'Active' ? '⚡ نشط' : '🌱 مبتدئ'}</span>
          <span className="text-[10px] opacity-60">المستوى</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatCard title="إجمالي الأرباح" value={`${stats?.totalProfit || 0} ر.ي`} icon="💰" color="bg-green-50 text-green-600" />
        <StatCard title="نسبة الإتمام" value={`${Math.round(stats?.completionRate || 0)}%`} icon="🎯" color="bg-blue-50 text-blue-600" />
        <StatCard title="نقرات الروابط" value={stats?.totalClicks || 0} icon="🔗" color="bg-purple-50 text-purple-600" />
        <StatCard title="نسبة التحويل (CR)" value={`${stats?.conversionRate || 0}%`} icon="📊" color="bg-amber-50 text-amber-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        {/* Opportunities Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Opportunities Section */}
          <section className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm">
            <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
              🚀 فرص ربح عالية
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">جديد</span>
            </h2>
            <div className="space-y-4">
              {opportunities.opportunities.map(opp => (
                <Link key={opp._id} to={`/ad/${opp._id}`} className="flex items-center justify-between p-4 rounded-2xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-xl">📦</div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{opp.title}</h3>
                      <p className="text-[10px] text-gray-500">العمولة: <span className="text-green-600 font-black">{opp.commissionValue}{opp.commissionType === 'percentage' ? '%' : ' ر.ي'}</span></p>
                    </div>
                  </div>
                  <div className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">ابدأ التسويق</div>
                </Link>
              ))}
              {opportunities.opportunities.length === 0 && <p className="text-center py-6 text-gray-400 italic text-sm">لا توجد فرص جديدة حالياً</p>}
            </div>
          </section>

          {/* Unserved Requests Section */}
          <section className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm">
            <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
              🎯 طلبات شراء غير مخدومة
              <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">تطابق تخصصك</span>
            </h2>
            <div className="space-y-4">
              {opportunities.unservedRequests.map(req => (
                <Link key={req._id} to={`/ad/${req._id}`} className="flex items-center justify-between p-4 rounded-2xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-xl">👤</div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 group-hover:text-purple-600 transition-colors">{req.title}</h3>
                      <p className="text-[10px] text-gray-500">المشتري: {req.userId?.name}</p>
                    </div>
                  </div>
                  <div className="text-[10px] font-black text-purple-600 bg-purple-50 px-3 py-1 rounded-lg">تواصل الآن</div>
                </Link>
              ))}
              {opportunities.unservedRequests.length === 0 && <p className="text-center py-6 text-gray-400 italic text-sm">لا توجد طلبات شراء تطابق تصنيفاتك</p>}
            </div>
          </section>
        </div>

        {/* Info Column */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-lg font-black mb-2 text-blue-50">كيف تزيد أرباحك؟ 📈</h3>
              <p className="text-xs text-blue-100 leading-relaxed mb-6">المسوقون المحترفون يحققون مبيعات أكثر من خلال نشر روابطهم في مجموعات الواتساب وتطبيقات التواصل.</p>
              <Link to="/how-to-earn" className="inline-block px-6 py-2.5 bg-white text-blue-600 text-xs font-black rounded-xl hover:bg-blue-50 transition-all active:scale-95">اقرأ الدليل التعليمي</Link>
            </div>
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
          </div>

          <div className="bg-purple-50 border border-purple-100 rounded-[2rem] p-6">
            <h3 className="text-sm font-black text-purple-900 mb-4 flex items-center gap-2">🎁 برنامج المكافآت</h3>
            <p className="text-[11px] text-purple-700 leading-relaxed">أتمم أول 5 عمليات بيع واحصل على شارة <span className="font-bold">Active</span> فوراً لزيادة ظهور إعلاناتك بنسبة 50%!</p>
          </div>
        </div>
      </div>

      {/* My Resell Ads */}
      {pendingTransactions.length > 0 && (
        <div className="mb-10 animate-in fade-in slide-in-from-top-4">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            🔔 بانتظار التأكيد
            <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{pendingTransactions.length}</span>
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {pendingTransactions.map(t => (
              <div key={t._id} className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-amber-900">تأكيد بيع: {t.originalAdId?.title}</p>
                  <p className="text-xs text-amber-700">الربح المتوقع: {t.resellerProfit} ر.ي</p>
                </div>
                {!t.confirmedByReseller ? (
                  <button 
                    onClick={async () => {
                      try {
                        await api.post("/resell/confirm-sale", { transactionId: t._id });
                        window.location.reload();
                      } catch (err) {
                        alert(err.response?.data?.error || "حدث خطأ ما");
                      }
                    }}
                    className="px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700 transition-all shadow-md"
                  >
                    تأكيد الآن
                  </button>
                ) : (
                  <span className="text-xs font-bold text-amber-600 italic">بانتظار تأكيد البائع...</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">إعلاناتي التسويقية</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs font-black uppercase tracking-wider">
                <th className="px-6 py-4">الإعلان</th>
                <th className="px-6 py-4">السعر</th>
                <th className="px-6 py-4">المشاهدات</th>
                <th className="px-6 py-4">النقرات</th>
                <th className="px-6 py-4">الحالة</th>
                <th className="px-6 py-4">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ads.map((ad) => (
                <tr key={ad._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img 
                        src={ad.originalAdId?.images?.[0] ? uploadsUrl(ad.originalAdId.images[0]) : ""} 
                        className="w-12 h-12 rounded-xl object-cover"
                        alt=""
                      />
                      <div className="max-w-[200px]">
                        <p className="text-sm font-bold text-gray-900 truncate">{ad.originalAdId?.title}</p>
                        <p className="text-[10px] text-gray-400">منذ {new Date(ad.createdAt).toLocaleDateString("ar-EG")}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-400 line-through">{ad.originalAdId?.price}</span>
                      <span className="text-sm font-bold text-blue-600">{ad.newPrice}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{ad.viewsCount || 0}</td>
                  <td className="px-6 py-4 text-sm font-medium text-purple-600">{ad.referralClicks || 0}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                      ad.status === 'active' ? 'bg-green-50 text-green-600' : 
                      ad.status === 'sold' ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-600'
                    }`}>
                      {ad.status === 'active' ? 'نشط' : ad.status === 'sold' ? 'مباع' : 'ملغي'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          const url = `${window.location.origin}/ad/${ad.originalAdId?._id}?ref=${ad.resellerId}`;
                          navigator.clipboard.writeText(url);
                          alert("تم نسخ رابط الإحالة الخاص بك");
                        }}
                        title="نسخ رابط الإحالة"
                        className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-all"
                      >
                        🔗
                      </button>
                      <Link to={`/ad/${ad._id}`} className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-all">
                        👁️
                      </Link>
                      {ad.status === 'active' && (
                        <button 
                          onClick={async () => {
                            if (window.confirm("هل أنت متأكد من إتمام عملية البيع؟ سيتم إرسال طلب تأكيد للبائع.")) {
                              try {
                                await api.post("/resell/mark-as-sold", { resellAdId: ad._id });
                                window.location.reload();
                              } catch (err) {
                                alert(err.response?.data?.error || "حدث خطأ ما");
                              }
                            }
                          }}
                          className="px-3 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
                        >
                          تم البيع
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {ads.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-gray-400 italic">لا توجد إعلانات تسويقية بعد. ابدأ الآن باختيار إعلان والضغط على "ابدأ التسويق".</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }) {
  return (
    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex items-center gap-4">
      <div className={`w-12 h-12 ${color} rounded-2xl flex items-center justify-center text-2xl shadow-inner`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-1">{title}</p>
        <p className="text-xl font-black text-gray-900">{value}</p>
      </div>
    </div>
  );
}
