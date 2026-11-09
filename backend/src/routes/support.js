import { Router } from "express";
import mongoose from "mongoose";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import SupportConversation from "../models/SupportConversation.js";
import SupportFaq from "../models/SupportFaq.js";
import SupportMessage from "../models/SupportMessage.js";
import User from "../models/User.js";
import { hasAdminPermission } from "../config/adminPermissions.js";
import { uploadMessageImages } from "../middleware/upload.js";
import {
  getUploadedMessageAttachmentNames,
  getMessageAttachmentReference,
  getSupportAttachmentAccess,
  isSafeMessageAttachmentFilename,
  rejectClientSuppliedAttachmentRefs,
  resolveMessageAttachmentPath,
  sendMessageAttachment
} from "../services/privateMessageAttachments.js";

const router = Router();

router.get("/attachments/:filename", auth, async (req, res) => {
  try {
    const { filename } = req.params;
    if (!isSafeMessageAttachmentFilename(filename)) return res.sendStatus(404);

    const references = [filename, `uploads/${filename}`, `/uploads/${filename}`, `private/${filename}`];
    const message = await SupportMessage.findOne({ images: { $in: references } })
      .select("conversationId images")
      .lean();
    if (!message) return res.sendStatus(404);

    const conversation = await SupportConversation.findById(message.conversationId)
      .select("userId isPermanentlyDeleted")
      .lean();
    if (!conversation) return res.sendStatus(404);

    if (!getSupportAttachmentAccess(req.user, conversation).isAuthorized) {
      return res.sendStatus(404);
    }

    const attachmentReference = getMessageAttachmentReference(message.images, filename);
    if (!attachmentReference) return res.sendStatus(404);
    const filePath = resolveMessageAttachmentPath(filename, attachmentReference);
    if (!filePath) return res.sendStatus(404);
    return sendMessageAttachment(res, filePath);
  } catch (error) {
    console.error("Support attachment access error:", error);
    return res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

const DEFAULT_FAQS = [
  {
    key: "default-account",
    category: "الحساب",
    question: "كيف أستعيد كلمة المرور؟",
    answer: "من صفحة تسجيل الدخول اختر «نسيت كلمة المرور؟» واتبع التعليمات الظاهرة لإعادة تعيينها.",
    keywords: ["نسيت كلمة السر", "استعادة كلمة المرور", "استعيد كلمة المرور", "تغيير كلمة السر"],
    sortOrder: 10,
    active: true
  },
  {
    key: "default-create-listing",
    category: "الإعلانات",
    question: "كيف أضيف إعلاناً جديداً؟",
    answer: "افتح خيار «إضافة إعلان»، اختر القسم المناسب، أكمل بيانات المنتج وأضف صوره، ثم أرسل الإعلان.",
    keywords: ["اضافة اعلان", "اضيف اعلان", "انشر اعلان", "نشر اعلان", "نشر منتج", "أبيع منتجاً"],
    sortOrder: 20,
    active: true
  },
  {
    key: "default-edit-listing",
    category: "الإعلانات",
    question: "كيف أعدل أو أحذف إعلاني؟",
    answer: "افتح صفحة «إعلاناتي»، اختر الإعلان المطلوب، ثم استخدم خيارات التعديل أو الحذف المتاحة له.",
    keywords: ["تعديل اعلان", "اعدل اعلاني", "حذف اعلان", "احذف اعلاني", "إعلاناتي", "تغيير بيانات المنتج"],
    sortOrder: 30,
    active: true
  },
  {
    key: "default-contact-seller",
    category: "الشراء والتواصل",
    question: "كيف أتواصل مع البائع؟",
    answer: "افتح تفاصيل الإعلان واستخدم وسيلة التواصل المتاحة في صفحة البائع أو الإعلان.",
    keywords: ["مراسلة البائع", "اتواصل مع البائع", "اكلم البائع", "رقم البائع", "التواصل مع صاحب الإعلان"],
    sortOrder: 40,
    active: true
  },
  {
    key: "default-contact-support",
    category: "الدعم الفني",
    question: "كيف أراسل الدعم الفني؟",
    answer: "اختر «مراسلة الدعم الفني» من هذه النافذة، واكتب رسالتك وسيراجعها فريق الدعم.",
    keywords: ["مراسلة الادمن", "مشكلة", "شكوى", "التواصل مع الدعم"],
    sortOrder: 50,
    active: true
  },
  {
    key: "default-assistant-identity",
    category: "الدعم الفني",
    question: "من أنت؟",
    answer: "أنا مساعد سوقك الفوري. أجيب عن الأسئلة الشائعة بإجابات جاهزة، وإذا لم أجد إجابة مناسبة يمكنك مراسلة فريق الدعم.",
    keywords: ["من انت", "ما هو مساعد سوقك", "مساعد سوقك", "ماهو البوت"],
    sortOrder: 60,
    active: true
  },
  {
    key: "default-secure-purchase",
    category: "الشراء الآمن",
    question: "ما هو الشراء الآمن؟",
    answer: "الشراء الآمن خدمة وساطة عبر أمانة تتيح بدء طلب الشراء ومتابعة تفاصيله وشحنه من سوقك. راجع تفاصيل الطلب والشروط قبل الإرسال، ولا تحوّل المال مباشرة خارج مسار الطلب.",
    keywords: ["ماهو الشراء الامن", "ما هي خدمة الشراء الآمن", "شراء مضمون", "كيف اشتري بأمان", "الوساطة عبر امانة"],
    sortOrder: 70,
    active: true
  },
  {
    key: "default-start-secure-purchase",
    category: "الشراء الآمن",
    question: "كيف أبدأ طلب شراء آمن؟",
    answer: "افتح الإعلان واختر طلب الشراء الآمن، ثم أدخل السعر المتفق عليه والعملة والتوصيل والملاحظات. راجع الإجمالي ورسوم الخدمة، وافق على الشروط، ثم أرسل الطلب لمتابعته من صفحة الطلب.",
    keywords: ["كيف اطلب شراء", "طريقة الشراء الآمن", "شراء عبر امانة", "طلب من الإعلان"],
    sortOrder: 80,
    active: true
  },
  {
    key: "default-secure-purchase-fee",
    category: "الشراء الآمن",
    question: "كم رسوم خدمة الشراء الآمن؟",
    answer: "رسوم خدمة الشراء الآمن الظاهرة في ملخص الطلب هي 3% من سعر السلعة. راجع الإجمالي المعروض قبل الموافقة والإرسال.",
    keywords: ["رسوم الشراء الآمن", "عمولة الشراء", "نسبة امانة", "كم عمولة الوساطة"],
    sortOrder: 90,
    active: true
  },
  {
    key: "default-track-order",
    category: "الطلبات",
    question: "كيف أتابع طلب الشراء؟",
    answer: "افتح صفحة الطلبات في حسابك، ثم اختر الطلب لمراجعة تفاصيله ومتابعة خطواته وشحنه.",
    keywords: ["تتبع الطلب", "حالة الطلب", "متابعة الشحنة", "وين طلبي"],
    sortOrder: 100,
    active: true
  },
  {
    key: "default-pending-balance",
    category: "المحفظة",
    question: "متى يتحول الرصيد المعلق إلى رصيدي المتاح؟",
    answer: "وفق المسار الحالي، يتحول الرصيد بعد تأكيد المشتري للاستلام، أو تلقائياً بعد 7 أيام من الشحن إذا لم يوجد نزاع مفتوح.",
    keywords: ["الرصيد المعلق", "تحرير الرصيد", "متى استلم ارباحي", "تأكيد الاستلام"],
    sortOrder: 110,
    active: true
  },
  {
    key: "default-withdraw-balance",
    category: "المحفظة",
    question: "كيف أسحب أرباحي؟",
    answer: "قدّم طلب سحب من صفحة المحفظة بعد إضافة بيانات الحساب المطلوبة. تتم مراجعة الطلب عادةً خلال 2 إلى 24 ساعة عمل، وقد يُطلب التحقق من الهوية لبعض الطلبات.",
    keywords: ["سحب الرصيد", "سحب الأرباح", "طلب سحب", "تحويل ارباحي"],
    sortOrder: 120,
    active: true
  }
];

let defaultFaqsInitialization;

async function ensureDefaultFaqs() {
  if (!defaultFaqsInitialization) {
    defaultFaqsInitialization = (async () => {
      await SupportFaq.init();
      try {
        await SupportFaq.bulkWrite(
          DEFAULT_FAQS.map((faq) => ({
            updateOne: {
              filter: { key: faq.key },
              update: { $setOnInsert: faq },
              upsert: true
            }
          }))
        );
      } catch (error) {
        const duplicateKeyError = error.code === 11000
          || error.writeErrors?.some((writeError) => writeError.code === 11000);
        if (!duplicateKeyError) throw error;
        const defaultsCount = await SupportFaq.countDocuments({
          key: { $in: DEFAULT_FAQS.map((faq) => faq.key) }
        });
        if (defaultsCount !== DEFAULT_FAQS.length) throw error;
      }
    })().catch((error) => {
      defaultFaqsInitialization = null;
      throw error;
    });
  }
  await defaultFaqsInitialization;
}

function validateFaqInput(body, { partial = false } = {}) {
  body = body && typeof body === "object" ? body : {};
  const faq = {};
  for (const field of ["question", "answer", "category"]) {
    if (!(field in body)) continue;
    if (typeof body[field] !== "string") {
      return { error: `حقل ${field} يجب أن يكون نصاً.` };
    }
    faq[field] = body[field].trim();
  }

  if (!partial && (!faq.question || !faq.answer)) {
    return { error: "السؤال والإجابة مطلوبان." };
  }
  if (faq.question?.length > 180) return { error: "يجب ألا يتجاوز السؤال 180 حرفاً." };
  if (faq.answer?.length > 2000) return { error: "يجب ألا تتجاوز الإجابة 2000 حرف." };
  if (faq.category?.length > 60) return { error: "يجب ألا يتجاوز القسم 60 حرفاً." };
  if ("keywords" in body) {
    if (!Array.isArray(body.keywords) || body.keywords.some((item) => typeof item !== "string")) {
      return { error: "الكلمات المفتاحية يجب أن تكون قائمة نصوص." };
    }
    faq.keywords = [...new Set(body.keywords.map((item) => item.trim()).filter(Boolean))].slice(0, 20);
  }
  if ("sortOrder" in body) {
    if (!Number.isFinite(body.sortOrder)) return { error: "ترتيب السؤال غير صالح." };
    faq.sortOrder = body.sortOrder;
  }
  if ("active" in body) {
    if (typeof body.active !== "boolean") return { error: "حالة السؤال غير صالحة." };
    faq.active = body.active;
  }
  return { faq };
}

router.get("/faqs", auth, async (req, res) => {
  try {
    await ensureDefaultFaqs();
    const faqs = await SupportFaq.find({ active: true })
      .select("question answer keywords category sortOrder")
      .sort({ sortOrder: 1, question: 1 })
      .lean();
    res.json(faqs);
  } catch (err) {
    console.error("Support FAQs GET error:", err);
    res.status(500).json({ error: "تعذر تحميل الأسئلة الشائعة." });
  }
});

router.get("/admin/faqs", auth, requireRole(["admin"]), async (req, res) => {
  try {
    await ensureDefaultFaqs();
    const faqs = await SupportFaq.find()
      .sort({ sortOrder: 1, question: 1 })
      .lean();
    res.json(faqs);
  } catch (err) {
    console.error("Admin support FAQs GET error:", err);
    res.status(500).json({ error: "تعذر تحميل الأسئلة الشائعة." });
  }
});

router.post("/admin/faqs", auth, requireRole(["admin"]), async (req, res) => {
  const validation = validateFaqInput(req.body);
  if (validation.error) return res.status(400).json({ error: validation.error });
  try {
    const faq = await SupportFaq.create({
      ...validation.faq,
      sortOrder: 100,
      key: `custom-${new mongoose.Types.ObjectId()}`
    });
    res.status(201).json(faq);
  } catch (err) {
    console.error("Admin support FAQ POST error:", err);
    res.status(500).json({ error: "تعذر حفظ السؤال الشائع." });
  }
});

router.patch("/admin/faqs/:id", auth, requireRole(["admin"]), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "معرف السؤال غير صالح." });
  }
  const validation = validateFaqInput(req.body, { partial: true });
  if (validation.error) return res.status(400).json({ error: validation.error });
  if (!Object.keys(validation.faq).length) {
    return res.status(400).json({ error: "لا توجد بيانات لتحديثها." });
  }
  try {
    const faq = await SupportFaq.findByIdAndUpdate(
      req.params.id,
      { $set: validation.faq },
      { new: true, runValidators: true }
    );
    if (!faq) return res.status(404).json({ error: "السؤال غير موجود." });
    res.json(faq);
  } catch (err) {
    console.error("Admin support FAQ PATCH error:", err);
    res.status(500).json({ error: "تعذر تحديث السؤال الشائع." });
  }
});

