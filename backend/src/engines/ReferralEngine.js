import { customAlphabet } from "nanoid";
import ReferralProfile from "../models/ReferralProfile.js";
import ReferralRelationship from "../models/ReferralRelationship.js";
import ReferralCommission from "../models/ReferralCommission.js";
import SystemSettings from "../models/SystemSettings.js";
import { creditReferralReward, reverseReferralCommission } from "../services/referralService.js";
import { calculateReferralReward } from "../utils/referralMath.js";

const codeGenerator = customAlphabet("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz", 10);

export default class ReferralEngine {
  static async getSettings() {
    const settings = await SystemSettings.getSettings();
    return {
      enabled: settings.referralProgram?.programEnabled !== false,
      defaultRate: settings.referralProgram?.defaultReferralRate ?? 10,
      saleRate: settings.referralProgram?.saleReferralRate ?? 10,
      safePurchaseRate: settings.referralProgram?.safePurchaseReferralRate ?? 10,
      promotionRate: settings.referralProgram?.promotionReferralRate ?? 10,
      pendingDays: settings.referralProgram?.pendingPeriod ?? 7
    };
  }

  static async ensureProfile(userId) {
    let profile = await ReferralProfile.findOne({ userId });
    if (profile) return profile;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await ReferralProfile.create({ userId, referralCode: codeGenerator() });
      } catch (error) {
        if (error.code !== 11000) throw error;
        profile = await ReferralProfile.findOne({ userId });
        if (profile) return profile;
      }
    }
    throw new Error("تعذر إنشاء رابط الإحالة");
  }

  static async findRelationship(referredUserId) {
    return ReferralRelationship.findOne({ referredUserId, status: "ACTIVE" });
  }

  static async claimAttribution(referredUserId, referralCode, admin = false) {
    const settings = await this.getSettings();
    if (!settings.enabled || !referralCode) return null;
    const profile = await ReferralProfile.findOne({ referralCode, status: "ACTIVE" });
    if (!profile || String(profile.userId) === String(referredUserId)) return null;
    const existing = await ReferralRelationship.findOne({ referredUserId });
    if (existing) return existing;
    let relationship;
    try {
      relationship = await ReferralRelationship.create({
        referrerUserId: profile.userId,
        referredUserId,
        referralCode,
        attributionMethod: admin ? "ADMIN_OVERRIDE" : "LINK",
        adminOverride: admin,
        createdBy: admin ? referredUserId : null
      });
    } catch (error) {
      if (error.code === 11000) return ReferralRelationship.findOne({ referredUserId });
      throw error;
    }
    await ReferralProfile.updateOne({ _id: profile._id }, { $inc: { totalReferredUsers: 1 } });
    return relationship;
  }

  static async createCommission({ sourceType, sourceId, referredUserId, rewardType, platformRevenueAmount, platformRevenueType, currency, rate }) {
    const relationship = await this.findRelationship(referredUserId);
    if (!relationship || relationship.status !== "ACTIVE") return null;
    const settings = await this.getSettings();
    const referralRate = Number.isFinite(rate) ? rate : settings.defaultRate;
    const commissionAmount = calculateReferralReward(platformRevenueAmount, referralRate);
    if (commissionAmount <= 0) return null;
    const pendingUntil = new Date(Date.now() + settings.pendingDays * 24 * 60 * 60 * 1000);
    try {
      const commission = await ReferralCommission.create({
        referrerUserId: relationship.referrerUserId,
        referredUserId,
        relationshipId: relationship._id,
        sourceType,
        sourceId,
        sourceEventId: `${sourceType}:${sourceId}`,
        rewardType,
        platformRevenueAmount: Number(platformRevenueAmount),
        platformRevenueType,
        referralRate,
        commissionAmount,
        currency,
        pendingUntil
      });
      return commission;
    } catch (error) {
      if (error.code === 11000) return ReferralCommission.findOne({ sourceType, sourceId, referrerUserId: relationship.referrerUserId, rewardType });
      throw error;
    }
  }

  static async processDueCommissions() {
    const due = await ReferralCommission.find({ status: "PENDING", pendingUntil: { $lte: new Date() } }).limit(100);
    for (const commission of due) await creditReferralReward(commission);
  }

  static async reverseForSource(sourceType, sourceId, reason) {
    const commissions = await ReferralCommission.find({ sourceType, sourceId, status: { $nin: ["REVERSED", "CANCELLED"] } });
    for (const commission of commissions) await reverseReferralCommission(commission._id, reason);
  }

  static async createSafePurchaseCommission(order) {
    const settings = await this.getSettings();
    return this.createCommission({
      sourceType: "SAFE_PURCHASE",
      sourceId: order._id,
      referredUserId: order.buyer,
      rewardType: "BUYER_PROTECTION",
      platformRevenueAmount: order.buyerServiceFee,
      platformRevenueType: "BUYER_PROTECTION_FEE",
      currency: order.currency,
      rate: settings.safePurchaseRate
    });
  }

  static async createPromotionCommission(purchaseRequest) {
    const settings = await this.getSettings();
    return this.createCommission({
      sourceType: "PROMOTION",
      sourceId: purchaseRequest._id,
      referredUserId: purchaseRequest.user,
      rewardType: "PROMOTION",
      platformRevenueAmount: purchaseRequest.price,
      platformRevenueType: "FEATURED_PROMOTION",
      currency: purchaseRequest.currency,
      rate: settings.promotionRate
    });
  }
}