import express from "express";
import CategoryAttribute from "../models/CategoryAttribute.js";
import Category from "../models/Category.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// GET /category-attributes - Get all attributes (admin) or by category
router.get("/", async (req, res) => {
  try {
    const { categoryId, admin } = req.query;
    
    if (admin === "true") {
      const attributes = await CategoryAttribute.find()
        .populate("categoryId", "name slug")
        .sort({ categoryId: 1, sortOrder: 1 })
        .lean();
      return res.json(attributes.map(a => ({ ...a, id: a._id })));
    }
    
    if (!categoryId) {
      return res.status(400).json({ error: "categoryId is required" });
    }
    
    const attributes = await CategoryAttribute.find({ categoryId })
      .sort({ sortOrder: 1 })
      .lean();
    
    res.json(attributes.map(a => ({ ...a, id: a._id })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /category-attributes/category/:categoryId - Get attributes for a specific category
router.get("/category/:categoryId", async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { includeAncestors } = req.query || {};
    
    const category = await Category.findById(categoryId).lean();
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    if (String(includeAncestors) === "true") {
      const chainIds = [];
      let current = category;
      while (current) {
        chainIds.push(String(current._id));
        if (!current.parentId) break;
        current = await Category.findById(current.parentId).lean();
      }

      const attrs = await CategoryAttribute.find({ categoryId: { $in: chainIds } })
        .sort({ sortOrder: 1 })
        .lean();

      const byCategory = chainIds.reduce((acc, id) => {
        acc[id] = [];
        return acc;
      }, {});
      for (const a of attrs) {
        const cid = String(a.categoryId);
        if (!byCategory[cid]) byCategory[cid] = [];
        byCategory[cid].push(a);
      }

      const seen = new Set();
      const merged = [];
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

      res.json(merged.map((a) => ({ ...a, id: a._id })));
      return;
    }
    
    const attributes = await CategoryAttribute.find({ categoryId })
      .sort({ sortOrder: 1 })
      .lean();
    
    res.json(attributes.map(a => ({ ...a, id: a._id })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /category-attributes/:id - Get single attribute
router.get("/:id", async (req, res) => {
  try {
    const attribute = await CategoryAttribute.findById(req.params.id)
      .populate("categoryId", "name slug")
      .lean();
    
    if (!attribute) {
      return res.status(404).json({ error: "Attribute not found" });
    }
    
    res.json({ ...attribute, id: attribute._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /category-attributes - Create new attribute (admin only)
router.post("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const { 
      categoryId, 
      name, 
      label, 
      type, 
      options, 
      required, 
      sortOrder, 
      placeholder,
      helpText,
      validation 
    } = req.body;
    
    if (!categoryId || !name || !label || !type) {
      return res.status(400).json({ 
        error: "categoryId, name, label, and type are required" 
      });
    }
    
    // Verify category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    
    // Check for duplicate name in same category
    const existing = await CategoryAttribute.findOne({ categoryId, name });
    if (existing) {
      return res.status(400).json({ 
        error: "Attribute with this name already exists for this category" 
      });
    }
    
    // Validate type-specific requirements
    if ((type === "select" || type === "multiselect") && (!options || options.length === 0)) {
      return res.status(400).json({ 
        error: "Options are required for select/multiselect types" 
      });
    }
    
    const attribute = new CategoryAttribute({
      categoryId,
      name: name.toLowerCase().trim().replace(/\s+/g, "_"),
      label: label.trim(),
      type,
      options: options || [],
      required: required || false,
      sortOrder: sortOrder || 0,
      placeholder: placeholder || "",
      helpText: helpText || "",
      validation: validation || {}
    });
    
    await attribute.save();
    
    const populated = await CategoryAttribute.findById(attribute._id)
      .populate("categoryId", "name slug")
      .lean();
    
    res.status(201).json({ ...populated, id: populated._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /category-attributes/:id - Update attribute (admin only)
router.put("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      label, 
      type, 
      options, 
      required, 
      sortOrder, 
      placeholder,
      helpText,
      validation 
    } = req.body;
    
    const attribute = await CategoryAttribute.findById(id);
    if (!attribute) {
      return res.status(404).json({ error: "Attribute not found" });
    }
    
    // Check for duplicate name if name is being changed
    if (name && name !== attribute.name) {
      const existing = await CategoryAttribute.findOne({ 
        categoryId: attribute.categoryId, 
        name: name.toLowerCase().trim().replace(/\s+/g, "_"),
        _id: { $ne: id }
      });
      if (existing) {
        return res.status(400).json({ 
          error: "Attribute with this name already exists for this category" 
        });
      }
      attribute.name = name.toLowerCase().trim().replace(/\s+/g, "_");
    }
    
    // Validate type-specific requirements
    if (type && (type === "select" || type === "multiselect")) {
      if (!options || options.length === 0) {
        return res.status(400).json({ 
          error: "Options are required for select/multiselect types" 
        });
      }
      attribute.options = options;
    }
    
    if (label) attribute.label = label.trim();
    if (type) attribute.type = type;
    if (options !== undefined && type !== "select" && type !== "multiselect") {
      attribute.options = options;
    }
    if (required !== undefined) attribute.required = required;
    if (sortOrder !== undefined) attribute.sortOrder = sortOrder;
    if (placeholder !== undefined) attribute.placeholder = placeholder;
    if (helpText !== undefined) attribute.helpText = helpText;
    if (validation !== undefined) attribute.validation = validation;
    
    await attribute.save();
    
    const populated = await CategoryAttribute.findById(attribute._id)
      .populate("categoryId", "name slug")
      .lean();
    
    res.json({ ...populated, id: populated._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /category-attributes/:id - Delete attribute (admin only)
router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const attribute = await CategoryAttribute.findById(id);
    if (!attribute) {
      return res.status(404).json({ error: "Attribute not found" });
    }
    
    // Check if any listings use this attribute
    const AdAttributeValue = (await import("../models/AdAttributeValue.js")).default;
    const usageCount = await AdAttributeValue.countDocuments({ attributeId: id });
    
    if (usageCount > 0) {
      // For safety, we delete associated values when an attribute is deleted
      await AdAttributeValue.deleteMany({ attributeId: id });
      console.log(`Deleted ${usageCount} associated attribute values for attribute ${id}`);
    }
    
    await CategoryAttribute.findByIdAndDelete(id);
    
    res.json({ message: "Attribute deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /category-attributes/reorder - Reorder attributes (admin only)
router.post("/reorder", authenticate, requireAdmin, async (req, res) => {
  try {
    const { attributes } = req.body;
    
    if (!Array.isArray(attributes)) {
      return res.status(400).json({ error: "Attributes array is required" });
    }
    
    const bulkOps = attributes.map((attr, index) => ({
      updateOne: {
        filter: { _id: attr.id },
        update: { sortOrder: index }
      }
    }));
    
    await CategoryAttribute.bulkWrite(bulkOps);
    res.json({ message: "Attributes reordered successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /category-attributes/copy - Copy attributes from one category to another (admin only)
router.post("/copy", authenticate, requireAdmin, async (req, res) => {
  try {
    const { sourceCategoryId, targetCategoryId } = req.body;
    
    if (!sourceCategoryId || !targetCategoryId) {
      return res.status(400).json({ 
        error: "sourceCategoryId and targetCategoryId are required" 
      });
    }
    
    // Verify both categories exist
    const [sourceCategory, targetCategory] = await Promise.all([
      Category.findById(sourceCategoryId),
      Category.findById(targetCategoryId)
    ]);
    
    if (!sourceCategory) {
      return res.status(404).json({ error: "Source category not found" });
    }
    if (!targetCategory) {
      return res.status(404).json({ error: "Target category not found" });
    }
    
    // Get attributes from source
    const sourceAttributes = await CategoryAttribute.find({ categoryId: sourceCategoryId }).lean();
    
    // Create copies for target
    const createdAttributes = await Promise.all(
      sourceAttributes.map(async (attr) => {
        const newAttr = new CategoryAttribute({
          categoryId: targetCategoryId,
          name: attr.name,
          label: attr.label,
          type: attr.type,
          options: attr.options,
          required: attr.required,
          sortOrder: attr.sortOrder,
          placeholder: attr.placeholder,
          helpText: attr.helpText,
          validation: attr.validation
        });
        return newAttr.save();
      })
    );
    
    res.status(201).json({
      message: `Copied ${createdAttributes.length} attributes`,
      count: createdAttributes.length,
      attributes: createdAttributes.map(a => ({ ...a.toObject(), id: a._id }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
