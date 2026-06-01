import Category from "../models/Category.js";
import Ad from "../models/Ad.js";

class CategoryService {
  // Simple in-memory cache
  static cache = new Map();
  static CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  static getCached(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  static setCached(key, data) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  static invalidateCache() {
    this.cache.clear();
  }

  /**
   * Get category depth (0 = main, 1 = subcategory, 2 = sub-subcategory)
   */
  static async getDepth(categoryId) {
    let depth = 0;
    let current = await Category.findById(categoryId).lean();
    while (current && current.parentId) {
      depth++;
      current = await Category.findById(current.parentId).lean();
    }
    return depth;
  }

  /**
   * Check if setting a parent would create a circular reference
   */
  static async wouldCreateCircularRef(categoryId, parentId) {
    if (!parentId) return false;
    if (parentId.toString() === categoryId.toString()) return true;

    let current = await Category.findById(parentId).lean();
    while (current) {
      if (current._id.toString() === categoryId.toString()) return true;
      current = current.parentId
        ? await Category.findById(current.parentId).lean()
        : null;
    }
    return false;
  }

  /**
   * Get all child category IDs recursively
   */
  static async getAllChildIds(parentId) {
    const children = await Category.find({ parentId }).select("_id").lean();
    let allIds = children.map((c) => String(c._id));
    for (const child of children) {
      const grandChildren = await this.getAllChildIds(child._id);
      allIds = [...allIds, ...grandChildren];
    }
    return allIds;
  }

  /**
   * Update ad count for a category (includes subcategories)
   */
  static async updateAdCount(categoryId) {
    const childIds = await this.getAllChildIds(categoryId);
    const allCategoryIds = [categoryId, ...childIds];

    const count = await Ad.countDocuments({
      categoryId: { $in: allCategoryIds },
      status: "approved",
      isArchived: { $ne: true },
      sold: { $ne: true },
    });

    await Category.findByIdAndUpdate(categoryId, { adCount: count });
    return count;
  }

  /**
   * Get main categories with ad counts (cached)
   */
  static async getMainCategories(adType = null) {
    try {
      const cacheKey = `categories_main_${adType || "all"}`;
      const cached = this.getCached(cacheKey);
      if (cached) return cached;

      console.log(`CategoryService: Fetching main categories (adType: ${adType || "all"})...`);
      const categories = await Category.find({ parentId: null, status: "active" })
        .sort({ sortOrder: 1, name: 1 })
        .lean();
      
      console.log(`CategoryService: Found ${categories.length} main categories.`);

      // Build children map for counting
      const allCategories = await Category.find({ status: "active" })
        .select("_id parentId")
        .lean();
      const childrenMap = {};
      allCategories.forEach((cat) => {
        if (cat.parentId) {
          const parentId = String(cat.parentId);
          if (!childrenMap[parentId]) childrenMap[parentId] = [];
          childrenMap[parentId].push(String(cat._id));
        }
      });

      // Get ad counts
      console.log("CategoryService: Aggregating ad counts...");
      const matchStage = {
        status: "approved",
        isArchived: { $ne: true },
        sold: { $ne: true },
      };
      if (adType) matchStage.adType = adType;

      const adCounts = await Ad.aggregate([
        { $match: matchStage },
        { $group: { _id: "$categoryId", count: { $sum: 1 } } },
      ]);
      
      const countMap = {};
      adCounts.forEach((item) => {
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

      const categoriesWithCount = categories.map((c) => ({
        ...c,
        id: String(c._id),
        adCount: getTotalCount(String(c._id)),
      }));

      this.setCached(cacheKey, categoriesWithCount);
      console.log("CategoryService: Successfully prepared main categories with counts.");
      return categoriesWithCount;
    } catch (err) {
      console.error("CategoryService ERROR in getMainCategories:", err);
      throw err;
    }
  }

  /**
   * Get subcategories of a category
   */
  static async getSubcategories(parentId, adType = null) {
    const children = await Category.find({ parentId, status: "active" })
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    return Promise.all(
      children.map(async (child) => {
        const query = {
          categoryId: child._id,
          status: "approved",
          isArchived: { $ne: true },
          sold: { $ne: true },
        };
        if (adType) query.adType = adType;

        const count = await Ad.countDocuments(query);
        return {
          ...child,
          id: child._id,
          adCount: count,
        };
      })
    );
  }

  /**
   * Build category tree recursively
   */
  static async buildTree(parentId = null) {
    const categories = await Category.find({ parentId, status: "active" })
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    const result = [];
    for (const cat of categories) {
      const children = await this.buildTree(cat._id);
      result.push({
        ...cat,
        id: cat._id,
        children: children.length > 0 ? children : undefined,
        adCount: cat.adCount || 0,
      });
    }
    return result;
  }

  /**
   * Get breadcrumbs for a category
   */
  static async getBreadcrumbs(categoryId) {
    const breadcrumbs = [];
    let current = await Category.findById(categoryId).lean();
    while (current) {
      breadcrumbs.unshift({
        id: current._id,
        name: current.name,
        slug: current.slug,
      });
      current = current.parentId
        ? await Category.findById(current.parentId).lean()
        : null;
    }
    return breadcrumbs;
  }

  /**
   * Validate category can be created/updated
   */
  static async validateCategory(data, existingId = null) {
    const errors = [];

    if (!data.name) {
      errors.push("Name is required");
    }

    if (data.parentId) {
      // Check parent exists
      const parent = await Category.findById(data.parentId);
      if (!parent) {
        errors.push("Parent category not found");
      } else {
        // Check max depth
        const parentDepth = await this.getDepth(data.parentId);
        if (parentDepth >= 1) {
          errors.push(
            "Maximum category depth exceeded. Subcategories cannot have their own subcategories."
          );
        }
      }

      // Check circular reference
      if (await this.wouldCreateCircularRef(existingId || "new", data.parentId)) {
        errors.push("Cannot set a descendant as parent (circular reference)");
      }

      // Check self-parenting
      if (data.parentId.toString() === existingId?.toString()) {
        errors.push("Category cannot be its own parent");
      }
    }

    return errors;
  }

  /**
   * Delete category with validation
   */
  static async deleteCategory(categoryId, options = {}) {
    const { moveAdsTo, moveChildrenTo } = options;

    const category = await Category.findById(categoryId);
    if (!category) {
      throw new Error("Category not found");
    }

    // Check for children
    const hasChildren = await Category.exists({ parentId: categoryId });
    if (hasChildren && !moveChildrenTo) {
      throw new Error(
        "Category has subcategories. Please provide moveChildrenTo or delete them first."
      );
    }

    // Check for ads
    const hasAds = await Ad.exists({ categoryId });
    if (hasAds && !moveAdsTo) {
      throw new Error(
        "Category has ads. Please provide moveAdsTo to move ads to another category."
      );
    }

    // Move children if specified
    if (moveChildrenTo) {
      const targetExists = await Category.exists({ _id: moveChildrenTo });
      if (!targetExists) {
        throw new Error("Target category for children not found");
      }
      await Category.updateMany({ parentId: categoryId }, { parentId: moveChildrenTo });
    }

    // Move ads if specified
    if (moveAdsTo) {
      const targetExists = await Category.exists({ _id: moveAdsTo });
      if (!targetExists) {
        throw new Error("Target category for ads not found");
      }
      await Ad.updateMany({ categoryId }, { categoryId: moveAdsTo });
      await this.updateAdCount(moveAdsTo);
    }

    // Delete the category
    await Category.findByIdAndDelete(categoryId);
    this.invalidateCache();

    return { message: "Category deleted successfully" };
  }
}

export default CategoryService;
