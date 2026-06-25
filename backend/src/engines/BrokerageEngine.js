import BrokerProfile from "../models/BrokerProfile.js";
import BrokerageCampaign from "../models/BrokerageCampaign.js";
import BrokerageMembership from "../models/BrokerageMembership.js";
import BrokerageEvidence from "../models/BrokerageEvidence.js";
import BrokerageDeal from "../models/BrokerageDeal.js";
import CampaignStateMachine from "../state-machines/CampaignStateMachine.js";
import MembershipStateMachine from "../state-machines/MembershipStateMachine.js";
import EvidenceStateMachine from "../state-machines/EvidenceStateMachine.js";
import DealStateMachine from "../state-machines/DealStateMachine.js";
import AuditEngine from "./AuditEngine.js";
import ConfigEngine from "./ConfigEngine.js";
import ReputationEngine from "./ReputationEngine.js";
import { v4 as uuidv4 } from "uuid";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz", 8);

export default class BrokerageEngine {
  static async createCampaign(adId, sellerId, data) {
    const { type, maxBrokerCount, rewardType, rewardValue, rewardCurrency, expiresAt } = data;
    const minReputation = await ConfigEngine.get("security.min_broker_reputation", 100);

    // Check existing campaign for this ad
    const existing = await BrokerageCampaign.findOne({ adId, state: { $nin: ["DEAL_CONFIRMED", "ARCHIVED"] } });
    if (existing) throw new Error("Active campaign already exists for this ad");

    // Validate reward
    if (rewardType === "FIXED") {
      const minFixedReward = await ConfigEngine.get("rewards.min_fixed_reward", 100);
      if (rewardValue < minFixedReward) {
        throw new Error(`Minimum fixed reward is ${minFixedReward}`);
      }
    } else if (rewardType === "PERCENTAGE") {
      const minPct = await ConfigEngine.get("rewards.min_percentage_reward", 1);
      const maxPct = await ConfigEngine.get("rewards.max_percentage_reward", 30);
      if (rewardValue < minPct || rewardValue > maxPct) {
        throw new Error(`Percentage reward must be between ${minPct}% and ${maxPct}%`);
      }
    }

    const campaign = await BrokerageCampaign.create({
      adId,
      sellerId,
      type,
      maxBrokerCount: type === "LIMITED" ? maxBrokerCount : null,
      rewardType,
      rewardValue,
      rewardCurrency,
      expiresAt,
      state: "ACTIVE"
    });

    await AuditEngine.log(
      sellerId,
      "USER",
      "BrokerageCampaign",
      campaign._id,
      "CAMPAIGN_CREATED",
      null,
      { state: "ACTIVE" }
    );

    return campaign;
  }

  static async joinCampaign(adId, userId, ipAddress = null, userAgent = null) {
    // Get or create broker profile
    let brokerProfile = await BrokerProfile.findOne({ userId });
    if (!brokerProfile) {
      brokerProfile = await BrokerProfile.create({
        userId,
        state: "ACTIVE"
      });
    }

    // Check broker eligibility
    const minReputation = await ConfigEngine.get("security.min_broker_reputation", 100);
    const { score: reputation } = await ReputationEngine.calculateReputation(userId);
    if (reputation < minReputation) {
      throw new Error(`Your reputation is too low. Minimum required: ${minReputation}`);
    }

    const campaign = await BrokerageCampaign.findOne({ adId, state: "ACTIVE" });
    if (!campaign) throw new Error("Active campaign not found for this ad");

    // Check if already joined
    const existingMembership = await BrokerageMembership.findOne({
      campaignId: campaign._id,
      brokerProfileId: brokerProfile._id,
      state: { $nin: ["REJECTED", "BANNED", "EXPIRED", "ARCHIVED"] }
    });
    if (existingMembership) {
      return existingMembership;
    }

    // Check max brokers if LIMITED
    if (campaign.type === "LIMITED") {
      const currentCount = await BrokerageMembership.countDocuments({
        campaignId: campaign._id,
        state: { $in: ["ACTIVE", "APPROVED", "REQUEST_SENT", "AUTO_ACTIVE"] }
      });
      if (currentCount >= campaign.maxBrokerCount) {
        throw new Error("This campaign has reached the maximum number of brokers");
      }
    }

    const referralCode = nanoid();
    const initialState = campaign.type === "AUTO_JOIN" ? "AUTO_ACTIVE" : "REQUEST_SENT";
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    const membership = await BrokerageMembership.create({
      campaignId: campaign._id,
      brokerProfileId: brokerProfile._id,
      referralCode,
      referralLink: `${baseUrl}/ads/${adId}?ref=${referralCode}`,
      state: initialState
    });

    await AuditEngine.log(
      userId,
      "USER",
      "BrokerageMembership",
      membership._id,
      initialState === "REQUEST_SENT" ? "MEMBERSHIP_REQUEST_SENT" : "MEMBERSHIP_AUTO_ACTIVATED",
      null,
      { state: initialState, referralCode },
      {},
      ipAddress,
      userAgent
    );

    return membership;
  }

