import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { uploadsUrl } from "../lib/uploads";

const AdminBrokerage = () => {
  const api = useApi();
  const [activeTab, setActiveTab] = useState("campaigns");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [brokerageEnabled, setBrokerageEnabled] = useState(true);
  const [toggling, setToggling] = useState(false);

  const tabs = [
    { id: "campaigns", label: "الحملات" },
    { id: "memberships", label: "العضويات" },
    { id: "deals", label: "الصفقات" },
    { id: "complaints", label: "الشكاوى" },
    { id: "reviews", label: "التقييمات" },
    { id: "brokers", label: "الوسطاء" },
  ];

  const loadSystemStatus = async () => {
    try {
      const res = await api.get("/admin/settings");
      setBrokerageEnabled(res.data.brokerageEnabled !== false);
    } catch {}
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, dataRes] = await Promise.all([
        api.get("/brokerage/analytics/platform"),
        api.get(activeTab === "complaints" ? "/brokerage/complaints" : `/brokerage/admin/${activeTab}`),
      ]);
      setStats(statsRes.data);
      setData(dataRes.data);
    } catch (err) {
      console.error("Error loading brokerage admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSystemStatus();
  }, []);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const toggleBrokerage = async () => {
    if (toggling) return;
    setToggling(true);
    try {
      const newVal = !brokerageEnabled;
      await api.patch("/admin/settings", { brokerageEnabled: newVal });
      setBrokerageEnabled(newVal);
    } catch (err) {
      console.error(err);
      alert("فشل تغيير حالة التسويق");
    } finally {
      setToggling(false);
    }
  };

  const formatDate = (date) => {
    try {
      return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: ar });
    } catch {
      return date;
    }
  };

  const getStateBadge = (state, type) => {
    const colors = {
      ACTIVE: "bg-emerald-100 text-emerald-800",
      SUSPENDED: "bg-amber-100 text-amber-800",
      ENDED: "bg-gray-100 text-gray-800",
      REQUEST_SENT: "bg-blue-100 text-blue-800",
      AUTO_ACTIVE: "bg-emerald-100 text-emerald-800",
      APPROVED: "bg-emerald-100 text-emerald-800",
      REJECTED: "bg-red-100 text-red-800",
      WITHDRAWN: "bg-gray-100 text-gray-800",
      BANNED: "bg-red-100 text-red-800",
      EXPIRED: "bg-gray-100 text-gray-800",
      INACTIVE: "bg-gray-100 text-gray-800",
      ARCHIVED: "bg-gray-100 text-gray-800",
      PENDING: "bg-amber-100 text-amber-800",
      PENDING_MODERATION: "bg-amber-100 text-amber-800",
      RESOLVED_IN_FAVOR: "bg-emerald-100 text-emerald-800",
      RESOLVED_AGAINST: "bg-red-100 text-red-800",
      SUBMITTED: "bg-blue-100 text-blue-800",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-bold ${colors[state] || "bg-gray-100 text-gray-800"}`}>
        {state}
      </span>
    );
  };

  const renderCampaigns = () => {
    if (!data?.items) return null;
    return (
      <div className="space-y-4">
        {data.items.map((campaign) => (
          <div key={campaign._id} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {campaign.adId?.images?.[0] && (
                  <img
                    src={uploadsUrl(campaign.adId.images[0], "thumb")}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                )}
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">{campaign.adId?.title}</h3>
                  <p className="text-xs text-gray-500">{campaign.sellerId?.name}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                {getStateBadge(campaign.state)}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-right">
                <p className="text-xs font-bold text-gray-500 uppercase">نوع المكافأة</p>
                <p className="text-sm font-bold text-gray-800">
                  {campaign.rewardType === "PERCENTAGE" ? `${campaign.rewardValue}%` : `${campaign.rewardValue} ${campaign.rewardCurrency}`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-gray-500 uppercase">نوع الحملة</p>
                <p className="text-sm font-bold text-gray-800">{campaign.type}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-gray-500 uppercase">الحد الأقصى للوسطاء</p>
                <p className="text-sm font-bold text-gray-800">{campaign.maxBrokerCount || "غير محدود"}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-gray-500 uppercase">تاريخ الإنشاء</p>
                <p className="text-sm font-bold text-gray-800">{formatDate(campaign.createdAt)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderMemberships = () => {
    if (!data?.items) return null;
    return (
      <div className="space-y-4">
        {data.items.map((membership) => (
          <div key={membership._id} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {membership.brokerProfileId?.userId?.avatar ? (
                  <img
                    src={uploadsUrl(membership.brokerProfileId.userId.avatar, "thumb")}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center">
                    <span className="text-brand-600 font-bold">
                      {(membership.brokerProfileId?.userId?.name || "م")[0]}
                    </span>
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    {membership.brokerProfileId?.userId?.name}
                  </h3>
                  <p className="text-xs text-gray-500">{membership.campaignId?.adId?.title}</p>
                </div>
              </div>
              {getStateBadge(membership.state)}
            </div>
            <div className="mt-4 flex items-center gap-4">
              <span className="text-xs text-gray-500">{formatDate(membership.createdAt)}</span>
              {membership.referralCode && (
                <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-1 rounded-full">
                  {membership.referralCode}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderDeals = () => {
    if (!data?.items) return null;
    return (
      <div className="space-y-4">
        {data.items.map((deal) => (
          <div key={deal._id} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {deal.adId?.images?.[0] && (
                  <img
                    src={uploadsUrl(deal.adId.images[0], "thumb")}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                )}
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">{deal.adId?.title}</h3>
                  <p className="text-xs text-gray-500">{deal.brokerProfileId?.userId?.name} - {deal.buyerId?.name}</p>
                </div>
              </div>
              {getStateBadge(deal.state)}
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-right">
                <p className="text-xs font-bold text-gray-500 uppercase">سعر الصفقة</p>
                <p className="text-sm font-bold text-gray-800">
                  {deal.finalAdPrice} {deal.finalAdCurrency}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-gray-500 uppercase">المكافأة للوسيط</p>
                <p className="text-sm font-bold text-gray-800">{deal.brokerRewardValue} {deal.brokerRewardCurrency}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-gray-500 uppercase">تاريخ الإنشاء</p>
                <p className="text-sm font-bold text-gray-800">{formatDate(deal.createdAt)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderComplaints = () => {
    if (!data?.items) return null;
    return (
      <div className="space-y-4">
        {data.items.map((complaint) => (
          <div key={complaint._id} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {getStateBadge(complaint.state)}
                </div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">{complaint.reason}</h3>
                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
                  <span className="font-bold">من: {complaint.complainantId?.name}</span>
                  <span className="text-gray-400">ضد: {complaint.againstUserId?.name}</span>
                </div>
              </div>
              <p className="text-xs text-gray-500">{formatDate(complaint.createdAt)}</p>
            </div>
            {complaint.moderatorNotes && (
              <div className="mt-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                <p className="text-xs font-bold text-gray-500 uppercase mb-1">ملاحظات المشرف</p>
                <p className="text-sm text-gray-800 dark:text-gray-200">{complaint.moderatorNotes}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderReviews = () => {
    if (!data?.items) return null;
    return (
      <div className="space-y-4">
        {data.items.map((review) => (
          <div key={review._id} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center gap-3">
                {review.authorId?.avatar ? (
                  <img
                    src={uploadsUrl(review.authorId.avatar, "thumb")}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center">
                    <span className="text-brand-600 font-bold">
                      {(review.authorId?.name || "م")[0]}
                    </span>
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{review.authorId?.name}</p>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <svg
                        key={i}
                        className={`w-4 h-4 ${i < review.rating ? "text-amber-400 fill-current" : "text-gray-300"}`}
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8-2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                </div>
              </div>
              {getStateBadge(review.state)}
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{review.text}</p>
            <p className="text-xs text-gray-500">{formatDate(review.createdAt)}</p>
          </div>
        ))}
      </div>
    );
  };

  const renderBrokers = () => {
    if (!data?.items) return null;
    return (
      <div className="space-y-4">
        {data.items.map((broker) => (
          <div key={broker._id} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {broker.userId?.avatar ? (
                  <img
                    src={uploadsUrl(broker.userId.avatar, "thumb")}
                    alt=""
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center">
                    <span className="text-brand-600 font-bold text-lg">
                      {(broker.userId?.name || "م")[0]}
                    </span>
                  </div>
                )}
                <div>
                  <p className="text-base font-bold text-gray-900 dark:text-white">{broker.userId?.name}</p>
                  <p className="text-xs text-gray-500">{broker.userId?.email}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {getStateBadge(broker.state)}
                <p className="text-xs text-gray-500">{formatDate(broker.createdAt)}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-right">
                <p className="text-xs font-bold text-gray-500 uppercase">المستوى</p>
                <p className="text-sm font-bold text-gray-800">{broker.level}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-gray-500 uppercase">السمعة</p>
                <p className="text-sm font-bold text-gray-800">{broker.reputation}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-gray-500 uppercase">إجمالي الصفقات</p>
                <p className="text-sm font-bold text-gray-800">{broker.totalDeals || 0}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-gray-500 uppercase">إجمالي الأرباح</p>
                <p className="text-sm font-bold text-gray-800">{broker.totalEarnings || 0}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full"></div>
        </div>
      );
    }

    switch (activeTab) {
      case "campaigns":
        return renderCampaigns();
      case "memberships":
        return renderMemberships();
      case "deals":
        return renderDeals();
      case "complaints":
        return renderComplaints();
      case "reviews":
        return renderReviews();
      case "brokers":
        return renderBrokers();
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className={`rounded-2xl p-5 md:p-6 shadow-lg border-2 ${brokerageEnabled ? "bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200 dark:from-emerald-900/20 dark:to-teal-900/20 dark:border-emerald-800" : "bg-gradient-to-r from-red-50 to-rose-50 border-red-200 dark:from-red-900/20 dark:to-rose-900/20 dark:border-red-800"}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${brokerageEnabled ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}>
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {brokerageEnabled ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                )}
              </svg>
            </div>
            <div>
              <h2 className={`text-lg md:text-xl font-black mb-1 ${brokerageEnabled ? "text-emerald-800 dark:text-emerald-200" : "text-red-800 dark:text-red-200"}`}>
                نظام التسويق بالعمولة: {brokerageEnabled ? "مفعل" : "مُوقف مؤقتاً"}
              </h2>
              <p className={`text-sm font-medium leading-relaxed max-w-2xl ${brokerageEnabled ? "text-emerald-700/80 dark:text-emerald-300/80" : "text-red-700/80 dark:text-red-300/80"}`}>
                {brokerageEnabled
                  ? "نظام التسويق يعمل حالياً ويظهر لكافة المستخدمين في الموقع، مع إمكانية عرض حملات التسويق، التوسط بين البائعين والمشترين، وكل مميزاته."
                  : "عند إيقاف نظام التسويق سيتم إخفاء كافة روابطه وصفقاته وعناصره عن جميع المستخدمين العاديين والبائعين على الموقع، بينما يظل ظاهراً لك هنا في لوحة الإدارة."}
              </p>
            </div>
          </div>
          <button
            onClick={toggleBrokerage}
            disabled={toggling}
            className={`w-full md:w-auto px-6 py-3 rounded-2xl font-black text-sm md:text-base whitespace-nowrap transition-all active:scale-95 disabled:opacity-60 shadow-xl ${
              brokerageEnabled
                ? "bg-red-600 hover:bg-red-700 text-white shadow-red-200 dark:shadow-none"
                : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 dark:shadow-none"
            }`}
          >
            {toggling ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                جاري التحديث...
              </span>
            ) : brokerageEnabled ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                إيقاف نظام التسويق
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                تفعيل نظام التسويق
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">إدارة التسويق</h1>
          <p className="text-sm font-bold text-gray-500">إدارة حملات التسويق، الوسطاء، والشكاوى</p>
        </div>
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-center">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">الحملات</p>
              <p className="text-xl font-black text-brand-600">{stats.totalCampaigns || 0}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-center">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">الوسطاء</p>
              <p className="text-xl font-black text-brand-600">{stats.totalBrokers || 0}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-center">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">الصفقات</p>
              <p className="text-xl font-black text-emerald-600">{stats.totalDeals || 0}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-center">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">الشكاوى</p>
              <p className="text-xl font-black text-amber-600">{stats.totalComplaints || 0}</p>
            </div>
          </div>
        )}
      </div>

      <div className="border-b border-gray-200 dark:border-slate-700">
        <nav className="flex flex-wrap gap-2 md:gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-all ${
                activeTab === tab.id
                  ? "bg-white dark:bg-slate-800 text-brand-600 border-b-2 border-brand-600"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="min-h-[400px]">{renderContent()}</div>
    </div>
  );
};

export default AdminBrokerage;
