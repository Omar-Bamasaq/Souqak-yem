
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useBrokerageApi } from "../api/brokerage.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";

export default function BrokerageCampaignDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const brokerageApi = useBrokerageApi();
  const [campaign, setCampaign] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [campaignRes, membershipsRes] = await Promise.all([
          brokerageApi.getCampaignById(id),
          brokerageApi.getCampaignMemberships(id),
        ]);
        setCampaign(campaignRes.data);
        setMemberships(membershipsRes.data || []);
      } catch (err) {
        console.error("Failed to fetch campaign details:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [brokerageApi, id]);

  const handleApprove = async (membershipId) => {
    try {
      await brokerageApi.approveMembership(membershipId);
      setMemberships(memberships.map((m) =>
        m._id === membershipId ? { ...m, state: "APPROVED" } : m
      ));
    } catch (err) {
      console.error("Failed to approve membership:", err);
    }
  };

  const handleReject = async (membershipId) => {
    try {
      await brokerageApi.rejectMembership(membershipId);
      setMemberships(memberships.map((m) =>
        m._id === membershipId ? { ...m, state: "REJECTED" } : m
      ));
    } catch (err) {
      console.error("Failed to reject membership:", err);
    }
  };

  const stateLabels = {
    REQUEST_SENT: "قيد المراجعة",
    AUTO_ACTIVE: "نشط",
    APPROVED: "مقبول",
    ACTIVE: "نشط",
    REJECTED: "مرفوض",
    WITHDRAWN: "منسحب",
    BANNED: "محظور",
    EXPIRED: "منتهي",
    INACTIVE: "غير نشط",
    ARCHIVED: "مؤرشف",
  };

  const stateColors = {
    REQUEST_SENT: "bg-amber-100 text-amber-700",
    AUTO_ACTIVE: "bg-emerald-100 text-emerald-700",
    APPROVED: "bg-emerald-100 text-emerald-700",
    ACTIVE: "bg-emerald-100 text-emerald-700",
    REJECTED: "bg-red-100 text-red-700",
    WITHDRAWN: "bg-gray-100 text-gray-600",
    BANNED: "bg-red-100 text-red-700",
    EXPIRED: "bg-gray-100 text-gray-600",
    INACTIVE: "bg-gray-100 text-gray-600",
    ARCHIVED: "bg-gray-100 text-gray-600",
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">الحملة غير موجودة</p>
      </div>
    );
  }

  const pendingRequests = memberships.filter(m => m.state === "REQUEST_SENT");
  const activeMemberships = memberships.filter(m =>
    m.state === "ACTIVE" || m.state === "APPROVED" || m.state === "AUTO_ACTIVE"
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 sm:pb-10 px-4 sm:px-0">
      {/* Mobile Top Header */}
      <div className="sm:hidden flex items-center justify-between pt-4 mb-2">
        <button
          onClick={() => navigate(-1)}
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
          تفاصيل الحملة
        </h1>
        <div className="w-10"></div>
      </div>

      <div className="space-y-6">
        <h1 className="hidden sm:block text-2xl font-black text-slate-900 dark:text-white">
          تفاصيل الحملة
        </h1>

        {/* Campaign Info */}
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 border-2 border-gray-50 dark:border-slate-800 shadow-sm">
          <h2 className="text-lg font-black text-slate-900 dark:text-white mb-4">
            {campaign.adId?.title}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">
                الحالة
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {campaign.state}
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
        </div>

        {/* Pending Requests */}
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 border-2 border-gray-50 dark:border-slate-800 shadow-sm">
          <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4">
            طلبات قيد المراجعة ({pendingRequests.length})
          </h3>
          {pendingRequests.length === 0 ? (
            <p className="text-gray-500 text-center">لا توجد طلبات حالياً</p>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((membership) => (
                <div
                  key={membership._id}
                  className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {membership.brokerProfileId?.userId?.name || "وسيط غير معروف"}
                      </p>
                      <p className="text-xs font-bold text-gray-500 dark:text-slate-400">
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
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(membership._id)}
                      className="flex-1 bg-emerald-600 text-white px-4 py-2 rounded-xl font-black text-sm hover:bg-emerald-700 transition-all"
                    >
                      قبول
                    </button>
                    <button
                      onClick={() => handleReject(membership._id)}
                      className="flex-1 bg-red-600 text-white px-4 py-2 rounded-xl font-black text-sm hover:bg-red-700 transition-all"
                    >
                      رفض
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Memberships */}
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 border-2 border-gray-50 dark:border-slate-800 shadow-sm">
          <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4">
            الوسطاء النشطون ({activeMemberships.length})
          </h3>
          {activeMemberships.length === 0 ? (
            <p className="text-gray-500 text-center">لا يوجد وسطاء نشطون حالياً</p>
          ) : (
            <div className="space-y-3">
              {activeMemberships.map((membership) => (
                <div
                  key={membership._id}
                  className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {membership.brokerProfileId?.userId?.name || "وسيط غير معروف"}
                      </p>
                      <p className="text-xs font-bold text-gray-500 dark:text-slate-400">
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
