import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AdminAnalyticsDashboard() {
  const api = useApi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("month");

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/analytics/overview?range=${range}`);
      setData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
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

  const getSumOfRevenue = (revenueObj) => {
    if (!revenueObj) return 0;
    // For the pie chart or general sum, we can't easily sum different currencies 
    // but we can return the entries for display
    return Object.entries(revenueObj).map(([curr, val]) => ({
      currency: curr,
      amount: val
    }));
  };

  useEffect(() => {
    loadAnalytics();
  }, [range]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-[11px] font-black text-gray-400 animate-pulse">جاري تحميل التحليلات والبيانات...</p>
      </div>
    );
  }

  const pieData = [
    { name: 'عمولات الوساطة', value: Object.values(data?.earnings?.escrowFees || {}).reduce((a, b) => a + b, 0) },
    { name: 'عمولات السحب', value: Object.values(data?.earnings?.withdrawFees || {}).reduce((a, b) => a + b, 0) },
    { name: 'الإعلانات المميزة', value: Object.values(data?.earnings?.featuredAdsRevenue || {}).reduce((a, b) => a + b, 0) },
    { name: 'التوثيق', value: Object.values(data?.earnings?.verificationRevenue || {}).reduce((a, b) => a + b, 0) },
    { name: 'عمولات البيع', value: Object.values(data?.earnings?.commissionRevenue || {}).reduce((a, b) => a + b, 0) },
  ].filter(d => d.value > 0);

  return (
    <div className="p-6 space-y-8 pb-20">
      {/* Header & Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">إحصائيات المنصة الذكية</h2>
          <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">تحليل الأداء المالي والنمو</p>
        </div>
        
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-2xl border dark:border-slate-800 shadow-sm">
          {['day', 'week', 'month', 'year'].map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                range === r 
                ? "bg-blue-600 text-white shadow-lg shadow-blue-100" 
                : "text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800"
              }`}
            >
              {r === 'day' ? 'اليوم' : r === 'week' ? 'أسبوع' : r === 'month' ? 'شهر' : 'سنة'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border dark:border-slate-800 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-4">
            <div className="h-12 w-12 rounded-2xl flex items-center justify-center text-xl bg-blue-50 text-blue-600 dark:bg-blue-900/20">
              💰
            </div>
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">إجمالي الأرباح</p>
          <div className="space-y-1">
            {data?.earnings?.totalRevenue && Object.entries(data.earnings.totalRevenue).length > 0 ? (
              Object.entries(data.earnings.totalRevenue).map(([curr, val]) => (
                <h4 key={curr} className="text-xl font-black text-gray-900 dark:text-white">
                  {val?.toLocaleString()} <span className="text-xs text-gray-400 font-bold">{formatCurrency(curr)}</span>
                </h4>
              ))
            ) : (
              <h4 className="text-xl font-black text-gray-900 dark:text-white">0 ريال</h4>
            )}
          </div>
        </div>
        <KpiCard 
          title="طلبات الشراء" 
          value={data?.orders?.rangeCount}
          subValue={`إجمالي: ${data?.orders?.total}`}
          icon="📦"
          color="emerald"
        />
        <KpiCard 
          title="مستخدمون جدد" 
          value={data?.users?.newInRange}
          subValue={`${data?.users?.verificationRate}% موثقون`}
          icon="👥"
          color="amber"
        />
        <KpiCard 
          title="النزاعات المفتوحة" 
          value={data?.orders?.disputes}
          icon="⚠️"
          color="red"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Line Chart */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border dark:border-slate-800 shadow-sm">
          <div className="mb-6">
            <h3 className="text-sm font-black text-gray-900 dark:text-white">تحليل تدفق المبيعات</h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">حجم العمليات خلال الفترة المحددة</p>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.charts}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="_id" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 900 }}
                />
                <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue Sources Pie Chart */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border dark:border-slate-800 shadow-sm">
          <div className="mb-6">
            <h3 className="text-sm font-black text-gray-900 dark:text-white">مصادر الدخل</h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">توزيع الأرباح حسب نوع الخدمة</p>
          </div>
          <div className="h-80 w-full flex items-center justify-center">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '10px', fontWeight: 900 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center space-y-2">
                <span className="text-4xl">📊</span>
                <p className="text-xs font-bold text-gray-400">لا توجد بيانات أرباح لهذه الفترة</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Additional Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricBox title="معدل التحويل" value={`${data?.metrics?.conversionRate}%`} desc="إعلانات تحولت لمبيعات" color="blue" />
        <MetricBox title="استخدام الوساطة" value={`${data?.metrics?.securePurchaseRate}%`} desc="نسبة الشراء الآمن" color="emerald" />
        <div className={`p-6 bg-white dark:bg-slate-900 rounded-3xl border-2 border-purple-100 dark:border-purple-900/30 shadow-sm`}>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">متوسط ربح المستخدم</p>
          <div className="space-y-1">
            {data?.metrics?.revenuePerUser && typeof data.metrics.revenuePerUser === 'object' ? (
              Object.entries(data.metrics.revenuePerUser).map(([curr, val]) => (
                <h5 key={curr} className="text-lg font-black text-gray-900 dark:text-white">
                  {val} <span className="text-[10px] text-gray-400 font-bold">{formatCurrency(curr)}</span>
                </h5>
              ))
            ) : (
              <h5 className="text-lg font-black text-gray-900 dark:text-white">0 ريال</h5>
            )}
          </div>
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">متوسط الدخل لكل مستخدم</p>
        </div>
      </div>

      {/* Distribution Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border dark:border-slate-800 shadow-sm">
          <h3 className="text-sm font-black text-gray-900 dark:text-white mb-6">توزيع الإعلانات حسب الفئة</h3>
          <div className="space-y-4">
            {data?.topCategories?.map((cat, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-600 dark:text-gray-400">{cat.name}</span>
                <div className="flex items-center gap-3 flex-1 mx-4">
                  <div className="h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full flex-1 overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 rounded-full" 
                      style={{ width: `${(cat.count / data.topCategories[0].count) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-xs font-black text-gray-900 dark:text-white">{cat.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border dark:border-slate-800 shadow-sm">
          <h3 className="text-sm font-black text-gray-900 dark:text-white mb-6">نشاط المحافظات</h3>
          <div className="space-y-4">
            {data?.topGovernorates?.map((gov, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-600 dark:text-gray-400">{gov.name}</span>
                <div className="flex items-center gap-3 flex-1 mx-4">
                  <div className="h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full flex-1 overflow-hidden">
                    <div 
                      className="h-full bg-emerald-600 rounded-full" 
                      style={{ width: `${(gov.count / data.topGovernorates[0].count) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-xs font-black text-gray-900 dark:text-white">{gov.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border dark:border-slate-800 shadow-sm">
        <h3 className="text-sm font-black text-gray-900 dark:text-white mb-6">أحدث عمليات الشراء الآمن</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b dark:border-slate-800">
                <th className="pb-4 pr-2">المنتج</th>
                <th className="pb-4">المشتري</th>
                <th className="pb-4">البائع</th>
                <th className="pb-4">المبلغ</th>
                <th className="pb-4 text-left pl-2">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800">
              {data?.recentOrders?.map((order, idx) => (
                <tr key={idx} className="text-xs">
                  <td className="py-4 pr-2 font-bold text-gray-900 dark:text-white">{order.ad?.title || "منتج محذوف"}</td>
                  <td className="py-4 text-gray-600 dark:text-gray-400">{order.buyer?.name}</td>
                  <td className="py-4 text-gray-600 dark:text-gray-400">{order.seller?.name}</td>
                  <td className="py-4 font-black text-blue-600">{order.totalAmount?.toLocaleString()} {order.currency}</td>
                  <td className="py-4 text-left pl-2">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${
                      order.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' :
                      order.status === 'CANCELLED' ? 'bg-red-50 text-red-600' :
                      'bg-blue-50 text-blue-600'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, subValue, icon, color }) {
  const colors = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-900/20",
    red: "bg-red-50 text-red-600 dark:bg-red-900/20",
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border dark:border-slate-800 shadow-sm hover:shadow-md transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-xl ${colors[color]}`}>
          {icon}
        </div>
      </div>
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">{title}</p>
      <h4 className="text-2xl font-black text-gray-900 dark:text-white">{value}</h4>
      {subValue && <p className="text-[10px] font-bold text-gray-400 mt-1">{subValue}</p>}
    </div>
  );
}

function MetricBox({ title, value, desc, color }) {
  const borderColors = {
    blue: "border-blue-100 dark:border-blue-900/30",
    emerald: "border-emerald-100 dark:border-emerald-900/30",
    purple: "border-purple-100 dark:border-purple-900/30",
  };

  return (
    <div className={`p-6 bg-white dark:bg-slate-900 rounded-3xl border-2 ${borderColors[color]} shadow-sm`}>
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{title}</p>
      <h5 className="text-xl font-black text-gray-900 dark:text-white mb-1">{value}</h5>
      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{desc}</p>
    </div>
  );
}
