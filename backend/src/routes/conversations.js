import { Router } from "express";
import mongoose from "mongoose";
import auth from "../middleware/auth.js";
import User from "../models/User.js";
import Conversation from "../models/Conversation.js";
import ConversationMessage from "../models/ConversationMessage.js";
import Ad from "../models/Ad.js";
import ResellAd from "../models/ResellAd.js";
import Notification from "../models/Notification.js";
import { createNotification } from "../services/notificationService.js";
import { uploadImages } from "../middleware/upload.js";
import Block from "../models/Block.js";
import rateLimit from "../middleware/rateLimit.js";
import { requireRole } from "../middleware/roles.js";

import { sendPushNotification } from "../services/pushService.js";

const router = Router();

router.get("/unread-count", auth, async (req, res) => {
  try {
    const conversations = await Conversation.find({ 
      participants: req.user.id,
      deletedBy: { $ne: req.user.id },
      isDeletedByAdmin: { $ne: true }
    }).select("_id").lean();

    const conversationIds = conversations.map(c => c._id);
    
    const unreadCount = await ConversationMessage.countDocuments({
      conversationId: { $in: conversationIds },
      senderId: { $ne: req.user.id },
      status: { $ne: "read" },
      deletedBy: { $ne: req.user.id }
    });

    res.json({ count: unreadCount });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/", auth, async (req, res) => {
  try {
    console.log("Fetching conversations for user:", req.user.id);
    const list = await Conversation.find({ 
      participants: req.user.id,
      deletedBy: { $ne: req.user.id },
      isDeletedByAdmin: { $ne: true }
    })
      .populate({
        path: "adId",
        refPath: "adModel"
      })
      .populate("participants", "name avatar isVerifiedSeller isOnline lastSeen")
      .sort({ updatedAt: -1 })
      .lean();

    console.log("Conversations found:", list.length);
    if (list.length === 0) return res.json([]);

    // Manually populate originalAdId for ResellAd items if needed
    for (let i = 0; i < list.length; i++) {
      const conv = list[i];
      if (conv.adModel === "ResellAd" && conv.adId && conv.adId.originalAdId) {
        try {
          const originalAd = await Ad.findById(conv.adId.originalAdId)
            .select("title images userId status price currency governorateId cityId")
            .lean();
          if (originalAd) {
            conv.adId.originalAdId = originalAd;
          }
        } catch (popErr) {
          console.error("Error populating originalAdId manually:", popErr);
        }
      }
    }

    // Get unread counts for all conversations in one go
    const convIds = list.map(c => c._id);
    const unreadCounts = await ConversationMessage.aggregate([
      { 
        $match: { 
          conversationId: { $in: convIds.map(id => new mongoose.Types.ObjectId(id)) },
          status: { $ne: "read" },
          senderId: { $ne: new mongoose.Types.ObjectId(req.user.id) },
          deletedBy: { $ne: new mongoose.Types.ObjectId(req.user.id) }
        } 
      },
      { $group: { _id: "$conversationId", count: { $sum: 1 } } }
    ]);

    const countMap = unreadCounts.reduce((acc, curr) => {
      acc[curr._id.toString()] = curr.count;
      return acc;
    }, {});

    const withUnread = list.map((c) => {
      try {
        const participants = Array.isArray(c.participants) ? c.participants : [];
        const counterpart = participants.find(
          (p) => p && String(p._id || p) !== String(req.user.id)
        );
        
        let counterpartName = "مستخدم";
        let counterpartId = null;
        let counterpartAvatar = null;
        let counterpartIsVerified = false;
        let counterpartIsOnline = false;
        let counterpartLastSeen = null;

        if (c.type === "DISPUTE" && c.title) {
          counterpartName = c.title;
        } else if (counterpart && typeof counterpart === "object") {
          counterpartId = counterpart._id;
          counterpartName = counterpart.name || "مستخدم";
          counterpartAvatar = counterpart.avatar;
          counterpartIsVerified = !!counterpart.isVerifiedSeller;
          counterpartIsOnline = !!counterpart.isOnline;
          counterpartLastSeen = counterpart.lastSeen;
        }

        const muted = Array.isArray(c.mutedFor) ? !!c.mutedFor.find((u) => String(u) === String(req.user.id)) : false;
        const isPinned = Array.isArray(c.pinnedBy) ? !!c.pinnedBy.find((u) => String(u) === String(req.user.id)) : false;
        
        return { 
          ...c, 
          unreadCount: countMap[c._id.toString()] || 0, 
          counterpartName, 
          counterpartId, 
          counterpartAvatar,
          counterpartIsVerified, 
          counterpartIsOnline, 
          counterpartLastSeen, 
          muted,
          isPinned
        };
      } catch (itemErr) {
        console.error("Error processing conversation item:", itemErr);
        return { ...c, unreadCount: 0, counterpartName: "مستخدم", counterpartId: null };
      }
    });

    const sortedList = withUnread.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    res.json(sortedList);
  } catch (error) {
    console.error("List conversations error:", error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

router.post("/open", auth, async (req, res) => {
  try {
    const { adId, participantId } = req.body;
    if (!adId) return res.status(400).json({ error: "adId required" });
    
    let ad = await Ad.findById(adId).lean();
    let adModel = "Ad";
    let sellerId = null;

    if (!ad) {
      const resellAd = await ResellAd.findById(adId).lean();
      if (resellAd) {
        ad = resellAd;
        adModel = "ResellAd";
        sellerId = resellAd.resellerId;
      }
    } else {
      sellerId = ad.userId;
    }

    if (!ad) {
      return res.status(400).json({ error: "الإعلان غير موجود" });
    }

    // السماح بفتح المحادثة حتى لو الإعلان غير نشط في حال كان هناك طرف محدد (سياق طلب شراء)
    if (!participantId && ad.status !== "active" && ad.status !== "approved") {
      return res.status(400).json({ error: "هذا الإعلان غير متاح للمراسلة حالياً" });
    }

    const currentUserId = req.user.id;
    let buyerId, targetSellerId;

    // Logic: If participantId is provided (e.g. from Order context)
    if (participantId) {
      // Find conversation between current user and the provided participant
      buyerId = currentUserId;
      targetSellerId = participantId;
      
      // We must ensure the order of participants doesn't matter for the search
      // The model uses participants: [buyerId, sellerId] but we use $all
    } else {
      // Default behavior (from ProductDetail): requester is buyer, ad owner is seller
      buyerId = currentUserId;
      targetSellerId = sellerId;

      if (String(targetSellerId) === String(buyerId)) {
        return res.status(400).json({ error: "Cannot message own ad" });
      }
    }
    
    const blocked = await Block.findOne({ 
      $or: [
        { blockerId: targetSellerId, blockedId: buyerId }, 
        { blockerId: buyerId, blockedId: targetSellerId }
      ] 
    }).lean();
    
    if (blocked) return res.status(403).json({ error: "تم الحظر" });
    
    let conv = await Conversation.findOne({ 
      adId, 
      adModel, 
      participants: { $all: [buyerId, targetSellerId] } 
    });

    if (!conv) {
      conv = await Conversation.create({ 
        adId, 
        adModel, 
        participants: [buyerId, targetSellerId], 
        lastMessage: "" 
      });

      // زيادة عداد المتواصلين في الإعلان عند فتح أول محادثة بين المشتري والبائع لهذا الإعلان
      try {
        if (adModel === "Ad") {
          await Ad.findByIdAndUpdate(adId, { $inc: { contactsCount: 1 } });
        } else if (adModel === "ResellAd") {
          // إذا كان إعلان إعادة بيع، نزيد العداد في الإعلان الأصلي أيضاً إذا وجد
          const resellAd = await ResellAd.findById(adId).select("originalAdId").lean();
          if (resellAd && resellAd.originalAdId) {
            await Ad.findByIdAndUpdate(resellAd.originalAdId, { $inc: { contactsCount: 1 } });
          }
        }
      } catch (incErr) {
        console.error("Error incrementing contactsCount:", incErr);
      }
    } else {
      if (conv.deletedBy && conv.deletedBy.find(u => String(u) === String(req.user.id))) {
        conv.deletedBy = conv.deletedBy.filter(u => String(u) !== String(req.user.id));
        await conv.save();
      }
    }
    res.json(conv);
  } catch (error) {
    console.error("Open conversation error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/unread-count", auth, async (req, res) => {
  try {
    const convs = await Conversation.find({ 
      participants: req.user.id,
      deletedBy: { $ne: req.user.id },
      isDeletedByAdmin: { $ne: true }
    }).select("_id").lean();
    const ids = convs.map((c) => c._id);
    if (ids.length === 0) return res.json({ count: 0 });
    const count = await ConversationMessage.countDocuments({
      conversationId: { $in: ids },
      status: { $ne: "read" },
      senderId: { $ne: req.user.id },
      deletedBy: { $ne: req.user.id },
      isDeleted: { $ne: true }
    });
    res.json({ count });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/:id/messages", auth, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id).lean();
    if (!conv) return res.status(404).json({ error: "Not found" });
    if (!conv.participants.find((p) => String(p) === String(req.user.id))) return res.status(403).json({ error: "Forbidden" });
    
    // Filter out messages deleted by the user
    const msgs = await ConversationMessage.find({ 
      conversationId: conv._id,
      deletedBy: { $ne: req.user.id },
      isDeleted: { $ne: true }
    }).sort({ createdAt: 1 }).populate("senderId", "name avatar role").lean();
    
    res.json(msgs);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/:id/messages", auth, rateLimit({ windowMs: 10_000, max: 5 }), uploadImages.array("images", 5), async (req, res) => {
  try {
    const { text } = req.body || {};
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: "Not found" });
    if (!conv.participants.find((p) => String(p) === String(req.user.id))) return res.status(403).json({ error: "Forbidden" });
    const counterpart = conv.participants.find((p) => String(p) !== String(req.user.id));
    const blocked = await Block.findOne({ blockerId: counterpart, blockedId: req.user.id }).lean();
    if (blocked) return res.status(403).json({ error: "لا يمكنك مراسلة هذا المستخدم" });
    const filenames = (req.files || []).map((f) => f.filename);
    if (!filenames.length && (!text || !String(text).trim())) return res.status(400).json({ error: "Empty message" });
    const msg = await ConversationMessage.create({
      conversationId: conv._id,
      senderId: req.user.id,
      text: text ? String(text).trim() : "",
      images: filenames.length ? filenames : [],
      status: "sent"
    });
    conv.lastMessage = msg.text;
    // Remove both participants from deletedBy when a new message is sent
    conv.deletedBy = []; 
    await conv.save();
    // Notify all other participants
    for (const participant of conv.participants) {
      if (String(participant) === String(req.user.id)) continue;
      
      try {
        const muted = (conv.mutedFor || []).find((u) => String(u) === String(participant));
        if (!muted) {
          await createNotification(req.app, {
            userId: participant,
            type: "message",
            title: "رسالة جديدة",
            body: msg.text || "صورة جديدة",
            data: { conversationId: conv._id, adId: conv.adId }
          });
        }
      } catch (err) {
        console.error("Error sending message notification:", err);
      }

      try {
        const io = req.app.get("io");
        if (io) {
          io.to(`user:${participant}`).emit("conversation:new_message", { conversationId: String(conv._id), message: { ...msg.toObject(), createdAt: new Date().toISOString() } });
        }
      } catch {}
    }

    try {
      const io = req.app.get("io");
      if (io) {
        io.to(`conv:${conv._id}`).emit("conversation:new_message", { conversationId: String(conv._id), message: { ...msg.toObject(), createdAt: new Date().toISOString() } });
      }
    } catch {}
    res.status(201).json(msg);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/:id/read", auth, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id).lean();
    if (!conv) return res.status(404).json({ error: "Not found" });
    if (!conv.participants.find((p) => String(p) === String(req.user.id))) return res.status(403).json({ error: "Forbidden" });
    await ConversationMessage.updateMany(
      { conversationId: conv._id, status: { $ne: "read" }, senderId: { $ne: req.user.id } },
      { $set: { status: "read" } }
    );
    try {
      const io = req.app.get("io");
      if (io) {
        // Notify all other participants that messages were read
        for (const participant of conv.participants) {
          if (String(participant) === String(req.user.id)) continue;
          io.to(`user:${participant}`).emit("conversation:read", { conversationId: String(conv._id) });
        }
      }
    } catch {}
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/:id/mute", auth, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: "Not found" });
    if (!conv.participants.find((p) => String(p) === String(req.user.id))) return res.status(403).json({ error: "Forbidden" });
    
    const mutedFor = conv.mutedFor || [];
    if (!mutedFor.find(u => String(u) === String(req.user.id))) {
      conv.mutedFor = [...mutedFor, req.user.id];
      await conv.save();
    }
    res.json({ muted: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/:id/unmute", auth, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: "Not found" });
    if (!conv.participants.find((p) => String(p) === String(req.user.id))) return res.status(403).json({ error: "Forbidden" });
    
    conv.mutedFor = (conv.mutedFor || []).filter(u => String(u) !== String(req.user.id));
    await conv.save();
    res.json({ muted: false });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/:id/close", auth, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id).populate("adId");
    if (!conv) return res.status(404).json({ error: "المحادثة غير موجودة" });
    
    // Only the seller (ad owner) can close the conversation
    if (String(conv.adId.userId) !== String(req.user.id)) {
      return res.status(403).json({ error: "غير مصرح لك بإغلاق هذه المحادثة" });
    }

    conv.isClosed = true;
    conv.closedAt = new Date();
    await conv.save();

    const buyerId = conv.participants.find(p => String(p) !== String(req.user.id));
    
    // استخدام السعر من قاعدة البيانات حصراً لمنع التلاعب بالعمولات
    const salePrice = Number(conv.adId.price) || 0;
    const currency = conv.adId.currency || "YER_ADEN";

    // Mark the ad as sold to this buyer (Manual Sale)
    try {
      await Ad.findByIdAndUpdate(conv.adId._id, {
        sold: true,
        status: "sold",
        soldAt: new Date(),
        buyerId: buyerId,
        buyerType: "DIRECT"
      });

      // Create Commission record
      const CommissionModel = mongoose.model("Commission");
      const SoldListing = mongoose.model("SoldListing");
      
      const commissionAmount = Math.round(salePrice * 0.01);
      
      const commission = await CommissionModel.create({
        adId: conv.adId._id,
        sellerId: req.user.id,
        price: salePrice,
        currency: currency,
        commissionAmount: commissionAmount,
        status: "unpaid",
        commissionStatus: "pending_payment",
        soldAt: new Date(),
      });

      // Create SoldListing snapshot
      await SoldListing.create({
        adId: conv.adId._id,
        sellerId: req.user.id,
        buyerId: buyerId,
        title: conv.adId.title,
        price: salePrice,
        currency: currency,
        images: conv.adId.images || [],
        commissionId: commission._id,
        commissionAmount: commissionAmount,
        commissionStatus: commission.status,
        soldAt: new Date(),
        buyerType: "DIRECT"
      });

    } catch (adErr) {
      console.error("Error updating ad status and creating commission on conversation close:", adErr);
    }

    // Notify the buyer that they can now review the seller
    try {
      const seller = await User.findById(req.user.id).select("name").lean();
      await createNotification(req.app, {
        userId: buyerId,
        type: "ad_status",
        title: "تم إتمام عملية البيع",
        body: `لقد قام ${seller?.name || "البائع"} بتحديدك كمشتري لإعلان "${conv.adId.title}". يمكنك الآن تقييم تجربتك معه.`,
        data: { adId: conv.adId._id, conversationId: conv._id }
      });
    } catch (notifErr) {
      console.error("Error sending manual sale notification:", notifErr);
    }

    // Notify both parties via a system message
    const msg = await ConversationMessage.create({
      conversationId: conv._id,
      senderId: req.user.id,
      text: `تم إغلاق المحادثة لأن السلعة تم بيعها بمبلغ ${salePrice} ${currency}.`,
      status: "sent"
    });

    try {
      const io = req.app.get("io");
      const recipient = conv.participants.find((p) => String(p) !== String(req.user.id));
      if (io) {
        io.to(`conv:${conv._id}`).emit("conversation:closed", { conversationId: String(conv._id) });
        io.to(`conv:${conv._id}`).emit("conversation:new_message", { 
          conversationId: String(conv._id), 
          message: { ...msg.toObject(), createdAt: new Date().toISOString() } 
        });
        if (recipient) {
          io.to(`user:${recipient}`).emit("conversation:new_message", { 
            conversationId: String(conv._id), 
            message: { ...msg.toObject(), createdAt: new Date().toISOString() } 
          });
        }
      }
    } catch {}

    res.json({ ok: true });
  } catch (error) {
    console.error("Close conversation error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/:id/pin", auth, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: "المحادثة غير موجودة" });
    if (!conv.participants.find((p) => String(p) === String(req.user.id))) return res.status(403).json({ error: "غير مصرح لك" });
    
    const pinnedBy = conv.pinnedBy || [];
    if (!pinnedBy.find(u => String(u) === String(req.user.id))) {
      conv.pinnedBy = [...pinnedBy, req.user.id];
      await conv.save();
    }
    res.json({ isPinned: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/:id/unpin", auth, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: "المحادثة غير موجودة" });
    if (!conv.participants.find((p) => String(p) === String(req.user.id))) return res.status(403).json({ error: "غير مصرح لك" });
    
    conv.pinnedBy = (conv.pinnedBy || []).filter(u => String(u) !== String(req.user.id));
    await conv.save();
    res.json({ isPinned: false });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: "المحادثة غير موجودة" });
    if (!conv.participants.find((p) => String(p) === String(req.user.id))) return res.status(403).json({ error: "غير مصرح لك" });
    
    // Add user to deletedBy instead of actual deletion to hide it for this user
    const deletedBy = conv.deletedBy || [];
    if (!deletedBy.find(u => String(u) === String(req.user.id))) {
      conv.deletedBy = [...deletedBy, req.user.id];
      await conv.save();
    }

    // Also mark all current messages as deleted for this user
    await ConversationMessage.updateMany(
      { conversationId: conv._id, deletedBy: { $ne: req.user.id } },
      { $push: { deletedBy: req.user.id } }
    );

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:id/messages/:messageId", auth, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: "المحادثة غير موجودة" });
    if (!conv.participants.find((p) => String(p) === String(req.user.id))) return res.status(403).json({ error: "غير مصرح لك" });
    
    const msg = await ConversationMessage.findOne({ _id: req.params.messageId, conversationId: conv._id });
    if (!msg) return res.status(404).json({ error: "الرسالة غير موجودة" });

    const deletedBy = msg.deletedBy || [];
    if (!deletedBy.find(u => String(u) === String(req.user.id))) {
      msg.deletedBy = [...deletedBy, req.user.id];
      await msg.save();
    }
    
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/admin/trash", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const p = Math.max(1, parseInt(page));
    const l = Math.max(1, Math.min(100, parseInt(limit)));

    const [items, total] = await Promise.all([
      Conversation.find({ isDeletedByAdmin: true, isPermanentlyDeleted: false })
        .populate("participants", "name avatar")
        .sort({ deletedByAdminAt: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .lean(),
      Conversation.countDocuments({ isDeletedByAdmin: true, isPermanentlyDeleted: false })
    ]);

    res.json({ items, total, pages: Math.ceil(total / l) });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/:id/admin-trash", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: "المحادثة غير موجودة" });
    if (conv.isDeletedByAdmin) return res.status(400).json({ error: "المحادثة موجودة في سلة المهملات بالفعل" });
    
    conv.isDeletedByAdmin = true;
    conv.deletedByAdminAt = new Date();
    conv.deletedByAdminId = req.user.id;
    await conv.save();
    
    res.json({ ok: true, message: "تم نقل المحادثة إلى سلة المهملات" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/:id/admin-restore", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: "المحادثة غير موجودة" });
    if (!conv.isDeletedByAdmin) return res.status(400).json({ error: "المحادثة ليست في سلة المهملات" });
    
    conv.isDeletedByAdmin = false;
    conv.deletedByAdminAt = null;
    conv.deletedByAdminId = null;
    await conv.save();
    
    res.json({ ok: true, message: "تم استعادة المحادثة بنجاح" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:id/admin-permanent", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: "المحادثة غير موجودة" });
    
    await ConversationMessage.deleteMany({ conversationId: conv._id });
    await Conversation.findByIdAndDelete(conv._id);
    
    res.json({ ok: true, message: "تم حذف المحادثة نهائياً" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
