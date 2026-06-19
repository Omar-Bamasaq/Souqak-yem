import BrokerProfile from "../models/BrokerProfile.js";
import BrokerageMembership from "../models/BrokerageMembership.js";
import BrokerageDeal from "../models/BrokerageDeal.js";
import BrokerageComplaint from "../models/BrokerageComplaint.js";
import ConfigEngine from "./ConfigEngine.js";
import AuditEngine from "./AuditEngine.js";

const ALERT_LEVELS = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL"
};

export default class FraudDetectionEngine {
  static async checkUser(userId, type = "BROKER") {
    const alerts = [];

    // Check rapid membership joins
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentJoins = await BrokerageMembership.countDocuments({
      brokerProfileId: (await BrokerProfile.findOne({ userId }))?._id,
      createdAt: { $gte: oneHourAgo }
    });
    if (recentJoins > 10) {
      alerts.push({
        level: ALERT_LEVELS.MEDIUM,
        type: "RAPID_JOINS",
        message: "User joined too many campaigns in the last hour",
        details: { count: recentJoins }
      });
    }

    // Check rapid deal confirmations
    const recentDeals = await BrokerageDeal.countDocuments({
      [type === "BROKER" ? "brokerProfileId" : "sellerId"]: (await BrokerProfile.findOne({ userId }))?._id,
      createdAt: { $gte: oneHourAgo }
    });
    if (recentDeals > 5) {
      alerts.push({
        level: ALERT_LEVELS.HIGH,
        type: "RAPID_DEALS",
        message: "User confirmed too many deals in the last hour",
        details: { count: recentDeals }
      });
    }

    // Check complaint rate
    const totalDeals = await BrokerageDeal.countDocuments({
      [type === "BROKER" ? "brokerProfileId" : "sellerId"]: (await BrokerProfile.findOne({ userId }))?._id
    });
    const complaintsAgainst = await BrokerageComplaint.countDocuments({
      againstUserId: userId,
      state: "RESOLVED_IN_FAVOR"
    });
    const complaintRate = totalDeals > 0 ? complaintsAgainst / totalDeals : 0;
    if (complaintRate > 0.2) {
      alerts.push({
        level: ALERT_LEVELS.CRITICAL,
        type: "HIGH_COMPLAINT_RATE",
        message: "User has a very high complaint rate",
        details: { complaintRate, totalDeals, complaintsAgainst }
      });
    }

    if (alerts.length > 0) {
      for (const alert of alerts) {
        await AuditEngine.log(
          null,
          "SYSTEM",
          "FraudDetection",
          userId,
          "FRAUD_ALERT",
          null,
          alert
        );
      }
    }

    return alerts;
  }

  static async checkDeal(dealId) {
    const deal = await BrokerageDeal.findById(dealId);
    if (!deal) return [];

    const alerts = [];

    // Check time between membership and deal creation
    const membership = await BrokerageMembership.findById(deal.membershipId);
    const timeDiffMs = deal.createdAt.getTime() - membership.createdAt.getTime();
    const timeDiffHours = timeDiffMs / (1000 * 60 * 60);
    const minTimeHours = await ConfigEngine.get("deals.min_time_after_join_hours", 4);

    if (timeDiffHours < minTimeHours) {
      alerts.push({
        level: ALERT_LEVELS.HIGH,
        type: "SUSPICIOUSLY_FAST_DEAL",
        message: "Deal confirmed too quickly after broker joined",
        details: { timeDiffHours, minTimeHours }
      });
    }

    if (alerts.length > 0) {
      for (const alert of alerts) {
        await AuditEngine.log(
          null,
          "SYSTEM",
          "FraudDetection",
          dealId,
          "FRAUD_ALERT",
          null,
          alert
        );
      }
    }

    return alerts;
  }
}
