import { Router } from "express";
import mongoose from "mongoose";
import QuoteRequest from "../models/QuoteRequest.js";
import Governorate from "../models/Governorate.js";
import City from "../models/City.js";
import Category from "../models/Category.js";
import User from "../models/User.js";
import auth from "../middleware/auth.js";
import optionalAuth from "../middleware/optionalAuth.js";
import { uploadImages } from "../middleware/upload.js";
import processImages, { validateProcessedImages } from "../middleware/processImages.js";
import { createAdminNotification, createNotification } from "../services/notificationService.js";

const router = Router();
const currencies = ["YER_ADEN", "YER_SANAA", "SAR", "USD"];
const validId = (id) => mongoose.Types.ObjectId.isValid(id);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pageData = (page, limit, total) => ({ page, limit, total, pages: Math.ceil(total / limit) });

const moderationRules = {
  blockedKeywords: ["أسلحة", "ذخائر", "مخدرات", "مواد محظورة", "قنبلة", "سلاح", "تزييف", "ممنوع"],
  suspiciousKeywords: ["wa.me", "whatsapp", "@", "http://", "https://", "تواصل مباشر", "اتصال مباشر", "محادثات خارجية"]
};

function assessContentModeration({ itemName = "", description = "", specifications = "" } = {}) {
  const haystack = `${itemName} ${description} ${specifications}`.toLowerCase();
  const blockedMatches = moderationRules.blockedKeywords
    .filter((keyword) => haystack.includes(keyword.toLowerCase()))
    .slice(0, 3);
  if (blockedMatches.length) {
    return { status: "blocked", reason: `محتوى غير مسموح: ${blockedMatches[0]}` };
  }

  const suspiciousMatches = moderationRules.suspiciousKeywords
    .filter((keyword) => haystack.includes(keyword.toLowerCase()))
    .slice(0, 3);

  if (suspiciousMatches.length) {
    return { status: "review", reason: "تحتاج مراجعة إدارية قبل النشر", matches: suspiciousMatches };
  }

  return { status: "approved", reason: "" };
}

function parseOffer(body) {
  const isNumericInput = (value) => typeof value === "number" || (typeof value === "string" && value.trim() !== "");
  if (!isNumericInput(body.price) || !isNumericInput(body.availableQuantity)) return { error: "أدخل السعر والكمية بشكل صحيح." };
  const price = Number(body.price);
  const availableQuantity = Number(body.availableQuantity);
  if (body.deliveryCost !== "" && body.deliveryCost != null && !isNumericInput(body.deliveryCost)) return { error: "أدخل تكلفة توصيل صحيحة." };
  const deliveryCost = body.deliveryCost === "" || body.deliveryCost == null ? 0 : Number(body.deliveryCost);
  const currency = currencies.includes(body.currency) ? body.currency : null;
  const notes = String(body.notes || "").trim();
  const validUntil = body.validUntil
    ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(body.validUntil) ? `${body.validUntil}T23:59:59.999Z` : body.validUntil)
    : null;
  if (!Number.isFinite(price) || price <= 0) return { error: "أدخل سعرًا صحيحًا." };
  if (!Number.isFinite(availableQuantity) || availableQuantity <= 0) return { error: "أدخل كمية متوفرة صحيحة." };
  if (!Number.isFinite(deliveryCost) || deliveryCost < 0) return { error: "أدخل تكلفة توصيل صحيحة." };
  if (!currency) return { error: "العملة المحددة غير صحيحة." };
  if (notes.length > 1000) return { error: "الملاحظات أطول من المسموح." };
  if (validUntil && (!Number.isFinite(validUntil.getTime()) || validUntil <= new Date())) return { error: "تاريخ صلاحية السعر غير صحيح." };
  return { offer: { price, availableQuantity, deliveryCost, currency, validUntil, notes } };
}

