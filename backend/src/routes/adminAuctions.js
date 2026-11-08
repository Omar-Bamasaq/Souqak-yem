import { Router } from "express";
import path from "node:path";
import Joi from "joi";
import mongoose from "mongoose";
import Auction from "../models/Auction.js";
import AuctionBid from "../models/AuctionBid.js";
import AuctionAuditLog from "../models/AuctionAuditLog.js";
import User from "../models/User.js";
import Category from "../models/Category.js";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import { createNotification } from "../services/notificationService.js";
import { AuctionError } from "../services/auctionErrors.js";
import {
  categoryHasUnapprovedDocumentPolicy,
  getCategoryAuctionRequirements,
  hasRequiredDocuments,
  hasRequiredReviewedDocuments,
  isCategoryAuctionFieldRequired,
  isCategoryAuctionFieldVisible,
  publicCategoryAuctionRequirements,
  validateCategoryAuctionData
} from "../config/auctionCategoryRequirements.js";
import { resolveAuctionCategoryRequirements } from "../services/auctionCategoryRequirements.js";
import { evaluateAuctionPublication } from "../services/auctionPublicationEligibility.js";
import { isUserVerificationCurrent } from "../services/userVerification.js";
import {
  AUCTION_DURATION_DAYS,
  auctionDurationLabel
} from "../config/auctions.js";

const router = Router();
router.use(auth, requireRole(["admin"]));
const privateAuctionDocumentsDirectory = path.resolve(
  process.cwd(),
  "private_uploads",
  "auction-documents"
);

const auctionIdParams = validateParams(
  Joi.object({ id: Joi.string().hex().length(24).required() })
);
const auctionDocumentParams = validateParams(
  Joi.object({
    id: Joi.string().hex().length(24).required(),
    documentId: Joi.string().hex().length(24).required()
  })
);
function adminAuction(auction) {
  const acknowledgments = auction.submissionAcknowledgments || [];
  return {
    id: String(auction._id),
    title: auction.title,
    description: auction.description,
    itemCondition: auction.itemCondition,
    defectsNotes: auction.defectsNotes,
    deliveryMethod: auction.deliveryMethod,
    deliveryDetails: auction.deliveryDetails,
    images: auction.images,
    imageLabels: auction.imageLabels || [],
    categoryDetails: auction.categoryDetails || {},
    categoryDocumentStatus: auction.categoryDocumentStatus || "missing",
    categoryDocuments: (auction.categoryDocuments || []).map((document) => ({
      id: String(document._id),
      type: document.type,
      typeLabel: document.typeLabel,
      policyVersion: document.policyVersion,
      version: document.version,
      mimeType: document.mimeType,
      size: document.size,
      reviewStatus: document.reviewStatus,
      isCurrent: document.isCurrent !== false,
      uploadedAt: document.uploadedAt,
      expiresAt: document.expiresAt || null,
      uploadedBy: document.uploadedBy || null,
      reviewedBy: document.reviewedBy || null,
      reviewedAt: document.reviewedAt || null,
      reviewNotes: document.reviewNotes || null,
      rejectionReason: document.rejectionReason || null
    })),
    category: auction.categoryId,
    governorate: auction.governorateId,
    city: auction.cityId,
    owner: auction.ownerId,
    currency: auction.currency,
    startingPrice: auction.startingPrice?.toString(),
    currentPrice: auction.currentPrice?.toString(),
    minimumIncrement: auction.minimumIncrement?.toString(),
    durationDays: auction.durationDays,
    durationLabel: auctionDurationLabel(auction.durationDays),
    startAt: auction.startAt,
    endAt: auction.endAt,
    status: auction.status,
    reviewStatus: auction.reviewStatus,
    approvedBy: auction.approvedBy,
    approvedAt: auction.approvedAt,
    rejectionReason: auction.rejectionReason,
    cancellationReason: auction.cancellationReason,
    bidCount: auction.bidCount,
    winner: auction.winnerId || null,
    winningBid: auction.winningBidId || null,
    saleStatus: auction.saleStatus,
    sellerConfirmedAt: auction.sellerConfirmedAt,
    winnerConfirmedAt: auction.winnerConfirmedAt,
    disputeReportedAt: auction.disputeReportedAt,
    disputeReason: auction.disputeReason,
    latestAcknowledgment: acknowledgments[acknowledgments.length - 1] || null,
    createdAt: auction.createdAt,
    endedAt: auction.endedAt
  };
}

