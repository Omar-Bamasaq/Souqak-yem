import { Router } from "express";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import AdminMessage from "../models/AdminMessage.js";
import User from "../models/User.js";
import adminAudit from "../middleware/adminAudit.js";
import { createNotification } from "../services/notificationService.js";

const router = Router();

/**
 * ADMIN ROUTES
 */

// Send a new admin message (broadcast or specific)
router.post("/", auth, requireRole(["admin"]), adminAudit(), async (req, res) => {
  try {
    const { targetType, recipients, title, content, isPinned } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required" });
    }

    if (targetType === "specific" && (!recipients || !Array.isArray(recipients) || recipients.length === 0)) {
      return res.status(400).json({ error: "Recipients are required for specific targeting" });
    }

    const newMessage = await AdminMessage.create({
      senderId: req.user.id,
      targetType: targetType || "all",
      recipients: targetType === "specific" ? recipients : [],
      title,
      content,
      isPinned: isPinned !== undefined ? isPinned : true
    });

    const recipientQuery = targetType === "specific"
      ? { _id: { $in: recipients } }
      : {};
    const users = await User.find(recipientQuery).select("_id").lean();

    await Promise.allSettled(users.map((user) => createNotification(req.app, {
      userId: user._id,
      type: "admin_message",
      title,
      body: content,
      data: {
        adminMessageId: newMessage._id,
        url: "/messages"
      },
      push: true,
      email: false
    })));

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error sending admin message:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get all admin messages (for admin dashboard list)
router.get("/admin/list", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const messages = await AdminMessage.find()
      .populate("senderId", "name email")
      .populate("recipients", "name email phone")
      .sort({ createdAt: -1 })
      .lean();
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Delete an admin message
router.delete("/:id", auth, requireRole(["admin"]), adminAudit(), async (req, res) => {
  try {
    await AdminMessage.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Search users for messaging
router.get("/users/search", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);

    const users = await User.find({
      $or: [
        { name: { $regex: String(q), $options: "i" } },
        { email: { $regex: String(q), $options: "i" } },
        { phone: { $regex: String(q), $options: "i" } }
      ]
    })
    .select("name email phone")
    .limit(10)
    .lean();

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * USER ROUTES
 */

// Get admin messages for the current user
router.get("/my-messages", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find messages that are either "all" or specific to this user
    const messages = await AdminMessage.find({
      $or: [
        { targetType: "all" },
        { recipients: userId }
      ]
    })
    .sort({ isPinned: -1, createdAt: -1 })
    .lean();

    // Add "isRead" flag based on readBy array
    const result = messages.map(m => ({
      ...m,
      isRead: m.readBy?.some(id => id.toString() === userId.toString()) || false
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Mark an admin message as read
router.post("/:id/read", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    await AdminMessage.findByIdAndUpdate(req.params.id, {
      $addToSet: { readBy: userId }
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
