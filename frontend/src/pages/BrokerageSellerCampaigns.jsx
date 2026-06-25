
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useBrokerageApi } from "../api/brokerage.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";

export default function BrokerageSellerCampaigns() {
  const navigate = useNavigate();
  const brokerageApi = useBrokerageApi();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [campaignsRes, ...membershipsRes] = await Promise.allSettled([
          brokerageApi.getMyCampaigns()
        ]);
        
        if (campaignsRes.status === 'fulfilled') {
          setCampaigns(campaignsRes.value.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch seller campaigns:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [brokerageApi]);

  const stateLabels = {
    ACTIVE: "نشط",
    PAUSED: "موقوف",
    COMPLETED: "مكتمل",
    INACTIVE: "غير نشط",
  };

  const stateColors = {
    ACTIVE: "bg-emerald-100 text-emerald-700",
    PAUSED: "bg-amber-100 text-amber-700",
    COMPLETED: "bg-gray-100 text-gray-600",
    INACTIVE: "bg-gray-100 text-gray-600",
  };

  const typeLabels = {
    AUTO_JOIN: "انضمام تلقائي",
    MANUAL_APPROVAL: "موافقة يدوية",
    SINGLE_BROKER: "وسيط واحد",
    LIMITED: "محدد",
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 sm:pb-10 px-4 sm:px-0">
      {/* Mobile Top Header */}
      <div className="sm:hidden flex items-center justify-between pt-4 mb-2">
        <button
          onClick={() => navigate("/brokerage")}
          className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-900 rounded-full shadow-sm border border-gray-100 dark:border-slate-800"
        >
          <svg
            className="w-5 h-5 text-gray-600 dark:text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
        <h1 className="text-lg font-black text-slate-900 dark:text-white">
          حملاتي
        </h1>
        <div className="w-10"></div>
      </div>

      <div className="space-y-4">
        <h1 className="hidden sm:block text-2xl font-black text-slate-900 dark:text-white">
          حملاتي
        </h1>

        {campaigns.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-[2.5rem] p-4 border-2 border-blue-100 dark:border-blue-800 text-center">
            <p className="text-blue-700 dark:text-blue-300 font-bold text-sm">
              💡 اضغط على الحملة لمراجعة طلبات المسوقين ومتابعة الحملة
            </p>
          </div>
        )}

        {campaigns.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border-2 border-gray-50 dark:border-slate-800 shadow-sm text-center">
            <div className="text-6xl mb-4">📢</div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2">
              لا توجد حملات بعد
            </h2>
            <p className="text-gray-500 dark:text-slate-400 font-bold mb-4">
              أنشئ حملة وسيط لمنتجك الآن!
            </p>
          </div>
        ) : (
          campaigns.map((campaign) => (
            <div
              key={campaign._id}
              onClick={() => navigate(`/brokerage/campaigns/${campaign._id}`)}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 border-2 border-gray-50 dark:border-slate-800 shadow-sm cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all relative overflow-hidden"
            >
              {campaign.type === "MANUAL_APPROVAL" && (
                <div className="absolute top-3 left-3">
                  <div className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-black animate-pulse">
                    طلبات جديدة
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="text-right">
                    <h2 className="text-lg font-black text-slate-900 dark:text-white mb-2">
                      {campaign.adId?.title}
                    </h2>
                    <p className="text-sm font-bold text-gray-500 dark:text-slate-400">
                      {new Date(campaign.createdAt).toLocaleDateString("ar-YE")}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black ${
                      stateColors[campaign.state] || "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {stateLabels[campaign.state]}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">
                      نوع الحملة
                    </p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {typeLabels[campaign.type]}
                    </p>
                  </div>

                  <div className="p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">
                      المكافأة
                    </p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {campaign.rewardValue} {campaign.rewardCurrency}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-400 font-bold">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  اضغط لعرض التفاصيل
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