function populated(query) {
  return query
    .populate("ownerId", "name email phone avatar")
    .populate("categoryId", "name slug")
    .populate("governorateId", "name")
    .populate("cityId", "name")
    .populate("approvedBy", "name")
    .populate("categoryDocuments.uploadedBy", "name")
    .populate("categoryDocuments.reviewedBy", "name")
    .populate("winnerId", "name phone")
    .populate("winningBidId", "amount sequence createdAt");
}

async function notifyOwner(req, auction, title, body, event) {
  const notification = await createNotification(req.app, {
    userId: auction.ownerId,
    type: "auction",
    title,
    body,
    data: { auctionId: String(auction._id), event }
  });
  if (!notification) {
    console.warn("[Auction Admin] Owner notification was not stored.", {
      auctionId: String(auction._id),
      event
    });
  }
}

async function recordAdminDecision({
  auctionId,
  administratorId,
  action,
  reason,
  documentId = null,
  filter,
  update
}) {
  const session = await mongoose.startSession();
  let auction = null;
  try {
    await session.withTransaction(async () => {
      const previous = await Auction.findOne(filter).session(session).lean();
      if (!previous) return;

      const changes = typeof update === "function" ? await update(previous) : update;
      auction = await Auction.findOneAndUpdate(
        filter,
        { $set: changes },
        { new: true, runValidators: true, session }
      );
      if (!auction) return;

      await AuctionAuditLog.create(
        [{
          auctionId: auction._id,
          administratorId,
          actorId: administratorId,
          actorRole: "administrator",
          action,
          documentId,
          decisionAt: new Date(),
          reason: reason || null,
          previousStatus: previous.status,
          previousReviewStatus: previous.reviewStatus,
          nextStatus: auction.status,
          nextReviewStatus: auction.reviewStatus
        }],
        { session }
      );
    });
    return auction;
  } finally {
    await session.endSession();
  }
}

