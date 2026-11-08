import { Router } from "express";
import mongoose from "mongoose";
import auth from "../middleware/auth.js";
import Ad from "../models/Ad.js";
import Category from "../models/Category.js";
import City from "../models/City.js";
import Governorate from "../models/Governorate.js";
import DigitalServiceCategory from "../models/DigitalServiceCategory.js";
import DraftAction from "../models/DraftAction.js";
import Plan from "../models/Plan.js";
import WalletService from "../models/WalletService.js";
import { getFamilyProductionActivity, getStoreActivity } from "../utils/storeActivityRegistry.js";
import { isWalletServiceQuantityAllowed } from "../utils/walletServicePricing.js";
import { rejectIfDraftActionWritesPaused } from "../services/draftActionWritePause.js";
import {
  getWalletServiceVersionAt,
  getWalletServiceVersion,
  isWalletServiceVersionValidAt,
  validateFormAnswers
} from "../utils/walletServiceDynamicConfig.js";

const router = Router();
const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const STORE_TYPES = new Set(["store_creation", "family_production_registration"]);
const MAX_STEPS = {
  store_creation: 4,
  family_production_registration: 4,
  featured_ad_upgrade: 2,
  wallet_service_catalog: 2
};

function boundedString(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeContacts(value, fallbackType) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 5).map((item) => ({
    type: boundedString(item?.type, 30) || fallbackType,
    value: boundedString(item?.value, 40)
  })).filter((item) => item.value);
}

function sanitizeDraftAnswers(value) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length > 50) {
    throw new Error("إجابات المسودة غير صالحة.");
  }
  const answers = {};
  for (const [key, answer] of Object.entries(value)) {
    if (typeof answer === "string" && answer.length <= 2000) {
      answers[key] = answer;
    } else if (typeof answer === "number" && Number.isFinite(answer)) {
      answers[key] = answer;
    } else if (typeof answer === "boolean") {
      answers[key] = answer;
    } else if (Array.isArray(answer) && answer.length <= 100
      && answer.every((item) => typeof item === "string" && item.length <= 120)) {
      answers[key] = answer;
    } else {
      throw new Error("إحدى إجابات المسودة غير صالحة.");
    }
  }
  return answers;
}

function sanitizeInput(type, body) {
  const data = body.data && typeof body.data === "object" && !Array.isArray(body.data)
    ? body.data
    : {};
  const currentStep = Number(body.currentStep);
  if (!Number.isInteger(currentStep) || currentStep < 1 || currentStep > MAX_STEPS[type]) {
    throw new Error("خطوة العملية غير صالحة.");
  }

  if (STORE_TYPES.has(type)) {
    const planId = boundedString(body.planId, 40);
    const selectedCategories = Array.isArray(data.selectedCategories)
      ? data.selectedCategories.slice(0, 50).map((id) => boundedString(String(id), 40)).filter(Boolean)
      : [];
    return {
      currentStep,
      planId: planId || null,
      adId: null,
      serviceId: null,
      sectionId: null,
      data: {
        storeName: boundedString(data.storeName, 150),
        activityKey: boundedString(data.activityKey, 120),
        description: boundedString(data.description, 3000),
        governorateId: boundedString(data.governorateId, 40),
        cityId: boundedString(data.cityId, 40),
        customCityName: boundedString(data.customCityName, 120),
        location: boundedString(data.location, 300),
        phone: boundedString(data.phone, 40),
        phones: normalizeContacts(data.phones, "mobile"),
        whatsapp: normalizeContacts(data.whatsapp, "whatsapp"),
        email: boundedString(data.email, 254),
        selectedCategories
      }
    };
  }

  if (type === "featured_ad_upgrade") {
    return {
      currentStep,
      planId: boundedString(body.planId, 40) || null,
      adId: boundedString(body.adId, 40) || null,
      serviceId: null,
      sectionId: null,
      data: {}
    };
  }

  const quantity = Number(data.quantity);
  const whatsappNumber = boundedString(data.whatsappNumber, 9);
  const serviceVersion = data.serviceVersion === undefined ? undefined : Number(data.serviceVersion);
  const formSchemaVersion = data.formSchemaVersion === undefined ? undefined : Number(data.formSchemaVersion);
  if ((serviceVersion !== undefined && (!Number.isSafeInteger(serviceVersion) || serviceVersion < 1))
    || (formSchemaVersion !== undefined && (!Number.isSafeInteger(formSchemaVersion) || formSchemaVersion < 1))) {
    throw new Error("إصدار الخدمة أو النموذج في المسودة غير صالح.");
  }
  const answers = sanitizeDraftAnswers(data.answers);
  return {
    currentStep,
    planId: null,
    adId: null,
    serviceId: boundedString(body.serviceId, 40) || null,
    sectionId: boundedString(body.sectionId, 40) || null,
    data: {
      ...(Number.isFinite(quantity) ? { quantity } : {}),
      whatsappNumber: /^\d{9}$/.test(whatsappNumber) ? whatsappNumber : "",
      ...(data.packageId !== undefined ? { packageId: boundedString(data.packageId, 50) } : {}),
      ...(serviceVersion !== undefined ? { serviceVersion } : {}),
      ...(formSchemaVersion !== undefined ? { formSchemaVersion } : {}),
      ...(answers !== undefined ? { answers } : {})
    }
  };
}

