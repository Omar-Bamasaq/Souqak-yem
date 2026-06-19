
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store/AuthContext.jsx";
import { useBrokerageApi } from "../api/brokerage.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";

export default function BrokerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const brokerageApi = useBrokerageApi();
  const [profile, setProfile] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [profileRes, membershipsRes] = await Promise.all([
          brokerageApi.getMyProfile(),
          brokerageApi.getMyMemberships(),
        ]);
        setProfile(profileRes.data);
        setMemberships(membershipsRes.data || []);
      } catch (err) {
        console.error("Failed to fetch broker dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [brokerageApi]);

  const handleActivateBroker = async () => {
    try {
      await brokerageApi.activateProfile();
      const updatedProfile = await brokerageApi.getMyProfile();
      setProfile(updatedProfile.data);
      alert("تم تفعيل حسابك كوسيط بنجاح! 🎉");
    } catch (err) {
      console.error("Failed to activate broker:", err);
      alert("حدث خطأ أثناء تفعيل حساب الوسيط");
    }
  };

  const statusColors = {
    ACTIVE: "bg-emerald-100 text-emerald-700",
    INACTIVE: "bg-gray-100 text-gray-600",
  };

  const stateLabels = {
    ACTIVE: "نشط",
    INACTIVE: "غير نشط",
  };

  const levelLabels = {
    BEGINNER: "مبتدئ",
    BRONZE: "برونزي",
    SILVER: "فضي",
    GOLD: "ذهبي",
    PLATINUM: "بلاتيني",
    DIAMOND: "ماسي",
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
          لوحة الوسيط
        </h1>
        <div className="w-10"></div>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {/* Broker Profile Card */}
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border-2 border-gray-50 dark:border-slate-800 shadow-sm">
          <h1 className="hidden sm:block text-2xl font-black text-slate-900 dark:text-white mb-6">
            لوحة الوسيط
          </h1>
          
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Avatar */}
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-3xl text-white font-black shadow-xl border-4 border-white dark:border-slate-800">
              {user?.name?.charAt(0).toUpperCase() || "U"}
            </div>
            
            {/* Profile Info */}
            <div className="flex-1 text-center sm:text-right">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  {user?.name}
                </h2>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-black ${
                    statusColors[profile?.state]
                  }`}
                >
                  {stateLabels[profile?.state]}
                </span>
                {profile && (
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-yellow-100 text-yellow-700">
                    {levelLabels[profile?.level]}
                  </span>
                )}
              </div>
              
              {profile?.state !== "ACTIVE" ? (
                <button
                  onClick={handleActivateBroker}
                  className="mt-3 bg-blue-600 text-white px-6 py-3 rounded-2xl font-black hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-200 dark:shadow-none"
                >
                  تفعيل حساب الوسيط
                </button>
              ) : (
                <p className="text-sm text-gray-500 dark:text-slate-400 font-bold">
                  حسابك الوسيط نشط الآن!
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate("/brokerage/campaigns")}
            className="flex flex-col items-center justify-center p-6 rounded-3xl bg-blue-50 dark:bg-blue-900/10 border-2 border-blue-100 dark:border-blue-900/30 transition-all active:scale-95"
          >
            <span className="text-3xl mb-2">📢</span>
            <span className="text-sm font-black text-slate-900 dark:text-white">
              الحملات المتاحة
            </span>
          </button>
          
          <button
            onClick={() => navigate("/brokerage/memberships")}
            className="flex flex-col items-center justify-center p-6 rounded-3xl bg-emerald-50 dark:bg-emerald-900/10 border-2 border-emerald-100 dark:border-emerald-900/30 transition-all active:scale-95"
          >
            <span className="text-3xl mb-2">🤝</span>
            <span className="text-sm font-black text-slate-900 dark:text-white">
              عضوياتي
            </span>
          </button>
          
          <button
            onClick={() => navigate("/brokerage/deals")}
            className="flex flex-col items-center justify-center p-6 rounded-3xl bg-purple-50 dark:bg-purple-900/10 border-2 border-purple-100 dark:border-purple-900/30 transition-all active:scale-95"
          >
            <span className="text-3xl mb-2">💰</span>
            <span className="text-sm font-black text-slate-900 dark:text-white">
              الصفقات
            </span>
          </button>
          
          <button
            onClick={() => navigate("/brokerage/achievements")}
            className="flex flex-col items-center justify-center p-6 rounded-3xl bg-yellow-50 dark:bg-yellow-900/10 border-2 border-yellow-100 dark:border-yellow-900/30 transition-all active:scale-95"
          >
            <span className="text-3xl mb-2">🏆</span>
            <span className="text-sm font-black text-slate-900 dark:text-white">
              الإنجازات
            </span>
          </button>
        </div>

        {/* Recent Memberships */}
        {memberships.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 border-2 border-gray-50 dark:border-slate-800 shadow-sm">
            <h2 className="text-lg font-black text-slate-900 dark:text-white mb-4">
              آخر العضويات
            </h2>
            <div className="space-y-3">
              {memberships.slice(0, 3).map((membership) => (
                <div
                  key={membership._id}
                  className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-900 dark:text-white">
                        {membership.campaignId?.adId?.title || "حملة بدون عنوان"}
                      </p>
                      <p className="text-xs font-bold text-gray-500 dark:text-slate-400">
                        {new Date(membership.createdAt).toLocaleDateString(
                          "ar-YE"
                        )}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-black ${
                        membership.state === "APPROVED"
                          ? "bg-emerald-100 text-emerald-700"
                          : membership.state === "PENDING"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {membership.state === "APPROVED"
                        ? "مقبول"
                        : membership.state === "PENDING"
                        ? "قيد المراجعة"
                        : membership.state}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {memberships.length > 3 && (
              <button
                onClick={() => navigate("/brokerage/memberships")}
                className="mt-4 w-full text-center text-sm font-black text-blue-600 dark:text-blue-400 hover:underline"
              >
                عرض جميع العضويات
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
