import BrokerageBadge from "../models/BrokerageBadge.js";
import BrokerageAchievement from "../models/BrokerageAchievement.js";
import ReputationEngine from "./ReputationEngine.js";
import AuditEngine from "./AuditEngine.js";

const BADGES = {
  BEGINNER: "BEGINNER",
  BRONZE: "BRONZE",
  SILVER: "SILVER",
  GOLD: "GOLD",
  PLATINUM: "PLATINUM",
  DIAMOND: "DIAMOND",
  FIRST_BROKERAGE: "FIRST_BROKERAGE",
  TOP_BROKER: "TOP_BROKER",
  COMMUNITY_FAVORITE: "COMMUNITY_FAVORITE"
};

const BADGE_REQUIREMENTS = {
  [BADGES.BEGINNER]: { achievements: [], level: "BEGINNER" },
  [BADGES.BRONZE]: { achievements: [], level: "BRONZE" },
  [BADGES.SILVER]: { achievements: [], level: "SILVER" },
  [BADGES.GOLD]: { achievements: [], level: "GOLD" },
  [BADGES.PLATINUM]: { achievements: [], level: "PLATINUM" },
  [BADGES.DIAMOND]: { achievements: [], level: "DIAMOND" },
  [BADGES.FIRST_BROKERAGE]: { achievements: ["FIRST_DEAL"], level: null },
  [BADGES.TOP_BROKER]: { achievements: ["DEALS_10"], level: null },
  [BADGES.COMMUNITY_FAVORITE]: { achievements: ["DEALS_25"], level: null }
};

export default class BadgeEngine {
  static async checkAndAwardAll(userId) {
    const awarded = [];
    const { level } = await ReputationEngine.calculateReputation(userId);
    const userAchievements = await BrokerageAchievement.find({ userId });
    const achievementTypes = userAchievements.map(a => a.type);

    for (const badgeType of Object.values(BADGES)) {
      const existing = await BrokerageBadge.findOne({ userId, type: badgeType });
      if (existing) continue;

      const requirements = BADGE_REQUIREMENTS[badgeType];

      // Check requirements
      const meetsAchievements = requirements.achievements.every(a => achievementTypes.includes(a));
      const levelOrder = ["BEGINNER", "BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"];
      const meetsLevel = requirements.level ? (
        level === requirements.level || 
        levelOrder.indexOf(level) >= levelOrder.indexOf(requirements.level)
      ) : true;

      if (meetsAchievements && (requirements.level ? meetsLevel : true)) {
        const badge = await BrokerageBadge.create({
          userId,
          type: badgeType,
          achievementIds: userAchievements.map(a => a._id)
        });
        await AuditEngine.log(
          null,
          "SYSTEM",
          "BrokerageBadge",
          badge._id,
          "BADGE_AWARDED",
          null,
          { type: badgeType }
        );
        awarded.push(badge);
      }
    }
    return awarded;
  }
}
