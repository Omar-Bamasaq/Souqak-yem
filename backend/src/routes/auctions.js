import { Router } from "express";
import fs from "node:fs/promises";
import Joi from "joi";
import mongoose from "mongoose";
import multer from "multer";
import path from "node:path";
import rateLimit from "express-rate-limit";
import { v4 as uuidv4 } from "uuid";
import Auction from "../models/Auction.js";
import AuctionBid from "../models/AuctionBid.js";
import AuctionAuditLog from "../models/AuctionAuditLog.js";
import City from "../models/City.js";
import Governorate from "../models/Governorate.js";
import auth from "../middleware/auth.js";
import { uploadImages } from "../middleware/upload.js";
import processImages, { validateProcessedImages } from "../middleware/processImages.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import {
  AUCTION_OWNER_ACKNOWLEDGMENT_TEXT,
  AUCTION_OWNER_ACKNOWLEDGMENT_VERSION,
  AUCTION_DURATION_OPTIONS,
  AUCTION_DURATION_DAYS,
  auctionDurationLabel,
  AUCTION_BID_RATE_LIMIT,
  AUCTION_BID_RATE_WINDOW_MS
} from "../config/auctions.js";
import {
  addAuctionAmounts,
  parseAuctionAmount,
  serializeAuctionAmount
} from "../utils/auctionMoney.js";
import { placeAuctionBid } from "../services/auctionBidService.js";
import { isPublicationEligible } from "../services/auctionPublicationEligibility.js";
import { AuctionError } from "../services/auctionErrors.js";
import { createNotification } from "../services/notificationService.js";
import { isUserVerificationCurrent } from "../services/userVerification.js";
import {
  categoryDocumentsNeedReview,
  hasRequiredDocuments,
  publicCategoryAuctionRequirements,
  validateCategoryAuctionData
} from "../config/auctionCategoryRequirements.js";
import {
  listAuctionCategories,
  resolveAuctionCategoryRequirements
} from "../services/auctionCategoryRequirements.js";

const router = Router();
const objectIdSchema = Joi.string().hex().length(24).required();
const auctionIdParams = validateParams(Joi.object({ id: objectIdSchema }));
const privateAuctionDocumentsDirectory = path.resolve(
  process.cwd(),
  "private_uploads",
  "auction-documents"
);
const auctionDocumentUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      fs.mkdir(privateAuctionDocumentsDirectory, { recursive: true })
        .then(() => callback(null, privateAuctionDocumentsDirectory))
        .catch(callback);
    },
    filename: (_req, file, callback) => {
      callback(null, `${uuidv4()}${path.extname(file.originalname).toLowerCase()}`);
    }
  }),
  fileFilter: (_req, file, callback) => {
    const allowed = {
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"]
    };
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowed[file.mimetype]?.includes(extension)) {
      const error = new Error("نوع الوثيقة غير مدعوم.");
      error.status = 400;
      return callback(error);
    }
    callback(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }
});

const createSchema = Joi.object({
  title: Joi.string().trim().min(3).max(120).required(),
  description: Joi.string().trim().min(5).max(5_000).required(),
  itemCondition: Joi.string().trim().min(3).max(500).required(),
  defectsNotes: Joi.string().trim().min(1).max(2_000).required(),
  deliveryMethod: Joi.string().valid("delivery", "pickup", "both").required(),
  deliveryDetails: Joi.string().trim().min(3).max(1_000).required(),
  categoryId: objectIdSchema,
  governorateId: objectIdSchema,
  cityId: Joi.string().hex().length(24).allow("", null).optional(),
  categoryDetails: Joi.object().unknown(false).default({}),
  imageLabels: Joi.array().items(
    Joi.string().valid(
      "front", "rear", "left_side", "right_side", "interior", "dashboard",
      "reported_damage", "actual_item"
    )
  ).default([]),
  currency: Joi.string().valid("YER_ADEN", "YER_SANAA", "SAR", "USD").required(),
  startingPrice: Joi.string().max(128).required(),
  minimumIncrement: Joi.string().max(128).required(),
  durationDays: Joi.number().valid(...AUCTION_DURATION_DAYS).required()
});

const updateSchema = createSchema;

const bidSchema = Joi.object({
  amount: Joi.string().max(128).required(),
  idempotencyKey: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^[A-Za-z0-9._:-]+$/)
    .required()
});
const submitSchema = Joi.object({
  accepted: Joi.boolean().valid(true).required()
}).required();
const completionSchema = Joi.object({
  action: Joi.string().valid("confirm", "report").required(),
  reason: Joi.when("action", {
    is: "report",
    then: Joi.string().trim().min(3).max(1_000).required(),
    otherwise: Joi.string().allow("").max(1_000).default("")
  })
}).required();
const documentUploadSchema = Joi.object({
  type: Joi.string().trim().pattern(/^[a-z0-9][a-z0-9-]{1,63}$/).required(),
  expiresAt: Joi.date().iso().allow(null).optional()
}).required();

const listSchema = Joi.object({
  q: Joi.string().trim().max(100).allow("").default(""),
  categoryId: Joi.string().hex().length(24).allow("").optional(),
  governorateId: Joi.string().hex().length(24).allow("").optional(),
  status: Joi.string().valid("live", "scheduled", "ended").allow("").optional(),
  sort: Joi.string()
    .valid("endingSoon", "newest", "priceLow", "priceHigh")
    .default("endingSoon"),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(50).default(20)
});

