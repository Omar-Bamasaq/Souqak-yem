import { Router } from "express";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import mongoose from "mongoose";
import path from "path";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import {
  uploadBankLogo,
  uploadWalletServiceCategoryImage,
  uploadWalletServiceReceipt,
  processImage
} from "../middleware/upload.js";
import DigitalServiceCategory from "../models/DigitalServiceCategory.js";
import DraftAction from "../models/DraftAction.js";
import WalletService from "../models/WalletService.js";
import WalletServiceOrder from "../models/WalletServiceOrder.js";
import WalletServiceFeeSettings from "../models/WalletServiceFeeSettings.js";
import { findDraftActionResult, getIncompleteDraftForSubmission, markDraftCompleted } from "../services/draftActions.js";
import { createAdminNotification, createNotification } from "../services/notificationService.js";
import { scanUrlWithCloudflare, UrlScanServiceError } from "../services/cloudflareUrlScanner.js";
import {
  calculateWalletServiceTotals,
  isWalletServiceQuantityAllowed,
  normalizeFeeBands,
  upgradeLegacyFeeBands,
  WALLET_SERVICE_CURRENCIES
} from "../utils/walletServicePricing.js";
import {
  WALLET_SERVICE_PRICING_TYPES,
  WALLET_SERVICE_TYPES,
  getWalletServiceVersionAt,
  getWalletServiceVersion,
  isWalletServiceVersionValidAt,
  normalizeFormSchema,
  normalizeWalletServicePackages,
  validateFormAnswers
} from "../utils/walletServiceDynamicConfig.js";

const router = Router();
const isAdmin = [auth, requireRole(["admin"])];

class RequestValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "RequestValidationError";
  }
}

function isValidationError(error) {
  return error instanceof RequestValidationError
    || error.name === "Error"
    || error.name === "ValidationError";
}

function makeHistoryEntry(status, note, user) {
  return {
    status,
    note,
    actor: user?.id || null,
    actorRole: user?.role || "system",
    createdAt: new Date()
  };
}

async function notifyOrderUser(app, order, title, body) {
  await createNotification(app, {
    userId: order.user,
    type: "wallet_service",
    title,
    body,
    data: { walletServiceOrderId: order._id },
    push: false
  });
}

function parseSections(value) {
  if (typeof value !== "string") return Array.isArray(value) ? value : [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) throw new Error("يجب أن تكون الأقسام قائمة.");
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("بيانات الأقسام غير صالحة.");
    throw error;
  }
}

function parseArray(value, label) {
  if (typeof value !== "string") {
    if (!Array.isArray(value)) throw new Error(`${label} غير صالح.`);
    return value;
  }
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) throw new Error(`${label} غير صالح.`);
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`${label} غير صالح.`);
    throw error;
  }
}

function assertKnownKeys(body, keys) {
  const unknownKey = Object.keys(body).find((key) => !keys.includes(key));
  if (unknownKey) throw new RequestValidationError(`الحقل ${unknownKey} غير معروف.`);
}

function readBoolean(value, label, fallback) {
  if (value === undefined) return fallback;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  throw new Error(`${label} غير صالح.`);
}

