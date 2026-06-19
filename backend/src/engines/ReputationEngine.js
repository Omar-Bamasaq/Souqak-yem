import BrokerProfile from "../models/BrokerProfile.js";
import BrokerageDeal from "../models/BrokerageDeal.js";
import BrokerageComplaint from "../models/BrokerageComplaint.js";
import ConfigEngine from "./ConfigEngine.js";
import AuditEngine from "./AuditEngine.js";

export default class ReputationEngine {
  static async calculateReputation(userId) {
    try {
      const profile = await BrokerProfile.findOne({ userId });
      if (!profile) return 0;

      const dealSuccessWeight = await ConfigEngine.get("trust.reputation_factor.deal_success", 25);
      const complaintAgainstWeight = await ConfigEngine.get("trust.reputation_factor.complaint_resolved_against", -100);
      const complaintForWeight = await ConfigEngine.get("trust.reputation_factor.complaint_resolved_for", 10);
      const complianceWeight = await ConfigEngine.get("trust.reputation_factor.compliance", 50);
      const activityWeight = await ConfigEngine.get("trust.reputation_factor.activity", 5);

      let score = 0;

      // 1. Deal success
      const successfulDeals = await BrokerageDeal.countDocuments({
        brokerProfileId: profile._id,
        state: "CONFIRMED"
      });
      score += successfulDeals * dealSuccessWeight;

      // 2. Complaints
      const complaintsAgainst = await BrokerageComplaint.countDocuments({
        againstUserId: userId,
        state: "RESOLVED_IN_FAVOR"
      });
      const complaintsFor = await BrokerageComplaint.countDocuments({
        complainantId: userId,
        state: "RESOLVED_IN_FAVOR"
      });
      score += complaintsAgainst * complaintAgainstWeight;
      score += complaintsFor * complaintForWeight;

      // 3. Compliance
      score += profile.complianceRate * complianceWeight / 100;

      // 4. Activity (last active within 7 days gives bonus)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      if (profile.lastActiveAt >= sevenDaysAgo) {
        score += activityWeight;
      }

      // Clamp score between 0 and 1000
      score = Math.max(0, Math.min(1000, Math.round(score)));

      const oldState = { reputation: profile.reputation || 0, level: profile.level };
      
      // Update profile
      profile.reputation = score;
      profile.level = await this._determineLevel(score, successfulDeals);
      await profile.save();
      
      const newLevel = profile.level;
      
      const newState = { reputation: score, level: newLevel };

      await AuditEngine.log(
        null,
        "SYSTEM",
        "BrokerProfile",
        profile._id,
        "REPUTATION_UPDATED",
        oldState,
        newState
      );

      return { score, level: newLevel };
    } catch (err) {
      console.error("Failed to calculate reputation:", err);
      throw err;
    }
  }

  static async _determineLevel(score, dealCount) {
    const levels = ["BEGINNER", "BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"].reverse();
    for (const level of levels) {
      const minRep = await ConfigEngine.get(`trust.levels.${level}.min_reputation`, 0);
      const minDeals = await ConfigEngine.get(`trust.levels.${level}.min_deals`, 0);
      if (score >= minRep && dealCount >= minDeals) {
        return level;
      }
    }
    return "BEGINNER";
  }

  static async getPublicProfile(userId) {
    try {
      const profile = await BrokerProfile.findOne({ userId });
      if (!profile) return null;

      const { score, level } = await this.calculateReputation(userId);

      return {
        level,
        successfulDealCount: profile.successfulDealCount,
        complaintCount: profile.complaintCount,
        complaintAgainstCount: profile.complaintAgainstCount,
        complianceRate: profile.complianceRate,
        lastActiveAt: profile.lastActiveAt
      };
    } catch (err) {
      console.error("Failed to get public profile:", err);
      throw err;
    }
  }
}
