
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useBrokerageApi } from "../api/brokerage.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";

export default function BrokerageMemberships() {
  const navigate = useNavigate();
  const brokerageApi = useBrokerageApi();
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await brokerageApi.getMyMemberships();
        setMemberships(res.data || []);
      } catch (err) {
        console.error("Failed to fetch memberships:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [brokerageApi]);

  const handleWithdraw = async (membershipId) => {
    if (!window.confirm("هل تريد حقًا الانسحاب من هذه الحملة؟")) return;
    
    try {
      await brokerageApi.withdrawMembership(membershipId);
      setMemberships(memberships.map(m => 
        m._id === membershipId ? { ...m, state: "WITHDRAWN" } : m
      ));
      alert("تم الانسحاب بنجاح!");
    } catch (err) {
      console.error("Failed to withdraw:", err);
      alert("حدث خطأ أثناء الانسحاب");
    }
  };

  const stateLabels = {
    PENDING: "قيد المراجعة",
    APPROVED: "مقبول",
    REJECTED: "مرفوض",
    WITHDRAWN: "منسحب",
  };

  const stateColors = {
    PENDING: "bg-amber-100 text-amber-700",
    APPROVED: "bg-emerald-100 text-emerald-700",
    REJECTED: "bg-red-100 text-red-700",
    WITHDRAWN: "bg-gray-100 text-gray-600",
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
          عضوياتي
        </h1>
        <div className="w-10"></div>
      </div>

      <div className="space-y-4">
        <h1 className="hidden sm:block text-2xl font-black text-slate-900 dark:text-white">
          عضوياتي
        </h1>

        {memberships.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border-2 border-gray-50 dark:border-slate-800 shadow-sm text-center">
            <div className="text-6xl mb-4">🤝</div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2">
              لا توجد عضويات بعد
            </h2>
            <p className="text-gray-500 dark:text-slate-400 font-bold mb-4">
              ابدأ بالانضمام إلى حملات الوساطة!
            </p>
            <button
              onClick={() => navigate("/brokerage/campaigns")}
              className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black hover:bg-blue-700 transition-all"
            >
              عرض الحملات المتاحة
            </button>
          </div>
        ) : (
          memberships.map((membership) => (
            <div
              key={membership._id}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 border-2 border-gray-50 dark:border-slate-800 shadow-sm"
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="text-right">
                    <h2 className="text-lg font-black text-slate-900 dark:text-white mb-2">
                      {membership.campaignId?.adId?.title}
                    </h2>
                    <p className="text-sm font-bold text-gray-500 dark:text-slate-400">
                      {new Date(membership.createdAt).toLocaleDateString("ar-YE")}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black ${
                      stateColors[membership.state]
                    }`}
                  >
                    {stateLabels[membership.state]}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                      البائع
                    </p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {membership.campaignId?.sellerId?.name}
                    </p>
                  </div>
                  
                  <div className="p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                      المكافأة المتوقعة
                    </p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {membership.campaignId?.rewardValue} {membership.campaignId?.rewardCurrency}
                    </p>
                  </div>
                </div>

                {membership.state === "APPROVED" || membership.state === "PENDING" ? (
                  <button
                    onClick={() => handleWithdraw(membership._id)}
                    className="w-full bg-red-50 text-red-600 border border-red-100 font-black py-3 rounded-2xl hover:bg-red-100 transition-all"
                  >
                    الانسحاب
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