const bidRateLimit = rateLimit({
  windowMs: AUCTION_BID_RATE_WINDOW_MS,
  limit: AUCTION_BID_RATE_LIMIT,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => `auction-bid:${req.user.id}`,
  message: {
    error: "لقد تجاوزت الحد المسموح به للمزايدة. يرجى الانتظار قبل المحاولة مجددًا.",
    code: "AUCTION_BID_RATE_LIMITED"
  }
});

function sendError(res, error) {
  if (error instanceof AuctionError || Number.isInteger(error?.status)) {
    return res.status(error.status).json({
      error: error.message,
      code: error.code || "AUCTION_REQUEST_FAILED"
    });
  }
  if (error instanceof TypeError) {
    return res.status(400).json({ error: error.message, code: "INVALID_AUCTION_INPUT" });
  }
  console.error("[Auction API] Request failed.", error);
  return res.status(500).json({
    error: "تعذر إكمال طلب المزاد.",
    code: "AUCTION_INTERNAL_ERROR"
  });
}

function cleanupPrivateAuctionDocument(req, res, next) {
  req.privateAuctionDocumentCommitted = false;
  res.once("finish", () => {
    if (req.file && !req.privateAuctionDocumentCommitted) {
      void fs.unlink(req.file.path).catch((error) => {
        if (error.code !== "ENOENT") {
          console.error("[Auction API] Failed to clean an unlinked private document.", error);
        }
      });
    }
  });
  next();
}

function requireCurrentVerification(message) {
  return (req, res, next) => {
    if (!isUserVerificationCurrent(req.user)) {
      return res.status(403).json({
        error: message,
        code: "AUCTION_VERIFICATION_REQUIRED"
      });
    }
    next();
  };
}

function cleanupAuctionUploads(req, res, next) {
  req.auctionUploadsCommitted = false;
  res.once("finish", () => {
    if (!req.auctionUploadsCommitted) void removeAuctionUploads(req.files);
  });
  next();
}

async function removeAuctionUploads(files = []) {
  const uploadRoot = path.resolve(process.cwd(), "uploads");
  const filenames = new Set();
  for (const file of files || []) {
    const original = path.basename(file.path || "");
    const optimized = path.basename(file.filename || "");
    for (const name of [original, optimized]) {
      if (!name) continue;
      filenames.add(name);
      const base = name.replace(/\.[^.]+$/, "");
      filenames.add(`${base}.webp`);
      filenames.add(`${base}.med.webp`);
      filenames.add(`${base}.thumb.webp`);
    }
  }

  for (const filename of filenames) {
    const filePath = path.resolve(uploadRoot, filename);
    if (path.dirname(filePath) !== uploadRoot) continue;
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error("[Auction API] Failed to clean an unlinked upload.", {
          filename,
          error
        });
      }
    }
  }
}

function uploadAuctionImages(req, res, next) {
  uploadImages.array("images", 10)(req, res, (error) => {
    if (!error) return next();
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    return res.status(status).json({
      error: error.code === "LIMIT_FILE_SIZE"
        ? "حجم الصورة يتجاوز الحد المسموح."
        : error.message || "تعذر رفع صور المزاد.",
      code: "INVALID_AUCTION_IMAGE_UPLOAD"
    });
  });
}

function parseAuctionCategoryFields(req, res, next) {
  try {
    for (const field of ["categoryDetails", "imageLabels"]) {
      if (typeof req.body[field] === "string") {
        req.body[field] = JSON.parse(req.body[field]);
      }
    }
    next();
  } catch {
    return res.status(400).json({
      error: "بيانات الفئة أو تسميات الصور غير صالحة.",
      code: "INVALID_CATEGORY_AUCTION_DATA"
    });
  }
}

function uploadPrivateAuctionDocument(req, res, next) {
  auctionDocumentUpload.single("document")(req, res, (error) => {
    if (!error) return next();
    return res.status(error.status || (error.code === "LIMIT_FILE_SIZE" ? 413 : 400)).json({
      error: error.code === "LIMIT_FILE_SIZE"
        ? "حجم الوثيقة يتجاوز الحد المسموح (5MB)."
        : error.message || "تعذر رفع وثيقة المركبة.",
      code: "INVALID_AUCTION_DOCUMENT_UPLOAD"
    });
  });
}