router.get(
  "/",
  validateQuery(
    Joi.object({
      status: Joi.string()
        .valid("review", "documents", "scheduled", "live", "ended", "cancelled", "rejected", "disputed")
        .default("review"),
      page: Joi.number().integer().min(1).default(1),
      pageSize: Joi.number().integer().min(1).max(50).default(30)
    })
  ),
  async (req, res) => {
    try {
      const { status, page, pageSize } = req.query;
      let filter;
      if (status === "documents") {
        const categories = await Category.find({ slug: { $in: ["cars-for-sale", "real-estate"] } })
          .select("_id slug")
          .lean();
        filter = {
          $or: [
            { categoryDocumentStatus: "pending_review" },
            ...categories.map((category) => ({
              categoryId: category._id,
              categoryDocuments: {
                $elemMatch: {
                  isCurrent: { $ne: false },
                  $or: [
                    {
                      type: {
                        $nin: getCategoryAuctionRequirements([category.slug])
                          .documentRequirements.map((requirement) => requirement.key)
                      }
                    },
                    {
                      policyVersion: {
                        $ne: getCategoryAuctionRequirements([category.slug]).documentPolicyVersion || 0
                      }
                    }
                  ]
                }
              }
            }))
          ]
        };
      } else {
        filter = status === "review"
          ? { reviewStatus: "pending", status: "draft" }
          : status === "disputed"
            ? { saleStatus: "disputed" }
            : { status, ...(status === "rejected" ? { reviewStatus: "rejected" } : {}) };
      }
      const [auctions, total] = await Promise.all([
        populated(Auction.find(filter))
          .sort({ createdAt: -1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .lean(),
        Auction.countDocuments(filter)
      ]);
      res.json({
        items: auctions.map(adminAuction),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      });
    } catch (error) {
      console.error("[Auction Admin] Listing failed.", error);
      res.status(500).json({ error: "تعذر تحميل المزادات.", code: "AUCTION_ADMIN_ERROR" });
    }
  }
);

router.get("/:id/bids", auctionIdParams, async (req, res) => {
  try {
    const bids = await AuctionBid.find({ auctionId: req.params.id })
      .populate("bidderId", "name phone")
      .sort({ sequence: -1 })
      .limit(100)
      .lean();
    res.json({
      items: bids.map((bid) => ({
        id: String(bid._id),
        bidder: bid.bidderId,
        amount: bid.amount.toString(),
        sequence: bid.sequence,
        createdAt: bid.createdAt
      }))
    });
  } catch (error) {
    console.error("[Auction Admin] Bid history failed.", error);
    res.status(500).json({ error: "تعذر تحميل سجل العروض.", code: "AUCTION_ADMIN_ERROR" });
  }
});

router.get("/:id", auctionIdParams, async (req, res) => {
  try {
    const auction = await populated(Auction.findById(req.params.id)).lean();
    if (!auction) {
      return res.status(404).json({ error: "المزاد غير موجود.", code: "AUCTION_NOT_FOUND" });
    }
    const category = await resolveAuctionCategoryRequirements(auction.categoryId?._id || auction.categoryId);
    const requirements = category?.requirements;
    const categoryDetails = auction.categoryDetails || {};
    const missingRequirements = [];
    const categoryDataError = requirements?.supported
      ? validateCategoryAuctionData(requirements, categoryDetails, auction.imageLabels || [])
      : "تصنيف المزاد غير مدعوم";
    if (requirements?.supported) {
      for (const item of requirements.fields) {
        const value = categoryDetails[item.key];
        if (isCategoryAuctionFieldVisible(item, categoryDetails) &&
          isCategoryAuctionFieldRequired(item, categoryDetails) &&
          (value === undefined || value === null || value === "")) {
          missingRequirements.push(item.label);
        }
      }
      for (const label of requirements.requiredImageLabels) {
        if (!(auction.imageLabels || []).includes(label)) {
          missingRequirements.push(`صورة: ${label}`);
        }
      }
      if (!hasRequiredDocuments(requirements, auction.categoryDocuments || [])) {
        missingRequirements.push("الوثائق الخاصة المطلوبة");
      }
      if (!hasRequiredReviewedDocuments(requirements, auction.categoryDocuments || [])) {
        missingRequirements.push("مراجعة الوثائق المطلوبة");
      }
      if (["vehicle", "property"].includes(requirements.type) &&
        requirements.documentPolicyApproved !== true) {
        missingRequirements.push("سياسة الوثائق غير معتمدة أو لم تُحدد متطلباتها");
      }
      if (categoryDataError && !missingRequirements.some((missing) => categoryDataError.includes(missing))) {
        missingRequirements.push(categoryDataError);
      }
    } else {
      missingRequirements.push("تصنيف المزاد غير مدعوم");
    }
    const publication = await evaluateAuctionPublication(auction);
    const currentDocuments = (auction.categoryDocuments || []).filter(
      (document) => document.isCurrent !== false
    );
    const hasSensitiveDocumentPolicy = ["vehicle", "property"].includes(requirements?.type);
    const documentsReviewed = (!hasSensitiveDocumentPolicy &&
      !requirements?.documentRequirements?.length) ||
      (Boolean(requirements?.requiredDocumentCount) &&
        hasRequiredReviewedDocuments(requirements, currentDocuments) &&
        currentDocuments.every((document) =>
          document.policyVersion === requirements.documentPolicyVersion &&
          document.reviewStatus === "approved"
        ));
    const categoryFieldsComplete = Boolean(requirements?.supported) &&
      !validateCategoryAuctionData(
        requirements,
        categoryDetails,
        requirements.requiredImageLabels
      );
    const requiredImagesComplete = Boolean(requirements?.supported) &&
      (auction.images || []).length >= 1 &&
      requirements.requiredImageLabels.every((label) =>
        (auction.imageLabels || []).includes(label)
      );
    const publicationChecks = {
      sellerVerified: !publication.reasons.includes("توثيق البائع غير سارٍ"),
      basicDataComplete: Boolean(auction.title && auction.description &&
        auction.itemCondition && auction.defectsNotes && auction.governorateId &&
        auction.currency && auction.startingPrice && auction.minimumIncrement &&
        auction.deliveryMethod && auction.deliveryDetails),
      categoryDataComplete: categoryFieldsComplete,
      imagesComplete: requiredImagesComplete,
      documentsPresent: Boolean(requirements?.supported) &&
        (!hasSensitiveDocumentPolicy || Boolean(requirements.requiredDocumentCount)) &&
        hasRequiredDocuments(requirements, currentDocuments),
      documentsReviewed,
      documentPolicyApproved: !["vehicle", "property"].includes(requirements?.type) ||
        requirements.documentPolicyApproved === true,
      noMaterialChangesAfterReview: documentsReviewed,
      administrativeApproval: auction.reviewStatus === "approved" &&
        Boolean(auction.approvedAt && auction.approvedBy),
      publicationEligible: publication.eligible
    };
    const auditLog = await AuctionAuditLog.find({ auctionId: auction._id })
      .populate("administratorId", "name")
      .populate("actorId", "name")
      .sort({ decisionAt: 1, _id: 1 })
      .lean();
    res.json({
      auction: adminAuction(auction),
      categoryRequirements: requirements
        ? publicCategoryAuctionRequirements(requirements)
        : null,
      publicationChecks,
      publicationReasons: publication.reasons,
      missingRequirements,
      auditLog: auditLog.map((entry) => ({
        id: String(entry._id),
        administrator: entry.administratorId,
        actor: entry.actorId,
        action: entry.action,
        decisionAt: entry.decisionAt,
        reason: entry.reason,
        previousStatus: entry.previousStatus,
        previousReviewStatus: entry.previousReviewStatus,
        nextStatus: entry.nextStatus,
        nextReviewStatus: entry.nextReviewStatus,
        documentId: entry.documentId ? String(entry.documentId) : null
      }))
    });
  } catch (error) {
    console.error("[Auction Admin] Detail failed.", error);
    res.status(500).json({ error: "تعذر تحميل المزاد.", code: "AUCTION_ADMIN_ERROR" });
  }
});

router.get("/:id/documents/:documentId/file", auctionDocumentParams, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.documentId)) {
      return res.status(400).json({ error: "معرف الوثيقة غير صالح.", code: "INVALID_DOCUMENT_ID" });
    }
    const auction = await Auction.findById(req.params.id).select("categoryDocuments").lean();
    const document = auction?.categoryDocuments?.find(
      (entry) => String(entry._id) === req.params.documentId
    );
    if (!document) {
      return res.status(404).json({ error: "الوثيقة غير موجودة.", code: "AUCTION_DOCUMENT_NOT_FOUND" });
    }
    const storageKey = path.basename(document.storageKey);
    if (storageKey !== document.storageKey) {
      return res.status(404).json({ error: "الوثيقة غير موجودة.", code: "AUCTION_DOCUMENT_NOT_FOUND" });
    }
    res.set("X-Content-Type-Options", "nosniff");
    res.type(document.mimeType);
    res.attachment(`auction-document${path.extname(storageKey)}`);
    res.sendFile(storageKey, { root: privateAuctionDocumentsDirectory, dotfiles: "deny" }, (error) => {
      if (error && !res.headersSent) {
        console.error("[Auction Admin] Private document delivery failed.", error);
        res.status(error.statusCode || 500).json({
          error: error.statusCode === 404 ? "الوثيقة غير موجودة." : "تعذر عرض الوثيقة.",
          code: error.statusCode === 404 ? "AUCTION_DOCUMENT_NOT_FOUND" : "AUCTION_DOCUMENT_ERROR"
        });
      }
    });
  } catch (error) {
    console.error("[Auction Admin] Private document lookup failed.", error);
    res.status(500).json({ error: "تعذر تحميل الوثيقة.", code: "AUCTION_DOCUMENT_ERROR" });
  }
});

