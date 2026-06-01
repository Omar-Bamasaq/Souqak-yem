import { Router } from "express";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import SupportConversation from "../models/SupportConversation.js";
import SupportMessage from "../models/SupportMessage.js";
import User from "../models/User.js";
import { uploadImages } from "../middleware/upload.js";

const router = Router();

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

router.post("/my/messages", auth, uploadImages.array("images", 5), async (req, res) => {
  try {
    const { text } = req.body;
    const images = req.files ? req.files.map(f => f.filename) : req.body.images;
    
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

router.post("/admin/:conversationId/messages", auth, requireRole(["admin"]), uploadImages.array("images", 5), async (req, res) => {
  try {
    const { text } = req.body;
    const images = req.files ? req.files.map(f => f.filename) : req.body.images;
    
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