async function validateWalletServiceCatalogDraft(draft, providedService = null) {
  const service = providedService || await WalletService.findOne({
    _id: draft.serviceId,
    isActive: true,
    isArchived: { $ne: true }
  });
  if (!service) return { error: "هذه العملية لم تعد متاحة بهذه البيانات. يمكنك بدء العملية من جديد." };
  const serviceVersion = Number(
    draft.data?.serviceVersion || getWalletServiceVersionAt(service, draft.createdAt)
  );
  if (!Number.isSafeInteger(serviceVersion) || serviceVersion < 1) {
    return { error: "تعذر التحقق من إصدار الخدمة عند إنشاء هذه المسودة. ابدأ طلبًا جديدًا." };
  }
  if (draft.createdAt && !isWalletServiceVersionValidAt(service, serviceVersion, draft.createdAt)) {
    return { error: "إصدار الخدمة لم يكن ساريًا عند إنشاء هذه المسودة. ابدأ طلبًا جديدًا." };
  }
  const config = getWalletServiceVersion(service, serviceVersion);
  if (!config || (draft.data?.formSchemaVersion !== undefined
    && Number(config.formSchemaVersion || 1) !== draft.data.formSchemaVersion)) {
    return { error: "إصدار الخدمة في هذه المسودة لم يعد متاحًا. يمكنك بدء العملية من جديد." };
  }
  if (config.categoryId) {
    const category = await DigitalServiceCategory.findOne({
      _id: config.categoryId,
      isActive: true,
      isArchived: false
    }).lean();
    if (!category) return { error: "هذه الخدمة لم تعد متاحة بهذه البيانات. يمكنك بدء العملية من جديد." };
  }
  if (draft.sectionId && !config.sections?.some((section) =>
    String(section._id) === String(draft.sectionId)
  )) {
    return { error: "هذه العملية لم تعد متاحة بهذه البيانات. يمكنك بدء العملية من جديد." };
  }
  const pricingType = config.pricingType || "UNIT";
  if (draft.data?.quantity !== undefined) {
    const quantityValid = ["FIXED", "PACKAGE"].includes(pricingType)
      ? draft.data.quantity === 1
      : isWalletServiceQuantityAllowed(draft.data.quantity, config);
    if (!quantityValid) return { error: "الكمية خارج الحدود المسموحة لهذه الخدمة.", status: 400 };
  }
  if (draft.data?.packageId) {
    const selectedPackage = config.packages?.find((item) =>
      item.id === draft.data.packageId && item.isActive && item.currency === config.currency
    );
    if (!selectedPackage) return { error: "الباقة المختارة في هذه المسودة لم تعد متاحة." };
  }
  try {
    validateFormAnswers(config.formSchema || [], draft.data?.answers || {}, { allowIncomplete: true });
  } catch {
    return { error: "إجابات النموذج في هذه المسودة لم تعد متوافقة. يمكنك بدء العملية من جديد." };
  }
  return { service, config };
}