router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const filter = { status: req.query.status || "open" };
    filter.moderationStatus = { $nin: ["hidden", "rejected", "pending_review"] };
    if (!["open", "closed", "cancelled", "awarded"].includes(filter.status)) {
      return res.status(400).json({ error: "حالة الطلب غير صحيحة." });
    }
    for (const key of ["governorateId", "cityId", "categoryId"]) {
      if (req.query[key]) {
        if (!validId(req.query[key])) return res.status(400).json({ error: `معرّف ${key} غير صحيح.` });
        filter[key] = req.query[key];
      }
    }
    if (req.query.q) {
      const term = escapeRegex(String(req.query.q).trim().slice(0, 100));
      if (term) {
        const pattern = new RegExp(term, "i");
        filter.$or = [{ itemName: pattern }, { description: pattern }, { specifications: pattern }];
      }
    }
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) {
        const from = new Date(req.query.from);
        if (!Number.isFinite(from.getTime())) return res.status(400).json({ error: "تاريخ البداية غير صحيح." });
        filter.createdAt.$gte = from;
      }
      if (req.query.to) {
        const to = new Date(req.query.to);
        if (!Number.isFinite(to.getTime())) return res.status(400).json({ error: "تاريخ النهاية غير صحيح." });
        to.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = to;
      }
    }
    const sort = req.query.sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 };
    const [items, total] = await Promise.all([
      QuoteRequest.find(filter).select("-offers").populate("governorateId", "name").populate("cityId", "name")
        .populate("categoryId", "name").populate("ownerId", "name avatar")
        .sort(sort).skip((page - 1) * limit).limit(limit).lean(),
      QuoteRequest.countDocuments(filter)
    ]);
    res.json({ items, ...pageData(page, limit, total) });
  } catch (error) {
    console.error("Quote requests list failed:", error);
    res.status(500).json({ error: "تعذر تحميل طلبات التسعير." });
  }
});

router.get("/mine", auth, async (req, res) => {
  try {
    const items = await QuoteRequest.find({ ownerId: req.user.id })
      .populate("governorateId", "name").populate("cityId", "name").populate("categoryId", "name")
      .sort({ createdAt: -1 }).lean();
    res.json(items);
  } catch (error) {
    console.error("My quote requests failed:", error);
    res.status(500).json({ error: "تعذر تحميل طلباتك." });
  }
});

router.get("/offers/mine", auth, async (req, res) => {
  try {
    const items = await QuoteRequest.find({ "offers.userId": req.user.id })
      .populate("governorateId", "name").populate("cityId", "name").populate("categoryId", "name")
      .sort({ createdAt: -1 }).lean();
    res.json(items.map((item) => ({
      ...item,
      offers: item.offers.filter((offer) => String(offer.userId) === req.user.id)
    })));
  } catch (error) {
    console.error("My quote offers failed:", error);
    res.status(500).json({ error: "تعذر تحميل عروضك." });
  }
});

router.post("/", auth, uploadImages.array("images", 1), processImages("ads"), validateProcessedImages, async (req, res) => {
  try {
    const itemName = String(req.body.itemName || "").trim();
    const quantity = Number(req.body.quantity);
    const governorateId = String(req.body.governorateId || "");
    const cityId = String(req.body.cityId || "");
    const categoryId = String(req.body.categoryId || "");
    const description = String(req.body.description || "").trim();
    const specifications = String(req.body.specifications || "").trim();
    if (!itemName || itemName.length > 160) return res.status(400).json({ error: "اسم السلعة مطلوب وبحد أقصى 160 حرفًا." });
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000000) return res.status(400).json({ error: "الكمية غير صحيحة." });
    if (description.length > 2000 || specifications.length > 2000) return res.status(400).json({ error: "الوصف أو المواصفات أطول من المسموح." });
    if (!validId(governorateId) || !validId(cityId)) return res.status(400).json({ error: "اختر المحافظة والمدينة بشكل صحيح." });
    if (categoryId && !validId(categoryId)) return res.status(400).json({ error: "التصنيف المحدد غير صحيح." });
    const [governorate, city, category] = await Promise.all([
      Governorate.findOne({ _id: governorateId, isActive: true }).select("_id").lean(),
      City.findOne({ _id: cityId, governorateId, isActive: true }).select("_id").lean(),
      categoryId ? Category.findOne({ _id: categoryId, status: "active" }).select("_id").lean() : null
    ]);
    if (!governorate || !city || (categoryId && !category)) {
      return res.status(400).json({ error: "المحافظة أو المدينة أو التصنيف غير صالح." });
    }
    const image = req.files?.[0]?.filename ? `/uploads/${req.files[0].filename}` : "";
    const moderation = assessContentModeration({ itemName, description, specifications });
    if (moderation.status === "blocked") {
      return res.status(400).json({ error: moderation.reason });
    }
    const item = await QuoteRequest.create({
      ownerId: req.user.id, itemName, description, quantity, governorateId, cityId,
      categoryId: categoryId || null, specifications, image,
      moderationStatus: moderation.status === "review" ? "pending_review" : "approved",
      moderationReason: moderation.status === "review" ? moderation.reason : "",
      flagged: moderation.status === "review"
    });
    res.status(201).json(item);
  } catch (error) {
    console.error("Quote request creation failed:", error);
    res.status(500).json({ error: "تعذر إنشاء طلب التسعير." });
  }
});