async function hasValidDocumentSignature(file) {
  const buffer = await fs.readFile(file.path);
  if (file.mimetype === "application/pdf") return buffer.subarray(0, 5).toString() === "%PDF-";
  if (file.mimetype === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8;
  if (file.mimetype === "image/png") return buffer.subarray(0, 8).equals(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  );
  if (file.mimetype === "image/webp") {
    return buffer.subarray(0, 4).toString() === "RIFF" &&
      buffer.subarray(8, 12).toString() === "WEBP";
  }
  return false;
}

function ownerDocumentMetadata(auction) {
  return {
    status: auction.categoryDocumentStatus || "missing",
    items: (auction.categoryDocuments || []).filter((document) => document.isCurrent !== false).map((document) => ({
      id: String(document._id),
      type: document.type,
      typeLabel: document.typeLabel,
      reviewStatus: document.reviewStatus,
      version: document.version,
      expiresAt: document.expiresAt || null,
      uploadedAt: document.uploadedAt,
      reviewNotes: document.reviewNotes || null,
      rejectionReason: document.rejectionReason || null
    }))
  };
}

function filePaths(files) {
  return (files || []).map((file) => `/uploads/${file.filename}`);
}

function publicCategoryDetails(details) {
  const privateKeys = new Set([
    "vin", "imei", "serialnumber", "serial_number", "serialno",
    "servicetag", "servicetagnumber"
  ]);
  return Object.fromEntries(
    Object.entries(details).filter(([key]) => !privateKeys.has(key.toLowerCase()))
  );
}

async function validateAuctionFields(
  body,
  files,
  existingImages = [],
  existingImageLabels = [],
  { checkCategoryRequirements = false } = {}
) {
  if (!AUCTION_DURATION_DAYS.includes(Number(body.durationDays))) {
    throw new AuctionError(
      "INVALID_AUCTION_DURATION",
      "مدة المزاد يجب أن تكون يومًا أو 4 أيام أو أسبوعًا.",
      400
    );
  }

  const startingPrice = parseAuctionAmount(body.startingPrice, "السعر الابتدائي");
  const minimumIncrement = parseAuctionAmount(
    body.minimumIncrement,
    "الحد الأدنى للزيادة"
  );
  const [categoryResult, governorate] = await Promise.all([
    resolveAuctionCategoryRequirements(body.categoryId),
    Governorate.findOne({ _id: body.governorateId, isActive: { $ne: false } })
      .select("_id")
      .lean()
  ]);
  if (!categoryResult) throw new AuctionError("INVALID_CATEGORY", "الفئة غير متاحة.", 400);
  if (categoryResult.requirements.supported !== true) {
    throw new AuctionError(
      "UNSUPPORTED_AUCTION_CATEGORY",
      "هذا التصنيف غير مفعّل للمزادات.",
      400
    );
  }
  if (!governorate) {
    throw new AuctionError("INVALID_GOVERNORATE", "المحافظة غير متاحة.", 400);
  }

  let cityId = null;
  if (categoryResult.requirements.type === "vehicle" && !body.cityId) {
    throw new AuctionError("INVALID_CITY", "اختر المدينة لمعاينة المركبة.", 400);
  }
  if (body.cityId) {
    const city = await City.findOne({
      _id: body.cityId,
      governorateId: body.governorateId,
      isActive: { $ne: false }
    })
      .select("_id")
      .lean();
    if (!city) throw new AuctionError("INVALID_CITY", "المدينة لا تتبع المحافظة المحددة.", 400);
    cityId = city._id;
  }

  const images = files.length > 0 ? filePaths(files) : existingImages;
  const imageLabels = files.length > 0 ? body.imageLabels : existingImageLabels;
  if (!images.length) {
    throw new AuctionError("AUCTION_IMAGE_REQUIRED", "أضف صورة واحدة على الأقل للسلعة.", 400);
  }
  if (images.length > 10) {
    throw new AuctionError("TOO_MANY_AUCTION_IMAGES", "الحد الأعلى هو 10 صور.", 400);
  }
  if (imageLabels.length && imageLabels.length !== images.length) {
    throw new AuctionError(
      "INVALID_AUCTION_IMAGE_LABELS",
      "يجب تحديد نوع كل صورة مرفوعة.",
      400
    );
  }
  const categoryDataError = validateCategoryAuctionData(
    categoryResult.requirements,
    body.categoryDetails || {},
    imageLabels,
    { checkRequired: checkCategoryRequirements }
  );
  if (categoryDataError) {
    throw new AuctionError("INVALID_CATEGORY_AUCTION_DATA", categoryDataError, 400);
  }

  return {
    title: body.title,
    description: body.description,
    itemCondition: body.itemCondition,
    defectsNotes: body.defectsNotes,
    deliveryMethod: body.deliveryMethod,
    deliveryDetails: body.deliveryDetails,
    images,
    imageLabels,
    categoryDetails: body.categoryDetails || {},
    categoryId: categoryResult.category._id,
    governorateId: governorate._id,
    cityId,
    currency: body.currency,
    startingPrice: startingPrice.decimal,
    currentPrice: startingPrice.decimal,
    minimumIncrement: minimumIncrement.decimal,
    durationDays: Number(body.durationDays)
  };
}

async function isAuctionCategoryPublishable(auction) {
  return isPublicationEligible(auction);
}

function publicAuction(auction) {
  const owner = auction.ownerId && typeof auction.ownerId === "object"
    ? { name: auction.ownerId.name, avatar: auction.ownerId.avatar || null }
    : null;
  return {
    id: String(auction._id),
    title: auction.title,
    description: auction.description,
    categoryDetails: publicCategoryDetails(auction.categoryDetails || {}),
    imageLabels: auction.imageLabels || [],
    itemCondition: auction.itemCondition,
    defectsNotes: auction.defectsNotes,
    deliveryMethod: auction.deliveryMethod,
    deliveryDetails: auction.deliveryDetails,
    images: auction.images,
    category: auction.categoryId
      ? { name: auction.categoryId.name, slug: auction.categoryId.slug }
      : null,
    governorate: auction.governorateId
      ? { name: auction.governorateId.name }
      : null,
    city: auction.cityId ? { name: auction.cityId.name } : null,
    seller: owner,
    currency: auction.currency,
    startingPrice: serializeAuctionAmount(auction.startingPrice),
    currentPrice: serializeAuctionAmount(auction.currentPrice),
    minimumIncrement: serializeAuctionAmount(auction.minimumIncrement),
    durationDays: auction.durationDays,
    durationLabel: auctionDurationLabel(auction.durationDays),
    minimumBidAmount: addAuctionAmounts(
      auction.currentPrice,
      auction.minimumIncrement
    ).toString(),
    startAt: auction.startAt,
    endAt: auction.endAt,
    status: auction.status,
    bidCount: auction.bidCount,
    createdAt: auction.createdAt,
    endedAt: auction.endedAt,
    winner: auction.status === "ended" && auction.winnerId
      ? { label: "تم تحديد الفائز", amount: serializeAuctionAmount(auction.currentPrice) }
      : null,
    saleStatus: auction.saleStatus || "not_applicable"
  };
}

function ownerAuction(auction, userId) {
  const ownerId = auction.ownerId?._id || auction.ownerId;
  const winnerId = auction.winnerId?._id || auction.winnerId;
  const participantRole =
    userId && String(ownerId) === String(userId) ? "seller" : "winner";
  return {
    ...publicAuction(auction),
    participantRole,
    sellerContact: participantRole === "winner" ? auction.ownerId?.phone || null : null,
    categoryId: String(auction.categoryId?._id || auction.categoryId),
    governorateId: String(auction.governorateId?._id || auction.governorateId),
    cityId: auction.cityId ? String(auction.cityId._id || auction.cityId) : "",
    reviewStatus: auction.reviewStatus,
    rejectionReason: auction.rejectionReason,
    cancellationReason: auction.cancellationReason,
    winner: winnerId
      ? {
          id: String(winnerId),
          name: auction.winnerId?.name || null,
          phone: auction.winnerId?.phone || null
        }
      : null,
    winningBidId: String(auction.winningBidId?._id || auction.winningBidId || "") || null,
    sellerConfirmedAt: auction.sellerConfirmedAt || null,
    winnerConfirmedAt: auction.winnerConfirmedAt || null,
    disputeReportedAt: auction.disputeReportedAt || null,
    disputeReason: auction.disputeReason || null,
    categoryDetails: participantRole === "seller"
      ? auction.categoryDetails || {}
      : publicCategoryDetails(auction.categoryDetails || {}),
    imageLabels: auction.imageLabels || [],
    categoryDocuments: participantRole === "seller" ? ownerDocumentMetadata(auction) : undefined
  };
}

function populateAuction(query, includeWinner = false) {
  const populatedQuery = query
    .populate("categoryId", "name slug")
    .populate("governorateId", "name")
    .populate("cityId", "name")
    .populate(
      "ownerId",
      includeWinner
        ? "name avatar phone verificationStatus verificationExpiryDate isDisabled isDeleted"
        : "name avatar verificationStatus verificationExpiryDate isDisabled isDeleted"
    );
  if (includeWinner) populatedQuery.populate("winnerId", "name phone");
  return populatedQuery;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

router.get(
  "/categories",
  async (_req, res) => {
    try {
      res.json({ items: await listAuctionCategories() });
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.get(
  "/category-requirements",
  validateQuery(Joi.object({ categoryId: objectIdSchema })),
  async (req, res) => {
    try {
      const category = await resolveAuctionCategoryRequirements(req.query.categoryId);
      if (!category) {
        return res.status(400).json({ error: "الفئة غير متاحة.", code: "INVALID_CATEGORY" });
      }
      res.json({
        requirements: publicCategoryAuctionRequirements(category.requirements)
      });
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.post(
  "/:id/documents",
  auth,
  auctionIdParams,
  uploadPrivateAuctionDocument,
  cleanupPrivateAuctionDocument,
  validateBody(documentUploadSchema),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "ارفع ملف الوثيقة المطلوبة لهذا المزاد.",
          code: "AUCTION_DOCUMENT_REQUIRED"
        });
      }
      if (!(await hasValidDocumentSignature(req.file))) {
        return res.status(400).json({
          error: "محتوى الملف لا يطابق نوع الوثيقة المعلن.",
          code: "INVALID_AUCTION_DOCUMENT"
        });
      }

      const auction = await Auction.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        status: { $in: ["draft", "rejected"] },
        reviewStatus: { $in: ["draft", "rejected"] }
      });
      if (!auction) {
        return res.status(409).json({
          error: "لا يمكن رفع وثيقة لهذا المزاد في حالته الحالية.",
          code: "AUCTION_NOT_EDITABLE"
        });
      }
      const category = await resolveAuctionCategoryRequirements(auction.categoryId);
      const requirement = category?.requirements.documentRequirements?.find(
        (entry) => entry.key === req.body.type
      );
      if (!requirement || requirement.confidential !== true) {
        return res.status(400).json({
          error: "نوع الوثيقة غير متوافق مع فئة المزاد.",
          code: "INVALID_AUCTION_DOCUMENT_TYPE"
        });
      }
      const expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
      if (requirement.expiryMatters &&
        (!expiresAt || !Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date())) {
        return res.status(400).json({
          error: "أدخل تاريخ انتهاء صالحًا للوثيقة.",
          code: "AUCTION_DOCUMENT_EXPIRY_REQUIRED"
        });
      }

      const previousVersions = auction.categoryDocuments
        .filter((document) => document.type === requirement.key)
        .map((document) => document.version || 0);
      auction.categoryDocuments.forEach((document) => {
        if (document.isCurrent &&
          !category.requirements.documentRequirements.some((entry) => entry.key === document.type)) {
          document.isCurrent = false;
        } else if (document.type === requirement.key && document.isCurrent) {
          document.isCurrent = false;
        }
      });
      auction.categoryDocuments.push({
        type: requirement.key,
        typeLabel: requirement.label,
        policyVersion: category.requirements.documentPolicyVersion,
        storageKey: path.basename(req.file.filename),
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedBy: req.user.id,
        reviewStatus: "pending_review",
        uploadedAt: new Date(),
        expiresAt,
        version: Math.max(0, ...previousVersions) + 1,
        isCurrent: true
      });
      auction.categoryDocumentStatus = "pending_review";
      auction.status = "draft";
      auction.reviewStatus = "draft";
      auction.rejectionReason = null;
      await auction.save();
      req.privateAuctionDocumentCommitted = true;
      res.status(201).json({ auction: ownerAuction(auction.toObject(), req.user.id) });
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.get(
  "/mine",
  auth,
  validateQuery(
    Joi.object({
      page: Joi.number().integer().min(1).default(1),
      pageSize: Joi.number().integer().min(1).max(50).default(20)
    })
  ),
  async (req, res) => {
    try {
      const { page, pageSize } = req.query;
      const filter = {
        $or: [{ ownerId: req.user.id }, { winnerId: req.user.id }]
      };
      const [auctions, total] = await Promise.all([
        populateAuction(Auction.find(filter), true)
          .sort({ createdAt: -1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .lean(),
        Auction.countDocuments(filter)
      ]);
      res.json({
        items: auctions.map((auction) => ownerAuction(auction, req.user.id)),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      });
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.get("/mine/:id", auth, auctionIdParams, async (req, res) => {
  try {
    const auction = await populateAuction(
      Auction.findOne({
        _id: req.params.id,
          $or: [{ ownerId: req.user.id }, { winnerId: req.user.id }]
      }),
      true
    ).lean();
    if (!auction) {
      return res.status(404).json({ error: "المزاد غير موجود.", code: "AUCTION_NOT_FOUND" });
    }
    res.json({ auction: ownerAuction(auction, req.user.id) });
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/", validateQuery(listSchema), async (req, res) => {
  try {
    const { q, categoryId, governorateId, status, sort, page, pageSize } = req.query;
    const filter = {
      reviewStatus: "approved",
      status: status ? [status] : ["live", "scheduled", "ended"]
    };
    if (categoryId) filter.categoryId = categoryId;
    if (governorateId) filter.governorateId = governorateId;
    if (q) {
      const expression = new RegExp(escapeRegExp(q), "i");
      filter.$or = [{ title: expression }, { description: expression }];
    }

    const sortOption = {
      endingSoon: { endAt: 1, _id: 1 },
      newest: { createdAt: -1, _id: -1 },
      priceLow: { currentPrice: 1, _id: 1 },
      priceHigh: { currentPrice: -1, _id: -1 }
    }[sort];

    const [auctions, total] = await Promise.all([
      populateAuction(Auction.find(filter))
        .sort(sortOption)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      Auction.countDocuments(filter)
    ]);

    const publishableAuctions = [];
    for (const auction of auctions) {
      if (await isAuctionCategoryPublishable(auction)) publishableAuctions.push(auction);
    }
    res.json({
      items: publishableAuctions.map(publicAuction),
      pagination: {
        page,
        pageSize,
        total: Math.max(0, total - (auctions.length - publishableAuctions.length)),
        totalPages: Math.ceil(Math.max(0, total - (auctions.length - publishableAuctions.length)) / pageSize)
      }
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.post(
  "/",
  auth,
  requireCurrentVerification("يجب أن يكون حسابك موثقًا وساري التوثيق لإنشاء مزاد."),
  cleanupAuctionUploads,
  uploadAuctionImages,
  processImages(),
  validateProcessedImages,
  parseAuctionCategoryFields,
  validateBody(createSchema),
  async (req, res) => {
    try {
      const values = await validateAuctionFields(req.body, req.files || []);
      const auction = await Auction.create({
        ...values,
        ownerId: req.user.id,
        startAt: null,
        endAt: null,
        reviewStatus: "draft",
        status: "draft"
      });
      req.auctionUploadsCommitted = true;
      res.status(201).json({ auction: ownerAuction(auction.toObject(), req.user.id) });
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.get("/submission-requirements", (_req, res) => {
  res.json({
    durationOptions: AUCTION_DURATION_OPTIONS,
    acknowledgment: {
      version: AUCTION_OWNER_ACKNOWLEDGMENT_VERSION,
      text: AUCTION_OWNER_ACKNOWLEDGMENT_TEXT
    }
  });
});

router.get(
  "/:id/bids",
  auctionIdParams,
  async (req, res) => {
    try {
      const auction = await Auction.findOne({
        _id: req.params.id,
        reviewStatus: "approved",
        status: { $in: ["live", "scheduled", "ended"] }
      }).lean();
      if (!auction || !(await isAuctionCategoryPublishable(auction))) {
        return res.status(404).json({ error: "المزاد غير متاح.", code: "AUCTION_NOT_FOUND" });
      }
      const bids = await AuctionBid.find({ auctionId: auction._id })
        .select("amount sequence createdAt")
        .sort({ sequence: -1 })
        .limit(50)
        .lean();
      res.json({
        items: bids.map((bid) => ({
          amount: bid.amount.toString(),
          sequence: bid.sequence,
          bidderLabel: `مزايد ${bid.sequence}`,
          createdAt: bid.createdAt
        }))
      });
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.get("/:id", auctionIdParams, async (req, res) => {
  try {
    const auction = await populateAuction(
      Auction.findOne({
        _id: req.params.id,
        reviewStatus: "approved",
        status: { $in: ["live", "scheduled", "ended"] }
      })
    ).lean();
    if (!auction) {
      return res.status(404).json({ error: "المزاد غير متاح.", code: "AUCTION_NOT_FOUND" });
    }
    if (!(await isAuctionCategoryPublishable(auction))) {
      return res.status(404).json({ error: "المزاد غير متاح.", code: "AUCTION_NOT_FOUND" });
    }
    const bids = await AuctionBid.find({ auctionId: auction._id })
      .select("amount sequence createdAt")
      .sort({ sequence: -1 })
      .limit(50)
      .lean();
    res.json({
      auction: publicAuction(auction),
      bids: bids.map((bid) => ({
        amount: bid.amount.toString(),
        sequence: bid.sequence,
        bidderLabel: `مزايد ${bid.sequence}`,
        createdAt: bid.createdAt
      }))
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.post(
  "/:id/submit",
  auth,
  requireCurrentVerification("يجب أن يكون حسابك موثقًا وساري التوثيق لإرسال المزاد للمراجعة."),
  auctionIdParams,
  validateBody(submitSchema),
  async (req, res) => {
  try {
    if (req.body?.accepted !== true) {
      return res.status(400).json({
        error: "يجب الإقرار بصحة البيانات والالتزام بشروط المزاد قبل الإرسال.",
        code: "AUCTION_ACKNOWLEDGMENT_REQUIRED"
      });
    }
    const current = await Auction.findOne({
      _id: req.params.id,
      ownerId: req.user.id,
      status: { $in: ["draft", "rejected"] },
      reviewStatus: { $in: ["draft", "rejected"] }
    }).lean();
    if (!current) {
      return res.status(409).json({
        error: "لا يمكن إرسال هذا المزاد للمراجعة في حالته الحالية.",
        code: "INVALID_AUCTION_TRANSITION"
      });
    }
    const category = await resolveAuctionCategoryRequirements(current.categoryId);
    if (!category) {
      return res.status(400).json({ error: "الفئة غير متاحة.", code: "INVALID_CATEGORY" });
    }
    const categoryDataError = validateCategoryAuctionData(
      category.requirements,
      current.categoryDetails || {},
      current.imageLabels || []
    );
    if (categoryDataError) {
      return res.status(400).json({
        error: categoryDataError,
        code: "INVALID_CATEGORY_AUCTION_DATA"
      });
    }
    if (!hasRequiredDocuments(category.requirements, current.categoryDocuments || [])) {
      return res.status(400).json({
        error: "أكمل وثائق الفئة المطلوبة قبل إرسال المزاد للمراجعة.",
        code: "AUCTION_DOCUMENT_REQUIRED"
      });
    }
    if ((current.categoryDocuments || []).some((document) =>
      document.isCurrent !== false && document.reviewStatus === "rejected"
    )) {
      return res.status(400).json({
        error: "استبدل الوثائق المرفوضة قبل إرسال المزاد للمراجعة.",
        code: "AUCTION_DOCUMENT_REJECTED"
      });
    }

    const now = new Date();
    const auction = await Auction.findOneAndUpdate(
      {
        _id: req.params.id,
        ownerId: req.user.id,
        status: { $in: ["draft", "rejected"] },
        reviewStatus: { $in: ["draft", "rejected"] }
      },
      {
        $set: {
          status: "draft",
          reviewStatus: "pending",
          rejectionReason: null
        },
        $push: {
          submissionAcknowledgments: {
            acceptedBy: req.user.id,
            acceptedAt: now,
            version: AUCTION_OWNER_ACKNOWLEDGMENT_VERSION,
            text: AUCTION_OWNER_ACKNOWLEDGMENT_TEXT
          }
        }
      },
      { new: true, runValidators: true }
    );
    if (!auction) {
      return res.status(409).json({
        error: "تغيرت حالة المزاد قبل إرساله للمراجعة.",
        code: "INVALID_AUCTION_TRANSITION"
      });
    }

    res.json({ auction: ownerAuction(auction.toObject(), req.user.id) });
  } catch (error) {
    sendError(res, error);
  }
  }
);

router.patch(
  "/:id",
  auth,
  cleanupAuctionUploads,
  uploadAuctionImages,
  processImages(),
  validateProcessedImages,
  parseAuctionCategoryFields,
  validateParams(Joi.object({ id: objectIdSchema })),
  validateBody(updateSchema),
  async (req, res) => {
    try {
      const filter = {
        _id: req.params.id,
        ownerId: req.user.id,
        status: { $in: ["draft", "rejected"] },
        reviewStatus: { $in: ["draft", "rejected"] }
      };
      const current = await Auction.findOne({
        _id: req.params.id,
        ownerId: req.user.id
      }).lean();
      if (!current) {
        return res.status(409).json({
          error: "لا يمكن تعديل المزاد بعد إرساله للمراجعة أو بدءه.",
          code: "AUCTION_NOT_EDITABLE"
        });
      }
      const currentCategory = await resolveAuctionCategoryRequirements(current.categoryId);
      const standardEdit = ["draft", "rejected"].includes(current.status) &&
        ["draft", "rejected"].includes(current.reviewStatus);
      const approvedCategoryEdit = current.reviewStatus === "approved" &&
        ["scheduled", "live"].includes(current.status) &&
        current.bidCount === 0 &&
        currentCategory?.requirements.documents.length > 0;
      if (!standardEdit && !approvedCategoryEdit) {
        return res.status(409).json({
          error: "لا يمكن تعديل المزاد بعد إرساله للمراجعة أو بدء المزايدات.",
          code: "AUCTION_NOT_EDITABLE"
        });
      }
      const updateFilter = standardEdit
        ? filter
        : {
            _id: current._id,
            ownerId: req.user.id,
            status: current.status,
            reviewStatus: "approved",
            bidCount: 0
          };
      const values = await validateAuctionFields(
        req.body,
        req.files || [],
        current.images,
        current.imageLabels || []
      );
      if (approvedCategoryEdit && values.durationDays !== current.durationDays) {
        return res.status(409).json({
          error: "لا يمكن تغيير مدة المزاد بعد موافقة الإدارة.",
          code: "AUCTION_DURATION_IMMUTABLE"
        });
      }
      if (String(current.categoryId) !== String(values.categoryId)) {
        return res.status(400).json({
          error: "لا يمكن تغيير فئة المزاد بعد إنشاء المسودة.",
          code: "AUCTION_CATEGORY_IMMUTABLE"
        });
      }
      const materialCategoryDetailsChanged = categoryDocumentsNeedReview(
        currentCategory?.requirements,
        current.categoryDetails || {},
        values.categoryDetails || {}
      );
      const propertyLocationChanged = currentCategory?.requirements.type === "property" &&
        (String(current.governorateId) !== String(values.governorateId) ||
          String(current.cityId || "") !== String(values.cityId || ""));
      const reopenDocuments = Boolean(
        currentCategory?.requirements.documents.length &&
        (materialCategoryDetailsChanged || propertyLocationChanged) &&
        (approvedCategoryEdit || (current.categoryDocuments || []).some((document) =>
          document.isCurrent !== false && document.reviewStatus === "approved"
        ))
      );
      let auction;
      if (reopenDocuments) {
        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            const updatedDocuments = current.categoryDocuments.map((document) => ({
              ...document,
              reviewStatus: document.isCurrent === false ? document.reviewStatus : "pending_review",
              reviewedBy: document.isCurrent === false ? document.reviewedBy : null,
              reviewedAt: document.isCurrent === false ? document.reviewedAt : null,
              reviewNotes: document.isCurrent === false ? document.reviewNotes : null,
              rejectionReason: document.isCurrent === false ? document.rejectionReason : null
            }));
            auction = await Auction.findOneAndUpdate(
              updateFilter,
              {
                $set: {
                  ...values,
                  categoryDocuments: updatedDocuments,
                  categoryDocumentStatus: "pending_review",
                  status: "draft",
                  reviewStatus: "draft",
                  approvedBy: null,
                  approvedAt: null,
                  rejectionReason: null
                }
              },
              { new: true, runValidators: true, session }
            );
            if (!auction) return;
            await AuctionAuditLog.create([{
              auctionId: auction._id,
              actorId: req.user.id,
              actorRole: "owner",
              action: "category_documents_reopened",
              decisionAt: new Date(),
              reason: "تم تغيير بيانات الفئة الجوهرية؛ يلزم إعادة مراجعة الوثائق.",
              previousStatus: current.status,
              previousReviewStatus: current.reviewStatus,
              nextStatus: auction.status,
              nextReviewStatus: auction.reviewStatus
            }], { session });
          });
        } finally {
          await session.endSession();
        }
      } else {
        auction = await Auction.findOneAndUpdate(
          updateFilter,
          {
            $set: {
              ...values,
              status: "draft",
              reviewStatus: "draft",
              approvedBy: null,
              approvedAt: null,
              rejectionReason: null
            }
          },
          { new: true, runValidators: true }
        );
      }
      if (!auction) {
        return res.status(409).json({
          error: "تغيرت حالة المزاد قبل حفظ التعديلات.",
          code: "AUCTION_NOT_EDITABLE"
        });
      }
      req.auctionUploadsCommitted = true;
      res.json({ auction: ownerAuction(auction.toObject(), req.user.id) });
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.post(
  "/:id/cancel",
  auth,
  auctionIdParams,
  validateBody(
    Joi.object({
      reason: Joi.string().trim().max(1_000).allow("").default("")
    })
  ),
  async (req, res) => {
    try {
      const now = new Date();
      const auction = await Auction.findOneAndUpdate({
        _id: req.params.id,
        ownerId: req.user.id,
        $or: [
          { status: "draft" },
          { status: "scheduled", startAt: { $gt: now } }
        ]
      }, {
        $set: {
          status: "cancelled",
          cancelledBy: req.user.id,
          cancelledAt: now,
          cancellationReason: req.body.reason || null
        }
      }, { new: true, runValidators: true });
      if (!auction) {
        return res.status(409).json({
          error: "لا يمكن إلغاء المزاد في حالته الحالية.",
          code: "INVALID_AUCTION_TRANSITION"
        });
      }
      req.app.get("io")?.to(`auction:${auction._id}`).emit("auction:status", {
        auctionId: String(auction._id),
        status: auction.status,
        endAt: auction.endAt
      });
      res.json({ auction: ownerAuction(auction.toObject(), req.user.id) });
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.post(
  "/:id/completion",
  auth,
  auctionIdParams,
  validateBody(completionSchema),
  async (req, res) => {
    try {
      const now = new Date();
      const participantFilter = {
        _id: req.params.id,
        status: "ended",
        winnerId: { $ne: null },
        saleStatus: "awaiting_confirmation",
        $or: [{ ownerId: req.user.id }, { winnerId: req.user.id }]
      };
      const current = await Auction.findOne(participantFilter).lean();
      if (!current) {
        return res.status(409).json({
          error: "لا يمكن تحديث متابعة الصفقة في حالة هذا المزاد.",
          code: "AUCTION_COMPLETION_UNAVAILABLE"
        });
      }

      const isSeller = String(current.ownerId) === String(req.user.id);
      let auction;
      if (req.body.action === "report") {
        auction = await Auction.findOneAndUpdate(
          participantFilter,
          {
            $set: {
              saleStatus: "disputed",
              disputeReportedBy: req.user.id,
              disputeReportedAt: now,
              disputeReason: req.body.reason
            }
          },
          { new: true, runValidators: true }
        );
        if (!auction) {
          return res.status(409).json({
            error: "تغيرت حالة الصفقة قبل تسجيل البلاغ.",
            code: "AUCTION_COMPLETION_UNAVAILABLE"
          });
        }

        const otherPartyId = isSeller ? auction.winnerId : auction.ownerId;
        const notification = await createNotification(req.app, {
          userId: otherPartyId,
          type: "auction",
          title: "تم الإبلاغ عن مشكلة في إتمام الصفقة",
          body: `تم تسجيل بلاغ مرتبط بالمزاد "${auction.title}".`,
          data: { auctionId: String(auction._id), event: "dispute_reported" }
        });
        if (!notification) {
          console.warn("[Auction API] Dispute notification was not stored.", {
            auctionId: String(auction._id)
          });
        }
      } else {
        const confirmationField = isSeller ? "sellerConfirmedAt" : "winnerConfirmedAt";
        auction = current[confirmationField]
          ? await Auction.findById(current._id)
          : await Auction.findOneAndUpdate(
              { ...participantFilter, [confirmationField]: null },
              { $set: { [confirmationField]: now } },
              { new: true, runValidators: true }
            );
        if (!auction) {
          auction = await Auction.findById(current._id);
          if (!auction || !auction[confirmationField]) {
            return res.status(409).json({
              error: "تغيرت حالة الصفقة قبل تأكيدها.",
              code: "AUCTION_COMPLETION_UNAVAILABLE"
            });
          }
        }

        let newlyCompleted = false;
        if (auction.sellerConfirmedAt && auction.winnerConfirmedAt) {
          const completedAuction = await Auction.findOneAndUpdate(
            {
              _id: auction._id,
              status: "ended",
              saleStatus: "awaiting_confirmation",
              sellerConfirmedAt: { $ne: null },
              winnerConfirmedAt: { $ne: null }
            },
            { $set: { saleStatus: "completed" } },
            { new: true, runValidators: true }
          );
          if (completedAuction) {
            auction = completedAuction;
            newlyCompleted = true;
          }
        }

        if (newlyCompleted) {
          const otherPartyId = isSeller ? auction.winnerId : auction.ownerId;
          const notification = await createNotification(req.app, {
            userId: otherPartyId,
            type: "auction",
            title: "تم تأكيد إتمام الصفقة",
            body: `أكد الطرفان إتمام الصفقة الخاصة بالمزاد "${auction.title}".`,
            data: { auctionId: String(auction._id), event: "sale_completed" }
          });
          if (!notification) {
            console.warn("[Auction API] Completion notification was not stored.", {
              auctionId: String(auction._id)
            });
          }
        }
      }

      res.json({ auction: ownerAuction(auction.toObject(), req.user.id) });
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.post(
  "/:id/bids",
  auth,
  requireCurrentVerification("يجب أن يكون حسابك موثقًا وساري التوثيق للمزايدة."),
  bidRateLimit,
  auctionIdParams,
  validateBody(bidSchema),
  async (req, res) => {
    try {
      const result = await placeAuctionBid({
        auctionId: req.params.id,
        bidderId: req.user.id,
        amount: req.body.amount,
        idempotencyKey: req.body.idempotencyKey,
        app: req.app
      });
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) {
      sendError(res, error);
    }
  }
);

export default router;