router.patch(
  "/:id/documents/:documentId/review",
  validateParams(Joi.object({
    id: Joi.string().hex().length(24).required(),
    documentId: Joi.string().hex().length(24).required()
  })),
  validateBody(Joi.object({
    decision: Joi.string().valid("approved", "rejected").required(),
    notes: Joi.when("decision", {
      is: "approved",
      then: Joi.string().trim().min(3).max(1_000).required(),
      otherwise: Joi.string().trim().allow("").max(1_000).default("")
    }),
    reason: Joi.when("decision", {
      is: "rejected",
      then: Joi.string().trim().min(3).max(1_000).required(),
      otherwise: Joi.string().allow("").max(1_000).default("")
    })
  })),
  async (req, res) => {
    const session = await mongoose.startSession();
    let updatedAuction = null;
    try {
      await session.withTransaction(async () => {
        const previous = await Auction.findOne({
          _id: req.params.id,
          "categoryDocuments._id": req.params.documentId
        }).session(session).lean();
        const document = previous?.categoryDocuments?.find(
          (entry) => String(entry._id) === req.params.documentId
        );
        if (!previous || !document || document.isCurrent === false ||
          document.reviewStatus !== "pending_review") {
          throw new AuctionError(
            "AUCTION_DOCUMENT_NOT_REVIEWABLE",
            "الوثيقة غير موجودة أو سبق حسم مراجعتها.",
            409
          );
        }
        const category = await resolveAuctionCategoryRequirements(previous.categoryId);
        const requirement = category?.requirements.documentRequirements?.find(
          (entry) => entry.key === document.type
        );
        const legacyDocument = !requirement &&
          ["vehicle", "property"].includes(category?.requirements.type);
        if (!category?.requirements.supported ||
          (!legacyDocument &&
            (!requirement || document.policyVersion !== category.requirements.documentPolicyVersion))) {
          throw new AuctionError(
            "INVALID_AUCTION_DOCUMENT_TYPE",
            "نوع الوثيقة أو إصدار سياستها غير متوافق مع متطلبات الفئة الحالية.",
            409
          );
        }
        if (requirement?.expiryMatters &&
          (!document.expiresAt || document.expiresAt <= new Date())) {
          throw new AuctionError(
            "AUCTION_DOCUMENT_EXPIRED",
            "انتهت صلاحية الوثيقة أو لم يسجل تاريخ انتهائها.",
            409
          );
        }

        const reviewedAt = new Date();
        const documents = previous.categoryDocuments.map((entry) =>
          String(entry._id) === req.params.documentId
            ? {
                ...entry,
                reviewStatus: req.body.decision,
                reviewedBy: req.user.id,
                reviewedAt,
                reviewNotes: req.body.notes || null,
                rejectionReason: req.body.decision === "rejected" ? req.body.reason : null
              }
            : entry
        );
        const currentDocuments = documents.filter((entry) => entry.isCurrent !== false);
        const documentStatus = currentDocuments.some((entry) => entry.reviewStatus === "rejected")
          ? "rejected"
          : currentDocuments.length && currentDocuments.every((entry) => entry.reviewStatus === "approved")
            ? "approved"
            : "pending_review";
        const rejected = req.body.decision === "rejected";
        updatedAuction = await Auction.findOneAndUpdate(
          { _id: previous._id, "categoryDocuments._id": req.params.documentId },
          {
            $set: {
              categoryDocuments: documents,
              categoryDocumentStatus: documentStatus,
              ...(rejected ? {
                status: "draft",
                reviewStatus: "draft",
                approvedBy: null,
                approvedAt: null
              } : {})
            }
          },
          { new: true, runValidators: true, session }
        );
        if (!updatedAuction) {
          throw new AuctionError(
            "AUCTION_DOCUMENT_NOT_REVIEWABLE",
            "تغيرت حالة الوثيقة أثناء المراجعة.",
            409
          );
        }
        await AuctionAuditLog.create([{
          auctionId: previous._id,
          administratorId: req.user.id,
          actorId: req.user.id,
          actorRole: "administrator",
          action: rejected ? "category_documents_rejected" : "category_documents_approved",
          decisionAt: reviewedAt,
          reason: rejected ? req.body.reason : req.body.notes || null,
          documentId: document._id,
          previousStatus: previous.status,
          previousReviewStatus: previous.reviewStatus,
          nextStatus: updatedAuction.status,
          nextReviewStatus: updatedAuction.reviewStatus
        }], { session });
      });
      res.json({ auction: adminAuction(updatedAuction.toObject()) });
    } catch (error) {
      if (error instanceof AuctionError) {
        return res.status(error.status).json({ error: error.message, code: error.code });
      }
      console.error("[Auction Admin] Document review failed.", error);
      res.status(500).json({ error: "تعذرت مراجعة الوثيقة.", code: "AUCTION_DOCUMENT_ERROR" });
    } finally {
      await session.endSession();
    }
  }
);