  static async approveMembership(membershipId, sellerId) {
    const membership = await BrokerageMembership.findById(membershipId).populate("campaignId");
    if (!membership) throw new Error("Membership not found");
    if (String(membership.campaignId.sellerId) !== String(sellerId)) {
      throw new Error("Not authorized to approve this membership");
    }

    MembershipStateMachine.transition(membership, "APPROVED");
    MembershipStateMachine.transition(membership, "ACTIVE");

    await membership.save();

    await AuditEngine.log(
      sellerId,
      "USER",
      "BrokerageMembership",
      membership._id,
      "MEMBERSHIP_APPROVED",
      { state: "REQUEST_SENT" },
      { state: "ACTIVE" }
    );

    return membership;
  }

  static async rejectMembership(membershipId, sellerId, reason = null) {
    const membership = await BrokerageMembership.findById(membershipId).populate("campaignId");
    if (!membership) throw new Error("Membership not found");
    if (String(membership.campaignId.sellerId) !== String(sellerId)) {
      throw new Error("Not authorized to reject this membership");
    }

    MembershipStateMachine.transition(membership, "REJECTED");
    membership.rejectedReason = reason;
    membership.rejectedAt = new Date();
    await membership.save();

    await AuditEngine.log(
      sellerId,
      "USER",
      "BrokerageMembership",
      membership._id,
      "MEMBERSHIP_REJECTED",
      { state: "REQUEST_SENT" },
      { state: "REJECTED", reason }
    );

    return membership;
  }

  static async withdrawMembership(membershipId, userId) {
    const membership = await BrokerageMembership.findById(membershipId).populate("brokerProfileId");
    if (!membership) throw new Error("Membership not found");
    if (String(membership.brokerProfileId.userId) !== String(userId)) {
      throw new Error("Not authorized to withdraw this membership");
    }

    MembershipStateMachine.transition(membership, "WITHDRAWN");
    membership.withdrawnAt = new Date();
    await membership.save();

    await AuditEngine.log(
      userId,
      "USER",
      "BrokerageMembership",
      membership._id,
      "MEMBERSHIP_WITHDRAWN",
      { state: "ACTIVE" },
      { state: "WITHDRAWN" }
    );

    return membership;
  }

  static async trackEvidence(adId, userId, evidenceType, metadata = {}, ipAddress = null, userAgent = null) {
    const campaign = await BrokerageCampaign.findOne({ adId, state: "ACTIVE" });
    if (!campaign) return null;

    let membership = null;

    // Find membership by referral code (if present in metadata)
    if (metadata.referralCode) {
      membership = await BrokerageMembership.findOne({ referralCode: metadata.referralCode });
    }

    if (!membership) return null;

    // Get evidence weight/rank
    const evidenceRank = this._getEvidenceRank(evidenceType);

    const evidence = await BrokerageEvidence.create({
      membershipId: membership._id,
      adId,
      buyerId: userId,
      type: evidenceType,
      rank: evidenceRank,
      data: metadata,
      state: "CREATED"
    });

    EvidenceStateMachine.transition(evidence, "VERIFIED"); // Auto-verify platform-generated evidence
    evidence.verifiedAt = new Date();
    await evidence.save();

    await AuditEngine.log(
      null,
      "SYSTEM",
      "BrokerageEvidence",
      evidence._id,
      "EVIDENCE_CREATED",
      null,
      { type: evidenceType, rank: evidenceRank },
      {},
      ipAddress,
      userAgent
    );

    return evidence;
  }

