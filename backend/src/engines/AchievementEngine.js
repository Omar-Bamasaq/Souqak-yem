import BrokerProfile from "../models/BrokerProfile.js";
import BrokerageAchievement from "../models/BrokerageAchievement.js";
import BrokerageBadge from "../models/BrokerageBadge.js";
import BrokerageDeal from "../models/BrokerageDeal.js";
import AuditEngine from "./AuditEngine.js";

const ACHIEVEMENTS = {
  FIRST_DEAL: "FIRST_DEAL",
  DEALS_5: "DEALS_5",
  DEALS_10: "DEALS_10",
  DEALS_25: "DEALS_25",
  DEALS_50: "DEALS_50",
  DEALS_100: "DEALS_100",
  PERFECT_COMPLIANCE_30: "PERFECT_COMPLIANCE_30",
  ZERO_COMPLAINTS_90: "ZERO_COMPLAINTS_90"
};

export default class AchievementEngine {
  static async checkAndUnlockAll(userId, brokerProfileId) {
    const unlocked = [];
    for (const achievementType of Object.values(ACHIEVEMENTS)) {
      const unlockedAchievement = await this.checkAndUnlock(achievementType, userId, brokerProfileId);
      if (unlockedAchievement) {
        unlocked.push(unlockedAchievement);
      }
    }
    return unlocked;
  }

  static async checkAndUnlock(achievementType, userId, brokerProfileId) {
    const existing = await BrokerageAchievement.findOne({ userId, type: achievementType });
    if (existing) return null; // Already unlocked

    let isEligible = false;
    let metadata = {};

    switch (achievementType) {
      case ACHIEVEMENTS.FIRST_DEAL:
        const firstDeal = await BrokerageDeal.findOne({ brokerProfileId, state: "CONFIRMED" });
        isEligible = !!firstDeal;
        if (isEligible) metadata.dealId = firstDeal._id;
        break;
      case ACHIEVEMENTS.DEALS_5:
      case ACHIEVEMENTS.DEALS_10:
      case ACHIEVEMENTS.DEALS_25:
      case ACHIEVEMENTS.DEALS_50:
      case ACHIEVEMENTS.DEALS_100:
        const requiredCount = parseInt(achievementType.replace("DEALS_", ""));
        const dealCount = await BrokerageDeal.countDocuments({ brokerProfileId, state: "CONFIRMED" });
        isEligible = dealCount >= requiredCount;
        metadata.dealCount = dealCount;
        break;
      case ACHIEVEMENTS.PERFECT_COMPLIANCE_30:
        const profile = await BrokerProfile.findById(brokerProfileId);
        isEligible = profile && profile.complianceRate >= 100;
        metadata.complianceRate = profile?.complianceRate;
        break;
      case ACHIEVEMENTS.ZERO_COMPLAINTS_90:
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const complaintCount = await BrokerageDeal.countDocuments({
          brokerProfileId,
          state: "CONFIRMED",
          createdAt: { $gte: ninetyDaysAgo }
        });
        isEligible = complaintCount === 0;
        metadata.days = 90;
        break;
    }

    if (isEligible) {
      const achievement = await BrokerageAchievement.create({
        userId,
        type: achievementType,
        metadata
      });
      await AuditEngine.log(
        null,
        "SYSTEM",
        "BrokerageAchievement",
        achievement._id,
        "ACHIEVEMENT_UNLOCKED",
        null,
        { type: achievementType }
      );
      return achievement;
    }

    return null;
  }
}