router.patch("/:id/approve", auctionIdParams, async (req, res) => {
  try {
    const auction = await recordAdminDecision({
      auctionId: req.params.id,
      administratorId: req.user.id,
      action: "approved",
      filter: {
        _id: req.params.id,
        status: "draft",
        reviewStatus: "pending"
      },
      update: async (current) => {
        const approvedAt = new Date();
        const owner = await User.findById(current.ownerId)
          .select("verificationStatus verificationExpiryDate isDisabled isDeleted")
          .lean();
        if (!isUserVerificationCurrent(owner, approvedAt)) {
          throw new AuctionError(
            "AUCTION_OWNER_VERIFICATION_REQUIRED",
            "لا يمكن اعتماد المزاد لأن توثيق البائع غير سارٍ.",
            409
          );
        }
        if (!AUCTION_DURATION_DAYS.includes(current.durationDays)) {
          throw new AuctionError(
            "INVALID_AUCTION_DURATION",
            "مدة المزاد غير صالحة. يجب أن تكون يومًا أو 4 أيام أو أسبوعًا.",
            409
          );
        }
        const category = await resolveAuctionCategoryRequirements(current.categoryId);
        if (!category) {
          throw new AuctionError("INVALID_CATEGORY", "الفئة غير متاحة.", 400);
        }
        const categoryDataError = validateCategoryAuctionData(
          category.requirements,
          current.categoryDetails || {},
          current.imageLabels || []
        );
        if (categoryDataError) {
          throw new AuctionError("INVALID_CATEGORY_AUCTION_DATA", categoryDataError, 400);
        }
        if (!hasRequiredDocuments(category.requirements, current.categoryDocuments || []) ||
          !hasRequiredReviewedDocuments(category.requirements, current.categoryDocuments || []) ||
          (category.requirements.requiredDocumentCount &&
            (current.categoryDocuments || []).some((document) =>
              document.isCurrent !== false && document.reviewStatus !== "approved"
            ))) {
          throw new AuctionError(
            "AUCTION_DOCUMENTS_NOT_APPROVED",
            "لا يمكن اعتماد المزاد قبل اعتماد جميع الوثائق المطلوبة.",
            409
          );
        }
        if (categoryHasUnapprovedDocumentPolicy(category.requirements) ||
          !category.requirements.publicListingEnabled) {
          throw new AuctionError(
            "CATEGORY_PUBLICATION_DISABLED",
            "نشر هذه الفئة متوقف إلى حين اعتماد سياسة الوثائق.",
            409
          );
        }
        return {
          reviewStatus: "approved",
          approvedBy: req.user.id,
          approvedAt,
          rejectionReason: null,
          startAt: approvedAt,
          endAt: new Date(approvedAt.getTime() + current.durationDays * 24 * 60 * 60 * 1_000),
          status: "live"
        };
      }
    });
    if (!auction) {
      return res.status(409).json({
        error: "تغيرت حالة المزاد قبل إتمام الموافقة.",
        code: "INVALID_AUCTION_TRANSITION"
      });
    }

    req.app.get("io")?.to(`auction:${auction._id}`).emit("auction:status", {
      auctionId: String(auction._id),
      status: auction.status,
      endAt: auction.endAt
    });
    await notifyOwner(
      req,
      auction,
      "تمت الموافقة على مزادك",
      `تمت الموافقة على المزاد "${auction.title}" وبدأت مدته الآن.`,
      "approved"
    );
    res.json({ auction: adminAuction(auction.toObject()) });
  } catch (error) {
    if (error instanceof AuctionError) {
      return res.status(error.status).json({ error: error.message, code: error.code });
    }
    console.error("[Auction Admin] Approval failed.", error);
    res.status(500).json({ error: "تعذرت الموافقة على المزاد.", code: "AUCTION_ADMIN_ERROR" });
  }
});

