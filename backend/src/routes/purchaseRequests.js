import { Router } from "express";
import path from "path";
import auth from "../middleware/auth.js";
import optionalAuth from "../middleware/optionalAuth.js";
import { requireRole } from "../middleware/roles.js";
import Plan from "../models/Plan.js";
import PurchaseRequest from "../models/PurchaseRequest.js";
import AdCampaignImpression from "../models/AdCampaignImpression.js";
import User from "../models/User.js";
import Ad from "../models/Ad.js";
import Notification from "../models/Notification.js";
import { createAdminNotification, createNotification } from "../services/notificationService.js";
import { uploadReceipt, processImage } from "../middleware/upload.js";
import { sendEmail } from "../utils/sendEmail.js";
import { getFinalPrice } from "../utils/planUtils.js";
import SystemSettings from "../models/SystemSettings.js";
import ReferralEngine from "../engines/ReferralEngine.js";
import { findDraftActionResult, getIncompleteDraftForSubmission, markDraftCompleted } from "../services/draftActions.js";
import {
  getCampaignWindow,
  isCampaignAvailable,
  isImpressionEligible,
  isValidCampaignWindow,
  getCampaignPositions,
  getCampaignServiceType
} from "../utils/adCampaigns.js";

const router = Router();

const CAMPAIGN_PLAN_FIELDS = "name type durationInDays adServiceType adPositions interstitialDelaySeconds frequencyCapHours socialPromotionIncluded socialPromotionPrice";
const PLACEMENT_PLAN_FIELDS = `${CAMPAIGN_PLAN_FIELDS} rotationIntervalSeconds`;

function isCampaignAdEligible(ad) {
  return Boolean(
    ad
    && ad.status === "approved"
    && ad.isDeleted !== true
    && ad.isVisible !== false
    && ad.sold !== true
    && Array.isArray(ad.images)
    && ad.images.length > 0
  );
}