router.post("/:id/report", auth, async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ error: "معرّف الطلب غير صحيح." });
    const reason = String(req.body?.reason || "").trim();
    if (!reason) return res.status(400).json({ error: "اكتب سبب الإبلاغ." });

    const item = await QuoteRequest.findById(req.params.id).select("ownerId moderationStatus flagged reportCount").lean();
    if (!item) return res.status(404).json({ error: "الطلب غير موجود." });
    if (String(item.ownerId) === req.user.id) return res.status(400).json({ error: "لا يمكنك الإبلاغ عن طلبك الخاص." });

    const updated = await QuoteRequest.findByIdAndUpdate(
      req.params.id,
      {
        $inc: { reportCount: 1 },
        flagged: true,
        moderationStatus: item.moderationStatus === "approved" ? "pending_review" : item.moderationStatus,
        moderationReason: item.moderationReason || "بلاغ مستخدم"
      },
      { new: true }
    ).lean();

    await createAdminNotification(req.app, {
      type: "quote_request_report",
      title: "بلاغ على طلب تسعيرة",
      message: `تم الإبلاغ عن طلب التسعيرة ${item._id} بسبب: ${reason}`,
      link: "/admin/quote-requests",
      data: { quoteRequestId: req.params.id, reason }
    });

    await createNotification(req.app, {
      userId: item.ownerId,
      type: "quote_status",
      title: "تمّ الإبلاغ عن طلبك",
      body: "تمّت مراجعة طلبك من الإدارة بسبب بلاغ جديد، وسيتم اتخاذ الإجراء المناسب.",
      data: { quoteRequestId: req.params.id, url: `/quote-requests/${req.params.id}` }
    }).catch(() => {});

    res.json({ ok: true, item: updated, message: "تم إرسال البلاغ للإدارة." });
  } catch (error) {
    console.error("Quote request report failed:", error);
    res.status(500).json({ error: "تعذر إرسال البلاغ." });
  }
});

router.get("/:id", optionalAuth, async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ error: "معرّف الطلب غير صحيح." });
    const item = await QuoteRequest.findById(req.params.id)
      .populate("governorateId", "name").populate("cityId", "name").populate("categoryId", "name")
      .populate("ownerId", "name avatar")
      .populate({ path: "offers.userId", select: "name phone" }).lean();
    if (!item) return res.status(404).json({ error: "الطلب غير موجود." });
    const isOwner = String(item.ownerId?._id || item.ownerId) === req.user?.id;
    const isAdmin = req.user?.role === "admin";
    if (!isOwner && !isAdmin && (item.moderationStatus || "approved") !== "approved") {
      return res.status(404).json({ error: "الطلب غير متاح للعامة." });
    }
    if (!isOwner && !isAdmin) item.offers = [];
    else if (item.offers.length) {
      const offererIds = item.offers.map((offer) => offer.userId?._id).filter(Boolean);
      const users = await User.find({ _id: { $in: offererIds } }).select("_id phone").lean();
      const phones = new Map(users.map((user) => [String(user._id), user.phone || ""]));
      item.offers = item.offers.map((offer) => ({
        ...offer,
        contactPhone: phones.get(String(offer.userId?._id)) || ""
      }));
    }
    res.json({ ...item, isOwner, isAdmin });
  } catch (error) {
    console.error("Quote request details failed:", error);
    res.status(500).json({ error: "تعذر تحميل تفاصيل الطلب." });
  }
});

router.post("/:id/offers", auth, async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ error: "معرّف الطلب غير صحيح." });
    const parsed = parseOffer(req.body || {});
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const existing = await QuoteRequest.findById(req.params.id).select("ownerId status moderationStatus offers itemName").lean();
    if (!existing) return res.status(404).json({ error: "الطلب غير موجود." });

    const offer = { ...parsed.offer, userId: req.user.id };
    const updateFilter = {
      _id: req.params.id,
      status: "open",
      ownerId: { $ne: req.user.id },
      moderationStatus: "approved",
      "offers.userId": { $ne: req.user.id }
    };
    const item = await QuoteRequest.findOneAndUpdate(
      updateFilter,
      { $push: { offers: offer } },
      { new: true, runValidators: true }
    ).select("ownerId itemName offers").lean();

    if (!item) {
      const moderationState = existing.moderationStatus || "approved";
      if (String(existing.ownerId) === req.user.id) {
        return res.status(403).json({ error: "لا يمكنك تقديم عرض على طلبك." });
      }
      if (moderationState !== "approved") {
        return res.status(403).json({ error: "هذا الطلب غير متاح حاليًا لتقديم عروض جديدة." });
      }
      if (existing.status !== "open") {
        return res.status(409).json({ error: "هذا الطلب مغلق ولا يستقبل عروضًا جديدة." });
      }
      if (existing.offers.some((offerItem) => String(offerItem.userId) === req.user.id)) {
        return res.status(409).json({ error: "سبق أن قدمت عرضًا على هذا الطلب." });
      }
      return res.status(409).json({ error: "تعذر إرسال العرض؛ قد يكون الطلب مغلقًا أو تحت مراجعة." });
    }
    await createNotification(req.app, {
      userId: item.ownerId,
      type: "quote_offer",
      title: "وصل عرض جديد لطلب التسعير",
      body: `قدّم أحد المستخدمين عرضًا على طلبك: ${item.itemName}`,
      data: { quoteRequestId: req.params.id, url: `/quote-requests/${req.params.id}` }
    });
    res.status(201).json(item.offers[item.offers.length - 1]);
  } catch (error) {
    console.error("Quote offer creation failed:", error);
    res.status(500).json({ error: "تعذر إرسال عرض السعر." });
  }
});

