import BrokerageCampaign from "../models/BrokerageCampaign.js";
import BrokerageMembership from "../models/BrokerageMembership.js";
import BrokerageDeal from "../models/BrokerageDeal.js";
import BrokerProfile from "../models/BrokerProfile.js";
import BrokerageComplaint from "../models/BrokerageComplaint.js";

export default class AnalyticsEngine {
  static async getPlatformStats() {
    const totalCampaigns = await BrokerageCampaign.countDocuments();
    const activeCampaigns = await BrokerageCampaign.countDocuments({ state: "ACTIVE" });
    const totalMemberships = await BrokerageMembership.countDocuments();
    const activeMemberships = await BrokerageMembership.countDocuments({ state: "ACTIVE" });
    const totalDeals = await BrokerageDeal.countDocuments();
    const confirmedDeals = await BrokerageDeal.countDocuments({ state: "CONFIRMED" });
    const totalBrokers = await BrokerProfile.countDocuments();
    const totalComplaints = await BrokerageComplaint.countDocuments();
    
    return {
      totalCampaigns,
      activeCampaigns,
      totalMemberships,
      activeMemberships,
      totalDeals,
      confirmedDeals,
      totalBrokers,
      totalComplaints,
      successRate: totalDeals > 0 ? Math.round((confirmedDeals / totalDeals) * 100) : 0
    };
  }

  static async getBrokerStats(brokerProfileId) {
    const activeMemberships = await BrokerageMembership.countDocuments({ brokerProfileId, state: "ACTIVE" });
    const totalDeals = await BrokerageDeal.countDocuments({ brokerProfileId });
    const confirmedDeals = await BrokerageDeal.countDocuments({ brokerProfileId, state: "CONFIRMED" });

    return {
      activeMemberships,
      totalDeals,
      confirmedDeals,
      successRate: totalDeals > 0 ? Math.round((confirmedDeals / totalDeals) * 100) : 0
    };
  }

  static async getSellerStats(sellerId) {
    const totalCampaigns = await BrokerageCampaign.countDocuments({ sellerId });
    const activeCampaigns = await BrokerageCampaign.countDocuments({ sellerId, state: "ACTIVE" });
    const totalDeals = await BrokerageDeal.countDocuments({ sellerId });
    const confirmedDeals = await BrokerageDeal.countDocuments({ sellerId, state: "CONFIRMED" });

    return {
      totalCampaigns,
      activeCampaigns,
      totalDeals,
      confirmedDeals,
      successRate: totalDeals > 0 ? Math.round((confirmedDeals / totalDeals) * 100) : 0
    };
  }
}