router.get("/campaigns", optionalAuth, async (req, res) => {
  try {
    const { position, type } = req.query;
    const now = new Date();
    if (type && type !== "interstitial") {
      return res.status(400).json({ error: "Invalid campaign type" });
    }
    const requestedServiceType = type === "interstitial" ? "interstitial" : "placement";
    if (type !== "interstitial" && !["home", "between_ads", "category"].includes(position)) {
      return res.status(400).json({ error: "Invalid campaign placement" });
    }

    const campaigns = await PurchaseRequest.find({
      status: "Approved",
      "campaign.serviceType": requestedServiceType,
      ...(requestedServiceType === "placement" ? { "campaign.positions": position } : {}),
      "campaign.isActive": true,
      "campaign.startsAt": { $lte: now },
      "campaign.endsAt": { $gt: now }
    })
      .populate({
        path: "plan",
        match: { type: "featured" },
        select: requestedServiceType === "placement" ? PLACEMENT_PLAN_FIELDS : CAMPAIGN_PLAN_FIELDS
      })
      .populate({ path: "product", select: "title images status isDeleted isVisible sold" })
      .sort({ "campaign.activatedAt": -1 })
      .limit(requestedServiceType === "placement" ? 10 : 30)
      .lean();
    const eligible = campaigns.filter((campaign) =>
      isCampaignAvailable(campaign, now)
      && getCampaignServiceType(campaign) === requestedServiceType
      && (requestedServiceType === "interstitial" || getCampaignPositions(campaign).includes(position))
      && isCampaignAdEligible(campaign.product)
    );

    let result = eligible;
    if (type === "interstitial" && req.user?.id && eligible.length) {
      const impressions = await AdCampaignImpression.find({
        campaignId: { $in: eligible.map(({ _id }) => _id) },
        userId: req.user.id,
        nextEligibleAt: { $gt: now }
      }).select("campaignId").lean();
      const suppressed = new Set(impressions.map(({ campaignId }) => String(campaignId)));
      result = eligible.filter(({ _id }) => !suppressed.has(String(_id))).slice(0, 1);
    } else if (type === "interstitial") {
      result = eligible.slice(0, 1);
    }

    res.json(result.map((campaign) => ({
      _id: campaign._id,
      product: {
        _id: campaign.product._id,
        title: campaign.product.title,
        image: campaign.product.images[0]
      },
      serviceType: getCampaignServiceType(campaign),
      ...(requestedServiceType === "placement" ? {
        endsAt: campaign.campaign.endsAt,
        rotationIntervalSeconds: campaign.campaign.rotationIntervalSeconds
          ?? campaign.plan.rotationIntervalSeconds
          ?? 5
      } : {}),
      delaySeconds: campaign.campaign.delaySeconds ?? campaign.plan.interstitialDelaySeconds,
      frequencyCapHours: campaign.campaign.frequencyCapHours ?? campaign.plan.frequencyCapHours
    })));
  } catch (error) {
    console.error("Failed to load ad campaigns:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/campaigns/:id/impression", optionalAuth, async (req, res) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ error: "Invalid campaign" });
    const now = new Date();
    const campaign = await PurchaseRequest.findOne({
      _id: req.params.id,
      status: "Approved",
      "campaign.isActive": true,
      "campaign.startsAt": { $lte: now },
      "campaign.endsAt": { $gt: now }
    })
      .populate({ path: "plan", match: { type: "featured" }, select: CAMPAIGN_PLAN_FIELDS })
      .populate({ path: "product", select: "title images status isDeleted isVisible sold" })
      .lean();
    if (!campaign || !isCampaignAvailable(campaign, now)
      || getCampaignServiceType(campaign) !== "interstitial"
      || !isCampaignAdEligible(campaign.product)) {
      return res.status(404).json({ error: "Campaign is not available" });
    }

    if (req.user?.id) {
      const frequencyCapHours = campaign.campaign.frequencyCapHours ?? campaign.plan.frequencyCapHours;
      const nextEligibleAt = new Date(now.getTime() + frequencyCapHours * 60 * 60 * 1000);
      const existing = await AdCampaignImpression.findOne({
        campaignId: campaign._id,
        userId: req.user.id
      }).select("_id nextEligibleAt").lean();
      if (existing) {
        if (!isImpressionEligible(existing.nextEligibleAt, now)) {
          return res.status(429).json({ error: "Campaign frequency cap reached" });
        }
        const updated = await AdCampaignImpression.findOneAndUpdate(
          { _id: existing._id, nextEligibleAt: { $lte: now } },
          { $set: { nextEligibleAt } },
          { new: true }
        );
        if (!updated) return res.status(429).json({ error: "Campaign frequency cap reached" });
      } else {
        try {
          await AdCampaignImpression.create({
            campaignId: campaign._id,
            userId: req.user.id,
            nextEligibleAt
          });
        } catch (error) {
          if (error.code === 11000) return res.status(429).json({ error: "Campaign frequency cap reached" });
          throw error;
        }
      }
    }
    res.json({ eligible: true });
  } catch (error) {
    console.error("Failed to record ad campaign impression:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/campaigns/:id", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const { isActive, startsAt, endsAt, socialPromotionStatus, extensionDays, extensionReason } = req.body || {};
    if (isActive !== undefined && typeof isActive !== "boolean") {
      return res.status(400).json({ error: "Invalid campaign state" });
    }
    if (extensionDays !== undefined
      && (!Number.isInteger(extensionDays) || extensionDays < 1 || extensionDays > 365)) {
      return res.status(400).json({ error: "Campaign extension must be between 1 and 365 days" });
    }
    const normalizedExtensionReason = typeof extensionReason === "string" ? extensionReason.trim() : "";
    if (extensionDays !== undefined
      && (!normalizedExtensionReason || normalizedExtensionReason.length > 1000)) {
      return res.status(400).json({ error: "A reason of 1 to 1000 characters is required for campaign extensions" });
    }
    if (extensionDays === undefined && extensionReason !== undefined) {
      return res.status(400).json({ error: "Campaign extension days are required" });
    }
    if (extensionDays !== undefined && (startsAt !== undefined || endsAt !== undefined)) {
      return res.status(400).json({ error: "Reschedule and extension must be submitted separately" });
    }
    const campaign = await PurchaseRequest.findById(req.params.id)
      .populate({ path: "plan", select: CAMPAIGN_PLAN_FIELDS })
      .populate({ path: "product", select: "status isDeleted isVisible sold images userId featured featuredAt featuredUntil featuredExpiresAt" });
    const serviceType = getCampaignServiceType(campaign);
    const isAdCampaign = ["placement", "interstitial"].includes(serviceType);
    const isFeaturedPromotion = serviceType === "featured" && Boolean(campaign?.product);
    if (!campaign || campaign.plan?.type !== "featured"
      || (!isAdCampaign && !isFeaturedPromotion && !campaign.campaign?.socialPromotionRequested)) {
      return res.status(404).json({ error: "Campaign not found" });
    }
    if (campaign.status !== "Approved") return res.status(409).json({ error: "Campaign requires approval" });
    campaign.campaign ||= {};
    if (isFeaturedPromotion) {
      campaign.campaign.serviceType = "featured";
      campaign.campaign.startsAt ||= campaign.product.featuredAt || campaign.updatedAt;
      campaign.campaign.endsAt ||= campaign.product.featuredExpiresAt || campaign.product.featuredUntil;
      campaign.campaign.durationInDays ||= campaign.duration || campaign.planSnapshot?.durationInDays || campaign.plan.durationInDays;
    }
    if (socialPromotionStatus !== undefined) {
      if (!campaign.campaign.socialPromotionRequested
        || !["pending", "in_progress", "completed", "rejected"].includes(socialPromotionStatus)) {
        return res.status(400).json({ error: "Invalid social promotion status" });
      }
      campaign.campaign.socialPromotionStatus = socialPromotionStatus;
    }
    if (startsAt !== undefined || endsAt !== undefined) {
      if (!isAdCampaign && !isFeaturedPromotion) return res.status(400).json({ error: "Campaign dates are not available for social promotion requests" });
      const nextStart = startsAt === undefined ? campaign.campaign.startsAt : new Date(startsAt);
      const nextEnd = endsAt === undefined ? campaign.campaign.endsAt : new Date(endsAt);
      if (!isValidCampaignWindow(
        nextStart,
        nextEnd,
        campaign.campaign.durationInDays || campaign.duration || campaign.plan.durationInDays
      )) {
        return res.status(400).json({ error: "Campaign dates must fit within the purchased duration" });
      }
      campaign.campaign.startsAt = nextStart;
      campaign.campaign.endsAt = nextEnd;
      if (isFeaturedPromotion) {
        await Ad.findByIdAndUpdate(campaign.product._id, {
          $set: { featuredAt: nextStart, featuredUntil: nextEnd, featuredExpiresAt: nextEnd }
        });
      }
    }
    if (extensionDays !== undefined) {
      if (!isAdCampaign && !isFeaturedPromotion) return res.status(400).json({ error: "Campaign extensions are only available for ad campaigns" });
      const previousEnd = new Date(campaign.campaign.endsAt).getTime();
      const currentDuration = Number(campaign.campaign.durationInDays);
      const extendedEnd = new Date(previousEnd + extensionDays * 24 * 60 * 60 * 1000);
      const extendedDuration = currentDuration + extensionDays;
      if (!Number.isFinite(previousEnd) || !Number.isInteger(currentDuration) || currentDuration < 1
        || !Number.isFinite(extendedEnd.getTime())
        || !isValidCampaignWindow(campaign.campaign.startsAt, extendedEnd, extendedDuration)) {
        return res.status(409).json({ error: "Campaign cannot be extended from its current schedule" });
      }
      campaign.campaign.adminExtensions ||= [];
      campaign.campaign.adminExtensions.push({
        days: extensionDays,
        reason: normalizedExtensionReason,
        extendedAt: new Date(),
        extendedBy: req.user.id
      });
      campaign.campaign.durationInDays = extendedDuration;
      campaign.campaign.endsAt = extendedEnd;
      if (previousEnd <= Date.now() && isActive !== true) {
        campaign.campaign.isActive = false;
      }
      if (isFeaturedPromotion) {
        await Ad.findByIdAndUpdate(campaign.product._id, {
          $set: {
            featuredUntil: extendedEnd,
            featuredExpiresAt: extendedEnd,
            ...(previousEnd <= Date.now() && isActive !== true ? { featured: false } : {})
          }
        });
      }
    }
    if (isActive === true && (!isCampaignAdEligible(campaign.product)
      || new Date(campaign.campaign.endsAt).getTime() <= Date.now())) {
      return res.status(409).json({ error: "The linked ad is not eligible" });
    }
    if (isActive !== undefined) {
      campaign.campaign.isActive = isActive;
      if (isFeaturedPromotion) {
        await Ad.findByIdAndUpdate(campaign.product._id, {
          $set: { featured: isActive }
        });
      }
    }
    await campaign.save();
    res.json({ ok: true, campaign: campaign.campaign });
  } catch (error) {
    console.error("Failed to update ad campaign:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/mine", auth, async (req, res) => {
  try {
    const prs = await PurchaseRequest.find({ user: req.user.id })
      .populate("plan", "name type durationInDays price adServiceType adPositions socialPromotionIncluded socialPromotionPrice")
      .populate("product", "title")
      .sort({ createdAt: -1 })
      .lean();
    res.json(prs);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", auth, requireRole(["seller", "user"]), uploadReceipt, async (req, res) => {
  try {
    const planId = req.body?.planId;
    const productId = req.body?.productId;
    const receiptFile = req.files?.[0];
    const draftActionId = req.body?.draftActionId;
    if (draftActionId) {
      const existingRequest = await findDraftActionResult(PurchaseRequest, draftActionId, req.user.id);
      if (existingRequest) {
        await markDraftCompleted(draftActionId, req.user.id, "featured_ad_upgrade", existingRequest._id, "purchase_request");
        return res.status(200).json(existingRequest);
      }
      const draftResult = await getIncompleteDraftForSubmission(
        draftActionId,
        req.user.id,
        "featured_ad_upgrade"
      );
      if (draftResult.error) return res.status(draftResult.status).json({ error: draftResult.error });
      if (String(draftResult.draft?.adId || "") !== String(productId || "")
        || String(draftResult.draft?.planId || "") !== String(planId || "")) {
        return res.status(409).json({ error: "بيانات المسودة لا تطابق الطلب الحالي. يرجى استئناف العملية من جديد." });
      }
    }
    const plan = await Plan.findById(planId).lean();
    if (!plan || !plan.isActive) return res.status(400).json({ error: "خطة غير صالحة" });
    if (draftActionId && plan.type !== "featured") {
      return res.status(409).json({ error: "هذه العملية لم تعد متاحة بهذه البيانات. يمكنك بدء العملية من جديد." });
    }
    
    const priceDetails = getFinalPrice(plan);
    const campaignServiceType = plan.type === "featured" ? (plan.adServiceType || "featured") : null;
    const socialPromotionRequested = req.body?.socialPromotionRequested === "true"
      || req.body?.socialPromotionRequested === true;
    if (socialPromotionRequested && plan.type !== "featured") {
      return res.status(400).json({ error: "الترويج الاجتماعي متاح مع باقات الإعلانات فقط" });
    }
    if (socialPromotionRequested && !plan.socialPromotionIncluded && !(plan.socialPromotionPrice > 0)) {
      return res.status(400).json({ error: "الترويج الاجتماعي غير متاح ضمن هذه الباقة" });
    }
    const finalPrice = priceDetails.finalPrice
      + (socialPromotionRequested && !plan.socialPromotionIncluded ? plan.socialPromotionPrice : 0);
    const originalPrice = priceDetails.originalPrice
      + (socialPromotionRequested && !plan.socialPromotionIncluded ? plan.socialPromotionPrice : 0);
    
    if (plan.type === "featured" && !productId) return res.status(400).json({ error: "يجب اختيار إعلان" });
    if (plan.type === "featured" && !receiptFile) return res.status(400).json({ error: "يجب رفع سند الدفع" });

    if (plan.type === "featured" && productId) {
      const ad = await Ad.findById(productId).lean();
      if (!ad) return res.status(400).json({ error: "إعلان غير صالح" });
      if (String(ad.userId) !== String(req.user.id)) return res.status(403).json({ error: "غير مصرح" });
      if (campaignServiceType !== "featured" && !isCampaignAdEligible(ad)) {
        return res.status(400).json({ error: "يجب اختيار إعلان منشور يحتوي على صورة" });
      }
    }

    let paymentReceipt = undefined;
    if (receiptFile && (plan.type === "featured" || plan.type === "verification")) {
      const processed = await processImage(receiptFile.path, "receipts");
      paymentReceipt = `receipts/${path.basename(processed)}`;
    }

    let pr;
    try {
      pr = await PurchaseRequest.create({
        user: req.user.id,
        ...(draftActionId ? { draftActionId } : {}),
        plan: plan._id,
        product: productId || undefined,
        paymentReceipt: (plan.type === "featured" || plan.type === "verification") ? paymentReceipt : undefined,
        status: (plan.type === "featured" || plan.type === "verification") ? "Pending" : "Approved",
        price: finalPrice,
        originalPrice,
        currency: plan.currency,
        duration: plan.durationInDays,
        planSnapshot: {
          name: plan.name,
          description: plan.description || "",
          type: plan.type,
          adServiceType: campaignServiceType,
          adPositions: plan.adPositions || [],
          basePrice: priceDetails.finalPrice,
          price: finalPrice,
          originalPrice,
          currency: plan.currency,
          durationInDays: plan.durationInDays,
          interstitialDelaySeconds: plan.interstitialDelaySeconds ?? null,
          ...(campaignServiceType === "placement"
            ? { rotationIntervalSeconds: plan.rotationIntervalSeconds ?? 5 }
            : {}),
          frequencyCapHours: plan.frequencyCapHours ?? null,
          socialPromotionIncluded: !!plan.socialPromotionIncluded,
          socialPromotionRequested,
          socialPromotionPrice: socialPromotionRequested && !plan.socialPromotionIncluded
            ? plan.socialPromotionPrice
            : 0
        },
        ...(campaignServiceType !== "featured" || socialPromotionRequested ? {
          campaign: {
            isActive: false,
            serviceType: campaignServiceType,
            positions: plan.adPositions || [],
            durationInDays: plan.durationInDays,
            ...(campaignServiceType === "placement"
              ? { rotationIntervalSeconds: plan.rotationIntervalSeconds ?? 5 }
              : {}),
            delaySeconds: plan.interstitialDelaySeconds ?? 8,
            frequencyCapHours: plan.frequencyCapHours ?? 24,
            socialPromotionRequested,
            socialPromotionStatus: socialPromotionRequested ? "pending" : "not_requested"
          }
        } : {})
      });
    } catch (error) {
      if (draftActionId && error.code === 11000) {
        pr = await findDraftActionResult(PurchaseRequest, draftActionId, req.user.id);
      }
      if (!pr) throw error;
      await markDraftCompleted(draftActionId, req.user.id, "featured_ad_upgrade", pr._id, "purchase_request");
      return res.status(200).json(pr);
    }

    await markDraftCompleted(
      draftActionId,
      req.user.id,
      "featured_ad_upgrade",
      pr._id,
      "purchase_request"
    );

    if (plan.type === "featured" || plan.type === "verification") {
      await createNotification(req.app, {
        userId: req.user.id,
        type: "purchase_approved",
        title: "تم استلام طلبك",
        body: `تم استلام طلب ${plan.type === 'featured' ? 'تمييز الإعلان' : 'توثيق الحساب'} وهو قيد المراجعة حالياً.`,
        data: { requestId: pr._id }
      });
    }

    // إنشاء إشعار للأدمن (Realtime)
    if (plan.type === "featured" || plan.type === "verification") {
      try {
        const requester = await User.findById(req.user.id).select("name").lean();
        const typeLabel = plan.type === "featured" ? "تمييز إعلان" : "توثيق حساب";
        await createAdminNotification(req.app, {
          type: plan.type,
          title: `طلب ${typeLabel} جديد`,
          message: `طلب ${typeLabel} من المستخدم: ${requester?.name || "غير معروف"}`,
          link: plan.type === "featured" ? "/admin/featured-requests" : "/admin/verification-requests",
          data: { requestId: pr._id }
        });
      } catch (err) {
        console.error("فشل إنشاء إشعار الأدمن:", err);
      }
    }

    // إرسال إشعار للأدمن (بشكل غير متزامن)
    if (plan.type === "featured" || plan.type === "verification") {
      User.findById(req.user.id).select("name").lean().then(requester => {
        const typeLabel = plan.type === "featured" ? "تمييز إعلان" : "توثيق حساب";
        sendEmail({
          subject: `طلب ${typeLabel} جديد`,
          html: `
            <div dir="rtl" style="font-family: sans-serif; padding: 20px; background-color: #f9fafb;">
              <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 25px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h2 style="color: #d97706; margin-bottom: 20px;">طلب ${typeLabel} جديد</h2>
                <p style="font-size: 16px; color: #374151;">وصل طلب ${typeLabel} جديد للمنصة:</p>
                <div style="background-color: #fffbeb; border-right: 4px solid #d97706; padding: 15px; border-radius: 4px; margin: 20px 0;">
                  <p style="margin: 5px 0;"><strong>اسم المستخدم:</strong> ${requester?.name || "غير متوفر"}</p>
                  <p style="margin: 5px 0;"><strong>نوع الباقة:</strong> ${plan.name}</p>
                </div>
                <div style="text-align: center; margin-top: 30px;">
                  <a href="${process.env.FRONTEND_URL || "https://souqak-yem.com"}/admin" style="background-color: #d97706; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">فتح لوحة تحكم الأدمن</a>
                </div>
              </div>
            </div>
          `
        });
      }).catch(err => console.error("فشل في إشعار الأدمن:", err));
    }

    if (plan.type === "featured" && productId) {
      // Nothing here yet, waits for approval
    }

    res.status(201).json(pr);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/:id/approve", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const pr = await PurchaseRequest.findById(req.params.id).populate("plan").lean();
    if (!pr) return res.status(404).json({ error: "Not found" });
    if (pr.status === "Approved") return res.json(pr);
    const plan = pr.plan;
    const planType = pr.planSnapshot?.type || plan?.type;
    if (!planType) return res.status(409).json({ error: "Purchase plan is no longer available" });
    const serviceType = planType === "featured"
      ? (pr.campaign?.serviceType || pr.planSnapshot?.adServiceType || plan?.adServiceType || "featured")
      : null;
    const isCampaignService = ["placement", "interstitial"].includes(serviceType);
    let campaignStart = pr.campaign?.startsAt || null;
    let campaignEnd = pr.campaign?.endsAt || null;
    let activatedAt = pr.campaign?.activatedAt || null;

    if (pr.status !== "Approved") {
      if (planType === "featured" && !pr.paymentReceipt) {
        return res.status(409).json({ error: "Payment receipt is required before activation" });
      }
      if (planType === "featured") {
        const ad = await Ad.findById(pr.product).lean();
        if (!ad || String(ad.userId) !== String(pr.user)
          || (isCampaignService && !isCampaignAdEligible(ad))) {
          return res.status(409).json({ error: "The linked ad is no longer eligible for this campaign" });
        }
      }
      activatedAt = new Date();
      campaignStart = activatedAt;
      const campaignWindow = getCampaignWindow(activatedAt, pr.duration || pr.planSnapshot?.durationInDays || plan?.durationInDays);
      campaignStart = campaignWindow.startsAt;
      campaignEnd = campaignWindow.endsAt;
      const setFields = { status: "Approved" };
      if (isCampaignService || pr.campaign?.socialPromotionRequested) {
        setFields["campaign.isActive"] = isCampaignService;
        setFields["campaign.startsAt"] = campaignStart;
        setFields["campaign.endsAt"] = campaignEnd;
        setFields["campaign.activatedAt"] = activatedAt;
        if (isCampaignService) {
          setFields["campaign.serviceType"] = serviceType;
          setFields["campaign.positions"] = pr.campaign?.positions || pr.planSnapshot?.adPositions || plan?.adPositions || [];
          setFields["campaign.durationInDays"] = pr.duration || pr.planSnapshot?.durationInDays || plan?.durationInDays;
          if (serviceType === "placement") {
            setFields["campaign.rotationIntervalSeconds"] = pr.campaign?.rotationIntervalSeconds
              ?? pr.planSnapshot?.rotationIntervalSeconds
              ?? plan?.rotationIntervalSeconds
              ?? 5;
          }
          setFields["campaign.delaySeconds"] = pr.campaign?.delaySeconds ?? pr.planSnapshot?.interstitialDelaySeconds ?? plan?.interstitialDelaySeconds ?? 8;
          setFields["campaign.frequencyCapHours"] = pr.campaign?.frequencyCapHours ?? pr.planSnapshot?.frequencyCapHours ?? plan?.frequencyCapHours ?? 24;
        }
        if (pr.campaign?.socialPromotionRequested) {
          setFields["campaign.socialPromotionStatus"] = "pending";
        }
      }
      const updated = await PurchaseRequest.findOneAndUpdate(
        { _id: pr._id, status: "Pending" },
        { $set: setFields },
        { new: true }
      ).lean();
      if (!updated) {
        const latest = await PurchaseRequest.findById(pr._id).lean();
        if (latest?.status !== "Approved") return res.status(409).json({ error: "Request is no longer pending" });
        return res.json(latest);
      }
    }

    const updatedPR = await PurchaseRequest.findById(pr._id).lean();
    if (planType === "featured") {
      await ReferralEngine.createPromotionCommission(updatedPR);
    }
    if (planType === "verification") {
      const expires = new Date(Date.now() + (pr.duration || plan?.durationInDays) * 24 * 60 * 60 * 1000);
      await User.findByIdAndUpdate(pr.user, { 
        isVerifiedSeller: true, 
        verified: true, 
        verificationStatus: "verified",
        verificationDate: new Date(),
        verificationExpiryDate: expires,
        verifiedAt: new Date(), 
        verificationExpiresAt: expires 
      });
    } else if (planType === "featured" && pr.product && serviceType === "featured") {
      const alreadyFeatured = pr.status === "Approved";
      const startsAt = campaignStart || pr.campaign?.startsAt || pr.updatedAt;
      const expires = campaignEnd
        || pr.campaign?.endsAt
        || new Date(new Date(startsAt).getTime() + (pr.duration || pr.planSnapshot?.durationInDays || plan?.durationInDays) * 24 * 60 * 60 * 1000);
      // Ensure the ad is updated and the featured status is set correctly
      const ad = await Ad.findByIdAndUpdate(pr.product, {
        $set: {
          featured: true,
          featuredUntil: expires,
          featuredAt: pr.campaign?.activatedAt || new Date(pr.updatedAt),
          featuredExpiresAt: expires,
          ...(alreadyFeatured ? {} : { status: "approved" })
        }
      });

      // Track conversion if this ad had a welcome promotion
      if (ad && ad.welcomePromotionStartDate) {
        const settings = await SystemSettings.getSettings();
        if (settings.welcomePromotion && settings.welcomePromotion.stats) {
          settings.welcomePromotion.stats.totalConversions += 1;
          settings.welcomePromotion.stats.purchasedAfterTrialCount += 1;
          await settings.save();
        }
      }
    }
    await createNotification(req.app, {
      userId: pr.user,
      type: "purchase_approved",
      title: "تم قبول طلبك",
      body: isCampaignService
        ? "تمت الموافقة على حملتك الإعلانية وتفعيلها."
        : planType === "featured" ? "تم قبول طلب تمييز إعلانك بنجاح." : "تم قبول طلب التوثيق بنجاح.",
      data: { purchaseRequestId: pr._id }
    });
    res.json(updatedPR);
  } catch (error) {
    console.error("Failed to approve purchase request:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/:id/reject", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const rejectionReason = String(req.body?.rejectionReason || "").trim();
    if (!rejectionReason || rejectionReason.length > 1000) {
      return res.status(400).json({ error: "A rejection reason of 1 to 1000 characters is required" });
    }
    const pr = await PurchaseRequest.findById(req.params.id).lean();
    if (!pr) return res.status(404).json({ error: "Not found" });
    if (pr.status === "Rejected") return res.json(pr);
    if (pr.status !== "Pending") return res.status(409).json({ error: "Only pending requests can be rejected" });
    const updatedPR = await PurchaseRequest.findOneAndUpdate(
      { _id: pr._id, status: "Pending" },
      { status: "Rejected", rejectionReason },
      { new: true }
    ).lean();
    if (!updatedPR) return res.status(409).json({ error: "Request is no longer pending" });
    await createNotification(req.app, {
      userId: pr.user,
      type: "purchase_rejected",
      title: "تم رفض طلبك",
      body: rejectionReason,
      data: { purchaseRequestId: pr._id, rejectionReason }
    });
    res.json(updatedPR);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