async function validateReferences(draft) {
  if (STORE_TYPES.has(draft.type) && draft.planId) {
    const planType = draft.type === "family_production_registration" ? "family-production" : "store";
    const plan = await Plan.findOne({ _id: draft.planId, type: planType, isActive: true }).lean();
    if (!plan) return "هذه العملية لم تعد متاحة بهذه البيانات. يمكنك بدء العملية من جديد.";
  }

  if (STORE_TYPES.has(draft.type)) {
    const isFamilyProduction = draft.type === "family_production_registration";
    const activity = isFamilyProduction
      ? getFamilyProductionActivity(draft.data?.activityKey)
      : getStoreActivity(draft.data?.activityKey);
    if (draft.data?.activityKey && !activity) {
      return "هذه العملية لم تعد متاحة بهذه البيانات. يمكنك بدء العملية من جديد.";
    }
    const categoryIds = draft.data?.selectedCategories || [];
    if (categoryIds.length) {
      if (categoryIds.some((id) => !validId(id))) {
        return "هذه العملية لم تعد متاحة بهذه البيانات. يمكنك بدء العملية من جديد.";
      }
      const categories = await Category.find({ _id: { $in: categoryIds }, status: "active" })
        .select("slug")
        .lean();
      if (categories.length !== categoryIds.length
        || (activity && categories.some((category) => !activity.allowedCategorySlugs.includes(category.slug)))) {
        return "هذه العملية لم تعد متاحة بهذه البيانات. يمكنك بدء العملية من جديد.";
      }
    }
    if (draft.data?.governorateId) {
      if (!validId(draft.data.governorateId)
        || !await Governorate.exists({ _id: draft.data.governorateId, isActive: true })) {
        return "هذه العملية لم تعد متاحة بهذه البيانات. يمكنك بدء العملية من جديد.";
      }
    }
    if (draft.data?.cityId) {
      if (!validId(draft.data.cityId) || !draft.data.governorateId
        || !await City.exists({
          _id: draft.data.cityId,
          governorateId: draft.data.governorateId,
          isActive: true
        })) {
        return "هذه العملية لم تعد متاحة بهذه البيانات. يمكنك بدء العملية من جديد.";
      }
    }
  }

  if (draft.type === "featured_ad_upgrade") {
    if (draft.adId) {
      const ad = await Ad.findById(draft.adId).lean();
      if (!ad || String(ad.userId) !== String(draft.userId)) {
        return "هذه العملية لم تعد متاحة بهذه البيانات. يمكنك بدء العملية من جديد.";
      }
    }
    if (draft.planId) {
      const plan = await Plan.findOne({ _id: draft.planId, type: "featured", isActive: true }).lean();
      if (!plan) return "هذه العملية لم تعد متاحة بهذه البيانات. يمكنك بدء العملية من جديد.";
    }
  }

  if (draft.type === "wallet_service_catalog") {
    const result = await validateWalletServiceCatalogDraft(draft);
    if (result.error) return result.error;
  }

  return null;
}

function validId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

router.get("/", auth, async (req, res) => {
  try {
    const drafts = await DraftAction.find({
      userId: req.user.id,
      status: "incomplete",
      expiresAt: { $gt: new Date() }
    }).sort({ updatedAt: -1 }).lean();
    res.json(drafts);
  } catch (error) {
    console.error("Load incomplete actions failed:", error);
    res.status(500).json({ error: "تعذر تحميل العمليات غير المكتملة." });
  }
});

