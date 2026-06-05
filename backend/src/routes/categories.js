import express from "express";
import mongoose from "mongoose";
import Category from "../models/Category.js";
import CategoryAttribute from "../models/CategoryAttribute.js";
import Ad from "../models/Ad.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import ImageUploadService from "../services/imageUploadService.js";
import CategoryService from "../services/categoryService.js";
import Joi from "joi";
import { validateQuery } from "../middleware/validate.js";

const router = express.Router();

const categoriesQuerySchema = Joi.object({
  flat: Joi.string().valid("true", "false").optional(),
  parent: Joi.string().allow("null", "").optional(),
  admin: Joi.string().valid("true", "false").optional(),
  adType: Joi.string().valid("sell", "order").optional()
}).unknown(false);

const uploadCategoryImage = ImageUploadService.getUploadMiddleware();

const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u0600-\u06FF-]+/g, "")
    .replace(/--+/g, "-");
};

const generateUniqueSlug = async (name, existingId = null) => {
  let baseSlug = slugify(name);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const query = { slug };
    if (existingId) query._id = { $ne: existingId };

    const existing = await Category.findOne(query);
    if (!existing) return slug;

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
};

router.get("/", validateQuery(categoriesQuerySchema), async (req, res) => {
  try {
    const { flat, parent, admin, adType } = req.query;
    console.log("Categories API called with:", { flat, parent, admin, adType });

    if (admin === "true") {
      const categories = await Category.find()
        .sort({ sortOrder: 1, name: 1 })
        .lean();
      console.log("Admin categories count:", categories.length);
      return res.json(categories.map(c => ({ ...c, id: c._id })));
    }

    if (flat === "true") {
      const filter = { status: "active" };
      if (parent !== undefined) {
        // Handle both string "null" and actual null/empty values
        filter.parentId = (parent === "null" || parent === "" || parent == null) ? null : parent;
      }

      const categories = await Category.find(filter)
        .sort({ sortOrder: 1, name: 1 })
        .lean();
      
      // Get all categories to build children map
      const allCategories = await Category.find({ status: "active" }).select("_id parentId").lean();
      const childrenMap = {};
      allCategories.forEach(cat => {
        if (cat.parentId) {
          const parentId = String(cat.parentId);
          if (!childrenMap[parentId]) childrenMap[parentId] = [];
          childrenMap[parentId].push(String(cat._id));
        }
      });

      // Get ad counts
      const adFilter = {
        status: "approved",
        isArchived: { $ne: true },
        sold: { $ne: true },
      };
      if (adType) adFilter.adType = adType;

      const adCounts = await Ad.aggregate([
        { $match: adFilter },
        { 
          $addFields: { 
            categoryIdStr: { $toString: "$categoryId" } 
          } 
        },
        { $group: { _id: "$categoryIdStr", count: { $sum: 1 } } },
      ]);
      const countMap = {};
      adCounts.forEach(item => {
        if (item._id) countMap[String(item._id)] = item.count;
      });

      // Calculate total count including children recursively
      const getTotalCount = (catId, visited = new Set()) => {
        if (visited.has(catId)) return 0;
        visited.add(catId);
        const catIdStr = String(catId);
        let total = countMap[catIdStr] || 0;
        const children = childrenMap[catIdStr] || [];
        for (const childId of children) {
          total += getTotalCount(childId, visited);
        }
        return total;
      };

      const categoriesWithCount = categories.map(c => ({
        ...c,
        id: c._id,
        adCount: getTotalCount(String(c._id))
      }));
      
      console.log("Flat categories count:", categories.length, "filter:", filter);
      return res.json(categoriesWithCount);
    }

    const tree = await CategoryService.buildTree();
    console.log("Tree categories count:", tree.length);
    res.json(tree);
  } catch (error) {
    console.error("Categories API error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/tree", async (req, res) => {
  try {
    const tree = await CategoryService.buildTree();
    res.json(tree);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /categories/main - returns only main categories
router.get("/main", async (req, res) => {
  try {
    const { adType } = req.query;
    const categories = await CategoryService.getMainCategories(adType);
    res.json(categories);
  } catch (error) {
    console.error("Categories main error:", error);
    res.status(500).json({ error: error.message || "Server error" });
  }
});

// GET /categories/:id/children - returns subcategories
router.get("/:id/children", async (req, res) => {
  try {
    const { id } = req.params;
    const { adType } = req.query;
    
    // Validate category exists
    const category = await Category.findById(id).lean();
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    const children = await CategoryService.getSubcategories(id, adType);
    res.json(children);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const allCategories = await Category.find({ status: "active" })
      .select("name slug image adCount parentId")
      .lean();

    // Build a map of parent -> children
    const childrenMap = {};
    allCategories.forEach(cat => {
      if (cat.parentId) {
        const parentId = String(cat.parentId);
        if (!childrenMap[parentId]) childrenMap[parentId] = [];
        childrenMap[parentId].push(String(cat._id));
      }
    });

    // Get all actual ad counts per category from database
    const adCounts = await Ad.aggregate([
      { $match: { status: "approved", isArchived: { $ne: true }, sold: { $ne: true } } },
      { $group: { _id: "$categoryId", count: { $sum: 1 } } }
    ]);

    // Create a map of categoryId -> count
    const countMap = {};
    adCounts.forEach(item => {
      if (item._id) {
        countMap[String(item._id)] = item.count;
      }
    });

    // Function to get total count including children
    const getTotalCount = (catId, visited = new Set()) => {
      if (visited.has(catId)) return 0;
      visited.add(catId);
      
      let total = countMap[catId] || 0;
      const children = childrenMap[catId] || [];
      for (const childId of children) {
        total += getTotalCount(childId, visited);
      }
      return total;
    };

    // Update categories with calculated ad counts (including subcategories)
    const categoriesWithCounts = allCategories.map(cat => ({
      ...cat,
      adCount: getTotalCount(String(cat._id))
    }));

    const totalAds = Object.values(countMap).reduce((sum, count) => sum + count, 0);

    res.json({
      totalCategories: allCategories.length,
      mainCategories: allCategories.filter(c => !c.parentId).length,
      subCategories: allCategories.filter(c => c.parentId).length,
      totalAds: totalAds,
      categoryStats: categoriesWithCounts.sort((a, b) => (b.adCount || 0) - (a.adCount || 0))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/breadcrumbs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const breadcrumbs = await CategoryService.getBreadcrumbs(id);
    res.json(breadcrumbs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const { adType } = req.query;
    console.log("Looking up category by slug:", slug, "decoded:", decodeURIComponent(slug));
    
    // Try to find by slug (case-insensitive)
    const category = await Category.findOne({ 
      slug: { $regex: new RegExp('^' + slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') },
      status: "active" 
    }).lean();

    if (!category) {
      console.log("Category not found for slug:", slug);
      return res.status(404).json({ error: "Category not found" });
    }
    
    console.log("Found category:", category.name, "with id:", category._id);

    const children = await CategoryService.getSubcategories(category._id, adType);

    res.json({
      ...category,
      id: category._id,
      children: children.map(c => ({ ...c, id: c._id }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/", authenticate, requireAdmin, uploadCategoryImage.single("image"), async (req, res) => {
  try {
    const { name, description, parentId, sortOrder, status } = req.body;

    // Validate using service
    const errors = await CategoryService.validateCategory({ name, parentId });
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(", ") });
    }

    const slug = await generateUniqueSlug(name);

    let imageUrl = null;
    if (req.file) {
      const validated = await ImageUploadService.validateUploadedFile(req.file);
      imageUrl = validated.url;
    }

    const category = new Category({
      name,
      slug,
      description,
      parentId: parentId || null,
      sortOrder: sortOrder || 0,
      status: status || "active",
      image: imageUrl
    });

    await category.save();
    
    // Invalidate cache
    CategoryService.invalidateCache();
    
    res.status(201).json({ ...category.toObject(), id: category._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/:id", authenticate, requireAdmin, uploadCategoryImage.single("image"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, parentId, sortOrder, status } = req.body;
    console.log("Updating category:", id, "Body:", req.body, "File:", req.file ? req.file.filename : "no file");

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    // Validate using service
    const errors = await CategoryService.validateCategory({ name, parentId }, id);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(", ") });
    }

    if (name && name !== category.name) {
      category.slug = await generateUniqueSlug(name, id);
      category.name = name;
    }

    if (description !== undefined) category.description = description;
    if (parentId !== undefined) category.parentId = parentId || null;
    if (sortOrder !== undefined) category.sortOrder = sortOrder;
    if (status !== undefined) category.status = status;

    if (req.file) {
      console.log("Processing new image upload:", req.file.filename);
      // Delete old image if exists
      if (category.image) {
        try {
          const oldFilename = category.image.split('/').pop();
          console.log("Deleting old image:", oldFilename);
          await ImageUploadService.deleteFile(oldFilename);
        } catch (deleteError) {
          console.log("Could not delete old image:", deleteError.message);
          // Continue even if delete fails
        }
      }
      const validated = await ImageUploadService.validateUploadedFile(req.file);
      console.log("Image validated:", validated.url);
      category.image = validated.url;
    }

    await category.save();
    
    // Invalidate cache
    CategoryService.invalidateCache();
    
    res.json({ ...category.toObject(), id: category._id });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { moveAdsTo, moveChildrenTo } = req.body;

    const result = await CategoryService.deleteCategory(id, { moveAdsTo, moveChildrenTo });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/:id/move-ads", authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { targetCategoryId } = req.body;

    if (!targetCategoryId) {
      return res.status(400).json({ error: "Target category ID is required" });
    }

    const sourceExists = await Category.exists({ _id: id });
    const targetExists = await Category.exists({ _id: targetCategoryId });

    if (!sourceExists) {
      return res.status(404).json({ error: "Source category not found" });
    }
    if (!targetExists) {
      return res.status(404).json({ error: "Target category not found" });
    }

    const result = await Ad.updateMany(
      { categoryId: id },
      { categoryId: targetCategoryId }
    );

    await CategoryService.updateAdCount(id);
    await CategoryService.updateAdCount(targetCategoryId);

    res.json({
      message: "Ads moved successfully",
      movedCount: result.modifiedCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/reorder", authenticate, requireAdmin, async (req, res) => {
  try {
    const { categories } = req.body;

    if (!Array.isArray(categories)) {
      return res.status(400).json({ error: "Categories array is required" });
    }

    const bulkOps = categories.map((cat, index) => ({
      updateOne: {
        filter: { _id: cat.id },
        update: { sortOrder: index, parentId: cat.parentId || null }
      }
    }));

    await Category.bulkWrite(bulkOps);
    
    // Invalidate cache
    CategoryService.invalidateCache();
    
    res.json({ message: "Categories reordered successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/refresh-stats", authenticate, requireAdmin, async (req, res) => {
  try {
    const categories = await Category.find();

    for (const cat of categories) {
      await CategoryService.updateAdCount(cat._id);
    }

    // Invalidate cache
    CategoryService.invalidateCache();

    res.json({ message: "Category stats refreshed successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id/attributes", async (req, res) => {
  try {
    const { id } = req.params;
    const { includeAncestors } = req.query;
    
    // Validate category exists
    const category = await Category.findById(id).lean();
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    
    let chainIds = [id];
    if (includeAncestors === "true") {
      let current = category;
      while (current && current.parentId) {
        chainIds.push(String(current.parentId));
        current = await Category.findById(current.parentId).lean();
      }
    }

    const attributes = await CategoryAttribute.find({ categoryId: { $in: chainIds } })
      .sort({ sortOrder: 1 })
      .lean();
    
    // Merge attributes, avoiding duplicates by name (ancestors first)
    const seen = new Set();
    const merged = [];
    
    // Reverse chain to have parents first if we want parent attributes to be overridden by child
    // Or keep current order and use Set to prevent child attributes from being overridden by parent?
    // Usually child attributes should override parent if names are same.
    // Let's use the same logic as in categoryAttributes.js
    
    const byCategory = chainIds.reduce((acc, cid) => {
      acc[cid] = [];
      return acc;
    }, {});
    
    for (const a of attributes) {
      const cid = String(a.categoryId);
      if (byCategory[cid]) byCategory[cid].push(a);
    }

    for (const cid of chainIds) {
      const list = (byCategory[cid] || []).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      for (const a of list) {
        const key = (a.name || "").toLowerCase();
        if (!key) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(a);
      }
    }

    res.json(merged.map(a => ({ ...a, id: a._id })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
