import { Router } from "express";
import Product from "../models/Product.js";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import { uploadImages } from "../middleware/upload.js";
import Comment from "../models/Comment.js";
import City from "../models/City.js";

const router = Router();

router.post(
  "/",
  auth,
  requireRole(["seller"]),
  uploadImages.array("images", 10),
  async (req, res) => {
    try {
      const origin = req.get("origin") || "";
      const isDev = (process.env.NODE_ENV || "").toLowerCase() === "development";
      const isLocal =
        origin.includes("localhost") ||
        req.hostname === "localhost" ||
        req.hostname === "127.0.0.1";
      const allowUnverified = isDev || isLocal || req.user.role === "admin";
      if (!allowUnverified && !req.user.isPhoneVerified) {
        return res.status(403).json({ error: "Phone not verified" });
      }
      const { title, description, price, category, governorateId, cityId } = req.body;
      if (!title || !description || !price) return res.status(400).json({ error: "Missing fields" });
      if (!governorateId || !cityId) return res.status(400).json({ error: "Governorate and city required" });
      const categoryName = (category && String(category).trim()) || "";
      if (!categoryName) return res.status(400).json({ error: "Missing category name" });
      const city = await City.findById(cityId).lean();
      if (!city) return res.status(400).json({ error: "Invalid city" });
      if (String(city.governorateId) !== String(governorateId)) {
        return res.status(400).json({ error: "City does not belong to governorate" });
      }
      let attributesObj = undefined;
      if (req.body.attributes) {
        try {
          const parsed = typeof req.body.attributes === "string" ? JSON.parse(req.body.attributes) : req.body.attributes;
          if (parsed && typeof parsed === "object") {
            attributesObj = parsed;
          }
        } catch {}
      }
      const filenames = (req.files || []).map((f) => f.filename);
      const product = await Product.create({
        seller: req.user.id,
        title,
        description,
        price,
        category: categoryName,
        governorateId: governorateId || undefined,
        cityId: cityId || undefined,
        attributes: attributesObj,
        images: filenames,
        status: "pending"
      });
      res.status(201).json(product);
    } catch (err) {
      res.status(400).json({ error: err && err.message ? err.message : "Upload error" });
    }
  }
);

router.get("/", async (req, res) => {
  try {
    const { category, q, governorateId, cityId } = req.query;
    const filter = { status: "approved" };
    if (category) filter.category = category;
    if (governorateId) filter.governorateId = governorateId;
    if (cityId) filter.cityId = cityId;
    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } }
      ];
    }
    const products = await Product.find(filter)
      .populate("governorateId", "name")
      .populate("cityId", "name")
      .sort({ isFeatured: -1, createdAt: -1 })
      .lean();
    res.json(products);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/mine", auth, requireRole(["seller"]), async (req, res) => {
  try {
    const products = await Product.find({ seller: req.user.id })
      .populate("governorateId", "name")
      .populate("cityId", "name")
      .sort({ createdAt: -1 })
      .lean();
    res.json(products);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const p = await Product.findById(req.params.id)
      .populate("governorateId", "name")
      .populate("cityId", "name")
      .lean();
    if (!p) return res.status(404).json({ error: "Not found" });
    if (p.status !== "approved") return res.status(404).json({ error: "Not found" });
    res.json(p);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/:id/comments", async (req, res) => {
  try {
    const p = await Product.findById(req.params.id).lean();
    if (!p || p.status !== "approved") return res.status(404).json({ error: "Not found" });
    const comments = await Comment.find({ product: req.params.id }).populate("user", "name").sort({ createdAt: -1 }).lean();
    res.json(comments);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/:id/comments", auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !String(text).trim()) return res.status(400).json({ error: "Text required" });
    const p = await Product.findById(req.params.id).lean();
    if (!p || p.status !== "approved") return res.status(404).json({ error: "Not found" });
    const c = await Comment.create({ product: req.params.id, user: req.user.id, text: String(text).trim() });
    const populated = await Comment.findById(c._id).populate("user", "name").lean();
    res.status(201).json(populated);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/:id/unfeature", auth, requireRole(["seller"]), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Not found" });
    if (product.seller.toString() !== req.user.id) return res.status(403).json({ error: "Forbidden" });
    if (!product.isFeatured) return res.json(await Product.findById(req.params.id).lean());
    product.isFeatured = false;
    product.featuredUntil = undefined;
    await product.save();
    const updated = await Product.findById(req.params.id).lean();
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