router.post("/", auth, async (req, res) => {
  if (rejectIfDraftActionWritesPaused(res)) return;
  try {
    const { type } = req.body || {};
    if (!Object.hasOwn(MAX_STEPS, type)) {
      return res.status(400).json({ error: "نوع العملية غير مدعوم." });
    }
    const payload = sanitizeInput(type, req.body || {});
    for (const id of [payload.planId, payload.adId, payload.serviceId, payload.sectionId]) {
      if (id && !validId(id)) return res.status(400).json({ error: "مرجع العملية غير صالح." });
    }
    if (type === "wallet_service_catalog" && !payload.serviceId) {
      return res.status(400).json({ error: "الخدمة غير محددة." });
    }

    if (STORE_TYPES.has(type) && payload.planId) {
      const expectedType = type === "family_production_registration" ? "family-production" : "store";
      if (!await Plan.exists({ _id: payload.planId, type: expectedType, isActive: true })) {
        return res.status(409).json({ error: "هذه العملية لم تعد متاحة بهذه البيانات. يمكنك بدء العملية من جديد." });
      }
    }
    if (type === "featured_ad_upgrade") {
      if (payload.adId) {
        const ad = await Ad.findById(payload.adId).select("userId").lean();
        if (!ad || String(ad.userId) !== String(req.user.id)) {
          return res.status(409).json({ error: "هذه العملية لم تعد متاحة بهذه البيانات. يمكنك بدء العملية من جديد." });
        }
      }
      if (payload.planId && !await Plan.exists({ _id: payload.planId, type: "featured", isActive: true })) {
        return res.status(409).json({ error: "هذه العملية لم تعد متاحة بهذه البيانات. يمكنك بدء العملية من جديد." });
      }
    }
    const id = req.body.id;
    let existingDraft = null;
    if (id) {
      if (!validId(id)) return res.status(400).json({ error: "المسودة غير صالحة." });
      existingDraft = await DraftAction.findOne({
        _id: id,
        userId: req.user.id,
        status: "incomplete",
        expiresAt: { $gt: new Date() }
      });
      if (!existingDraft || existingDraft.type !== type) {
        return res.status(404).json({ error: "العملية غير موجودة." });
      }
    } else {
      const query = {
        userId: req.user.id,
        type,
        status: "incomplete",
        expiresAt: { $gt: new Date() }
      };
      if (type === "wallet_service_catalog") query.serviceId = payload.serviceId;
      existingDraft = await DraftAction.findOne(query);
    }

    if (type === "wallet_service_catalog") {
      if (existingDraft && String(existingDraft.serviceId || "") !== String(payload.serviceId)) {
        return res.status(409).json({ error: "لا يمكن تغيير الخدمة المرتبطة بالمسودة." });
      }

      const currentService = await WalletService.findOne({
        _id: payload.serviceId,
        isActive: true,
        isArchived: { $ne: true }
      });
      if (!currentService) {
        return res.status(409).json({ error: "هذه العملية لم تعد متاحة بهذه البيانات. يمكنك بدء العملية من جديد." });
      }
      const requestedVersion = payload.data.serviceVersion;
      const pinnedVersion = existingDraft
        ? Number(existingDraft.data?.serviceVersion
          || getWalletServiceVersionAt(currentService, existingDraft.createdAt))
        : Number(currentService.serviceVersion || 1);
      if (!Number.isSafeInteger(pinnedVersion) || pinnedVersion < 1) {
        return res.status(409).json({ error: "تعذر التحقق من إصدار الخدمة عند إنشاء هذه المسودة." });
      }
      if (requestedVersion !== undefined && requestedVersion !== pinnedVersion) {
        return res.status(409).json({ error: "لا يمكن تغيير إصدار الخدمة المرتبط بالمسودة." });
      }
      const pinnedConfig = getWalletServiceVersion(currentService, pinnedVersion);
      if (!pinnedConfig) {
        return res.status(409).json({ error: "إصدار الخدمة لم يعد متاحًا. ابدأ طلبًا جديدًا." });
      }
      const pinnedFormVersion = Number(pinnedConfig.formSchemaVersion || 1);
      if (payload.data.formSchemaVersion !== undefined
        && payload.data.formSchemaVersion !== pinnedFormVersion) {
        return res.status(409).json({ error: "لا يمكن تغيير إصدار نموذج الخدمة المرتبط بالمسودة." });
      }
      payload.data.serviceVersion = pinnedVersion;
      payload.data.formSchemaVersion = pinnedFormVersion;

      const validation = await validateWalletServiceCatalogDraft({
        ...payload,
        type,
        serviceId: payload.serviceId,
        ...(existingDraft ? { createdAt: existingDraft.createdAt } : {})
      }, currentService);
      if (validation.error) return res.status(validation.status || 409).json({ error: validation.error });
    }

    let draft;
    if (existingDraft) {
      draft = existingDraft;
      Object.assign(draft, payload, { expiresAt: new Date(Date.now() + DRAFT_TTL_MS) });
      await draft.save();
    } else {
      const query = { userId: req.user.id, type, status: "incomplete" };
      if (type === "wallet_service_catalog") query.serviceId = payload.serviceId;
      const update = { $set: { ...payload, expiresAt: new Date(Date.now() + DRAFT_TTL_MS) } };
      try {
        draft = await DraftAction.findOneAndUpdate(query, update, {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
        return res.status(409).json({ error: "تم إنشاء مسودة أخرى بالتزامن. أعد تحميل العملية قبل المتابعة." });
      }
    }
    res.status(200).json(draft);
  } catch (error) {
    if (error.message === "خطوة العملية غير صالحة.") return res.status(400).json({ error: error.message });
    console.error("Save incomplete action failed:", error);
    res.status(500).json({ error: "تعذر حفظ العملية غير المكتملة." });
  }
});

router.get("/:id/resume", auth, async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: "العملية غير موجودة." });
    const draft = await DraftAction.findOne({
      _id: req.params.id,
      userId: req.user.id,
      status: "incomplete",
      expiresAt: { $gt: new Date() }
    }).lean();
    if (!draft) return res.status(404).json({ error: "انتهت صلاحية هذه العملية أو لم تعد موجودة." });
    const invalidReason = await validateReferences(draft);
    if (invalidReason) return res.status(409).json({ error: invalidReason, code: "DRAFT_INVALID" });
    res.json(draft);
  } catch (error) {
    console.error("Resume incomplete action failed:", error);
    res.status(500).json({ error: "تعذر استئناف العملية." });
  }
});

router.delete("/:id", auth, async (req, res) => {
  if (rejectIfDraftActionWritesPaused(res)) return;
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: "العملية غير موجودة." });
    const result = await DraftAction.deleteOne({
      _id: req.params.id,
      userId: req.user.id,
      status: "incomplete"
    });
    if (!result.deletedCount) return res.status(404).json({ error: "العملية غير موجودة." });
    res.status(204).end();
  } catch (error) {
    console.error("Delete incomplete action failed:", error);
    res.status(500).json({ error: "تعذر حذف العملية." });
  }
});

export { DRAFT_TTL_MS, sanitizeInput, validateReferences };
export default router;