function readText(value, fallback, label, maxLength) {
  if (value === undefined) value = fallback;
  if (typeof value !== "string") throw new Error(`${label} غير صالح.`);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${label} يتجاوز الحد المسموح.`);
  return text;
}

function validObjectId(value) {
  return typeof value === "string" && mongoose.Types.ObjectId.isValid(value);
}

function normalizeCategoryInput(body, existing = {}, file) {
  assertKnownKeys(body, ["name", "slug", "description", "image", "sortOrder", "isActive"]);
  const name = readText(body.name, existing.name ?? "", "اسم التصنيف", 120);
  const slug = readText(body.slug, existing.slug ?? "", "معرف التصنيف", 80).toLowerCase();
  const description = readText(body.description, existing.description ?? "", "وصف التصنيف", 1000);
  const image = file
    ? `/uploads/logos/${file.filename}`
    : readText(body.image, existing.image ?? "", "صورة التصنيف", 500);
  const sortOrder = Number(body.sortOrder ?? existing.sortOrder ?? 0);
  if (!name || name.length > 120) throw new Error("اسم التصنيف مطلوب وبحد أقصى 120 حرفًا.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
    throw new Error("معرف التصنيف يجب أن يتكون من أحرف إنجليزية صغيرة وأرقام وشرطة.");
  }
  if (description.length > 1000 || image.length > 500 || !Number.isSafeInteger(sortOrder)) {
    throw new Error("بيانات التصنيف أو ترتيبه غير صالحة.");
  }
  return {
    name,
    slug,
    description,
    image,
    sortOrder,
    isActive: readBoolean(body.isActive, "حالة التصنيف", existing.isActive ?? true)
  };
}

async function ensureActiveCategory(categoryId) {
  if (!categoryId) return null;
  const category = await DigitalServiceCategory.findOne({
    _id: categoryId,
    isActive: true,
    isArchived: false
  }).lean();
  if (!category) throw new Error("التصنيف غير موجود أو غير نشط.");
  return category;
}

function normalizeServiceInput(body, file, existing = {}) {
  assertKnownKeys(body, [
    "name", "description", "image", "categoryId", "serviceType", "pricingType",
    "formSchema", "packages", "currency", "unitLabel", "unitPrice",
    "minimumQuantityEnabled", "maximumQuantityEnabled", "minimumQuantity", "maximumQuantity",
    "customerInfoLabel", "sections", "isActive", "sortOrder"
  ]);
  const name = readText(body.name, existing.name ?? "", "اسم الخدمة", 120);
  const currency = readText(body.currency, existing.currency ?? "USD", "عملة الخدمة", 20);
  const unitLabel = readText(body.unitLabel, existing.unitLabel ?? "وحدة", "وحدة القياس", 40);
  const description = readText(body.description, existing.description ?? "", "وصف الخدمة", 1000);
  const customerInfoLabel = readText(
    body.customerInfoLabel,
    existing.customerInfoLabel ?? "",
    "عنوان البيانات الإضافية",
    100
  );
  const minimumQuantityEnabled = readBoolean(
    body.minimumQuantityEnabled,
    "تفعيل الحد الأدنى للكمية",
    existing.minimumQuantityEnabled ?? true
  );
  const maximumQuantityEnabled = readBoolean(
    body.maximumQuantityEnabled,
    "تفعيل الحد الأعلى للكمية",
    existing.maximumQuantityEnabled ?? true
  );
  const minimumQuantity = Number(body.minimumQuantity ?? existing.minimumQuantity ?? 1);
  const maximumQuantity = Number(body.maximumQuantity ?? existing.maximumQuantity ?? 50000);
  const unitPrice = body.unitPrice === undefined
    ? existing.unitPrice
    : body.unitPrice === "" || body.unitPrice === null
      ? undefined
      : Number(body.unitPrice);
  const sections = body.sections === undefined
    ? (existing.sections || [])
    : parseSections(body.sections);
  const serviceType = readText(body.serviceType, existing.serviceType ?? "OTHER", "نوع الخدمة", 40);
  const pricingType = readText(body.pricingType, existing.pricingType ?? "UNIT", "طريقة التسعير", 20);
  const formSchemaInput = body.formSchema === undefined
    ? (existing.formSchema || [])
    : parseArray(body.formSchema, "مخطط النموذج");
  const formSchema = normalizeFormSchema(formSchemaInput);
  const packagesInput = body.packages === undefined
    ? (existing.packages || [])
    : parseArray(body.packages, "قائمة الباقات");
  const packages = normalizeWalletServicePackages(packagesInput, currency);
  const categoryIdValue = body.categoryId === undefined ? existing.categoryId : body.categoryId;
  if (categoryIdValue !== undefined && categoryIdValue !== null
    && typeof categoryIdValue !== "string" && !(categoryIdValue instanceof mongoose.Types.ObjectId)) {
    throw new Error("تصنيف الخدمة غير صالح.");
  }
  const categoryId = categoryIdValue === "" || categoryIdValue == null ? null : String(categoryIdValue);
  const formSchemaVersion = Number(existing.formSchemaVersion || 1);
  const sortOrder = Number(body.sortOrder ?? existing.sortOrder ?? 0);
  const isActive = readBoolean(body.isActive, "حالة الخدمة", existing.isActive ?? true);

  if (!name || name.length > 120) throw new Error("اسم الخدمة مطلوب وبحد أقصى 120 حرفًا.");
  if (!WALLET_SERVICE_CURRENCIES.includes(currency)) throw new Error("عملة الخدمة غير مدعومة.");
  if (!WALLET_SERVICE_TYPES.includes(serviceType)) throw new Error("نوع الخدمة غير مدعوم.");
  if (!WALLET_SERVICE_PRICING_TYPES.includes(pricingType)) throw new Error("طريقة تسعير الخدمة غير مدعومة.");
  if (!unitLabel || unitLabel.length > 40) throw new Error("وحدة القياس مطلوبة وبحد أقصى 40 حرفًا.");
  if (categoryId && !mongoose.Types.ObjectId.isValid(categoryId)) throw new Error("تصنيف الخدمة غير صالح.");
  if ((minimumQuantityEnabled && (!Number.isInteger(minimumQuantity) || minimumQuantity < 1))
    || (maximumQuantityEnabled && (!Number.isInteger(maximumQuantity) || maximumQuantity < 1))
    || (minimumQuantityEnabled && maximumQuantityEnabled && maximumQuantity < minimumQuantity)) {
    throw new Error("حدود الكمية غير صالحة.");
  }
  if (!Number.isSafeInteger(sortOrder) || !Number.isSafeInteger(formSchemaVersion) || formSchemaVersion < 1) {
    throw new Error("ترتيب الخدمة أو إصدار النموذج غير صالح.");
  }
  if (!Array.isArray(sections) || sections.length > 100) throw new Error("قائمة الأقسام غير صالحة.");

  const normalizedSections = sections.map((section) => {
    const sectionName = String(section?.name || "").trim();
    const sectionUnitPrice = Number(section?.unitPrice);
    if (!sectionName || sectionName.length > 100 || !Number.isFinite(sectionUnitPrice) || sectionUnitPrice < 0) {
      throw new Error("اسم القسم وسعره مطلوبان ويجب أن يكون السعر صفرًا أو أكثر.");
    }
    return { name: sectionName, unitPrice: sectionUnitPrice, ...(section._id ? { _id: section._id } : {}) };
  });

  if (["FIXED", "UNIT"].includes(pricingType)
    && normalizedSections.length === 0
    && (!Number.isFinite(unitPrice) || unitPrice < 0)) {
    throw new Error("سعر الوحدة مطلوب عندما لا تحتوي الخدمة على أقسام.");
  }
  if (pricingType === "FIXED" && normalizedSections.length) {
    throw new Error("الخدمة ذات السعر الثابت لا تستخدم الأقسام.");
  }
  if (pricingType === "PACKAGE" && (!packages.length || normalizedSections.length)) {
    throw new Error("خدمة الباقات تحتاج إلى باقة واحدة على الأقل ولا تستخدم الأقسام.");
  }
  if (pricingType === "PACKAGE" && isActive && !packages.some((item) => item.isActive)) {
    throw new Error("يجب تفعيل باقة واحدة على الأقل قبل تفعيل الخدمة.");
  }
  if (pricingType !== "PACKAGE" && packages.length) {
    throw new Error("لا تقبل الباقات إلا مع طريقة التسعير PACKAGE.");
  }
  const image = file
    ? `/uploads/logos/${file.filename}`
    : readText(body.image, existing.image ?? "", "صورة الخدمة", 500);

  return {
    name,
    description,
    image,
    categoryId,
    serviceType,
    pricingType,
    formSchema,
    formSchemaVersion,
    packages,
    currency,
    unitLabel,
    unitPrice: normalizedSections.length ? undefined : unitPrice,
    minimumQuantityEnabled,
    maximumQuantityEnabled,
    minimumQuantity,
    maximumQuantity,
    customerInfoLabel,
    sections: normalizedSections,
    isActive,
    isArchived: existing.isArchived ?? false,
    sortOrder
  };
}

function snapshotServiceConfiguration(service) {
  const source = typeof service.toObject === "function" ? service.toObject() : service;
  const fields = [
    "name", "description", "image", "categoryId", "serviceType", "pricingType",
    "formSchema", "formSchemaVersion", "packages", "currency", "unitLabel",
    "unitPrice", "minimumQuantityEnabled", "maximumQuantityEnabled",
    "minimumQuantity", "maximumQuantity", "customerInfoLabel", "sections",
    "isActive", "sortOrder"
  ];
  const snapshot = Object.fromEntries(fields.map((field) => [field, source[field]]));
  return JSON.parse(JSON.stringify(snapshot));
}

function serviceResponse(service, { includeHistory = false } = {}) {
  const source = typeof service.toObject === "function" ? service.toObject() : service;
  const { versionHistory, orderCreationRevision, ...publicFields } = source;
  const response = {
    ...publicFields,
    categoryId: publicFields.categoryId ?? null,
    serviceType: publicFields.serviceType || "OTHER",
    pricingType: publicFields.pricingType || "UNIT",
    formSchema: publicFields.formSchema || [],
    formSchemaVersion: Number(publicFields.formSchemaVersion || 1),
    serviceVersion: Number(publicFields.serviceVersion || 1),
    packages: publicFields.packages || [],
    sections: publicFields.sections || [],
    isArchived: publicFields.isArchived ?? false
  };
  return includeHistory ? { ...response, versionHistory: versionHistory || [] } : response;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function walletServiceIdempotencyKey(req) {
  const value = req.get?.("Idempotency-Key")
    || req.headers?.["idempotency-key"]
    || req.body?.idempotencyKey;
  if (value === undefined) throw new RequestValidationError("مفتاح منع تكرار الطلب مطلوب. حدّث التطبيق ثم أعد المحاولة.");
  if (typeof value !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(value)) {
    throw new RequestValidationError("مفتاح منع تكرار الطلب غير صالح.");
  }
  return value;
}

function idempotencyPayloadHash(orderType, payload) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize({ orderType, ...payload })))
    .digest("hex");
}

function sameIdempotencyPayload(order, orderType, hash) {
  return order.orderType === orderType && order.idempotencyPayloadHash === hash;
}

async function findIdempotentOrder(userId, idempotencyKey) {
  return WalletServiceOrder.findOne({ user: userId, idempotencyKey }).lean();
}

async function waitForIdempotentOrder(userId, idempotencyKey) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const order = await findIdempotentOrder(userId, idempotencyKey);
    if (order) return order;
    if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return null;
}

function idempotencyConflict(order, orderType, hash) {
  return sameIdempotencyPayload(order, orderType, hash)
    ? { status: 200, order }
    : { status: 409, error: "استُخدم مفتاح منع التكرار لبيانات طلب مختلفة أو نوع طلب آخر." };
}

async function validateReceiptOrder(req, res, next) {
  try {
    if (!validObjectId(req.params.id)) {
      return res.status(404).json({ error: "الطلب غير موجود." });
    }
    const order = await WalletServiceOrder.findOne({
      _id: req.params.id,
      user: req.user.id,
      status: { $in: ["AWAITING_PAYMENT", "PAYMENT_NEEDS_CORRECTION"] }
    }).select("_id").lean();
    if (!order) return res.status(400).json({ error: "الطلب غير متاح لإرفاق سند الدفع." });
    next();
  } catch (error) {
    console.error("Validate wallet service receipt upload failed:", error);
    res.status(500).json({ error: "تعذر التحقق من الطلب قبل رفع السند." });
  }
}

async function removeUnlinkedReceiptFiles(paths) {
  for (const filePath of new Set(paths.filter(Boolean))) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error("Remove unlinked wallet service receipt failed:", {
          path: filePath,
          message: error.message
        });
      }
    }
  }
}

async function removeUnlinkedCategoryImage(file) {
  if (!file?.path) return;
  const logosDirectory = path.resolve(process.cwd(), "uploads", "logos");
  const filePath = path.resolve(file.path);
  const filename = path.basename(filePath);
  if (
    path.dirname(filePath) !== logosDirectory
    || !/^public-[a-z0-9-]+\.webp$/i.test(filename)
  ) {
    console.error("Refusing to remove an unexpected wallet service category image path.", {
      path: file.path
    });
    return;
  }

  const stem = filename.slice(0, -".webp".length);
  await removeUnlinkedReceiptFiles([
    path.join(logosDirectory, `${stem}.webp`),
    path.join(logosDirectory, `${stem}.med.webp`),
    path.join(logosDirectory, `${stem}.thumb.webp`)
  ]);
}

async function getFeeBands() {
  const settings = await WalletServiceFeeSettings.findOne({ key: "wallet-services" }).lean();
  if (!settings) return [];
  if (settings.feeBandVersion >= 2) return normalizeFeeBands(settings.feeBands || []);

  const feeBands = upgradeLegacyFeeBands(settings.feeBands || []);
  return normalizeFeeBands(feeBands);
}

router.get("/categories", async (_req, res) => {
  try {
    const categories = await DigitalServiceCategory.find({ isActive: true, isArchived: false })
      .sort({ sortOrder: 1, name: 1 })
      .lean();
    res.json(categories);
  } catch (error) {
    console.error("Load digital service categories failed:", error);
    res.status(500).json({ error: "تعذر تحميل تصنيفات الخدمات." });
  }
});

router.get("/categories/:slug", async (req, res) => {
  try {
    const category = await DigitalServiceCategory.findOne({
      slug: String(req.params.slug).toLowerCase(),
      isActive: true,
      isArchived: false
    }).lean();
    if (!category) return res.status(404).json({ error: "التصنيف غير موجود." });
    const services = await WalletService.find({
      categoryId: category._id,
      isActive: true,
      isArchived: { $ne: true }
    }).sort({ sortOrder: 1, createdAt: 1 }).lean();
    res.json({ category, services: services.map((service) => serviceResponse(service)) });
  } catch (error) {
    console.error("Load digital services by category failed:", error);
    res.status(500).json({ error: "تعذر تحميل خدمات التصنيف." });
  }
});

router.get("/services/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: "الخدمة غير موجودة." });
    }
    const service = await WalletService.findOne({
      _id: req.params.id,
      isActive: true,
      isArchived: { $ne: true }
    }).lean();
    if (!service) return res.status(404).json({ error: "الخدمة غير موجودة." });
    if (service.categoryId) {
      const category = await DigitalServiceCategory.findOne({
        _id: service.categoryId,
        isActive: true,
        isArchived: false
      }).lean();
      if (!category) return res.status(404).json({ error: "الخدمة غير موجودة." });
    }
    res.json(serviceResponse(service));
  } catch (error) {
    console.error("Load digital service details failed:", error);
    res.status(500).json({ error: "تعذر تحميل تفاصيل الخدمة." });
  }
});

router.get("/services/:id/versions/:version", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: "الخدمة غير موجودة." });
    }
    const service = await WalletService.findOne({
      _id: req.params.id,
      isActive: true,
      isArchived: { $ne: true }
    }).lean();
    if (!service) return res.status(404).json({ error: "الخدمة غير موجودة." });
    const config = getWalletServiceVersion(service, req.params.version);
    if (!config) return res.status(404).json({ error: "إصدار الخدمة غير متاح." });
    if (config.categoryId) {
      const category = await DigitalServiceCategory.findOne({
        _id: config.categoryId,
        isActive: true,
        isArchived: false
      }).lean();
      if (!category) return res.status(404).json({ error: "الخدمة غير موجودة." });
    }
    res.json({
      ...serviceResponse(config),
      _id: service._id,
      serviceVersion: Number(req.params.version)
    });
  } catch (error) {
    console.error("Load historical digital service version failed:", error);
    res.status(500).json({ error: "تعذر تحميل إصدار الخدمة." });
  }
});

router.get("/", async (_req, res) => {
  try {
    const activeCategories = await DigitalServiceCategory.find({ isActive: true, isArchived: false })
      .select("_id")
      .lean();
    const categoryIds = activeCategories.map((category) => category._id);
    const services = await WalletService.find({
      isActive: true,
      isArchived: { $ne: true },
      $or: [{ categoryId: null }, { categoryId: { $exists: false } }, { categoryId: { $in: categoryIds } }]
    }).sort({ sortOrder: 1, createdAt: 1 }).lean();
    const [feeBands] = await Promise.all([getFeeBands()]);
    res.json({ services: services.map((service) => serviceResponse(service)), feeBands });
  } catch (error) {
    console.error("Load wallet service catalog failed:", error);
    res.status(500).json({ error: "تعذر تحميل خدمات الدفع." });
  }
});

router.get("/mine/orders", auth, async (req, res) => {
  try {
    const orders = await WalletServiceOrder.find({ user: req.user.id })
      .populate("statusHistory.actor", "name role")
      .sort({ createdAt: -1 })
      .lean();
    res.json(orders);
  } catch (error) {
    console.error("Load wallet service customer orders failed:", error);
    res.status(500).json({ error: "تعذر تحميل طلباتك." });
  }
});

router.get("/mine/orders/:id", auth, async (req, res) => {
  try {
    const order = await WalletServiceOrder.findOne({ _id: req.params.id, user: req.user.id })
      .populate("statusHistory.actor", "name role")
      .lean();
    if (!order) return res.status(404).json({ error: "الطلب غير موجود." });
    res.json(order);
  } catch (error) {
    console.error("Load wallet service customer order failed:", error);
    res.status(500).json({ error: "تعذر تحميل الطلب." });
  }
});

router.post("/orders", auth, async (req, res) => {
  try {
    const body = req.body || {};
    const { orderType, serviceId, sectionId, quantity, customerInfo, whatsappNumber, customerNotes } = body;
    const draftActionId = req.body?.draftActionId;
    if (orderType === "custom") {
      assertKnownKeys(body, [
        "orderType", "serviceName", "serviceUrl", "whatsappNumber", "customerNotes", "idempotencyKey"
      ]);
    } else if (orderType === "catalog") {
      assertKnownKeys(body, [
        "orderType", "serviceId", "sectionId", "quantity", "customerInfo", "whatsappNumber",
        "customerNotes", "draftActionId", "serviceVersion", "formSchemaVersion",
        "packageId", "answers", "idempotencyKey"
      ]);
    } else {
      return res.status(400).json({ error: "نوع الطلب غير مدعوم." });
    }
    let idempotencyKey;
    try {
      idempotencyKey = walletServiceIdempotencyKey(req);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    const requestPayload = { ...body };
    delete requestPayload.idempotencyKey;
    const requestPayloadHash = idempotencyPayloadHash(orderType, requestPayload);
    const priorOrder = await findIdempotentOrder(req.user.id, idempotencyKey);
    if (priorOrder) {
      const replay = idempotencyConflict(priorOrder, orderType, requestPayloadHash);
      if (replay.order && orderType === "catalog" && draftActionId) {
        await markDraftCompleted(
          draftActionId,
          req.user.id,
          "wallet_service_catalog",
          replay.order._id,
          "wallet_service_order"
        );
      }
      return replay.order
        ? res.status(replay.status).json(replay.order)
        : res.status(replay.status).json({ error: replay.error });
    }
    if (orderType === "catalog") {
      if (!validObjectId(serviceId)
        || (sectionId !== undefined && typeof sectionId !== "string")
        || (body.packageId !== undefined && typeof body.packageId !== "string")
        || (body.quantity !== undefined && !["string", "number"].includes(typeof body.quantity))
        || (body.serviceVersion !== undefined && !["string", "number"].includes(typeof body.serviceVersion))
        || (body.formSchemaVersion !== undefined && !["string", "number"].includes(typeof body.formSchemaVersion))
        || (customerInfo !== undefined && typeof customerInfo !== "string")
        || (draftActionId !== undefined && typeof draftActionId !== "string")) {
        return res.status(400).json({ error: "بيانات طلب الخدمة غير صالحة." });
      }
    }

    if (draftActionId && orderType !== "catalog") {
      return res.status(400).json({ error: "المسودة غير صالحة لهذا النوع من الطلبات." });
    }
    if (draftActionId && !validObjectId(draftActionId)) {
      return res.status(400).json({ error: "معرف المسودة غير صالح." });
    }
    let draft = null;
    if (draftActionId && orderType === "catalog") {
      const existingOrder = await findDraftActionResult(WalletServiceOrder, draftActionId, req.user.id);
      if (existingOrder) {
        const replay = idempotencyConflict(existingOrder, orderType, requestPayloadHash);
        if (replay.order) {
          await markDraftCompleted(
            draftActionId,
            req.user.id,
            "wallet_service_catalog",
            replay.order._id,
            "wallet_service_order"
          );
        }
        return replay.order
          ? res.status(replay.status).json(replay.order)
          : res.status(409).json({ error: "استُخدمت هذه المسودة بالفعل مع طلب آخر." });
      }
      const draftResult = await getIncompleteDraftForSubmission(
        draftActionId,
        req.user.id,
        "wallet_service_catalog"
      );
      if (draftResult.error) return res.status(draftResult.status).json({ error: draftResult.error });
      draft = draftResult.draft;
      if (String(draftResult.draft?.serviceId || "") !== String(serviceId || "")
        || String(draftResult.draft?.sectionId || "") !== String(sectionId || "")
        || Number(draftResult.draft?.data?.quantity) !== Number(quantity)
        || String(draftResult.draft?.data?.packageId || "") !== String(body.packageId || "")
        || (draftResult.draft?.data?.serviceVersion !== undefined
          && Number(draftResult.draft.data.serviceVersion) !== Number(body.serviceVersion ?? draftResult.draft.data.serviceVersion))
        || (draftResult.draft?.data?.formSchemaVersion !== undefined
          && Number(draftResult.draft.data.formSchemaVersion)
            !== Number(body.formSchemaVersion ?? draftResult.draft.data.formSchemaVersion))
        || (draftResult.draft?.data?.answers !== undefined
          && JSON.stringify(canonicalize(draftResult.draft.data.answers))
            !== JSON.stringify(canonicalize(body.answers || {})))) {
        return res.status(409).json({ error: "بيانات المسودة لا تطابق الطلب الحالي. يرجى استئناف العملية من جديد." });
      }
    }
    if (!/^\d{9}$/.test(String(whatsappNumber || ""))) {
      return res.status(400).json({ error: "رقم واتساب يجب أن يتكون من 9 أرقام." });
    }
    if (typeof customerNotes === "string" && customerNotes.length > 1000) {
      return res.status(400).json({ error: "الملاحظات تتجاوز الحد المسموح." });
    }
    if (customerNotes !== undefined && customerNotes !== null && typeof customerNotes !== "string") {
      return res.status(400).json({ error: "الملاحظات غير صالحة." });
    }

    if (orderType === "custom") {
      if (typeof body.serviceName !== "string" || typeof body.serviceUrl !== "string") {
        return res.status(400).json({ error: "اسم الخدمة أو الرابط غير صالح." });
      }
      const serviceName = body.serviceName.trim();
      const serviceUrl = body.serviceUrl.trim();
      if (!serviceName || serviceName.length > 160 || serviceUrl.length > 2048) {
        return res.status(400).json({ error: "اسم الخدمة أو الرابط غير صالح." });
      }
      let parsedUrl;
      try {
        parsedUrl = new URL(serviceUrl);
      } catch {
        return res.status(400).json({ error: "رابط الخدمة غير صالح." });
      }
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return res.status(400).json({ error: "يجب أن يبدأ رابط الخدمة بـ HTTP أو HTTPS." });
      }
      if (parsedUrl.username || parsedUrl.password) {
        return res.status(400).json({ error: "يجب ألا يحتوي الرابط على اسم مستخدم أو كلمة مرور." });
      }

      const urlSafety = await scanUrlWithCloudflare(parsedUrl.toString());
      if (!urlSafety.safe) {
        return res.status(400).json({
          error: "صنّف فحص Cloudflare هذا الرابط على أنه قد يكون ضارًا؛ لم يتم إنشاء الطلب."
        });
      }

      let order;
      try {
        order = await WalletServiceOrder.create({
          user: req.user.id,
          orderType: "custom",
          status: "CUSTOM_QUOTE_PENDING",
          serviceName,
          serviceUrl: parsedUrl.toString(),
          serviceUrlSafety: "cloudflare_unlisted_clean",
          serviceUrlCheckedAt: urlSafety.checkedAt,
          whatsappNumber,
          customerNotes: String(customerNotes || ""),
          idempotencyKey,
          idempotencyPayloadHash: requestPayloadHash,
          statusHistory: [makeHistoryEntry("CUSTOM_QUOTE_PENDING", "تم إرسال طلب خدمة مخصصة.", req.user)]
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
        const concurrentOrder = await findIdempotentOrder(req.user.id, idempotencyKey);
        if (!concurrentOrder || !sameIdempotencyPayload(concurrentOrder, orderType, requestPayloadHash)) {
          return res.status(409).json({ error: "تعذر إنشاء الطلب بسبب تكرار المفتاح ببيانات مختلفة." });
        }
        return res.status(200).json(concurrentOrder);
      }
      await createAdminNotification(req.app, {
        type: "new_order",
        title: "طلب خدمة دفع مخصص جديد",
        message: `طلب ${serviceName} من ${req.user.name || "مستخدم"}`,
        link: "/admin/wallet-service-orders",
        data: { walletServiceOrderId: order._id }
      });
      return res.status(201).json(order);
    }

    const service = await WalletService.findOne({
      _id: serviceId,
      isActive: true,
      isArchived: { $ne: true }
    });
    if (!service) return res.status(404).json({ error: "الخدمة غير متاحة." });
    const requestedVersion = body.serviceVersion ?? draft?.data?.serviceVersion;
    const expectedVersion = draft
      ? Number(draft.data?.serviceVersion || getWalletServiceVersionAt(service, draft.createdAt))
      : Number(service.serviceVersion || 1);
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1
      || (requestedVersion !== undefined && Number(requestedVersion) !== expectedVersion)
      || (draft && !isWalletServiceVersionValidAt(service, expectedVersion, draft.createdAt))) {
      return res.status(409).json({ error: "إصدار الخدمة لا يتوافق مع هذه المسودة. حدّث بيانات الطلب." });
    }
    const config = getWalletServiceVersion(service, expectedVersion);
    if (!config) return res.status(409).json({ error: "إصدار الخدمة لم يعد متاحًا." });
    const serviceVersion = expectedVersion;
    const formSchemaVersion = Number(config.formSchemaVersion || 1);
    if (body.formSchemaVersion !== undefined
      && Number(body.formSchemaVersion) !== formSchemaVersion) {
      return res.status(409).json({ error: "إصدار نموذج الخدمة لم يعد متاحًا." });
    }
    const category = await ensureActiveCategory(config.categoryId);
    const quantityNumber = quantity === undefined ? 1 : Number(quantity);
    const pricingType = config.pricingType || "UNIT";
    if (pricingType === "FIXED" || pricingType === "PACKAGE") {
      if (quantityNumber !== 1) return res.status(400).json({ error: "هذه الخدمة تُطلب بكمية واحدة." });
    } else if (!isWalletServiceQuantityAllowed(quantityNumber, config)) {
      return res.status(400).json({ error: "الكمية خارج الحدود المسموحة لهذه الخدمة." });
    }

    let section = null;
    const sections = Array.isArray(config.sections) ? config.sections : [];
    if (pricingType === "UNIT" && sections.length) {
      section = sections.find((item) => String(item._id) === String(sectionId));
      if (!section) return res.status(400).json({ error: "يرجى اختيار قسم صالح." });
    } else if (sectionId) {
      return res.status(400).json({ error: "هذه الخدمة لا تحتوي على أقسام." });
    }
    if (String(customerInfo || "").length > 300) {
      return res.status(400).json({ error: "البيانات الإضافية تتجاوز الحد المسموح." });
    }

    let answers;
    try {
      answers = validateFormAnswers(config.formSchema || [], body.answers === undefined ? {} : body.answers);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    if (["SOFTWARE", "ENTERTAINMENT"].includes(config.serviceType)
      && config.formSchema?.some((field) => field.id === "accountOwnershipConsent" && field.required)
      && answers.accountOwnershipConsent !== true) {
      return res.status(400).json({ error: "يجب الموافقة على تعهد ملكية الحساب قبل إرسال الطلب." });
    }
    if (config.customerInfoLabel && !String(customerInfo || "").trim()) {
      return res.status(400).json({ error: `يرجى إدخال ${config.customerInfoLabel}.` });
    }
    let selectedPackage = null;
    if (pricingType === "PACKAGE") {
      selectedPackage = (config.packages || []).find((item) =>
        item.id === body.packageId && item.isActive
      );
      if (!selectedPackage) return res.status(400).json({ error: "يرجى اختيار باقة متاحة لهذه الخدمة." });
      if (selectedPackage.currency !== config.currency) {
        return res.status(409).json({ error: "عملة الباقة لا تتوافق مع عملة الخدمة." });
      }
    } else if (body.packageId) {
      return res.status(400).json({ error: "هذه الخدمة لا تدعم اختيار الباقات." });
    }

    let unitPrice;
    let serviceAmount;
    if (pricingType === "PACKAGE") {
      unitPrice = selectedPackage.price;
      serviceAmount = selectedPackage.price;
    } else if (pricingType === "FIXED") {
      unitPrice = Number(config.unitPrice);
      serviceAmount = unitPrice;
    } else {
      unitPrice = Number(section?.unitPrice ?? config.unitPrice);
      serviceAmount = unitPrice * quantityNumber;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isFinite(serviceAmount)) {
      return res.status(409).json({ error: "تعذر تحديد سعر الخدمة من إعداداتها الحالية." });
    }

    const feeBands = await getFeeBands();
    const currency = selectedPackage?.currency || config.currency;
    const totals = calculateWalletServiceTotals(serviceAmount, currency, feeBands);
    const feeBand = feeBands.find((band) =>
      band.currency === currency
      && totals.serviceAmount >= band.minimumAmount
      && totals.serviceAmount <= band.maximumAmount
    );
    const orderCreationRevision = Number(service.orderCreationRevision || 0);
    const reservedService = await WalletService.findOneAndUpdate(
      {
        _id: service._id,
        isActive: true,
        isArchived: { $ne: true },
        serviceVersion: Number(service.serviceVersion || 1),
        $or: [
          { orderCreationRevision },
          ...(orderCreationRevision === 0 ? [{ orderCreationRevision: { $exists: false } }] : [])
        ]
      },
      { $inc: { orderCreationRevision: 1 } },
      { new: true, runValidators: true }
    );
    if (!reservedService) {
      const concurrentOrder = await waitForIdempotentOrder(req.user.id, idempotencyKey);
      if (concurrentOrder && sameIdempotencyPayload(concurrentOrder, orderType, requestPayloadHash)) {
        if (draftActionId) {
          await markDraftCompleted(
            draftActionId,
            req.user.id,
            "wallet_service_catalog",
            concurrentOrder._id,
            "wallet_service_order"
          );
        }
        return res.status(200).json(concurrentOrder);
      }
      return res.status(409).json({ error: "تغيرت إعدادات الخدمة أثناء إنشاء الطلب. حدّث الصفحة وحاول مجددًا." });
    }

    let order;
    try {
      order = await WalletServiceOrder.create({
        user: req.user.id,
        ...(draftActionId ? { draftActionId } : {}),
        idempotencyKey,
        idempotencyPayloadHash: requestPayloadHash,
        service: service._id,
        categoryId: config.categoryId || null,
        categoryName: category?.name || "",
        orderType: "catalog",
        status: "AWAITING_PAYMENT",
        serviceName: config.name,
        serviceType: config.serviceType || "OTHER",
        serviceVersion,
        formSchemaVersion,
        sectionName: section?.name || "",
        packageId: selectedPackage?.id || "",
        packageName: selectedPackage?.name || "",
        pricingType,
        quantity: quantityNumber,
        customerInfoLabel: config.customerInfoLabel || "",
        customerInfo: String(customerInfo || "").trim(),
        answers,
        formSchemaSnapshot: config.formSchema || [],
        whatsappNumber,
        customerNotes: String(customerNotes || ""),
        currency,
        unitPrice,
        statusHistory: [makeHistoryEntry("AWAITING_PAYMENT", "تم إنشاء طلب الخدمة بانتظار الدفع.", req.user)],
        ...totals,
        buyerServiceFee: totals.platformFee,
        pricingSnapshot: {
          pricingType,
          currency,
          quantity: quantityNumber,
          unitPrice,
          categoryId: config.categoryId || null,
          categoryName: category?.name || "",
          serviceId: service._id,
          serviceName: config.name,
          serviceVersion,
          formSchemaVersion,
          sectionId: section?._id || null,
          sectionName: section?.name || "",
          packageId: selectedPackage?.id || "",
          packageName: selectedPackage?.name || "",
          serviceAmount: totals.serviceAmount,
          buyerServiceFee: totals.platformFee,
          totalAmount: totals.totalAmount,
          feeBand: feeBand ? {
            minimumAmount: feeBand.minimumAmount,
            maximumAmount: feeBand.maximumAmount,
            feeAmount: feeBand.feeAmount
          } : null,
          formSchema: config.formSchema || [],
          answers
        }
      });
    } catch (error) {
      if (draftActionId && error.code === 11000) {
        order = await findDraftActionResult(WalletServiceOrder, draftActionId, req.user.id);
        if (order && !sameIdempotencyPayload(order, orderType, requestPayloadHash)) {
          return res.status(409).json({ error: "استُخدمت هذه المسودة بالفعل مع بيانات طلب مختلفة." });
        }
      }
      if (error.code === 11000 && !order) {
        const concurrentOrder = await findIdempotentOrder(req.user.id, idempotencyKey);
        if (concurrentOrder && sameIdempotencyPayload(concurrentOrder, orderType, requestPayloadHash)) {
          order = concurrentOrder;
        }
      }
      if (!order) throw error;
      await markDraftCompleted(
        draftActionId,
        req.user.id,
        "wallet_service_catalog",
        order._id,
        "wallet_service_order"
      );
      return res.status(200).json(order);
    }
    await markDraftCompleted(
      draftActionId,
      req.user.id,
      "wallet_service_catalog",
      order._id,
      "wallet_service_order"
    );
    await createAdminNotification(req.app, {
      type: "new_order",
      title: "طلب خدمة دفع جديد",
      message: `طلب ${config.name} من ${req.user.name || "مستخدم"}`,
      link: "/admin/wallet-service-orders",
      data: { walletServiceOrderId: order._id }
    });
    res.status(201).json(order);
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof UrlScanServiceError) {
      if (error.code === "not_configured") {
        console.error("Cloudflare URL Scanner is not configured; custom wallet service orders are paused.");
        return res.status(503).json({ error: "فحص الروابط غير مهيأ حاليًا. يرجى المحاولة لاحقًا." });
      }
      console.error(`Cloudflare URL scan failed (${error.code}); custom wallet service order was not created.`);
      if (error.code === "provider_error_429") {
        return res.status(429).json({ error: "يوجد ضغط على فحص الروابط؛ انتظر قليلًا ثم أعد المحاولة." });
      }
      if (error.code === "scan_pending") {
        return res.status(503).json({ error: "لم يكتمل فحص الرابط بعد؛ لم يتم إنشاء الطلب. يرجى المحاولة لاحقًا." });
      }
      return res.status(503).json({ error: "تعذر إكمال فحص الرابط حاليًا. لم يتم إنشاء الطلب؛ يرجى المحاولة لاحقًا." });
    }
    if (error.message?.startsWith("لا توجد شريحة رسوم")) {
      return res.status(409).json({ error: error.message });
    }
    if (error.message === "التصنيف غير موجود أو غير نشط.") {
      return res.status(409).json({ error: error.message });
    }
    console.error("Create wallet service order failed:", error);
    res.status(500).json({ error: "تعذر إرسال الطلب." });
  }
});

router.post("/orders/:id/accept-quote", auth, async (req, res) => {
  try {
    const order = await WalletServiceOrder.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id, status: "QUOTE_OFFERED" },
      {
        $set: { status: "AWAITING_PAYMENT", quoteAcceptedAt: new Date() },
        $push: { statusHistory: makeHistoryEntry("AWAITING_PAYMENT", "وافق العميل على عرض السعر.", req.user) }
      },
      { new: true }
    );
    if (!order) return res.status(400).json({ error: "عرض السعر غير موجود أو لم يعد متاحًا." });
    res.json(order);
  } catch (error) {
    console.error("Accept wallet service quote failed:", error);
    res.status(500).json({ error: "تعذر قبول عرض السعر." });
  }
});

router.post("/orders/:id/payment", auth, validateReceiptOrder, uploadWalletServiceReceipt, async (req, res) => {
  let uploadedPath = "";
  let processedPath = "";
  let persisted = false;
  try {
    const receiptFile = req.file;
    if (!receiptFile) return res.status(400).json({ error: "يرجى إرفاق سند الدفع." });
    uploadedPath = receiptFile.path;
    const processed = await processImage(uploadedPath, "receipts");
    processedPath = processed;
    const paymentReceipt = `receipts/${path.basename(processedPath)}`;
    const currentOrder = await WalletServiceOrder.findOne({
      _id: req.params.id,
      user: req.user.id,
      status: { $in: ["AWAITING_PAYMENT", "PAYMENT_NEEDS_CORRECTION"] }
    }).select("paymentReceipt paymentSubmittedAt").lean();
    if (!currentOrder) return res.status(400).json({ error: "الطلب غير متاح لإرفاق سند الدفع." });
    const paymentReceiptFilter = currentOrder.paymentReceipt
      ? { paymentReceipt: currentOrder.paymentReceipt }
      : { $or: [{ paymentReceipt: "" }, { paymentReceipt: null }, { paymentReceipt: { $exists: false } }] };
    const push = {
      statusHistory: makeHistoryEntry("PAYMENT_REVIEW", "أرسل العميل سند الدفع للمراجعة.", req.user)
    };
    if (currentOrder.paymentReceipt) {
      push.previousPaymentReceipts = {
        path: currentOrder.paymentReceipt,
        submittedAt: currentOrder.paymentSubmittedAt || new Date()
      };
    }
    const order = await WalletServiceOrder.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.user.id,
        status: { $in: ["AWAITING_PAYMENT", "PAYMENT_NEEDS_CORRECTION"] },
        ...paymentReceiptFilter
      },
      {
        $set: {
          status: "PAYMENT_REVIEW",
          paymentReceipt,
          paymentSubmittedAt: new Date(),
          paymentCorrectionReason: ""
        },
        $push: push
      },
      { new: true }
    );
    if (!order) return res.status(409).json({ error: "تغيرت حالة الطلب أثناء رفع السند. يرجى التحقق من الطلب." });
    persisted = true;
    await createAdminNotification(req.app, {
      type: "order_payment",
      title: "سند دفع لخدمة سوقك",
      message: `أرفق المستخدم سند دفع لطلب ${order.serviceName}`,
      link: "/admin/wallet-service-orders",
      data: { walletServiceOrderId: order._id }
    });
    await notifyOrderUser(req.app, order, "تم استلام سند الدفع", "استلمنا سند دفعك لخدمة سوقك، وهو الآن قيد المراجعة.");
    res.json(order);
  } catch (error) {
    console.error("Submit wallet service payment failed:", error);
    res.status(500).json({ error: "تعذر إرسال سند الدفع." });
  } finally {
    const candidates = [];
    if (!persisted) candidates.push(uploadedPath, processedPath);
    if (processedPath) {
      const extension = path.extname(processedPath);
      candidates.push(processedPath.slice(0, -extension.length) + ".thumb.webp");
    }
    await removeUnlinkedReceiptFiles(candidates);
  }
});

router.get("/admin/services", ...isAdmin, async (_req, res) => {
  try {
    const [services, feeBands] = await Promise.all([
      WalletService.find().sort({ sortOrder: 1, createdAt: 1 }).lean(),
      getFeeBands()
    ]);
    res.json({ services: services.map((service) => serviceResponse(service)), feeBands });
  } catch (error) {
    console.error("Load admin wallet services failed:", error);
    res.status(500).json({ error: "تعذر تحميل الخدمات." });
  }
});

router.get("/admin/categories", ...isAdmin, async (_req, res) => {
  try {
    const categories = await DigitalServiceCategory.find().sort({ sortOrder: 1, name: 1 }).lean();
    res.json(categories);
  } catch (error) {
    console.error("Load admin digital service categories failed:", error);
    res.status(500).json({ error: "تعذر تحميل تصنيفات الخدمات." });
  }
});

router.post("/admin/categories", ...isAdmin, uploadWalletServiceCategoryImage, async (req, res) => {
  try {
    const category = await DigitalServiceCategory.create(normalizeCategoryInput(req.body || {}, {}, req.file));
    res.status(201).json(category);
  } catch (error) {
    await removeUnlinkedCategoryImage(req.file);
    if (error.code === 11000) return res.status(409).json({ error: "معرف التصنيف مستخدم مسبقًا." });
    if (isValidationError(error)) {
      return res.status(400).json({ error: error.message || "تعذر إنشاء التصنيف." });
    }
    console.error("Create digital service category failed:", error);
    res.status(500).json({ error: "تعذر إنشاء التصنيف." });
  }
});

router.patch("/admin/categories/:id", ...isAdmin, uploadWalletServiceCategoryImage, async (req, res) => {
  try {
    if (!validObjectId(req.params.id)) {
      await removeUnlinkedCategoryImage(req.file);
      return res.status(404).json({ error: "التصنيف غير موجود." });
    }
    const category = await DigitalServiceCategory.findById(req.params.id);
    if (!category) {
      await removeUnlinkedCategoryImage(req.file);
      return res.status(404).json({ error: "التصنيف غير موجود." });
    }
    if (category.isArchived) {
      await removeUnlinkedCategoryImage(req.file);
      return res.status(409).json({ error: "التصنيف مؤرشف ولا يمكن تعديله." });
    }
    Object.assign(category, normalizeCategoryInput(req.body || {}, category.toObject(), req.file));
    await category.save();
    res.json(category);
  } catch (error) {
    await removeUnlinkedCategoryImage(req.file);
    if (error.code === 11000) return res.status(409).json({ error: "معرف التصنيف مستخدم مسبقًا." });
    if (isValidationError(error)) {
      return res.status(400).json({ error: error.message || "تعذر تحديث التصنيف." });
    }
    console.error("Update digital service category failed:", error);
    res.status(500).json({ error: "تعذر تحديث التصنيف." });
  }
});

router.post("/admin/categories/:id/status", ...isAdmin, async (req, res) => {
  try {
    assertKnownKeys(req.body || {}, ["isActive"]);
    if (!validObjectId(req.params.id)) return res.status(404).json({ error: "التصنيف غير موجود." });
    const category = await DigitalServiceCategory.findById(req.params.id);
    if (!category) return res.status(404).json({ error: "التصنيف غير موجود." });
    const isActive = readBoolean(req.body?.isActive, "حالة التصنيف", category.isActive);
    if (category.isArchived && isActive) return res.status(409).json({ error: "لا يمكن تفعيل تصنيف مؤرشف." });
    category.isActive = isActive;
    await category.save();
    res.json(category);
  } catch (error) {
    if (isValidationError(error)) {
      return res.status(400).json({ error: error.message || "تعذر تحديث حالة التصنيف." });
    }
    console.error("Update digital service category status failed:", error);
    res.status(500).json({ error: "تعذر تحديث حالة التصنيف." });
  }
});

router.post("/admin/categories/:id/archive", ...isAdmin, async (req, res) => {
  try {
    if (!validObjectId(req.params.id)) return res.status(404).json({ error: "التصنيف غير موجود." });
    const category = await DigitalServiceCategory.findById(req.params.id);
    if (!category) return res.status(404).json({ error: "التصنيف غير موجود." });
    category.isActive = false;
    category.isArchived = true;
    await category.save();
    res.json(category);
  } catch (error) {
    console.error("Archive digital service category failed:", error);
    res.status(500).json({ error: "تعذر أرشفة التصنيف." });
  }
});

router.delete("/admin/categories/:id", ...isAdmin, async (req, res) => {
  try {
    if (!validObjectId(req.params.id)) return res.status(404).json({ error: "التصنيف غير موجود." });
    const category = await DigitalServiceCategory.findById(req.params.id);
    if (!category) return res.status(404).json({ error: "التصنيف غير موجود." });
    if (!category.isArchived || category.isActive) {
      return res.status(409).json({ error: "أرشف التصنيف أولًا قبل حذفه نهائيًا." });
    }

    const [serviceCount, orderCount] = await Promise.all([
      WalletService.countDocuments({ categoryId: category._id }),
      WalletServiceOrder.countDocuments({ categoryId: category._id })
    ]);
    if (serviceCount || orderCount) {
      return res.status(409).json({
        error: "لا يمكن حذف هذا التصنيف لارتباطه بخدمات أو طلبات سابقة. يمكنك إبقاؤه مؤرشفًا."
      });
    }

    const deleted = await DigitalServiceCategory.findOneAndDelete({
      _id: category._id,
      isArchived: true,
      isActive: false
    });
    if (!deleted) return res.status(409).json({ error: "تغيرت حالة التصنيف. حدّث الصفحة ثم حاول مجددًا." });
    res.json({ message: "تم حذف التصنيف نهائيًا." });
  } catch (error) {
    console.error("Delete digital service category failed:", error);
    res.status(500).json({ error: "تعذر حذف التصنيف." });
  }
});

router.post("/admin/services", ...isAdmin, uploadBankLogo, async (req, res) => {
  try {
    const data = normalizeServiceInput(req.body || {}, req.file);
    await ensureActiveCategory(data.categoryId);
    const service = await WalletService.create({
      ...data,
      serviceVersion: 1,
      versionHistory: []
    });
    res.status(201).json(serviceResponse(service, { includeHistory: true }));
  } catch (error) {
    if (isValidationError(error)) {
      return res.status(400).json({ error: error.message || "تعذر إنشاء الخدمة." });
    }
    console.error("Create wallet service failed:", error);
    res.status(500).json({ error: "تعذر إنشاء الخدمة." });
  }
});

router.patch("/admin/services/:id", ...isAdmin, uploadBankLogo, async (req, res) => {
  try {
    if (!validObjectId(req.params.id)) return res.status(404).json({ error: "الخدمة غير موجودة." });
    const existing = await WalletService.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "الخدمة غير موجودة." });
    if (existing.isArchived) return res.status(409).json({ error: "الخدمة مؤرشفة ولا يمكن تعديلها." });
    const current = existing.toObject();
    const update = normalizeServiceInput(req.body || {}, req.file, current);
    await ensureActiveCategory(update.categoryId);
    const oldVersion = Number(existing.serviceVersion || 1);
    const schemaChanged = JSON.stringify(canonicalize(current.formSchema || []))
      !== JSON.stringify(canonicalize(update.formSchema || []));
    existing.versionHistory ||= [];
    existing.versionHistory.push({
      version: oldVersion,
      snapshot: snapshotServiceConfiguration(current),
      createdAt: new Date(),
      createdBy: req.user.id
    });
    Object.assign(existing, update, {
      serviceVersion: oldVersion + 1,
      formSchemaVersion: Number(current.formSchemaVersion || 1) + (schemaChanged ? 1 : 0),
      orderCreationRevision: Number(current.orderCreationRevision || 0) + 1
    });
    await existing.save();
    res.json(serviceResponse(existing, { includeHistory: true }));
  } catch (error) {
    if (isValidationError(error)) {
      return res.status(400).json({ error: error.message || "تعذر تحديث الخدمة." });
    }
    console.error("Update wallet service failed:", error);
    res.status(500).json({ error: "تعذر تحديث الخدمة." });
  }
});

router.get("/admin/services/:id/versions", ...isAdmin, async (req, res) => {
  try {
    if (!validObjectId(req.params.id)) return res.status(404).json({ error: "الخدمة غير موجودة." });
    const service = await WalletService.findById(req.params.id).lean();
    if (!service) return res.status(404).json({ error: "الخدمة غير موجودة." });
    res.json({
      currentVersion: service.serviceVersion || 1,
      current: serviceResponse(service),
      history: service.versionHistory || []
    });
  } catch (error) {
    console.error("Load wallet service versions failed:", error);
    res.status(500).json({ error: "تعذر تحميل إصدارات الخدمة." });
  }
});

router.post("/admin/services/:id/status", ...isAdmin, async (req, res) => {
  try {
    assertKnownKeys(req.body || {}, ["isActive"]);
    if (!validObjectId(req.params.id)) return res.status(404).json({ error: "الخدمة غير موجودة." });
    const service = await WalletService.findById(req.params.id);
    if (!service) return res.status(404).json({ error: "الخدمة غير موجودة." });
    const isActive = readBoolean(req.body?.isActive, "حالة الخدمة", service.isActive);
    if (service.isArchived && isActive) return res.status(409).json({ error: "لا يمكن تفعيل خدمة مؤرشفة." });
    if (isActive) {
      await ensureActiveCategory(service.categoryId);
      if (service.pricingType === "PACKAGE" && !service.packages.some((item) => item.isActive)) {
        return res.status(409).json({ error: "فعّل باقة واحدة على الأقل قبل تفعيل الخدمة." });
      }
    }
    service.isActive = isActive;
    service.orderCreationRevision = Number(service.orderCreationRevision || 0) + 1;
    await service.save();
    res.json(serviceResponse(service));
  } catch (error) {
    if (isValidationError(error)) {
      return res.status(400).json({ error: error.message || "تعذر تحديث حالة الخدمة." });
    }
    console.error("Update wallet service status failed:", error);
    res.status(500).json({ error: "تعذر تحديث حالة الخدمة." });
  }
});

router.post("/admin/services/:id/archive", ...isAdmin, async (req, res) => {
  try {
    if (!validObjectId(req.params.id)) return res.status(404).json({ error: "الخدمة غير موجودة." });
    const service = await WalletService.findById(req.params.id);
    if (!service) return res.status(404).json({ error: "الخدمة غير موجودة." });
    service.isActive = false;
    service.isArchived = true;
    service.orderCreationRevision = Number(service.orderCreationRevision || 0) + 1;
    await service.save();
    res.json(serviceResponse(service));
  } catch (error) {
    console.error("Archive wallet service failed:", error);
    res.status(500).json({ error: "تعذر أرشفة الخدمة." });
  }
});

router.delete("/admin/services/:id", ...isAdmin, async (req, res) => {
  try {
    if (!validObjectId(req.params.id)) return res.status(404).json({ error: "الخدمة غير موجودة." });
    const service = await WalletService.findById(req.params.id);
    if (!service) return res.status(404).json({ error: "الخدمة غير موجودة." });
    if (!service.isArchived || service.isActive) {
      return res.status(409).json({ error: "أرشف الخدمة أولًا قبل حذفها نهائيًا." });
    }

    const [orderCount, draftCount] = await Promise.all([
      WalletServiceOrder.countDocuments({ service: service._id }),
      DraftAction.countDocuments({
        serviceId: service._id,
        type: "wallet_service_catalog",
        status: "incomplete",
        expiresAt: { $gt: new Date() }
      })
    ]);
    if (orderCount || draftCount) {
      return res.status(409).json({
        error: "لا يمكن حذف هذه الخدمة لارتباطها بطلبات أو مسودات نشطة. يمكنك إبقاؤها مؤرشفة."
      });
    }

    const deleted = await WalletService.findOneAndDelete({
      _id: service._id,
      isArchived: true,
      isActive: false
    });
    if (!deleted) return res.status(409).json({ error: "تغيرت حالة الخدمة. حدّث الصفحة ثم حاول مجددًا." });
    res.json({ message: "تم حذف الخدمة نهائيًا." });
  } catch (error) {
    console.error("Delete wallet service failed:", error);
    res.status(500).json({ error: "تعذر حذف الخدمة." });
  }
});

router.put("/admin/fee-bands", ...isAdmin, async (req, res) => {
  try {
    const feeBands = normalizeFeeBands(req.body?.feeBands);
    const settings = await WalletServiceFeeSettings.findOneAndUpdate(
      { key: "wallet-services" },
      { $set: { feeBands, feeBandVersion: 2 } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();
    res.json({ feeBands: settings.feeBands });
  } catch (error) {
    res.status(400).json({ error: error.message || "تعذر حفظ شرائح الرسوم." });
  }
});

router.get("/admin/orders", ...isAdmin, async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = String(req.query.status);
    const orders = await WalletServiceOrder.find(filter)
      .populate("user", "name email phone")
      .populate("statusHistory.actor", "name role")
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();
    res.json(orders);
  } catch (error) {
    console.error("Load admin wallet service orders failed:", error);
    res.status(500).json({ error: "تعذر تحميل طلبات الخدمات." });
  }
});

router.post("/admin/orders/:id/quote", ...isAdmin, async (req, res) => {
  try {
    assertKnownKeys(req.body || {}, ["serviceAmount", "currency", "quoteNote"]);
    if (req.body?.serviceAmount !== undefined
      && !["string", "number"].includes(typeof req.body.serviceAmount)) {
      return res.status(400).json({ error: "سعر الخدمة غير صالح." });
    }
    if (req.body?.quoteNote !== undefined
      && (typeof req.body.quoteNote !== "string" || req.body.quoteNote.length > 1000)) {
      return res.status(400).json({ error: "ملاحظة عرض السعر غير صالحة." });
    }
    const serviceAmount = Number(req.body?.serviceAmount);
    const currency = String(req.body?.currency || "");
    if (!WALLET_SERVICE_CURRENCIES.includes(currency)) {
      return res.status(400).json({ error: "عملة التسعير غير مدعومة." });
    }
    const feeBands = await getFeeBands();
    const totals = calculateWalletServiceTotals(serviceAmount, currency, feeBands);
    const feeBand = feeBands.find((band) =>
      band.currency === currency
      && totals.serviceAmount >= band.minimumAmount
      && totals.serviceAmount <= band.maximumAmount
    );
    const order = await WalletServiceOrder.findOneAndUpdate(
      { _id: req.params.id, orderType: "custom", status: "CUSTOM_QUOTE_PENDING" },
      {
        $set: {
          status: "QUOTE_OFFERED",
          currency,
          ...totals,
          buyerServiceFee: totals.platformFee,
          quoteNote: String(req.body?.quoteNote || "").trim(),
          quotedBy: req.user.id,
          pricingSnapshot: {
            pricingType: "ADMIN_QUOTE",
            currency,
            serviceAmount: totals.serviceAmount,
            buyerServiceFee: totals.platformFee,
            totalAmount: totals.totalAmount,
            quoteNote: String(req.body?.quoteNote || "").trim(),
            feeBand: feeBand ? {
              minimumAmount: feeBand.minimumAmount,
              maximumAmount: feeBand.maximumAmount,
              feeAmount: feeBand.feeAmount
            } : null
          }
        },
        $push: {
          statusHistory: makeHistoryEntry(
            "QUOTE_OFFERED",
            `قدمت الإدارة عرض سعر بقيمة ${totals.totalAmount} ${currency}.`,
            req.user
          )
        }
      },
      { new: true }
    );
    if (!order) return res.status(400).json({ error: "الطلب غير متاح لإضافة عرض سعر." });
    await notifyOrderUser(
      req.app,
      order,
      "عرض سعر خدمة سوقك جاهز",
      `حددت الإدارة سعر طلب ${order.serviceName}. افتح الطلب لمراجعة السعر وقبوله.`
    );
    res.json(order);
  } catch (error) {
    if (error.message?.startsWith("لا توجد شريحة رسوم")) {
      return res.status(409).json({ error: error.message });
    }
    res.status(400).json({ error: error.message || "تعذر تسعير الطلب." });
  }
});

router.post("/admin/orders/:id/confirm-payment", ...isAdmin, async (req, res) => {
  try {
    const order = await WalletServiceOrder.findOneAndUpdate(
      { _id: req.params.id, status: "PAYMENT_REVIEW" },
      {
        $set: { status: "IN_PROGRESS", paymentReviewedBy: req.user.id, paymentReviewedAt: new Date() },
        $push: { statusHistory: makeHistoryEntry("IN_PROGRESS", "أكدت الإدارة الدفع وبدأ تنفيذ الطلب.", req.user) }
      },
      { new: true }
    );
    if (!order) return res.status(400).json({ error: "الطلب غير متاح لتأكيد الدفع." });
    await notifyOrderUser(
      req.app,
      order,
      "تم تأكيد الدفع",
      `تم تأكيد دفع طلب ${order.serviceName}، وبدأت الإدارة بتنفيذه.`
    );
    res.json(order);
  } catch (error) {
    console.error("Confirm wallet service payment failed:", error);
    res.status(500).json({ error: "تعذر تأكيد الدفع." });
  }
});

router.post("/admin/orders/:id/complete", ...isAdmin, async (req, res) => {
  try {
    const completionNote = String(req.body?.completionNote || "").trim();
    if (!completionNote) return res.status(400).json({ error: "يرجى إدخال نتيجة تنفيذ الطلب." });
    const order = await WalletServiceOrder.findOneAndUpdate(
      { _id: req.params.id, status: "IN_PROGRESS" },
      {
        $set: { status: "COMPLETED", completionNote, completedBy: req.user.id, completedAt: new Date() },
        $push: { statusHistory: makeHistoryEntry("COMPLETED", `اكتمل الطلب: ${completionNote}`, req.user) }
      },
      { new: true }
    );
    if (!order) return res.status(400).json({ error: "الطلب غير متاح للإكمال." });
    await notifyOrderUser(
      req.app,
      order,
      "اكتمل طلب خدمة سوقك",
      `اكتمل طلب ${order.serviceName}. النتيجة: ${completionNote}`
    );
    res.json(order);
  } catch (error) {
    console.error("Complete wallet service order failed:", error);
    res.status(500).json({ error: "تعذر إكمال الطلب." });
  }
});

router.post("/admin/orders/:id/reject", ...isAdmin, async (req, res) => {
  try {
    const rejectionReason = String(req.body?.rejectionReason || "").trim();
    if (!rejectionReason) return res.status(400).json({ error: "يرجى إدخال سبب الرفض." });
    const order = await WalletServiceOrder.findOneAndUpdate(
      { _id: req.params.id, status: { $in: ["CUSTOM_QUOTE_PENDING", "QUOTE_OFFERED", "AWAITING_PAYMENT", "PAYMENT_REVIEW", "PAYMENT_NEEDS_CORRECTION"] } },
      {
        $set: { status: "REJECTED", rejectionReason, rejectedBy: req.user.id, rejectedAt: new Date() },
        $push: { statusHistory: makeHistoryEntry("REJECTED", `رفضت الإدارة الطلب: ${rejectionReason}`, req.user) }
      },
      { new: true }
    );
    if (!order) return res.status(400).json({ error: "الطلب لا يمكن رفضه في حالته الحالية." });
    await notifyOrderUser(
      req.app,
      order,
      "تحديث على طلب خدمة سوقك",
      `تعذر تنفيذ طلب ${order.serviceName}. السبب: ${rejectionReason}`
    );
    res.json(order);
  } catch (error) {
    console.error("Reject wallet service order failed:", error);
    res.status(500).json({ error: "تعذر رفض الطلب." });
  }
});

router.post("/admin/orders/:id/request-proof-correction", ...isAdmin, async (req, res) => {
  try {
    const reason = String(req.body?.reason || "").trim();
    if (!reason) return res.status(400).json({ error: "يرجى توضيح سبب طلب سند بديل." });
    if (reason.length > 1000) return res.status(400).json({ error: "سبب التصحيح يتجاوز الحد المسموح." });

    const order = await WalletServiceOrder.findOneAndUpdate(
      { _id: req.params.id, status: "PAYMENT_REVIEW" },
      {
        $set: { status: "PAYMENT_NEEDS_CORRECTION", paymentCorrectionReason: reason },
        $push: { statusHistory: makeHistoryEntry("PAYMENT_NEEDS_CORRECTION", `طلبت الإدارة سندًا بديلًا: ${reason}`, req.user) }
      },
      { new: true }
    );
    if (!order) return res.status(400).json({ error: "لا يمكن طلب تعديل السند في حالة الطلب الحالية." });

    await notifyOrderUser(
      req.app,
      order,
      "نحتاج سند دفع أوضح",
      `يرجى تحديث سند دفع طلب ${order.serviceName}. ملاحظة الإدارة: ${reason}`
    );
    res.json(order);
  } catch (error) {
    console.error("Request wallet service payment proof correction failed:", error);
    res.status(500).json({ error: "تعذر طلب تصحيح سند الدفع." });
  }
});

export default router;