router.patch(
  "/:id/reject",
  auctionIdParams,
  validateBody(
    Joi.object({
      reason: Joi.string().trim().min(3).max(1_000).required()
    })
  ),
  async (req, res) => {
    try {
      const auction = await recordAdminDecision({
        auctionId: req.params.id,
        administratorId: req.user.id,
        action: "rejected",
        reason: req.body.reason,
        filter: {
          _id: req.params.id,
          status: "draft",
          reviewStatus: "pending"
        },
        update: {
            status: "rejected",
            reviewStatus: "rejected",
            rejectionReason: req.body.reason
        }
      });
      if (!auction) {
        return res.status(409).json({
          error: "لا يمكن رفض هذا المزاد في حالته الحالية.",
          code: "INVALID_AUCTION_TRANSITION"
        });
      }
      await notifyOwner(
        req,
        auction,
        "لم تتم الموافقة على مزادك",
        `سبب الرفض: ${req.body.reason}`,
        "rejected"
      );
      res.json({ auction: adminAuction(auction.toObject()) });
    } catch (error) {
      console.error("[Auction Admin] Rejection failed.", error);
      res.status(500).json({ error: "تعذر رفض المزاد.", code: "AUCTION_ADMIN_ERROR" });
    }
  }
);

router.patch(
  "/:id/cancel",
  auctionIdParams,
  validateBody(
    Joi.object({
      reason: Joi.string().trim().min(3).max(1_000).required()
    })
  ),
  async (req, res) => {
    try {
      const now = new Date();
      const auction = await recordAdminDecision({
        auctionId: req.params.id,
        administratorId: req.user.id,
        action: "cancelled",
        reason: req.body.reason,
        filter: {
          _id: req.params.id,
          status: { $in: ["draft", "scheduled", "live"] },
          endAt: { $gt: now }
        },
        update: {
            status: "cancelled",
            cancelledBy: req.user.id,
            cancelledAt: now,
            cancellationReason: req.body.reason
        }
      });
      if (!auction) {
        return res.status(409).json({
          error: "لا يمكن إلغاء هذا المزاد في حالته الحالية.",
          code: "INVALID_AUCTION_TRANSITION"
        });
      }
      await notifyOwner(
        req,
        auction,
        "تم إلغاء المزاد",
        `تم إلغاء المزاد "${auction.title}". السبب: ${req.body.reason}`,
        "cancelled"
      );
      const bidderIds = await AuctionBid.distinct("bidderId", { auctionId: auction._id });
      for (const bidderId of bidderIds) {
        const notification = await createNotification(req.app, {
          userId: bidderId,
          type: "auction",
          title: "تم إلغاء مزاد",
          body: `تم إلغاء المزاد "${auction.title}".`,
          data: { auctionId: String(auction._id), event: "cancelled" }
        });
        if (!notification) {
          console.warn("[Auction Admin] Bidder cancellation notification was not stored.", {
            auctionId: String(auction._id),
            userId: String(bidderId)
          });
        }
      }
      req.app.get("io")?.to(`auction:${auction._id}`).emit("auction:status", {
        auctionId: String(auction._id),
        status: auction.status,
        endAt: auction.endAt
      });
      res.json({ auction: adminAuction(auction.toObject()) });
    } catch (error) {
      console.error("[Auction Admin] Cancellation failed.", error);
      res.status(500).json({ error: "تعذر إلغاء المزاد.", code: "AUCTION_ADMIN_ERROR" });
    }
  }
);

export default router;
