import { Router } from "express";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import Joi from "joi";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import BrokerProfile from "../models/BrokerProfile.js";
import BrokerageCampaign from "../models/BrokerageCampaign.js";
import BrokerageMembership from "../models/BrokerageMembership.js";
import BrokerageEvidence from "../models/BrokerageEvidence.js";
import BrokerageDeal from "../models/BrokerageDeal.js";
import BrokerageComplaint from "../models/BrokerageComplaint.js";
import BrokerageReview from "../models/BrokerageReview.js";
import BrokerageAchievement from "../models/BrokerageAchievement.js";
import BrokerageBadge from "../models/BrokerageBadge.js";
import BrokerageAuditLog from "../models/BrokerageAuditLog.js";
import BrokerageConfig from "../models/BrokerageConfig.js";
import Ad from "../models/Ad.js";
import BrokerageEngine from "../engines/BrokerageEngine.js";
import AuditEngine from "../engines/AuditEngine.js";
import AchievementEngine from "../engines/AchievementEngine.js";
import BadgeEngine from "../engines/BadgeEngine.js";
import ConfigEngine from "../engines/ConfigEngine.js";

const router = Router();

// ------------------------------
// 1. Broker Profiles
// ------------------------------
router.get("/profiles/me", auth, async (req, res) => {
  try {
    let profile = await BrokerProfile.findOne({ userId: req.user.id }).lean();
    if (!profile) {
      profile = await BrokerProfile.create({
        userId: req.user.id,
        state: "INACTIVE",
        level: "BEGINNER"
      });
    }
    res.json(profile);
  } catch (err) {
    console.error("Get broker profile error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/profiles/me/activate", auth, async (req, res) => {
  try {
    const profile = await BrokerProfile.findOneAndUpdate(
      { userId: req.user.id },
      { state: "ACTIVE", lastActiveAt: new Date() },
      { new: true, upsert: true }
    ).lean();
    await AuditEngine.log(
      req.user.id,
      "USER",
      "BrokerProfile",
      profile._id,
      "BROKER_ACTIVATED",
      null,
      { state: "ACTIVE" }
    );
    res.json(profile);
  } catch (err) {
    console.error("Activate broker profile error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get any broker's public profile
router.get("/profiles/:userId", async (req, res) => {
  try {
    const profile = await BrokerProfile.findOne({ userId: req.params.userId }).lean();
    if (!profile) return res.status(404).json({ error: "Broker profile not found" });
    
    // Remove private fields from response
    const { reputation, ...publicProfile } = profile;
    res.json(publicProfile);
  } catch (err) {
    console.error("Get broker profile error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ------------------------------
// 2. Brokerage Campaigns
// ------------------------------
const createCampaignSchema = Joi.object({
  adId: Joi.string().length(24).hex().required(),
  type: Joi.string().valid("AUTO_JOIN", "MANUAL_APPROVAL", "SINGLE_BROKER", "LIMITED").required(),
  maxBrokerCount: Joi.number().min(1).when("type", {
    is: "LIMITED",
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  rewardType: Joi.string().valid("FIXED", "PERCENTAGE").required(),
  rewardValue: Joi.number().min(0).required(),
  rewardCurrency: Joi.string().default("YER_ADEN"),
  expiresAt: Joi.date().optional()
});

router.post("/campaigns", auth, requireRole(["seller"]), validateBody(createCampaignSchema), async (req, res) => {
  try {
    const campaign = await BrokerageEngine.createCampaign(req.body.adId, req.user.id, req.body);
    res.status(201).json(campaign);
  } catch (err) {
    console.error("Create campaign error:", err);
    res.status(400).json({ error: err.message || "Server error" });
  }
});

router.get("/campaigns", auth, async (req, res) => {
  try {
    const { state, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (state) filter.state = state;
    
    const campaigns = await BrokerageCampaign.find(filter)
      .populate("adId", "title price images status")
      .populate("sellerId", "name avatar isVerifiedSeller")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();
    
    const total = await BrokerageCampaign.countDocuments(filter);
    
    res.json({ 
      items: campaigns, 
      page: parseInt(page), 
      limit: parseInt(limit), 
      total, 
      pages: Math.ceil(total / limit) 
    });
  } catch (err) {
    console.error("Get campaigns error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/campaigns/my", auth, requireRole(["seller"]), async (req, res) => {
  try {
    const campaigns = await BrokerageCampaign.find({ sellerId: req.user.id })
      .populate("adId", "title price images status sold")
      .sort({ createdAt: -1 })
      .lean();
    res.json(campaigns);
  } catch (err) {
    console.error("Get my campaigns error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/campaigns/:id", async (req, res) => {
  try {
    const campaign = await BrokerageCampaign.findById(req.params.id)
      .populate("adId", "title price images description status")
      .populate("sellerId", "name avatar isVerifiedSeller")
      .lean();
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json(campaign);
  } catch (err) {
    console.error("Get campaign error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/campaigns/:id/suspend", auth, requireRole(["seller", "admin"]), validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })), async (req, res) => {
  try {
    const campaign = await BrokerageCampaign.findOne({ _id: req.params.id });
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    if (campaign.sellerId.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }
    
    if (!["ACTIVE", "SUSPENDED"].includes(campaign.state)) {
      return res.status(400).json({ error: "Cannot suspend campaign in current state" });
    }
    
    const newState = campaign.state === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    campaign.state = newState;
    await campaign.save();
    
    await AuditEngine.log(
      req.user.id,
      "USER",
      "BrokerageCampaign",
      campaign._id,
      newState === "SUSPENDED" ? "CAMPAIGN_SUSPENDED" : "CAMPAIGN_ACTIVATED",
      { state: campaign.state },
      { state: newState }
    );
    
    res.json(campaign);
  } catch (err) {
    console.error("Suspend campaign error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ------------------------------
// 3. Brokerage Memberships
// ------------------------------
router.post("/campaigns/:id/join", auth, validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })), async (req, res) => {
  try {
    const campaign = await BrokerageCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    const membership = await BrokerageEngine.joinCampaign(
      campaign.adId.toString(), 
      req.user.id, 
      req.clientIp, 
      req.headers["user-agent"]
    );
    res.status(201).json(membership);
  } catch (err) {
    console.error("Join campaign error:", err);
    res.status(400).json({ error: err.message || "Server error" });
  }
});

router.get("/memberships/my", auth, async (req, res) => {
  try {
    const brokerProfile = await BrokerProfile.findOne({ userId: req.user.id });
    if (!brokerProfile) return res.json([]);
    
    const { state, page = 1, limit = 20 } = req.query;
    const filter = { brokerProfileId: brokerProfile._id };
    if (state) filter.state = state;
    
    const memberships = await BrokerageMembership.find(filter)
      .populate({
        path: "campaignId",
        populate: [
          { path: "adId", select: "title price images" },
          { path: "sellerId", select: "name avatar" }
        ]
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();
    
    res.json(memberships);
  } catch (err) {
    console.error("Get my memberships error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/campaigns/:id/memberships", auth, requireRole(["seller", "admin"]), async (req, res) => {
  try {
    const campaign = await BrokerageCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    if (campaign.sellerId.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }
    
    const { state, page = 1, limit = 20 } = req.query;
    const filter = { campaignId: campaign._id };
    if (state) filter.state = state;
    
    const memberships = await BrokerageMembership.find(filter)
      .populate({
        path: "brokerProfileId",
        populate: { path: "userId", select: "name avatar" }
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();
    
    res.json(memberships);
  } catch (err) {
    console.error("Get campaign memberships error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/memberships/:id/approve", auth, requireRole(["seller"]), validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })), async (req, res) => {
  try {
    const membership = await BrokerageEngine.approveMembership(req.params.id, req.user.id);
    res.json(membership);
  } catch (err) {
    console.error("Approve membership error:", err);
    res.status(400).json({ error: err.message || "Server error" });
  }
});

router.patch("/memberships/:id/reject", auth, requireRole(["seller"]), validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })), validateBody(Joi.object({ reason: Joi.string().optional() })), async (req, res) => {
  try {
    const membership = await BrokerageEngine.rejectMembership(req.params.id, req.user.id, req.body.reason);
    res.json(membership);
  } catch (err) {
    console.error("Reject membership error:", err);
    res.status(400).json({ error: err.message || "Server error" });
  }
});

router.patch("/memberships/:id/withdraw", auth, validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })), async (req, res) => {
  try {
    const membership = await BrokerageEngine.withdrawMembership(req.params.id, req.user.id);
    res.json(membership);
  } catch (err) {
    console.error("Withdraw membership error:", err);
    res.status(400).json({ error: err.message || "Server error" });
  }
});

// ------------------------------
// 4. Brokerage Evidence
// ------------------------------
const createEvidenceSchema = Joi.object({
  adId: Joi.string().length(24).hex().required(),
  type: Joi.string().valid(
    "INTERNAL_QR_SCAN", "INTERNAL_REFERRAL_LINK", "REFERRAL_CODE_ENTERED", 
    "INTERNAL_PLATFORM_MESSAGE", "MANUAL_INTERNAL_SCREENSHOT", 
    "MANUAL_EXTERNAL_SCREENSHOT", "MANUAL_TEXT_ONLY"
  ).required(),
  referralCode: Joi.string().optional(),
  metadata: Joi.object().optional(),
  notes: Joi.string().max(500).optional()
});

router.post("/evidence", auth, validateBody(createEvidenceSchema), async (req, res) => {
  try {
    const { adId, type, referralCode, metadata, notes } = req.body;
    const evidence = await BrokerageEngine.trackEvidence(
      adId, 
      req.user.id, 
      type, 
      { ...metadata, referralCode },
      req.clientIp,
      req.headers["user-agent"]
    );
    if (!evidence) return res.status(404).json({ error: "Active campaign not found for this ad" });
    res.status(201).json(evidence);
  } catch (err) {
    console.error("Create evidence error:", err);
    res.status(400).json({ error: err.message || "Server error" });
  }
});

router.get("/memberships/:id/evidence", auth, async (req, res) => {
  try {
    const membership = await BrokerageMembership.findById(req.params.id);
    if (!membership) return res.status(404).json({ error: "Membership not found" });
    
    const brokerProfile = await BrokerProfile.findById(membership.brokerProfileId);
    const campaign = await BrokerageCampaign.findById(membership.campaignId);
    
    // Check if user is the broker or the seller or admin
    if (
      brokerProfile.userId.toString() !== req.user.id && 
      campaign.sellerId.toString() !== req.user.id && 
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ error: "Not authorized" });
    }
    
    const evidences = await BrokerageEvidence.find({ membershipId: req.params.id })
      .populate("adId", "title")
      .populate("buyerId", "name")
      .sort({ createdAt: -1 })
      .lean();
    
    res.json(evidences);
  } catch (err) {
    console.error("Get membership evidence error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ------------------------------
// 5. Brokerage Deals
// ------------------------------
const createDealSchema = Joi.object({
  adId: Joi.string().length(24).hex().required(),
  brokerProfileId: Joi.string().length(24).hex().required(),
  buyerId: Joi.string().length(24).hex().required(),
  finalAdPrice: Joi.number().min(0).required(),
  finalAdCurrency: Joi.string().default("YER_ADEN"),
  primaryEvidenceId: Joi.string().length(24).hex().optional()
});

router.post("/deals", auth, requireRole(["seller"]), validateBody(createDealSchema), async (req, res) => {
  try {
    const deal = await BrokerageEngine.createDeal(
      req.body.adId,
      req.user.id,
      req.body.brokerProfileId,
      req.body.buyerId,
      req.body.finalAdPrice,
      req.body.finalAdCurrency,
      req.body.primaryEvidenceId
    );
    res.status(201).json(deal);
  } catch (err) {
    console.error("Create deal error:", err);
    res.status(400).json({ error: err.message || "Server error" });
  }
});

router.get("/deals/my", auth, async (req, res) => {
  try {
    const { state, role = "all", page = 1, limit = 20 } = req.query;
    const filter = {};
    
    if (state) filter.state = state;
    
    if (role === "seller") {
      filter.sellerId = req.user.id;
    } else if (role === "broker") {
      const brokerProfile = await BrokerProfile.findOne({ userId: req.user.id });
      if (brokerProfile) filter.brokerProfileId = brokerProfile._id;
      else return res.json([]);
    } else if (role === "buyer") {
      filter.buyerId = req.user.id;
    } else {
      // All roles
      const brokerProfile = await BrokerProfile.findOne({ userId: req.user.id });
      filter.$or = [
        { sellerId: req.user.id },
        { buyerId: req.user.id }
      ];
      if (brokerProfile) {
        filter.$or.push({ brokerProfileId: brokerProfile._id });
      }
    }
    
    const deals = await BrokerageDeal.find(filter)
      .populate("adId", "title price images")
      .populate("sellerId", "name avatar")
      .populate("buyerId", "name avatar")
      .populate({
        path: "brokerProfileId",
        populate: { path: "userId", select: "name avatar" }
      })
      .populate("primaryEvidenceId")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();
    
    res.json(deals);
  } catch (err) {
    console.error("Get my deals error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/deals/:id", auth, async (req, res) => {
  try {
    const deal = await BrokerageDeal.findById(req.params.id)
      .populate("adId", "title price images description")
      .populate("sellerId", "name avatar")
      .populate("buyerId", "name avatar")
      .populate({
        path: "brokerProfileId",
        populate: { path: "userId", select: "name avatar" }
      })
      .populate("membershipId")
      .populate("primaryEvidenceId")
      .lean();
    
    if (!deal) return res.status(404).json({ error: "Deal not found" });
    
    // Check authorization
    const brokerProfile = await BrokerProfile.findById(deal.brokerProfileId);
    if (
      deal.sellerId.toString() !== req.user.id &&
      deal.buyerId.toString() !== req.user.id &&
      brokerProfile.userId.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ error: "Not authorized" });
    }
    
    res.json(deal);
  } catch (err) {
    console.error("Get deal error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/deals/:id/confirm-broker", auth, validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })), async (req, res) => {
  try {
    const deal = await BrokerageEngine.confirmDealAsBroker(req.params.id, req.user.id);
    res.json(deal);
  } catch (err) {
    console.error("Confirm deal as broker error:", err);
    res.status(400).json({ error: err.message || "Server error" });
  }
});

router.patch("/deals/:id/confirm-buyer", auth, validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })), async (req, res) => {
  try {
    const deal = await BrokerageEngine.confirmDealAsBuyer(req.params.id, req.user.id);
    res.json(deal);
  } catch (err) {
    console.error("Confirm deal as buyer error:", err);
    res.status(400).json({ error: err.message || "Server error" });
  }
});

// ------------------------------
// 6. Brokerage Complaints
// ------------------------------
const createComplaintSchema = Joi.object({
  dealId: Joi.string().length(24).hex().optional(),
  membershipId: Joi.string().length(24).hex().optional(),
  campaignId: Joi.string().length(24).hex().optional(),
  againstUserId: Joi.string().length(24).hex().required(),
  againstParty: Joi.string().valid("SELLER", "BROKER", "BUYER").required(),
  reason: Joi.string().min(10).max(1000).required(),
  evidenceUrls: Joi.array().items(Joi.string()).optional()
});

router.post("/complaints", auth, validateBody(createComplaintSchema), async (req, res) => {
  try {
    const { dealId, membershipId, campaignId, againstUserId, againstParty, reason, evidenceUrls } = req.body;
    
    // Determine complainant party
    let complainantParty = "BUYER";
    const brokerProfile = await BrokerProfile.findOne({ userId: req.user.id });
    
    // Check if user is a seller with active campaigns
    const sellerCampaigns = await BrokerageCampaign.countDocuments({ sellerId: req.user.id });
    if (sellerCampaigns > 0) complainantParty = "SELLER";
    else if (brokerProfile) complainantParty = "BROKER";
    
    const complaint = await BrokerageComplaint.create({
      dealId,
      membershipId,
      campaignId,
      complainantId: req.user.id,
      complainantParty,
      againstUserId,
      againstParty,
      reason,
      evidenceUrls,
      state: "PENDING_MODERATION"
    });
    
    await AuditEngine.log(
      req.user.id,
      "USER",
      "BrokerageComplaint",
      complaint._id,
      "COMPLAINT_CREATED",
      null,
      { reason, againstUserId }
    );
    
    res.status(201).json(complaint);
  } catch (err) {
    console.error("Create complaint error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/complaints/my", auth, async (req, res) => {
  try {
    const { state, page = 1, limit = 20 } = req.query;
    const filter = {
      $or: [
        { complainantId: req.user.id },
        { againstUserId: req.user.id }
      ]
    };
    
    if (state) filter.state = state;
    
    const complaints = await BrokerageComplaint.find(filter)
      .populate("complainantId", "name avatar")
      .populate("againstUserId", "name avatar")
      .populate("dealId")
      .populate("membershipId")
      .populate("campaignId")
      .populate("resolvedBy", "name")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();
    
    res.json(complaints);
  } catch (err) {
    console.error("Get my complaints error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Moderator-only: Get all complaints
router.get("/complaints", auth, requireRole(["admin", "moderator"]), async (req, res) => {
  try {
    const { state, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (state) filter.state = state;
    
    const complaints = await BrokerageComplaint.find(filter)
      .populate("complainantId", "name avatar")
      .populate("againstUserId", "name avatar")
      .populate("dealId")
      .populate("membershipId")
      .populate("campaignId")
      .populate("resolvedBy", "name")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();
    
    const total = await BrokerageComplaint.countDocuments(filter);
    
    res.json({ 
      items: complaints, 
      page: parseInt(page), 
      limit: parseInt(limit), 
      total, 
      pages: Math.ceil(total / limit) 
    });
  } catch (err) {
    console.error("Get complaints error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Moderator-only: Resolve complaint
router.patch("/complaints/:id/resolve", auth, requireRole(["admin", "moderator"]), validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })), validateBody(Joi.object({
  resolution: Joi.string().valid("RESOLVED_IN_FAVOR", "RESOLVED_AGAINST", "REJECTED").required(),
  moderatorNotes: Joi.string().optional()
})), async (req, res) => {
  try {
    const complaint = await BrokerageComplaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ error: "Complaint not found" });
    
    complaint.state = req.body.resolution;
    complaint.moderatorNotes = req.body.moderatorNotes;
    complaint.resolvedAt = new Date();
    complaint.resolvedBy = req.user.id;
    await complaint.save();
    
    await AuditEngine.log(
      req.user.id,
      "MODERATOR",
      "BrokerageComplaint",
      complaint._id,
      "COMPLAINT_RESOLVED",
      { state: "PENDING_MODERATION" },
      { state: req.body.resolution }
    );
    
    res.json(complaint);
  } catch (err) {
    console.error("Resolve complaint error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ------------------------------
// 7. Brokerage Reviews
// ------------------------------
const createReviewSchema = Joi.object({
  dealId: Joi.string().length(24).hex().required(),
  subjectId: Joi.string().length(24).hex().required(),
  subjectType: Joi.string().valid("BROKER", "SELLER").required(),
  rating: Joi.number().min(1).max(5).required(),
  title: Joi.string().max(100).optional(),
  text: Joi.string().min(10).max(1000).required()
});

router.post("/reviews", auth, validateBody(createReviewSchema), async (req, res) => {
  try {
    const { dealId, subjectId, subjectType, rating, title, text } = req.body;
    
    // Verify deal exists and user is involved
    const deal = await BrokerageDeal.findById(dealId);
    if (!deal) return res.status(404).json({ error: "Deal not found" });
    
    if (
      deal.sellerId.toString() !== req.user.id && 
      deal.buyerId.toString() !== req.user.id
    ) {
      return res.status(403).json({ error: "Not authorized to review this deal" });
    }
    
    // Check if review already exists
    const existingReview = await BrokerageReview.findOne({ dealId, authorId: req.user.id });
    if (existingReview) return res.status(400).json({ error: "Review already submitted for this deal" });
    
    const review = await BrokerageReview.create({
      dealId,
      authorId: req.user.id,
      subjectId,
      subjectType,
      rating,
      title,
      text,
      state: "SUBMITTED"
    });
    
    await AuditEngine.log(
      req.user.id,
      "USER",
      "BrokerageReview",
      review._id,
      "REVIEW_CREATED",
      null,
      { rating, subjectId }
    );
    
    res.status(201).json(review);
  } catch (err) {
    console.error("Create review error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/reviews/user/:userId", async (req, res) => {
  try {
    const { subjectType, page = 1, limit = 20 } = req.query;
    const filter = { 
      subjectId: req.params.userId, 
      state: "APPROVED" 
    };
    
    if (subjectType) filter.subjectType = subjectType;
    
    const reviews = await BrokerageReview.find(filter)
      .populate("authorId", "name avatar")
      .populate("dealId")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();
    
    const totalReviews = await BrokerageReview.countDocuments({ 
      subjectId: req.params.userId, 
      state: "APPROVED" 
    });
    
    const avgRating = totalReviews > 0 
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews 
      : 0;
    
    res.json({
      items: reviews,
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalReviews,
      pages: Math.ceil(totalReviews / limit),
      averageRating: Math.round(avgRating * 10) / 10
    });
  } catch (err) {
    console.error("Get user reviews error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Moderator-only: Approve/Reject review
router.patch("/reviews/:id/moderate", auth, requireRole(["admin", "moderator"]), validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })), validateBody(Joi.object({
  state: Joi.string().valid("APPROVED", "REJECTED").required(),
  moderatorNotes: Joi.string().optional()
})), async (req, res) => {
  try {
    const review = await BrokerageReview.findById(req.params.id);
    if (!review) return res.status(404).json({ error: "Review not found" });
    
    review.state = req.body.state;
    review.moderatorNotes = req.body.moderatorNotes;
    review.approvedAt = req.body.state === "APPROVED" ? new Date() : null;
    review.approvedBy = req.user.id;
    await review.save();
    
    await AuditEngine.log(
      req.user.id,
      "MODERATOR",
      "BrokerageReview",
      review._id,
      req.body.state === "APPROVED" ? "REVIEW_APPROVED" : "REVIEW_REJECTED",
      { state: "SUBMITTED" },
      { state: req.body.state }
    );
    
    res.json(review);
  } catch (err) {
    console.error("Moderate review error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ------------------------------
// 8. Achievements & Badges
// ------------------------------
router.get("/achievements/my", auth, async (req, res) => {
  try {
    const achievements = await BrokerageAchievement.find({ userId: req.user.id }).sort({ unlockedAt: -1 }).lean();
    res.json(achievements);
  } catch (err) {
    console.error("Get my achievements error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/badges/my", auth, async (req, res) => {
  try {
    const badges = await BrokerageBadge.find({ userId: req.user.id })
      .populate("achievementIds")
      .sort({ unlockedAt: -1 })
      .lean();
    res.json(badges);
  } catch (err) {
    console.error("Get my badges error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get any user's badges
router.get("/badges/user/:userId", async (req, res) => {
  try {
    const badges = await BrokerageBadge.find({ userId: req.params.userId })
      .populate("achievementIds")
      .sort({ unlockedAt: -1 })
      .lean();
    res.json(badges);
  } catch (err) {
    console.error("Get user badges error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ------------------------------
// 9. Audit Log
// ------------------------------
router.get("/audit/entity/:entityType/:entityId", auth, requireRole(["admin", "moderator"]), async (req, res) => {
  try {
    const logs = await AuditEngine.getEntityHistory(req.params.entityType, req.params.entityId, 100);
    res.json(logs);
  } catch (err) {
    console.error("Get audit history error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ------------------------------
// 10. Configuration (Admin only)
// ------------------------------
router.get("/config", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const configs = await ConfigEngine.getAll();
    res.json(configs);
  } catch (err) {
    console.error("Get config error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/config/:key", auth, requireRole(["admin"]), validateParams(Joi.object({ key: Joi.string().required() })), validateBody(Joi.object({
  value: Joi.any().required(),
  description: Joi.string().optional()
})), async (req, res) => {
  try {
    const updated = await ConfigEngine.update(
      req.params.key, 
      req.body.value, 
      req.user.id, 
      req.body.description
    );
    res.json(updated);
  } catch (err) {
    console.error("Update config error:", err);
    res.status(400).json({ error: err.message || "Server error" });
  }
});

// ------------------------------
// 11. Analytics
// ------------------------------
router.get("/analytics/platform", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const stats = await import("../engines/AnalyticsEngine.js");
    const platformStats = await stats.default.getPlatformStats();
    res.json(platformStats);
  } catch (err) {
    console.error("Get platform analytics error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/analytics/broker/:brokerProfileId", auth, async (req, res) => {
  try {
    const stats = await import("../engines/AnalyticsEngine.js");
    const brokerStats = await stats.default.getBrokerStats(req.params.brokerProfileId);
    res.json(brokerStats);
  } catch (err) {
    console.error("Get broker analytics error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/analytics/seller/my", auth, requireRole(["seller"]), async (req, res) => {
  try {
    const stats = await import("../engines/AnalyticsEngine.js");
    const sellerStats = await stats.default.getSellerStats(req.user.id);
    res.json(sellerStats);
  } catch (err) {
    console.error("Get seller analytics error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;