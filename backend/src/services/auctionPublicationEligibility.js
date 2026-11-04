import User from "../models/User.js";
import { AUCTION_DURATION_DAYS } from "../config/auctions.js";
import {
  categoryHasUnapprovedDocumentPolicy,
  hasRequiredDocuments,
  hasRequiredReviewedDocuments,
  validateCategoryAuctionData
} from "../config/auctionCategoryRequirements.js";
import { resolveAuctionCategoryRequirements } from "./auctionCategoryRequirements.js";
import { isUserVerificationCurrent } from "./userVerification.js";

export async function evaluateAuctionPublication(auction, now = new Date()) {
  const reasons = [];
  if (auction.reviewStatus !== "approved" || !auction.approvedAt || !auction.approvedBy) {
    reasons.push("الموافقة الإدارية النهائية غير مكتملة");
  }
  if (!["live", "scheduled", "ended"].includes(auction.status) ||
    !auction.startAt || !auction.endAt || auction.endAt <= auction.startAt) {
    reasons.push("حالة المزاد أو أوقاته لا تسمح بالنشر");
  }
  if (!AUCTION_DURATION_DAYS.includes(auction.durationDays)) {
    reasons.push("مدة المزاد غير معتمدة");
  }

  const owner = auction.ownerId && typeof auction.ownerId === "object" &&
    auction.ownerId.verificationStatus !== undefined
    ? auction.ownerId
    : await User.findById(auction.ownerId)
      .select("verificationStatus verificationExpiryDate isDisabled isDeleted")
      .lean();
  if (!isUserVerificationCurrent(owner, now)) {
    reasons.push("توثيق البائع غير سارٍ");
  }

  const categoryId = auction.categoryId?._id || auction.categoryId;
  const category = await resolveAuctionCategoryRequirements(categoryId);
  if (!category || !category.requirements.supported) {
    reasons.push("تصنيف المزاد غير مدعوم");
    return { eligible: false, reasons };
  }
  const requirements = category.requirements;
  const invalidData = validateCategoryAuctionData(
    requirements,
    auction.categoryDetails || {},
    auction.imageLabels || []
  );
  if (invalidData) reasons.push(invalidData);
  if (categoryHasUnapprovedDocumentPolicy(requirements) ||
    !requirements.publicListingEnabled) {
    reasons.push("سياسة وثائق الفئة غير معتمدة للنشر العام");
  }
  const documents = auction.categoryDocuments || [];
  if (!hasRequiredDocuments(requirements, documents)) {
    reasons.push("الوثائق المطلوبة ناقصة أو غير صالحة");
  }
  if (!hasRequiredReviewedDocuments(requirements, documents)) {
    reasons.push("مراجعة الوثائق المطلوبة لم تكتمل");
  }
  if (requirements.documentRequirements?.length &&
    documents.some((document) =>
      document.isCurrent !== false &&
      (document.policyVersion !== requirements.documentPolicyVersion ||
        document.reviewStatus !== "approved")
    )) {
    reasons.push("توجد وثائق معلقة أو مرفوضة أو وفق سياسة سابقة");
  }

  return { eligible: reasons.length === 0, reasons };
}

export async function isPublicationEligible(auction, now = new Date()) {
  const result = await evaluateAuctionPublication(auction, now);
  return result.eligible;
}
