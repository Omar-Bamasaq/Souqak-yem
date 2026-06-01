import { Router } from "express";
import Tag from "../models/Tag.js";
import Ad from "../models/Ad.js";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";

const router = Router();

// Get all tags (public)
router.get("/", async (req, res) => {
  try {
    const { categoryId, popular } = req.query;
    let query = {};
    
    if (categoryId) {
      query.categoryIds = categoryId;
    }
    
    if (popular === "true") {
      query.isPopular = true;
    }
    
    const tags = await Tag.find(query).sort({ order: 1, name: 1 });
    res.json(tags);
  } catch (err) {
    console.error("Tags GET error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch tags" });
  }
});

// Get single tag by slug
router.get("/:slug", async (req, res) => {
  try {
    const tag = await Tag.findOne({ slug: req.params.slug });
    if (!tag) return res.status(404).json({ error: "Tag not found" });
    res.json(tag);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch tag" });
  }
});

// Get ads by tag
router.get("/:slug/ads", async (req, res) => {
  try {
    const tag = await Tag.findOne({ slug: req.params.slug });
    if (!tag) return res.status(404).json({ error: "Tag not found" });
    
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    
    const ads = await Ad.find({ 
      tags: tag._id,
      status: "approved",
      isArchived: false,
      sold: false
    })
      .populate("userId", "name")
      .populate("governorateId", "name")
      .populate("cityId", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
    
    const total = await Ad.countDocuments({
      tags: tag._id,
      status: "approved",
      isArchived: false,
      sold: false
    });
    
    res.json({
      items: ads,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      total
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch ads by tag" });
  }
});

// Create tag (admin only)
router.post("/", auth, requireRole("admin"), async (req, res) => {
  try {
    const { name, slug, description, icon, color, categoryIds, isPopular, order } = req.body;
    
    const tag = new Tag({
      name,
      slug,
      description,
      icon,
      color,
      categoryIds,
      isPopular,
      order
    });
    
    await tag.save();
    res.status(201).json(tag);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: "Tag slug already exists" });
    }
    res.status(500).json({ error: "Failed to create tag" });
  }
});

// Update tag (admin only)
router.patch("/:id", auth, requireRole("admin"), async (req, res) => {
  try {
    const tag = await Tag.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    
    if (!tag) return res.status(404).json({ error: "Tag not found" });
    res.json(tag);
  } catch (err) {
    res.status(500).json({ error: "Failed to update tag" });
  }
});

// Delete tag (admin only)
router.delete("/:id", auth, requireRole("admin"), async (req, res) => {
  try {
    const tag = await Tag.findByIdAndDelete(req.params.id);
    if (!tag) return res.status(404).json({ error: "Tag not found" });
    
    // Remove tag from ads
    await Ad.updateMany(
      { tags: tag._id },
      { $pull: { tags: tag._id, tagNames: tag.name } }
    );
    
    res.json({ message: "Tag deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete tag" });
  }
});

export default router;