router.patch("/:id/status", auth, async (req, res) => {
  try {
    const status = req.body?.status;
    if (!validId(req.params.id)) return res.status(400).json({ error: "معرّف الطلب غير صحيح." });
    if (!["closed", "cancelled"].includes(status)) return res.status(400).json({ error: "حالة الإغلاق غير صحيحة." });

    const existing = await QuoteRequest.findById(req.params.id).select("ownerId status moderationStatus").lean();
    if (!existing) return res.status(404).json({ error: "الطلب غير موجود." });
    if (String(existing.ownerId) !== req.user.id) return res.status(403).json({ error: "لا تملك صلاحية تعديل هذا الطلب." });
    if ((existing.moderationStatus || "approved") !== "approved") return res.status(403).json({ error: "هذا الطلب تحت مراجعة إدارية ولا يمكن تعديله حاليًا." });
    if (existing.status !== "open") return res.status(409).json({ error: "الطلب مغلق مسبقًا." });

    const item = await QuoteRequest.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.user.id, status: "open", moderationStatus: "approved" },
      { $set: { status } },
      { new: true }
    ).lean();
    if (!item) return res.status(409).json({ error: "تعذر تحديث حالة الطلب." });
    res.json(item);
  } catch (error) {
    console.error("Quote request closing failed:", error);
    res.status(500).json({ error: "تعذر إغلاق الطلب." });
  }
});

router.patch("/:id/select-offer/:offerId", auth, async (req, res) => {
  try {
    if (!validId(req.params.id) || !validId(req.params.offerId)) return res.status(400).json({ error: "معرّف الطلب أو العرض غير صحيح." });

    const existing = await QuoteRequest.findById(req.params.id).select("ownerId status moderationStatus offers itemName").lean();
    if (!existing) return res.status(404).json({ error: "الطلب غير موجود." });
    if (String(existing.ownerId) !== req.user.id) return res.status(403).json({ error: "لا تملك صلاحية اختيار العرض." });
    if ((existing.moderationStatus || "approved") !== "approved") return res.status(403).json({ error: "هذا الطلب تحت مراجعة إدارية ولا يمكن اختيار عرضٍ عليه." });
    if (existing.status !== "open") return res.status(409).json({ error: "تعذر اختيار العرض؛ الطلب غير مفتوح." });
    if (!existing.offers.some((offer) => String(offer._id) === req.params.offerId)) return res.status(409).json({ error: "العرض المحدد غير موجود في هذا الطلب." });

    const item = await QuoteRequest.findOneAndUpdate(
      {
        _id: req.params.id, ownerId: req.user.id, status: "open", moderationStatus: "approved",
        offers: { $elemMatch: { _id: req.params.offerId } }
      },
      { $set: { status: "awarded", selectedOfferId: req.params.offerId } },
      { new: true }
    ).select("offers itemName").lean();
    if (!item) return res.status(409).json({ error: "تعذر اختيار العرض؛ تحقق من أن الطلب مفتوح والعرض موجود." });
    const selected = item.offers.find((offer) => String(offer._id) === req.params.offerId);
    await createNotification(req.app, {
      userId: selected.userId,
      type: "quote_status",
      title: "تم اختيار عرضك",
      body: `اختار صاحب الطلب عرضك على: ${item.itemName}`,
      data: { quoteRequestId: req.params.id, url: `/quote-requests/${req.params.id}` }
    });
    res.json({ ok: true, status: "awarded", selectedOfferId: req.params.offerId });
  } catch (error) {
    console.error("Quote offer selection failed:", error);
    res.status(500).json({ error: "تعذر اختيار العرض." });
  }
});

export default router;
