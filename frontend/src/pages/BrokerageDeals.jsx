
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useBrokerageApi } from "../api/brokerage.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";

export default function BrokerageDeals() {
  const navigate = useNavigate();
  const brokerageApi = useBrokerageApi();
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await brokerageApi.getMyDeals();
        setDeals(res.data || []);
      } catch (err) {
        console.error("Failed to fetch deals:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [brokerageApi]);

  const stateLabels = {
    CREATED: "تم إنشاؤها",
    BROKER_CONFIRMED: "مؤكد من الوسيط",
    BUYER_CONFIRMED: "مؤكد من المشتري",
    COMPLETED: "مكتملة",
    CANCELLED: "ملغية",
  };

  const stateColors = {
    CREATED: "bg-blue-100 text-blue-700",
    BROKER_CONFIRMED: "bg-purple-100 text-purple-700",
    BUYER_CONFIRMED: "bg-amber-100 text-amber-700",
    COMPLETED: "bg-emerald-100 text-emerald-700",
    CANCELLED: "bg-red-100 text-red-700",
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
          الصفقات
        </h1>
        <div className="w-10"></div>
      </div>

      <div className="space-y-4">
        <h1 className="hidden sm:block text-2xl font-black text-slate-900 dark:text-white">
          الصفقات
        </h1>

        {deals.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border-2 border-gray-50 dark:border-slate-800 shadow-sm text-center">
            <div className="text-6xl mb-4">💰</div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2">
              لا توجد صفقات بعد
            </h2>
            <p className="text-gray-500 dark:text-slate-400 font-bold">
              ستظهر الصفقات هنا فور إنشاؤها
            </p>
          </div>
        ) : (
          deals.map((deal) => (
            <div
              key={deal._id}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 border-2 border-gray-50 dark:border-slate-800 shadow-sm"
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="text-right">
                    <h2 className="text-lg font-black text-slate-900 dark:text-white mb-2">
                      {deal.adId?.title}
                    </h2>
                    <p className="text-sm font-bold text-gray-500 dark:text-slate-400">
                      {new Date(deal.createdAt).toLocaleDateString("ar-YE")}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black ${
                      stateColors[deal.state]
                    }`}
                  >
                    {stateLabels[deal.state]}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                      سعر السلعة
                    </p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {deal.finalAdPrice} {deal.finalAdCurrency}
                    </p>
                  </div>
                  
                  <div className="p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                      مكافأتك
                    </p>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {deal.brokerRewardAmount} {deal.brokerRewardCurrency}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
