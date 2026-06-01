import { Router } from "express";
import auth from "../middleware/auth.js";
import Chat from "../models/Chat.js";
import Product from "../models/Product.js";

const router = Router();

router.get("/:productId", auth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId).lean();
    if (!product || product.status !== "approved") return res.status(404).json({ error: "Not found" });
    const isSeller = product.seller.toString() === req.user.id;
    const isBuyer = req.user.role === "buyer";
    if (!isSeller && !isBuyer) return res.status(403).json({ error: "Forbidden" });
    let chat;
    if (isBuyer) {
      chat = await Chat.findOne({ product: product._id, buyer: req.user.id }).lean();
    } else if (isSeller) {
      chat = await Chat.findOne({ product: product._id, seller: req.user.id }).lean();
    }
    if (!chat && isBuyer) {
      chat = await Chat.create({ product: product._id, buyer: req.user.id, seller: product.seller, messages: [] });
      chat = chat.toObject();
    }
    if (!chat && isSeller) return res.status(404).json({ error: "No chat yet" });
    res.json(chat);
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/:productId", auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Text required" });
    const product = await Product.findById(req.params.productId).lean();
    if (!product || product.status !== "approved") return res.status(404).json({ error: "Not found" });
    const isSeller = product.seller.toString() === req.user.id;
    const isBuyer = req.user.role === "buyer";
    if (!isSeller && !isBuyer) return res.status(403).json({ error: "Forbidden" });
    let chat;
    if (isBuyer) {
      chat = await Chat.findOne({ product: product._id, buyer: req.user.id });
    } else if (isSeller) {
      chat = await Chat.findOne({ product: product._id, seller: req.user.id });
    }
    if (!chat && isSeller) return res.status(400).json({ error: "Seller cannot start chat" });
    if (!chat && isBuyer) {
      chat = await Chat.create({ product: product._id, buyer: req.user.id, seller: product.seller, messages: [] });
    }
    chat.messages.push({ sender: req.user.id, text, createdAt: new Date() });
    await chat.save();
    const io = req.app.get("io");
    if (io) io.to(`chat:${req.params.productId}`).emit("chat:new_message", { productId: req.params.productId, message: { sender: req.user.id, text, createdAt: new Date().toISOString() } });
    res.status(201).json({ ok: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
