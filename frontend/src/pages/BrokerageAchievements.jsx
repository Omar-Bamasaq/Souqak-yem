
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useBrokerageApi } from "../api/brokerage.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";

export default function BrokerageAchievements() {
  const navigate = useNavigate();
  const brokerageApi = useBrokerageApi();
  const [achievements, setAchievements] = useState([]);
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [achRes, badgeRes] = await Promise.all([
          brokerageApi.getMyAchievements(),
          brokerageApi.getMyBadges(),
        ]);
        setAchievements(achRes.data || []);
        setBadges(badgeRes.data || []);
      } catch (err) {
        console.error("Failed to fetch achievements:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [brokerageApi]);

  const achievementIcons = {
    FIRST_DEAL: "🎉",
    DEALS_10: "🏆",
    DEALS_25: "👑",
  };

  const achievementLabels = {
    FIRST_DEAL: "الصفقة الأولى",
    DEALS_10: "10 صفقة",
    DEALS_25: "25 صفقة",
  };

  const badgeIcons = {
    BEGINNER: "🌟",
    BRONZE: "🥉",
    SILVER: "🥈",
    GOLD: "🥇",
    PLATINUM: "💎",
    DIAMOND: "💫",
    FIRST_BROKERAGE: "🎯",
    TOP_BROKER: "🏅",
    COMMUNITY_FAVORITE: "❤️",
  };

  const badgeLabels = {
    BEGINNER: "مبتدئ",
    BRONZE: "برونزي",
    SILVER: "فضي",
    GOLD: "ذهبي",
    PLATINUM: "بلاتيني",
    DIAMOND: "ماسي",
    FIRST_BROKERAGE: "الوساطة الأولى",
    TOP_BROKER: "الوسيط الأفضل",
    COMMUNITY_FAVORITE: "مفضل المجتمع",
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
          الإنجازات والشارات
        </h1>
        <div className="w-10"></div>
      </div>

      <div className="space-y-6">
        {/* Badges Section */}
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 border-2 border-gray-50 dark:border-slate-800 shadow-sm">
          <h2 className="text-lg font-black text-slate-900 dark:text-white mb-4">
            الشارات
          </h2>

          {badges.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-slate-400 font-bold py-8">
              لا توجد شارات بعد
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {badges.map((badge) => (
                <div
                  key={badge._id}
                  className="p-4 rounded-2xl bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border border-yellow-100 dark:border-yellow-900/30 text-center"
                >
                  <div className="text-4xl mb-2">
                    {badgeIcons[badge.type] || "🏅"}
                  </div>
                  <p className="text-sm font-black text-slate-900 dark:text-white">
                    {badgeLabels[badge.type] || badge.type}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Achievements Section */}
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 border-2 border-gray-50 dark:border-slate-800 shadow-sm">
          <h2 className="text-lg font-black text-slate-900 dark:text-white mb-4">
            الإنجازات
          </h2>

          {achievements.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-slate-400 font-bold py-8">
              لا توجد إنجازات بعد
            </p>
          ) : (
            <div className="space-y-3">
              {achievements.map((achievement) => (
                <div
                  key={achievement._id}
                  className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 flex items-center gap-4"
                >
                  <div className="text-3xl">
                    {achievementIcons[achievement.type] || "🎯"}
                  </div>
                  <div className="flex-1 text-right">
                    <p className="text-sm font-black text-slate-900 dark:text-white">
                      {achievementLabels[achievement.type] || achievement.type}
                    </p>
                    <p className="text-[10px] font-bold text-gray-500 dark:text-slate-400">
                      {new Date(achievement.unlockedAt).toLocaleDateString("ar-YE")}
                    </p>
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