router.delete("/admin/faqs/:id", auth, requireRole(["admin"]), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "معرف السؤال غير صالح." });
  }
  try {
    const faq = await SupportFaq.findById(req.params.id);
    if (!faq) return res.status(404).json({ error: "السؤال غير موجود." });
    if (faq.key?.startsWith("default-")) {
      return res.status(400).json({ error: "لا يمكن حذف سؤال أساسي؛ يمكنك تعطيله بدلاً من ذلك." });
    }
    await faq.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    console.error("Admin support FAQ DELETE error:", err);
    res.status(500).json({ error: "تعذر حذف السؤال الشائع." });
  }
});

router.get("/my", auth, async (req, res) => {
  try {
    let conv = await SupportConversation.findOne({ 
      userId: req.user.id,
      deletedByUser: false
    });
    if (!conv) {
      const restoredConv = await SupportConversation.findOne({ userId: req.user.id });
      if (restoredConv && restoredConv.deletedByUser) {
        restoredConv.deletedByUser = false;
        restoredConv.deletedByUserAt = null;
        await restoredConv.save();
        conv = restoredConv;
      } else if (!restoredConv) {
        conv = await SupportConversation.create({ userId: req.user.id });
      } else {
        conv = restoredConv;
      }
    }
    res.json(conv);
  } catch (err) {
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

router.get("/my/messages", auth, async (req, res) => {
  try {
    let conv = await SupportConversation.findOne({ userId: req.user.id });
    if (!conv) {
      conv = await SupportConversation.create({ userId: req.user.id });
    } else if (conv.deletedByUser) {
      conv.deletedByUser = false;
      conv.deletedByUserAt = null;
      await conv.save();
    }
    const messages = await SupportMessage.find({ conversationId: conv._id })
      .sort({ createdAt: 1 })
      .lean();
    res.json(messages);
  } catch (err) {
    console.error("Support messages GET error:", err);
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

router.get("/conversations", auth, async (req, res) => {
  try {
    const filter = req.user.role === "admin" 
      ? {} 
      : { userId: req.user.id, deletedByUser: false };
    const convs = await SupportConversation.find(filter)
      .populate("userId", "name phone")
      .sort({ lastMessageAt: -1 })
      .lean();
    res.json(convs);
  } catch (err) {
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

router.get("/conversations/:id/messages", auth, async (req, res) => {
  try {
    const conv = await SupportConversation.findById(req.params.id).lean();
    if (!conv) return res.status(404).json({ error: "المحادثة غير موجودة." });
    
    if (req.user.role !== "admin" && String(conv.userId) !== String(req.user.id)) {
      return res.status(403).json({ error: "غير مسموح لك بالدخول لهذه المحادثة." });
    }

    if (req.user.role !== "admin" && conv.deletedByUser) {
      conv.deletedByUser = false;
      conv.deletedByUserAt = null;
      await SupportConversation.findByIdAndUpdate(req.params.id, {
        deletedByUser: false,
        deletedByUserAt: null
      });
    }

    const messages = await SupportMessage.find({ conversationId: req.params.id })
      .sort({ createdAt: 1 })
      .lean();
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

router.post("/my/messages", auth, uploadMessageImages.array("images", 5), rejectClientSuppliedAttachmentRefs, async (req, res) => {
  try {
    const { text } = req.body;
    const images = getUploadedMessageAttachmentNames(req.files).map((filename) => `private/${filename}`);
    
    let conv = await SupportConversation.findOne({ userId: req.user.id });
    if (!conv) {
      conv = await SupportConversation.create({ userId: req.user.id });
    } else if (conv.deletedByUser) {
      conv.deletedByUser = false;
      conv.deletedByUserAt = null;
      await conv.save();
    }
    
    const message = await SupportMessage.create({
      conversationId: conv._id,
      senderId: req.user.id,
      senderRole: "user",
      text,
      images: Array.isArray(images) ? images : (images ? [images] : [])
    });
    
    await SupportConversation.updateOne(
      { _id: conv._id },
      { 
        $set: { 
          lastMessage: text || (images?.length ? "صورة" : ""), 
          lastMessageAt: new Date(), 
          status: "open",
          deletedByUser: false,
          deletedByUserAt: null,
          deletedByAdmin: false,
          deletedByAdminAt: null,
          deletedByAdminId: null
        },
        $inc: { adminUnreadCount: 1 }
      }
    );
    
    const populatedConv = await SupportConversation.findById(conv._id)
      .populate("userId", "name phone avatar isDisabled")
      .lean();
    
    const io = req.app.get("io");
    if (io) {
      io.to("role:admin").emit("support:new_message", { 
        conversationId: conv._id, 
        message,
        conversation: populatedConv
      });
      io.to(`user:${req.user.id}`).emit("support:my_new_message", { message });
    }
    
    res.json(message);
  } catch (err) {
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

router.delete("/my", auth, async (req, res) => {
  try {
    const conv = await SupportConversation.findOne({ userId: req.user.id });
    if (!conv) return res.status(404).json({ error: "المحادثة غير موجودة." });
    
    conv.deletedByUser = true;
    conv.deletedByUserAt = new Date();
    await conv.save();
    
    res.json({ ok: true, message: "تم حذف المحادثة بنجاح" });
  } catch (err) {
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

router.get("/admin/unread-count", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const count = await SupportConversation.countDocuments({ 
      adminUnreadCount: { $gt: 0 },
      deletedByAdmin: false
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

router.get("/admin/all", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const conversations = await SupportConversation.find({ deletedByAdmin: false })
      .populate("userId", "name phone avatar isDisabled")
      .sort({ lastMessageAt: -1 })
      .lean();
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

router.get("/admin/trash", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const p = Math.max(1, parseInt(page));
    const l = Math.max(1, Math.min(100, parseInt(limit)));

    const [items, total] = await Promise.all([
      SupportConversation.find({ 
        deletedByAdmin: true,
        isPermanentlyDeleted: false
      })
        .populate("userId", "name phone avatar")
        .sort({ deletedByAdminAt: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .lean(),
      SupportConversation.countDocuments({ 
        deletedByAdmin: true,
        isPermanentlyDeleted: false
      })
    ]);

    res.json({ items, total, pages: Math.ceil(total / l) });
  } catch (err) {
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

router.post("/admin/:id/trash", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const conv = await SupportConversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: "المحادثة غير موجودة." });
    if (conv.deletedByAdmin) return res.status(400).json({ error: "المحادثة موجودة في سلة المهملات بالفعل." });
    
    conv.deletedByAdmin = true;
    conv.deletedByAdminAt = new Date();
    conv.deletedByAdminId = req.user.id;
    await conv.save();
    
    res.json({ ok: true, message: "تم نقل المحادثة إلى سلة المهملات" });
  } catch (err) {
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

router.post("/admin/:id/restore", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const conv = await SupportConversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: "المحادثة غير موجودة." });
    if (!conv.deletedByAdmin) return res.status(400).json({ error: "المحادثة ليست في سلة المهملات." });
    
    conv.deletedByAdmin = false;
    conv.deletedByAdminAt = null;
    conv.deletedByAdminId = null;
    await conv.save();
    
    res.json({ ok: true, message: "تم استعادة المحادثة بنجاح" });
  } catch (err) {
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

router.delete("/admin/:id/permanent", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const conv = await SupportConversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: "المحادثة غير موجودة." });
    
    await SupportMessage.deleteMany({ conversationId: conv._id });
    await SupportConversation.findByIdAndDelete(conv._id);
    
    res.json({ ok: true, message: "تم حذف المحادثة نهائياً" });
  } catch (err) {
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

router.get("/admin/:conversationId/messages", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const messages = await SupportMessage.find({ conversationId: req.params.conversationId })
      .sort({ createdAt: 1 })
      .lean();
    
    await SupportConversation.updateOne(
      { _id: req.params.conversationId },
      { $set: { adminUnreadCount: 0 } }
    );

    const io = req.app.get("io");
    if (io) {
      io.to("role:admin").emit("support:unread_count_update");
    }
    
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

router.post("/admin/:conversationId/messages", auth, requireRole(["admin"]), uploadMessageImages.array("images", 5), rejectClientSuppliedAttachmentRefs, async (req, res) => {
  try {
    const { text } = req.body;
    const images = getUploadedMessageAttachmentNames(req.files).map((filename) => `private/${filename}`);
    
    const conv = await SupportConversation.findById(req.params.conversationId);
    if (!conv) return res.status(404).json({ error: "المحادثة غير موجودة." });
    
    const message = await SupportMessage.create({
      conversationId: conv._id,
      senderId: req.user.id,
      senderRole: "admin",
      text,
      images: Array.isArray(images) ? images : (images ? [images] : [])
    });
    
    await SupportConversation.updateOne(
      { _id: conv._id },
      { 
        $set: { 
          lastMessage: text || (images?.length ? "صورة" : ""), 
          lastMessageAt: new Date(),
          deletedByAdmin: false,
          deletedByAdminAt: null,
          deletedByAdminId: null
        },
        $inc: { userUnreadCount: 1 }
      }
    );
    
    const io = req.app.get("io");
    if (io) {
      io.to(`user:${conv.userId}`).emit("support:admin_message", { message });
      io.to("role:admin").emit("support:admin_new_message", { conversationId: conv._id, message });
    }
    
    res.json(message);
  } catch (err) {
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

export default router;