  static async createDeal(adId, sellerId, brokerId, buyerId, finalAdPrice, finalAdCurrency, primaryEvidenceId = null) {
    const campaign = await BrokerageCampaign.findOne({ adId, state: "ACTIVE" });
    if (!campaign) throw new Error("Active campaign not found for this ad");

    const membership = await BrokerageMembership.findOne({
      campaignId: campaign._id,
      brokerProfileId: brokerId,
      state: "ACTIVE"
    });
    if (!membership) throw new Error("Broker not a member of this campaign");

    // Check if deal already exists for this ad
    const existingDeal = await BrokerageDeal.findOne({ adId });
    if (existingDeal) throw new Error("Deal already exists for this ad");

    // Validate minimum time after join
    const minTimeHours = await ConfigEngine.get("deals.min_time_after_join_hours", 4);
    const timeSinceJoin = (Date.now() - membership.createdAt.getTime()) / (1000 * 60 * 60);
    if (timeSinceJoin < minTimeHours) {
      throw new Error(`Cannot create deal within ${minTimeHours} hours of joining campaign`);
    }

    const deal = await BrokerageDeal.create({
      adId,
      sellerId,
      brokerProfileId: brokerId,
      buyerId,
      membershipId: membership._id,
      state: "PENDING_BROKER_CONFIRM",
      rewardType: campaign.rewardType, // Copy immutable reward
      rewardValue: campaign.rewardValue,
      rewardCurrency: campaign.rewardCurrency,
      finalAdPrice,
      finalAdCurrency,
      primaryEvidenceId
    });

    await AuditEngine.log(
      sellerId,
      "USER",
      "BrokerageDeal",
      deal._id,
      "DEAL_PENDING_BROKER_CONFIRM",
      null,
      { state: "PENDING_BROKER_CONFIRM" }
    );

    return deal;
  }

  static async confirmDealAsBroker(dealId, brokerUserId) {
    const deal = await BrokerageDeal.findById(dealId).populate("brokerProfileId");
    if (!deal) throw new Error("Deal not found");
    if (String(deal.brokerProfileId.userId) !== String(brokerUserId)) {
      throw new Error("Not authorized to confirm this deal");
    }

    DealStateMachine.transition(deal, "PENDING_BUYER_CONFIRM");
    deal.brokerConfirmedAt = new Date();
    await deal.save();

    await AuditEngine.log(
      brokerUserId,
      "USER",
      "BrokerageDeal",
      deal._id,
      "DEAL_PENDING_BUYER_CONFIRM",
      { state: "PENDING_BROKER_CONFIRM" },
      { state: "PENDING_BUYER_CONFIRM" }
    );

    return deal;
  }

  static async confirmDealAsBuyer(dealId, buyerUserId) {
    const deal = await BrokerageDeal.findById(dealId).populate("membershipId adId brokerProfileId");
    if (!deal) throw new Error("Deal not found");
    if (String(deal.buyerId) !== String(buyerUserId)) {
      throw new Error("Not authorized to confirm this deal");
    }

    DealStateMachine.transition(deal, "CONFIRMED");
    deal.buyerConfirmedAt = new Date();
    await deal.save();

    // Update campaign state
    const campaign = await BrokerageCampaign.findById(deal.membershipId.campaignId);
    CampaignStateMachine.transition(campaign, "DEAL_CONFIRMED");
    await campaign.save();

    // Update broker profile
    const brokerProfile = await BrokerProfile.findById(deal.brokerProfileId._id);
    brokerProfile.successfulDealCount += 1;
    brokerProfile.lastActiveAt = new Date();
    await brokerProfile.save();

    // Update reputation
    await ReputationEngine.calculateReputation(brokerProfile.userId);

    await AuditEngine.log(
      buyerUserId,
      "USER",
      "BrokerageDeal",
      deal._id,
      "DEAL_CONFIRMED",
      { state: "PENDING_BUYER_CONFIRM" },
      { state: "CONFIRMED" }
    );

    return deal;
  }

  static _getEvidenceRank(evidenceType) {
    const ranks = {
      "INTERNAL_QR_SCAN": 100,
      "INTERNAL_REFERRAL_LINK": 90,
      "REFERRAL_CODE_ENTERED": 80,
      "INTERNAL_PLATFORM_MESSAGE": 70,
      "MANUAL_INTERNAL_SCREENSHOT": 50,
      "MANUAL_EXTERNAL_SCREENSHOT": 30,
      "MANUAL_TEXT_ONLY": 10
    };
    return ranks[evidenceType] || 10;
  }
}
